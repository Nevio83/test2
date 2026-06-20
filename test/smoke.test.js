/**
 * Smoke-Tests — laufen ohne externe Dependencies über Node's eingebautes `node:test`.
 * Fokus: sicherheitskritische, reine Logik (Preisvalidierung, Versandkosten).
 * Ausführen: `npm test`  (= `node --test`)
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  round2,
  sanitizeQuantity,
  validateCart,
  resolveUnitPriceEUR
} = require('../price-validator');

const { calculateShippingCost } = require('../shipping-calculator');

// Mini-Katalog (unabhängig von products.json), deckt Basis + Farbe + Bundle ab.
const CATALOG = [
  {
    id: 1,
    name: 'Test-Produkt',
    price: 19.99,
    colors: [{ name: 'Rot', price: 21.99 }],
    bundles: [{ bundlePrice: 34.99 }]
  },
  { id: 2, name: 'Zweitprodukt', price: 9.5 }
];

test('round2 rundet auf zwei Nachkommastellen', () => {
  assert.equal(round2(1.005), 1); // bekanntes Float-Verhalten, aber stabil gerundet
  assert.equal(round2(19.999), 20);
  assert.equal(round2('9.5'), 9.5);
  assert.equal(round2(undefined), 0);
});

test('sanitizeQuantity erzwingt 1..99 als Ganzzahl', () => {
  assert.equal(sanitizeQuantity(0), 1);
  assert.equal(sanitizeQuantity(-5), 1);
  assert.equal(sanitizeQuantity('3'), 3);
  assert.equal(sanitizeQuantity(150), 99);
  assert.equal(sanitizeQuantity('abc'), 1);
});

test('resolveUnitPriceEUR akzeptiert Basis-, Farb- und Bundle-Preise', () => {
  assert.equal(resolveUnitPriceEUR({ id: 1, price: 19.99 }, CATALOG), 19.99);
  assert.equal(resolveUnitPriceEUR({ id: 1, price: 21.99 }, CATALOG), 21.99);
  assert.equal(resolveUnitPriceEUR({ id: 1, price: 34.99 }, CATALOG), 34.99);
});

test('resolveUnitPriceEUR fällt bei manipuliertem Preis auf Basispreis zurück', () => {
  // Sicherheitskern: Client kann Preis nicht frei setzen.
  assert.equal(resolveUnitPriceEUR({ id: 1, price: 0.01 }, CATALOG), 19.99);
});

test('resolveUnitPriceEUR lehnt unbekanntes Produkt ab', () => {
  assert.throws(() => resolveUnitPriceEUR({ id: 999, price: 5 }, CATALOG));
});

test('validateCart säubert Mengen und Preise', () => {
  const result = validateCart(
    [{ id: 1, price: 0.01, quantity: 200 }, { id: 2, price: 9.5, quantity: '2' }],
    CATALOG
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].price, 19.99); // manipulierter Preis korrigiert
  assert.equal(result[0].quantity, 99); // Menge gedeckelt
  assert.equal(result[1].price, 9.5);
  assert.equal(result[1].quantity, 2);
});

test('validateCart lehnt leeren Warenkorb ab', () => {
  assert.throws(() => validateCart([], CATALOG));
  assert.throws(() => validateCart(null, CATALOG));
});

test('calculateShippingCost liefert nicht-negative Zahl', () => {
  const de = calculateShippingCost('DE');
  assert.equal(typeof de, 'number');
  assert.ok(de >= 0);
  // Unbekanntes Land darf nicht crashen
  assert.equal(typeof calculateShippingCost('XX'), 'number');
});
