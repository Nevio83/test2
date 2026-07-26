/**
 * cj-stock-sync.js — Verfuegbarkeit gegen den CJ-Lagerbestand abgleichen.
 *
 * Problem: Ob ein Produkt lieferbar ist, stand bisher als fester Wert in
 * products.json und wurde nie aktualisiert — ausgewertet wurde er ohnehin
 * nirgends. Ist bei CJ etwas ausverkauft, kaufen Kunden trotzdem weiter:
 * Rueckerstattung, Aerger, schlechte Bewertung.
 *
 * Zuordnung Produkt -> CJ: identisch zum Preis-Abgleich (numerische CJ-Produkt-ID
 * aus der Excel-Liste, per Teilstring gegen products.json[].sku). Produkte ohne
 * sichere Zuordnung werden uebersprungen, nicht geraten.
 *
 * ⚠️ SICHERHEITSREGEL: "nicht lieferbar" wird NUR gesetzt, wenn CJ eine
 * eindeutig erfolgreiche Antwort mit einer konkreten Bestandszahl 0 liefert.
 * Jede Unsicherheit — Fehler, abgelaufenes Token, leere oder unerwartete
 * Antwort — laesst die Verfuegbarkeit unveraendert. Ein Ausfall bei CJ darf
 * niemals dazu fuehren, dass der halbe Shop als ausverkauft erscheint.
 *
 * Hinweis zur Antwortstruktur: das CJ-Token ist derzeit abgelaufen (401), die
 * genauen Feldnamen liessen sich also nicht am Live-System gegenpruefen. Die
 * Auswertung testet deshalb mehrere bekannte Schreibweisen und faellt bei
 * allem Unbekannten auf "keine Aussage" zurueck statt zu raten.
 */

const { dbOperations } = require('./database');
const emailService = require('./resend-service');
const { extractCjPidsFromCsv, matchProductByPid } = require('./cj-price-sync');

const REQUEST_PAUSE_MS = 400;                          // schont CJs Rate-Limit
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;         // max. 1 Meldung/Produkt/Tag

/** Liest eine Bestandszahl aus einem CJ-Antwortobjekt. null = keine Aussage. */
function readStockValue(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.storageNum, obj.stockNum, obj.quantity, obj.totalInventory,
    obj.inventoryNum, obj.num, obj.count
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Ermittelt den Gesamtbestand eines CJ-Produkts ueber alle Varianten.
 * @returns {number|null} Summe, oder null wenn keine belastbare Aussage moeglich ist.
 */
async function fetchCjStock(cjAPI, pid) {
  try {
    const variantRes = await cjAPI.queryProductVariant(pid);
    if (!variantRes || variantRes.success === false || variantRes.result === false) return null;
    const variants = Array.isArray(variantRes.data) ? variantRes.data : [];
    if (!variants.length) return null;

    let total = 0;
    let gotAnyNumber = false;

    for (const v of variants) {
      // Manche Antworten tragen den Bestand direkt an der Variante.
      let n = readStockValue(v);

      if (n === null && v.vid) {
        const stockRes = await cjAPI.getProductStockByVid(v.vid);
        await new Promise((r) => setTimeout(r, REQUEST_PAUSE_MS));
        if (stockRes && stockRes.success !== false && stockRes.result !== false) {
          const rows = Array.isArray(stockRes.data) ? stockRes.data : [stockRes.data];
          for (const row of rows) {
            const rowNum = readStockValue(row);
            if (rowNum !== null) { n = (n === null ? 0 : n) + rowNum; }
          }
        }
      }

      if (n !== null) { total += n; gotAnyNumber = true; }
    }

    // Keine einzige verwertbare Zahl -> lieber keine Aussage als eine falsche.
    return gotAnyNumber ? total : null;
  } catch (e) {
    console.warn('⚠️ CJ-Bestandsabfrage fehlgeschlagen für', pid, '-', e.message);
    return null;
  }
}

/**
 * Fuehrt den Abgleich aus. Wirft nie.
 * @returns {{matched:number, checked:number, unavailable:number, nowUnavailable:Array, backInStock:Array}}
 */
async function runCjStockSync(cjAPI) {
  const summary = {
    linksInCsv: 0, matched: 0, checked: 0, unavailable: 0,
    nowUnavailable: [], backInStock: []
  };

  try {
    const pids = extractCjPidsFromCsv();
    summary.linksInCsv = pids.length;
    const products = require('./products.json');

    for (const pid of pids) {
      const product = matchProductByPid(pid, products);
      if (!product) continue;
      summary.matched++;

      const stock = await fetchCjStock(cjAPI, pid);
      if (stock === null) { summary.unavailable++; continue; } // keine Aussage -> nichts aendern
      summary.checked++;

      const isAvailable = stock > 0;
      const cached = await dbOperations.getCjStockWatch(product.id);
      const wasAvailable = cached ? cached.available : true;
      const canAlertAgain = !cached || !cached.last_alert_at ||
        (Date.now() - new Date(cached.last_alert_at).getTime()) > ALERT_COOLDOWN_MS;

      const changedToUnavailable = wasAvailable && !isAvailable;
      const changedToAvailable = !wasAvailable && isAvailable;
      const shouldAlert = changedToUnavailable && canAlertAgain;

      if (changedToUnavailable) {
        summary.nowUnavailable.push({ productId: product.id, name: product.name, stock });
      } else if (changedToAvailable) {
        summary.backInStock.push({ productId: product.id, name: product.name, stock });
      }

      await dbOperations.upsertCjStockWatch(product.id, pid, stock, isAvailable, shouldAlert);
    }

    if (summary.nowUnavailable.length || summary.backInStock.length) {
      await sendStockAlert(summary);
    }
  } catch (e) {
    console.error('❌ CJ-Bestandsabgleich fehlgeschlagen:', e.message);
    summary.error = e.message;
  }

  return summary;
}

/** Meldung bei Verfuegbarkeitswechsel. */
async function sendStockAlert(summary) {
  const to = process.env.CJ_STOCK_ALERT_EMAIL ||
    process.env.RECEIPT_ARCHIVE_EMAIL ||
    'maioscorporation@gmail.com';

  const out = summary.nowUnavailable.map((p) =>
    `<li><strong>${p.name}</strong> (#${p.productId}) — CJ-Bestand ${p.stock}</li>`).join('');
  const back = summary.backInStock.map((p) =>
    `<li><strong>${p.name}</strong> (#${p.productId}) — CJ-Bestand ${p.stock}</li>`).join('');

  await emailService.sendEmail({
    to,
    subject: summary.nowUnavailable.length
      ? `📦 ${summary.nowUnavailable.length} Produkt(e) bei CJ ausverkauft`
      : `📦 ${summary.backInStock.length} Produkt(e) wieder lieferbar`,
    html:
      `<h2>Verfügbarkeit hat sich geändert</h2>` +
      (out ? `<p><strong>Ab sofort im Shop als „derzeit nicht lieferbar" markiert</strong> ` +
        `(kein Kauf mehr möglich):</p><ul>${out}</ul>` : '') +
      (back ? `<p><strong>Wieder lieferbar</strong> (im Shop wieder freigegeben):</p><ul>${back}</ul>` : '') +
      `<p style="margin-top:14px"><small>Geprüft: ${summary.checked} Produkte · ` +
      `${summary.unavailable}× keine belastbare CJ-Antwort (Verfügbarkeit dort unverändert gelassen).</small></p>`
  }).catch((e) => console.warn('⚠️ Bestands-Meldung fehlgeschlagen:', e.message));
}

module.exports = { runCjStockSync, fetchCjStock, readStockValue };
