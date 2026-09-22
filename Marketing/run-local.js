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
 *
 *     node Marketing/run-local.js --bestand-umstellen
 *         Vorschau: Was eine Umstellung der Merkliste auf Pruefsummen aendern
 *         wuerde. Schreibt nichts.
 *     node Marketing/run-local.js --bestand-umstellen --schreiben --regeln v3
 *         Schreibt es fest, mit Sicherung daneben.
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
                fristMin: FRIST_STANDARD_MIN, job: null,
                bestandUmstellen: false, schreiben: false, regeln: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--once' || a === '--einmal') opt.einmal = true;
    else if (a === '--status') opt.status = true;
    else if (a === '--takt') opt.taktSek = zahl(argv[++i], TAKT_STANDARD_SEK, 30);
    else if (a === '--max-minutes') opt.fristMin = zahl(argv[++i], FRIST_STANDARD_MIN, 0.5);
    else if (a === '--job') opt.job = argv[++i];
    // Punkt 49: Die Merkliste auf Pruefsummen umstellen. OHNE --schreiben ist
    // es eine Vorschau — erst sehen, was passieren wuerde, dann festschreiben.
    // Dieselbe Linie wie beim Trockenlauf des Bots.
    else if (a === '--bestand-umstellen') opt.bestandUmstellen = true;
    else if (a === '--schreiben') opt.schreiben = true;
    else if (a === '--regeln') opt.regeln = argv[++i];
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

// Ab wann eine stehende Merkliste gemeldet wird. Drei Tage sind grosszuegig
// fuer eine TAEGLICHE Aufgabe und eng genug, um einen Ausfall zu bemerken,
// bevor eine Woche vergangen ist.
const BESTAND_FRIST_TAGE = 3;

/**
 * Meldet, wenn die taegliche Schnitt-Aufgabe stehengeblieben ist.
 *
 * WARUM DAS HIER STEHT
 * Marketing/videos/.bestand.json ist die Merkliste der taeglichen Aufgabe
 * ("Nicht von Hand loeschen — sonst schneidet die Aufgabe alles neu"). Am
 * 18.09. stand darin zuletzt_gelaufen: 2026-08-30 — neunzehn Tage. Gemeldet
 * hatte das niemand.
 *
 * Das ist dieselbe Fehlerklasse wie die Wochenlaeufe im Shop, die
 * monatelang nicht liefen: Ein Ablauf, der NICHT laeuft, sieht genauso aus
 * wie einer, der nichts zu tun hatte. Der Unterschied wird erst sichtbar,
 * wenn jemand ihn ausspricht.
 *
 * Warum hier und nicht im Dashboard: Die Datei liegt in .gitignore und
 * entsteht lokal. Auf dem Server, wo das Dashboard laeuft, gibt es sie gar
 * nicht. Der lokale Starter ist die einzige Stelle, die sie sieht.
 */
function meldeStehendeSchnittaufgabe(jetzt = new Date()) {
  const datei = path.join(MARKETING, 'videos', '.bestand.json');
  let gelesen;
  try {
    gelesen = JSON.parse(fs.readFileSync(datei, 'utf8'));
  } catch {
    return null;   // keine Merkliste, keine Aussage — kein Fehler
  }
  const zuletzt = gelesen && gelesen.zuletzt_gelaufen;
  if (!zuletzt) return null;

  const gelaufen = new Date(`${zuletzt}T00:00:00Z`);
  if (Number.isNaN(gelaufen.getTime())) return null;

  const tage = Math.floor((jetzt - gelaufen) / 86400000);
  if (tage < BESTAND_FRIST_TAGE) return { tage, gemeldet: false };

  console.warn(`⚠️  Die tägliche Schnitt-Aufgabe lief zuletzt am ${zuletzt} — vor ${tage} Tagen.`);
  console.warn('   Marketing/videos/.bestand.json steht seitdem still. Läuft die geplante');
  console.warn('   Aufgabe noch? Findet sie den Ordner? Bricht sie still ab?');
  console.warn('   Ein Ablauf, der nicht läuft, sieht aus wie einer, der nichts zu tun hatte.\n');
  return { tage, gemeldet: true };
}


