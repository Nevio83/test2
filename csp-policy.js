/**
 * csp-policy.js — Content-Security-Policy: welche Quellen im Browser laufen duerfen.
 *
 * Wozu: Bei Shops ist eingeschleuster Fremdcode die Standard-Angriffsstelle
 * ("Magecart"). Gelingt es jemandem, ein Skript unterzubringen, liest es
 * unbemerkt Adress- und Zahlungsdaten mit. Eine CSP gibt dem Browser vorab die
 * Liste der erlaubten Quellen und blockt alles andere.
 *
 * ⚠️ EHRLICHE EINORDNUNG DER SCHUTZWIRKUNG
 *
 *   ✅ blockiert nachgeladene Fremdskripte (<script src="https://boese.tld/x.js">)
 *      — der uebliche Weg, auf dem Schadcode ueberhaupt erst hereinkommt
 *   ✅ blockiert das Abfliessen von Daten an unbekannte Server (connect-src)
 *   ✅ blockiert <object>/<embed>, fremde Frames und veraenderte Formularziele
 *   ✅ blockiert eingeschleusten Inline-Code — seit die Hashes des erlaubten
 *      Inline-Codes je Seite mitgegeben werden (csp-inline.js). Vorher stand
 *      hier 'unsafe-inline', womit JEDER in die Seite geschriebene Code lief.
 *   ⚠️ style-src erlaubt weiterhin 'unsafe-inline': rund 1500 style="..."-
 *      Attribute. Eingeschleustes CSS kann Seiten verunstalten, aber keine
 *      Daten abgreifen — der Hebel liegt eindeutig bei script-src.
 *
 * Notausstieg: CSP_ALLOW_INLINE_SCRIPTS=true stellt das alte Verhalten wieder
 * her ('unsafe-inline' in script-src). Gedacht fuer den Fall, dass in
 * Produktion doch eine Seite haengt — eine falsche CSP legt eine Seite still,
 * und dann muss ein einziger Schalter genuegen, kein Deploy.
 *
 * Jede Quelle unten ist belegt: sie stammt aus einer Fundstelle im Code, nicht
 * aus einer Vermutung. Fehlt eine, blockiert der Browser sie — deshalb laeuft
 * die Richtlinie standardmaessig nur im BEOBACHTUNGSMODUS mit (meldet, blockt
 * nicht). Scharf geschaltet wird erst per CSP_ENFORCE=true.
 */

// Stripe: Zahlung. js.stripe.com laedt Stripe.js (cart.html + cart.js),
// api.stripe.com nimmt die Aufrufe entgegen, checkout./hooks.stripe.com sind
// Weiterleitungs- und Frame-Ziele der gehosteten Kasse.
const STRIPE_SCRIPT = 'https://js.stripe.com';
const STRIPE_CONNECT = ['https://api.stripe.com'];
const STRIPE_FRAME = ['https://js.stripe.com', 'https://hooks.stripe.com', 'https://checkout.stripe.com'];

// Adress-Vervollstaendigung im Warenkorb (cart.js, 5 Fundstellen). Fehlt das,
// findet der Kunde an der Kasse seine Adresse nicht mehr.
const ADRESSSUCHE = ['https://nominatim.openstreetmap.org'];

// IP-Standortbestimmung (geolocation-tracker.js, nur index.html). Aufgenommen,
// um das bestehende Verhalten nicht stillschweigend zu veraendern — eine
// Sicherheits-Kopfzeile ist der falsche Ort, um nebenbei Funktionen abzuschalten.
// Hinweis: dieses Skript fragt die Dienste OHNE Cookie-Einwilligung ab
// (anders als site-integrations.js) — separat zu klaeren, nicht hier.
const GEO_DIENSTE = [
  'https://geolocation-db.com',
  'https://ipapi.co',
  'https://ipwhois.app',
  'http://ip-api.com',
  'https://ip-api.com'
];

// Schriften + Icons (index.html, alle Produktseiten, 404.html)
const FONT_CSS = 'https://fonts.googleapis.com';
const FONT_FILES = 'https://fonts.gstatic.com';
const CDN = 'https://cdn.jsdelivr.net';

