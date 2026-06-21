require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');

// Initialize Stripe only if API key is available
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'your_stripe_secret_key_here') {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe initialized');
} else {
  console.warn('⚠️  Stripe not initialized - STRIPE_SECRET_KEY missing');
}

// Initialize CJ Dropshipping API (has its own fallback system)
const CJDropshippingAPI = require('./cj-dropshipping-api');
const cjAPI = new CJDropshippingAPI();

// Initialize Shipping Calculator
const { calculateShippingCost } = require('./shipping-calculator');

// Initialize Exchange Rate Service
const ExchangeRateService = require('./exchange-rate-service');
const exchangeRateService = new ExchangeRateService();

// Währungs-Mapping basierend auf Land
function getCurrencyByCountry(countryCode) {
  const currencyMap = {
    // Eurozone
    'DE': 'EUR', 'AT': 'EUR', 'BE': 'EUR', 'ES': 'EUR', 'FR': 'EUR',
    'IT': 'EUR', 'NL': 'EUR', 'PT': 'EUR', 'GR': 'EUR', 'IE': 'EUR',
    'FI': 'EUR', 'LU': 'EUR', 'SK': 'EUR', 'SI': 'EUR', 'EE': 'EUR',
    'LV': 'EUR', 'LT': 'EUR', 'CY': 'EUR', 'MT': 'EUR',
    // Andere europäische Länder
    'CH': 'CHF', // Schweiz
    'GB': 'GBP', // UK
    'PL': 'PLN', // Polen
    'CZ': 'CZK', // Tschechien
    'DK': 'DKK', // Dänemark
    'SE': 'SEK', // Schweden
    'NO': 'NOK', // Norwegen
    'HU': 'HUF', // Ungarn
    'RO': 'RON', // Rumänien
    // Nordamerika
    'US': 'USD', 'CA': 'CAD',
    // Asien
    'JP': 'JPY', 'CN': 'CNY', 'IN': 'INR', 'KR': 'KRW',
    // Ozeanien
    'AU': 'AUD', 'NZ': 'NZD',
    // Andere
    'BR': 'BRL', 'MX': 'MXN', 'TR': 'TRY', 'RU': 'RUB'
  };
  
  return currencyMap[countryCode?.toUpperCase()] || 'EUR'; // Standard: EUR
}

// Wrapper-Funktionen für Exchange Rate Service (async)
async function convertPrice(priceInEUR, targetCurrency) {
  return await exchangeRateService.convertPrice(priceInEUR, targetCurrency);
}

// Initialize Receipt System
const { dbOperations } = require('./database');
const ReceiptGenerator = require('./receipt-generator');
const emailService = require('./resend-service'); // Resend E-Mail Service
const { v4: uuidv4 } = require('uuid');

const receiptGenerator = new ReceiptGenerator();

const app = express();

