// Netlify Function für Stripe Checkout Session
require('dotenv').config();

// Debug-Ausgabe aller Umgebungsvariablen (ohne sensible Werte)
console.log('===== UMGEBUNGSVARIABLEN DEBUG =====');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CONTEXT:', process.env.CONTEXT); // Netlify-spezifisch
console.log('STRIPE_SECRET_KEY existiert:', !!process.env.STRIPE_SECRET_KEY);
if (process.env.STRIPE_SECRET_KEY) {
  // Zeige nur die ersten und letzten 4 Zeichen, um die Sicherheit zu wahren
  console.log('STRIPE_SECRET_KEY Format:', 
    process.env.STRIPE_SECRET_KEY.substring(0, 3) + 
    '...' + 
    process.env.STRIPE_SECRET_KEY.substring(process.env.STRIPE_SECRET_KEY.length - 4));
}
console.log('STRIPE_PUBLISHABLE_KEY existiert:', !!process.env.STRIPE_PUBLISHABLE_KEY);
console.log('CJ_STRIPE_ACCOUNT_ID existiert:', !!process.env.CJ_STRIPE_ACCOUNT_ID);
console.log('===================================');

// Stripe-Client mit spezifischer API-Version initialisieren
let stripe;
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('⚠️ KRITISCHER FEHLER: STRIPE_SECRET_KEY nicht in Umgebungsvariablen gefunden!');
  // Setze einen Fallback nur für Debug-Zwecke - NIEMALS in Produktion verwenden!
  // Dies ist nur, um zu sehen, ob wir ein Problem mit den Umgebungsvariablen haben
  const FALLBACK_KEY = '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';
  console.log('⚠️ WARNUNG: Verwende Fallback-Key für Debugging');
  try {
    stripe = require('stripe')(FALLBACK_KEY, {
      apiVersion: '2023-10-16' 
    });
    console.log('✅ Stripe mit Fallback-Key initialisiert');
  } catch (error) {
    console.error('⚠️ Fehler beim Initialisieren des Stripe-Clients mit Fallback-Key:', error.message);
  }
} else {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' // Aktuelle Stripe API-Version mit Unterstützung für alle Features
    });
    console.log('✅ Stripe mit API-Version 2023-10-16 initialisiert');
  } catch (error) {
    console.error('⚠️ Fehler beim Initialisieren des Stripe-Clients:', error.message);
  }
}

// Lokalen Pfad für cj-payment-calculator verwenden
const { calculateCJCost, calculatePaymentSplit } = require('./cj-payment-calculator');

// Währungs-Mapping basierend auf Land
function getCurrencyByCountry(countryCode) {
  const currencies = {
    'DE': 'EUR', 'AT': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR', 'BE': 'EUR',
    'CH': 'CHF', 'GB': 'GBP', 'US': 'USD'
  };
  return currencies[countryCode] || 'EUR';
}

