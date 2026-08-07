/**
 * Tests für das, was ein Kunde sieht, wenn die Kasse nicht durchgeht.
 *
 * Ausgangslage: Scheiterte der Klick auf „Jetzt bestellen", öffnete der Browser
 * ein Meldungsfenster mit Fehlernummer und rohem JSON. Sogar zwei davon — das
 * `throw` stand INNERHALB des `try` und wurde vom eigenen `catch` gefangen, das
 * daraufhin „Kein JSON in Antwort" behauptete, obwohl es gerade gelesen worden
 * war. Der Server antwortete dabei mit einem Serverfehler, obwohl die Ursache
 * ein veralteter Warenkorb im Browser war.
 *
 * DIE STELLE, DIE HIER WIRKLICH VERROTTEN KANN: server.js liest aus der
 * Fehlermeldung der Preisprüfung heraus, ob ein Produkt unbekannt ist — per
 * Textmuster. Formuliert jemand die Meldung in price-validator.js um, passt das
 * Muster nicht mehr. Es gibt keinen Fehler, keinen roten Prüflauf: Der Kunde
 * bekommt ab dann nur noch den allgemeinen Ersatzsatz statt des Hinweises, was
 * zu tun ist. Genau diese Kopplung halten die Tests unten fest.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { validateCart } = require('../price-validator');

const WURZEL = path.join(__dirname, '..');

/** Kommentare entfernen — ein Wort im Kommentar ist kein Aufruf. */
function ohneKommentare(js) {
  return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('unbekanntes Produkt wird als Fehler gemeldet', () => {
  assert.throws(
    () => validateCart([{ id: 999999, name: 'Weg', price: 9.99, quantity: 1 }]),
    /Unbekanntes Produkt im Warenkorb/
  );
});

test('das Textmuster in server.js passt noch zur Meldung', () => {
  // Die Kopplung: server.js zieht die Produkt-ID aus dieser Meldung, um dem
  // Kunden den hilfreichen Satz zu zeigen. Aendert sich der Wortlaut drueben,
  // faellt es hier auf — nicht erst beim Kunden.
  let meldung = '';
  try {
    validateCart([{ id: 4242, name: 'Weg', price: 1, quantity: 1 }]);
  } catch (e) {
    meldung = e.message;
  }
  const server = fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8');
  const musterZeile = /exec\(warenkorbFehler\.message\)/.test(server)
    && /\/Unbekanntes Produkt im Warenkorb: \(\\S\+\)\//.test(server);
  assert.ok(musterZeile, 'server.js liest die Meldung nicht mehr wie erwartet aus');

  const treffer = /Unbekanntes Produkt im Warenkorb: (\S+)/.exec(meldung);
  assert.ok(treffer, 'das Muster greift bei der echten Meldung nicht: ' + meldung);
  assert.equal(treffer[1], '4242', 'die Produkt-ID wird nicht mehr erkannt');
});

test('leerer Warenkorb wird als Fehler gemeldet', () => {
  assert.throws(() => validateCart([]), /leer oder ungültig/);
});

test('ein veralteter Warenkorb ist KEIN Serverfehler', () => {
  // Frueher lief dieser Fall in den allgemeinen 500er-Zweig. Ein 500 ist
  // sachlich falsch (die Ursache liegt im Browser des Kunden) und verzerrt
  // jede spaetere Fehlerstatistik.
  const server = fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8');
  const stelle = server.indexOf('warenkorbFehler');
  assert.ok(stelle > 0, 'der eigene Zweig für veraltete Warenkörbe fehlt');
  const abschnitt = server.slice(stelle, stelle + 1400);
  assert.match(abschnitt, /res\.status\(400\)/, 'antwortet nicht mit 400');
  assert.ok(!/res\.status\(500\)/.test(abschnitt.slice(0, 600)), 'antwortet weiterhin mit 500');
});

test('der Warenkorb öffnet kein Meldungsfenster mehr', () => {
  // Ein alert() im Kaufweg ist Entwickler-Ausgabe vor dem Kunden — und der
  // schnellste Weg, jemanden im teuersten Moment zu verlieren.
  const cart = ohneKommentare(fs.readFileSync(path.join(WURZEL, 'cart.js'), 'utf8'));
  const treffer = [...cart.matchAll(/\balert\s*\(/g)];
  assert.equal(treffer.length, 0, treffer.length + '× alert() in cart.js');
});

test('die Kundenmeldung kommt aus "message", nicht aus "error"', () => {
  // "error" ist eine technische Kennung ("Warenkorb veraltet", "Cart is
  // required and must contain items"). Nur "message" ist fuer Menschen
  // formuliert — und nur das darf angezeigt werden.
  const cart = ohneKommentare(fs.readFileSync(path.join(WURZEL, 'cart.js'), 'utf8'));

  // Nur die Zuweisung des ANGEZEIGTEN Textes prüfen — die Protokollzeile
  // darüber darf und soll Statuscode und Rohtext enthalten, die landet in
  // der Konsole und nicht vor dem Kunden.
  const m = /const fuerKunden = ([\s\S]{0,320}?);\s*throw new Error\(fuerKunden\)/.exec(cart);
  assert.ok(m, 'die Zuweisung des angezeigten Textes wurde umgebaut');
  const anzeige = m[1];
  assert.match(anzeige, /daten\.message/, 'nutzt "message" nicht mehr');
  assert.ok(!/daten\.error|daten\.details|response\.status|statusText|JSON\.stringify/.test(anzeige),
    'technische Angaben landen wieder in der Anzeige: ' + anzeige.slice(0, 120));
});

test('GEGENPROBE: ein wieder eingebautes alert() fällt auf', () => {
  // Ohne das koennte der Test oben gruen sein, weil das Suchmuster nichts
  // findet — etwa wenn die Kommentar-Entfernung zu viel wegnimmt.
  const kaputt = ohneKommentare('function f(){ alert("API-Fehler (500)"); }');
  assert.equal([...kaputt.matchAll(/\balert\s*\(/g)].length, 1, 'das Muster muss greifen');

  // Und: ein alert im Kommentar darf NICHT anschlagen.
  const harmlos = ohneKommentare('// frueher stand hier alert("x")\nvar a = 1;');
  assert.equal([...harmlos.matchAll(/\balert\s*\(/g)].length, 0, 'Kommentare dürfen nicht zählen');
});
