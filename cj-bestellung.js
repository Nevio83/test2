/**
 * cj-bestellung.js — baut aus einer bezahlten Shop-Bestellung die Bestellung
 * bei CJ Dropshipping.
 *
 * WARUM ES DIESES MODUL GIBT (23.09.2026)
 * Die erste echte Bestellung — eine Krystall Ball Nachtlampe, Farbe "Mond" —
 * wurde bezahlt und kam bei CJ nie an. Die automatische Bestellung konnte nie
 * funktionieren, und zwar an vier Stellen gleichzeitig:
 *
 *   1. Als `vid` ging die SKU des PRODUKTS raus (CJJT153840401AZ). CJ erwartet
 *      die Varianten-Nummer (1555129918705643520), und zwar die der
 *      GEWAEHLTEN Farbe, nicht irgendeiner.
 *   2. Die Adresse ging als verschachteltes Objekt raus. CJ erwartet flache
 *      Felder (shippingCustomerName, shippingCity, shippingZip ...).
 *   3. `fromCountryCode: 'DE'` — die Ware liegt aber in China.
 *   4. `shippingMethod: 'Standard'` statt eines Versandwegs, den CJ kennt.
 *
 * Dieser Code wurde nie gegen die echte Schnittstelle geprueft, weil es bis
 * dahin keine echte Bestellung gab.
 *
 * WAS ES JETZT TUT
 * Jede Position wird ueber ihre SKU bei CJ nachgeschlagen
 * (product/query?variantSku=...), und nur die dort gefundene Varianten-Nummer
 * geht in die Bestellung. Der Versandweg ist der guenstigste, den CJ fuer
 * genau diese Varianten nach genau diesem Land anbietet — bei 3 Cent Marge
 * (Krystall Ball) entscheidet das ueber Gewinn oder Verlust.
 *
 * LIEBER GAR NICHT BESTELLEN ALS DAS FALSCHE
 * Fehlt irgendetwas — Adresse, SKU, Varianten-Nummer, Versandweg — wirft
 * bereiteVor() mit einer Meldung, die sagt, WAS fehlt. Der Webhook schickt
 * dann eine Warnmail. Eine halbe Bestellung waere schlimmer: Sie saehe im
 * CJ-Konto aus wie eine richtige.
 */

'use strict';

// Die Ware liegt bei CJ in China. Das gilt fuer alle 27 Produkte, deren
// Versand am 07.09. abgefragt wurde.
const HERKUNFT = 'CN';

// CJ verlangt neben dem Laendercode den Laendernamen. Fuer Laender, die hier
// nicht stehen, geht der Code selbst mit — das ist besser als nichts und
// faellt spaetestens bei CJ auf.
const LAENDERNAMEN = {
  DE: 'Germany', AT: 'Austria', CH: 'Switzerland', FR: 'France', IT: 'Italy',
  ES: 'Spain', NL: 'Netherlands', BE: 'Belgium', LU: 'Luxembourg', PL: 'Poland',
  DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', CZ: 'Czech Republic',
  PT: 'Portugal', IE: 'Ireland', GB: 'United Kingdom', US: 'United States',
};

/**
 * Bestellnummer fuer CJ — gebunden an die ZAHLUNG, nicht zufaellig.
 *
 * Stripe schickt den Webhook erneut, wenn er scheitert. Bisher bekam jede
 * Bestellung bei jedem Durchlauf eine neue Zufallsnummer; ein zweiter
 * Durchlauf haette bei CJ ein zweites Mal bestellt. Mit einer Nummer, die an
 * der Zahlung haengt, weist CJ das Duplikat ab.
 */
function bestellnummerFuer(zahlungsId, rueckfall) {
  const basis = String(zahlungsId || rueckfall || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!basis) throw new Error('keine Zahlungs-ID fuer die CJ-Bestellnummer');
  return `MAIOS-${basis}`.slice(0, 50);
}

/**
 * Kommt die Antwort aus dem Notbetrieb statt von CJ?
 *
 * Der CJ-Client wirft bei Ablehnungen nicht, sondern faellt auf
 * cj-fallback-system.js zurueck — und das liefert fuer Produkte und Versand
 * ausgedachte Werte (Versandkosten: 0). Fuer eine echte Bestellung ist jede
 * ausgedachte Zahl falsch, also wird sie hier wie ein Fehler behandelt.
 */
function ausDemNotbetrieb(r) {
  return !r || r.source === 'fallback';
}

/** Varianten-Nummer (vid) zu einer SKU — direkt bei CJ nachgeschlagen. */
async function vidFuerSku(api, sku) {
  if (!sku) return null;
  const r = await api.makeRequest(
    '/api2.0/v1/product/query?' + new URLSearchParams({ variantSku: sku }), 'GET'
  );
  if (ausDemNotbetrieb(r)) throw new Error(`CJ nicht erreichbar beim Nachschlagen von ${sku}`);
  const varianten = (r && r.data && Array.isArray(r.data.variants)) ? r.data.variants : [];
  const v = varianten.find((x) => x && x.variantSku === sku);
  return v ? { vid: String(v.vid), bezeichnung: v.variantKey || v.variantNameEn || '' } : null;
}

