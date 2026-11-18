/**
 * Was AGB, Versandseite, Datenschutzerklärung und Produktseiten über die
 * Kasse sagen, stimmt mit der Kasse überein.
 *
 * BEFUND VOM 15.10. (Lese-Analyse, am 21.10. am Code bestätigt):
 *   - Die AGB nannten PayPal und Vorkasse. Die Kasse bietet Karte und Klarna
 *     an (server.js, payment_method_types) — PayPal stand außerdem in der
 *     Fußzeile der Startseite, als Knopf im Warenkorb („Mit PayPal bezahlen"
 *     führte in eine Kasse ohne PayPal) und auf allen 40 Produktseiten.
 *   - Die AGB lieferten nur nach DE und AT in 3–5 Werktagen. Die Kasse nimmt
 *     11 Länder an (LIEFERLAENDER), die Lieferzeit steht je Produkt in
 *     products.json und liegt zwischen 6 und 20 Werktagen.
 *   - Die Versandseite nannte pauschal 7–13 Werktage und 4,99 € außerhalb
 *     Europas (tatsächlich USA 12 €); ihr Rechner und der Warenkorb boten
 *     Kanada, Australien, Japan, Brasilien und Mexiko an — Länder, deren
 *     Adresse Stripe danach ablehnt.
 *   - 22 Produktseiten nannten im Datenblatt eine andere Lieferzeit als im
 *     Kopf derselben Seite und in products.json.
 *   - Die Datenschutzerklärung erwähnte jsDelivr nicht, obwohl zehn
 *     Kundenseiten Bootstrap von dort laden (IP-Adresse geht an Dritte).
 *
 * Warum ein Test: Keiner dieser Widersprüche erzeugt eine Fehlermeldung. Die
 * Kasse funktioniert, die Seiten sehen richtig aus — falsch ist nur, was dort
 * steht, und das merkt erst ein Kunde oder ein Abmahner. Geprüft wird deshalb
 * immer gegen die Quelle, aus der die Kasse selbst liest: payment_method_types
 * in server.js, LIEFERLAENDER und FLAT_SHIPPING_COSTS in shipping-calculator.js,
 * shippingTime in products.json. Ändert sich die Quelle, wird der Text rot.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { LIEFERLAENDER, FLAT_SHIPPING_COSTS } = require('../shipping-calculator');
const { PUBLIC_ROOT_HTML } = require('../static-guard');

const WURZEL = path.join(__dirname, '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const sortiert = (menge) => [...menge].sort();

const ohneHtmlKommentare = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const ohneJsKommentare = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
// Was ein Besucher liest: ohne Skripte und Kommentare.
const sichtbar = (html) => ohneHtmlKommentare(html).replace(/<script\b[\s\S]*?<\/script>/gi, '');

/** Ein Abschnitt der AGB: vom <h2> mit `kopf` bis zum nächsten <h2>. */
function abschnitt(html, kopf) {
  const start = html.search(new RegExp(`<h2[^>]*>\\s*${kopf}\\b`));
  assert.ok(start >= 0, `Abschnitt "${kopf}" nicht gefunden`);
  const ende = html.indexOf('<h2', start + 3);
  return html.slice(start, ende < 0 ? undefined : ende);
}

// Alles, was ein Kunde zu sehen bekommt: die freigegebenen Seiten im
// Wurzelverzeichnis, Produkt- und Infoseiten, und die zwei Skripte, die
// sichtbaren Text bauen (Warenkorb, Startseite).
const KUNDENSEITEN = [
  ...sortiert(PUBLIC_ROOT_HTML),
  ...['produkte', 'infos'].flatMap((o) => fs.readdirSync(path.join(WURZEL, o))
    .filter((n) => n.endsWith('.html')).map((n) => `${o}/${n}`)),
];
const KUNDENSKRIPTE = ['cart.js', 'home.js'];

// ── Zahlarten ───────────────────────────────────────────────────────────────

