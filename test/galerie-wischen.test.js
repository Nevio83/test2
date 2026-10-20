/**
 * Punkt 60: Die Produktgalerie auf dem Handy — Wischen und Hauptbild.
 *
 * ZWEI BEFUNDE VOM 15.10. (beim Lesen fuer die Zielseite gefunden):
 *  1. Wischen war kaputt. attachEventListeners rief `this.handleSwipe()` auf,
 *     definiert war aber nur eine lokale Konstante — jedes Loslassen nach dem
 *     Wischen warf einen TypeError, das Bild wechselte nie. Gerade auf dem
 *     Handy, wo die Besucher aus den Videos ankommen.
 *  2. Die Galerie erzeugte ein NEUES Hauptbild statt das vorhandene
 *     weiterzuverwenden. Fuer den Browser ein neues Element, gezeichnet erst
 *     nach dem Galerie-Aufbau — der "groesste Inhalt" rutschte nach hinten.
 *
 * Geprueft wird mit dem echten Code aus product-gallery-complete.js in einer
 * Sandbox mit einem kleinen DOM-Nachbau. Der Nachbau wirft wie der Browser
 * einen NotFoundError, wenn replaceChild das alte Element nicht findet — die
 * Gegenprobe zeigt, dass die alte Reihenfolge damit gescheitert waere.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATEI = path.join(__dirname, '..', 'product-gallery-complete.js');
const QUELLE = fs.readFileSync(DATEI, 'utf8').replace(/\r\n/g, '\n');

// ── Statisch: jeder this.x()-Aufruf trifft eine Methode der Klasse ──

function klassen(quelle) {
  const ergebnis = [];
  const muster = /^class (\w+) \{/gm;
  const starts = [];
  let m;
  while ((m = muster.exec(quelle))) starts.push({ name: m[1], start: m.index });
  starts.forEach((k, i) => {
    const ende = i + 1 < starts.length ? starts[i + 1].start : quelle.length;
    ergebnis.push({ name: k.name, text: quelle.slice(k.start, ende) });
  });
  return ergebnis;
}

/** Kommentare weg — der Kommentar zum behobenen Fehler zitiert den alten Aufruf woertlich. */
function ohneKommentare(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function unbekannteAufrufe(klassentext) {
  klassentext = ohneKommentare(klassentext);
  const methoden = new Set();
  for (const m of klassentext.matchAll(/^ {4}(?:async )?(\w+)\s*\([^)]*\)\s*\{/gm)) methoden.add(m[1]);
  const fehlend = [];
  for (const m of klassentext.matchAll(/this\.(\w+)\s*\(/g)) {
    if (!methoden.has(m[1])) fehlend.push(m[1]);
  }
  return fehlend;
}

test('jeder this.x()-Aufruf in der Galerie trifft eine Methode der Klasse', () => {
  const gefunden = klassen(QUELLE);
  assert.ok(gefunden.some((k) => k.name === 'ProductImageGallery'), 'Klasse nicht gefunden');
  for (const k of gefunden) {
    assert.deepStrictEqual(unbekannteAufrufe(k.text), [], `${k.name} ruft Methoden auf, die es nicht gibt`);
  }
});

test('Gegenprobe: der alte Wisch-Aufruf waere als unbekannt erkannt worden', () => {
  const alt = [
    'class Probe {',
    '    attachEventListeners() {',
    "        this.galleryContainer?.addEventListener('touchend', (e) => {",
    '            this.handleSwipe();',
    '        });',
    '        const handleSwipe = () => {};',
    '    }',
    '}',
  ].join('\n');
  assert.deepStrictEqual(unbekannteAufrufe(alt), ['handleSwipe']);
});

// ── Zur Laufzeit, mit DOM-Nachbau ───────────────────────────────────

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.className = '';
    this.style = {};
    this.textContent = '';
    this.handler = {};
    const el = this;
    this.classList = {
      add(c) { if (!el.className.split(' ').includes(c)) el.className = `${el.className} ${c}`.trim(); },
      remove(c) { el.className = el.className.split(' ').filter((x) => x !== c).join(' '); },
      contains(c) { return el.className.split(' ').includes(c); },
    };
  }
  _loesen(kind) {
    const i = this.children.indexOf(kind);
    if (i >= 0) this.children.splice(i, 1);
    kind.parentElement = null;
  }
  appendChild(kind) {
    if (kind.parentElement) kind.parentElement._loesen(kind);
    kind.parentElement = this;
    this.children.push(kind);
    return kind;
  }
  insertBefore(kind, vor) {
    if (vor && vor.parentElement !== this) throw new Error('NotFoundError: insertBefore');
    if (kind.parentElement) kind.parentElement._loesen(kind);
    kind.parentElement = this;
    if (vor) this.children.splice(this.children.indexOf(vor), 0, kind);
    else this.children.push(kind);
    return kind;
  }
  replaceChild(neu, alt) {
    const i = this.children.indexOf(alt);
    if (i < 0) throw new Error('NotFoundError: replaceChild — das alte Element ist kein Kind mehr');
    if (neu.parentElement) neu.parentElement._loesen(neu);
    this.children[i] = neu;
    neu.parentElement = this;
    alt.parentElement = null;
    return alt;
  }
  remove() { if (this.parentElement) this.parentElement._loesen(this); }
  get nextSibling() {
    const p = this.parentElement;
    return p ? p.children[p.children.indexOf(this) + 1] || null : null;
  }
  addEventListener(art, fn) { this.handler[art] = fn; }
  querySelectorAll() { return []; }
  alle(klasse) {
    const treffer = this.className.split(' ').includes(klasse) ? [this] : [];
    return treffer.concat(...this.children.map((k) => k.alle(klasse)));
  }
}

