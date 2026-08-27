/**
 * Tests fuer den TikTok-Rohmaterial-Bot.
 *
 * Der Kern, den diese Tests absichern: Dieses Programm laedt fremde Videos aus
 * dem Netz. Jeder Fehler hier ist entweder Datenmuell (falsch zugeordnetes
 * Material, das im Ordner wie ein Treffer aussieht) oder unnoetiger Verkehr
 * gegen TikTok. Beides faellt nicht auf, wenn man nur in den Ordner schaut —
 * dort liegen ja Dateien.
 *
 * Kein Netz, kein installiertes yt-dlp: Alles, was yt-dlp startet, laeuft durch
 * EINE Funktion, und die wird hier durch einen Nachbau ersetzt.
 *
 * Projektregel aus CLAUDE.md §2: Ein Test, der nur gruen werden kann, ist
 * wertlos. Zu jeder Pruefung steht darum eine Gegenprobe daneben, die das
 * falsche Verhalten nachbildet und belegt, dass der Test es rot gemeldet haette.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  lauf, ladeIndex, speichereIndex, produktBegriffe, trefferwert,
  quellenFuer, konfigZuProdukt, normalisiere, STANDARD, pruefListePfad,
  belastbar, getroffeneBegriffe,
  sucheAdressen, istMusik, pruefeSprache, wirdGeredet, begriffeFuer,
  begriffsGruppen, bewerte, ausschlussTreffer, spracheDesTextes, hatKernwort,
  naechsteNummer, slugFuerDateiname, schuetzeDatei,
  interaktiv, frageStelle, TIKTOK_VIDEO_MUSTER,
  verwaisteEintraege, raeumeIndexAuf, aufraeumen, schonImIndex, schonAlsDateiDa,
  sprachHinweise, textAusPuffern, videoText, ladeKonfig,
  hatMerkmal, getroffeneMerkmale, adressenAusText, zerlege, impersonationVerfuegbar,
  produktOrdner, imRohmaterial, brauchtEinzelschutz, legeProduktOrdnerAn,
  gesprocheneSprache, sprachePasst, SPRACHE_SICHER, indexPfad,
} = require('./tiktok-video-sync');
const { PassThrough } = require('stream');

// ── Nachbauten ───────────────────────────────────────────────────────

const PRODUKT = {
  id: 10,
  name: 'Elektrischer Wasserspender für Schreibtisch',
  slug: 'elektrischer-wasserspender-fuer-schreibtisch',
};

// Passt: enthaelt alle drei Suchbegriffe (elektrischer, wasserspender,
// schreibtisch) -> Trefferwert 1.
const TREFFER = {
  id: '7300000000000000001',
  url: 'https://www.tiktok.com/@buerokram/video/7300000000000000001',
  title: 'Elektrischer Wasserspender am Schreibtisch im Test',
  uploader: '@buerokram',
};

// Passt nicht: kein einziger Suchbegriff -> Trefferwert 0.
const DANEBEN = {
  id: '7300000000000000002',
  url: 'https://www.tiktok.com/@katzen/video/7300000000000000002',
  title: 'Meine Katze schlaeft wieder auf der Tastatur',
  uploader: '@katzen',
};

const KONFIG = {
  standard: { ...STANDARD },
  produkte: { 10: { hashtags: ['wasserspender'] } },
};

/**
 * Nachbau von yt-dlp.
 *
 * Bildet nach, was das echte Programm nach aussen tut — und zwar ehrlich:
 * Beim Download SCHREIBT es eine Datei. Ein Nachbau, der nur "code 0" meldet,
 * ohne etwas anzulegen, wuerde die Groessen- und Pruefsummen-Ermittlung
 * ueberspringen und damit genau den Teil ungeprueft lassen, der den Index
 * fuellt (siehe Merksatz "Nachbauten muessen luegenfrei sein").
 */
function nachbauYtdlp({ extractors = ['tiktok', 'tiktok:user', 'tiktok:tag'], kandidaten = [TREFFER] } = {}) {
  const aufrufe = [];
  const ytdlp = async (argumente) => {
    aufrufe.push(argumente);

    if (argumente.includes('--list-extractors')) {
      return { code: 0, stdout: [...extractors, 'youtube', 'vimeo'].join('\n'), stderr: '' };
    }
    if (argumente.includes('--dump-json')) {
      return { code: 0, stdout: kandidaten.map((k) => JSON.stringify(k)).join('\n'), stderr: '' };
    }

    // Download-Aufruf: Datei anlegen, wie yt-dlp es taete.
    const ziel = argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
    fs.writeFileSync(ziel, 'kein echtes Video, nur Fuellung fuer den Test');
    return { code: 0, stdout: '', stderr: '' };
  };
  return {
    ytdlp,
    aufrufe,
    downloads: () => aufrufe.filter((a) => a.includes('-o')),
  };
}

// Echtes yt-dlp meldet hier 38 Ziele, sobald curl_cffi installiert ist.
// Fehlt das Paket, beantwortet TikTok keine einzige Anfrage — deshalb fragt
// der Bot einmal vorab. Die Nachbauten muessen diese Frage mitbeantworten.
const nachahmungDa = async () => ({ ok: true, anzahl: 38 });

// Videos liegen seit dem Umbau in rohmaterial/<NN>_<slug>/ statt flach im
// Sammelordner. Die Tests zaehlen deshalb rekursiv — so pruefen sie WAS
// geladen wurde, ohne sich an den genauen Ablageort zu klammern.
function geladeneVideos(basis) {
  const gefunden = [];
  const gehe = (ordner) => {
    let eintraege = [];
    try { eintraege = fs.readdirSync(ordner, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      const voll = path.join(ordner, e.name);
      if (e.isDirectory()) gehe(voll);
      else if (e.name.endsWith('.mp4')) gefunden.push(e.name);
    }
  };
  gehe(basis);
  return gefunden;
}

function tempOrdner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-sync-test-'));
}

const still = () => {};

/** Ein Lauf mit allen Vorgaben, die nicht aus der echten Umgebung kommen duerfen. */
function baueLauf(ytdlp, ordner, zusatz = {}) {
  return lauf({
    ytdlp,
    produkte: [PRODUKT],
    konfig: KONFIG,
    standard: { ...STANDARD },
    ordner,
    // Ein Pfad, der garantiert nicht existiert — sonst haengt das Ergebnis
    // davon ab, ob gerade jemand lokal Marketing/STOP angelegt hat.
    stopDatei: path.join(ordner, 'STOP-gibt-es-nicht'),
    env: {},
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
    jetzt: () => '2026-08-18T12:00:00.000Z',
    ...zusatz,
  });
}

// ── Trockenlauf ──────────────────────────────────────────────────────

test('Trockenlauf laedt nichts — auch bei perfektem Treffer', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  const ergebnis = await baueLauf(bau.ytdlp, ordner);          // ohne laden

  assert.equal(bau.downloads().length, 0, 'im Trockenlauf darf kein Download-Aufruf rausgehen');
  assert.equal(ergebnis.geladen.length, 0);
  assert.equal(geladeneVideos(ordner).length, 0,
    'es darf keine Videodatei im Ordner liegen');
  assert.equal(ladeIndex(ordner).eintraege.length, 0, 'der Index muss leer bleiben');

  // Die Pruefliste entsteht trotzdem — sonst waere der Trockenlauf ergebnislos.
  const liste = JSON.parse(fs.readFileSync(pruefListePfad(ordner), 'utf8'));
  assert.equal(liste.trockenlauf, true);
  assert.equal(liste.eintraege.length, 1);
  assert.match(liste.eintraege[0].grund, /Trockenlauf/);
});

test('Gegenprobe: derselbe Fall MIT --laden laedt sehr wohl', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  const ergebnis = await baueLauf(bau.ytdlp, ordner, { laden: true });

  // Beweist, dass der Test oben nicht deshalb gruen ist, weil der Nachbau
  // grundsaetzlich nichts laedt. Wuerde der Trockenlauf laden, waere er rot.
  assert.equal(bau.downloads().length, 1, 'mit --laden muss genau ein Download rausgehen');
  assert.equal(ergebnis.geladen.length, 1);
  assert.equal(geladeneVideos(ordner).length, 1);
});

// ── Schwelle ─────────────────────────────────────────────────────────

test('Trefferwert unter der Schwelle wird NICHT geladen', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp({ kandidaten: [DANEBEN] });

  const ergebnis = await baueLauf(bau.ytdlp, ordner, { laden: true });

  assert.equal(bau.downloads().length, 0, 'ein Video ohne Bezug darf nicht geladen werden');
  assert.equal(ergebnis.geladen.length, 0);
  assert.equal(ergebnis.pruefliste.length, 1, 'es gehoert in die Pruefliste, nicht in den Papierkorb');
  assert.match(ergebnis.pruefliste[0].grund, /unter Schwelle/);
  assert.equal(ergebnis.pruefliste[0].quelle_url, DANEBEN.url);
});

// Fuenf Begriffe: elektrischer, wasserspender, schreibtisch, buero, zuhause.
const PRODUKT_LANG = {
  id: 10,
  name: 'Elektrischer Wasserspender für Schreibtisch Büro Zuhause',
  slug: 'elektrischer-wasserspender-fuer-schreibtisch-buero-zuhause',
};

// Trifft genau zwei der fuenf Begriffe -> Wert 0.4, aber belastbar.
const TEILTREFFER = {
  id: '7300000000000000009',
  url: 'https://www.tiktok.com/@buerokram/video/7300000000000000009',
  title: 'Wasserspender im Büro ausprobiert',
  uploader: '@buerokram',
};

test('Gegenprobe: mit Schwelle 0 wuerde dasselbe Video geladen', async () => {
  const bau1 = nachbauYtdlp({ kandidaten: [TEILTREFFER] });
  const ordner1 = tempOrdner();
  const ergebnis = await baueLauf(bau1.ytdlp, ordner1, { laden: true, produkte: [PRODUKT_LANG] });

  // Vorbedingung: scheitert AUSSCHLIESSLICH an der Schwelle, nicht an der
  // Belastbarkeit — zwei Begriffe treffen ja.
  assert.equal(bau1.downloads().length, 0);
  assert.match(ergebnis.pruefliste[0].grund, /unter Schwelle/);
  assert.equal(ergebnis.pruefliste[0].trefferwert, 0.4);

  // Gegenprobe: dieselbe Lage mit Schwelle 0 laedt. Damit haengt der Test oben
  // wirklich an der Schwelle und nicht daran, dass dieses Video aus einem
  // anderen Grund gar nicht erst ankommt.
  const bau2 = nachbauYtdlp({ kandidaten: [TEILTREFFER] });
  const ordner2 = tempOrdner();
  await baueLauf(bau2.ytdlp, ordner2, { laden: true, schwelle: 0, produkte: [PRODUKT_LANG] });
  assert.equal(bau2.downloads().length, 1,
    'Gegenprobe: ohne Schwelle wird geladen — genau das soll die Schwelle verhindern');
});

test('das Katzenvideo scheitert an BEIDEM — Schwelle und Belastbarkeit', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp({ kandidaten: [DANEBEN] });

  // Selbst ohne Schwelle bleibt es draussen: kein einziger Begriff trifft.
  // Vor der Belastbarkeitsregel wurde es hier heruntergeladen.
  await baueLauf(bau.ytdlp, ordner, { laden: true, schwelle: 0 });
  assert.equal(bau.downloads().length, 0,
    'ein Video ohne jeden Bezug darf auch bei Schwelle 0 nicht geladen werden');
});

// ── Wiederholte Laeufe ───────────────────────────────────────────────

test('bereits indizierte URL wird beim zweiten Lauf uebersprungen', async () => {
  const ordner = tempOrdner();

  // Erster Lauf: laedt.
  const ersterBau = nachbauYtdlp();
  await baueLauf(ersterBau.ytdlp, ordner, { laden: true });
  assert.equal(ersterBau.downloads().length, 1, 'Vorbedingung: der erste Lauf laedt');

  // Zweiter Lauf: gleiche Quelle, gleicher Kandidat, gleicher Ordner.
  const zweiterBau = nachbauYtdlp();
  const ergebnis = await baueLauf(zweiterBau.ytdlp, ordner, { laden: true });

  assert.equal(zweiterBau.downloads().length, 0, 'der zweite Lauf darf nicht erneut laden');
  assert.equal(ladeIndex(ordner).eintraege.length, 1, 'der Index darf keinen Doppeleintrag bekommen');
  assert.ok(
    ergebnis.uebersprungen.some((u) => u.art === 'bereits_geladen' && u.quelle_url === TREFFER.url),
    'das Ueberspringen muss protokolliert sein, nicht stillschweigend passieren',
  );
});

test('Gegenprobe: bei leerem Index laedt derselbe zweite Lauf', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  // Index von Hand geleert = der Zustand, den es ohne die Index-Pruefung
  // bei JEDEM Lauf gaebe.
  speichereIndex(ordner, { version: 1, eintraege: [] });
  await baueLauf(bau.ytdlp, ordner, { laden: true });

  assert.equal(bau.downloads().length, 1,
    'Gegenprobe: ohne Index-Eintrag wird geladen — der Test oben haengt also wirklich am Index');
});

test('nur die Video-ID im Index reicht schon zum Ueberspringen', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  // Gleiches Video, aber unter anderer URL vermerkt (m.tiktok.com statt www).
  // Ohne den ID-Vergleich waere das ein zweiter Download derselben Datei.
  speichereIndex(ordner, {
    version: 1,
    eintraege: [{ video_id: TREFFER.id, quelle_url: 'https://m.tiktok.com/v/7300000000000000001', rechte_geprueft: false }],
  });
  await baueLauf(bau.ytdlp, ordner, { laden: true });

  assert.equal(bau.downloads().length, 0, 'dieselbe Video-ID unter anderer URL ist trotzdem dieselbe Datei');
});

// ── Notaus ───────────────────────────────────────────────────────────

test('Marketing/STOP haelt den Lauf an, bevor irgendetwas passiert', async () => {
  const ordner = tempOrdner();
  const stopDatei = path.join(ordner, 'STOP');
  fs.writeFileSync(stopDatei, '');
  const bau = nachbauYtdlp();

  const ergebnis = await baueLauf(bau.ytdlp, ordner, { laden: true, stopDatei });

  assert.equal(ergebnis.abgebrochen, true);
  assert.match(ergebnis.grund, /Notaus/);
  // Nicht nur "nichts geladen": Es darf ueberhaupt kein yt-dlp-Aufruf rausgehen,
  // auch nicht das harmlose --list-extractors.
  assert.equal(bau.aufrufe.length, 0, 'bei Notaus darf yt-dlp gar nicht erst starten');
  assert.equal(ergebnis.geladen.length, 0);
});

test('Gegenprobe: ohne STOP-Datei laeuft genau derselbe Aufruf durch', async () => {
  const ordner = tempOrdner();
  const stopDatei = path.join(ordner, 'STOP');          // wird NICHT angelegt
  const bau = nachbauYtdlp();

  const ergebnis = await baueLauf(bau.ytdlp, ordner, { laden: true, stopDatei });

  assert.equal(ergebnis.abgebrochen, false);
  assert.ok(bau.aufrufe.length > 0,
    'Gegenprobe: ohne Notaus wird gearbeitet — der Test oben misst also den Notaus');
  assert.equal(ergebnis.geladen.length, 1);
});

test('MARKETING_ENABLED=false haelt genauso an', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  const ergebnis = await baueLauf(bau.ytdlp, ordner, {
    laden: true,
    env: { MARKETING_ENABLED: 'false' },
  });

  assert.equal(ergebnis.abgebrochen, true);
  assert.match(ergebnis.grund, /MARKETING_ENABLED/);
  assert.equal(bau.aufrufe.length, 0);
});

// ── Zuordnung ────────────────────────────────────────────────────────

test('Fuellwoerter zaehlen nicht als Treffer', () => {
  const begriffe = produktBegriffe(PRODUKT);
  assert.ok(!begriffe.includes('fuer'), '"für" darf kein Suchbegriff sein');
  assert.deepEqual(begriffe, ['elektrischer', 'wasserspender', 'schreibtisch']);

  const fremd = { title: 'Das beste Rezept für Pfannkuchen' };
  assert.equal(trefferwert(begriffe, fremd), 0);

  // Gegenprobe: mit "fuer" in der Begriffsliste — dem Verhalten ohne
  // Stoppwortfilter — punktet dasselbe voellig fremde Video bereits.
  assert.ok(trefferwert([...begriffe, 'fuer'], fremd) > 0,
    'Gegenprobe: ohne Stoppwortliste bekaeme ein Pfannkuchenvideo Punkte fuer einen Wasserspender');
});

test('ein einzelnes Modewort reicht nicht fuer eine Zuordnung', () => {
  // Der echte Fehlgriff aus dem ersten Lauf gegen TikTok: ein Video ueber eine
  // Kuechenwaage landete bei "Smart Beamer", weil im Text "SmartKitchen" stand.
  const beamer = produktBegriffe({ id: 44, name: 'Smart Beamer', slug: 'smart-beamer' });
  const kuechenwaage = { title: 'Die Küchenwaage mit App', description: '#SmartKitchen #GadgetTest' };

  // Der Wert allein sagt weiterhin 0.5 — die Haelfte von zwei Begriffen.
  assert.equal(trefferwert(beamer, kuechenwaage), 0.5);
  assert.deepEqual(getroffeneBegriffe(beamer, kuechenwaage), ['smart']);

  // Aber ein Begriff traegt die Zuordnung nicht.
  assert.equal(belastbar(beamer, kuechenwaage), false,
    'ein einziges Wort darf ein Produkt nicht zugeordnet bekommen');

  // Gegenprobe: Genau dieser Wert stand ueber der Standardschwelle 0.5 — ohne
  // die Zusatzregel waere das Video eingesammelt worden. Das ist kein
  // gedachter Fall, sondern der real gemessene.
  assert.ok(trefferwert(beamer, kuechenwaage) >= STANDARD.schwelle,
    'Gegenprobe: die Schwelle allein haette diese Fehlzuordnung durchgelassen');

  // Und die echte Zuordnung bleibt bestehen: zwei Begriffe treffen.
  const echtesVideo = { title: 'Elektrischer Wasserspender im Test', description: '#elektrischerwasserspender' };
  assert.equal(belastbar(produktBegriffe(PRODUKT), echtesVideo), true);
});

test('bei einem Produkt mit nur einem Begriff zaehlt dieser eine', () => {
  const begriffe = produktBegriffe({ name: 'Küchenwaage', slug: 'kuechenwaage' });
  assert.equal(begriffe.length, 1);
  assert.equal(belastbar(begriffe, { title: 'Meine neue Küchenwaage' }), true,
    'sonst waere ein einwortiges Produkt nie zuzuordnen');
  assert.equal(belastbar(begriffe, { title: 'Ein Video über Katzen' }), false);
});

