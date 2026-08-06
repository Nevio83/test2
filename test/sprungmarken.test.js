/**
 * Tests fuer interne Links auf Sprungmarken.
 *
 * Anlass: Fuenf Infoseiten verlinkten mit "Alle Produkte ansehen" und
 * "Weiter einkaufen" auf eine Sprungmarke der Startseite, die es seit deren
 * Umbau nicht mehr gibt. Wer darauf klickte, landete oben auf der Startseite
 * statt bei den Produkten — auf genau den Wegen, auf denen jemand gerade
 * kaufen will.
 *
 * Warum ein Test: Ein toter Anker wirft keinen Fehler. Der Browser springt
 * einfach nicht, die Seite laedt normal, in der Konsole steht nichts. Das
 * faellt nur auf, wenn man jeden Link einzeln anklickt.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const AUS = ['node_modules', '.git', 'graphify-out', 'Marketing', 'produkt bilder',
  'karten', 'excel', 'receipts', 'test', 'produkt videos', '.claude',
  'design_handoff_warenkorb'];

function sammle(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (AUS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sammle(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const SEITEN = sammle(WURZEL);
const inhalt = new Map(SEITEN.map((p) => [
  '/' + path.relative(WURZEL, p).split(path.sep).join('/'),
  fs.readFileSync(p, 'utf8')
]));

/** Gibt es diese Sprungmarke in der Seite? id= oder name= (alte Schreibweise). */
function markeVorhanden(html, marke) {
  return new RegExp('(?:id|name)=["\']' + marke.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']').test(html);
}

/**
 * Sammelt alle Links, die auf eine Sprungmarke EINER ANDEREN SEITE zeigen.
 * Reine "#marke"-Links innerhalb derselben Seite werden mitgeprueft, indem
 * die Seite selbst als Ziel gilt.
 */
function ankerLinks() {
  const treffer = [];
  for (const [seite, html] of inhalt) {
    for (const m of html.matchAll(/href=["']([^"']*#[\w-]+)["']/g)) {
      const roh = m[1];
      const [pfadTeil, marke] = roh.split('#');
      if (!marke) continue;
      let ziel;
      if (!pfadTeil) ziel = seite;                       // "#marke" -> gleiche Seite
      else if (pfadTeil.startsWith('http')) continue;    // fremde Adresse
      else {
        const ohneFrage = pfadTeil.split('?')[0];
        ziel = ohneFrage.startsWith('/')
          ? ohneFrage
          : '/' + path.posix.normalize(path.posix.join(path.posix.dirname(seite), ohneFrage));
      }
      if (ziel === '/') ziel = '/index.html';
      treffer.push({ seite, roh, ziel, marke, zeile: html.slice(0, m.index).split('\n').length });
    }
  }
  return treffer;
}

const LINKS = ankerLinks();

test('es gibt überhaupt Sprungmarken-Links zu prüfen', () => {
  // Sonst waere der Test unten leer und trotzdem gruen.
  assert.ok(LINKS.length >= 10, 'nur ' + LINKS.length + ' gefunden — stimmt der Suchpfad?');
});

test('jeder Link zeigt auf eine Sprungmarke, die es gibt', () => {
  const kaputt = [];
  for (const l of LINKS) {
    const zielHtml = inhalt.get(l.ziel);
    if (zielHtml === undefined) continue;   // Zielseite gehoert nicht zum Shop
    if (!markeVorhanden(zielHtml, l.marke)) {
      kaputt.push(`${l.seite}:${l.zeile} → ${l.roh}  (Marke "${l.marke}" fehlt in ${l.ziel})`);
    }
  }
  assert.deepEqual(kaputt, [], 'Links ins Leere:\n  ' + kaputt.join('\n  '));
});

test('der Kategorie-Parameter der Angebote-Seite wird auch ausgewertet', () => {
  // Die Angebote-Seite haengt "?category=…" an. Liest home.js das nicht,
  // landet der Besucher auf "Alle" — der Knopf tut dann so, als filtere er.
  const angebote = inhalt.get('/infos/angebote.html');
  assert.match(angebote, /\?category=\$\{encodeURIComponent/, 'Angebote-Seite setzt den Parameter');

  const home = fs.readFileSync(path.join(WURZEL, 'home.js'), 'utf8');
  assert.match(home, /get\(['"]category['"]\)/, 'home.js liest ihn nicht aus');
});

test('GEGENPROBE: eine erfundene Sprungmarke fällt auf', () => {
  // Ohne das koennte der Test oben gruen sein, weil das Suchmuster nichts
  // findet oder markeVorhanden() immer true liefert.
  const html = inhalt.get('/index.html');
  assert.ok(markeVorhanden(html, 'sortiment'), 'die echte Marke muss gefunden werden');
  assert.ok(!markeVorhanden(html, 'productGrid'), 'die alte Marke gibt es wirklich nicht mehr');
  assert.ok(!markeVorhanden(html, 'gibtEsNicht123'), 'Erfundenes darf nicht gefunden werden');
});
