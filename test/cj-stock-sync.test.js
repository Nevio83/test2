/**
 * Tests fuer die Auswertung der Lieferanten-Bestandsantwort.
 *
 * Warum ausgerechnet hier: Diese Funktion entscheidet, ob ein Produkt im Shop
 * als "nicht lieferbar" gesperrt wird. Am 02.08. hat sie genau das faelschlich
 * getan — drei Produkte waren live unverkaeuflich, obwohl der Lieferant ueber
 * 26.000 Stueck meldete.
 *
 * Die Ursache steckt in einer Zeile: geprueft wurde mit
 * Number.isFinite(Number(c)). Number(null) ist aber 0, und 0 ist endlich. Der
 * Lieferant liefert in der Variantenantwort inventoryNum: null — dort steht
 * schlicht kein Bestand. Ein FEHLENDES Feld sah damit aus wie ein LEERES
 * LAGER. Dieselbe Falle stellen '', [] und false.
 *
 * Der wichtigste Test ist deshalb der erste — und gleich danach der, der
 * belegt, dass eine ECHTE Null weiterhin als Null durchgeht. Sonst waere der
 * Fehler nur in die andere Richtung verschoben und echte Ausverkaeufe blieben
 * unbemerkt.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { readStockValue } = require('../cj-stock-sync');

test('fehlender Bestand ist KEINE Null', () => {
  // Genau der Fall, der drei Produkte live gesperrt hat.
  assert.equal(readStockValue({ inventoryNum: null }), null);
  assert.equal(readStockValue({ storageNum: null, inventoryNum: null }), null);
  assert.equal(readStockValue({ inventoryNum: undefined }), null);
});

test('leere Werte sind keine Null', () => {
  assert.equal(readStockValue({ storageNum: '' }), null, 'leerer Text');
  assert.equal(readStockValue({ storageNum: [] }), null, 'leere Liste');
  assert.equal(readStockValue({ storageNum: false }), null, 'false');
  assert.equal(readStockValue({ storageNum: {} }), null, 'Objekt');
});

test('eine ECHTE Null bleibt eine Null', () => {
  // Ohne diesen Test waere der Fehler nur verschoben: echte Ausverkaeufe
  // wuerden dann nicht mehr erkannt.
  assert.equal(readStockValue({ storageNum: 0 }), 0);
  assert.equal(readStockValue({ storageNum: '0' }), 0);
});

test('echte Zahlen werden gelesen — auch als Text', () => {
  assert.equal(readStockValue({ storageNum: 12388 }), 12388);
  assert.equal(readStockValue({ storageNum: '12388' }), 12388);
  assert.equal(readStockValue({ storageNum: ' 42 ' }), 42, 'Leerzeichen stören nicht');
});

test('Text ohne Zahl ergibt keine Aussage', () => {
  assert.equal(readStockValue({ storageNum: 'viele' }), null);
  assert.equal(readStockValue({ storageNum: '12 Stück' }), null);
  assert.equal(readStockValue({ storageNum: 'NaN' }), null);
});

test('negative Werte ergeben keine Aussage', () => {
  assert.equal(readStockValue({ storageNum: -5 }), null);
  assert.equal(readStockValue({ storageNum: '-5' }), null);
});

test('leere oder fehlende Antwort ergibt keine Aussage', () => {
  assert.equal(readStockValue(null), null);
  assert.equal(readStockValue(undefined), null);
  assert.equal(readStockValue({}), null);
  assert.equal(readStockValue('12388'), null, 'kein Objekt');
});

test('das erste brauchbare Feld gewinnt, leere werden übersprungen', () => {
  // Der Lieferant liefert je nach Aufruf unterschiedliche Feldnamen.
  assert.equal(readStockValue({ storageNum: 7, stockNum: 99 }), 7);
  assert.equal(readStockValue({ storageNum: null, stockNum: 99 }), 99,
    'ein leeres erstes Feld darf die spaeteren nicht blockieren');
  assert.equal(readStockValue({ storageNum: null, inventoryNum: null, quantity: 3 }), 3);
});

test('Antwort des Lieferanten im Original wird richtig gelesen', () => {
  // So sieht die Variantenantwort wirklich aus (am 02.08. abgefragt):
  const variante = {
    vid: '1621426087651717120',
    variantSellPrice: 11.44,
    combineNum: null,
    inventoryNum: null,
    inventories: null
  };
  assert.equal(readStockValue(variante), null,
    'aus der Variante allein darf kein Bestand abgeleitet werden');

  // Der Bestand kommt aus dem zweiten Aufruf:
  const bestand = {
    vid: '1621426087651717120',
    areaEn: 'China Warehouse',
    storageNum: 12388,
    totalInventoryNum: 12388,
    cjInventoryNum: 0
  };
  assert.equal(readStockValue(bestand), 12388);
});

// ── Ware aus dem deutschen CJ-Lager (seit 04.11.2026) ─────────────────
// Bestellt wird dort — Bestand in China oder den USA darf ein DE-Produkt
// nicht "lieferbar" halten, und fehlt die DE-Zeile, gibt es keine Aussage.

const { fetchCjStock } = require('../cj-stock-sync');
const { matchProductByPid } = require('../cj-price-sync');

function lagerApi(zeilen) {
  return {
    async queryProductVariant() { return { result: true, data: [{ vid: 'v1', inventoryNum: 5000 }] }; },
    async getProductStockByVid() { return { result: true, data: zeilen }; },
  };
}

test('mit Lager DE zaehlt nur der deutsche Bestand', async () => {
  const api = lagerApi([
    { countryCode: 'CN', areaEn: 'China Warehouse', storageNum: 12388 },
    { countryCode: 'DE', areaEn: 'Germany Warehouse', storageNum: 85 },
  ]);
  assert.equal(await fetchCjStock(api, '123', 'DE'), 85);
});

test('ist das DE-Lager leer, ist das Produkt ausverkauft — China rettet es nicht', async () => {
  const api = lagerApi([
    { countryCode: 'CN', storageNum: 12388 },
    { countryCode: 'DE', storageNum: 0 },
  ]);
  assert.equal(await fetchCjStock(api, '123', 'DE'), 0);
});

test('fehlt die DE-Zeile ganz, gibt es keine Aussage statt einer erfundenen Null', async () => {
  const api = lagerApi([{ countryCode: 'CN', storageNum: 12388 }]);
  assert.equal(await fetchCjStock(api, '123', 'DE'), null);
});

test('ohne Lager zaehlt wie bisher alles — und der Variantenwert', async () => {
  const api = lagerApi([{ countryCode: 'DE', storageNum: 85 }]);
  assert.equal(await fetchCjStock(api, '123'), 5000, 'die Variante traegt hier selbst einen Bestand');
});

test('Produkte mit nur einer Variante finden ihre CJ-Produkt-ID ueber cjPid', () => {
  const produkte = [{ id: 1, sku: 'CJ1621032671155597312' }, { id: 52, sku: 'CJQJ204534103AZ', cjPid: '2045341034818355201' }];
  assert.equal(matchProductByPid('2045341034818355201', produkte).id, 52);
  assert.equal(matchProductByPid('1621032671155597312', produkte).id, 1);
  assert.equal(matchProductByPid('999', produkte), null);
});
