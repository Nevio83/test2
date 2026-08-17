#!/usr/bin/env node
/**
 * run-local.js — der Dauerläufer für alles, was einen Browser oder eine
 * Grafikkarte braucht.
 *
 * WOZU ES IHN GIBT
 * Der Automat läuft an drei Orten (siehe Marketing/README.md). GitHub Actions
 * übernimmt den Löwenanteil, kann aber zwei Dinge nicht: einen echten Browser
 * für den TikTok-Upload steuern und ein KI-Video auf einer Grafikkarte
 * rendern. Genau diese Abläufe stehen in `mkt_jobs` mit `requires_local = true`
 * und werden dem Actions-Runner vom Orchestrator gar nicht erst zugeteilt.
 * Dieses Programm holt sie sich — von deinem PC aus.
 *
 * WARUM NODE UND NICHT EINFACH EINE SCHLEIFE IN PYTHON
 * Damit der Takt exakt dem Vorbild des Shops folgt (`job-scheduler.js`): kurzer
 * Takt, Fälligkeit aus der Datenbank, Neustart ist höchstens eine Verzögerung
 * um einen Takt. Die eigentliche Arbeit macht weiterhin Python — dieses
 * Programm startet nur `run_loop --once` und schaut, dass immer nur EIN
 * Durchgang gleichzeitig läuft.
 *
 * WAS ES BEWUSST NICHT TUT
 *   * Es entscheidet nicht selbst, was fällig ist. Das steht in der Datenbank,
 *     und `state.uebernimm()` klärt es in einer einzigen SQL-Anweisung. Zwei
 *     laufende Kopien dieses Programms können denselben Ablauf daher nicht
 *     doppelt starten.
 *   * Es schaltet den Trockenlauf nicht ab. Wer wirklich veröffentlichen will,
 *     setzt `MARKETING_DRY_RUN=false` selbst — bewusst und sichtbar.
 *   * Es startet Python nicht neu, wenn ein Durchgang scheitert. Ein Fehler
 *     wird gemeldet, der nächste Takt versucht es erneut. Ein Programm, das
 *     bei jedem Fehler sofort neu startet, erzeugt bei einem dauerhaften
 *     Problem eine Endlosschleife statt einer sichtbaren Störung.
 *
 * Aufruf:
 *     npm run marketing:local            Dauerläufer, 5-Minuten-Takt
 *     npm run marketing:status           einmal den Zustand anzeigen
 *     node Marketing/run-local.js --once      genau ein Durchgang
 *     node Marketing/run-local.js --takt 60   anderer Takt in Sekunden
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MARKETING = __dirname;
const TAKT_STANDARD_SEK = 300;          // 5 Minuten, wie job-scheduler.js
const FRIST_STANDARD_MIN = 25;

// ── Argumente ────────────────────────────────────────────────────────

/**
 * Zahl aus einem Argument — mit Untergrenze und Rueckfall.
 *
 * Zwei verschiedene Faelle, die frueher verschieden behandelt wurden:
 *   * `--takt abc` ist UNLESBAR -> Standardwert.
 *   * `--takt 0` ist lesbar, aber unbrauchbar -> Untergrenze.
 * Vorher lief `0` ueber `|| standard` in den Standardwert, `-5` dagegen in die
 * Untergrenze — zwei gleich unsinnige Eingaben, zwei verschiedene Ergebnisse.
 * Bei einem Takt ist das nicht egal: 0 haette Python in einer Endlosschleife
 * gestartet, wenn die Untergrenze fehlt.
 */
function zahl(roh, standard, untergrenze) {
  const wert = parseFloat(roh);
  if (!Number.isFinite(wert)) return standard;
  return Math.max(untergrenze, wert);
}

function leseArgumente(argv) {
  const opt = { einmal: false, status: false, taktSek: TAKT_STANDARD_SEK,
                fristMin: FRIST_STANDARD_MIN, job: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--once' || a === '--einmal') opt.einmal = true;
    else if (a === '--status') opt.status = true;
    else if (a === '--takt') opt.taktSek = zahl(argv[++i], TAKT_STANDARD_SEK, 30);
    else if (a === '--max-minutes') opt.fristMin = zahl(argv[++i], FRIST_STANDARD_MIN, 0.5);
    else if (a === '--job') opt.job = argv[++i];
    else if (a === '--help' || a === '-h') opt.hilfe = true;
  }
  return opt;
}

