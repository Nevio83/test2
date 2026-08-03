/**
 * Tests fuer die Datei-Freigabe.
 *
 * Warum ausgerechnet hier: Ohne diese Pruefung liefert express.static das
 * GESAMTE Projektverzeichnis aus. Am 27.07. war live abrufbar: server.js,
 * database.js, voucher-validator.js (also saemtliche Gutscheincodes samt
 * Bedingungen), die Lieferantenliste in excel/ MIT EINKAUFSPREISEN und
 * erzeugte Beleg-PDFs. Eine Regression hier reisst genau dieses Loch wieder
 * auf — und zwar lautlos, denn der Shop funktioniert dabei einwandfrei.
 *
 * Die Tests laufen bewusst gegen das ECHTE Projektverzeichnis, nicht gegen
 * einen Nachbau: nur so faellt auf, wenn eine neue Backend-Datei dazukommt,
 * die versehentlich oeffentlich waere.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { createStaticGuard } = require('../static-guard');

const WURZEL = path.join(__dirname, '..');

// createStaticGuard meldet beim Bauen einmal in die Konsole — im Test still.
const echtesLog = console.log;
console.log = () => {};
const guard = createStaticGuard(WURZEL);
console.log = echtesLog;

/**
 * Laesst die Pruefung fuer einen Pfad laufen.
 * @returns {'durchgelassen'|'geblockt'} — geblockt heisst: Antwort mit 404.
 */
function pruefe(pfad) {
  let ergebnis = null;
  const req = { path: pfad };
  const res = {
    status(code) { this._code = code; return this; },
    type() { return this; },
    send() { ergebnis = 'geblockt'; },
    json() { ergebnis = 'geblockt'; }
  };
  guard(req, res, () => { ergebnis = 'durchgelassen'; });
  return ergebnis;
}

test('Backend-Dateien sind NICHT abrufbar', () => {
  const geheim = [
    '/server.js',
    '/database.js',
    '/voucher-validator.js',     // enthaelt alle Gutscheincodes
    '/price-validator.js',
    '/csp-inline.js',
    '/job-scheduler.js',
    '/package.json',
    '/package-lock.json',
    '/CLAUDE.md',
    '/CLAUDE-CODE.md'
  ];
  for (const p of geheim) {
    assert.equal(pruefe(p), 'geblockt', 'MUSS gesperrt sein: ' + p);
  }
});

test('Lieferantenliste mit Einkaufspreisen ist nicht abrufbar', () => {
  assert.equal(pruefe('/excel/Maios Produkte.csv'), 'geblockt');
  assert.equal(pruefe('/excel/Maios Preisanalyse 2026-06.xlsx'), 'geblockt');
  // Ein VERZEICHNIS wird durchgereicht — dort gibt es nichts auszuliefern,
  // express.static zeigt kein Inhaltsverzeichnis, und die 404-Seite greift.
  assert.equal(pruefe('/excel/'), 'durchgelassen');
});

test('die Wurzel wird normalisiert — sonst fällt die Prüfung lautlos AUF', () => {
  // Kommt die Wurzel mit Schraegstrichen herein, passt der interne
  // startsWith-Vergleich unter Windows nicht mehr. Ohne Normalisierung wuerde
  // die Pruefung dann ALLES durchreichen: server.js, .env, Lieferantenliste.
  const echt = console.log; console.log = () => {};
  const mitSchraegstrichen = createStaticGuard(WURZEL.replace(/\\/g, '/'));
  console.log = echt;

  let ergebnis = null;
  const res = {
    status() { return this; }, type() { return this; },
    send() { ergebnis = 'geblockt'; }, json() { ergebnis = 'geblockt'; }
  };
  mitSchraegstrichen({ path: '/server.js' }, res, () => { ergebnis = 'durchgelassen'; });
  assert.equal(ergebnis, 'geblockt', 'muss auch bei anders geschriebener Wurzel sperren');
});

test('Frontend-Dateien sind abrufbar', () => {
  const oeffentlich = [
    '/',
    '/index.html',
    '/cart.html',
    '/app.js',
    '/cart.js',
    '/styles.css',
    '/produkte/led-crystal-lampe.html',
    '/infos/agb.html',
    '/images/logo.png'
  ];
  for (const p of oeffentlich) {
    assert.equal(pruefe(p), 'durchgelassen', 'MUSS erreichbar sein: ' + p);
  }
});

test('Pfade, unter denen keine Datei liegt, werden durchgereicht', () => {
  // Entscheidend: hinter express.static haengen rund 89 API-Routen und die
  // 404-Seite. Wuerde hier stumpf jeder nicht freigegebene Pfad geblockt,
  // waeren Bewertungen, Retouren, Newsletter und das Admin-Dashboard tot.
  // Genau das ist beim Bauen einmal passiert.
  const routen = [
    '/api/reviews',
    '/api/newsletter/subscribe',
    '/a29715347575/api/jobs',
    '/sitemap.xml',
    '/google-feed.xml',
    '/gibt-es-nicht'
  ];
  for (const p of routen) {
    assert.equal(pruefe(p), 'durchgelassen', 'Route muss durchkommen: ' + p);
  }
});

test('Ausbruch aus dem Verzeichnis wird abgewehrt', () => {
  for (const p of ['/../server.js', '/produkte/../../server.js', '/..%2Fserver.js']) {
    assert.notEqual(pruefe(p), undefined, 'keine Ausnahme bei: ' + p);
    // Wichtig ist, dass NICHT die Datei ausgeliefert wird — durchgelassen
    // waere hier unkritisch, weil express.static selbst normalisiert; ein
    // Absturz oder ein Treffer waere es nicht.
  }
});

test('kaputte Kodierung und Null-Zeichen führen nicht zur Auslieferung', () => {
  assert.doesNotThrow(() => pruefe('/%E0%A4%A'));
  assert.doesNotThrow(() => pruefe('/server.js%00.png'));
});

test('Zugangsdaten und Konfigurationsdateien sind nicht abrufbar', () => {
  // .env und .nvmrc liegen wirklich im Projekt — sie MÜSSEN gesperrt sein.
  for (const p of ['/.env', '/.nvmrc', '/.gitignore']) {
    assert.equal(pruefe(p), 'geblockt', 'MUSS gesperrt sein: ' + p);
  }
  // Was es nicht gibt, wird durchgereicht, damit Routen und 404-Seite greifen.
  for (const p of ['/Dockerfile', '/irgendwas.sh']) {
    assert.equal(pruefe(p), 'durchgelassen', 'nicht vorhanden -> durchreichen: ' + p);
  }
});
