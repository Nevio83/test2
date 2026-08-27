#!/usr/bin/env node
/**
 * tiktok-video-sync.js — holt fremdes TikTok-Rohmaterial als Referenz.
 *
 * WOZU ES DAS GIBT
 * Der Marketing-Automat unter Marketing/ rendert EIGENE Videos. Dieses Programm
 * macht etwas anderes: Es sucht zu den Produkten aus der Wurzel-`products.json`
 * fremde TikTok-Videos, laedt sie als ROHMATERIAL herunter und schreibt zu jedem
 * Download auf, woher er kommt. Zweck ist Recherche — anschauen, was in der
 * Kategorie funktioniert. Nichts davon geht in den Shop, nichts davon geht in
 * `products.json`, nichts davon wird veroeffentlicht.
 *
 * WAS ES BEWUSST NICHT TUT
 *   * Es laedt nichts, solange nicht `--laden` dabeisteht. Trockenlauf ist der
 *     Standard — wie `trockenlauf.standard` im Marketing-Automaten. Ein
 *     Programm, das beim ersten Ausprobieren 40 Videos zieht, ist ein Unfall.
 *   * Es erfindet keine Faehigkeiten. Was die installierte yt-dlp-Version bei
 *     TikTok kann, wird zur Laufzeit aus `--list-extractors` GELESEN. Steht die
 *     Stichwortsuche nicht in der Liste, wird sie protokolliert und
 *     uebersprungen, nicht auf gut Glueck versucht.
 *   * Es faelscht nichts. Fehlt yt-dlp, bricht es mit Hinweis ab, statt eine
 *     leere Liste als Erfolg auszugeben.
 *   * Es meldet sich nirgends an und umgeht keine Sperre — kein Login, keine
 *     Cookies, kein Proxy. Ob eine Sperre der ganzen Leitung den Lauf BEENDET,
 *     steuert `bei_sperre_abbrechen` (derzeit: aus, es wird weitergemacht).
 *     Das hebt keine Sperre auf, es erzeugt nur weitere Fehlversuche.
 *
 * RECHTE
 * Jeder Eintrag im Index startet mit `rechte_geprueft: false`. Das Material ist
 * internes Referenzmaterial. Ohne manuelle Rechtepruefung wandert es weder in
 * den Shop noch in eine Veroeffentlichung. Details: TIKTOK-VIDEO-SYNC.md.
 *
 * Aufruf:
 *     npm run tiktok:status              zeigt Vorbedingungen, laedt nichts
 *     npm run tiktok:probe               sucht + bewertet, laedt NICHTS
 *     npm run tiktok:laden -- --max 2    laedt hoechstens 2 Videos
 *     npm run tiktok                  gefuehrt: Produktnummer, Anzahl, fertig
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

// Dieses Programm liegt in bot/, gearbeitet wird aber im Projektwurzelordner:
// dort liegen products.json, .gitignore, Marketing/ und die .env.
const WURZEL = path.join(__dirname, '..');
const MARKETING = path.join(WURZEL, 'Marketing');
// Die Suchkonfiguration liegt beim Programm, nicht bei Marketing/ — sie gehoert
// zu diesem Bot und wird mit ihm zusammen verschoben.
const KONFIG_PFAD = path.join(__dirname, 'tiktok-quellen.json');
const STOP_DATEI = path.join(MARKETING, 'STOP');

// .env einlesen — sonst sind Schluessel, die dort stehen, fuer dieses Programm
// unsichtbar. Genau das ist passiert: Der Suchschluessel lag korrekt in der
// .env, und der Bot meldete trotzdem "kein Suchschluessel gesetzt". Ein Fehler,
// bei dem man den Schluessel verdaechtigt statt das Programm.
// Fester Pfad statt Verlass auf das Arbeitsverzeichnis: Sonst haengt es davon
// ab, aus welchem Ordner der Befehl gestartet wurde.
// Vorhandene Umgebungsvariablen gewinnen (dotenv ueberschreibt nichts).
try { require('dotenv').config({ path: path.join(WURZEL, '.env') }); } catch { /* ohne dotenv laeuft es weiter */ }

// Eingebaute Werte. Ueberschreibbar in dieser Reihenfolge:
// Konfigurationsdatei -> Umgebungsvariable -> Kommandozeile.
const STANDARD = {
  schwelle: 0.5,
  max_downloads: 5,
  max_kandidaten_je_quelle: 20,
  max_anfragen: 60,
  max_dateigroesse: '40M',
  pause_zwischen_anfragen_sek: 3,
  wiederholungen: 2,
  suche_praefix: null,
  // Bei einer Sperre der GANZEN LEITUNG (429, CAPTCHA, Anmeldezwang) aufhoeren?
  // Auf ausdruecklichen Wunsch abgeschaltet: Der Lauf macht dann mit der
  // naechsten Quelle weiter, statt zu enden.
  // Was das NICHT tut: eine Sperre aufheben. Die liegt bei TikTok, nicht hier.
  // Es entstehen lediglich weitere Fehlversuche, und die verlaengern eine
  // Sperre erfahrungsgemaess. Wer Sperren vermeiden will, dreht stattdessen
  // pause_zwischen_anfragen_sek hoch und senkt max_anfragen.
  bei_sperre_abbrechen: false,
};

// ── Ablageort ────────────────────────────────────────────────────────

/**
 * Wohin das Rohmaterial kommt.
 *
 * Respektiert MARKETING_DATA_DIR — dieselbe Variable, mit der der
 * Marketing-Automat seine Zwischenstaende aus dem Projektordner heraus verlegt
 * (Marketing/README.md §9). Wer sie setzt und hier ignoriert, bekaeme Dateien
 * an einer Stelle, an der der Prozess vielleicht gar nicht schreiben darf.
 * Der Unterordner `tiktok-quellen` liegt bewusst NICHT bei Marketing/videos —
 * dort stehen die selbst gerenderten Videos, und der Aufraeum-Ablauf
 * `cleanup_assets` fasst nur die an.
 */
function datenOrdner(env = process.env) {
  const ausEnv = String(env.MARKETING_DATA_DIR || '').trim();
  const basis = ausEnv ? path.resolve(ausEnv) : path.join(MARKETING, 'data');
  return path.join(basis, 'tiktok-quellen');
}

// ── Notaus ───────────────────────────────────────────────────────────

/**
 * Gibt den Grund zurueck, warum nichts laufen darf — oder null.
 *
 * Zwei der drei Wege aus Marketing/README.md §4 gelten auch hier: die Datei
 * Marketing/STOP und MARKETING_ENABLED=false. Der dritte (Dashboard) haengt an
 * der Marketing-Datenbank und betrifft deren Ablaeufe, nicht dieses Programm.
 */
function notausGrund({ stopDatei = STOP_DATEI, env = process.env } = {}) {
  if (String(env.MARKETING_ENABLED || '').trim().toLowerCase() === 'false') {
    return 'MARKETING_ENABLED=false';
  }
  if (fs.existsSync(stopDatei)) {
    return `Notaus-Datei vorhanden: ${stopDatei}`;
  }
  return null;
}

// ── yt-dlp finden ────────────────────────────────────────────────────

/**
 * Sucht einen yt-dlp-Aufruf, der wirklich funktioniert.
 *
 * Nicht geraten, sondern PROBIERT — genau wie `findePython()` in
 * Marketing/run-local.js. Auf Windows liegt yt-dlp mal als eigene .exe im PATH,
 * mal nur als Python-Modul hinter `py`. Wer hier fest `yt-dlp` eintraegt,
 * bekommt im zweiten Fall "nicht gefunden" und sucht an der falschen Stelle.
 * Fester Pfad ueber YTDLP_PATH.
 */
function findeYtdlp(env = process.env) {
  const fest = String(env.YTDLP_PATH || '').trim();
  const kandidaten = fest
    ? [[fest]]
    : (process.platform === 'win32'
      ? [['yt-dlp'], ['yt-dlp.exe'], ['py', '-m', 'yt_dlp'], ['python', '-m', 'yt_dlp']]
      : [['yt-dlp'], ['python3', '-m', 'yt_dlp'], ['python', '-m', 'yt_dlp']]);

  for (const kandidat of kandidaten) {
    try {
      // Bewusst OHNE shell: true — Node warnt ab Version 22 (DEP0190), weil
      // die Argumente dann nur aneinandergehaengt statt maskiert werden.
      const { status, stdout } = spawnSync(kandidat[0], [...kandidat.slice(1), '--version'], {
        encoding: 'utf8',
      });
      if (status === 0) return { aufruf: kandidat, version: String(stdout || '').trim() };
    } catch { /* naechster Kandidat */ }
  }
  return null;
}

/**
 * Baut aus einem gefundenen Aufruf die Funktion, die dieses Programm benutzt.
 *
 * Alles, was yt-dlp startet, laeuft ueber genau diese eine Funktion. Deshalb
 * kommen die Tests ohne Netz und ohne installiertes yt-dlp aus: sie schieben
 * einen Nachbau hinein.
 */
/**
 * Setzt die Ausgabe eines Programms aus den Rohstuecken zusammen.
 *
 * WARUM NICHT EINFACH `text += stueck`: Node reicht die Ausgabe blockweise
 * herein, und die Blockgrenze faellt irgendwohin — auch mitten in ein Zeichen.
 * "ue" ist als UTF-8 zwei Bytes; landet das erste am Blockende und das zweite
 * im naechsten Block, wird jede Haelfte fuer sich gelesen und ergibt
 * Zeichenmuell. Bei einer JSON-Ausgabe von zehntausenden Zeichen ist das kein
 * Sonderfall.
 *
 * Auffallen wuerde es nirgends: Es steht dann nur Unsinn im Untertitel, und
 * Spracherkennung, Kernwort und Bewertung greifen alle daneben — ausgerechnet
 * bei den deutschen Videos, denn nur die haben Umlaute. Erst die Bytes
 * zusammenlegen, dann einmal am Stueck lesen.
 */
function textAusPuffern(stuecke) {
  return Buffer.concat(
    (stuecke || []).map((s) => (Buffer.isBuffer(s) ? s : Buffer.from(String(s), 'utf8'))),
  ).toString('utf8');
}

function macheYtdlpAufruf(aufruf) {
  return (argumente, optionen = {}) => new Promise((fertig) => {
    const kind = spawn(aufruf[0], [...aufruf.slice(1), ...argumente], {
      env: process.env,
      // yt-dlp legt Zwischendateien (*.tmp) im ARBEITSVERZEICHNIS ab — auch
      // beim blossen Abfragen von Metadaten. Steht das im Projektordner und
      // ist der schreibgeschuetzt, scheitert schon das:
      //   ERROR: [Errno 2] No such file or directory: '…\Maios\tmpXXXX.tmp'
      // Deshalb ist der System-Temp-Ordner der Standard, nicht process.cwd().
      // Dort darf jedes Programm schreiben.
      cwd: optionen.cwd || os.tmpdir(),
    });
    const stdout = [];
    const stderr = [];
    kind.stdout.on('data', (d) => stdout.push(d));
    kind.stderr.on('data', (d) => stderr.push(d));
    kind.on('error', (fehler) => fertig({ code: 1, stdout: '', stderr: fehler.message }));
    kind.on('close', (code) => fertig({
      code: code === null ? 1 : code,
      stdout: textAusPuffern(stdout),
      stderr: textAusPuffern(stderr),
    }));
  });
}

/**
 * Was kann diese yt-dlp-Version bei TikTok wirklich?
 *
 * Aus `--list-extractors` GELESEN, nicht angenommen. Die Liste unterscheidet
 * sich zwischen Versionen erheblich, und ein Extractor, den es nicht gibt,
 * scheitert nicht sauber, sondern faellt auf die allgemeine URL-Behandlung
 * zurueck — was dann irgendetwas laedt, nur nicht das Gesuchte.
 */
/**
 * Kann yt-dlp sich als Browser ausgeben — und ist das hier eingerichtet?
 *
 * WARUM DAS ZAEHLT: TikTok beantwortet die Seitenanfrage nur dann brauchbar,
 * wenn die Verbindung wie die eines gewoehnlichen Browsers aussieht. Fehlt das
 * Python-Paket "curl_cffi", scheitert JEDER Abruf mit
 *   "Unexpected response from webpage request"
 * — einer Meldung, die nach einem kaputten Einzelvideo klingt und in kein
 * Sperrmuster passt. yt-dlp weist darauf hin, aber nur als WARNUNG neben dem
 * Fehler, und mit --no-warnings (das der Bot setzt, um die Ausgabe lesbar zu
 * halten) verschwindet sie ganz.
 *
 * Genau daran wurde hier ein ganzer Nachmittag vertan: Die Meldung wurde erst
 * fuer eine Ratenbegrenzung gehalten, dann fuer ein veraltetes yt-dlp. Beides
 * war falsch — und beides liess sich erst ausschliessen, nachdem die neueste
 * Nightly dasselbe tat. Deshalb wird jetzt DIREKT gefragt, statt zu raten.
 *
 * Behoben mit:  py -m pip install curl_cffi
 */
async function impersonationVerfuegbar(ytdlp) {
  const { stdout, stderr } = await ytdlp(['--list-impersonate-targets']);
  const text = String(stdout || '') + String(stderr || '');
  // Eine Kopfzeile steht immer da; entscheidend ist, ob eine Quelle folgt.
  const ziele = text.split(/\r?\n/).filter((z) => /curl_cffi|requests|websockets/i.test(z));
  return { ok: ziele.length > 0, anzahl: ziele.length };
}

async function tiktokFaehigkeiten(ytdlp) {
  const { code, stdout, stderr } = await ytdlp(['--list-extractors']);
  if (code !== 0) {
    return {
      ok: false,
      grund: `--list-extractors endete mit Code ${code}: ${String(stderr || '').trim().slice(0, 200)}`,
      namen: [], kannHashtag: false, kannSuche: false,
    };
  }
  const namen = String(stdout || '')
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z && /tiktok/i.test(z));

  // yt-dlp haengt kaputten Extractors ein "(CURRENTLY BROKEN)" an den Namen.
  // Der Eintrag steht also in der Liste, taugt aber nichts. Wer nur den Namen
  // prueft, haelt eine Faehigkeit fuer vorhanden, die es nicht gibt — und
  // bekommt statt einer klaren Meldung eine Fehlermeldung je Quelle.
  // Genau in diese Falle lief die erste Fassung: tiktok:tag ist derzeit kaputt.
  const defekt = namen.filter((n) => /currently broken/i.test(n));
  const brauchbar = namen.filter((n) => !/currently broken/i.test(n));

  const kannHashtag = brauchbar.some((n) => /tag/i.test(n));
  const kannSuche = brauchbar.some((n) => /search/i.test(n));

  return {
    ok: true,
    grund: null,
    namen,
    defekt,
    // Einzelvideos und Creator-Profile kann jede Version, die TikTok ueberhaupt
    // kennt. Hashtag- und Suchseiten sind eigene Extractors — die stehen nur
    // dann zur Verfuegung, wenn sie da UND nicht als kaputt markiert sind.
    kannHashtag,
    kannSuche,
    hashtagGrund: kannHashtag ? null : (defekt.some((n) => /tag/i.test(n))
      ? `yt-dlp markiert den Hashtag-Extractor selbst als kaputt: ${defekt.find((n) => /tag/i.test(n))}`
      : 'Diese yt-dlp-Version fuehrt keinen TikTok-Hashtag-Extractor.'),
    sucheGrund: kannSuche ? null : (defekt.some((n) => /search/i.test(n))
      ? `yt-dlp markiert den Such-Extractor selbst als kaputt: ${defekt.find((n) => /search/i.test(n))}`
      : 'Diese yt-dlp-Version fuehrt keinen TikTok-Suchextractor.'),
  };
}

// ── Konfiguration ────────────────────────────────────────────────────

function ladeKonfig(pfad = KONFIG_PFAD) {
  let roh = {};
  try {
    roh = JSON.parse(fs.readFileSync(pfad, 'utf8'));
  } catch (fehler) {
    if (fehler.code !== 'ENOENT') {
      // Eine kaputte Konfiguration darf NICHT still auf Standardwerte fallen.
      // Sonst laeuft der Bot mit Schwelle 0.5 statt der eingetragenen 0.8 und
      // sieht dabei voellig normal aus.
      throw new Error(`Konfiguration ${pfad} ist nicht lesbar: ${fehler.message}`);
    }
  }
  return {
    standard: { ...STANDARD, ...(roh.standard || {}) },
    produkte: roh.produkte || {},
  };
}

/**
 * Der Konfigurationseintrag zu einem Produkt.
 *
 * Schluessel sind Zeichenketten (JSON kann nichts anderes), Produkt-IDs sind
 * Zahlen. Verglichen wird numerisch — wie ueberall im Bestandscode
 * (`Number(p.id) === Number(id)`, CLAUDE.md §8).
 */
function konfigZuProdukt(konfig, produktId) {
  for (const [schluessel, wert] of Object.entries(konfig.produkte || {})) {
    if (Number(schluessel) === Number(produktId)) return wert || {};
  }
  return {};
}

// ── Suchbegriffe und Bewertung ───────────────────────────────────────

// Woerter, die in jedem zweiten Produktnamen stehen und darum nichts ueber die
// Zuordnung aussagen. Ohne sie waere "fuer" ein Treffer und der Trefferwert
// eines beliebigen Videos schon deshalb ueber der Schwelle.
const STOPWOERTER = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'oder', 'mit', 'ohne',
  'von', 'vom', 'fuer', 'aus', 'auf', 'ein', 'eine', 'einen', 'einem',
  'zum', 'zur', 'set', 'stk', 'stueck', 'neu', 'inkl',
]);

/**
 * Kleinbuchstaben, Umlaute aufgeloest, alles Uebrige zu Leerzeichen.
 *
 * Die Umlaut-Aufloesung ist der Punkt: TikTok-Titel schreiben "fuer" oder
 * "für" oder "for", und ein Vergleich, der das nicht angleicht, findet
 * "Wasserspender für Schreibtisch" in keinem einzigen Titel wieder.
 */
