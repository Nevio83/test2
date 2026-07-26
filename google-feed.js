/**
 * google-feed.js — Produktdatenfeed fuer das Google Merchant Center.
 *
 * Google zeigt Shopping-Ergebnisse auch kostenlos an ("kostenlose Eintraege"),
 * verlangt dafuer aber eine maschinenlesbare Produktliste. Der Feed wird unter
 * /google-feed.xml ausgeliefert und im Merchant Center einmalig als geplanter
 * Abruf eingetragen — danach aktualisiert er sich von selbst mit products.json.
 *
 * Format: RSS 2.0 mit dem Google-Namensraum (der von Google dokumentierte
 * Standardweg fuer Datei-/URL-Feeds).
 *
 * Grundsatz: nur Angaben, die nachweislich stimmen. Google gleicht den Feed mit
 * der Landingpage ab und sperrt bei Abweichungen das Konto — ein geratener Wert
 * ist hier schlimmer als ein fehlender.
 */

const SHOP_BRAND = 'Maios';
// Versand nach DE ist tatsaechlich kostenlos (shipping-calculator.js: 'DE': 0,
// und der Stripe-Checkout schlaegt nichts auf). Google prueft das.
const SHIPPING_COUNTRY = 'DE';
const SHIPPING_PRICE = '0.00 EUR';

/** XML-Sonderzeichen maskieren. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Baut aus einem products.json-Pfad eine absolute URL.
 * Die Bildordner enthalten Leerzeichen und Umlaute — ohne Kodierung lehnt
 * Google die Bild-URL ab.
 */
function absoluteUrl(baseUrl, relPath) {
  if (!relPath) return '';
  if (/^https?:\/\//i.test(relPath)) return relPath;
  const encoded = String(relPath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${baseUrl}/${encoded}`;
}

/** Beschreibung auf Googles Grenze kuerzen, ohne mitten im Wort zu enden. */
function trimDescription(text, max = 4900) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Preis im von Google erwarteten Format. */
function money(n) {
  return `${Number(n).toFixed(2)} EUR`;
}

/**
 * Erzeugt den kompletten Feed.
 *
 * @param {object}  opts
 * @param {Array}   opts.products         Liste aus products.json
 * @param {Set}     [opts.unavailableIds] Produkt-IDs, die laut CJ-Bestandsabgleich nicht lieferbar sind
 * @param {string}  [opts.baseUrl]        Shop-Basis-URL ohne Schraegstrich am Ende
 * @returns {{xml:string, included:number, skipped:Array}}
 */
function buildGoogleFeed(opts = {}) {
  const products = Array.isArray(opts.products) ? opts.products : [];
  const unavailable = opts.unavailableIds instanceof Set ? opts.unavailableIds : new Set();
  const baseUrl = (opts.baseUrl || 'https://maiosshop.com').replace(/\/+$/, '');

  const items = [];
  const skipped = [];

  for (const p of products) {
    // Pflichtangaben. Fehlt eine, wird das Produkt ausgelassen statt mit
    // erfundenen Werten eingereicht — Google wuerde es ohnehin ablehnen.
    if (!p || p.id == null || !p.name || !p.slug || !p.image || !(Number(p.price) > 0)) {
      skipped.push({ id: p && p.id, name: p && p.name, grund: 'Pflichtangabe fehlt (Name, Slug, Bild oder Preis)' });
      continue;
    }

    const price = Number(p.price);
    const original = Number(p.originalPrice);
    // Google-Logik: "price" ist der regulaere Preis, "sale_price" der aktuelle.
    // Nur wenn es wirklich einen Streichpreis gibt, sonst nur "price".
    const hasSale = Number.isFinite(original) && original > price;

    const fields = [
      `<g:id>${esc('maios-' + p.id)}</g:id>`,
      `<g:title>${esc(p.name)}</g:title>`,
      `<g:description>${esc(trimDescription(p.description || p.name))}</g:description>`,
      `<g:link>${esc(`${baseUrl}/produkte/${p.slug}.html`)}</g:link>`,
      `<g:image_link>${esc(absoluteUrl(baseUrl, p.image))}</g:image_link>`,
      `<g:availability>${unavailable.has(Number(p.id)) ? 'out_of_stock' : 'in_stock'}</g:availability>`,
      `<g:price>${esc(money(hasSale ? original : price))}</g:price>`
    ];
    if (hasSale) fields.push(`<g:sale_price>${esc(money(price))}</g:sale_price>`);

    fields.push(`<g:condition>new</g:condition>`);
    fields.push(`<g:brand>${esc(SHOP_BRAND)}</g:brand>`);
    // Dropshipping-Ware ohne Hersteller-Artikelnummer/EAN. Google verlangt in
    // diesem Fall ausdruecklich identifier_exists=no statt erfundener Nummern.
    fields.push(`<g:identifier_exists>no</g:identifier_exists>`);
    if (p.category) fields.push(`<g:product_type>${esc(p.category)}</g:product_type>`);

    // Zusaetzliche Bilder aus den Farbvarianten (Google erlaubt bis zu 10).
    if (Array.isArray(p.colors)) {
      const extra = [];
      for (const c of p.colors) {
        if (!c || !c.image || c.image === p.image) continue;
        const url = absoluteUrl(baseUrl, c.image);
        if (!extra.includes(url)) extra.push(url);
        if (extra.length >= 10) break;
      }
      extra.forEach((url) => fields.push(`<g:additional_image_link>${esc(url)}</g:additional_image_link>`));
    }

    fields.push(
      `<g:shipping><g:country>${SHIPPING_COUNTRY}</g:country>` +
      `<g:price>${esc(SHIPPING_PRICE)}</g:price></g:shipping>`
    );

    items.push(`    <item>\n      ${fields.join('\n      ')}\n    </item>`);
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>${esc(SHOP_BRAND + ' Shop')}</title>\n` +
    `    <link>${esc(baseUrl)}</link>\n` +
    `    <description>Produktdatenfeed für das Google Merchant Center</description>\n` +
    items.join('\n') + (items.length ? '\n' : '') +
    `  </channel>\n` +
    `</rss>\n`;

  return { xml, included: items.length, skipped };
}

module.exports = { buildGoogleFeed, absoluteUrl, trimDescription, esc };
