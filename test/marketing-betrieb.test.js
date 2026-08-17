/**
 * Tests für den Betrieb des Marketing-Automaten: Workflow, lokaler Läufer,
 * npm-Skripte.
 *
 * Die Fehler in dieser Ecke haben alle dieselbe unangenehme Eigenschaft: Der
 * Lauf bleibt GRÜN und meldet nichts. Ein Workflow, der einen Ablauf nie
 * zuteilt, sieht genauso aus wie einer, bei dem gerade nichts fällig ist. Ein
 * Trockenlauf, der versehentlich abgeschaltet ist, sieht aus wie normaler
 * Betrieb — bis der erste Beitrag öffentlich steht.
 *
 * Deshalb prüfen diese Tests nicht „läuft es durch", sondern die drei
 * Einstellungen, an denen genau das hängt.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const WORKFLOW = fs.readFileSync(
  path.join(WURZEL, '.github', 'workflows', 'marketing.yml'), 'utf8');
const PAKET = JSON.parse(fs.readFileSync(path.join(WURZEL, 'package.json'), 'utf8'));

// ── 1. Der Workflow veröffentlicht nicht versehentlich ───────────────

test('der Workflow schaltet den Trockenlauf nicht selbst ab', () => {
  // Der gefährlichste denkbare Tippfehler in dieser Datei. Erlaubt ist nur,
  // die Variable aus einem Secret zu übernehmen — dann ist es eine bewusste
  // Entscheidung eines Menschen, keine Zeile im Repository.
  const zeilen = WORKFLOW.split('\n').filter((z) => z.includes('MARKETING_DRY_RUN'));
  assert.ok(zeilen.length > 0, 'MARKETING_DRY_RUN kommt gar nicht vor — Absicht dokumentieren');
  for (const zeile of zeilen) {
    if (zeile.trimStart().startsWith('#')) continue;   // Erklärtext
    assert.match(
      zeile, /\$\{\{\s*secrets\./,
      `MARKETING_DRY_RUN wird fest gesetzt statt aus einem Secret gelesen: ${zeile.trim()}`
    );
  }
});

test('der Workflow setzt MARKETING_ENABLED nicht auf true', () => {
  // Der Notaus über die Umgebung muss von außen kommen können. Stünde hier
  // ein festes true, wäre einer der drei Wege still ausgehebelt.
  const gesetzt = WORKFLOW.split('\n').filter(
    (z) => !z.trimStart().startsWith('#') && /MARKETING_ENABLED\s*:/.test(z));
  assert.deepEqual(gesetzt, [], `MARKETING_ENABLED wird im Workflow gesetzt: ${gesetzt.join(' | ')}`);
});

test('Läufe werden serialisiert, nicht abgebrochen', () => {
  // Ein abgebrochener Lauf hinterlässt einen belegten Ablauf (laeuft_seit
  // gesetzt). Der nächste überspringt ihn dann bis zum Herzschlag-Timeout —
  // 30 Minuten, in denen scheinbar grundlos nichts passiert.
  assert.match(WORKFLOW, /concurrency:/, 'keine concurrency-Gruppe — zwei Läufe können sich überholen');
  assert.match(
    WORKFLOW, /cancel-in-progress:\s*false/,
    'cancel-in-progress steht nicht auf false — ein Lauf könnte mitten im Rendern abgebrochen werden'
  );
});

test('die Eingabe des manuellen Starts landet nicht in der Befehlszeile', () => {
  // Bekannte Schwachstellenklasse bei GitHub Actions: ${{ github.event.inputs.x }}
  // wird VOR der Shell ersetzt. Ein Ablaufname wie `a; curl …` wäre dann ein
  // eigener Befehl. Über env: gelesen ist er nur ein Wert.
  const laufBloecke = WORKFLOW.split(/^\s*- name:/m);
  for (const block of laufBloecke) {
    const runTeil = block.split(/\n\s*run:/)[1];
    if (!runTeil) continue;
    assert.ok(
      !/\$\{\{\s*github\.event\.inputs\./.test(runTeil),
      'Eingabe wird direkt in run: eingesetzt — muss über env: gehen'
    );
  }
});

test('der Workflow verlässt sich nicht darauf, dass ffmpeg vorhanden ist', () => {
  // Ob ein Runner-Abbild ffmpeg mitbringt, ändert sich zwischen
  // Abbild-Versionen. Fehlt es, rendert Stil A nicht — und der Lauf bleibt
  // trotzdem grün, weil der Job den Grund brav protokolliert.
  assert.match(WORKFLOW, /ffmpeg/, 'ffmpeg wird nirgends erwähnt');
  assert.match(
    WORKFLOW, /command -v ffmpeg|apt-get install[^\n]*ffmpeg/,
    'ffmpeg wird vorausgesetzt statt geprüft oder installiert'
  );
});

test('der Workflow hat eine Zeitgrenze', () => {
  // Ohne timeout-minutes läuft ein hängender HTTP-Aufruf bis zur
  // GitHub-Obergrenze von 6 Stunden — und blockiert dabei die serialisierte
  // Gruppe, also auch alle folgenden Läufe.
  assert.match(WORKFLOW, /timeout-minutes:\s*\d+/, 'keine timeout-minutes gesetzt');
});

// ── 2. Der lokale Läufer holt sich die richtigen Abläufe ─────────────

test('der lokale Läufer meldet sich als "local" an', () => {
  // Stünde hier etwas anderes, bekäme er die Abläufe mit requires_local nie
  // zugeteilt: Veröffentlichen und Stil B liefen einfach nicht. Ohne
  // Fehlermeldung — der Durchgang meldet "nicht fällig / belegt" und ist grün.
  const { laufUmgebung } = require('../Marketing/run-local');
  const umgebung = laufUmgebung({ PATH: '/usr/bin', MARKETING_RUNNER: 'actions' });
  assert.equal(
    umgebung.MARKETING_RUNNER, 'local',
    'der lokale Läufer übernimmt eine fremde Einstellung statt sie zu setzen'
  );
  assert.equal(umgebung.PATH, '/usr/bin', 'die übrige Umgebung darf nicht verlorengehen');
});

test('der lokale Läufer schaltet den Trockenlauf nicht ab', () => {
  const { laufUmgebung } = require('../Marketing/run-local');
  const umgebung = laufUmgebung({});
  assert.equal(
    umgebung.MARKETING_DRY_RUN, undefined,
    'der Läufer setzt MARKETING_DRY_RUN selbst — das muss ein Mensch tun'
  );
  assert.equal(umgebung.MARKETING_ENABLED, undefined, 'der Läufer hebelt den Notaus aus');
});

test('die Schalter des lokalen Läufers werden richtig gelesen', () => {
  const { leseArgumente } = require('../Marketing/run-local');

  const standard = leseArgumente([]);
  assert.equal(standard.einmal, false);
  assert.equal(standard.taktSek, 300, '5-Minuten-Takt wie job-scheduler.js');

  const einmal = leseArgumente(['--once', '--max-minutes', '5']);
  assert.equal(einmal.einmal, true);
  assert.equal(einmal.fristMin, 5);

  const nurJob = leseArgumente(['--job', 'publish_due']);
  assert.equal(nurJob.job, 'publish_due');
});

test('ein unsinniger Takt fällt nicht unter 30 Sekunden', () => {
  // GEGENPROBE zur Zeile mit Math.max: Ein Takt von 0 (oder ein Tippfehler,
  // der zu NaN wird) würde Python in einer Endlosschleife starten.
  const { leseArgumente } = require('../Marketing/run-local');
  assert.equal(leseArgumente(['--takt', '0']).taktSek, 30);
  assert.equal(leseArgumente(['--takt', 'abc']).taktSek, 300);
  assert.equal(leseArgumente(['--takt', '-5']).taktSek, 30);
});

test('die Datenbank-Warnung berücksichtigt die .env-Dateien', () => {
  // Node liest .env nicht von selbst, Python schon. Ein bloßer Blick in
  // process.env hätte gewarnt, obwohl die Datenbank einwandfrei angebunden
  // ist — eine Warnung, die falsch erscheint, bringt einem bei, Warnungen zu
  // überlesen.
  const { datenbankKonfiguriert } = require('../Marketing/run-local');
  const gemerkt = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const hatEnvDatei = ['Marketing/.env', '.env'].some((p) => {
      try {
        return /^\s*DATABASE_URL\s*=\s*\S/m.test(fs.readFileSync(path.join(WURZEL, p), 'utf8'));
      } catch { return false; }
    });
    assert.equal(
      datenbankKonfiguriert(), hatEnvDatei,
      'die Prüfung deckt sich nicht mit dem, was tatsächlich in den .env-Dateien steht'
    );
  } finally {
    if (gemerkt) process.env.DATABASE_URL = gemerkt;
  }
});

// ── 3. Die npm-Skripte zeigen auf vorhandene Dateien ─────────────────

test('jedes marketing-Skript ruft eine Datei auf, die es gibt', () => {
  const skripte = Object.entries(PAKET.scripts).filter(([name]) => name.startsWith('marketing:'));
  assert.ok(skripte.length >= 3, `nur ${skripte.length} marketing-Skripte — fehlt eines?`);
  for (const [name, befehl] of skripte) {
    const datei = (befehl.match(/node\s+(\S+)/) || [])[1];
    assert.ok(datei, `Skript '${name}' ruft kein node-Programm auf: ${befehl}`);
    assert.ok(
      fs.existsSync(path.join(WURZEL, datei)),
      `Skript '${name}' zeigt auf '${datei}' — die Datei gibt es nicht`
    );
  }
});

test('die Betriebsanleitung nennt alle drei Wege zum Anhalten', () => {
  // Ein Notaus, den man im Ernstfall erst suchen muss, ist keiner.
  const readme = fs.readFileSync(path.join(WURZEL, 'Marketing', 'README.md'), 'utf8');
  for (const weg of ['STOP', 'MARKETING_ENABLED', 'marketing.html']) {
    assert.ok(readme.includes(weg), `README nennt den Weg '${weg}' nicht`);
  }
});
