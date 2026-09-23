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
function nachbauCj({ varianten = { [MOND_SKU]: MOND_VID }, preis = 1.71, versand, bestellung, notbetrieb = {} } = {}) {
  const aufrufe = { query: 0, fracht: 0, bestellung: 0, letzteNutzlast: null };
  return {
    aufrufe,
    async makeRequest(pfad) {
      aufrufe.query++;
      if (notbetrieb.query) return { success: true, data: [], source: 'fallback' };
      const sku = new URL('http://x' + pfad).searchParams.get('variantSku');
      const vid = varianten[sku];
      // variantSellPrice 1.71 ist der echte Einkaufspreis vom 23.09. — in USD.
      return { code: 200, result: true, message: 'Success',
        data: { pid: '1555129918592397312', variants: vid ? [{ vid, variantSku: sku, variantKey: 'Solid Wood Lamp Holder-Moon 6CM', variantSellPrice: preis }] : [] } };
    },
    async freightCalculate() {
      aufrufe.fracht++;
      if (notbetrieb.fracht) return { success: true, data: { cost: 0, currency: 'EUR' }, source: 'fallback' };
      // Echte Werte vom 23.09.: logisticPrice ist NICHT, was CJ berechnet —
      // die Bestellung kostete 11,22 $ Versand, also totalPostageFee.
      return { code: 200, result: true, data: versand || [
        { logisticName: 'YunExpress Sensitive', logisticPrice: 9.14, totalPostageFee: 12.64, logisticAging: '8-15' },
        { logisticName: 'YunExpress Ordinary', logisticPrice: 7.72, totalPostageFee: 11.22, logisticAging: '6-8' },
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

// ── IOSS und Bezahlung aus dem Wallet (seit 23.09.) ─────────────────────
//
// Der erste echte Bestellversuch am 23.09. kam bei CJ an und wurde
// abgelehnt: "Please enter a IOSS number". Angelegt wurde nichts.
// Entscheidung Nevio: CJs IOSS (Typ 3). Dazu: aus dem CJ-Wallet bezahlen —
// aber nur, wenn es die Bestellung samt Steuer sicher deckt.

const mitWarenwert = (eur) => ({ ...bestellungMond(), warenwertEur: eur });

test('ohne Einstellung geht CJs IOSS (Typ 3) mit, ohne eigene Nummer', async () => {
  const { nutzlast } = await cj.bereiteVor(nachbauCj(), mitWarenwert(17.99));
  assert.equal(nutzlast.iossType, 3);
  assert.equal(nutzlast.iossNumber, undefined);
});

test('ueber 150 € Warenwert wird NICHT automatisch bestellt — dort gilt IOSS nicht', async () => {
  const api = nachbauCj();
  await assert.rejects(cj.bereiteVor(api, mitWarenwert(150.01), { iossType: 3 }), /ueber 150/);
  assert.equal(api.aufrufe.query, 0, 'es darf gar nicht erst bei CJ nachgefragt werden');
});

test('genau 150 € geht noch durch', async () => {
  const { nutzlast } = await cj.bereiteVor(nachbauCj(), mitWarenwert(150), { iossType: 3 });
  assert.equal(nutzlast.iossType, 3);
});

test('"kein IOSS" (Typ 1) gilt auch ueber 150 € — die Kundin zahlt dann selbst', async () => {
  const { nutzlast } = await cj.bereiteVor(nachbauCj(), mitWarenwert(200), { iossType: 1 });
  assert.equal(nutzlast.iossType, 1);
});

test('eigene IOSS ohne Nummer wird abgelehnt statt leer verschickt', async () => {
  await assert.rejects(cj.bereiteVor(nachbauCj(), mitWarenwert(17.99), { iossType: 2 }), /keine Nummer/);
});

test('eigene IOSS mit Nummer geht mit der Nummer raus', async () => {
  const { nutzlast } = await cj.bereiteVor(nachbauCj(), mitWarenwert(17.99), { iossType: '2', iossNumber: 'IM2760000001' });
  assert.equal(nutzlast.iossType, 2);
  assert.equal(nutzlast.iossNumber, 'IM2760000001');
});

test('ein Tippfehler in CJ_IOSS_TYPE wird gemeldet, nicht geraten', async () => {
  await assert.rejects(cj.bereiteVor(nachbauCj(), mitWarenwert(17.99), { iossType: 'drei' }), /keine gueltige IOSS-Einstellung/);
});

test('aus dem Wallet bezahlt (2) wird nur mit Puffer fuer die Steuer', () => {
  // Geschaetzt 12,93 $ (1,71 Ware + 11,22 Versand), ohne Einfuhrumsatzsteuer.
  assert.equal(cj.zahlweise(16.81, 12.93), 2, '12,93 × 1,3 = 16,81 reicht');
  assert.equal(cj.zahlweise(16.80, 12.93), 3, 'einen Cent darunter nicht mehr');
});

test('der Versandpreis ist totalPostageFee, nicht logisticPrice', () => {
  assert.equal(cj.versandPreis({ logisticPrice: 7.72, totalPostageFee: 11.22 }), 11.22);
  assert.equal(cj.versandPreis({ logisticPrice: 7.72 }), 7.72, 'fehlt der Gesamtpreis, bleibt der Einzelpreis');
  assert.equal(cj.versandPreis({ logisticPrice: 7.72, totalPostageFee: null }), 7.72);
});

test('der guenstigste Versand wird nach dem GESAMTPREIS gewaehlt', async () => {
  // A wirkt nach logisticPrice billiger, kostet aber insgesamt mehr.
  const versand = [
    { logisticName: 'A', logisticPrice: 7.00, totalPostageFee: 15.00 },
    { logisticName: 'B', logisticPrice: 9.00, totalPostageFee: 12.00 },
  ];
  const { versand: gewaehlt } = await cj.bereiteVor(nachbauCj({ versand }), mitWarenwert(17.99));
  assert.equal(gewaehlt.logisticName, 'B');
  // Gegenprobe: so wurde bis zum 23.09. sortiert — das haette A genommen.
  const alt = versand.slice().sort((a, b) => a.logisticPrice - b.logisticPrice)[0];
  assert.equal(alt.logisticName, 'A', 'Gegenprobe wertlos');
});

test('istBezahlt liest den echten Stand bei CJ', async () => {
  const mit = (data) => ({ getOrderDetail: async () => ({ code: 200, result: true, data }) });
  // So stand die angelegte, unbezahlte Bestellung am 23.09. bei CJ.
  assert.equal(await cj.istBezahlt(mit({ orderStatus: 'CREATED', paymentDate: null }), 'SD1'), false);
  assert.equal(await cj.istBezahlt(mit({ orderStatus: 'UNPAID', paymentDate: null }), 'SD1'), false);
  assert.equal(await cj.istBezahlt(mit({ orderStatus: 'UNSHIPPED', paymentDate: null }), 'SD1'), true);
  assert.equal(await cj.istBezahlt(mit({ orderStatus: 'CREATED', paymentDate: '2026-09-23 14:00:00' }), 'SD1'), true);
});

test('istBezahlt raet nicht: Notbetrieb, Fehler oder leere Antwort sind "unbekannt"', async () => {
  assert.equal(await cj.istBezahlt({ getOrderDetail: async () => ({ success: true, data: { orderStatus: 'SHIPPED' }, source: 'fallback' }) }, 'SD1'), null);
  assert.equal(await cj.istBezahlt({ getOrderDetail: async () => { throw new Error('Netz weg'); } }, 'SD1'), null);
  assert.equal(await cj.istBezahlt({ getOrderDetail: async () => ({ code: 200, data: {} }) }, 'SD1'), null);
});

test('ist Guthaben oder Preis unbekannt, wird NIE blind abgebucht', () => {
  assert.equal(cj.zahlweise(NaN, 9.46), 3, 'unbekanntes Guthaben');
  assert.equal(cj.zahlweise(500, NaN), 3, 'unbekannter Preis');
  assert.equal(cj.zahlweise(500, 0), 3, 'Kosten 0 sind ein Fehler, keine Gratisbestellung');
});

test('ein Wallet aus dem Notbetrieb gilt als unbekannt — weder leer noch voll', async () => {
  assert.ok(Number.isNaN(await cj.walletGuthaben({ getBalance: async () => ({ success: true, data: { amount: 999 }, source: 'fallback' }) })));
  assert.ok(Number.isNaN(await cj.walletGuthaben({ getBalance: async () => { throw new Error('Netz weg'); } })));
});

test('das echte Wallet-Format von CJ wird gelesen', async () => {
  // So antwortete CJ am 23.09. live (Guthaben 0).
  const echt = { code: 200, result: true, message: 'Success', data: { amount: 0, noWithdrawalAmount: 0, freezeAmount: 0 } };
  assert.equal(await cj.walletGuthaben({ getBalance: async () => echt }), 0);
});

test('bereiteVor waehlt die Zahlweise nach Wallet und CJ-Preisen', async () => {
  const voll = await cj.bereiteVor(nachbauCj(), mitWarenwert(17.99), { guthaben: 100 });
  assert.ok(Math.abs(voll.kosten - 12.93) < 1e-9, `Kosten ${voll.kosten}`);
  assert.equal(voll.payType, 2);
  assert.equal(voll.nutzlast.payType, 2);
  const leer = await cj.bereiteVor(nachbauCj(), mitWarenwert(17.99), { guthaben: 0 });
  assert.equal(leer.nutzlast.payType, 3, 'leeres Wallet: nur anlegen');
  const ohnePreis = await cj.bereiteVor(nachbauCj({ preis: null }), mitWarenwert(17.99), { guthaben: 100 });
  assert.equal(ohnePreis.nutzlast.payType, 3, 'ohne CJ-Preis: nur anlegen');
});

test('der Webhook fragt das Wallet ab und meldet "nur angelegt" und "Wallet knapp"', () => {
  assert.match(server, /guthaben: await cjBestellung\.walletGuthaben\(cjAPI\)/);
  assert.match(server, /cjBestellung\.istBezahlt\(cjAPI, cjErgebnis\.cjBestellnummer\)/,
    'ob bezahlt wurde, muss bei CJ nachgefragt werden, nicht aus payType geschlossen');
  assert.match(server, /if \(bezahlt !== true\)/, 'auch "unbekannt" muss den Hinweis ausloesen');
  assert.match(server, /bitte in CJ BEZAHLEN/, 'ohne Hinweis laege eine unbezahlte Bestellung still bei CJ');
  assert.match(server, /CJ-Wallet fast leer/);
});

test('die Kasse ueberweist nichts an ein "CJ-Konto" bei Stripe — CJ hat keins', () => {
  // setup-stripe-cj-split.js legte das Zielkonto im EIGENEN Stripe-Konto an.
  // Der Transfer haette Geld dorthin geschoben, nie zu CJ. Am 23.09. waren
  // zehn solcher Konten angelegt, keines durfte zahlen oder auszahlen.
  const nurCode = server.split('\n').filter((z) => !/^\s*\/\//.test(z)).join('\n');
  assert.ok(!/transfer_data/.test(nurCode), 'kein Transfer an ein verbundenes Konto');
  assert.ok(!/CJ_STRIPE_ACCOUNT_ID/.test(nurCode));
  assert.ok(!/Automatische Zahlung aktiv/.test(nurCode), 'der Webhook darf keine Zahlung an CJ behaupten');
  assert.ok(!fs.existsSync(path.join(WURZEL, 'setup-stripe-cj-split.js')));
});

test('GEGENPROBE: die alte Nutzlast haette CJ genau so abgelehnt wie am 23.09.', () => {
  // Ohne ioss baut baueNutzlast die Nutzlast wie bis zum 23.09. — ohne
  // iossType. Genau damit kam "Please enter a IOSS number" zurueck.
  const alt = cj.baueNutzlast({
    bestellnummer: 'MAIOS-x', adresse: ADRESSE, name: 'Emrah Cardak',
    positionen: [{ vid: MOND_VID, quantity: 1 }], logisticName: 'YunExpress Ordinary',
  });
  assert.equal(alt.iossType, undefined, 'Gegenprobe wertlos: alt haette schon IOSS gehabt');
  // Und ein Vergleich ohne Puffer haette mit 13 $ Guthaben bezahlen lassen —
  // CJ hat fuer genau diese Bestellung am 23.09. aber 13,26 $ berechnet
  // (12,93 plus 0,32 Einfuhrumsatzsteuer plus 0,01 Gebuehr).
  const ohnePuffer = (g, k) => (g >= k ? 2 : 3);
  assert.equal(ohnePuffer(13.00, 12.93), 2, 'Gegenprobe wertlos: ohne Puffer waere nicht bezahlt worden');
  assert.equal(cj.zahlweise(13.00, 12.93), 3);
});
