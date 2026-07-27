/**
 * csp-policy.js — Content-Security-Policy: welche Quellen im Browser laufen duerfen.
 *
 * Wozu: Bei Shops ist eingeschleuster Fremdcode die Standard-Angriffsstelle
 * ("Magecart"). Gelingt es jemandem, ein Skript unterzubringen, liest es
 * unbemerkt Adress- und Zahlungsdaten mit. Eine CSP gibt dem Browser vorab die
 * Liste der erlaubten Quellen und blockt alles andere.
 *
 * ⚠️ EHRLICHE EINORDNUNG DER SCHUTZWIRKUNG
 * Der Shop hat 59 HTML-Dateien mit Inline-Skripten und rund 1500
 * style="..."-Attribute. Deshalb muss 'unsafe-inline' erlaubt bleiben — der
 * saubere Weg (Nonces) hiesse, jede dieser Dateien und jedes zur Laufzeit
 * erzeugte Skript umzubauen. Was diese Richtlinie damit leistet und was nicht:
 *
 *   ✅ blockiert nachgeladene Fremdskripte (<script src="https://boese.tld/x.js">)
 *      — der uebliche Weg, auf dem Schadcode ueberhaupt erst hereinkommt
 *   ✅ blockiert das Abfliessen von Daten an unbekannte Server (connect-src)
 *   ✅ blockiert <object>/<embed>, fremde Frames und veraenderte Formularziele
 *   ❌ blockiert KEINEN direkt in die Seite geschriebenen Inline-Code
 *
 * Das ist trotzdem der wirksamste Einzelschritt, der ohne Umbau des gesamten
 * Frontends moeglich ist. Nonces waeren der naechste Ausbauschritt.
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

// Live-Chat (ai-chat-integration.js, derzeit mit Platzhalter-IDs inaktiv —
// aufgenommen, damit das Aktivieren spaeter nicht an der CSP scheitert).
const TAWK = ['https://embed.tawk.to', 'https://*.tawk.to'];
const TAWK_WS = ['wss://*.tawk.to'];
const OPENAI = ['https://api.openai.com'];

// Die eigene Domain ausdruecklich mitfuehren. Grund: index.html bindet das
// Logo als absolute Adresse ein (https://maiosshop.com/images/logo.png). Wird
// der Shop ueber die Render-Ersatzadresse aufgerufen, ist das eine ANDERE
// Herkunft als 'self' — der Browser wuerde das Logo blockieren. Genau das ist
// beim Testen aufgetreten.
const EIGENE_DOMAIN = ['https://maiosshop.com', 'https://www.maiosshop.com'];

const dedupe = (arr) => [...new Set(arr.filter(Boolean))];

/** Baut den Header-Wert der Richtlinie. */
function buildCsp() {
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
    'script-src': dedupe([
      "'self'", "'unsafe-inline'", STRIPE_SCRIPT, CDN, ...GA, ...META, ...TIKTOK, ...TAWK
    ]),
    'style-src': dedupe(["'self'", "'unsafe-inline'", FONT_CSS, CDN, ...TAWK]),
    'font-src': dedupe(["'self'", 'data:', FONT_FILES, CDN, ...TAWK]),
    // data: fuer eingebettete Platzhalter, blob: fuer im Browser erzeugte Bilder.
    'img-src': dedupe(["'self'", 'data:', 'blob:', ...EIGENE_DOMAIN, ...META_IMG, ...GA_CONNECT, ...TIKTOK, ...TAWK]),
    'connect-src': dedupe([
      "'self'", ...STRIPE_CONNECT, ...ADRESSSUCHE, ...GEO_DIENSTE,
      ...GA_CONNECT, ...META, ...TIKTOK, ...TAWK, ...TAWK_WS, ...OPENAI
    ]),
    'frame-src': dedupe([...STRIPE_FRAME, ...TAWK]),
    // Produktvideos liegen im Shop selbst.
    'media-src': ["'self'"],
    'worker-src': ["'self'", 'blob:']
  };

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ') + '; upgrade-insecure-requests';
}

const CSP_VALUE = buildCsp();

/** true = scharf blockieren, false = nur beobachten und melden. */
function isEnforcing() {
  return (process.env.CSP_ENFORCE || '').trim() === 'true';
}

/** Header-Name je nach Modus. */
function headerName() {
  return isEnforcing() ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

module.exports = { buildCsp, CSP_VALUE, isEnforcing, headerName };
