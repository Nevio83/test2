/**
 * HSTS — "diese Seite künftig nur noch verschlüsselt aufrufen"
 *
 * WAS DIE KOPFZEILE LOEST
 * Der Shop leitet http:// bereits per 301 auf https:// um. Diese Umleitung
 * geht aber selbst noch UNVERSCHLUESSELT ueber die Leitung. Wer im selben Netz
 * sitzt (offenes WLAN im Cafe), kann sie abfangen und den Besucher auf einer
 * unverschluesselten Verbindung festhalten — mitsamt Adresse und allem, was
 * ins Bestellformular getippt wird. Mit dieser Kopfzeile merkt sich der
 * Browser die Regel und ruft beim naechsten Mal von sich aus https:// auf.
 * Die abfangbare erste Anfrage entfaellt.
 *
 * WARUM SIE HEIKEL IST
 * Sie laesst sich nicht zurueckrufen. Ist sie einmal beim Besucher, gilt sie
 * fuer die angegebene Dauer — auch dann, wenn die Verschluesselung spaeter
 * ausfaellt (abgelaufenes Zertifikat, Umzug auf einen anderen Anbieter). Der
 * Shop waere fuer diese Besucher schlicht nicht erreichbar, und es gaebe
 * keinen Weg, das von aussen zu beschleunigen.
 *
 * DESHALB DREI VORSICHTSMASSNAHMEN
 *   1. Standard ist EIN TAG, nicht ein Jahr. Der schlimmste Fall ist damit
 *      ein Tag Wartezeit, kein Jahr. Laeuft es eine Woche ohne Zwischenfall,
 *      im Render-Dashboard HSTS_MAX_AGE=31536000 setzen — kein Deploy noetig.
 *   2. Untergeordnete Adressen (mail.…, shop.…) sind NICHT eingeschlossen.
 *      Sonst gilt die Regel auch fuer Adressen, die es heute noch gar nicht
 *      gibt. Bewusst per HSTS_INCLUDE_SUBDOMAINS=true zuschaltbar.
 *   3. "preload" gibt es hier gar nicht. Damit landet die Domain in einer
 *      Liste, die fest in den Browsern steckt; sie wieder herauszubekommen
 *      dauert Monate. Das gehoert nicht in eine Voreinstellung.
 */

const EIN_TAG = 86400;
const EIN_JAHR = 31536000;

/** Liest die Dauer aus der Umgebung. Unsinnige Werte fallen auf den Standard. */
function maxAge(env = process.env) {
  const roh = String(env.HSTS_MAX_AGE || '').trim();
  if (!/^\d+$/.test(roh)) return EIN_TAG;
  const zahl = Number(roh);
  // Mehr als ein Jahr bringt nichts und verlaengert nur den Weg zurueck.
  if (zahl > EIN_JAHR) return EIN_JAHR;
  return zahl;
}

/**
 * Kam diese Anfrage verschlüsselt an?
 *
 * Render beendet die Verschluesselung selbst und reicht die Auskunft in
 * x-forwarded-proto weiter — req.protocol allein sagt hinter einem solchen
 * Zwischenserver immer "http".
 *
 * Faelschbar ist die Kopfzeile nur fuer jemanden, der ohnehin unverschluesselt
 * spricht — und ueber eine unverschluesselte Verbindung ignorieren Browser die
 * HSTS-Angabe laut Standard. Der schlimmste Fall ist also: wirkungslos.
 */
function ueberHttps(req) {
  const weitergereicht = req && req.headers && req.headers['x-forwarded-proto'];
  const proto = String(weitergereicht || (req && req.protocol) || '').split(',')[0].trim();
  return proto.toLowerCase() === 'https';
}

/**
 * Der Kopfzeilen-Wert — oder null, wenn keine gesetzt werden soll.
 *
 * Null kommt in zwei Faellen: die Anfrage kam unverschluesselt (dann waere die
 * Angabe wirkungslos, und in der lokalen Entwicklung wuerde sie den eigenen
 * Browser auf https://localhost festnageln), oder die Dauer wurde auf 0
 * gesetzt — das ist der Notausstieg.
 */
function hstsWert(req, env = process.env) {
  if (!ueberHttps(req)) return null;
  const dauer = maxAge(env);
  if (dauer <= 0) return null;
  let wert = `max-age=${dauer}`;
  if (String(env.HSTS_INCLUDE_SUBDOMAINS || '').toLowerCase() === 'true') {
    wert += '; includeSubDomains';
  }
  return wert;
}

module.exports = { hstsWert, maxAge, ueberHttps, EIN_TAG, EIN_JAHR };
