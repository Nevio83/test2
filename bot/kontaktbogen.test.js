/**
 * Tests fuer den Kontaktbogen.
 *
 * Was hier abgesichert wird, ist nicht die Schoenheit des Blattes, sondern die
 * Stellen, an denen es LAUTLOS falsch wird:
 *
 *   * Ein Blatt, das Videos zeigt, die es nicht mehr gibt (Eintraege aus
 *     `frueher_geladen`), sieht aus wie ein voller Vorrat.
 *   * Standbilder, die bei jedem Aufruf neu gezogen werden, machen das
 *     Programm bei 23 Clips unbenutzbar — und man merkt es nur an der Uhr.
 *   * Ein Untertitel mit `<script>` darin ist in einer HTML-Datei kein
 *     Schoenheitsfehler. Das Material stammt von Fremden.
 *   * Ein 480p-Querformat-Clip, der auf dem Blatt aussieht wie jeder andere,
 *     ist genau der Fall, fuer den es das Blatt gibt.
 *
 * Kein ffmpeg noetig: Die Aufrufe laufen durch zwei Funktionen, und die werden
 * hier durch Nachbauten ersetzt.
 *
 * Projektregel aus CLAUDE.md §2: Ein Test, der nur gruen werden kann, ist
 * wertlos. Zu jeder Pruefung steht darum eine Gegenprobe daneben, die das alte
 * bzw. falsche Verhalten nachbildet und belegt, dass der Test es rot gemeldet
 * haette.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  medienInfo, formatWort, ziehStandbilder, eintraegeMitDatei,
  baueBlatt, baueBoegen, baueEntwurf, leseArgumente, schuetzeHtml,
  szenenAusAusgabe, waehleAusschnitt,
  MARKEN, BILDER_ORDNER,
} = require('./kontaktbogen');

// ── Hilfen ───────────────────────────────────────────────────────────

function tempOrdner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kontaktbogen-test-'));
}

const EINTRAG = {
  produkt_id: 10,
  produkt_name: 'Elektrischer Wasserspender für Schreibtisch',
  video_id: '7300000000000000001',
  quelle_url: 'https://www.tiktok.com/@buerokram/video/7300000000000000001',
  creator: '@buerokram',
  titel: 'Wasserspender am Schreibtisch',
  datei: '10_7300000000000000001.mp4',
  trefferwert: 1,
  rechte_geprueft: false,
};

/** Ein ffmpeg-Nachbau, der Dateien anlegt und mitzaehlt, wie oft er lief. */
function ffmpegNachbau({ schreibt = true } = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    lauf(_werkzeug, argumente) {
      aufrufe.push(argumente);
      if (!schreibt) return;
      const ziel = argumente[argumente.length - 1];
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.writeFileSync(ziel, 'JPEGDATEN');
    },
  };
}

// ── formatWort ───────────────────────────────────────────────────────

test('formatWort trennt hoch, quer und quadratisch', () => {
  assert.strictEqual(formatWort(1080, 1920), 'hoch');
  assert.strictEqual(formatWort(1920, 1080), 'quer');
  assert.strictEqual(formatWort(1080, 1080), 'quadratisch');
  // Fehlende Angaben duerfen nicht als "hoch" durchgehen: Ein Clip ohne
  // Medienangaben ist unbekannt, nicht brauchbar.
  assert.strictEqual(formatWort(0, 0), 'unbekannt');
});

test('Gegenprobe: ohne Seitenverhaeltnis-Pruefung waere Querformat unsichtbar', () => {
  // So sah es aus, als das Blatt nur Bilder zeigte: Jeder Clip ist gleich.
  const naiv = () => 'egal';
  assert.strictEqual(naiv(1920, 1080), naiv(1080, 1920));
  // Mit Pruefung faellt der Unterschied auf — genau darum geht es.
  assert.notStrictEqual(formatWort(1920, 1080), formatWort(1080, 1920));
});