/** Guenstigster Versandweg, den CJ fuer genau diese Varianten anbietet. */
async function guenstigsterVersand(api, positionen, zielLand) {
  const r = await api.freightCalculate({
    startCountryCode: HERKUNFT,
    endCountryCode: zielLand,
    products: positionen.map((p) => ({ vid: p.vid, quantity: p.quantity })),
  });
  // Der Notbetrieb rechnet Versand mit 0 € — bei 3 Cent Marge waere das die
  // Differenz zwischen "lohnt sich" und "Verlust".
  if (ausDemNotbetrieb(r)) throw new Error('CJ nicht erreichbar bei der Versandabfrage');
  const optionen = (r && Array.isArray(r.data)) ? r.data.filter((o) => o && o.logisticName) : [];
  if (!optionen.length) return null;
  return optionen.slice().sort((a, b) => Number(a.logisticPrice) - Number(b.logisticPrice))[0];
}

/** Die Nutzlast in dem flachen Format, das CJs createOrderV2 erwartet. */
function baueNutzlast({ bestellnummer, adresse, name, email, telefon, positionen, logisticName }) {
  const land = String(adresse.country || '').toUpperCase();
  return {
    orderNumber: bestellnummer,
    shippingCountryCode: land,
    shippingCountry: LAENDERNAMEN[land] || land,
    // In Deutschland gibt es keine Provinz. CJ verlangt das Feld trotzdem;
    // die Stadt ist die uebliche Belegung.
    shippingProvince: adresse.state || adresse.city || '',
    shippingCity: adresse.city || '',
    shippingZip: adresse.postal_code || '',
    shippingAddress: adresse.line1 || '',
    shippingAddress2: adresse.line2 || '',
    shippingCustomerName: name || '',
    shippingPhone: telefon || '',
    email: email || '',
    logisticName,
    fromCountryCode: HERKUNFT,
    products: positionen.map((p) => ({ vid: p.vid, quantity: p.quantity })),
  };
}

/**
 * Alles pruefen und die Bestellung vorbereiten. Bestellt NICHT selbst.
 *
 * @param {object} api  CJ-Client (makeRequest, freightCalculate)
 * @param {object} b    { zahlungsId, bestellId, adresse, name, email, telefon,
 *                        positionen: [{ sku, quantity, bezeichnung }] }
 * @returns {Promise<{nutzlast, versand, positionen}>}
 * @throws  mit einer Meldung, die sagt, WAS fehlt
 */
async function bereiteVor(api, b) {
  const fehlt = [];
  const a = b.adresse || {};
  if (!a.line1) fehlt.push('Strasse');
  if (!a.city) fehlt.push('Stadt');
  if (!a.postal_code) fehlt.push('PLZ');
  if (!a.country) fehlt.push('Land');
  if (!b.name) fehlt.push('Name');
  if (fehlt.length) throw new Error(`Lieferadresse unvollstaendig: ${fehlt.join(', ')} fehlt`);

  if (!Array.isArray(b.positionen) || !b.positionen.length) {
    throw new Error('keine Positionen in der Bestellung');
  }

  const aufgeloest = [];
  for (const p of b.positionen) {
    const was = p.bezeichnung || p.sku || '(unbenannt)';
    if (!p.sku) throw new Error(`keine SKU fuer "${was}" — Variante nicht bestimmbar`);
    const v = await vidFuerSku(api, p.sku);
    if (!v) throw new Error(`SKU ${p.sku} ("${was}") ist bei CJ nicht (mehr) zu finden`);
    const menge = Math.max(1, parseInt(p.quantity, 10) || 1);
    aufgeloest.push({ sku: p.sku, vid: v.vid, quantity: menge, bezeichnung: v.bezeichnung || was });
  }

  const versand = await guenstigsterVersand(api, aufgeloest, String(a.country).toUpperCase());
  if (!versand) throw new Error(`CJ bietet keinen Versand nach ${a.country} fuer diese Varianten an`);

  const nutzlast = baueNutzlast({
    bestellnummer: bestellnummerFuer(b.zahlungsId, b.bestellId),
    adresse: a,
    name: b.name,
    email: b.email,
    telefon: b.telefon,
    positionen: aufgeloest,
    logisticName: versand.logisticName,
  });
  return { nutzlast, versand, positionen: aufgeloest };
}

/**
 * Die vorbereitete Bestellung wirklich an CJ schicken.
 *
 * Erfolg ist NUR, was CJ selbst als Erfolg meldet — mit einer echten
 * Bestellnummer. Der alte Webhook las `cjOrder.orderId` (liegt aber unter
 * `data.orderId`) und behandelte jede Antwort ohne Ausnahme als Erfolg; im
 * Protokoll stand dann "CJ-Bestellung erstellt: undefined".
 */
async function bestelle(api, nutzlast) {
  const r = await api.createOrderV2(nutzlast);
  if (ausDemNotbetrieb(r)) {
    throw new Error((r && r.message) || 'CJ nicht erreichbar — keine Bestellung angelegt');
  }
  const d = r && r.data;
  const nummer = d && (d.orderId || d.orderNum || d.cjOrderId);
  const ok = r && (r.result === true || r.code === 200) && nummer;
  if (!ok) {
    const grund = (r && (r.message || r.msg)) || JSON.stringify(r).slice(0, 200);
    throw new Error(`CJ lehnte die Bestellung ab: ${grund}`);
  }
  return { cjBestellnummer: String(nummer), antwort: r };
}

module.exports = {
  HERKUNFT, LAENDERNAMEN,
  ausDemNotbetrieb, bestellnummerFuer, vidFuerSku, guenstigsterVersand,
  baueNutzlast, bereiteVor, bestelle,
};
