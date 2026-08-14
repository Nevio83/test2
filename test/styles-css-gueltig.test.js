/**
 * Prüft, dass styles.css syntaktisch gültig bleibt.
 *
 * Anlass: Beim Ausmessen, wie viele Regeln in styles.css von den Seiten, die
 * die Datei noch laden, überhaupt benutzt werden (siehe Fortschrittsbericht,
 * "Textseiten laden eine Stildatei für eine Seite, die es nicht mehr gibt"),
 * kamen zwei ECHTE, bis dahin unbemerkte Fehler in der Live-Datei zutage:
 *
 * 1. Eine Regel ohne schliessende geschweifte Klammer — der Browser liest
 *    alles Folgende bis zur naechsten schliessenden Klammer als (ungueltigen)
 *    Teil dieser Regel hinein.
 * 2. Ein Kommentar ohne Kommentar-Abschluss (Stern, Schraegstrich) — er
 *    verschluckt alles bis zum naechsten Kommentar-Abschluss irgendwo weiter
 *    unten in der Datei, und macht dabei echte, gewollte Regeln dazwischen
 *    zu totem Text.
 *
 * Beide Fehler sind UNSICHTBAR beim Lesen des Diffs oder beim Draufschauen --
 * sie fallen erst auf, wenn man genau zaehlt. Kein Konsolenfehler, keine
 * Warnung, die Seite sieht nur an einer Stelle, an die man nicht zufaellig
 * scrollt, anders aus (oder eine tot geglaubte Regel wirkt ploetzlich doch).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOMMENTAR_START = '/' + '*';
const KOMMENTAR_ENDE = '*' + '/';

const WURZEL = path.join(__dirname, '..');
const original = fs.readFileSync(path.join(WURZEL, 'styles.css'), 'utf8');

// Liefert [start, endeOderMinus1] fuer jeden Kommentar.
function kommentare(css) {
  const treffer = [];
  let i = 0;
  while (true) {
    const start = css.indexOf(KOMMENTAR_START, i);
    if (start === -1) break;
    const ende = css.indexOf(KOMMENTAR_ENDE, start + 2);
    treffer.push([start, ende]);
    if (ende === -1) break;
    i = ende + 2;
  }
  return treffer;
}

function ohneKommentare(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('jeder Kommentar in styles.css schliesst wieder', () => {
  const offene = kommentare(original).filter(([, ende]) => ende === -1);
  assert.equal(offene.length, 0,
    `unterminierter Kommentar ab Zeichen-Index ${offene[0]?.[0]} -- verschluckt alles bis zum naechsten Kommentar-Ende weiter unten`);
});

test('die geschweiften Klammern in styles.css gehen auf', () => {
  const rein = ohneKommentare(original);
  const auf = (rein.match(/\{/g) || []).length;
  const zu = (rein.match(/\}/g) || []).length;
  assert.equal(auf, zu, `${auf} × "{" gegen ${zu} × "}" -- eine fehlende Klammer löscht alle Regeln danach`);
});

test('GEGENPROBE: ein fehlender Kommentar-Abschluss fällt auf', () => {
  // Baut den echten Fehler nach, der die zweite ".notification-slide-in"-
  // Regel verschluckt hatte: ein Kommentar, der nie schliesst.
  const kaputt = KOMMENTAR_START + ' Enhanced notification animation ' + KOMMENTAR_ENDE
    + '\n' + KOMMENTAR_START + '@keyframes x { 0% { opacity: 0; } }\n\n.echte-regel { color: red; }\n';
  const offene = kommentare(kaputt).filter(([, ende]) => ende === -1);
  assert.equal(offene.length, 1, 'der unterminierte Kommentar muss auffallen');
});

test('GEGENPROBE: eine fehlende schliessende Klammer fällt auf', () => {
  const kaputt = ohneKommentare(original).replace('}', ''); // erste schliessende Klammer weg
  const auf = (kaputt.match(/\{/g) || []).length;
  const zu = (kaputt.match(/\}/g) || []).length;
  assert.notEqual(auf, zu, 'die Zählung muss den Unterschied sehen');
});