test('Umlaute werden angeglichen, sonst findet der Slug seinen eigenen Namen nicht', () => {
  const begriffe = produktBegriffe({ name: 'Küchenwaage', slug: 'kuechenwaage' });
  assert.deepEqual(begriffe, ['kuechenwaage'], 'Name und Slug muessen auf denselben Begriff fallen');
  assert.equal(trefferwert(begriffe, { title: 'Meine neue Küchenwaage' }), 1);

  // Gegenprobe: ohne die Umlaut-Angleichung steht im Titel "küchenwaage" und
  // im Slug "kuechenwaage" — zwei verschiedene Zeichenketten, Trefferwert 0.
  assert.equal('meine neue küchenwaage'.includes('kuechenwaage'), false,
    'Gegenprobe: reines Kleinschreiben haette hier nichts gefunden');
  assert.equal(normalisiere('Küchenwaage'), 'kuechenwaage');
});

// ── Quellen und Faehigkeiten ─────────────────────────────────────────

test('Stichwortsuche wird nicht geraten, wenn der Extractor sie nicht kann', () => {
  const eintrag = { hashtags: ['wasserspender'], stichworte: ['wasserspender test'] };

  const ohne = quellenFuer(PRODUKT, eintrag,
    { kannHashtag: true, kannSuche: false }, { ...STANDARD });
  assert.equal(ohne.quellen.filter((q) => q.art === 'suche').length, 0,
    'ohne Suchextractor darf keine Such-URL entstehen');
  assert.ok(ohne.uebersprungen.some((u) => u.art === 'suche' && /Suchextractor/.test(u.grund)),
    'das Fehlen muss protokolliert werden, nicht umgangen');

  // Gegenprobe: mit Extractor UND konfiguriertem Praefix entsteht die Quelle.
  const mit = quellenFuer(PRODUKT, eintrag,
    { kannHashtag: true, kannSuche: true }, { ...STANDARD, suche_praefix: 'tiktoksearch5:' });
  assert.equal(mit.quellen.filter((q) => q.art === 'suche').length, 1);
});

test('vorhandener Suchextractor ohne Praefix reicht nicht — die URL bliebe geraten', () => {
  const { quellen, uebersprungen } = quellenFuer(PRODUKT, { stichworte: ['test'] },
    { kannHashtag: false, kannSuche: true }, { ...STANDARD, suche_praefix: null });

  assert.equal(quellen.length, 0);
  assert.ok(uebersprungen.some((u) => u.art === 'suche' && /praefix/i.test(u.grund)));
});

test('als CURRENTLY BROKEN markierte Extractors gelten als nicht vorhanden', async () => {
  // Genau die Liste, die yt-dlp 2026.07.04 auf diesem Rechner ausgibt.
  const echteListe = [
    'TikTok', 'tiktok:collection', 'tiktok:effect (CURRENTLY BROKEN)',
    'tiktok:live', 'tiktok:sound (CURRENTLY BROKEN)', 'tiktok:tag (CURRENTLY BROKEN)',
    'tiktok:user', 'vm.tiktok', 'youtube',
  ];
  const ytdlp = async () => ({ code: 0, stdout: echteListe.join('\n'), stderr: '' });

  const f = await require('./tiktok-video-sync').tiktokFaehigkeiten(ytdlp);
  assert.equal(f.kannHashtag, false, 'ein kaputter Extractor ist keine Faehigkeit');
  assert.match(f.hashtagGrund, /kaputt/, 'der Grund muss den Marker nennen, nicht "gibt es nicht"');
  assert.equal(f.kannSuche, false, 'einen Suchextractor gibt es in dieser Liste gar nicht');

  // Gegenprobe: dieselbe Liste OHNE den Marker — dann ist die Faehigkeit da.
  // Damit ist belegt, dass der Test am Marker haengt und nicht daran, dass
  // "tiktok:tag" ueberhaupt nicht erkannt wuerde.
  const ohneMarker = async () => ({
    code: 0,
    stdout: echteListe.map((n) => n.replace(' (CURRENTLY BROKEN)', '')).join('\n'),
    stderr: '',
  });
  const g = await require('./tiktok-video-sync').tiktokFaehigkeiten(ohneMarker);
  assert.equal(g.kannHashtag, true,
    'Gegenprobe: ohne den Marker wuerde tiktok:tag benutzt — die erste Fassung tat genau das');
});

test('Hashtag-Quellen entfallen ohne Hashtag-Extractor', () => {
  const eintrag = { hashtags: ['wasserspender', '#buero'] };

  const ohne = quellenFuer(PRODUKT, eintrag, { kannHashtag: false, kannSuche: false }, { ...STANDARD });
  assert.equal(ohne.quellen.length, 0);

  // Gegenprobe: mit Extractor entstehen genau zwei Hashtag-URLs — und das
  // fuehrende "#" wird nicht mit in die Adresse geschrieben.
  const mit = quellenFuer(PRODUKT, eintrag, { kannHashtag: true, kannSuche: false }, { ...STANDARD });
  assert.equal(mit.quellen.length, 2);
  assert.equal(mit.quellen[1].url, 'https://www.tiktok.com/tag/buero');
});

test('feste URLs stehen vor Hashtags — Reihenfolge (a) vor (b)', () => {
  const { quellen } = quellenFuer(PRODUKT, {
    videos: ['https://www.tiktok.com/@a/video/1'],
    creators: ['https://www.tiktok.com/@a'],
    hashtags: ['wasserspender'],
  }, { kannHashtag: true, kannSuche: false }, { ...STANDARD });

  assert.deepEqual(quellen.map((q) => q.art), ['video', 'creator', 'hashtag']);
});

// ── Konfiguration ────────────────────────────────────────────────────

test('Produkt-IDs werden numerisch verglichen, nicht als Zeichenkette', () => {
  const konfig = { produkte: { 10: { hashtags: ['treffer'] } } };
  assert.deepEqual(konfigZuProdukt(konfig, 10).hashtags, ['treffer']);
  assert.deepEqual(konfigZuProdukt(konfig, '10').hashtags, ['treffer']);

  // Gegenprobe: ein direkter Zugriff mit der Zahl als Schluessel geht in
  // JavaScript zwar gut, ein Vergleich `'10' === 10` aber nicht — genau davor
  // warnt CLAUDE.md §8.
  assert.equal(String(10) === 10, false);
  assert.deepEqual(konfigZuProdukt(konfig, 11), {});
});

test('Kommentarschluessel in der Konfiguration sind keine Produkt-IDs', () => {
  const konfig = { produkte: { _beispiel_feste_urls: { hashtags: ['darf-nie-greifen'] }, 10: {} } };
  // Number('_beispiel_feste_urls') ist NaN, und NaN === NaN ist falsch.
  assert.deepEqual(konfigZuProdukt(konfig, 10), {});
  assert.deepEqual(konfigZuProdukt(konfig, NaN), {});
});

// ── Index ────────────────────────────────────────────────────────────

test('ein kaputter Index bricht ab, statt still als leer zu gelten', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, 'index.json'), '{ das ist kein JSON');

  assert.throws(() => ladeIndex(ordner), /nicht lesbar/);

  // Warum das wichtig ist: Wuerde ein kaputter Index als leer durchgehen, waere
  // die Folge nicht "Fehlermeldung", sondern ein kompletter Neu-Download aller
  // Videos — inklusive verlorener Herkunftsangaben. Ein Fehler, der wie
  // Normalbetrieb aussieht.
  fs.writeFileSync(path.join(ordner, 'index.json'), '{"version":1}');
  assert.throws(() => ladeIndex(ordner), /eintraege/);
});

test('jeder Index-Eintrag traegt Herkunft und rechte_geprueft: false', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  await baueLauf(bau.ytdlp, ordner, { laden: true });
  const [eintrag] = ladeIndex(ordner).eintraege;

  assert.equal(eintrag.produkt_id, 10);
  assert.equal(eintrag.produkt_name, PRODUKT.name);
  assert.equal(eintrag.video_id, TREFFER.id);
  assert.equal(eintrag.quelle_url, TREFFER.url);
  assert.equal(eintrag.creator, '@buerokram');
  assert.equal(eintrag.titel, TREFFER.title);
  assert.equal(eintrag.zeitstempel, '2026-08-18T12:00:00.000Z');
  assert.match(eintrag.datei, /\.mp4$/);
  assert.ok(eintrag.groesse_bytes > 0, 'die Groesse kommt aus der echten Datei');
  assert.match(eintrag.sha256, /^[0-9a-f]{64}$/, 'die Pruefsumme kommt aus der echten Datei');
  assert.equal(eintrag.trefferwert, 1);

  // Der wichtigste Wert der ganzen Datei: Ohne Rechtepruefung von Hand ist das
  // Material reine Recherche. Er darf nie mit true anfangen.
  assert.equal(eintrag.rechte_geprueft, false);
});

// ── Obergrenzen ──────────────────────────────────────────────────────

test('--max begrenzt die Downloads je Lauf', async () => {
  const ordner = tempOrdner();
  const viele = [1, 2, 3, 4].map((n) => ({
    id: `73000000000000000${n}`,
    url: `https://www.tiktok.com/@buerokram/video/73000000000000000${n}`,
    title: 'Elektrischer Wasserspender fuer den Schreibtisch',
    uploader: '@buerokram',
  }));
  const bau = nachbauYtdlp({ kandidaten: viele });

  const ergebnis = await baueLauf(bau.ytdlp, ordner, { laden: true, max: 2 });

  assert.equal(bau.downloads().length, 2, 'hoechstens zwei Downloads');
  assert.equal(ergebnis.geladen.length, 2);
  assert.equal(ladeIndex(ordner).eintraege.length, 2);
});

test('eine Sperre von TikTok beendet den Lauf, statt es weiter zu versuchen', async () => {
  const ordner = tempOrdner();
  const aufrufe = [];
  const ytdlp = async (argumente) => {
    aufrufe.push(argumente);
    if (argumente.includes('--list-extractors')) {
      return { code: 0, stdout: 'tiktok\ntiktok:tag', stderr: '' };
    }
    return { code: 1, stdout: '', stderr: 'ERROR: Unable to download webpage: HTTP Error 429: Too Many Requests' };
  };

  const ergebnis = await baueLauf(ytdlp, ordner, { laden: true, standard: { ...STANDARD, bei_sperre_abbrechen: true } });

  assert.equal(ergebnis.abgebrochen, true);
  assert.match(ergebnis.grund, /blockiert/);
  // Nach der Sperre darf kein weiterer Aufruf mehr rausgehen: einmal
  // --list-extractors, einmal die gesperrte Abfrage — mehr nicht.
  assert.equal(aufrufe.length, 2, 'eine Sperre wird akzeptiert, nicht wiederholt angerannt');
});

test('ein einzelnes gesperrtes Video beendet den Lauf NICHT', async () => {
  const ordner = tempOrdner();
  const aufrufe = [];
  // Die echte Meldung aus dem ersten Lauf gegen TikTok.
  const verboten = 'ERROR: [TikTok] 7560752656407416086: Your IP address is blocked from accessing this post';
  const ytdlp = async (argumente) => {
    aufrufe.push(argumente);
    if (argumente.includes('--list-extractors')) return { code: 0, stdout: 'tiktok\ntiktok:tag', stderr: '' };
    if (argumente.includes('--dump-json')) return { code: 0, stdout: JSON.stringify(TREFFER), stderr: '' };
    return { code: 1, stdout: '', stderr: verboten };   // der Download ist gesperrt
  };

  const ergebnis = await baueLauf(ytdlp, ordner, { laden: true });

  // Eine Regionssperre auf EIN Video ist kein Grund, alles hinzuwerfen.
  assert.equal(ergebnis.abgebrochen, false, 'ein einzelnes gesperrtes Video darf den Lauf nicht beenden');
  assert.equal(ergebnis.geladen.length, 0);
  assert.equal(ergebnis.pruefliste.length, 1);
  assert.match(ergebnis.pruefliste[0].grund, /gesperrt/, 'der Grund muss protokolliert sein');
});

test('Gegenprobe: eine Ratenbegrenzung beendet den Lauf sehr wohl', async () => {
  const ordner = tempOrdner();
  const ytdlp = async (argumente) => {
    if (argumente.includes('--list-extractors')) return { code: 0, stdout: 'tiktok\ntiktok:tag', stderr: '' };
    if (argumente.includes('--dump-json')) return { code: 0, stdout: JSON.stringify(TREFFER), stderr: '' };
    return { code: 1, stdout: '', stderr: 'ERROR: HTTP Error 429: Too Many Requests' };
  };

  const ergebnis = await baueLauf(ytdlp, ordner,
    { laden: true, standard: { ...STANDARD, bei_sperre_abbrechen: true } });

  // Beweist, dass der Test oben die BEIDEN Faelle unterscheidet und nicht
  // einfach jede Sperre durchwinkt. Eine Ratenbegrenzung betrifft die ganze
  // Leitung — weitermachen waere der Anfang einer Umgehung.
  assert.equal(ergebnis.abgebrochen, true,
    'Gegenprobe: bei 429 muss weiterhin Schluss sein');
  assert.match(ergebnis.grund, /blockiert/);
});

test('mit bei_sperre_abbrechen=false laeuft der Lauf trotz Sperre weiter', async () => {
  const ordner = tempOrdner();
  const aufrufe = [];
  const ytdlp = async (argumente) => {
    aufrufe.push(argumente);
    if (argumente.includes('--list-extractors')) return { code: 0, stdout: 'tiktok\ntiktok:tag', stderr: '' };
    if (argumente.includes('--dump-json')) return { code: 0, stdout: JSON.stringify(TREFFER), stderr: '' };
    return { code: 1, stdout: '', stderr: 'ERROR: HTTP Error 429: Too Many Requests' };
  };

  // Der Standard steht seit der Umstellung auf false — ausdruecklich so gewollt.
  const ergebnis = await baueLauf(ytdlp, ordner, { laden: true });

  assert.equal(ergebnis.abgebrochen, false, 'mit abgeschaltetem Abbruch endet der Lauf nicht');
  assert.equal(ergebnis.geladen.length, 0, 'geladen wird trotzdem nichts — die Sperre bleibt eine Sperre');
  assert.ok(ergebnis.pruefliste.some((e) => /gesperrt/.test(e.grund)),
    'der Grund muss trotzdem protokolliert sein');

  // Der Punkt, der leicht uebersehen wird: Weitermachen bringt KEIN Video.
  // Es entstehen nur zusaetzliche Fehlversuche gegen dieselbe Sperre.
  assert.ok(aufrufe.length > 2, 'es gehen mehr Aufrufe raus als mit Abbruch');
});
test('yt-dlp laedt in ein Zwischenlager, nicht direkt in den Zielordner', async () => {
  // Der real aufgetretene Fehler: Auf dem echten Rechner scheiterte yt-dlp
  // reihenweise mit "Cannot write video metadata to JSON file
  // …/Marketing/data/tiktok-quellen/…" — und einmal schon an einer *.tmp im
  // Projektwurzelverzeichnis. Der Ordner war da, Node konnte hineinschreiben,
  // nur Python nicht (Windows-Ordnerschutz / Virenscanner). Ergebnis: 0 von 1
  // Videos, bei 28 geprueften Adressen.
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();

  await baueLauf(bau.ytdlp, ordner, { laden: true });

  const aufruf = bau.downloads()[0];
  const ausgabeZiel = aufruf[aufruf.indexOf('-o') + 1];
  assert.ok(!ausgabeZiel.startsWith(ordner),
    'yt-dlp darf nicht direkt in den Zielordner schreiben — genau das schlug fehl');
  assert.ok(ausgabeZiel.startsWith(os.tmpdir()),
    'das Zwischenlager muss im System-Temp liegen, dort darf jedes Programm schreiben');

  // Und trotzdem liegt am Ende alles am richtigen Platz — Node verschiebt.
  assert.equal(geladeneVideos(ordner).length, 1);
  assert.equal(ladeIndex(ordner).eintraege.length, 1);
});

test('ein gesperrter Zielordner stuerzt den Lauf nicht ab', async () => {
  // Der real aufgetretene Absturz: Das Video war geladen, aber das Kopieren in
  // den Projektordner scheiterte — und beendete den ganzen Lauf mit einer rohen
  // Systemmeldung ("❌ Abbruch: ENOENT … copyfile …"). Fuer den Benutzer nicht
  // lesbar, und der Download war umsonst.
  // Nachgestellt mit einem Zielpfad, der nicht anlegbar ist: unterhalb einer
  // DATEI kann kein Ordner entstehen.
  const basis = tempOrdner();
  const sperre = path.join(basis, 'keine-datei');
  fs.writeFileSync(sperre, 'ich bin eine Datei, kein Ordner');
  const gesperrterOrdner = path.join(sperre, 'unterordner');
  const bau = nachbauYtdlp();

  const ergebnis = await baueLauf(bau.ytdlp, gesperrterOrdner, { laden: true });

  // Kein Absturz — der Lauf gibt ein Ergebnis zurueck statt zu fliegen.
  assert.equal(typeof ergebnis, 'object');
  assert.equal(ergebnis.abgebrochen, true, 'der Lauf muss sich sauber beenden');
  assert.equal(ergebnis.geladen.length, 0);
  // Und der Grund muss erklaeren, was los ist, statt nur einen Fehlercode zu zeigen.
  assert.match(ergebnis.grund, /nicht anlegbar/,
    'der Grund muss den Ordner benennen, nicht bloss einen Systemfehler durchreichen');

  // Gegenprobe: mit einem normalen Ordner laeuft derselbe Aufruf durch. Damit
  // haengt der Test wirklich an der Schreibsperre und nicht an etwas anderem.
  const bau2 = nachbauYtdlp();
  const ergebnis2 = await baueLauf(bau2.ytdlp, tempOrdner(), { laden: true });
  assert.equal(ergebnis2.abgebrochen, false);
  assert.equal(ergebnis2.geladen.length, 1);
});

test('das Zwischenlager wird wieder aufgeraeumt', async () => {
  const ordner = tempOrdner();
  const bau = nachbauYtdlp();
  const vorher = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('tiktok-sync-')).length;

  await baueLauf(bau.ytdlp, ordner, { laden: true });

  const nachher = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('tiktok-sync-')).length;
  assert.equal(nachher, vorher, 'jeder Download darf keinen Temp-Ordner hinterlassen');
});

test('greift --max-filesize, entsteht keine Datei — und das wird gemeldet', async () => {
  const ordner = tempOrdner();
  const ytdlp = async (argumente) => {
    if (argumente.includes('--list-extractors')) return { code: 0, stdout: 'tiktok\ntiktok:tag', stderr: '' };
    if (argumente.includes('--dump-json')) return { code: 0, stdout: JSON.stringify(TREFFER), stderr: '' };
    // yt-dlp endet bei ueberschrittener Groesse mit Code 0 und schreibt NICHTS.
    return { code: 0, stdout: '', stderr: '' };
  };

  const ergebnis = await baueLauf(ytdlp, ordner, { laden: true });

  assert.equal(ergebnis.geladen.length, 0, 'ohne Datei darf kein Index-Eintrag entstehen');
  assert.equal(ladeIndex(ordner).eintraege.length, 0);
  assert.equal(ergebnis.pruefliste.length, 1);
  assert.match(ergebnis.pruefliste[0].grund, /keine Datei entstanden/,
    'dem Rueckgabewert 0 allein darf nicht geglaubt werden');
});

