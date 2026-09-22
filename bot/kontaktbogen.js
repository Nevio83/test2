#!/usr/bin/env node
/**
 * kontaktbogen.js — macht aus einem Ordner Rohmaterial ein Blatt zum Ansehen.
 *
 * WOZU ES DAS GIBT
 * Die Pruefkette in tiktok-video-sync.js entscheidet aus TEXT: Untertitel,
 * Kernwort, Merkmale, Verneinung, Sprache. Neun Huerden, und keine einzige hat
 * je ein Bild gesehen. Ob im Clip wirklich das Geraet vorkommt, ob die Aufnahme
 * scharf ist, ob ein fremdes Wasserzeichen mitten im Bild klebt — das steht in
 * keinem Untertitel.
 *
 * Herausgefunden hat man es deshalb bisher so: Datei oeffnen, ansehen,
 * schliessen, naechste. Fuer die 23 Rohclips zum Wasserspender war das ein
 * Nachmittag. Es ist der teuerste Handgriff der ganzen Kette und der, der am
 * wenigsten Koennen verlangt.
 *
 * Dieses Programm zieht je Video vier Standbilder und legt sie zusammen mit den
 * Angaben aus dem Index auf EIN HTML-Blatt. Sichtung im Browser, im Vergleich
 * statt nacheinander — man sieht sofort, welche drei Clips dasselbe zeigen.
 *
 * WAS ES BEWUSST NICHT TUT
 *   * Es urteilt nicht. Kein Video wird geloescht, kein Indexeintrag geaendert.
 *     Das Blatt ist eine Lesehilfe, keine zehnte Huerde.
 *   * Es laedt nichts herunter und ruft TikTok nicht auf. Es arbeitet
 *     ausschliesslich mit dem, was schon auf der Platte liegt.
 *   * Es schreibt nichts in den versionierten Teil des Repos. Das Blatt landet
 *     neben dem Rohmaterial, und das ist in .gitignore ausgenommen.
 *
 * Aufruf:
 *     npm run tiktok:bogen                 alle Produkte mit Rohmaterial
 *     npm run tiktok:bogen -- --produkt 10 nur Produkt 10
 *     npm run tiktok:bogen -- --neu        nur Videos ohne Standbilder
 *     npm run tiktok:bogen -- --schnittliste  zusaetzlich einen Listen-Entwurf
 *
 * Mit --schnittliste wird zusaetzlich nach Szenenwechseln gesucht (ffmpeg
 * select=gt(scene,…)), damit der Entwurf echte Schnittpunkte nennt statt
 * ueberall "ab Sekunde 0".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const kindProzess = require('child_process');

// spawnSync NICHT herausloesen, sondern ueber das Modul aufrufen. Der Grund ist
// der Testlauf: Ein herausgeloestes spawnSync zeigt fuer immer auf die echte
// Funktion, auch wenn der Test child_process.spawnSync ersetzt — der Nachbau
// greift dann nicht, und der Test startet in Wahrheit ffmpeg. Ohne installiertes
// ffmpeg sieht das aus wie ein Fehler im Programm.
function spawnSync(...argumente) {
  return kindProzess.spawnSync(...argumente);
}

const sync = require('./tiktok-video-sync.js');

const WURZEL = path.join(__dirname, '..');

// Wo die Standbilder liegen. Bewusst ein Unterordner NEBEN den Videos und kein
// eigener Ort: Wer das Rohmaterial eines Produkts wegwirft, wirft die Bilder
// mit weg. Ein Vorschaubild, das ein Video ueberlebt, ist Muell, den niemand
// findet.
const BILDER_ORDNER = '.standbilder';

// Vier Bilder, gleichmaessig verteilt — aber nicht bei 0 %: Das erste Bild
// eines TikTok-Videos ist oft schwarz oder ein Titeleinblender, und ein
// schwarzes Vorschaubild sagt ueber den Clip genau nichts.
const MARKEN = [0.10, 0.35, 0.60, 0.85];

// Breite der Standbilder. 320 px reicht fuer die Frage "ist das das Geraet?"
// und haelt das Blatt klein — bei 23 Clips sind das 92 Bilder auf einer Seite.
const BILD_BREITE = 320;

// Wo Schnittlisten liegen. Der Entwurf landet dort, wo der Renderer sie sucht —
// nicht in einem Downloads-Ordner, aus dem ihn jemand haendisch umkopiert.
const SCHNITTLISTEN_ORDNER = path.join(WURZEL, 'Marketing', 'schnittlisten');

// Vorgabelaenge je Segment im Entwurf. Kommt aus derselben Konfiguration, an
// der sich der Renderer orientiert — nicht aus einer zweiten Zahl hier.
const KONFIG_DATEI = path.join(WURZEL, 'Marketing', 'config', 'marketing.config.json');

// Ab welcher Bildaenderung ein Szenenwechsel gilt. 0.3 ist der Wert, mit dem
// ffmpeg selbst in seiner Dokumentation arbeitet: harte Schnitte werden
// zuverlaessig erkannt, eine Kamerafahrt oder ein Zoom nicht.
const SZENEN_SCHWELLE = 0.3;

// Wieviel vom Anfang eines Clips uebersprungen wird, wenn ein Schnittpunkt
// gesucht wird. Der Anfang fremder TikToks ist fast immer ein Titeleinblender
// oder ein schwarzes Bild — dieselbe Ueberlegung wie bei MARKEN, wo aus
// demselben Grund kein Standbild bei 0 % gezogen wird.
const ANFANG_UEBERSPRINGEN = 0.12;

function schnittLaenge() {
  try {
    const konfig = JSON.parse(fs.readFileSync(KONFIG_DATEI, 'utf8'));
    const wert = Number((konfig.video || {}).schnitt_max_sek);
    if (Number.isFinite(wert) && wert > 0) return wert;
  } catch {
    // Fehlt die Datei oder ist sie kaputt, ist das kein Grund, den Entwurf
    // ausfallen zu lassen. 2,2 s ist der Wert, der dort steht.
  }
  return 2.2;
}

// ── ffmpeg finden ────────────────────────────────────────────────────

/**
 * Sucht ffmpeg und ffprobe — und meldet ehrlich, wenn sie fehlen.
 *
 * Gleiche Linie wie findeYtdlp() im Hauptprogramm: Lieber mit klarem Hinweis
 * abbrechen als eine leere Ausgabe als Erfolg verkaufen. Der Marketing-Automat
 * sucht ffmpeg auf demselben Weg (Marketing/pipelines/video/common.py) — wer
 * dort schon gerendert hat, hat es also.
 */