// ── eintraegeMitDatei ────────────────────────────────────────────────

test('nur Eintraege mit vorhandener Datei kommen aufs Blatt', () => {
  const ordner = tempOrdner();
  const da = path.join(ordner, EINTRAG.datei);
  fs.writeFileSync(da, 'VIDEODATEN');

  const index = {
    version: 1,
    eintraege: [
      EINTRAG,
      { ...EINTRAG, video_id: '999', datei: '10_999.mp4' },   // Datei fehlt
    ],
  };

  const treffer = eintraegeMitDatei(index, null, ordner);
  assert.strictEqual(treffer.length, 1);
  assert.strictEqual(treffer[0].eintrag.video_id, '7300000000000000001');
});

test('frueher_geladen kommt NICHT aufs Blatt', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, EINTRAG.datei), 'VIDEODATEN');

  const index = {
    version: 1,
    eintraege: [EINTRAG],
    // Aufgeraeumte Eintraege: Die Datei ist weg, der Nachweis bleibt.
    frueher_geladen: [{ produkt_id: 10, video_id: '888', quelle_url: 'https://x/888' }],
  };

  const treffer = eintraegeMitDatei(index, null, ordner);
  assert.strictEqual(treffer.length, 1, 'aufgeraeumte Eintraege gehoeren nicht aufs Blatt');
});

test('Gegenprobe: wer beide Listen liest, zeigt Videos, die es nicht gibt', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, EINTRAG.datei), 'VIDEODATEN');
  const index = {
    version: 1,
    eintraege: [EINTRAG],
    frueher_geladen: [{ produkt_id: 10, video_id: '888', datei: '10_888.mp4' }],
  };

  // Das falsche Verhalten: beide Listen zusammenwerfen.
  const falsch = [].concat(index.eintraege, index.frueher_geladen);
  assert.strictEqual(falsch.length, 2);
  // Der Vorrat saehe doppelt so gross aus, wie er ist.
  assert.notStrictEqual(falsch.length, eintraegeMitDatei(index, null, ordner).length);
});

test('eine 0-Byte-Datei zaehlt nicht als vorhandenes Video', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, EINTRAG.datei), '');   // 0 Byte

  // Genau der Fall aus dem Marketing-Automaten: neun MP4-Dateien mit 0 Byte,
  // die aussahen wie fertige Arbeit. Im Ordner sieht man den Unterschied nicht.
  const treffer = eintraegeMitDatei({ version: 1, eintraege: [EINTRAG] }, null, ordner);
  assert.strictEqual(treffer.length, 0);
});

// ── ziehStandbilder ──────────────────────────────────────────────────

test('zieht vier Standbilder, und beim zweiten Lauf keines mehr', () => {
  const ordner = tempOrdner();
  const video = path.join(ordner, 'clip.mp4');
  fs.writeFileSync(video, 'VIDEODATEN');
  const bilderOrdner = path.join(ordner, BILDER_ORDNER);

  const nachbau = ffmpegNachbau();
  const echterSpawn = require('child_process').spawnSync;
  require('child_process').spawnSync = (werkzeug, argumente) => {
    nachbau.lauf(werkzeug, argumente);
    return { status: 0, stdout: '' };
  };

  try {
    const erste = ziehStandbilder('ffmpeg', video, bilderOrdner, 'clip', 20);
    assert.strictEqual(erste.length, MARKEN.length);
    assert.strictEqual(nachbau.aufrufe.length, MARKEN.length);

    // Zweiter Lauf: Die Bilder liegen schon da — ffmpeg darf nicht noch einmal
    // starten. Bei 23 Clips ist das der Unterschied zwischen brauchbar und
    // "dauert jedes Mal wieder Minuten".
    const zweite = ziehStandbilder('ffmpeg', video, bilderOrdner, 'clip', 20);
    assert.strictEqual(zweite.length, MARKEN.length);
    assert.strictEqual(nachbau.aufrufe.length, MARKEN.length, 'vorhandene Bilder wurden neu gezogen');

    // Mit --neu ausdruecklich doch.
    ziehStandbilder('ffmpeg', video, bilderOrdner, 'clip', 20, { neuBauen: true });
    assert.strictEqual(nachbau.aufrufe.length, MARKEN.length * 2);
  } finally {
    require('child_process').spawnSync = echterSpawn;
  }
});

