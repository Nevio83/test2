// Netlify Function für Stripe Checkout Session
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { calculateCJCost, calculatePaymentSplit } = require('../../cj-payment-calculator');

// Währungs-Mapping basierend auf Land
function getCurrencyByCountry(countryCode) {
  const currencies = {
    'DE': 'EUR', 'AT': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR', 'BE': 'EUR',
    'CH': 'CHF', 'GB': 'GBP', 'US': 'USD'
  };
  return currencies[countryCode] || 'EUR';
}

exports.handler = async (event, context) => {
  // Nur POST-Anfragen erlauben
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Anfrage-Daten parsen
    const { cart, country, discount, customerInfo } = JSON.parse(event.body);

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

    // Stripe Checkout-Konfiguration
    const sessionConfig = {
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
      locale: 'de',
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      },
      payment_intent_data: {
        description: 'Einkauf bei Maios',
        capture_method: 'automatic',
        metadata: {
          order_id: `ORD-${Date.now()}`,
          shop_domain: 'maiosshop.com'
        }
      }
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
    console.error('❌ Checkout Error:', error.message);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Fehler beim Erstellen der Checkout-Session',
        details: error.message
      })
    };
  }
};