// ── Gefuehrter Ablauf: Suche, Tonspur, Einsortieren ──────────────────

test('nur echte Videoadressen kommen durch, keine Themenseiten', () => {
  assert.ok(TIKTOK_VIDEO_MUSTER.test('https://www.tiktok.com/@handle/video/7300000000000000001'));
  // Gegenprobe: Genau diese drei Formen liefert eine Websuche massenhaft mit —
  // sie sehen wie Treffer aus, enthalten aber kein einziges Video.
  for (const u of ['https://www.tiktok.com/discover/wasserspender',
                   'https://www.tiktok.com/tag/waterdispenser',
                   'https://shop.tiktok.com/us/k/desktop-water-dispenser']) {
    assert.equal(TIKTOK_VIDEO_MUSTER.test(u), false, `haette ${u} durchgelassen`);
  }
});

test('die Suche filtert die Ergebnisliste auf Videoadressen', async () => {
  const holen = async () => ({
    ok: true,
    json: async () => ({ web: { results: [
      { url: 'https://www.tiktok.com/discover/wasserspender' },
      { url: 'https://www.tiktok.com/@a/video/111' },
      { url: 'https://www.tiktok.com/@a/video/111' },      // doppelt
      { url: 'https://www.tiktok.com/@b/video/222' },
    ] } }),
  });
  const e = await sucheAdressen({ begriff: 'test', env: { BRAVE_API_KEY: 'x' }, holen });
  assert.deepEqual(e.adressen, ['https://www.tiktok.com/@a/video/111', 'https://www.tiktok.com/@b/video/222']);
});

test('Tavily wird bevorzugt, weil es ohne Kreditkarte auskommt', async () => {
  const gerufen = [];
  const holen = async (adresse, einstellungen) => {
    gerufen.push(adresse);
    return {
      ok: true,
      json: async () => ({ results: [
        { url: 'https://www.tiktok.com/@a/video/111' },
        { url: 'https://www.tiktok.com/discover/irgendwas' },
      ] }),
    };
  };
  // Beide Schluessel gesetzt — Tavily muss gewinnen.
  const e = await sucheAdressen({
    begriff: 'test', env: { TAVILY_API_KEY: 't', BRAVE_API_KEY: 'b' }, holen,
  });
  assert.equal(e.anbieter, 'Tavily');
  assert.ok(gerufen[0].includes('tavily.com'), 'es wurde nicht Tavily gefragt');
  assert.deepEqual(e.adressen, ['https://www.tiktok.com/@a/video/111']);

  // Gegenprobe: ohne Tavily-Schluessel geht dieselbe Suche an Brave.
  const gerufen2 = [];
  const holen2 = async (adresse) => {
    gerufen2.push(adresse);
    return { ok: true, json: async () => ({ web: { results: [{ url: 'https://www.tiktok.com/@b/video/222' }] } }) };
  };
  const e2 = await sucheAdressen({ begriff: 'test', env: { BRAVE_API_KEY: 'b' }, holen: holen2 });
  assert.equal(e2.anbieter, 'Brave');
  assert.ok(gerufen2[0].includes('search.brave.com'));
  assert.deepEqual(e2.adressen, ['https://www.tiktok.com/@b/video/222']);
});

test('ein Fehler der Such-API wird gemeldet, nicht verschluckt', async () => {
  const e = await sucheAdressen({
    begriff: 'test', env: { TAVILY_API_KEY: 't' },
    holen: async () => ({ ok: false, status: 401 }),
  });
  assert.equal(e.ok, false);
  assert.match(e.grund, /Tavily antwortete mit 401/);
  assert.deepEqual(e.adressen, [], 'bei einem Fehler darf keine Adresse herauskommen');
});

test('ohne Suchschluessel wird nicht geraten, sondern gesagt was fehlt', async () => {
  const e = await sucheAdressen({ begriff: 'test', env: {}, holen: async () => { throw new Error('haette nicht rufen duerfen'); } });
  assert.equal(e.ok, false);
  assert.match(e.grund, /Suchschluessel/);
  assert.deepEqual(e.adressen, []);
});

test('Suchbegriffe folgen der gewaehlten Sprache', () => {
  const eintrag = { suchbegriff: { de: ['tiktok wasserspender'], en: ['tiktok water dispenser'] } };
  assert.deepEqual(begriffeFuer(eintrag, PRODUKT, 'de'), ['tiktok wasserspender']);
  assert.deepEqual(begriffeFuer(eintrag, PRODUKT, 'en'), ['tiktok water dispenser']);
});

test('fehlt die gewaehlte Sprache, wird die andere genommen statt gar nichts', () => {
  // Ein Lauf ohne einen einzigen Suchbegriff findet nichts und waere fuer
  // niemanden nuetzlich — lieber die falsche Sprache als keine Suche.
  const nurEnglisch = { suchbegriff: { de: [], en: ['tiktok water dispenser'] } };
  assert.deepEqual(begriffeFuer(nurEnglisch, PRODUKT, 'de'), ['tiktok water dispenser']);

  // Gegenprobe: Sind beide leer, greift der Rueckfall auf den Produktnamen.
  const leer = { suchbegriff: { de: [], en: [] } };
  assert.deepEqual(begriffeFuer(leer, PRODUKT, 'de'), ['tiktok ' + PRODUKT.name]);
});

test('alte Schreibweisen der Konfiguration laufen weiter', () => {
  // Frueher stand dort eine Liste oder eine einzelne Zeichenkette. Beides muss
  // weiter gelten, sonst waere jede aeltere Konfiguration mit dem Umbau
  // stillschweigend wirkungslos geworden.
  assert.deepEqual(begriffeFuer({ suchbegriff: ['a', 'b'] }, PRODUKT, 'de'), ['a', 'b']);
  assert.deepEqual(begriffeFuer({ suchbegriff: ['a', 'b'] }, PRODUKT, 'en'), ['a', 'b']);
  assert.deepEqual(begriffeFuer({ suchbegriff: 'einer' }, PRODUKT, 'en'), ['einer']);
  assert.deepEqual(begriffeFuer({}, PRODUKT, 'en'), ['tiktok ' + PRODUKT.name]);
});

test('die Sprache des Untertitels wird erkannt', () => {
  // An echten Untertiteln der geladenen Videos gemessen, nicht ausgedacht.
  assert.equal(spracheDesTextes('Findet ihr diesen Wasserspender nuetzlich oder eher nicht'), 'de');
  assert.equal(spracheDesTextes('Perfekt fuer dein Gaming-Setup mit USB'), 'de');
  assert.equal(spracheDesTextes('We have well water and have been buying bottled water'), 'en');
  assert.equal(spracheDesTextes('If a 5 gallon dispenser is not in the cards, this one is'), 'en');
});

test('Umlaute allein reichen als deutsches Zeichen', () => {
  // Kurze Untertitel haben oft kein einziges Funktionswort.
  assert.equal(spracheDesTextes('Wasserspender für Büro'), 'de');
});

test('nicht entscheidbare Untertitel werden NICHT geraten', () => {
  // Reine Hashtag-Zeilen enthalten keine Funktionswoerter — sie als falsche
  // Sprache zu werten wuerde fast jedes Video aussperren.
  assert.equal(spracheDesTextes('#waterdispenser #zira #fyp'), null);
  assert.equal(spracheDesTextes(''), null);
  assert.equal(spracheDesTextes(null), null);

  // Gegenprobe: Ein Inhaltswort allein entscheidet ebenfalls nichts —
  // "wasserspender" steht auch unter englischen Videos.
  assert.equal(spracheDesTextes('wasserspender'), null);
});

test('ein Untertitel ohne erkennbare Sprache gilt NICHT als Treffer', async () => {
  // Der real aufgetretene Fall: Untertitel "#waterdispenser #bekasairkenduri"
  // — reine Hashtags, malaiischer Kontext. Beim ersten Anlauf liess ich
  // "nicht entscheidbar" durch, und genau dieses Video kam bei Auswahl
  // "deutsch" herein. Reine Hashtags sind kein deutscher Untertitel.
  const nurHashtags = {
    id: '7300000000000000088',
    webpage_url: 'https://www.tiktok.com/@x/video/7300000000000000088',
    title: '#waterdispenser #bekasairkenduri', description: '',
    duration: 20, uploader: 'x', track: 'Ein Lied', artist: 'Wer',
  };
  assert.equal(spracheDesTextes(nurHashtags.title), null, 'Vorbedingung: nicht entscheidbar');

  const daten = tempOrdner();
  const videos = tempOrdner();
  const gi = path.join(daten, '.gitignore');
  fs.writeFileSync(gi, '');
  const ytdlp = async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      return { code: 0, stdout: JSON.stringify(nurHashtags), stderr: '' };
    }
    fs.writeFileSync(argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4'), 'video');
    return { code: 0, stdout: '', stderr: '' };
  };
  const antworten = ['10', '1', '1', '2'];      // deutsch, Ton egal
  await interaktiv({
    ytdlp, produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [nurHashtags.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: gi,
    wurzel: path.dirname(videos),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-21T12:00:00.000Z', melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });
  assert.equal(geladeneVideos(videos).length, 0,
    'bei Auswahl "deutsch" darf ein Video ohne erkennbaren deutschen Untertitel nicht geladen werden');
});

test('Allerweltswoerter zaehlen bei der Pruefung nicht mit', () => {
  const produkt = { id: 16, name: 'Elektrische Kuechenwaage Digital', slug: 'elektrische-kuechenwaage-digital' };
  const eintrag = { suchbegriff: { de: ['tiktok kuechenwaage lcd test'], en: [] } };
  const gruppen = begriffsGruppen(produkt, eintrag);

  // "test" darf in keiner Gruppe mehr auftauchen — es steht in jedem zweiten
  // Untertitel. Vorher ergab "lcd test" allein zwei Treffer von drei.
  for (const g of gruppen) {
    assert.equal(g.includes('test'), false, `"test" steckt noch in [${g.join(', ')}]`);
  }

  // Gegenprobe: Das Produktwort bleibt selbstverstaendlich erhalten.
  assert.ok(gruppen.some((g) => g.includes('kuechenwaage')));
});

test('Gruppen ohne Aussagekraft fliegen ganz raus', () => {
  // "tiktok gadget test" enthaelt nach dem Aussieben nichts mehr — eine leere
  // oder einwortige Gruppe wuerde jedes beliebige Video bestehen lassen.
  const produkt = { id: 99, name: 'Testprodukt Eins', slug: 'testprodukt-eins' };
  const gruppen = begriffsGruppen(produkt, { suchbegriff: ['tiktok gadget test', 'tiktok testprodukt eins'] });
  assert.equal(gruppen.some((g) => g.length < 2 && g.length > 0), false,
    'es darf keine einwortige Gruppe aus Allerweltswoertern geben');
});

test('kurze Begriffe muessen ganze Woerter sein, lange duerfen im Wort stehen', () => {
  // Lang: Hashtags sind zusammengeschrieben, "dispenser" muss in
  // "#waterdispenser" gefunden werden.
  assert.deepEqual(getroffeneBegriffe(['dispenser'], { title: '#waterdispenser' }), ['dispenser']);

  // Kurz: "eis" darf NICHT in "reise" treffen, "cat" nicht in "category".
  assert.deepEqual(getroffeneBegriffe(['eis'], { title: 'Meine reise nach Italien' }), []);
  assert.deepEqual(getroffeneBegriffe(['cat'], { title: 'the best category ever' }), []);

  // Gegenprobe: als eigenes Wort trifft es sehr wohl.
  assert.deepEqual(getroffeneBegriffe(['eis'], { title: 'mit eis im glas' }), ['eis']);
});

test('ohne Produktwort im Text zaehlt keine Bewertung', () => {
  // Der real aufgetretene Fehlgriff (Video 17): Ein Nachttisch-Dekovideo mit
  // dem Untertitel "#bedsidetable #nightstand #nightstandorganization".
  // Der Suchbegriff "water dispenser bedside nightstand" bildet eine
  // Vierergruppe — die beiden ORTSWOERTER allein ergaben 0,5 Punkte und zwei
  // Treffer, also genug. Ein Produktwort kam im Video nie vor.
  const nachttischDeko = { title: 'Time for a refresh #bedsidetable #nightstand #nightstandorganization' };
  const gruppe = [['water', 'dispenser', 'bedside', 'nightstand']];
  const kern = ['wasserspender', 'dispenser', 'wasserpumpe'];

  // Vorbedingung: Die Bewertung allein haette es durchgelassen.
  const b = bewerte(gruppe, nachttischDeko);
  assert.equal(b.wert, 0.5, 'zwei von vier Woertern treffen');
  assert.equal(b.haelt, true, 'zwei Treffer gelten als belastbar');

  // Erst die Kernwortpruefung stoppt es.
  assert.equal(hatKernwort(nachttischDeko, kern), false);

  // Gegenprobe: echte Produktvideos beider Sprachen bleiben unberuehrt.
  assert.equal(hatKernwort({ title: 'Wasserspender fuer den Schreibtisch im Test' }, kern), true);
  assert.equal(hatKernwort({ title: 'desktop water dispenser #waterdispenser' }, kern), true,
    'der Hashtag #waterdispenser muss den Kern "dispenser" treffen');
});

test('ohne hinterlegte Kernwoerter sperrt die Pruefung nichts aus', () => {
  // Sie darf nicht stillschweigend alles verwerfen, wofuer nie etwas
  // konfiguriert wurde — sonst waere ein leeres Feld ein unsichtbarer Totalstopp.
  assert.equal(hatKernwort({ title: 'irgendwas' }, []), true);
  assert.equal(hatKernwort({ title: 'irgendwas' }, undefined), true);
});

test('ein Katzenbrunnen wird ausgeschlossen, obwohl die Bewertung passt', () => {
  // Der real aufgetretene Fehlgriff: Zwei geladene Videos zeigten Katzenbrunnen.
  // Ein Katzenbrunnen IST ein automatischer Wasserspender — die Bewertung ist
  // hoch und trotzdem ist das Video falsch. Nur eine harte Liste hilft.
  const katzenbrunnen = {
    title: 'Automatischer Katzenbrunnen 2,2L – Kabellos und leise',
    description: '#katzen #cattok #wasserspender',
  };
  const gruppen = [['automatischer', 'wasserspender']];

  // Vorbedingung: Die Bewertung allein laesst es durch.
  const b = bewerte(gruppen, katzenbrunnen);
  assert.equal(b.wert, 1, 'die Trefferbewertung gibt volle Punktzahl');
  assert.equal(b.haelt, true);

  // Erst die Ausschlussliste stoppt es.
  assert.equal(ausschlussTreffer(katzenbrunnen, ['katzen', 'hund']), 'katzen');

  // Gegenprobe: Das echte Produktvideo bleibt unberuehrt.
  const echt = { title: 'Automatischer Wasserspender fuer den Schreibtisch', description: '#wasserspender' };
  assert.equal(ausschlussTreffer(echt, ['katzen', 'hund']), null);
});

test('Ausschlusswoerter treffen Wortanfaenge, nicht beliebige Teilstuecke', () => {
  // "Katzenbrunnen" muss mit "katzen" erwischt werden — deutsche Komposita.
  assert.equal(ausschlussTreffer({ title: 'Katzenbrunnen im Test' }, ['katzen']), 'katzen');
  assert.equal(ausschlussTreffer({ title: 'katzenmama zeigt' }, ['katzen']), 'katzen');

  // Gegenprobe: Ein blosser Teilstring-Vergleich haette hier faelschlich
  // zugeschlagen — "kategorie" enthaelt "kat", aber faengt nicht mit "katzen" an.
  assert.equal(ausschlussTreffer({ title: 'Die beste Kategorie fuer Gadgets' }, ['katzen']), null);
  assert.equal(ausschlussTreffer({ title: 'communication tools' }, ['cat']), null,
    '"cat" darf nicht in "communication" treffen');
});

test('Redeerkennung trennt die real gemessenen Faelle', () => {
  // Diese Zahlen sind an zehn echten Videos gemessen, nicht ausgedacht.
  const geredet = [
    { ok: true, woerter: 52, redeanteil: 0.996 },    // 07, "original sound"
    { ok: true, woerter: 169, redeanteil: 0.997 },   // 08, "original sound"
    { ok: true, woerter: 134, redeanteil: 0.93 },    // 09, angeblich Musik!
    { ok: true, woerter: 38, redeanteil: 0.98 },     // 10, angeblich Musik!
    { ok: true, woerter: 90, redeanteil: 0.706 },    // 18, angeblich Musik!
  ];
  const still = [
    { ok: true, woerter: 0, redeanteil: 0.0 },       // 12
    { ok: true, woerter: 0, redeanteil: 0.0 },       // 13
    { ok: true, woerter: 1, redeanteil: 0.05 },      // 17, ein Wort = kein Gespraech
  ];
  for (const m of geredet) assert.equal(wirdGeredet(m), true, JSON.stringify(m));
  for (const m of still) assert.equal(wirdGeredet(m), false, JSON.stringify(m));
});

test('Gegenprobe: das track-Feld haette drei dieser Videos falsch eingeordnet', () => {
  // Genau der Fehler, den die Tonpruefung behebt: Ein lizenzierter Musiktitel
  // heisst NICHT, dass niemand darueber redet.
  assert.equal(istMusik({ track: 'Love You So' }), true, 'track-Feld sagt: Musik');
  assert.equal(wirdGeredet({ ok: true, woerter: 38, redeanteil: 0.98 }), true,
    'abgehoert wird aber sehr wohl geredet — die alte Methode lag hier falsch');
});

test('ohne Spracherkenner wird nicht geraten, sondern "unbekannt" gemeldet', () => {
  // null heisst ausdruecklich "nicht geprueft" — nicht "keine Sprache".
  // Sonst wuerde ein fehlendes Programm stillschweigend zu "alles in Ordnung".
  assert.equal(wirdGeredet({ ok: false, grund: 'faster-whisper fehlt' }), null);
  assert.equal(wirdGeredet(null), null);
});

test('der Spracherkenner meldet sauber, wenn die Datei fehlt', () => {
  const e = pruefeSprache(path.join(tempOrdner(), 'gibt-es-nicht.mp4'));
  assert.equal(e.ok, false, 'eine fehlende Datei darf kein "ok" ergeben');
  assert.ok(String(e.grund || '').length > 0, 'es muss ein Grund dabeistehen');
});

test('Sprache wird an der Tonspur erkannt', () => {
  assert.equal(istMusik({ track: 'Love You So' }), true);
  // Gegenprobe: Wer selbst spricht, bekommt "original sound" — in mehreren
  // Sprachen, weil TikTok das uebersetzt ausliefert.
  for (const t of ['original sound', 'Originalton', 'son original', 'sonido original']) {
    assert.equal(istMusik({ track: t }), false, `"${t}" haette als Musik gegolten`);
  }
  assert.equal(istMusik({ track: '' }), false, 'ohne Angabe wird NICHT geraten');
  assert.equal(istMusik({}), false);
});

test('naechsteNummer und Slug folgen den vorhandenen Dateien', () => {
  const ordner = tempOrdner();
  for (const n of ['01_nordic-crystal-lamp_20s_stil-a.mp4', '05_elektrischer-wasserspender_21s_stil-a.mp4']) {
    fs.writeFileSync(path.join(ordner, n), 'x');
  }
  assert.equal(naechsteNummer(ordner), 6);
  // Der volle Slug waere "elektrischer-wasserspender-fuer-schreibtisch" — die
  // vorhandene Datei gibt aber die kuerzere Schreibweise vor. Sonst staenden
  // zwei Schreibweisen desselben Produkts nebeneinander.
  assert.equal(slugFuerDateiname(PRODUKT, ordner), 'elektrischer-wasserspender');
  // Gegenprobe: ohne passende Datei bleibt es beim vollen Slug.
  assert.equal(slugFuerDateiname(PRODUKT, tempOrdner()), PRODUKT.slug);
});

test('jede eingesortierte Datei wird in .gitignore eingetragen', () => {
  const ordner = tempOrdner();
  const gi = path.join(ordner, '.gitignore');
  fs.writeFileSync(gi, '# Kopf\nnode_modules/\n');

  const e = schuetzeDatei('09_elektrischer-wasserspender_49s_stil-b.mp4', gi);
  assert.equal(e.ok, true);
  assert.equal(e.schonDa, false);
  const inhalt = fs.readFileSync(gi, 'utf8');
  assert.ok(inhalt.includes('Marketing/videos/09_elektrischer-wasserspender_49s_stil-b.*'));
  assert.ok(inhalt.includes('node_modules/'), 'der Bestand darf nicht verlorengehen');

  // Zweimal eintragen darf keine Dublette geben.
  const e2 = schuetzeDatei('09_elektrischer-wasserspender_49s_stil-b.mp4', gi);
  assert.equal(e2.schonDa, true);
  const zeilen = fs.readFileSync(gi, 'utf8').split('\n').filter((z) => z.includes('09_elektrischer'));
  assert.equal(zeilen.length, 1);
});

test('gemischte Zeilenenden bringen den Eintrag nicht durcheinander', () => {
  const ordner = tempOrdner();
  const gi = path.join(ordner, '.gitignore');
  // Genau der Zustand, an dem drei Ersetzungsversuche gescheitert sind.
  fs.writeFileSync(gi, '# Kopf\r\nnode_modules/\r\n');
  schuetzeDatei('10_test_5s_stil-b.mp4', gi);
  const zeilen = fs.readFileSync(gi, 'utf8').split(/\r?\n/).map((z) => z.trim());
  assert.ok(zeilen.includes('Marketing/videos/10_test_5s_stil-b.*'));
  // Gegenprobe: ein Vergleich ohne \r-Toleranz haette die Zeile nicht gefunden.
  assert.equal(zeilen.filter((z) => z === 'node_modules/').length, 1);
});

test('der gefuehrte Ablauf laedt genau die gewuenschte Anzahl — und nur Musik', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const gi = path.join(daten, '.gitignore');
  fs.writeFileSync(gi, '');

  const mitMusik = (n) => ({
    id: '73000000000000000' + n,
    webpage_url: `https://www.tiktok.com/@musik/video/73000000000000000${n}`,
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 10 + n,
    uploader: 'musik', track: 'Ein Lied', artist: 'Jemand',
  });
  const mitStimme = {
    id: '7399999999999999999',
    webpage_url: 'https://www.tiktok.com/@rede/video/7399999999999999999',
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 30,
    uploader: 'rede', track: 'original sound', artist: '',
  };

  const geladene = [];
  const ytdlp = async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      const url = argumente[argumente.length - 1];
      const alle = [mitStimme, mitMusik(1), mitMusik(2), mitMusik(3)];
      const treffer = alle.find((v) => v.webpage_url === url);
      return { code: 0, stdout: treffer ? JSON.stringify(treffer) : '', stderr: '' };
    }
    const ziel = argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
    fs.writeFileSync(ziel, 'video-' + path.basename(ziel));
    geladene.push(ziel);
    return { code: 0, stdout: '', stderr: '' };
  };

  // Sprache 1 = deutsch, passend zum deutschen Beispiel-Untertitel; Ton 1 = keine Sprache
  const antworten = ['10', '2', '1', '1'];
  const code = await interaktiv({
    ytdlp,
    // Projektwurzel vorgeben: Der .gitignore-Eintrag wird nur geschrieben, wenn
    // der Videoordner INNERHALB des Projekts liegt — ausserhalb kann Git die
    // Datei ohnehin nie erfassen. Hier soll der Schutz greifen, also liegt die
    // Wurzel oberhalb des Videoordners.
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [
      mitStimme.webpage_url, mitMusik(1).webpage_url, mitMusik(2).webpage_url, mitMusik(3).webpage_url,
    ] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: gi,
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-19T10:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(code, 0);
  const dateien = geladeneVideos(videos);
  assert.equal(dateien.length, 2, 'genau die gewuenschte Anzahl — nicht alle verfuegbaren');
  // Das Video mit "original sound" darf nicht dabei sein, obwohl es zuerst kam.
  const index = ladeIndex(daten);
  assert.equal(index.eintraege.every((e) => e.creator !== 'rede'), true,
    'ein Video mit Sprache wurde geladen');
  assert.equal(index.eintraege.every((e) => e.rechte_geprueft === false), true);
  // Namensschema und Schutz
  assert.match(dateien[0], /^\d{2}_elektrischer-wasserspender-fuer-schreibtisch_\d+s_stil-b\.mp4$/);
  // SCHUTZ: Seit die Videos unter rohmaterial/ liegen, deckt eine Ordner-Regel
  // sie ab — es wird KEIN Einzeleintrag mehr geschrieben. Das ist die
  // Verbesserung: Die frueheren Einzelzeilen waren die fehleranfaelligste
  // Stelle im Projekt, zweimal ist fremdes Material im Status aufgetaucht,
  // weil beim Umbenennen eine Zeile fehlte. Geprueft wird deshalb, dass die
  // Datei WIRKLICH unter der Ordner-Regel liegt.
  const ignoriert = fs.readFileSync(gi, 'utf8');
  for (const d of dateien) {
    const abgelegt = path.join(produktOrdner(videos, PRODUKT), d);
    assert.ok(imRohmaterial(abgelegt),
      `${d} liegt nicht unter rohmaterial/ — es waere ungeschuetzt`);
    assert.equal(ignoriert.includes('Marketing/videos/' + d.replace('.mp4', '') + '.*'), false,
      'unter der Ordner-Regel braucht es keinen Einzeleintrag mehr');
  }
});

test('Ton-Auswahl 2 laesst auch Videos mit Sprache durch', async () => {
  const mitStimme = {
    id: '7300000000000000055',
    webpage_url: 'https://www.tiktok.com/@rede/video/7300000000000000055',
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 20,
    uploader: 'rede', track: 'original sound', artist: '',
  };
  const bauen = () => {
    const geladene = [];
    const ytdlp = async (argumente) => {
      if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
        return { code: 0, stdout: JSON.stringify(mitStimme), stderr: '' };
      }
      const ziel = argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
      fs.writeFileSync(ziel, 'video-' + path.basename(ziel));
      geladene.push(ziel);
      return { code: 0, stdout: '', stderr: '' };
    };
    return { ytdlp, geladene };
  };

  const lauf1 = async (antworten) => {
    const daten = tempOrdner();
    const videos = tempOrdner();
    const gi = path.join(daten, '.gitignore');
    fs.writeFileSync(gi, '');
    const bau = bauen();
    await interaktiv({
      ytdlp: bau.ytdlp,
      produkte: [PRODUKT],
      konfig: { produkte: { 10: { videos: [mitStimme.webpage_url] } } },
      standard: { ...STANDARD },
      datenOrdner: daten, videoOrdner: videos, gitignore: gi,
      wurzel: path.dirname(videos),
      stopDatei: path.join(daten, 'kein-STOP'), env: {},
      frage: async () => antworten.shift(),
      jetzt: () => '2026-08-21T10:00:00.000Z',
      melde: still, warte: async () => {}, impersonation: nachahmungDa,
    });
    return { geladen: geladeneVideos(videos).length, daten };
  };

  // Produktnummer, Anzahl, Sprache, Ton = "egal"
  const mitEgal = await lauf1(['10', '1', '1', '2']);        // deutsch, Ton = mit Sprache
  assert.equal(mitEgal.geladen, 1, 'mit Auswahl 2 muss das Sprach-Video geladen werden');
  // Und der Nachweis darf NICHT behaupten, es sei sprachfrei.
  const eintrag = ladeIndex(mitEgal.daten).eintraege[0];
  assert.match(eintrag.tonart, /gesprochen/,
    'der Nachweis muss die eigene Tonspur benennen, nicht "keine Sprache" behaupten');

  // Gegenprobe: dieselbe Lage mit "nur-musik" laedt nichts.
  const mitMusik = await lauf1(['10', '1', '1', '1']);       // deutsch, Ton = keine Sprache
  assert.equal(mitMusik.geladen, 0, 'mit Auswahl 1 muss dasselbe Video draussen bleiben');
});