// Tracking — laedt nur nach Cookie-Einwilligung (site-integrations.js),
// muss aber erlaubt sein, sonst greift die Einwilligung ins Leere.
const GA = ['https://www.googletagmanager.com'];
const GA_CONNECT = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com'
];
const META = ['https://connect.facebook.net'];
const META_IMG = ['https://www.facebook.com'];
const TIKTOK = ['https://analytics.tiktok.com'];

// Live-Chat (site-integrations.js -> loadTawk, laedt nur mit TAWK_PROPERTY_ID —
// aufgenommen, damit das Aktivieren spaeter nicht an der CSP scheitert).
const TAWK = ['https://embed.tawk.to', 'https://*.tawk.to'];
const TAWK_WS = ['wss://*.tawk.to'];
// api.openai.com stand hier fuer den OpenAI-Rueckfall in ai-chat-integration.js.
// Diese Datei ist entfernt (sie war durch site-integrations.js abgeloest und
// wurde von keiner Seite mehr eingebunden), damit ist der Eintrag unbelegt —
// und jede unbelegte Quelle ist eine Adresse mehr, an die der Browser Daten
// schicken duerfte. Wird der Chat spaeter mit OpenAI gebaut, kommt sie zurueck.

// Die eigene Domain ausdruecklich mitfuehren. Grund: index.html bindet das
// Logo als absolute Adresse ein (https://maiosshop.com/images/logo.png). Wird
// der Shop ueber die Render-Ersatzadresse aufgerufen, ist das eine ANDERE
// Herkunft als 'self' — der Browser wuerde das Logo blockieren. Genau das ist
// beim Testen aufgetreten.
const EIGENE_DOMAIN = ['https://maiosshop.com', 'https://www.maiosshop.com'];

const dedupe = (arr) => [...new Set(arr.filter(Boolean))];

/** true = 'unsafe-inline' bleibt in script-src (Notausstieg, siehe Kopf). */
function erlaubtInlineSkripte() {
  return (process.env.CSP_ALLOW_INLINE_SCRIPTS || '').trim() === 'true';
}

/**
 * Baut den Header-Wert der Richtlinie.
 * @param {string[]} [skriptHashes] Hashes des auf DIESER Seite erlaubten
 *   Inline-Codes (aus csp-inline.js). Ohne Angabe bleibt 'unsafe-inline'
 *   stehen — das gilt fuer Antworten, die gar kein Markup sind.
 */
