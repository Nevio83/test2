/**
 * Tests fuer die Fingerabdruecke des erlaubten Inline-Codes.
 *
 * Warum ausgerechnet hier: Stimmt ein Fingerabdruck nicht, blockiert der
 * Browser das Skript der Seite — und zwar LAUTLOS. Beim Bauen waren zwei
 * Seiten ohne jede Fehlermeldung funktionslos; weder Konsole noch
 * Verstossmeldung sagten etwas. Aufgefallen ist es nur, weil dieselbe Seite
 * mit abgeschaltetem Schutz lief und ohne nicht.
 *
 * Der erste Test unten ist genau dieser Fehler: der HTML-Parser wandelt
 * Windows-Zeilenenden in \n um, BEVOR er den Fingerabdruck bildet. Wer ueber
 * die Rohbytes rechnet, liegt bei jeder solchen Datei daneben.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  hash, normalisiere, skripteAusHtml, handlerAusText, htmlEntkoden,
  jsEntmaskieren, baueIndex
} = require('../csp-inline');

test('Windows-Zeilenenden ergeben denselben Fingerabdruck wie Unix', () => {
  const unix = "console.log('hallo');\nconsole.log('welt');\n";
  const windows = unix.replace(/\n/g, '\r\n');
  assert.notEqual(unix, windows, 'die Texte unterscheiden sich in den Bytes');
  assert.equal(hash(unix), hash(windows),
    'genau hier lagen zwei Seiten lautlos still');
});

test('einzelnes Wagenrücklauf-Zeichen wird ebenfalls normalisiert', () => {
  assert.equal(normalisiere('a\rb'), 'a\nb');
  assert.equal(normalisiere('a\r\nb'), 'a\nb');
  assert.equal(normalisiere('a\nb'), 'a\nb');
});

test('Fingerabdruck hat die vom Browser erwartete Form', () => {
  const h = hash('x');
  assert.match(h, /^'sha256-[A-Za-z0-9+/]+=*'$/);
});

test('unterschiedlicher Code ergibt unterschiedliche Fingerabdrücke', () => {
  assert.notEqual(hash('a=1'), hash('a=2'));
});

test('Inline-Skripte werden erkannt, externe nicht', () => {
  const html = `
    <script src="app.js"></script>
    <script>var a = 1;</script>
    <script type="text/javascript">var b = 2;</script>
    <script></script>
  `;
  const treffer = [...skripteAusHtml(html)];
  assert.equal(treffer.length, 2, 'nur die beiden Inline-Blöcke');
  assert.ok(treffer.some((t) => t.includes('var a = 1')));
  assert.ok(treffer.some((t) => t.includes('var b = 2')));
});

test('Ereignisbehandler werden mit beiden Anführungszeichen erkannt', () => {
  const html = `<button onclick="tu(1)">a</button><img onerror='weg(this)'>`;
  const treffer = [...handlerAusText(html, false)];
  assert.equal(treffer.length, 2);
  assert.ok(treffer.includes('tu(1)'));
  assert.ok(treffer.includes('weg(this)'));
});

test('HTML-Entitäten werden aufgelöst — der Browser sieht das Zeichen', () => {
  assert.equal(htmlEntkoden('a &amp;&amp; b'), 'a && b');
  assert.equal(htmlEntkoden('x &lt; y'), 'x < y');
  assert.equal(htmlEntkoden('sag &quot;hallo&quot;'), 'sag "hallo"');
  assert.equal(htmlEntkoden('it&#39;s'), "it's");
});

test('Maskierung aus JS-Zeichenketten wird aufgelöst', () => {
  // Im Quelltext steht \' — im ausgelieferten Markup steht '.
  assert.equal(jsEntmaskieren("x=\\'y\\'"), "x='y'");
  assert.equal(jsEntmaskieren('a\\"b'), 'a"b');
  // Template-Literale maskieren nicht -> unveraendert.
  assert.equal(jsEntmaskieren("this.style.display='none'"), "this.style.display='none'");
});

test('Behandler mit eingesetztem Wert wird gemeldet', () => {
  // Solche Behandler haben bei jedem Aufruf einen anderen Fingerabdruck und
  // sind grundsaetzlich nicht absicherbar — sie muessen auffallen.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'));
  fs.writeFileSync(path.join(tmp, 'a.html'),
    '<script>el.innerHTML = `<b onclick="loesche(${id})">x</b>`;</script>');
  const { statistik } = baueIndex(tmp);
  assert.ok(statistik.meldungen.length >= 1, 'muss gemeldet werden');
  assert.match(statistik.meldungen[0], /loesche/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('konstanter Behandler wird NICHT gemeldet', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'));
  fs.writeFileSync(path.join(tmp, 'a.html'),
    '<script>el.innerHTML = `<b onclick="loesche(this.dataset.id)">x</b>`;</script>');
  const { statistik } = baueIndex(tmp);
  assert.equal(statistik.meldungen.length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('das echte Projekt hat keine Behandler mit eingesetzten Werten', () => {
  // Faellt eine neue Stelle dazu, blockiert die Schutzregel sie im Browser —
  // die Schaltflaeche tut dann nichts, ohne Fehlermeldung. Hier faellt es auf.
  const { statistik } = baueIndex(path.join(__dirname, '..'));
  assert.equal(statistik.meldungen.length, 0,
    'gefunden: ' + statistik.meldungen.slice(0, 3).join(' | '));
  assert.ok(statistik.seiten > 50, 'es müssen alle Seiten erfasst sein');
});

test('jede Seite bekommt ihre eigenen Fingerabdrücke', () => {
  const { index } = baueIndex(path.join(__dirname, '..'));
  const start = index.get('/index.html');
  const korb = index.get('/cart.html');
  assert.ok(Array.isArray(start) && Array.isArray(korb));
  assert.notDeepEqual(start, korb, 'Seiten dürfen nicht dieselbe Liste bekommen');
  assert.ok(index.get('/'), 'die Startseite muss auch unter "/" erreichbar sein');
  assert.deepEqual(index.get('/'), start);
});

test('unbekannter Pfad liefert null, nicht eine leere Liste', () => {
  // Der Unterschied zaehlt: eine leere Liste heisst "Seite ohne Inline-Code"
  // und wird streng behandelt, null heisst "unbekannte Seite" und bekommt die
  // Grundfassung. Wer das verwechselt, legt Seiten stumm oder schuetzt zu wenig.
  const { createInlineHashes } = require('../csp-inline');
  const echt = console.log; console.log = () => {};
  const nachschlager = createInlineHashes(path.join(__dirname, '..'));
  console.log = echt;
  assert.equal(nachschlager.fuerPfad('/gibt-es-nicht.html'), null);
  assert.ok(Array.isArray(nachschlager.fuerPfad('/index.html')));
});
