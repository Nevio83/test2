/**
 * Punkt 60: Schriften und Icons kommen vom Shop selbst, nicht von Google.
 *
 * BEFUND VOM 07.10. (Handy-Messung): Zwei fremde Stylesheets hielten die
 * Darstellung auf — Google Fonts (fertig nach 1,7 s) und die Bootstrap-Icons
 * von jsdelivr (2,0 s), jedes mit eigener neuer Verbindung; das eigene CSS war
 * nach 0,6 s da. Dazu sah Google bei jedem Seitenaufruf die Adresse des
 * Besuchers, ohne Einwilligung und ohne Erwaehnung in der Datenschutzerklaerung.
 *
 * Seit dem 20.10. liegen beide unter /schriften/. Was hier geprueft wird, ist
 * genau das, was lautlos kaputtgehen kann:
 *   - ein neuer Google-Link in einer Seite (sieht aus wie vorher, funktioniert)
 *   - eine Schriftdatei, auf die das CSS zeigt, die es aber nicht gibt
 *     (die Seite faellt still auf die Ersatzschrift zurueck)
 *   - die Datei-Freigabe, die den neuen Ordner nicht durchlaesst
 *     (dieselbe stille Ersatzschrift — und Icons als leere Kaestchen)
 *   - eine CSP, die Google weiter erlaubt
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createStaticGuard, PUBLIC_DIRS } = require('../static-guard');
const { buildCsp } = require('../csp-policy');

const WURZEL = path.join(__dirname, '..');
const ORDNER = ['', 'produkte', 'infos', 'a29715347575'];
const FREMD = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/npm\/bootstrap-icons/;

function ausgelieferteDateien() {
  return ORDNER.flatMap((o) => fs.readdirSync(path.join(WURZEL, o))
    .filter((n) => /\.(html|css)$/.test(n)).map((n) => path.join(o, n)));
}

function fremdeVerweise(text) {
  return text.split(/\r?\n/).filter((z) => FREMD.test(z)).map((z) => z.trim());
}

test('keine Seite und kein Stylesheet holt Schriften oder Icons von fremden Servern', () => {
  const funde = [];
  for (const datei of ausgelieferteDateien()) {
    for (const z of fremdeVerweise(fs.readFileSync(path.join(WURZEL, datei), 'utf8'))) {
      funde.push(`${datei}: ${z.slice(0, 100)}`);
    }
  }
  assert.deepStrictEqual(funde, []);
});

test('Gegenprobe: die alten Zeilen waeren gemeldet worden', () => {
  const alt = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet">',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">',
    "@import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');",
    // Bootstrap selbst bleibt bei jsdelivr — das darf NICHT anschlagen:
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">',
  ].join('\n');
  assert.strictEqual(fremdeVerweise(alt).length, 4);
});

test('jede Schriftdatei, auf die ein Stylesheet zeigt, gibt es — und sie ist WOFF2/WOFF', () => {
  const stile = ['schriften/schriften.css', 'schriften/bootstrap-icons/bootstrap-icons.min.css'];
  let gezaehlt = 0;
  for (const stil of stile) {
    const css = fs.readFileSync(path.join(WURZEL, stil), 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const datei = path.join(WURZEL, path.dirname(stil), m[1].split(/[?#]/)[0]);
      assert.ok(fs.existsSync(datei), `${stil} zeigt auf ${m[1]} — die Datei fehlt`);
      const kopf = fs.readFileSync(datei).subarray(0, 4).toString('latin1');
      assert.ok(kopf === 'wOF2' || kopf === 'wOFF', `${m[1]} ist keine Webschrift (Kopf "${kopf}")`);
      gezaehlt += 1;
    }
  }
  assert.strictEqual(gezaehlt, 10, '8 Schriften + 2 Icon-Dateien');
});

test('jede Familie hat latin und latin-ext — sonst fehlen Umlaute oder Sonderzeichen', () => {
  const css = fs.readFileSync(path.join(WURZEL, 'schriften', 'schriften.css'), 'utf8');
  const regeln = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const je = new Map();
  for (const r of regeln) {
    const familie = /font-family:\s*'([^']+)'/.exec(r)[1];
    const datei = /url\(([^)]+)\)/.exec(r)[1];
    if (!je.has(familie)) je.set(familie, []);
    je.get(familie).push(datei);
    // ä ö ü ß liegen in U+0000-00FF — die latin-Regel muss sie abdecken.
    if (datei.endsWith('-latin.woff2')) assert.match(r, /U\+0000-00FF/, `${familie}: latin ohne Umlaute`);
  }
  assert.deepStrictEqual([...je.keys()].sort(), ['Inter', 'Manrope', 'Marcellus', 'Outfit']);
  for (const [familie, dateien] of je) assert.strictEqual(dateien.length, 2, familie);
});

// createStaticGuard meldet beim Bauen einmal in die Konsole — im Test still.
const echtesLog = console.log;
console.log = () => {};
const guard = createStaticGuard(WURZEL);
console.log = echtesLog;

function pruefe(pfad) {
  let ergebnis = null;
  const res = {
    status() { return this; }, type() { return this; },
    send() { ergebnis = 'geblockt'; }, json() { ergebnis = 'geblockt'; },
  };
  guard({ path: pfad }, res, () => { ergebnis = 'durchgelassen'; });
  return ergebnis;
}

const NOETIG = [
  '/schriften/schriften.css',
  '/schriften/inter-latin.woff2',
  '/schriften/outfit-latin-ext.woff2',
  '/schriften/bootstrap-icons/bootstrap-icons.min.css',
  '/schriften/bootstrap-icons/fonts/bootstrap-icons.woff2',
];

test('die Datei-Freigabe laesst Schriften und Icons durch, aber nicht die Beschreibung daneben', () => {
  for (const p of NOETIG) assert.strictEqual(pruefe(p), 'durchgelassen', p);
  assert.strictEqual(pruefe('/schriften/README.md'), 'geblockt');
  assert.strictEqual(pruefe('/schriften/bootstrap-icons/LICENSE'), 'geblockt');
});

test('Gegenprobe: ohne "schriften" in der Freigabe waeren alle geblockt', () => {
  PUBLIC_DIRS.delete('schriften');
  try {
    for (const p of NOETIG) assert.strictEqual(pruefe(p), 'geblockt', p);
  } finally {
    PUBLIC_DIRS.add('schriften');
  }
});

test('die CSP erlaubt Google Fonts nicht mehr — Schriften kommen von self', () => {
  // Beide Fassungen: ohne Seitenkenntnis (Rueckfall) und verschaerft mit
  // style-src-elem — dort stand Google ein drittes Mal.
  for (const csp of [buildCsp(), buildCsp([], [])]) {
    assert.doesNotMatch(csp, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    const schrift = /(?:^|; )font-src ([^;]+)/.exec(csp)[1].split(' ');
    assert.ok(schrift.includes("'self'"), schrift.join(' '));
  }
  assert.match(buildCsp([], []), /style-src-elem /, 'die verschaerfte Fassung wurde wirklich gebaut');
});
