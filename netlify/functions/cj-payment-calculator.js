/**
 * CJ PAYMENT CALCULATOR
 * 
 * Berechnet automatisch die Aufteilung zwischen CJ-Kosten und deinem Gewinn
 */

// Produkt-Kosten bei CJ (in EUR) - Aus Excel-Tabelle
const CJ_PRODUCT_COSTS = {
  // Haushalt und Küche
  '1': 20.50,  // Wasserflaschen-Dispenser
  '2': 24.98,  // Mixer
  '3': 7.92,   // Multipeler Vegetables Chopper
  '4': 12.85,  // Tumbler Schwarz
  '5': 12.85,  // Tumbler Cream Weiß
  '6': 12.62,  // Tumbler Hellblau
  '7': 11.88,  // Tumbler Bay Leaves
  '8': 11.88,  // Tumbler Rostrot
  '9': 13.42,  // Tumbler Pink
  '10': 12.62, // Tumbler Rosa
  '11': 13.15, // Tumbler Hell Lila
  '12': 14.45, // Tumbler Weiß
  '13': 11.88, // Tumbler Marina
  '14': 13.42, // Tumbler Weihnachtszauber
  '15': 13.42, // Tumbler Merry Christmas
  '16': 3.71,  // Tumbler Strohhalm
  '17': 11.33, // 2 in 1 Öl Sprayer Flasche
  '18': 11.33, // Wärmender Untersetzter Pink
  '19': 11.33, // Wärmender Untersetzter Grün
  '20': 11.33, // Wärmender Untersetzter Weiß
  
  // Technik/Gadgets
  '21': 4.47,  // Anti lost finder
  '22': 8.60,  // Home electronic Clock
  '23': 19.78, // Mini Thermal Drucker Grün
  '24': 19.78, // Mini Thermal Drucker Blau
  '25': 19.78, // Mini Thermal Drucker Pink
  '26': 19.78, // Mini Thermal Drucker Gelb
  '27': 19.78, // Mini Thermal Drucker Weiß
  '28': 7.12,  // Style A Rollen
  '29': 7.01,  // Style B Rollen
  '30': 7.72,  // Style C Rollen
  '31': 58.86, // Tragbarer Beamer Weiß
  '32': 59.30, // Tragbarer Beamer Silber
  '33': 20.59, // Klimaanlage mit Display
  '34': 13.39, // Distance Measuring Instrument Electronic
  
  // Beleuchtung
  '35': 9.92,  // Indoor Sensing Wall Lamp Schwarz
  '36': 9.92,  // Indoor Sensing Wall Lamp Weiß
  '37': 8.88,  // LED Water in Crown
  '38': 10.50, // Led Water Wooden base
  '39': 8.57,  // Crystal Ball Mond
  '40': 8.63,  // Crystal Ball Riesenrad
  '41': 7.72,  // Crystal Ball Wassermolch
  '42': 8.63,  // Crystal Ball Saturn 
  '43': 9.69,  // Crystal Ball Segelboot
  '44': 8.39,  // Crystal Ball Schneemann
  '45': 9.69,  // Crystal Ball Sternenhimmel
  '46': 8.43,  // Waterproof RGB
  '47': 15.25, // Nordic Crystall Lampe Schwarz
  '48': 15.25, // Nordic Crystall Lampe Weiß
  '49': 15.25, // Nordic Crystall Lampe Gelb
  
  // Körperpflege/Wellness
  '50': 6.41,  // 4 In 1 Self Cleaning Hair Brush
  '51': 15.38, // Aroma Öl Diffusor
  '52': 4.70,  // Aroma Öl
  '53': 10.11, // Gesichtssauna Blau
  '54': 10.11, // Gesichtssauna Weiß
  '55': 14.97, // Thermische Massage Weiß
  '56': 14.79, // Thermische Massage Schwarz
  '57': 8.42,  // Mitesserentferner Gerät
  '58': 47.12, // Proffesioneller 5 in 1 Haar Trockner
  '59': 7.08,  // Jade Stein Weiß
  '60': 7.79,  // Jade Stein Grün
  '61': 7.15,  // Jade Stein Pink
  '62': 23.09, // Elektronische Premium Jade Stein
};

// Versandkosten bei CJ
const CJ_SHIPPING_COST = {
  'DE': 0,     // Deutschland - kostenlos
  'AT': 0,     // Österreich - kostenlos
  'CH': 2.50,  // Schweiz
  'FR': 0,     // Frankreich - kostenlos
  'IT': 0,     // Italien - kostenlos
  'ES': 0,     // Spanien - kostenlos
  'NL': 0,     // Niederlande - kostenlos
  'BE': 0,     // Belgien - kostenlos
  'GB': 3.00,  // UK
  'US': 5.00,  // USA
  'default': 4.99
};

/**
 * Berechnet CJ-Kosten für einen Warenkorb
 */
function calculateCJCost(cartItems, country = 'DE') {
  let totalCost = 0;
  
  // Produktkosten
  for (const item of cartItems) {
    const productCost = CJ_PRODUCT_COSTS[item.id] || 10.00; // Default: €10
    totalCost += productCost * item.quantity;
  }
  
  // Versandkosten
  const shippingCost = CJ_SHIPPING_COST[country] || CJ_SHIPPING_COST.default;
  totalCost += shippingCost;
  
  return totalCost;
}

/**
 * Berechnet Aufteilung für Stripe Payment
 */
function calculatePaymentSplit(cartTotal, cjCost) {
  const stripeFee = (cartTotal * 0.029) + 0.25; // 2.9% + €0.25
  const yourProfit = cartTotal - cjCost - stripeFee;
  
  return {
    total: cartTotal,
    cjCost: cjCost,
    stripeFee: stripeFee,
    yourProfit: yourProfit,
    profitPercentage: ((yourProfit / cartTotal) * 100).toFixed(2)
  };
}

/**
 * Zeigt detaillierte Aufschlüsselung
 */
function showBreakdown(cart, country = 'DE') {
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cjCost = calculateCJCost(cart, country);
  const split = calculatePaymentSplit(cartTotal, cjCost);
  
  console.log('\n💰 PAYMENT BREAKDOWN');
  console.log('='.repeat(50));
  console.log(`Kunde zahlt:        €${split.total.toFixed(2)}`);
  console.log(`├─ CJ-Kosten:       €${split.cjCost.toFixed(2)} (${((split.cjCost/split.total)*100).toFixed(1)}%)`);
  console.log(`├─ Stripe-Gebühr:   €${split.stripeFee.toFixed(2)} (${((split.stripeFee/split.total)*100).toFixed(1)}%)`);
  console.log(`└─ DEIN GEWINN:     €${split.yourProfit.toFixed(2)} (${split.profitPercentage}%)`);
  console.log('='.repeat(50));
  
  return split;
}

// Export für Verwendung in anderen Dateien
module.exports = {
  CJ_PRODUCT_COSTS,
  CJ_SHIPPING_COST,
  calculateCJCost,
  calculatePaymentSplit,
  showBreakdown
};