function normalisiere(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function zerlege(text) {
  return normalisiere(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWOERTER.has(t));
}

/** Die Woerter, an denen ein Video zu diesem Produkt gemessen wird. */
function produktBegriffe(produkt, zusatz = []) {
  const roh = [produkt && produkt.name, produkt && produkt.slug, ...zusatz]
    .filter(Boolean).join(' ');
  return Array.from(new Set(zerlege(roh)));
}

/** Alles, was an einem Kandidaten Text ist — Titel, Beschreibung, Hashtags. */
function videoText(video) {
  const teile = [video.title, video.fulltitle, video.description];
  for (const liste of [video.tags, video.hashtags, video.categories]) {
    if (Array.isArray(liste)) teile.push(liste.join(' '));
  }
  return normalisiere(teile.filter(Boolean).join(' '));
}

/**
 * Trefferwert 0–1: wie viele Produktbegriffe im Videotext vorkommen.
 *
 * Teilstring-Vergleich mit Absicht: Deutsche Komposita zerfallen im TikTok-Text
 * anders als im Produktnamen ("Wasserspender" vs. "wasser spender"), und ein
 * Vergleich auf ganze Woerter wuerde genau die richtigen Treffer verwerfen.
 */
/**
 * Welche Begriffe kommen im Videotext vor?
 *
 * Der Vergleich ist laengenabhaengig, und zwar aus zwei gegenlaeufigen Gruenden:
 *
 *   * LANGE Begriffe (ab 5 Zeichen) duerfen mitten im Wort stehen. TikTok-
 *     Untertitel bestehen aus zusammengeschriebenen Hashtags — "#waterdispenser"
 *     ist EIN Wort, und "dispenser" muss darin gefunden werden.
 *   * KURZE Begriffe muessen ein ganzes Wort sein. Sonst trifft "cat" in
 *     "category" und "eis" in "reise" — und ein Zufallstreffer reicht bei
 *     kleinen Gruppen schon fuer die halbe Punktzahl.
 */
function getroffeneBegriffe(begriffe, video) {
  const text = videoText(video);
  if (!text) return [];
  const tokens = text.split(' ').filter(Boolean);
  return begriffe.filter((begriff) => (
    begriff.length >= 5
      ? text.includes(begriff)
      : tokens.includes(begriff)
  ));
}

function trefferwert(begriffe, video) {
  if (!begriffe.length) return 0;
  return Math.round((getroffeneBegriffe(begriffe, video).length / begriffe.length) * 1000) / 1000;
}

/**
 * Haelt die Zuordnung mehr als einem einzigen Allerweltswort stand?
 *
 * Das Verhaeltnis allein genuegt nicht, und das ist beim ersten echten Lauf
 * sofort aufgefallen: Ein Video ueber eine Kuechenwaage landete bei Produkt 44
 * "Smart Beamer" — Trefferwert 0.5, weil im Text "SmartKitchen" steht und
 * "smart" die Haelfte von zwei Begriffen ist. Bei kurzen Produktnamen reicht
 * ein einzelnes Modewort, um die Schwelle zu reissen.
 *
 * Deshalb zusaetzlich: mindestens ZWEI verschiedene Begriffe muessen treffen.
 * Nur wenn ein Produkt ueberhaupt bloss einen Begriff hat, zaehlt dieser eine.
 */
function belastbar(begriffe, video) {
  const treffer = getroffeneBegriffe(begriffe, video);
  return begriffe.length <= 1 ? treffer.length === 1 : treffer.length >= 2;
}

// ── Index und Prueflíste ─────────────────────────────────────────────

function indexPfad(ordner) { return path.join(ordner, 'index.json'); }
function pruefListePfad(ordner) { return path.join(ordner, 'pruefliste.json'); }

/**
 * Liest den Index. Fehlt er, ist er leer — ist er kaputt, bricht der Lauf ab.
 *
 * Der Unterschied ist wichtig: Ein kaputter Index, der still als leer gilt,
 * laedt beim naechsten Lauf ALLES noch einmal und ueberschreibt dabei die
 * Herkunftsangaben der alten Dateien.
 */
function ladeIndex(ordner) {
  const pfad = indexPfad(ordner);
  let roh;
  try {
    roh = fs.readFileSync(pfad, 'utf8');
  } catch (fehler) {
    if (fehler.code === 'ENOENT') return { version: 1, eintraege: [] };
    throw fehler;
  }
  let gelesen;
  try {
    gelesen = JSON.parse(roh);
  } catch (fehler) {
    throw new Error(`Index ${pfad} ist nicht lesbar: ${fehler.message}`);
  }
  if (!gelesen || !Array.isArray(gelesen.eintraege)) {
    throw new Error(`Index ${pfad} hat kein Feld "eintraege" — bitte pruefen statt loeschen.`);
  }
  return gelesen;
}

function speichereIndex(ordner, index) {
  fs.writeFileSync(indexPfad(ordner), JSON.stringify(index, null, 2) + '\n', 'utf8');
}

/**
 * Liegt derselbe Inhalt schon da — Byte fuer Byte?
 *
 * Adresse und Video-ID reichen nicht: Dasselbe Video wird auf TikTok unter
 * mehreren Konten neu hochgeladen, jedes Mal mit eigener ID und eigenem
 * Untertitel. Es sind verschiedene Videos im Sinne der Adresse und dieselbe
 * Datei im Sinne des Materials. Im Nachweis lagen zwei solche Paare — gefunden
 * erst, als die Pruefsummen verglichen wurden.
 *
 * Geprueft wird zwangslaeufig NACH dem Laden: Vorher gibt es keine Pruefsumme.
 * Die Datei wird dann wieder entfernt.
 */
function schonAlsDateiDa(index, pruefsumme) {
  if (!pruefsumme) return null;
  return (index.eintraege || []).find((e) => e.sha256 === pruefsumme) || null;
}

/**
 * Bereits im Index? Erkannt an Quell-URL ODER Video-ID.
 *
 * Gesucht wird in BEIDEN Listen: in "eintraege" (Datei liegt noch da) und in
 * "frueher_geladen" (Datei ist weg, der Eintrag wurde aufgeraeumt). Ohne die
 * zweite Liste holt --aufraeumen genau das zurueck, was es eben entfernt hat:
 * Die Suche findet dieselben Adressen wieder, und nichts wuesste mehr, dass
 * diese Videos schon einmal hier waren und weggeworfen wurden.
 */
function schonImIndex(index, kandidat) {
  const listen = [].concat(index.eintraege || [], index.frueher_geladen || []);
  return listen.some((e) => (
    (kandidat.url && e.quelle_url === kandidat.url)
    || (kandidat.id && String(e.video_id) === String(kandidat.id))
  ));
}

/**
 * Wo koennte die Datei zu einem Eintrag liegen?
 *
 * Zwei Orte, weil sich der Ablageort verschieben laesst (TIKTOK_VIDEO_DIR) und
 * aeltere Eintraege noch aus der Zeit stammen, als alles im Datenordner lag.
 */
function dateiOrte(eintrag, videoOrdner, datenOrdner) {
  const orte = [];
  if (!eintrag || !eintrag.datei) return orte;
  // ZUERST der Ort, den der Eintrag selbst nennt. Seit die Videos in
  // Produktordnern liegen (rohmaterial/<NN>_<slug>/), findet der blosse
  // Sammelordner sie nicht mehr — und "nicht gefunden" heisst beim Aufraeumen
  // "verwaist". Ohne diese Zeile erklaerte ein einziger Aufruf den gesamten
  // Herkunftsnachweis fuer ungueltig; live passiert, 27 Eintraege auf einmal.
  if (eintrag.ablage) {
    orte.push(path.join(WURZEL, eintrag.ablage, eintrag.datei));
    if (videoOrdner) {
      // Auch relativ zum uebergebenen Ordner, damit Tests und ein verlegter
      // Videoordner (TIKTOK_VIDEO_DIR) weiter funktionieren.
      const zweig = String(eintrag.ablage).replace(/^Marketing\/videos\/?/, '');
      if (zweig) orte.push(path.join(videoOrdner, zweig, eintrag.datei));
    }
  }
  if (videoOrdner) orte.push(path.join(videoOrdner, eintrag.datei));
  if (datenOrdner) orte.push(path.join(datenOrdner, eintrag.datei));
  return orte;
}

/**
 * Eintraege ohne ihre Datei.
 *
 * "Ohne Datei" heisst nicht nur "keine da", sondern auch "eine andere da".
 * Beides ist im Betrieb vorgekommen: Nach einer doppelt vergebenen Nummer lag
 * unter dem Dateinamen ein voellig anderes Video, und der Eintrag beschrieb
 * eines, das es nicht mehr gab. Weil die Datei existierte, hielt das Aufraeumen
 * ihn fuer in Ordnung — und der Nachweis behauptete weiter eine Herkunft, die
 * nicht stimmte. Verglichen wird deshalb die Pruefsumme, wo eine hinterlegt ist.
 */
function verwaisteEintraege(index, videoOrdner, datenOrdner) {
  return (index.eintraege || []).filter((e) => {
    const orte = dateiOrte(e, videoOrdner, datenOrdner);
    const da = orte.find((o) => fs.existsSync(o));
    if (!da) return true;
    if (!e.sha256) return false;          // ohne Pruefsumme bleibt es beim Dasein
    try {
      return sha256(da) !== e.sha256;     // andere Datei unter demselben Namen
    } catch {
      return false;                       // unlesbar ist kein Grund zu loeschen
    }
  });
}

/**
 * Raeumt verwaiste Eintraege aus dem Herkunftsnachweis.
 *
 * WARUM UEBERHAUPT: Der Index beantwortet die Frage "wem gehoert diese Datei
 * und woher stammt sie". Fuer eine geloeschte Datei gibt es darauf keine
 * Antwort mehr — der Eintrag behauptet nur noch Bestand, den es nicht gibt,
 * und faelscht nebenbei die Zahl in "npm run tiktok:status".
 *
 * WARUM NICHT EINFACH LOESCHEN: Der Index ist zugleich das Gedaechtnis, welche
 * Videos schon einmal hier waren. Wer eine Datei wegwirft, will sie meist nicht
 * beim naechsten Lauf zurueckbekommen. Die Eintraege wandern deshalb in eine
 * schmale Liste "frueher_geladen" — ohne Herkunftsangaben, denn es gibt keine
 * Datei mehr, fuer die sie gelten wuerden, aber mit Kennung und Adresse.
 */
function raeumeIndexAuf(index, opt = {}) {
  const verwaist = verwaisteEintraege(index, opt.videoOrdner, opt.datenOrdner);
  if (!verwaist.length) return { entfernt: [], index };
  const weg = new Set(verwaist);
  const frueher = [].concat(index.frueher_geladen || []);
  const bekannt = new Set(frueher.map((e) => String(e.video_id)));
  const jetzt = opt.jetzt || new Date().toISOString();
  for (const e of verwaist) {
    if (bekannt.has(String(e.video_id))) continue;   // schon vermerkt
    bekannt.add(String(e.video_id));
    frueher.push({
      produkt_id: e.produkt_id,
      video_id: e.video_id,
      quelle_url: e.quelle_url,
      datei: e.datei,
      entfernt_am: jetzt,
    });
  }
  return {
    entfernt: verwaist,
    index: {
      ...index,
      eintraege: index.eintraege.filter((e) => !weg.has(e)),
      frueher_geladen: frueher,
    },
  };
}

// ── Kandidaten aufloesen ─────────────────────────────────────────────

// Zwei Sorten Sperre, die auseinandergehalten werden muessen — beim ersten
// echten Lauf gegen TikTok kam prompt die zweite:
//
//   EINZELNES_VERBOTEN — "Your IP address is blocked from accessing this post".
//   Das gilt fuer GENAU DIESES Video (Regionssperre des Uploaders o.ae.), nicht
//   fuer das Konto oder die Leitung. Andere Videos derselben Sitzung laufen
//   weiter einwandfrei. Dieses Video wird uebersprungen und vermerkt.
//   Weiterzumachen ist hier keine Umgehung: Das gesperrte Video wird gerade
//   NICHT geholt. Umgehung waere, es mit anderer Kennung erneut zu versuchen —
//   und genau das passiert nirgends.
//
//   SPERRE — Ratenbegrenzung, CAPTCHA, Anmeldezwang. Das betrifft die ganze
//   Leitung. Hier wird der Lauf beendet, denn jeder weitere Aufruf macht es
//   schlimmer und ist der Anfang einer Umgehung.
const EINZELNES_VERBOTEN = /blocked from accessing this post|not available in your (?:country|region)|geo.?restricted|region.?restricted|video is private|content is not available/i;
const SPERRE = /captcha|too many requests|rate.?limit|http error 429|verify to continue|access denied|login required|sign in to confirm/i;

/**
 * Die Quellen eines Produkts, in der festgelegten Reihenfolge.
 *
 * (a) fest hinterlegte Video-/Creator-URLs, (b) Hashtag-Seiten,
 * (c) Stichwortsuche — Letztere NUR, wenn die installierte yt-dlp-Version einen
 * TikTok-Suchextractor mitbringt UND ein Suchpraefix konfiguriert ist. Ohne
 * beides waere die Such-URL geraten.
 */
function quellenFuer(produkt, eintrag, faehigkeiten, standard) {
  const quellen = [];
  const uebersprungen = [];

  for (const url of (eintrag.videos || [])) quellen.push({ art: 'video', url });
  for (const url of (eintrag.creators || [])) quellen.push({ art: 'creator', url });

  const hashtags = eintrag.hashtags || [];
  if (hashtags.length) {
    if (faehigkeiten.kannHashtag) {
      for (const tag of hashtags) {
        quellen.push({ art: 'hashtag', url: `https://www.tiktok.com/tag/${encodeURIComponent(String(tag).replace(/^#/, ''))}` });
      }
    } else {
      uebersprungen.push({
        art: 'hashtag',
        grund: faehigkeiten.hashtagGrund || 'Diese yt-dlp-Version fuehrt keinen TikTok-Hashtag-Extractor.',
      });
    }
  }

  const stichworte = eintrag.stichworte && eintrag.stichworte.length
    ? eintrag.stichworte
    : [produkt.name];
  const praefix = eintrag.suche_praefix || standard.suche_praefix;
  if (faehigkeiten.kannSuche && praefix) {
    for (const wort of stichworte) {
      quellen.push({ art: 'suche', url: `${praefix}${wort}` });
    }
  } else {
    uebersprungen.push({
      art: 'suche',
      grund: faehigkeiten.kannSuche
        ? 'Suchextractor vorhanden, aber kein "suche_praefix" konfiguriert — Such-URL wird nicht geraten.'
        : (faehigkeiten.sucheGrund || 'Diese yt-dlp-Version fuehrt keinen TikTok-Suchextractor.'),
    });
  }

  return { quellen, uebersprungen };
}

/** Metadaten einer Quelle holen — ausdruecklich OHNE Download. */
async function holeKandidaten(ytdlp, quelle, standard) {
  const { code, stdout, stderr } = await ytdlp([
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--playlist-end', String(standard.max_kandidaten_je_quelle),
    '--sleep-requests', String(standard.pause_zwischen_anfragen_sek),
    '--retries', String(standard.wiederholungen),
    quelle.url,
  ]);

  const meldung = String(stderr || '').trim();
  if (SPERRE.test(meldung) && !EINZELNES_VERBOTEN.test(meldung)) {
    return { gesperrt: true, meldung: meldung.slice(0, 300), kandidaten: [] };
  }

  const kandidaten = [];
  for (const zeile of String(stdout || '').split(/\r?\n/)) {
    const geputzt = zeile.trim();
    if (!geputzt.startsWith('{')) continue;
    try {
      const roh = JSON.parse(geputzt);
      kandidaten.push({
        id: roh.id != null ? String(roh.id) : null,
        url: roh.webpage_url || roh.url || null,
        title: roh.title || '',
        description: roh.description || '',
        uploader: roh.uploader || roh.uploader_id || roh.channel || '',
        tags: roh.tags,
        categories: roh.categories,
      });
    } catch { /* keine JSON-Zeile — yt-dlp mischt Hinweise dazwischen */ }
  }

  return {
    gesperrt: false,
    fehler: code !== 0 && !kandidaten.length ? (meldung.slice(0, 300) || `Code ${code}`) : null,
    kandidaten: kandidaten.filter((k) => k.url),
  };
}

// ── Fund: einzelne URLs pruefen und einsortieren ─────────────────────

/**
 * Metadaten zu EINER URL holen. Kein Download, keine Playlist.
 *
 * Warum es diesen Weg zusaetzlich zu holeKandidaten() gibt: Diese
 * yt-dlp-Version bringt fuer TikTok keinen Suchextractor mit, und der
 * Hashtag-Extractor ist als kaputt markiert. Gefunden wird deshalb ausserhalb
 * — ueber eine gewoehnliche Websuche — und was dabei herauskommt, ist eine
 * Liste einzelner Adressen. Die muessen geprueft werden, bevor sie in die
 * Konfiguration wandern: Eine URL, die niemand aufgerufen hat, ist eine
 * Behauptung.
 */
async function holeEinzelMeta(ytdlp, url) {
  const { code, stdout, stderr } = await ytdlp([
    '--dump-json', '--no-playlist', '--no-warnings', url,
  ]);
  const meldung = String(stderr || '').trim();
  if (EINZELNES_VERBOTEN.test(meldung)) {
    return { gesperrt: false, fehler: `dieses Video ist gesperrt: ${meldung.slice(0, 160)}` };
  }
  if (SPERRE.test(meldung)) return { gesperrt: true, meldung: meldung.slice(0, 300) };

  const zeile = String(stdout || '').split(/\r?\n/).find((z) => z.trim().startsWith('{'));
  if (!zeile) {
    return { gesperrt: false, fehler: meldung.slice(0, 200) || `yt-dlp endete mit Code ${code}` };
  }
  const roh = JSON.parse(zeile);
  return {
    gesperrt: false,
    fehler: null,
    video: {
      id: roh.id != null ? String(roh.id) : null,
      url: roh.webpage_url || url,
      title: roh.title || '',
      description: roh.description || '',
      uploader: roh.uploader || roh.uploader_id || '',
      tags: roh.tags,
      dauer: roh.duration,
      // Der Ton entscheidet, ob jemand spricht — siehe istMusik().
      track: roh.track || '',
      artist: roh.artist || '',
    },
  };
}

/**
 * Ordnet gefundene URLs dem am besten passenden Produkt zu.
 *
 * Bewusst gegen ALLE Produkte gemessen, nicht gegen ein vorgegebenes: Wer eine
 * Handvoll URLs aus einer Suche hat, weiss oft selbst nicht mehr, zu welchem
 * Produkt welche gehoerte. Das Ergebnis ist nachpruefbar — der Trefferwert
 * steht daneben, und unter der Schwelle wird nichts einsortiert.
 */
async function finde(opt) {
  const melde = opt.melde || console.log;
  const schwelle = opt.schwelle != null ? opt.schwelle : STANDARD.schwelle;
  const ergebnis = { treffer: [], daneben: [], abgebrochen: false, grund: null };

  const notaus = notausGrund({ stopDatei: opt.stopDatei, env: opt.env });
  if (notaus) {
    ergebnis.abgebrochen = true;
    ergebnis.grund = notaus;
    melde(`⏹  Notaus aktiv — es wird nichts abgefragt. Grund: ${notaus}`);
    return ergebnis;
  }

  // Begriffe je Produkt einmal bilden, inklusive der Stichworte aus der
  // Konfiguration.
  const begriffeJeProdukt = opt.produkte.map((p) => ({
    produkt: p,
    begriffe: produktBegriffe(p, (konfigZuProdukt(opt.konfig, p.id).stichworte) || []),
  }));

  for (const url of opt.urls) {
    const antwort = await holeEinzelMeta(opt.ytdlp, url);
    if (antwort.gesperrt) {
      melde(`❌ TikTok blockt (${url}): ${antwort.meldung}`);
      if (opt.beiSperreAbbrechen !== false) {
        melde('   Der Lauf endet hier.');
        ergebnis.abgebrochen = true;
        ergebnis.grund = 'TikTok hat die Anfrage blockiert';
        return ergebnis;
      }
      melde('   Abbruch bei Sperre ist abgeschaltet — weiter mit der naechsten Adresse.');
      ergebnis.daneben.push({ url, grund: `gesperrt: ${antwort.meldung}` });
      continue;
    }
    if (antwort.fehler) {
      melde(`⚠️  ${url}: ${antwort.fehler}`);
      ergebnis.daneben.push({ url, grund: antwort.fehler });
      continue;
    }

    // Belastbare Zuordnungen gewinnen IMMER gegen unbelastbare, auch wenn eine
    // unbelastbare den hoeheren Wert hat. Sonst schnappt ein Zwei-Wort-Produkt
    // wie "Smart Beamer" mit einem einzigen Modewort das Video weg.
    let bestes = null;
    for (const { produkt, begriffe } of begriffeJeProdukt) {
      const wert = trefferwert(begriffe, antwort.video);
      const haelt = belastbar(begriffe, antwort.video);
      const kandidat = { produkt, begriffe, wert, haelt };
      if (!bestes
        || (haelt && !bestes.haelt)
        || (haelt === bestes.haelt && wert > bestes.wert)) bestes = kandidat;
    }

    const zeile = {
      url: antwort.video.url,
      video_id: antwort.video.id,
      creator: antwort.video.uploader,
      titel: antwort.video.title,
      produkt_id: bestes.produkt.id,
      produkt_name: bestes.produkt.name,
      trefferwert: bestes.wert,
    };

    if (bestes.wert >= schwelle && bestes.haelt) {
      ergebnis.treffer.push(zeile);
      melde(`✅ ${bestes.wert}  → ${bestes.produkt.id} ${bestes.produkt.name}`);
      melde(`      ${antwort.video.uploader}: ${String(antwort.video.title).slice(0, 70)}`);
    } else {
      zeile.grund = bestes.haelt
        ? `bester Treffer nur ${bestes.wert} (Schwelle ${schwelle}): ${bestes.produkt.name}`
        : `bester Treffer "${bestes.produkt.name}" haengt an einem einzigen Begriff (${getroffeneBegriffe(bestes.begriffe, antwort.video).join(', ')})`;
      ergebnis.daneben.push(zeile);
      melde(`↩︎  ${bestes.wert}  ${String(antwort.video.title).slice(0, 55)} — ${bestes.haelt ? 'unter der Schwelle' : 'nur ein Begriff'}`);
    }
  }

  return ergebnis;
}

/**
 * Traegt die Treffer in tiktok-quellen.json ein.
 *
 * Liest die Datei ROH und aendert nur `produkte` — die Kommentarschluessel
 * (`_hinweis`, `_rechte`, …) erklaeren die Datei und muessen ueberleben. Wer
 * hier ladeKonfig() nimmt, schreibt sie beim ersten Fund weg.
 */
function schreibeFund(konfigPfad, treffer) {
  const roh = JSON.parse(fs.readFileSync(konfigPfad, 'utf8'));
  roh.produkte = roh.produkte || {};
  let neu = 0;

  for (const t of treffer) {
    const schluessel = Object.keys(roh.produkte).find((k) => Number(k) === Number(t.produkt_id))
      || String(t.produkt_id);
    if (!roh.produkte[schluessel]) roh.produkte[schluessel] = {};
    const eintrag = roh.produkte[schluessel];
    eintrag.videos = eintrag.videos || [];
    if (!eintrag.videos.includes(t.url)) { eintrag.videos.push(t.url); neu++; }
  }

  fs.writeFileSync(konfigPfad, JSON.stringify(roh, null, 2) + '\n', 'utf8');
  return neu;
}

// ── Herunterladen ────────────────────────────────────────────────────

function sauberer(text) {
  return String(text || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'unbekannt';
}

function sha256(pfad) {
  return crypto.createHash('sha256').update(fs.readFileSync(pfad)).digest('hex');
}

/**
 * Laedt genau EIN Video.
 *
 * `--no-playlist` verhindert, dass aus einer Video-URL mit Playlist-Anhang das
 * halbe Profil wird. `--max-filesize` ist die Bremse gegen einzelne
 * Riesendateien — greift sie, endet yt-dlp mit Code 0 und schreibt trotzdem
 * keine Datei. Genau deshalb wird hinterher geprueft, ob eine Datei da ist,
 * statt dem Rueckgabewert zu glauben.
 */
async function ladeVideo(ytdlp, ordner, produkt, kandidat, standard, zielDatei) {
  const stamm = `${produkt.id}_${sauberer(kandidat.id || kandidat.url)}`;

  // ZWISCHENLAGER STATT DIREKT INS ZIEL.
  // yt-dlp scheiterte auf dem echten Rechner reihenweise mit
  //   "Cannot write video metadata to JSON file …/Marketing/data/tiktok-quellen/…"
  // und einmal mit "[Errno 2] … Maios\tmpXXXX.tmp" — also schon an der
  // Zwischendatei im Projektwurzelverzeichnis. Der Ordner existierte, Node
  // konnte hineinschreiben, nur Python nicht: typisch fuer Windows-Ordnerschutz
  // ("Ueberwachter Ordnerzugriff" auf Dokumente) oder einen Virenscanner, der
  // fremde Programme aussperrt.
  // Deshalb laedt yt-dlp in den System-Temp-Ordner — dort darf es immer — und
  // Node verschiebt anschliessend. Node schreibt nachweislich ins Projekt.
  const zwischen = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-sync-'));

  let ergebnis;
  try {
    const { code, stderr } = await ytdlp([
      '--no-playlist',
      '--no-warnings',
      '--max-filesize', String(standard.max_dateigroesse),
      '--write-info-json',
      '--sleep-requests', String(standard.pause_zwischen_anfragen_sek),
      '--retries', String(standard.wiederholungen),
      '-o', path.join(zwischen, `${stamm}.%(ext)s`),
      kandidat.url,
    ], { cwd: zwischen });        // auch die *.tmp-Dateien landen dort

    const meldung = String(stderr || '').trim();
    if (EINZELNES_VERBOTEN.test(meldung)) {
      return { gesperrt: false, fehler: `dieses Video ist gesperrt: ${meldung.slice(0, 160)}` };
    }
    if (SPERRE.test(meldung)) return { gesperrt: true, meldung: meldung.slice(0, 300) };

    const datei = fs.readdirSync(zwischen).find((n) => (
      n.startsWith(stamm + '.') && !n.endsWith('.info.json')
    ));
    if (!datei) {
      return {
        gesperrt: false,
        fehler: code !== 0
          ? `yt-dlp endete mit Code ${code}: ${meldung.slice(0, 200)}`
          : `keine Datei entstanden — vermutlich groesser als ${standard.max_dateigroesse}`,
      };
    }

    // Wenn ein festes Ziel vorgegeben ist, geht das Video DIREKT dorthin —
    // vom Zwischenlager aus, in EINEM Schritt. Der frueher uebliche Umweg
    // (Zwischenlager -> Datenordner -> Videoordner) scheiterte auf diesem
    // Rechner reproduzierbar am zweiten Sprung, waehrend derselbe Kopiervorgang
    // eigenstaendig aufgerufen einwandfrei lief. Ein Sprung weniger ist nicht
    // nur robuster, sondern auch die einfachere Erklaerung.
    if (zielDatei) {
      try {
        fs.mkdirSync(path.dirname(zielDatei), { recursive: true });
        fs.copyFileSync(path.join(zwischen, datei), zielDatei);
      } catch (fehler) {
        // Nicht abstuerzen: Das Video ist geladen, nur das Ablegen scheitert.
        return {
          gesperrt: false,
          schreibsperre: true,
          fehler: `konnte das Video nicht nach ${path.dirname(zielDatei)} legen `
            + `(${fehler.code || fehler.message}). Geladen ist es — nur das Ablegen scheitert. `
            + 'Ausweg: TIKTOK_VIDEO_DIR in der .env auf einen Ordner ausserhalb von "Dokumente" setzen.',
        };
      }
      // Die Metadaten bleiben beim Nachweis.
      const infoQuelle = path.join(zwischen, datei.replace(/\.[^.]+$/, '') + '.info.json');
      const infoZiel = path.join(ordner, path.basename(zielDatei).replace(/\.[^.]+$/, '') + '.info.json');
      try {
        if (fs.existsSync(infoQuelle)) {
          fs.mkdirSync(ordner, { recursive: true });
          fs.copyFileSync(infoQuelle, infoZiel);
        }
      } catch { /* Metadaten sind nice-to-have, kein Grund zum Abbruch */ }
      return {
        gesperrt: false, fehler: null,
        datei: path.basename(zielDatei),
        groesse: fs.statSync(zielDatei).size,
        sha256: sha256(zielDatei),
      };
    }

    // Video und Metadaten ins Ziel holen.
    // Scheitert das, liegt es NICHT am Download — der ist gelaufen. Dann darf
    // dieses Programm nicht in den Zielordner schreiben. Eine rohe
    // ENOENT-Meldung liesse den ganzen Lauf abstuerzen und waere fuer
    // niemanden lesbar; deshalb hier abfangen und sagen, was zu tun ist.
    try {
      fs.mkdirSync(ordner, { recursive: true });
      for (const name of fs.readdirSync(zwischen)) {
        if (!name.startsWith(stamm + '.')) continue;
        fs.copyFileSync(path.join(zwischen, name), path.join(ordner, name));
      }
    } catch (fehler) {
      return {
        gesperrt: false,
        schreibsperre: true,
        fehler: `konnte nicht nach ${ordner} schreiben (${fehler.code || fehler.message}). `
          + 'Das Video wurde geladen, nur das Ablegen scheitert — der Ordner ist fuer '
          + 'dieses Programm gesperrt (Windows "Ueberwachter Ordnerzugriff" oder Virenscanner).',
      };
    }

    const voll = path.join(ordner, datei);
    ergebnis = { gesperrt: false, fehler: null, datei, groesse: fs.statSync(voll).size, sha256: sha256(voll) };
  } finally {
    // Zwischenlager immer aufraeumen, auch wenn oben etwas schiefging.
    try { fs.rmSync(zwischen, { recursive: true, force: true }); } catch { /* egal */ }
  }
  return ergebnis;
}

// ── Der Lauf ─────────────────────────────────────────────────────────

/**
 * Ein kompletter Durchgang.
 *
 * Alles Aeussere kommt herein: yt-dlp, Produktliste, Konfiguration, Zielordner,
 * Notaus-Datei. Nur so laesst sich der Ablauf pruefen, ohne Netz und ohne
 * installiertes yt-dlp.
 */
async function lauf(opt) {
  const melde = opt.melde || console.log;
  const ordner = opt.ordner;
  const standard = { ...STANDARD, ...(opt.standard || {}) };
  const schwelle = opt.schwelle != null ? opt.schwelle : standard.schwelle;
  const maxDownloads = opt.max != null ? opt.max : standard.max_downloads;
  const laden = opt.laden === true;
  const jetzt = opt.jetzt || (() => new Date().toISOString());

  const ergebnis = {
    abgebrochen: false, grund: null,
    geladen: [], pruefliste: [], uebersprungen: [], anfragen: 0,
  };

  const notaus = notausGrund({ stopDatei: opt.stopDatei, env: opt.env });
  if (notaus) {
    ergebnis.abgebrochen = true;
    ergebnis.grund = notaus;
    melde(`⏹  Notaus aktiv — es wird nichts geladen. Grund: ${notaus}`);
    return ergebnis;
  }

  // Gleich hier klaeren, ob ueberhaupt geschrieben werden darf. Vorher stuerzte
  // der Lauf an dieser Stelle mit einer rohen Systemmeldung ab — und zwar
  // NACHDEM schon Anfragen an TikTok rausgegangen waren.
  try {
    fs.mkdirSync(ordner, { recursive: true });
  } catch (fehler) {
    ergebnis.abgebrochen = true;
    ergebnis.grund = `Ablageordner nicht anlegbar: ${ordner} (${fehler.code || fehler.message})`;
    melde(`❌ ${ergebnis.grund}`);
    melde('   Der Ordner ist fuer dieses Programm gesperrt (Windows "Ueberwachter');
    melde('   Ordnerzugriff" oder Virenscanner) — oder der Pfad ist unbrauchbar.');
    melde('   Ausweg: MARKETING_DATA_DIR auf einen Ordner ausserhalb von "Dokumente" setzen.');
    return ergebnis;
  }
  const index = ladeIndex(ordner);

  const faehigkeiten = await tiktokFaehigkeiten(opt.ytdlp);
  ergebnis.anfragen++;
  if (!faehigkeiten.ok) {
    ergebnis.abgebrochen = true;
    ergebnis.grund = faehigkeiten.grund;
    melde(`❌ yt-dlp liess sich nicht abfragen: ${faehigkeiten.grund}`);
    return ergebnis;
  }
  melde(`ℹ️  TikTok-Extractors dieser yt-dlp-Version: ${faehigkeiten.namen.join(', ') || '(keine)'}`);
  melde(`   Hashtag-Seiten: ${faehigkeiten.kannHashtag ? 'ja' : 'nein'} · Stichwortsuche: ${faehigkeiten.kannSuche ? 'ja' : 'nein'}`);
  melde(laden
    ? `▶ Ladelauf — hoechstens ${maxDownloads} Videos, Schwelle ${schwelle}.`
    : `▶ Trockenlauf — es wird gesucht und bewertet, aber NICHTS geladen (Schwelle ${schwelle}).`);

  let gesperrt = false;

  for (const produkt of opt.produkte) {
    if (gesperrt) break;
    if (laden && ergebnis.geladen.length >= maxDownloads) break;

    const eintrag = konfigZuProdukt(opt.konfig, produkt.id);
    const begriffe = produktBegriffe(produkt, eintrag.stichworte || []);
    const { quellen, uebersprungen } = quellenFuer(produkt, eintrag, faehigkeiten, standard);

    for (const u of uebersprungen) {
      ergebnis.uebersprungen.push({ produkt_id: produkt.id, ...u });
    }
    if (!quellen.length) {
      melde(`⚠️  ${produkt.id} ${produkt.name}: keine nutzbare Quelle — kein Eintrag in tiktok-quellen.json und kein Suchextractor.`);
      continue;
    }

    const kandidaten = [];
    for (const quelle of quellen) {
      if (ergebnis.anfragen >= standard.max_anfragen) {
        melde(`⚠️  Anfrage-Obergrenze (${standard.max_anfragen}) erreicht — Lauf endet hier.`);
        gesperrt = true;
        break;
      }
      ergebnis.anfragen++;
      const antwort = await holeKandidaten(opt.ytdlp, quelle, standard);
      if (antwort.gesperrt) {
        melde(`❌ TikTok blockt (${quelle.url}): ${antwort.meldung}`);
        if (standard.bei_sperre_abbrechen !== false) {
          melde('   Der Lauf endet hier.');
          ergebnis.abgebrochen = true;
          ergebnis.grund = 'TikTok hat die Anfrage blockiert';
          gesperrt = true;
          break;
        }
        melde('   Abbruch bei Sperre ist abgeschaltet — weiter mit der naechsten Quelle.');
        ergebnis.uebersprungen.push({ produkt_id: produkt.id, art: quelle.art,
          grund: `gesperrt: ${antwort.meldung}` });
        continue;
      }
      if (antwort.fehler) {
        melde(`⚠️  ${quelle.art} ${quelle.url}: ${antwort.fehler}`);
        ergebnis.uebersprungen.push({ produkt_id: produkt.id, art: quelle.art, grund: antwort.fehler });
        continue;
      }
      kandidaten.push(...antwort.kandidaten);
    }
    if (gesperrt) break;

    // Doppelte aus mehreren Quellen zusammenfassen, dann nach Trefferwert.
    const gesehen = new Set();
    const bewertet = [];
    for (const kandidat of kandidaten) {
      if (gesehen.has(kandidat.url)) continue;
      gesehen.add(kandidat.url);
      bewertet.push({ ...kandidat, wert: trefferwert(begriffe, kandidat) });
    }
    bewertet.sort((a, b) => b.wert - a.wert);

    for (const kandidat of bewertet) {
      if (schonImIndex(index, kandidat)) {
        ergebnis.uebersprungen.push({
          produkt_id: produkt.id, art: 'bereits_geladen',
          quelle_url: kandidat.url, grund: 'steht schon im Index',
        });
        continue;
      }

      const haelt = belastbar(begriffe, kandidat);
      if (kandidat.wert < schwelle || !haelt) {
        // Unter der Schwelle wird NICHT geladen. Eine stille Fehlzuordnung ist
        // schlimmer als gar keine — sie sieht im Ordner aus wie ein Treffer.
        ergebnis.pruefliste.push({
          produkt_id: produkt.id, produkt_name: produkt.name,
          video_id: kandidat.id, quelle_url: kandidat.url,
          creator: kandidat.uploader, titel: kandidat.title,
          trefferwert: kandidat.wert,
          grund: kandidat.wert < schwelle
            ? `Trefferwert ${kandidat.wert} unter Schwelle ${schwelle}`
            : `nur ein Begriff getroffen (${getroffeneBegriffe(begriffe, kandidat).join(', ')}) — zu wenig fuer eine Zuordnung`,
        });
        continue;
      }

      if (!laden) {
        ergebnis.pruefliste.push({
          produkt_id: produkt.id, produkt_name: produkt.name,
          video_id: kandidat.id, quelle_url: kandidat.url,
          creator: kandidat.uploader, titel: kandidat.title,
          trefferwert: kandidat.wert,
          grund: 'Trockenlauf — wuerde geladen werden (mit --laden)',
        });
        continue;
      }

      if (ergebnis.geladen.length >= maxDownloads) break;

      ergebnis.anfragen++;
      const geladen = await ladeVideo(opt.ytdlp, ordner, produkt, kandidat, standard);
      if (geladen.gesperrt) {
        melde(`❌ TikTok blockt beim Laden (${kandidat.url}): ${geladen.meldung}`);
        if (standard.bei_sperre_abbrechen !== false) {
          melde('   Der Lauf endet hier.');
          ergebnis.abgebrochen = true;
          ergebnis.grund = 'TikTok hat den Download blockiert';
          gesperrt = true;
          break;
        }
        melde('   Abbruch bei Sperre ist abgeschaltet — weiter mit dem naechsten Video.');
        ergebnis.pruefliste.push({
          produkt_id: produkt.id, produkt_name: produkt.name,
          video_id: kandidat.id, quelle_url: kandidat.url,
          creator: kandidat.uploader, titel: kandidat.title,
          trefferwert: kandidat.wert, grund: `gesperrt: ${geladen.meldung}`,
        });
        continue;
      }
      if (geladen.fehler) {
        melde(`⚠️  ${kandidat.url}: ${geladen.fehler}`);
        ergebnis.pruefliste.push({
          produkt_id: produkt.id, produkt_name: produkt.name,
          video_id: kandidat.id, quelle_url: kandidat.url,
          creator: kandidat.uploader, titel: kandidat.title,
          trefferwert: kandidat.wert, grund: geladen.fehler,
        });
        continue;
      }

      const neu = {
        produkt_id: produkt.id,
        produkt_name: produkt.name,
        video_id: kandidat.id,
        quelle_url: kandidat.url,
        creator: kandidat.uploader,
        titel: kandidat.title,
        zeitstempel: jetzt(),
        datei: geladen.datei,
        groesse_bytes: geladen.groesse,
        sha256: geladen.sha256,
        trefferwert: kandidat.wert,
        // Startet IMMER auf false. Ohne Rechtepruefung von Hand geht das
        // Material weder in den Shop noch in eine Veroeffentlichung.
        rechte_geprueft: false,
      };
      index.eintraege.push(neu);
      // Nach jedem Download schreiben: ein Abbruch mittendrin darf die
      // Herkunft der schon geladenen Dateien nicht verlieren.
      speichereIndex(ordner, index);
      ergebnis.geladen.push(neu);
      melde(`✅ ${produkt.id} ${produkt.name} ← ${geladen.datei} (Trefferwert ${kandidat.wert})`);
    }
  }

  fs.writeFileSync(pruefListePfad(ordner), JSON.stringify({
    erzeugt: jetzt(),
    schwelle,
    trockenlauf: !laden,
    eintraege: ergebnis.pruefliste,
    uebersprungen: ergebnis.uebersprungen,
  }, null, 2) + '\n', 'utf8');

  melde('');
  melde(`— geladen: ${ergebnis.geladen.length} · Prueflíste: ${ergebnis.pruefliste.length} · uebersprungen: ${ergebnis.uebersprungen.length} · yt-dlp-Aufrufe: ${ergebnis.anfragen}`);
  melde(`   Index:      ${indexPfad(ordner)}`);
  melde(`   Prueflíste: ${pruefListePfad(ordner)}`);
  if (!laden) melde('   Nichts geladen — das war ein Trockenlauf. Mit --laden wird geladen.');

  return ergebnis;
}

// ── Suche ueber eine Such-API ────────────────────────────────────────

/** Nur echte Videoseiten sind brauchbar — /discover/ und /tag/ sind Themenseiten. */
const TIKTOK_VIDEO_MUSTER = /^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i;

/**
 * Sucht TikTok-Videoadressen ueber eine Suchmaschinen-API.
 *
 * WARUM UEBER EINEN UMWEG: yt-dlp hat fuer TikTok keinen Suchextractor. Die
 * Videoseiten sind aber oeffentlich und werden von Suchmaschinen erfasst — also
 * wird dort gesucht und nur die gefundene Adresse an yt-dlp gereicht.
 *
 * Der Schluessel kommt aus der Umgebung, nie aus dem Code. Fehlt er, wird das
 * gesagt und auf die Adressen aus der Konfiguration zurueckgefallen — nicht
 * geraten und nicht stillschweigend nichts getan.
 */
/**
 * Zieht Videoadressen aus dem Text einer Seite.
 *
 * WOZU — gemessen an sechs echten Anfragen: Von 94 Treffern waren ganze SECHS
 * Videoadressen. 53 davon waren "/discover/"-Seiten, TikToks eigene
 * Themenseiten, und 33 Shop-Seiten. Die Suche findet also fast nur Seiten UEBER
 * das Thema, kaum einzelne Videos — deshalb blieb die Ausbeute bei rund zwei
 * Adressen je Anfrage haengen.
 *
 * Auf genau diesen Themenseiten stehen aber die Videos, nach denen gesucht
 * wird. Die Such-API liefert den Seitentext auf Wunsch gleich mit
 * (include_raw_content), sie hat die Seite ohnehin abgerufen. Gemessen an
 * denselben vier Begriffen: 0 Adressen aus den Treffern, 114 aus dem
 * Seitentext.
 *
 * WARUM NICHT DIE SEITE SELBST ABRUFEN: ausprobiert — TikTok antwortet einem
 * eigenen Abruf mit einer Pruefseite und null Videoadressen. Das zu umgehen
 * verbietet die Aufgabenstellung ausdruecklich, und es waere ohnehin
 * aussichtslos.
 */
function adressenAusText(text) {
  const gefunden = String(text || '').match(
    /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d{15,25}/gi,
  ) || [];
  // Ohne Anhaengsel: dieselbe Adresse taucht mit "?lang=ur", "?is_from_webapp"
  // und aehnlichem mehrfach auf und waere sonst mehrfach in der Warteschlange.
  return gefunden.map((u) => u.split('?')[0]);
}

async function sucheAdressen(opt) {
  const env = opt.env || process.env;
  const anzahl = Math.min(20, Math.max(1, opt.anzahl || 20));
  const holen = opt.holen || globalThis.fetch;

  // Zwei Anbieter, weil sich die Bedingungen aendern: Brave hat 2026 seinen
  // Gratis-Tarif abgeschafft und verlangt eine Kreditkarte, Tavily nicht.
  // Genommen wird, wofuer ein Schluessel da ist — Tavily zuerst, weil es ohne
  // Karte auskommt. Kein Schluessel heisst: sagen was fehlt, nichts raten.
  const tavily = String(env.TAVILY_API_KEY || '').trim();
  const brave = String(env.BRAVE_API_KEY || env.TIKTOK_SUCHE_API_KEY || '').trim();
  if (!tavily && !brave) {
    return { ok: false, grund: 'kein Suchschluessel gesetzt (TAVILY_API_KEY oder BRAVE_API_KEY)', adressen: [] };
  }

  const anbieter = tavily ? 'Tavily' : 'Brave';
  try {
    let roh = [];
    if (tavily) {
      const antwort = await holen('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tavily}` },
        // Der Schluessel steht zusaetzlich im Rumpf: aeltere Tavily-Fassungen
        // erwarten ihn dort, neuere im Kopf. Beides zu schicken schadet nicht.
        body: JSON.stringify({
          api_key: tavily,
          query: opt.begriff,
          max_results: anzahl,
          include_domains: ['tiktok.com'],
          // Der Seitentext ist hier die eigentliche Fundgrube — siehe
          // adressenAusText(). Es bleibt EINE Anfrage je Begriff.
          include_raw_content: true,
        }),
      });
      if (!antwort.ok) return { ok: false, grund: `${anbieter} antwortete mit ${antwort.status}`, adressen: [] };
      const daten = await antwort.json();
      const treffer = (daten && daten.results) || [];
      // REIHENFOLGE: erst die Trefferadressen, dann die aus dem Seitentext.
      // Das ist keine Kosmetik. Die Trefferadressen sind von der Suchmaschine
      // SORTIERT, die aus dem Seitentext stehen in der Reihenfolge, in der sie
      // zufaellig auf der Seite vorkommen. Seit eine einzige Anfrage ueber 200
      // Adressen liefert und die Obergrenze bei 60 Abrufen liegt, entscheidet
      // die Reihenfolge darueber, WELCHE 60 geprueft werden. Die Sortierte
      // zuerst — sonst waere die Masse ein Rueckschritt gegenueber den wenigen
      // gut sortierten von vorher.
      roh = treffer.map((r) => r && r.url).filter(Boolean);
      for (const r of treffer) roh = roh.concat(adressenAusText(r && r.raw_content));
    } else {
      const adresse = 'https://api.search.brave.com/res/v1/web/search'
        + '?q=' + encodeURIComponent(opt.begriff) + '&count=' + anzahl;
      const antwort = await holen(adresse, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': brave },
      });
      if (!antwort.ok) return { ok: false, grund: `${anbieter} antwortete mit ${antwort.status}`, adressen: [] };
      const daten = await antwort.json();
      roh = ((daten.web && daten.web.results) || []).map((r) => r && r.url).filter(Boolean);
    }
    return {
      ok: true, grund: null, anbieter,
      adressen: Array.from(new Set(roh.filter((u) => TIKTOK_VIDEO_MUSTER.test(u)))),
    };
  } catch (fehler) {
    return { ok: false, grund: `${anbieter} nicht erreichbar: ${fehler.message}`, adressen: [] };
  }
}