test('erzeugt kein Standbild bei 0 % — das erste Bild ist oft schwarz', () => {
  // Die Marken beginnen bewusst bei 10 %. Ein schwarzes Vorschaubild sagt
  // ueber den Clip nichts, und genau dafuer gibt es das Blatt.
  assert.ok(MARKEN.every((m) => m > 0), 'keine Marke darf bei 0 liegen');
  assert.ok(MARKEN.every((m) => m < 1), 'keine Marke darf am Dateiende liegen');
});

test('meldet fehlende Bilder, statt Erfolg zu behaupten', () => {
  const ordner = tempOrdner();
  const video = path.join(ordner, 'clip.mp4');
  fs.writeFileSync(video, 'VIDEODATEN');

  const echterSpawn = require('child_process').spawnSync;
  // ffmpeg meldet Erfolg, schreibt aber nichts — real bei einem Sprung hinter
  // das Dateiende. Dem Rueckgabewert zu glauben hiesse: vier Bilder gemeldet,
  // null vorhanden, und im Blatt stehen kaputte Verweise.
  require('child_process').spawnSync = () => ({ status: 0, stdout: '' });

  try {
    const bilder = ziehStandbilder('ffmpeg', video, path.join(ordner, BILDER_ORDNER), 'clip', 20);
    assert.strictEqual(bilder.length, 0, 'ohne Datei darf kein Bild gemeldet werden');
  } finally {
    require('child_process').spawnSync = echterSpawn;
  }
});

// ── HTML ─────────────────────────────────────────────────────────────

test('fremder Text wird entschaerft', () => {
  const boese = '<script>alert(1)</script> & "Anführung"';
  const sicher = schuetzeHtml(boese);
  assert.ok(!sicher.includes('<script>'));
  assert.ok(sicher.includes('&lt;script&gt;'));
  assert.ok(sicher.includes('&amp;'));
  assert.ok(sicher.includes('&quot;'));
});

test('Gegenprobe: ohne Entschaerfung landet fremder Code im Blatt', () => {
  const blatt = baueBlatt('Test', '10', [{
    eintrag: { ...EINTRAG, titel: '<script>alert(1)</script>' },
    info: { dauer: 20, breite: 1080, hoehe: 1920, bytes: 1024 * 1024 },
    bilder: ['clip_1.jpg'],
  }]);
  // Der Untertitel kommt von einem fremden TikTok-Konto. Er darf im Blatt
  // stehen, aber nicht ausgefuehrt werden.
  assert.ok(!blatt.includes('<script>alert(1)</script>'));
  assert.ok(blatt.includes('&lt;script&gt;'));
});

test('technisch schwaches Material wird im Blatt markiert', () => {
  const schwach = baueBlatt('Test', '10', [{
    eintrag: EINTRAG,
    info: { dauer: 3, breite: 640, hoehe: 480, bytes: 500000 },
    bilder: ['clip_1.jpg'],
  }]);
  assert.ok(schwach.includes('warnung'), 'schwacher Clip braucht die Markierung');
  assert.ok(schwach.includes('480p') || schwach.includes('nur 480'), 'Auflösung muss benannt sein');
  assert.ok(schwach.includes('Querformat'));

  const gut = baueBlatt('Test', '10', [{
    eintrag: EINTRAG,
    info: { dauer: 20, breite: 1080, hoehe: 1920, bytes: 4000000 },
    bilder: ['clip_1.jpg'],
  }]);
  assert.ok(gut.includes('technisch brauchbar'));
  assert.ok(!gut.includes('class="clip warnung"'));
});

