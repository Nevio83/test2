/**
 * Tests fuer den Notausgang bei bezahlten Bestellungen.
 *
 * Anlass, am 22.09.2026 live eingetreten: Die Neon-Datenbank war am
 * Kontingent und verweigerte JEDE Verbindung. `/api/receipt/create` — die
 * Route, die die Bestellung speichert — lief in ihren catch-Zweig,
 * protokollierte den Fehler und warf die Nutzdaten weg.
 *
 * Das Besondere daran: Diese Route wird vom BROWSER des Kunden aufgerufen,
 * nachdem Stripe zurueckgeleitet hat (checkout-receipt.js). Anders als beim
 * Stripe-Webhook, den Stripe tagelang wiederholt, gibt es hier keinen zweiten
 * Versuch. Das Geld war kassiert, und Warenkorb, Adresse und Zahlungsbezug
 * waren weg — ohne dass irgendwo etwas davon stand.
 *
 * Zwei Dinge werden hier abgesichert:
 *   1. Der Server rettet die Nutzdaten (Mail + Datei) statt sie zu verwerfen.
 *   2. Der Kunde liest NICHT, dass etwas fehlgeschlagen sei. Er hat gerade
 *      bezahlt; "Fehler" laedt zum zweiten Kauf ein.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(WURZEL, 'checkout-receipt.js'), 'utf8');

/** Schneidet den catch-Zweig von /api/receipt/create heraus. */
function catchZweigDerBelegRoute() {
  const start = server.indexOf("app.post('/api/receipt/create'");
  assert.ok(start > 0, 'Route /api/receipt/create nicht gefunden');
  const ende = server.indexOf("app.get('/api/receipt/order/", start);
  assert.ok(ende > start, 'Ende der Route nicht gefunden');
  const block = server.slice(start, ende);
  const c = block.lastIndexOf('} catch (error) {');
  assert.ok(c > 0, 'catch-Zweig der Route nicht gefunden');
  return block.slice(c);
}

test('die Rettung wird im catch-Zweig der Beleg-Route aufgerufen', () => {
  const zweig = catchZweigDerBelegRoute();
  assert.match(
    zweig, /await retteBezahlteBestellung\(req\.body, error\)/,
    'Der catch-Zweig muss die Nutzdaten retten — sonst ist eine bezahlte Bestellung weg.'
  );
});

