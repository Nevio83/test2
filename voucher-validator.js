/**
 * voucher-validator.js
 * Serverseitige Gutschein-Pruefung.
 *
 * Warum: Der Browser schickte beim Checkout bisher den Rabattcode UND den
 * Rabattsatz mit, und der Server hat beides ungeprueft uebernommen (nur
 * "zwischen 1 und 100" wurde geprueft). Die echten Regeln — welche Codes es
 * ueberhaupt gibt, Mindestbestellwert, Mindestmenge — standen ausschliesslich
 * im Browser-Code (gutschein-system.js) und liessen sich damit umgehen: eine
 * manipulierte Anfrage konnte 99 % Rabatt erzwingen.
 *
 * Ab jetzt gilt: der vom Client gesendete Prozentsatz wird KOMPLETT ignoriert.
 * Nur der Code zaehlt; Rabatthoehe und Bedingungen kommen aus dieser Datei und
 * werden gegen den bereits preis-validierten Warenkorb geprueft.
 *
 * ⚠️ Diese Liste ist die massgebliche Quelle. Die Liste in gutschein-system.js
 * dient nur der Anzeige (Titel, Beschreibung, Bild) — wer hier etwas aendert,
 * muss sie dort mitziehen, sonst zeigt der Shop etwas anderes an als er gewaehrt.
 *
 * Bewusste Grenze: dass ein Kunde einen Gutschein "besitzt", prueft der Browser
 * ueber localStorage. Ohne Kundenkonten laesst sich das serverseitig nicht
 * nachvollziehen — wer einen Code kennt, kann ihn einloesen. Das ist bei
 * oeffentlichen Rabattcodes normal; entscheidend ist, dass Hoehe und
 * Bedingungen nicht mehr manipulierbar sind.
 */

// discount = Anteil (0.10 = 10 %). type 'shipping' gewaehrt keinen Betragsrabatt.
const VOUCHERS = [
  { code: 'SAVE10',    type: 'percentage', discount: 0.10, minOrder: 50,  minItems: 0 },
  { code: 'SAVE15',    type: 'percentage', discount: 0.15, minOrder: 100, minItems: 0 },
  { code: 'SAVE20',    type: 'percentage', discount: 0.20, minOrder: 150, minItems: 0 },
  { code: 'FREESHIP',  type: 'shipping',   discount: 0,    minOrder: 0,   minItems: 0 },
  { code: 'WELCOME25', type: 'percentage', discount: 0.25, minOrder: 0,   minItems: 0 },
  { code: 'BUNDLE30',  type: 'percentage', discount: 0.30, minOrder: 0,   minItems: 3 }
];

/** Sucht einen Gutschein (Gross-/Kleinschreibung und Leerzeichen egal). */
function getVoucher(code) {
  if (typeof code !== 'string') return null;
  const norm = code.trim().toUpperCase();
  if (!norm) return null;
  return VOUCHERS.find((v) => v.code === norm) || null;
}

/**
 * Prueft einen Gutschein gegen den bereits preis-validierten Warenkorb.
 *
 * @param {string} code            Gutscheincode aus der Anfrage
 * @param {Array}  validatedCart   Ergebnis von price-validator.validateCart()
 *                                 — enthaelt gepruefte EUR-Preise, NICHT die
 *                                 Client-Preise.
 * @returns {{ok:boolean, code?:string, type?:string, percent?:number, reason?:string}}
 *          percent ist der serverseitig berechnete Rabatt in Prozent (ganzzahlig).
 *          Bei type 'shipping' ist percent 0 -> es wird kein Stripe-Coupon erzeugt.
 */
function validateVoucher(code, validatedCart) {
  const voucher = getVoucher(code);
  if (!voucher) {
    return { ok: false, reason: 'Ungültiger Gutscheincode' };
  }

  if (!Array.isArray(validatedCart) || validatedCart.length === 0) {
    return { ok: false, reason: 'Warenkorb ist leer' };
  }

  // Beträge/Mengen ausschliesslich aus den serverseitig geprueften Werten.
  const subtotal = validatedCart.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  const itemCount = validatedCart.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0), 0);

  if (voucher.minOrder > 0 && subtotal < voucher.minOrder) {
    return {
      ok: false,
      reason: `Mindestbestellwert ${voucher.minOrder}€ nicht erreicht (Warenkorb: ${subtotal.toFixed(2)}€)`
    };
  }

  if (voucher.minItems > 0 && itemCount < voucher.minItems) {
    return {
      ok: false,
      reason: `Mindestens ${voucher.minItems} Produkte nötig (Warenkorb: ${itemCount})`
    };
  }

  return {
    ok: true,
    code: voucher.code,
    type: voucher.type,
    percent: Math.round(voucher.discount * 100)
  };
}

module.exports = { VOUCHERS, getVoucher, validateVoucher };