// ── Merkliste auf Pruefsummen (Punkt 49) ─────────────────────────────
//
// .bestand.json haelt fest, welche Rohdateien schon verarbeitet sind — sonst
// schneidet die Aufgabe bei jedem Lauf alles neu. Bisher stand darin NUR der
// Dateiname.
//
// WAS DIE ECHTE LISTE ZEIGT — UND WAS NICHT
// Nachgezaehlt in der Liste vom 30.08. (22 Dateien, Produkt 10): KEIN
// Dateiname kommt doppelt vor. Der erste Verdacht war also falsch, und das
// gehoert hierher statt in eine Behauptung.
//
// Was doppelt vorkommt, ist die laufende NUMMER:
//
//     14_elektrischer-wasserspender_20s_stil-b.mp4
//     14_elektrischer-wasserspender_32s_stil-b.mp4
//
// Das ist (noch) harmlos, weil die Dauer die beiden trennt. Es zeigt aber, dass
// die Nummernvergabe schon einmal ausgesetzt hat — und der Dateiname haengt an
// ihr. Der eigentliche Fall bleibt derselbe: Wird eine Datei unter gleichem
// Namen durch anderen Inhalt ersetzt (neu geladen, nachbearbeitet), merkt eine
// Liste aus Dateinamen das nicht. Die Aufgabe haelt sie fuer erledigt und
// schneidet den neuen Inhalt nie — lautlos.
//
// Die Pruefsummen werden beim Laden ohnehin gerechnet und stehen im Bot-Index.
// Sie muessen also nur abgeschrieben werden, nicht neu berechnet.
//
// WAS HIER NICHT PASSIERT: DIE LISTE UMSCHREIBEN.
// Diese Funktionen lesen und vergleichen. Das Umstellen ist ein eigener,
// sichtbarer Schritt (--bestand-umstellen), denn in der Liste stehen Notizen,
// die jemand von Hand geschrieben hat ("Clips mit dem SCHWARZEN Spender nicht
// mit den weissen mischen") — die sind mehr wert als die Dateiliste selbst.

const BESTAND_DATEI = path.join(MARKETING, 'videos', '.bestand.json');

