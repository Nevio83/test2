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

/**
 * Liest ab einer Position den vollstaendigen Ausdruck bis zum abschliessenden
 * Semikolon — Zeichenketten dabei als Ganzes behandelt.
 *
 * ⚠️ Der naheliegende Weg (bis zum ersten ';' lesen) geht hier schief: CSS
 * steckt voller Semikolons, und die stehen INNERHALB der Zeichenkette. Beim
 * ersten Versuch fielen dadurch 41 Seiten auf die alte Regel zurueck —
 * darunter alle Produktseiten und der Warenkorb.
 */
function leseAusdruck(text, ab) {
  let i = ab, inZeichenkette = null;
  while (i < text.length) {
    const c = text[i], vorher = text[i - 1];
    if (inZeichenkette) {
      if (c === inZeichenkette && vorher !== '\\') inZeichenkette = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inZeichenkette = c;
    } else if (c === ';') {
      return text.slice(ab, i);
    }
    i++;
  }
  return null;
}

/**
 * Entfernt Kommentare aus einem Ausdruck — aber nur solche AUSSERHALB von
 * Zeichenketten. Ein stumpfes Wegschneiden von "//" wuerde CSS zerstoeren:
 * url(//cdn.example/x) steckt voller doppelter Schraegstriche.
 *
 * Noetig, weil die CSS-Verkettungen im Projekt kommentiert sind
 * (product-availability.js hat mitten in der Kette ein "// Vormerkung").
 */
function entferneKommentare(text) {
  let raus = '', i = 0, inZeichenkette = null;
  while (i < text.length) {
    const c = text[i], vorher = text[i - 1];
    if (inZeichenkette) {
      raus += c;
      if (c === inZeichenkette && vorher !== '\\') inZeichenkette = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inZeichenkette = c; raus += c; i++; continue; }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    raus += c;
    i++;
  }
  return raus;
}

/**
 * Wertet einen JS-Ausdruck aus, der NUR aus Zeichenketten und + besteht.
 * Damit lassen sich zusammengesetzte CSS-Texte exakt rekonstruieren
 * ('a{…}' + 'b{…}'), ohne die Quelldatei umzuschreiben — ein Umschreiben von
 * Hand wuerde die Gestaltung riskieren.
 * @returns {string|null} null, wenn der Ausdruck etwas anderes enthaelt.
 */
