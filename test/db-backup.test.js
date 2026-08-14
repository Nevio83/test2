/**
 * Tests für die Datenbank-Sicherung.
 *
 * Anlass: Die Sicherung erfasste 9 von 17 Tabellen. Nicht dabei waren unter
 * anderem die 28 gespeicherten Einwilligungen (user_consent_events) — der
 * NACHWEIS, den Art. 7 Abs. 1 DSGVO verlangt und der sich nicht
 * wiederherstellen lässt, wenn er weg ist. Begründet war die Auslassung im
 * Code mit „reproduzierbar/unkritisch" und „würde den Export aufblähen" —
 * beides stimmte nicht: nachgemessen 504 KB für alle ausgelassenen Tabellen
 * zusammen, überwiegend leerer Tabellen-Überbau.
 *
 * DIE EIGENTLICHE GEFAHR BEIM ERWEITERN: Drei Tabellen des Schemas haben
 * keine "id"-Spalte (cj_price_watch/cj_stock_watch → product_id, job_runs →
 * job). Ein hartes "ORDER BY id" hätte bei jeder von ihnen den GESAMTEN
 * täglichen Lauf abstürzen lassen — lautlos, als "Backup fehlgeschlagen" im
 * Log, ohne zu sagen, welche Tabelle schuld war. Das ist der Kern dieser
 * Tests, nicht die Tabellenliste selbst.
 *
 * CI hat keine Datenbank. Tests, die eine echte Verbindung brauchen,
 * überspringen sich selbst statt fehlzuschlagen — sie laufen lokal mit
 * gesetzter DATABASE_URL.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const HAT_DB = !!process.env.DATABASE_URL;
const { BACKUP_TABLES, sortierSpalten, exportBackupJson } = require('../db-backup');

// ── Ohne Datenbank prüfbar: die Liste selbst ────────────────────────

test('die Sicherung nimmt keine reproduzierbaren Arbeitsstände auf', () => {
  // cj_price_watch/cj_stock_watch bauen sich beim naechsten CJ-Abgleich neu
  // auf, job_runs bestimmt nur Faelligkeiten. Nichts davon ist ein Nachweis.
  for (const t of ['cj_price_watch', 'cj_stock_watch', 'job_runs']) {
    assert.ok(!BACKUP_TABLES.includes(t), `${t} sollte nicht gesichert werden`);
  }
});

test('die Nachweis-Tabellen sind jetzt in der Liste', () => {
  // Der eigentliche Zweck dieser Aenderung: das hier fehlte vorher.
  for (const t of ['user_consent_events', 'privacy_requests', 'stock_notifications']) {
    assert.ok(BACKUP_TABLES.includes(t), `${t} fehlt weiterhin in der Sicherung`);
  }
});

test('keine Tabelle steht doppelt in der Liste', () => {
  assert.equal(new Set(BACKUP_TABLES).size, BACKUP_TABLES.length);
});

// ── Mit Datenbank: die eigentliche Absturz-Gefahr ───────────────────

test('jede gesicherte Tabelle bekommt eine Sortierspalte, die es wirklich gibt', { skip: !HAT_DB && 'keine DATABASE_URL — lokal mit Verbindung ausführen' }, async () => {
  const spalten = await sortierSpalten(BACKUP_TABLES);
  const ohne = BACKUP_TABLES.filter((t) => !spalten[t]);
  assert.deepEqual(ohne, [], 'ohne erkannte Sortierspalte: ' + ohne.join(', '));
});

test('der Export läuft für alle Tabellen ohne SQL-Fehler durch', { skip: !HAT_DB && 'keine DATABASE_URL — lokal mit Verbindung ausführen' }, async () => {
  const payload = await exportBackupJson();
  assert.equal(Object.keys(payload.tables).length, BACKUP_TABLES.length);
  for (const t of BACKUP_TABLES) {
    assert.ok(Array.isArray(payload.tables[t]), `${t}: kein Array zurückgegeben`);
    assert.equal(payload.counts[t], payload.tables[t].length, `${t}: Zähler stimmt nicht mit der Zeilenzahl überein`);
  }
});

test('GEGENPROBE: ein hartes "ORDER BY id" wäre bei den ausgeschlossenen Tabellen abgestürzt', { skip: !HAT_DB && 'keine DATABASE_URL — lokal mit Verbindung ausführen' }, async () => {
  // Beweist, dass die alte Annahme ("jede Tabelle hat eine id-Spalte") falsch
  // war — genau der Fehler, den sortierSpalten() jetzt verhindert.
  const { db } = require('../database');
  await assert.rejects(
    () => db.query('SELECT * FROM cj_price_watch ORDER BY id ASC'),
    /column "id" does not exist/i,
    'cj_price_watch hat doch eine id-Spalte — dann war die Sorge unbegründet'
  );
});

test('GEGENPROBE: eine unbekannte Tabelle bekommt keine erfundene Sortierspalte', { skip: !HAT_DB && 'keine DATABASE_URL — lokal mit Verbindung ausführen' }, async () => {
  const spalten = await sortierSpalten(['diese_tabelle_gibt_es_nicht']);
  assert.equal(spalten.diese_tabelle_gibt_es_nicht, undefined);
});
