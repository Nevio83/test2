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

// CJ laesst rund EINE Anfrage pro Sekunde zu (live nachgewiesen an der
// Token-Anfrage: "QPS limit is 1 time/1second"). Der Bestand muss pro Variante
// einzeln geholt werden — bei 12 Varianten sind das 12 Aufrufe. Mit 400 ms
// waeren wir schneller als erlaubt und wuerden uns selbst ausbremsen.
const REQUEST_PAUSE_MS = 1100;
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;         // max. 1 Meldung/Produkt/Tag

/**
 * Liest eine Bestandszahl aus einem CJ-Antwortobjekt. null = keine Aussage.
 *
 * ⚠️ Hier lag am 02.08. ein teurer Fehler: geprueft wurde mit
 * `Number.isFinite(Number(c))`. Number(null) ist aber 0 — und 0 ist endlich.
 * CJ liefert in der Variantenantwort `inventoryNum: null` (der Bestand steht
 * dort schlicht nicht drin, sondern nur unter /product/stock/queryByVid).
 * Ein FEHLENDES Feld sah damit aus wie ein LEERES LAGER: drei Produkte wurden
 * im Live-Shop als ausverkauft gesperrt, obwohl CJ 12.388 Stueck meldete.
 * Dieselbe Falle gilt fuer '', [] und false — alle ergeben Number() === 0.
 *
 * Deshalb: nur echte Zahlen und reine Zahl-Zeichenketten zaehlen. Alles andere
 * ist "keine Aussage" und laesst die Verfuegbarkeit unveraendert.
 */
function readStockValue(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.storageNum, obj.stockNum, obj.quantity, obj.totalInventory,
    obj.inventoryNum, obj.num, obj.count
  ];
  for (const c of candidates) {
    if (typeof c === 'number') {
      if (Number.isFinite(c) && c >= 0) return c;
      continue;
    }
    if (typeof c === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(c)) {
      const n = Number(c);
      if (Number.isFinite(n) && n >= 0) return n;
    }
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
    nowUnavailable: [], backInStock: [], notified: 0
  };

  try {
    const pids = extractCjPidsFromCsv();
    summary.linksInCsv = pids.length;
    const products = require('./products.json');

    // Erst alles einsammeln, dann entscheiden. Vorher wurde jedes Produkt
    // sofort geschrieben — dadurch liess sich nicht mehr erkennen, ob ein
    // Ergebnis fuer sich plausibel ist oder ob der ganze Lauf danebenlag.
    const messwerte = [];
    for (const pid of pids) {
      const product = matchProductByPid(pid, products);
      if (!product) continue;
      summary.matched++;

      const stock = await fetchCjStock(cjAPI, pid);
      if (stock === null) { summary.unavailable++; continue; } // keine Aussage -> nichts aendern
      summary.checked++;
      messwerte.push({ pid, product, stock });
    }

    // ⚠️ Plausibilitaetsbremse: melden ALLE geprueften Produkte gleichzeitig
    // null, ist ein Lesefehler weit wahrscheinlicher als ein gleichzeitiger
    // Ausverkauf des ganzen Sortiments. Am 02.08. genau so passiert — ein
    // fehlendes Feld wurde als Bestand 0 gelesen und sperrte drei Produkte im
    // Live-Shop. Ab zwei geprueften Produkten wird ein solcher Lauf verworfen.
    const alleNull = messwerte.length >= 2 && messwerte.every((m) => m.stock === 0);
    if (alleNull) {
      summary.verworfen = true;
      summary.checked = 0;
      summary.unavailable = summary.matched;
      console.warn(`⚠️ CJ meldete für ALLE ${messwerte.length} geprüften Produkte Bestand 0 — ` +
        'das sieht nach einem Lesefehler aus, nicht nach Ausverkauf. Lauf verworfen, ' +
        'Verfügbarkeit unverändert gelassen.');
      await sendOpsHinweis(messwerte.length);
      return summary;
    }

    for (const { pid, product, stock } of messwerte) {
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

    // Kunden benachrichtigen, die sich fuer ein wieder lieferbares Produkt
    // vorgemerkt haben. Laeuft NACH der Betreiber-Meldung und faengt eigene
    // Fehler ab — ein Mail-Problem darf den Abgleich nicht scheitern lassen.
    for (const p of summary.backInStock) {
      try {
        summary.notified += await notifyWaitingCustomers(p);
      } catch (e) {
        console.warn('⚠️ Benachrichtigung der Vormerkungen fehlgeschlagen für', p.productId, '-', e.message);
      }
    }
  } catch (e) {
    console.error('❌ CJ-Bestandsabgleich fehlgeschlagen:', e.message);
    summary.error = e.message;
  }

  return summary;
}

