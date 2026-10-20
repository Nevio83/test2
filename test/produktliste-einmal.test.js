/**
 * Punkt 60: products.json wird je Seitenaufruf genau EINMAL geladen.
 *
 * GEMESSEN am 07.10. auf der Wasserspender-Seite: acht Abrufe beim Erstbesuch,
 * einer davon mit ?v=<Zeit>, der jede 304-Antwort verhinderte. Auf einem
 * Handy im Mobilfunknetz sind das acht Rundreisen in dem Moment, in dem die
 * Galerie und die Verfuegbarkeit auf ihre Daten warten — und auf dem Server
 * bis zu acht Bestandsabfragen in der Datenbank.
 *
 * Seitdem gibt es ein gemeinsames Versprechen (window.__maiosProdukte), das
 * das Inline-Skript der Produktseite als erstes anlegt und app.js mit
 * window.maiosProdukte() bereitstellt. Diese Pruefung haelt zwei Dinge fest:
 *   1. Keine der sechs Stellen holt die Liste wieder selbst — ausser im
 *      Rueckfall, der nur greift, wenn das gemeinsame Versprechen fehlt.
 *   2. Das Versprechen tut zur Laufzeit, was es soll: zwei Aufrufe, ein
 *      Abruf; nach einem Fehler darf ein spaeterer Aufruf neu laden.
 *
 * Projektregel (CLAUDE.md §2): Zu jeder Pruefung eine Gegenprobe.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WURZEL = path.join(__dirname, '..');
const SKRIPTE = [
  'app.js',
  'produkte/produkt-premium.js',
  'bundle-images-final.js',
  'color-image-selection.js',
  'product-video.js',
  'product-availability.js',
];
const lies = (datei) => fs.readFileSync(path.join(WURZEL, datei), 'utf8').replace(/\r\n/g, '\n');
const produktseiten = () => fs.readdirSync(path.join(WURZEL, 'produkte'))
  .filter((n) => n.endsWith('.html')).map((n) => `produkte/${n}`);

/**
 * Jeder fetch() auf products.json — eingeteilt in "legt das gemeinsame
 * Versprechen an", "Rueckfall" und "eigener Abruf" (= Fehler).
 */
