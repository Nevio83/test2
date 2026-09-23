/**
 * Tests fuer die automatische Bestellung bei CJ.
 *
 * Anlass, am 23.09.2026 bei der ERSTEN echten Bestellung aufgefallen: Eine
 * Kundin kaufte eine Krystall Ball Nachtlampe in der Farbe "Mond" und
 * bezahlte. Bei CJ kam nie eine Bestellung an — die Kette war an sieben
 * Stellen gebrochen:
 *
 *   1. validateCart warf die gewaehlte Farbe weg
 *   2. die Kasse gab Stripe nur den Namen, keine Produkt-ID, Farbe oder SKU
 *   3. der Webhook suchte die Lieferadresse am falschen Ort
 *   4. der Webhook nahm die STRIPE-Produktnummer als Shop-Produkt-ID
 *   5. an CJ ging die SKU des Produkts statt der Varianten-Nummer der Farbe
 *   6. die Adresse ging verschachtelt statt flach, Versand "aus Deutschland"
 *   7. lehnte CJ ab, erfand der Notbetrieb eine erfolgreiche Bestellung
 *
 * Der Nachbau von CJ unten liefert GENAU die Antwortformen, die CJ am 23.09.
 * live geliefert hat — nicht bequemere. Ein Nachbau, der sich anders verhaelt
 * als das Original, prueft den falschen Fall.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const cj = require('../cj-bestellung');
const { validateCart } = require('../price-validator');

const WURZEL = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(WURZEL, 'cj-dropshipping-api.js'), 'utf8');

// Echte Werte vom 23.09. (Krystall Ball Nachtlampe, Variante "Moon 6CM").
const MOND_SKU = 'CJJT153840404DW';
const MOND_VID = '1555129918705643520';
const PRODUKT_SKU = 'CJJT153840401AZ';   // die SKU, die frueher faelschlich rausging

const ADRESSE = {
  line1: 'Lore-Dauer-Straße 3', line2: null, city: 'Ludwigshafen am Rhein',
  postal_code: '67071', country: 'DE', state: null,
};

/** CJ-Nachbau mit den echten Antwortformen. */
function nachbauCj({ varianten = { [MOND_SKU]: MOND_VID }, versand, bestellung, notbetrieb = {} } = {}) {
  const aufrufe = { query: 0, fracht: 0, bestellung: 0, letzteNutzlast: null };
  return {
    aufrufe,
    async makeRequest(pfad) {
      aufrufe.query++;
      if (notbetrieb.query) return { success: true, data: [], source: 'fallback' };
      const sku = new URL('http://x' + pfad).searchParams.get('variantSku');
      const vid = varianten[sku];
      return { code: 200, result: true, message: 'Success',
        data: { pid: '1555129918592397312', variants: vid ? [{ vid, variantSku: sku, variantKey: 'Solid Wood Lamp Holder-Moon 6CM' }] : [] } };
    },
    async freightCalculate() {
      aufrufe.fracht++;
      if (notbetrieb.fracht) return { success: true, data: { cost: 0, currency: 'EUR' }, source: 'fallback' };
      return { code: 200, result: true, data: versand || [
        { logisticName: 'CJPacket Sensitive', logisticPrice: 9.71 },
        { logisticName: 'YunExpress Ordinary', logisticPrice: 7.75 },
        { logisticName: 'CJPacket Postal', logisticPrice: 14.08 },
      ] };
    },
    async createOrderV2(nutzlast) {
      aufrufe.bestellung++;
      aufrufe.letzteNutzlast = nutzlast;
      if (bestellung) return bestellung;
      return { code: 200, result: true, message: 'Success', data: { orderId: 'CJ2609230001' } };
    },
  };
}

const bestellungMond = () => ({
  zahlungsId: 'pi_3UIZuMFTodqoWLSI0j0s4pDp',
  adresse: ADRESSE, name: 'Emrah Cardak', email: 'kunde@example.invalid', telefon: '+49 000',
  positionen: [{ sku: MOND_SKU, quantity: 1, bezeichnung: 'Krystall Ball Nachtlampe (Mond)' }],
});

// ── 1. Die Farbe ueberlebt den Warenkorb ────────────────────────────────

test('validateCart behaelt die Farbe und loest die SKU aus dem KATALOG auf', () => {
  const [p] = validateCart([{ id: 50, price: 17.99, quantity: 1, selectedColor: 'Mond', selectedColorSku: 'GEFAELSCHT' }]);
  assert.equal(p.farbe, 'Mond');
  assert.equal(p.sku, MOND_SKU, 'die SKU muss aus products.json kommen');
  assert.notEqual(p.sku, 'GEFAELSCHT', 'eine vom Browser geschickte SKU darf nicht durchgehen');
});

test('eine unbekannte Farbe wird zu null statt erfunden', () => {
  const [p] = validateCart([{ id: 50, price: 17.99, quantity: 1, selectedColor: 'Gibtsnicht' }]);
  assert.equal(p.farbe, null);
});

