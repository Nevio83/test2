/**
 * Tests fuer die Beschriftung der Eingabefelder.
 *
 * Worum es geht: Wer die Seite nicht sieht, hoert an einem unbeschrifteten
 * Feld nur "Eingabefeld" — ohne zu erfahren, ob dort die Bestellnummer, die
 * E-Mail oder der Gutscheincode hingehoert. Ein Formular wird damit
 * unbedienbar, ohne dass optisch irgendetwas fehlt.
 *
 * Ein "placeholder" zaehlt hier BEWUSST NICHT als Beschriftung: er verschwindet,
 * sobald jemand tippt, und wird von Screenreadern uneinheitlich behandelt.
 *
 * Der Test deckt HTML-Seiten UND die Vorlagen in den JS-Dateien ab. Beim
 * ersten Auszaehlen war genau das der blinde Fleck: zwei Felder entstehen erst
 * zur Laufzeit (Bundle-Auswahl, "Haeufig zusammen gekauft") und tauchten in
 * keiner HTML-Datei auf.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const AUS = ['node_modules', '.git', 'graphify-out', 'Marketing', 'produkt bilder',
  'karten', 'excel', 'receipts', 'test', 'produkt videos', '.claude',
  'design_handoff_warenkorb', 'a29715347575'];

function sammle(dir, endung, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (AUS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sammle(p, endung, out);
    else if (e.name.endsWith(endung)) out.push(p);
  }
  return out;
}

const FELD = /<(input|textarea|select)\b([^>]*)>/gi;
// Diese Typen sind keine Eingabefelder im Sinne der Beschriftung: sie sind
// entweder unsichtbar oder tragen ihren Text selbst (value/Beschriftung).
const OHNE_BESCHRIFTUNGSPFLICHT = ['hidden', 'submit', 'button', 'reset', 'image'];

/** Umschliesst ein <label> mit echtem Text diese Stelle? */
function inLabelMitText(quelle, pos) {
  const davor = quelle.slice(0, pos);
  const auf = davor.lastIndexOf('<label');
  if (auf === -1 || auf < davor.lastIndexOf('</label>')) return false;
  const zu = quelle.indexOf('</label>', pos);
  if (zu === -1) return false;
  // Markup raus, dann schauen, ob ueberhaupt Text uebrig bleibt. Ein <label>,
  // das nur ein Haekchen-Symbol enthaelt, liest sich als gar nichts vor.
  const text = quelle.slice(auf, zu).replace(/<[^>]*>/g, ' ').replace(/[^\wÄÖÜäöüß]+/g, ' ').trim();
  return text.length >= 3;
}

