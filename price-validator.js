/**
 * price-validator.js
 * Serverseitige Preis-/Mengenvalidierung gegen products.json.
 *
 * Warum: Der Warenkorb kommt aus dem Client (localStorage) und ist manipulierbar.
 * Niemals den vom Client gesendeten Preis ungeprüft als Stripe-Betrag verwenden.
 *
 * Strategie: Für jede Produkt-ID die in products.json ERLAUBTEN Preise sammeln
 * (Basispreis + Farb-Preise + Bundle-Preise). Stimmt der Client-Preis mit einem
 * erlaubten Wert überein, wird er akzeptiert (Varianten/Bundles bleiben gültig).
 * Sonst wird auf den Basispreis zurückgefallen. Unbekannte Produkte werden abgelehnt.
 *
 * Wird von server.js im Checkout-Pfad genutzt, bevor Stripe-Beträge gebildet werden.
 */

let DEFAULT_CATALOG = [];
try {
  DEFAULT_CATALOG = require('./products.json');
} catch (e) {
  // products.json relativ nicht gefunden – Aufrufer kann Katalog explizit übergeben
  DEFAULT_CATALOG = [];
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Set aller erlaubten EUR-Preise eines Produkts (Basis + Farben + Bundles). */
function buildAllowedPrices(product) {
  const set = new Set();
  if (typeof product.price === 'number') set.add(round2(product.price));
  if (Array.isArray(product.colors)) {
    product.colors.forEach(c => {
      if (typeof c.price === 'number') set.add(round2(c.price));
    });
  }
  if (Array.isArray(product.bundles)) {
    product.bundles.forEach(b => {
      if (typeof b.bundlePrice === 'number') set.add(round2(b.bundlePrice));
      if (typeof b.price === 'number') set.add(round2(b.price));
    });
  }
  return set;
}

/**
 * Validierten Einzelpreis (EUR) für ein Warenkorb-Item ermitteln.
 * @throws wenn die Produkt-ID nicht im Katalog existiert.
 */
function resolveUnitPriceEUR(item, catalog = DEFAULT_CATALOG) {
  const product = catalog.find(p => Number(p.id) === Number(item.id));
  if (!product) {
    throw new Error(`Unbekanntes Produkt im Warenkorb: ${item && item.id}`);
  }
  const claimed = round2(item && item.price);
  const allowed = buildAllowedPrices(product);
  if (allowed.has(claimed)) return claimed;
  // Client-Preis nicht erlaubt -> sicherer Basispreis
  console.warn(`⚠️ Ungültiger Client-Preis für Produkt ${item.id}: ${claimed} -> nutze Basispreis ${round2(product.price)}`);
  return round2(product.price);
}

/** Menge säubern: positive Ganzzahl, Obergrenze 99. */
function sanitizeQuantity(q) {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
}

/**
 * Kompletten Warenkorb validieren -> [{ id, name, price (EUR, geprüft), quantity }].
 * @throws bei unbekanntem Produkt (Aufrufer sollte 400 zurückgeben).
 */
function validateCart(cart, catalog = DEFAULT_CATALOG) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Warenkorb ist leer oder ungültig');
  }
  return cart.map(item => {
    const product = catalog.find(p => Number(p.id) === Number(item.id));
    const farbe = resolveFarbe(item, product);
    return {
      id: item.id,
      name: typeof item.name === 'string' ? item.name : `Produkt ${item.id}`,
      price: resolveUnitPriceEUR(item, catalog),
      quantity: sanitizeQuantity(item.quantity),
      farbe,
      sku: resolveVariantenSku(product, farbe),
    };
  });
}

/**
 * Die gewählte Farbe — aber nur, wenn es sie bei diesem Produkt wirklich gibt.
 *
 * WARUM DAS JETZT HIER STEHT
 * Bis zum 23.09. gab validateCart nur id, name, price und quantity zurück. Die
 * Farbe, die der Warenkorb als `selectedColor` mitschickt, fiel hier heraus —
 * und damit wusste am Ende niemand mehr, WELCHE Variante bestellt war. Die
 * erste echte Bestellung (Krystall Ball Nachtlampe, Farbe "Mond") kam so ohne
 * Farbe bei Stripe an, und die Bestellung bei CJ scheiterte.
 *
 * Der Name wird gegen die Farbliste des Produkts geprüft, statt ihn blind zu
 * übernehmen. Eine unbekannte Farbe wird zu null — lieber keine Farbe als eine
 * erfundene, die CJ dann nicht findet.
 */
function resolveFarbe(item, product) {
  const gewuenscht = item && typeof item.selectedColor === 'string' ? item.selectedColor.trim() : '';
  if (!gewuenscht || !product || !Array.isArray(product.colors)) return null;
  const treffer = product.colors.find(c => c && typeof c.name === 'string'
    && c.name.trim().toLowerCase() === gewuenscht.toLowerCase());
  return treffer ? treffer.name : null;
}

/**
 * Die SKU der Variante, die tatsächlich verschickt werden muss.
 *
 * Kommt BEWUSST aus dem Katalog, nicht vom Browser. Der Warenkorb schickt zwar
 * eine `selectedColorSku` mit, aber wer die manipuliert, könnte CJ ein anderes
 * — womöglich teureres — Produkt verschicken lassen. Aus products.json kann
 * nur eine SKU kommen, die zu diesem Produkt gehört.
 */
function resolveVariantenSku(product, farbe) {
  if (!product) return null;
  if (farbe && Array.isArray(product.colors)) {
    const c = product.colors.find(x => x && x.name === farbe);
    if (c && typeof c.sku === 'string' && c.sku && c.sku !== 'default') return c.sku;
  }
  return typeof product.sku === 'string' && product.sku ? product.sku : null;
}

module.exports = {
  round2,
  buildAllowedPrices,
  resolveUnitPriceEUR,
  sanitizeQuantity,
  validateCart,
  resolveFarbe,
  resolveVariantenSku
};