function buildCsp(skriptHashes, stilHashes) {
  // Verschaerft wird, sobald die Seite BEKANNT ist — also eine Liste vorliegt,
  // auch eine leere. Eine leere Liste heisst "diese Seite hat gar keinen
  // Inline-Code", und das ist der beste Fall, nicht der unsicherste.
  // (Vorher stand hier "&& length > 0"; dadurch bekam markt-insights.html, die
  // ohne Inline-Code auskommt, ausgerechnet die laschere Richtlinie.)
  // Fehlt die Liste ganz (null), ist die Seite unbekannt — dann lieber
  // 'unsafe-inline' als eine stillgelegte Seite.
  const verschaerfen = Array.isArray(skriptHashes) && !erlaubtInlineSkripte();

  const skriptQuellen = verschaerfen
    // 'unsafe-hashes' ist noetig, damit die Hashes auch fuer onclick & Co.
    // gelten — fuer <script>-Bloecke allein braeuchte es das nicht.
    ? ["'self'", "'unsafe-hashes'", ...skriptHashes, STRIPE_SCRIPT, CDN, ...GA, ...META, ...TIKTOK, ...TAWK]
    : ["'self'", "'unsafe-inline'", STRIPE_SCRIPT, CDN, ...GA, ...META, ...TIKTOK, ...TAWK];

  const directives = {
    'default-src': ["'self'"],
    // Verhindert, dass eingeschleustes <base href> alle relativen Pfade umbiegt.
    'base-uri': ["'self'"],
    // Flash/Java-Altlasten haben in einem Shop nichts verloren.
    'object-src': ["'none'"],
    // Schutz gegen Clickjacking (loest X-Frame-Options ab, das bleibt zusaetzlich).
    'frame-ancestors': ["'self'"],
    // Formulare duerfen nur zum Shop selbst oder zur Stripe-Kasse abschicken —
    // ein umgebogenes Formularziel wuerde sonst Adressdaten abgreifen.
    'form-action': ["'self'", 'https://checkout.stripe.com'],
    'script-src': dedupe(skriptQuellen),
    // Grundfassung — gilt zugleich als Rueckfall fuer aeltere Browser, die
    // style-src-elem/-attr noch nicht kennen. Die bekommen das alte Verhalten.
    'style-src': dedupe(["'self'", "'unsafe-inline'", FONT_CSS, CDN, ...TAWK]),
    'font-src': dedupe(["'self'", 'data:', FONT_FILES, CDN, ...TAWK]),
    // data: fuer eingebettete Platzhalter, blob: fuer im Browser erzeugte Bilder.
    'img-src': dedupe(["'self'", 'data:', 'blob:', ...EIGENE_DOMAIN, ...META_IMG, ...GA_CONNECT, ...TIKTOK, ...TAWK]),
    'connect-src': dedupe([
      "'self'", ...STRIPE_CONNECT, ...ADRESSSUCHE, ...GEO_DIENSTE,
      ...GA_CONNECT, ...META, ...TIKTOK, ...TAWK, ...TAWK_WS
    ]),
    'frame-src': dedupe([...STRIPE_FRAME, ...TAWK]),
    // Produktvideos liegen im Shop selbst.
    'media-src': ["'self'"],
    'worker-src': ["'self'", 'blob:']
  };

  // ── Gestaltung: <style>-Bloecke schaerfen, style="…"-Attribute nicht ──
  //
  // style-src deckt BEIDES ab und braucht deshalb 'unsafe-inline'. Die
  // CSP-Stufe 3 trennt das:
  //   style-src-elem  -> <style>-Bloecke und <link rel=stylesheet>
  //   style-src-attr  -> style="…"-Attribute
  //
  // Der Shop hat rund 1500 style="…"-Attribute; die bleiben erlaubt, daran
  // aendert sich nichts. Aber ein EINGESCHLEUSTER <style>-Block koennte die
  // ganze Seite umgestalten — etwa den echten Kasse-Knopf unsichtbar machen
  // und einen falschen darueberlegen. Genau das wird hier zugemacht.
  //
  // Ehrlich zur Reichweite: Datenabfluss ueber CSS (background:url(…)) war nie
  // moeglich, den deckt img-src ab. Und wer Markup einschleusen kann, kann
  // weiterhin eigene Elemente mit style="…" mitbringen. Der Gewinn ist also
  // begrenzt — aber er kostet nichts an Funktion.
  //
  // Ohne Hash-Liste (stilHashes == null) bleibt es bei der alten Regel. Das
  // passiert, wenn sich bei einer Seite auch nur ein Stylesheet nicht
  // eindeutig bestimmen liess — lieber kein Gewinn als eine Seite ohne
  // Gestaltung.
  if (Array.isArray(stilHashes) && !erlaubtInlineSkripte()) {
    directives['style-src-elem'] = dedupe([
      "'self'", ...stilHashes, FONT_CSS, CDN, ...TAWK
    ]);
    directives['style-src-attr'] = ["'unsafe-inline'"];
  }

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ') + '; upgrade-insecure-requests';
}

/** Grundfassung ohne Seitenbezug (Antworten, die kein Markup sind). */
const CSP_VALUE = buildCsp();

/** true = scharf blockieren, false = nur beobachten und melden. */
function isEnforcing() {
  return (process.env.CSP_ENFORCE || '').trim() === 'true';
}

/** Header-Name je nach Modus. */
function headerName() {
  return isEnforcing() ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

module.exports = { buildCsp, CSP_VALUE, isEnforcing, headerName, erlaubtInlineSkripte };