// CORS-Konfiguration für maiosshop.com und lokale Entwicklung
app.use((req, res, next) => {
  // Erlaubte Domains
  const allowedOrigins = [
    'https://maiosshop.com',
    'https://www.maiosshop.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];
  
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // Kein Fallback auf '*' — Same-Origin-Requests brauchen keinen ACAO-Header
  
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Options-Anfragen für CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// 🔒 WICHTIG: Stripe-Webhook braucht den ROHEN Body für die Signaturprüfung.
// Deshalb den Raw-Parser für /stripe-webhook VOR express.json() registrieren –
// sonst konsumiert express.json() den Body und stripe.webhooks.constructEvent
// schlägt mit "No signatures found matching..." fehl.
app.use('/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Enable gzip compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// (express.json() ist bereits oben registriert – Duplikat entfernt)

// Sicherheits-Header
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ── Admin-Authentifizierung (HTTP Basic Auth) ───────────────────────
// Schützt Admin-Dashboards und sensible API-Routen. Login via Browser-Dialog;
// Zugangsdaten aus ENV: ADMIN_USER (Default 'admin') + ADMIN_PASSWORD.
const crypto = require('crypto');

// Eindeutige Bestell-ID — kryptographisch zufällig (kollisionssicher, nicht vorhersagbar)
function generateOrderId() {
  return `ORD-${Date.now()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function requireAdminAuth(req, res, next) {
  const USER = process.env.ADMIN_USER || 'admin';
  const PASS = process.env.ADMIN_PASSWORD;
  if (!PASS) {
    return res.status(503).json({ error: 'Admin-Zugang nicht konfiguriert (ADMIN_PASSWORD fehlt)' });
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (safeEqual(user, USER) && safeEqual(pass, PASS)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Maios Admin", charset="UTF-8"');
  return res.status(401).json({ error: 'Authentifizierung erforderlich' });
}

// Admin-Dashboard-Ordner schützen (VOR express.static)
app.use('/a29715347575', requireAdminAuth);
// Alle CJ-Routen sind admin-intern (kein oeffentlicher Aufruf)
app.use('/api/cj', requireAdminAuth);
// Admin-Analytics liegen unter /a29715347575/api/views/* und sind dadurch bereits
// von der Admin-Auth oben (app.use('/a29715347575', requireAdminAuth)) geschuetzt.
// /api/receipt: nur Admin-Routen schuetzen, oeffentliche (Checkout + Tracking) freilassen
app.use('/api/receipt', (req, res, next) => {
  const path0 = (req.originalUrl || '').split('?')[0];
  const isPublic =
    (req.method === 'POST' && /^\/api\/receipt\/create\/?$/.test(path0)) ||
    (req.method === 'GET'  && /^\/api\/receipt\/order\/[^/]+\/?$/.test(path0)) ||
    (req.method === 'GET'  && /^\/api\/receipt\/orders\/email\/[^/]+\/?$/.test(path0));
  if (isPublic) return next();
  return requireAdminAuth(req, res, next);
});

// Serve static files with no cache for development
app.use(express.static(path.join(__dirname), {
  maxAge: 0, // No caching for development
  etag: false,
  setHeaders: (res, path) => {
    // Disable caching in development
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Hilfsfunktion: Erstelle oder hole Stripe Coupon
async function createOrGetCoupon(percent, code) {
  if (!stripe) {
    throw new Error('Stripe not initialized');
  }
  
  // Validiere Eingaben
  if (!percent || !code) {
    throw new Error('Percent and code are required');
  }
  
  const percentNum = parseInt(percent);
  if (percentNum < 1 || percentNum > 100) {
    throw new Error('Percent must be between 1 and 100');
  }
  
  try {
    // Versuche existierenden Coupon zu holen
    const existingCoupon = await stripe.coupons.retrieve(code);
    console.log('✅ Existierender Coupon gefunden:', code);
    return existingCoupon.id;
  } catch (error) {
    if (error.code === 'resource_missing') {
      // Coupon existiert nicht, erstelle neuen
      console.log('🆕 Erstelle neuen Coupon:', code);
      const coupon = await stripe.coupons.create({
        id: code,
        percent_off: percentNum,
        duration: 'once',
        name: `${percentNum}% Rabatt`
      });
      console.log('✅ Neuer Coupon erstellt:', coupon.id);
      return coupon.id;
    } else {
      // Anderer Fehler
      console.error('❌ Stripe Coupon Fehler:', error.message);
      throw error;
    }
  }
}

// WICHTIG: Für PayPal-Integration musst du im Stripe Dashboard folgende Schritte durchführen:
// 1. Gehe zu https://dashboard.stripe.com/settings/payment_methods
// 2. Aktiviere PayPal unter "Payment methods"
// 3. Verbinde dein PayPal-Konto mit Stripe

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payment system not configured. Please set up Stripe API key.' });
  }
  
  const { cart, country, discount, customerInfo } = req.body;
  
  // Validiere Eingaben
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is required and must contain items' });
  }
  
  console.log('🛒 Checkout-Session Request:', {
    cartItems: cart.length,
    country: country || 'DE',
    hasDiscount: !!discount,
    discountCode: discount?.code,
    discountPercent: discount?.percent
  });
  
  console.log('📍 Empfangenes Land:', country);
  const currency = getCurrencyByCountry(country);
  console.log('💱 Verwendete Währung:', currency);
  
  let line_items;
  let split;
  
  try {
    // Berechne CJ-Kosten für automatische Aufteilung
    const { calculateCJCost, calculatePaymentSplit } = require('./cj-payment-calculator');
    // 🔒 Preise serverseitig gegen products.json validieren (Manipulationsschutz)
    const { validateCart } = require('./price-validator');
    var validatedCart = validateCart(cart);

    const cartItems = validatedCart.map(item => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity
    }));
    const cjCost = calculateCJCost(cartItems, country);
    const cartTotal = validatedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    split = calculatePaymentSplit(cartTotal, cjCost);
    
    console.log('💰 Payment Split Berechnung:');
    console.log(`   Gesamt: €${split.total.toFixed(2)}`);
    console.log(`   CJ-Kosten: €${split.cjCost.toFixed(2)}`);
    console.log(`   Dein Gewinn: €${split.yourProfit.toFixed(2)} (${split.profitPercentage}%)`);
    
    // Konvertiere GEPRÜFTE Preise (EUR) parallel in die Zielwährung
    line_items = await Promise.all(validatedCart.map(async (item) => {
      try {
        // Rechne geprüften EUR-Preis in Zielwährung um
        const convertedPrice = await convertPrice(item.price, currency);
        const amountInCents = Math.round(convertedPrice * 100);
        
        return {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: item.name },
            unit_amount: amountInCents,
          },
          quantity: item.quantity,
        };
      } catch (priceError) {
        console.error('❌ Fehler bei Preiskonvertierung für Item:', item.name, priceError.message);
        // Fallback: Verwende EUR-Preis direkt
        const amountInCents = Math.round(item.price * 100);
        return {
          price_data: {
            currency: 'eur',
            product_data: { name: item.name },
            unit_amount: amountInCents,
          },
          quantity: item.quantity,
        };
      }
    }));
  } catch (moduleError) {
    console.error('❌ Fehler beim Laden der Module oder Berechnung:', moduleError.message);
    return res.status(500).json({ 
      error: 'Fehler bei der Preisberechnung',
      details: moduleError.message
    });
  }

  try {
    // Erweiterte Stripe Checkout-Konfiguration für maiosshop.com
    const sessionConfig = {
      payment_method_types: ['card'], // Nur Kreditkarten für maximale Kompatibilität
      
      payment_intent_data: {
        description: 'Einkauf bei Maios',
        capture_method: 'automatic',
        setup_future_usage: 'off_session',
        metadata: {
          order_id: `ORD-${Date.now()}`,
          shop_domain: 'maiosshop.com'
        }
      },
      automatic_payment_methods: {
        enabled: true
      },
      line_items,
      mode: 'payment',
      success_url: `${process.env.REPL_URL || 'https://maiosshop.com'}/success.html`,
      cancel_url: `${process.env.REPL_URL || 'https://maiosshop.com'}/cart.html`,
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
      }
    };
    
    // 🚀 AUTOMATISCHE CJ-ZAHLUNG: Füge Payment Intent mit Transfer hinzu
    if (process.env.CJ_STRIPE_ACCOUNT_ID && split.cjCost > 0) {
      // Berechne maximalen Transfer-Betrag (nie mehr als Gesamtbetrag)
      const cartTotalInCents = Math.round(split.total * 100);
      const maxTransferAmount = Math.min(
        Math.round(split.cjCost * 100),  // CJ-Kosten in Cents
        cartTotalInCents - 1             // Gesamtbetrag - 1 Cent (für Stripe-Gebühr)
      );

      console.log('💳 Aktiviere automatischen Transfer an CJ Sub-Account');
      console.log(`   Ursprünglicher CJ-Betrag: €${split.cjCost.toFixed(2)}`);
      console.log(`   Angepasster Transfer-Betrag: €${(maxTransferAmount/100).toFixed(2)} (${maxTransferAmount} cents)`);
      
      // Nur Transfer hinzufügen wenn positiver Betrag
      if (maxTransferAmount > 0) {
        // Existierende payment_intent_data Objekt erweitern statt überschreiben
        sessionConfig.payment_intent_data = {
          ...sessionConfig.payment_intent_data,
          application_fee_amount: 0, // Keine Platform-Gebühr
          transfer_data: {
            amount: maxTransferAmount,
            destination: process.env.CJ_STRIPE_ACCOUNT_ID
          },
          metadata: {
            cj_cost: split.cjCost.toFixed(2),
            your_profit: split.yourProfit.toFixed(2),
            profit_percentage: split.profitPercentage,
            adjusted_transfer: (maxTransferAmount/100).toFixed(2)
          }
        };
        
        console.log('✅ Automatischer Transfer konfiguriert!');
        console.log(`   Destination: ${process.env.CJ_STRIPE_ACCOUNT_ID}`);
      } else {
        console.log('⚠️ Kein Transfer möglich - Gewinn zu gering');
      }
    } else if (!process.env.CJ_STRIPE_ACCOUNT_ID) {
      console.log('⚠️  CJ Sub-Account nicht konfiguriert - Transfer übersprungen');
      console.log('💡 Führe aus: node setup-stripe-cj-split.js');
    }
    
    // Füge Kundendaten hinzu wenn vorhanden
    if (customerInfo && customerInfo.email) {
      sessionConfig.customer_email = customerInfo.email;
    }
    
    // Setze Standard-Land basierend auf ausgewähltem Land
    if (country) {
      console.log('🌍 Setze Standard-Land für Stripe:', country);
    }
    
    // Füge Rabatt hinzu wenn vorhanden
    if (discount && discount.percent && discount.code) {
      try {
        console.log('🎫 Erstelle Coupon:', discount.code, discount.percent + '%');
        const couponId = await createOrGetCoupon(discount.percent, discount.code);
        sessionConfig.discounts = [{
          coupon: couponId
        }];
        console.log('✅ Coupon erfolgreich hinzugefügt:', couponId);
      } catch (couponError) {
        console.error('❌ Coupon-Fehler:', couponError.message);
        // Fahre ohne Coupon fort, anstatt zu scheitern
        console.log('⚠️ Fahre ohne Rabatt fort');
      }
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    // Stripe Checkout Link (z.B. für Debugging oder manuelle Weiterleitung)
    console.log('Stripe Checkout Link:', session.url);
    res.json({ id: session.id, url: session.url }); // session.url ist der Stripe-Zahlungslink
  } catch (err) {
    // Stripe gibt oft einen hilfreichen Fehlertext zurück!
    console.error('❌ Stripe Checkout Error:', {
      message: err.message,
      type: err.type,
      code: err.code,
      param: err.param,
      stack: err.stack?.split('\n')[0] // Nur erste Zeile des Stack Trace
    });
    
    // Benutzerfreundliche Fehlermeldungen
    let userMessage = 'Fehler beim Erstellen der Checkout-Session';
    if (err.message.includes('coupon')) {
      userMessage = 'Fehler beim Anwenden des Gutscheins';
    } else if (err.message.includes('currency')) {
      userMessage = 'Währungsfehler - bitte versuchen Sie es erneut';
    } else if (err.message.includes('line_items')) {
      userMessage = 'Fehler bei den Produktdaten';
    }
    
    res.status(500).json({
      error: userMessage,
      code: err.code || 'checkout_error'
    });
  }
});

// Stripe Webhook für Zahlungsbestätigung
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payment system not configured' });
  }
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle Checkout Session (Stripe Checkout)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Hole vollständige Session-Daten mit Line Items
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'customer']
      });
      
      // Erstelle Bestelldaten aus Stripe Session
      const orderData = {
        order_id: generateOrderId(),
        receipt_number: `KB-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
        customer_email: fullSession.customer_details.email,
        customer_name: fullSession.customer_details.name,
        customer_phone: fullSession.customer_details.phone || null,
        shipping_address: JSON.stringify(fullSession.shipping_details?.address || {}),
        billing_address: JSON.stringify(fullSession.customer_details?.address || {}),
        payment_method: 'card',
        payment_status: 'paid',
        subtotal: fullSession.amount_subtotal / 100, // Stripe gibt Cents zurück
        shipping_cost: (fullSession.total_details?.amount_shipping || 0) / 100,
        tax_amount: (fullSession.total_details?.amount_tax || 0) / 100,
        total_amount: fullSession.amount_total / 100,
        currency: fullSession.currency.toUpperCase(),
        notes: `Stripe Payment ID: ${session.payment_intent}`,
        items: fullSession.line_items.data.map(item => ({
          product_id: item.price.product,
          product_name: item.description,
          product_sku: item.price.metadata?.sku || null,
          product_image: null,
          color: item.price.metadata?.color || null,
          quantity: item.quantity,
          unit_price: item.price.unit_amount / 100,
          total_price: item.amount_total / 100
        })),
        created_at: new Date(session.created * 1000).toISOString()
      };
      
      // Erstelle Stripe Invoice
      try {
        // 1. Kunde erstellen oder abrufen
        let customer;
        if (fullSession.customer) {
          customer = await stripe.customers.retrieve(fullSession.customer);
        } else {
          customer = await stripe.customers.create({
            email: fullSession.customer_details.email,
            name: fullSession.customer_details.name,
            phone: fullSession.customer_details.phone,
            address: fullSession.customer_details.address,
            metadata: {
              order_id: orderData.order_id
            }
          });
        }
        
        // 2. Erstelle Invoice zuerst
        const invoice = await stripe.invoices.create({
          customer: customer.id,
          auto_advance: false,
          collection_method: 'send_invoice',
          days_until_due: 0,
          description: `Bestellung ${orderData.order_id}`,
          footer: `Vielen Dank für Ihren Einkauf!\n\nBestellnummer: ${orderData.order_id}\nKassenbon-Nr: ${orderData.receipt_number}\n\nDiese Rechnung wurde bereits bezahlt.`,
          metadata: {
            order_id: orderData.order_id,
            receipt_number: orderData.receipt_number,
            payment_intent: session.payment_intent,
            paid: 'true'
          }
        });
        
        // 3. Füge Invoice Items zur Invoice hinzu
        for (const item of orderData.items) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(item.total_price * 100), // Gesamtpreis in Cents
            currency: orderData.currency.toLowerCase(),
            description: `${item.quantity}x ${item.product_name}${item.color ? ` (${item.color})` : ''} - je ${item.unit_price.toFixed(2)}€`,
            metadata: {
              product_id: item.product_id,
              product_sku: item.product_sku || '',
              order_id: orderData.order_id,
              quantity: item.quantity.toString()
            }
          });
        }
        
        // 4. Versandkosten hinzufügen (falls vorhanden)
        if (orderData.shipping_cost > 0) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: invoice.id,
            amount: Math.round(orderData.shipping_cost * 100),
            currency: orderData.currency.toLowerCase(),
            description: 'Versandkosten',
            metadata: {
              order_id: orderData.order_id
            }
          });
        }
        
        // 5. Invoice finalisieren
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        
        // 6. E-Mail senden (funktioniert nur im Live-Modus)
        try {
          await stripe.invoices.sendInvoice(finalizedInvoice.id);
        } catch (emailError) {
          console.log('⚠️ E-Mail-Versand übersprungen (Testmodus)');
        }
        
        console.log(`✅ Stripe Invoice erstellt: ${finalizedInvoice.number}`);
        console.log(`📄 Invoice URL: ${finalizedInvoice.hosted_invoice_url}`);
        console.log(`📥 PDF Download: ${finalizedInvoice.invoice_pdf}`);
        console.log(`📧 Rechnung per E-Mail an ${orderData.customer_email} gesendet`);
        
      } catch (invoiceError) {
        console.error('❌ Stripe Invoice-Erstellung fehlgeschlagen:', invoiceError);
      }
      
      // ==========================================
      // 🚀 NEU: AUTOMATISCHE CJ-BESTELLUNG
      // ==========================================
      try {
        console.log('\n🏭 AUTOMATISCHE CJ-BESTELLUNG STARTEN...');
        
        // Importiere CJ Payment Calculator
        const { calculateCJCost, calculatePaymentSplit } = require('./cj-payment-calculator');
        
        // Berechne CJ-Kosten
        const cartItems = orderData.items.map(item => ({
          id: item.product_id,
          price: item.unit_price,
          quantity: item.quantity
        }));
        
        const country = JSON.parse(orderData.shipping_address).country || 'DE';
        const cjCost = calculateCJCost(cartItems, country);
        const split = calculatePaymentSplit(orderData.total_amount, cjCost);
        
        console.log(`💰 Kunde zahlt: €${split.total.toFixed(2)}`);
        console.log(`🏭 CJ-Kosten: €${split.cjCost.toFixed(2)}`);
        console.log(`✅ Dein Gewinn: €${split.yourProfit.toFixed(2)} (${split.profitPercentage}%)`);
        
        // Prüfe ob CJ Sub-Account existiert
        if (process.env.CJ_STRIPE_ACCOUNT_ID) {
          console.log('💳 CJ Sub-Account gefunden - Automatische Zahlung aktiv');
          
          // Hinweis: Transfer wird automatisch durch Stripe Split gemacht
          // (wird in cart.js beim Checkout konfiguriert)
          console.log('✅ Zahlung wird automatisch aufgeteilt');
          
        } else {
          console.log('⚠️  CJ Sub-Account nicht konfiguriert');
          console.log('💡 Führe aus: node setup-stripe-cj-split.js');
        }
        
        // Erstelle CJ-Bestellung (wenn API verfügbar)
        if (cjAPI && orderData.items.length > 0) {
          console.log('📦 Erstelle CJ-Bestellung...');
          
          const cjOrderData = {
            orderNumber: orderData.order_id,
            shippingAddress: {
              name: orderData.customer_name,
              email: orderData.customer_email,
              phone: orderData.customer_phone || '',
              ...JSON.parse(orderData.shipping_address)
            },
            products: orderData.items.map(item => ({
              vid: item.product_sku || `PROD-${item.product_id}`,
              quantity: item.quantity,
              variantId: item.color || null
            })),
            shippingMethod: 'Standard',
            fromCountryCode: 'DE'
          };
          
          try {
            const cjOrder = await cjAPI.createOrderV2(cjOrderData);
            console.log(`✅ CJ-Bestellung erstellt: ${cjOrder.orderId}`);
            
            // Speichere CJ-Bestellnummer
            await dbOperations.addTracking({
              order_id: orderData.order_id,
              status: 'order_placed',
              description: 'Bestellung an CJ Dropshipping gesendet',
              tracking_number: cjOrder.orderId,
              carrier: 'CJ Dropshipping'
            });
            
          } catch (cjError) {
            console.error('❌ CJ-Bestellung fehlgeschlagen:', cjError.message);
            
            // Sende Admin-Warnung
            await emailService.sendEmail({
              to: 'maioscorporation@gmail.com',
              subject: `⚠️ CJ-Bestellung fehlgeschlagen: ${orderData.order_id}`,
              html: `
                <h2>CJ-Bestellung konnte nicht automatisch erstellt werden</h2>
                <p><strong>Bestellnummer:</strong> ${orderData.order_id}</p>
                <p><strong>Kunde:</strong> ${orderData.customer_name}</p>
                <p><strong>Betrag:</strong> €${orderData.total_amount.toFixed(2)}</p>
                <p><strong>Fehler:</strong> ${cjError.message}</p>
                <p><strong>Aktion erforderlich:</strong> Bitte manuell in CJ Dashboard erstellen</p>
                <hr>
                <p>Geld ist in deinem Stripe-Konto verfügbar.</p>
              `
            });
          }
        } else {
          console.log('⚠️  CJ API nicht verfügbar - Bestellung muss manuell erstellt werden');
        }
        
      } catch (autoOrderError) {
        console.error('❌ Automatische CJ-Bestellung Fehler:', autoOrderError.message);
      }
    }
    
    // Handle Payment Intent (Direkte Kartenzahlung)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      console.log(`✅ Payment Intent erfolgreich: ${paymentIntent.id}`);
      console.log(`⚠️ Hinweis: Für Payment Intent Rechnungen muss noch Logik implementiert werden`);
      // TODO: Hier könnte man auch eine Rechnung erstellen, wenn man die Bestelldaten hat
    }
    
    res.status(200).end();
  } catch (err) {
    console.error('Webhook Error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.post('/api/create-payment-intent', async (req, res) => {
  const { cart, email, country, city, firstname, lastname } = req.body;
  const currency = getCurrencyByCountry(country);
  
  // Berechne Gesamtbetrag in EUR
  let amountInEUR = 0;
  for (const item of cart) {
    amountInEUR += (item.price || 0) * item.quantity;
  }

  // Versandkosten in EUR (pauschale Kosten basierend auf Land)
  const shippingCostEUR = calculateShippingCost(country);
  amountInEUR += shippingCostEUR;
  
  console.log(`📦 Versandkosten für ${country}: €${shippingCostEUR.toFixed(2)}`);
  
  // Rechne Gesamtbetrag in Zielwährung um
  const convertedAmount = await convertPrice(amountInEUR, currency);
  const amount = Math.round(convertedAmount * 100);

  try {
    if (amount < 50) {
      return res.status(400).json({ error: 'Gesamtbetrag zu niedrig für Stripe.' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      receipt_email: email,
      description: 'Maios Bestellung',
      payment_method_types: ['card'],
      metadata: {
        customer_name: `${firstname || ''} ${lastname || ''}`.trim(),
        customer_city: city || '',
        customer_country: country || '',
        order_source: 'web'
      }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Payment Intent Error:', err);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Kontaktformular-Endpunkt
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Bitte Name, E-Mail und Nachricht angeben.' });
    }
    
    // E-Mail über Resend senden
    const result = await emailService.sendEmail({
      to: 'maioscorporation@gmail.com',
      subject: 'Kontaktanfrage – Maios',
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Von:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        <p><strong>Nachricht:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
      replyTo: email
    });
    
    if (result.success) {
      res.json({ success: true });
    } else {
      throw new Error(result.error || 'E-Mail konnte nicht gesendet werden');
    }
  } catch (error) {
    console.error('Kontakt-Fehler:', error);
    res.status(500).json({ error: 'Senden fehlgeschlagen' });
  }
});

// ── EU-Widerruf (gesetzliches Widerrufsrecht) ────────────────────────
// Oeffentlicher Endpunkt: Kunde widerruft den Vertrag. Sendet eine
// Benachrichtigung an den Shop UND eine Eingangsbestaetigung an den Kunden
// (gesetzlich vorgeschrieben: Bestaetigung auf dauerhaftem Datentraeger).
app.post('/api/widerruf', async (req, res) => {
  try {
    const { orderId, email, name, orderDate, address, note } = req.body || {};
    if (!orderId || !email || !name) {
      return res.status(400).json({ error: 'Bitte Bestellnummer, Name und E-Mail angeben.' });
    }
    // einfache E-Mail-Plausibilitaet
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
    }

    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const eingegangen = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

    const detailsHtml = `
      <p><strong>Bestellnummer:</strong> ${esc(orderId)}</p>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>E-Mail:</strong> ${esc(email)}</p>
      <p><strong>Bestellt/erhalten am:</strong> ${esc(orderDate || 'Nicht angegeben')}</p>
      <p><strong>Anschrift:</strong> ${esc(address || 'Nicht angegeben')}</p>
      <p><strong>Anmerkung:</strong> ${esc(note || '—')}</p>
      <p><strong>Eingegangen:</strong> ${esc(eingegangen)}</p>`;

    // 1) Benachrichtigung an den Shop
    await emailService.sendEmail({
      to: 'maioscorporation@gmail.com',
      subject: `↩️ Widerruf: ${orderId}`,
      replyTo: email,
      html: `<h2>↩️ Neuer Widerruf eingegangen</h2>${detailsHtml}`
    });

    // 2) Eingangsbestaetigung an den Kunden (gesetzlich vorgeschrieben)
    await emailService.sendEmail({
      to: email,
      subject: `Bestätigung deines Widerrufs – Bestellung ${orderId}`,
      html: `
        <h2>Wir haben deinen Widerruf erhalten</h2>
        <p>Hallo ${esc(name)},</p>
        <p>hiermit bestätigen wir den Eingang deines Widerrufs zu folgender Bestellung.
        Eine eventuelle Rückzahlung erfolgt unverzüglich, spätestens binnen 14 Tagen.</p>
        ${detailsHtml}
        <p>Bitte sende die Ware – sofern bereits erhalten – unverzüglich an uns zurück.</p>
        <p>Dein Maios Shop Team<br>
        <a href="https://maiosshop.com">maiosshop.com</a></p>`
    });

    console.log(`↩️ Widerruf eingegangen: ${orderId} (${email})`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Widerruf-Fehler:', error.message);
    res.status(500).json({ error: 'Widerruf konnte nicht gesendet werden.' });
  }
});

// Retoure-Anfrage Endpunkt
app.post('/api/return-request', async (req, res) => {
  try {
    const { orderId, email, reason, items } = req.body || {};
    if (!orderId || !email) {
      return res.status(400).json({ error: 'Bitte Bestellnummer und E-Mail angeben.' });
    }
    
    // Validiere Bestellnummer gegen Datenbank
    let orderExists = false;
    let orderDetails = null;
    let autoApproved = false;
    let refundProcessed = false;
    
    try {
      orderDetails = await dbOperations.getOrderByOrderId(orderId);
      orderExists = !!orderDetails;
      
      // Prüfe ob E-Mail zur Bestellung passt
      if (orderExists && orderDetails.customer_email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ 
          error: 'Die angegebene E-Mail-Adresse stimmt nicht mit der Bestellung überein.' 
        });
      }
      
      // 🚀 AUTOMATISCHE GENEHMIGUNG prüfen
      if (orderExists && orderDetails) {
        const orderAge = Math.floor((Date.now() - new Date(orderDetails.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const autoApproveReasons = ['Produkt defekt', 'Falsche Ware erhalten', 'Beschädigt angekommen'];
        
        console.log(`🔍 Prüfe automatische Genehmigung:`);
        console.log(`   Bestellalter: ${orderAge} Tage`);
        console.log(`   Grund: ${reason}`);
        
        // Automatisch genehmigen wenn:
        // 1. Bestellung < 14 Tage alt
        // 2. Grund ist in Auto-Approve Liste
        // Nur aktiv wenn RETURNS_AUTO_APPROVE=true gesetzt ist (Standard: manuell)
        if (process.env.RETURNS_AUTO_APPROVE === 'true' && orderAge <= 14 && autoApproveReasons.includes(reason)) {
          autoApproved = true;
          console.log('✅ Retoure wird automatisch genehmigt!');
          
          // Automatischer Stripe Refund
          try {
            if (stripe && orderDetails.payment_intent_id) {
              console.log('💳 Erstelle automatischen Stripe Refund...');
              
              const refund = await stripe.refunds.create({
                payment_intent: orderDetails.payment_intent_id,
                reason: 'requested_by_customer',
                metadata: {
                  order_id: orderId,
                  return_reason: reason,
                  auto_approved: 'true'
                }
              });
              
              refundProcessed = true;
              console.log(`✅ Refund erstellt: ${refund.id}`);
              console.log(`   Betrag: €${(refund.amount / 100).toFixed(2)}`);
              
              // Update Order Status
              await dbOperations.updateOrderStatus(orderId, 'refunded');
              
              // 🚀 AUTOMATISCHE CJ-RETOURE
              try {
                console.log('📦 Erstelle automatische CJ-Retoure...');
                
                // Hole CJ Order ID aus Tracking
                const tracking = await dbOperations.getTracking(orderId);
                let cjOrderId = null;
                
                if (tracking && tracking.length > 0) {
                  cjOrderId = tracking.find(t => t.carrier === 'CJ Dropshipping')?.tracking_number;
                }
                
                if (cjOrderId && cjAPI) {
                  const cjReturnData = {
                    orderId: cjOrderId,
                    reason: reason,
                    description: `Customer return request - ${reason}`,
                    refundAmount: orderDetails.total_amount,
                    returnType: 'refund' // oder 'exchange'
                  };
                  
                  const cjReturn = await cjAPI.createReturn(cjReturnData);
                  
                  if (cjReturn && cjReturn.success) {
                    console.log(`✅ CJ-Retoure erstellt: ${cjReturn.returnId || 'ID pending'}`);
                    
                    // Speichere CJ-Retoure ID
                    await dbOperations.addTracking({
                      order_id: orderId,
                      status: 'return_requested',
                      description: 'CJ-Retoure automatisch erstellt',
                      tracking_number: cjReturn.returnId || 'pending',
                      carrier: 'CJ Dropshipping Return'
                    });
                  } else {
                    console.log('⚠️  CJ-Retoure konnte nicht erstellt werden - manuell erforderlich');
                  }
                } else {
                  console.log('⚠️  CJ Order ID nicht gefunden - CJ-Retoure manuell erforderlich');
                }
                
              } catch (cjReturnError) {
                console.error('❌ CJ-Retoure Fehler:', cjReturnError.message);
                console.log('⚠️  CJ-Retoure muss manuell erstellt werden');
              }
              
            } else {
              console.log('⚠️  Stripe Refund nicht möglich - Payment Intent fehlt');
            }
          } catch (refundError) {
            console.error('❌ Automatischer Refund fehlgeschlagen:', refundError.message);
            autoApproved = false; // Fallback zu manuell
          }
        } else {
          console.log('⚠️  Automatische Genehmigung nicht möglich:');
          if (orderAge > 14) console.log(`   - Bestellung zu alt (${orderAge} Tage)`);
          if (!autoApproveReasons.includes(reason)) console.log(`   - Grund nicht in Auto-Approve Liste`);
        }
      }
      
    } catch (dbError) {
      console.warn('⚠️ Datenbank-Validierung fehlgeschlagen:', dbError.message);
      // Fahre fort ohne Validierung (Fallback)
    }
    
    // Erstelle professionelle HTML-E-Mail
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="text-align: center; padding: 40px 0; background: linear-gradient(135deg, ${autoApproved ? '#28a745' : '#dc3545'} 0%, ${autoApproved ? '#218838' : '#c82333'} 100%);">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${autoApproved ? '✅ RETOURE AUTOMATISCH GENEHMIGT' : '🔄 RETOURE-ANFRAGE'}</h1>
                            ${autoApproved ? '<p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">Refund wurde automatisch verarbeitet</p>' : ''}
                        </td>
                    </tr>
                    
                    <!-- Hauptinhalt -->
                    <tr>
                        <td style="padding: 40px;">
                            ${autoApproved ? `
                            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #155724; font-size: 14px; font-weight: 600;">✅ RETOURE AUTOMATISCH GENEHMIGT & REFUND VERARBEITET</p>
                                <p style="margin: 10px 0 0 0; color: #155724; font-size: 12px;">Kunde erhält Geld automatisch zurück. CJ-Retoure muss noch geklärt werden.</p>
                            </div>
                            ` : `
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600;">⚠️ NEUE RETOURE-ANFRAGE - MANUELLE PRÜFUNG ERFORDERLICH</p>
                            </div>
                            `}
                            
                            <!-- Bestellnummer -->
                            <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 0 0 20px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Bestellnummer</p>
                                <p style="margin: 5px 0 0 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">${orderId}</p>
                                ${orderExists ? '<p style="margin: 10px 0 0 0; color: #28a745; font-size: 13px;">✅ Bestellung in Datenbank gefunden</p>' : '<p style="margin: 10px 0 0 0; color: #ffc107; font-size: 13px;">⚠️ Bestellung nicht in Datenbank gefunden</p>'}
                            </div>
                            
                            <!-- Kundendaten -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 12px; text-transform: uppercase;">Kunden-E-Mail</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">${email}</p>
                                        ${orderExists && orderDetails ? `<p style="margin: 10px 0 0 0; color: #666666; font-size: 14px;">Kunde: ${orderDetails.customer_name || 'Nicht angegeben'}</p>` : ''}
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Retouren-Grund -->
                            <div style="margin: 0 0 20px 0;">
                                <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">Grund der Retoure</h2>
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                    <p style="margin: 0; color: #495057; font-size: 15px; line-height: 1.6;">${reason || '<em style="color: #999;">Kein Grund angegeben</em>'}</p>
                                </div>
                            </div>
                            
                            ${orderExists && orderDetails ? `
                            <!-- Bestelldetails -->
                            <div style="margin: 0 0 20px 0;">
                                <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">Bestelldetails</h2>
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;"><strong>Bestelldatum:</strong> ${new Date(orderDetails.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;"><strong>Gesamtbetrag:</strong> €${orderDetails.total_amount.toFixed(2)}</p>
                                    <p style="margin: 0; color: #666666; font-size: 14px;"><strong>Status:</strong> ${orderDetails.order_status || 'Unbekannt'}</p>
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- Aktionen -->
                            <div style="margin: 30px 0 0 0; padding: 20px; background: linear-gradient(135deg, #e9ecef 0%, #f8f9fa 100%); border-radius: 8px; border: 2px solid #dc3545;">
                                <p style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">📋 Nächste Schritte:</p>
                                <ol style="margin: 0; padding-left: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
                                    <li>Bestellung in Datenbank überprüfen</li>
                                    <li>Retourenlabel erstellen und an Kunden senden</li>
                                    <li>Retoure in System erfassen</li>
                                    <li>Nach Wareneingang: Rückerstattung veranlassen</li>
                                </ol>
                            </div>
                            
                            <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; text-align: center;">
                                Diese E-Mail wurde automatisch generiert.<br>
                                Antworte direkt auf diese E-Mail, um mit dem Kunden zu kommunizieren.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1a1a1a; padding: 20px; text-align: center;">
                            <p style="margin: 0; color: #999999; font-size: 13px;">Maios Shop - Retouren-System</p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
    
    // E-Mail über Resend senden
    const result = await emailService.sendEmail({
      to: 'maioscorporation@gmail.com',
      subject: `🔄 Retoure-Anfrage #${orderId}${orderExists ? ' ✅' : ' ⚠️'}`,
      html: htmlContent,
      replyTo: email
    });
    
    if (result.success) {
      console.log(`✅ Retoure-Anfrage für ${orderId} gesendet (Bestellung ${orderExists ? 'gefunden' : 'nicht gefunden'})`);
      if (autoApproved) {
        console.log(`✅ Retoure automatisch genehmigt und Refund verarbeitet`);
      }
      
      res.json({ 
        success: true, 
        orderFound: orderExists,
        autoApproved: autoApproved,
        refundProcessed: refundProcessed,
        message: autoApproved 
          ? 'Retoure automatisch genehmigt! Rückerstattung wird verarbeitet.' 
          : orderExists 
            ? 'Retoure-Anfrage erfolgreich gesendet. Wir prüfen Ihre Anfrage.' 
            : 'Retoure-Anfrage gesendet. Bestellung wird manuell geprüft.'
      });
    } else {
      throw new Error(result.error || 'E-Mail konnte nicht gesendet werden');
    }
  } catch (error) {
    console.error('❌ Retoure-Fehler:', error);
    res.status(500).json({ error: 'Senden fehlgeschlagen' });
  }
});

// ==========================================
// CJ DROPSHIPPING API ROUTES
// ==========================================

// Get CJ Product List
app.get('/api/cj/products', async (req, res) => {
  try {
    const params = req.query;
    const products = await cjAPI.getProductList(params);
    res.json(products);
  } catch (error) {
    console.error('CJ Products Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Search CJ Products
app.post('/api/cj/products/search', async (req, res) => {
  try {
    const searchParams = req.body;
    const products = await cjAPI.queryProducts(searchParams);
    res.json(products);
  } catch (error) {
    console.error('CJ Product Search Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Product Categories
app.get('/api/cj/categories', async (req, res) => {
  try {
    const categories = await cjAPI.getProductCategory();
    res.json(categories);
  } catch (error) {
    console.error('CJ Categories Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Product Details by VID
app.get('/api/cj/product/:vid', async (req, res) => {
  try {
    const { vid } = req.params;
    const product = await cjAPI.queryProductByVid(vid);
    res.json(product);
  } catch (error) {
    console.error('CJ Product Details Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Product Stock
app.get('/api/cj/product/:vid/stock', async (req, res) => {
  try {
    const { vid } = req.params;
    const stock = await cjAPI.getProductStockByVid(vid);
    res.json(stock);
  } catch (error) {
    console.error('CJ Product Stock Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Funktion zur automatischen Auswahl der Versandmethode
function getShippingMethod(country) {
  // Europa - Standard Versand mit Tracking
  const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'GB', 'PL', 'SE', 'DK', 'NO', 'FI'];
  
  if (europeanCountries.includes(country)) {
    return "CJ Packet Registered"; // Mit Tracking für Europa (7-13 Tage)
  }
  
  // USA
  if (country === 'US') {
    return "CJ Packet Ordinary"; // Standard für USA (10-20 Tage)
  }
  
  // Rest der Welt
  return "CJ Packet Ordinary"; // Standard weltweit
}

// Create CJ Order mit automatischer Versandmethoden-Auswahl
app.post('/api/cj/orders/create', async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      // Automatische Versandmethoden-Auswahl basierend auf Zielland
      logisticName: getShippingMethod(req.body.shippingAddress?.country || 'DE'),
      // Versand aus China Warehouse (günstiger und schneller)
      fromCountryCode: "CN"
    };
    
    console.log(`📦 Bestellung erstellt mit Versandmethode: ${orderData.logisticName} nach ${orderData.shippingAddress?.country || 'DE'}`);
    console.log(`🏭 Warehouse: ${orderData.fromCountryCode}`);
    console.log(`📋 Komplette Order-Daten:`, JSON.stringify(orderData, null, 2));
    
    const order = await cjAPI.createOrderV2(orderData);
    res.json(order);
  } catch (error) {
    console.error('CJ Create Order Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get CJ Orders
app.get('/api/cj/orders', async (req, res) => {
  try {
    const params = req.query;
    const orders = await cjAPI.getShoppingOrderList(params);
    res.json(orders);
  } catch (error) {
    console.error('CJ Orders Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Confirm CJ Order
app.post('/api/cj/orders/:orderId/confirm', async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await cjAPI.confirmOrder(orderId);
    res.json(result);
  } catch (error) {
    console.error('CJ Confirm Order Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Order Details
app.get('/api/cj/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await cjAPI.getOrderDetail(orderId);
    res.json(order);
  } catch (error) {
    console.error('CJ Order Details Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Calculate Shipping Cost
app.post('/api/cj/shipping/calculate', async (req, res) => {
  try {
    const shippingData = req.body;
    const cost = await cjAPI.freightCalculate(shippingData);
    res.json(cost);
  } catch (error) {
    console.error('CJ Shipping Calculate Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Track Package
app.get('/api/cj/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const tracking = await cjAPI.getTrackInfo(trackingNumber);
    res.json(tracking);
  } catch (error) {
    console.error('CJ Tracking Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Account Balance
app.get('/api/cj/balance', async (req, res) => {
  try {
    const balance = await cjAPI.getBalance();
    res.json(balance);
  } catch (error) {
    console.error('CJ Balance Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Product Sourcing
app.post('/api/cj/sourcing/create', async (req, res) => {
  try {
    const sourcingData = req.body;
    const result = await cjAPI.createProductSourcing(sourcingData);
    res.json(result);
  } catch (error) {
    console.error('CJ Product Sourcing Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Disputes
app.get('/api/cj/disputes', async (req, res) => {
  try {
    const params = req.query;
    const disputes = await cjAPI.getDisputeList(params);
    res.json(disputes);
  } catch (error) {
    console.error('CJ Disputes Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Create Dispute
app.post('/api/cj/disputes/create', async (req, res) => {
  try {
    const disputeData = req.body;
    const dispute = await cjAPI.createDispute(disputeData);
    res.json(dispute);
  } catch (error) {
    console.error('CJ Create Dispute Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Test CJ API Connection
app.get('/api/cj/test', async (req, res) => {
  try {
    const result = await cjAPI.testConnection();
    res.json(result);
  } catch (error) {
    console.error('CJ API Test Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Get Available CJ API Methods
app.get('/api/cj/methods', (req, res) => {
  try {
    const methods = cjAPI.getAvailableMethods();
    res.json(methods);
  } catch (error) {
    console.error('CJ Methods Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// ==========================================
// KASSENBON SYSTEM API ROUTES
// ==========================================

// Neue Bestellung mit Kassenbon erstellen
app.post('/api/receipt/create', async (req, res) => {
  try {
    const { cart, customer, payment, shipping } = req.body;
    
    // Generiere eindeutige IDs
    const orderId = generateOrderId();
    const receiptNumber = `KB-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
    const receiptId = uuidv4();
    
    // Berechne Summen
    let subtotal = 0;
    const orderItems = cart.map(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      
      return {
        product_id: item.id,
        product_name: item.name,
        product_sku: item.sku || null,
        product_image: item.image || null,
        color: item.color || null,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: itemTotal
      };
    });
    
    const shippingCost = shipping?.cost || 0;
    const taxRate = 0.19;
    const taxAmount = (subtotal + shippingCost) * taxRate / (1 + taxRate);
    const totalAmount = subtotal + shippingCost;
    
    // Ermittle Währung basierend auf Lieferland
    const shippingCountry = shipping?.address?.country || customer.country || 'DE';
    const currency = getCurrencyByCountry(shippingCountry);
    
    // Erstelle Bestelldaten
    const orderData = {
      order_id: orderId,
      receipt_number: receiptNumber,
      customer_email: customer.email,
      customer_name: customer.name,
      customer_phone: customer.phone || null,
      shipping_address: JSON.stringify(shipping?.address || {}),
      billing_address: JSON.stringify(customer.billingAddress || shipping?.address || {}),
      payment_method: payment?.method || 'card',
      payment_status: payment?.status || 'pending',
      subtotal: subtotal,
      shipping_cost: shippingCost,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      currency: currency,
      notes: null,
      items: orderItems,
      created_at: new Date().toISOString()
    };
    
    // Speichere Bestellung in Datenbank
    await dbOperations.createOrder(orderData);
    await dbOperations.addOrderItems(orderId, orderItems);
    
    // Generiere PDF-Kassenbon
    const pdfResult = await receiptGenerator.generateReceipt(orderData);
    
    // Speichere Kassenbon-Info in Datenbank
    await dbOperations.saveReceipt({
      receipt_id: receiptId,
      order_id: orderId,
      receipt_number: receiptNumber,
      pdf_path: pdfResult.filePath
    });
    
    // Generiere HTML-Version für E-Mail
    const receiptHTML = receiptGenerator.generateHTMLReceipt(orderData);
    
    // Sende E-Mails mit EmailJS
    try {
      // Kunde
      await emailService.sendOrderConfirmation(orderData);
      await dbOperations.updateEmailStatus(receiptId, 'customer');
      
      // Admin
      await emailService.sendAdminNotification(orderData);
      await dbOperations.updateEmailStatus(receiptId, 'admin');
    } catch (emailError) {
      console.error('E-Mail-Versand Fehler:', emailError);
      // Fahre fort auch wenn E-Mail fehlschlägt
    }
    
    res.json({
      success: true,
      orderId: orderId,
      receiptNumber: receiptNumber,
      receiptUrl: pdfResult.relativePath,
      trackingUrl: `/tracking/${orderId}`,
      message: 'Bestellung erfolgreich erstellt und Kassenbon generiert'
    });
    
  } catch (error) {
    console.error('Kassenbon-Erstellung Fehler:', error);
    res.status(500).json({
      error: 'Fehler bei der Kassenbon-Erstellung'
    });
  }
});

// Bestellung abrufen
app.get('/api/receipt/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await dbOperations.getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Bestellabruf Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Alle Bestellungen abrufen (Admin)
app.get('/api/receipt/orders', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const orders = await dbOperations.getAllOrders(parseInt(limit), parseInt(offset));
    res.json(orders);
  } catch (error) {
    console.error('Bestellungen abrufen Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Bestellstatus aktualisieren
app.put('/api/receipt/order/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const result = await dbOperations.updateOrderStatus(orderId, status);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }
    
    // Tracking hinzufügen
    await dbOperations.addTracking({
      order_id: orderId,
      status: status,
      description: `Status geändert zu: ${status}`,
      tracking_number: null,
      carrier: null
    });
    
    res.json({ success: true, message: 'Status aktualisiert' });
  } catch (error) {
    console.error('Status-Update Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Tracking-Info hinzufügen
app.post('/api/receipt/order/:orderId/tracking', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, carrier, status, description } = req.body;
    
    await dbOperations.addTracking({
      order_id: orderId,
      status: status || 'shipped',
      description: description || 'Sendung wurde verschickt',
      tracking_number: trackingNumber,
      carrier: carrier
    });
    
    res.json({ success: true, message: 'Tracking-Info hinzugefügt' });
  } catch (error) {
    console.error('Tracking-Update Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Bestellungen nach E-Mail suchen
app.get('/api/receipt/orders/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await dbOperations.getOrdersByEmail(email);
    res.json(orders);
  } catch (error) {
    console.error('E-Mail-Suche Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Statistiken abrufen
app.get('/api/receipt/statistics', async (req, res) => {
  try {
    const stats = await dbOperations.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Statistik-Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// ── Aufrufe / Besucher-Tracking ──────────────────────────────────────
// Oeffentlicher Endpunkt: Client meldet Seitenaufruf. Keine rohe IP wird
// gespeichert — Land kommt clientseitig (geolocation-tracker.js), Pfad/Referrer
// werden auf sinnvolle Laengen gekuerzt.
app.post('/api/track/view', async (req, res) => {
  try {
    const { path: viewPath, referrer, country, session_id } = req.body || {};
    if (!viewPath || typeof viewPath !== 'string') {
      return res.status(400).json({ error: 'path erforderlich' });
    }
    // Admin-Bereich nicht mitzaehlen
    if (viewPath.includes('a29715347575')) {
      return res.json({ success: true, skipped: true });
    }
    const trim = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
    await dbOperations.addPageView({
      path: trim(viewPath, 512),
      referrer: trim(referrer, 512),
      country: trim(country, 64),
      user_agent: trim(req.headers['user-agent'], 256),
      session_id: trim(session_id, 64)
    });
    res.json({ success: true });
  } catch (error) {
    console.error('⚠️ Tracking-Fehler:', error.message);
    // Tracking darf das Frontend nie stoeren — immer 200 zurueck
    res.json({ success: false });
  }
});

// Admin: Kennzahlen fuer die Dashboard-Kacheln
// Routen liegen bewusst UNTER /a29715347575/ (= authentifizierter Pfad-Teilbaum),
// damit der Browser bei fetch() aus dem Dashboard die Basic-Auth-Credentials
// zuverlaessig mitsendet. Geschuetzt durch app.use('/a29715347575', requireAdminAuth).
app.get('/a29715347575/api/views/stats', async (req, res) => {
  try {
    res.json(await dbOperations.getViewStats());
  } catch (error) {
    console.error('Aufruf-Statistik-Fehler:', error.message);
    res.status(500).json({ error: 'Aufruf-Statistik nicht verfuegbar' });
  }
});

// Admin: meistbesuchte Seiten
app.get('/a29715347575/api/views/top-pages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    res.json(await dbOperations.getTopPages(limit, days));
  } catch (error) {
    console.error('Top-Seiten-Fehler:', error.message);
    res.status(500).json({ error: 'Top-Seiten nicht verfuegbar' });
  }
});

// Admin: Aufrufe nach Land
app.get('/a29715347575/api/views/top-countries', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    res.json(await dbOperations.getTopCountries(limit, days));
  } catch (error) {
    console.error('Top-Laender-Fehler:', error.message);
    res.status(500).json({ error: 'Top-Laender nicht verfuegbar' });
  }
});

// Erlaubte Zeitraum-Filter fuer die Dashboard-Diagramme
const TIMESERIES_RANGES = ['7d', '30d', '12m', 'all'];
const parseRange = (q) => (TIMESERIES_RANGES.includes(q) ? q : '30d');

// Admin: Zeitreihe fuer den Chart (Aufrufe/Besucher)
app.get('/a29715347575/api/views/timeseries', async (req, res) => {
  try {
    res.json(await dbOperations.getViewsTimeseries(parseRange(req.query.range)));
  } catch (error) {
    console.error('Zeitreihen-Fehler:', error.message);
    res.status(500).json({ error: 'Zeitreihe nicht verfuegbar' });
  }
});

// Admin: Zeitreihe fuer Bestellungen + Umsatz (treibt das umschaltbare Dashboard-Chart)
app.get('/a29715347575/api/orders/timeseries', async (req, res) => {
  try {
    res.json(await dbOperations.getOrdersTimeseries(parseRange(req.query.range)));
  } catch (error) {
    console.error('Bestell-Zeitreihen-Fehler:', error.message);
    res.status(500).json({ error: 'Zeitreihe nicht verfuegbar' });
  }
});

// Kassenbon erneut senden
app.post('/api/receipt/resend/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email } = req.body;
    
    const order = await dbOperations.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }
    
    // Generiere HTML-Version
    const receiptHTML = receiptGenerator.generateHTMLReceipt(order);
    
    // Finde PDF-Pfad
    const pdfPath = `receipts/receipt_${order.receipt_number}.pdf`;
    const fullPdfPath = require('path').join(__dirname, pdfPath);
    
    // Sende E-Mail mit EmailJS
    await emailService.sendOrderConfirmation({
      ...order,
      customer_email: email || order.customer_email
    });
    
    res.json({ success: true, message: 'Kassenbon erneut gesendet' });
  } catch (error) {
    console.error('Kassenbon erneut senden Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Test E-Mail-System
app.post('/api/receipt/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await emailService.sendTestEmail(email);
    res.json(result);
  } catch (error) {
    console.error('Test-E-Mail Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// ==========================================
// EXCHANGE RATE API ROUTES
// ==========================================

// Hole aktuelle Wechselkurse
app.get('/api/exchange-rates', async (req, res) => {
  try {
    const rates = await exchangeRateService.fetchLiveRates();
    const cacheStatus = exchangeRateService.getCacheStatus();
    
    res.json({
      success: true,
      baseCurrency: 'EUR',
      rates: rates,
      cache: cacheStatus
    });
  } catch (error) {
    console.error('Exchange Rates Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Konvertiere Preis
app.post('/api/exchange-rates/convert', async (req, res) => {
  try {
    const { amount, from, to } = req.body;
    
    if (!amount || !from || !to) {
      return res.status(400).json({ error: 'Amount, from, and to currency required' });
    }
    
    const convertedAmount = await exchangeRateService.convertBetweenCurrencies(
      parseFloat(amount),
      from,
      to
    );
    
    const formatted = exchangeRateService.formatPrice(convertedAmount, to);
    
    res.json({
      success: true,
      original: {
        amount: parseFloat(amount),
        currency: from
      },
      converted: {
        amount: convertedAmount,
        currency: to,
        formatted: formatted
      }
    });
  } catch (error) {
    console.error('Currency Conversion Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Hole unterstützte Währungen
app.get('/api/exchange-rates/currencies', async (req, res) => {
  try {
    const currencies = await exchangeRateService.getSupportedCurrencies();
    res.json({
      success: true,
      count: currencies.length,
      currencies: currencies
    });
  } catch (error) {
    console.error('Currencies Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Cache-Status abrufen
app.get('/api/exchange-rates/cache-status', (req, res) => {
  try {
    const status = exchangeRateService.getCacheStatus();
    res.json({
      success: true,
      cache: status
    });
  } catch (error) {
    console.error('Cache Status Error:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Cache leeren (Admin)
app.post('/api/exchange-rates/clear-cache', (req, res) => {
  try {
    exchangeRateService.clearCache();
    res.json({
      success: true,
      message: 'Exchange rate cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear Cache Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📱 Access URL: ${process.env.REPL_URL || 'https://maiosshop.com'}`);
  console.log(`💻 API-Endpunkte:`);
  console.log(`   ✅ /api/create-checkout-session (Stripe Checkout)`); 
  console.log(`   ✅ /api/exchange-rates (Währungskurse)`);  
  console.log(`   ✅ /stripe-webhook (Stripe Events)`);  
  console.log('='.repeat(50));
});