/**
 * Spricht in diesem Video jemand?
 *
 * Hoeren kann das Programm nicht — TikTok verraet es aber in den Metadaten: Wer
 * mit eigener Stimme aufnimmt, bekommt "original sound" als Tonspur. Ein
 * lizenzierter Musiktitel heisst, dass die Tonspur dieser Titel IST.
 * Kein Beweis, aber das belastbarste Signal, das ohne Zuhoeren zu haben ist.
 */
/**
 * Alle Begriffsgruppen eines Produkts — zum Pruefen, ob ein Video wirklich
 * dazugehoert.
 *
 * WARUM GRUPPEN: Ein Video ist entweder deutsch oder englisch beschriftet, nie
 * beides. Wuerden alle Woerter in einen Topf wandern, saenke der Anteil
 * zwangslaeufig unter jede Schwelle. Jede Gruppe wird deshalb fuer sich
 * gemessen, es zaehlt die beste — Produktname und jeder Suchbegriff beider
 * Sprachen sind je eine Gruppe.
 *
 * Das fuehrende "tiktok" fliegt raus: Es steht in jedem Suchbegriff und sagt
 * ueber die Zugehoerigkeit nichts aus.
 */
function begriffsGruppen(produkt, eintrag) {
  const gruppen = [];
  const ausNamen = produktBegriffe(produkt).filter((w) => !GENERISCH.includes(w));
  if (ausNamen.length) gruppen.push(ausNamen);

  const roh = eintrag && eintrag.suchbegriff;
  const listen = (roh && !Array.isArray(roh) && typeof roh === 'object')
    ? [].concat(roh.de || [], roh.en || [])
    : [].concat(roh || []);
  for (const begriff of listen) {
    const gruppe = Array.from(new Set(zerlege(String(begriff).replace(/^\s*tiktok\s+/i, ''))))
      .filter((w) => !GENERISCH.includes(w));
    // Gruppen, von denen nach dem Aussieben nichts Aussagekraeftiges bleibt,
    // fliegen ganz raus — sonst entstuende aus "tiktok gadget test" eine leere
    // oder einwortige Gruppe, die jedes beliebige Video bestehen wuerde.
    if (gruppe.length >= 2) gruppen.push(gruppe);
  }
  return gruppen.length ? gruppen : [[]];
}

