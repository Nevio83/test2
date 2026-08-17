/**
 * Tests für die Marketing-Übersichtsseite im Admin-Bereich.
 *
 * Diese Seite ist die einzige Stelle, an der ein Mensch sieht, was der
 * Marketing-Automat tut — und der einzige Ort, an dem er ihn anhalten kann.
 * Genau deshalb sind ihre Fehler besonders unangenehm: Sie sehen nach Ruhe
 * aus. Ein Feld, das nie gefüllt wird, steht dauerhaft auf „Lädt…" und wirkt
 * wie „es gibt nichts zu zeigen". Es kommt keine Fehlermeldung, kein Eintrag
 * in der Konsole, nichts im Protokoll.
 *
 * Drei Gefahrenstellen, drei Testgruppen:
 *
 * 1. HTML und JS müssen dieselben Element-IDs benutzen. Wird eine ID in der
 *    einen Datei umbenannt, bleibt die Kachel in der anderen für immer leer.
 * 2. Die Ereignisbehandler dürfen keine eingesetzten Werte tragen
 *    (onclick="x(${id})"). Solche Stellen blockt die Sicherheitsregel des
 *    Shops — auch das ohne sichtbare Meldung (siehe csp-inline.js).
 * 3. Die Abfragen in Marketing/api.js müssen ohne Datenbank eine LEERE
 *    Antwort geben statt zu werfen. Der Shop startet auch ohne
 *    DATABASE_URL; eine Nebenseite darf ihn nicht mitreißen.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(WURZEL, 'a29715347575', 'marketing.html'), 'utf8');
const JS = fs.readFileSync(path.join(WURZEL, 'a29715347575', 'marketing.js'), 'utf8');
const API = fs.readFileSync(path.join(WURZEL, 'Marketing', 'api.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8');

// ── 1. HTML und JS sprechen über dieselben IDs ───────────────────────

test('jede Kachel im HTML wird vom Skript auch gefüllt', () => {
  // Alle id="…" aus dem HTML, ohne die reinen Gestaltungs-Container.
  const ids = [...HTML.matchAll(/\sid="([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10, `nur ${ids.length} IDs gefunden — Seite unvollständig?`);

  const ungefuellt = ids.filter((id) => {
    // Knöpfe werden verdrahtet, nicht befüllt.
    if (id.startsWith('btn-')) return !JS.includes(`'${id}'`);
    return !JS.includes(`'${id}'`);
  });
  assert.deepEqual(
    ungefuellt, [],
    `diese Bereiche stehen für immer auf "Lädt…": ${ungefuellt.join(', ')}`
  );
});

test('das Skript füllt keine IDs, die es im HTML gar nicht gibt', () => {
  // GEGENRICHTUNG: Ein Tippfehler im Skript fällt sonst nirgends auf,
  // weil setze() null-sicher ist und stillschweigend nichts tut.
  const genutzt = [...JS.matchAll(/getElementById\('([a-z0-9-]+)'\)/g)].map((m) => m[1]);
  const querys = [...JS.matchAll(/querySelector(?:All)?\('#([a-z0-9-]+)/g)].map((m) => m[1]);
  const fehlend = [...new Set([...genutzt, ...querys])].filter(
    (id) => !HTML.includes(`id="${id}"`)
  );
  assert.deepEqual(fehlend, [], `im HTML nicht vorhanden: ${fehlend.join(', ')}`);
});

test('alle Panels haben einen Platzhalter, solange nichts geladen ist', () => {
  // Ein leeres <div> sieht aus wie "fertig geladen, nichts da". Der
  // Unterschied zwischen "noch nicht da" und "es gibt nichts" muss sichtbar
  // sein, sonst wartet man vor einer Seite, die längst aufgegeben hat.
  const panels = [...HTML.matchAll(/<div id="([a-z0-9-]+)">([\s\S]{0,80}?)<\/div>/g)];
  for (const [, id, inhalt] of panels) {
    if (id === 'hinweise') continue;          // absichtlich leer, füllt sich nur bei Bedarf
    assert.match(inhalt, /Lädt…|leer/, `Bereich '${id}' startet ohne Platzhalter`);
  }
});

// ── 2. Sicherheitsregel: keine eingesetzten Werte in Behandlern ──────

test('keine Ereignisbehandler mit eingesetzten Werten', () => {
  // Der reale Vorfall: onclick="x(${id})" hat bei jedem Aufruf einen anderen
  // Fingerabdruck und ist deshalb grundsätzlich nicht freizugeben. 25 solche
  // Stellen mussten schon einmal auf data-Attribute umgestellt werden.
  const treffer = [...JS.matchAll(/on[a-z]+\s*=\s*["'][^"']*\$\{/g)];
  assert.deepEqual(
    treffer.map((t) => t[0]), [],
    'Behandler mit eingesetztem Wert — die Sicherheitsregel blockt ihn lautlos'
  );
});

test('alles, was aus der Datenbank kommt, geht durch die Maskierung', () => {
  // Die Seite baut ihr HTML aus Zeichenketten. Ein Trend-Stichwort kommt aus
  // einer FREMDEN Quelle (Reddit, YouTube, Shop-Suche) — es darf nie roh in
  // die Seite. Deshalb muss jeder eingesetzte Wert entweder durch schuetze()
  // gehen oder eine berechnete Zahl sein.
  const roh = [...JS.matchAll(/\+ (z|d)\.([a-z_]+) \+/g)]
    .map((m) => `${m[1]}.${m[2]}`)
    .filter((s) => !s.endsWith('_cent'));
  assert.deepEqual(roh, [], `ungeprüft eingesetzt: ${roh.join(', ')}`);
});

// ── 3. Routen und Abfragen ───────────────────────────────────────────

test('jede Route der Seite ist im Server angelegt', () => {
  const gerufen = [...JS.matchAll(/BASIS \+ '([a-z]+)/g)].map((m) => m[1]);
  const zusaetzlich = [...JS.matchAll(/hole\('([a-z]+)/g)].map((m) => m[1]);
  const alle = [...new Set([...gerufen, ...zusaetzlich])];
  assert.ok(alle.length >= 8, `nur ${alle.length} Abrufe gefunden — Skript unvollständig?`);

  for (const pfad of alle) {
    assert.ok(
      SERVER.includes(`marketingRoute('${pfad}'`) ||
        SERVER.includes(`/a29715347575/api/marketing/${pfad}'`),
      `Route '${pfad}' wird abgerufen, ist aber im Server nicht angelegt`
    );
  }
});

test('die Marketing-Routen stehen hinter Anmeldung und Herkunftsprüfung', () => {
  // Sie liegen unter /a29715347575 und erben damit requireSameOrigin +
  // requireAdminAuth. Dieser Test hält fest, dass der Pfad genau so bleibt —
  // eine Route unter /api/… wäre öffentlich, und im Protokoll steht, welches
  // Produkt wann beworben wurde.
  const routen = [...SERVER.matchAll(/\/api\/marketing\/[a-z]+/g)].map((m) => m[0]);
  assert.ok(routen.length > 0, 'keine Marketing-Routen im Server gefunden');
  const oeffentlich = routen.filter(
    (r) => !SERVER.includes(`/a29715347575${r}`)
  );
  assert.deepEqual(oeffentlich, [], `ohne Admin-Schutz erreichbar: ${oeffentlich.join(', ')}`);
});

test('die Seite schreibt nur über die zwei Schalter', () => {
  // Ein Dashboard, das Prozesse startet oder Daten ändert, ist die
  // gefährlichere Bauart. Erlaubt sind genau zwei schreibende Aufrufe:
  // ein Job an/aus und der Sammelschalter.
  const schreibend = [...API.matchAll(/(INSERT INTO|UPDATE|DELETE FROM) (\w+)/g)]
    .map((m) => `${m[1]} ${m[2]}`);
  const erlaubt = new Set(['UPDATE mkt_jobs', 'INSERT INTO mkt_audit_log']);
  const unerwartet = schreibend.filter((s) => !erlaubt.has(s));
  assert.deepEqual(unerwartet, [], `unerwartet schreibender Zugriff: ${unerwartet.join(', ')}`);
});

test('ohne Datenbank liefert die Übersicht eine leere Antwort statt zu werfen', async () => {
  // Der Shop startet auch ohne DATABASE_URL (CLAUDE.md §5). Wenn die
  // Marketing-Seite dabei wirft, reißt sie die Route mit — und mit der
  // zentralen Fehlerbehandlung sieht man nur noch einen 500er.
  const gemerkt = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  for (const key of Object.keys(require.cache)) {
    if (key.includes('Marketing') && key.endsWith('api.js')) delete require.cache[key];
  }
  try {
    const api = require('../Marketing/api');
    const ueberblick = await api.ueberblick();
    assert.equal(ueberblick.datenbank, false, 'ohne DB muss datenbank=false gemeldet werden');
    assert.ok(ueberblick.grund, 'ohne DB fehlt die Begründung');

    for (const name of ['jobs', 'trends', 'warteschlange', 'ergebnisse',
                        'verworfen', 'lernstand', 'protokoll', 'overrides']) {
      assert.deepEqual(await api[name](), [], `${name}() wirft oder liefert Daten ohne DB`);
    }
    const kosten = await api.kosten();
    assert.equal(kosten.monat_cent, 0, 'Kosten ohne DB müssen 0 sein, nicht undefined');
  } finally {
    if (gemerkt) process.env.DATABASE_URL = gemerkt;
    for (const key of Object.keys(require.cache)) {
      if (key.includes('Marketing') && key.endsWith('api.js')) delete require.cache[key];
    }
  }
});

// ── 4. Was die Rangliste anzeigt ─────────────────────────────────────

test('die Trend-Rangliste fasst ein Thema zu einer Zeile zusammen', () => {
  // Jeder Durchlauf legt für dasselbe Stichwort eine neue Trend-Zeile an —
  // die Historie braucht saisonalitaet(). Ohne DISTINCT ON stand dasselbe
  // Stichwort dreimal untereinander (gemessen: 18 Zeilen für 6 Stichwörter),
  // und die Rangliste zeigte statt der besten 12 Themen nur die besten 4.
  const abfrage = API.slice(API.indexOf('async function trends'), API.indexOf('async function warteschlange'));
  assert.match(abfrage, /DISTINCT ON \(t\.keyword_norm\)/,
    'ohne DISTINCT ON zeigt die Rangliste dasselbe Thema mehrfach');
});
