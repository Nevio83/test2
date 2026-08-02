/**
 * csp-inline.js — Hashes fuer den Inline-Code jeder Seite.
 *
 * Wozu: Damit 'unsafe-inline' aus script-src verschwinden kann. Solange es
 * drinsteht, darf JEDER in die Seite geschriebene Code laufen — genau das,
 * was ein eingeschleustes Skript ausnutzt. Nennt die Richtlinie stattdessen
 * die Hashes des erlaubten Inline-Codes, laeuft nur noch genau dieser Code;
 * alles Fremde blockt der Browser, auch wenn es mitten im Markup steht.
 *
 * Warum Hashes und nicht Nonces: Nonces muessen pro Aufruf neu gewuerfelt und
 * in jedes <script>-Tag geschrieben werden — das hiesse, 59 HTML-Dateien
 * umzubauen und jede Seite bei jedem Abruf umzuschreiben. Hashes brauchen
 * KEINE Aenderung am Markup: sie werden beim Start aus den Dateien berechnet.
 * Aendert jemand ein Inline-Skript, stimmt der Hash beim naechsten Start
 * automatisch wieder — die Liste pflegt sich selbst, wie bei static-guard.js.
 *
 * Drei Quellen von Inline-Code:
 *   1) <script>...</script> in den HTML-Seiten            -> Hash des Rumpfes
 *   2) onclick="..." u.ae. in den HTML-Seiten              -> Hash + 'unsafe-hashes'
 *   3) onclick="..." in JS-Vorlagen, die zur Laufzeit ins  -> Hash + 'unsafe-hashes'
 *      Markup geschrieben werden (cart.js, app.js, ...)
 *
 * Zu (2)/(3): Fuer Ereignisbehandler reicht ein Hash allein nicht, der Browser
 * verlangt zusaetzlich das Schluesselwort 'unsafe-hashes'. Das klingt schlimmer
 * als es ist: erlaubt sind weiterhin ausschliesslich die aufgefuehrten Hashes.
 * Ein Angreifer koennte also hoechstens einen der hier gelisteten Texte erneut
 * verwenden — das sind Navigationen und Ein-/Ausblenden, kein Datenabfluss.
 *
 * ⚠️ Vorbedingung, die eigens hergestellt wurde: Behandler mit eingesetzten
 * Werten (onclick="loesche(${id})") haben bei jedem Aufruf einen anderen Text
 * und damit einen anderen Hash — sie sind grundsaetzlich nicht hashbar. Alle
 * 21 solchen Stellen wurden auf data-Attribute umgestellt, sodass der
 * Handler-Text konstant ist: onclick="loesche(this.dataset.artikel)".
 * Kommt eine neue Stelle mit ${...} im Handler dazu, faellt sie hier auf
 * (pruefeAufVariableHandler) und wird beim Start gemeldet.
 *
 * NICHT angefasst: style-src. Der Shop hat rund 1500 style="..."-Attribute;
 * dafuer gibt es keine vergleichbar sichere Loesung ohne Umbau jeder Seite.
 * Eingeschleustes CSS kann Seiten verunstalten, aber keine Daten abgreifen —
 * der Hebel liegt eindeutig bei script-src.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Verzeichnisse mit ausgelieferten Seiten (deckungsgleich mit static-guard). */
const SEITEN_DIRS = ['', 'produkte', 'infos', 'a29715347575'];

/**
 * ⚠️ Zeilenenden normalisieren, BEVOR gehasht wird.
 *
 * Der HTML-Parser wandelt beim Einlesen jedes \r\n und jedes einzelne \r in \n
 * um (so schreibt es die HTML-Spezifikation vor). Der Browser hasht also den
 * normalisierten Text, nicht die Bytes aus der Datei. Wer ueber die Rohbytes
 * hasht, liegt bei jeder Datei mit Windows-Zeilenenden daneben — und die Seite
 * ist still tot, denn ein blockiertes Inline-Skript meldet sich nicht immer in
 * der Konsole.
 *
 * Genau das ist am 02.08. passiert: gutscheine.html und infos/agb.html haben
 * CRLF, alle anderen LF. Die beiden Seiten waren ohne jede Fehlermeldung ohne
 * Funktion, waehrend der statische Abgleich "passt" meldete — er rechnete mit
 * demselben Fehler.
 */
const normalisiere = (text) => text.replace(/\r\n?/g, '\n');

const hash = (text) =>
  "'sha256-" + crypto.createHash('sha256').update(normalisiere(text), 'utf8').digest('base64') + "'";

/** HTML-Entitaeten, die in Attributwerten vorkommen koennen. */
function htmlEntkoden(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&'); // zuletzt, sonst werden Doppel-Kodierungen falsch
}

/**
 * Maskierung aus einem JS-String-Literal aufloesen. In '<a onerror="x=\'y\'">'
 * steht im Quelltext \' — im ausgelieferten Markup steht '. Template-Literale
 * (`...`) maskieren nicht, dort aendert diese Funktion nichts.
 */