function findeWerkzeug(name) {
  const kandidaten = process.platform === 'win32'
    ? [`${name}.exe`, name]
    : [name];
  for (const kandidat of kandidaten) {
    const lauf = spawnSync(kandidat, ['-version'], { encoding: 'utf8' });
    if (lauf.status === 0) return kandidat;
  }
  return null;
}

// ── Medienangaben ────────────────────────────────────────────────────

/**
 * Dauer, Breite und Hoehe eines Videos.
 *
 * Diese drei Werte sind der Grund, warum das Blatt mehr kann als eine
 * Bildergalerie: Sie beantworten genau die Frage, die der Textfilter nicht
 * beantworten kann — taugt der Clip technisch fuer einen 1080x1920-Schnitt.
 * Gibt null zurueck, wenn die Datei fuer ffprobe unlesbar ist; das ist ein
 * Befund und kein Fehler (eine 0-Byte-Datei sieht im Ordner aus wie ein Video).
 */
function medienInfo(ffprobe, videoPfad) {
  const lauf = spawnSync(ffprobe, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    videoPfad,
  ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });

  if (lauf.status !== 0) return null;
  let gelesen;
  try {
    gelesen = JSON.parse(lauf.stdout);
  } catch {
    return null;
  }
  const strom = (gelesen.streams || [])[0] || {};
  const format = gelesen.format || {};
  const dauer = Number(format.duration || 0);
  return {
    dauer: Number.isFinite(dauer) ? dauer : 0,
    breite: Number(strom.width || 0),
    hoehe: Number(strom.height || 0),
    bytes: Number(format.size || 0),
  };
}

/**
 * Hoch, quer oder quadratisch — in einem Wort.
 *
 * Das Ziel ist 1080x1920. Querformat ist deshalb nicht wertlos, aber es kann
 * nur Einblendung werden, nie Vollbild. Der Unterschied gehoert aufs Blatt.
 */
function formatWort(breite, hoehe) {
  if (!breite || !hoehe) return 'unbekannt';
  const verhaeltnis = breite / hoehe;
  if (verhaeltnis < 0.95) return 'hoch';
  if (verhaeltnis > 1.05) return 'quer';
  return 'quadratisch';
}

// ── Szenenwechsel ────────────────────────────────────────────────────

