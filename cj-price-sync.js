/**
 * cj-price-sync.js — Preis-Beobachtung über die CJ-Produktlinks aus der
 * Excel-Preisliste (excel/Maios Produkte.csv).
 *
 * WICHTIG: Aendert NIEMALS automatisch den Verkaufspreis in products.json.
 * Der Grund: die CJ-API kann (wie am 25.07. real getestet) leere/fehlerhafte
 * Antworten liefern (abgelaufenes Token, Rate-Limit, temporaerer Ausfall) —
 * ein automatischer Preis-Write auf Basis einer moeglicherweise fehlerhaften
 * externen Quelle waere ein echtes Risiko fuer einen Live-Shop. Stattdessen:
 * beobachten, vergleichen, bei echter Abweichung eine Mail an den Shop-Betreiber,
 * der dann selbst entscheidet.
 *
 * Zuordnung CSV-Zeile -> Produkt: nur ueber die numerische CJ-Produkt-ID aus dem
 * Link, per Teilstring-Abgleich gegen products.json[].sku. Der Produktname in der
 * Excel-Liste ist oft informell/abweichend (z.B. "Wasserflaschen-Dispenser" statt
 * "Elektrischer Wasserspender für Schreibtisch") und daher NICHT zuverlaessig genug
 * fuer eine Finanz-relevante Zuordnung. Produkte ohne passende SKU werden bewusst
 * uebersprungen statt geraten zuzuordnen.
 */

const fs = require('fs');
const path = require('path');
const { dbOperations } = require('./database');
const emailService = require('./resend-service');

const CSV_PATH = path.join(__dirname, 'excel', 'Maios Produkte.csv');
const CJ_LINK_RE = /cjdropshipping\.com\/product\/[^;,\s]*-p-(\d{10,})/;
const PRICE_ALERT_THRESHOLD_PCT = 5; // ab dieser Abweichung wird gewarnt
const PRICE_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 Warnung/Produkt/Tag max.

/** Liest alle validen CJ-Produkt-IDs aus der Excel-CSV (eindeutig, dedupliziert). */
function extractCjPidsFromCsv() {
  if (!fs.existsSync(CSV_PATH)) return [];
  const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).slice(1);
  const pids = new Set();
  for (const line of lines) {
    const m = line.match(CJ_LINK_RE);
    if (m) pids.add(m[1]);
  }
  return [...pids];
}

/** Ordnet eine CJ-Produkt-ID einem Produkt aus products.json zu (ueber sku). */
function matchProductByPid(pid, products) {
  return products.find((p) => p && typeof p.sku === 'string' && p.sku.includes(pid)) || null;
}

/**
 * Fragt den aktuellen CJ-Preis fuer eine Produkt-ID ab. Gibt bei JEDER
 * Unsicherheit (Fehler, kein Token, leere/unerwartete Antwort) null zurueck —
 * nie einen geratenen Wert. Prueft mehrere bekannte CJ-Feldnamen defensiv.
 */
async function fetchCjPrice(cjAPI, pid) {
  try {
    const result = await cjAPI.queryProductVariant(pid);
    if (!result || result.success === false || result.result === false) return null;
    const variants = Array.isArray(result.data) ? result.data : [];
    if (!variants.length) return null;
    const prices = variants
      .map((v) => Number(v.variantSellPrice ?? v.sellPrice ?? v.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!prices.length) return null;
    return Math.min(...prices);
  } catch (e) {
    console.warn('⚠️ CJ-Preisabfrage fehlgeschlagen für', pid, '-', e.message);
    return null;
  }
}

/**
 * Fuehrt den Abgleich aus. Gibt eine Zusammenfassung zurueck; wirft nie.
 */
async function runCjPriceSync(cjAPI) {
  const summary = { linksInCsv: 0, matched: 0, checked: 0, unavailable: 0, changes: [] };
  try {
    const pids = extractCjPidsFromCsv();
    summary.linksInCsv = pids.length;
    const products = require('./products.json');

    for (const pid of pids) {
      const product = matchProductByPid(pid, products);
      if (!product) continue;
      summary.matched++;

      const currentPrice = await fetchCjPrice(cjAPI, pid);
      // CJ laesst rund eine Anfrage pro Sekunde zu. 400 ms waren zu schnell:
      // beim Lauf am 02.08. kamen von drei Produkten nur zwei durch.
      await new Promise((r) => setTimeout(r, 1100));
      if (currentPrice == null) { summary.unavailable++; continue; }
      summary.checked++;

      const cached = await dbOperations.getCjPriceWatch(product.id);
      if (!cached) {
        await dbOperations.upsertCjPriceWatch(product.id, pid, currentPrice, false);
        continue; // erster Lauf = Baseline, kein Alarm
      }

      const changePct = cached.last_price > 0
        ? Math.abs(currentPrice - cached.last_price) / cached.last_price * 100
        : 0;
      const canAlertAgain = !cached.last_alert_at ||
        (Date.now() - new Date(cached.last_alert_at).getTime()) > PRICE_ALERT_COOLDOWN_MS;

      if (changePct >= PRICE_ALERT_THRESHOLD_PCT && canAlertAgain) {
        summary.changes.push({
          productId: product.id, name: product.name,
          oldPrice: cached.last_price, newPrice: currentPrice, changePct
        });
        await dbOperations.upsertCjPriceWatch(product.id, pid, currentPrice, true);
      } else {
        await dbOperations.upsertCjPriceWatch(product.id, pid, currentPrice, false);
      }
    }

    if (summary.changes.length) {
      const to = process.env.CJ_PRICE_ALERT_EMAIL || process.env.RECEIPT_ARCHIVE_EMAIL || 'maioscorporation@gmail.com';
      const rows = summary.changes.map((c) =>
        `<li><strong>${c.name}</strong> (#${c.productId}): ${c.oldPrice.toFixed(2)}€ → ${c.newPrice.toFixed(2)}€ ` +
        `(${c.newPrice > c.oldPrice ? '+' : ''}${(c.newPrice - c.oldPrice).toFixed(2)}€, ${c.changePct.toFixed(1)}%)</li>`
      ).join('');
      await emailService.sendEmail({
        to,
        subject: `💱 CJ-Einkaufspreis geändert bei ${summary.changes.length} Produkt(en)`,
        html: `<h2>CJ-Einkaufspreis-Änderung erkannt</h2>` +
          `<p>Bei folgenden Produkten hat sich der CJ-Einkaufspreis um ${PRICE_ALERT_THRESHOLD_PCT}%+ verändert. ` +
          `Der Verkaufspreis wurde <strong>nicht</strong> automatisch angepasst — bitte selbst prüfen, ob die Marge noch passt.</p>` +
          `<ul>${rows}</ul>`
      }).catch((e) => console.warn('⚠️ CJ-Preis-Alarm-Mail fehlgeschlagen:', e.message));
    }
  } catch (e) {
    console.error('❌ CJ-Preisabgleich fehlgeschlagen:', e.message);
  }
  return summary;
}

module.exports = { runCjPriceSync, extractCjPidsFromCsv, matchProductByPid, fetchCjPrice };