// Woerter, die in fast jedem TikTok-Untertitel stehen und ueber die
// Zugehoerigkeit zu einem Produkt NICHTS aussagen. Sie sind zum Suchen
// nuetzlich ("kuechenwaage asmr" findet Videos mit Musik statt Kommentar),
// beim Pruefen aber schaedlich: Aus "kuechenwaage lcd test" wurde eine
// Dreiergruppe, in der "lcd" und "test" allein schon zwei Treffer ergaben —
// ganz ohne Produktbezug.
const GENERISCH = ['test', 'review', 'gadget', 'gadgets', 'unboxing', 'aesthetic', 'asmr',
  'satisfying', 'setup', 'deko', 'decor', 'viral', 'trend', 'trending', 'must', 'haves',
  'shop', 'tiktok', 'amazon', 'finds', 'neu', 'new', 'best', 'beste', 'top', 'diy',
  'hack', 'hacks', 'idee', 'ideen', 'ideas', 'routine', 'anleitung', 'tutorial'];

// Funktionswoerter, die eine Sprache verraten. Bewusst nur solche, die es in
// der jeweils anderen Sprache nicht gibt — "in", "so" oder "man" waeren
// zweideutig und wuerden mehr schaden als nutzen.
const DEUTSCHE_MARKER = ['der', 'die', 'das', 'und', 'ist', 'fuer', 'mit', 'ein', 'eine', 'einen',
  'nicht', 'auch', 'auf', 'von', 'zum', 'zur', 'sich', 'hat', 'habe', 'kann', 'wird', 'sehr',
  'aber', 'oder', 'wenn', 'schon', 'noch', 'immer', 'mein', 'meine', 'dein', 'jetzt', 'gibt',
  'wie', 'was', 'bei', 'ich', 'du', 'wir', 'ihr', 'euch', 'dir', 'man',
  // Kurzwoerter, die es im Englischen so nicht gibt. Ohne sie galt
  // "Elektrischer Wasserspender am Schreibtisch im Test" als nicht erkennbar —
  // ein offensichtlich deutscher Untertitel ohne jedes lange Funktionswort.
  'am', 'im', 'zu', 'es', 'dem', 'den', 'des', 'als', 'aus', 'nach', 'ueber', 'unter'];
const ENGLISCHE_MARKER = ['the', 'and', 'is', 'for', 'with', 'this', 'that', 'you', 'your',
  'are', 'have', 'has', 'can', 'will', 'not', 'but', 'just', 'more', 'always', 'my', 'our',
  'what', 'how', 'when', 'they', 'was', 'were', 'been', 'from', 'about', 'get', 'got', 'only'];

/**
 * In welcher Sprache ist der Untertitel geschrieben?
 *
 * WOZU: Die Sprachauswahl steuerte anfangs nur die Suchbegriffe. Deutsche
 * Begriffe liefern aber problemlos Videos mit englischem Untertitel — genau das
 * ist passiert. Wer "deutsch" waehlt, will deutsche Videos.
 *
 * Gezaehlt werden Funktionswoerter, nicht Inhaltswoerter: "wasserspender" steht
 * auch unter englischen Videos, "der/die/das" nicht. Umlaute und ss zaehlen
 * zusaetzlich fuer Deutsch.
 *
 * Rueckgabe 'de', 'en' oder null. NULL heisst "nicht entscheidbar" — bei
 * Untertiteln, die nur aus Hashtags bestehen, gibt es schlicht nichts zu
 * erkennen. Das als "falsche Sprache" zu werten waere geraten.
 */
/**
 * Der zweisprachige Wortschatz des Produkts, auf das Eindeutige eingekocht.
 *
 * Aus den Suchbegriffen beider Sprachen wird behalten, was NUR in einer der
 * beiden Listen vorkommt: "wasserspender" verraet Deutsch, "dispenser"
 * Englisch — "gadget" oder "smart" stehen in beiden und verraten nichts.
 * Allerweltswoerter fliegen ohnehin raus.
 *
 * Wozu: Fast jeder fuenfte Untertitel (gemessen 7 von 36) besteht nur aus
 * Hashtags und enthaelt kein einziges Funktionswort. "Smart table water
 * dispenser #tiktokshop" ist unuebersehbar englisch, galt aber als "nicht
 * entscheidbar" und flog deshalb raus. Der Wortschatz liefert das fehlende
 * Merkmal, ohne die Pruefung weicher zu machen: Verlangt bleibt ein positiver
 * Nachweis, es gibt jetzt nur eine zweite Quelle dafuer.
 */
function sprachHinweise(eintrag) {
  const roh = (eintrag && eintrag.suchbegriff) || {};
  const woerter = (liste) => new Set(
    [].concat(liste || [])
      .flatMap((b) => zerlege(String(b).replace(/^\s*tiktok\s+/i, '')))
      .filter((w) => !GENERISCH.includes(w)),
  );
  const de = woerter(roh.de);
  const en = woerter(roh.en);
  return {
    de: [...de].filter((w) => !en.has(w)),
    en: [...en].filter((w) => !de.has(w)),
  };
}

function spracheDesTextes(roh, hinweise) {
  const original = String(roh || '');
  const tokens = normalisiere(original).split(' ').filter(Boolean);
  if (!tokens.length) return null;

  let de = 0;
  let en = 0;
  for (const t of tokens) {
    if (DEUTSCHE_MARKER.includes(t)) de++;
    if (ENGLISCHE_MARKER.includes(t)) en++;
  }
  // Umlaute sind ein starkes Zeichen und kommen in englischen Texten nicht vor.
  if (/[äöüß]/i.test(original)) de += 2;

  // Zweites Merkmal, erst wenn die Funktionswoerter schweigen: der eindeutige
  // Wortschatz des Produkts. Bewusst NUR dann — Funktionswoerter sind das
  // verlaesslichere Zeichen, und ein englischer Hashtag unter einem deutschen
  // Satz soll ihn nicht ueberstimmen.
  if (de === en && hinweise) {
    const text = normalisiere(original);
    const trifft = (liste) => (liste || []).filter(
      (w) => (w.length >= 5 ? text.includes(w) : tokens.includes(w)),
    ).length;
    const deW = trifft(hinweise.de);
    const enW = trifft(hinweise.en);
    if (deW !== enW) return deW > enW ? 'de' : 'en';
  }

  if (de === 0 && en === 0) return null;
  if (de === en) return null;
  return de > en ? 'de' : 'en';
}

/**
 * Steht im Videotext ein Wort, das dieses Video sicher ausschliesst?
 *
 * WOZU: Die Trefferbewertung allein reicht nicht. Ein Katzenbrunnen ist wirklich
 * ein "automatischer Wasserspender" — jedes Suchwort passt, die Bewertung ist
 * hoch, und das Video ist trotzdem falsch. Real passiert: Zwei geladene Videos
 * zeigten Katzenbrunnen statt des Schreibtisch-Geraets.
 *
 * Verglichen wird WORTANFANG, nicht Teilstring: Deutsche Komposita wie
 * "Katzenbrunnen" oder "katzenmama" muessen mit "katzen" erwischt werden,
 * ohne dass "kategorie" ueber ein blosses "cat" mitfliegt.
 */
/**
 * Schliesst der Text dieses Video aus?
 *
 * EINZELNE WOERTER treffen als WORTANFANG: "fellnase" trifft "Fellnasen".
 * Deshalb stehen dort keine Kurzformen — "pet" traefe "Peter", "cat" jede
 * "Kategorie". Ein eigener Test wacht darueber.
 *
 * MEHRERE WOERTER treffen als zusammenhaengende Wendung. Die braucht es fuer
 * Geraete, deren Bezeichnung aus lauter harmlosen Woertern besteht: Ein
 * "bottom load water dispenser" ist ein Standgeraet und damit das falsche
 * Produkt — aber "bottom" allein auszuschliessen waere unbrauchbar. Live
 * nachgewiesen: Ein Standgeraet und eine fest verbaute Filteranlage kamen
 * durch, beide mit nur einem allgemeinen Merkmal ("pump", "gallon").
 */
function ausschlussTreffer(video, ausschlussWoerter) {
  const woerter = [].concat(ausschlussWoerter || [])
    .map((w) => normalisiere(String(w))).filter(Boolean);
  if (!woerter.length) return null;
  const text = normalisiere(videoText(video));
  const tokens = text.split(' ').filter(Boolean);
  for (const wort of woerter) {
    if (wort.includes(' ')) {
      if (text.includes(wort)) return wort;      // Wendung
    } else if (tokens.some((t) => t.startsWith(wort))) {
      return wort;                               // Wortanfang
    }
  }
  return null;
}

/**
 * Kommt im Videotext mindestens ein Wort vor, das DAS PRODUKT SELBST benennt?
 *
 * WOZU: Die Gruppenbewertung allein reicht nicht, weil Suchbegriffe neben dem
 * Produkt auch den Ort nennen. Real passiert: Der Begriff "water dispenser
 * bedside nightstand" bildet eine Vierergruppe — ein Nachttisch-Dekovideo traf
 * "bedside" und "nightstand", kam damit auf 0,5 und wurde geladen, ohne ein
 * einziges Produktwort zu enthalten.
 *
 * Fehlen Kernwoerter in der Konfiguration, greift diese Pruefung nicht (dann
 * entscheidet allein die Bewertung) — sie darf nichts stillschweigend
 * aussperren, wofuer nie etwas hinterlegt wurde.
 */