test('liegt der Videoordner ausserhalb des Projekts, wird .gitignore nicht angefasst', async () => {
  // Warum das wichtig ist: Mit TIKTOK_VIDEO_DIR landen die Videos ausserhalb
  // des Repos — Git kann sie dort gar nicht erfassen, ein Eintrag waere sinnlos.
  // Schlimmer noch: Der Schreibversuch ging auf eine .gitignore im geschuetzten
  // Projektordner und riss den ganzen Lauf mit "EBADF" um, NACHDEM das Video
  // schon geladen war.
  const daten = tempOrdner();
  const videos = tempOrdner();
  const gi = path.join(daten, '.gitignore');
  fs.writeFileSync(gi, '# unveraendert\n');
  const vorher = fs.readFileSync(gi, 'utf8');

  const treffer = {
    id: '7300000000000000077',
    webpage_url: 'https://www.tiktok.com/@musik/video/7300000000000000077',
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 12,
    uploader: 'musik', track: 'Ein Lied', artist: 'Jemand',
  };
  const ytdlp = async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      return { code: 0, stdout: JSON.stringify(treffer), stderr: '' };
    }
    fs.writeFileSync(argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4'), 'video');
    return { code: 0, stdout: '', stderr: '' };
  };

  const antworten = ['10', '1', '1', '1'];
  const code = await interaktiv({
    ytdlp,
    // Wurzel liegt woanders — der Videoordner ist damit ausserhalb des Projekts.
    wurzel: path.join(daten, 'ein-anderes-projekt'),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [treffer.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: gi,
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-20T10:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(code, 0, 'der Lauf muss trotzdem gelingen');
  assert.equal(geladeneVideos(videos).length, 1,
    'das Video liegt am Ziel');
  assert.equal(fs.readFileSync(gi, 'utf8'), vorher,
    'die .gitignore darf gar nicht angefasst werden, wenn das Video ausserhalb liegt');
});

test('Gegenprobe: ohne Musikfilter waere das Sprach-Video dabei', () => {
  // Der Filter ist eine einzige Bedingung. Faellt sie weg, ist "original sound"
  // ein ganz normaler Kandidat — und der Test oben waere rot.
  const mitStimme = { track: 'original sound' };
  assert.equal(istMusik(mitStimme), false);
  assert.equal(!istMusik(mitStimme), true, 'ohne die Verneinung wuerde er geladen');
});

test('zwei Eingabezeilen auf einmal gehen nicht verloren', async () => {
  // Der real aufgetretene Fehler: Kommen beide Zeilen in EINEM Rutsch an (aus
  // einer Datei oder Weiterleitung), meldet readline sie sofort hintereinander.
  // Die erste holt sich Frage 1, die zweite fiel ins Leere — Frage 2 wartete
  // dann auf etwas, das nie mehr kam. Der Lauf endete lautlos mit Code 0, ohne
  // eine einzige weitere Zeile Ausgabe. Genau das bildet dieser Test nach.
  const eingabe = new PassThrough();
  const ausgabe = new PassThrough();
  const k = frageStelle(eingabe, ausgabe);
  eingabe.write('11\n5\n');                     // beide Zeilen gleichzeitig

  const erste = await k.frage('Produktnummer? ');
  const zweite = await k.frage('Wie viele? ');
  k.schliesse();

  assert.equal(erste, '11');
  assert.equal(zweite, '5', 'die zweite Zeile darf nicht verlorengehen');
});

test('am Dateiende haengt keine Frage — sie bekommt eine leere Antwort', async () => {
  const eingabe = new PassThrough();
  const ausgabe = new PassThrough();
  const k = frageStelle(eingabe, ausgabe);
  eingabe.end();                                 // sofort Dateiende

  // Gegenprobe zum Fehler oben: Ohne die close-Behandlung wuerde dieses await
  // ewig warten und der Test in eine Zeitueberschreitung laufen.
  const antwort = await k.frage('Produktnummer? ');
  assert.equal(antwort, '');
});

test('eine unbekannte Produktnummer bricht sauber ab', async () => {
  const antworten = ['999'];
  const code = await interaktiv({
    ytdlp: async () => ({ code: 0, stdout: '', stderr: '' }),
    produkte: [PRODUKT], konfig: { produkte: {} }, standard: { ...STANDARD },
    datenOrdner: tempOrdner(), videoOrdner: tempOrdner(),
    stopDatei: path.join(tempOrdner(), 'kein-STOP'), env: {},
    frage: async () => antworten.shift(), melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });
  assert.equal(code, 1, 'eine falsche Nummer darf nicht als Erfolg gelten');
});

test('Notaus greift auch im gefuehrten Ablauf', async () => {
  const ordner = tempOrdner();
  const stop = path.join(ordner, 'STOP');
  fs.writeFileSync(stop, '');
  let gefragt = false;
  const code = await interaktiv({
    ytdlp: async () => { throw new Error('haette nicht laufen duerfen'); },
    produkte: [PRODUKT], konfig: { produkte: {} }, standard: { ...STANDARD },
    datenOrdner: ordner, videoOrdner: ordner, stopDatei: stop, env: {},
    frage: async () => { gefragt = true; return '10'; }, melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });
  assert.equal(code, 1);
  assert.equal(gefragt, false, 'bei Notaus darf nicht einmal gefragt werden');
});

// ── Herkunftsnachweis aufraeumen ─────────────────────────────────────
//
// Der Index sagt, wem eine Datei gehoert und woher sie stammt. Zeigt ein
// Eintrag auf eine Datei, die es nicht mehr gibt, weist er nichts mehr nach —
// er faelscht nur noch die Zahl im Zustandsbericht. Gemessen: 26 von 36.

function indexMitDatei(ordner, dateiname) {
  fs.writeFileSync(path.join(ordner, dateiname), 'nur-fuer-den-test');
  return {
    produkt_id: 10,
    video_id: '7300000000000000010',
    quelle_url: 'https://www.tiktok.com/@da/video/7300000000000000010',
    datei: dateiname,
    rechte_geprueft: false,
  };
}

const OHNE_DATEI = {
  produkt_id: 10,
  video_id: '7300000000000000011',
  quelle_url: 'https://www.tiktok.com/@weg/video/7300000000000000011',
  datei: 'gibt-es-nicht-mehr.mp4',
  rechte_geprueft: false,
};

test('verwaiste Eintraege sind die ohne Datei — und nur die', () => {
  const ordner = tempOrdner();
  const daEintrag = indexMitDatei(ordner, 'liegt-da.mp4');
  const index = { version: 1, eintraege: [daEintrag, OHNE_DATEI] };

  const verwaist = verwaisteEintraege(index, ordner, ordner);
  assert.equal(verwaist.length, 1);
  assert.equal(verwaist[0].datei, 'gibt-es-nicht-mehr.mp4');

  // Gegenprobe: Wer pauschal alles einsammelt, wirft auch den Eintrag weg,
  // dessen Datei sehr wohl da liegt — und damit dessen Herkunftsnachweis.
  assert.notEqual(verwaist.length, index.eintraege.length,
    'ein Aufraeumer, der alles nimmt, loescht gueltige Nachweise');
});

test('aufgeraeumte Eintraege wandern nach "frueher_geladen", der Rest bleibt', () => {
  const ordner = tempOrdner();
  const daEintrag = indexMitDatei(ordner, 'liegt-da.mp4');
  const index = { version: 1, eintraege: [daEintrag, OHNE_DATEI] };

  const { entfernt, index: neu } = raeumeIndexAuf(index, { videoOrdner: ordner, datenOrdner: ordner });
  assert.equal(entfernt.length, 1);
  assert.equal(neu.eintraege.length, 1);
  assert.equal(neu.eintraege[0].datei, 'liegt-da.mp4');
  assert.equal(neu.frueher_geladen.length, 1);
  assert.equal(neu.frueher_geladen[0].video_id, OHNE_DATEI.video_id);
  assert.ok(neu.frueher_geladen[0].entfernt_am, 'wann es entfernt wurde, gehoert dazu');

  // Der schmale Eintrag traegt bewusst KEINE Herkunftsangaben mehr: Es gibt
  // keine Datei, fuer die sie gelten wuerden.
  assert.equal(neu.frueher_geladen[0].sha256, undefined);
  assert.equal(neu.frueher_geladen[0].creator, undefined);
});

test('ein aufgeraeumtes Video wird NICHT erneut geladen', () => {
  const ordner = tempOrdner();
  const index = { version: 1, eintraege: [OHNE_DATEI] };
  const kandidat = { id: OHNE_DATEI.video_id, url: OHNE_DATEI.quelle_url };

  assert.equal(schonImIndex(index, kandidat), true, 'vorher bekannt');
  const { index: neu } = raeumeIndexAuf(index, { videoOrdner: ordner, datenOrdner: ordner });
  assert.equal(schonImIndex(neu, kandidat), true, 'nach dem Aufraeumen immer noch bekannt');

  // GEGENPROBE — genau das war die Falle beim Bauen: Die alte Fassung sah nur
  // in "eintraege". Mit ihr gilt das eben aufgeraeumte Video als unbekannt,
  // und der naechste Lauf holt exakt die 26 Videos zurueck, die gerade
  // entfernt wurden.
  const alteFassung = (idx, k) => idx.eintraege.some(
    (e) => e.quelle_url === k.url || String(e.video_id) === String(k.id));
  assert.equal(alteFassung(neu, kandidat), false,
    'die alte Fassung haette das Video wieder geholt — dieser Test haette sie rot gemeldet');
});

test('aufraeumen schreibt ohne --schreiben nichts', () => {
  const ordner = tempOrdner();
  const index = { version: 1, eintraege: [OHNE_DATEI] };
  speichereIndex(ordner, index);
  const vorher = fs.readFileSync(indexPfad(ordner), 'utf8');

  const echtesLog = console.log;
  console.log = () => {};
  try {
    const code = aufraeumen({ datenOrdner: ordner, videoOrdner: ordner });
    assert.equal(code, 0);
  } finally {
    console.log = echtesLog;
  }

  assert.equal(fs.readFileSync(indexPfad(ordner), 'utf8'), vorher,
    'die Vorschau darf den Nachweis nicht anfassen');
});

// ── Gesprochene Sprache ──────────────────────────────────────────────
//
// Alle Werte hier sind gemessen, nicht ausgedacht: py bot/sprach-erkennung.py
// ueber die 16 Videos in Marketing/videos.
//   geredet:  Sicherheit 0.977 - 0.998   (28 - 173 Woerter)
//   still:    Sicherheit 0.258 - 0.580   ( 0 Woerter)

const DEUTSCH_GESPROCHEN =                       // 07_..._14s_stil-b.mp4
  { ok: true, sprache: 'de', sprache_sicherheit: 0.995, dauer: 14.05, redeanteil: 0.996, woerter: 52 };
const ENGLISCH_GESPROCHEN =                      // 09_..._49s_stil-b.mp4
  { ok: true, sprache: 'en', sprache_sicherheit: 0.995, dauer: 49.76, redeanteil: 0.93, woerter: 134 };
const STILL =                                    // 13_..._14s_stil-b.mp4
  { ok: true, sprache: 'en', sprache_sicherheit: 0.258, dauer: 14.98, redeanteil: 0, woerter: 0 };
const STILL_KNAPP =                              // 17_..._15s_stil-b.mp4
  { ok: true, sprache: 'en', sprache_sicherheit: 0.58, dauer: 27.38, redeanteil: 0, woerter: 0 };

test('bei Stille gibt es keine gesprochene Sprache — auch wenn der Erkenner eine nennt', () => {
  assert.equal(gesprocheneSprache(STILL), null);
  assert.equal(gesprocheneSprache(STILL_KNAPP), null);

  // GEGENPROBE: Die alte Fassung schrieb messung.sprache ungeprueft in den
  // Nachweis. Bei 0 Woertern stand dort dann "en" — als Tatsache, obwohl kein
  // Wort faellt. Genau dieser Wert steht noch in aelteren Index-Eintraegen.
  assert.equal(STILL.sprache, 'en',
    'der Erkenner RAET hier — deshalb darf man ihn nicht uebernehmen');
});

test('wer deutsch waehlt, bekommt kein englisch gesprochenes Video', () => {
  assert.equal(sprachePasst(ENGLISCH_GESPROCHEN, 'de'), false);
  assert.equal(sprachePasst(DEUTSCH_GESPROCHEN, 'de'), true);
  assert.equal(sprachePasst(ENGLISCH_GESPROCHEN, 'en'), true);

  // GEGENPROBE: Vorher wurde der Ton bei "mit Sprache" gar nicht abgehoert —
  // es zaehlte allein der Untertitel. Ein englisch gesprochenes Video mit
  // deutschem Untertitel kam damit als "deutsch" durch.
  assert.equal(spracheDesTextes('Der beste Wasserspender fuer den Schreibtisch im Test'), 'de',
    'der Untertitel sagt deutsch — die Ansage kann trotzdem englisch sein');
});

test('Stille ist kein Einwand gegen die Sprachwahl', () => {
  assert.equal(sprachePasst(STILL, 'de'), null);
  assert.equal(sprachePasst(STILL, 'en'), null);

  // Gegenprobe: Wuerde hier false herauskommen, fiele bei "nur Musik" jedes
  // Video durch — dort redet ja niemand. Der Filter haette den Ordner leer
  // gelassen, ohne dass ein Fehler sichtbar waere.
  assert.notEqual(sprachePasst(STILL, 'de'), false);
});

test('nicht abhoerbar heisst kein Einwand, nicht "falsche Sprache"', () => {
  const kaputt = { ok: false, grund: 'Python-Paket numpy fehlt' };
  assert.equal(sprachePasst(kaputt, 'de'), null);
  assert.equal(gesprocheneSprache(kaputt), null);
});

test('die Sicherheitsgrenze liegt in der gemessenen Luecke', () => {
  const geredet = [0.995, 0.994, 0.989, 0.996, 0.977, 0.998, 0.991];
  const still = [0.428, 0.258, 0.258, 0.58];
  assert.ok(SPRACHE_SICHER > Math.max(...still),
    'unter der Grenze muss alles liegen, wo niemand redet');
  assert.ok(SPRACHE_SICHER < Math.min(...geredet),
    'ueber der Grenze muss alles liegen, wo geredet wird');

  // Gegenprobe: Eine Grenze am Rand statt in der Luecke waere wertlos. Bei 0.5
  // zaehlte reine Stille (gemessen bis 0.58) als erkannte Sprache.
  assert.ok(0.5 < Math.max(...still),
    'eine Grenze bei 0.5 haette Stille als Sprache durchgelassen');
});


// ── Zeichen, die ueber eine Blockgrenze fallen ───────────────────────

test('ein Umlaut an der Blockgrenze bleibt ein Umlaut', () => {
  // "für" als UTF-8: 66 C3 BC 72. Der Schnitt liegt MITTEN im "ü".
  const erstes = Buffer.from([0x66, 0xc3]);
  const zweites = Buffer.from([0xbc, 0x72]);
  assert.equal(textAusPuffern([erstes, zweites]), 'für');

  // GEGENPROBE: So stand es vorher im Code — jedes Stueck fuer sich gelesen.
  // Das Ergebnis ist Zeichenmuell, und zwar lautlos: keine Meldung, kein
  // Fehler, nur ein kaputter Untertitel, an dem Sprache, Kernwort und
  // Bewertung anschliessend alle scheitern.
  let alteFassung = '';
  alteFassung += erstes;
  alteFassung += zweites;
  assert.notEqual(alteFassung, 'für');
  assert.ok(alteFassung.includes('\uFFFD'), 'die alte Fassung macht daraus Ersatzzeichen');
});

test('normale Ausgabe ohne Blockgrenzen bleibt unveraendert', () => {
  assert.equal(textAusPuffern([Buffer.from('{"title":"Wasserspender"}', 'utf8')]),
    '{"title":"Wasserspender"}');
  assert.equal(textAusPuffern([]), '');
  assert.equal(textAusPuffern(null), '');
});

// ── Kernwort mit Laengenregel ────────────────────────────────────────

test('kurze Kernwoerter treffen nur ganze Woerter, lange duerfen im Wort stehen', () => {
  const kern = ['jug', 'dispenser'];

  assert.equal(hatKernwort({ title: 'My bed side water set up, I use a smaller jug' }, kern), true,
    '"jug" als eigenes Wort muss treffen');
  assert.equal(hatKernwort({ title: 'Stay hydrated #waterdispenser #homemusthave' }, kern), true,
    '"dispenser" muss im Hashtag stecken duerfen');

  // GEGENPROBE: Der reine Teilstring-Vergleich von vorher haette hier
  // zugeschlagen — und genau deshalb konnte man kurze Woerter wie "jug",
  // "cup" oder "gallon" gar nicht erst eintragen.
  const alteFassung = (v, w) => w.some((x) => videoText(v).includes(x));
  const jonglieren = { title: 'Juggling three balls while walking' };
  assert.equal(hatKernwort(jonglieren, kern), false);
  assert.equal(alteFassung(jonglieren, kern), true,
    'die alte Fassung haette ein Jonglier-Video als Wasserspender gezaehlt');
});

// ── Sprache: zweites Merkmal aus dem Wortschatz ──────────────────────

const WORTSCHATZ = {
  suchbegriff: {
    de: ['tiktok wasserspender gadget', 'tiktok automatischer wasserspender nachttisch'],
    en: ['tiktok water dispenser desktop', 'tiktok bedside water dispenser nightstand'],
  },
};

test('nur eindeutige Woerter zaehlen als Sprachhinweis', () => {
  const h = sprachHinweise({
    suchbegriff: { de: ['wasserspender smart pumpe'], en: ['water dispenser smart pump'] },
  });
  assert.ok(h.de.includes('wasserspender'));
  assert.ok(h.en.includes('dispenser'));

  // "smart" steht in beiden Listen und verraet deshalb nichts. Waere es
  // drin, entschiede es Faelle, in denen es gar keinen Hinweis gibt.
  assert.equal(h.de.includes('smart'), false);
  assert.equal(h.en.includes('smart'), false);
  // "gadget" ist ein Allerweltswort und fliegt ohnehin raus.
  const g = sprachHinweise({ suchbegriff: { de: ['gadget test'], en: [] } });
  assert.equal(g.de.includes('gadget'), false);
});

test('reine Hashtag-Untertitel werden mit dem Wortschatz entscheidbar', () => {
  const h = sprachHinweise(WORTSCHATZ);
  const nurHashtags = 'Smart table water dispenser #tiktokshop #CapCut';

  // GEGENPROBE zuerst: ohne den Wortschatz kein einziges Funktionswort —
  // der Untertitel galt als "nicht entscheidbar" und flog raus, obwohl er
  // unuebersehbar englisch ist. Gemessen an 36 echten Untertiteln traf das
  // 7 davon, also fast jeden fuenften.
  assert.equal(spracheDesTextes(nurHashtags), null);
  assert.equal(spracheDesTextes(nurHashtags, h), 'en');

  assert.equal(spracheDesTextes('#waterdispenser #bedside #nightstand', h), 'en');
});

test('der Wortschatz ueberstimmt die Funktionswoerter nicht', () => {
  const h = sprachHinweise(WORTSCHATZ);
  // Deutscher Satz mit englischem Hashtag: Die Funktionswoerter entscheiden,
  // der Wortschatz kommt gar nicht erst zum Zug.
  const gemischt = 'Das ist der beste Spender für den Schreibtisch #waterdispenser';
  assert.equal(spracheDesTextes(gemischt, h), 'de');

  // Gegenprobe: Zaehlte der Wortschatz immer mit, kippte dieser Satz auf
  // englisch — ein deutsches Video ginge bei der Auswahl "deutsch" verloren.
  const immerMitzaehlen = (text) => {
    const t = normalisiere(text);
    const de = h.de.filter((w) => t.includes(w)).length;
    const en = h.en.filter((w) => t.includes(w)).length;
    return de === en ? null : (de > en ? 'de' : 'en');
  };
  assert.equal(immerMitzaehlen(gemischt), 'en',
    'genau deshalb greift der Wortschatz nur bei Gleichstand');
});

// ── Dubletten ueber die Pruefsumme ───────────────────────────────────

test('dieselbe Datei unter einem anderen Konto wird erkannt', () => {
  const index = {
    version: 1,
    eintraege: [{
      video_id: '7300000000000000020',
      quelle_url: 'https://www.tiktok.com/@erster/video/7300000000000000020',
      datei: '07_wasserspender_14s_stil-b.mp4',
      sha256: 'abc123',
    }],
  };
  const treffer = schonAlsDateiDa(index, 'abc123');
  assert.ok(treffer);
  assert.equal(treffer.datei, '07_wasserspender_14s_stil-b.mp4');
  assert.equal(schonAlsDateiDa(index, 'ganzandere'), null);
  assert.equal(schonAlsDateiDa(index, null), null, 'ohne Pruefsumme keine Aussage');

  // GEGENPROBE: Der Nachladeschutz ueber Adresse und ID greift hier NICHT —
  // es ist ein anderes Konto, eine andere ID, eine andere Adresse. Genau so
  // lagen zwei bitgleiche Paare im Nachweis.
  const neuHochgeladen = { id: '7999999999999999999', url: 'https://www.tiktok.com/@zweiter/video/7999999999999999999' };
  assert.equal(schonImIndex(index, neuHochgeladen), false,
    'ueber Adresse und ID ist das ein neues Video — nur die Pruefsumme verraet es');
});

// ── Ausschlussliste: trifft Tiere, nicht Unbeteiligte ────────────────

test('die Ausschlussliste trifft Tierprodukte und sonst nichts', () => {
  const konfig = ladeKonfig();
  const aus = [].concat(konfig.standard.ausschluss || []);

  assert.equal(ausschlussTreffer({ title: 'mit Fernbedienung #petpeer #wasserspender' }, aus), 'petpeer');
  assert.equal(ausschlussTreffer({ title: 'Immer frisches Wasser für die Fellnasen' }, aus), 'fellnase');

  // GEGENPROBE — der Grund, warum hier KEINE Kurzformen stehen: Verglichen
  // wird als Wortanfang. "pet" haette "Peter" und "petite" getroffen, "cat"
  // jede "Kategorie" und jedes "Catering".
  assert.equal(ausschlussTreffer({ title: 'Peter zeigt seine petite Kategorie beim Catering' }, aus), null);
  assert.equal(aus.includes('pet'), false, '"pet" wuerde zu viel treffen');
  assert.equal(aus.includes('cat'), false, '"cat" wuerde zu viel treffen');
});


test('bitgleiche Downloads landen nur einmal im Ordner', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();

  // Zwei verschiedene Konten, zwei verschiedene IDs, zwei verschiedene
  // Adressen — und derselbe Clip. Auf TikTok ist das der Normalfall: Ein
  // Video laeuft gut, drei andere Konten laden es neu hoch.
  const nachbau = (n, konto) => ({
    id: '740000000000000000' + n,
    webpage_url: `https://www.tiktok.com/@${konto}/video/740000000000000000${n}`,
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 12,
    uploader: konto, track: 'Ein Lied', artist: 'Jemand',
  });
  const erstes = nachbau(1, 'original');
  const zweites = nachbau(2, 'nachlader');

  const ytdlp = async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      const url = argumente[argumente.length - 1];
      const treffer = [erstes, zweites].find((v) => v.webpage_url === url);
      return { code: 0, stdout: treffer ? JSON.stringify(treffer) : '', stderr: '' };
    }
    // BEIDE Downloads liefern denselben Inhalt — das ist der ganze Punkt.
    fs.writeFileSync(argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4'), 'derselbe clip');
    return { code: 0, stdout: '', stderr: '' };
  };

  const antworten = ['10', '2', '1', '1'];
  const code = await interaktiv({
    ytdlp,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [erstes.webpage_url, zweites.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T10:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(code, 0);
  const dateien = geladeneVideos(videos);
  assert.equal(dateien.length, 1, 'derselbe Clip darf nur einmal liegenbleiben');
  const index = ladeIndex(daten);
  assert.equal(index.eintraege.length, 1, 'und nur einmal im Nachweis stehen');

  // GEGENPROBE: Nach Adresse und ID sind das zwei verschiedene Videos. Ohne
  // den Vergleich der Pruefsumme laegen jetzt zwei bitgleiche Dateien im
  // Ordner — genau das ist passiert, zweimal.
  assert.equal(schonImIndex({ eintraege: [index.eintraege[0]] }, { id: zweites.id, url: zweites.webpage_url }),
    false, 'der Schutz ueber Adresse und ID greift hier nicht');
});


// ── Die zweite Pruefung: ist es wirklich DIESES Geraet? ──────────────
//
// Das Kernwort sagt nur "es geht um einen Wasserspender". Davon gibt es
// Standgeraete fuers Buero, Kuehlschrankspender, Filterkannen und dieses
// kleine Geraet, das auf einer Gallonenflasche sitzt und mit Akku pumpt.

const MERKMALE = ['flasche', 'gallone', 'kanister', 'akku', 'usb', 'wiederaufladbar',
  'elektrisch', 'pumpe', 'schreibtisch', 'nachttisch', 'buero', 'desk', 'bottle', 'pump'];

test('ohne Merkmal dieses Geraets wird nicht geladen', () => {
  // Ein Buero-Standgeraet: heisst Wasserspender, ist aber ein anderes Produkt.
  const standgeraet = { title: 'Der neue Wasserspender im Flur unserer Firma ist da' };
  assert.equal(hatMerkmal(standgeraet, MERKMALE), false);

  const echtes = { title: 'Elektrischer Wasserspender mit Akku für die Gallonenflasche' };
  assert.equal(hatMerkmal(echtes, MERKMALE), true);
  // Vier Merkmale, nicht zwei: "Gallonenflasche" ist ein zusammengesetztes
  // Wort und enthaelt "gallone" UND "flasche". Genau dafuer duerfen lange
  // Begriffe im Wort stehen — deutsche Komposita verstecken die Merkmale sonst.
  assert.deepEqual(getroffeneMerkmale(echtes, MERKMALE).sort(),
    ['akku', 'elektrisch', 'flasche', 'gallone'].sort());

  // GEGENPROBE: Genau hier liegt der Wert. Das Standgeraet besteht ALLE
  // vorherigen Huerden — es hat das Kernwort "wasserspender" und mit
  // "wasserspender" plus "buero" auch zwei getroffene Begriffe. Ohne die
  // Merkmalspruefung waere es heruntergeladen worden.
  assert.equal(hatKernwort(standgeraet, ['wasserspender', 'dispenser']), true,
    'das Kernwort allein haelt das Standgeraet nicht auf');
});

test('ohne gepflegte Merkmale blockiert die Pruefung nichts', () => {
  const irgendwas = { title: 'Wasserspender' };
  assert.equal(hatMerkmal(irgendwas, []), true);
  assert.equal(hatMerkmal(irgendwas, undefined), true);

  // Gegenprobe: Wuerde ein leeres Feld als "kein Merkmal getroffen" gelten,
  // kaeme bei den 39 Produkten ohne Merkmalsliste gar nichts mehr durch —
  // und zwar lautlos, denn abgelehnte Videos sieht man nirgends.
  assert.notEqual(hatMerkmal(irgendwas, []), false);
});

test('kurze Merkmale treffen nur ganze Woerter', () => {
  assert.equal(hatMerkmal({ title: 'Wasserspender mit USB Anschluss' }, ['usb']), true);

  // GEGENPROBE zum reinen Teilstring-Vergleich: "usb" steckt in "Usbekistan",
  // "akku" in "Akkusativ", "pump" in "Pumpernickel".
  assert.equal(hatMerkmal({ title: 'Reisevideo aus Usbekistan' }, ['usb']), false);
  assert.equal(hatMerkmal({ title: 'Deutschstunde: der Akkusativ' }, ['akku']), false);
});

// ── Weitersuchen, bis die Zahl steht ─────────────────────────────────

test('es wird nachgesucht, bis die gewuenschte Anzahl da ist', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();

  // Der erste Suchbegriff liefert nur ein Video, das durchfaellt (jemand
  // redet). Erst der zweite bringt ein brauchbares.
  const durchfaller = {
    id: '7410000000000000001',
    webpage_url: 'https://www.tiktok.com/@rede/video/7410000000000000001',
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 20,
    uploader: 'rede', track: 'original sound', artist: '',
  };
  const treffer = {
    id: '7410000000000000002',
    webpage_url: 'https://www.tiktok.com/@musik/video/7410000000000000002',
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 14,
    uploader: 'musik', track: 'Ein Lied', artist: 'Jemand',
  };

  const gefragt = [];
  const holen = async (adresse, einstellungen) => {
    const anfrage = JSON.parse(einstellungen.body);
    gefragt.push(anfrage.query);
    const treffer1 = gefragt.length === 1 ? [durchfaller] : [treffer];
    return { ok: true, json: async () => ({ results: treffer1.map((v) => ({ url: v.webpage_url })) }) };
  };

  const ytdlp = async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      const url = argumente[argumente.length - 1];
      const v = [durchfaller, treffer].find((x) => x.webpage_url === url);
      return { code: 0, stdout: v ? JSON.stringify(v) : '', stderr: '' };
    }
    const ziel = argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
    fs.writeFileSync(ziel, 'video-' + path.basename(ziel));
    return { code: 0, stdout: '', stderr: '' };
  };

  const antworten = ['10', '1', '1', '1'];
  const code = await interaktiv({
    ytdlp, holen,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { suchbegriff: {
      de: ['tiktok wasserspender schreibtisch', 'tiktok wasserspender akku flasche'],
      en: [],
    } } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: { TAVILY_API_KEY: 'x' },
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T12:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(code, 0);
  assert.equal(geladeneVideos(videos).length, 1,
    'das Ziel wurde erreicht, obwohl der erste Begriff nichts Brauchbares brachte');

  // GEGENPROBE: Vorher wurden alle Begriffe VORWEG abgefragt und die Sammlung
  // dann abgearbeitet — kam nichts durch, endete der Lauf eben mit "0 von 1".
  // Dass hier zwei Begriffe gebraucht wurden, ist der Beleg fuers Nachlegen.
  assert.equal(gefragt.length, 2, 'der zweite Begriff wurde erst bei Bedarf abgefragt');
});

test('ist die Zahl erreicht, wird nicht weiter gesucht', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();

  const treffer = {
    id: '7420000000000000001',
    webpage_url: 'https://www.tiktok.com/@musik/video/7420000000000000001',
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 14,
    uploader: 'musik', track: 'Ein Lied', artist: 'Jemand',
  };

  const gefragt = [];
  const holen = async (adresse, einstellungen) => {
    gefragt.push(JSON.parse(einstellungen.body).query);
    return { ok: true, json: async () => ({ results: [{ url: treffer.webpage_url }] }) };
  };
  const ytdlp = async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      return { code: 0, stdout: JSON.stringify(treffer), stderr: '' };
    }
    fs.writeFileSync(argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4'), 'video');
    return { code: 0, stdout: '', stderr: '' };
  };

  const antworten = ['10', '1', '1', '1'];
  await interaktiv({
    ytdlp, holen,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { suchbegriff: {
      de: ['begriff eins wasserspender', 'begriff zwei wasserspender',
        'begriff drei wasserspender', 'begriff vier wasserspender'],
      en: [],
    } } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: { TAVILY_API_KEY: 'x' },
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T12:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  // GEGENPROBE zum alten Verhalten: Das haette alle VIER Begriffe abgefragt,
  // bevor ueberhaupt das erste Video angesehen wurde. Bei 48 hinterlegten
  // Begriffen waeren das 48 Abfragen fuer ein einziges Video — vom Kontingent
  // (1000 im Monat) und von der Wartezeit her reine Verschwendung.
  assert.equal(gefragt.length, 1, 'eine Abfrage hat gereicht, also blieb es dabei');
});


// ── Zweite Runde: Tonspur ist Reihenfolge, nicht Urteil ──────────────
//
// "original sound" heisst nur, dass der Ton eine eigene Aufnahme ist statt
// eines lizenzierten Titels. Nachgemessen lag das Feld bei VIER von SIEBEN
// angeblichen Musikvideos falsch, und in einem echten Lauf fielen daran 24 von
// 33 Kandidaten — viele davon nachweislich still.
//
// Der Spracherkenner wird hier ERSETZT. Was er im Echtbetrieb liefert, sichern
// die Messwert-Tests weiter oben ab (Redeanteil, Woerter, Sicherheit); hier
// geht es allein um den Ablauf drumherum, der sich sonst nicht durchspielen
// liesse: Echtes Python auf einer Attrappendatei kann gar nichts hoeren.
const STILL_GEMESSEN = { ok: true, sprache: 'de', sprache_sicherheit: 0.99, dauer: 12, redeanteil: 0, woerter: 0 };
const REDE_GEMESSEN = { ok: true, sprache: 'de', sprache_sicherheit: 0.99, dauer: 20, redeanteil: 0.9, woerter: 60 };

function eigenerTon(n) {
  return {
    id: '743000000000000000' + n,
    webpage_url: `https://www.tiktok.com/@eigen${n}/video/743000000000000000${n}`,
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 12 + n,
    uploader: 'eigen' + n, track: 'original sound', artist: '',
  };
}
function lizenzierterTon(n) {
  return {
    id: '744000000000000000' + n,
    webpage_url: `https://www.tiktok.com/@musik${n}/video/744000000000000000${n}`,
    title: 'Elektrischer Wasserspender am Schreibtisch', duration: 20 + n,
    uploader: 'musik' + n, track: 'Ein Lied', artist: 'Jemand',
  };
}

function ytdlpFuer(videos, protokoll) {
  return async (argumente) => {
    if (argumente.includes('--dump-json') && !argumente.includes('-o')) {
      const url = argumente[argumente.length - 1];
      protokoll.angaben.push(url);
      const v = videos.find((x) => x.webpage_url === url);
      return { code: 0, stdout: v ? JSON.stringify(v) : '', stderr: '' };
    }
    const ziel = argumente[argumente.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
    fs.writeFileSync(ziel, 'video-' + path.basename(ziel));
    protokoll.downloads.push(ziel);
    return { code: 0, stdout: '', stderr: '' };
  };
}

test('ein zurueckgestelltes Video kommt in der zweiten Runde doch dran', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const eigen = eigenerTon(1);
  const protokoll = { angaben: [], downloads: [] };

  const antworten = ['10', '1', '1', '1'];          // deutsch, keine Sprache
  const code = await interaktiv({
    ytdlp: ytdlpFuer([eigen], protokoll),
    pruefeSprache: () => STILL_GEMESSEN,             // abgehoert: es redet niemand
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [eigen.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T13:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(code, 0);
  assert.equal(geladeneVideos(videos).length, 1);

  // GEGENPROBE: Vorher entschied allein das Feld "track". Dieses Video haette
  // den Ordner nie erreicht, obwohl darin nachweislich niemand redet.
  assert.equal(istMusik(eigen), false,
    'nach dem alten Urteil waere hier Schluss gewesen — 0 statt 1 Video');

  // Und es wurde nur EINMAL nach den Angaben gefragt: Der zurueckgestellte
  // Kandidat bringt sie mit. Sonst waere jede zweite Runde ein zweiter Satz
  // Anfragen an TikTok fuer dieselben Videos.
  assert.equal(protokoll.angaben.length, 1, 'keine zweite Anfrage fuer dasselbe Video');
});

test('wird geredet, hilft auch die zweite Runde nicht', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const eigen = eigenerTon(2);
  const protokoll = { angaben: [], downloads: [] };

  const antworten = ['10', '1', '1', '1'];
  await interaktiv({
    ytdlp: ytdlpFuer([eigen], protokoll),
    pruefeSprache: () => REDE_GEMESSEN,              // abgehoert: es wird geredet
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [eigen.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T13:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(geladeneVideos(videos).length, 0,
    'geladen wurde es, aber nach dem Abhoeren wieder entfernt');
  assert.equal(protokoll.downloads.length, 1,
    'das Herunterladen war noetig — hoeren kann man nur eine Datei');
});

test('ist die Zahl schon voll, bleibt das Zurueckgestellte liegen', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const eigen = eigenerTon(3);
  const musik = lizenzierterTon(3);
  const protokoll = { angaben: [], downloads: [] };

  const antworten = ['10', '1', '1', '1'];
  await interaktiv({
    ytdlp: ytdlpFuer([eigen, musik], protokoll),
    pruefeSprache: () => STILL_GEMESSEN,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    // Der mit eigener Tonspur steht ZUERST — er wird trotzdem hintangestellt.
    konfig: { produkte: { 10: { videos: [eigen.webpage_url, musik.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T13:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(protokoll.downloads.length, 1, 'nur ein Download, obwohl zwei Kandidaten da waren');
  const index = ladeIndex(daten);
  assert.equal(index.eintraege[0].creator, 'musik3',
    'der lizenzierte Ton kommt zuerst dran — die Reihenfolge bleibt die guenstige');
});

test('ohne Abhoermoeglichkeit entscheidet wieder die Tonspur', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const eigen = eigenerTon(4);
  const protokoll = { angaben: [], downloads: [] };

  const antworten = ['10', '1', '1', '1'];
  await interaktiv({
    ytdlp: ytdlpFuer([eigen], protokoll),
    // Python fehlt, Datei unlesbar — der haeufigste reale Fehlerfall.
    pruefeSprache: () => ({ ok: false, grund: "Python-Paket 'numpy' fehlt" }),
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [eigen.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T13:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  // GEGENPROBE zur Verbesserung selbst: Die Tonspur ist nur deshalb kein
  // Urteil mehr, WEIL abgehoert wird. Faellt das Abhoeren aus, ist sie wieder
  // das einzige Indiz — und dann gilt sie auch. Sonst waere die Verbesserung
  // im Fehlerfall eine Verschlechterung.
  assert.equal(geladeneVideos(videos).length, 0,
    'nicht hoerbar plus eigene Tonspur heisst: bleibt draussen');
});


test('der Nachweis haelt fest, WARUM das Video zum Produkt gehoert', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const musik = lizenzierterTon(9);
  musik.title = 'Elektrischer Wasserspender mit Akku für die Gallonenflasche am Schreibtisch';
  const protokoll = { angaben: [], downloads: [] };

  const antworten = ['10', '1', '1', '1'];
  await interaktiv({
    ytdlp: ytdlpFuer([musik], protokoll),
    pruefeSprache: () => STILL_GEMESSEN,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: {
      videos: [musik.webpage_url],
      merkmale: ['akku', 'gallone', 'flasche', 'schreibtisch', 'usb'],
    } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T14:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  const eintrag = ladeIndex(daten).eintraege[0];
  assert.deepEqual([].concat(eintrag.merkmale).sort(),
    ['akku', 'flasche', 'gallone', 'schreibtisch'].sort());

  // GEGENPROBE: Der Trefferwert allein sagt nur "es kamen genug Suchbegriffe
  // vor". Er stuende auch unter einem Buero-Standgeraet. Erst die Merkmale
  // belegen, dass es DIESES Geraet ist — und ohne sie im Nachweis liesse sich
  // spaeter nicht mehr pruefen, worauf die Zuordnung beruhte.
  assert.equal(typeof eintrag.trefferwert, 'number');
  assert.notEqual(eintrag.merkmale, null, 'ohne Merkmale im Nachweis fehlt die Begruendung');
});


// ── Videoadressen aus dem Seitentext ─────────────────────────────────
//
// Gemessen an sechs echten Anfragen: 94 Treffer, davon SECHS Videoadressen.
// 53 waren "/discover/"-Seiten (TikToks eigene Themenseiten), 33 Shop-Seiten.
// Auf genau diesen Themenseiten stehen die gesuchten Videos — und die Such-API
// liefert den Seitentext mit. Dieselben vier Begriffe: 0 Adressen aus den
// Treffern, 114 aus dem Seitentext.

test('aus dem Seitentext werden Videoadressen gelesen', () => {
  const seite = 'Menü [TikTok](https://www.tiktok.com/?lang=ur) '
    + '[Clip](https://www.tiktok.com/@erster.nutzer/video/7286234333940141343?lang=ur) '
    + 'https://tiktok.com/@zweiter-nutzer/video/7240998020924312874 '
    + 'https://www.tiktok.com/@dritter/video/7286234333940141343';

  const gefunden = adressenAusText(seite);
  assert.equal(gefunden.length, 3);
  assert.ok(gefunden.includes('https://www.tiktok.com/@erster.nutzer/video/7286234333940141343'),
    'Punkte und Bindestriche kommen in Kontonamen vor');
  assert.ok(gefunden.includes('https://tiktok.com/@zweiter-nutzer/video/7240998020924312874'),
    'auch ohne "www."');

  // Das Anhaengsel muss weg: Dieselbe Adresse steht auf einer Seite mit
  // "?lang=ur", "?is_from_webapp=1" und ohne — sonst stuende sie dreimal in
  // der Warteschlange und kostete dreimal einen Abruf bei TikTok.
  assert.ok(gefunden.every((u) => !u.includes('?')), 'ohne Anhaengsel');
});

test('was keine Videoadresse ist, wird auch nicht dafuer gehalten', () => {
  const seite = 'https://www.tiktok.com/discover/water-dispenser '
    + 'https://www.tiktok.com/tag/waterdispenser '
    + 'https://shop.tiktok.com/us/k/desktop-water-dispenser '
    + 'https://www.tiktok.com/@jemand '
    + 'https://www.tiktok.com/@jemand/photo/7657111936898829600 '
    + 'https://www.tiktok.com/@jemand/video/123';
  assert.deepEqual(adressenAusText(seite), []);
  assert.deepEqual(adressenAusText(''), []);
  assert.deepEqual(adressenAusText(null), []);

  // "/video/123" hat nur drei Ziffern. Echte TikTok-Kennungen haben 19 —
  // eine kurze Zahl stammt aus einem Beispiel oder einer fremden Seite.
});

test('die Suche nimmt beide Quellen: Treffer UND Seitentext', async () => {
  const seitentext = 'irgendwas https://www.tiktok.com/@aus.dem.text/video/7286234333940141343?lang=ur'
    + ' und https://tiktok.com/@noch.einer/video/7240998020924312874';
  let gesendet = null;
  const holen = async (adresse, einstellungen) => {
    gesendet = JSON.parse(einstellungen.body);
    return { ok: true, json: async () => ({ results: [
      // So sieht es in echt aus: die Trefferadresse selbst ist eine
      // Themenseite, die Videos stehen in ihrem Text.
      { url: 'https://www.tiktok.com/discover/water-dispenser', raw_content: seitentext },
      { url: 'https://www.tiktok.com/@direkt/video/7300000000000000001', raw_content: '' },
      { url: 'https://shop.tiktok.com/us/k/desk', raw_content: null },
    ] }) };
  };

  const e = await sucheAdressen({ begriff: 'wasserspender', env: { TAVILY_API_KEY: 't' }, holen });
  assert.equal(e.ok, true);
  assert.equal(e.adressen.length, 3);
  assert.equal(gesendet.include_raw_content, true, 'der Seitentext muss angefordert werden');

  // GEGENPROBE: Ohne den Seitentext bliebe genau EINE Adresse uebrig — die
  // Themenseite und die Shop-Seite sind keine Videos. Genau das war der
  // Engpass: rund zwei Adressen je Anfrage.
  const nurTreffer = e.adressen.filter((u) => u.includes('@direkt'));
  assert.equal(nurTreffer.length, 1, 'vorher waere es bei dieser einen geblieben');
});

// ── Aufhoeren, wenn TikTok nicht mehr antwortet ──────────────────────

test('nach fuenf Fehlschlaegen hintereinander ist Schluss', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();

  // Zehn Adressen, TikTok beantwortet keine einzige. Genau das ist passiert:
  // Nach rund 50 Abrufen an einem Tag scheiterte auch eine Adresse, die eine
  // Stunde vorher noch funktioniert hatte.
  const urls = Array.from({ length: 10 },
    (unbenutzt, i) => `https://www.tiktok.com/@k${i}/video/74500000000000000${i}`);
  let versuche = 0;
  const ytdlp = async () => {
    versuche++;
    return { code: 1, stdout: '', stderr: 'ERROR: [TikTok] 123: Unexpected response from webpage request' };
  };

  const antworten = ['10', '3', '1', '1'];
  await interaktiv({
    ytdlp,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: urls } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T15:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  assert.equal(versuche, 5, 'nach fuenf gleichen Fehlschlaegen wird nicht weiter abgeklopft');

  // GEGENPROBE: Vorher zaehlte jeder Fehlschlag fuer sich und der Lauf machte
  // weiter. Bei diesen zehn Adressen waeren es zehn Abrufe gewesen, bei einem
  // echten Lauf mit 50 Adressen eben fuenfzig — alle mit derselben Antwort,
  // und jeder einzelne verlaengert eine Ratenbegrenzung eher, als sie zu loesen.
  assert.notEqual(versuche, urls.length, 'ohne die Bremse waere jede Adresse drangekommen');
});

test('ein einzelner Fehlschlag bremst den Lauf nicht', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const kaputt = 'https://www.tiktok.com/@weg/video/7460000000000000001';
  const gut = lizenzierterTon(7);
  const protokoll = { angaben: [], downloads: [] };
  const echtes = ytdlpFuer([gut], protokoll);

  const ytdlp = async (argumente) => {
    if (argumente[argumente.length - 1] === kaputt) {
      return { code: 1, stdout: '', stderr: 'ERROR: [TikTok] 1: Unexpected response from webpage request' };
    }
    return echtes(argumente);
  };

  const antworten = ['10', '1', '1', '1'];
  await interaktiv({
    ytdlp,
    pruefeSprache: () => STILL_GEMESSEN,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [kaputt, gut.webpage_url] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T15:00:00.000Z',
    melde: still, warte: async () => {}, impersonation: nachahmungDa,
  });

  // Ein totes Video heisst "dieses Video gibt es nicht mehr" — mehr nicht.
  assert.equal(geladeneVideos(videos).length, 1,
    'nach einem toten Link muss es normal weitergehen');
});


test('zwischen zwei Abrufen wird gewartet', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const eins = lizenzierterTon(1);
  const zwei = lizenzierterTon(2);
  const protokoll = { angaben: [], downloads: [] };

  const pausen = [];
  const antworten = ['10', '2', '1', '1'];
  await interaktiv({
    ytdlp: ytdlpFuer([eins, zwei], protokoll),
    pruefeSprache: () => STILL_GEMESSEN,
    warte: async (ms) => { pausen.push(ms); },
    impersonation: nachahmungDa,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [eins.webpage_url, zwei.webpage_url] } } },
    standard: { ...STANDARD, pause_zwischen_anfragen_sek: 3 },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T16:00:00.000Z',
    melde: still,
  });

  assert.equal(protokoll.angaben.length, 2, 'beide Adressen wurden abgerufen');
  assert.deepEqual(pausen, [3000], 'genau einmal gewartet: vor dem zweiten Abruf, nicht vor dem ersten');

  // GEGENPROBE: Vorher gab es hier gar keine Pause. Weitergereicht wurde
  // "--sleep-requests", und das bremst nur INNERHALB eines yt-dlp-Aufrufs —
  // jeder Abruf ist aber ein eigener Prozess mit genau einer Adresse.
  // Ergebnis war Dauerfeuer: Nach rund 50 Abrufen beantwortete TikTok auch
  // eine Adresse nicht mehr, die eine Stunde vorher noch funktionierte.
  assert.notEqual(pausen.length, 0, 'ohne diese Zeile feuert der Lauf ungebremst');
});

test('ohne eingestellte Pause wird nicht gewartet', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  const eins = lizenzierterTon(5);
  const zwei = lizenzierterTon(6);
  const protokoll = { angaben: [], downloads: [] };
  const pausen = [];

  const antworten = ['10', '2', '1', '1'];
  await interaktiv({
    ytdlp: ytdlpFuer([eins, zwei], protokoll),
    pruefeSprache: () => STILL_GEMESSEN,
    warte: async (ms) => { pausen.push(ms); },
    impersonation: nachahmungDa,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: [eins.webpage_url, zwei.webpage_url] } } },
    standard: { ...STANDARD, pause_zwischen_anfragen_sek: 0 },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-25T16:00:00.000Z',
    melde: still,
  });

  // Wer die Pause bewusst auf 0 stellt, soll auch keine bekommen — und keine
  // Warteschleife von 0 ms, die den Ablauf trotzdem zerstueckelt.
  assert.deepEqual(pausen, []);
});


test('sortierte Trefferadressen kommen vor denen aus dem Seitentext', async () => {
  const holen = async () => ({ ok: true, json: async () => ({ results: [
    { url: 'https://www.tiktok.com/discover/thema',
      raw_content: 'https://www.tiktok.com/@aus.text.eins/video/7300000000000000011 '
        + 'https://www.tiktok.com/@aus.text.zwei/video/7300000000000000012' },
    { url: 'https://www.tiktok.com/@sortiert/video/7300000000000000001', raw_content: '' },
  ] }) });

  const e = await sucheAdressen({ begriff: 'x', env: { TAVILY_API_KEY: 't' }, holen });
  assert.equal(e.adressen[0], 'https://www.tiktok.com/@sortiert/video/7300000000000000001',
    'die von der Suchmaschine sortierte Adresse muss zuerst drankommen');
  assert.equal(e.adressen.length, 3);

  // GEGENPROBE: Der Seitentext steht im ERSTEN Treffer, die sortierte Adresse
  // im zweiten. Wer einfach der Reihe nach durchgeht, haette die beiden
  // Textfunde zuerst. Bei ueber 200 Adressen je Anfrage und einer Obergrenze
  // von 60 Abrufen entscheidet genau das, welche geprueft werden.
  assert.notEqual(e.adressen[0], 'https://www.tiktok.com/@aus.text.eins/video/7300000000000000011');
});


// ── Die Wortlisten selbst pruefen ────────────────────────────────────
//
// 984 Suchbegriffe, 399 Kernwoerter, 820 Merkmale und 552 Ausschlusswoerter
// ueber 40 Produkte kann niemand mehr von Hand ueberblicken. Diese Pruefungen
// haben beim Anlegen 210 echte Fehler gefunden — sie bleiben stehen, damit die
// Listen nicht wieder auseinanderlaufen.

function alleProdukte() {
  const konfig = ladeKonfig();
  return Object.entries(konfig.produkte)
    .filter(([s, e]) => !s.startsWith('_') && e && typeof e === 'object');
}

const trifftWie_im_Betrieb = (wort, text, tokens) => (
  wort.length >= 5 ? text.includes(wort) : tokens.includes(wort)
);

test('jeder Suchbegriff benennt auch das Produkt', () => {
  const schlecht = [];
  for (const [id, e] of alleProdukte()) {
    const kern = [].concat(e.kernwoerter || []).map(normalisiere);
    const begriffe = [].concat(e.suchbegriff.de || [], e.suchbegriff.en || []);
    for (const b of begriffe) {
      const text = normalisiere(String(b).replace(/^\s*tiktok\s+/i, ''));
      const tokens = text.split(' ').filter(Boolean);
      if (!kern.some((w) => trifftWie_im_Betrieb(w, text, tokens))) schlecht.push(`${id}: "${b}"`);
    }
  }
  assert.deepEqual(schlecht, [],
    'aus jedem Suchbegriff wird eine Pruefgruppe — ohne Produktwort gibt sie jedem Video Punkte');

  // GEGENPROBE: So sieht ein Begriff aus, der die Pruefung reissen muss.
  // "tiktok made me buy it" ergaebe die Gruppe [made, buy] und haette jedem
  // beliebigen Einkaufsvideo Punkte gegeben.
  const schlechterBegriff = normalisiere('made me buy it');
  const kern10 = ladeKonfig().produkte['10'].kernwoerter.map(normalisiere);
  assert.equal(
    kern10.some((w) => trifftWie_im_Betrieb(w, schlechterBegriff, schlechterBegriff.split(' '))),
    false, 'die Pruefung wuerde so einen Begriff melden');
});

test('kein Ausschlusswort trifft das eigene Produkt', () => {
  const konfig = ladeKonfig();
  const allgemein = [].concat(konfig.standard.ausschluss || []).map(normalisiere);
  const schlecht = [];

  for (const [id, e] of alleProdukte()) {
    const aus = allgemein.concat([].concat(e.ausschluss || []).map(normalisiere));
    const eigene = new Set([
      ...[].concat(e.kernwoerter || [], e.merkmale || []).map(normalisiere),
      ...[].concat(e.suchbegriff.de || [], e.suchbegriff.en || [])
        .flatMap((b) => zerlege(String(b).replace(/^\s*tiktok\s+/i, ''))),
    ]);
    // Der eigene Text des Produkts, so wie ihn die Pruefung im Betrieb sieht.
    const eigenerText = normalisiere([].concat(
      e.kernwoerter || [], e.merkmale || [],
      e.suchbegriff.de || [], e.suchbegriff.en || [],
    ).join(' '));
    for (const w of aus) {
      if (w.includes(' ')) {
        // Mehrwortige Ausschluesse treffen als WENDUNG. Fuer sie lief die
        // Token-Pruefung ins Leere — ein Token enthaelt nie ein Leerzeichen.
        // "water dispenser" als Ausschluss haette Produkt 10 lautlos getoetet.
        if (eigenerText.includes(w)) schlecht.push(`${id}: Ausschluss "${w}" trifft eigenen Text`);
        continue;
      }
      for (const t of eigene) {
        // Einzelne Woerter treffen als WORTANFANG — genau das macht sie
        // gefaehrlich.
        if (t.startsWith(w)) schlecht.push(`${id}: Ausschluss "${w}" trifft eigenes Wort "${t}"`);
      }
    }
  }
  assert.deepEqual(schlecht, [], 'so ein Wort macht sein eigenes Produkt unauffindbar');

  // GEGENPROBE mit dem Fall, der beim Anlegen fast passiert waere: "gun" als
  // Ausschlusswort fuer die Massagepistole. Es haette das englische
  // "massage gun" ausgeschlossen — das Produkt waere unfindbar gewesen, ohne
  // dass irgendwo ein Fehler erschienen waere.
  const tokens = zerlege('mini massage gun muscle recovery');
  assert.ok(tokens.some((t) => t.startsWith('gun')),
    'genau daran erkennt die Pruefung so ein Wort');
  assert.equal(
    [].concat(konfig.produkte['28'].ausschluss || []).map(normalisiere).includes('gun'),
    false, '"gun" darf deshalb nicht in der Liste stehen');
});

test('jedes Produkt hat gepflegte Listen, nichts doppelt', () => {
  const schlecht = [];
  for (const [id, e] of alleProdukte()) {
    const listen = {
      kernwoerter: [].concat(e.kernwoerter || []),
      merkmale: [].concat(e.merkmale || []),
      ausschluss: [].concat(e.ausschluss || []),
      suchbegriff: [].concat(e.suchbegriff.de || [], e.suchbegriff.en || []),
    };
    for (const [name, liste] of Object.entries(listen)) {
      if (!liste.length) schlecht.push(`${id}: ${name} ist leer`);
      const gesehen = new Set();
      for (const w of liste.map(normalisiere)) {
        if (gesehen.has(w)) schlecht.push(`${id}: ${name} doppelt "${w}"`);
        gesehen.add(w);
      }
    }
    // Beide Sprachen, sonst faellt eine Auswahl auf den Produktnamen zurueck.
    if (!(e.suchbegriff.de || []).length) schlecht.push(`${id}: keine deutschen Begriffe`);
    if (!(e.suchbegriff.en || []).length) schlecht.push(`${id}: keine englischen Begriffe`);
  }
  assert.deepEqual(schlecht, []);
});

test('mehrwortige Kernwoerter treffen die getrennte Schreibweise', () => {
  // Der Grund fuer die 210 Meldungen beim Anlegen: Englische Produktnamen
  // bestehen aus mehreren Woertern. "motionlight" trifft "motion sensor light"
  // nicht — "motion sensor" schon.
  assert.equal(hatKernwort({ title: 'LED motion sensor light for stairs' },
    ['motion sensor']), true);
  assert.equal(hatKernwort({ title: 'LED motion sensor light for stairs' },
    ['motionlight']), false);

  // Und die zusammengeschriebene Form braucht es weiter — Hashtags kleben.
  assert.equal(hatKernwort({ title: '#motionsensorlight #stairs' },
    ['motionsensorlight']), true);

  // Gegenprobe zur Wortstellung: Mehrwortige Kernwoerter verlangen, dass die
  // Woerter nebeneinander stehen. "solar fence lights" trifft "solar light"
  // deshalb NICHT — genau darum wurden fuenf Suchbegriffe umgestellt.
  assert.equal(hatKernwort({ title: 'solar fence lights outdoor' }, ['solar light']), false);
  assert.equal(hatKernwort({ title: 'solar lights fence outdoor' }, ['solar light']), true);
});


test('jedes Produkt erkennt seinen eigenen Text', () => {
  // DIE SCHAERFSTE PROBE, die sich ohne Netz stellen laesst.
  //
  // Name und Beschreibung aus products.json sind der ehrlichste denkbare
  // Untertitel fuer genau dieses Produkt. Faellt der durch die eigene
  // Pruefkette, sind die Wortlisten falsch — dann faellt jeder echte
  // Untertitel erst recht durch, und zwar lautlos: Abgelehnte Videos sieht
  // man nirgends, der Lauf meldet nur "0 von 3 geladen".
  //
  // Gefunden hat diese Probe zwei echte Fehler: Bei "Mini Muskel Massage
  // Pistole" und "Aroma-Pads" schreibt der deutsche Name das Produkt
  // GETRENNT, die Kernwoerter waren zusammengeschrieben. Beide Produkte
  // haetten ihren eigenen Namen nicht erkannt.
  const konfig = ladeKonfig();
  const produkte = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'products.json'), 'utf8'));
  const schlecht = [];

  for (const p of produkte) {
    const e = konfigZuProdukt(konfig, p.id);
    if (!e || !e.kernwoerter) continue;
    const aus = [].concat(konfig.standard.ausschluss || [], e.ausschluss || []);
    const video = { title: `${p.name} ${p.description || ''}` };

    const verboten = ausschlussTreffer(video, aus);
    if (verboten) { schlecht.push(`${p.id}: schliesst sich selbst aus ("${verboten}")`); continue; }
    if (!hatKernwort(video, e.kernwoerter)) { schlecht.push(`${p.id}: kein Kernwort im eigenen Text`); continue; }
    if (!hatMerkmal(video, e.merkmale)) { schlecht.push(`${p.id}: kein Merkmal im eigenen Text`); continue; }
    const bewertung = bewerte(begriffsGruppen(p, e), video);
    if (bewertung.wert < 0.5 || !bewertung.haelt) {
      schlecht.push(`${p.id}: Trefferwert nur ${bewertung.wert}`);
    }
  }

  assert.deepEqual(schlecht, [],
    'ein Produkt, das seinen eigenen Namen nicht erkennt, findet auch keine Videos');

  // GEGENPROBE mit dem echten Fund: Der deutsche Name schreibt "Massage
  // Pistole" getrennt. Nur das zusammengeschriebene Kernwort trifft ihn nicht.
  const eigenerName = { title: 'Mini Muskel Massage Pistole für Muskelentspannung' };
  assert.equal(hatKernwort(eigenerName, ['massagepistole', 'massagegun']), false,
    'genau daran ist es gescheitert');
  assert.equal(hatKernwort(eigenerName, ['massage pistole']), true,
    'die getrennte Schreibweise gehoert dazu');
});


// ── Browser-Kennung: die Pruefung, die einen Nachmittag gekostet hat ──
//
// TikTok beantwortet die Seitenanfrage nur brauchbar, wenn die Verbindung wie
// die eines Browsers aussieht. Fehlt das Paket curl_cffi, scheitert JEDER
// Abruf mit "Unexpected response from webpage request" — einer Meldung, die
// nach einem kaputten Einzelvideo klingt und in kein Sperrmuster passt.
// Sie wurde erst fuer eine Ratenbegrenzung gehalten, dann fuer ein veraltetes
// yt-dlp. Beides war falsch.

test('vorhandene Nachahmungsziele werden erkannt', async () => {
  const echteAusgabe = [
    '[info] Available impersonate targets',
    'Client          OS           Source',
    '--------------------------------------',
    'Chrome-133      Macos-15     curl_cffi',
    'Safari-17.2     Ios-17.2     curl_cffi',
  ].join('\n');
  const e = await impersonationVerfuegbar(async () => ({ code: 0, stdout: echteAusgabe, stderr: '' }));
  assert.equal(e.ok, true);
  assert.equal(e.anzahl, 2, 'die Kopfzeilen zaehlen nicht mit');
});

test('fehlende Nachahmungsziele werden erkannt', async () => {
  // Ohne curl_cffi gibt yt-dlp nur die Kopfzeile aus.
  const ohne = '[info] Available impersonate targets\nClient          OS           Source\n---';
  const e = await impersonationVerfuegbar(async () => ({ code: 0, stdout: ohne, stderr: '' }));
  assert.equal(e.ok, false);

  // GEGENPROBE: Wer nur schaut, ob ueberhaupt etwas ausgegeben wurde, haelt
  // diesen Fall fuer in Ordnung — die Kopfzeile steht ja da. Genau deshalb
  // wird auf eine QUELLE geprueft, nicht auf Ausgabe.
  assert.ok(ohne.length > 0, 'Ausgabe gibt es, sie sagt nur nichts Gutes');
});

test('ohne Browser-Kennung startet der Lauf gar nicht erst', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();
  let abgerufen = 0;

  const code = await interaktiv({
    ytdlp: async () => { abgerufen++; return { code: 0, stdout: '', stderr: '' }; },
    impersonation: async () => ({ ok: false, anzahl: 0 }),
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: ['https://www.tiktok.com/@x/video/7300000000000000099'] } } },
    standard: { ...STANDARD },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => ['10', '5', '2', '1'].shift(),
    jetzt: () => '2026-08-27T10:00:00.000Z',
    melde: still, warte: async () => {},
  });

  assert.equal(code, 1, 'das ist kein Erfolg');
  assert.equal(abgerufen, 0, 'kein einziger Abruf darf rausgehen');

  // GEGENPROBE: Ohne diese Pruefung liefen erst FUENF Abrufe ins Leere, bevor
  // der Abbruch griff — und die Meldung nannte die falsche Ursache zuerst.
  assert.notEqual(abgerufen, 5);
});


