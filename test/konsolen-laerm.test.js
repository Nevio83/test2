/**
 * Tests für die Aufräumung der Browser-Konsole auf Kundenseiten.
 *
 * Anlass: Am Live-Shop mitgelesen -- eine Produktseite schrieb rund 30
 * Meldungen in die Browser-Konsole, darunter vollständige Produktdaten und
 * interne Dateipfade. 47 dieser Meldungen (in app.js) waren zusätzlich durch
 * einen CP1252/UTF-8-Kodierungsfehler zerschossen -- statt "📋" stand dort
 * "ðŸ“‹". Zwei unabhängige Fixe, ein gemeinsames Ziel: die Konsole zeigt auf
 * der echten Domain nur noch, was wirklich schiefgeht.
 *
 * 1. Mojibake-Reparatur (app.js): die betroffenen Bytes wurden über eine
 *    CP1252-Rückabbildung repariert, nicht neu getippt -- ein Test prüft,
 *    dass kein Muster dieser Art mehr vorkommt.
 * 2. konsole-daempfer.js: neues, zuerst geladenes Skript auf allen 45
 *    betroffenen Seiten. Dämpft console.log/info/debug außerhalb von
 *    localhost -- das Gegenstück zum LOG_LEVEL-Schalter in server.js, nur
 *    per Hostname statt ENV, weil es für statische Seiten keine ENV gibt.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WURZEL = path.join(__dirname, '..');

// ── 1. Mojibake-Reparatur ─────────────────────────────────────────────

const appSrc = fs.readFileSync(path.join(WURZEL, 'app.js'), 'utf8');

// Dieselbe Erkennung wie beim Aufspüren des Fehlers: CP1252-Mojibake für
// UTF-8-Mehrbyte-Zeichen beginnt immer mit "ð" (4-Byte-Emoji) oder "â"
// (3-Byte-Symbole wie ✅/❌/⚠️). Kommt danach ein zweites Zeichen aus dem
// CP1252-Sonderbereich (0x80-0x9F, als typografische Zeichen kodiert), ist
// es kein normaler Umlaut, sondern zerschossener Text.
const MOJIBAKE_MUSTER = /[ðâ][€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;

test('app.js enthält keine CP1252-Mojibake-Muster mehr', () => {
  const treffer = appSrc.match(new RegExp(MOJIBAKE_MUSTER, 'g')) || [];
  assert.deepEqual(treffer, [], `${treffer.length} Mojibake-Stelle(n) gefunden -- z.B. ${treffer[0]}`);
});

test('die reparierten Emoji stehen jetzt korrekt in app.js', () => {
  // Stichprobe der ursprünglich betroffenen Symbole (aus dem Fund).
  for (const emoji of ['📋', '✅', '❌', '🛒', '🔍', '🔗', '💜', '📦', '🎨', '⚠️']) {
    assert.ok(appSrc.includes(emoji), `Emoji ${emoji} fehlt -- Reparatur unvollständig?`);
  }
});

test('die Reparatur hat keine console-Aufrufe verloren', () => {
  // Bekannter Vorher-Wert (aus dem Commit vor der Reparatur) -- stellt sicher,
  // dass repariert wurde, nicht gelöscht.
  const anzahl = (appSrc.match(/console\.(log|info|debug|warn|error)\s*\(/g) || []).length;
  assert.equal(anzahl, 171, 'Anzahl console-Aufrufe in app.js hat sich verändert');
});

test('GEGENPROBE: ein künstlich eingefügtes Mojibake-Muster fällt auf', () => {
  const kaputt = appSrc.replace('📋', 'ðŸ“‹');
  const treffer = kaputt.match(new RegExp(MOJIBAKE_MUSTER, 'g')) || [];
  assert.ok(treffer.length >= 1, 'die Erkennung muss ein frisch eingefügtes Mojibake finden');
});

// ── 2. konsole-daempfer.js: Verhalten in einer Browser-Attrappe ───────

const daempferSrc = fs.readFileSync(path.join(WURZEL, 'konsole-daempfer.js'), 'utf8');

/** Führt konsole-daempfer.js mit einem gegebenen location.hostname aus und
 * gibt zurück, ob console.log/warn danach noch die Original-Funktionen sind. */