test('das Blatt sagt, dass Rechte damit nicht geprueft sind', () => {
  const blatt = baueBlatt('Test', '10', [{
    eintrag: EINTRAG,
    info: { dauer: 20, breite: 1080, hoehe: 1920, bytes: 1024 },
    bilder: [],
  }]);
  // Ein Blatt mit Vorschaubildern sieht aus wie eine Freigabe. Es ist keine.
  assert.ok(/Rechte sind damit nicht geprüft/.test(blatt));
  assert.ok(blatt.includes('ungeprüft'), 'der Rechtestand je Clip gehoert aufs Blatt');
});

test('das Blatt braucht kein JavaScript und keine Netzverweise', () => {
  const blatt = baueBlatt('Test', '10', [{
    eintrag: EINTRAG,
    info: { dauer: 20, breite: 1080, hoehe: 1920, bytes: 1024 },
    bilder: ['clip_1.jpg'],
  }]);
  // Es liegt in einem ignorierten Ordner und wird per Doppelklick geoeffnet.
  // Ein Verweis auf ein CDN macht es in fuenf Jahren kaputt.
  assert.ok(!/<script/i.test(blatt));
  assert.ok(!/https?:\/\/(?!www\.tiktok)/i.test(blatt.replace(/href="[^"]*tiktok[^"]*"/g, '')));
});

// ── baueBoegen ───────────────────────────────────────────────────────

test('ein Blatt je Produkt, nicht eines fuer alle', () => {
  const ordner = tempOrdner();
  const zehn = { ...EINTRAG };
  const elf = {
    ...EINTRAG, produkt_id: 11, produkt_name: 'Anderes Produkt',
    video_id: '7300000000000000002', datei: '11_7300000000000000002.mp4',
  };
  fs.writeFileSync(path.join(ordner, zehn.datei), 'VIDEODATEN');
  fs.writeFileSync(path.join(ordner, elf.datei), 'VIDEODATEN');
  fs.writeFileSync(path.join(ordner, 'index.json'),
    JSON.stringify({ version: 1, eintraege: [zehn, elf] }, null, 2));

  const echterSpawn = require('child_process').spawnSync;
  require('child_process').spawnSync = (_w, argumente) => {
    // ffprobe-Aufruf erkennen und Medienangaben liefern.
    if (argumente.includes('-show_entries')) {
      return {
        status: 0,
        stdout: JSON.stringify({
          streams: [{ width: 1080, height: 1920 }],
          format: { duration: '20.0', size: '4000000' },
        }),
      };
    }
    const ziel = argumente[argumente.length - 1];
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, 'JPEGDATEN');
    return { status: 0, stdout: '' };
  };

  try {
    const ergebnis = baueBoegen({
      ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', ordner, videoOrdner: null,
      ausgabe: () => {},
    });
    assert.strictEqual(ergebnis.boegen.length, 2, 'zwei Produkte, zwei Blätter');
    assert.strictEqual(ergebnis.clips, 2);
    for (const blatt of ergebnis.boegen) assert.ok(fs.existsSync(blatt));
  } finally {
    require('child_process').spawnSync = echterSpawn;
  }
});

test('ohne Rohmaterial passiert nichts — und das ist kein Fehler', () => {
  const ordner = tempOrdner();
  fs.writeFileSync(path.join(ordner, 'index.json'),
    JSON.stringify({ version: 1, eintraege: [] }, null, 2));

  const ergebnis = baueBoegen({
    ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', ordner, videoOrdner: null,
    ausgabe: () => {},
  });
  assert.strictEqual(ergebnis.boegen.length, 0);
  assert.strictEqual(ergebnis.clips, 0);
});

// ── Argumente ────────────────────────────────────────────────────────

