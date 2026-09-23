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
  if (!v) return null;
  // Der Einkaufspreis bei CJ — gebraucht, um zu entscheiden, ob das Wallet
  // die Bestellung deckt. Fehlt er, bleibt er null, und es wird NICHT
  // automatisch bezahlt (siehe zahlweise()).
  const preis = Number(v.variantSellPrice);
  return {
    vid: String(v.vid),
    bezeichnung: v.variantKey || v.variantNameEn || '',
    preis: Number.isFinite(preis) && preis > 0 ? preis : null,
  };
}

// ── IOSS und Bezahlung ─────────────────────────────────────────────────
//
// Seit dem 23.09.: CJ lehnte die erste echte Bestellung ab mit "Please enter
// a IOSS number". Ware aus China an Privatkunden in der EU unterliegt der
// Einfuhrumsatzsteuer, und CJ will wissen, wer sie zahlt (API-Doku,
// createOrderV2):
//   1 = kein IOSS — die KUNDIN zahlt Steuer plus Gebuehr an der Haustuer
//   2 = eigene IOSS-Nummer (iossNumber noetig)
//   3 = CJs IOSS — CJ legt aus und berechnet es uns; nur bis 150 € Warenwert
// Entscheidung Nevio vom 23.09.: CJs IOSS (3). Einstellbar ueber CJ_IOSS_TYPE.
//
// Bezahlung (payType): 2 = aus dem CJ-Wallet abbuchen, 3 = nur anlegen.
// CJ kann NICHT auf Stripe zugreifen — das Wallet wird per PayPal, Payoneer
// oder Ueberweisung aufgeladen. Deshalb wird nur dann automatisch bezahlt,
// wenn das Wallet die Bestellung sicher deckt; sonst angelegt und gemeldet.

const IOSS_GRENZE_EUR = 150;

// Bei CJs IOSS berechnet CJ die Einfuhrumsatzsteuer zusaetzlich zu Ware und
// Versand (in der EU bis 27 %, Deutschland 19 %). Die kennt diese Rechnung
// nicht vorab — also muss das Wallet 30 % mehr decken, bevor abgebucht wird.
const WALLET_PUFFER = 1.3;

/** Welche IOSS-Angabe geht mit? Wirft, wenn sie fuer diese Bestellung nicht passt. */
function iossAngabe({ iossType, iossNumber }, warenwertEur) {
  const typ = Number(iossType);
  if (![1, 2, 3].includes(typ)) {
    throw new Error(`keine gueltige IOSS-Einstellung (CJ_IOSS_TYPE=${iossType}) — erlaubt sind 1, 2, 3`);
  }
  // Ueber 150 € Warenwert gilt IOSS gesetzlich nicht. CJs IOSS verweigert
  // dann ohnehin, und "kein IOSS" hiesse: die Kundin zahlt an der Haustuer.
  // Beides soll ein Mensch entscheiden, nicht der Automat.
  if (typ !== 1 && Number(warenwertEur) > IOSS_GRENZE_EUR) {
    throw new Error(`Warenwert ${Number(warenwertEur).toFixed(2)} € liegt ueber ${IOSS_GRENZE_EUR} € — IOSS gilt nicht, bitte von Hand verzollen`);
  }
  if (typ === 2 && !iossNumber) {
    throw new Error('eigene IOSS gewaehlt (CJ_IOSS_TYPE=2), aber keine Nummer hinterlegt (CJ_IOSS_NUMBER)');
  }
  return typ === 2 ? { iossType: 2, iossNumber: String(iossNumber) } : { iossType: typ };
}

/**
 * Aus dem Wallet bezahlen (2) oder nur anlegen (3)?
 *
 * Automatisch bezahlt wird NUR, wenn das Guthaben bekannt ist und die
 * geschaetzten Kosten samt Puffer fuer die Steuer deckt. Ein unbekanntes
 * Guthaben (Notbetrieb) oder ein unbekannter Preis fuehrt zu "nur anlegen" —
 * lieber eine Bestellung von Hand bezahlen als eine, die an einem leeren
 * Wallet haengen bleibt. Beide Werte sind in CJs Waehrung (USD).
 */
function zahlweise(guthaben, kosten) {
  if (!Number.isFinite(guthaben) || !Number.isFinite(kosten) || kosten <= 0) return 3;
  return guthaben >= kosten * WALLET_PUFFER ? 2 : 3;
}

/**
 * Was der Versandweg WIRKLICH kostet.
 *
 * freightCalculate liefert zwei Preise, und der naheliegende ist der falsche:
 * `logisticPrice` war fuer die Mond-Lampe 7,72 $, berechnet hat CJ bei der
 * echten Bestellung am 23.09. aber 11,22 $ — genau `totalPostageFee`. Also
 * zaehlt totalPostageFee; logisticPrice nur, wenn CJ den Gesamtpreis nicht
 * mitschickt.
 */
