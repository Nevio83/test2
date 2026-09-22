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
 * Jeder Clip traegt eine Rechteakte: Art der Erlaubnis, Datum, Rechteinhaber,
 * Kontakt, Beleg und Umfang (eigene Beitraege und/oder bezahlte Anzeigen).
 * Solange etwas davon fehlt, bleibt die Sperre zu — dieselbe Linie wie beim
 * Materialkatalog des Automaten ("ein Asset ohne Lizenzeintrag kommt nicht ins
 * Video. Punkt."). Ein blosses `rechte_geprueft: true` aus dem Altbestand gilt
 * als "geprueft, Art unbekannt" und reicht NICHT: Ein Wahrheitswert kann keine
 * Einwilligung belegen. Details: TIKTOK-VIDEO-SYNC.md.
 *
 * Aufruf:
 *     npm run tiktok:status              zeigt Vorbedingungen, laedt nichts
 *     npm run tiktok:probe               sucht + bewertet, laedt NICHTS
 *     npm run tiktok:laden -- --max 2    laedt hoechstens 2 Videos
 *     npm run tiktok                  gefuehrt: Produktnummer, Anzahl, fertig
 *
 *     node tiktok-video-sync.js --anfragen --absender "Name" --produkt 10 \
 *       --zwecke organisch anzeige --dauer "12 Monate" \
 *       --gegenleistung "das Geraet geschenkt"
 *                                     Anfragetexte an Creator — verschickt
 *                                     wird NICHTS, der Text geht ins Protokoll
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
  // Obergrenze der Pause. Ein FESTER Abstand ist selbst ein Muster: 3,00 s
  // zwischen jedem Abruf sieht fuer die Gegenseite genau nach dem aus, was es
  // ist. Gewuerfelt wird zwischen den beiden Werten.
  pause_hoechstens_sek: 12,
  // Wie lange ein erschoepfter Suchbegriff hinten ansteht, in Tagen.
  // 0 schaltet die Sortierung ab — dann gehen die Begriffe wie frueher der
  // Reihe nach raus.
  begriff_ruhe_tage: 21,
  // Zielzahl brauchbarer Clips je Produkt. Steuert, welches Produkt als
  // naechstes drankommt — nicht, wieviel ein einzelner Lauf laedt.
  ziel_clips_je_produkt: 15,
  // Ein Treffer muss UNTERSCHEIDEN: Mindestens ein Begriff, den hoechstens so
  // viele Produkte fuehren. 0 = aus.
  //
  // Gemessen an den gesammelten Untertiteln: Bei allen sechs angenommenen
  // Videos steht der unterscheidendste Treffer bei EINEM oder ZWEI Produkten.
  // Bei fremden Geraeten, die nur "usb/rechargeable/mini/portable" treffen,
  // bei sechs bis achtzehn. Der Abstand ist gross genug fuer eine Grenze.
  hoechstens_produkte_je_begriff: 2,
  // Hoechstalter eines Videos in Tagen. 0 = aus.
  //
  // BEWUSST AUS als Vorgabe. Die Reihenfolge nach Wachstum (Likes je Tag)
  // holt den Nutzen schon fast ganz, und zwar ohne Risiko. Eine Altersgrenze
  // wirft dagegen Material WEG, und wie alt das Material zu den vierzig
  // Produkten ueberhaupt ist, weiss hier niemand — der Index ist leer.
  // Erst messen (das Alter steht ab jetzt bei jedem Fund im Protokoll), dann
  // bewusst enger ziehen. 540 (18 Monate) ist ein brauchbarer Startwert.
  hoechstalter_tage: 0,
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
  // ── Technische Mindestanforderungen (Huerde 8) ─────────────────────
  // Die sieben Text-Huerden pruefen, ob es das RICHTIGE PRODUKT ist. Keine
  // prueft, ob der Clip technisch ueberhaupt zu gebrauchen ist. Ein Video mit
  // perfektem Untertitel kann 480p sein, drei Sekunden kurz oder Querformat —
  // und ist damit fuer einen 1080x1920-Schnitt wertlos.
  //
  // Die Werte entsprechen denen, gegen die der Marketing-Automat am ENDE
  // prueft (video.min_dauer_sek / video.hoehe in marketing.config.json). Was
  // dort durchfaellt, braucht hier gar nicht erst geladen zu werden.
  //
  // 0 schaltet die jeweilige Pruefung ab.
  min_hoehe: 720,
  min_dauer_sek: 5,
  // Querformat wird NICHT abgelehnt, nur vermerkt: Es taugt als Einblendung,
  // bloss nie als Vollbild. Ablehnen hiesse brauchbares Material wegwerfen.
  quer_ablehnen: false,
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
// ── Hashtags: Reichweite ist kein Inhalt ─────────────────────────────
//
// Eine TikTok-Unterschrift besteht meist aus zwei Teilen: ein kurzer Satz und
// danach zwanzig Hashtags, von denen die Haelfte nichts mit dem Video zu tun
// hat. Bis hierher wurden beide gleich behandelt — normalisiere() macht aus
// "#fyp" schlicht "fyp", und danach ist ein Reichweiten-Tag von einem
// Produktwort nicht mehr zu unterscheiden.
//
// WAS HIER ENTFERNT WIRD UND WAS NICHT
// Nur Tags, die REINE Reichweite meinen: #fyp, #viral, #trending. Sie stehen
// unter jedem zweiten Video und sagen ueber den Inhalt genau nichts.
//
// Fachliche Tags bleiben — und zwar bewusst. "#waterdispenser" ist oft das
// EINZIGE Produktwort einer Unterschrift; gemessen an den gesammelten
// Untertiteln faellt ein angenommenes Video weg, wenn man Hashtags pauschal
// abwertet ("The one thing you need on your nightstand💧#waterdispenser").
// Der Fehler steckt nicht in den Hashtags, sondern in den inhaltsleeren.
//
// Auch "#tiktokmademebuyit" bleibt: Es benennt keine Reichweite, sondern eine
// Produktvorfuehrung — genau das, wonach hier gesucht wird.
const REICHWEITEN_TAGS = [
  'fyp', 'fyp1', 'fypage', 'fypp', 'foryou', 'foryoupage', 'foryourpage',
  'forupage', 'foru', 'fy', 'fyi',
  'viral', 'viralvideo', 'viraltiktok', 'viralvideos', 'goviral', 'viralpost',
  'trending', 'trendingnow', 'trend', 'trends',
  'xyzbca', 'xyz', 'parati', 'paratii', 'paratiii',
  'fuerdich', 'fuerdichseite', 'dich', 'neuerkanal',
  'explore', 'explorepage', 'tiktokviral', 'tiktokdeutschland',
  'duet', 'stitch', 'capcut', 'followme', 'follow', 'likes', 'likeforlike',
];

/**
 * Trennt eine Unterschrift in Fliesstext und Hashtags.
 *
 * Gearbeitet wird auf dem ROHTEXT, nicht auf dem normalisierten: normalisiere()
 * wirft das Rautenzeichen weg, und danach ist die Trennung nicht mehr moeglich.
 *
 * Hashtags stehen nicht nur am Ende. "The one thing you need on your
 * nightstand💧#waterdispenser #bedroom" hat einen Tag mitten im Satz — deshalb
 * wird je Wort getrennt und nicht an der ersten Raute abgeschnitten.
 */
function trenneUnterschrift(text) {
  const roh = String(text == null ? '' : text);
  const hashtags = [];
  // Ein Tag endet am naechsten Leerzeichen, an der naechsten Raute oder am
  // Satzzeichen. Emojis und Zeilenumbrueche trennen ebenfalls.
  const ohneTags = roh.replace(/#([\p{L}\p{N}_]+)/gu, (_, wort) => {
    hashtags.push(String(wort));
    return ' ';
  });
  return { fliesstext: ohneTags.replace(/\s+/g, ' ').trim(), hashtags };
}

/** Hashtags ohne die, die nur Reichweite meinen. */
function inhaltsTags(hashtags, reichweite = REICHWEITEN_TAGS) {
  const raus = new Set([].concat(reichweite || []).map((w) => normalisiere(w)).filter(Boolean));
  return [].concat(hashtags || []).filter((tag) => {
    const sauber = normalisiere(tag);
    if (!sauber) return false;
    // Zusammengeschriebene Ketten wie "fypviral" faengt das absichtlich NICHT:
    // Wer "#wasserspenderfyp" schreibt, meint trotzdem den Wasserspender.
    return !raus.has(sauber);
  });
}

/**
 * Wieviel FLIESSTEXT hat eine Unterschrift?
 *
 * Die Vorpruefung urteilt erst ab 25 Zeichen — und das war bisher die Laenge
 * des GANZEN Textes. Eine Unterschrift aus zwanzig Hashtags hat leicht 200
 * Zeichen und trotzdem keinen Satz; sie wurde beurteilt, als staende dort
 * etwas. Umgekehrt heisst wenig Fliesstext ab jetzt: nicht urteilen, normal
 * abrufen. Das ist die richtige Richtung — abgelehnt wird nur auf positiven
 * Beweis.
 */
function fliesstextLaenge(text) {
  return trenneUnterschrift(text).fliesstext.length;
}

function videoText(video) {
  const teile = [];
  // Fliesstext und Inhaltstags getrennt einsammeln, damit die
  // Reichweiten-Tags gar nicht erst in den Bewertungstext geraten.
  for (const feld of [video.title, video.fulltitle, video.description]) {
    if (!feld) continue;
    const { fliesstext, hashtags } = trenneUnterschrift(feld);
    if (fliesstext) teile.push(fliesstext);
    const inhalt = inhaltsTags(hashtags);
    if (inhalt.length) teile.push(inhalt.join(' '));
  }
  for (const liste of [video.tags, video.hashtags, video.categories]) {
    if (Array.isArray(liste)) {
      const inhalt = inhaltsTags(liste);
      if (inhalt.length) teile.push(inhalt.join(' '));
    }
  }
  return normalisiere(teile.filter(Boolean).join(' '));
}

/**
 * Derselbe Text, aber NUR der Fliesstext — ohne jeden Hashtag.
 *
 * Gebraucht fuer die Frage "steht das Produktwort im Satz oder nur in der
 * Tag-Wolke?". Ein Treffer im Satz ist das staerkere Signal; als Ausschluss
 * taugt die Unterscheidung nicht (siehe REICHWEITEN_TAGS), als Entscheidung
 * bei Gleichstand schon.
 */
