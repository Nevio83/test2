/**
 * Tests fuer die Gutschein-Pruefung.
 *
 * Warum ausgerechnet hier: Diese Datei entscheidet ueber echtes Geld. Sie ist
 * die SERVERSEITIGE Pruefung — der Browser schickt beim Checkout einen Code
 * mit, und was er als Rabatt behauptet, zaehlt bewusst nicht. Ein Fehler hier
 * bedeutet, dass jemand einen Rabatt bekommt, den es nicht geben darf.
 *
 * Beim Aufraeumen kam dazu ein realer Fall ans Licht: eine verwaiste
 * Verwaltungsseite trug eine zweite, von Hand eingetippte Kopie derselben
 * Liste — und die wich bei FUENF von sechs Codes im Mindestbestellwert ab.
 * Es gibt genau eine massgebliche Quelle, und das ist diese Datei.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { VOUCHERS, getVoucher, validateVoucher } = require('../voucher-validator');

/** Warenkorb, wie ihn price-validator.validateCart() liefert (geprueft, EUR). */
const korb = (...posten) => posten.map(([price, quantity]) => ({ price, quantity }));

test('unbekannter Code wird abgelehnt', () => {
  const r = validateVoucher('GIBTSNICHT', korb([100, 1]));
  assert.equal(r.ok, false);
  assert.match(r.reason, /Ungültig/);
});

test('Code wird unabhängig von Gross-/Kleinschreibung und Leerzeichen erkannt', () => {
  for (const eingabe of ['save10', '  SAVE10  ', 'SaVe10']) {
    assert.equal(getVoucher(eingabe)?.code, 'SAVE10', 'fehlgeschlagen bei: ' + eingabe);
  }
});

test('leerer Warenkorb wird abgelehnt', () => {
  assert.equal(validateVoucher('SAVE10', []).ok, false);
  assert.equal(validateVoucher('SAVE10', null).ok, false);
});

test('Mindestbestellwert wird durchgesetzt', () => {
  // SAVE10 gilt ab 50 EUR.
  const zuWenig = validateVoucher('SAVE10', korb([49.99, 1]));
  assert.equal(zuWenig.ok, false);
  assert.match(zuWenig.reason, /Mindestbestellwert/);

  const genug = validateVoucher('SAVE10', korb([50, 1]));
  assert.equal(genug.ok, true, 'genau der Mindestwert muss reichen');
});

test('Mindestbestellwert zählt die MENGE mit, nicht nur den Stückpreis', () => {
  // Zwei Stueck zu 30 EUR sind 60 EUR -> ueber der 50er-Grenze.
  const r = validateVoucher('SAVE10', korb([30, 2]));
  assert.equal(r.ok, true);
});

test('Mindestanzahl Artikel wird durchgesetzt', () => {
  // BUNDLE30 verlangt mindestens 3 Artikel.
  const zuWenige = validateVoucher('BUNDLE30', korb([100, 2]));
  assert.equal(zuWenige.ok, false);
  assert.match(zuWenige.reason, /Mindestens 3/);

  const genug = validateVoucher('BUNDLE30', korb([10, 3]));
  assert.equal(genug.ok, true);
});

test('Rabatt kommt aus der Liste, nicht aus der Anfrage', () => {
  const r = validateVoucher('SAVE20', korb([200, 1]));
  assert.equal(r.ok, true);
  assert.equal(r.percent, 20, 'Prozentwert muss aus VOUCHERS stammen');
  assert.equal(r.code, 'SAVE20');
});

test('Gratis-Versand erzeugt keinen Prozent-Rabatt', () => {
  const r = validateVoucher('FREESHIP', korb([10, 1]));
  assert.equal(r.ok, true);
  assert.equal(r.type, 'shipping');
  assert.equal(r.percent, 0, 'sonst gäbe es Versand UND Rabatt');
});

test('manipulierte Preise im Warenkorb heben die Grenze nicht aus', () => {
  // Ein negativer oder unsinniger Preis darf die Summe nicht aufblasen.
  const r = validateVoucher('SAVE20', [{ price: -1000, quantity: 1 }, { price: 10, quantity: 1 }]);
  assert.equal(r.ok, false, 'Summe liegt unter dem Mindestwert');
});

test('fehlende Felder im Warenkorb werden als 0 gewertet, nicht als NaN', () => {
  const r = validateVoucher('SAVE10', [{ price: undefined, quantity: undefined }]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Mindestbestellwert/);
  assert.ok(!/NaN/.test(r.reason), 'Meldung darf kein NaN enthalten');
});

test('jeder Code in der Liste ist vollständig definiert', () => {
  assert.ok(VOUCHERS.length > 0);
  for (const v of VOUCHERS) {
    assert.match(v.code, /^[A-Z0-9]+$/, 'Code in Grossbuchstaben: ' + v.code);
    assert.ok(['percentage', 'shipping'].includes(v.type), 'unbekannte Art bei ' + v.code);
    assert.ok(typeof v.discount === 'number' && v.discount >= 0 && v.discount < 1,
      'Rabatt muss ein Anteil zwischen 0 und 1 sein: ' + v.code);
    assert.ok(typeof v.minOrder === 'number' && v.minOrder >= 0, 'minOrder fehlt bei ' + v.code);
    assert.ok(typeof v.minItems === 'number' && v.minItems >= 0, 'minItems fehlt bei ' + v.code);
  }
});

test('keine doppelten Codes', () => {
  const codes = VOUCHERS.map((v) => v.code);
  assert.equal(new Set(codes).size, codes.length, 'ein Code kommt doppelt vor');
});
