/**
 * Vorrat des Marketing-Automaten (Punkt 56 in Marketing/VideosVerbessern.html).
 *
 * Ein Kanal schlaeft nicht ein, weil der Zeitplan fehlt, sondern weil der
 * Vorrat leer ist. Diese Pruefungen sichern die Rechnung, die das Dashboard
 * und die taegliche Warnmail benutzen — ohne Datenbank, denn die Rechnung ist
 * eine reine Funktion.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { vorratRechnen, trockenlaufAktiv } = require('../Marketing/api');

test('20 freigegebene Clips bei drei am Tag reichen keine zwei Wochen', () => {
  const v = vorratRechnen({ frei: 20, wartet: 5, slots: 4, maxProTag: 3 });
  assert.equal(v.pro_tag, 3, 'vier Slots, aber hoechstens drei Beitraege am Tag');
  assert.equal(v.reicht_tage, 6.7);
  assert.equal(v.warnung, true);
  assert.equal(v.wartet, 5, 'was auf Freigabe wartet, wird mitgemeldet — dort liegt der Hebel');
});

test('ab zwei Wochen Reichweite bleibt es still', () => {
  assert.equal(vorratRechnen({ frei: 42, slots: 4, maxProTag: 3 }).warnung, false, '14 Tage genau');
  assert.equal(vorratRechnen({ frei: 41, slots: 4, maxProTag: 3 }).warnung, true, 'knapp darunter');
});

test('der Takt ist das Kleinere aus Slots und Tageshoechstwert', () => {
  // Der Automat darf die Slots lernen (veroeffentlichung.slots steht auf der
  // Positivliste). Zwei Slots heissen zwei Beitraege am Tag, nicht drei.
  const v = vorratRechnen({ frei: 20, slots: 2, maxProTag: 3 });
  assert.equal(v.pro_tag, 2);
  assert.equal(v.reicht_tage, 10);

  // GEGENPROBE: Wer nur max_posts_pro_tag liest, rechnet 6,7 statt 10 Tage —
  // die Warnung kaeme ein Drittel zu frueh. Fehlalarme sind nicht harmlos:
  // Wer ein paar davon bekommen hat, liest den echten nicht mehr.
  const nurMaximum = Math.round((20 / 3) * 10) / 10;
  assert.equal(nurMaximum, 6.7);
  assert.notEqual(v.reicht_tage, nurMaximum);
});

test('ohne Slot wird nichts verbraucht — und nichts gewarnt', () => {
  const v = vorratRechnen({ frei: 20, slots: 0, maxProTag: 3 });
  assert.equal(v.reicht_tage, null, 'eine Division durch null waere "unendlich" und saehe beruhigend aus');
  assert.equal(v.warnung, false);
  assert.ok(v.grund, 'aber es wird gesagt, warum');
});

test('der Trockenlauf wird genauso entschieden wie in Python', () => {
  // guardrails.trockenlauf(): _flag("MARKETING_DRY_RUN", Vorgabe aus der Datei)
  assert.equal(trockenlaufAktiv({}), true, 'ohne ENV gilt die Vorgabe — und die ist Trockenlauf');
  assert.equal(trockenlaufAktiv({ MARKETING_DRY_RUN: 'false' }), false);
  assert.equal(trockenlaufAktiv({ MARKETING_DRY_RUN: 'nein' }), false, 'dieselben Woerter wie _flag');
  assert.equal(trockenlaufAktiv({ MARKETING_DRY_RUN: 'true' }), true);

  // GEGENPROBE: Ein unbekannter Wert darf NICHT als "aus" gelten. Sonst
  // schaltete ein Tippfehler in der ENV den Echtbetrieb an — und die
  // Vorratswarnung liefe los, waehrend der Automat in Wahrheit nur probt.
  assert.equal(trockenlaufAktiv({ MARKETING_DRY_RUN: 'flase' }), true);
});

test('die Warnmail laeuft nur im Echtbetrieb', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const block = server.slice(server.indexOf("'marketing-vorrat'") - 400, server.indexOf("'marketing-vorrat'") + 200);
  assert.ok(block.includes('marketingLive'), 'der Ablauf haengt am Echtbetrieb');
  assert.ok(server.includes('!marketingApi.trockenlaufAktiv()'),
    'im Trockenlauf wird nichts veroeffentlicht — eine taegliche Mail waere Laerm');
  assert.ok(block.includes('sendOpsAlert') || server.slice(server.indexOf("'marketing-vorrat'"), server.indexOf("'marketing-vorrat'") + 900).includes('sendOpsAlert'),
    'derselbe Weg wie die uebrigen Betriebswarnungen');
});
