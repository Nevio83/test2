/**
 * Punkt 60: Bootstrap-Icons in genau EINER Version.
 *
 * BEFUND VOM 15.10.: 12 Seiten luden die Icons in Version 1.10.0, alle
 * anderen in 1.11.3. Fuenf Infoseiten luden sogar beide — die alte per
 * eigenem Link, die neue per @import aus infos/info.css. Zwei Versionen heissen:
 * zwei render-blockierende Stylesheets von einem fremden Server, zwei
 * Schriftdateien, und kein gemeinsamer Zwischenspeicher, wenn ein Besucher von
 * der Produktseite auf die AGB wechselt.
 *
 * Seit dem 20.10. liegen die Icons unter /schriften/bootstrap-icons/ — die
 * Adresse traegt dann keine Versionsnummer mehr. Die Version kommt in dem Fall
 * aus dem Kopf der Datei selbst ("Bootstrap Icons v1.11.3"). Ohne das fiele
 * die lokale Kopie aus der Pruefung heraus, und eine zweite, fremde Version
 * daneben stuende allein da und saehe aus wie "eine Version".
 *
 * Geprueft wird jede ausgelieferte Seite (Wurzel, produkte/, infos/,
 * a29715347575/) samt der lokalen Stylesheets, die sie einbindet, und deren
 * @import-Zeilen.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const ORDNER = ['', 'produkte', 'infos', 'a29715347575'];
const VERSION = /bootstrap-icons@(\d+\.\d+\.\d+)/;
const KOPF = /Bootstrap Icons v(\d+\.\d+\.\d+)/;

function seiten() {
  return ORDNER.flatMap((o) => fs.readdirSync(path.join(WURZEL, o))
    .filter((n) => n.endsWith('.html')).map((n) => path.join(o, n)));
}

/** Lokale Adresse -> Datei. "/x" gilt ab der Wurzel, sonst ab dem Ordner der einbindenden Datei. */
function aufloesen(adresse, basisOrdner) {
  const ohneAnfrage = adresse.split(/[?#]/)[0];
  return ohneAnfrage.startsWith('/')
    ? path.join(WURZEL, ohneAnfrage)
    : path.join(WURZEL, basisOrdner, ohneAnfrage);
}

/** Die Icon-Version hinter einer Adresse — aus der Adresse oder, lokal, aus dem Dateikopf. */
function versionVon(adresse, basisOrdner, lesen) {
  const ausAdresse = VERSION.exec(adresse);
  if (ausAdresse) return ausAdresse[1];
  if (/^https?:/.test(adresse) || !/bootstrap-icons[^/]*\.css$/.test(adresse.split(/[?#]/)[0])) return null;
  try {
    const kopf = KOPF.exec(lesen(aufloesen(adresse, basisOrdner)));
    return kopf ? kopf[1] : 'unbekannt';
  } catch {
    return 'fehlt';   // eine eingebundene Datei, die es nicht gibt, ist auch ein Befund
  }
}

/** Alle Icon-Versionen, die eine Seite laedt — mit Herkunft (Link oder @import). */
function iconQuellen(html, seitenPfad, lesen = (p) => fs.readFileSync(p, 'utf8')) {
  const quellen = [];
  const seitenOrdner = path.dirname(seitenPfad);
  for (const link of html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)) {
    const href = link[1];
    const version = versionVon(href, seitenOrdner, lesen);
    if (version) { quellen.push({ version, adresse: href, weg: 'Link' }); continue; }
    if (/\.css$/.test(href) && !/^https?:/.test(href)) {
      const datei = aufloesen(href, seitenOrdner);
      let css = '';
      try { css = lesen(datei); } catch { continue; }
      const cssOrdner = path.relative(WURZEL, path.dirname(datei));
      for (const imp of css.matchAll(/@import\s+url\(\s*['"]?([^'")]+)/g)) {
        const v = versionVon(imp[1], cssOrdner, lesen);
        if (v) quellen.push({ version: v, adresse: imp[1], weg: `@import in ${href}` });
      }
    }
  }
  return quellen;
}

test('jede Seite laedt die Icons hoechstens einmal', () => {
  // Gezaehlt werden ADRESSEN: Dieselbe Adresse zweimal (Link und @import) laedt
  // der Browser nur einmal — so steht es in infos/mitteilungen.html, und das
  // ist sogar guenstiger als das @import allein, weil der Link frueher
  // entdeckt wird. Zwei VERSCHIEDENE Adressen sind zwei Downloads.
  const doppelt = [];
  for (const seite of seiten()) {
    const quellen = iconQuellen(fs.readFileSync(path.join(WURZEL, seite), 'utf8'), seite);
    const adressen = new Set(quellen.map((q) => q.adresse));
    if (adressen.size > 1) doppelt.push(`${seite}: ${quellen.map((q) => `${q.version} (${q.weg})`).join(' + ')}`);
  }
  assert.deepStrictEqual(doppelt, []);
});

test('alle Seiten nutzen dieselbe Icon-Version — und die Datei dazu gibt es', () => {
  const versionen = new Map();
  for (const seite of seiten()) {
    for (const q of iconQuellen(fs.readFileSync(path.join(WURZEL, seite), 'utf8'), seite)) {
      if (!versionen.has(q.version)) versionen.set(q.version, []);
      versionen.get(q.version).push(seite);
    }
  }
  assert.strictEqual(versionen.size, 1, [...versionen].map(([v, s]) => `${v}: ${s.length} Seiten`).join(', '));
  assert.ok(versionen.has('1.11.3'), `gefunden: ${[...versionen.keys()].join(', ')}`);
});

test('Gegenprobe: eine Seite mit eigenem 1.10.0-Link plus info.css wird erkannt', () => {
  // So stand infos/agb.html bis zum 20.10. da — info.css bringt die Icons
  // inzwischen aus /schriften/ mit, die Version kommt dann aus dem Dateikopf.
  const html = [
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">',
    '<link href="info.css" rel="stylesheet">',
  ].join('\n');
  const quellen = iconQuellen(html, 'infos/agb.html');
  assert.deepStrictEqual(quellen.map((q) => q.version), ['1.10.0', '1.11.3'],
    'info.css bringt 1.11.3 per @import mit — sonst prueft der Test die Imports nicht');
});

test('Gegenprobe: die lokale Kopie zaehlt mit — fehlt sie, ist das ein Befund', () => {
  const lokal = '<link rel="stylesheet" href="/schriften/bootstrap-icons/bootstrap-icons.min.css">';
  assert.deepStrictEqual(iconQuellen(lokal, 'produkte/x.html').map((q) => q.version), ['1.11.3']);
  // Neben einer fremden zweiten Version waeren das zwei — mit der alten,
  // nur adressbasierten Pruefung stuende die fremde allein da.
  const gemischt = `${lokal}\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">`;
  assert.deepStrictEqual(iconQuellen(gemischt, 'index.html').map((q) => q.version), ['1.11.3', '1.10.0']);
  const ohneDatei = iconQuellen(lokal, 'index.html', () => { throw new Error('ENOENT'); });
  assert.deepStrictEqual(ohneDatei.map((q) => q.version), ['fehlt']);
});