function abrufe(quelle) {
  const muster = /fetch\(\s*[`'"][^`'"]*products\.json[^`'"]*[`'"]/g;
  const ergebnis = [];
  let m;
  while ((m = muster.exec(quelle))) {
    const davor = quelle.slice(Math.max(0, m.index - 300), m.index);
    let art = 'eigener Abruf';
    if (/__maiosProdukte\s*=\s*$/.test(davor)) art = 'legt an';
    else if (/maiosProdukte/.test(davor)) art = 'Rueckfall';
    ergebnis.push({ art, text: m[0] });
  }
  return ergebnis;
}

test('keines der sechs Skripte holt products.json wieder selbst', () => {
  for (const datei of SKRIPTE) {
    const quelle = lies(datei);
    const eigene = abrufe(quelle).filter((a) => a.art === 'eigener Abruf');
    assert.deepStrictEqual(eigene, [], `${datei} laedt die Liste wieder selbst`);
    assert.match(quelle, /maiosProdukte/, `${datei} nutzt das gemeinsame Versprechen nicht`);
  }
});

test('genau eine Stelle in app.js legt das Versprechen an — ohne ?v=', () => {
  const quelle = lies('app.js');
  const anlegen = abrufe(quelle).filter((a) => a.art === 'legt an');
  assert.strictEqual(anlegen.length, 1);
  assert.match(anlegen[0].text, /'\/products\.json'/, 'absolute Adresse, damit es auf jeder Seite gleich ist');
  // home.js (Startseite) holt die Liste nur einmal, hing aber ebenfalls ?v= an.
  for (const datei of [...SKRIPTE, 'home.js']) {
    assert.doesNotMatch(lies(datei), /products\.json\?v=/, `${datei}: ?v= verhindert jede 304-Antwort`);
    assert.doesNotMatch(lies(datei), /products\.json\?v='\s*\+/, `${datei}: ?v= per Verkettung`);
  }
});

test('alle 40 Produktseiten legen das Versprechen im Inline-Skript an', () => {
  const seiten = produktseiten();
  assert.ok(seiten.length >= 40, `nur ${seiten.length} Produktseiten gefunden`);
  for (const seite of seiten) {
    const arten = abrufe(lies(seite)).map((a) => a.art);
    assert.deepStrictEqual(arten, ['legt an'], `${seite}: ${arten.join(', ') || 'kein Abruf'}`);
  }
});

test('Gegenprobe: die alten Abrufe waeren erkannt worden', () => {
  // So stand es bis zum 20.10. in den Dateien.
  const alt = [
    "fetch('../products.json')\n      .then(function(r){ return r.json(); })",                 // Inline-Skript
    "const response = await fetch(`${jsonPath}?v=${cacheBuster}`);",                         // app.js (Vorlage)
    "return fetch('../products.json')\n      .then(r => r.json())",                           // produkt-premium.js
    "fetch('/products.json')\n    .then(function (r) { return r.json(); })",                  // product-video.js
  ];
  assert.deepStrictEqual(abrufe(alt[0]).map((a) => a.art), ['eigener Abruf']);
  assert.deepStrictEqual(abrufe(alt[2]).map((a) => a.art), ['eigener Abruf']);
  assert.deepStrictEqual(abrufe(alt[3]).map((a) => a.art), ['eigener Abruf']);
  // Die Vorlagen-Schreibweise in app.js enthielt "products.json" nicht woertlich —
  // dafuer faengt die ?v=-Pruefung sie: genau diese Zeichenkette stand im Pfad.
  assert.match('../products.json?v=1791405616186', /products\.json\?v=/);
});

// ── Zur Laufzeit ────────────────────────────────────────────────────

/** Die Funktion window.maiosProdukte aus app.js, ohne den Rest der Datei. */
function maiosProdukteQuelle() {
  const quelle = lies('app.js');
  const start = quelle.indexOf('window.maiosProdukte = window.maiosProdukte || function () {');
  assert.ok(start >= 0, 'window.maiosProdukte nicht gefunden');
  const ende = quelle.indexOf('\n};', start);
  return quelle.slice(start, ende + 3);
}

/** Eine Sandbox mit gefaelschtem fetch, das zaehlt. */
function sandbox(antworten) {
  const zaehler = { abrufe: 0 };
  const ctx = {
    fetch: () => {
      zaehler.abrufe++;
      const naechste = antworten.shift();
      return naechste instanceof Error
        ? Promise.reject(naechste)
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(naechste) });
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  return { ctx, zaehler };
}

test('zwei Aufrufe, ein Abruf — und alle bekommen dasselbe Array', async () => {
  const { ctx, zaehler } = sandbox([[{ id: 10 }]]);
  vm.runInContext(maiosProdukteQuelle(), ctx);
  const [a, b] = await Promise.all([ctx.maiosProdukte(), ctx.maiosProdukte()]);
  assert.strictEqual(zaehler.abrufe, 1);
  assert.strictEqual(a, b);
  assert.strictEqual(a[0].id, 10);
});

test('nach einem Fehler darf ein spaeterer Aufruf neu laden', async () => {
  const { ctx, zaehler } = sandbox([new Error('Netz weg'), [{ id: 11 }]]);
  vm.runInContext(maiosProdukteQuelle(), ctx);
  await assert.rejects(ctx.maiosProdukte(), /Netz weg/);
  const zweiter = await ctx.maiosProdukte();
  assert.strictEqual(zaehler.abrufe, 2);
  assert.strictEqual(zweiter[0].id, 11);

  // GEGENPROBE: Ohne das Zuruecksetzen bliebe der Fehler fuer immer stehen —
  // ein einziger Netzaussetzer haette Galerie und Warenkorb fuer die ganze
  // Sitzung lahmgelegt.
  const ohneZuruecksetzen = maiosProdukteQuelle().replace('window.__maiosProdukte = null; ', '');
  assert.notStrictEqual(ohneZuruecksetzen, maiosProdukteQuelle(), 'Gegenprobe greift nicht');
  const g = sandbox([new Error('Netz weg'), [{ id: 11 }]]);
  vm.runInContext(ohneZuruecksetzen, g.ctx);
  await assert.rejects(g.ctx.maiosProdukte());
  await assert.rejects(g.ctx.maiosProdukte(), 'der Fehler bliebe kleben');
  assert.strictEqual(g.zaehler.abrufe, 1);
});

test('das Inline-Skript legt an, app.js haengt sich daran — kein zweiter Abruf', async () => {
  const seite = lies('produkte/elektrischer-wasserspender-fuer-schreibtisch.html');
  const start = seite.indexOf('if (!window.__maiosProdukte) {');
  const ende = seite.indexOf('\n    }', start);
  assert.ok(start > 0 && ende > start, 'Anlegen im Inline-Skript nicht gefunden');
  const { ctx, zaehler } = sandbox([[{ id: 10 }]]);
  vm.runInContext(seite.slice(start, ende + 6), ctx);      // Inline-Skript zuerst, wie auf der Seite
  vm.runInContext(maiosProdukteQuelle(), ctx);             // dann app.js
  const liste = await ctx.maiosProdukte();
  assert.strictEqual(zaehler.abrufe, 1);
  assert.strictEqual(liste[0].id, 10);
});