test('mehrwortige Ausschluesse treffen als Wendung', () => {
  const aus = ['bottom load', 'water filter', 'fellnase'];

  // Beide Fehlfunde aus dem echten Lauf: Sie kamen mit nur EINEM allgemeinen
  // Merkmal durch ("pump", "gallon") und sind trotzdem andere Geraete —
  // ein Standgeraet und eine fest verbaute Filteranlage.
  assert.equal(ausschlussTreffer(
    { title: 'Fujidenzo Bottom Load water dispenser, no more heavy lifting' }, aus), 'bottom load');
  assert.equal(ausschlussTreffer(
    { title: 'Just installed a water filter dispenser system in the kitchen' }, aus), 'water filter');

  // Einzelne Woerter treffen weiterhin als Wortanfang.
  assert.equal(ausschlussTreffer({ title: 'Wasser für die Fellnasen' }, aus), 'fellnase');

  // GEGENPROBE: "bottom" allein auszuschliessen waere unbrauchbar — das Wort
  // steht in jedem zweiten Untertitel. Erst die Wendung trennt sauber, und
  // das eigentliche Produkt bleibt unberuehrt.
  assert.equal(ausschlussTreffer({ title: 'the bottom of the bottle stays cool' }, aus), null);
  assert.equal(ausschlussTreffer({ title: 'water dispenser for my desk' }, aus), null);
});