test('die Rettung bekommt die VOLLSTAENDIGEN Nutzdaten, nicht nur die Mailadresse', () => {
  const zweig = catchZweigDerBelegRoute();
  // req.body traegt cart, customer, payment, shipping. Wer hier nur die
  // E-Mail weiterreicht, kann die Bestellung hinterher nicht nachbauen.
  assert.match(zweig, /retteBezahlteBestellung\(req\.body/,
    'Es muss req.body uebergeben werden, nicht ein Ausschnitt daraus.');
});

test('die Rettung kann selbst nicht werfen', () => {
  const i = server.indexOf('async function retteBezahlteBestellung');
  assert.ok(i > 0, 'retteBezahlteBestellung nicht gefunden');
  const ende = server.indexOf('\n}', server.indexOf('return { perMail', i));
  const koerper = server.slice(i, ende);

  // Sie laeuft INNERHALB eines catch. Eine Ausnahme hier wuerde den
  // urspruenglichen Fehler ersetzen — die Rettung waere genau dann kaputt,
  // wenn sie gebraucht wird.
  assert.ok(koerper.includes('try {'), 'Die Rettung muss ihren eigenen try-Block haben.');
  assert.ok(/catch \(e\) \{/.test(koerper), 'Die Rettung muss ihre eigenen Fehler abfangen.');
  assert.ok(!/\bthrow\b/.test(koerper), 'Die Rettung darf nicht werfen.');
});

test('die Rettung schreibt nicht NUR eine Datei', () => {
  const i = server.indexOf('async function retteBezahlteBestellung');
  const koerper = server.slice(i, server.indexOf('\n}', server.indexOf('return { perMail', i)));
  // Renders Dateisystem ist fluechtig — dieselbe Ueberlegung wie beim
  // GoBD-Belegarchiv. Eine Datei allein waere nach dem naechsten Deploy weg.
  assert.ok(/sendOpsAlert\(/.test(koerper),
    'Die Rettung muss die Daten per Mail hinausschicken, nicht nur auf die Platte.');
});

test('die Antwort sagt dem Kunden, dass die ZAHLUNG sicher ist', () => {
  const zweig = catchZweigDerBelegRoute();
  assert.match(zweig, /zahlungSicher:\s*true/, 'Die Antwort muss zahlungSicher melden.');
  assert.match(zweig, /kundenhinweis:/, 'Die Antwort muss einen Text fuer den Kunden tragen.');
  assert.match(zweig, /NICHT noch einmal bestellen/i,
    'Der Text muss ausdruecklich vom zweiten Kauf abraten.');
});

test('die Antwort bleibt ein 500 — der Fehlerzaehler soll sie sehen', () => {
  const zweig = catchZweigDerBelegRoute();
  assert.match(zweig, /res\.status\(500\)/,
    'Ein 200 wuerde den Ausfall vor der Ueberwachung verstecken.');
});

test('der Kunde sieht KEINE Fehlermeldung, sondern die Zahlungs-Bestaetigung', () => {
  // Der Weg im Client: !response.ok -> showZahlungSicher, nicht showError.
  const i = client.indexOf('if (!response.ok)');
  assert.ok(i > 0, 'Die Stelle mit !response.ok fehlt');
  const block = client.slice(i, i + 1400);
  assert.ok(block.includes('showZahlungSicher('),
    'Bei !response.ok muss showZahlungSicher laufen.');
  assert.ok(!/throw new Error\('Fehler bei der Kassenbon-Erstellung'\)/.test(block),
    'Der alte Wurf landete in showError und damit bei "Fehler" — genau das soll weg.');
});

test('showZahlungSicher ist nicht rot', () => {
  const i = client.indexOf('showZahlungSicher(message)');
  assert.ok(i > 0, 'showZahlungSicher fehlt');
  const koerper = client.slice(i, i + 900);
  // Rot heisst fuer den Kunden "fehlgeschlagen, nochmal versuchen" — und ein
  // zweiter Versuch waere hier eine zweite Zahlung.
  assert.ok(!koerper.includes('#dc3545'),
    'Die Bestaetigung darf nicht die Fehlerfarbe der Kasse benutzen.');
  assert.match(koerper, /Zahlung eingegangen/,
    'Die Ueberschrift muss mit dem Geld anfangen, nicht mit dem Beleg.');
});

test('die Rettung meldet den Mailversand ehrlich, nicht pauschal Erfolg', () => {
  const i = server.indexOf('async function retteBezahlteBestellung');
  const koerper = server.slice(i, server.indexOf('\n}', server.indexOf('return { perMail', i)));

  // Beim ersten Testlauf stand hier `perMail = true` direkt nach dem
  // sendOpsAlert-Aufruf. Ohne RESEND_API_KEY ging keine Mail raus, und die
  // Rettung meldete trotzdem "Mail: ja". Eine Rettung, die faelschlich Erfolg
  // meldet, ist schlimmer als gar keine — man verlaesst sich darauf.
  assert.ok(!/perMail\s*=\s*true\s*;/.test(koerper),
    'perMail darf nicht hart auf true gesetzt werden.');
  assert.match(koerper, /perMail\s*=\s*Boolean\(versandt\)/,
    'perMail muss aus dem Rueckgabewert von sendOpsAlert kommen.');

  // Und sendOpsAlert muss diesen Rueckgabewert ueberhaupt liefern.
  const j = server.indexOf('function sendOpsAlert');
  const alert = server.slice(j, j + 1300);
  assert.match(alert, /return false;/,
    'sendOpsAlert muss im Fehlerfall false liefern, nicht undefined.');
});

test('die Notfall-Dateien sind gitignored — sie enthalten Kundendaten', () => {
  // Das Repo ist oeffentlich. In den Dateien stehen Name, Anschrift, E-Mail
  // und Warenkorb echter Kunden. Die Regel receipts/*.pdf deckte sie nicht ab,
  // hier entsteht JSON.
  const ignore = fs.readFileSync(path.join(WURZEL, '.gitignore'), 'utf8');
  assert.match(ignore, /^receipts\/notfall\/$/m,
    'receipts/notfall/ muss in .gitignore stehen.');

  // Gegenprobe: Die alte Regel allein haette nicht gereicht.
  const nurPdf = 'receipts/*.pdf';
  assert.ok(!/notfall/.test(nurPdf),
    'Gegenprobe wertlos: die alte Regel duerfte notfall nicht erfassen.');
});

test('GEGENPROBE: der alte Zustand waere hier rot geworden', () => {
  // Der Stand vor dem 22.09. — so sah der catch-Zweig aus:
  const alterZweig = [
    '} catch (error) {',
    "  console.error('Kassenbon-Erstellung Fehler:', error);",
    '  res.status(500).json({',
    "    error: 'Fehler bei der Kassenbon-Erstellung'",
    '  });',
    '}',
  ].join('\n');

  // Genau die drei Eigenschaften, die oben geprueft werden, fehlen ihm.
  assert.ok(!/retteBezahlteBestellung/.test(alterZweig),
    'Gegenprobe wertlos: der alte Zweig duerfte nicht retten.');
  assert.ok(!/zahlungSicher/.test(alterZweig),
    'Gegenprobe wertlos: der alte Zweig duerfte nichts ueber die Zahlung sagen.');
  assert.ok(!/NICHT noch einmal bestellen/i.test(alterZweig),
    'Gegenprobe wertlos: der alte Zweig duerfte nicht vom zweiten Kauf abraten.');

  // Und der alte Client-Weg fuehrte nach showError.
  const alterClient = "if (!response.ok) {\n  throw new Error('Fehler bei der Kassenbon-Erstellung');\n}";
  assert.ok(!alterClient.includes('showZahlungSicher'),
    'Gegenprobe wertlos: der alte Client duerfte die Bestaetigung nicht kennen.');
});