/**
 * Steht im Videotext ueberhaupt ein Wort, das das Produkt benennt?
 *
 * Verglichen wird nach derselben Laengenregel wie bei der Bewertung: lange
 * Woerter duerfen im Wort stehen ("dispenser" trifft "#waterdispenser"), kurze
 * muessen ganze Woerter sein. Ohne diese Regel liesse sich kein kurzes
 * Kernwort eintragen: "cup" haette "cupcake" und "cupboard" getroffen, "eis"
 * jede "reise". Genau deshalb fehlten bisher gaengige Bezeichnungen.
 */
/**
 * Woerter, die das Folgende ins Gegenteil verkehren.
 *
 * Anlass ist ein echter Fehlfund: "Genius DIY Water Dispenser — NO ELECTRICITY
 * needed" wurde angenommen, weil das Merkmal "elektrisch" im Wort "Electricity"
 * steckt. Der Untertitel sagt woertlich das Gegenteil dessen, was das Produkt
 * ausmacht.
 *
 * Bewusst nur unmittelbar davor (ein Wort Abstand): "no electricity" verneint,
 * "no more heavy bottles, this electric pump…" nicht. Ein groesseres Fenster
 * wuerde mehr kaputtmachen als reparieren — in "No More Heavy Water Bottles!
 * USB Rechargeable Automatic Water Pump" steht "no" vier Woerter vor "usb",
 * und das Video ist genau das Produkt.
 */
const VERNEINUNG = ['no', 'not', 'without', 'kein', 'keine', 'keinen', 'ohne', 'nicht', 'statt', 'instead'];

/**
 * Steht dieses Wort im Text — und ist es dort nicht verneint?
 *
 * Laengenregel wie ueberall: Ab fuenf Zeichen darf es im Wort stehen
 * ("dispenser" trifft "#waterdispenser"), kuerzere muessen ganze Woerter sein
 * ("cup" darf nicht "cupcake" treffen).
 */
function stehtImText(wort, text, tokens) {
  const treffer = wort.length >= 5 ? text.includes(wort) : tokens.includes(wort);
  if (!treffer) return false;
  // Wo steht es — und was steht direkt davor?
  const stelle = tokens.findIndex((t) => (wort.length >= 5 ? t.includes(wort) : t === wort));
  if (stelle > 0 && VERNEINUNG.includes(tokens[stelle - 1])) return false;
  return true;
}

/**
 * Ist es wirklich DIESES Geraet — nicht nur eines desselben Namens?
 *
 * Das Kernwort beantwortet nur die erste Haelfte der Frage: Im Text steht
 * "Wasserspender". Davon gibt es aber Standgeraete fuers Buero,
 * Kuehlschrankspender, Filterkannen, Katzenbrunnen und eben dieses kleine
 * Geraet, das auf einer Gallonenflasche sitzt und mit Akku pumpt.
 *
 * Die Merkmale beantworten die zweite Haelfte. Sie kommen aus der
 * Produktbeschreibung in products.json, nicht aus einer Vermutung:
 * "Automatischer Wasserspender fuer Gallon-Flaschen. Wiederaufladbar und
 * perfekt fuer Buero und Zuhause."
 *
 * Bewusst reicht EIN Merkmal. Untertitel sind kurz; zwei zu verlangen hiesse,
 * fast alles abzulehnen. Die Haerte kommt daher, dass diese Pruefung ZUSAETZLICH
 * zu Kernwort, Ausschlussliste und Trefferwert kommt — nicht daraus, dass eine
 * einzelne Pruefung unmoeglich zu bestehen waere.
 *
 * Ohne gepflegte Merkmale (Feld fehlt) greift die Pruefung nicht: Ein leeres
 * Feld darf nicht dazu fuehren, dass gar nichts mehr durchkommt.
 */
function hatMerkmal(video, merkmale) {
  return getroffeneMerkmale(video, merkmale).length > 0 || !([].concat(merkmale || []).length);
}

/** Welche Merkmale genau getroffen haben — fuer den Nachweis und die Meldung. */
function getroffeneMerkmale(video, merkmale) {
  const woerter = [].concat(merkmale || [])
    .map((w) => normalisiere(String(w))).filter(Boolean);
  const text = videoText(video);
  const tokens = text.split(' ').filter(Boolean);
  return woerter.filter((w) => stehtImText(w, text, tokens));
}

function hatKernwort(video, kernwoerter) {
  const woerter = [].concat(kernwoerter || [])
    .map((w) => normalisiere(String(w))).filter(Boolean);
  if (!woerter.length) return true;
  const text = videoText(video);
  const tokens = text.split(' ').filter(Boolean);
  return woerter.some((w) => stehtImText(w, text, tokens));
}

/**
 * Bewertet ein Video gegen alle Gruppen und gibt die beste Bewertung zurueck.
 *
 * Belastbare Gruppen gewinnen immer gegen unbelastbare, auch bei niedrigerem
 * Wert — sonst schlaegt ein Zufallstreffer in einer Zwei-Wort-Gruppe die
 * saubere Zuordnung aus dem Produktnamen.
 */
function bewerte(gruppen, video) {
  let bestes = { wert: 0, haelt: false, treffer: [], gruppe: [] };
  for (const gruppe of gruppen) {
    const treffer = getroffeneBegriffe(gruppe, video);
    const wert = gruppe.length
      ? Math.round((treffer.length / gruppe.length) * 1000) / 1000
      : 0;
    const haelt = gruppe.length <= 1 ? treffer.length === 1 : treffer.length >= 2;
    if ((haelt && !bestes.haelt) || (haelt === bestes.haelt && wert > bestes.wert)) {
      bestes = { wert, haelt, treffer, gruppe };
    }
  }
  return bestes;
}

/**
 * Die Suchbegriffe eines Produkts in der gewuenschten Sprache.
 *
 * Das Feld `suchbegriff` darf dreierlei sein, damit alte Konfigurationen
 * weiterlaufen:
 *   "ein begriff"                  -> gilt fuer jede Sprache
 *   ["a", "b"]                     -> gilt fuer jede Sprache
 *   { de: [...], en: [...] }       -> je Sprache eigene Begriffe
 *
 * Fehlt die gewuenschte Sprache, wird die andere genommen statt nichts zu tun —
 * ein Lauf ohne einen einzigen Suchbegriff waere fuer niemanden nuetzlich.
 */
function begriffeFuer(eintrag, produkt, sprache) {
  const roh = eintrag && eintrag.suchbegriff;
  let liste = roh;
  if (roh && !Array.isArray(roh) && typeof roh === 'object') {
    liste = roh[sprache] && roh[sprache].length
      ? roh[sprache]
      : (roh.en || roh.de || []);
  }
  const fertig = [].concat(liste || []).map((b) => String(b).trim()).filter(Boolean);
  // Rueckfall aus dem Produktnamen — bei "de" ohne Uebersetzungsversuch,
  // der Name IST ja deutsch.
  return fertig.length ? fertig : [`tiktok ${produkt.name}`];
}

/**
 * Hoert den Ton ab und meldet, ob wirklich gesprochen wird.
 *
 * WARUM NICHT DAS track-FELD ALLEIN: Es ist nur ein Indiz. An zehn geladenen
 * Videos nachgemessen lag es bei VIER von sieben angeblichen Musikvideos
 * falsch — die Leute reden ueber den lizenzierten Titel. Einfache
 * Ton-Kennzahlen (Pausenanteil, Energie im Sprachband) trennen die Faelle
 * ebenfalls nicht, die Werte ueberlappen vollstaendig. Erst ein echter
 * Spracherkenner liefert eine klare Trennung:
 *   geredet:  Redeanteil 0.71 - 0.996,  38 - 173 Woerter
 *   nur Ton:  Redeanteil 0.00 - 0.05,    0 -   1 Wort
 *
 * Der erkannte TEXT wird nirgends gespeichert — nur Kennzahlen. Siehe
 * bot/sprach-erkennung.py.
 */
function pruefeSprache(videoPfad, opt = {}) {
  const python = opt.python || (process.platform === 'win32' ? 'py' : 'python3');
  const skript = opt.skript || path.join(__dirname, 'sprach-erkennung.py');
  const lauf = spawnSync(python, [skript, videoPfad], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const zeile = String(lauf.stdout || '').split(/\r?\n/).find((z) => z.trim().startsWith('{'));
  if (!zeile) {
    return { ok: false, grund: String(lauf.stderr || '').trim().slice(0, 160) || 'keine Antwort' };
  }
  try {
    return JSON.parse(zeile);
  } catch (fehler) {
    return { ok: false, grund: `Antwort unlesbar: ${fehler.message}` };
  }
}

/**
 * Wird in diesem Video geredet?
 *
 * Die Grenzen stammen aus der Messung oben und sitzen bewusst in der grossen
 * Luecke dazwischen: Ein einzelnes erkanntes Wort (Rauschen, ein Ausruf) macht
 * noch kein Gespraech.
 */
function wirdGeredet(messung) {
  if (!messung || !messung.ok) return null;          // unbekannt, nicht "nein"
  return Number(messung.woerter) >= 5 && Number(messung.redeanteil) >= 0.15;
}

/**
 * Ab welcher Sicherheit die erkannte Sprache etwas wert ist.
 *
 * Gemessen an den 16 Videos im Ordner (6 eigene Renderings mit deutscher
 * Ansage, 10 fremde):
 *   es wird geredet:  Sicherheit 0.977 - 0.998   (28 - 173 Woerter)
 *   niemand redet:    Sicherheit 0.258 - 0.580   (0 Woerter)
 * Bei Stille RAET der Erkenner — er meldete dort ausnahmslos "en", obwohl kein
 * Wort faellt. Genau dieser Ratewert stand bisher als Tatsache im
 * Herkunftsnachweis ("gesprochene_sprache": "en" bei 0 Woertern).
 * Die Grenze liegt in der Luecke zwischen beiden Gruppen, nicht am Rand.
 */
const SPRACHE_SICHER = 0.7;

/**
 * Welche Sprache wird tatsaechlich GESPROCHEN?
 *
 * null heisst "keine" — entweder redet niemand, oder die Erkennung ist zu
 * unsicher, um daraus etwas abzuleiten. Bewusst nicht geraten.
 */
function gesprocheneSprache(messung) {
  if (wirdGeredet(messung) !== true) return null;
  if (Number(messung.sprache_sicherheit) < SPRACHE_SICHER) return null;
  return messung.sprache || null;
}

/**
 * Passt die gesprochene Sprache zur getroffenen Auswahl?
 *
 *   true   ja — es wird in der gewaehlten Sprache geredet
 *   false  nein — es wird geredet, aber nicht (nachweislich) in dieser Sprache
 *   null   kein Einwand: es redet niemand, oder es liess sich nicht abhoeren
 *
 * WOZU, obwohl der Untertitel schon geprueft wird: Der Untertitel ist Text
 * unter dem Video, die Ansage ist der Ton darin. Beide koennen auseinandergehen
 * — ein deutscher Untertitel unter einem englisch gesprochenen Video kam so
 * als "deutsch" durch. Die Auswahl "1 = deutsch" meinte fuer den Ton bislang
 * gar nichts.
 *
 * Warum bei unklarer Erkennung streng: Verlangt wird ein POSITIVER Nachweis,
 * dieselbe Linie wie beim Untertitel. Es wird ja unbestritten geredet — nur
 * eben nicht erkennbar in der gewuenschten Sprache. Das ist kein Grund, es
 * durchzuwinken.
 */
function sprachePasst(messung, gewaehlt) {
  if (wirdGeredet(messung) !== true) return null;    // niemand redet -> nichts zu pruefen
  const erkannt = gesprocheneSprache(messung);
  if (!erkannt) return false;                        // geredet, aber unklar worin
  return erkannt === gewaehlt;
}

function istMusik(video) {
  const titel = String((video && video.track) || '').trim();
  if (!titel) return false;
  return !/original sound|originalton|son original|sonido original|som original/i.test(titel);
}

// ── Einsortieren zu den eigenen Videos ───────────────────────────────

/**
 * Wohin die fertigen Videos kommen.
 *
 * Normalfall Marketing/videos, neben den eigenen Renderings. Ueber
 * TIKTOK_VIDEO_DIR verlegbar — noetig, wenn der Projektordner fuer dieses
 * Programm schreibgeschuetzt ist (Windows "Ueberwachter Ordnerzugriff"). Ohne
 * diesen Ausweg gaebe es bei gesperrtem Ordner ueberhaupt keine Loesung ausser
 * einer Systemeinstellung.
 */
function videoOrdnerAus(env = process.env) {
  const ausEnv = String(env.TIKTOK_VIDEO_DIR || '').trim();
  return ausEnv ? path.resolve(ausEnv) : path.join(MARKETING, 'videos');
}

const VIDEO_ORDNER = videoOrdnerAus();
const GITIGNORE = path.join(WURZEL, '.gitignore');

/** Die naechste freie laufende Nummer in Marketing/videos. */
/**
 * Wo das Rohmaterial EINES Produkts liegt.
 *
 * Flach in einem Ordner war es ab etwa zwanzig Dateien unbrauchbar: Alles hiess
 * "NN_slug_dauer_stil-b.mp4", und welches Video zu welchem Produkt gehoerte,
 * stand nur im Dateinamen. Jetzt bekommt jedes Produkt seinen eigenen Ordner,
 * benannt mit Nummer UND Slug — die Nummer sortiert, der Slug sagt, was drin
 * ist.
 *
 *   Marketing/videos/rohmaterial/10_elektrischer-wasserspender-fuer-schreibtisch/
 *
 * Der Zwischenordner "rohmaterial" ist kein Schmuck: Er traegt die Grenze
 * zwischen FREMDEM Material (gehoert anderen Leuten, darf nie ins oeffentliche
 * Repo) und den EIGENEN Renderings, die weiterhin flach daneben liegen und
 * versioniert sind. Eine einzige .gitignore-Zeile deckt damit alles ab, was
 * vorher zwanzig Einzelzeilen brauchte — und die waren die fehleranfaelligste
 * Stelle im ganzen Projekt.
 */
const ROHMATERIAL = 'rohmaterial';
const GESCHNITTEN = 'geschnitten';

function produktOrdner(basis, produkt) {
  const nummer = String(produkt && produkt.id != null ? produkt.id : 0).padStart(2, '0');
  const slug = String((produkt && produkt.slug) || 'ohne-slug');
  return path.join(basis, ROHMATERIAL, `${nummer}_${slug}`);
}

/**
 * Legt fuer JEDES Produkt einen Ordner an, auch fuer die noch leeren.
 *
 * Wozu leere Ordner: Sie sind das Inhaltsverzeichnis. Wer Material sucht oder
 * ablegt, sieht auf einen Blick, welche Produktnummer zu welchem Produkt
 * gehoert — ohne products.json aufzuschlagen. Und beim Ablegen von Hand
 * landet nichts mehr in einem selbst erfundenen Ordnernamen.
 *
 * Bewusst als BEFEHL und nicht einmalig von Hand: Der Zweig ist gitignoriert,
 * also existiert er auf keinem anderen Rechner und ueberlebt kein frisches
 * Auschecken. Wiederherstellbar zu sein ist hier mehr wert als einmal angelegt.
 */
function legeProduktOrdnerAn(basis, produkte) {
  const angelegt = [];
  const vorhanden = [];
  for (const produkt of produkte || []) {
    if (!produkt || produkt.id == null) continue;
    const ordner = produktOrdner(basis, produkt);
    if (fs.existsSync(ordner)) { vorhanden.push(ordner); continue; }
    fs.mkdirSync(ordner, { recursive: true });
    angelegt.push(ordner);
  }
  return { angelegt, vorhanden };
}

/** Liegt dieser Pfad im Rohmaterial-Zweig — also unter einer Ordner-Regel? */
function imRohmaterial(pfad) {
  return String(pfad || '').split(/[\\/]/).includes(ROHMATERIAL);
}

/**
 * Welche laufende Nummer bekommt das naechste Video?
 *
 * ZWEI QUELLEN, nicht eine. Aus dem Ordner allein gelesen wird die Nummer nach
 * jedem Loeschen neu vergeben — und dann bekommt ein ANDERES Video denselben
 * Dateinamen. Genau das ist passiert, zweimal an einem Tag:
 *
 *   16_…_12s_stil-b.mp4  (15:42)  ← ueberschrieben
 *   16_…_12s_stil-b.mp4  (16:41)  ← anderes Video, gleicher Name
 *
 * Das erste Video war damit weg, und im Nachweis standen zwei Eintraege fuer
 * dieselbe Datei — die Herkunft der verbliebenen war nicht mehr feststellbar.
 * Deshalb zaehlen jetzt auch die Namen mit, die im Herkunftsnachweis stehen:
 * Der vergisst nicht, wenn jemand eine Datei loescht.
 */
function naechsteNummer(ordner = VIDEO_ORDNER, bekannteNamen = []) {
  let hoechste = 0;
  const namen = [].concat(bekannteNamen || []);
  try {
    namen.push(...fs.readdirSync(ordner));
  } catch { /* Ordner fehlt — dann zaehlen nur die bekannten Namen */ }
  for (const name of namen) {
    const treffer = /^(\d+)_/.exec(String(name));
    if (treffer) hoechste = Math.max(hoechste, parseInt(treffer[1], 10));
  }
  return hoechste + 1;
}

/**
 * Der Slug-Teil im Dateinamen.
 *
 * Vorhandene Dateien desselben Produkts geben die Schreibweise vor: Zu Produkt
 * 10 liegt `05_elektrischer-wasserspender_21s_stil-a.mp4`, also wird weiter
 * `elektrischer-wasserspender` benutzt und nicht der volle Slug. Sonst staenden
 * zwei Schreibweisen desselben Produkts nebeneinander.
 */
function slugFuerDateiname(produkt, ordner = VIDEO_ORDNER) {
  const voll = String(produkt.slug || '');
  try {
    for (const name of fs.readdirSync(ordner)) {
      const treffer = /^\d+_(.+?)_\d+s_stil-[ab]\./.exec(name);
      if (treffer && voll.startsWith(treffer[1])) return treffer[1];
    }
  } catch { /* egal */ }
  return voll;
}

/**
 * Traegt eine Datei in .gitignore ein.
 *
 * NOETIG, WEIL DAS UMBENENNEN DEN SCHUTZ AUFHEBT: Das allgemeine Muster
 * unterscheidet fremdes von eigenem Material an den Ziffern nach dem
 * Unterstrich. Sobald eine fremde Datei auf das Schema der eigenen umgetauft
 * ist, greift es nicht mehr — und ohne Eintrag landet sie im oeffentlichen
 * Repo. Genau das ist zweimal passiert, bevor es hier automatisch geschah.
 */
/**
 * Braucht diese Datei noch einen eigenen .gitignore-Eintrag?
 *
 * Unter "rohmaterial/" nicht: Dort greift eine Ordner-Regel fuer alles. Die
 * frueheren Einzelzeilen waren die fehleranfaelligste Stelle im Projekt —
 * zweimal ist fremdes Material im Status aufgetaucht, weil beim Umbenennen
 * eine Zeile fehlte.
 */
function brauchtEinzelschutz(pfad) {
  return !imRohmaterial(pfad);
}

function schuetzeDatei(dateiname, pfad = GITIGNORE) {
  const zeile = 'Marketing/videos/' + dateiname.replace(/\.[^.]+$/, '') + '.*';
  let inhalt;
  try {
    inhalt = fs.readFileSync(pfad, 'utf8');
  } catch {
    return { ok: false, grund: '.gitignore nicht lesbar' };
  }
  if (inhalt.split(/\r?\n/).some((z) => z.trim() === zeile)) return { ok: true, schonDa: true, zeile };
  // Zeilenweise anhaengen, damit gemischte Zeilenenden nicht zur Falle werden.
  const trenner = inhalt.includes('\r\n') ? '\r\n' : '\n';
  try {
    fs.writeFileSync(pfad, inhalt.replace(/\s*$/, '') + trenner + zeile + trenner, 'utf8');
  } catch (fehler) {
    // Darf den Lauf NICHT abbrechen: Das Video ist zu diesem Zeitpunkt schon
    // geladen und abgelegt. Genau hier flog der Lauf vorher mit
    // "EBADF: bad file descriptor, write" — weil .gitignore im geschuetzten
    // Projektordner liegt, das Video aber laengst ausserhalb lag.
    return { ok: false, grund: `${pfad} nicht beschreibbar (${fehler.code || fehler.message})`, zeile };
  }
  return { ok: true, schonDa: false, zeile };
}

// ── Gefuehrter Ablauf (npm run tiktok) ───────────────────────────────

/**
 * Oeffnet EINE Konsolen-Anbindung fuer alle Fragen.
 *
 * Warum nicht je Frage eine eigene: Die erste Anbindung liest stdin gepuffert.
 * Wird sie geschlossen, ist der Rest der Eingabe verloren — die zweite Frage
 * bekommt sofort das Dateiende, ihr Rueckruf feuert nie, und das Programm endet
 * lautlos mit Code 0. Genau so ist es beim ersten echten Aufruf passiert: Nach
 * "Wie viele Videos?" kam keine einzige Zeile mehr, und der Lauf galt als
 * erfolgreich. Ein stiller Fehlschlag, der wie Betrieb aussieht.
 */
function frageStelle(eingabe = process.stdin, ausgabe = process.stdout) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: eingabe, output: ausgabe });

  // Zeilen, die ankamen, BEVOR jemand danach gefragt hat — und Fragen, die auf
  // eine Zeile warten. Ohne diese zwei Listen geht die zweite Eingabe verloren:
  // Kommen beide Zeilen in einem Rutsch (Eingabe aus einer Datei oder einer
  // Weiterleitung), meldet readline sie sofort hintereinander. Die erste holt
  // sich die erste Frage, die zweite faellt ins Leere, weil die naechste Frage
  // noch nicht gestellt ist. Danach wartet Frage zwei auf etwas, das nie mehr
  // kommt — das Programm endet lautlos mit Code 0.
  const wartendeZeilen = [];
  const offeneFragen = [];
  let beendet = false;

  rl.on('line', (zeile) => {
    const naechsteFrage = offeneFragen.shift();
    if (naechsteFrage) naechsteFrage(String(zeile).trim());
    else wartendeZeilen.push(String(zeile).trim());
  });
  rl.on('close', () => {
    beendet = true;
    // Dateiende: offene Fragen mit leerer Antwort abschliessen, statt haengen.
    while (offeneFragen.length) offeneFragen.shift()('');
  });

  return {
    frage: (text) => new Promise((fertig) => {
      ausgabe.write(text);
      if (wartendeZeilen.length) return fertig(wartendeZeilen.shift());
      if (beendet) return fertig('');
      offeneFragen.push(fertig);
    }),
    // Mehrfach aufrufbar: Die Anbindung haelt sonst den Prozess am Leben.
    schliesse: () => { if (!beendet) rl.close(); },
  };
}