test('liest --produkt, --neu und --schnittliste', () => {
  const leer = { produkt: null, neu: false, schnittliste: false };
  assert.deepStrictEqual(leseArgumente([]), leer);
  assert.deepStrictEqual(leseArgumente(['--produkt', '10']), { ...leer, produkt: '10' });
  assert.deepStrictEqual(leseArgumente(['--neu']), { ...leer, neu: true });
  assert.deepStrictEqual(leseArgumente(['--schnittliste']), { ...leer, schnittliste: true });
});

// ── medienInfo ───────────────────────────────────────────────────────

test('medienInfo gibt null statt zu raten, wenn ffprobe scheitert', () => {
  const echterSpawn = require('child_process').spawnSync;
  require('child_process').spawnSync = () => ({ status: 1, stdout: '' });
  try {
    assert.strictEqual(medienInfo('ffprobe', '/gibt/es/nicht.mp4'), null);
  } finally {
    require('child_process').spawnSync = echterSpawn;
  }
});

test('Gegenprobe: geratene Nullwerte wuerden als gueltiges Format durchgehen', () => {
  // Das falsche Verhalten: bei Fehler ein leeres Objekt zurueckgeben.
  const geraten = { dauer: 0, breite: 0, hoehe: 0, bytes: 0 };
  // Damit waere der Clip "unbekannt" statt "unlesbar" — und im Blatt stuende
  // eine Angabe, wo eine Warnung stehen muesste.
  assert.strictEqual(formatWort(geraten.breite, geraten.hoehe), 'unbekannt');
  assert.notStrictEqual(geraten, null);
});

// ── Schnittlisten-Entwurf ────────────────────────────────────────────
//
// Der Bogen nennt Dateiname, Dauer und Aufloesung — genau die Felder einer
// Schnittliste. Sie abzuschreiben war bei 25 Clips eine Viertelstunde mit
// vier Gelegenheiten fuer einen Tippfehler.

function _zeile(datei, { dauer = 12, breite = 1080, hoehe = 1920, creator = '@wer',
  szenen = [] } = {}) {
  return {
    eintrag: { ...EINTRAG, datei, creator },
    info: { dauer, breite, hoehe, bytes: 1000 },
    bilder: [],
    szenen,
  };
}

test('der Entwurf nennt jeden Clip als eigenes Segment', () => {
  const entwurf = baueEntwurf({
    produktId: '10',
    produktName: 'Wasserspender',
    zeilen: [_zeile('a.mp4'), _zeile('b.mp4'), _zeile('c.mp4')],
    laenge: 2.2,
  });

  assert.strictEqual(entwurf.produkt_id, 10, 'die Produkt-ID muss eine Zahl sein');
  assert.deepStrictEqual(entwurf.segmente.map((s) => s.quelle), ['a.mp4', 'b.mp4', 'c.mp4']);
  // Ohne erkannte Szenen bleibt es bei "ab Sekunde 0" — geraten wird nicht.
  assert.ok(entwurf.segmente.every((s) => s.von === 0 && s.bis === 2.2));
});

test('ein Clip, der kuerzer ist als die Vorgabe, bekommt seine echte Laenge', () => {
  // Ohne das stuende im Entwurf "bis: 2.2" fuer einen 1,4-Sekunden-Clip.
  // lies() kuerzt das zwar und meldet es — aber erst beim Rendern, und dann
  // ist die Fassung schon geschrieben.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [_zeile('kurz.mp4', { dauer: 1.4 })],
    laenge: 2.2,
  });
  assert.strictEqual(entwurf.segmente[0].bis, 1.4);
});

