/**
 * Tests für den Stilblock der Startseite.
 *
 * Anlass: Für den ersten Bildschirm auf dem Handy sind Regeln dazugekommen —
 * Preis und Kaufknopf lagen vorher darunter. Diese Regeln stehen in einem
 * <style>-Block direkt in index.html.
 *
 * WAS HIER GEPRUEFT WIRD, IST NICHT "steht die Regel da" — das waere ein Test,
 * der nur gruen werden kann. Geprueft wird die Eigenschaft, die bei
 * handgeschriebenem CSS wirklich kaputtgeht: eine fehlende Klammer. Ein
 * einziges vergessenes "}" beendet den Block zu frueh, und ALLE Regeln danach
 * verschwinden — lautlos. Keine Fehlermeldung, keine Konsolenausgabe, die
 * Seite sieht nur plötzlich anders aus.
 *
 * Die tatsaechliche Wirkung (Preis im ersten Bildschirm) laesst sich hier
 * nicht pruefen: dafuer braeuchte es einen Browser, der die Seite wirklich
 * ausmisst. Das ist im Browser geschehen und im Commit dokumentiert.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

/** Der Inhalt aller <style>-Blöcke der Seite. */
function stilBloecke(quelltext) {
  return [...quelltext.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
}

/** Kommentare raus — sonst zählt ein "}" in einem Kommentar mit. */
function ohneKommentare(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const BLOECKE = stilBloecke(html);

test('die Startseite hat überhaupt einen Stilblock', () => {
  assert.ok(BLOECKE.length >= 1, 'kein <style> gefunden — stimmt der Suchpfad?');
});

test('die geschweiften Klammern gehen auf', () => {
  BLOECKE.forEach((css, i) => {
    const rein = ohneKommentare(css);
    const auf = (rein.match(/\{/g) || []).length;
    const zu = (rein.match(/\}/g) || []).length;
    assert.equal(auf, zu, `Stilblock ${i + 1}: ${auf} × "{" gegen ${zu} × "}" — eine fehlende Klammer löscht alle Regeln danach`);
  });
});

test('kein Media-Query bleibt offen', () => {
  // Ein @media ohne schliessende Klammer verschluckt den gesamten Rest.
  BLOECKE.forEach((css, i) => {
    const rein = ohneKommentare(css);
    let tiefe = 0;
    let offeneMedien = 0;
    const zeichen = [...rein];
    for (let k = 0; k < zeichen.length; k++) {
      if (zeichen[k] === '{') tiefe++;
      else if (zeichen[k] === '}') { tiefe--; assert.ok(tiefe >= 0, `Stilblock ${i + 1}: eine "}" zu viel`); }
    }
    for (const m of rein.matchAll(/@media[^{]*\{/g)) offeneMedien++;
    assert.equal(tiefe, 0, `Stilblock ${i + 1}: ${tiefe} Ebene(n) offen bei ${offeneMedien} Media-Queries`);
  });
});

test('die Handy-Regeln für den ersten Bildschirm sind noch da', () => {
  // Bewusst schlicht: eine Erinnerung, keine Wirkungsprüfung. Wer diese
  // Regeln entfernt, soll wenigstens merken, dass er etwas entfernt.
  const css = BLOECKE.join('\n');
  assert.match(css, /@media \(max-width: 600px\) and \(max-height: 780px\)/,
    'die Regel für kürzere Handy-Bildschirme fehlt');
  assert.match(css, /\.reel-desc \{ display: none; \}/,
    'die ausgeblendete Beschreibung im Karussell fehlt');
});

test('GEGENPROBE: eine fehlende Klammer fällt auf', () => {
  // Ohne das koennte der Test oben gruen sein, weil das Zaehlen nicht greift.
  const kaputt = ohneKommentare(BLOECKE[0]).replace(/\}/, '');   // erste schliessende weg
  const auf = (kaputt.match(/\{/g) || []).length;
  const zu = (kaputt.match(/\}/g) || []).length;
  assert.notEqual(auf, zu, 'die Zählung muss den Unterschied sehen');
});