/**
 * Laedt EIN Video und legt es zu den eigenen Videos — umbenannt und geschuetzt.
 *
 * Die drei Schritte, die vorher von Hand kamen, in einem: herunterladen,
 * auf das Namensschema `NN_<slug>_<dauer>s_stil-b.mp4` umtaufen und die Datei
 * in .gitignore eintragen. Der letzte Schritt ist der wichtigste — ohne ihn
 * steht fremdes Material im oeffentlichen Repo.
 */
async function holeUndSortiereEin(opt) {
  const melde = opt.melde || console.log;
  const kandidat = opt.kandidat;

  // Endgueltigen Namen VOR dem Laden festlegen, damit das Video in einem Zug
  // an seinen Platz kommt und nicht zweimal umziehen muss.
  const dauer = Math.round(Number(kandidat.dauer) || 0);
  const name = `${String(opt.nummer).padStart(2, '0')}_${opt.slug}_${dauer}s_stil-b.mp4`;
  const nach = path.join(opt.videoOrdner, name);

  const geladen = await ladeVideo(
    opt.ytdlp, opt.datenOrdner, opt.produkt, kandidat, opt.standard, nach,
  );
  if (geladen.gesperrt) return { ok: false, gesperrt: true, grund: geladen.meldung };
  // Schreibsperre betrifft JEDES weitere Video gleichermassen — einmal melden
  // und aufhoeren, statt es fuenfmal zu versuchen und fuenfmal zu scheitern.
  if (geladen.schreibsperre) return { ok: false, schreibsperre: true, grund: geladen.fehler };
  if (geladen.fehler) return { ok: false, grund: geladen.fehler };

  // Das Video liegt bereits an seinem Platz — ladeVideo() hat es direkt dorthin
  // kopiert. Der frueher noetige zweite Umzug entfaellt damit vollstaendig.
  // Die Metadaten bleiben beim Nachweis, nicht bei den Videos.
  const infoAlt = path.join(opt.datenOrdner, geladen.datei.replace(/\.[^.]+$/, '') + '.info.json');
  const infoNeu = path.join(opt.datenOrdner, name.replace(/\.mp4$/, '') + '.info.json');
  try { if (fs.existsSync(infoAlt)) fs.renameSync(infoAlt, infoNeu); } catch { /* nicht schlimm */ }

  // Der .gitignore-Eintrag ist nur noetig, wenn die Datei INNERHALB des
  // Projekts liegt — sonst kann Git sie ohnehin nie erfassen. Liegt der
  // Videoordner ausserhalb (TIKTOK_VIDEO_DIR), waere der Eintrag sinnlos und
  // der Schreibversuch auf eine womoeglich geschuetzte .gitignore riskant.
  const wurzel = opt.wurzel || WURZEL;
  const imProjekt = !path.relative(wurzel, opt.videoOrdner).startsWith('..');
  // Unter "rohmaterial/" deckt eine Ordner-Regel alles ab. Die frueheren
  // Einzelzeilen waren die fehleranfaelligste Stelle im Projekt — zweimal ist
  // fremdes Material im Status aufgetaucht, weil beim Umbenennen eine fehlte.
  if (imProjekt && brauchtEinzelschutz(opt.videoOrdner)) {
    const schutz = schuetzeDatei(name, opt.gitignore);
    if (!schutz.ok) {
      melde(`⚠️  ${name}: konnte nicht in .gitignore eingetragen werden (${schutz.grund})`);
      melde('    VOR dem naechsten Commit von Hand nachtragen, sonst wird das Video veroeffentlicht!');
    }
  }

  return {
    ok: true,
    eintrag: {
      produkt_id: opt.produkt.id,
      produkt_name: opt.produkt.name,
      video_id: kandidat.id,
      quelle_url: kandidat.url,
      creator: kandidat.uploader,
      titel: kandidat.title,
      dauer_sek: dauer,
      ton: `${kandidat.track} — ${kandidat.artist}`.replace(/ — $/, ''),
      // Aus dem Kandidaten abgeleitet, nicht fest eingetragen: Bei Tonwahl
      // "egal" kommen auch Videos mit eigener Tonspur durch, und dann waere
      // ein pauschales "keine Sprache" im Nachweis schlicht gelogen.
      tonart: istMusik(kandidat)
        ? 'lizenzierter Musiktitel (kein "original sound") -> keine Sprache'
        : 'eigene Tonspur ("original sound") -> es wird vermutlich gesprochen',
      zeitstempel: opt.jetzt(),
      datei: name,
      // Wo die Datei liegt, relativ zum Sammelordner — sonst laesst sich ein
      // Eintrag spaeter nicht mehr seiner Datei zuordnen.
      ablage: opt.ablage || 'Marketing/videos',
      groesse_bytes: fs.statSync(nach).size,
      sha256: sha256(nach),
      trefferwert: kandidat.wert != null ? kandidat.wert : null,
      // WARUM dieses Video zu diesem Produkt gehoert — nicht nur DASS.
      // Der Trefferwert allein sagt "es kamen genug Suchbegriffe vor"; erst
      // die Merkmale sagen, dass es dasselbe Geraet ist und nicht ein
      // Standgeraet, ein Kuehlschrankspender oder eine Filterkanne.
      merkmale: Array.isArray(kandidat.merkmale) && kandidat.merkmale.length
        ? kandidat.merkmale : null,
      zuordnung: 'ueber Suche gefunden, Tonspur geprueft',
      rechte_geprueft: false,
    },
  };
}

/**
 * Der gefuehrte Ablauf: Produktnummer, Anzahl, fertig.
 *
 * Alles Aeussere kommt herein, damit es pruefbar bleibt — auch die Fragen
 * selbst, sodass ein Test sie ohne Konsole beantworten kann.
 */