/**
 * Liest die Zeitpunkte aus dem, was ffmpeg beim Szenenfilter ausgibt.
 *
 * Eigene Funktion, damit sie ohne ffmpeg pruefbar ist: Die Ausgabe ist ein
 * Textstrom mit Zeilen der Form "pts_time:3.436667", und daran haengt die
 * ganze Erkennung. Ein Parser, der nur im Zusammenspiel mit dem echten
 * Werkzeug getestet werden kann, wird nicht getestet.
 */
function szenenAusAusgabe(text) {
  const zeiten = [];
  const muster = /pts_time:\s*([0-9]+(?:\.[0-9]+)?)/g;
  let treffer;
  while ((treffer = muster.exec(String(text || ''))) !== null) {
    const wert = Number(treffer[1]);
    if (Number.isFinite(wert)) zeiten.push(Math.round(wert * 100) / 100);
  }
  // Aufsteigend und ohne Dubletten: ffmpeg meldet dieselbe Stelle gelegentlich
  // zweimal, wenn zwei Bilder hintereinander stark abweichen.
  return [...new Set(zeiten)].sort((a, b) => a - b);
}

/**
 * Sucht die Szenenwechsel eines Clips. Ergebnis wird neben den Standbildern
 * zwischengespeichert.
 *
 * WARUM ZWISCHENGESPEICHERT WIRD
 * Anders als beim Standbild springt ffmpeg hier nicht, sondern dekodiert den
 * ganzen Clip. Bei 25 Clips ist der Unterschied zwischen "einmal" und "bei
 * jedem Aufruf" der Unterschied zwischen brauchbar und nervig — dieselbe
 * Ueberlegung wie bei ziehStandbilder().
 *
 * Gibt [] zurueck, wenn ffmpeg scheitert. Das ist ein Befund und kein
 * Fehler: Der Entwurf faellt dann auf "ab Sekunde 0" zurueck, statt gar
 * nicht zu entstehen.
 *
 * GEMESSENE GRENZE DES WERKZEUGS
 * ffmpeg rechnet den Szenenwert aus der Helligkeit, und bei flaechigem
 * Material greift das schlecht. Nachgemessen an drei aneinandergehaengten
 * Vierseckunden-Clips:
 *
 *   * einfarbig rot -> gruen -> blau: nur EIN Wechsel gefunden (bei 8 s),
 *     auch mit Schwelle 0,1 — der Uebergang rot/gruen liegt in der Helligkeit
 *     zu dicht beieinander.
 *   * dasselbe mit gemustertem Material: BEIDE Wechsel exakt gefunden
 *     (4 s und 8 s).
 *
 * Echtes TikTok-Material ist gemustert, dort stimmt es. Aber ein Clip ohne
 * gefundenen Wechsel heisst nicht "eine Einstellung" — er heisst "nicht
 * erkannt". Genau deshalb steht im Entwurf ein Hinweis, statt den geratenen
 * Ausschnitt wie einen gemessenen aussehen zu lassen.
 */