function versandPreis(o) {
  const gesamt = Number(o && o.totalPostageFee);
  if (Number.isFinite(gesamt) && gesamt > 0) return gesamt;
  return Number(o && o.logisticPrice);
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
  return optionen.slice().sort((a, b) => versandPreis(a) - versandPreis(b))[0];
}

/** Die Nutzlast in dem flachen Format, das CJs createOrderV2 erwartet. */
function baueNutzlast({ bestellnummer, adresse, name, email, telefon, positionen, logisticName, ioss, payType }) {
  const land = String(adresse.country || '').toUpperCase();
  return {
    ...(ioss || {}),
    ...(payType ? { payType } : {}),
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
 *                        warenwertEur, positionen: [{ sku, quantity, bezeichnung }] }
 * @param {object} [e]  { iossType, iossNumber, guthaben } — aus der Umgebung
 * @returns {Promise<{nutzlast, versand, positionen, kosten, payType}>}
 * @throws  mit einer Meldung, die sagt, WAS fehlt
 */
async function bereiteVor(api, b, e = {}) {
  // IOSS zuerst: Passt sie nicht (ueber 150 €, keine Nummer), braucht es
  // gar keine Anfrage an CJ.
  const ioss = iossAngabe(
    { iossType: e.iossType === undefined ? 3 : e.iossType, iossNumber: e.iossNumber },
    b.warenwertEur
  );
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
    aufgeloest.push({ sku: p.sku, vid: v.vid, quantity: menge, bezeichnung: v.bezeichnung || was, preis: v.preis });
  }

  const versand = await guenstigsterVersand(api, aufgeloest, String(a.country).toUpperCase());
  if (!versand) throw new Error(`CJ bietet keinen Versand nach ${a.country} fuer diese Varianten an`);

  // Geschaetzte Kosten in CJs Waehrung (USD): Ware + Versand, ohne Steuer.
  // Fehlt ein Preis, ist die Summe unbekannt — dann wird nicht automatisch
  // bezahlt.
  const warePreise = aufgeloest.map((p) => (p.preis === null ? NaN : p.preis * p.quantity));
  const kosten = warePreise.reduce((s, x) => s + x, 0) + versandPreis(versand);
  const payType = zahlweise(Number(e.guthaben), kosten);

  const nutzlast = baueNutzlast({
    bestellnummer: bestellnummerFuer(b.zahlungsId, b.bestellId),
    adresse: a,
    name: b.name,
    email: b.email,
    telefon: b.telefon,
    positionen: aufgeloest,
    logisticName: versand.logisticName,
    ioss,
    payType,
  });
  return { nutzlast, versand, positionen: aufgeloest, kosten, payType };
}

/**
 * Guthaben im CJ-Wallet, oder NaN, wenn es nicht sicher bekannt ist.
 * NaN fuehrt in zahlweise() zu "nur anlegen" — nie blind abbuchen.
 */
async function walletGuthaben(api) {
  try {
    const r = await api.getBalance();
    if (ausDemNotbetrieb(r)) return NaN;
    const betrag = Number(r && r.data && r.data.amount);
    return Number.isFinite(betrag) ? betrag : NaN;
  } catch (_) {
    return NaN;
  }
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

/**
 * Hat CJ die Bestellung wirklich bezahlt? true / false / null (unbekannt).
 *
 * Nicht aus payType ableiten: payType 2 heisst nur "bitte aus dem Wallet
 * abbuchen". Reicht das Guthaben am Ende doch nicht (die Steuer kennt man
 * vorher nicht genau), bleibt die Bestellung unbezahlt liegen — und CJ
 * verschickt nichts. Deshalb wird bei CJ nachgefragt. Die echte, unbezahlte
 * Bestellung vom 23.09. stand dort auf orderStatus CREATED, paymentDate null.
 */
const UNBEZAHLT = new Set(['CREATED', 'IN_CART', 'UNPAID']);
async function istBezahlt(api, cjBestellnummer) {
  try {
    const r = await api.getOrderDetail(encodeURIComponent(cjBestellnummer));
    if (ausDemNotbetrieb(r) || !r.data) return null;
    if (r.data.paymentDate) return true;
    const status = String(r.data.orderStatus || '').toUpperCase();
    if (!status) return null;
    return !UNBEZAHLT.has(status);
  } catch (_) {
    return null;
  }
}

module.exports = {
  HERKUNFT, LAENDERNAMEN, IOSS_GRENZE_EUR, WALLET_PUFFER,
  ausDemNotbetrieb, bestellnummerFuer, vidFuerSku, versandPreis, guenstigsterVersand,
  iossAngabe, zahlweise, walletGuthaben,
  baueNutzlast, bereiteVor, bestelle, istBezahlt,
};
