/**
 * Tests: der Kaufbereich steht auf jeder Produktseite in der rechten Spalte.
 *
 * Anlass (November 2026): Beim Entfernen des Countdowns ("Angebot endet in:")
 * blieb auf allen Produktseiten ein schließendes </div> zu viel stehen. Es
 * schloss die rechte Spalte (pp-buybox) direkt nach dem Preis. Farbwahl,
 * Menge, Warenkorb-Knopf, Lieferzeit und Vertrauenszeile rutschten am
 * Computer unter die Bildergalerie, verteilt auf zwei Spalten. Am Handy fiel
 * es kaum auf, weil dort ohnehin alles untereinander steht.
 *
 * Warum ein Test: Der Browser repariert so etwas stillschweigend. Keine
 * Fehlermeldung, kein Konsoleneintrag, die Seite funktioniert sogar. Sie sieht
 * nur kaputt aus, und das genau an der Stelle, an der gekauft wird.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const SEITEN = fs.readdirSync(path.join(WURZEL, 'produkte'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => 'produkte/' + f);
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

/** Was in der rechten Spalte stehen muss: [Name, Erkennungsmerkmal]. */
const PFLICHT = [
  ['Farbwahl', 'id="colorSelection"'],
  ['Menge', 'id="pp-qty"'],
  ['Warenkorb-Knopf', 'id="cartBtn"'],
  ['Lieferzeit', 'class="pp-delivery"'],
  ['Vertrauenszeile', 'class="pp-trust-row"'],
];

/** Position des </div>, das das bei `start` geöffnete <div> schließt, sonst -1. */
function divEnde(html, start) {
  const muster = /<div\b|<\/div>/g;
  muster.lastIndex = start;
  let tiefe = 0;
  let m;
  while ((m = muster.exec(html))) {
    tiefe += m[0] === '</div>' ? -1 : 1;
    if (tiefe === 0) return m.index;
  }
  return -1;
}

/** Namen der Pflichtteile, die NICHT in der rechten Spalte stehen. Leer = in Ordnung. */
function ausserhalb(html) {
  const start = html.indexOf('<div class="pp-buybox">');
  if (start < 0) return ['keine pp-buybox'];
  const ende = divEnde(html, start);
  if (ende < 0) return ['pp-buybox wird nie geschlossen'];
  return PFLICHT
    .filter(([, merkmal]) => {
      const i = html.indexOf(merkmal);
      return i < start || i > ende;
    })
    .map(([name]) => name);
}

test('es gibt Produktseiten zu prüfen', () => {
  // Sonst wären die Prüfungen unten leer und trotzdem grün.
  assert.ok(SEITEN.length >= 50, `nur ${SEITEN.length} Produktseiten gefunden`);
});

test('Farbwahl, Menge, Warenkorb-Knopf, Lieferzeit und Vertrauenszeile stehen in der rechten Spalte', () => {
  const funde = SEITEN
    .map((rel) => [rel, ausserhalb(lies(rel))])
    .filter(([, f]) => f.length);
  assert.deepStrictEqual(funde, []);
});

test('jedes <div> wird genau einmal geschlossen', () => {
  const schief = SEITEN
    .map((rel) => {
      const h = lies(rel);
      return [rel, (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length];
    })
    .filter(([, differenz]) => differenz !== 0);
  assert.deepStrictEqual(schief, []);
});

test('GEGENPROBE: das überzählige </div> nach dem Preis fällt auf', () => {
  // Baut den Fehler genau so nach, wie er auf allen Seiten stand.
  const echt = lies('produkte/auto-bildschirm.html');
  const kaputt = echt.replace(
    /(<div class="pp-price-hint">[^\n]*<\/div>\r?\n)/,
    (zeile) => zeile + '            </div>\n'
  );
  assert.notStrictEqual(kaputt, echt, 'Suchmuster trifft nichts, dann prüft der Test nichts');
  assert.deepStrictEqual(ausserhalb(echt), []);
  assert.deepStrictEqual(ausserhalb(kaputt), PFLICHT.map(([name]) => name));
  const differenz = (kaputt.match(/<div\b/g) || []).length - (kaputt.match(/<\/div>/g) || []).length;
  assert.strictEqual(differenz, -1, 'die Zählung muss das überzählige </div> sehen');
});