function szenenWechsel(ffmpeg, videoPfad, zielOrdner, stamm, { neuBauen = false } = {}) {
  const merker = path.join(zielOrdner, `${stamm}.szenen.json`);
  if (!neuBauen && fs.existsSync(merker)) {
    try {
      const gelesen = JSON.parse(fs.readFileSync(merker, 'utf8'));
      if (Array.isArray(gelesen)) return gelesen;
    } catch {
      // Kaputter Merker: neu messen statt aufgeben.
    }
  }

  const lauf = spawnSync(ffmpeg, [
    '-loglevel', 'info',
    '-i', videoPfad,
    '-vf', `select='gt(scene,${SZENEN_SCHWELLE})',metadata=print`,
    '-an', '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

  if (lauf.status !== 0) return [];
  const zeiten = szenenAusAusgabe(`${lauf.stderr || ''}${lauf.stdout || ''}`);
  try {
    fs.mkdirSync(zielOrdner, { recursive: true });
    fs.writeFileSync(merker, JSON.stringify(zeiten), 'utf8');
  } catch {
    // Nicht schreibbar ist kein Grund, das Ergebnis wegzuwerfen.
  }
  return zeiten;
}

/**
 * Aus Szenenwechseln einen Ausschnitt vorschlagen.
 *
 * WAS HIER ENTSCHIEDEN WIRD — UND WAS NICHT
 * Vorgeschlagen wird EIN Ausschnitt je Clip, nicht einer je Szene. Ein
 * Entwurf mit 25 Clips und je vier Szenen waere eine Liste mit hundert
 * Segmenten; die streicht niemand durch, die schliesst man wieder.
 *
 * Gewaehlt wird die LAENGSTE Szene, die nicht ganz am Anfang liegt. Lang
 * heisst: ruhige Einstellung, in der man das Geraet sieht. Der Anfang wird
 * uebersprungen, weil dort fast immer ein Titeleinblender steht — derselbe
 * Grund, aus dem bei den Standbildern keines bei 0 % gezogen wird.
 *
 * Ohne erkannte Szenen bleibt es bei "ab Sekunde 0". Das ist schlechter,
 * aber ehrlich: geraten wird nicht.
 */
function waehleAusschnitt(szenen, dauer, laenge) {
  const ende = Number(dauer) > 0 ? Number(dauer) : laenge;
  const frueh = ende * ANFANG_UEBERSPRINGEN;

  // Grenzen der Szenen: Anfang, jeder Wechsel, Ende.
  const marken = [0, ...(Array.isArray(szenen) ? szenen : []), ende]
    .filter((z) => Number.isFinite(z) && z >= 0 && z <= ende)
    .sort((a, b) => a - b);

  let besteVon = 0;
  let besteLaenge = -1;
  for (let i = 0; i < marken.length - 1; i += 1) {
    const von = marken[i];
    const bis = marken[i + 1];
    if (von < frueh) continue;          // Titeleinblender ueberspringen
    const spanne = bis - von;
    if (spanne > besteLaenge) {
      besteLaenge = spanne;
      besteVon = von;
    }
  }

  // Alles vor der Anfangsmarke: dann gibt es keinen besseren Vorschlag.
  if (besteLaenge < 0) return { von: 0, bis: Math.min(laenge, ende) };

  const von = Math.round(besteVon * 100) / 100;
  const bis = Math.round(Math.min(von + laenge, ende) * 100) / 100;
  // Ein Rest von unter einer halben Sekunde ist kein Segment.
  if (bis - von < 0.5) return { von: 0, bis: Math.min(laenge, ende) };
  return { von, bis };
}

// ── Standbilder ziehen ───────────────────────────────────────────────

/**
 * Zieht die vier Standbilder eines Videos. Gibt die Dateinamen zurueck.
 *
 * Vorhandene Bilder werden NICHT neu erzeugt: Das Ziehen kostet pro Video
 * mehrere Sekunden, und bei 23 Clips ist der Unterschied zwischen "einmal" und
 * "bei jedem Aufruf" der Unterschied zwischen brauchbar und nervig. Dieselbe
 * Ueberlegung wie bei .bestand.json im Schnitt-Zweig.
 */
function ziehStandbilder(ffmpeg, videoPfad, zielOrdner, stamm, dauer, { neuBauen = false } = {}) {
  fs.mkdirSync(zielOrdner, { recursive: true });
  const bilder = [];

  MARKEN.forEach((marke, nr) => {
    const name = `${stamm}_${nr + 1}.jpg`;
    const ziel = path.join(zielOrdner, name);

    if (!neuBauen && fs.existsSync(ziel) && fs.statSync(ziel).size > 0) {
      bilder.push(name);
      return;
    }

    // Bei unbekannter Dauer auf eine feste Sekunde ausweichen statt zu raten:
    // Ein Sprung hinter das Dateiende liefert gar kein Bild, und zwar ohne
    // Fehlermeldung — die Datei fehlt danach einfach.
    const zeitpunkt = dauer > 0 ? (dauer * marke) : (nr + 1);

    const lauf = spawnSync(ffmpeg, [
      '-loglevel', 'error',
      // -ss VOR -i ist um ein Vielfaches schneller: ffmpeg springt, statt das
      // Video bis zur Stelle abzuspielen. Bei vier Bildern mal 23 Videos ist
      // das der Unterschied zwischen Sekunden und Minuten.
      '-ss', zeitpunkt.toFixed(2),
      '-i', videoPfad,
      '-frames:v', '1',
      '-vf', `scale=${BILD_BREITE}:-2`,
      '-q:v', '4',
      '-y', ziel,
    ], { encoding: 'utf8' });

    // Auch hier gilt der Satz aus dem Handbuch: nicht dem Rueckgabewert
    // glauben, sondern nachsehen, ob eine Datei da ist. ffmpeg meldet bei
    // einem Sprung ins Leere durchaus Erfolg.
    if (fs.existsSync(ziel) && fs.statSync(ziel).size > 0) bilder.push(name);
  });

  return bilder;
}

// ── Index lesen ──────────────────────────────────────────────────────

/**
 * Alle Eintraege, zu denen wirklich eine Datei auf der Platte liegt.
 *
 * Der Index fuehrt auch `frueher_geladen` — Videos, die es einmal gab und die
 * aufgeraeumt wurden. Die gehoeren nicht aufs Blatt: Ein Vorschaubild zu einer
 * Datei, die niemand mehr oeffnen kann, ist eine Enttaeuschung mit Bild.
 */
function eintraegeMitDatei(index, videoOrdner, datenOrdner) {
  const treffer = [];
  for (const eintrag of (index.eintraege || [])) {
    const orte = sync.dateiOrte(eintrag, videoOrdner, datenOrdner);
    const gefunden = orte.find((ort) => {
      try { return fs.statSync(ort).size > 0; } catch { return false; }
    });
    if (gefunden) treffer.push({ eintrag, pfad: gefunden });
  }
  return treffer;
}

// ── Das Blatt ────────────────────────────────────────────────────────

function schuetzeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function zahl(wert, nachkomma = 0) {
  const n = Number(wert);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma });
}