exports.handler = async (event, context) => {
  console.log('📂 Checkout-Session Anfrage erhalten');
  console.log('--- DEBUG INFO START ---');
  console.log('STRIPE KEY existiert:', !!process.env.STRIPE_SECRET_KEY);
  console.log('STRIPE KEY Länge:', process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.length : 0);
  console.log('NODE VERSION:', process.version);
  console.log('ENV:', process.env.NODE_ENV);
  console.log('EVENT BODY TYP:', typeof event.body);
  console.log('EVENT BODY Länge:', event.body ? event.body.length : 0);
  console.log('--- DEBUG INFO END ---');
  
  // Prüfe Stripe-Initialisierung
  if (!stripe) {
    console.error('⚠️ Stripe nicht initialisiert - fehlende API-Keys?');
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Stripe-Zahlungsabwicklung nicht konfiguriert',
        details: 'API-Schlüssel fehlen oder sind ungültig',
        env_vars_exist: !!process.env.STRIPE_SECRET_KEY
      })
    };
  }
  
  // Nur POST-Anfragen erlauben
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Anfrage-Daten parsen
    let parsedBody;
    try {
      console.log('📂 EVENT BODY (ersten 100 Zeichen):', event.body ? event.body.substring(0, 100) + '...' : 'leer');
      parsedBody = JSON.parse(event.body);
      console.log('✅ Anfrage erfolgreich geparst');
    } catch (parseError) {
      console.error('⚠️ JSON Parse-Fehler:', parseError.message);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Ungültiges JSON Format',
          details: parseError.message,
          received_data_type: typeof event.body,
          received_data_sample: event.body ? event.body.substring(0, 50) : 'leer'
        })
      };
    }
    
    const { cart, country, discount, customerInfo } = parsedBody;
    console.log('💰 Land:', country, 'Warenkorbgröße:', cart?.length || 0);
    
    // Detaillierte Datenprüfungen
    if (!country) console.warn('⚠️ Land fehlt in der Anfrage!');
    if (!cart) console.warn('⚠️ Warenkorb fehlt komplett!');
    if (cart && cart.length === 0) console.warn('⚠️ Warenkorb ist leer!');
    if (cart && cart.length > 0) {
      console.log('🛒 Warenkorb-Details:');
      cart.forEach((item, index) => {
        console.log(`  Item ${index+1}: ID=${item.id}, Name=${item.name}, Preis=${item.price}, Menge=${item.quantity}`);
        if (!item.id) console.warn(`  ⚠️ Item ${index+1} hat keine ID!`);
        if (!item.price) console.warn(`  ⚠️ Item ${index+1} hat keinen Preis!`);
        if (!item.quantity) console.warn(`  ⚠️ Item ${index+1} hat keine Menge!`);
      });
    }

    // Validiere Eingaben
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cart is required and must contain items' })
      };
    }

    console.log('📦 Checkout-Session Request:', {
      cartItems: cart.length,
      country: country || 'DE',
      hasDiscount: !!discount,
      discountCode: discount?.code,
      discountPercent: discount?.percent
    });

    console.log('📍 Empfangenes Land:', country);
    const currency = getCurrencyByCountry(country);
    console.log('💱 Verwendete Währung:', currency);

    // Berechne CJ-Kosten für automatische Aufteilung
    const cartItems = cart.map(item => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity
    }));
    
    const cjCost = calculateCJCost(cartItems, country);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const split = calculatePaymentSplit(cartTotal, cjCost);

    console.log('💰 Payment Split Berechnung:');
    console.log(`   Gesamt: €${split.total.toFixed(2)}`);
    console.log(`   CJ-Kosten: €${split.cjCost.toFixed(2)}`);
    console.log(`   Dein Gewinn: €${split.yourProfit.toFixed(2)} (${split.profitPercentage}%)`);

    // Konvertiere alle Preise in Stripe-Format
    const line_items = cart.map(item => {
      // Preisberechnung direkt in Cent
      const amountInCents = Math.round(item.price * 100);

      return {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: item.name },
          unit_amount: amountInCents,
        },
        quantity: item.quantity,
      };
    });

    // Absolut minimale Konfiguration - keine fortgeschrittenen Features
    const sessionConfig = {
      // Nur Kreditkarten - absolut minimale Konfiguration
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.URL || 'https://maiosshop.com'}/success.html`,
      cancel_url: `${process.env.URL || 'https://maiosshop.com'}/cart.html`,
      // Nur die absolut notwendigsten Optionen behalten
      locale: 'de'
      // ALLE anderen Optionen entfernt für maximale Kompatibilität
    };

    // CJ-Zahlungs-Split komplett deaktiviert für Kompatibilitätstests
    // Berechnen der Werte nur für Logging-Zwecke
    if (process.env.CJ_STRIPE_ACCOUNT_ID && split.cjCost > 0) {
      const cartTotalInCents = Math.round(split.total * 100);
      const potentialTransferAmount = Math.min(
        Math.round(split.cjCost * 100),
        cartTotalInCents - 1
      );
      
      console.log(`   [INFO] Berechneter Transfer-Betrag (deaktiviert): €${(potentialTransferAmount/100).toFixed(2)}`);
      // WICHTIG: KEIN Transfer wird konfiguriert!
    }

    // Füge Kundendaten hinzu wenn vorhanden
    if (customerInfo && customerInfo.email) {
      sessionConfig.customer_email = customerInfo.email;
    }

    // Erstelle Stripe Checkout Session
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('✅ Checkout Session erstellt:', session.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        id: session.id, 
        url: session.url 
      })
    };

  } catch (error) {
    // Detaillierte Fehlerbehandlung
    console.error('❌ Checkout Error:', error);
    
    // Klassifizieren des Fehlers für bessere Fehlermeldungen
    let statusCode = 500;
    let errorMessage = 'Fehler beim Erstellen der Checkout-Session';
    let errorDetails = error.message;
    
    if (error.type && error.type.startsWith('Stripe')) {
      // Stripe-spezifische Fehler
      if (error.type === 'StripeCardError') {
        statusCode = 400;
        errorMessage = 'Zahlungsmethode wurde abgelehnt';
      } else if (error.type === 'StripeInvalidRequestError') {
        statusCode = 400;
        errorMessage = 'Ungültige Anfrage an Stripe';
      } else if (error.type === 'StripeAPIError') {
        statusCode = 503;
        errorMessage = 'Stripe API nicht erreichbar';
      }
    } else if (error instanceof SyntaxError) {
      statusCode = 400;
      errorMessage = 'Ungültige Anfrage-Daten';
    }
    
    return {
      statusCode,
      body: JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId || 'netlify-function'
      })
    };
  }
};
