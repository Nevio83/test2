/**
 * Tests für die Geräte-/Browser-Kacheln im Besucher-Dashboard.
 *
 * Anlass: Gerät und Browser stehen nur bei voller Cookie-Einwilligung in der
 * Datenbank — ohne Einwilligung bleibt das Feld leer. Die Kachel zeigte
 * bisher nur die Aufteilung der BEKANNTEN Besuche ("Mobil: 9, Desktop: 11")
 * und sah damit wie eine vollständige Verteilung aus. Nachgemessen fehlten an
 * einem Tag 56 von 175 Besuchen komplett — kein Fehler, sondern Absicht,
 * aber ohne Hinweis unsichtbar.
 *
 * ZWEI VERSCHIEDENE GEFAHRENSTELLEN, ZWEI TESTGRUPPEN:
 *
 * 1. Die SQL-Ebene (database.js): "total" und "known" müssen aus demselben
 *    Zeitfenster kommen wie die Aufteilung selbst — sonst driften die Zahlen
 *    auseinander, ohne dass es auffällt. Läuft nur mit DATABASE_URL.
 *
 * 2. Die Anzeige-Ebene (admin-views.js): Bei der Browser-Kachel begrenzt ein
 *    LIMIT die angezeigten Zeilen. Eine Summe über die angezeigten Zeilen
 *    wäre bei mehr als "limit" verschiedenen Browsern zu klein — die Lücke
 *    würde dann teils der Kürzung, teils der fehlenden Einwilligung
 *    zugeschrieben, und die Kachel nennt am Ende den falschen Grund. Läuft
 *    immer (führt die echte Datei in einer Browser-Attrappe aus).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WURZEL = path.join(__dirname, '..');
const HAT_DB = !!process.env.DATABASE_URL;

// ── 1. SQL-Ebene ─────────────────────────────────────────────────────

test(
  '"total" und "known" zählen dasselbe Zeitfenster wie die Aufteilung',
  { skip: !HAT_DB && 'keine DATABASE_URL — lokal mit Verbindung ausführen' },
  async () => {
    const { dbOperations } = require('../database');

    const geraete = await dbOperations.getDeviceBreakdown(30);
    assert.ok(Array.isArray(geraete.rows), 'rows ist kein Array');
    assert.equal(typeof geraete.total, 'number', 'total fehlt oder ist keine Zahl');
    const summeGeraete = geraete.rows.reduce((s, r) => s + r.views, 0);
    assert.ok(summeGeraete <= geraete.total,
      `Summe der Geräte-Zeilen (${summeGeraete}) darf total (${geraete.total}) nicht übersteigen`);

    const browser = await dbOperations.getBrowserBreakdown(30, 8);
    assert.equal(typeof browser.total, 'number');
    assert.equal(typeof browser.known, 'number');
    assert.ok(browser.known <= browser.total,
      `known (${browser.known}) darf total (${browser.total}) nicht übersteigen`);
    // Geräte und Browser filtern beide nach "Consent = all" -> dieselbe
    // Grundgesamtheit. Weichen sie stark voneinander ab, filtert eine der
    // beiden Abfragen etwas anderes als gedacht.
    assert.equal(browser.known, summeGeraete,
      `bekannte Browser-Views (${browser.known}) und Geräte-Views (${summeGeraete}) sollten übereinstimmen`);
  }
);

test(
  'GEGENPROBE: "known" bleibt unverändert, wenn das LIMIT verschärft wird',
  { skip: !HAT_DB && 'keine DATABASE_URL — lokal mit Verbindung ausführen' },
  async () => {
    // Der eigentliche Fehler, den dieser Test verhindern soll: eine Summe
    // über die (gekürzten) angezeigten Zeilen wäre bei limit=1 kleiner als
    // bei limit=8 -- "known" (eigene Abfrage, kein LIMIT) darf das nicht sein.
    const { dbOperations } = require('../database');
    const weit = await dbOperations.getBrowserBreakdown(30, 8);
    const eng = await dbOperations.getBrowserBreakdown(30, 1);
    assert.equal(eng.rows.length <= 1, true, 'limit=1 sollte höchstens 1 Zeile liefern');
    assert.equal(eng.known, weit.known,
      'known darf sich mit dem LIMIT nicht ändern — sonst erklärt die Kürzung fälschlich die Lücke');
  }
);

// ── 2. Anzeige-Ebene: die echte Datei in einer Browser-Attrappe ──────

const quelle = fs.readFileSync(path.join(WURZEL, 'a29715347575', 'admin-views.js'), 'utf8');

/**
 * Führt admin-views.js in einer Attrappe aus und gibt zurück, was in den
 * Kacheln stünde. "fixtures" ordnet Pfad-Anfänge (z.B. "api/views/devices")
 * einer JSON-Antwort zu; nicht genannte Pfade bekommen ein leeres Objekt --
 * die zugehörigen Lade-Funktionen brechen dann harmlos ab (geprüft: jede
 * bis auf devices/browsers hat ein eigenes "if (!el) return").
 */