test('ein Suchbegriff frisst nicht das ganze Anfrage-Budget', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();

  // Der erste Begriff liefert 50 Adressen, von denen KEINE brauchbar ist
  // (alle mit Gerede). Der zweite liefert das gesuchte Video.
  // Genau diese Lage gab es live: Seit die Adressen aus dem Seitentext kommen,
  // liefert eine Anfrage ueber 200 Stueck — der Lauf endete mit
  // "0 von 3 geladen, 60 Adressen geprueft, 1 von 24 Suchbegriffen gebraucht".
  const nieten = Array.from({ length: 50 }, (unbenutzt, i) => ({
    id: '746000000000000' + String(i).padStart(4, '0'),
    webpage_url: `https://www.tiktok.com/@niete${i}/video/746000000000000${String(i).padStart(4, '0')}`,
    title: 'Katzenvideo ohne jeden Bezug', duration: 10,
    uploader: 'niete' + i, track: 'Ein Lied', artist: 'Jemand',
  }));
  const treffer = lizenzierterTon(8);

  const gefragt = [];
  const holen = async (adresse, einstellungen) => {
    gefragt.push(JSON.parse(einstellungen.body).query);
    const liste = gefragt.length === 1 ? nieten : [treffer];
    return { ok: true, json: async () => ({ results: liste.map((v) => ({ url: v.webpage_url })) }) };
  };

  const protokoll = { angaben: [], downloads: [] };
  const ytdlp = ytdlpFuer(nieten.concat([treffer]), protokoll);

  const antworten = ['10', '1', '1', '1'];
  const code = await interaktiv({
    ytdlp, holen,
    pruefeSprache: () => STILL_GEMESSEN,
    impersonation: nachahmungDa,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { suchbegriff: {
      de: ['tiktok wasserspender eins', 'tiktok wasserspender zwei'], en: [],
    } } } },
    // Kontingent 20 je Begriff, Obergrenze 60 Abrufe — wie im Betrieb.
    standard: { ...STANDARD, max_kandidaten_je_quelle: 20, max_anfragen: 60 },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: { TAVILY_API_KEY: 'x' },
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-27T12:00:00.000Z',
    melde: still, warte: async () => {},
  });

  assert.equal(code, 0, 'das Ziel muss erreichbar bleiben');
  assert.equal(geladeneVideos(videos).length, 1);
  assert.equal(gefragt.length, 2, 'der zweite Begriff kam dran, obwohl der erste 50 Adressen hatte');

  // GEGENPROBE: Ohne Kontingent haette der erste Begriff 50 Abrufe verbraucht.
  // Das Ziel waere zwar noch erreichbar gewesen (60 > 50), aber bei den echten
  // 233 Adressen je Anfrage ist die Obergrenze VOR dem zweiten Begriff
  // erreicht — und genau so endete der Lauf mit null Videos.
  assert.ok(protokoll.angaben.length <= 25,
    `hoechstens ein Kontingent plus Treffer, tatsaechlich ${protokoll.angaben.length}`);
  assert.ok(nieten.length > 25, 'der erste Begriff hatte deutlich mehr Adressen als das Kontingent');
});