async function interaktiv(opt) {
  const melde = opt.melde || console.log;
  const jetzt = opt.jetzt || (() => new Date().toISOString());
  const standard = { ...STANDARD, ...(opt.standard || {}) };
  const datenZiel = opt.datenOrdner || datenOrdner();
  let videoZiel = opt.videoOrdner || VIDEO_ORDNER;

  const notaus = notausGrund({ stopDatei: opt.stopDatei, env: opt.env });
  // Vor dem Notaus wird nicht einmal gefragt — und die Konsole erst danach
  // geoeffnet, damit sie den Prozess in diesem Fall gar nicht erst festhaelt.
  if (notaus) { melde(`⏹  Notaus aktiv — es wird nichts geladen. Grund: ${notaus}`); return 1; }

  // Eigene Fragen (Test) oder eine echte Konsole, die bis zur letzten Frage offen bleibt.
  const konsole = opt.frage ? null : frageStelle();
  const stelleFrage = opt.frage || konsole.frage;
  const schliesseKonsole = () => { if (konsole) konsole.schliesse(); };

  // 1. Welches Produkt?
  const eingabe = await stelleFrage('Produktnummer? ');
  const produkt = opt.produkte.find((p) => Number(p.id) === Number(eingabe));
  if (!produkt) {
    schliesseKonsole();
    melde(`❌ Kein Produkt mit der Nummer "${eingabe}". Vorhanden: ${opt.produkte.map((p) => p.id).join(', ')}`);
    return 1;
  }
  melde(`   → ${produkt.name}`);

  // 2. Wie viele?
  // Die Obergrenze stand hier immer schon bei 25, die 5 war nur die Vorgabe —
  // in der Frage stand das aber nirgends, also sah es nach "hoechstens 5" aus.
  // Jetzt bis 50, und die Grenze steht in der Frage.
  const HOECHSTENS = 50;
  const anzahlRoh = await stelleFrage(`Wie viele Videos? [5, hoechstens ${HOECHSTENS}] `);
  const anzahl = zahl(anzahlRoh || '5', 5, 1, HOECHSTENS);

  // 3. Sprache der Suche. Sie entscheidet, mit welchen Begriffen gesucht wird —
  // nicht, welche Sprache im Video gesprochen wird. Das laesst sich aus den
  // Angaben nicht zuverlaessig ablesen, und Geratenes waere hier wertlos.
  // String(... || '') statt direkt .toLowerCase(): Am Dateiende oder bei einer
  // eigenen Frage-Funktion kann hier undefined ankommen — das waere ein
  // Absturz mitten in der Abfrage.
  const spracheRoh = String(await stelleFrage(
    'Sprache?  1 = deutsch  2 = englisch  [2] ') || '').trim();
  // Ziffer bevorzugt, Wort weiterhin erlaubt — wer "deutsch" tippt, soll nicht
  // stillschweigend Englisch bekommen.
  const sprache = (spracheRoh.startsWith('1') || spracheRoh.toLowerCase().startsWith('d')) ? 'de' : 'en';

  // 4. Ton. Standard bleibt "nur Musik" — wer nichts eingibt, bekommt das
  // Strengere, nicht das Beliebigere.
  const tonRoh = String(await stelleFrage(
    'Ton?  1 = keine Sprache  2 = mit Sprache  [1] ') || '').trim();
  // Wichtig fuer die Erwartung: Das ist ein Hinweis aus den Metadaten, keine
  // Garantie. Geprueft wird die Tonspur ("original sound" = eigene Aufnahme,
  // sonst lizenzierter Musiktitel). Hoeren kann das Programm nicht.
  // Bewusst NICHT auf "m" pruefen: "musik" und "mit Sprache" fangen beide damit
  // an — die Abkuerzung haette das Gegenteil bewirkt. Nur die Ziffer und
  // eindeutige Woerter zaehlen; alles andere bleibt beim strengeren Standard.
  const tonKlein = tonRoh.toLowerCase();
  const nurMusik = !(tonRoh.startsWith('2') || tonKlein.startsWith('mit') || tonKlein.startsWith('spr'));

  schliesseKonsole();                    // ab hier wird nicht mehr gefragt
  melde(`   → ${anzahl} Video(s) · ${sprache === 'de' ? 'Deutsch' : 'Englisch'} (Suche, Untertitel und Ansage) · `
    + `${nurMusik ? 'nur Musik (keine Sprache)' : 'mit Sprache erlaubt'}\n`);

  // 3. Adressen beschaffen: erst Suche, sonst was in der Konfiguration steht.
  const eintrag = konfigZuProdukt(opt.konfig, produkt.id);
  // Womit spaeter geprueft wird, ob ein Fund wirklich zum Produkt gehoert.
  // Bewusst aus BEIDEN Sprachen, unabhaengig von der gewaehlten Suchsprache:
  // Ein englisch beschriftetes Video kann auch bei deutscher Suche auftauchen.
  const gruppen = begriffsGruppen(produkt, eintrag);
  // Zweites Merkmal fuer die Sprache des Untertitels, aus dem zweisprachigen
  // Wortschatz des Produkts. Greift nur, wenn die Funktionswoerter schweigen.
  const hinweise = sprachHinweise(eintrag);
  const schwelle = opt.schwelle != null ? opt.schwelle : standard.schwelle;
  // Ausschlusswoerter: die allgemeinen aus der Konfiguration plus die des
  // Produkts. Im Sortiment gibt es kein einziges Tierprodukt — deshalb sind
  // Katzen-, Hunde- und Aquariumbegriffe global gefahrlos.
  const ausschluss = [].concat(standard.ausschluss || [], eintrag.ausschluss || []);
  // Woerter, die das Produkt SELBST benennen. Mindestens eines muss im
  // Videotext stehen, sonst zaehlt keine noch so hohe Bewertung.
  const kernwoerter = [].concat(eintrag.kernwoerter || []);
  // Zweite, unabhaengige Pruefung: Woerter, die dieses eine Geraet von anderen
  // desselben Namens unterscheiden. Siehe hatMerkmal().
  const merkmale = [].concat(eintrag.merkmale || []);
  // Mehrere Suchbegriffe sind erlaubt und meist noetig: Eine einzelne Anfrage
  // liefert oft nur eine Handvoll Adressen, und davon faellt der groesste Teil
  // durch den Musikfilter. Gemessen: ein Begriff -> 6 Adressen -> 0 brauchbar.
  const begriffe = begriffeFuer(eintrag, produkt, sprache);

  // Adressen kommen HAEPPCHENWEISE, nicht alle auf einmal.
  //
  // Vorher liefen alle Suchbegriffe vorweg durch, dann wurde die Sammlung
  // abgearbeitet — und war sie zu duenn, endete der Lauf eben mit "1 von 3
  // geladen". Mit den strengeren Pruefungen faellt inzwischen so viel durch,
  // dass das der Normalfall waere.
  //
  // Jetzt wird nachgelegt, solange etwas fehlt: erst die fest hinterlegten
  // Adressen, dann ein Suchbegriff nach dem anderen. Der naechste geht erst
  // raus, wenn die Warteschlange leer ist und die Zahl noch nicht steht. Das
  // spart nebenbei Abfragen — bei 48 Begriffen waeren 48 Anfragen im Voraus
  // reine Verschwendung, wenn die erste schon reicht.
  const gesehen = new Set();
  // { url, meta } — meta ist gesetzt, wenn die Angaben schon geholt wurden.
  const warteschlange = [].concat(eintrag.videos || []).map((url) => ({ url, meta: null }));
  // Was ein Suchbegriff ueber sein Kontingent hinaus geliefert hat. Wird erst
  // angefasst, wenn alle Begriffe durch sind — siehe unten.
  const reserve = [];
  // Zweite Runde: Kandidaten, deren TONSPUR nach eigener Aufnahme aussieht.
  // Sie werden zurueckgestellt, nicht verworfen — siehe unten.
  const zweiteChance = [];
  let zweiteRunde = false;
  let naechsterBegriff = 0;
  let sucheGescheitert = null;

  const nachschub = async () => {
    while (naechsterBegriff < begriffe.length) {
      const begriff = begriffe[naechsterBegriff++];
      const suche = await sucheAdressen({
        begriff, anzahl: 20, env: opt.env || process.env, holen: opt.holen,
      });
      if (!suche.ok) {
        sucheGescheitert = suche.grund;
        melde(`⚠️  Suche nicht moeglich: ${suche.grund}`);
        melde('   Es zaehlen dann nur die Adressen aus tiktok-quellen.json.');
        melde('   Fuer die automatische Suche einen Schluessel in die .env eintragen:');
        melde('     TAVILY_API_KEY  — 1000 Abfragen/Monat, KEINE Kreditkarte (tavily.com)');
        melde('     BRAVE_API_KEY   — Alternative, verlangt aber eine Kreditkarte');
        return false;
      }
      const neu = suche.adressen.filter((u) => !gesehen.has(u));
      // EIN BEGRIFF DARF NICHT DAS GANZE BUDGET FRESSEN.
      //
      // Seit die Adressen aus dem Seitentext kommen, liefert eine einzige
      // Anfrage ueber 200 Stueck. Ungebremst arbeitet der Lauf die alle ab,
      // rennt in die Obergrenze von 60 Abrufen und kommt nie zu Begriff 2 —
      // live nachgewiesen: "0 von 3 geladen, 60 Adressen geprueft, 1 von 24
      // Suchbegriffen gebraucht". Zwei Dutzend gute Begriffe blieben ungenutzt,
      // waehrend das Budget in den Nachzuegler-Adressen EINER Anfrage verpuffte.
      //
      // Deshalb nimmt jeder Begriff nur sein Kontingent (max_kandidaten_je_quelle,
      // Standard 20) — vorne stehen ohnehin die von der Suchmaschine sortierten.
      // Der Rest wandert in die Reserve und kommt dran, wenn alle Begriffe
      // durch sind und immer noch etwas fehlt.
      const kontingent = Math.max(1, Number(standard.max_kandidaten_je_quelle) || 20);
      const jetztNehmen = neu.slice(0, kontingent);
      const spaeter = neu.slice(kontingent);
      if (spaeter.length) reserve.push(...spaeter.map((url) => ({ url, meta: null })));
      melde(`🔎 "${begriff}": ${suche.adressen.length} Adresse(n), ${neu.length} neu — `
        + `${jetztNehmen.length} jetzt${spaeter.length ? `, ${spaeter.length} in Reserve` : ''}.`);
      if (jetztNehmen.length) {
        warteschlange.push(...jetztNehmen.map((url) => ({ url, meta: null })));
        return true;
      }
    }
    // Begriffe aufgebraucht — jetzt die Reserve, in denselben Haeppchen.
    if (reserve.length) {
      const kontingent = Math.max(1, Number(standard.max_kandidaten_je_quelle) || 20);
      const haeppchen = reserve.splice(0, kontingent);
      melde(`🔎 Reserve: ${haeppchen.length} weitere Adresse(n) (${reserve.length} bleiben).`);
      warteschlange.push(...haeppchen);
      return true;
    }
    return false;
  };

  // 4. Bekanntes ueberspringen, Tonspur pruefen, laden.
  try {
    fs.mkdirSync(datenZiel, { recursive: true });
  } catch (fehler) {
    melde(`❌ Ablageordner nicht anlegbar: ${datenZiel} (${fehler.code || fehler.message})`);
    melde('   Ausweg: MARKETING_DATA_DIR auf einen Ordner ausserhalb von "Dokumente" setzen.');
    return 1;
  }
  // Einmal vorab statt fuenf Fehlschlaege spaeter: Ohne Browser-Kennung
  // beantwortet TikTok keine einzige Anfrage.
  const nachahmung = opt.impersonation
    ? await opt.impersonation(opt.ytdlp)
    : await impersonationVerfuegbar(opt.ytdlp);
  if (!nachahmung.ok) {
    melde('');
    melde('❌ yt-dlp kann sich nicht als Browser ausgeben — TikTok wird jeden Abruf ablehnen.');
    melde('   Einmalig beheben:  py -m pip install curl_cffi');
    melde('');
    melde('   Ohne das Paket meldet yt-dlp "Unexpected response from webpage request".');
    melde('   Das klingt nach einem einzelnen kaputten Video, betrifft aber alle.');
    return 1;
  }

  // Ab hier ist "videoZiel" der Ordner DIESES Produkts, nicht mehr der
  // Sammelordner. Alles Weitere — Nummerierung, Namensschema, Ablage — bezieht
  // sich darauf, sodass die Nummern je Produkt bei 01 anfangen.
  const sammelOrdner = videoZiel;
  videoZiel = produktOrdner(sammelOrdner, produkt);
  try {
    fs.mkdirSync(videoZiel, { recursive: true });
  } catch (fehler) {
    melde(`❌ Produktordner nicht anlegbar: ${videoZiel} (${fehler.code || fehler.message})`);
    return 1;
  }
  melde(`   Ablage:  ${path.relative(sammelOrdner, videoZiel)}`);
  melde('');

  const index = ladeIndex(datenZiel);
  // Auch die Namen, die schon einmal vergeben waren — siehe naechsteNummer().
  const schonVergeben = [].concat(index.eintraege || [], index.frueher_geladen || [])
    .filter((e) => Number(e.produkt_id) === Number(produkt.id))
    .map((e) => e.datei)
    .filter(Boolean);
  let nummer = naechsteNummer(videoZiel, schonVergeben);
  const slug = slugFuerDateiname(produkt, videoZiel);
  let geladen = 0;
  let geprueft = 0;
  // Wenn TikTok dichtmacht, scheitert nicht EIN Video, sondern jedes.
  // Gemessen: Nach rund 50 Abrufen an einem Tag beantwortete TikTok auch eine
  // Adresse nicht mehr, die eine Stunde vorher noch funktioniert hatte —
  // Fehlermeldung "Unexpected response from webpage request", die in kein
  // Sperrmuster passt. Der Lauf haette danach alle restlichen Adressen
  // einzeln durchprobiert und jedes Mal dieselbe Antwort bekommen.
  //
  // Ein einzelner Fehlschlag heisst "dieses Video gibt es nicht mehr".
  // Fuenf hintereinander, ohne einen einzigen Erfolg dazwischen, heissen etwas
  // anderes: Die Gegenseite redet nicht mehr mit uns. Dann wird aufgehoert —
  // so steht es in der Aufgabenstellung, und Weiterprobieren waere genau das
  // Draufhalten, das eine Sperre erst verlaengert.
  const FEHLER_HINTEREINANDER = 5;
  let fehlerFolge = 0;

  // WIEVIELE ABRUFE DIESER LAUF DARF.
  //
  // "max_anfragen" (60) war auf drei bis fuenf Videos gemuenzt. Wer 30 will,
  // kommt damit nicht weit: Gemessen ueber mehrere echte Laeufe wird etwa
  // jede zehnte bis zwoelfte geprueffte Adresse ein brauchbares Video — der
  // Rest faellt durch Sprache, Ausschluss, Merkmale oder das Abhoeren.
  // Das Budget waechst deshalb MIT der gewuenschten Anzahl, statt sie
  // stillschweigend zu deckeln. Nach oben bleibt es begrenzt: 300 Abrufe mit
  // drei Sekunden Pause sind schon eine Viertelstunde Laufzeit, und laenger
  // ohne Zwischenstand am Stueck gegen TikTok zu laufen ist nicht klug.
  const anfrageBudget = Math.min(300, Math.max(standard.max_anfragen, anzahl * 12));
  if (anfrageBudget > standard.max_anfragen) {
    melde(`   Budget:  ${anfrageBudget} Abrufe (statt ${standard.max_anfragen}) — `
      + `${anzahl} Videos brauchen erfahrungsgemaess rund ${anzahl * 12}.`);
  }

  // PAUSE ZWISCHEN DEN ABRUFEN.
  //
  // "pause_zwischen_anfragen_sek" stand zwar in der Konfiguration, wirkte hier
  // aber nicht: Weitergereicht wurde sie als --sleep-requests, und das bremst
  // nur INNERHALB eines yt-dlp-Aufrufs. Jeder Abruf ist aber ein eigener
  // Prozess mit genau einer Adresse — zwischen zwei Abrufen lag also nichts.
  //
  // Das ist keine Theorie: Nach rund 50 Abrufen ohne Pause beantwortete TikTok
  // auch eine Adresse nicht mehr, die eine Stunde vorher noch ging. Ein Lauf,
  // der in die Ratenbegrenzung faehrt, bringt gar nichts mehr — die Pause ist
  // also nicht bloss Anstand, sie ist der guenstigere Weg.
  //
  // Umso wichtiger, seit die Suche statt rund zwei nun ueber hundert Adressen
  // je Anfrage liefert: Ohne Bremse waere daraus ein Dauerfeuer geworden.
  const warte = opt.warte || ((ms) => new Promise((fertig) => { setTimeout(fertig, ms); }));
  const pauseMs = Math.max(0, Number(standard.pause_zwischen_anfragen_sek) || 0) * 1000;

  let grundFuersEnde = 'Ziel erreicht';
  while (geladen < anzahl) {
    if (!warteschlange.length) {
      const gabEsWas = await nachschub();
      if (gabEsWas) continue;
      // Suchbegriffe erschoepft. Bevor der Lauf aufgibt: die zurueckgestellten
      // Kandidaten mit eigener Tonspur doch noch anhoeren.
      if (zweiteChance.length && !zweiteRunde) {
        zweiteRunde = true;
        melde('');
        melde(`🎧 Zweite Runde: ${zweiteChance.length} Video(s) mit eigener Tonspur werden `
          + 'jetzt doch geladen und abgehoert — die Tonspur ist nur ein Indiz.');
        warteschlange.push(...zweiteChance.splice(0));
        continue;
      }
      grundFuersEnde = sucheGescheitert
        ? `Suche nicht moeglich: ${sucheGescheitert}`
        : 'alle Suchbegriffe abgearbeitet, keine weiteren Adressen';
      break;
    }
    const kandidat = warteschlange.shift();
    const url = kandidat.url;
    if (!kandidat.meta) {
      if (gesehen.has(url)) continue;
      gesehen.add(url);
      if (schonImIndex(index, { url })) continue;
      if (geprueft >= anfrageBudget) {
        // Die Obergrenze zaehlt ABRUFE bei TikTok. Zurueckgestellte Kandidaten
        // brauchen keinen einzigen mehr — ihre Angaben liegen schon vor.
        // Sie deshalb mit abzuwuergen war schlicht falsch: Ein Lauf endete mit
        // "2 von 3", waehrend 39 fertig geprüfte Kandidaten unangetastet in der
        // zweiten Reihe standen.
        if (zweiteChance.length && !zweiteRunde) {
          zweiteRunde = true;
          melde('');
          melde(`⚠️  Anfrage-Obergrenze (${anfrageBudget}) erreicht — aber ${zweiteChance.length} `
            + 'Kandidat(en) sind schon geprueft und brauchen keinen weiteren Abruf.');
          melde('   Die zweite Runde laeuft noch.');
          warteschlange.length = 0;
          warteschlange.push(...zweiteChance.splice(0));
          continue;
        }
        melde('⚠️  Anfrage-Obergrenze erreicht.');
        grundFuersEnde = `Obergrenze von ${anfrageBudget} Anfragen erreicht`;
        break;
      }
      // Vor jedem Abruf ausser dem ersten. Nach einem zurueckgestellten
      // Kandidaten, der gar nicht abgerufen wurde, waere die Pause sinnlos —
      // deshalb steht sie hier drin und nicht am Schleifenanfang.
      if (geprueft > 0 && pauseMs) await warte(pauseMs);
      geprueft++;
    }

    // Zurueckgestellte Kandidaten bringen ihre Angaben mit — sonst waere jede
    // zweite Runde ein zweiter Satz Anfragen an TikTok fuer dieselben Videos.
    const meta = kandidat.meta || await holeEinzelMeta(opt.ytdlp, url);
    if (meta.gesperrt) {
      melde(`❌ TikTok blockt: ${meta.meldung}`);
      if (standard.bei_sperre_abbrechen !== false) break;
      continue;
    }
    if (meta.fehler) {
      melde(`⚠️  ${url}: ${meta.fehler}`);
      fehlerFolge++;
      if (fehlerFolge >= FEHLER_HINTEREINANDER) {
        melde('');
        melde(`⏹  ${fehlerFolge} Abrufe hintereinander gescheitert, keiner erfolgreich —`);
        melde('   TikTok beantwortet gerade keine Anfragen mehr. Der Lauf hoert hier auf,');
        melde('   statt die restlichen Adressen ebenfalls abzuklopfen.');
        melde('   Ursachen, nach Haeufigkeit:');
        melde('   1. Browser-Kennung fehlt:  py -m pip install curl_cffi');
        melde('      (wird beim Start geprueft — dann waere der Lauf gar nicht gestartet)');
        melde('   2. Veraltetes yt-dlp:  py -m pip install --upgrade yt-dlp');
        melde('   3. Zu viele Abrufe in kurzer Zeit — spaeter noch einmal versuchen.');
        grundFuersEnde = `${fehlerFolge} Abrufe hintereinander gescheitert (TikTok antwortet nicht)`;
        break;
      }
      continue;
    }
    fehlerFolge = 0;                            // es geht wieder
    if (schonImIndex(index, meta.video)) continue;

    // TONSPUR ALS REIHENFOLGE, NICHT ALS URTEIL.
    //
    // "original sound" heisst nur: Der Ton ist eine eigene Aufnahme statt eines
    // lizenzierten Titels. Das ist ein Indiz und sonst nichts — nachgemessen
    // lag es bei VIER von SIEBEN angeblichen Musikvideos falsch. Als hartes
    // Urteil ist es sogar teuer: In einem echten Lauf fielen so 24 von 33
    // Kandidaten raus, viele davon nachweislich still (Produktgeraeusche,
    // in der App hinterlegte Musik).
    //
    // Deshalb werden sie nur ZURUECKGESTELLT. Wer eine eigene Tonspur hat,
    // kommt zuletzt dran — und dann entscheidet nicht das Feld, sondern das
    // Abhoeren. So bleibt die guenstige Reihenfolge erhalten, ohne dass der
    // Lauf an einem unzuverlaessigen Indiz scheitert.
    if (nurMusik && !zweiteRunde && !istMusik(meta.video)) {
      zweiteChance.push({ url, meta });
      melde(`🎵 zurueckgestellt (eigene Tonspur): ${String(meta.video.title).slice(0, 45)}`);
      continue;
    }

    // Sprache des Untertitels. Die Auswahl steuerte anfangs nur die
    // Suchbegriffe — deutsche Begriffe liefern aber problemlos Videos mit
    // englischem Untertitel, genau das ist passiert.
    // Verlangt wird ein POSITIVER Nachweis der gewaehlten Sprache.
    // Zuerst war "nicht entscheidbar" durchgelassen — das war falsch: Genau so
    // kam ein Video mit dem Untertitel "#waterdispenser #bekasairkenduri"
    // durch, also malaiisch, obwohl deutsch gewaehlt war. Reine Hashtag-Zeilen
    // sind eben KEIN deutscher Untertitel, nur einer ohne erkennbare Sprache.
    // Der Preis ist bekannt und gewollt: Es kommt deutlich weniger durch.
    const textSprache = spracheDesTextes(
      `${meta.video.title || ''} ${meta.video.description || ''}`,
      hinweise,
    );
    if (textSprache !== sprache) {
      const gefunden = textSprache || 'nicht erkennbar (nur Hashtags)';
      melde(`🌐 andere Sprache (${gefunden}): ${String(meta.video.title).slice(0, 40)}`);
      continue;
    }

    // Zuerst die harte Ausschlussliste: Ein Katzenbrunnen bekommt bei
    // "automatischer Wasserspender" volle Punktzahl und ist trotzdem falsch.
    const verboten = ausschlussTreffer(meta.video, ausschluss);
    if (verboten) {
      melde(`⛔ ausgeschlossen ("${verboten}"): ${String(meta.video.title).slice(0, 45)}`);
      continue;
    }

    // Ohne ein Wort, das das Produkt benennt, zaehlt keine Bewertung.
    if (!hatKernwort(meta.video, kernwoerter)) {
      melde(`↩︎  kein Produktwort im Text: ${String(meta.video.title).slice(0, 45)}`);
      continue;
    }

    // GEHOERT DAS VIDEO UEBERHAUPT ZUM PRODUKT?
    // Diese Pruefung fehlte im gefuehrten Ablauf komplett — die Suchmaschine
    // liefert, was sie fuer aehnlich haelt, und das Ergebnis wanderte ungeprueft
    // in den Ordner. So kam bei Produkt 10 (Wasserspender) ein Video einer
    // Moebelmanufaktur an: Der Suchbegriff enthielt "Schreibtisch", und das
    // trifft eben auch Tischlerei.
    const bewertung = bewerte(gruppen, meta.video);
    if (bewertung.wert < schwelle || !bewertung.haelt) {
      const getroffen = bewertung.treffer.length ? bewertung.treffer.join(', ') : 'nichts';
      melde(`↩︎  passt nicht zum Produkt (${bewertung.wert}, trifft: ${getroffen}): `
        + `${String(meta.video.title).slice(0, 45)}`);
      continue;
    }
    // LETZTE PRUEFUNG VOR DEM LADEN — und die einzige, die fragt, ob es
    // wirklich DIESES Geraet ist. Alles davor prueft nur, ob es um die
    // richtige Sache geht: "Wasserspender" steht auch unter einem
    // Buero-Standgeraet, einem Kuehlschrankspender und einer Filterkanne.
    const merkmalTreffer = getroffeneMerkmale(meta.video, merkmale);
    if (merkmale.length && !merkmalTreffer.length) {
      melde(`🔬 kein Merkmal dieses Geraets (Flasche/Akku/Pumpe/Tisch): `
        + `${String(meta.video.title).slice(0, 42)}`);
      continue;
    }
    meta.video.wert = bewertung.wert;      // wandert in den Nachweis
    meta.video.merkmale = merkmalTreffer;  // desgleichen — belegt die Zuordnung

    const ergebnis = await holeUndSortiereEin({
      ytdlp: opt.ytdlp, kandidat: meta.video, produkt, slug, nummer,
      datenOrdner: datenZiel, videoOrdner: videoZiel, gitignore: opt.gitignore,
      // Wo die Datei WIRKLICH liegt. Ohne diese Angabe stand im Nachweis
      // weiter der Sammelordner, und ein Eintrag liess sich seiner Datei
      // nicht mehr zuordnen — genau das, wogegen der Nachweis da ist.
      ablage: path.join('Marketing/videos',
        path.relative(sammelOrdner, videoZiel)).split(path.sep).join('/'),
      wurzel: opt.wurzel, standard, jetzt, melde,
    });
    if (ergebnis.schreibsperre) {
      melde(`❌ ${ergebnis.grund}`);
      melde('');
      melde('   Zwei Wege:');
      melde('   1. Windows-Sicherheit → Viren- & Bedrohungsschutz → Ransomware-Schutz');
      melde('      → Ueberwachter Ordnerzugriff → node.exe und python.exe zulassen.');
      melde('   2. Oder die Ablage aus "Dokumente" herausnehmen, z.B. in der .env:');
      melde('        MARKETING_DATA_DIR=C:\\tiktok-rohmaterial');
      melde('        TIKTOK_VIDEO_DIR=C:\\tiktok-rohmaterial\\videos');
      melde('');
      melde('   Das Video selbst wurde geladen — nur das Ablegen scheiterte.');
      break;
    }
    if (!ergebnis.ok) { melde(`⚠️  ${url}: ${ergebnis.grund}`); if (ergebnis.gesperrt && standard.bei_sperre_abbrechen !== false) break; continue; }

    // JETZT ERST laesst sich der Ton wirklich pruefen — dafuer muss die Datei da
    // sein. Das track-Feld war nur eine Vermutung und lag bei vier von sieben
    // Videos falsch.
    const abgelegt = path.join(videoZiel, ergebnis.eintrag.datei);

    // Erst die billige Pruefung: Ist das bitgenau dieselbe Datei, die schon
    // im Ordner liegt? Dann weg damit, bevor der Spracherkenner anlaeuft.
    const dublette = schonAlsDateiDa(index, ergebnis.eintrag.sha256);
    if (dublette) {
      try { fs.unlinkSync(abgelegt); } catch { /* dann bleibt sie eben liegen */ }
      melde(`👯 identisch mit ${dublette.datei} (gleiche Pruefsumme, anderes Konto): `
        + `${String(meta.video.title).slice(0, 40)}`);
      continue;
    }

    // Abgehoert wird JEDES Video, nicht nur bei "keine Sprache". Vorher lief
    // der Erkenner nur im Musik-Fall — bei "mit Sprache" wurde ueberhaupt nicht
    // hingehoert, und die Sprachauswahl galt dort nur fuer den Untertitel.
    const hoeren = opt.pruefeSprache || pruefeSprache;
    const messung = hoeren(abgelegt, { python: opt.python, skript: opt.spracheSkript });
    const geredet = wirdGeredet(messung);
    if (nurMusik && geredet === true) {
      // Wieder wegraeumen: Der Nutzer wollte ausdruecklich kein Gerede.
      try { fs.unlinkSync(abgelegt); } catch { /* dann bleibt sie eben liegen */ }
      melde(`🗣  verworfen nach Tonpruefung (${messung.woerter} Woerter, `
        + `Redeanteil ${messung.redeanteil}): ${String(meta.video.title).slice(0, 40)}`);
      continue;
    }
    if (geredet === null) {
      // WICHTIG: Die Tonspur ist nur deshalb kein Urteil mehr, WEIL abgehoert
      // wird. Faellt das Abhoeren aus (Python fehlt, Datei unlesbar), ist sie
      // wieder das einzige Indiz — und dann gilt sie auch. Sonst waere die
      // Verbesserung im Fehlerfall eine Verschlechterung: "original sound"
      // kaeme durch, obwohl niemand hineingehoert hat.
      if (nurMusik && !istMusik(meta.video)) {
        try { fs.unlinkSync(abgelegt); } catch { /* dann bleibt sie eben liegen */ }
        melde(`🗣  verworfen: nicht abhoerbar (${messung && messung.grund}), und die `
          + `Tonspur ist eine eigene Aufnahme: ${String(meta.video.title).slice(0, 35)}`);
        continue;
      }
      melde(`⚠️  Tonpruefung nicht moeglich (${messung && messung.grund}) — `
        + 'es gilt nur die Angabe der Tonspur.');
    }
    // Wird geredet, muss es die gewaehlte Sprache sein. Bei Stille kein
    // Einwand — dann gibt es keine Ansage, die falsch sein koennte.
    if (sprachePasst(messung, sprache) === false) {
      try { fs.unlinkSync(abgelegt); } catch { /* dann bleibt sie eben liegen */ }
      const erkannt = messung.sprache
        ? `${messung.sprache}, Sicherheit ${messung.sprache_sicherheit}`
        : 'nicht erkennbar';
      melde(`🗣  Ansage in anderer Sprache (${erkannt}): `
        + `${String(meta.video.title).slice(0, 40)}`);
      continue;
    }
    if (messung && messung.ok) {
      const erkannt = gesprocheneSprache(messung);
      ergebnis.eintrag.redeanteil = messung.redeanteil;
      ergebnis.eintrag.woerter = messung.woerter;
      // null statt des Ratewerts: Bei 0 Woertern gibt es keine gesprochene
      // Sprache, und der Nachweis soll nichts behaupten, was nicht gemessen ist.
      ergebnis.eintrag.gesprochene_sprache = erkannt;
      ergebnis.eintrag.tonart = erkannt
        ? `abgehoert: gesprochen (${erkannt}, ${messung.woerter} Woerter, `
          + `Redeanteil ${messung.redeanteil})`
        : `abgehoert: es wird nicht gesprochen (${messung.woerter} Woerter, `
          + `Redeanteil ${messung.redeanteil})`;
    }

    index.eintraege.push(ergebnis.eintrag);
    speichereIndex(datenZiel, index);
    geladen++;
    nummer++;
    melde(`✅ ${ergebnis.eintrag.datei}  ← ${ergebnis.eintrag.creator}  (${ergebnis.eintrag.ton})`);
  }

  melde('');
  melde(`— ${geladen} von ${anzahl} gewuenschten Videos geladen, ${geprueft} Adresse(n) geprueft, `
    + `${naechsterBegriff} von ${begriffe.length} Suchbegriffen gebraucht.`);
  if (geladen) {
    melde(`   Ablage:  ${videoZiel}`);
    melde(`   Nachweis: ${indexPfad(datenZiel)}  (alle mit rechte_geprueft: false)`);
  }
  if (geladen < anzahl) {
    melde('');
    melde(`   Warum nicht mehr: ${grundFuersEnde}.`);
    if (!sucheGescheitert && naechsterBegriff >= begriffe.length) {
      melde('   Es wurde bis zum letzten Suchbegriff weitergesucht — mehr Adressen gab es nicht.');
      melde('   Zwei Hebel, in dieser Reihenfolge:');
      melde('   1. Weitere "suchbegriff"-Zeilen fuer dieses Produkt in tiktok-quellen.json.');
      melde('   2. Links von Hand unter "videos" eintragen.');
    }
  }
  // Nichts geladen ist kein Erfolg — sonst haelt ein Skript den Lauf fuer gut.
  return geladen > 0 ? 0 : 1;
}