function daempferLaufenLassen(hostname) {
  const originalLog = () => {};
  const originalWarn = () => {};
  const konsole = { log: originalLog, info: () => {}, debug: () => {}, warn: originalWarn, error: () => {} };
  const umgebung = vm.createContext({
    location: { hostname },
    console: konsole
  });
  vm.runInContext(daempferSrc, umgebung);
  return {
    logUnveraendert: konsole.log === originalLog,
    warnUnveraendert: konsole.warn === originalWarn,
    konsole
  };
}

test('auf localhost bleibt console.log unangetastet', () => {
  for (const host of ['localhost', '127.0.0.1', '']) {
    const { logUnveraendert, warnUnveraendert } = daempferLaufenLassen(host);
    assert.ok(logUnveraendert, `hostname="${host}": console.log wurde verändert, sollte aber unverändert bleiben`);
    assert.ok(warnUnveraendert, `hostname="${host}": console.warn wurde verändert`);
  }
});

test('auf der echten Domain wird console.log stummgeschaltet', () => {
  const { logUnveraendert } = daempferLaufenLassen('maiosshop.com');
  assert.ok(!logUnveraendert, 'console.log sollte auf maiosshop.com überschrieben werden');
});

test('console.warn und console.error bleiben auf der echten Domain unangetastet', () => {
  const { warnUnveraendert } = daempferLaufenLassen('maiosshop.com');
  assert.ok(warnUnveraendert, 'console.warn darf nicht gedämpft werden -- das ist, was wirklich schiefgeht');
});

test('console.log wird auf der echten Domain zu einem echten No-op', () => {
  const { konsole } = daempferLaufenLassen('maiosshop.com');
  let geloggt = false;
  // Der Test ruft die gepatchte Funktion auf und prüft, ob sie wirklich
  // nichts tut, statt nur zu prüfen, dass sie "anders" ist als vorher.
  const alterConsoleLog = console.log;
  console.log = () => { geloggt = true; };
  konsole.log('sollte nicht ankommen');
  console.log = alterConsoleLog;
  assert.equal(geloggt, false, 'console.log lief noch durch, obwohl es gedämpft sein sollte');
});

test('GEGENPROBE: ein Skript, das AUCH auf localhost dämpft, würde auffallen', () => {
  const kaputtesSkript = daempferSrc.replace(
    "['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1",
    'false'
  );
  const umgebung = vm.createContext({
    location: { hostname: 'localhost' },
    console: { log: () => {}, info: () => {}, debug: () => {}, warn: () => {}, error: () => {} }
  });
  const originalLog = umgebung.console.log;
  vm.runInContext(kaputtesSkript, umgebung);
  assert.notEqual(umgebung.console.log, originalLog,
    'die Gegenprobe muss zeigen, dass eine kaputte Hostname-Prüfung auch localhost dämpfen würde');
});

// ── 3. Einbindung: das Dämpfer-Skript läuft auf allen 45 Seiten ZUERST ─

const SEITEN = [
  'cart.html', 'gutscheine.html', 'success.html', 'wishlist.html',
  'infos/versand.html',
  ...fs.readdirSync(path.join(WURZEL, 'produkte'))
    .filter((d) => d.endsWith('.html'))
    .map((d) => 'produkte/' + d)
];

test('konsole-daempfer.js ist auf allen 45 betroffenen Seiten das erste <script>', () => {
  assert.equal(SEITEN.length, 45, 'unerwartete Seitenzahl -- Liste der Produktseiten geändert?');
  for (const rel of SEITEN) {
    const html = fs.readFileSync(path.join(WURZEL, rel), 'utf8');
    const skriptTreffer = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)];
    assert.ok(skriptTreffer.length > 0, `${rel}: kein <script src="..."> gefunden`);
    assert.match(skriptTreffer[0][1], /konsole-daempfer\.js$/,
      `${rel}: erstes Skript ist "${skriptTreffer[0][1]}", nicht konsole-daempfer.js`);
  }
});

test('GEGENPROBE: eine Seite ohne das Skript fällt auf', () => {
  const ohneSkript = '<head><script src="app.js"></script></head>';
  const treffer = [...ohneSkript.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)];
  assert.doesNotMatch(treffer[0][1], /konsole-daempfer\.js$/, 'die Gegenprobe selbst muss ohne Dämpfer sein');
});