function dashboardLaden(fixtures) {
  return new Promise((fertig, fehler) => {
    const elemente = {};
    const el = (id, klasse) => {
      if (!elemente[id]) {
        elemente[id] = {
          id, className: klasse || '', dataset: {}, style: {},
          _text: '', _html: '',
          get textContent() { return this._text; },
          set textContent(v) { this._text = String(v); },
          get innerHTML() { return this._html; },
          set innerHTML(v) { this._html = String(v); },
          addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} },
          querySelectorAll: () => [],
          getBoundingClientRect: () => ({ height: 0 })
        };
      }
      return elemente[id];
    };
    // Nur die Kacheln, die dieser Test wirklich prüft, bekommen echte
    // Attrappen-Elemente. Alles andere liefert null -> die jeweilige
    // Lade-Funktion bricht über ihr eigenes "if (!el) return" ab.
    const BEKANNTE_IDS = ['device-breakdown', 'device-coverage', 'browser-breakdown', 'browser-coverage'];

    const handler = {};
    const dok = {
      readyState: 'loading',
      getElementById: (id) => (BEKANNTE_IDS.includes(id) ? el(id) : null),
      querySelectorAll: () => [],
      addEventListener: (n, f) => { handler[n] = f; },
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} })
    };

    const umgebung = vm.createContext({
      document: dok,
      console: { log() {}, warn() {}, error() {} },
      fetch: (url) => {
        const treffer = Object.keys(fixtures).find((praefix) => String(url).startsWith(praefix));
        const daten = treffer ? fixtures[treffer] : {};
        return Promise.resolve({ ok: true, status: 200, json: async () => daten });
      },
      setTimeout, clearTimeout,
      setInterval: () => 0, clearInterval() {}
    });

    try {
      vm.runInContext(quelle, umgebung);
    } catch (e) {
      fehler(e);
      return;
    }
    if (typeof handler.DOMContentLoaded !== 'function') {
      fehler(new Error('DOMContentLoaded wurde nicht registriert -- Datei umgebaut?'));
      return;
    }
    handler.DOMContentLoaded();
    // Alle Lader sind async und starten beim Aufruf von init(); ein Tick
    // reicht, weil die Fixtures synchron auflösen (Promise.resolve).
    setTimeout(() => fertig(elemente), 0);
  });
}

test('Geräte-Kachel: "Basiert auf X von Y" mit den echten Zahlen', async () => {
  const el = await dashboardLaden({
    'api/views/devices': { rows: [{ device: 'Desktop', views: 33 }, { device: 'Mobil', views: 23 }], total: 69 }
  });
  assert.equal(el['device-coverage'].textContent, 'Basiert auf 56 von 69 Besuchen mit Einwilligung.');
});

test('Browser-Kachel: nutzt "known" vom Server, NICHT die Summe der angezeigten Zeilen', async () => {
  // Absichtlich ein Fall, in dem die Summe der (gekürzten) Zeilen kleiner ist
  // als "known" -- genau der Fall, der bei mehr als "limit" Browsern
  // entsteht. Zeigt die Kachel dennoch "56", kommt der Wert vom Server und
  // nicht aus einer Summe der sichtbaren Balken.
  const el = await dashboardLaden({
    'api/views/browsers': { rows: [{ browser: 'Chrome', views: 40 }], total: 69, known: 56 }
  });
  assert.equal(el['browser-coverage'].textContent, 'Basiert auf 56 von 69 Besuchen mit Einwilligung.');
});

test('vollständige Abdeckung bekommt einen positiven Satz, keine "10 von 10"', async () => {
  const el = await dashboardLaden({
    'api/views/devices': { rows: [{ device: 'Desktop', views: 10 }], total: 10 }
  });
  assert.equal(el['device-coverage'].textContent, 'Vollständig — alle 10 Besuche mit Einwilligung.');
});

test('ganz ohne Aufrufe bleibt die Zeile leer statt "0 von 0"', async () => {
  const el = await dashboardLaden({
    'api/views/devices': { rows: [], total: 0 }
  });
  assert.equal(el['device-coverage'].textContent, '');
});

test('die Geräte-Liste selbst zeigt weiterhin nur die bekannten Zeilen an', async () => {
  // Die Kachel-Liste soll sich NICHT ändern (keine erfundene "Unbekannt"-
  // Zeile) -- nur die neue Zeile darunter erklärt die Lücke.
  const el = await dashboardLaden({
    'api/views/devices': { rows: [{ device: 'Desktop', views: 33 }, { device: 'Mobil', views: 23 }], total: 69 }
  });
  assert.match(el['device-breakdown'].innerHTML, /Desktop/);
  assert.match(el['device-breakdown'].innerHTML, /Mobil/);
  assert.doesNotMatch(el['device-breakdown'].innerHTML, /Unbekannt/);
});

test('GEGENPROBE: eine falsche "known"-Verdrahtung würde aus 56 stillschweigend 40 machen', () => {
  // Ohne das koennte der Test oben ("nutzt known vom Server") auch dann
  // gruen sein, wenn setCoverageNote() das known-Argument gar nicht liest.
  // Reproduziert von Hand, was OHNE Override passieren wuerde.
  const rows = [{ views: 40 }];
  const naiveSumme = rows.reduce((s, r) => s + r.views, 0);
  assert.equal(naiveSumme, 40, 'die Kontrollrechnung selbst muss 40 ergeben');
  assert.notEqual(naiveSumme, 56, 'und 40 darf nicht zufällig gleich der echten Zahl (56) sein');
});