/** Alle Felder einer Datei, die kein Screenreader benennen kann. */
function stummeFelder(quelle, datei) {
  const perFor = new Set([...quelle.matchAll(/<label[^>]*\bfor="([^"]+)"/gi)].map((m) => m[1]));
  const treffer = [];
  for (const m of quelle.matchAll(FELD)) {
    const attr = m[2];
    const typ = ((attr.match(/\btype="([^"]+)"/i) || [])[1] || 'text').toLowerCase();
    if (OHNE_BESCHRIFTUNGSPFLICHT.includes(typ)) continue;

    const id = (attr.match(/\bid="([^"]+)"/i) || [])[1];
    const beschriftet =
      (id && perFor.has(id)) ||
      /\baria-label\s*=/i.test(attr) ||
      /\baria-labelledby\s*=/i.test(attr) ||
      /\btitle\s*=/i.test(attr) ||
      inLabelMitText(quelle, m.index);

    if (!beschriftet) {
      treffer.push(`${datei}:${quelle.slice(0, m.index).split('\n').length} type=${typ}` +
        ` name=${(attr.match(/\bname="([^"]+)"/i) || [])[1] || '—'}`);
    }
  }
  return treffer;
}

const HTML_SEITEN = sammle(WURZEL, '.html');
const JS_DATEIEN = sammle(WURZEL, '.js');

test('es gibt überhaupt Formularfelder zu prüfen', () => {
  // Sonst waeren die Tests unten leer und trotzdem gruen.
  let felder = 0;
  for (const d of HTML_SEITEN) {
    for (const m of fs.readFileSync(d, 'utf8').matchAll(FELD)) {
      const typ = ((m[2].match(/\btype="([^"]+)"/i) || [])[1] || 'text').toLowerCase();
      if (!OHNE_BESCHRIFTUNGSPFLICHT.includes(typ)) felder++;
    }
  }
  assert.ok(felder >= 60, 'nur ' + felder + ' Felder gefunden — stimmt der Suchpfad?');
});

test('kein Eingabefeld auf einer Kundenseite ist stumm', () => {
  const stumm = [];
  for (const datei of HTML_SEITEN) {
    const rel = path.relative(WURZEL, datei).split(path.sep).join('/');
    stumm.push(...stummeFelder(fs.readFileSync(datei, 'utf8'), rel));
  }
  assert.deepEqual(stumm, [], 'ohne vorlesbare Beschriftung:\n  ' + stumm.join('\n  '));
});

test('auch die erst zur Laufzeit erzeugten Felder sind beschriftet', () => {
  // Der blinde Fleck der ersten Auszaehlung: Bundle-Auswahl und "Haeufig
  // zusammen gekauft" stehen in keiner HTML-Datei.
  const stumm = [];
  for (const datei of JS_DATEIEN) {
    const rel = path.relative(WURZEL, datei).split(path.sep).join('/');
    stumm.push(...stummeFelder(fs.readFileSync(datei, 'utf8'), rel));
  }
  assert.deepEqual(stumm, [], 'ohne vorlesbare Beschriftung:\n  ' + stumm.join('\n  '));
});

test('ein placeholder allein reicht nicht', () => {
  // Er verschwindet beim Tippen. Genau so sahen die Felder der
  // Sendungsverfolgung vorher aus.
  const nur = '<form><input type="text" placeholder="Bestellnummer"></form>';
  assert.equal(stummeFelder(nur, 'probe').length, 1);
});

test('ein <label> ohne Text zählt nicht als Beschriftung', () => {
  // Genau der Fall bei "Häufig zusammen gekauft": das umschliessende <label>
  // enthielt nur ein Häkchen-Symbol.
  const nurSymbol = '<label><input type="checkbox"><span><i class="bi bi-check"></i></span></label>';
  assert.equal(stummeFelder(nurSymbol, 'probe').length, 1, 'Symbol ist kein Text');

  const mitText = '<label><input type="checkbox"><span>Newsletter erhalten</span></label>';
  assert.equal(stummeFelder(mitText, 'probe').length, 0);
});

test('label und Feld müssen verbunden sein, nicht nur benachbart', () => {
  // So sahen Kontakt- und Retourenformular vorher aus: die Beschriftung stand
  // sichtbar darueber, war aber nicht mit dem Feld verknuepft.
  const daneben = '<div><label class="form-label">Name</label></div><div><input type="text" name="name"></div>';
  assert.equal(stummeFelder(daneben, 'probe').length, 1, 'nur benachbart reicht nicht');

  const verbunden = '<div><label for="n">Name</label></div><div><input id="n" type="text" name="name"></div>';
  assert.equal(stummeFelder(verbunden, 'probe').length, 0);
});

test('GEGENPROBE: eine entfernte Verknüpfung fällt auf', () => {
  // Ohne das koennten die Tests oben gruen sein, weil das Suchmuster nichts
  // findet. Hier wird an einer ECHTEN Datei geprueft.
  const datei = path.join(WURZEL, 'infos', 'kontakt.html');
  const echt = fs.readFileSync(datei, 'utf8');
  assert.deepEqual(stummeFelder(echt, 'kontakt.html'), [], 'Ausgangslage muss sauber sein');

  const kaputt = echt.replace('<label class="form-label" for="kontakt-name">', '<label class="form-label">')
    .replace(' id="kontakt-name"', '');
  assert.notEqual(kaputt, echt, 'die Ersetzung muss greifen, sonst prüft der Test nichts');
  assert.equal(stummeFelder(kaputt, 'kontakt.html').length, 1, 'die Lücke muss auffallen');
});