function werteZeichenkettenAusdruckAus(ausdruck) {
  const roh = entferneKommentare(ausdruck).trim().replace(/;$/, '');
  // Erlaubt: '…' "…" `…` (ohne ${), Pluszeichen, Leerraum. Sonst nichts.
  const erlaubt = /^(?:\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.|\$(?!\{))*`)\s*\+?)+$/;
  if (!erlaubt.test(roh)) return null;
  if (/\$\{/.test(roh)) return null;      // eingesetzte Werte -> nicht bestimmbar
  try {
    // new Function ist hier vertretbar: der Ausdruck wurde vorher streng
    // geprueft und darf nur Zeichenketten und + enthalten. Er stammt zudem aus
    // dem eigenen Quellcode, nicht von aussen.
    const wert = new Function('return (' + roh + ');')();
    if (typeof wert !== 'string') return null;
    // ⚠️ Plausibilitaetspruefung: Wurde der Ausdruck an der falschen Stelle
    // abgeschnitten, fehlt hinten CSS — und das faellt an unausgeglichenen
    // geschweiften Klammern auf. Wichtig, weil zwei dieser Stylesheets im
    // Shop derzeit NIE erscheinen (nur bei Video bzw. ausverkaufter Ware) und
    // ein falscher Fingerabdruck dort erst auffiele, wenn es so weit ist.
    const auf = (wert.match(/\{/g) || []).length;
    const zu = (wert.match(/\}/g) || []).length;
    if (auf === 0 || auf !== zu) return null;
    return wert;
  } catch (e) {
    return null;
  }
}

/**
 * CSS, das ein Skript zur Laufzeit als <style> in die Seite haengt.
 *
 * Zwei Bauarten kommen im Projekt vor:
 *   1) <style>…</style> mitten in einer Markup-Zeichenkette (per innerHTML)
 *   2) document.createElement('style') + .textContent = <Ausdruck>
 *      — der Ausdruck ist teils ein Template-Literal, teils eine Verkettung,
 *        teils eine vorher belegte Variable.
 *
 * @returns {{stile: Set<string>, unklar: string[]}} unklar = Stellen, deren
 *   Inhalt sich nicht sicher bestimmen liess. Gibt es solche, bleibt die Seite
 *   bei der alten, laschen Regel — lieber kein Gewinn als eine Seite ohne
 *   Gestaltung.
 */
function stileAusJs(quelltext, datei) {
  const stile = new Set();
  const unklar = [];

  // (1) <style>…</style> in Markup-Zeichenketten
  for (const m of quelltext.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    if (/\$\{/.test(m[1])) { unklar.push(datei + ': <style> mit eingesetztem Wert'); continue; }
    if (m[1].trim()) stile.add(m[1]);
  }

  // (2) .textContent = … bei einem erzeugten <style>
  for (const treffer of quelltext.matchAll(/createElement\(\s*['"]style['"]\s*\)/g)) {
    const zeile = quelltext.slice(0, treffer.index).split('\n').length;
    // Zuweisung nach der Erzeugung suchen (im Umkreis, nicht global).
    const umkreis = quelltext.slice(treffer.index, treffer.index + 8000);
    const zuweisung = umkreis.match(/\.(?:textContent|innerHTML)\s*=\s*/);
    if (!zuweisung) { unklar.push(datei + ':' + zeile + ': Zuweisung nicht gefunden'); continue; }

    const ab = treffer.index + zuweisung.index + zuweisung[0].length;
    const ausdruck = leseAusdruck(quelltext, ab);
    if (ausdruck === null) { unklar.push(datei + ':' + zeile + ': Ausdruck nicht abgeschlossen'); continue; }

    // Direkt ein Literal bzw. eine Verkettung ohne eingesetzte Werte?
    const direkt = werteZeichenkettenAusdruckAus(ausdruck);
    if (direkt !== null) { stile.add(direkt); continue; }

    // Sonst: Variable, die vorher belegt wurde (var css = '…' + '…';)
    const name = ausdruck.trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
      const belegStelle = quelltext.slice(0, treffer.index)
        .search(new RegExp('(?:var|let|const)\\s+' + name + '\\s*=\\s*[^;]', 'g'));
      if (belegStelle !== -1) {
        const nachGleich = quelltext.indexOf('=', belegStelle) + 1;
        const wertAusdruck = leseAusdruck(quelltext, nachGleich);
        const wert = wertAusdruck === null ? null : werteZeichenkettenAusdruckAus(wertAusdruck);
        if (wert !== null) { stile.add(wert); continue; }
      }
    }
    unklar.push(datei + ':' + zeile + ': Inhalt nicht eindeutig bestimmbar');
  }

  return { stile, unklar };
}

/** <style>-Bloecke einer HTML-Seite. */
function stileAusHtml(quelltext) {
  const treffer = new Set();
  for (const m of quelltext.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (m[1].trim()) treffer.add(m[1]);
  }
  return treffer;
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

  // Schritt 1: Handler- und Stil-Hashes je JS-Datei (beides landet zur Laufzeit
  // in der Seite).
  const jsHandler = new Map();   // Dateiname -> string[]
  const jsStile = new Map();     // Dateiname -> { hashes: string[], unklar: string[] }
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

      const { stile, unklar } = stileAusJs(src, e.name);
      if (stile.size || unklar.length) {
        jsStile.set(e.name, { hashes: [...stile].map(hash), unklar });
      }
    }
  }

  // Schritt 2: je HTML-Seite eigener Satz.
  const index = new Map();
  const stilIndex = new Map();
  let seiten = 0, skriptHashes = 0, handlerHashes = 0, stilHashes = 0, seitenOhneStil = 0;
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
      const eingebundeneSkripte = skriptDateienAusHtml(src);
      for (const name of eingebundeneSkripte) {
        for (const h of (jsHandler.get(name) || [])) menge.add(h);
      }

      // Stil-Hashes: eigene <style>-Bloecke + das CSS der eingebundenen Skripte.
      // Ist auch nur EINE Stelle nicht eindeutig bestimmbar, bekommt die Seite
      // gar keine Stil-Hashes und bleibt bei der alten, laschen Regel. Lieber
      // kein Gewinn als eine Seite, die ihre Gestaltung verliert.
      const stile = new Set();
      let stilUnklar = [];
      for (const s of stileAusHtml(src)) { stile.add(hash(s)); stilHashes++; }
      for (const name of eingebundeneSkripte) {
        const eintrag = jsStile.get(name);
        if (!eintrag) continue;
        if (eintrag.unklar.length) stilUnklar = stilUnklar.concat(eintrag.unklar);
        for (const h of eintrag.hashes) stile.add(h);
      }

      const urlPfad = '/' + (dir ? dir + '/' : '') + e.name;
      index.set(urlPfad, [...menge]);
      if (stilUnklar.length) { stilIndex.set(urlPfad, null); seitenOhneStil++; }
      else stilIndex.set(urlPfad, [...stile]);
      if (urlPfad === '/index.html') {
        index.set('/', [...menge]);
        stilIndex.set('/', stilIndex.get(urlPfad));
      }
      seiten++;
    }
  }

  return {
    index,
    stilIndex,
    statistik: {
      seiten, skriptHashes, handlerHashes, stilHashes, seitenOhneStil,
      jsDateienMitHandlern: jsHandler.size, meldungen
    }
  };
}

/**
 * Erzeugt den Nachschlager. Wird beim Start EINMAL aufgerufen.
 * @param {string} rootDir Projektverzeichnis
 */
function createInlineHashes(rootDir) {
  let index = new Map();
  let stilIndex = new Map();
  let statistik = { seiten: 0, skriptHashes: 0, handlerHashes: 0, stilHashes: 0, seitenOhneStil: 0, meldungen: [] };
  try {
    ({ index, stilIndex, statistik } = baueIndex(rootDir));
  } catch (e) {
    console.warn('⚠️ Inline-Hashes konnten nicht berechnet werden:', e.message);
  }

  if (statistik.meldungen.length) {
    console.warn('⚠️ Ereignisbehandler mit eingesetzten Werten gefunden — deren Hash ' +
      'aendert sich bei jedem Aufruf, sie werden blockiert:');
    statistik.meldungen.slice(0, 10).forEach((m) => console.warn('   ' + m));
  }
  console.log(`🔐 Inline-Hashes berechnet: ${statistik.seiten} Seiten, ` +
    `${statistik.skriptHashes} Skriptbloecke, ${statistik.handlerHashes} Behandler, ` +
    `${statistik.stilHashes} Stilbloecke`);
  if (statistik.seitenOhneStil) {
    console.log(`   ${statistik.seitenOhneStil} Seite(n) behalten die alte Stil-Regel ` +
      '(dort liess sich nicht jedes Stylesheet eindeutig bestimmen)');
  }

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

  /**
   * Stil-Hashes fuer einen Pfad. null = kein Satz vorhanden -> die Seite
   * behaelt die alte Regel mit 'unsafe-inline'.
   */
  function stileFuerPfad(reqPfad) {
    let p;
    try { p = decodeURIComponent(reqPfad); } catch (e) { return null; }
    return stilIndex.has(p) ? stilIndex.get(p) : null;
  }

  return { fuerPfad, stileFuerPfad, statistik, groesse: () => index.size };
}

module.exports = {
  createInlineHashes, baueIndex, skripteAusHtml, handlerAusText,
  jsEntmaskieren, htmlEntkoden, hash, normalisiere,
  stileAusHtml, stileAusJs, werteZeichenkettenAusdruckAus
};
