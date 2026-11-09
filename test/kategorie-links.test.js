// Die Kategorie in der Pfadzeile jeder Produktseite muss die Startseite MIT
// dieser Kategorie öffnen (?category=…#sortiment). Früher stand dort nur "/" —
// der Besucher landete oben auf der Startseite statt in der Kategorie.
// home.js ignoriert unbekannte Werte still und zeigt dann "Alle": ein
// Tippfehler im Link fiele also nicht auf.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const homeJs = fs.readFileSync(path.join(root, 'home.js'), 'utf8');
const block = homeJs.match(/var CAT_META = \{([\s\S]*?)\n {2}\};/)[1];
const schluessel = [...block.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]);

test('home.js kennt die vier Kategorien', () => {
  assert.ok(schluessel.length >= 4, 'CAT_META gelesen: ' + schluessel.join(', '));
});

test('jede Produktseite verlinkt ihre Kategorie mit gültigem Schlüssel', () => {
  const dir = path.join(root, 'produkte');
  const fehler = [];
  let geprueft = 0;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    // Alle Links der Pfadzeile; der letzte vor dem aktuellen Eintrag ist die Kategorie
    const links = [...html.matchAll(/<a href="([^"]*)" class="pp-bc-link">([^<]*)<\/a>/g)];
    if (links.length < 2) continue;
    geprueft++;
    const [, href, text] = links[links.length - 1];
    const wunsch = new URL(href, 'https://x.test').searchParams.get('category');
    if (!schluessel.includes(wunsch) || wunsch !== text.trim() || !href.endsWith('#sortiment')) {
      fehler.push(f + ': ' + href + ' (' + text + ')');
    }
  }
  assert.ok(geprueft >= 50, 'mindestens 50 Produktseiten geprüft, waren ' + geprueft);
  assert.deepStrictEqual(fehler, []);
});