// ── 2.–4. Kasse und Webhook tragen die Daten weiter ─────────────────────

test('die Kasse gibt Produkt, Farbe und SKU an Stripe weiter', () => {
  assert.match(server, /product_data: \{ name: item\.name, metadata: cjMetadaten\(item\) \}/);
  assert.ok(!/product_data: \{ name: item\.name \},/.test(server),
    'keine Stelle darf mehr nur den Namen weitergeben');
});

test('der Webhook laedt die Produkt-Metadaten und liest die Adresse am neuen Ort', () => {
  assert.match(server, /expand: \['line_items\.data\.price\.product', 'customer'\]/);
  assert.match(server, /collected_information\.shipping_details/);
  assert.ok(!/product_id: item\.price\.product,/.test(server),
    'die Stripe-Produktnummer darf nicht mehr als Shop-Produkt-ID dienen');
});

// ── 5.–6. Die richtige Bestellung bei CJ ────────────────────────────────

test('die Bestellung geht mit der VARIANTEN-Nummer der Farbe raus', async () => {
  const api = nachbauCj();
  const { nutzlast } = await cj.bereiteVor(api, bestellungMond());
  assert.deepEqual(nutzlast.products, [{ vid: MOND_VID, quantity: 1 }]);
  assert.notEqual(nutzlast.products[0].vid, PRODUKT_SKU, 'die SKU ist keine Varianten-Nummer');
});

test('die Adresse geht in CJs flachem Format raus, Versand aus China', async () => {
  const { nutzlast } = await cj.bereiteVor(nachbauCj(), bestellungMond());
  assert.equal(nutzlast.shippingCustomerName, 'Emrah Cardak');
  assert.equal(nutzlast.shippingAddress, 'Lore-Dauer-Straße 3');
  assert.equal(nutzlast.shippingZip, '67071');
  assert.equal(nutzlast.shippingCity, 'Ludwigshafen am Rhein');
  assert.equal(nutzlast.shippingCountryCode, 'DE');
  assert.equal(nutzlast.shippingCountry, 'Germany');
  assert.equal(nutzlast.fromCountryCode, 'CN', 'die Ware liegt in China, nicht in Deutschland');
  assert.equal(typeof nutzlast.shippingAddress, 'string', 'keine verschachtelte Adresse');
});

test('es wird der GUENSTIGSTE Versandweg genommen', async () => {
  const { nutzlast, versand } = await cj.bereiteVor(nachbauCj(), bestellungMond());
  assert.equal(versand.logisticName, 'YunExpress Ordinary');
  assert.equal(nutzlast.logisticName, 'YunExpress Ordinary');
});

test('die Bestellnummer haengt an der Zahlung — ein Wiederholungslauf bestellt nicht doppelt', () => {
  const a = cj.bestellnummerFuer('pi_3UIZuMFTodqoWLSI0j0s4pDp');
  const b = cj.bestellnummerFuer('pi_3UIZuMFTodqoWLSI0j0s4pDp');
  assert.equal(a, b, 'dieselbe Zahlung muss dieselbe Nummer ergeben');
  assert.equal(a, 'MAIOS-pi_3UIZuMFTodqoWLSI0j0s4pDp');
});

// ── Lieber gar nicht bestellen als das Falsche ──────────────────────────

test('fehlt die SKU, wird NICHT bestellt', async () => {
  const b = bestellungMond(); b.positionen[0].sku = null;
  await assert.rejects(cj.bereiteVor(nachbauCj(), b), /keine SKU/);
});

test('findet CJ die SKU nicht, wird NICHT bestellt', async () => {
  const b = bestellungMond(); b.positionen[0].sku = 'CJ-GIBTSNICHT';
  await assert.rejects(cj.bereiteVor(nachbauCj(), b), /nicht \(mehr\) zu finden/);
});

test('fehlt ein Teil der Adresse, wird NICHT bestellt — und die Meldung sagt, welcher', async () => {
  const b = bestellungMond(); b.adresse = { ...ADRESSE, postal_code: '', city: '' };
  await assert.rejects(cj.bereiteVor(nachbauCj(), b), /PLZ.*|Stadt/);
});

test('bietet CJ keinen Versand an, wird NICHT bestellt', async () => {
  await assert.rejects(cj.bereiteVor(nachbauCj({ versand: [] }), bestellungMond()), /keinen Versand/);
});

// ── 7. Der Notbetrieb erfindet keine Bestellungen mehr ──────────────────

test('eine Notbetriebs-Antwort beim Nachschlagen wird als Fehler behandelt', async () => {
  await assert.rejects(cj.bereiteVor(nachbauCj({ notbetrieb: { query: true } }), bestellungMond()), /nicht erreichbar/);
});

