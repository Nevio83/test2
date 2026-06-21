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
  return cart.map(item => ({
    id: item.id,
    name: typeof item.name === 'string' ? item.name : `Produkt ${item.id}`,
    price: resolveUnitPriceEUR(item, catalog),
    quantity: sanitizeQuantity(item.quantity)
  }));
}

module.exports = {
  round2,
  buildAllowedPrices,
  resolveUnitPriceEUR,
  sanitizeQuantity,
  validateCart
};