/**
 * Baut das HTML-Blatt.
 *
 * Bewusst eine einzelne Datei ohne Skript und ohne Netzverweise: Sie liegt
 * neben Videos in einem ignorierten Ordner, wird lokal per Doppelklick
 * geoeffnet und soll das in fuenf Jahren noch tun. Die Auf- und Zuklapperei
 * macht <details>, nicht JavaScript.
 */
function baueBlatt(produktName, produktId, zeilen) {
  const kopf = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kontaktbogen ${schuetzeHtml(produktId)} — ${schuetzeHtml(produktName)}</title>
<style>
  :root{color-scheme:light dark;}
  body{margin:0;padding:24px;background:#14141a;color:#ece9f2;
    font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;}
  h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:26px;margin:0 0 4px;}
  .unter{color:#9b97a8;font-size:14px;margin:0 0 24px;}
  .clip{border:1px solid #26262f;border-radius:10px;background:#1a1a22;
    padding:14px 16px;margin-bottom:14px;}
  .clip.warnung{border-left:3px solid #e2963f;}
  .bilder{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
  .bilder img{width:180px;border-radius:6px;display:block;background:#000;}
  .titel{font-weight:600;font-size:15px;margin:0 0 6px;}
  .werte{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:#9b97a8;margin-bottom:8px;}
  .werte b{color:#ece9f2;font-weight:600;}
  .warn{color:#e2963f;font-weight:600;}
  .gut{color:#33c479;font-weight:600;}
  .untertitel{font-size:13.5px;color:#c9c5d4;background:#111118;border-radius:6px;
    padding:8px 10px;margin:0 0 8px;white-space:pre-wrap;word-break:break-word;}
  a{color:#4d8fe0;}
  code{background:#26262f;padding:1px 5px;border-radius:4px;font-size:12px;
    font-family:ui-monospace,Consolas,monospace;}
  @media (max-width:520px){.bilder img{width:calc(50% - 4px);}}
</style>
</head>
<body>
<h1>${schuetzeHtml(produktName)}</h1>
<p class="unter">Produkt ${schuetzeHtml(produktId)} · ${zeilen.length} Clip(s) mit Datei ·
erzeugt ${new Date().toLocaleString('de-DE')} · <b>Dies ist eine Lesehilfe, kein Urteil.</b>
Rechte sind damit nicht geprüft.</p>
`;

  const koerper = zeilen.map((z) => {
    const e = z.eintrag;
    const info = z.info;
    const bilder = z.bilder.map((b) => (
      `<img src="${BILDER_ORDNER}/${schuetzeHtml(b)}" alt="Standbild" loading="lazy">`
    )).join('\n      ');

    // Was hier als Warnung erscheint, sind genau die Eigenschaften, die der
    // Textfilter nicht sehen kann — und die spaeter die Ausgangspruefung des
    // Automaten ablehnen wuerde.
    const hinweise = [];
    if (!info) hinweise.push('für ffprobe unlesbar');
    else {
      if (info.hoehe && info.hoehe < 720) hinweise.push(`nur ${info.hoehe}p`);
      if (info.dauer && info.dauer < 5) hinweise.push(`nur ${info.dauer.toFixed(1)} s`);
      if (formatWort(info.breite, info.hoehe) === 'quer') hinweise.push('Querformat');
    }

    const werte = info ? [
      `<span><b>${zahl(info.dauer, 1)} s</b></span>`,
      `<span><b>${info.breite}×${info.hoehe}</b> (${formatWort(info.breite, info.hoehe)})</span>`,
      `<span>${zahl(info.bytes / (1024 * 1024), 1)} MB</span>`,
    ].join('\n      ') : '<span class="warn">keine Medienangaben</span>';

    return `  <div class="clip${hinweise.length ? ' warnung' : ''}">
    <div class="bilder">
      ${bilder || '<span class="warn">keine Standbilder erzeugt</span>'}
    </div>
    <p class="titel">${schuetzeHtml(e.titel || e.datei || 'ohne Titel')}</p>
    <div class="werte">
      ${werte}
      <span>Treffer <b>${zahl(e.trefferwert, 2)}</b></span>
      ${e.creator ? `<span>${schuetzeHtml(e.creator)}</span>` : ''}
      ${hinweise.length ? `<span class="warn">⚠ ${hinweise.map(schuetzeHtml).join(' · ')}</span>` : '<span class="gut">✓ technisch brauchbar</span>'}
    </div>
    ${e.untertitel ? `<p class="untertitel">${schuetzeHtml(e.untertitel)}</p>` : ''}
    <div class="werte">
      <span><code>${schuetzeHtml(e.datei || '')}</code></span>
      ${e.quelle_url ? `<span><a href="${schuetzeHtml(e.quelle_url)}">Quelle</a></span>` : ''}
      <span>Rechte: <b class="${e.rechte_geprueft ? 'gut' : 'warn'}">${e.rechte_geprueft ? 'geprüft' : 'ungeprüft'}</b></span>
    </div>
  </div>`;
  }).join('\n');

  return `${kopf}${koerper}\n</body>\n</html>\n`;
}

// ── Ablauf ───────────────────────────────────────────────────────────

/**
 * Baut die Kontaktboegen. Gibt zurueck, was entstanden ist.
 *
 * Als eigene Funktion und nicht in main(), damit der Testlauf sie ohne
 * Kommandozeile aufrufen kann — wie lauf() im Hauptprogramm.
 */
/**
 * Aus den Clips eines Produkts ein Schnittlisten-Geruest bauen.
 *
 * WOZU
 * Der Bogen nennt je Clip Dateiname, Dauer und Aufloesung — genau die Felder,
 * die in eine Schnittliste gehoeren. Bisher las der Mensch sie ab und tippte
 * sie in JSON. Bei 25 Clips zum Wasserspender ist das eine Viertelstunde
 * Abschreiben mit vier Gelegenheiten fuer einen Tippfehler, den dann lies()
 * abfaengt — gut gebaut, aber es haette gar nicht erst passieren muessen.
 *
 * WAS DER ENTWURF IST UND WAS NICHT
 * Er ist eine Liste zum STREICHEN, keine fertige Fassung. Jeder Clip kommt mit
 * einer Vorgabelaenge hinein; der Mensch wirft raus, ordnet um und setzt die
 * Zeitmarken. Die Maschine entscheidet hier nichts — sie tippt nur ab.
 *
 * Der fuehrende Unterstrich im Dateinamen ist die Sicherung: Dateien, die so
 * heissen, werden vom Renderer uebersprungen. Ein Entwurf mit fuenfundzwanzig
 * Segmenten à 2,2 s waere ein 55-Sekunden-Video — und genau das soll nicht
 * versehentlich entstehen.
 */
function baueEntwurf({ produktId, produktName, zeilen, laenge = 2.2 }) {
  const segmente = zeilen.map((z) => {
    const info = z.info;
    const dauer = info ? info.dauer : 0;
    const format = info ? formatWort(info.breite, info.hoehe) : 'unbekannt';
    const szenen = Array.isArray(z.szenen) ? z.szenen : [];
    // Mit erkannten Szenen wird der Ausschnitt aus dem MATERIAL vorgeschlagen,
    // ohne bleibt es bei "ab Sekunde 0" — geraten wird nicht.
    const ausschnitt = waehleAusschnitt(szenen, dauer, laenge);

    const hinweise = [];
    if (format === 'quer') hinweise.push('Querformat — taugt nur als Einblendung');
    if (info && info.hoehe && info.hoehe < 720) hinweise.push(`nur ${info.hoehe}p`);
    if (dauer > 0 && dauer < 2) hinweise.push(`nur ${dauer.toFixed(1)}s lang`);
    if (!szenen.length && dauer > 4) {
      hinweise.push('kein Szenenwechsel erkannt — Ausschnitt geraten, bitte nachsehen');
    }

    const segment = {
      quelle: z.eintrag.datei,
      von: ausschnitt.von,
      bis: ausschnitt.bis,
      // Felder mit Unterstrich ignoriert der Renderer. Sie stehen hier, damit
      // man beim Streichen sieht, was man streicht, ohne den Bogen daneben
      // offen zu halten.
      _dauer: dauer > 0 ? Math.round(dauer * 10) / 10 : null,
      _format: format,
      _creator: z.eintrag.creator || null,
      // Die uebrigen Schnittpunkte stehen daneben, damit man den Vorschlag
      // verschieben kann, ohne das Video zu oeffnen.
      _szenen: szenen.length ? szenen : null,
    };
    // Schwarze Balken: Der Bot hat den echten Bildbereich beim Laden
    // gemessen und im Index vermerkt. Hier wandert er als Zuschnitt in die
    // Liste — der Renderer wendet ihn VOR dem Einpassen an, sonst gaebe es
    // Balken im Balken.
    if (z.eintrag.zuschnitt) {
      segment.zuschnitt = String(z.eintrag.zuschnitt);
      const prozent = z.eintrag.rand_anteil != null
        ? ` (${Math.round(Number(z.eintrag.rand_anteil) * 100)} % Rand)` : '';
      hinweise.push(`Zuschnitt aus dem Index übernommen${prozent}`);
    }
    if (hinweise.length) segment._achtung = hinweise.join(' · ');
    return segment;
  });

  return {
    _hinweis: 'ENTWURF aus dem Kontaktbogen. Streichen, umsortieren, Zeitmarken '
      + 'setzen — und "hook", "cta" und "hashtags" ausfuellen, sonst geht der '
      + 'Beitrag ohne Text raus. Danach OHNE fuehrenden Unterstrich speichern, '
      + 'erst dann wird gerendert.',
    produkt_id: Number(produktId),
    musik: null,
    hook: '',
    cta: '',
    hashtags: [],
    segmente,
  };
}

function baueBoegen({ ffmpeg, ffprobe, ordner, videoOrdner, nurProdukt = null, neuBauen = false,
  entwurf = false, schnittlistenOrdner = SCHNITTLISTEN_ORDNER,
  ausgabe = console.log } = {}) {
  const index = sync.ladeIndex(ordner);
  const alle = eintraegeMitDatei(index, videoOrdner, ordner);

  if (!alle.length) {
    ausgabe('Kein Rohmaterial mit Datei gefunden — nichts zu zeigen.');
    return { boegen: [], clips: 0 };
  }

  // Nach Produkt buendeln: ein Blatt je Produkt. Ein einziges Blatt ueber alle
  // 40 Produkte waere genau die unuebersichtliche Liste, die es ersetzen soll.
  const nachProdukt = new Map();
  for (const zeile of alle) {
    const id = String(zeile.eintrag.produkt_id != null ? zeile.eintrag.produkt_id : 'ohne');
    if (nurProdukt !== null && id !== String(nurProdukt)) continue;
    if (!nachProdukt.has(id)) nachProdukt.set(id, []);
    nachProdukt.get(id).push(zeile);
  }

  if (!nachProdukt.size) {
    ausgabe(`Für Produkt ${nurProdukt} liegt kein Rohmaterial mit Datei vor.`);
    return { boegen: [], clips: 0 };
  }

  const boegen = [];
  const entwuerfe = [];
  let clips = 0;

  for (const [id, zeilen] of nachProdukt) {
    const erstes = zeilen[0].eintrag;
    const name = erstes.produkt_name || `Produkt ${id}`;
    // Das Blatt liegt bei den Videos. Alle Videos eines Produkts liegen im
    // selben Ordner, deshalb reicht der Ordner der ersten Datei.
    const zielOrdner = path.dirname(zeilen[0].pfad);
    const bilderOrdner = path.join(zielOrdner, BILDER_ORDNER);

    ausgabe(`\n${name} (Produkt ${id}) — ${zeilen.length} Clip(s)`);

    const fertig = [];
    for (const zeile of zeilen) {
      const stamm = path.basename(zeile.pfad).replace(/\.[^.]+$/, '');
      const info = medienInfo(ffprobe, zeile.pfad);
      const bilder = ziehStandbilder(
        ffmpeg, zeile.pfad, bilderOrdner, stamm,
        info ? info.dauer : 0, { neuBauen },
      );
      // Szenen nur suchen, wenn ein Entwurf entsteht: Das kostet einen vollen
      // Durchlauf je Clip, und fuer das Blatt allein bringt es nichts.
      const szenen = entwurf
        ? szenenWechsel(ffmpeg, zeile.pfad, bilderOrdner, stamm, { neuBauen })
        : [];
      fertig.push({ eintrag: zeile.eintrag, info, bilder, szenen });
      clips += 1;
      ausgabe(`  ${bilder.length === MARKEN.length ? '✅' : '⚠️ '} ${stamm} — ${bilder.length}/${MARKEN.length} Standbilder`);
    }

    const blatt = path.join(zielOrdner, 'kontaktbogen.html');
    fs.writeFileSync(blatt, baueBlatt(name, id, fertig), 'utf8');
    boegen.push(blatt);
    ausgabe(`  → ${path.relative(WURZEL, blatt)}`);

    if (entwurf) {
      const ziel = path.join(schnittlistenOrdner, `_entwurf-${id}.json`);
      // EINEN VORHANDENEN ENTWURF NICHT UEBERSCHREIBEN.
      //
      // Wer eine halbe Stunde lang Zeitmarken gesetzt hat und den Bogen dann
      // noch einmal baut, weil zwei Clips dazugekommen sind, verliert sonst
      // die Arbeit — lautlos, weil der Aufruf ja "erfolgreich" war.
      if (fs.existsSync(ziel) && !neuBauen) {
        ausgabe(`  → ${path.relative(WURZEL, ziel)} besteht bereits — nicht `
          + 'angefasst (mit --neu überschreiben)');
      } else {
        fs.mkdirSync(schnittlistenOrdner, { recursive: true });
        const inhalt = baueEntwurf({
          produktId: id, produktName: name, zeilen: fertig, laenge: schnittLaenge(),
        });
        fs.writeFileSync(ziel, `${JSON.stringify(inhalt, null, 2)}\n`, 'utf8');
        entwuerfe.push(ziel);
        ausgabe(`  → ${path.relative(WURZEL, ziel)} (${inhalt.segmente.length} Segmente zum Streichen)`);
      }
    }
  }

  return { boegen, clips, entwuerfe };
}

function leseArgumente(argv) {
  const opt = { produkt: null, neu: false, schnittliste: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--produkt') { opt.produkt = argv[i + 1]; i += 1; }
    else if (arg === '--neu') opt.neu = true;
    else if (arg === '--schnittliste') opt.schnittliste = true;
  }
  return opt;
}

function main(argv) {
  const opt = leseArgumente(argv);

  const ffmpeg = findeWerkzeug('ffmpeg');
  const ffprobe = findeWerkzeug('ffprobe');
  if (!ffmpeg || !ffprobe) {
    console.error('❌ Abbruch: ffmpeg/ffprobe nicht gefunden.');
    console.error('   Windows: winget install Gyan.FFmpeg   (danach neues Terminal öffnen)');
    console.error('   Der Marketing-Automat braucht dieselben Programme zum Rendern.');
    return 1;
  }

  const ordner = sync.datenOrdner();
  const ergebnis = baueBoegen({
    ffmpeg, ffprobe, ordner,
    videoOrdner: sync.VIDEO_ORDNER,
    nurProdukt: opt.produkt,
    neuBauen: opt.neu,
    entwurf: opt.schnittliste,
  });

  if (!ergebnis.boegen.length) return 0;
  console.log(`\n✅ ${ergebnis.boegen.length} Kontaktbogen/-bögen für ${ergebnis.clips} Clip(s).`);
  console.log('   Im Browser öffnen (Doppelklick). Die Standbilder liegen daneben.');
  if (ergebnis.entwuerfe && ergebnis.entwuerfe.length) {
    console.log(`\n📝 ${ergebnis.entwuerfe.length} Schnittlisten-Entwurf/-Entwürfe in Marketing/schnittlisten/.`);
    console.log('   Streichen, umsortieren, hook/cta/hashtags ausfüllen —');
    console.log('   dann ohne führenden Unterstrich speichern, erst dann wird gerendert.');
  }
  return 0;
}

if (require.main === module) {
  try {
    const code = main(process.argv.slice(2));
    if (code) process.exit(code);
  } catch (fehler) {
    console.error(`❌ Abbruch: ${fehler.message}`);
    process.exit(1);
  }
}

module.exports = {
  findeWerkzeug, medienInfo, formatWort, ziehStandbilder,
  eintraegeMitDatei, baueBlatt, baueBoegen, baueEntwurf, leseArgumente,
  schuetzeHtml, schnittLaenge, szenenAusAusgabe, szenenWechsel, waehleAusschnitt,
  MARKEN, BILDER_ORDNER, BILD_BREITE, SCHNITTLISTEN_ORDNER,
  SZENEN_SCHWELLE, ANFANG_UEBERSPRINGEN,
};
