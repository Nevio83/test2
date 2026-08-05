/**
 * Tests fuer die Bildgroessen auf den Produktseiten.
 *
 * Ausgangslage: die Verkleinerung war seit Runde 6 gebaut und lief auf der
 * Startseite — auf den Produktseiten wurde sie nie eingeschaltet. Am Handy
 * wurden dadurch 56-px-Kacheln mit 800-px-Quellen geladen, bis zum
 * Vierzehnfachen der noetigen Bildpunkte.
 *
 * Warum ein Test: Das faellt niemandem auf. Die Seite sieht identisch aus, sie
 * laedt nur mehr. Und die naechste Produktseite, die jemand nach Vorlage
 * anlegt, hat den Fehler wieder — hier faellt genau das auf.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const PRODUKTSEITEN = fs.readdirSync(path.join(WURZEL, 'produkte')).filter((f) => f.endsWith('.html'));

/** Die Breiten, die server.js ueberhaupt ausliefert. */
const ERLAUBTE_BREITEN = [160, 320, 480, 640];

function lies(datei) {
  return fs.readFileSync(path.join(WURZEL, 'produkte', datei), 'utf8');
}

test('es gibt überhaupt Produktseiten zu prüfen', () => {
  // Sonst waeren alle Tests hier leer und trotzdem gruen.
  assert.ok(PRODUKTSEITEN.length >= 40, 'nur ' + PRODUKTSEITEN.length + ' Seiten gefunden');
});

test('Empfehlungskacheln laden nicht in voller Größe', () => {
  const ohne = [];
  for (const datei of PRODUKTSEITEN) {
    const html = lies(datei);
    const treffer = [...html.matchAll(/<div class="pp-similar-img">\s*<img src="([^"]+)"/g)];
    assert.equal(treffer.length, 4, `${datei}: ${treffer.length} Kacheln statt 4`);
    for (const t of treffer) {
      if (!/\?w=\d+/.test(t[1])) ohne.push(`${datei}: ${t[1].slice(0, 50)}`);
    }
  }
  assert.deepEqual(ohne, [], 'Kacheln ohne Breitenangabe:\n  ' + ohne.slice(0, 5).join('\n  '));
});

test('die verwendeten Breiten liefert der Server auch wirklich aus', () => {
  // Eine Breite, die nicht in der Liste steht, wird stillschweigend ignoriert:
  // der Server liefert dann das Original. Sieht aus wie eingebaut, wirkt nicht.
  const falsch = [];
  for (const datei of PRODUKTSEITEN) {
    for (const t of lies(datei).matchAll(/<img[^>]+src="[^"]*\?w=(\d+)"/g)) {
      if (!ERLAUBTE_BREITEN.includes(Number(t[1]))) falsch.push(`${datei}: w=${t[1]}`);
    }
  }
  assert.deepEqual(falsch, [], 'unbekannte Breiten: ' + falsch.join(', '));
});

test('die Skripte fordern nur Breiten an, die es gibt', () => {
  // Dieselbe Falle, nur zur Laufzeit: product-gallery-complete.js,
  // color-image-selection.js und bundle-images-final.js haengen die Breite
  // selbst an. Steht dort eine Zahl, die server.js nicht kennt, laedt der
  // Besucher weiterhin das Original — ohne dass irgendetwas meldet.
  const dateien = ['product-gallery-complete.js', 'color-image-selection.js', 'bundle-images-final.js'];
  const falsch = [];
  for (const d of dateien) {
    const quelle = fs.readFileSync(path.join(WURZEL, d), 'utf8');
    for (const t of quelle.matchAll(/['"`]?w=['"`]?\s*\+?\s*(\d+)|w=(\d+)/g)) {
      const zahl = Number(t[1] || t[2]);
      if (zahl && !ERLAUBTE_BREITEN.includes(zahl)) falsch.push(`${d}: w=${zahl}`);
    }
    // Die Konstanten selbst muessen ebenfalls passen.
    for (const t of quelle.matchAll(/(?:VORSCHAU_BREITE|KACHEL_BREITE)\s*=\s*(\d+)/g)) {
      if (!ERLAUBTE_BREITEN.includes(Number(t[1]))) falsch.push(`${d}: Konstante ${t[1]}`);
    }
  }
  assert.deepEqual(falsch, [], 'unbekannte Breiten: ' + falsch.join(', '));
});

test('das Hauptbild bleibt in voller Auflösung', () => {
  // Bewusste Grenze: 294 px Anzeige gegen 800 px Quelle ist Faktor 2,7 — der
  // Rest ist Reserve fuer feine Displays und die Lupe. Wer hier eine Breite
  // anhaengt, macht genau das Bild unscharf, an dem der Kunde das Produkt
  // beurteilt.
  const galerie = fs.readFileSync(path.join(WURZEL, 'product-gallery-complete.js'), 'utf8');
  assert.match(
    galerie, /this\.mainImage\.src = this\.images\[index\]\.src;/,
    'Hauptbild bekommt eine Breitenangabe — das war nicht gewollt'
  );
});

test('die Vollbild-Ansicht zeigt nie eine Vorschaufassung', () => {
  // Die Vollbild-Ansicht liest im Notfall Adressen aus dem Dokument — dort
  // stehen auch Vorschaubilder. Ohne volleAdresse() wuerde eine 160-px-Fassung
  // gross gezogen: unscharf, und niemand kaeme auf den Grund.
  const galerie = fs.readFileSync(path.join(WURZEL, 'product-gallery-complete.js'), 'utf8');
  assert.match(galerie, /src: volleAdresse\(img\.src\)/);
});

test('GEGENPROBE: eine Kachel ohne Breitenangabe fällt auf', () => {
  // Ohne diese Probe koennte die Pruefung oben auch dann gruen sein, wenn das
  // Suchmuster gar nichts findet.
  const echt = lies(PRODUKTSEITEN[0]);
  const kaputt = echt.replace(/(<div class="pp-similar-img">\s*<img src="[^"]+)\?w=\d+/, '$1');
  assert.notEqual(kaputt, echt, 'Suchmuster trifft nichts — dann prüft der Test nichts');

  const treffer = [...kaputt.matchAll(/<div class="pp-similar-img">\s*<img src="([^"]+)"/g)];
  const ohne = treffer.filter((t) => !/\?w=\d+/.test(t[1]));
  assert.equal(ohne.length, 1, 'die fehlende Angabe muss auffallen');
});
