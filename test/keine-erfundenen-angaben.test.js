/**
 * Tests: keine erfundenen Bewertungen, Verkaufszahlen oder Telefonabfrage.
 *
 * Anlass (25.09.2026): Alle 40 Produktseiten trugen fest eingetippte
 * Kundenbewertungen ("Markus T. — Verifiziert", "4.9 · 61 Bewertungen"),
 * dazu "201x bestellt" und "Nur noch 9 Stück — 79% verkauft". Die
 * Startseite rechnete Sterne, Bewertungszahl, "heute gekauft" und
 * "Nur noch X Stück" aus der Produkt-ID aus (4.2 + ((id*7)%8)/10), zeigte
 * drei erfundene Kundenstimmen und "2.400+ zufriedene Kunden" — zu einem
 * Zeitpunkt, als es genau eine echte Bestellung gab. Und die Kasse fragte
 * eine Telefonnummer ab, die für die Bestellung nicht gebraucht wird.
 *
 * Warum ein Test: Erfundene Bewertungen und Verkaufszahlen sehen aus wie
 * echte. Keine Fehlermeldung, kein Konsoleneintrag — und sie kommen leicht
 * zurück, wenn eine Produktseite aus einer alten Vorlage kopiert wird.
 * Rechtlich sind sie irreführend (UWG, Anhang Nr. 23b/23c), und Google
 * verwirft bei erfundenen Sternen die Auszeichnungen der ganzen Domain.
 *
 * Echte Bewertungen bleiben erlaubt: product-reviews.js lädt sie zur
 * Laufzeit aus der Datenbank. Geprüft wird deshalb nur, was FEST im
 * Markup oder im Code steht.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

const PRODUKTSEITEN = fs.readdirSync(path.join(WURZEL, 'produkte'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => 'produkte/' + f)
  .filter((rel) => lies(rel).includes('data-product-id='));

/**
 * Findet fest eingetragene Bewertungs-, Verkaufs- und Knappheitsangaben.
 * Gibt eine Liste lesbarer Funde zurück — leer heißt sauber.
 */
function erfundeneAngaben(text) {
  const MUSTER = [
    ['Sterne-Symbol', /bi-star-(?:fill|half)|[★☆]/],
    ['Bewertungszahl', /\d+\s*(?:Bewertungen|Rezensionen)|Basierend auf \d+/],
    // "4.9<span …>/5</span>": Zahl und "/5" stehen oft in getrennten Tags
    ['Durchschnittsbewertung', /\d[.,]\d\s*(?:<[^>]+>\s*)?\/\s*5\b/],
    ['"verifizierter" Käufer', /pp-verified|Verifiziert(?:er Kauf)?</],
    ['Bestellzahl', /\d+\s*x\s*bestellt|heute gekauft|\d+\s*%\s*verkauft/i],
    ['erfundener Bestand', /Nur noch\s*(?:<[^>]+>\s*)?\d+\s*Stück/],
    ['Bestseller-Behauptung', /BESTSELLER|Am häufigsten gekauft/],
    ['Kundenzahl', /data-stat="customers"|Zufriedene Kunden<\/div>/],
    ['Kundenstimmen', /class="voice"|id="stimmen"/],
  ];
  return MUSTER.filter(([, re]) => re.test(text)).map(([name]) => name);
}

test('Gegenprobe: die alten Stellen hätte die Prüfung gemeldet', () => {
  // Wörtlich aus dem Stand vor dem 25.09. — jede Zeile muss auffallen.
  const alt = [
    '<a href="#reviews" class="pp-rating-count">61 Bewertungen</a>',
    '<span class="pp-sold"><i class="bi bi-bag-check"></i> 201x bestellt</span>',
    'Nur noch <strong class="pp-scarcity-num">9 Stück</strong> verfügbar!',
    '<span class="pp-scarcity-pct">79% verkauft</span>',
    '<span class="pp-reviewer-name">Markus T.<span class="pp-verified">',
    '<div class="pp-rating-big">4.9<span class="pp-rating-denom">/5</span></div>',
    '<i class="bi bi-star-fill"></i><i class="bi bi-star-half"></i>',
    '<div class="pp-badge-bestseller">★ BESTSELLER</div>',
    "'<div class=\"social\"><i class=\"bi bi-fire\"></i> ' + soldToday(p.id) + ' heute gekauft</div>'",
    '<span><i class="bi bi-star-fill"></i> 4,8 / 5 Bewertung</span>',
    '<div class="stat-num" data-stat="customers">0+</div><div class="stat-lbl">Zufriedene Kunden</div>',
    '<section id="stimmen" class="reveal" data-reveal>',
    '<span class="sec-sub">Am häufigsten gekauft</span>',
  ];
  for (const zeile of alt) {
    assert.ok(erfundeneAngaben(zeile).length > 0, `nicht erkannt: ${zeile}`);
  }
  // Und umgekehrt: Echtes darf nicht anschlagen.
  for (const echt of ['Zurzeit nicht lieferbar', '30 Tage Rückgabe', '<h2 class="pr-title">Kundenbewertungen</h2>']) {
    assert.deepStrictEqual(erfundeneAngaben(echt), [], `Fehlalarm bei: ${echt}`);
  }
});

test('Produktseiten: keine fest eingetragenen Bewertungen, Verkaufs- oder Bestandszahlen', () => {
  assert.ok(PRODUKTSEITEN.length >= 40, `nur ${PRODUKTSEITEN.length} Produktseiten gefunden`);
  const funde = PRODUKTSEITEN
    .map((rel) => [rel, erfundeneAngaben(lies(rel))])
    .filter(([, f]) => f.length);
  assert.deepStrictEqual(funde, [], 'erfundene Angaben auf Produktseiten');
});

test('Produktseiten: echte Bewertungen aus der Datenbank bleiben eingebunden', () => {
  // Ohne product-reviews.js gäbe es gar keine Bewertungen mehr — auch keine echten.
  const ohne = PRODUKTSEITEN.filter((rel) => !lies(rel).includes('product-reviews.js'));
  assert.deepStrictEqual(ohne, []);
});

test('Startseite: keine erfundenen Sterne, Kundenstimmen, Kunden- oder Verkaufszahlen', () => {
  assert.deepStrictEqual(erfundeneAngaben(lies('index.html')), []);
  // Kommentare zählen nicht: Dort steht bewusst, WAS entfernt wurde.
  const js = lies('home.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.deepStrictEqual(erfundeneAngaben(js), []);
  // Die Pseudo-Werte wurden aus der Produkt-ID gerechnet — diese Helfer
  // dürfen nicht zurückkommen, auch nicht unter anderem Text.
  const helfer = js.match(/function\s+(rating|reviews|stockOf|soldToday|stars)\s*\(/g) || [];
  assert.deepStrictEqual(helfer, [], 'Pseudo-Wert-Helfer in home.js');
  assert.ok(!/STAT_(CUSTOMERS|RATING)/.test(js), 'erfundene Kennzahlen in home.js');
});

test('Kasse: fragt keine Telefonnummer ab', () => {
  const server = lies('server.js');
  assert.ok(!/phone_number_collection\s*:\s*\{\s*enabled\s*:\s*true/.test(server),
    'Stripe-Checkout sammelt wieder Telefonnummern (phone_number_collection)');
  // Gegenprobe mit dem alten Stand
  assert.ok(/phone_number_collection\s*:\s*\{\s*enabled\s*:\s*true/.test(
    "phone_number_collection: {\n        enabled: true\n      },"));
});
