/**
 * Tests fuer die HSTS-Kopfzeile.
 *
 * Diese Kopfzeile ist die einzige im Shop, die sich NICHT zurueckrufen laesst:
 * Ist sie einmal beim Besucher, gilt sie fuer die angegebene Dauer — auch wenn
 * die Verschluesselung spaeter ausfaellt. Ein Fehler hier macht den Shop fuer
 * wiederkehrende Besucher unerreichbar, und niemand kann das beschleunigen.
 *
 * Deshalb pruefen diese Tests vor allem die Bremsen: dass die Dauer nicht
 * versehentlich auf ein Jahr springt, dass untergeordnete Adressen nicht
 * stillschweigend mit eingeschlossen werden, dass "preload" nirgends auftaucht
 * — und dass die Kopfzeile in der lokalen Entwicklung gar nicht erst rausgeht.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { hstsWert, maxAge, ueberHttps, EIN_TAG, EIN_JAHR } = require('../hsts-policy');

/** Anfrage wie sie hinter Renders Zwischenserver ankommt. */
const verschluesselt = { headers: { 'x-forwarded-proto': 'https' }, protocol: 'http' };
const offen = { headers: {}, protocol: 'http' };

test('hinter dem Zwischenserver wird HTTPS erkannt', () => {
  // req.protocol allein sagt dort IMMER "http" — nur die weitergereichte
  // Angabe stimmt. Wer das verwechselt, setzt die Kopfzeile nie.
  assert.equal(ueberHttps(verschluesselt), true);
  assert.equal(ueberHttps({ headers: { 'x-forwarded-proto': 'https,http' } }), true, 'Liste');
  assert.equal(ueberHttps({ headers: { 'x-forwarded-proto': 'HTTPS' } }), true, 'Großschreibung');
  assert.equal(ueberHttps(offen), false);
  assert.equal(ueberHttps({ headers: {}, protocol: 'https' }), true, 'ohne Zwischenserver');
});

test('lokal wird die Kopfzeile NICHT gesetzt', () => {
  // Sonst nagelt der eigene Browser http://localhost auf https fest — und die
  // Entwicklungsumgebung ist erst einmal nicht mehr erreichbar.
  assert.equal(hstsWert(offen, {}), null);
});

test('Standard ist ein Tag, nicht ein Jahr', () => {
  // Der schlimmste Fall soll ein Tag Wartezeit sein, kein Jahr.
  assert.equal(maxAge({}), EIN_TAG);
  assert.equal(hstsWert(verschluesselt, {}), 'max-age=86400');
});

test('die Dauer lässt sich ohne Deploy erhöhen', () => {
  assert.equal(hstsWert(verschluesselt, { HSTS_MAX_AGE: '31536000' }), 'max-age=31536000');
});

test('unsinnige Angaben fallen auf den Standard zurück', () => {
  // Ein Tippfehler im Dashboard darf nicht zu einer wilden Dauer fuehren.
  for (const wert of ['ein Jahr', '86400s', '-5', '1e9', '', '  ', '12.5']) {
    assert.equal(maxAge({ HSTS_MAX_AGE: wert }), EIN_TAG, `bei "${wert}"`);
  }
});

test('mehr als ein Jahr wird gekappt', () => {
  // Laenger bringt nichts und verlaengert nur den Weg zurueck.
  assert.equal(maxAge({ HSTS_MAX_AGE: '99999999999' }), EIN_JAHR);
});

test('Notausstieg: Dauer 0 schaltet die Kopfzeile ab', () => {
  assert.equal(hstsWert(verschluesselt, { HSTS_MAX_AGE: '0' }), null);
});

test('untergeordnete Adressen sind nur auf ausdrücklichen Wunsch dabei', () => {
  // Sonst gilt die Regel auch fuer Adressen, die es heute noch nicht gibt.
  assert.ok(!/includeSubDomains/.test(hstsWert(verschluesselt, {})));
  assert.ok(!/includeSubDomains/.test(hstsWert(verschluesselt, { HSTS_INCLUDE_SUBDOMAINS: '1' })),
    'nur "true" zählt, nicht jeder wahrheitsähnliche Wert');
  assert.match(
    hstsWert(verschluesselt, { HSTS_INCLUDE_SUBDOMAINS: 'true' }),
    /^max-age=86400; includeSubDomains$/
  );
});

test('"preload" kommt nirgends vor', () => {
  // Damit landet die Domain in einer Liste, die fest im Browser steckt —
  // sie dort wieder herauszubekommen dauert Monate. Kein Versehen erlaubt.
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'hsts-policy.js'), 'utf8');
  const imCode = quelle.split('*/').pop();   // Erklaertext oben zaehlt nicht
  assert.ok(!/['"`].*preload/i.test(imCode), 'preload steht im Code');

  for (const env of [{}, { HSTS_MAX_AGE: '31536000', HSTS_INCLUDE_SUBDOMAINS: 'true' }]) {
    assert.ok(!/preload/i.test(hstsWert(verschluesselt, env) || ''), JSON.stringify(env));
  }
});

test('GEGENPROBE: die Prüfungen würden einen Fehler auch melden', () => {
  // Ohne das koennten die Tests oben gruen sein, weil hstsWert() immer null
  // liefert und damit nie etwas zu pruefen ist.
  const wert = hstsWert(verschluesselt, { HSTS_MAX_AGE: '600' });
  assert.equal(wert, 'max-age=600', 'es kommt überhaupt eine Kopfzeile heraus');
  assert.throws(
    () => assert.ok(!/max-age/.test(wert)),
    'ein falscher Wert würde auffallen'
  );
});
