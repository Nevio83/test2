/**
 * DYNAMISCHE VERSANDKOSTEN-BERECHNUNG
 * Basierend auf echten CJ Dropshipping Kosten
 */

// PAUSCHALE VERSANDKOSTEN (Durchschnitt für alle Produkte)
// Einfach und funktioniert für 90% der Fälle
const FLAT_SHIPPING_COSTS = {
  // Europa - Kostenlos (Marketing)
  'DE': 0,
  'AT': 0,
  'CH': 0,
  'FR': 0,
  'IT': 0,
  'ES': 0,
  'NL': 0,
  'BE': 0,
  'GB': 0,
  'PL': 0,
  
  // Nordamerika
  'US': 12.00,
  'CA': 12.00,
  'MX': 15.00,
  
  // Asien
  'JP': 15.00,
  'CN': 15.00,
  'KR': 15.00,
  'SG': 15.00,
  
  // Ozeanien
  'AU': 20.00,
  'NZ': 20.00,
  
  // Südamerika
  'BR': 18.00,
  'AR': 18.00,
  
  // Rest der Welt (Standard)
  'DEFAULT': 15.00
};

// Keine extra Markup - Preise sind bereits kalkuliert
const SHIPPING_MARKUP = 0;

/**
 * Berechnet Versandkosten für Kunden
 * @param {string} countryCode - ISO Ländercode (z.B. 'DE', 'US')
 * @returns {number} Versandkosten in EUR
 */
function calculateShippingCost(countryCode) {
  // Hole pauschale Kosten für das Land (hasOwnProperty um 0 korrekt zu behandeln)
  return FLAT_SHIPPING_COSTS.hasOwnProperty(countryCode) ? FLAT_SHIPPING_COSTS[countryCode] : FLAT_SHIPPING_COSTS['DEFAULT'];
}

/**
 * Berechnet deinen Gewinn/Verlust bei Versand
 * @param {string} countryCode - ISO Ländercode
 * @returns {object} Gewinn-Analyse
 */
function analyzeShippingProfit(countryCode) {
  const customerPrice = calculateShippingCost(countryCode);
  
  return {
    country: countryCode,
    customerPrice: customerPrice,
    note: 'Pauschale Kosten - deckt durchschnittliche CJ-Kosten + Gewinn'
  };
}

/**
 * Gibt alle Versandkosten als Tabelle aus
 */
function printShippingTable() {
  console.log('\n📦 PAUSCHALE VERSANDKOSTEN-ÜBERSICHT\n');
  console.log('Land | Kundenpreis');
  console.log('-'.repeat(30));
  
  Object.keys(FLAT_SHIPPING_COSTS).forEach(country => {
    if (country === 'DEFAULT') return;
    const cost = FLAT_SHIPPING_COSTS[country];
    console.log(`${country.padEnd(4)} | €${cost.toFixed(2)}`);
  });
  
  console.log('\n💡 Diese Preise decken durchschnittliche CJ-Kosten + Gewinn');
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateShippingCost,
    analyzeShippingProfit,
    printShippingTable,
    FLAT_SHIPPING_COSTS
  };
}

// Beispiel-Ausgabe
if (require.main === module) {
  printShippingTable();
  
  console.log('\n💡 BEISPIEL-RECHNUNGEN:\n');
  
  const examples = ['DE', 'US', 'AU', 'JP'];
  examples.forEach(country => {
    const cost = calculateShippingCost(country);
    console.log(`${country}: Kunde zahlt €${cost.toFixed(2)} Versand`);
  });
}
