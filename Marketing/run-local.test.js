/**
 * Tests fuer den lokalen Starter.
 *
 * Geprueft wird die Meldung ueber die stehende Schnitt-Aufgabe. Sie ist die
 * Antwort auf einen echten Befund vom 18.09.: In Marketing/videos/.bestand.json
 * stand zuletzt_gelaufen: 2026-08-30 — neunzehn Tage, und niemand hatte es
 * gemerkt. Dieselbe Fehlerklasse wie die Wochenlaeufe im Shop: Ein Ablauf, der
 * NICHT laeuft, sieht genauso aus wie einer, der nichts zu tun hatte.
 *
 * Projektregel aus CLAUDE.md Paragraph 2: Zu jeder Pruefung eine Gegenprobe.
 * Eine Warnung, die immer kommt, ist keine Warnung.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');

// Der Ordner, den run-local.js prueft, haengt an __dirname. Fuer den Test
// wird eine Kopie neben einer nachgebauten videos/.bestand.json geladen.
function ladeMit(inhalt) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'runlocal-'));
  fs.mkdirSync(path.join(ordner, 'videos'));
  if (inhalt !== null) {
    fs.writeFileSync(path.join(ordner, 'videos', '.bestand.json'), inhalt, 'utf8');
  }
  fs.mkdirSync(path.join(ordner, 'pipelines', 'orchestrator'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'run-local.js'), path.join(ordner, 'run-local.js'));
  delete require.cache[path.join(ordner, 'run-local.js')];
  return require(path.join(ordner, 'run-local.js'));
}

function ohneAusgabe(fn) {
  const echt = console.warn;
  const zeilen = [];
  console.warn = (...a) => zeilen.push(a.join(' '));
  try { return { ergebnis: fn(), zeilen }; } finally { console.warn = echt; }
}

test('eine stehende Merkliste wird gemeldet', () => {
  const modul = ladeMit(JSON.stringify({ zuletzt_gelaufen: '2026-08-30' }));
  const { ergebnis, zeilen } = ohneAusgabe(
    () => modul.meldeStehendeSchnittaufgabe(new Date('2026-09-18T12:00:00Z')));
  assert.strictEqual(ergebnis.gemeldet, true);
  assert.strictEqual(ergebnis.tage, 19);
  assert.match(zeilen.join(' '), /2026-08-30/);
  assert.match(zeilen.join(' '), /19 Tagen/);
});

test('Gegenprobe: eine frische Merkliste meldet nichts', () => {
  const modul = ladeMit(JSON.stringify({ zuletzt_gelaufen: '2026-09-18' }));
  const { ergebnis, zeilen } = ohneAusgabe(
    () => modul.meldeStehendeSchnittaufgabe(new Date('2026-09-18T12:00:00Z')));
  assert.strictEqual(ergebnis.gemeldet, false);
  assert.strictEqual(zeilen.length, 0, 'kein Warnwort ohne Anlass');
});

test('keine Merkliste ist keine Aussage — und kein Fehler', () => {
  const modul = ladeMit(null);
  const { ergebnis, zeilen } = ohneAusgabe(
    () => modul.meldeStehendeSchnittaufgabe(new Date('2026-09-18T12:00:00Z')));
  assert.strictEqual(ergebnis, null);
  assert.strictEqual(zeilen.length, 0);
});

test('eine kaputte Merkliste bringt den Start nicht zu Fall', () => {
  const modul = ladeMit('{"zuletzt_gelaufen": ');
  const { ergebnis } = ohneAusgabe(
    () => modul.meldeStehendeSchnittaufgabe(new Date('2026-09-18T12:00:00Z')));
  assert.strictEqual(ergebnis, null);
});

test('ein unsinniges Datum wird nicht zu einer Warnung verrechnet', () => {
  const modul = ladeMit(JSON.stringify({ zuletzt_gelaufen: 'gestern' }));
  const { ergebnis, zeilen } = ohneAusgabe(
    () => modul.meldeStehendeSchnittaufgabe(new Date('2026-09-18T12:00:00Z')));
  assert.strictEqual(ergebnis, null);
  assert.strictEqual(zeilen.length, 0);
});

// ── Merkliste auf Pruefsummen (Punkt 49) ─────────────────────────────

const {
  ladeBestand, bestandEintrag, giltAlsVerarbeitet, veraltetDurchRegeln, bestandUmstellen,
} = require('./run-local.js');

test('gleicher Name, anderer Inhalt gilt nicht mehr als erledigt', () => {
  const liste = [{ datei: 'a.mp4', sha256: 'aaaa' }];

  assert.equal(giltAlsVerarbeitet(liste, 'a.mp4', 'aaaa').verarbeitet, true);
  const geaendert = giltAlsVerarbeitet(liste, 'a.mp4', 'bbbb');
  assert.equal(geaendert.verarbeitet, false);
  assert.equal(geaendert.grund, 'gleicher Name, anderer Inhalt');

  // GEGENPROBE: Genau das ist der Fall, den eine Liste aus blossen Dateinamen
  // nicht sehen kann — dort ist "a.mp4" erledigt, egal was drinsteht.
  assert.equal(giltAlsVerarbeitet(['a.mp4'], 'a.mp4', 'bbbb').verarbeitet, true);
});

test('Altbestand ohne Pruefsumme wird nicht pauschal neu geschnitten', () => {
  // Eine Umstellung, die die alte Form nicht mehr liest, wirft beim ersten
  // Lauf alles weg und schneidet neu — genau das, was die Liste verhindern soll.
  const alt = ['01_datei.mp4', '02_datei.mp4'];
  assert.equal(giltAlsVerarbeitet(alt, '01_datei.mp4', 'egal').verarbeitet, true);
  assert.match(giltAlsVerarbeitet(alt, '01_datei.mp4').grund, /Altbestand/);

  // GEGENPROBE: Was NICHT in der Liste steht, gilt weiterhin als unerledigt.
  assert.equal(giltAlsVerarbeitet(alt, '03_datei.mp4').verarbeitet, false);
});

test('beide Schreibweisen werden gelesen', () => {
  assert.deepEqual(bestandEintrag('a.mp4'), { datei: 'a.mp4', sha256: null, regeln: null });
  assert.deepEqual(bestandEintrag({ datei: 'b.mp4', sha256: 'x', regeln: 'v2' }),
    { datei: 'b.mp4', sha256: 'x', regeln: 'v2' });

  // GEGENPROBE: Unsinn ergibt keinen Eintrag, statt einen leeren zu erfinden.
  assert.equal(bestandEintrag(null), null);
  assert.equal(bestandEintrag({ sha256: 'ohne datei' }), null);
});

test('eine Vorlagenaenderung wirkt nur auf Clips, die eine Fassung tragen', () => {
  assert.equal(veraltetDurchRegeln({ datei: 'a.mp4', sha256: 'x', regeln: 'v2' }, 'v3'), true);
  assert.equal(veraltetDurchRegeln({ datei: 'a.mp4', sha256: 'x', regeln: 'v3' }, 'v3'), false);

  // GEGENPROBE: Altbestand OHNE Fassung ist nicht veraltet. Ihn pauschal neu
  // zu schneiden waere genau das "schneidet alles neu" aus dem Hinweistext
  // der Datei.
  assert.equal(veraltetDurchRegeln('a.mp4', 'v3'), false);
  assert.equal(veraltetDurchRegeln({ datei: 'a.mp4', sha256: 'x' }, 'v3'), false);
});

test('das Umstellen schreibt nichts und erfindet keine Pruefsumme', () => {
  const bestand = { produkte: { '10_x': { verarbeitet: ['a.mp4', 'b.mp4'] } },
                    notizen: { merk: 'schwarzes Modell nicht mischen' } };
  const summen = new Map([['a.mp4', 'aaaa']]);
  const { bestand: neu, bericht } = bestandUmstellen(bestand, summen, { regeln: 'v3' });

  assert.equal(bericht.ergaenzt, 1);
  assert.deepEqual(bericht.ohnePruefsumme, ['10_x/b.mp4']);
  assert.deepEqual(neu.produkte['10_x'].verarbeitet[0],
    { datei: 'a.mp4', sha256: 'aaaa', regeln: 'v3' });
  assert.equal(neu.produkte['10_x'].verarbeitet[1], 'b.mp4',
    'ohne bekannte Pruefsumme bleibt der Eintrag, wie er war');

  // Die Notizen ueberleben. Sie sind von Hand geschrieben und mehr wert als
  // die Dateiliste selbst.
  assert.equal(neu.notizen.merk, 'schwarzes Modell nicht mischen');

  // GEGENPROBE: Die urspruengliche Liste ist unveraendert — diese Funktion
  // berichtet, sie stellt nicht um.
  assert.equal(bestand.produkte['10_x'].verarbeitet[0], 'a.mp4');
});

test('eine fehlende Merkliste ist keine Aussage', () => {
  const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'bestand-'));
  assert.equal(ladeBestand(path.join(leer, 'gibt-es-nicht.json')), null);

  // GEGENPROBE: Eine kaputte Datei ebenso — sie darf den Starter nicht beenden.
  const kaputt = path.join(leer, 'kaputt.json');
  fs.writeFileSync(kaputt, '{kein json');
  assert.equal(ladeBestand(kaputt), null);
});