/**
 * Benachrichtigt alle Kunden, die sich fuer dieses Produkt vorgemerkt haben.
 *
 * Die Vormerkungen werden erst geloescht, NACHDEM alle Mails abgesetzt wurden —
 * bricht der Versand vorher ab, bleiben sie erhalten und der naechste Lauf
 * versucht es erneut. Umgekehrt (erst loeschen, dann senden) waere ein Fehler
 * mitten im Versand endgueltig.
 *
 * @returns {Promise<number>} Anzahl erfolgreich benachrichtigter Adressen
 */
async function notifyWaitingCustomers(produkt) {
  const wartende = await dbOperations.getStockNotifications(produkt.productId);
  if (!wartende.length) return 0;

  const basis = (process.env.REPL_URL || 'https://maiosshop.com').replace(/\/+$/, '');
  const produkte = require('./products.json');
  const daten = produkte.find((p) => Number(p.id) === Number(produkt.productId)) || {};
  const link = daten.slug ? `${basis}/produkte/${daten.slug}.html` : basis;

  let erfolge = 0;
  for (const w of wartende) {
    const abmelden = `${basis}/api/stock-notify/cancel?token=${encodeURIComponent(w.cancel_token)}`;
    const r = await emailService.sendEmail({
      to: w.email,
      subject: `Wieder da: ${produkt.name}`,
      html:
        `<div style="font-family:sans-serif;max-width:520px">` +
        `<h2 style="margin:0 0 12px">Gute Nachricht — wieder verfügbar</h2>` +
        `<p>Du hattest dich benachrichtigen lassen, sobald <strong>${produkt.name}</strong> ` +
        `wieder lieferbar ist. Genau das ist jetzt der Fall.</p>` +
        `<p style="margin:24px 0"><a href="${link}" ` +
        `style="background:#D8B56C;color:#13100B;text-decoration:none;padding:13px 26px;` +
        `border-radius:999px;font-weight:700;display:inline-block">Zum Produkt</a></p>` +
        `<p style="color:#777;font-size:13px">Beliebte Artikel sind erfahrungsgemäß schnell wieder weg.</p>` +
        `<hr style="border:none;border-top:1px solid #eee;margin:22px 0">` +
        `<p style="color:#999;font-size:12px">Du erhältst diese Nachricht einmalig, weil du sie ` +
        `auf maiosshop.com angefordert hast. Es folgt keine weitere E-Mail. ` +
        `<a href="${abmelden}" style="color:#999">Vormerkung vorher löschen</a></p></div>`,
      headers: { 'List-Unsubscribe': `<${abmelden}>` }
    });
    if (r && r.success !== false) erfolge++;
  }

  // Nur aufraeumen, wenn wirklich alle durchgingen.
  if (erfolge === wartende.length) {
    await dbOperations.clearStockNotifications(produkt.productId);
    console.log(`🔔 ${erfolge} Vormerkung(en) zu "${produkt.name}" benachrichtigt und entfernt`);
  } else {
    console.warn(`⚠️ Nur ${erfolge}/${wartende.length} Vormerkungen zu "${produkt.name}" zugestellt — Rest bleibt für den nächsten Lauf`);
  }
  return erfolge;
}

/**
 * Hinweis, wenn ein Lauf wegen Unplausibilitaet verworfen wurde. Das ist keine
 * Ausverkauf-Meldung, sondern der Hinweis, dass die CJ-Antwort nicht mehr zum
 * erwarteten Aufbau passt — dann muss jemand nachsehen.
 */
async function sendOpsHinweis(anzahl) {
  const to = process.env.CJ_STOCK_ALERT_EMAIL ||
    process.env.RECEIPT_ARCHIVE_EMAIL ||
    'maioscorporation@gmail.com';
  await emailService.sendEmail({
    to,
    subject: '⚠️ CJ-Bestandsabgleich verworfen — Antwort wirkt unplausibel',
    html:
      `<h2>Bestandsabgleich wurde nicht angewendet</h2>` +
      `<p>CJ meldete für <strong>alle ${anzahl} geprüften Produkte gleichzeitig Bestand 0</strong>. ` +
      `Ein gleichzeitiger Ausverkauf des gesamten zugeordneten Sortiments ist unwahrscheinlich — ` +
      `wahrscheinlicher hat sich der Aufbau der CJ-Antwort geändert.</p>` +
      `<p><strong>Im Shop wurde nichts gesperrt.</strong> Alle Produkte bleiben verkäuflich. ` +
      `Bitte den Bestandsweg prüfen (<code>/product/stock/queryByVid</code>), bevor der Abgleich ` +
      `wieder greift.</p>`
  }).catch((e) => console.warn('⚠️ Hinweis-Mail fehlgeschlagen:', e.message));
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