/** Die Merkliste lesen. Fehlt sie, gibt es nichts zu sagen. */
function ladeBestand(datei = BESTAND_DATEI) {
  try {
    return JSON.parse(fs.readFileSync(datei, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Ein Eintrag der Liste, einheitlich gelesen.
 *
 * Alte Form: "01_datei.mp4". Neue Form: { datei, sha256, regeln }.
 * Beide muessen nebeneinander funktionieren — eine Umstellung, die die alte
 * Form nicht mehr liest, wirft beim ersten Lauf alles weg und schneidet neu.
 */
function bestandEintrag(roh) {
  if (typeof roh === 'string') return { datei: roh, sha256: null, regeln: null };
  if (roh && typeof roh === 'object' && roh.datei) {
    return { datei: String(roh.datei), sha256: roh.sha256 || null, regeln: roh.regeln || null };
  }
  return null;
}

/**
 * Gilt diese Datei als verarbeitet?
 *
 * DREI FAELLE, und der mittlere ist der Grund fuer diesen Punkt:
 *   1. Pruefsumme steht in der Liste und stimmt          → erledigt
 *   2. Pruefsumme steht in der Liste und stimmt NICHT    → neu schneiden
 *   3. keine Pruefsumme in der Liste (Altbestand)        → Name entscheidet
 *
 * Fall 2 war bisher unsichtbar: Gleicher Name, anderer Inhalt, und die Aufgabe
 * hielt die Datei fuer erledigt.
 *
 * @param {string|null} pruefsumme  sha256 der Datei JETZT, aus dem Bot-Index.
 */
function giltAlsVerarbeitet(eintraege, datei, pruefsumme = null) {
  const liste = [].concat(eintraege || []).map(bestandEintrag).filter(Boolean);
  const treffer = liste.find((e) => e.datei === datei);
  if (!treffer) return { verarbeitet: false, grund: 'nicht in der Liste' };
  if (!treffer.sha256) {
    return { verarbeitet: true, grund: 'nur der Name steht in der Liste (Altbestand)' };
  }
  if (!pruefsumme) {
    return { verarbeitet: true, grund: 'Pruefsumme der Datei unbekannt — Name entscheidet' };
  }
  if (treffer.sha256 === pruefsumme) return { verarbeitet: true, grund: 'Pruefsumme stimmt' };
  return { verarbeitet: false, grund: 'gleicher Name, anderer Inhalt' };
}

/**
 * Gilt ein Clip nach einer Vorlagenaenderung als veraltet?
 *
 * Aendert sich die Fassung der Schnittregeln, sollen alle damit gebauten Clips
 * neu erzeugt werden — gezielt, nicht pauschal. Ein Eintrag ohne Fassung ist
 * NICHT veraltet: Altbestand pauschal neu zu schneiden waere genau das
 * "schneidet alles neu", das die Liste verhindern soll.
 */
function veraltetDurchRegeln(eintrag, aktuelleFassung) {
  const e = bestandEintrag(eintrag);
  if (!e || !e.regeln) return false;
  if (!aktuelleFassung) return false;
  return e.regeln !== aktuelleFassung;
}

/**
 * Was eine Umstellung auf Pruefsummen aendern WUERDE.
 *
 * Gibt die neue Liste zurueck, schreibt aber nichts. Die Pruefsummen kommen aus
 * dem Bot-Index; wo keine steht, bleibt der Eintrag wie er ist — geraten wird
 * nichts.
 *
 * @param {Map<string,string>} pruefsummen  Dateiname → sha256
 */
function bestandUmstellen(bestand, pruefsummen, { regeln = null } = {}) {
  const neu = JSON.parse(JSON.stringify(bestand || {}));
  const bericht = { ergaenzt: 0, ohnePruefsumme: [], doppelteNamen: [] };
  for (const [ordner, stand] of Object.entries(neu.produkte || {})) {
    const liste = [].concat(stand.verarbeitet || []);
    const gesehen = new Set();
    stand.verarbeitet = liste.map((roh) => {
      const e = bestandEintrag(roh);
      if (!e) return roh;
      if (gesehen.has(e.datei)) bericht.doppelteNamen.push(`${ordner}/${e.datei}`);
      gesehen.add(e.datei);
      const summe = pruefsummen.get(e.datei) || e.sha256 || null;
      if (!summe) {
        bericht.ohnePruefsumme.push(`${ordner}/${e.datei}`);
        return typeof roh === 'string' ? roh : e;
      }
      if (!e.sha256) bericht.ergaenzt++;
      return { datei: e.datei, sha256: summe, ...(regeln ? { regeln } : {}) };
    });
  }
  return { bestand: neu, bericht };
}

/**
 * Die Merkliste auf Pruefsummen umstellen.
 *
 * Die Pruefsummen kommen aus dem Bot-Index — sie werden beim Laden ohnehin
 * gerechnet und muessen nur abgeschrieben werden. Wo keine steht, bleibt der
 * Eintrag, wie er ist.
 *
 * OHNE --schreiben passiert nichts. In der Liste stehen Notizen, die jemand von
 * Hand geschrieben hat ("Clips mit dem SCHWARZEN Spender nicht mit den weissen
 * mischen") — die sind mehr wert als die Dateiliste selbst, und eine
 * Umstellung, die sie ueberschreibt, waere ein schlechter Tausch.
 */
function stelleBestandUm(opt) {
  const bestand = ladeBestand();
  if (!bestand) {
    console.error(`❌ ${BESTAND_DATEI} nicht lesbar — nichts umzustellen.`);
    return 1;
  }

  // Der Bot-Index haelt die Pruefsummen. Fehlt er, ist das kein Fehler: Dann
  // gibt es eben nichts zu ergaenzen, und das steht dann auch da.
  const pruefsummen = new Map();
  try {
    const sync = require(path.join(__dirname, '..', 'bot', 'tiktok-video-sync.js'));
    const index = sync.ladeIndex(sync.datenOrdner());
    for (const e of (index.eintraege || [])) {
      if (e.datei && e.sha256) pruefsummen.set(e.datei, e.sha256);
    }
  } catch (fehler) {
    console.warn(`⚠️  Bot-Index nicht lesbar (${fehler.message}) — ohne Pruefsummen`);
    console.warn('   laesst sich nichts ergaenzen. Erst "npm run tiktok:status" pruefen.\n');
  }
  console.log(`Pruefsummen aus dem Bot-Index: ${pruefsummen.size}`);

  const { bestand: neu, bericht } = bestandUmstellen(bestand, pruefsummen,
    { regeln: opt.regeln });

  console.log(`Ergaenzt:        ${bericht.ergaenzt} Eintrag/Eintraege`);
  console.log(`Ohne Pruefsumme: ${bericht.ohnePruefsumme.length} (bleiben unveraendert)`);
  for (const d of bericht.ohnePruefsumme.slice(0, 10)) console.log(`                   ${d}`);
  if (bericht.ohnePruefsumme.length > 10) {
    console.log(`                   … und ${bericht.ohnePruefsumme.length - 10} weitere`);
  }
  if (bericht.doppelteNamen.length) {
    console.log(`⚠️  Doppelte Dateinamen: ${bericht.doppelteNamen.join(', ')}`);
  }

  if (!opt.schreiben) {
    console.log('');
    console.log('Nichts geschrieben — das war eine Vorschau.');
    console.log('Festschreiben mit:  node Marketing/run-local.js --bestand-umstellen --schreiben');
    return 0;
  }

  // Eine Sicherung daneben, bevor etwas ueberschrieben wird. Die Notizen in
  // dieser Datei sind Handarbeit; ein Schreibfehler darf sie nicht kosten.
  const sicherung = `${BESTAND_DATEI}.vorher`;
  try {
    fs.copyFileSync(BESTAND_DATEI, sicherung);
    fs.writeFileSync(BESTAND_DATEI, `${JSON.stringify(neu, null, 2)}\n`, 'utf8');
  } catch (fehler) {
    console.error(`❌ Nicht geschrieben: ${fehler.message}`);
    return 1;
  }
  console.log('');
  console.log(`✅ Umgestellt. Sicherung: ${sicherung}`);
  return 0;
}

async function main() {
  const opt = leseArgumente(process.argv.slice(2));

  if (opt.hilfe) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?|^ \* ?/gm, ''));
    return 0;
  }

  // Punkt 49: Die Umstellung braucht kein Python — sie liest zwei JSON-Dateien.
  // Deshalb VOR der Python-Suche: Sonst scheitert sie auf einem Rechner ohne
  // Python an etwas, das sie gar nicht braucht.
  if (opt.bestandUmstellen) return stelleBestandUm(opt);

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

  meldeStehendeSchnittaufgabe();

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

module.exports = {
  leseArgumente, findePython, laufUmgebung, datenbankKonfiguriert,
  meldeStehendeSchnittaufgabe, BESTAND_FRIST_TAGE, stelleBestandUm,
  BESTAND_DATEI, ladeBestand, bestandEintrag, giltAlsVerarbeitet,
  veraltetDurchRegeln, bestandUmstellen,
};
