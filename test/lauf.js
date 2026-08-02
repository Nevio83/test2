/**
 * test/lauf.js — startet alle Testdateien in diesem Ordner.
 *
 * Warum es diese Datei gibt: `npm test` stand auf
 *     node --test "test/**\/*.test.js"
 * und das lief NUR unter Windows. Unter Linux bricht es mit
 * "Could not find '/…/test/**\/*.test.js'" ab — die Shell loest das Muster
 * nicht auf (`**` braucht globstar) und reicht es unveraendert weiter.
 * Aufgefallen beim allerersten CI-Lauf: die Tests waeren dort nie gelaufen,
 * der Lauf war sofort rot. Vorher hat es niemand gemerkt, weil lokal Windows
 * laeuft und dort ein anderer Weg greift.
 *
 * `node --test test/` waere die naheliegende Loesung, verhaelt sich aber je
 * nach Node-Version unterschiedlich (unter Node 24 wird der Ordner als Modul
 * interpretiert und der Lauf scheitert). Deshalb hier die Dateien selbst
 * einsammeln und uebergeben — das ist auf jeder Version und jedem
 * Betriebssystem gleich.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ordner = __dirname;
const dateien = fs.readdirSync(ordner)
  .filter((n) => n.endsWith('.test.js'))
  .sort()
  .map((n) => path.join(ordner, n));

if (!dateien.length) {
  console.error('Keine Testdateien in ' + ordner + ' gefunden (*.test.js).');
  process.exit(1);
}

console.log('Testdateien: ' + dateien.map((d) => path.basename(d)).join(', '));

const ergebnis = spawnSync(process.execPath, ['--test', ...dateien], { stdio: 'inherit' });
process.exit(ergebnis.status === null ? 1 : ergebnis.status);