test('schwaches Material wird im Entwurf markiert, nicht weggelassen', () => {
  // Weglassen waere bequemer und falsch: Ein Querformat-Clip taugt als
  // Einblendung, und ein 480p-Clip kann die einzige Aufnahme sein, die das
  // Produkt in Betrieb zeigt. Der Mensch entscheidet — er soll es nur sehen.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [
      _zeile('quer.mp4', { breite: 1920, hoehe: 1080, szenen: [4] }),
      _zeile('klein.mp4', { breite: 480, hoehe: 640, szenen: [4] }),
      _zeile('gut.mp4', { szenen: [4] }),
    ],
    laenge: 2.2,
  });

  assert.match(entwurf.segmente[0]._achtung, /Querformat/);
  assert.match(entwurf.segmente[1]._achtung, /640p/);
  assert.strictEqual(entwurf.segmente[2]._achtung, undefined);
  assert.strictEqual(entwurf.segmente.length, 3, 'nichts darf verschwinden');
});

test('der Entwurf laesst hook, cta und hashtags leer — sichtbar leer', () => {
  // Erfundener Text waere schlimmer als keiner: Er sieht nach Arbeit aus und
  // geht dann so raus.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W', zeilen: [_zeile('a.mp4')], laenge: 2.2,
  });
  assert.strictEqual(entwurf.hook, '');
  assert.strictEqual(entwurf.cta, '');
  assert.deepStrictEqual(entwurf.hashtags, []);
  assert.match(entwurf._hinweis, /hook/);
});

test('--schnittliste wird erkannt und ist nicht die Vorgabe', () => {
  assert.strictEqual(leseArgumente([]).schnittliste, false);
  assert.strictEqual(leseArgumente(['--schnittliste']).schnittliste, true);
  const beides = leseArgumente(['--produkt', '10', '--schnittliste']);
  assert.strictEqual(beides.produkt, '10');
  assert.strictEqual(beides.schnittliste, true);
});

test('Gegenprobe: ohne die Felder mit Unterstrich waere der Entwurf blind', () => {
  // Die _-Felder ignoriert der Renderer (lies() liest nur quelle/von/bis/
  // text/zuschnitt). Sie stehen da, damit man beim Streichen sieht, was man
  // streicht — ohne den Bogen daneben offen zu halten.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [_zeile('a.mp4', { dauer: 14.3, creator: '@buerokram' })],
    laenge: 2.2,
  });
  const s = entwurf.segmente[0];
  assert.strictEqual(s._dauer, 14.3);
  assert.strictEqual(s._format, 'hoch');
  assert.strictEqual(s._creator, '@buerokram');
});

test('--schnittliste schreibt den Entwurf und ueberschreibt ihn nie ungefragt', () => {
  // Der zweite Teil ist der wichtigere: Wer eine halbe Stunde Zeitmarken
  // gesetzt hat und den Bogen dann noch einmal baut, weil zwei Clips
  // dazugekommen sind, darf die Arbeit nicht verlieren — schon gar nicht
  // lautlos, weil der Aufruf ja "erfolgreich" war.
  const ordner = tempOrdner();
  const listen = tempOrdner();
  fs.writeFileSync(path.join(ordner, EINTRAG.datei), 'VIDEODATEN');
  fs.writeFileSync(path.join(ordner, 'index.json'),
    JSON.stringify({ version: 1, eintraege: [EINTRAG] }, null, 2));

  const echterSpawn = require('child_process').spawnSync;
  require('child_process').spawnSync = (_w, argumente) => {
    if (argumente.includes('-show_entries')) {
      return {
        status: 0,
        stdout: JSON.stringify({
          streams: [{ width: 1080, height: 1920 }],
          format: { duration: '20.0', size: '4000000' },
        }),
      };
    }
    const ziel = argumente[argumente.length - 1];
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, 'JPEGDATEN');
    return { status: 0, stdout: '' };
  };

  try {
    const lauf = () => baueBoegen({
      ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', ordner, videoOrdner: null,
      entwurf: true, schnittlistenOrdner: listen, ausgabe: () => {},
    });

    const erst = lauf();
    assert.strictEqual(erst.entwuerfe.length, 1);
    const datei = erst.entwuerfe[0];
    assert.match(path.basename(datei), /^_entwurf-/,
      'der fuehrende Unterstrich haelt den Entwurf vom Renderer fern');

    const gelesen = JSON.parse(fs.readFileSync(datei, 'utf8'));
    assert.strictEqual(gelesen.produkt_id, 10);
    assert.strictEqual(gelesen.segmente.length, 1);
    assert.strictEqual(gelesen.segmente[0].quelle, EINTRAG.datei);

    // Jetzt von Hand bearbeitet — und ein zweiter Lauf.
    fs.writeFileSync(datei, JSON.stringify({ ...gelesen, hook: 'von Hand' }), 'utf8');
    const zweit = lauf();
    assert.strictEqual(zweit.entwuerfe.length, 0, 'nichts neu geschrieben');
    assert.strictEqual(JSON.parse(fs.readFileSync(datei, 'utf8')).hook, 'von Hand',
      'die Handarbeit wurde ueberschrieben');
  } finally {
    require('child_process').spawnSync = echterSpawn;
  }
});

