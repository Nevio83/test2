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
const VERSION = /bootstrap-icons@(\d+\.\d+\.\d+)/g;

function seiten() {
  return ORDNER.flatMap((o) => fs.readdirSync(path.join(WURZEL, o))
    .filter((n) => n.endsWith('.html')).map((n) => path.join(o, n)));
}

/** Alle Icon-Versionen, die eine Seite laedt — mit Herkunft (Link oder @import). */
function iconQuellen(html, seitenPfad, lesen = (p) => fs.readFileSync(p, 'utf8')) {
  const quellen = [];
  for (const link of html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)) {
    const href = link[1];
    for (const v of href.matchAll(VERSION)) quellen.push({ version: v[1], adresse: href, weg: 'Link' });
    if (/\.css$/.test(href) && !/^https?:/.test(href)) {
      const datei = path.join(WURZEL, path.dirname(seitenPfad), href.replace(/^\//, path.relative(path.dirname(seitenPfad), '.') + '/'));
      let css = '';
      try { css = lesen(datei); } catch { continue; }
      for (const imp of css.matchAll(/@import\s+url\(\s*['"]?([^'")]+)/g)) {
        for (const v of imp[1].matchAll(VERSION)) quellen.push({ version: v[1], adresse: imp[1], weg: `@import in ${href}` });
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

test('alle Seiten nutzen dieselbe Icon-Version', () => {
  const versionen = new Map();
  for (const seite of seiten()) {
    for (const q of iconQuellen(fs.readFileSync(path.join(WURZEL, seite), 'utf8'), seite)) {
      if (!versionen.has(q.version)) versionen.set(q.version, []);
      versionen.get(q.version).push(seite);
    }
  }
  assert.strictEqual(versionen.size, 1, [...versionen].map(([v, s]) => `${v}: ${s.length} Seiten`).join(', '));
});

test('Gegenprobe: eine Seite mit eigenem 1.10.0-Link plus info.css wird erkannt', () => {
  // So stand infos/agb.html bis zum 20.10. da.
  const html = [
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">',
    '<link href="info.css" rel="stylesheet">',
  ].join('\n');
  const quellen = iconQuellen(html, 'infos/agb.html');
  assert.deepStrictEqual(quellen.map((q) => q.version), ['1.10.0', '1.11.3'],
    'info.css bringt 1.11.3 per @import mit — sonst prueft der Test die Imports nicht');
});