function videoFliesstext(video) {
  const teile = [];
  for (const feld of [video.title, video.fulltitle, video.description]) {
    if (!feld) continue;
    const { fliesstext } = trenneUnterschrift(feld);
    if (fliesstext) teile.push(fliesstext);
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
// ── Bildfingerabdruck: derselbe Clip, neu kodiert ────────────────────
//
// WAS DIE PRUEFSUMME NICHT FAENGT
//
// Der Index erkennt Dubletten heute an drei Stellen: gleiche Quell-Adresse,
// gleiche Video-ID (dasselbe Video unter mehreren Adressen) und gleiche
// SHA-256-Summe (dieselbe Datei unter einem anderen Konto). Alle drei
// scheitern am haeufigsten Fall auf TikTok: Ein Repost wird NEU KODIERT —
// andere Aufloesung, andere Bitrate, manchmal ein Rand. Das Bild ist
// dasselbe, die Pruefsumme eine voellig andere.
//
// WIE ES HIER GELOEST IST
// Aus dem Clip werden vier winzige Graustufenbilder gezogen (9x8 Pixel) und
// je Bild ein dHash gerechnet: Vergleiche jedes Pixel mit seinem rechten
// Nachbarn, ein Bit je Vergleich, 64 Bit je Bild. Das ueberlebt Skalierung,
// Bitrate und maessige Helligkeitsaenderungen — und braucht keine einzige
// zusaetzliche Bibliothek. ffmpeg liefert die Rohbytes direkt.
//
// AN ECHTEM MATERIAL GEMESSEN, nicht geschaetzt: Ein neu kodierter Clip
// (720p statt 1080p, halbe Bitrate) liegt bei 0 bis 4 Bit Abstand, zwei
// verschiedene Clips desselben Produkts bei ueber 20. Die Zahlen stehen im
// Handbuch.

// Ab wieviel Bit Unterschied zwei Bilder als verschieden gelten.
// 64 Bit je Bild; 10 ist etwa ein Sechstel.
// AN ECHTEM MATERIAL GEMESSEN, an fuenf Clips desselben Produkts und drei
// nachgebauten Reposts:
//
//     Repost 720p, halbe Bitrate      0 bis 1 Bit
//     Repost 576p, leicht aufgehellt  0 bis 1 Bit
//     Repost mit schwarzem Rand       5 bis 9 Bit
//     verschiedene Clips (10 Paare)   19 bis 40 Bit
//
// Das Fenster fuer die Schwelle ist also 10 bis 18. 12 liegt in der Mitte —
// Abstand nach beiden Seiten, statt knapp neben dem schwierigsten Fall.
const BILD_ABSTAND_MAX = 12;

// Wieviele der vier Bilder uebereinstimmen muessen. Zwei von vier: Ein
// einzelnes gleiches Bild kann Zufall sein (zwei Clips mit weissem
// Hintergrund), vier zu verlangen scheitert an einem eingeblendeten Text.
const BILDER_GLEICH_NOETIG = 2;

// Wo die Bilder gezogen werden. Wie beim Kontaktbogen NICHT bei 0 %: Das
// erste Bild eines TikToks ist oft schwarz oder ein Titeleinblender, und
// zwei schwarze Anfaenge sind kein Beleg fuer dasselbe Video.
const BILD_MARKEN = [0.10, 0.35, 0.60, 0.85];

/**
 * dHash eines 9x8-Graustufenbildes: 64 Bit als 16 Hexzeichen.
 *
 * Neun Spalten fuer acht Vergleiche je Zeile — deshalb 9x8 und nicht 8x8.
 */
function dHash(bytes) {
  if (!bytes || bytes.length < 72) return null;
  let bits = '';
  for (let zeile = 0; zeile < 8; zeile++) {
    for (let spalte = 0; spalte < 8; spalte++) {
      const links = bytes[zeile * 9 + spalte];
      const rechts = bytes[zeile * 9 + spalte + 1];
      bits += links > rechts ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Wieviele Bits unterscheiden zwei dHashes? 64 = maximal verschieden. */
function bitAbstand(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let abstand = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { abstand += x & 1; x >>= 1; }
  }
  return abstand;
}

/**
 * Vier Bildfingerabdruecke eines Videos. [] wenn ffmpeg nicht kann.
 *
 * Ein leeres Ergebnis ist ein Befund und kein Fehler: Dann greift weiterhin
 * die Pruefsumme, und es wird nichts abgelehnt, was nicht belegt ist.
 */
// ── Schwarze Balken: was von der Datei wirklich Bild ist ─────────────
//
// Viel Material auf TikTok ist bereits umformatiert: ein Querformat-Video mit
// schwarzen Balken oben und unten, oder ein Hochformat mit verwaschenem
// Hintergrund. Die DATEI misst dann 1080x1920 und besteht die technische
// Huerde — der echte Bildinhalt ist aber viel kleiner.
//
// Wer so einen Clip ungeprueft in einen 1080x1920-Schnitt legt, bekommt
// Balken im Balken. Das sieht billig aus und ist der erste Eindruck.
//
// GEMESSEN an einem nachgebauten Letterbox-Clip: cropdetect meldet
// "crop=1080:1620:0:150" — 300 Zeilen Rand, also 15,6 % der Hoehe. Bei einem
// echten Clip ohne Balken: "crop=1080:1920:0:0".

// Ab wieviel Prozent Randanteil gilt ein Clip als umformatiert. 5 % ist
// genug Spielraum fuer eine dunkle Szene am Bildrand und eng genug, um
// echte Balken zu fassen.
const RAND_ANTEIL_MELDEN = 0.05;

/**
 * Welcher Bildausschnitt ist wirklich Bild? null, wenn nicht messbar.
 *
 * Gemessen wird ZWEI SEKUNDEN aus der Mitte, nicht der ganze Clip: Eine
 * Blende am Anfang macht jedes Video kurz schwarz, und cropdetect wuerde
 * daraus einen Rand von hundert Prozent lesen.
 */
function randErkennung(ffmpeg, videoPfad, dauer, { lauf = null } = {}) {
  if (!ffmpeg) return null;
  const starte = lauf || ((werkzeug, argumente) => spawnSync(werkzeug, argumente, {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  }));
  const mitte = dauer > 4 ? dauer * 0.4 : 0;
  const ergebnis = starte(ffmpeg, [
    '-loglevel', 'info',
    '-ss', mitte.toFixed(2),
    '-t', '2',
    '-i', videoPfad,
    '-vf', 'cropdetect=24:2:0',
    '-f', 'null', '-',
  ]);
  if (!ergebnis) return null;
  const text = `${ergebnis.stderr || ''}${ergebnis.stdout || ''}`;
  // Die LETZTE Meldung nehmen: cropdetect tastet sich ueber die Sekunden
  // heran, und der letzte Wert ist der ueber das ganze Fenster gemittelte.
  const treffer = [...String(text).matchAll(/crop=(\d+):(\d+):(-?\d+):(-?\d+)/g)];
  if (!treffer.length) return null;
  const [, breite, hoehe, x, y] = treffer[treffer.length - 1];
  return { breite: Number(breite), hoehe: Number(hoehe), x: Number(x), y: Number(y) };
}

/**
 * Wieviel der Flaeche ist Rand? 0 = kein Rand, 0.5 = die Haelfte.
 *
 * Gibt null zurueck, wenn eine der Angaben fehlt — "nicht messbar" ist etwas
 * anderes als "kein Rand", und die Unterscheidung entscheidet hier darueber,
 * ob abgelehnt wird.
 */
function randAnteil(datei, ausschnitt) {
  const bV = Number(datei && datei.breite);
  const hV = Number(datei && datei.hoehe);
  if (!bV || !hV || !ausschnitt || !ausschnitt.breite || !ausschnitt.hoehe) return null;
  const flaecheGanz = bV * hV;
  const flaecheBild = ausschnitt.breite * ausschnitt.hoehe;
  if (!flaecheGanz || flaecheBild > flaecheGanz) return 0;
  return Math.round((1 - flaecheBild / flaecheGanz) * 1000) / 1000;
}

/**
 * Taugt der ECHTE Bildinhalt noch? Gibt den Grund zurueck, sonst null.
 *
 * Huerde 8 misst die Datei. Diese Pruefung misst, was davon Bild ist — die
 * Ausgangspruefung des Automaten lehnt am Ende genau das ab, und vorne fragte
 * es bisher niemand.
 */
function randUntauglich(ausschnitt, standard = STANDARD) {
  if (!ausschnitt) return null;              // nicht messbar ist kein Urteil
  const minHoehe = Number(standard.min_hoehe) || 0;
  if (minHoehe && ausschnitt.hoehe && ausschnitt.hoehe < minHoehe) {
    return `echter Bildinhalt nur ${ausschnitt.hoehe} Pixel hoch`;
  }
  return null;
}

/**
 * ffmpeg finden — oder ehrlich sagen, dass es fehlt.
 *
 * Gleiche Linie wie findeYtdlp() und findeWerkzeug() im Kontaktbogen. Ohne
 * ffmpeg faellt nur der Bildfingerabdruck aus; der Lauf geht weiter, und die
 * Pruefsumme greift wie bisher. Ein fehlendes Werkzeug darf nicht heissen,
 * dass nichts mehr geladen wird.
 */
function findeFfmpeg(env = process.env) {
  const ausEnv = String(env.FFMPEG_PFAD || env.FFMPEG || '').trim();
  const kandidaten = ausEnv
    ? [ausEnv]
    : (process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']);
  for (const kandidat of kandidaten) {
    const lauf = spawnSync(kandidat, ['-version'], { encoding: 'utf8' });
    if (lauf.status === 0) return kandidat;
  }
  return null;
}

// ── Werkzeugversionen (Punkt 72) ─────────────────────────────────────
//
// Die ganze Kette haengt an zwei fremden Programmen. yt-dlp aendert sich fast
// woechentlich, weil sich die Plattformen aendern — die Lehre aus dem
// CURRENTLY-BROKEN-Marker am Hashtag-Extractor ist genau die: Faehigkeiten
// verschwinden, ohne dass jemand es sagt. Umgekehrt ist ein zu altes yt-dlp der
// haeufigste Grund fuer ploetzlich scheiternde Abrufe.
//
// Wenn ein Lauf scheitert, soll die erste Frage — hat sich das Werkzeug
// geaendert? — in einer Zeile beantwortet sein statt in einer Stunde Suche.

/** Die erste Zeile einer Versionsausgabe, gekuerzt. Leer heisst: nicht da. */
function ersteZeile(text, hoechstens = 120) {
  return String(text || '').split(/\r?\n/)[0].trim().slice(0, hoechstens);
}

/**
 * Version von ffmpeg. null, wenn es nicht da ist.
 *
 * `ffmpeg -version` schreibt "ffmpeg version 6.1.1-..." in die erste Zeile.
 * Herausgeloest wird nur die Versionsnummer — der Rest ist Bauinformation und
 * macht jeden Vergleich zwischen zwei Laeufen unleserlich.
 */
function ffmpegVersion(ffmpeg, starte = null) {
  if (!ffmpeg) return null;
  const ruf = starte || ((w, a) => spawnSync(w, a, { encoding: 'utf8' }));
  try {
    const ergebnis = ruf(ffmpeg, ['-version']);
    if (!ergebnis || ergebnis.status !== 0) return null;
    const zeile = ersteZeile(ergebnis.stdout);
    const treffer = zeile.match(/ffmpeg version (\S+)/i);
    return treffer ? treffer[1] : (zeile || null);
  } catch {
    return null;
  }
}

/**
 * Was dieser Lauf an Werkzeug vorgefunden hat — in einer Zeile.
 *
 * Bewusst OHNE eigene Aufrufe, wo es geht: Die yt-dlp-Version faellt bei
 * findeYtdlp() ohnehin ab, die Faehigkeiten stehen nach tiktokFaehigkeiten()
 * fest. Ein zusaetzlicher Abruf nur fuer das Protokoll waere ein Abruf zu viel.
 */
function werkzeugStand({ ytdlpVersion = null, ffmpeg = null, faehigkeiten = null,
                         starte = null } = {}) {
  const stand = {
    yt_dlp: ytdlpVersion ? ersteZeile(ytdlpVersion, 40) : null,
    ffmpeg: ffmpegVersion(ffmpeg, starte),
    node: process.version,
  };
  if (faehigkeiten) {
    // Die Faehigkeiten gehoeren dazu: Eine neue yt-dlp-Version kann dieselbe
    // Nummer behalten und trotzdem einen Extractor verloren haben.
    stand.hashtag = !!faehigkeiten.kannHashtag;
    stand.suche = !!faehigkeiten.kannSuche;
    stand.extractors = [].concat(faehigkeiten.namen || []).length;
  }
  return stand;
}

/** Eine Zeile fuers Protokoll. Fehlendes wird benannt, nicht verschwiegen. */
function werkzeugZeile(stand) {
  const teile = [
    `yt-dlp ${stand.yt_dlp || '?'}`,
    `ffmpeg ${stand.ffmpeg || 'fehlt'}`,
    `node ${stand.node}`,
  ];
  if (stand.hashtag !== undefined) {
    teile.push(`Hashtag ${stand.hashtag ? 'ja' : 'nein'}`);
    teile.push(`Suche ${stand.suche ? 'ja' : 'nein'}`);
  }
  return teile.join(' · ');
}

/**
 * Hat sich seit dem letzten Lauf etwas am Werkzeug geaendert?
 *
 * Gibt die Unterschiede als lesbare Zeilen zurueck, leer heisst gleich. Nur
 * Felder, die in BEIDEN Staenden stehen — ein neu hinzugekommenes Feld ist
 * keine Aenderung am Werkzeug, sondern eine an diesem Programm.
 */
function werkzeugUnterschied(vorher, jetzt) {
  if (!vorher || !jetzt) return [];
  const namen = { yt_dlp: 'yt-dlp', ffmpeg: 'ffmpeg', node: 'Node',
                  hashtag: 'Hashtag-Extractor', suche: 'Such-Extractor',
                  extractors: 'TikTok-Extractors' };
  const zeilen = [];
  for (const [feld, name] of Object.entries(namen)) {
    if (!(feld in vorher) || !(feld in jetzt)) continue;
    if (vorher[feld] === jetzt[feld]) continue;
    const alt = vorher[feld] === null ? 'fehlt' : String(vorher[feld]);
    const neu = jetzt[feld] === null ? 'fehlt' : String(jetzt[feld]);
    zeilen.push(`${name}: ${alt} → ${neu}`);
  }
  return zeilen;
}

function bildFingerabdruck(ffmpeg, videoPfad, dauer, { lauf = null } = {}) {
  if (!ffmpeg) return [];
  const starte = lauf || ((werkzeug, argumente) => spawnSync(werkzeug, argumente, {
    maxBuffer: 4 * 1024 * 1024, encoding: 'buffer',
  }));
  const abdruecke = [];
  for (const marke of BILD_MARKEN) {
    const zeitpunkt = dauer > 0 ? (dauer * marke) : 1;
    const ergebnis = starte(ffmpeg, [
      '-loglevel', 'error',
      '-ss', zeitpunkt.toFixed(2),
      '-i', videoPfad,
      '-frames:v', '1',
      // Auf 9x8 zusammenstauchen und entfaerben: Was uebrig bleibt, ist die
      // grobe Helligkeitsverteilung — genau das, was eine Neukodierung
      // unveraendert laesst.
      '-vf', 'scale=9:8,format=gray',
      '-f', 'rawvideo', '-',
    ]);
    if (!ergebnis || ergebnis.status !== 0 || !ergebnis.stdout) continue;
    const abdruck = dHash(ergebnis.stdout);
    if (abdruck) abdruecke.push(abdruck);
  }
  return abdruecke;
}

/**
 * Ist das derselbe Clip, nur neu kodiert?
 *
 * Verglichen wird Bild gegen Bild an derselben Stelle. Der Reihe nach, nicht
 * jeder gegen jeden: Zwei Clips, die dieselbe Szene an verschiedenen Stellen
 * zeigen, sind NICHT dasselbe Video — und ein Vergleich aller gegen alle
 * wuerde sie dazu erklaeren.
 */
function gleichesBild(a, b, { abstand = BILD_ABSTAND_MAX, noetig = BILDER_GLEICH_NOETIG } = {}) {
  const eins = [].concat(a || []);
  const zwei = [].concat(b || []);
  if (eins.length < noetig || zwei.length < noetig) return false;
  let gleich = 0;
  for (let i = 0; i < Math.min(eins.length, zwei.length); i++) {
    if (bitAbstand(eins[i], zwei[i]) <= abstand) gleich++;
  }
  return gleich >= noetig;
}

/**
 * Schon als Bild im Index? Findet auch neu kodierte Reposts.
 *
 * Nebenbei die Antwort auf eine Frage, die Punkt 63 braucht: Liegt derselbe
 * Clip unter vier Konten, ist der mit dem fruehesten Datum der wahrscheinliche
 * Urheber.
 */
function schonAlsBildDa(index, abdruecke, opt = {}) {
  if (!abdruecke || abdruecke.length < BILDER_GLEICH_NOETIG) return null;
  return (index.eintraege || []).find(
    (e) => gleichesBild(e.bild_abdruck, abdruecke, opt)) || null;
}

// ── Wo fehlt Material? (Punkt 12) ────────────────────────────────────
//
// "Genug Material" war bisher ein Gefuehl. Nachgezaehlt am 18.09.: Von 41
// angelegten Produktordnern sind DREI gefuellt — 25 Clips beim Wasserspender,
// fuenf beim Mixer, einer bei der Massagepistole. 38 sind leer.
//
// Der Bot arbeitet aber gleichmaessig ueber alles. Er legt dort nach, wo schon
// 25 Clips liegen, mit derselben Wahrscheinlichkeit wie dort, wo nichts ist.

/**
 * Wieviele brauchbare Clips liegen je Produkt — und wieviele fehlen?
 *
 * Gezaehlt werden Eintraege im Index, nicht Dateien im Ordner: Ein Eintrag
 * ohne Datei ist kein Vorrat, eine Datei ohne Eintrag ist keine Herkunft.
 */
function bestandJeProdukt(index, produkte, { ziel = 15 } = {}) {
  const gezaehlt = new Map();
  for (const e of (index.eintraege || [])) {
    const id = Number(e.produkt_id);
    if (!Number.isFinite(id)) continue;
    gezaehlt.set(id, (gezaehlt.get(id) || 0) + 1);
  }
  return [].concat(produkte || []).map((p) => {
    const vorhanden = gezaehlt.get(Number(p.id)) || 0;
    return {
      id: Number(p.id),
      name: p.name,
      vorhanden,
      ziel,
      luecke: Math.max(ziel - vorhanden, 0),
    };
  });
}

/**
 * Produkte in der Reihenfolge, in der sie Material brauchen.
 *
 * Groesste Luecke zuerst; bei Gleichstand die kleinere Nummer, damit zwei
 * Laeufe dieselbe Reihenfolge ergeben und man nicht raet, warum sich etwas
 * geaendert hat.
 *
 * @param {boolean} [opt.alle]  volle Produkte nicht weglassen, sondern ans
 *   Ende stellen. Fuer den Ladelauf ueber ALLE Produkte: Dort soll nichts
 *   stillschweigend verschwinden, nur weil gerade genug da ist — ein
 *   Trockenlauf haette sonst ploetzlich Luecken im Bericht.
 */
function produkteNachLuecke(index, produkte, opt = {}) {
  const sortiert = bestandJeProdukt(index, produkte, opt)
    .sort((a, b) => b.luecke - a.luecke || a.id - b.id);
  return opt.alle ? sortiert : sortiert.filter((p) => p.luecke > 0);
}

// ── Gute Creator wiederfinden (Punkt 02) ─────────────────────────────
//
// Jeder Eintrag traegt seit jeher den Creator. Die Spalte wurde bisher nur
// mitgeschrieben, nie gelesen — dabei ist sie das staerkste Signal im ganzen
// Index: Wer einmal einen brauchbaren Clip zum Wasserspender gemacht hat,
// macht mit hoher Wahrscheinlichkeit weitere.
//
// WAS HIER NICHT GEZAEHLT WIRD
// Ablehnungen. Sie fallen, bevor etwas geladen ist — da gibt es nur den
// Untertitel aus dem Seitentext, keinen Creator. "Ab drei Ablehnungen fliegt
// er raus" waere also eine Regel ohne Daten. Gezaehlt wird, was belegt ist:
// angenommene Clips.

/** Profil-Adresse aus einer Video-Adresse. null, wenn keine drinsteht. */
function creatorProfil(quelleUrl, creator) {
  const ausUrl = String(quelleUrl || '').match(/https?:\/\/(?:www\.)?tiktok\.com\/(@[\w.-]+)/i);
  if (ausUrl) return `https://www.tiktok.com/${ausUrl[1]}`;
  const name = String(creator || '').trim().replace(/^@+/, '');
  return name ? `https://www.tiktok.com/@${name}` : null;
}

/**
 * Wie oft hat welcher Creator brauchbares Material geliefert?
 *
 * @param {number} [nurProdukt]  nur dieses Produkt zaehlen. Ohne Angabe alle —
 *   wer beim Wasserspender liefert, liefert nicht zwangslaeufig beim Mixer.
 */
function creatorBilanz(index, { nurProdukt = null } = {}) {
  const bilanz = new Map();
  for (const e of (index.eintraege || [])) {
    if (nurProdukt != null && Number(e.produkt_id) !== Number(nurProdukt)) continue;
    const name = String(e.creator || '').trim();
    if (!name) continue;
    if (!bilanz.has(name)) {
      bilanz.set(name, { creator: name, angenommen: 0, profil: null, produkte: new Set() });
    }
    const eintrag = bilanz.get(name);
    eintrag.angenommen += 1;
    eintrag.produkte.add(Number(e.produkt_id));
    if (!eintrag.profil) eintrag.profil = creatorProfil(e.quelle_url, name);
  }
  return [...bilanz.values()]
    .map((e) => ({ ...e, produkte: [...e.produkte].sort((a, b) => a - b) }))
    .sort((a, b) => b.angenommen - a.angenommen || a.creator.localeCompare(b.creator));
}

/**
 * Creator, die es wert sind, gezielt wieder besucht zu werden.
 *
 * Ab zwei angenommenen Clips. Einer kann Zufall sein — ein Video, das durch
 * die Kette kam, weil der Untertitel zufaellig passte. Zwei ist ein Muster.
 */
function creatorQuellen(index, { nurProdukt = null, abMindestens = 2, hoechstens = 8 } = {}) {
  return creatorBilanz(index, { nurProdukt })
    .filter((e) => e.angenommen >= abMindestens && e.profil)
    .slice(0, hoechstens)
    .map((e) => ({ art: 'creator', url: e.profil, creator: e.creator,
                   angenommen: e.angenommen }));
}

// ── Erschoepfte Suchbegriffe (Punkt 01) ──────────────────────────────
//
// tiktok-quellen.json haelt 984 Suchbegriffe ueber alle 40 Produkte. Die
// gehen einer nach dem anderen raus, und das Budget liegt bei 60 Abrufen —
// die REIHENFOLGE entscheidet also, welche ueberhaupt drankommen. Bisher war
// das immer dieselbe: von vorne.
//
// Gemessen: Der zweite Lauf mit identischem Aufruf brachte 0 Downloads. Das
// ist korrektes Verhalten des Index — die Themenseite war abgegrast. Es heisst
// aber, dass die QUELLE erschoepft ist, nicht der Markt. Wer denselben Begriff
// beim naechsten Lauf wieder an die erste Stelle setzt, verbrennt das Budget
// an einer Seite, die er schon kennt.
//
// AUSSORTIERT WIRD NICHTS. Ein erschoepfter Begriff wandert nach hinten und
// kommt nach der Ruhezeit wieder vor — eine Themenseite fuellt sich nach.

/** Bilanz aller Begriffe eines Produkts aus dem Index. */
function begriffsBilanz(index, produktId) {
  const alle = (index && index.begriffe) || {};
  return { ...(alle[String(produktId)] || {}) };
}

/**
 * Suchbegriffe in die Reihenfolge bringen, in der sie noch etwas bringen.
 *
 * ZWEI TEILE. Erstens eine Ruhezeit fuer Begriffe, die leer ausgegangen sind —
 * und zwar eine, die mit jedem Leerlauf laenger wird: einmal leer heisst
 * "ruheTage" Pause, dreimal leer hintereinander heisst dreimal so lang.
 * Zweitens, unter den wachen Begriffen, ein schlichtes Reihum: wer am
 * laengsten nicht dran war, kommt zuerst.
 *
 *   1. wach vor ruhend
 *   2. nie benutzte zuerst — sie sind der unerschlossene Teil
 *   3. dann die, die am laengsten nicht benutzt wurden
 *   4. dann die mit den wenigsten Leerlaeufen hintereinander
 *   5. bei Gleichstand die urspruengliche Reihenfolge
 *
 * WARUM STUFE 3 AM LETZTEN GEBRAUCH HAENGT UND NICHT AM LETZTEN FUND
 * Erst stand da "aeltester Fund zuerst". Damit landete ein Begriff, der noch
 * NIE etwas geliefert hat, ganz vorne: Er hat kein Funddatum, das zaehlt als
 * Jahr 0, und Jahr 0 ist aelter als alles. Ausgerechnet der aussichtsloseste
 * Begriff haette das Budget bekommen. Der zweite Versuch — "wenigste
 * Leerlaeufe zuerst" als feste Stufe davor — kippte in den anderen Graben:
 * Ein Begriff mit fuenf Leerlaeufen waere nie wieder drangekommen, solange
 * irgendein anderer noch bei null steht. Das ist Aussortieren durch die
 * Hintertuer, und genau das soll hier nicht passieren.
 *
 * Der letzte Gebrauch loest beides: Er ist immer gesetzt, sobald ein Begriff
 * einmal draussen war, und er waechst bei jedem, der wartet. Das Bremsen
 * uebernimmt allein die Ruhezeit — befristet, mit Obergrenze.
 *
 * @param {number} [hoechstensRuhe]  Vielfaches, ab dem die Ruhezeit nicht
 *   weiter waechst. Ohne Deckel waere ein Begriff nach genug Leerlaeufen
 *   faktisch ausgemustert — bei 21 Tagen und zwanzig Leerlaeufen ueber ein
 *   Jahr Pause.
 */
function begriffeSortiert(begriffe, bilanz, {
  ruheTage = 21, hoechstensRuhe = 6, jetzt = new Date(),
} = {}) {
  const liste = [].concat(begriffe || []);
  const stand = bilanz || {};

  return liste
    .map((begriff, platz) => {
      const b = stand[begriff] || {};
      const leerFolge = Number(b.leer_in_folge) || 0;
      const leerSeit = b.leer_seit ? new Date(b.leer_seit).getTime() : null;
      // Je Leerlauf eine Runde laenger, gedeckelt.
      const ruheMs = Math.max(0, ruheTage) * 86400000
        * Math.min(Math.max(leerFolge, 1), Math.max(1, hoechstensRuhe));
      const ruht = leerSeit != null && !Number.isNaN(leerSeit)
        && (jetzt.getTime() - leerSeit) < ruheMs;
      const nieBenutzt = !b.zuletzt_benutzt;
      const benutzt = b.zuletzt_benutzt ? new Date(b.zuletzt_benutzt).getTime() : 0;
      return { begriff, platz, ruht, nieBenutzt, benutzt, leerFolge };
    })
    .sort((a, b) => {
      if (a.ruht !== b.ruht) return a.ruht ? 1 : -1;
      if (a.nieBenutzt !== b.nieBenutzt) return a.nieBenutzt ? -1 : 1;
      if (a.benutzt !== b.benutzt) return a.benutzt - b.benutzt;
      if (a.leerFolge !== b.leerFolge) return a.leerFolge - b.leerFolge;
      return a.platz - b.platz;
    })
    .map((e) => e.begriff);
}

/**
 * Was ein Begriff gebracht hat, im Index festhalten.
 *
 * @param {number} neu  wieviele NEUE Adressen er geliefert hat. 0 heisst
 *   erschoepft — der Begriff ruht dann eine Weile.
 */
function vermerkeBegriff(index, produktId, begriff, neu, jetzt = new Date()) {
  if (!index.begriffe) index.begriffe = {};
  const schluessel = String(produktId);
  if (!index.begriffe[schluessel]) index.begriffe[schluessel] = {};
  const stand = index.begriffe[schluessel][begriff] || {};
  const zeit = jetzt.toISOString();
  stand.zuletzt_benutzt = zeit;
  if (neu > 0) {
    stand.zuletzt_neu = zeit;
    stand.leer_seit = null;
    stand.leer_in_folge = 0;
  } else {
    stand.leer_seit = stand.leer_seit || zeit;
    stand.leer_in_folge = (stand.leer_in_folge || 0) + 1;
  }
  index.begriffe[schluessel][begriff] = stand;
  return stand;
}

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

// ── Die Messlatte waechst mit (Punkt 20) ─────────────────────────────
//
// Die Pruefkette wurde nicht an ausgedachten Beispielen entwickelt, sondern an
// 80 echten Untertiteln aus den eigenen Protokollen: vorher 22 angenommen,
// davon 4 falsch — nachher 18 angenommen, 0 falsch, ohne dass ein richtiger
// Treffer verlorenging.
//
// NUR EINES FEHLTE: Die Sammlung waechst nicht von selbst. Bei 492 Suchbegriffen
// und 403 Kernwoertern, die weiterwachsen, bleibt die Messlatte sonst bei 80
// Untertiteln aus dem August stehen — und jede weitere Verschaerfung ist dann
// Hoffnung statt Messung.
//
// GESAMMELT WIRD DAS URTEIL, NICHT DER TEST.
// Aus dieser Datei wird kein Test erzeugt. Sie ist Material: Wer die Wortlisten
// aendert, laesst sie gegenlaufen und sieht, welche Urteile sich verschoben
// haben. Ein Test, der sich seine eigene Erwartung schreibt, kann nur gruen
// werden — und ein Test, der nur gruen werden kann, ist wertlos (CLAUDE.md §2).

const URTEILE_DATEI = 'urteile.json';
const URTEILE_HOECHSTENS = 2000;

function urteilePfad(ordner) { return path.join(ordner, URTEILE_DATEI); }

/**
 * Ein gefaelltes Urteil zur Sammlung legen.
 *
 * Erkannt wird ein bereits gesammelter Fall an der Video-ID, nicht am Text:
 * Derselbe Clip taucht unter mehreren Adressen auf, und zwei Eintraege mit
 * demselben Untertitel wuerden die Statistik verdoppeln.
 *
 * @param {string} urteil  'angenommen' oder der Ablehnungsgrund
 */
function sammleUrteil(sammlung, { video_id, titel, produkt_id, urteil, wert = null,
                                  jetzt = new Date() } = {}) {
  const liste = (sammlung && sammlung.urteile) || [];
  const text = String(titel || '').trim();
  if (!text) return sammlung || { version: 1, urteile: [] };
  const id = video_id != null ? String(video_id) : null;
  const schonDa = liste.find((u) => (id && String(u.video_id) === id)
    || (!id && u.titel === text && Number(u.produkt_id) === Number(produkt_id)));
  if (schonDa) {
    // Das Urteil kann sich geaendert haben — die Wortlisten wachsen ja. Genau
    // diese Aenderung ist das Interessante, also wird sie festgehalten.
    if (schonDa.urteil !== urteil) {
      schonDa.vorher = schonDa.urteil;
      schonDa.urteil = urteil;
      schonDa.geaendert_am = jetzt.toISOString();
    }
    return sammlung;
  }
  liste.push({
    video_id: id, titel: text.slice(0, 200), produkt_id: Number(produkt_id) || null,
    urteil, wert, gesehen_am: jetzt.toISOString(),
  });
  return {
    version: 1,
    // Die aeltesten fallen heraus, wenn es zu viele werden. Die Datei liegt
    // neben dem Index und wird bei jedem Lauf geschrieben.
    urteile: liste.slice(-URTEILE_HOECHSTENS),
  };
}

/** Die Sammlung lesen. Fehlt sie, ist sie leer — das ist kein Fehler. */
function ladeUrteile(ordner) {
  try {
    const gelesen = JSON.parse(fs.readFileSync(urteilePfad(ordner), 'utf8'));
    return (gelesen && Array.isArray(gelesen.urteile)) ? gelesen : { version: 1, urteile: [] };
  } catch {
    return { version: 1, urteile: [] };
  }
}

function speichereUrteile(ordner, sammlung) {
  try {
    fs.writeFileSync(urteilePfad(ordner), `${JSON.stringify(sammlung, null, 2)}\n`, 'utf8');
    return urteilePfad(ordner);
  } catch {
    return null;    // nicht schreibbar ist kein Grund, den Lauf zu faerben
  }
}

/** Was die Sammlung ueber die Pruefkette sagt. */
function urteilsBilanz(sammlung) {
  const liste = (sammlung && sammlung.urteile) || [];
  const gruende = new Map();
  let angenommen = 0;
  let gekippt = 0;
  for (const u of liste) {
    if (u.urteil === 'angenommen') angenommen++;
    else gruende.set(u.urteil, (gruende.get(u.urteil) || 0) + 1);
    if (u.vorher) gekippt++;
  }
  return {
    gesamt: liste.length,
    angenommen,
    abgelehnt: liste.length - angenommen,
    // Faelle, deren Urteil sich seit dem ersten Mal geaendert hat. DAS ist der
    // Wert der Sammlung: Wer die Wortlisten verschaerft, sieht hier sofort,
    // wie viele frueher angenommene Clips jetzt durchfallen.
    gekippt,
    gruende: [...gruende.entries()].map(([grund, anzahl]) => ({ grund, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl),
  };
}

// ── Rechteakte je Clip (Punkt 63) ────────────────────────────────────
//
// DER VERGLEICH MACHT DIE LUECKE SICHTBAR. Der Materialkatalog des Automaten
// setzt die Regel hart durch: "Ein Asset ohne Lizenzeintrag kommt nicht ins
// Video. Punkt." Der Bot dagegen hatte ein einzelnes `rechte_geprueft: false`,
// das "nur von Hand" umgestellt wird. Was, wann, durch wen und in welchem
// Umfang geprueft wurde, stand nirgends.
//
// EIN WAHRHEITSWERT KANN KEINE EINWILLIGUNG BELEGEN.
// Heute war es verkehrt herum: Ein Pexels-Bild brauchte einen Lizenzeintrag,
// ein fremder TikTok-Clip nur ein Haekchen — und zwar genau das Material mit
// dem hoechsten Risiko. Ein Video laesst sich auf TikTok nicht nachtraeglich
// kurz zurueckholen.
//
// WAS HIER NICHT ENTSCHIEDEN WIRD
// Ob eine Erlaubnis rechtlich traegt. Das ist keine Frage, die ein Programm
// beantwortet. Festgehalten wird, WAS vorliegt und was fehlt — und solange
// etwas fehlt, bleibt die Sperre zu.

/** Wie die Erlaubnis zustande kam. */
const RECHTE_ARTEN = {
  eigen: 'eigenes Material — keine fremden Rechte betroffen',
  einwilligung: 'Creator hat ausdruecklich zugestimmt',
  lizenz: 'kostenpflichtige oder freie Lizenz mit Nachweis',
  keine: 'keine Erlaubnis — nur internes Referenzmaterial',
};

/** Wofuer die Erlaubnis gilt. Beides getrennt, weil es rechtlich getrennt ist. */
const RECHTE_ZWECKE = ['organisch', 'anzeige'];

/**
 * Die Rechtelage eines Eintrags, in einheitlicher Form.
 *
 * Liest BEIDE Schreibweisen: die neue Akte und das alte `rechte_geprueft`.
 * Ein altes `true` wird dabei NICHT zu "einwilligung" aufgewertet — es wird zu
 * "geprueft, Art unbekannt". Aus einem Haekchen nachtraeglich eine Einwilligung
 * zu machen waere genau die Behauptung, die dieser Punkt abstellen soll.
 */
function rechteAkte(eintrag) {
  const akte = (eintrag && eintrag.rechte) || null;
  if (akte && akte.art) {
    return {
      art: akte.art,
      datum: akte.datum || null,
      inhaber: akte.inhaber || (eintrag && eintrag.creator) || null,
      kontakt: akte.kontakt || (eintrag && eintrag.quelle_url) || null,
      beleg: akte.beleg || null,
      zwecke: [].concat(akte.zwecke || []).filter((z) => RECHTE_ZWECKE.includes(z)),
      bis: akte.bis || null,
      widerrufen_am: akte.widerrufen_am || null,
      quelle: 'akte',
    };
  }
  // Altbestand: nur der Wahrheitswert.
  const haken = !!(eintrag && eintrag.rechte_geprueft);
  return {
    art: haken ? 'unbekannt' : 'keine',
    datum: null,
    inhaber: (eintrag && eintrag.creator) || null,
    kontakt: (eintrag && eintrag.quelle_url) || null,
    beleg: null,
    zwecke: [],
    bis: null,
    widerrufen_am: null,
    quelle: 'altbestand',
  };
}

/**
 * Was der Akte noch fehlt, damit sie etwas belegt.
 *
 * @returns {string[]} leer heisst vollstaendig.
 */
function rechteLuecken(eintrag) {
  const a = rechteAkte(eintrag);
  if (a.art === 'eigen') return [];            // eigenes Material braucht nichts
  if (a.art === 'keine') return ['keine Erlaubnis eingeholt'];
  const fehlt = [];
  if (a.art === 'unbekannt') fehlt.push('Art der Erlaubnis (nur ein altes Haekchen)');
  if (!a.datum) fehlt.push('Datum der Erlaubnis');
  if (!a.inhaber) fehlt.push('Rechteinhaber');
  if (!a.kontakt) fehlt.push('Kontakt zum Rechteinhaber');
  if (!a.beleg) fehlt.push('Beleg (Screenshot, Mail, Lizenzdatei)');
  if (!a.zwecke.length) fehlt.push('Umfang (organisch und/oder Anzeige)');
  return fehlt;
}

/**
 * Darf dieser Clip fuer DIESEN Zweck veroeffentlicht werden?
 *
 * DIE SPERRE IST ZU, SOLANGE ETWAS FEHLT — dieselbe Linie wie beim
 * Materialkatalog. Und sie ist je Zweck getrennt: Eine Einwilligung fuer einen
 * organischen Beitrag deckt keine bezahlte Anzeige. Das ist kein Formalismus,
 * sondern der haeufigste Punkt, an dem eine Zusage endet.
 *
 * @returns {{ok:boolean, grund?:string}}
 */
function darfVeroeffentlicht(eintrag, { zweck = 'organisch', jetzt = new Date() } = {}) {
  if (!RECHTE_ZWECKE.includes(zweck)) {
    return { ok: false, grund: `unbekannter Zweck "${zweck}" (erlaubt: ${RECHTE_ZWECKE.join(', ')})` };
  }
  const a = rechteAkte(eintrag);
  if (a.widerrufen_am) {
    return { ok: false, grund: `widerrufen am ${String(a.widerrufen_am).slice(0, 10)}` };
  }
  if (a.art === 'eigen') return { ok: true };
  const luecken = rechteLuecken(eintrag);
  if (luecken.length) return { ok: false, grund: luecken.join('; ') };
  if (!a.zwecke.includes(zweck)) {
    return { ok: false, grund: `Erlaubnis deckt ${a.zwecke.join(' und ')}, nicht "${zweck}"` };
  }
  if (a.bis) {
    const ende = Date.parse(a.bis);
    if (Number.isFinite(ende) && ende < jetzt.getTime()) {
      return { ok: false, grund: `Erlaubnis lief am ${String(a.bis).slice(0, 10)} aus` };
    }
  }
  return { ok: true };
}

/**
 * Eine Rechteakte eintragen.
 *
 * Wie setzeZustand(): kein Wurf, sondern eine Antwort — ein Tippfehler soll
 * keinen Lauf beenden.
 */
function setzeRechte(eintrag, { art, datum = null, inhaber = null, kontakt = null,
                                beleg = null, zwecke = [], bis = null,
                                jetzt = new Date() } = {}) {
  if (!eintrag) return { ok: false, grund: 'kein Eintrag' };
  if (!RECHTE_ARTEN[art]) {
    return { ok: false, grund: `unbekannte Art "${art}" (erlaubt: ${Object.keys(RECHTE_ARTEN).join(', ')})` };
  }
  const saubereZwecke = [].concat(zwecke || []).filter((z) => RECHTE_ZWECKE.includes(z));
  const unbekannt = [].concat(zwecke || []).filter((z) => !RECHTE_ZWECKE.includes(z));
  if (unbekannt.length) {
    return { ok: false, grund: `unbekannter Zweck: ${unbekannt.join(', ')}` };
  }
  eintrag.rechte = {
    art,
    datum: datum || jetzt.toISOString(),
    inhaber: inhaber || eintrag.creator || null,
    kontakt: kontakt || eintrag.quelle_url || null,
    beleg,
    zwecke: saubereZwecke,
    bis,
    widerrufen_am: null,
  };
  // Der alte Wahrheitswert bleibt — Marketing-Abfragen lesen ihn noch. Er ist
  // ab jetzt ABGELEITET und nicht mehr die Wahrheit selbst.
  eintrag.rechte_geprueft = darfVeroeffentlicht(eintrag, { zweck: 'organisch', jetzt }).ok;
  return { ok: true };
}

/** Eine Erlaubnis zurueckziehen. Der Eintrag bleibt — der Widerruf gehoert zur Akte. */
function widerrufeRechte(eintrag, { jetzt = new Date() } = {}) {
  if (!eintrag || !eintrag.rechte) return { ok: false, grund: 'keine Akte vorhanden' };
  eintrag.rechte.widerrufen_am = jetzt.toISOString();
  eintrag.rechte_geprueft = false;
  return { ok: true };
}

/** Wie steht es um die Rechte im ganzen Index? */
function rechteBilanz(index, { zweck = 'organisch', jetzt = new Date() } = {}) {
  const zaehler = { frei: 0, gesperrt: 0, widerrufen: 0 };
  const nachArt = new Map();
  const luecken = new Map();
  for (const e of (index.eintraege || [])) {
    const a = rechteAkte(e);
    nachArt.set(a.art, (nachArt.get(a.art) || 0) + 1);
    if (a.widerrufen_am) { zaehler.widerrufen++; continue; }
    const urteil = darfVeroeffentlicht(e, { zweck, jetzt });
    if (urteil.ok) { zaehler.frei++; continue; }
    zaehler.gesperrt++;
    for (const l of rechteLuecken(e)) luecken.set(l, (luecken.get(l) || 0) + 1);
  }
  return {
    ...zaehler,
    zweck,
    nachArt: [...nachArt.entries()].map(([art, anzahl]) => ({ art, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl),
    luecken: [...luecken.entries()].map(([was, anzahl]) => ({ was, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl),
  };
}

// ── Anfragen an Creator (Punkt 64) ───────────────────────────────────
//
// Eine Einwilligung ist der einzige saubere Weg: Ein fremder Clip in einem
// gewerblichen Werbeclip ist keine Grauzone. Ohne Vorlage wird jede Anfrage neu
// formuliert, mal vollstaendig, mal nicht — und dann fehlt genau die Zeile zum
// Umfang, also der Punkt, an dem eine Zusage spaeter endet.
//
// WAS DIE VORLAGE LEISTET UND WAS NICHT
// Sie stellt die Frage vollstaendig. Sie verschickt nichts, und sie behauptet
// nichts: Alles, was drinsteht, kommt aus dem Index (Creator, Adresse,
// Untertitel) oder aus den uebergebenen Angaben. Fehlt eine Angabe, steht eine
// Luecke da — kein erfundener Firmenname.

/** Was in einer Anfrage nicht fehlen darf. */
const ANFRAGE_FELDER = ['absender', 'produkt'];

/**
 * Anfragetext fuer EINEN Clip, deutsch oder englisch.
 *
 * @param {object} eintrag  Indexeintrag — liefert Creator, Adresse, Untertitel.
 * @param {object} opt.absender      wer fragt (Name, Shop)
 * @param {string} opt.produkt       wofuer der Clip gebraucht wird
 * @param {string[]} opt.zwecke      'organisch' und/oder 'anzeige'
 * @param {string} [opt.dauer]       wie lange, im Klartext ("12 Monate")
 * @param {string} [opt.gegenleistung] Produkt, Gutschein, Verguetung
 * @param {string} [opt.nennung]     wie genannt wird ("@handle im Video")
 * @returns {{ok:boolean, text?:string, an?:string, fehlt?:string[]}}
 */
function creatorAnfrage(eintrag, opt = {}) {
  // Mehrere Clips desselben Menschen gehoeren in EINE Nachricht — und muessen
  // dann auch alle darin stehen. Eine Anfrage, die "dein Video X" sagt und
  // spaeter zehn verwendet, ist keine Einwilligung fuer die zehn.
  const weitere = [].concat(opt.weitereAdressen || []).filter(Boolean);
  const fehlt = ANFRAGE_FELDER.filter((f) => !String(opt[f] || '').trim());
  const zwecke = [].concat(opt.zwecke || []).filter((z) => RECHTE_ZWECKE.includes(z));
  if (!zwecke.length) fehlt.push('zwecke');
  if (fehlt.length) return { ok: false, fehlt };

  const sprache = opt.sprache === 'en' ? 'en' : 'de';
  const handle = String((eintrag && eintrag.creator) || '').replace(/^@+/, '');
  const adresse = (eintrag && eintrag.quelle_url) || null;
  const titel = String((eintrag && eintrag.titel) || '').trim().slice(0, 80);
  const profil = creatorProfil(adresse, handle);

  // Der Clip muss eindeutig benannt sein. "dein Video" reicht nicht — ein
  // Creator hat hunderte, und eine Zusage zu "einem davon" belegt nichts.
  const clip = adresse || (titel ? `"${titel}"` : null);
  if (!clip) return { ok: false, fehlt: ['clip nicht eindeutig benennbar (weder Adresse noch Titel)'] };
  const alleAdressen = [adresse, ...weitere].filter(Boolean)
    .filter((u, i, liste) => liste.indexOf(u) === i);
  const mehrere = alleAdressen.length > 1;

  const dauer = String(opt.dauer || '').trim();
  const gegenleistung = String(opt.gegenleistung || '').trim();
  const nennung = String(opt.nennung || '').trim();

  if (sprache === 'de') {
    const zweckText = zwecke.includes('anzeige') && zwecke.includes('organisch')
      ? 'in eigenen Beitraegen UND in bezahlten Anzeigen'
      : zwecke.includes('anzeige') ? 'in bezahlten Anzeigen' : 'in eigenen Beitraegen';
    const zeilen = [
      handle ? `Hallo @${handle},` : 'Hallo,',
      '',
      // BEWUSST NICHT "ich verkaufe <Produktname>": Der Name kommt im Nominativ
      // aus products.json ("Elektrischer Wasserspender"), und "verkaufe"
      // verlangt den Akkusativ. Ein Doppelpunkt umgeht die Beugung, statt sie
      // falsch zu raten.
      `ich bin ${opt.absender} und verkaufe in meinem Shop: ${opt.produkt}.`,
      '',
      ...(mehrere
        ? [`Von dir haben mir ${alleAdressen.length} Videos gefallen, und ich wuerde gern`,
           `fragen, ob ich Ausschnitte daraus verwenden darf — ${zweckText}.`,
           '',
           'Konkret geht es um diese:',
           ...alleAdressen.map((u) => `· ${u}`)]
        : [`Dein Video ${clip} passt sehr gut dazu, und ich wuerde gern fragen, ob ich`,
           `einen Ausschnitt daraus verwenden darf — ${zweckText}.`]),
      '',
      'Damit du weisst, worauf du dich einlaesst:',
      `· Wofuer:        ${zweckText}`,
      `· Wie lange:     ${dauer || '(bitte eintragen)'}`,
      `· Nennung:       ${nennung || 'gern so, wie du es moechtest — sag mir einfach wie'}`,
      `· Gegenleistung: ${gegenleistung || '(bitte eintragen)'}`,
      '',
      'Wenn dir etwas davon nicht passt, sag es gern — daran soll es nicht',
      'scheitern. Und wenn du spaeter deine Meinung aenderst, nehme ich es',
      'selbstverstaendlich wieder raus.',
      '',
      'Ein kurzes "ja, in Ordnung" von dir reicht mir als Nachweis.',
      '',
      'Viele Gruesse',
      String(opt.absender),
    ];
    return { ok: true, an: profil, text: zeilen.join('\n') };
  }

  const zweckText = zwecke.includes('anzeige') && zwecke.includes('organisch')
    ? 'in my own posts AND in paid ads'
    : zwecke.includes('anzeige') ? 'in paid ads' : 'in my own posts';
  const zeilen = [
    handle ? `Hi @${handle},` : 'Hi,',
    '',
    `I'm ${opt.absender} and I sell ${opt.produkt}.`,
    '',
    ...(mehrere
      ? [`I really liked ${alleAdressen.length} of your videos and would like to ask`,
         `whether I may use short sections of them — ${zweckText}.`,
         '',
         'These are the ones:',
         ...alleAdressen.map((u) => `· ${u}`)]
      : [`Your video ${clip} fits really well, and I'd like to ask whether I may use`,
         `a short section of it — ${zweckText}.`]),
    '',
    'So you know exactly what you would be agreeing to:',
    `· Where:         ${zweckText}`,
    `· How long:      ${dauer || '(please fill in)'}`,
    `· Credit:        ${nennung || "however you prefer — just tell me how"}`,
    `· In return:     ${gegenleistung || '(please fill in)'}`,
    '',
    "If any of that doesn't work for you, just say so. And if you change your",
    'mind later, I will take it down, no questions asked.',
    '',
    'A short "yes, that\'s fine" is all I need as a record.',
    '',
    'Thanks,',
    String(opt.absender),
  ];
  return { ok: true, an: profil, text: zeilen.join('\n') };
}

/**
 * Anfragen fuer alle Clips, deren Rechte noch offen sind.
 *
 * EIN CREATOR, EINE ANFRAGE. Wer fuenf Clips desselben Menschen geladen hat,
 * schreibt ihn nicht fuenfmal an — das ist der schnellste Weg zu einer
 * Absage. Die Clips stehen dann gesammelt in einer Nachricht.
 *
 * Zuerst die Creator mit den meisten Clips: Dort lohnt eine dauerhafte
 * Absprache am ehesten (siehe Punkt 02).
 */
function offeneAnfragen(index, opt = {}) {
  const jeCreator = new Map();
  for (const e of (index.eintraege || [])) {
    if (opt.nurProdukt != null && Number(e.produkt_id) !== Number(opt.nurProdukt)) continue;
    const a = rechteAkte(e);
    if (a.art === 'eigen') continue;                 // nichts zu fragen
    if (a.art === 'einwilligung' || a.art === 'lizenz') continue;   // schon da
    const handle = String(e.creator || '').trim();
    if (!handle) continue;                           // ohne Creator kein Adressat
    if (!jeCreator.has(handle)) jeCreator.set(handle, []);
    jeCreator.get(handle).push(e);
  }
  return [...jeCreator.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([creator, eintraege]) => {
      const anfrage = creatorAnfrage(eintraege[0], {
        ...opt,
        weitereAdressen: eintraege.slice(1).map((e) => e.quelle_url).filter(Boolean),
      });
      const profil = creatorProfil(eintraege[0].quelle_url, creator);
      // Die Adresse gewinnt gegen den Namen — sie ist das, was TikTok selbst
      // ausliefert. Gehen beide auseinander, ist das ein Hinweis und keine
      // Nebensache: Dann fuehrt die Anfrage womoeglich zum falschen Konto.
      const ausName = creatorProfil('', creator);
      return {
        creator,
        clips: eintraege.length,
        adressen: eintraege.map((e) => e.quelle_url).filter(Boolean),
        profil,
        handleWeichtAb: !!(profil && ausName && profil !== ausName),
        ...anfrage,
      };
    });
}

// ── Fremde Werbung erkennen (Punkt 24) ───────────────────────────────
//
// Ein Teil des gefundenen Materials ist die Werbung eines Mitbewerbers: fremder
// Rabattcode, fremder Shop, Kennzeichnungspflicht-Hinweis. Als Anschauung
// brauchbar, im eigenen Clip ein Eigentor — und rechtlich der klarste Fall von
// allen.
//
// WAS HIER NICHT PASSIERT: ABLEHNEN.
// Der Clip wird MARKIERT, nicht verworfen. Zwei Gruende. Erstens ist die
// laufende Mitbewerber-Beobachtung ein Nebenprodukt, das sonst niemand macht.
// Zweitens ist die Erkennung Textarbeit und damit unscharf: "Werbung" steht
// auch unter Videos, die nur erklaeren, dass sie keine sind. Eine Markierung
// darf danebenliegen, eine Ablehnung soll es nicht.
//
// GEPRUEFT WIRD NUR DER TEXT. Sichtbare Shop-Namen im Bild braeuchten
// Texterkennung (Punkt 30) und sind hier ausdruecklich nicht abgedeckt.

const WERBE_SIGNALE = [
  // Kennzeichnung — in beiden Sprachen die verlaesslichsten Woerter.
  { muster: /\b(werbung|anzeige|gesponsert|sponsored|paid partnership)\b/i, art: 'kennzeichnung' },
  // Nur MIT Raute: "ad" als blosses Wort ist zu duenn — es steckt in "Gadget",
  // und als Abkuerzung steht es in jeder zweiten englischen Unterschrift.
  { muster: /#(ad|werbung|anzeige|sponsored|paidpartnership)\b/i, art: 'kennzeichnung' },
  // Rabatt und Code — "code XY20", "10% off", "rabattcode".
  { muster: /\b(rabattcode|gutscheincode|discount code|promo ?code|coupon)\b/i, art: 'rabatt' },
  // WAS EINEN CODE VON EINEM WORT UNTERSCHEIDET: eine Ziffer oder durchgehende
  // Grossschreibung. Ein blosses /i ueber "code \w+" traefe "no code needed"
  // und "I code for a living"; nur Grossschreibung zu verlangen verpasst das
  // haeufige "code save20" in einer kleingeschriebenen Unterschrift.
  { muster: /\b[Cc][Oo][Dd][Ee]\s+(?=[A-Za-z0-9]{3,12}\b)[A-Za-z0-9]*\d[A-Za-z0-9]*\b/, art: 'rabatt' },
  { muster: /\b[Cc][Oo][Dd][Ee]\s+[A-Z]{3,12}\b/, art: 'rabatt' },
  { muster: /\b\d{1,2}\s?% ?(off|rabatt)\b/i, art: 'rabatt' },
  // Kaufaufforderung mit Weg — der Link in der Bio ist das haeufigste Signal.
  { muster: /\b(link in (der )?bio|linkinbio|link in my bio|shop now|jetzt shoppen|jetzt kaufen)\b/i, art: 'kaufweg' },
  { muster: /\b(tiktok ?shop|amazon\.[a-z]{2,3}|temu|shopee|aliexpress)\b/i, art: 'fremder shop' },
];

/**
 * Der Text eines Videos, UNVERAENDERT — mit Gross-/Kleinschreibung und Rauten.
 *
 * videoText() taugt hier nicht: Es macht aus "#ad" ein blosses "ad" und
 * schreibt alles klein. Beides braucht diese Pruefung aber. Ohne die Raute ist
 * "ad" ein Allerweltswort (es steckt in jedem "Gadget"), und ohne
 * Grossschreibung ist "Code SAVE20" von "code save20" nicht zu trennen — und
 * damit von jedem Satz, in dem das Wort "code" vorkommt.
 */
function rohText(video) {
  if (!video) return '';
  const teile = [video.title, video.fulltitle, video.description];
  for (const liste of [video.tags, video.hashtags, video.categories]) {
    if (Array.isArray(liste)) teile.push(liste.join(' '));
  }
  return teile.filter(Boolean).join(' ');
}

/**
 * Sieht dieser Clip nach fremder Werbung aus?
 *
 * @returns {{werbung:boolean, arten:string[], treffer:string[]}}
 */
function werbeVerdacht(video) {
  const text = rohText(video);
  const arten = new Set();
  const treffer = [];
  for (const { muster, art } of WERBE_SIGNALE) {
    const gefunden = text.match(muster);
    if (!gefunden) continue;
    arten.add(art);
    treffer.push(gefunden[0].trim().slice(0, 40));
  }
  return { werbung: arten.size > 0, arten: [...arten], treffer };
}

/**
 * Ein Verdacht, der das Markieren wert ist.
 *
 * EINE Fundstelle reicht nicht immer: "shop" und "code" rutschen leicht in eine
 * gewoehnliche Unterschrift. Eine Kennzeichnung dagegen ist fuer sich schon
 * eindeutig — sie steht dort, weil jemand rechtlich dazu verpflichtet ist.
 */
function istFremdeWerbung(video) {
  const v = werbeVerdacht(video);
  if (!v.werbung) return null;
  if (v.arten.includes('kennzeichnung')) return v;
  return v.arten.length >= 2 ? v : null;
}

// ── Drei Zustaende je Clip (Punkt 22) ────────────────────────────────
//
// Bisher kannte der Index zwei Lagen: Eintrag da (Datei liegt) oder in
// "frueher_geladen" (weggeworfen). Was dazwischen liegt, stand in einer Datei
// neben dem Projekt — "Clips mit dem schwarzen Modell nicht mit den weissen
// mischen". Beim naechsten Produkt faengt man damit wieder bei null an.
//
// WARUM DIE GRUENDE EINE FESTE LISTE SIND UND KEIN FREITEXT
// Nach zwanzig Produkten soll die Gruende-Liste beschreiben, was gutes
// Rohmaterial ausmacht. Freitext laesst sich nicht zaehlen: "zu dunkel",
// "duster" und "schlecht belichtet" waeren drei Gruende statt einem. Ein
// eigener Satz darf trotzdem dazu — als Notiz neben dem Grund, nicht an seiner
// Stelle.

const ZUSTAENDE = ['vorrat', 'verwendet', 'verworfen'];

const VERWURF_GRUENDE = {
  falsches_modell: 'falsches Modell oder falsche Farbvariante',
  zu_dunkel: 'zu dunkel oder zu unscharf',
  fremdes_wasserzeichen: 'fremdes Wasserzeichen im Bild',
  person_im_bild: 'Person im Bild',
  ton_unbrauchbar: 'Ton unbrauchbar',
  doppelgaenger: 'Doppelgaenger zu vorhandenem Material',
  fremde_werbung: 'Werbung eines Mitbewerbers',
  technisch: 'technisch unbrauchbar (Aufloesung, Dauer, Format)',
};

/**
 * Zustand eines Eintrags setzen.
 *
 * @returns {{ok:boolean, grund?:string}} — bei ok:false steht in grund, warum
 *   nicht. Bewusst kein Wurf: Ein Tippfehler in einem Grund soll den Lauf nicht
 *   abbrechen, sondern gemeldet werden.
 */
function setzeZustand(eintrag, zustand, { grund = null, notiz = null,
                                          jetzt = new Date() } = {}) {
  if (!eintrag) return { ok: false, grund: 'kein Eintrag' };
  if (!ZUSTAENDE.includes(zustand)) {
    return { ok: false, grund: `unbekannter Zustand "${zustand}" (erlaubt: ${ZUSTAENDE.join(', ')})` };
  }
  // PFLICHTFELD NUR BEIM VERWERFEN. Bei "verwendet" oder "vorrat" gibt es
  // nichts zu begruenden — ein Pflichtfeld dort erzeugt nur Fuellwoerter.
  if (zustand === 'verworfen') {
    if (!grund) {
      return { ok: false, grund: `"verworfen" braucht einen Grund (${Object.keys(VERWURF_GRUENDE).join(', ')})` };
    }
    if (!VERWURF_GRUENDE[grund]) {
      return { ok: false, grund: `unbekannter Grund "${grund}" (erlaubt: ${Object.keys(VERWURF_GRUENDE).join(', ')})` };
    }
  }
  eintrag.zustand = zustand;
  eintrag.zustand_seit = jetzt.toISOString();
  if (zustand === 'verworfen') {
    eintrag.verwurf_grund = grund;
  } else {
    delete eintrag.verwurf_grund;
  }
  if (notiz) eintrag.notiz = String(notiz).slice(0, 500);
  return { ok: true };
}

/**
 * Der Zustand eines Eintrags — auch fuer alte Eintraege, die keinen haben.
 *
 * Ein Eintrag ohne Feld gilt als "vorrat": Er wurde geladen und noch nicht
 * beurteilt. Das ist die ehrliche Lesart — "verwendet" waere geraten, und
 * "verworfen" waere eine Behauptung ueber Material, das niemand angesehen hat.
 */
function zustandVon(eintrag) {
  const roh = String((eintrag && eintrag.zustand) || '').trim();
  return ZUSTAENDE.includes(roh) ? roh : 'vorrat';
}

/** Wieviele Clips liegen in welchem Zustand, und woran scheitern sie? */
function zustandsBilanz(index, { nurProdukt = null } = {}) {
  const zaehler = { vorrat: 0, verwendet: 0, verworfen: 0 };
  const gruende = new Map();
  for (const eintrag of (index.eintraege || [])) {
    if (nurProdukt != null && Number(eintrag.produkt_id) !== Number(nurProdukt)) continue;
    const z = zustandVon(eintrag);
    zaehler[z]++;
    if (z === 'verworfen' && eintrag.verwurf_grund) {
      gruende.set(eintrag.verwurf_grund, (gruende.get(eintrag.verwurf_grund) || 0) + 1);
    }
  }
  return {
    ...zaehler,
    gruende: [...gruende.entries()]
      .map(([schluessel, anzahl]) => ({ schluessel, anzahl,
                                        text: VERWURF_GRUENDE[schluessel] || schluessel }))
      .sort((a, b) => b.anzahl - a.anzahl || a.schluessel.localeCompare(b.schluessel)),
  };
}

// ── Platz und Alter des Materials (Punkt 70) ─────────────────────────
//
// Rohvideos sind gross. 23 Clips fuer ein Produkt sind unkritisch; 23 Clips fuer
// 40 Produkte sind es nicht mehr — und eine volle Platte meldet sich beim
// Rendern mit einem abgebrochenen Auftrag, nicht mit einer klaren Fehlermeldung.
//
// GEZAEHLT WIRD, WAS WIRKLICH DA IST. Nicht die Zahl der Indexeintraege: Ein
// Eintrag ohne Datei belegt keinen Platz, und eine Datei ohne Eintrag wuerde
// beim Aufraeumen sonst uebersehen. Gesucht wird ueber dieselbe Funktion, die
// auch das Aufraeumen benutzt — zwei Wege zur selben Datei sind zwei Wege, sich
// zu widersprechen.

/**
 * Wieviel Platz belegt das Rohmaterial, und wie alt ist das aelteste Stueck?
 *
 * @returns {{dateien:number, fehlend:number, bytes:number, aeltestes:string|null,
 *            aeltesteTage:number|null, jeProdukt:Array}}
 */
function platzbedarf(index, videoOrdner, datenOrdner, { jetzt = new Date() } = {}) {
  const jeProdukt = new Map();
  let bytes = 0;
  let dateien = 0;
  let fehlend = 0;
  let aeltestesMs = null;

  for (const eintrag of (index.eintraege || [])) {
    const ort = dateiOrte(eintrag, videoOrdner, datenOrdner).find((o) => {
      try { return fs.statSync(o).isFile(); } catch { return false; }
    });
    if (!ort) { fehlend++; continue; }
    let stat;
    try { stat = fs.statSync(ort); } catch { fehlend++; continue; }
    dateien++;
    bytes += stat.size;
    // Das Datum des EINTRAGS, nicht der Datei: Eine Datei, die beim Umkopieren
    // einen neuen Zeitstempel bekam, ist deshalb nicht neueres Material.
    //
    // BEIDE SCHREIBWEISEN. Der Index fuehrt das Feld als "zeitstempel"; nur die
    // Liste "frueher_geladen" nennt es "zeitpunkt". Wer nur eine davon liest,
    // bekommt fuer jeden Eintrag das Dateidatum und damit ein Alter, das beim
    // naechsten Umkopieren auf null springt.
    const rohZeit = eintrag.zeitstempel || eintrag.zeitpunkt;
    const zeit = rohZeit ? Date.parse(rohZeit) : stat.mtimeMs;
    if (Number.isFinite(zeit) && (aeltestesMs === null || zeit < aeltestesMs)) aeltestesMs = zeit;
    const id = Number(eintrag.produkt_id);
    const stand = jeProdukt.get(id) || { id, dateien: 0, bytes: 0 };
    stand.dateien++;
    stand.bytes += stat.size;
    jeProdukt.set(id, stand);
  }

  return {
    dateien, fehlend, bytes,
    aeltestes: aeltestesMs === null ? null : new Date(aeltestesMs).toISOString(),
    aeltesteTage: aeltestesMs === null ? null
      : Math.floor((jetzt.getTime() - aeltestesMs) / 86400000),
    jeProdukt: [...jeProdukt.values()].sort((a, b) => b.bytes - a.bytes),
  };
}

/** Bytes als Zeile, die ein Mensch liest. */
function lesbareGroesse(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const einheiten = ['KB', 'MB', 'GB', 'TB'];
  let wert = n / 1024;
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) { wert /= 1024; i++; }
  return `${wert < 10 ? wert.toFixed(1) : Math.round(wert)} ${einheiten[i]}`;
}

/**
 * Welche Dateien duerfen nach der Aufbewahrungsregel weg?
 *
 * NUR VERWORFENES. Was verwendet wurde oder im Vorrat liegt, bleibt — die
 * Aufbewahrungsfrist ist eine Platzregel, keine Bewertung. Und geloescht wird
 * hier gar nichts: Diese Funktion nennt nur die Kandidaten. Loeschen ist ein
 * eigener, bewusster Schritt, denn der Indexeintrag mit Pruefsumme muss bleiben
 * — sonst laedt der naechste Lauf genau das wieder, was eben weggeworfen wurde.
 */
function ablaufkandidaten(index, videoOrdner, datenOrdner,
                          { tage = 90, jetzt = new Date() } = {}) {
  const grenze = jetzt.getTime() - Math.max(0, tage) * 86400000;
  const dran = [];
  for (const eintrag of (index.eintraege || [])) {
    if (String(eintrag.zustand || '') !== 'verworfen') continue;
    const rohZeit = eintrag.zeitstempel || eintrag.zeitpunkt;
    const zeit = rohZeit ? Date.parse(rohZeit) : NaN;
    if (!Number.isFinite(zeit) || zeit > grenze) continue;
    const ort = dateiOrte(eintrag, videoOrdner, datenOrdner).find((o) => {
      try { return fs.statSync(o).isFile(); } catch { return false; }
    });
    if (!ort) continue;                       // Datei schon weg, Eintrag bleibt
    dran.push({ datei: eintrag.datei, ort, produkt_id: eintrag.produkt_id,
                zeitstempel: rohZeit,
                tage: Math.floor((jetzt.getTime() - zeit) / 86400000) });
  }
  return dran;
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
function quellenFuer(produkt, eintrag, faehigkeiten, standard, { index = null } = {}) {
  const quellen = [];
  const uebersprungen = [];
  const schonDa = new Set();

  for (const url of (eintrag.videos || [])) quellen.push({ art: 'video', url });
  for (const url of (eintrag.creators || [])) {
    quellen.push({ art: 'creator', url });
    schonDa.add(String(url).replace(/\/+$/, ''));
  }

  // CREATOR, DIE SCHON GELIEFERT HABEN — vor allem anderen.
  //
  // Die Spalte "creator" wird seit Tag eins mitgeschrieben und war bis zum
  // 18.09. nie gelesen worden. Dabei ist sie das staerkste Signal im Index:
  // Wer zweimal brauchbares Material zu diesem Produkt gemacht hat, macht mit
  // hoher Wahrscheinlichkeit mehr davon. Ein Profil abzufragen ist ausserdem
  // billiger als eine Suchanfrage — und liefert nur Videos EINES Menschen,
  // was fuer die Rechtefrage (Gruppe G) den Unterschied macht: Einer, den man
  // zweimal angeschrieben hat, ist ungleich einfacher als vierzig Einzelfaelle.
  if (index) {
    for (const quelle of creatorQuellen(index, { nurProdukt: produkt.id })) {
      const sauber = String(quelle.url).replace(/\/+$/, '');
      if (schonDa.has(sauber)) continue;     // steht schon von Hand drin
      schonDa.add(sauber);
      quellen.push(quelle);
    }
  }

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
        // PUNKT 14: Masse mitnehmen, wenn sie dabeistehen.
        //
        // Mit --flat-playlist liefert yt-dlp nicht immer alles: Die Dauer steht
        // meist da, Breite und Hoehe oft nicht. Genommen wird, was da ist — die
        // Pruefung weiter unten urteilt ausdruecklich nur ueber vorhandene
        // Angaben. Eine fehlende Hoehe ist keine Aussage ueber die Hoehe.
        dauer: Number(roh.duration) || null,
        breite: Number(roh.width) || null,
        hoehe: Number(roh.height) || null,
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
      // Masse fuer Huerde 8. yt-dlp liefert sie im selben --dump-json-Aufruf,
      // der ohnehin laeuft — die Pruefung kostet also KEINEN zusaetzlichen
      // Abruf. Genau deshalb steht sie vor dem Laden und nicht danach.
      // Fehlt die Angabe (kommt vor), wird nicht geraten, sondern durchgelassen:
      // Ablehnen auf Verdacht wuerde gutes Material kosten.
      breite: Number(roh.width) || null,
      hoehe: Number(roh.height) || null,
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

  // PUNKT 72: Werkzeugstand festhalten und Aenderungen melden.
  //
  // Hier sind die Faehigkeiten echt gemessen — tiktokFaehigkeiten() lief gerade.
  // Eine neue yt-dlp-Version kann dieselbe Nummer behalten und trotzdem einen
  // Extractor verloren haben; deshalb gehoeren beide in denselben Vergleich.
  const werkzeuge = werkzeugStand({
    ytdlpVersion: opt.ytdlpVersion || null,
    ffmpeg: opt.ffmpeg !== undefined ? opt.ffmpeg : findeFfmpeg(opt.env || process.env),
    faehigkeiten,
  });
  melde(`🔧 ${werkzeugZeile(werkzeuge)}`);
  for (const zeile of werkzeugUnterschied(index.werkzeuge, werkzeuge)) {
    melde(`   ⚠️  seit dem letzten Lauf geaendert — ${zeile}`);
  }
  index.werkzeuge = werkzeuge;
  melde(laden
    ? `▶ Ladelauf — hoechstens ${maxDownloads} Videos, Schwelle ${schwelle}.`
    : `▶ Trockenlauf — es wird gesucht und bewertet, aber NICHTS geladen (Schwelle ${schwelle}).`);

  let gesperrt = false;

  // PUNKT 12: Das Produkt mit der groessten Luecke zuerst.
  //
  // Der Ladelauf hoert auf, sobald max_downloads erreicht ist. Bisher lief er
  // die Produktliste von vorne durch — also bekam Produkt 10 in jedem Lauf das
  // ganze Budget, und die Produkte weiter hinten nie etwas. Gemessen am 18.09.:
  // 3 von 41 Produktordnern gefuellt.
  //
  // Weggelassen wird nichts: Volle Produkte rutschen ans Ende, nicht aus der
  // Liste. Sonst faende ein Trockenlauf ploetzlich weniger, als er soll.
  const zielVorrat = Number(standard.ziel_clips_je_produkt) || STANDARD.ziel_clips_je_produkt;
  const nachId = new Map([].concat(opt.produkte || []).map((p) => [Number(p.id), p]));
  const reihenfolge = produkteNachLuecke(index, opt.produkte, { ziel: zielVorrat, alle: true })
    .map((p) => nachId.get(p.id))
    .filter(Boolean);
  if (reihenfolge.length > 1 && reihenfolge[0] !== opt.produkte[0]) {
    melde(`📋 Reihenfolge nach Bedarf — zuerst ${reihenfolge[0].id} ${reihenfolge[0].name}`
      + ` (Ziel ${zielVorrat} Clips je Produkt).`);
  }

  for (const produkt of reihenfolge) {
    if (gesperrt) break;
    if (laden && ergebnis.geladen.length >= maxDownloads) break;

    const eintrag = konfigZuProdukt(opt.konfig, produkt.id);
    const begriffe = produktBegriffe(produkt, eintrag.stichworte || []);
    // Der Index liegt hier ohnehin schon vor — daraus kommen die Profile der
    // Creator, die zu diesem Produkt bereits geliefert haben.
    const { quellen, uebersprungen } = quellenFuer(produkt, eintrag, faehigkeiten, standard,
      { index });

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

      // PUNKT 14: Technisch unbrauchbar? Dann gar nicht erst laden.
      //
      // Der gefuehrte Ablauf prueft das seit jeher als Huerde 8; der Sammellauf
      // ueber alle Produkte tat es nicht. Ein Clip mit perfektem Untertitel kann
      // drei Sekunden kurz sein — fuer einen 1080x1920-Schnitt wertlos, und die
      // Ausgangspruefung des Automaten lehnt ihn am Ende ohnehin ab.
      //
      // Geprueft wird VOR dem Download, mit den Angaben, die schon da sind.
      // Das spart einen echten Abruf, und das zaehlt doppelt, seit bekannt ist,
      // dass nach rund 50 Abrufen die Sperre kommt.
      const untauglich = technischUntauglich(kandidat, standard);
      if (untauglich) {
        ergebnis.pruefliste.push({
          produkt_id: produkt.id, produkt_name: produkt.name,
          video_id: kandidat.id, quelle_url: kandidat.url,
          creator: kandidat.uploader, titel: kandidat.title,
          trefferwert: kandidat.wert,
          grund: `technisch unbrauchbar: ${untauglich}`,
        });
        melde(`📐 technisch unbrauchbar (${untauglich}): ${String(kandidat.title).slice(0, 40)}`);
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
/**
 * Findet Videos im Seitentext — mit ihrer Bildunterschrift.
 *
 * DAS IST DER GANZE PUNKT. Auf TikToks Themenseiten steht die Unterschrift
 * DIREKT HINTER dem Link, und davor die Zahl der Likes:
 *
 *   … **3374**](https://www.tiktok.com/@x/video/706…) refilling💧hello kitty
 *   water dispenser 🎀 link on insta <3 #kawaii #hellokittywaterdispenser …
 *
 * Damit laesst sich pruefen, BEVOR ein Abruf bei TikTok faellig wird. Gemessen
 * an einem echten Lauf: 29 von 96 geprueften Adressen hatten nicht einmal ein
 * Produktwort im Text — 29 Abrufe fuer Videos, die von vornherein nicht in
 * Frage kamen, jeder mit drei Sekunden Pause davor.
 *
 * Die Likes sind kein Beiwerk: Seit eine Anfrage ueber 200 Adressen liefert
 * und das Budget bei 60 bis 300 Abrufen liegt, entscheidet die Reihenfolge,
 * WELCHE geprueft werden. Nach Beliebtheit sortiert kommt brauchbares
 * Material frueher dran.
 */
function fundeAusText(text) {
  const roh = String(text || '');
  const muster = /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d{15,25})/gi;
  const funde = [];
  for (const treffer of roh.matchAll(muster)) {
    const ende = treffer.index + treffer[0].length;
    // Unterschrift: was nach der schliessenden Klammer der Link-Syntax folgt,
    // bis zur naechsten Zeile oder zum naechsten Link.
    let dahinter = roh.slice(ende, ende + 400);
    // Die Adresse kann noch ein "?lang=ur" tragen; die Unterschrift beginnt
    // erst hinter der schliessenden Klammer der Link-Syntax. Nur wegschneiden,
    // wenn die Klammer auch wirklich in Reichweite steht — sonst frisst der
    // Schnitt bei einer nackten Adresse die Unterschrift mit weg.
    const klammer = dahinter.indexOf(')');
    if (klammer >= 0 && klammer <= 120) dahinter = dahinter.slice(klammer + 1);
    // Zwischen Klammer und Unterschrift stehen LEERZEILEN. Ohne sie hier
    // wegzunehmen schneidet der Zeilenumbruch-Trenner gleich am Anfang, und
    // die Unterschrift ist leer — gemessen: 178 von 190 Funden ohne Text,
    // obwohl er in fast allen dastand.
    dahinter = dahinter.replace(/^\s+/, '');
    const unterschrift = dahinter.split(/\n|\[|https?:\/\//)[0].replace(/\s+/g, ' ').trim();
    // Likes: die fettgedruckte Zahl unmittelbar vor dem Link.
    const davor = roh.slice(Math.max(0, treffer.index - 60), treffer.index);
    const zahl = davor.match(/\*\*([\d.,]+)\s*(K|M)?\*\*\]?\(?$/i);
    let likes = null;
    if (zahl) {
      const einheit = String(zahl[2] || '');
      // Mit K/M ist das Zeichen ein DEZIMALtrenner ("1,2K" = 1200), ohne
      // Einheit ein Tausendertrenner ("3.374" = 3374). Beides gleich zu
      // behandeln machte aus 1,2K glatte 12000 — Faktor zehn daneben.
      const wert = einheit
        ? parseFloat(String(zahl[1]).replace(',', '.'))
        : parseFloat(String(zahl[1]).replace(/[.,]/g, ''));
      const faktor = /k/i.test(einheit) ? 1000 : (/m/i.test(einheit) ? 1000000 : 1);
      if (Number.isFinite(wert)) likes = Math.round(wert * faktor);
    }
    funde.push({
      // Ohne Anhaengsel: dieselbe Adresse steht mit "?lang=ur" und ohne auf
      // der Seite und waere sonst zweimal in der Warteschlange.
      url: treffer[0].split('?')[0],
      unterschrift,
      likes,
    });
  }
  return funde;
}

// ── Alter eines Videos ───────────────────────────────────────────────
//
// Eine TikTok-Video-ID ist eine 64-Bit-Zahl, und die oberen 32 Bit sind der
// Unix-Zeitstempel der Veroeffentlichung. Das Datum steht also SCHON IN DER
// ADRESSE — es kostet keinen Abruf, keine Metadaten, kein yt-dlp.
//
// Das ist der entscheidende Unterschied zum naheliegenden Weg ueber
// --dump-json: Der braeuchte einen Abruf je Kandidat, und genau die sind das
// knappe Gut (nach rund 50 macht TikTok dicht). So laesst sich schon beim
// SORTIEREN entscheiden, welche 60 von 200 Adressen ueberhaupt geprueft
// werden.

// Vor diesem Datum kann es keine TikTok-Video-ID geben (TikTok ausserhalb
// Chinas ab 2017; musical.ly-Uebernahme 2018). Was davor liegt, ist keine
// alte Adresse, sondern eine falsch gelesene.
const TIKTOK_FRUEHESTENS = Date.UTC(2016, 0, 1) / 1000;

/**
 * Veroeffentlichungsdatum aus der Video-ID. null, wenn unplausibel.
 *
 * BigInt, nicht Number: Eine 19-stellige ID liegt weit ueber
 * Number.MAX_SAFE_INTEGER, und ">> 32" auf einem Number waere schlicht
 * falsch — JavaScript rechnet Bitoperationen auf 32 Bit. Genau die Sorte
 * Fehler, die stillschweigend plausible Zahlen liefert.
 */
function datumAusVideoId(videoId) {
  const roh = String(videoId == null ? '' : videoId).trim();
  if (!/^\d{15,25}$/.test(roh)) return null;
  let sekunden;
  try {
    sekunden = Number(BigInt(roh) >> 32n);
  } catch {
    return null;
  }
  if (!Number.isFinite(sekunden) || sekunden < TIKTOK_FRUEHESTENS) return null;
  // Ein Datum in der Zukunft ist ebenfalls ein Lesefehler, kein Fund.
  const jetztSek = Math.floor(Date.now() / 1000) + 86400;
  if (sekunden > jetztSek) return null;
  return new Date(sekunden * 1000);
}

/** Video-ID aus einer TikTok-Adresse. */
function videoIdAusUrl(url) {
  const treffer = String(url || '').match(/\/video\/(\d{15,25})/);
  return treffer ? treffer[1] : null;
}

/** Alter in Tagen, mindestens 1 — oder null, wenn kein Datum lesbar ist. */
function alterInTagen(url, jetzt = new Date()) {
  const datum = datumAusVideoId(videoIdAusUrl(url));
  if (!datum) return null;
  const tage = (jetzt.getTime() - datum.getTime()) / 86400000;
  return Math.max(1, Math.round(tage * 10) / 10);
}

/**
 * Beliebtheit als RATE statt als Menge.
 *
 * 800.000 Likes aus 2023 sehen aus wie der beste Fund des Laufs und wirken im
 * Schnitt von 2026 alt: anderer Schnittrhythmus, andere Textgestaltung, oft
 * ein sichtbar veraltetes Produktmodell.
 *
 * NACHGERECHNET, WEIL DER SATZ SO NICHT STIMMT: "Ein frischer Clip mit 20.000
 * Likes gewinnt gegen einen alten mit 800.000" gilt NICHT allgemein. 800.000
 * Likes auf 1042 Tage sind 767 am Tag; 20.000 Likes auf 30 Tage sind 666 —
 * der alte gewinnt weiter, und zu Recht, denn 800.000 sind wirklich viel.
 * Erst ab rund 2000 am Tag (20.000 in zehn Tagen) dreht es sich. Die Rate
 * bevorzugt also nicht das Neue, sondern das SCHNELL WACHSENDE. Das ist das
 * richtige Signal, nur ein anderes als "neu schlaegt alt".
 *
 * Ohne lesbares Datum bleibt die rohe Zahl. Geraten wird nicht; ein Video
 * ohne Datum soll weder bevorzugt noch bestraft werden.
 */
function beliebtheitsRate(fund, jetzt = new Date()) {
  const likes = fund && fund.likes;
  if (likes == null || !Number.isFinite(Number(likes))) return null;
  const tage = alterInTagen(fund.url, jetzt);
  if (tage == null) return Number(likes);
  return Math.round((Number(likes) / tage) * 100) / 100;
}

/** Nur die Adressen — fuer Aufrufer, die die Unterschrift nicht brauchen. */
function adressenAusText(text) {
  return fundeAusText(text).map((f) => f.url);
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
  // Was im Seitentext gefunden wurde, samt Unterschrift und Likes.
  const funde = [];
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
      for (const r of treffer) funde.push(...fundeAusText(r && r.raw_content));
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
      // Je Adresse hoechstens ein Fund, der mit der laengsten Unterschrift.
      funde: Array.from(funde.reduce((m, f) => {
        const bisher = m.get(f.url);
        if (!bisher || String(f.unterschrift).length > String(bisher.unterschrift).length) m.set(f.url, f);
        return m;
      }, new Map()).values()),
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
/**
 * Huerde 8: Taugt der Clip technisch — Hoehe, Dauer, Seitenverhaeltnis?
 *
 * WARUM ES DIESE HUERDE GIBT
 * Die sieben Huerden davor pruefen alle dasselbe: Geht es um das richtige
 * Produkt? Das ist gruendlich geprueft (Kernwort, Merkmale, Ausschlussliste,
 * Verneinung, Sprache) — aber es beantwortet nicht die zweite Frage: Kann man
 * mit dem Clip ueberhaupt arbeiten? Ein 480p-Querformat-Video mit perfektem
 * Untertitel besteht alle sieben und ist fuer einen 1080x1920-Schnitt trotzdem
 * wertlos. Bisher fiel das erst beim Sichten auf — nach dem Abruf.
 *
 * WARUM VOR DEM LADEN
 * Die Masse stehen im --dump-json, das ohnehin laeuft. Die Pruefung kostet
 * keinen einzigen zusaetzlichen Abruf und spart jeden, den sie ablehnt. Das
 * zaehlt doppelt, seit bekannt ist: nach rund 50 Abrufen ohne Pause antwortet
 * TikTok nicht mehr.
 *
 * WARUM SIE IM ZWEIFEL DURCHLAESST
 * Fehlt eine Angabe, wird NICHT abgelehnt. Gleiche Linie wie bei der
 * Vorpruefung aus dem Seitentext: abgelehnt wird nur auf positiven Beweis.
 * Ein Abruf zu viel ist billiger als ein gutes Video, das nie angesehen wurde.
 *
 * Gibt null zurueck, wenn nichts dagegen spricht — sonst den Grund im Klartext.
 */
function technischUntauglich(video, standard = STANDARD) {
  if (!video) return null;

  const minHoehe = Number(standard.min_hoehe) || 0;
  const minDauer = Number(standard.min_dauer_sek) || 0;

  const hoehe = Number(video.hoehe) || 0;
  const breite = Number(video.breite) || 0;
  const dauer = Number(video.dauer) || 0;

  // Nur pruefen, wo eine Angabe da ist. Eine fehlende Hoehe ist keine
  // Aussage ueber die Hoehe.
  if (minHoehe && hoehe && hoehe < minHoehe) {
    return `nur ${hoehe}p (mindestens ${minHoehe}p)`;
  }
  if (minDauer && dauer && dauer < minDauer) {
    return `nur ${dauer.toFixed(1)} s (mindestens ${minDauer} s)`;
  }
  if (standard.quer_ablehnen && breite && hoehe && (breite / hoehe) > 1.05) {
    return `Querformat ${breite}x${hoehe}`;
  }
  return null;
}

/**
 * Hoch, quer oder quadratisch — als Vermerk fuer den Nachweis.
 *
 * Querformat wird nicht abgelehnt (siehe oben), aber es gehoert in den
 * Nachweis: Beim Schneiden entscheidet es, ob der Clip Vollbild werden kann
 * oder nur Einblendung.
 */
function formatVermerk(breite, hoehe) {
  const b = Number(breite) || 0;
  const h = Number(hoehe) || 0;
  if (!b || !h) return null;
  const verhaeltnis = b / h;
  if (verhaeltnis < 0.95) return 'hoch';
  if (verhaeltnis > 1.05) return 'quer';
  return 'quadratisch';
}

/**
 * Fuehrt Buch darueber, WARUM abgelehnt wurde — nicht nur DASS.
 *
 * WOZU
 * Bei 338 Untertiteln fielen 168 (50 %) vorab durch. Die Entscheidung war
 * binaer: durch oder nicht. Der Grund stand im Protokoll eines Laufs und war
 * danach weg. Welche Regel wie oft greift, welche nie greift und welche
 * Begriffe staendig knapp danebenliegen — all das liess sich nur von Hand
 * herauslesen, und im Bericht standen "Standgeraet", "Osmose-Anlage",
 * "Thermosbecher" als handverlesene Beispiele. Das sollte die Maschine selbst
 * sagen.
 *
 * WAS ES NICHT TUT
 * Es urteilt nicht und aendert keine Regel. Eine Regel, die nie greift, wird
 * hier gemeldet und NICHT automatisch entfernt: Vielleicht ist sie richtig und
 * das Material war nur brav. Das ist eine Entscheidung fuer einen Menschen mit
 * den Zahlen in der Hand.
 */
function ablehnungsbuch() {
  const eintraege = [];
  return {
    eintraege,
    /**
     * @param {string} regel     welche Huerde gegriffen hat
     * @param {string} ausloeser das konkrete Wort/der Wert — "" wenn es keinen gibt
     */
    vermerke(regel, ausloeser = '') {
      eintraege.push({ regel: String(regel), ausloeser: String(ausloeser || '').slice(0, 60) });
    },
    /** Je Regel: wie oft, und die haeufigsten Ausloeser. */
    auswertung(hoechstens = 5) {
      const jeRegel = new Map();
      for (const e of eintraege) {
        if (!jeRegel.has(e.regel)) jeRegel.set(e.regel, { regel: e.regel, anzahl: 0, ausloeser: new Map() });
        const eintrag = jeRegel.get(e.regel);
        eintrag.anzahl += 1;
        if (e.ausloeser) {
          eintrag.ausloeser.set(e.ausloeser, (eintrag.ausloeser.get(e.ausloeser) || 0) + 1);
        }
      }
      return [...jeRegel.values()]
        .map((r) => ({
          regel: r.regel,
          anzahl: r.anzahl,
          ausloeser: [...r.ausloeser.entries()]
            .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
            .slice(0, hoechstens)
            .map(([wort, anzahl]) => ({ wort, anzahl })),
        }))
        // Haeufigste zuerst; bei Gleichstand alphabetisch, damit zwei Laeufe
        // mit denselben Zahlen dieselbe Reihenfolge ergeben.
        .sort((a, b) => b.anzahl - a.anzahl || a.regel.localeCompare(b.regel));
    },
  };
}

/**
 * Haengt die Auswertung eines Laufs an eine kleine Statistikdatei an.
 *
 * Die letzten LAEUFE_IM_BUCH Laeufe bleiben stehen. Nach zehn Laeufen ist das
 * eine Kurve statt eines Bauchgefuehls — dieselbe Ueberlegung wie bei den
 * Sperren in Punkt 09.
 */
const LAEUFE_IM_BUCH = 20;

function schreibeAblehnungen(datenOrdnerPfad, auswertung, { geprueft = 0, geladen = 0,
  produkt = null, jetzt = null, vorfaelle = null } = {}) {
  // jetzt kommt an verschiedenen Stellen dieses Programms als Date, als
  // ISO-Zeichenkette ODER als Funktion, die eine liefert. Hier wird alles
  // drei angenommen, statt einen der drei Faelle zum Absturz zu bringen —
  // gefunden hat das der vorhandene Testlauf, nicht das Nachdenken.
  const roh = typeof jetzt === 'function' ? jetzt() : jetzt;
  let zeitpunkt;
  if (roh instanceof Date) zeitpunkt = roh.toISOString();
  else if (typeof roh === 'string' && roh) zeitpunkt = roh;
  else zeitpunkt = new Date().toISOString();
  const pfad = path.join(datenOrdnerPfad, 'ablehnungen.json');
  let bisher = [];
  try {
    const gelesen = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    if (Array.isArray(gelesen)) bisher = gelesen;
    else if (gelesen && Array.isArray(gelesen.laeufe)) bisher = gelesen.laeufe;
  } catch { /* erste Zeile, oder kaputt — dann eben neu */ }

  bisher.push({
    zeitpunkt,
    produkt,
    geprueft,
    geladen,
    abgelehnt: auswertung.reduce((s, r) => s + r.anzahl, 0),
    // Punkt 09: Sperren und Fehler je Lauf. Nach zehn Laeufen ist das eine
    // Kurve — man merkt, dass eine Quelle tot ist, bevor man drei Laeufe
    // lang nichts bekommt.
    ...(vorfaelle ? { vorfaelle } : {}),
    regeln: auswertung,
  });

  const inhalt = {
    _hinweis: 'Welche Vorfilter-Regel wie oft gegriffen hat, je Lauf. Eine Regel, '
      + 'die nie auftaucht, greift nie — pruefen, ob sie noch gebraucht wird. Ein '
      + 'Ausloeser, der staendig oben steht, gehoert in die Feinjustierung. Nichts '
      + 'hier aendert automatisch eine Regel.',
    laeufe: bisher.slice(-LAEUFE_IM_BUCH),
  };
  try {
    fs.writeFileSync(pfad, `${JSON.stringify(inhalt, null, 2)}\n`, 'utf8');
    return pfad;
  } catch {
    return null;   // nicht schreibbar ist kein Grund, den Lauf zu faerben
  }
}

/**
 * Wie lange bis zum naechsten Abruf — gewuerfelt, nicht fest.
 *
 * Die Pause selbst ist alt und ihre Geschichte teuer: Sie stand in der
 * Konfiguration, wurde aber als --sleep-requests weitergereicht, und das
 * bremst nur INNERHALB eines yt-dlp-Aufrufs. Da jeder Abruf ein eigener
 * Prozess mit genau einer Adresse ist, lag zwischen zwei Abrufen nichts.
 *
 * Was blieb, ist die Gleichmaessigkeit. Ein Abstand von exakt 3,00 Sekunden
 * ist selbst ein Muster — er sieht fuer die Gegenseite genau nach dem aus,
 * was er ist. Eine Spanne kostet im Schnitt mehr Zeit und faellt weniger auf;
 * gemessen ist der Preis eines abgebrochenen Laufs hoeher: Der kostet nicht
 * die Abrufe, er kostet den Nachschub der Woche.
 *
 * @param {function} wuerfel  austauschbar, damit der Testlauf nicht wuerfelt
 */
function pauseSpanne(standard, wuerfel = Math.random) {
  const min = Math.max(0, Number(standard.pause_zwischen_anfragen_sek) || 0);
  const maxRoh = Number(standard.pause_hoechstens_sek);
  // Fehlt die Obergrenze oder liegt sie unter der Untergrenze, bleibt es beim
  // festen Wert. Eine kaputte Einstellung darf die Pause nicht abschalten.
  const max = Number.isFinite(maxRoh) && maxRoh > min ? maxRoh : min;
  if (min <= 0) return 0;
  return Math.round((min + wuerfel() * (max - min)) * 1000);
}

// ── Wie unterscheidend ist ein Begriff? ──────────────────────────────
//
// GEMESSEN AN DER EIGENEN KONFIGURATION, nicht geschaetzt. Ueber die 40
// Produkte hinweg fuehren:
//
//     "usb"           18 Produkte
//     "akku"          15
//     "rechargeable"  13
//     "light"         12
//     "portable"      10
//
// 42 Begriffe stehen bei fuenf oder mehr Produkten. bewerte() zaehlt aber nur
// TREFFER durch GRUPPENGROESSE — ein Video mit "Mini USB rechargeable LED
// light for bedroom" kommt damit auf Wert 0,5 und haelt, ohne ein einziges
// Wort zu enthalten, das dieses Geraet von zwoelf anderen unterscheidet.
// Nachgemessen; die Zahlen stehen im Handbuch.
//
// Was die drei Fremdgeraete bisher aufgehalten hat, war ALLEIN die
// Kernwort-Huerde. Und 34 Kernwoerter stehen bei zwei oder drei Produkten
// ("diffuser" bei 27, 33 und 42) — dort haelt auch sie nicht.
//
// Deshalb: Ein Treffer, den ein Dutzend Produkte teilen, ist kein Beleg.
// Mindestens EIN Treffer muss von einem Begriff kommen, den hoechstens
// hoechstensProdukte Produkte fuehren.

/**
 * Wie viele Produkte fuehren welchen Begriff?
 *
 * Einmal je Lauf berechnet und durchgereicht — nicht je Kandidat, das waeren
 * 40 Produkte mal 900 Begriffe fuer jede einzelne Adresse.
 */
function begriffsHaeufigkeit(konfig, produkte) {
  const zaehler = new Map();
  for (const produkt of [].concat(produkte || [])) {
    const eintrag = konfigZuProdukt(konfig, produkt.id);
    const gesehen = new Set();
    for (const gruppe of begriffsGruppen(produkt, eintrag)) {
      for (const begriff of gruppe) gesehen.add(begriff);
    }
    for (const begriff of gesehen) zaehler.set(begriff, (zaehler.get(begriff) || 0) + 1);
  }
  return zaehler;
}

/**
 * @param {Map} [haeufigkeit]   aus begriffsHaeufigkeit(). Fehlt sie, bleibt
 *                              alles wie vorher — die Pruefung ist dann aus.
 * @param {number} [hoechstensProdukte]  0 schaltet sie ebenfalls ab.
 */
function bewerte(gruppen, video, { haeufigkeit = null, hoechstensProdukte = 2 } = {}) {
  let bestes = { wert: 0, haelt: false, treffer: [], gruppe: [],
                 im_fliesstext: 0, unterscheidend: [] };
  // Einmal berechnen, nicht je Gruppe: Wieviel von der Unterschrift ist Satz?
  const satz = videoFliesstext(video);
  const satzTokens = satz.split(' ').filter(Boolean);

  for (const gruppe of gruppen) {
    const treffer = getroffeneBegriffe(gruppe, video);
    const wert = gruppe.length
      ? Math.round((treffer.length / gruppe.length) * 1000) / 1000
      : 0;
    let haelt = gruppe.length <= 1 ? treffer.length === 1 : treffer.length >= 2;
    // Mindestens ein Treffer muss UNTERSCHEIDEN. Ohne Haeufigkeitstabelle
    // bleibt es beim alten Verhalten — die Pruefung ist dann schlicht aus.
    const unterscheidend = haeufigkeit && hoechstensProdukte > 0
      ? treffer.filter((b) => (haeufigkeit.get(b) || 1) <= hoechstensProdukte)
      : treffer;
    if (haelt && haeufigkeit && hoechstensProdukte > 0 && !unterscheidend.length) {
      haelt = false;
    }
    // Wieviele Treffer stehen im SATZ und nicht bloss in der Tag-Wolke?
    const imFliesstext = satz
      ? treffer.filter((b) => (b.length >= 5 ? satz.includes(b) : satzTokens.includes(b))).length
      : 0;

    // ENTSCHEIDUNG BEI GLEICHSTAND, NICHT ABWERTUNG.
    //
    // Der naheliegende Weg waere gewesen, Hashtag-Treffer geringer zu
    // gewichten. Gemessen an den gesammelten Untertiteln faellt dabei
    // angenommenes Material durch: "The one thing you need on your
    // nightstand💧#waterdispenser" hat sein einziges Produktwort im Tag.
    // Also bleibt der Wert, wie er ist — und wo zwei Gruppen gleichauf
    // liegen, gewinnt die, die im Satz steht.
    const besser = haelt !== bestes.haelt
      ? haelt
      : (wert !== bestes.wert
        ? wert > bestes.wert
        : imFliesstext > bestes.im_fliesstext);
    if (besser) {
      bestes = { wert, haelt, treffer, gruppe, im_fliesstext: imFliesstext,
                 unterscheidend };
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

// ── Fremdmaterial bleibt im Fremdmaterial-Ordner (Punkt 65) ──────────
//
// Die .gitignore macht die Regel seit dem 18.09. am ORDNER fest statt am
// Dateinamen — vorher fiel sie beim Umbenennen auseinander, und fremde Videos
// standen prompt als neu im git status. In einem oeffentlichen Repo.
//
// Was noch fehlte, ist die Gegenprobe: eine Pruefung, die ROT MELDET, wenn ein
// Indexeintrag auf eine Datei ausserhalb der erlaubten Orte zeigt. Die
// .gitignore schuetzt den Ort; diese Pruefung schuetzt davor, dass etwas an
// einem ganz anderen Ort landet, den die .gitignore nie gesehen hat.

/** Orte, an denen fremdes Rohmaterial liegen darf — relativ zur Wurzel. */
const ERLAUBTE_ABLAGEN = [
  `Marketing/videos/${ROHMATERIAL}`,
  `Marketing/videos/${GESCHNITTEN}`,
];

/**
 * Liegt dieser Eintrag an einem erlaubten Ort?
 *
 * Geprueft wird die Ablage-Angabe des Eintrags, nicht die Datei: Eine Datei,
 * die schon weg ist, kann nicht mehr am falschen Ort liegen — der EINTRAG sagt
 * aber weiterhin, wohin sie gehoerte, und genau der wandert ins Repo.
 */
function ablageErlaubt(eintrag) {
  const roh = String((eintrag && eintrag.ablage) || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (!roh) return false;                    // ohne Angabe ist nichts belegt
  return ERLAUBTE_ABLAGEN.some((ort) => roh === ort || roh.startsWith(`${ort}/`));
}

/**
 * Eintraege, deren Ablage ausserhalb der erlaubten Orte liegt.
 *
 * EIGENES MATERIAL IST AUSGENOMMEN — aber nur, wo es hingehoert: unter
 * rohmaterial/eigenes/. Dieser eine Ordner ist im Repo, sein Inhalt nicht.
 */
function fremdmaterialAmFalschenOrt(index) {
  return (index.eintraege || [])
    .filter((e) => !ablageErlaubt(e))
    .map((e) => ({
      datei: e.datei || '(ohne Dateinamen)',
      produkt_id: e.produkt_id,
      ablage: e.ablage || '(ohne Ablage-Angabe)',
      quelle_url: e.quelle_url || null,
    }));
}

// ── Was der Dateiname ueber die Herkunft sagt (Punkt 71) ─────────────
//
// Solange die Herkunft nur im Index steht, kann eine Datei AUSSERHALB des Index
// nicht mehr zugeordnet werden — und genau solche Dateien landen im falschen
// Ordner.
//
// WAS BEIM MESSEN HERAUSKAM, UND ZWAR UNERFREULICH
// Der Bot tauft geladenes Fremdmaterial auf `NN_<slug>_<dauer>s_stil-b.mp4`.
// Das ist exakt die Form, die auch die EIGENEN Renderings tragen — "stil-b"
// heisst dort "KI-erzeugt". Am Dateinamen ist fremdes Material also nicht mehr
// von eigenem zu unterscheiden. Das alte Fremdschema konnte das: Nach dem
// letzten Unterstrich standen die Ziffern der TikTok-ID, und genau daran
// erkennt die .gitignore den Altbestand bis heute.
//
// WARUM HIER TROTZDEM NICHTS UMBENANNT WIRD
// Jeder Indexeintrag zeigt auf seinen Dateinamen; ein Umtaufen im Hintergrund
// bricht sie alle auf einmal. Der Index ist das Wertvolle — die Dateien sind
// nachladbar, die Beurteilung nicht. Gemeldet wird deshalb, nicht gehandelt.
// Die Ordnerregel aus Punkt 65 bleibt die eigentliche Absicherung; der Name
// ist der zweite Guertel, und dieser Guertel sitzt derzeit locker.

/** Das Schema, das fremdes Material trug, bevor auf "stil-b" umgestellt wurde. */
const HERKUNFT_MUSTER = /_(\d{10,25})\.(mp4|mov|webm|mkv)$/i;

/** Das Schema der eigenen Renderings — und, seit der Umstellung, auch der fremden. */
const RENDER_MUSTER = /^(\d{2})_(.+?)_(\d+)s_stil-([abc])\.(mp4|mov|webm|mkv)$/i;

/**
 * Was ein Dateiname ueber seine Herkunft verraet.
 *
 * @returns {{schema:string, produkt_id:number|null, video_id:string|null,
 *            sagtHerkunft:boolean}}
 */
function herkunftAusName(name) {
  const roh = String(name || '');
  const mitId = roh.match(HERKUNFT_MUSTER);
  if (mitId) {
    const nummer = roh.match(/^(\d{2})_/);
    return {
      schema: 'mit-video-id',
      produkt_id: nummer ? Number(nummer[1]) : null,
      video_id: mitId[1],
      sagtHerkunft: true,
    };
  }
  const render = roh.match(RENDER_MUSTER);
  if (render) {
    return {
      schema: `stil-${render[4].toLowerCase()}`,
      produkt_id: Number(render[1]),
      video_id: null,
      // Ausdruecklich false: Diese Form tragen eigene Renderings UND geladenes
      // Fremdmaterial. Sie sagt, zu welchem Produkt es gehoert — nicht, woher.
      sagtHerkunft: false,
    };
  }
  return { schema: 'unbekannt', produkt_id: null, video_id: null, sagtHerkunft: false };
}

/**
 * Eintraege, deren Dateiname die Herkunft nicht mit sich traegt.
 *
 * GEMELDET, NICHT UMBENANNT — siehe oben. Der Vorschlag steht daneben, damit
 * ein Umzug spaeter kein Ratespiel ist.
 */
function ohneHerkunftImNamen(index) {
  return (index.eintraege || [])
    .filter((e) => e.datei && !herkunftAusName(e.datei).sagtHerkunft)
    .map((e) => ({
      datei: e.datei,
      produkt_id: e.produkt_id,
      schema: herkunftAusName(e.datei).schema,
      vorschlag: e.video_id
        ? String(e.datei).replace(/\.([^.]+)$/, `_${e.video_id}.$1`)
        : null,
    }));
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
      // PUNKT 22: Jeder frisch geladene Clip liegt im Vorrat — beurteilt ist er
      // damit noch nicht. "verwendet" waere geraten, "verworfen" eine
      // Behauptung ueber Material, das niemand angesehen hat.
      zustand: 'vorrat',
      // PUNKT 24: Nur gesetzt, wenn die Textpruefung angeschlagen hat.
      ...(kandidat.fremde_werbung ? { fremde_werbung: kandidat.fremde_werbung } : {}),
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
  // EINMAL je Lauf, nicht je Kandidat: 40 Produkte mal rund 900 Begriffe.
  // Braucht die Produktliste — ohne sie bleibt die Pruefung schlicht aus.
  // Fuer den Bildfingerabdruck. Fehlt ffmpeg, bleibt es bei der Pruefsumme —
  // gemeldet wird es einmal, nicht bei jedem Video.
  const ffmpegPfad = opt.ffmpeg !== undefined ? opt.ffmpeg : findeFfmpeg(opt.env || process.env);
  if (!ffmpegPfad) {
    melde('ℹ️  ffmpeg nicht gefunden — neu kodierte Doppelgaenger werden nicht erkannt.');
    melde('   (Die Pruefsumme faengt weiterhin bitgleiche Dateien.)');
  }
  const haeufigkeit = Array.isArray(opt.produkte) && opt.produkte.length
    ? begriffsHaeufigkeit(opt.konfig, opt.produkte)
    : null;
  const hoechstensProdukte = Math.max(0, Number(standard.hoechstens_produkte_je_begriff) || 0);
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
  // Veraenderlich, weil die Reihenfolge gleich nach dem Laden des Index
  // noch einmal angefasst wird — siehe Punkt 01 weiter unten.
  let begriffe = begriffeFuer(eintrag, produkt, sprache);

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
      // Was der Seitentext ueber die einzelnen Videos verraet.
      const nachUrl = new Map((suche.funde || []).map((f) => [f.url, f]));
      const neu = suche.adressen
        .filter((u) => !gesehen.has(u))
        .map((url) => {
          const f = nachUrl.get(url) || {};
          const likes = f.likes == null ? null : f.likes;
          const eintrag = { url, meta: null, unterschrift: f.unterschrift || '', likes };
          // Datum und Rate kosten NICHTS: Beides steckt in der Video-ID,
          // die ohnehin in der Adresse steht. Kein Abruf, keine Metadaten.
          eintrag.alter_tage = alterInTagen(url, new Date());
          eintrag.rate = beliebtheitsRate(eintrag, new Date());
          return eintrag;
        })
        // NACH WACHSTUM, nicht nach Fundreihenfolge und nicht nach roher
        // Beliebtheit. Die Adressen aus dem Seitentext stehen dort, wie sie
        // zufaellig auf der Seite vorkommen. Seit eine Anfrage ueber 200
        // liefert und das Budget bei 60 bis 300 Abrufen liegt, entscheidet
        // die Reihenfolge, WELCHE geprueft werden.
        //
        // Gemessen wird jetzt Likes JE TAG statt roher Likes: Ein Clip mit
        // 800.000 Likes aus 2023 stand sonst vor jedem frischen Fund,
        // obwohl er im Schnitt von 2026 alt aussieht. Ohne Angabe hinten
        // anstellen, aber nicht aussortieren.
        .sort((a, x) => (x.rate == null ? -1 : x.rate) - (a.rate == null ? -1 : a.rate));
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
      // PUNKT 01: Was dieser Begriff gebracht hat, wandert in den Index.
      //
      // Gezaehlt wird, was WIRKLICH neu ist — also weder in diesem Lauf schon
      // gesehen noch aus einem frueheren Lauf bekannt. "20 Adressen" klingt
      // nach Ertrag; sind es dieselben 20 wie letzte Woche, ist der Begriff
      // erschoepft und gehoert beim naechsten Mal nach hinten.
      //
      // Der Vermerk wird hier nur gesetzt; geschrieben wird der Index wie
      // bisher am Ende des Laufs. Ein Absturz mittendrin verliert damit
      // hoechstens die Bilanz eines Laufs, nie einen Eintrag.
      const wirklichNeu = neu.filter((k) => !schonImIndex(index, { url: k.url })).length;
      // Die Uhr des Laufs, nicht new Date(): Sonst haengt die Ruhezeit an der
      // echten Systemzeit und laesst sich nicht pruefen.
      vermerkeBegriff(index, produkt.id, begriff, wirklichNeu, new Date(jetzt()));

      const kontingent = Math.max(1, Number(standard.max_kandidaten_je_quelle) || 20);
      const jetztNehmen = neu.slice(0, kontingent);
      const spaeter = neu.slice(kontingent);
      if (spaeter.length) reserve.push(...spaeter);
      const mitText = neu.filter((k) => k.unterschrift).length;
      melde(`🔎 "${begriff}": ${suche.adressen.length} Adresse(n), ${neu.length} neu `
        + `(${mitText} mit Unterschrift, ${wirklichNeu} noch nie geladen) — ${jetztNehmen.length} jetzt`
        + `${spaeter.length ? `, ${spaeter.length} in Reserve` : ''}.`);
      if (!wirklichNeu && neu.length) {
        melde(`   Nichts Neues — "${begriff}" ruht die naechsten `
          + `${Number(standard.begriff_ruhe_tage) || 21} Tage.`);
      }
      if (jetztNehmen.length) {
        warteschlange.push(...jetztNehmen);
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

  // PUNKT 01: Die Suchbegriffe in die Reihenfolge bringen, in der sie noch
  // etwas bringen.
  //
  // Das Abrufbudget liegt bei 60 bis 300 Abrufen, die Begriffsliste bei bis zu
  // 48 Eintraegen je Produkt. Der Lauf kommt also nie bis zum letzten Begriff —
  // die Reihenfolge entscheidet, welche ueberhaupt drankommen. Bisher war sie
  // in jedem Lauf dieselbe: von vorne. Damit ging das Budget Lauf fuer Lauf an
  // dieselben Themenseiten, die beim letzten Mal schon abgegrast wurden.
  //
  // Jetzt zuerst die nie benutzten, dann die mit dem aeltesten Fund, ganz
  // hinten die, die zuletzt leer ausgingen. AUSSORTIERT WIRD NICHTS: Eine
  // Themenseite fuellt sich nach, deshalb ruht ein erschoepfter Begriff nur.
  const begriffeVorher = begriffe.slice();
  begriffe = begriffeSortiert(begriffe, begriffsBilanz(index, produkt.id), {
    ruheTage: Number(standard.begriff_ruhe_tage) || 21,
    jetzt: new Date(jetzt()),
  });
  if (begriffe.length && begriffe[0] !== begriffeVorher[0]) {
    melde(`🔀 Suchbegriffe umsortiert — zuerst "${begriffe[0]}"`
      + ` (statt "${begriffeVorher[0]}", zuletzt ohne neue Adressen).`);
  }

  // Auch die Namen, die schon einmal vergeben waren — siehe naechsteNummer().
  const schonVergeben = [].concat(index.eintraege || [], index.frueher_geladen || [])
    .filter((e) => Number(e.produkt_id) === Number(produkt.id))
    .map((e) => e.datei)
    .filter(Boolean);
  let nummer = naechsteNummer(videoZiel, schonVergeben);
  const slug = slugFuerDateiname(produkt, videoZiel);
  let geladen = 0;
  let geprueft = 0;
  // Warum abgelehnt wurde, nicht nur dass. Ausgewertet am Ende des Laufs.
  const buch = ablehnungsbuch();

  // PUNKT 20: Jedes Urteil der TEXTKETTE wandert in eine wachsende Sammlung.
  //
  // Die Pruefkette wurde an 80 echten Untertiteln aus den eigenen Protokollen
  // entwickelt. Die Sammlung wuchs aber nicht mit — bei 492 Suchbegriffen und
  // 403 Kernwoertern, die weiterwachsen, bliebe die Messlatte im August stehen,
  // und jede weitere Verschaerfung waere Hoffnung statt Messung.
  //
  // NUR DIE TEXTKETTE. Was nach dem Laden entschieden wird (Doppelgaenger, Ton,
  // schwarze Balken), ist kein Urteil ueber einen Untertitel und hat in dieser
  // Sammlung nichts zu suchen.
  let urteile = ladeUrteile(datenZiel);
  const merkeUrteil = (video, urteil, wert = null) => {
    try {
      urteile = sammleUrteil(urteile, {
        video_id: video && video.id,
        titel: video && (video.title || video.fulltitle),
        produkt_id: produkt.id, urteil, wert, jetzt: new Date(jetzt()),
      });
    } catch { /* die Sammlung ist Beiwerk, kein Grund zum Abbruch */ }
  };
  // Punkt 09: Sperren und Fehler ZAEHLEN, nicht nur vermerken. Ein einzelner
  // Vermerk liegt im Protokoll eines Laufs; ob Sperren zunehmen, ob eine
  // Quelle systematisch sperrt, ob sich nach einem TikTok-Update etwas
  // geaendert hat — das sieht man erst ueber mehrere Laeufe.
  const vorfaelle = { sperren: 0, fehler: 0, regionssperren: 0 };
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
  const wuerfel = opt.wuerfel || Math.random;
  const pausenSpanne = () => pauseSpanne(standard, wuerfel);

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
      // VORPRUEFUNG AUS DEM SEITENTEXT.
      //
      // Auf TikToks Themenseiten steht die Unterschrift direkt neben dem Link.
      // Damit laesst sich das Offensichtliche aussortieren, bevor ein Abruf
      // faellig wird — gemessen an einem echten Lauf hatten 29 von 96
      // geprueften Adressen nicht einmal ein Produktwort im Text.
      //
      // ABGELEHNT WIRD NUR AUF POSITIVEN BEWEIS. Die Unterschrift aus dem
      // Seitentext kann abgeschnitten oder ganz leer sein; bei duennem Text
      // wird deshalb gar nicht geurteilt, sondern normal abgerufen. Lieber ein
      // Abruf zu viel als ein gutes Video, das nie angesehen wurde.
      // ALTERSGRENZE — vor dem Abruf, weil das Datum nichts kostet: Es
      // steckt in der Video-ID, die in der Adresse steht. Standardmaessig
      // aus (hoechstalter_tage: 0); wer sie einschaltet, sieht im
      // Ablehnungsbuch, wieviel sie wegnimmt.
      const grenzeTage = Math.max(0, Number(standard.hoechstalter_tage) || 0);
      const alter = kandidat.alter_tage != null ? kandidat.alter_tage : alterInTagen(url);
      if (grenzeTage && alter != null && alter > grenzeTage) {
        buch.vermerke('zu alt', `${Math.round(alter)} Tage`);
        melde(`📅 zu alt (${Math.round(alter)} Tage, Grenze ${grenzeTage}): ${url}`);
        continue;
      }

      // GEMESSEN WIRD DER FLIESSTEXT, NICHT DIE GESAMTLAENGE.
      //
      // Eine Unterschrift aus zwanzig Hashtags hat leicht 200 Zeichen und
      // trotzdem keinen Satz. Sie wurde bisher beurteilt, als staende dort
      // etwas — und ein Urteil aus einer Tag-Wolke ist geraten. Wenig
      // Fliesstext heisst ab jetzt: nicht urteilen, normal abrufen. Das ist
      // die richtige Richtung, abgelehnt wird nur auf positiven Beweis.
      const vortext = String(kandidat.unterschrift || '');
      if (fliesstextLaenge(vortext) >= 25) {
        const vorVideo = { title: vortext };
        const verbotenVorab = ausschlussTreffer(vorVideo, ausschluss);
        if (verbotenVorab) {
          buch.vermerke('vorab: ausschlussliste', verbotenVorab);
          melde(`⏭  vorab aussortiert ("${verbotenVorab}"): ${vortext.slice(0, 44)}`);
          continue;
        }
        if (!hatKernwort(vorVideo, kernwoerter)) {
          buch.vermerke('vorab: kein Produktwort');
          melde(`⏭  vorab aussortiert (kein Produktwort): ${vortext.slice(0, 44)}`);
          continue;
        }
      }

      // Vor jedem Abruf ausser dem ersten. Nach einem zurueckgestellten
      // Kandidaten, der gar nicht abgerufen wurde, waere die Pause sinnlos —
      // deshalb steht sie hier drin und nicht am Schleifenanfang.
      const pause = pausenSpanne();
      if (geprueft > 0 && pause) await warte(pause);
      geprueft++;
    }

    // Zurueckgestellte Kandidaten bringen ihre Angaben mit — sonst waere jede
    // zweite Runde ein zweiter Satz Anfragen an TikTok fuer dieselben Videos.
    const meta = kandidat.meta || await holeEinzelMeta(opt.ytdlp, url);
    if (meta.gesperrt) {
      vorfaelle.sperren++;
      melde(`❌ TikTok blockt: ${meta.meldung}`);
      if (standard.bei_sperre_abbrechen !== false) break;
      continue;
    }
    if (meta.fehler) {
      vorfaelle.fehler++;
      if (/region|country|not available in your/i.test(String(meta.fehler))) {
        vorfaelle.regionssperren++;
      }
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
      buch.vermerke('sprache', gefunden);
      merkeUrteil(meta.video, `sprache: ${gefunden}`);
      melde(`🌐 andere Sprache (${gefunden}): ${String(meta.video.title).slice(0, 40)}`);
      continue;
    }

    // Zuerst die harte Ausschlussliste: Ein Katzenbrunnen bekommt bei
    // "automatischer Wasserspender" volle Punktzahl und ist trotzdem falsch.
    const verboten = ausschlussTreffer(meta.video, ausschluss);
    if (verboten) {
      buch.vermerke('ausschlussliste', verboten);
      merkeUrteil(meta.video, `ausgeschlossen: ${verboten}`);
      melde(`⛔ ausgeschlossen ("${verboten}"): ${String(meta.video.title).slice(0, 45)}`);
      continue;
    }

    // Ohne ein Wort, das das Produkt benennt, zaehlt keine Bewertung.
    if (!hatKernwort(meta.video, kernwoerter)) {
      buch.vermerke('kernwort fehlt');
      merkeUrteil(meta.video, 'kein Kernwort');
      melde(`↩︎  kein Produktwort im Text: ${String(meta.video.title).slice(0, 45)}`);
      continue;
    }

    // GEHOERT DAS VIDEO UEBERHAUPT ZUM PRODUKT?
    // Diese Pruefung fehlte im gefuehrten Ablauf komplett — die Suchmaschine
    // liefert, was sie fuer aehnlich haelt, und das Ergebnis wanderte ungeprueft
    // in den Ordner. So kam bei Produkt 10 (Wasserspender) ein Video einer
    // Moebelmanufaktur an: Der Suchbegriff enthielt "Schreibtisch", und das
    // trifft eben auch Tischlerei.
    const bewertung = bewerte(gruppen, meta.video, { haeufigkeit, hoechstensProdukte });
    if (bewertung.wert < schwelle || !bewertung.haelt) {
      const getroffen = bewertung.treffer.length ? bewertung.treffer.join(', ') : 'nichts';
      // ZWEI verschiedene Gruende, zwei verschiedene Zeilen im Buch. "Wert zu
      // klein" heisst: zu wenig getroffen. "Nur Allerweltsbegriffe" heisst:
      // genug getroffen, aber nichts davon unterscheidet dieses Geraet von
      // einem Dutzend anderen. Das eine justiert man an der Schwelle, das
      // andere an den Wortlisten — und wer beides zusammenzaehlt, sieht
      // keins von beidem.
      if (bewertung.wert >= schwelle && !bewertung.unterscheidend.length
          && bewertung.treffer.length) {
        buch.vermerke('nur Allerweltsbegriffe', bewertung.treffer.slice(0, 2).join('+'));
        merkeUrteil(meta.video, 'nur Allerweltsbegriffe', bewertung.wert);
        melde(`🫧 nur Allerweltsbegriffe (${getroffen} — jeder bei mehr als `
          + `${hoechstensProdukte} Produkten): ${String(meta.video.title).slice(0, 40)}`);
      } else {
        buch.vermerke('trefferwert zu klein', `Wert ${bewertung.wert}`);
        merkeUrteil(meta.video, 'trefferwert zu klein', bewertung.wert);
        melde(`↩︎  passt nicht zum Produkt (${bewertung.wert}, trifft: ${getroffen}): `
          + `${String(meta.video.title).slice(0, 45)}`);
      }
      continue;
    }
    // LETZTE PRUEFUNG VOR DEM LADEN — und die einzige, die fragt, ob es
    // wirklich DIESES Geraet ist. Alles davor prueft nur, ob es um die
    // richtige Sache geht: "Wasserspender" steht auch unter einem
    // Buero-Standgeraet, einem Kuehlschrankspender und einer Filterkanne.
    const merkmalTreffer = getroffeneMerkmale(meta.video, merkmale);
    if (merkmale.length && !merkmalTreffer.length) {
      buch.vermerke('kein Merkmal');
      merkeUrteil(meta.video, 'kein Merkmal', bewertung.wert);
      melde(`🔬 kein Merkmal dieses Geraets (Flasche/Akku/Pumpe/Tisch): `
        + `${String(meta.video.title).slice(0, 42)}`);
      continue;
    }
    // HUERDE 8 — die einzige, die nicht nach dem Produkt fragt, sondern nach
    // der Brauchbarkeit. Sie steht bewusst ganz am Ende der Vorpruefung: Die
    // Textpruefungen sind billiger, und was inhaltlich nicht passt, muss gar
    // nicht erst vermessen werden.
    const untauglich = technischUntauglich(meta.video, standard);
    if (untauglich) {
      buch.vermerke('technisch unbrauchbar', untauglich);
      merkeUrteil(meta.video, `technisch: ${untauglich}`);
      melde(`📐 technisch unbrauchbar (${untauglich}): `
        + `${String(meta.video.title).slice(0, 40)}`);
      continue;
    }

    // PUNKT 24: Fremde Werbung MARKIEREN, nicht ablehnen.
    //
    // Der Clip bleibt brauchbar — als Anschauung, und der Ordner ist nebenbei
    // die laufende Mitbewerber-Beobachtung, die sonst niemand macht. Im eigenen
    // Werbeclip hat ein fremder Rabattcode aber nichts verloren, und das soll
    // beim Sichten ins Auge springen statt beim Rendern aufzufallen.
    //
    // Abgelehnt wird hier bewusst nicht: Die Erkennung ist Textarbeit und damit
    // unscharf. Eine Markierung darf danebenliegen, eine Ablehnung soll es
    // nicht. Gemessen an 15 echten Untertiteln aus dem Herkunftsnachweis:
    // 0 Fehlalarme, nicht einmal ein Einzelsignal unterhalb der Schwelle.
    const werbung = istFremdeWerbung(meta.video);
    if (werbung) {
      meta.video.fremde_werbung = { arten: werbung.arten, treffer: werbung.treffer };
      melde(`📣 sieht nach fremder Werbung aus (${werbung.arten.join(', ')}: `
        + `${werbung.treffer.slice(0, 2).join(', ')}) — wird markiert, nicht verworfen.`);
    }

    // Die Textkette ist durch — das ist das Urteil "angenommen".
    merkeUrteil(meta.video, 'angenommen', bewertung.wert);

    meta.video.wert = bewertung.wert;      // wandert in den Nachweis
    meta.video.merkmale = merkmalTreffer;  // desgleichen — belegt die Zuordnung
    // Masse in den Nachweis: Damit laesst sich spaeter beantworten, warum ein
    // Clip im Schnitt nur Einblendung wurde — ohne die Datei zu oeffnen.
    meta.video.format = formatVermerk(meta.video.breite, meta.video.hoehe);

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
      buch.vermerke('doppelgaenger', 'gleiche Pruefsumme');
      melde(`👯 identisch mit ${dublette.datei} (gleiche Pruefsumme, anderes Konto): `
        + `${String(meta.video.title).slice(0, 40)}`);
      continue;
    }

    // DERSELBE CLIP, NEU KODIERT.
    //
    // Die Pruefsumme oben faengt nur die bitgleiche Datei. Der haeufigere
    // Fall auf TikTok ist der Repost: andere Aufloesung, andere Bitrate,
    // manchmal ein schwarzer Rand — dasselbe Bild, voellig andere Summe.
    //
    // Geprueft wird NACH dem Laden, weil das Bild vorher nicht zu haben ist.
    // Der Abruf ist damit nicht gespart; gespart ist der Platz, die
    // Sichtungszeit und ein Clip, der im Schnitt zweimal dasselbe zeigt.
    // Beim NAECHSTEN Lauf ist auch der Abruf gespart: Die Adresse wandert
    // nach frueher_geladen.
    const abdruecke = ffmpegPfad
      ? bildFingerabdruck(ffmpegPfad, abgelegt, ergebnis.eintrag.dauer_sek)
      : [];
    const bildDublette = schonAlsBildDa(index, abdruecke);
    if (bildDublette) {
      try { fs.unlinkSync(abgelegt); } catch { /* dann bleibt sie eben liegen */ }
      buch.vermerke('doppelgaenger', 'gleiches Bild, neu kodiert');
      // Damit derselbe Repost nicht bei jedem Lauf erneut abgerufen wird.
      index.frueher_geladen = [].concat(index.frueher_geladen || [], [{
        quelle_url: url,
        video_id: meta.video.id,
        grund: `Bild identisch mit ${bildDublette.datei}`,
        zeitpunkt: jetzt(),
      }]);
      speichereIndex(datenZiel, index);
      melde(`👯 gleiches Bild wie ${bildDublette.datei} (neu kodiert, anderes Konto): `
        + `${String(meta.video.title).slice(0, 38)}`);
      continue;
    }
    if (abdruecke.length) ergebnis.eintrag.bild_abdruck = abdruecke;

    // SCHWARZE BALKEN — was von der Datei wirklich Bild ist.
    //
    // Huerde 8 hat die DATEI gemessen und fuer gut befunden. Ein
    // umformatiertes Querformat-Video misst aber 1080x1920 und hat nur
    // 1080x1620 Bild. Im Schnitt gibt das Balken im Balken.
    const ausschnitt = ffmpegPfad
      ? randErkennung(ffmpegPfad, abgelegt, ergebnis.eintrag.dauer_sek)
      : null;
    const randGrund = randUntauglich(ausschnitt, standard);
    if (randGrund) {
      try { fs.unlinkSync(abgelegt); } catch { /* dann bleibt sie eben liegen */ }
      buch.vermerke('schwarze Balken', `${ausschnitt.breite}x${ausschnitt.hoehe}`);
      melde(`🖼  ${randGrund} (Datei ${meta.video.breite}x${meta.video.hoehe}): `
        + `${String(meta.video.title).slice(0, 38)}`);
      continue;
    }
    if (ausschnitt) {
      const anteil = randAnteil(meta.video, ausschnitt);
      // Nur vermerken, wenn es etwas zu vermerken gibt: Ein Feld
      // "zuschnitt: crop=1080:1920:0:0" bei jedem zweiten Eintrag ist Rauschen.
      if (anteil !== null && anteil >= RAND_ANTEIL_MELDEN) {
        ergebnis.eintrag.zuschnitt =
          `crop=${ausschnitt.breite}:${ausschnitt.hoehe}:${ausschnitt.x}:${ausschnitt.y}`;
        ergebnis.eintrag.rand_anteil = anteil;
        melde(`🖼  ${Math.round(anteil * 100)} % Rand — Zuschnitt vermerkt: `
          + `${ergebnis.eintrag.zuschnitt}`);
      }
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
      buch.vermerke('gerede im Ton');
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
        buch.vermerke('nicht abhoerbar', messung && messung.grund);
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
      buch.vermerke('Ansage in anderer Sprache', messung.sprache || 'nicht erkennbar');
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

  // PUNKT 72: Den Werkzeugstand dieses Laufs im Index festhalten.
  //
  // Nur EIN Stand, nicht eine Liste: Gebraucht wird die Frage "hat sich seit
  // dem letzten Mal etwas geaendert?", und die beantwortet der letzte Stand.
  // Eine wachsende Historie im Index waere Ballast in einer Datei, die bei
  // jedem Download neu geschrieben wird.
  //
  // OHNE FAEHIGKEITEN. Der gefuehrte Ablauf ruft --list-extractors gar nicht
  // auf — er sucht ueber eine Suchmaschine statt ueber einen Extractor. Die
  // Felder hier zu fuellen hiesse, sie zu erfinden; der Zustandsbericht fragt
  // sie ohnehin frisch ab.
  try {
    index.werkzeuge = werkzeugStand({
      ytdlpVersion: opt.ytdlpVersion || null,
      ffmpeg: ffmpegPfad,
    });
  } catch { /* der Werkzeugstand ist Beiwerk, kein Grund zum Abbruch */ }

  // PUNKT 21: Den Kontaktbogen gleich mitbauen.
  //
  // Der Bogen gibt es seit dem 18.09., aber nur als eigenen Befehl — und ein
  // Befehl, den man nach jedem Lauf von Hand tippen muss, wird nach dem
  // dritten Mal nicht mehr getippt. Dabei ist die Sichtung der teuerste
  // Handgriff der ganzen Kette: 23 Clips einzeln oeffnen war ein Nachmittag.
  //
  // LAZY REQUIRE, mit Absicht. kontaktbogen.js verlangt diese Datei hier
  // ("const sync = require('./tiktok-video-sync.js')"). Ein Require oben am
  // Dateianfang waere ein Ring: Beim Laden von kontaktbogen.js waeren die
  // Exporte hier noch leer, und sync.ladeIndex waere undefined.
  //
  // Gebaut wird NUR, wenn dieser Lauf etwas geladen hat. Ein Lauf ohne Fund
  // hat nichts Neues zu zeigen, und der alte Bogen liegt ja noch da.
  let bogenPfad = null;
  if (geladen > 0 && opt.bogen !== false) {
    try {
      const bogen = require('./kontaktbogen.js');
      const ffprobePfad = opt.ffprobe !== undefined ? opt.ffprobe : bogen.findeWerkzeug('ffprobe');
      if (ffmpegPfad && ffprobePfad) {
        const ergebnis = bogen.baueBoegen({
          ffmpeg: ffmpegPfad, ffprobe: ffprobePfad,
          ordner: datenZiel, videoOrdner: sammelOrdner,
          nurProdukt: produkt.id,
          ausgabe: () => {},          // die Meldungen kommen unten, gebuendelt
        });
        bogenPfad = (ergebnis.boegen || [])[0] || null;
      } else {
        melde('ℹ️  Kontaktbogen uebersprungen — ffmpeg/ffprobe nicht gefunden.');
      }
    } catch (fehler) {
      // Ein fehlgeschlagener Bogen ist kein fehlgeschlagener Lauf. Die Videos
      // liegen da, der Index steht — das Blatt ist eine Lesehilfe.
      melde(`ℹ️  Kontaktbogen nicht gebaut: ${fehler.message}`);
    }
  }

  // PUNKT 20: Die Urteilssammlung festschreiben.
  const urteilsDatei = speichereUrteile(datenZiel, urteile);

  // PUNKT 01: Die Begriffs-Bilanz festschreiben — auch wenn nichts geladen wurde.
  //
  // Der Index wird sonst nur beim erfolgreichen Download geschrieben. Genau der
  // Lauf, der nichts findet, ist aber der, dessen Ergebnis hier zaehlt: Er
  // belegt, dass die gefragten Begriffe abgegrast sind. Ohne dieses Speichern
  // faengt der naechste Lauf wieder bei Begriff 1 an — die ganze Umsortierung
  // waere wirkungslos gewesen. Aufgefallen ist das erst im Durchlauf, nicht im
  // Einzeltest der Sortierfunktion.
  try {
    speichereIndex(datenZiel, index);
  } catch (fehler) {
    melde(`⚠️  Begriffs-Bilanz nicht gespeichert: ${fehler.code || fehler.message}`);
  }

  melde('');
  melde(`— ${geladen} von ${anzahl} gewuenschten Videos geladen, ${geprueft} Adresse(n) geprueft, `
    + `${naechsterBegriff} von ${begriffe.length} Suchbegriffen gebraucht.`);

  // ── Warum die anderen nicht durchkamen ─────────────────────────────
  //
  // Bei 168 Ablehnungen aus 338 Untertiteln ist der GRUND die eigentliche
  // Information. Bisher stand er verstreut im Protokoll eines Laufs und war
  // danach weg; im Bericht standen handverlesene Beispiele. Jetzt sagt es
  // die Maschine selbst — und die Datei daneben macht aus zehn Laeufen eine
  // Kurve statt eines Bauchgefuehls.
  // DIESE BEIDEN MELDUNGEN STEHEN AUSSERHALB DES ABLEHNUNGSBLOCKS.
  //
  // Erst standen sie darin — und damit hinter "if (auswertung.length)". Ein
  // Lauf, in dem NICHTS abgelehnt wurde, zeigte den Kontaktbogen also nie an,
  // obwohl er gebaut war und im Ordner lag. Gefunden hat das der Durchlauf mit
  // echtem ffmpeg, nicht das Lesen.
  if (bogenPfad) {
    melde('');
    melde(`👁  Kontaktbogen: ${bogenPfad}`);
    melde('   Im Browser oeffnen — vier Standbilder je Clip, im Vergleich statt');
    melde('   nacheinander. Man sieht sofort, welche drei Clips dasselbe zeigen.');
  }
  if (urteilsDatei) {
    const bilanz = urteilsBilanz(urteile);
    melde('');
    melde(`🧾 Urteile: ${urteilsDatei}`);
    melde(`   ${bilanz.gesamt} gesammelt (${bilanz.angenommen} angenommen, `
      + `${bilanz.abgelehnt} abgelehnt)`
      + (bilanz.gekippt ? `, ${bilanz.gekippt} haben ihr Urteil geaendert` : ''));
  }

  const auswertung = buch.auswertung();
  if (auswertung.length) {
    const abgelehnt = auswertung.reduce((s, r) => s + r.anzahl, 0);
    melde('');
    if (vorfaelle.sperren || vorfaelle.fehler) {
      melde(`   Vorfaelle: ${vorfaelle.sperren} Sperre(n), ${vorfaelle.fehler} Fehler`
        + `${vorfaelle.regionssperren ? `, davon ${vorfaelle.regionssperren} Regionssperre(n)` : ''}.`);
    }
    melde(`   Abgelehnt: ${abgelehnt} — welche Regel wie oft gegriffen hat:`);
    for (const regel of auswertung) {
      const oben = regel.ausloeser.length
        ? `  (${regel.ausloeser.map((a) => `${a.wort}×${a.anzahl}`).join(', ')})`
        : '';
      melde(`     ${String(regel.anzahl).padStart(3)}  ${regel.regel}${oben}`);
    }
    const geschrieben = schreibeAblehnungen(datenZiel, auswertung, {
      geprueft, geladen, produkt: produkt && produkt.id, jetzt, vorfaelle,
    });
    if (geschrieben) {
      melde(`   Verlauf:  ${geschrieben}`);
      melde('   Eine Regel, die dort nie auftaucht, greift nie. Ein Ausloeser, der');
      melde('   staendig oben steht, gehoert in die Feinjustierung.');
    }
  }
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
                ordner: false, anfragen: false, absender: null, sprache: 'de',
                zwecke: null, dauer: null, gegenleistung: null, nennung: null,
                produktNr: null };
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
    // PUNKT 64: Anfragetexte ausgeben. Verschickt wird NICHTS — der Text geht
    // ins Protokoll, und abgeschickt wird er von Hand. Eine Nachricht, die ein
    // Programm ungelesen an einen fremden Menschen schickt, ist genau das, was
    // eine Anfrage unglaubwuerdig macht.
    else if (a === '--anfragen') opt.anfragen = true;
    else if (a === '--absender') opt.absender = argv[++i] || null;
    else if (a === '--produkt') opt.produktNr = argv[++i] || null;
    else if (a === '--dauer') opt.dauer = argv[++i] || null;
    else if (a === '--gegenleistung') opt.gegenleistung = argv[++i] || null;
    else if (a === '--nennung') opt.nennung = argv[++i] || null;
    else if (a === '--sprache') opt.sprache = String(argv[++i] || 'de').startsWith('en') ? 'en' : 'de';
    else if (a === '--zwecke') {
      opt.zwecke = [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.zwecke.push(argv[++i]);
    }
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

/**
 * Anfragetexte fuer alle Clips, deren Rechte noch offen sind.
 *
 * VERSCHICKT WIRD NICHTS. Der Text geht ins Protokoll; abgeschickt wird er von
 * Hand. Eine Nachricht, die ein Programm ungelesen an einen fremden Menschen
 * schickt, ist genau das, was eine Anfrage unglaubwuerdig macht — und die
 * Antwortquote haengt daran, dass sie nicht nach Vorlage klingt.
 */
function anfragenAusgeben(opt) {
  const ordner = datenOrdner();
  let index;
  try {
    index = ladeIndex(ordner);
  } catch (fehler) {
    console.error(`❌ Index nicht lesbar: ${fehler.message}`);
    return 1;
  }

  const absender = String(opt.absender || '').trim();
  if (!absender) {
    console.error('❌ --absender fehlt. Wer fragt, muss in der Nachricht stehen.');
    console.error('   Beispiel:');
    console.error('     node tiktok-video-sync.js --anfragen --absender "Nevio (Maios)" \\');
    console.error('       --produkt 10 --zwecke organisch anzeige --dauer "12 Monate" \\');
    console.error('       --gegenleistung "das Geraet geschenkt"');
    return 1;
  }

  // Der Produktname kommt aus products.json, nicht aus der Kommandozeile:
  // Was in der Nachricht steht, soll dasselbe sein, was im Shop steht.
  let produktName = null;
  let produktNr = null;
  if (opt.produktNr != null) {
    produktNr = Number(opt.produktNr);
    try {
      const alle = JSON.parse(fs.readFileSync(path.join(WURZEL, 'products.json'), 'utf8'));
      const gefunden = alle.find((p) => Number(p.id) === produktNr);
      if (!gefunden) {
        console.error(`❌ Kein Produkt mit der Nummer ${produktNr}.`);
        return 1;
      }
      produktName = gefunden.name;
    } catch (fehler) {
      console.error(`❌ products.json nicht lesbar: ${fehler.message}`);
      return 1;
    }
  }

  const zwecke = [].concat(opt.zwecke || ['organisch']);
  const anfragen = offeneAnfragen(index, {
    absender, produkt: produktName || '<Produkt>', zwecke,
    dauer: opt.dauer, gegenleistung: opt.gegenleistung, nennung: opt.nennung,
    sprache: opt.sprache, nurProdukt: produktNr,
  });

  if (!anfragen.length) {
    console.log('Keine offenen Anfragen — zu allen Clips liegt bereits eine Erlaubnis vor');
    console.log('oder es fehlt der Creator-Name als Adressat.');
    return 0;
  }

  console.log(`── ${anfragen.length} Anfrage(n), ${anfragen.reduce((n, a) => n + a.clips, 0)} Clip(s) ──`);
  console.log('');
  console.log('Verschickt wird nichts. Lies jede Nachricht, bevor du sie abschickst —');
  console.log('eine Anfrage, die nach Vorlage klingt, bekommt keine Antwort.');
  for (const a of anfragen) {
    console.log('');
    console.log('─'.repeat(64));
    console.log(`AN:     ${a.profil || '(kein Profil ermittelbar)'}`
      + (a.handleWeichtAb ? '   ⚠️  Adresse und Name weichen ab' : ''));
    console.log(`CLIPS:  ${a.clips}`);
    for (const url of a.adressen.slice(0, 10)) console.log(`        ${url}`);
    console.log('');
    if (!a.ok) {
      console.log(`⚠️  Kein Text — es fehlt: ${a.fehlt.join(', ')}`);
      continue;
    }
    console.log(a.text);
  }
  console.log('');
  console.log('─'.repeat(64));
  console.log('Die Antwort gehoert in die Rechteakte (Punkt 63): Art, Datum, Beleg,');
  console.log('Umfang. Ohne die vier Angaben bleibt die Sperre zu.');
  return 0;
}

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

    // PUNKT 63: Die Rechtelage, getrennt nach Zweck.
    //
    // Der Materialkatalog des Automaten sperrt hart: "Ein Asset ohne
    // Lizenzeintrag kommt nicht ins Video. Punkt." Fuer fremde TikTok-Clips —
    // das Material mit dem HOECHSTEN Risiko — galt bis zum 20.09. nur ein
    // Haekchen. Ein Wahrheitswert kann keine Einwilligung belegen.
    if (index.eintraege.length) {
      const organisch = rechteBilanz(index, { zweck: 'organisch' });
      const anzeige = rechteBilanz(index, { zweck: 'anzeige' });
      console.log('');
      console.log(`Rechte:         ${organisch.frei} frei fuer eigene Beitraege · `
        + `${anzeige.frei} frei fuer Anzeigen · ${organisch.gesperrt} gesperrt`
        + (organisch.widerrufen ? ` · ${organisch.widerrufen} widerrufen` : ''));
      for (const a of organisch.nachArt) {
        console.log(`                  ${String(a.anzahl).padStart(3)}×  ${RECHTE_ARTEN[a.art] || a.art}`);
      }
      if (organisch.luecken.length) {
        console.log('                Was am haeufigsten fehlt:');
        for (const l of organisch.luecken.slice(0, 4)) {
          console.log(`                  ${String(l.anzahl).padStart(3)}×  ${l.was}`);
        }
      }

      // PUNKT 64: Wen man fragen muesste — ein Creator, eine Anfrage.
      const anfragen = offeneAnfragen(index, {
        absender: '<dein Name>', produkt: '<Produkt>', zwecke: ['organisch'],
      });
      if (anfragen.length) {
        const clips = anfragen.reduce((n, a) => n + a.clips, 0);
        console.log('');
        console.log(`Offene Anfragen: ${anfragen.length} Creator, ${clips} Clip(s)`);
        for (const a of anfragen.slice(0, 5)) {
          console.log(`                  ${String(a.clips).padStart(2)}×  ${a.creator}  ${a.profil || ''}`
            + (a.handleWeichtAb ? '   ⚠️  Adresse und Name weichen ab' : ''));
        }
        console.log('                Ein Creator, EINE Anfrage — wer fuenf Clips desselben');
        console.log('                Menschen hat, schreibt ihn nicht fuenfmal an.');
      }
    }
    const verwaist = verwaisteEintraege(index, videoOrdnerAus(), ordner);
    if (verwaist.length) {
      console.log(`                ⚠️  ${verwaist.length} davon ohne Datei — aufraeumen: npm run tiktok:aufraeumen`);
    }
    const frueher = (index.frueher_geladen || []).length;
    if (frueher) console.log(`                ${frueher} frueher geladen und wieder entfernt (werden nicht neu geholt)`);

    // PUNKT 22: In welchem Zustand liegt das Material?
    const zustaende = zustandsBilanz(index);
    if (index.eintraege.length) {
      console.log(`                ${zustaende.vorrat} im Vorrat · ${zustaende.verwendet} verwendet `
        + `· ${zustaende.verworfen} verworfen`);
      for (const g of zustaende.gruende.slice(0, 5)) {
        console.log(`                  ${String(g.anzahl).padStart(3)}×  ${g.text}`);
      }
    }

    // PUNKT 65: Zeigt ein Eintrag aus den erlaubten Ordnern heraus?
    //
    // Die .gitignore schuetzt den ORT. Diese Pruefung schuetzt davor, dass
    // etwas an einem ganz anderen Ort landet, den die .gitignore nie gesehen
    // hat — in einem oeffentlichen Repo ist das fremdes Material auf GitHub.
    const verirrt = fremdmaterialAmFalschenOrt(index);
    if (verirrt.length) {
      console.log('');
      console.log(`Ablage:         ❌ ${verirrt.length} Eintrag/Eintraege ausserhalb der erlaubten Ordner`);
      console.log(`                erlaubt: ${ERLAUBTE_ABLAGEN.join(', ')}`);
      for (const v of verirrt.slice(0, 5)) {
        console.log(`                  ${v.ablage}/${v.datei}`);
      }
    }

    // PUNKT 71: Sagt der Dateiname, woher die Datei kommt?
    const namenlos = ohneHerkunftImNamen(index);
    if (namenlos.length) {
      console.log('');
      console.log(`Herkunft im Namen: ⚠️  ${namenlos.length} von ${index.eintraege.length} Dateien`);
      console.log('                tragen ihre Herkunft NICHT im Namen. Geladenes Fremdmaterial');
      console.log('                heisst "..._stil-b.mp4" — dieselbe Form wie die eigenen');
      console.log('                Renderings. Am Namen allein ist fremd von eigen nicht mehr');
      console.log('                zu unterscheiden; der Ordner ist derzeit der einzige Schutz.');
      console.log('                Umbenannt wird hier NICHTS: Jeder Indexeintrag zeigt auf');
      console.log('                seinen Dateinamen. Das ist ein eigener, bewusster Schritt.');
    }

    // PUNKT 20: Wie gross ist die Messlatte inzwischen?
    const urteile = urteilsBilanz(ladeUrteile(ordner));
    if (urteile.gesamt) {
      console.log('');
      console.log(`Urteilssammlung: ${urteile.gesamt} echte Untertitel `
        + `(${urteile.angenommen} angenommen, ${urteile.abgelehnt} abgelehnt)`);
      if (urteile.gekippt) {
        console.log(`                ${urteile.gekippt} haben seit dem ersten Mal ihr Urteil `
          + 'geaendert — die Wortlisten wirken.');
      }
      for (const g of urteile.gruende.slice(0, 3)) {
        console.log(`                  ${String(g.anzahl).padStart(3)}×  ${g.grund}`);
      }
    }

    // PUNKT 70: Was liegt da eigentlich auf der Platte?
    //
    // Eine volle Platte meldet sich beim Rendern mit einem abgebrochenen
    // Auftrag, nicht mit einer klaren Fehlermeldung. 23 Clips fuer ein Produkt
    // sind unkritisch, 23 fuer 40 Produkte nicht mehr.
    const platz = platzbedarf(index, videoOrdnerAus(), ordner);
    console.log('');
    console.log(`Platzbedarf:    ${lesbareGroesse(platz.bytes)} in ${platz.dateien} Datei(en)`);
    if (platz.dateien) {
      console.log(`                Schnitt ${lesbareGroesse(platz.bytes / platz.dateien)} je Clip`);
    }
    if (platz.aeltesteTage != null) {
      console.log(`                aeltestes Material: ${platz.aeltesteTage} Tage `
        + `(${String(platz.aeltestes).slice(0, 10)})`);
    }
    const abgelaufen = ablaufkandidaten(index, videoOrdnerAus(), ordner, { tage: 90 });
    if (abgelaufen.length) {
      console.log(`                ${abgelaufen.length} verworfene Datei(en) aelter als 90 Tage `
        + `(${lesbareGroesse(abgelaufen.reduce((sum, a) => {
          try { return sum + fs.statSync(a.ort).size; } catch { return sum; }
        }, 0))})`);
      console.log('                Der Indexeintrag bleibt in jedem Fall — sonst wird neu geladen,');
      console.log('                was eben weggeworfen wurde. Loeschen ist ein eigener Schritt.');
    }

    // WO FEHLT MATERIAL? Die Frage, die der Zustandsbericht bisher nicht
    // beantwortet hat — und die darueber entscheidet, was der naechste Lauf
    // tun sollte. Gezaehlt am 18.09.: 3 von 41 Produktordnern gefuellt.
    try {
      const konfig = ladeKonfig();
      const produkte = JSON.parse(fs.readFileSync(path.join(WURZEL, 'products.json'), 'utf8'));
      const ziel = Number((konfig.standard || {}).ziel_clips_je_produkt)
        || STANDARD.ziel_clips_je_produkt;
      const bestand = bestandJeProdukt(index, produkte, { ziel });
      const leer = bestand.filter((p) => p.vorhanden === 0).length;
      const voll = bestand.filter((p) => p.luecke === 0).length;
      console.log('');
      console.log(`Vorrat:         Ziel ${ziel} Clips je Produkt`);
      console.log(`                ${voll} von ${bestand.length} Produkten voll, ${leer} ohne einen einzigen Clip`);
      const dran = produkteNachLuecke(index, produkte, { ziel }).slice(0, 5);
      if (dran.length) {
        console.log('                Als naechstes dran (groesste Luecke zuerst):');
        for (const p of dran) {
          console.log(`                  ${String(p.id).padStart(3)}  ${String(p.vorhanden).padStart(2)}/${p.ziel}  ${p.name}`);
        }
        console.log(`                → npm run tiktok -- --produkt ${dran[0].id}`);
      }
      const gute = creatorBilanz(index).filter((c) => c.angenommen >= 2);
      if (gute.length) {
        console.log('');
        console.log(`Gute Creator:   ${gute.length} mit zwei oder mehr brauchbaren Clips —`);
        console.log('                ihre Profile werden ab jetzt bei jedem Lauf mit abgefragt.');
        for (const c of gute.slice(0, 5)) {
          console.log(`                  ${String(c.angenommen).padStart(2)}×  ${c.creator}  (Produkt ${c.produkte.join(', ')})`);
        }
      }
    } catch (fehler) {
      console.log(`Vorrat:         ⚠️  ${fehler.message}`);
    }
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

  // PUNKT 72: Werkzeugstand — und was sich seit dem letzten Lauf geaendert hat.
  //
  // yt-dlp aendert sich fast woechentlich, weil sich die Plattformen aendern.
  // Die Lehre aus dem CURRENTLY-BROKEN-Marker am Hashtag-Extractor ist genau
  // die: Faehigkeiten verschwinden, ohne dass jemand es sagt. Wenn ein Lauf
  // scheitert, soll die Frage "hat sich das Werkzeug geaendert?" in einer Zeile
  // beantwortet sein statt in einer Stunde Suche.
  const stand = werkzeugStand({
    ytdlpVersion: gefunden.version,
    ffmpeg: findeFfmpeg(process.env),
    faehigkeiten,
  });
  console.log('');
  console.log(`Werkzeuge:      ${werkzeugZeile(stand)}`);
  try {
    const index = ladeIndex(ordner);
    const unterschiede = werkzeugUnterschied(index.werkzeuge, stand);
    if (unterschiede.length) {
      console.log('                ⚠️  seit dem letzten Lauf geaendert:');
      for (const zeile of unterschiede) console.log(`                    ${zeile}`);
      console.log('                Nach einem Werkzeugwechsel ein Gegenlauf mit einem Clip,');
      console.log('                der vorher ging:  npm run tiktok -- --fund <adresse>');
    } else if (index.werkzeuge) {
      console.log('                unveraendert seit dem letzten Lauf');
    }
  } catch { /* kein Index, kein Vergleich — das ist kein Fehler */ }
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

  // PUNKT 64: Die Anfragetexte ausgeben — ein Creator, eine Nachricht.
  if (opt.anfragen) return anfragenAusgeben(opt);
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
      // Punkt 72: faellt bei findeYtdlp() ohnehin ab — ein eigener Aufruf nur
      // fuers Protokoll waere ein Abruf zu viel.
      ytdlpVersion: gefunden.version,
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
    ytdlpVersion: gefunden.version,
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
  ablehnungsbuch, schreibeAblehnungen, LAEUFE_IM_BUCH, pauseSpanne,
  datumAusVideoId, videoIdAusUrl, alterInTagen, beliebtheitsRate,
  TIKTOK_FRUEHESTENS,
  trenneUnterschrift, inhaltsTags, fliesstextLaenge, videoFliesstext, REICHWEITEN_TAGS,
  begriffsHaeufigkeit,
  bestandJeProdukt, produkteNachLuecke, creatorProfil, creatorBilanz, creatorQuellen,
  begriffsBilanz, begriffeSortiert, vermerkeBegriff,
  dHash, bitAbstand, bildFingerabdruck, gleichesBild, schonAlsBildDa, findeFfmpeg,
  randErkennung, randAnteil, randUntauglich, RAND_ANTEIL_MELDEN,
  BILD_ABSTAND_MAX, BILDER_GLEICH_NOETIG, BILD_MARKEN,
  ausschlussTreffer, spracheDesTextes, hatKernwort, sprachHinweise, textAusPuffern,
  stehtImText, VERNEINUNG,
  adressenAusText, fundeAusText,
  hatMerkmal, getroffeneMerkmale,
  technischUntauglich, formatVermerk,
  ERLAUBTE_ABLAGEN, ablageErlaubt, fremdmaterialAmFalschenOrt,
  HERKUNFT_MUSTER, RENDER_MUSTER, herkunftAusName, ohneHerkunftImNamen,
  ersteZeile, ffmpegVersion, werkzeugStand, werkzeugZeile, werkzeugUnterschied,
  rohText, werbeVerdacht, istFremdeWerbung, WERBE_SIGNALE,
  ZUSTAENDE, VERWURF_GRUENDE, setzeZustand, zustandVon, zustandsBilanz,
  RECHTE_ARTEN, RECHTE_ZWECKE, rechteAkte, rechteLuecken, darfVeroeffentlicht,
  setzeRechte, widerrufeRechte, rechteBilanz,
  ANFRAGE_FELDER, creatorAnfrage, offeneAnfragen,
  URTEILE_DATEI, urteilePfad, sammleUrteil, ladeUrteile, speichereUrteile, urteilsBilanz,
  platzbedarf, lesbareGroesse, ablaufkandidaten,
  naechsteNummer, slugFuerDateiname, schuetzeDatei,
  produktOrdner, imRohmaterial, brauchtEinzelschutz, ROHMATERIAL, GESCHNITTEN,
  legeProduktOrdnerAn,
  holeUndSortiereEin, interaktiv, frageStelle, VIDEO_ORDNER, TIKTOK_VIDEO_MUSTER,
};
