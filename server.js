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

// Initialize SendGrid only if API key is available
let sgMail = null;
if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized');
} else {
  console.warn('⚠️  SendGrid not initialized - SENDGRID_API_KEY missing');
}

// Initialize CJ Dropshipping API (has its own fallback system)
const CJDropshippingAPI = require('./cj-dropshipping-api');
const cjAPI = new CJDropshippingAPI();

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
const EmailService = require('./email-service');
const { v4: uuidv4 } = require('uuid');

const receiptGenerator = new ReceiptGenerator();
const emailService = new EmailService();

const app = express();

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

app.use(express.json());

// Add middleware for Replit proxy/iframe support
app.use((req, res, next) => {
  // Allow iframe embedding for Replit preview
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  
  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  next();
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

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payment system not configured. Please set up Stripe API key.' });
  }
  const { cart, country } = req.body;
  const currency = getCurrencyByCountry(country);
  
  // Konvertiere alle Preise parallel
  const line_items = await Promise.all(cart.map(async (item) => {
    if (item.id === 1) {
      return {
        price: 'price_XXXXXXXXXXXXXXXXXXXXXXXX',
        quantity: item.quantity,
      };
    }
    
    // Rechne Preis von EUR in Zielwährung um
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
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.REPL_URL || 'http://localhost:5000'}/success.html`,
      cancel_url: `${process.env.REPL_URL || 'http://localhost:5000'}/cart.html`,
    });
    // Stripe Checkout Link (z.B. für Debugging oder manuelle Weiterleitung)
    console.log('Stripe Checkout Link:', session.url);
    res.json({ id: session.id, url: session.url }); // session.url ist der Stripe-Zahlungslink
  } catch (err) {
    // Stripe gibt oft einen hilfreichen Fehlertext zurück!
    console.error('Stripe Checkout Error:', err.message);
    res.status(500).json({ error: err.message });
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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const msg = {
        to: session.customer_details.email,
        from: process.env.SENDER_EMAIL,
        reply_to: process.env.SUPPORT_EMAIL,
        subject: 'Zahlungsbestätigung - Maios',
        text: `Vielen Dank für Ihre Bestellung #${session.id}!\n\nIhre Zahlung wurde erfolgreich verarbeitet.`,        html: `<strong>Bestellbestätigung #${session.id}</strong>
          <p>Ihre Zahlung wurde erfolgreich verarbeitet und wir bereiten den Versand vor.</p>`
      };
      await sgMail.send(msg);
    }
    res.status(200).end();
  } catch (err) {
    console.error('Webhook Error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Legacy E-Mail-Endpunkt (kann später entfernt werden)
app.post('/api/send-confirmation', async (req, res) => {
  try {
    const { email, orderId } = req.body;
    
    const msg = {
      to: email,
      from: process.env.SENDER_EMAIL,
      reply_to: process.env.SUPPORT_EMAIL,
      subject: 'Bestellbestätigung - Maios',
      text: `Vielen Dank für Ihre Bestellung #${orderId}!\n\nWir bearbeiten Ihre Bestellung und senden sie innerhalb von 2 Werktagen zu.`,
      html: `<strong>Bestellbestätigung #${orderId}</strong>
        <p>Wir haben Ihre Zahlung erhalten und bearbeiten den Versand.</p>`
    };

    await sgMail.send(msg);
    res.json({ success: true });
  } catch (error) {
    console.error('E-Mail-Fehler:', error);
    res.status(500).json({ error: 'E-Mail-Versand fehlgeschlagen' });
  }
});

app.post('/api/create-payment-intent', async (req, res) => {
  const { cart, email, country, city, firstname, lastname } = req.body;
  const currency = getCurrencyByCountry(country);
  
  // Berechne Gesamtbetrag in EUR
  let amountInEUR = 0;
  for (const item of cart) {
    if (item.id === 1) {
      amountInEUR += 10.00 * item.quantity;
    } else {
      amountInEUR += (item.price || 0) * item.quantity;
    }
  }

  // Versandkosten in EUR
  const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'GB'];
  const shippingCostEUR = europeanCountries.includes(country) ? 0 : 4.99;
  amountInEUR += shippingCostEUR;
  
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
    res.status(500).json({ error: err.message });
  }
});

