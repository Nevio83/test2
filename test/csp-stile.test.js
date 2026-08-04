/**
 * Tests fuer die Absicherung der Gestaltungsangaben.
 *
 * Worum es geht: <style>-Bloecke bekommen Fingerabdruecke, damit ein
 * EINGESCHLEUSTER Block nicht mehr die ganze Seite umgestalten kann (etwa den
 * echten Kasse-Knopf verstecken und einen falschen darueberlegen). Die rund
 * 1500 style="…"-Attribute bleiben bewusst erlaubt.
 *
 * Der heikle Teil ist das Auslesen des CSS aus den Skripten: acht Dateien
 * haengen ihr Stylesheet erst zur Laufzeit ein, teils als Verkettung mehrerer
 * Zeichenketten, teils mit Kommentaren dazwischen. Stimmt der Fingerabdruck
 * nicht, verliert die Seite ihre Gestaltung — und zwar lautlos.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  werteZeichenkettenAusdruckAus, stileAusHtml, stileAusJs, baueIndex
} = require('../csp-inline');

test('einfache Zeichenkette wird ausgewertet', () => {
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1}'"), 'a{x:1}');
  assert.equal(werteZeichenkettenAusdruckAus('`a{x:1}`'), 'a{x:1}');
});

test('Verkettung über mehrere Zeilen wird zusammengesetzt', () => {
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1}' +\n  'b{y:2}'"), 'a{x:1}b{y:2}');
});

test('Kommentare zwischen den Teilen stören nicht', () => {
  // product-availability.js hat mitten in der Kette ein "// Vormerkung".
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1}' // Notiz\n + 'b{y:2}'"), 'a{x:1}b{y:2}');
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1}' /* Notiz */ + 'b{y:2}'"), 'a{x:1}b{y:2}');
});

test('doppelte Schrägstriche IM CSS bleiben erhalten', () => {
  // Ein stumpfes Wegschneiden von "//" wuerde url(//…) zerstoeren.
  assert.equal(
    werteZeichenkettenAusdruckAus("'a{background:url(//cdn.example/x.png)}'"),
    'a{background:url(//cdn.example/x.png)}'
  );
});

test('eingesetzte Werte sind nicht bestimmbar', () => {
  assert.equal(werteZeichenkettenAusdruckAus('`a{width:${w}px}`'), null);
});

test('abgeschnittenes CSS wird abgelehnt', () => {
  // Faengt einen falsch gesetzten Ausdruck-Rand ab: dann fehlen Klammern.
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1'"), null, 'unausgeglichen');
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1}}'"), null, 'zu viele schliessende');
  assert.equal(werteZeichenkettenAusdruckAus("'nur text'"), null, 'gar kein CSS');
});

test('alles andere als Zeichenketten wird abgelehnt', () => {
  assert.equal(werteZeichenkettenAusdruckAus('berechneCss()'), null);
  assert.equal(werteZeichenkettenAusdruckAus("'a{x:1}' + variable"), null);
});

test('<style>-Blöcke aus HTML werden gelesen', () => {
  const html = '<style>a{x:1}</style><p>x</p><style type="text/css">b{y:2}</style><style></style>';
  const treffer = [...stileAusHtml(html)];
  assert.equal(treffer.length, 2, 'leerer Block zählt nicht');
  assert.ok(treffer.includes('a{x:1}'));
  assert.ok(treffer.includes('b{y:2}'));
});

test('zur Laufzeit eingehängtes CSS wird erkannt', () => {
  const js = `
    function f() {
      var s = document.createElement('style');
      s.id = 'x';
      s.textContent =
        '.a{color:red;}' +
        '.b{color:blue;}';
      document.head.appendChild(s);
    }`;
  const { stile, unklar } = stileAusJs(js, 'probe.js');
  assert.equal(unklar.length, 0, 'sollte eindeutig sein: ' + unklar.join(', '));
  assert.deepEqual([...stile], ['.a{color:red;}.b{color:blue;}']);
});

test('CSS über eine Zwischenvariable wird erkannt', () => {
  // So macht es product-video.js.
  const js = `
    function f() {
      var css =
        '.a{color:red}' +
        '.b{color:blue}';
      var s = document.createElement('style');
      s.textContent = css;
    }`;
  const { stile, unklar } = stileAusJs(js, 'probe.js');
  assert.equal(unklar.length, 0, unklar.join(', '));
  assert.deepEqual([...stile], ['.a{color:red}.b{color:blue}']);
});

test('nicht bestimmbares CSS wird als unklar gemeldet, nicht geraten', () => {
  const js = `
    function f() {
      var s = document.createElement('style');
      s.textContent = baueCss(breite);
    }`;
  const { stile, unklar } = stileAusJs(js, 'probe.js');
  assert.equal(stile.size, 0);
  assert.equal(unklar.length, 1, 'muss auffallen statt stillschweigend zu fehlen');
});

test('jede Seite des echten Projekts bekommt ihre Stil-Hashes', () => {
  // Bleibt auch nur ein Stylesheet unklar, faellt die Seite auf die alte Regel
  // zurueck — dann waere hier null statt einer Liste. Das soll auffallen.
  const { stilIndex, statistik } = baueIndex(path.join(__dirname, '..'));
  const ohne = [...stilIndex.entries()].filter(([, v]) => v === null).map(([k]) => k);
  assert.deepEqual(ohne, [], 'Seiten ohne Stil-Hashes: ' + ohne.slice(0, 5).join(', '));
  assert.ok(statistik.stilHashes > 20, 'es müssen Stilblöcke gefunden werden');

  // Stichproben: die Seiten mit den meisten Laufzeit-Stylesheets
  assert.ok(stilIndex.get('/produkte/led-crystal-lampe.html').length >= 5);
  assert.ok(stilIndex.get('/cart.html').length >= 3);
});