// ── Python finden ────────────────────────────────────────────────────

/**
 * Sucht einen Python-Aufruf, der wirklich funktioniert.
 *
 * Nicht geraten, sondern PROBIERT: Auf diesem Rechner zeigt `python` auf eine
 * Installation ohne die Pakete, waehrend `py` die richtige startet — wer hier
 * fest `python` einträgt, bekommt "No module named pipelines" und sucht an
 * der falschen Stelle. Deshalb wird jeder Kandidat einmal mit `--version`
 * getestet und der erste genommen, der antwortet.
 */
function findePython() {
  const kandidaten = process.env.MARKETING_PYTHON
    ? [process.env.MARKETING_PYTHON]
    : (process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python']);

  for (const kandidat of kandidaten) {
    try {
      // Bewusst OHNE shell: true. Mit Shell warnt Node ab Version 22
      // (DEP0190), weil die Argumente dann nur aneinandergehaengt statt
      // maskiert werden — und `py`/`python` liegen ohnehin als ausfuehrbare
      // Datei im PATH, dafuer braucht es keine Shell.
      const { status } = require('child_process').spawnSync(kandidat, ['--version'], {
        stdio: 'ignore',
      });
      if (status === 0) return kandidat;
    } catch { /* naechster Kandidat */ }
  }
  return null;
}

/**
 * Ist eine Datenbank erreichbar konfiguriert?
 *
 * Node liest `.env` nicht von selbst, Python schon (env_loader.py). Ein
 * blosser Blick in process.env haette hier also gewarnt, obwohl die Datenbank
 * einwandfrei angebunden ist — eine Warnung, die faelschlich erscheint, bringt
 * einem bei, Warnungen zu ueberlesen.
 */
function datenbankKonfiguriert() {
  if (process.env.DATABASE_URL) return true;
  for (const datei of [path.join(MARKETING, '.env'), path.join(MARKETING, '..', '.env')]) {
    try {
      if (/^\s*DATABASE_URL\s*=\s*\S/m.test(fs.readFileSync(datei, 'utf8'))) return true;
    } catch { /* Datei fehlt — naechste */ }
  }
  return false;
}

// ── Ein Durchgang ────────────────────────────────────────────────────

/**
 * Die Umgebung, in der Python laeuft.
 *
 * Eigene Funktion, damit sie pruefbar ist: Stuende `MARKETING_RUNNER` hier
 * nicht auf 'local', bekaeme dieses Programm die Ablaeufe mit requires_local
 * gar nicht zugeteilt — Veroeffentlichen und Stil B wuerden schlicht nie
 * laufen. Und zwar ohne Fehlermeldung: Der Durchgang meldet brav "nicht
 * faellig / belegt" und ist gruen. Genau die Sorte Fehler, die man erst
 * Wochen spaeter bemerkt.
 */
function laufUmgebung(basis = process.env) {
  return {
    ...basis,
    MARKETING_RUNNER: 'local',
    // Windows-Konsolen laufen auf cp1252; die Protokollausgaben des
    // Automaten sind voller Umlaute und Symbole.
    PYTHONIOENCODING: 'utf-8',
  };
}

function fuehreAus(python, argumente) {
  return new Promise((fertig) => {
    const kind = spawn(python, ['-m', 'pipelines.orchestrator.run_loop', ...argumente], {
      cwd: MARKETING,
      // Ausgabe direkt durchreichen: Der Python-Teil protokolliert bereits
      // ausfuehrlich, und eine zweite Protokollebene wuerde nur verdoppeln.
      stdio: 'inherit',
      env: laufUmgebung(),
    });
    kind.on('error', (fehler) => {
      console.error(`❌ Python liess sich nicht starten: ${fehler.message}`);
      fertig(1);
    });
    kind.on('close', (code) => fertig(code === null ? 1 : code));
  });
}

// ── Dauerlauf ────────────────────────────────────────────────────────

async function dauerlauf(python, opt) {
  let laeuft = false;
  let beenden = false;
  let durchgaenge = 0;
  let fehlgeschlagen = 0;

  const argumente = opt.job
    ? ['--job', opt.job, '--max-minutes', String(opt.fristMin)]
    : ['--once', '--max-minutes', String(opt.fristMin)];

  async function takt() {
    // Ueberlappung verhindern. Ein Durchgang darf laenger dauern als der Takt
    // (Rendern!) — dann wird der naechste Takt einfach uebersprungen, statt
    // einen zweiten Prozess danebenzustellen.
    if (laeuft) {
      console.log('⏳ Vorheriger Durchgang laeuft noch — dieser Takt wird uebersprungen.');
      return;
    }
    laeuft = true;
    durchgaenge++;
    const start = Date.now();
    try {
      const code = await fuehreAus(python, argumente);
      const dauer = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`— Durchgang ${durchgaenge} fertig nach ${dauer}s\n`);
      } else {
        fehlgeschlagen++;
        console.error(`— Durchgang ${durchgaenge} endete mit Code ${code} (nach ${dauer}s)\n`);
      }
    } finally {
      laeuft = false;
    }
    if (beenden) process.exit(0);
  }

  const uhr = setInterval(takt, opt.taktSek * 1000);

  // Strg+C: laufenden Durchgang zu Ende bringen, statt ihn abzuschneiden.
  // Ein mitten im Rendern abgeschossener Ablauf bleibt sonst in der Datenbank
  // belegt, bis der Herzschlag-Timeout ihn nach 30 Minuten freigibt.
  const aufhoeren = () => {
    if (beenden) process.exit(1);      // zweites Strg+C: sofort
    beenden = true;
    clearInterval(uhr);
    if (laeuft) {
      console.log('\n⏹  Beenden vorgemerkt — der laufende Durchgang wird noch fertig.');
      console.log('   Nochmal Strg+C bricht sofort ab (hinterlaesst einen belegten Ablauf).');
    } else {
      console.log('\n⏹  Beendet.');
      process.exit(0);
    }
  };
  process.on('SIGINT', aufhoeren);
  process.on('SIGTERM', aufhoeren);

  console.log(`▶ Dauerlaeufer gestartet — Takt ${opt.taktSek}s, Frist ${opt.fristMin} Min je Durchgang.`);
  console.log('   Beenden mit Strg+C. Notaus fuer alles: Datei Marketing/STOP anlegen.\n');
  await takt();      // nicht erst nach dem ersten Takt anfangen
}

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const opt = leseArgumente(process.argv.slice(2));

  if (opt.hilfe) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?|^ \* ?/gm, ''));
    return 0;
  }

  const python = findePython();
  if (!python) {
    console.error('❌ Kein funktionierendes Python gefunden.');
    console.error('   Versucht wurden: ' + (process.platform === 'win32' ? 'py, python, python3' : 'python3, python'));
    console.error('   Fester Pfad moeglich ueber MARKETING_PYTHON=<pfad zur python.exe>');
    return 1;
  }

  if (!fs.existsSync(path.join(MARKETING, 'pipelines', 'orchestrator', 'run_loop.py'))) {
    console.error(`❌ pipelines/orchestrator/run_loop.py nicht gefunden unter ${MARKETING}`);
    return 1;
  }

  if (!datenbankKonfiguriert()) {
    // Kein Abbruch: run_loop meldet das je Ablauf sauber. Aber es ist der mit
    // Abstand haeufigste Grund fuer "es passiert nichts" — also einmal deutlich.
    console.warn('⚠️  DATABASE_URL ist weder gesetzt noch in einer .env zu finden.');
    console.warn('   Ohne sie kann kein Ablauf belegt werden. Der Durchgang laeuft');
    console.warn('   trotzdem und nennt je Ablauf den Grund.\n');
  }

  if (opt.status) return fuehreAus(python, ['--status']);
  if (opt.einmal) {
    return fuehreAus(python, opt.job
      ? ['--job', opt.job, '--max-minutes', String(opt.fristMin)]
      : ['--once', '--max-minutes', String(opt.fristMin)]);
  }

  await dauerlauf(python, opt);
  return 0;
}

if (require.main === module) {
  main().then((code) => { if (code) process.exit(code); });
}

module.exports = { leseArgumente, findePython, laufUmgebung, datenbankKonfiguriert };