// ── Szenenerkennung (Punkt 26) ───────────────────────────────────────
//
// Die Schnittliste entstand bisher per Stoppuhr: Clip ansehen, Zeitpunkte
// notieren, eintippen. Bei 23 Rohclips ist das ein Nachmittag, und jede neue
// Fassung faengt teilweise von vorn an.

test('die Zeitpunkte werden aus ffmpegs Ausgabe gelesen', () => {
  const ausgabe = [
    '[Parsed_metadata_1 @ 0x55] frame:0    pts:103    pts_time:3.436667',
    'lavfi.scene_score=0.512345',
    '[Parsed_metadata_1 @ 0x55] frame:1    pts:310    pts_time:10.333',
    'frame=  300 fps=120 q=-1.0 Lsize=N/A time=00:00:12.00',
  ].join('\n');

  assert.deepStrictEqual(szenenAusAusgabe(ausgabe), [3.44, 10.33]);
});

test('doppelte und unsortierte Meldungen werden geglaettet', () => {
  // ffmpeg meldet dieselbe Stelle gelegentlich zweimal, wenn zwei Bilder
  // hintereinander stark abweichen.
  const ausgabe = 'pts_time:10.5\npts_time:3.4\npts_time:10.5\npts_time:3.4';
  assert.deepStrictEqual(szenenAusAusgabe(ausgabe), [3.4, 10.5]);
});

test('eine Ausgabe ohne Treffer ergibt eine leere Liste, keinen Fehler', () => {
  assert.deepStrictEqual(szenenAusAusgabe(''), []);
  assert.deepStrictEqual(szenenAusAusgabe('frame=300 fps=120 time=00:00:12.00'), []);
  assert.deepStrictEqual(szenenAusAusgabe(null), []);
});

test('gewaehlt wird die laengste Einstellung, nicht die erste', () => {
  // Szenen bei 3 und 5 in einem 20-Sekunden-Clip: 0-3, 3-5, 5-20.
  // Die letzte ist mit Abstand die laengste — dort steht das Geraet ruhig
  // im Bild, waehrend vorne geschnitten wird.
  const { von, bis } = waehleAusschnitt([3, 5], 20, 2.2);
  assert.strictEqual(von, 5);
  assert.strictEqual(bis, 7.2);
});

test('der Anfang wird uebersprungen — dort steht der Titeleinblender', () => {
  // Die laengste Einstellung waere 0-9. Sie beginnt aber bei 0, und der
  // Anfang fremder TikToks ist fast immer Titel oder schwarzes Bild —
  // derselbe Grund, aus dem kein Standbild bei 0 % gezogen wird.
  const { von } = waehleAusschnitt([9, 11], 12, 2.2);
  assert.strictEqual(von, 9, 'die Einstellung nach dem Titel muss gewinnen');
});

test('ohne erkannte Szenen wird nichts erfunden', () => {
  assert.deepStrictEqual(waehleAusschnitt([], 20, 2.2), { von: 0, bis: 2.2 });
  assert.deepStrictEqual(waehleAusschnitt(null, 20, 2.2), { von: 0, bis: 2.2 });
});

