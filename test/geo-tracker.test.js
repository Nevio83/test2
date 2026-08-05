/**
 * Tests fuer die Standort-Erkennung.
 *
 * Der eigentliche Anlass: geolocation-tracker.js schickte die IP-Adresse des
 * Besuchers als eigenes Merkmal an Google Analytics — waehrend
 * site-integrations.js fuer dasselbe GA ausdruecklich `anonymize_ip: true`
 * setzt. Die eine Zeile hob die andere auf. Eine IP ist eine personenbezogene
 * Angabe, und Googles eigene Bedingungen untersagen, sie zu uebermitteln.
 *
 * Das faellt niemandem auf: im Shop sieht man nichts davon, in der Konsole
 * steht nichts, und GA nimmt das Feld klaglos entgegen. Deshalb ein Test.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WURZEL = path.join(__dirname, '..');
const quelle = fs.readFileSync(path.join(WURZEL, 'geolocation-tracker.js'), 'utf8');

/**
 * Fuehrt die Datei in einer Browser-Attrappe aus und gibt zurueck, was
 * tatsaechlich passiert waere. Ein reiner Textvergleich wuerde nur zeigen,
 * dass irgendwo "ip" nicht mehr steht — nicht, was uebermittelt wird.
 */
function laufenLassen(standort, { einwilligung = false } = {}) {
  const gesendet = [];
  const abfragen = [];        // externe Standort-Abfragen
  const gespeichert = {};
  const handler = {};         // was die Datei auf document/window registriert

  const speicher = {
    getItem: (k) => (k in gespeichert ? gespeichert[k] : null),
    setItem: (k, v) => { gespeichert[k] = String(v); },
    removeItem: (k) => { delete gespeichert[k]; }
  };
  const dok = {
    // 'loading' ist der ehrliche Zustand beim Einbinden: die Datei registriert
    // dann DOMContentLoaded, statt sofort loszulaufen. Wer hier 'complete'
    // setzt, prueft eine Reihenfolge, die es so nicht gibt.
    readyState: 'loading',
    documentElement: {},
    addEventListener: (n, f) => { handler[n] = f; },
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {} }),
    head: { appendChild() {} },
    body: { appendChild() {} }
  };
  const fenster = {
    localStorage: speicher,
    gtag: (art, name, werte) => gesendet.push({ art, name, werte }),
    addEventListener: (n, f) => { handler['window:' + n] = f; },
    dispatchEvent() {},
    navigator: { language: 'de-DE' },
    location: { hostname: 'maiosshop.com' }
  };
  if (einwilligung) fenster.MaiosConsent = { allowsTracking: () => true };
  fenster.window = fenster;

  const umgebung = vm.createContext({
    window: fenster,
    localStorage: speicher,
    gtag: fenster.gtag,
    document: dok,
    navigator: fenster.navigator,
    console: { log() {}, warn() {}, error() {} },
    fetch: (url) => { abfragen.push(String(url)); return Promise.reject(new Error('kein Netz im Test')); },
    setTimeout,
    clearTimeout,
    CustomEvent: class { constructor(n, o) { this.type = n; Object.assign(this, o); } }
  });
  vm.runInContext(quelle, umgebung);

  return {
    gesendet, gespeichert, abfragen, handler,
    tracker: umgebung.window.geolocationTracker,
    klasse: umgebung.window.geolocationTracker.constructor,
    /** Simuliert das Laden der Seite — hier entscheidet sich der Start. */
    seiteFertig: () => handler.DOMContentLoaded && handler.DOMContentLoaded(),
    /** Fuehrt aus, was nach einer erfolgreichen Standort-Abfrage passiert. */
    standortVerarbeiten: () => {
      umgebung.window.geolocationTracker.applyLocationData(standort);
      umgebung.window.geolocationTracker.trackLocation(standort);
    }
  };
}

const STANDORT = {
  country: 'Deutschland', countryCode: 'DE', city: 'Köln',
  ip: '203.0.113.42', source: 'ipapi', language: 'de'
};