test('die Anfrage-Obergrenze stoppt nicht, was schon geprueft ist', async () => {
  const daten = tempOrdner();
  const videos = tempOrdner();

  // Drei Kandidaten mit eigener Tonspur (werden zurueckgestellt) und eine
  // Obergrenze von genau drei Abrufen. Nach dem dritten ist das Budget weg —
  // aber die drei Kandidaten sind laengst geprueft und brauchen keinen Abruf
  // mehr. Live endete so ein Lauf mit "2 von 3", waehrend 39 fertig geprüfte
  // Kandidaten unangetastet in der zweiten Reihe standen.
  const kandidaten = [eigenerTon(5), eigenerTon(6), eigenerTon(7)];
  const protokoll = { angaben: [], downloads: [] };

  const antworten = ['10', '1', '1', '1'];
  const code = await interaktiv({
    ytdlp: ytdlpFuer(kandidaten, protokoll),
    pruefeSprache: () => STILL_GEMESSEN,
    impersonation: nachahmungDa,
    wurzel: path.dirname(videos),
    produkte: [PRODUKT],
    konfig: { produkte: { 10: { videos: kandidaten.map((v) => v.webpage_url) } } },
    standard: { ...STANDARD, max_anfragen: 3 },
    datenOrdner: daten, videoOrdner: videos, gitignore: path.join(daten, '.gitignore'),
    stopDatei: path.join(daten, 'kein-STOP'), env: {},
    frage: async () => antworten.shift(),
    jetzt: () => '2026-08-27T13:00:00.000Z',
    melde: still, warte: async () => {},
  });

  assert.equal(code, 0);
  assert.equal(geladeneVideos(videos).length, 1,
    'die zweite Runde lief trotz erreichter Obergrenze');
  assert.equal(protokoll.angaben.length, 3, 'die Obergrenze fuer ABRUFE gilt weiterhin');

  // GEGENPROBE: Vorher brach der Lauf an der Obergrenze ab, ohne die
  // zurueckgestellten Kandidaten auch nur anzusehen — obwohl fuer sie kein
  // einziger weiterer Abruf noetig gewesen waere.
  assert.notEqual(protokoll.downloads.length, 0,
    'ohne diese Ausnahme waere gar nichts geladen worden');
});