// Kontaktformular-Endpunkt
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Bitte Name, E-Mail und Nachricht angeben.' });
    }
    const msg = {
      to: 'marktplatzcontact@gmail.com',
      from: process.env.SENDER_EMAIL,
      reply_to: email,
      subject: 'Kontaktanfrage – Maios',
      text: `Von: ${name} <${email}>
Nachricht:\n${message}`,
      html: `<p><strong>Von:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, '<br>')}</p>`
    };
    await sgMail.send(msg);
    res.json({ success: true });
  } catch (error) {
    console.error('Kontakt-Fehler:', error);
    res.status(500).json({ error: 'Senden fehlgeschlagen' });
  }
});

// Retoure-Anfrage Endpunkt
app.post('/api/return-request', async (req, res) => {
  try {
    const { orderId, email, reason, items } = req.body || {};
    if (!orderId || !email) {
      return res.status(400).json({ error: 'Bitte Bestellnummer und E-Mail angeben.' });
    }
    const msg = {
      to: 'marktplatzcontact@gmail.com',
      from: process.env.SENDER_EMAIL,
      reply_to: email,
      subject: `Retoure-Anfrage #${orderId}`,
      text: `Retoure angefragt für Bestellung ${orderId}\nE-Mail: ${email}\nGrund: ${reason || '—'}\nArtikel: ${(items && items.join(', ')) || '—'}`,
      html: `<p><strong>Retoure angefragt</strong> für Bestellung <strong>#${orderId}</strong></p>
            <p><strong>E-Mail:</strong> ${email}</p>
            <p><strong>Grund:</strong> ${reason || '—'}</p>
            <p><strong>Artikel:</strong> ${(items && items.join(', ')) || '—'}</p>`
    };
    await sgMail.send(msg);
    res.json({ success: true });
  } catch (error) {
    console.error('Retoure-Fehler:', error);
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Get Product Categories
app.get('/api/cj/categories', async (req, res) => {
  try {
    const categories = await cjAPI.getProductCategory();
    res.json(categories);
  } catch (error) {
    console.error('CJ Categories Error:', error);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Create CJ Order
app.post('/api/cj/orders/create', async (req, res) => {
  try {
    const orderData = req.body;
    const order = await cjAPI.createOrderV2(orderData);
    res.json(order);
  } catch (error) {
    console.error('CJ Create Order Error:', error);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Get Account Balance
app.get('/api/cj/balance', async (req, res) => {
  try {
    const balance = await cjAPI.getBalance();
    res.json(balance);
  } catch (error) {
    console.error('CJ Balance Error:', error);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Test CJ API Connection
app.get('/api/cj/test', async (req, res) => {
  try {
    const result = await cjAPI.testConnection();
    res.json(result);
  } catch (error) {
    console.error('CJ API Test Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Available CJ API Methods
app.get('/api/cj/methods', (req, res) => {
  try {
    const methods = cjAPI.getAvailableMethods();
    res.json(methods);
  } catch (error) {
    console.error('CJ Methods Error:', error);
    res.status(500).json({ error: error.message });
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
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
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
    
    // Sende E-Mails
    try {
      // Kunde
      await emailService.sendReceiptToCustomer(orderData, receiptHTML, pdfResult.filePath);
      await dbOperations.updateEmailStatus(receiptId, 'customer');
      
      // Admin
      await emailService.sendAdminNotification(orderData, receiptHTML, pdfResult.filePath);
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
      error: 'Fehler bei der Kassenbon-Erstellung',
      details: error.message 
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Statistiken abrufen
app.get('/api/receipt/statistics', async (req, res) => {
  try {
    const stats = await dbOperations.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Statistik-Fehler:', error);
    res.status(500).json({ error: error.message });
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
    
    // Sende E-Mail
    await emailService.sendReceiptToCustomer(
      { ...order, customer_email: email || order.customer_email },
      receiptHTML,
      fullPdfPath
    );
    
    res.json({ success: true, message: 'Kassenbon erneut gesendet' });
  } catch (error) {
    console.error('Kassenbon erneut senden Fehler:', error);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access URL: ${process.env.REPL_URL || `http://localhost:${PORT}`}`);
});