test('der Ausschnitt endet nie hinter dem Clip', () => {
  // Ohne diese Grenze stuende "bis: 11.2" fuer einen 10-Sekunden-Clip. lies()
  // kuerzt das und meldet es — aber erst beim Rendern.
  const { von, bis } = waehleAusschnitt([9], 10, 2.2);
  assert.ok(bis <= 10, `bis=${bis} liegt hinter dem Dateiende`);
  assert.ok(bis > von);
});

test('ein Rest von unter einer halben Sekunde ist kein Segment', () => {
  // Szene bei 9.8 in einem 10-Sekunden-Clip: 0,2 s waeren uebrig. Lieber
  // zurueck auf den Anfang als ein Segment, das im Video nicht zu sehen ist.
  assert.deepStrictEqual(waehleAusschnitt([9.8], 10, 2.2), { von: 0, bis: 2.2 });
});

test('der Entwurf nimmt den Schnittpunkt aus dem Material', () => {
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [_zeile('a.mp4', { dauer: 20, szenen: [3, 5] })],
    laenge: 2.2,
  });
  const s = entwurf.segmente[0];
  assert.strictEqual(s.von, 5, 'nicht mehr stur ab Sekunde 0');
  assert.strictEqual(s.bis, 7.2);
  assert.deepStrictEqual(s._szenen, [3, 5], 'die Alternativen muessen danebenstehen');
});

test('Gegenprobe: ohne Szenen faellt der Entwurf sichtbar zurueck', () => {
  // Wichtig ist das WORT im Entwurf. Ein geratener Ausschnitt, der aussieht
  // wie ein gemessener, ist schlimmer als gar keiner.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [_zeile('a.mp4', { dauer: 20, szenen: [] })],
    laenge: 2.2,
  });
  const s = entwurf.segmente[0];
  assert.strictEqual(s.von, 0);
  assert.strictEqual(s._szenen, null);
  assert.match(s._achtung, /kein Szenenwechsel/);
});

test('ein kurzer Clip ohne Szenen wird nicht angemahnt', () => {
  // Bei drei Sekunden ist "kein Szenenwechsel" der Normalfall und keine
  // Auffaelligkeit. Eine Warnung, die bei der Haelfte aller Clips steht,
  // liest nach zwei Tagen niemand mehr.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [_zeile('kurz.mp4', { dauer: 3, szenen: [] })],
    laenge: 2.2,
  });
  assert.strictEqual(entwurf.segmente[0]._achtung, undefined);
});

test('ein vermerkter Zuschnitt wandert in den Entwurf', () => {
  // Der Bot misst beim Laden, was von der Datei wirklich Bild ist
  // (cropdetect). Ohne diese Zeile müsste der Mensch den Wert aus dem Index
  // abschreiben — und genau das soll der Entwurf abnehmen.
  const zeile = _zeile('balken.mp4', { szenen: [3] });
  zeile.eintrag.zuschnitt = 'crop=1080:1620:0:150';
  zeile.eintrag.rand_anteil = 0.156;

  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W', zeilen: [zeile], laenge: 2.2,
  });
  const s = entwurf.segmente[0];
  assert.strictEqual(s.zuschnitt, 'crop=1080:1620:0:150');
  assert.match(s._achtung, /16 % Rand/);
});

test('ohne vermerkten Zuschnitt steht auch keiner im Entwurf', () => {
  // GEGENPROBE: Ein Feld "zuschnitt" bei jedem Segment waere Rauschen — und
  // ein falscher Zuschnitt schneidet Bild weg, das da sein soll.
  const entwurf = baueEntwurf({
    produktId: '10', produktName: 'W',
    zeilen: [_zeile('sauber.mp4', { szenen: [3] })], laenge: 2.2,
  });
  assert.strictEqual(entwurf.segmente[0].zuschnitt, undefined);
});