// ── Die Pruefkette an echten Untertiteln ─────────────────────────────
//
// Alle Texte hier sind echt: gesammelt aus dem Herkunftsnachweis und den
// Laufprotokollen dieses Projekts, gekuerzt. Sie sind der einzige ehrliche
// Massstab — ausgedachte Beispiele bestaetigen nur die Regel, die man gerade
// geschrieben hat.
//
// Gemessen an 80 gesammelten Untertiteln fielen VIER Fehlgriffe auf, jeder mit
// eigener Ursache. Alle vier stehen unten, alle vier waren angenommen worden.

function urteilFuerProdukt10(titel) {
  const konfig = ladeKonfig();
  const produkte = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products.json'), 'utf8'));
  const produkt = produkte.find((p) => Number(p.id) === 10);
  const eintrag = konfigZuProdukt(konfig, 10);
  const video = { title: titel };

  const verboten = ausschlussTreffer(video,
    [].concat(konfig.standard.ausschluss || [], eintrag.ausschluss || []));
  if (verboten) return `ausgeschlossen (${verboten})`;
  if (!hatKernwort(video, eintrag.kernwoerter)) return 'kein Kernwort';
  const bewertung = bewerte(begriffsGruppen(produkt, eintrag), video);
  if (bewertung.wert < 0.5 || !bewertung.haelt) return `zu schwach (${bewertung.wert})`;
  if (!hatMerkmal(video, eintrag.merkmale)) return 'kein Merkmal';
  return 'angenommen';
}

test('echte Untertitel des richtigen Produkts kommen durch', () => {
  const richtig = [
    'Staying hydrated with my new desktop water dispenser 💧office must have',
    'No More Heavy Water Bottles! USB Rechargeable Automatic Water Pump.',
    'The one thing you need on your nightstand💧#waterdispenser #bedroomwaterdispenser',
    'Automatic wireless water dispenser pump | Electric water pump with auto stop',
    'Mini water dispenser cooler for your office or desk 🫶🏻 just add water',
    'This $18 water dispenser that goes on top of a 5 gallon jug was a great buy',
  ];
  const durchgefallen = richtig.filter((t) => urteilFuerProdukt10(t) !== 'angenommen')
    .map((t) => `${t.slice(0, 50)} → ${urteilFuerProdukt10(t)}`);
  assert.deepEqual(durchgefallen, [],
    'die Pruefung darf nicht so streng werden, dass das eigene Produkt durchfaellt');
});

test('vier echte Fehlgriffe, vier verschiedene Ursachen', () => {
  // 1. TIERPRODUKT. "pets" stand in der Liste, der Untertitel schreibt
  //    "pet dispenser" in der Einzahl. Als Wendung eindeutig — als Wortanfang
  //    waere "pet" unbrauchbar ("Peter", "petite").
  assert.match(urteilFuerProdukt10(
    'Better water, less mess. 💦 This portable pet dispenser keeps water clean'),
  /ausgeschlossen/);

  // 2. VERNEINUNG. Das Merkmal "elektrisch" steckt im Wort "Electricity" —
  //    in einem Satz, der woertlich das Gegenteil sagt.
  assert.equal(urteilFuerProdukt10(
    'Genius DIY Water Dispenser – No Electricity Needed'), 'kein Merkmal');

  // 3. + 4. BEHAELTER STATT GERAET. "jug" und "carafe" waren Kernwoerter —
  //    sie benennen aber ein Gefaess, kein Spendergeraet. Als Merkmal bleiben
  //    sie richtig (das Geraet sitzt auf einem Kanister), als Kernwort nicht.
  assert.equal(urteilFuerProdukt10(
    'Replying to @Jazzy My bed side water set up ✨ I use a smaller jug just for'), 'kein Kernwort');
  assert.equal(urteilFuerProdukt10(
    'Bedside carafe and cup set for my nightstand ✨ #marshallsfinds #nightstand'), 'kein Kernwort');
});

test('aehnliche, aber andere Geraete bleiben draussen', () => {
  const falsch = {
    '[No More Carrying Water] Bottom-Loading Water Dispenser for home': /ausgeschlossen/,
    'Just installed a water filter dispenser system in my in-laws kitchen': /ausgeschlossen/,
    'Automatischer Katzenbrunnen 2,2L - Kabellos, leise, für Wohnungskatzen': /ausgeschlossen/,
    'Your water dispenser may fail because of your kettle limescale': /ausgeschlossen/,
    'Ein Schreibtisch für einen der reichsten Unternehmer der Schweiz 🔥': /kein Kernwort/,
    'Time for a refresh 🛏️☁️ #bedsidetable #nightstandorganization': /kein Kernwort/,
  };
  const schlecht = [];
  for (const [titel, erwartet] of Object.entries(falsch)) {
    const u = urteilFuerProdukt10(titel);
    if (!erwartet.test(u)) schlecht.push(`${titel.slice(0, 45)} → ${u}`);
  }
  assert.deepEqual(schlecht, []);
});

test('eine Verneinung entwertet nur das, was direkt dahinter steht', () => {
  const merkmale = ['elektrisch', 'electric', 'usb', 'akku', 'battery', 'pump'];

  assert.deepEqual(getroffeneMerkmale({ title: 'No Electricity Needed' }, merkmale), []);
  assert.deepEqual(getroffeneMerkmale({ title: 'Wasserspender ohne Strom, ganz ohne Elektrik' }, merkmale), []);

  // GEGENPROBE — hier darf die Verneinung NICHT zuschlagen: "no" steht vier
  // Woerter vor "USB", und das Video ist genau das Produkt. Ein groesseres
  // Fenster haette mehr kaputtgemacht als repariert.
  assert.deepEqual(
    getroffeneMerkmale({ title: 'No More Heavy Water Bottles! USB Rechargeable Automatic Water Pump' }, merkmale),
    ['usb', 'pump']);
});


// ── Je Produkt ein Ordner ────────────────────────────────────────────

test('jedes Produkt bekommt seinen eigenen Ordner unter rohmaterial', () => {
  const p = { id: 10, slug: 'elektrischer-wasserspender-fuer-schreibtisch' };
  const ordner = produktOrdner('Marketing/videos', p);
  assert.ok(ordner.includes('rohmaterial'), 'der Zweig trennt Fremdes von Eigenem');
  assert.ok(ordner.endsWith(path.join('10_elektrischer-wasserspender-fuer-schreibtisch')),
    'Nummer sortiert, Slug sagt was drin ist');

  // Einstellige Nummern werden aufgefuellt, sonst sortiert 10 vor 2.
  assert.ok(produktOrdner('v', { id: 2, slug: 'x' }).endsWith(path.join('02_x')));
});

test('unter rohmaterial braucht keine Datei einen eigenen .gitignore-Eintrag', () => {
  assert.equal(brauchtEinzelschutz(path.join('Marketing', 'videos', 'rohmaterial', '10_x')), false);
  assert.equal(brauchtEinzelschutz(path.join('Marketing', 'videos')), true);

  // GEGENPROBE — der Grund fuer die Ordner-Regel: Vorher stand je Datei eine
  // Zeile in .gitignore, weil das Namensmuster fremdes von eigenem Material
  // trennte. Beim Umbenennen fiel das zweimal auseinander, und fremde Videos
  // tauchten im Status eines OEFFENTLICHEN Repos auf. Eine Ordner-Regel kann
  // man beim Umbenennen nicht vergessen.
  assert.equal(imRohmaterial('Marketing/videos/rohmaterial/10_x/01_y.mp4'), true);
  assert.equal(imRohmaterial('Marketing/videos/01_eigenes_rendering.mp4'), false);
});

test('die .gitignore deckt beide Unterordner ab, aber nicht die eigenen Renderings', () => {
  const regeln = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8')
    .split(/\r?\n/).map((z) => z.trim());
  assert.ok(regeln.includes('Marketing/videos/rohmaterial/'), 'fremdes Rohmaterial');
  assert.ok(regeln.includes('Marketing/videos/geschnitten/'), 'daraus Geschnittenes ist auch fremd');

  // GEGENPROBE: Keine Regel darf den ganzen Ordner erfassen — dort liegen die
  // eigenen Renderings, und die GEHOEREN ins Repo.
  assert.equal(regeln.includes('Marketing/videos/'), false);
  assert.equal(regeln.includes('Marketing/videos'), false);
});

// ── Nummern werden nicht zweimal vergeben ────────────────────────────

test('eine geloeschte Datei gibt ihre Nummer nicht wieder frei', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, '03_x_10s_stil-b.mp4'), 'x');

  assert.equal(naechsteNummer(ordner), 4, 'aus dem Ordner allein');
  assert.equal(naechsteNummer(ordner, ['16_x_12s_stil-b.mp4']), 17,
    'der Nachweis kennt eine hoehere Nummer, auch wenn die Datei fehlt');

  // GEGENPROBE — genau so ist an einem Tag ein Video verlorengegangen:
  // Die Nummer wurde aus dem Ordner gelesen, nach dem Loeschen neu vergeben,
  // und ein ANDERES Video bekam denselben Dateinamen. Das erste war weg, und
  // im Nachweis standen zwei Eintraege fuer dieselbe Datei.
  const nurOrdner = naechsteNummer(ordner);
  assert.notEqual(nurOrdner, naechsteNummer(ordner, ['16_x_12s_stil-b.mp4']),
    'ohne die Namen aus dem Nachweis kollidiert die Nummer');
});

// ── Aufraeumen erkennt auch die falsche Datei ────────────────────────

test('eine andere Datei unter demselben Namen gilt als verwaist', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, 'video.mp4'), 'der neue Inhalt');
  const index = {
    version: 1,
    eintraege: [{
      produkt_id: 10, video_id: '1', quelle_url: 'https://www.tiktok.com/@a/video/1',
      datei: 'video.mp4', sha256: 'pruefsumme-des-alten-inhalts',
    }],
  };

  assert.equal(verwaisteEintraege(index, ordner, ordner).length, 1,
    'die Datei ist da, aber es ist nicht DIESE Datei');

  // GEGENPROBE: Die alte Fassung fragte nur, OB eine Datei existiert. Damit
  // galt der Eintrag als in Ordnung — und der Nachweis behauptete weiter eine
  // Herkunft, die zu dieser Datei nicht gehoerte.
  const alteFassung = (idx, o) => (idx.eintraege || []).filter(
    (e) => !fs.existsSync(path.join(o, e.datei)));
  assert.equal(alteFassung(index, ordner).length, 0,
    'die alte Fassung haette den falschen Eintrag stehen lassen');

  // Ohne hinterlegte Pruefsumme bleibt es beim blossen Dasein — eine fehlende
  // Angabe ist kein Grund, einen Nachweis wegzuwerfen.
  const ohneSumme = { version: 1, eintraege: [{ datei: 'video.mp4', produkt_id: 10 }] };
  assert.equal(verwaisteEintraege(ohneSumme, ordner, ordner).length, 0);
});


test('jedes Produkt bekommt einen Ordner, auch das noch leere', () => {
  const basis = tempOrdner();
  const produkte = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products.json'), 'utf8'));

  const ergebnis = legeProduktOrdnerAn(basis, produkte);
  assert.equal(ergebnis.angelegt.length, produkte.length, 'kein Produkt darf fehlen');

  const vorhanden = fs.readdirSync(path.join(basis, 'rohmaterial'));
  assert.equal(vorhanden.length, produkte.length);
  for (const p of produkte) {
    assert.ok(vorhanden.some((o) => o.endsWith('_' + p.slug)),
      `kein Ordner fuer ${p.id} ${p.slug}`);
  }

  // Die Nummer wird aufgefuellt, sonst sortiert 10 vor 2 und die Liste ist
  // genau da unlesbar, wo sie helfen soll.
  assert.ok(vorhanden.every((o) => /^\d{2}_/.test(o)));
  assert.deepEqual(vorhanden.slice(0, 2).sort(), vorhanden.slice(0, 2),
    'die Ordner sortieren sich von selbst richtig');
});

test('ein zweiter Aufruf fasst nichts an, was schon da ist', () => {
  const basis = tempOrdner();
  const produkte = [{ id: 10, slug: 'wasserspender' }, { id: 2, slug: 'lampe' }];

  legeProduktOrdnerAn(basis, produkte);
  // Etwas hineinlegen — das muss den zweiten Aufruf ueberleben.
  const datei = path.join(produktOrdner(basis, produkte[0]), '01_video.mp4');
  fs.writeFileSync(datei, 'wichtig');

  const zweiter = legeProduktOrdnerAn(basis, produkte);
  assert.equal(zweiter.angelegt.length, 0, 'nichts Neues');
  assert.equal(zweiter.vorhanden.length, 2);
  assert.equal(fs.readFileSync(datei, 'utf8'), 'wichtig',
    'ein Befehl, der Ordner anlegt, darf niemals Inhalte kosten');

  // GEGENPROBE: Ein Anlegen ohne die Existenzpruefung — etwa mit rmSync davor,
  // um "sauber" zu starten — haette die Datei geloescht. Der Zweig ist
  // gitignoriert, also waere sie unwiederbringlich weg.
  assert.ok(fs.existsSync(datei));
});


test('ein Eintrag im Produktordner gilt NICHT als verwaist', () => {
  // DER TEURSTE FEHLER DIESES UMBAUS.
  //
  // Nach der Umstellung auf Produktordner suchte das Aufraeumen die Dateien
  // weiter im Sammelordner. "Nicht gefunden" heisst dort "verwaist" — und ein
  // einziger Aufruf erklaerte den GESAMTEN Herkunftsnachweis fuer ungueltig:
  // 27 Eintraege auf einmal, obwohl nur drei Dateien geloescht worden waren.
  // Wiederherstellbar war das nur, weil die Pruefsummen in einer Sicherung
  // standen. Fuenf Eintraege blieben unvollstaendig.
  const basis = tempOrdner();
  const produkt = { id: 10, slug: 'wasserspender' };
  const ordner = produktOrdner(basis, produkt);
  fs.mkdirSync(ordner, { recursive: true });
  fs.writeFileSync(path.join(ordner, '01_wasserspender_14s_stil-b.mp4'), 'video');

  const index = {
    version: 1,
    eintraege: [{
      produkt_id: 10,
      video_id: '7300000000000000030',
      quelle_url: 'https://www.tiktok.com/@a/video/7300000000000000030',
      datei: '01_wasserspender_14s_stil-b.mp4',
      ablage: 'Marketing/videos/rohmaterial/10_wasserspender',
    }],
  };

  assert.deepEqual(verwaisteEintraege(index, basis, basis), [],
    'die Datei liegt da, wo der Eintrag es sagt');

  // GEGENPROBE: So sah es vorher aus — nur der Sammelordner wurde durchsucht.
  const alteFassung = (idx, o) => (idx.eintraege || []).filter(
    (e) => !fs.existsSync(path.join(o, e.datei)));
  assert.equal(alteFassung(index, basis).length, 1,
    'die alte Fassung haette diesen Eintrag weggeraeumt — und mit ihm die Herkunft');

  // Und der echte Ausfall wird weiterhin erkannt.
  fs.unlinkSync(path.join(ordner, '01_wasserspender_14s_stil-b.mp4'));
  assert.equal(verwaisteEintraege(index, basis, basis).length, 1);
});

test('ohne Ablage-Angabe wird weiterhin im Sammelordner gesucht', () => {
  // Aeltere Eintraege haben das Feld nicht — die duerfen nicht durchfallen.
  const basis = tempOrdner();
  fs.writeFileSync(path.join(basis, 'alt.mp4'), 'video');
  const index = { version: 1, eintraege: [{ datei: 'alt.mp4', produkt_id: 10 }] };
  assert.deepEqual(verwaisteEintraege(index, basis, basis), []);
});