test('an Google Analytics geht KEINE IP-Adresse', () => {
  const lauf = laufenLassen(STANDORT);
  lauf.standortVerarbeiten();
  const gesendet = lauf.gesendet;
  assert.equal(gesendet.length, 1, 'genau ein Ereignis erwartet');
  const werte = gesendet[0].werte;
  assert.equal(werte.country_code, 'DE', 'Land soll weiterhin ankommen');

  // Gegenprobe zum echten Fehler: frueher stand hier 'ip': location.ip.
  assert.ok(!('ip' in werte), 'IP wird übermittelt: ' + JSON.stringify(werte));
  const alsText = JSON.stringify(werte);
  assert.ok(
    !alsText.includes(STANDORT.ip),
    'die IP steckt in einem anderen Feld: ' + alsText
  );
});

test('im Browser bleibt nur das Länderkürzel liegen', () => {
  const lauf = laufenLassen(STANDORT);
  lauf.standortVerarbeiten();
  const gespeichert = lauf.gespeichert;
  assert.equal(gespeichert.userCountry, 'DE', 'view-tracker.js braucht das');

  // Die 50er-Standortliste hatte nach dem Wegfall der Übersichtsseite keinen
  // Leser mehr. Daten ohne Abnehmer gehören nicht ins Gerät des Besuchers.
  assert.equal(gespeichert.locationStats, undefined, 'Standortliste ist entfallen');

  // Der Betrag hier war nie gelesen worden UND widersprach der echten Tabelle.
  assert.equal(gespeichert.shippingCost, undefined, 'Versandbetrag ist entfallen');
});

test('die IP wird nirgends dauerhaft im Browser abgelegt', () => {
  const lauf = laufenLassen(STANDORT);
  lauf.standortVerarbeiten();
  const alles = JSON.stringify(lauf.gespeichert);
  assert.ok(!alles.includes(STANDORT.ip), 'IP liegt im Browser: ' + alles);
});

test('ohne Einwilligung wird kein externer Dienst gefragt', () => {
  // Nicht die Prueffunktion abfragen (die koennte stimmen und trotzdem nicht
  // greifen), sondern das Laden der Seite nachspielen und schauen, ob eine
  // Abfrage rausgeht. Ohne Einwilligung darf keine IP das Gerät verlassen.
  const lauf = laufenLassen(STANDORT);
  lauf.seiteFertig();
  assert.deepEqual(lauf.abfragen, [], 'externe Abfrage trotz fehlender Einwilligung');
});

test('GEGENPROBE: mit Einwilligung geht die Abfrage sehr wohl raus', () => {
  // Sonst waere der Test darueber wertlos — er koennte auch dann gruen sein,
  // wenn die Attrappe die Abfrage schlicht nie erreicht.
  const lauf = laufenLassen(STANDORT, { einwilligung: true });
  lauf.seiteFertig();
  assert.ok(lauf.abfragen.length > 0, 'mit Einwilligung muss eine Abfrage laufen');
});

test('GEGENPROBE: die Attrappe würde eine übermittelte IP melden', () => {
  // Ohne diese Probe koennte der Test oben auch dann gruen sein, wenn die
  // Attrappe gtag gar nicht erreicht — also nie etwas zu pruefen bekaeme.
  const gesendet = [];
  const gtag = (art, name, werte) => gesendet.push({ art, name, werte });
  gtag('event', 'location_detected', { country_code: 'DE', ip: STANDORT.ip });
  assert.ok('ip' in gesendet[0].werte, 'Attrappe fängt das Feld');
  assert.throws(
    () => assert.ok(!('ip' in gesendet[0].werte)),
    'die Prüfung oben würde bei einer IP rot werden'
  );
});

test('die entfernte Übersichtsseite ist wirklich weg', () => {
  // Sie war oeffentlich erreichbar, von nirgends verlinkt und zeigte nur die
  // Daten des Browsers, der sie oeffnete.
  assert.ok(
    !fs.existsSync(path.join(WURZEL, 'location-analytics-dashboard.html')),
    'Seite ist wieder da — dann fehlt ihr mindestens ein noindex'
  );
});
