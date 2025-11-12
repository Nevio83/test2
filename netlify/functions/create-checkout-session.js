// Netlify Function für Stripe Checkout Session
require('dotenv').config();

// Fehlerprüfung für Stripe API-Key
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('⚠️ KRITISCHER FEHLER: STRIPE_SECRET_KEY nicht in Umgebungsvariablen gefunden!');
}

// Stripe-Client initialisieren
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  console.error('⚠️ Fehler beim Initialisieren des Stripe-Clients:', error.message);
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
  console.log('💾 Checkout-Session Anfrage erhalten');
  
  // Prüfe Stripe-Initialisierung
  if (!stripe) {
    console.error('⚠️ Stripe nicht initialisiert - fehlende API-Keys?');
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Stripe-Zahlungsabwicklung nicht konfiguriert',
        details: 'API-Schlüssel fehlen oder sind ungültig'
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
    console.log('📂 Rohe Anfrage erhalten:', event.body);
    
    // Anfrage-Daten parsen
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
      console.log('✅ Anfrage erfolgreich geparst');
    } catch (parseError) {
      console.error('⚠️ JSON Parse-Fehler:', parseError.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ungültiges JSON Format', details: parseError.message })
      };
    }
    
    const { cart, country, discount, customerInfo } = parsedBody;
    console.log('💰 Land:', country, 'Warenkorbgröße:', cart?.length || 0);

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

    // Stripe Checkout-Konfiguration mit allen aktivierten Zahlungsmethoden
    // Absolut minimal konfigurierte Session
    const sessionConfig = {
      // Nur Kreditkarten für Basistest
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.URL || 'https://maiosshop.com'}/success.html`,
      cancel_url: `${process.env.URL || 'https://maiosshop.com'}/cart.html`,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'PL', 'US', 'GB']
      },
      phone_number_collection: {
        enabled: true
      },
      locale: 'de'
      // Alle erweiterten Optionen entfernt für Basistest
    };

    // CJ-Zahlungs-Split
    if (process.env.CJ_STRIPE_ACCOUNT_ID && split.cjCost > 0) {
      // Berechne maximalen Transfer-Betrag (nie mehr als Gesamtbetrag)
      const cartTotalInCents = Math.round(split.total * 100);
      const maxTransferAmount = Math.min(
        Math.round(split.cjCost * 100),  // CJ-Kosten in Cents
        cartTotalInCents - 1             // Gesamtbetrag - 1 Cent (für Stripe-Gebühr)
      );

      console.log(`   Angepasster Transfer-Betrag: €${(maxTransferAmount/100).toFixed(2)}`);

      // Nur Transfer hinzufügen wenn positiver Betrag
      if (maxTransferAmount > 0) {
        sessionConfig.payment_intent_data = {
          ...sessionConfig.payment_intent_data,
          transfer_data: {
            amount: maxTransferAmount,
            destination: process.env.CJ_STRIPE_ACCOUNT_ID
          }
        };
      }
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
