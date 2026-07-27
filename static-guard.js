/**
 * static-guard.js — nur oeffentliche Dateien ausliefern.
 *
 * Problem: express.static gibt das GESAMTE Projektverzeichnis frei. Damit war
 * jede Datei abrufbar, fuer die es keine eigene Route gibt — am 27.07. live
 * nachgewiesen: server.js, database.js, voucher-validator.js (also saemtliche
 * Gutscheincodes samt Bedingungen), package.json, die internen Doku-Dateien,
 * die Lieferantenliste in excel/ mit Einkaufspreisen, sowie erzeugte
 * Beleg-PDFs unter receipts/.
 *
 * Secrets waren nicht betroffen (.env wird nicht deployt, alles laeuft ueber
 * process.env) — aber Gutscheincodes sind unmittelbar Geld wert, und in
 * receipts/ landen kuenftig echte Kundenrechnungen.
 *
 * Ansatz: Freigabe statt Sperrliste. Eine Sperrliste vergisst man, sobald eine
 * neue Backend-Datei dazukommt — dann steht das Loch wieder offen, ohne dass
 * es jemandem auffaellt. Hier ist umgekehrt alles gesperrt, was nicht
 * ausdruecklich oeffentlich ist.
 *
 * Die Liste der oeffentlichen Skripte und Stylesheets wird beim Start aus den
 * HTML-Seiten abgeleitet (was dort per <script src>/<link href> eingebunden
 * ist, muss ausgeliefert werden). Dadurch pflegt sie sich selbst: ein neues
 * Frontend-Skript wird automatisch freigegeben, sobald es eingebunden ist —
 * eine neue Backend-Datei taucht dort nie auf und bleibt gesperrt.
 */

const fs = require('fs');
const path = require('path');

// Verzeichnisse, die ausgeliefert werden duerfen.
// a29715347575 steht bewusst drin: der Ordner ist bereits durch die
// Admin-Anmeldung geschuetzt (app.use('/a29715347575', requireAdminAuth)).
const PUBLIC_DIRS = new Set([
  'produkte', 'infos', 'images', 'karten', 'produkt bilder', 'produkt videos',
  'a29715347575'
]);

// Endungen, die im Wurzelverzeichnis und in den freigegebenen Ordnern
// unbedenklich sind. .js und .json fehlen hier bewusst — siehe unten.
const PUBLIC_EXT = new Set([
  '.html', '.css', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico',
  '.avif', '.mp4', '.webm', '.mov', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.txt', '.xml', '.webmanifest', '.map'
]);

// Notnagel: falls das Ableiten aus den HTML-Seiten fehlschlaegt, funktioniert
// der Shop mit dieser Grundausstattung weiter. Wird mit dem Ergebnis des
// Scans vereinigt, ersetzt es also nicht.
const FALLBACK_JS = [
  'app.js', 'cart.js', 'home.js', 'keyboard-shortcuts.js', 'cookie-consent.js',
  'site-integrations.js', 'view-tracker.js', 'widerruf-button.js',
  'newsletter-popup.js', 'gutschein-system.js', 'geolocation-tracker.js',
  'product-gallery-complete.js', 'product-video.js', 'product-availability.js',
  'product-reviews.js', 'color-image-selection.js', 'color-cart-bridge.js',
  'bundle-images-final.js', 'cart-color-images-only.js', 'checkout-receipt.js',
  'produkt-premium.js', 'admin-orders.js', 'admin-views.js', 'markt-insights.js',
  'newsletter.js', 'produkt-analyse.js'
];

/**
 * Ermittelt alle lokalen .js/.css-Dateien, die das Frontend braucht.
 *
 * Zwei Durchgaenge, denn nicht alles steht im HTML:
 *   1) was HTML-Seiten per <script src>/<link href> einbinden
 *   2) was diese Skripte ihrerseits zur Laufzeit nachladen — cookie-consent.js
 *      und newsletter-popup.js holen ihr eigenes Stylesheet selbst nach. Ohne
 *      diesen zweiten Durchgang stuende der Cookie-Banner ohne Gestaltung da.
 *
 * Durchgang 2 sieht sich bewusst nur die in Durchgang 1 gefundenen Skripte an,
 * nicht den Backend-Code — sonst koennten dessen interne Verweise ungewollt
 * etwas freischalten.
 *
 * @returns {Set<string>} Dateinamen ohne Pfad
 */