function jsEntmaskieren(s) {
  return s.replace(/\\(['"\\])/g, '$1');
}

/** Inline-<script>-Rumpfe einer HTML-Seite. */
function skripteAusHtml(quelltext) {
  const treffer = new Set();
  for (const m of quelltext.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(m[1])) continue;     // externes Skript, kein Inline-Code
    if (m[2].trim() === '') continue;          // leerer Block wird nie ausgefuehrt
    treffer.add(m[2]);
  }
  return treffer;
}

/** Ereignisbehandler-Texte aus Markup (HTML-Datei oder JS-Vorlage). */
function handlerAusText(quelltext, ausJs) {
  const treffer = new Set();
  const muster = [/\son[a-z]+\s*=\s*"([^"]*)"/gi, /\son[a-z]+\s*=\s*'([^']*)'/gi];
  for (const re of muster) {
    for (const m of quelltext.matchAll(re)) {
      let code = m[1];
      if (ausJs) code = jsEntmaskieren(code);
      code = htmlEntkoden(code);
      if (code.trim()) treffer.add(code);
    }
  }
  return treffer;
}

/** Meldet Behandler, die eingesetzte Werte enthalten und daher nie passen. */
function pruefeAufVariableHandler(quelltext, datei, meldungen) {
  for (const m of quelltext.matchAll(/\son[a-z]+\s*=\s*(["'])((?:(?!\1)[\s\S]){0,200}?)\1/gi)) {
    if (/\$\{|["']\s*\+\s*/.test(m[2])) {
      meldungen.push(datei + ': ' + m[2].slice(0, 60));
    }
  }
}

/** Welche lokalen Skripte bindet diese Seite ein? (Dateinamen ohne Pfad) */
function skriptDateienAusHtml(quelltext) {
  const namen = new Set();
  for (const m of quelltext.matchAll(/<script\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)) {
    if (/^https?:\/\//i.test(m[1])) continue;
    namen.add(path.basename(m[1].split('?')[0]));
  }
  return namen;
}

/**
 * Baut den Index: URL-Pfad -> Liste von Hash-Quellen.
 * @returns {{index: Map<string,string[]>, statistik: object}}
 */
function baueIndex(rootDir) {
  const meldungen = [];

  // Schritt 1: Handler-Hashes je JS-Datei (die landen zur Laufzeit im Markup).
  const jsHandler = new Map();   // Dateiname -> string[]
  for (const dir of SEITEN_DIRS) {
    const abs = path.join(rootDir, dir);
    let eintraege = [];
    try { eintraege = fs.readdirSync(abs, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of eintraege) {
      if (!e.isFile() || !e.name.endsWith('.js')) continue;
      let src;
      try { src = fs.readFileSync(path.join(abs, e.name), 'utf8'); } catch (e2) { continue; }
      pruefeAufVariableHandler(src, e.name, meldungen);
      const menge = handlerAusText(src, true);
      if (menge.size) jsHandler.set(e.name, [...menge].map(hash));
    }
  }

  // Schritt 2: je HTML-Seite eigener Satz.
  const index = new Map();
  let seiten = 0, skriptHashes = 0, handlerHashes = 0;
  for (const dir of SEITEN_DIRS) {
    const abs = path.join(rootDir, dir);
    let eintraege = [];
    try { eintraege = fs.readdirSync(abs, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of eintraege) {
      if (!e.isFile() || !e.name.endsWith('.html')) continue;
      let src;
      try { src = fs.readFileSync(path.join(abs, e.name), 'utf8'); } catch (e2) { continue; }

      pruefeAufVariableHandler(src, (dir ? dir + '/' : '') + e.name, meldungen);

      const menge = new Set();
      for (const s of skripteAusHtml(src)) { menge.add(hash(s)); skriptHashes++; }
      for (const h of handlerAusText(src, false)) { menge.add(hash(h)); handlerHashes++; }
      for (const name of skriptDateienAusHtml(src)) {
        for (const h of (jsHandler.get(name) || [])) menge.add(h);
      }

      const urlPfad = '/' + (dir ? dir + '/' : '') + e.name;
      index.set(urlPfad, [...menge]);
      if (urlPfad === '/index.html') index.set('/', [...menge]);
      seiten++;
    }
  }

  return {
    index,
    statistik: { seiten, skriptHashes, handlerHashes, jsDateienMitHandlern: jsHandler.size, meldungen }
  };
}

/**
 * Erzeugt den Nachschlager. Wird beim Start EINMAL aufgerufen.
 * @param {string} rootDir Projektverzeichnis
 */
function createInlineHashes(rootDir) {
  let index = new Map();
  let statistik = { seiten: 0, skriptHashes: 0, handlerHashes: 0, meldungen: [] };
  try {
    ({ index, statistik } = baueIndex(rootDir));
  } catch (e) {
    console.warn('⚠️ Inline-Hashes konnten nicht berechnet werden:', e.message);
  }

  if (statistik.meldungen.length) {
    console.warn('⚠️ Ereignisbehandler mit eingesetzten Werten gefunden — deren Hash ' +
      'aendert sich bei jedem Aufruf, sie werden blockiert:');
    statistik.meldungen.slice(0, 10).forEach((m) => console.warn('   ' + m));
  }
  console.log(`🔐 Inline-Hashes berechnet: ${statistik.seiten} Seiten, ` +
    `${statistik.skriptHashes} Skriptbloecke, ${statistik.handlerHashes} Behandler`);

  /**
   * Hashes fuer einen angefragten Pfad. Leeres Ergebnis = Seite unbekannt.
   * @returns {string[]|null} null, wenn der Pfad keine bekannte Seite ist
   */
  function fuerPfad(reqPfad) {
    let p;
    try { p = decodeURIComponent(reqPfad); } catch (e) { return null; }
    if (index.has(p)) return index.get(p);
    return null;
  }

  return { fuerPfad, statistik, groesse: () => index.size };
}

module.exports = {
  createInlineHashes, baueIndex, skripteAusHtml, handlerAusText,
  jsEntmaskieren, htmlEntkoden, hash, normalisiere
};