const BASIS = 'https://maiosshop.com/produkte/elektrischer-wasserspender-fuer-schreibtisch.html';

/** Laedt die Datei in eine Sandbox. `quelle` erlaubt eine veraenderte Fassung fuer Gegenproben. */
function lade(quelle = QUELLE) {
  const seite = new El('div');
  const vorher = seite.appendChild(new El('span'));
  const bild = new El('img');
  bild.className = 'main-product-image pp-main-img';
  bild.src = 'https://maiosshop.com/produkt%20bilder/Elektrischer%20Wasserspender%20f%C3%BCr%20Schreibtisch.jpg';
  seite.appendChild(bild);
  const nachher = seite.appendChild(new El('p'));
  const document = {
    baseURI: BASIS,
    body: { dataset: {} },
    querySelector: (sel) => (sel.includes('main-product-image') ? bild : null),
    querySelectorAll: () => [],
    createElement: (tag) => new El(tag),
    addEventListener: () => {},
  };
  const ctx = { document, console: { log() {}, warn() {}, error() {} }, URL, setTimeout };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(quelle, ctx);
  const galerie = Object.create(ctx.ProductImageGallery.prototype);
  galerie.images = [
    { src: '../produkt bilder/Elektrischer Wasserspender für Schreibtisch.jpg', alt: 'Wasserspender', color: 'Standard' },
    { src: '../produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Schwarz.jpg', alt: 'Schwarz', color: 'Schwarz' },
  ];
  galerie.currentImageIndex = 0;
  return { galerie, seite, bild, vorher, nachher };
}

test('die Galerie verwendet das vorhandene Hauptbild weiter', () => {
  const { galerie, seite, bild, vorher, nachher } = lade();
  galerie.createGalleryStructure();
  assert.strictEqual(galerie.mainImage, bild, 'es wurde ein neues Bild-Element erzeugt');
  assert.strictEqual(bild.className, 'gallery-image main-product-image fade-in', 'pp-main-img muss weg (doppelter Rand)');
  // Die Galerie steht genau dort, wo das Bild stand.
  assert.deepStrictEqual(seite.children, [vorher, galerie.galleryContainer, nachher]);
  assert.strictEqual(seite.alle('main-product-image').length, 1, 'genau ein Hauptbild');
});

test('zeigt das erste Galeriebild eine andere Datei, entsteht ein neues Bild — und das alte verschwindet', () => {
  const { galerie, seite, bild } = lade();
  galerie.images[0].src = '../produkt bilder/etwas anderes.jpg';
  galerie.createGalleryStructure();
  assert.notStrictEqual(galerie.mainImage, bild);
  assert.strictEqual(bild.parentElement, null, 'das alte Bild steht noch auf der Seite');
  assert.strictEqual(seite.alle('main-product-image').length, 1);
});

test('Gegenprobe: mit dem alten replaceChild waere der Aufbau gescheitert', () => {
  // Das Bild wird umgehaengt — danach findet replaceChild es nicht mehr. Genau
  // deshalb musste diese Zeile mit geaendert werden.
  const alt = QUELLE.replace(
    'parentContainer.insertBefore(this.galleryContainer, platzNachBild);\n        if (!bildWeiterverwenden) existingImage.remove();',
    'parentContainer.replaceChild(this.galleryContainer, existingImage);',
  );
  assert.notStrictEqual(alt, QUELLE, 'Gegenprobe greift nicht');
  const { galerie } = lade(alt);
  assert.throws(() => galerie.createGalleryStructure(), /NotFoundError/);
});

test('Wischen nach links zeigt das naechste Bild, nach rechts das vorige', () => {
  const { galerie } = lade();
  const schritte = [];
  galerie.galleryContainer = new El('div');
  galerie.nextImage = () => schritte.push('weiter');
  galerie.previousImage = () => schritte.push('zurueck');
  galerie.attachEventListeners();
  const wisch = (von, bis) => {
    galerie.galleryContainer.handler.touchstart({ changedTouches: [{ screenX: von }] });
    galerie.galleryContainer.handler.touchend({ changedTouches: [{ screenX: bis }] });
  };
  wisch(300, 100);
  wisch(100, 300);
  wisch(200, 220);              // zu kurz — kein Wechsel
  assert.deepStrictEqual(schritte, ['weiter', 'zurueck']);
});

test('Gegenprobe: der alte Aufruf warf beim Loslassen einen TypeError', () => {
  const alt = QUELLE.replace('            handleSwipe();\n        });', '            this.handleSwipe();\n        });');
  assert.notStrictEqual(alt, QUELLE, 'Gegenprobe greift nicht');
  const { galerie } = lade(alt);
  galerie.galleryContainer = new El('div');
  galerie.attachEventListeners();
  galerie.galleryContainer.handler.touchstart({ changedTouches: [{ screenX: 300 }] });
  // Der TypeError entsteht in der Sandbox — ein anderes Objekt als der TypeError
  // dieses Prozesses. Deshalb ueber Name und Meldung geprueft.
  assert.throws(
    () => galerie.galleryContainer.handler.touchend({ changedTouches: [{ screenX: 100 }] }),
    (f) => f.name === 'TypeError' && /handleSwipe is not a function/.test(f.message),
  );
});