function collectReferencedAssets(rootDir) {
  const namen = new Set();
  const RE_HTML = /(?:src|href)="([^"]+\.(?:js|css))(?:\?[^"]*)?"/g;
  // Stringliterale in JS: 'x.css', "x.js" — nur Dateinamen, keine URLs.
  const RE_JS = /['"]([a-zA-Z0-9_-]+\.(?:css|js))(?:\?[^'"]*)?['"]/g;

  function scan(dir, tiefe) {
    if (tiefe > 3) return;
    let eintraege;
    try {
      eintraege = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of eintraege) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        scan(p, tiefe + 1);
      } else if (e.name.endsWith('.html')) {
        try {
          const src = fs.readFileSync(p, 'utf8');
          for (const m of src.matchAll(RE_HTML)) {
            if (/^https?:\/\//i.test(m[1])) continue; // externe Quelle
            namen.add(path.basename(m[1]));
          }
        } catch (e2) { /* einzelne unlesbare Datei ueberspringen */ }
      }
    }
  }

  scan(rootDir, 0);

  // Durchgang 2: nachgeladene Assets der bereits freigegebenen Skripte.
  const skripte = [...namen].filter((n) => n.endsWith('.js'));
  for (const name of skripte) {
    for (const kandidat of [path.join(rootDir, name), path.join(rootDir, 'produkte', name)]) {
      let src;
      try {
        src = fs.readFileSync(kandidat, 'utf8');
      } catch (e) {
        continue; // Datei liegt woanders -> naechster Kandidat
      }
      for (const m of src.matchAll(RE_JS)) namen.add(m[1]);
      break;
    }
  }

  return namen;
}

/**
 * Baut die Pruef-Middleware. Muss VOR express.static registriert werden.
 * @param {string} rootDir Projektverzeichnis
 */
function createStaticGuard(rootDir) {
  let erlaubteAssets;
  try {
    erlaubteAssets = collectReferencedAssets(rootDir);
  } catch (e) {
    console.warn('⚠️ Asset-Liste konnte nicht aus den HTML-Seiten gelesen werden:', e.message);
    erlaubteAssets = new Set();
  }
  FALLBACK_JS.forEach((n) => erlaubteAssets.add(n));
  console.log(`🔒 Datei-Freigabe aktiv (${erlaubteAssets.size} oeffentliche Skripte/Stylesheets)`);

  function istErlaubt(reqPath) {
    let p;
    try {
      p = decodeURIComponent(reqPath);
    } catch (e) {
      return false; // kaputte Kodierung -> nicht ausliefern
    }
    if (p.includes('\0') || p.includes('..')) return false;

    const teile = p.split('/').filter(Boolean);
    if (!teile.length) return true; // "/" -> index.html

    // Unterverzeichnis: nur die ausdruecklich freigegebenen.
    if (teile.length > 1 && !PUBLIC_DIRS.has(teile[0])) return false;

    const datei = teile[teile.length - 1];
    const ext = path.extname(datei).toLowerCase();

    // Skripte und Stylesheets nur, wenn eine HTML-Seite sie einbindet.
    // Genau hier faellt Backend-Code raus: den bindet keine Seite ein.
    if (ext === '.js' || ext === '.css') return erlaubteAssets.has(datei);

    // .json bewusst nicht freigegeben: products.json hat eine eigene Route
    // (die frueher greift), package.json & Co. gehen niemanden etwas an.
    return PUBLIC_EXT.has(ext);
  }

  /** Gibt es unter diesem Pfad ueberhaupt eine Datei? */
  function existiertAlsDatei(reqPath) {
    let p;
    try {
      p = decodeURIComponent(reqPath);
    } catch (e) {
      return false;
    }
    if (p.includes('\0') || p.includes('..')) return false;
    const abs = path.join(rootDir, p);
    // Ausbruch aus dem Projektverzeichnis ausschliessen.
    if (!abs.startsWith(rootDir)) return false;
    try {
      return fs.statSync(abs).isFile();
    } catch (e) {
      return false;
    }
  }

  return function staticGuard(req, res, next) {
    if (istErlaubt(req.path)) return next();

    // Wichtig: nur ABLEHNEN, wenn dort wirklich eine Datei liegt. Sonst
    // weiterreichen — hinter express.static sind noch 89 API-Routen und die
    // 404-Seite registriert. Wuerde hier stumpf jeder nicht freigegebene Pfad
    // geblockt, waeren Bewertungen, Retouren, Newsletter und das komplette
    // Admin-Dashboard tot (beim Testen genau so passiert).
    if (!existiertAlsDatei(req.path)) return next();

    // 404 statt 403: kein Hinweis darauf, dass die Datei existiert.
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Nicht gefunden' });
    }
    return res.status(404).type('txt').send('Nicht gefunden');
  };
}

module.exports = { createStaticGuard, collectReferencedAssets, PUBLIC_DIRS, PUBLIC_EXT };