test('ein Notbetriebs-Versand von 0 € wird NICHT uebernommen', async () => {
  // Bei 3 Cent Marge waere ein ausgedachter Versand von 0 € der Unterschied
  // zwischen "lohnt sich" und Verlust.
  await assert.rejects(cj.bereiteVor(nachbauCj({ notbetrieb: { fracht: true } }), bestellungMond()), /nicht erreichbar/);
});

test('eine erfolgreiche CJ-Antwort liefert die echte Bestellnummer', async () => {
  const api = nachbauCj();
  const { nutzlast } = await cj.bereiteVor(api, bestellungMond());
  const r = await cj.bestelle(api, nutzlast);
  assert.equal(r.cjBestellnummer, 'CJ2609230001');
});

test('lehnt CJ ab (result: false), ist das ein FEHLER, kein Erfolg', async () => {
  const api = nachbauCj({ bestellung: { code: 1600100, result: false, message: 'vid does not exist', data: null } });
  const { nutzlast } = await cj.bereiteVor(api, bestellungMond());
  await assert.rejects(cj.bestelle(api, nutzlast), /vid does not exist/);
});

test('eine Notbetriebs-"Bestellung" ist ein FEHLER, kein Erfolg', async () => {
  const api = nachbauCj({ bestellung: { success: true, data: { orderId: 'MOCK_123' }, source: 'fallback' } });
  const { nutzlast } = await cj.bereiteVor(api, bestellungMond());
  await assert.rejects(cj.bestelle(api, nutzlast), /nicht erreichbar|KEINE Bestellung/);
});

test('der CJ-Client erfindet beim Bestellen keinen Erfolg mehr', () => {
  const i = client.indexOf("endpoint.includes('/order/createOrderV2')");
  assert.ok(i > 0);
  const zweig = client.slice(i, i + 1400);
  // Nur den Code pruefen, nicht die Kommentare: Der Kommentar in diesem
  // Zweig zitiert bewusst den alten Aufruf, um zu erklaeren, was er anrichtete.
  const nurCode = zweig.split('\n').filter((z) => !/^\s*\/\//.test(z)).join('\n');
  assert.ok(!/fallbackSystem\.createOrder\(/.test(nurCode),
    'der Notbetrieb darf fuer Bestellungen keine Scheinbestellung mehr liefern');
  assert.match(zweig, /success: false/);
});

// ── Die Beleg-Rechnung ──────────────────────────────────────────────────

test('die Beleg-Rechnung wird als bezahlt markiert, BEVOR sie rausgeht', () => {
  const pay = server.indexOf('stripe.invoices.pay(finalizedInvoice.id, { paid_out_of_band: true })');
  const send = server.indexOf('await stripe.invoices.sendInvoice(finalizedInvoice.id)');
  assert.ok(pay > 0, 'paid_out_of_band fehlt');
  assert.ok(send > pay, 'sendInvoice muss NACH dem Markieren kommen');
  const zwischen = server.slice(pay, send);
  assert.match(zwischen, /if \(alsBezahltMarkiert\)/,
    'verschickt werden darf nur, wenn das Markieren geklappt hat');
});

test('der Webhook meldet einen Datenbankfehler NICHT als gescheiterte CJ-Bestellung', () => {
  const i = server.indexOf('cjErgebnis = await cjBestellung.bestelle');
  const j = server.indexOf('await dbOperations.addTracking', i);
  assert.ok(i > 0 && j > i);
  const zwischen = server.slice(i, j);
  assert.match(zwischen, /\} catch \(cjError\)/,
    'das Vermerken in der Datenbank muss AUSSERHALB des Bestell-try stehen');
});

// ── Gegenprobe ──────────────────────────────────────────────────────────

test('GEGENPROBE: der alte Nutzlast-Bau haette genau diese Pruefungen verfehlt', () => {
  // So baute der Webhook die CJ-Bestellung bis zum 23.09. — wortgetreu
  // nachgebildet, mit den Werten, die bei der ersten Bestellung ankamen
  // (product_sku und color waren leer, weil nie gesetzt).
  const item = { product_sku: null, product_id: 'prod_Sa8x2FTodqo', color: null, quantity: 1 };
  const alt = {
    orderNumber: 'ORD-zufall',
    shippingAddress: { name: 'Emrah Cardak', ...ADRESSE },
    products: [{ vid: item.product_sku || `PROD-${item.product_id}`, quantity: item.quantity, variantId: item.color || null }],
    shippingMethod: 'Standard',
    fromCountryCode: 'DE',
  };
  assert.notEqual(alt.products[0].vid, MOND_VID, 'Gegenprobe wertlos: alt waere richtig gewesen');
  assert.equal(alt.products[0].vid, 'PROD-prod_Sa8x2FTodqo', 'alt: eine erfundene Nummer aus der Stripe-ID');
  assert.equal(alt.fromCountryCode, 'DE', 'alt: falsches Versandland');
  assert.equal(typeof alt.shippingAddress, 'object', 'alt: verschachtelte Adresse');
  assert.equal(alt.logisticName, undefined, 'alt: kein Versandweg, den CJ kennt');
});