// ── Kommandozeile ────────────────────────────────────────────────────

/** Wie in run-local.js: unlesbar -> Standardwert, lesbar aber unsinnig -> Grenze. */
function zahl(roh, standard, untergrenze, obergrenze) {
  const wert = parseFloat(roh);
  if (!Number.isFinite(wert)) return standard;
  return Math.min(obergrenze, Math.max(untergrenze, wert));
}

function leseArgumente(argv) {
  const opt = { status: false, laden: false, max: null, schwelle: null, hilfe: false,
                fund: null, schreiben: false, interaktiv: false, aufraeumen: false,
                ordner: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--status') opt.status = true;
    else if (a === '--ordner') opt.ordner = true;
    else if (a === '--aufraeumen') opt.aufraeumen = true;
    else if (a === '--interaktiv' || a === '--frage') opt.interaktiv = true;
    else if (a === '--laden') opt.laden = true;
    else if (a === '--schreiben') opt.schreiben = true;
    else if (a === '--fund') {
      // Alle folgenden Werte bis zum naechsten Schalter sind URLs.
      opt.fund = [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.fund.push(argv[++i]);
    }
    else if (a === '--max') opt.max = zahl(argv[++i], STANDARD.max_downloads, 0, 100);
    else if (a === '--schwelle') opt.schwelle = zahl(argv[++i], STANDARD.schwelle, 0, 1);
    else if (a === '--help' || a === '-h') opt.hilfe = true;
  }
  return opt;
}

/** Umgebungsvariablen als mittlere Ebene zwischen Datei und Kommandozeile. */
function ausUmgebung(env = process.env) {
  const werte = {};
  if (env.TIKTOK_SYNC_SCHWELLE) werte.schwelle = zahl(env.TIKTOK_SYNC_SCHWELLE, STANDARD.schwelle, 0, 1);
  if (env.TIKTOK_SYNC_MAX) werte.max_downloads = zahl(env.TIKTOK_SYNC_MAX, STANDARD.max_downloads, 0, 100);
  if (env.TIKTOK_SYNC_MAX_DATEIGROESSE) werte.max_dateigroesse = String(env.TIKTOK_SYNC_MAX_DATEIGROESSE).trim();
  return werte;
}

const FEHLT_HINWEIS = [
  '   yt-dlp ist ein externes Programm, kein npm-Paket — genau wie ffmpeg.',
  '   Installieren:  py -m pip install --upgrade yt-dlp',
  '            oder  winget install yt-dlp.yt-dlp',
  '   Fester Pfad moeglich ueber YTDLP_PATH=<pfad zur yt-dlp.exe>',
];

async function status() {
  const ordner = datenOrdner();
  console.log('── TikTok-Rohmaterial: Zustand ──────────────────────────────');
  console.log(`Ablageort:      ${ordner}`);
  console.log(`Konfiguration:  ${KONFIG_PFAD}${fs.existsSync(KONFIG_PFAD) ? '' : '   ⚠️  fehlt'}`);

  const notaus = notausGrund();
  console.log(`Notaus:         ${notaus ? '⏹  aktiv — ' + notaus : 'nicht aktiv'}`);

  try {
    const index = ladeIndex(ordner);
    const ungeprueft = index.eintraege.filter((e) => !e.rechte_geprueft).length;
    console.log(`Index:          ${index.eintraege.length} Eintraege, davon ${ungeprueft} ohne Rechtepruefung`);
    const verwaist = verwaisteEintraege(index, videoOrdnerAus(), ordner);
    if (verwaist.length) {
      console.log(`                ⚠️  ${verwaist.length} davon ohne Datei — aufraeumen: npm run tiktok:aufraeumen`);
    }
    const frueher = (index.frueher_geladen || []).length;
    if (frueher) console.log(`                ${frueher} frueher geladen und wieder entfernt (werden nicht neu geholt)`);
  } catch (fehler) {
    console.log(`Index:          ⚠️  ${fehler.message}`);
  }

  const gefunden = findeYtdlp();
  if (!gefunden) {
    console.log('yt-dlp:         ❌ nicht gefunden');
    console.log(`                versucht: ${(process.platform === 'win32'
      ? 'yt-dlp, yt-dlp.exe, py -m yt_dlp, python -m yt_dlp'
      : 'yt-dlp, python3 -m yt_dlp, python -m yt_dlp')}`);
    FEHLT_HINWEIS.forEach((z) => console.log(z));
    console.log('');
    console.log('Ohne yt-dlp laufen "tiktok:probe" und "tiktok:laden" nicht.');
    // Bewusst Code 0: Der Zustandsbericht hat seine Aufgabe erfuellt, wenn er
    // sagt, was fehlt. Ein Fehlercode wuerde ihn hinter npm-Rauschen begraben.
    return 0;
  }

  console.log(`yt-dlp:         ✅ ${gefunden.aufruf.join(' ')} (Version ${gefunden.version})`);
  const faehigkeiten = await tiktokFaehigkeiten(macheYtdlpAufruf(gefunden.aufruf));
  if (!faehigkeiten.ok) {
    console.log(`Extractors:     ⚠️  ${faehigkeiten.grund}`);
    return 0;
  }
  const nachahmung = await impersonationVerfuegbar(macheYtdlpAufruf(gefunden.aufruf));
  if (nachahmung.ok) {
    console.log(`Browser-Kennung: ✅ ${nachahmung.anzahl} Ziel(e) verfuegbar (curl_cffi)`);
  } else {
    console.log('Browser-Kennung: ❌ keine — TikTok wird JEDEN Abruf ablehnen');
    console.log('                 Behebt man mit:  py -m pip install curl_cffi');
    console.log('                 Ohne das Paket meldet yt-dlp "Unexpected response from');
    console.log('                 webpage request" — das klingt nach einem kaputten Video,');
    console.log('                 betrifft aber alle.');
  }
  console.log(`Extractors:     ${faehigkeiten.namen.join(', ') || '(keiner mit "tiktok" im Namen)'}`);
  console.log(`Hashtag-Seiten: ${faehigkeiten.kannHashtag ? 'ja' : 'nein — ' + faehigkeiten.hashtagGrund}`);
  console.log(`Stichwortsuche: ${faehigkeiten.kannSuche ? 'ja' : 'nein — ' + faehigkeiten.sucheGrund}`);
  if (!faehigkeiten.kannHashtag && !faehigkeiten.kannSuche) {
    console.log('');
    console.log('→ Nutzbar sind damit nur fest hinterlegte Video- und Creator-URLs.');
    console.log(`  Eintragen unter "produkte" in ${path.basename(KONFIG_PFAD)} (Felder "videos" und "creators").`);
  }
  return 0;
}

/**
 * Entfernt Eintraege, deren Datei es nicht mehr gibt.
 *
 * Zeigt standardmaessig nur an, was ginge. Geschrieben wird erst mit
 * --schreiben — dieselbe Linie wie beim Herunterladen, wo --laden noetig ist:
 * Erst sehen, was passiert, dann festschreiben. Ein Herkunftsnachweis ist
 * nichts, was ein Programm ungefragt kuerzen sollte.
 */
function aufraeumen(opt = {}) {
  const ordner = opt.datenOrdner || datenOrdner();
  const videoZiel = opt.videoOrdner || videoOrdnerAus();
  console.log('── Herkunftsnachweis aufraeumen ─────────────────────────────');
  console.log(`Index:     ${indexPfad(ordner)}`);
  console.log(`Videos:    ${videoZiel}`);

  let index;
  try {
    index = ladeIndex(ordner);
  } catch (fehler) {
    console.error(`❌ ${fehler.message}`);
    return 1;
  }

  const ergebnis = raeumeIndexAuf(index, { videoOrdner: videoZiel, datenOrdner: ordner });
  if (!ergebnis.entfernt.length) {
    console.log(`✅ Nichts aufzuraeumen — zu allen ${index.eintraege.length} Eintraegen gibt es eine Datei.`);
    return 0;
  }

  console.log('');
  console.log(`${ergebnis.entfernt.length} Eintrag/Eintraege ohne Datei:`);
  for (const e of ergebnis.entfernt) {
    console.log(`  · ${e.datei}   (Produkt ${e.produkt_id}, ${e.creator || 'ohne Creator'})`);
  }
  console.log('');
  console.log(`Danach: ${ergebnis.index.eintraege.length} Eintraege mit Datei, `
    + `${ergebnis.index.frueher_geladen.length} in "frueher_geladen".`);
  console.log('   Die entfernten Videos werden dadurch NICHT erneut geholt —');
  console.log('   ihre Kennungen bleiben in "frueher_geladen" stehen.');

  if (!opt.schreiben) {
    console.log('');
    console.log('   Nichts geaendert — das war eine Vorschau.');
    console.log('   Wirklich aufraeumen: npm run tiktok:aufraeumen -- --schreiben');
    return 0;
  }

  try {
    speichereIndex(ordner, ergebnis.index);
  } catch (fehler) {
    console.error(`❌ Index nicht schreibbar: ${fehler.message}`);
    return 1;
  }
  console.log('');
  console.log(`✅ ${ergebnis.entfernt.length} Eintrag/Eintraege entfernt.`);
  return 0;
}

async function main(argv) {
  const opt = leseArgumente(argv);

  if (opt.hilfe) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\*?|^ \* ?| \*$/gm, ''));
    return 0;
  }
  if (opt.status) return status();
  if (opt.ordner) {
    const basis = videoOrdnerAus();
    const alle = JSON.parse(fs.readFileSync(path.join(WURZEL, 'products.json'), 'utf8'));
    let ergebnis;
    try {
      ergebnis = legeProduktOrdnerAn(basis, alle);
    } catch (fehler) {
      console.error(`❌ Ordner nicht anlegbar: ${fehler.message}`);
      return 1;
    }
    console.log(`── Produktordner unter ${path.join(basis, ROHMATERIAL)} ──`);
    console.log(`${ergebnis.angelegt.length} neu angelegt, ${ergebnis.vorhanden.length} waren schon da.`);
    for (const o of ergebnis.angelegt) console.log('  + ' + path.basename(o));
    const schnitte = path.join(basis, GESCHNITTEN);
    if (!fs.existsSync(schnitte)) { fs.mkdirSync(schnitte, { recursive: true }); console.log('  + ' + GESCHNITTEN); }
    return 0;
  }
  // Vor der yt-dlp-Suche: Aufraeumen braucht kein yt-dlp, und wer gerade keins
  // hat, soll seinen Index trotzdem in Ordnung bringen koennen.
  if (opt.aufraeumen) return aufraeumen({ schreiben: opt.schreiben });

  const gefunden = findeYtdlp();
  if (!gefunden) {
    console.error('❌ yt-dlp nicht gefunden — ohne das Programm gibt es nichts zu holen.');
    FEHLT_HINWEIS.forEach((z) => console.error(z));
    console.error('   Zustand ohne yt-dlp ansehen: npm run tiktok:status');
    return 1;
  }

  const konfig = ladeKonfig();
  const standard = { ...konfig.standard, ...ausUmgebung() };
  const produkte = JSON.parse(fs.readFileSync(path.join(WURZEL, 'products.json'), 'utf8'));

  if (opt.interaktiv) {
    return interaktiv({
      ytdlp: macheYtdlpAufruf(gefunden.aufruf),
      produkte, konfig, standard,
      datenOrdner: datenOrdner(),
      stopDatei: STOP_DATEI,
    });
  }

  if (opt.fund) {
    if (!opt.fund.length) {
      console.error('❌ --fund braucht mindestens eine TikTok-URL.');
      console.error('   Beispiel: node tiktok-video-sync.js --fund https://www.tiktok.com/@handle/video/123');
      return 1;
    }
    const ergebnisFund = await finde({
      ytdlp: macheYtdlpAufruf(gefunden.aufruf),
      urls: opt.fund,
      produkte,
      konfig,
      stopDatei: STOP_DATEI,
      schwelle: opt.schwelle != null ? opt.schwelle : standard.schwelle,
      beiSperreAbbrechen: standard.bei_sperre_abbrechen,
    });
    if (ergebnisFund.abgebrochen) return 1;

    console.log('');
    console.log(`— zugeordnet: ${ergebnisFund.treffer.length} · daneben: ${ergebnisFund.daneben.length}`);
    if (opt.schreiben && ergebnisFund.treffer.length) {
      const neu = schreibeFund(KONFIG_PFAD, ergebnisFund.treffer);
      console.log(`✅ ${neu} neue URL(s) in ${path.basename(KONFIG_PFAD)} eingetragen.`);
      console.log('   Weiter mit: npm run tiktok:probe');
    } else if (ergebnisFund.treffer.length) {
      // Ohne --schreiben wird nur angezeigt. Gleiche Linie wie beim
      // Trockenlauf: Erst sehen, was passieren wuerde, dann festschreiben.
      console.log('   Nichts eingetragen — das war eine Vorschau. Mit --schreiben wird eingetragen.');
    }
    return 0;
  }

  const ergebnis = await lauf({
    ytdlp: macheYtdlpAufruf(gefunden.aufruf),
    produkte,
    konfig,
    standard,
    ordner: datenOrdner(),
    stopDatei: STOP_DATEI,
    laden: opt.laden,
    max: opt.max,
    schwelle: opt.schwelle,
  });

  return ergebnis.abgebrochen ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => { if (code) process.exit(code); })
    .catch((fehler) => {
      console.error(`❌ Abbruch: ${fehler.message}`);
      process.exit(1);
    });
}

module.exports = {
  datenOrdner, notausGrund, findeYtdlp, macheYtdlpAufruf, tiktokFaehigkeiten,
  ladeKonfig, konfigZuProdukt, normalisiere, zerlege, produktBegriffe, videoText,
  trefferwert, getroffeneBegriffe, belastbar,
  ladeIndex, speichereIndex, schonImIndex, schonAlsDateiDa, quellenFuer, lauf,
  dateiOrte, verwaisteEintraege, raeumeIndexAuf, aufraeumen,
  gesprocheneSprache, sprachePasst, SPRACHE_SICHER,
  holeEinzelMeta, finde, schreibeFund,
  leseArgumente, ausUmgebung, indexPfad, pruefListePfad, STANDARD,
  sucheAdressen, istMusik, pruefeSprache, wirdGeredet, begriffeFuer, begriffsGruppen, bewerte,
  impersonationVerfuegbar,
  ausschlussTreffer, spracheDesTextes, hatKernwort, sprachHinweise, textAusPuffern,
  stehtImText, VERNEINUNG,
  adressenAusText,
  hatMerkmal, getroffeneMerkmale,
  naechsteNummer, slugFuerDateiname, schuetzeDatei,
  produktOrdner, imRohmaterial, brauchtEinzelschutz, ROHMATERIAL, GESCHNITTEN,
  legeProduktOrdnerAn,
  holeUndSortiereEin, interaktiv, frageStelle, VIDEO_ORDNER, TIKTOK_VIDEO_MUSTER,
};