/** Die Zahlarten, die server.js an Stripe meldet (payment_method_types). */
function zahlartenDerKasse(quelle) {
  const start = /const paymentMethods = \[([^\]]*)\]/.exec(quelle);
  if (!start || !/payment_method_types:\s*paymentMethods/.test(quelle)) return null;
  const typen = new Set([...start[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
  for (const m of quelle.matchAll(/paymentMethods\.push\('([a-z_]+)'\)/g)) typen.add(m[1]);
  return typen;
}

// Wie eine Zahlart in Kundentexten heißt. Google Pay und Apple Pay laufen bei
// Stripe über 'card' (Express-Knöpfe), deshalb zählen sie dazu.
const ZAHLARTEN = [
  { typ: 'card', name: 'Karte', muster: /Kreditkarte|Debitkarte|\bKarte\b|Google Pay|Apple Pay|Visa|Mastercard/i },
  { typ: 'klarna', name: 'Klarna', muster: /Klarna/ },
  { typ: 'paypal', name: 'PayPal', muster: /PayPal/i },
  { typ: 'customer_balance', name: 'Vorkasse/Überweisung', muster: /Vorkasse|Banküberweisung|per Überweisung/i },
  { typ: 'sepa_debit', name: 'Lastschrift', muster: /Lastschrift/i },
  { typ: 'giropay', name: 'giropay', muster: /giropay/i },
  { typ: 'nachnahme', name: 'Nachnahme', muster: /Nachnahme/i },
];

/** Zahlarten, die ein Text nennt, die Kasse aber nicht anbietet. */
function fremdeZahlarten(text, kasse) {
  return ZAHLARTEN.filter((z) => !kasse.has(z.typ) && z.muster.test(text)).map((z) => z.name);
}

const KASSE = zahlartenDerKasse(lies('server.js'));

test('die Zahlarten der Kasse lassen sich aus server.js lesen', () => {
  // Fiele das Auslesen still auf eine leere Menge zurück, wäre jede andere
  // Prüfung hier wertlos — deshalb ausdrücklich.
  assert.ok(KASSE, 'paymentMethods / payment_method_types in server.js nicht gefunden');
  assert.deepStrictEqual(sortiert(KASSE), ['card', 'klarna']);
  for (const typ of KASSE) {
    assert.ok(ZAHLARTEN.some((z) => z.typ === typ), `Zahlart "${typ}" hat keinen Eintrag in ZAHLARTEN`);
  }
});

test('kein Kundentext nennt eine Zahlart, die die Kasse nicht anbietet', () => {
  const funde = [];
  for (const rel of KUNDENSEITEN) {
    const f = fremdeZahlarten(ohneHtmlKommentare(lies(rel)), KASSE);
    if (f.length) funde.push(`${rel}: ${f.join(', ')}`);
  }
  for (const rel of KUNDENSKRIPTE) {
    const f = fremdeZahlarten(ohneJsKommentare(lies(rel)), KASSE);
    if (f.length) funde.push(`${rel}: ${f.join(', ')}`);
  }
  assert.deepStrictEqual(funde, []);
});

test('die AGB nennen jede Zahlart der Kasse', () => {
  const agb = sichtbar(abschnitt(lies('infos/agb.html'), '§4'));
  for (const typ of KASSE) {
    const z = ZAHLARTEN.find((e) => e.typ === typ);
    assert.match(agb, z.muster, `AGB §4 nennt ${z.name} nicht`);
  }
});

test('Gegenprobe Zahlarten: alter Stand und eine Kasse ohne Klarna wären aufgefallen', () => {
  const altAgb = '<li>Kreditkarte (Visa, Mastercard)</li><li>PayPal</li><li>Klarna</li>'
    + '<p>Die Zahlung erfolgt wahlweise per Vorkasse oder über einen der angebotenen Zahlungsdienstleister.</p>';
  assert.deepStrictEqual(fremdeZahlarten(altAgb, KASSE), ['PayPal', 'Vorkasse/Überweisung']);
  assert.deepStrictEqual(fremdeZahlarten('<div class="pp-guarantee-sub">Stripe · PayPal · Karte</div>', KASSE), ['PayPal']);
  // Dieselbe Prüfung liest wirklich server.js: ohne die Klarna-Zeile wäre
  // "Klarna" in den heutigen AGB ein Fund.
  const ohneKlarna = zahlartenDerKasse(lies('server.js').replace(/paymentMethods\.push\('klarna'\)/, ''));
  assert.deepStrictEqual(sortiert(ohneKlarna), ['card']);
  assert.deepStrictEqual(fremdeZahlarten(sichtbar(abschnitt(lies('infos/agb.html'), '§4')), ohneKlarna), ['Klarna']);
});

// ── Lieferländer ────────────────────────────────────────────────────────────

// Deutsche Namen, wie sie in Texten vorkommen. Auch Länder, in die NICHT
// geliefert wird — nur so fällt auf, wenn ein Text sie trotzdem nennt.
const LAENDERNAMEN = {
  DE: /Deutschland/, AT: /Österreich/, CH: /Schweiz/, FR: /Frankreich/, IT: /Italien/,
  ES: /Spanien/, NL: /Niederlande/, BE: /Belgien/, PL: /Polen/,
  US: /\bUSA\b|Vereinigte(?:n)? Staaten/, GB: /Vereinigte[sn]? Königreich|Großbritannien/,
  CA: /Kanada/, AU: /Australien/, JP: /Japan/, BR: /Brasilien/, MX: /Mexiko/,
  CN: /China/, KR: /Korea/, SG: /Singapur/, NZ: /Neuseeland/, AR: /Argentinien/,
};

const genannteLaender = (text) => Object.keys(LAENDERNAMEN).filter((l) => LAENDERNAMEN[l].test(text)).sort();

/** Ländercodes der <option>s in <select id="…">. */
function optionen(quelle, id) {
  const block = new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`).exec(quelle);
  assert.ok(block, `<select id="${id}"> nicht gefunden`);
  return [...block[0].matchAll(/<option value="([A-Z]{2})"/g)].map((m) => m[1]).sort();
}

// Polen fehlt im Warenkorb, weil cart.js keine Złoty-Anzeige kennt (die Kasse
// rechnet für PL in PLN). Polnische Adressen nimmt Stripe trotzdem an. Wer PL
// im Warenkorb ergänzt, nimmt es hier heraus.
const NICHT_IM_WARENKORB = ['PL'];

test('jedes Lieferland hat einen deutschen Namen für die Prüfung', () => {
  for (const l of LIEFERLAENDER) assert.ok(LAENDERNAMEN[l], `Lieferland ${l} fehlt in LAENDERNAMEN`);
});

test('AGB §5 und Versandseite nennen genau die Lieferländer der Kasse', () => {
  const soll = sortiert(LIEFERLAENDER);
  assert.deepStrictEqual(genannteLaender(sichtbar(abschnitt(lies('infos/agb.html'), '§5'))), soll, 'AGB §5');
  assert.deepStrictEqual(genannteLaender(sichtbar(lies('infos/versand.html'))), soll, 'infos/versand.html');
});

test('Versandrechner und Warenkorb bieten nur Länder an, die die Kasse annimmt', () => {
  assert.deepStrictEqual(optionen(lies('infos/versand.html'), 'shipCountry'), sortiert(LIEFERLAENDER));
  const warenkorb = optionen(lies('cart.js'), 'country');
  assert.deepStrictEqual(warenkorb.filter((l) => !LIEFERLAENDER.includes(l)), [], 'Warenkorb bietet Länder an, die Stripe ablehnt');
  assert.deepStrictEqual(sortiert([...warenkorb, ...NICHT_IM_WARENKORB]), sortiert(LIEFERLAENDER));
});

test('Gegenprobe Länder: alte AGB und alter Versandrechner wären aufgefallen', () => {
  const altAgb = '<p>Die Lieferung erfolgt innerhalb Deutschlands und Österreichs mit DHL oder UPS.</p>';
  assert.deepStrictEqual(genannteLaender(altAgb), ['AT', 'DE']);
  assert.notDeepStrictEqual(genannteLaender(altAgb), sortiert(LIEFERLAENDER));
  const altRechner = '<select id="shipCountry"><option value="DE">Deutschland</option>'
    + '<option value="US">USA</option><option value="CA">Kanada</option><option value="MX">Mexiko</option></select>';
  assert.deepStrictEqual(optionen(altRechner, 'shipCountry').filter((l) => !LIEFERLAENDER.includes(l)), ['CA', 'MX']);
});

// ── Versandkosten ───────────────────────────────────────────────────────────

/** Die Länder mit Versandkosten und ihre Beträge, laut shipping-calculator.js. */
const KOSTENPFLICHTIG = LIEFERLAENDER.filter((l) => FLAT_SHIPPING_COSTS[l] > 0);

/** Alle Euro-Beträge eines Textes ("12,00 €", "4,99€", "20€"). */
const betraege = (text) => [...text.matchAll(/(\d+(?:,\d{2})?)\s*(?:€|EUR\b)/g)]
  .map((m) => Number(m[1].replace(',', '.')));

/** Kopie der Preistabelle in einem Browser-Skript: { DE: 0, US: 12, … } */
function preistabelle(quelle) {
  const block = /const shippingCosts = \{([\s\S]*?)\};/.exec(quelle);
  assert.ok(block, 'const shippingCosts = {…} nicht gefunden');
  return Object.fromEntries([...block[1].matchAll(/'([A-Z]{2})':\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
}

function abweichendePreise(tabelle) {
  return LIEFERLAENDER.filter((l) => tabelle[l] !== FLAT_SHIPPING_COSTS[l])
    .map((l) => `${l}: ${tabelle[l]} statt ${FLAT_SHIPPING_COSTS[l]}`);
}

test('die Preistabellen in Versandrechner und Warenkorb sind dieselben wie in der Kasse', () => {
  assert.deepStrictEqual(abweichendePreise(preistabelle(lies('infos/versand.html'))), [], 'infos/versand.html');
  assert.deepStrictEqual(abweichendePreise(preistabelle(lies('cart.js'))), [], 'cart.js');
});

test('AGB §3 und Versandseite nennen genau die Versandkosten der Kasse', () => {
  const soll = [...new Set(KOSTENPFLICHTIG.map((l) => FLAT_SHIPPING_COSTS[l]))].sort();
  const texte = {
    'AGB §3': sichtbar(abschnitt(lies('infos/agb.html'), '§3')),
    'infos/versand.html': sichtbar(lies('infos/versand.html')),
  };
  for (const [wo, text] of Object.entries(texte)) {
    assert.deepStrictEqual([...new Set(betraege(text))].sort(), soll, `${wo}: Beträge`);
    for (const l of KOSTENPFLICHTIG) assert.match(text, LAENDERNAMEN[l], `${wo} nennt das kostenpflichtige Land ${l} nicht`);
  }
});

test('Gegenprobe Versandkosten: 4,99 € und eine abweichende Kopie wären aufgefallen', () => {
  assert.deepStrictEqual(betraege('<li>Außerhalb Europas: 4,99€ Versandkosten</li>'), [4.99]);
  assert.deepStrictEqual(betraege('Kostenfrei in Europa, weltweit 12-20€'), [20]);
  const falsch = "const shippingCosts = { 'DE': 0, 'AT': 0, 'CH': 0, 'FR': 0, 'IT': 0, 'ES': 0, 'NL': 0, "
    + "'BE': 0, 'GB': 0, 'PL': 0, 'US': 9.00 };";
  assert.deepStrictEqual(abweichendePreise(preistabelle(falsch)), ['US: 9 statt 12']);
});

// ── Lieferzeit ──────────────────────────────────────────────────────────────

const PRODUKTE = JSON.parse(lies('products.json'));
const spanne = (text) => [...text.matchAll(/(\d+)\s*[-–]\s*(\d+)\s*Werktage/g)].map((m) => `${m[1]}-${m[2]}`);
const ZEITEN = PRODUKTE.map((p) => /(\d+)\s*[-–]\s*(\d+)/.exec(p.shippingTime || '')).filter(Boolean);
const KUERZESTE = Math.min(...ZEITEN.map((m) => Number(m[1])));
const LAENGSTE = Math.max(...ZEITEN.map((m) => Number(m[2])));

/** Lieferzeit-Angaben einer Produktseite, die nicht zu products.json passen. */
function falscheLieferzeiten(html, produkt) {
  const soll = spanne(produkt.shippingTime)[0];
  return spanne(html).filter((s) => s !== soll).map((s) => `${s} statt ${soll}`);
}

/** Pauschale Lieferzeiten in einem Infotext, die nicht die echte Spanne sind. */
function falscheSpannen(text) {
  const echt = `${KUERZESTE}-${LAENGSTE}`;
  const genannt = [...spanne(text),
    ...[...text.matchAll(/zwischen (\d+) und (\d+) Werktagen/g)].map((m) => `${m[1]}-${m[2]}`)];
  return genannt.filter((s) => s !== echt);
}

test('jedes Produkt hat eine Lieferzeit in products.json', () => {
  assert.strictEqual(ZEITEN.length, PRODUKTE.length);
});

test('jede Produktseite nennt überall die Lieferzeit aus products.json', () => {
  const funde = [];
  for (const name of fs.readdirSync(path.join(WURZEL, 'produkte')).filter((n) => n.endsWith('.html'))) {
    const html = lies(`produkte/${name}`);
    const id = /data-product-id="(\d+)"/.exec(html);
    if (!id) continue;
    const produkt = PRODUKTE.find((p) => Number(p.id) === Number(id[1]));
    assert.ok(produkt, `${name}: Produkt ${id[1]} fehlt in products.json`);
    const f = falscheLieferzeiten(html, produkt);
    if (f.length) funde.push(`${name}: ${f.join(', ')}`);
  }
  assert.deepStrictEqual(funde, []);
});

test('AGB und Versandseite nennen keine erfundene Pauschal-Lieferzeit', () => {
  assert.deepStrictEqual(falscheSpannen(lies('infos/agb.html')), [], 'infos/agb.html');
  assert.deepStrictEqual(falscheSpannen(lies('infos/versand.html')), [], 'infos/versand.html');
});

test('Gegenprobe Lieferzeit: das alte Datenblatt und die alten Pauschalen wären aufgefallen', () => {
  const flasche = PRODUKTE.find((p) => Number(p.id) === 13);
  assert.deepStrictEqual(falscheLieferzeiten('<div class="pp-spec-value">6-11 Werktage</div>', flasche),
    [`6-11 statt ${spanne(flasche.shippingTime)[0]}`]);
  assert.deepStrictEqual(falscheSpannen('<li>Lieferzeit: 7–13 Werktage</li>'), ['7-13']);
  assert.deepStrictEqual(falscheSpannen('Die Lieferzeit beträgt 3-5 Werktage.'), ['3-5']);
});

// ── Datenschutzerklärung: Fremdquellen ──────────────────────────────────────

// Fremde Server, von denen Kundenseiten Dateien laden, und wie die
// Datenschutzerklärung sie nennt. `nurWennGeladen`: Der Abschnitt ist veraltet,
// sobald keine Seite mehr von dort lädt (Stripe bleibt als Zahlungsdienstleister
// genannt, auch ohne eingebundenes Skript).
const FREMDQUELLEN = {
  'cdn.jsdelivr.net': { name: /jsDelivr/, nurWennGeladen: true },
  'js.stripe.com': { name: /Stripe/, nurWennGeladen: false },
};
const EIGENE = new Set(['maiosshop.com', 'www.maiosshop.com']);

/** Fremde Hosts, die eine Seite per <script src> oder <link href> einbindet. */
function fremdeHosts(html) {
  const hosts = [...ohneHtmlKommentare(html).matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="https?:\/\/([^/"]+)/gi)]
    .map((m) => m[1].toLowerCase());
  return [...new Set(hosts)].filter((h) => !EIGENE.has(h)).sort();
}

/** Was in der Datenschutzerklärung fehlt oder veraltet ist. */
function datenschutzLuecken(seiten, datenschutz) {
  const geladen = new Set(seiten.flatMap(fremdeHosts));
  const luecken = [];
  for (const host of geladen) {
    const q = FREMDQUELLEN[host];
    if (!q) luecken.push(`${host}: unbekannte Fremdquelle — in die Datenschutzerklärung und in FREMDQUELLEN aufnehmen`);
    else if (!q.name.test(datenschutz)) luecken.push(`${host}: in der Datenschutzerklärung nicht genannt`);
  }
  for (const [host, q] of Object.entries(FREMDQUELLEN)) {
    if (q.nurWennGeladen && !geladen.has(host) && q.name.test(datenschutz)) {
      luecken.push(`${host}: wird von keiner Seite mehr geladen, steht aber noch in der Datenschutzerklärung`);
    }
  }
  return luecken.sort();
}

/** Sätze, die eine Weitergabe an Dritte verneinen und dabei einen genutzten Dienst nennen. */
const verneinteDritte = (text) => (text.replace(/z\.(?:&nbsp;|\s)*B\./g, 'zB')
  .match(/[^.]*\bkeine\b[^.]*\bDritte[^.]*Google Analytics[^.]*/gi) || [])
  .map((s) => s.replace(/<[^>]+>/g, '').trim());

const DATENSCHUTZ = sichtbar(lies('infos/datenschutz.html'));
const SEITEN_HTML = KUNDENSEITEN.map(lies);

test('jede fremde Quelle, die eine Kundenseite lädt, steht in der Datenschutzerklärung', () => {
  assert.deepStrictEqual(datenschutzLuecken(SEITEN_HTML, DATENSCHUTZ), []);
  // Die Datenschutzerklärung nennt Warenkorb und sich selbst als Beispiele.
  for (const rel of ['cart.html', 'infos/datenschutz.html']) {
    assert.ok(fremdeHosts(lies(rel)).includes('cdn.jsdelivr.net'), `${rel} lädt nicht mehr von jsDelivr — Beispiel im Text anpassen`);
  }
});

test('nachgeladene Dienste (Google Analytics, Standortdienste) stehen in der Datenschutzerklärung', () => {
  // Diese Dienste stehen nicht als <script src> im Markup, sondern werden
  // nach der Einwilligung von site-integrations.js bzw. geolocation-tracker.js
  // nachgeladen — die Prüfung oben sieht sie deshalb nicht.
  assert.match(lies('site-integrations.js'), /googletagmanager\.com\/gtag\/js/);
  // Nur den Namen zu finden reicht nicht: Bis 21.10. stand er im Satz "Es
  // werden keine … Daten an Dritte (z. B. Google Analytics) übermittelt" —
  // während die GA4-Kennung live gesetzt war.
  assert.match(DATENSCHUTZ, /Google Analytics[\s\S]{0,200}Google Ireland Limited/, 'Google Analytics ohne Anbieterangabe');
  assert.deepStrictEqual(verneinteDritte(DATENSCHUTZ), []);
  const apis = /this\.apis = \[([\s\S]*?)\]/.exec(lies('geolocation-tracker.js'));
  assert.ok(apis, 'Liste der Standortdienste in geolocation-tracker.js nicht gefunden');
  const hosts = [...apis[1].matchAll(/https?:\/\/([^/'"]+)/g)].map((m) => m[1]);
  assert.ok(hosts.length >= 1);
  for (const host of hosts) assert.ok(DATENSCHUTZ.includes(host), `Standortdienst ${host} fehlt in der Datenschutzerklärung`);
});

test('Gegenprobe Datenschutz: fehlendes jsDelivr, Google Fonts und ein veralteter Abschnitt wären aufgefallen', () => {
  const ohneJsdelivr = DATENSCHUTZ.replace(/jsDelivr/g, 'XYZ');
  assert.deepStrictEqual(datenschutzLuecken(SEITEN_HTML, ohneJsdelivr), ['cdn.jsdelivr.net: in der Datenschutzerklärung nicht genannt']);
  const mitGoogle = ['<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">'];
  assert.deepStrictEqual(datenschutzLuecken(mitGoogle, DATENSCHUTZ), [
    'cdn.jsdelivr.net: wird von keiner Seite mehr geladen, steht aber noch in der Datenschutzerklärung',
    'fonts.googleapis.com: unbekannte Fremdquelle — in die Datenschutzerklärung und in FREMDQUELLEN aufnehmen',
  ]);
  const altSatz = 'Es werden <strong>keine</strong> Klarnamen, IP-Adressen oder Daten an Dritte '
    + '(z.&nbsp;B. Google Analytics) übermittelt – die Auswertung läuft ausschließlich auf unseren eigenen Systemen.';
  assert.strictEqual(verneinteDritte(altSatz).length, 1);
});
