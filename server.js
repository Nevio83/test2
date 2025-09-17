require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const sgMail = require('@sendgrid/mail');
const CJDropshippingAPI = require('./cj-dropshipping-api');
const compression = require('compression');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize CJ Dropshipping API
const cjAPI = new CJDropshippingAPI();

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

// Set caching headers for static assets
app.use(express.static(path.join(__dirname), {
  maxAge: '1y', // Cache static files for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Different cache strategies for different file types
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes for HTML
    } else if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year for CSS/JS
    } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year for images
    }
  }
}));

app.post('/api/create-checkout-session', async (req, res) => {
  const { cart } = req.body;
  const line_items = cart.map(item => {
    if (item.id === 1) {
      return {
        price: 'price_XXXXXXXXXXXXXXXXXXXXXXXX',
        quantity: item.quantity,
      };
    }
    return {
      price_data: {
        currency: 'eur',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    };
  });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: 'http://localhost:3000/success.html',
      cancel_url: 'http://localhost:3000/cart.html',
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
        subject: 'Zahlungsbestätigung - Marktplatz',
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
      subject: 'Bestellbestätigung - Marktplatz',
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
  let amount = 0;
  for (const item of cart) {
    if (item.id === 1) {
      amount += 1000 * item.quantity; // 10.00 EUR * 100
    } else {
      amount += Math.round((item.price || 0) * 100) * item.quantity;
    }
  }

  // Versandkosten serverseitig basierend auf dem Land berechnen
  const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'GB'];
  const shippingCost = europeanCountries.includes(country) ? 0 : 499;
  amount += shippingCost;

  try {
    if (amount < 50) {
      return res.status(400).json({ error: 'Gesamtbetrag zu niedrig für Stripe.' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      receipt_email: email,
      description: 'Marktplatz Bestellung',
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
      subject: 'Kontaktanfrage – Marktplatz',
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



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});