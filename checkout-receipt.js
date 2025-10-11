// Checkout Receipt Integration
// Dieses Script integriert das Kassenbon-System in den Checkout-Prozess

class CheckoutReceipt {
  constructor() {
    this.orderData = null;
    this.receiptUrl = null;
    this.init();
  }

  init() {
    // Überwache den Checkout-Button
    this.attachCheckoutListener();
    
    // Füge Receipt-UI-Elemente hinzu
    this.addReceiptUI();
  }

  addReceiptUI() {
    // Füge einen Container für Kassenbon-Status hinzu
    const receiptStatusHTML = `
      <div id="receipt-status" style="display: none; margin: 20px 0; padding: 15px; border-radius: 8px; background: #f0f8ff; border: 1px solid #007bff;">
        <h3 style="margin: 0 0 10px 0; color: #007bff;">
          <i class="bi bi-receipt"></i> Kassenbon wird erstellt...
        </h3>
        <div class="receipt-progress">
          <div class="progress" style="height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden;">
            <div class="progress-bar" style="width: 0%; height: 100%; background: #007bff; transition: width 0.3s;"></div>
          </div>
          <p class="receipt-message" style="margin: 10px 0 0 0; color: #666;">Bestellung wird verarbeitet...</p>
        </div>
      </div>
    `;

    // Füge Success-Container hinzu
    const receiptSuccessHTML = `
      <div id="receipt-success" style="display: none; margin: 20px 0; padding: 20px; border-radius: 8px; background: #d4edda; border: 1px solid #28a745;">
        <h3 style="margin: 0 0 15px 0; color: #155724;">
          <i class="bi bi-check-circle-fill"></i> Bestellung erfolgreich!
        </h3>
        <p style="margin: 10px 0; color: #155724;">
          Ihre Bestellung wurde erfolgreich aufgenommen und der Kassenbon wurde erstellt.
        </p>
        <div class="receipt-details" style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Bestellnummer:</strong> <span id="order-id"></span></p>
          <p style="margin: 5px 0;"><strong>Kassenbon-Nr:</strong> <span id="receipt-number"></span></p>
          <p style="margin: 5px 0;"><strong>Gesamtbetrag:</strong> € <span id="total-amount"></span></p>
        </div>
        <div class="receipt-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button id="download-receipt" class="btn btn-primary" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            <i class="bi bi-download"></i> Kassenbon herunterladen
          </button>
          <button id="view-order" class="btn btn-secondary" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
            <i class="bi bi-eye"></i> Bestellung anzeigen
          </button>
          <button id="track-order" class="btn btn-info" style="padding: 10px 20px; background: #17a2b8; color: white; border: none; border-radius: 5px; cursor: pointer;">
            <i class="bi bi-truck"></i> Sendung verfolgen
          </button>
        </div>
        <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
          <i class="bi bi-envelope"></i> Der Kassenbon wurde auch an Ihre E-Mail-Adresse gesendet.
        </p>
      </div>
    `;

    // Füge die Elemente zur Seite hinzu
    const checkoutContainer = document.querySelector('.checkout-container') || 
                             document.querySelector('#checkout-form') ||
                             document.querySelector('main');
    
    if (checkoutContainer) {
      const receiptContainer = document.createElement('div');
      receiptContainer.id = 'receipt-container';
      receiptContainer.innerHTML = receiptStatusHTML + receiptSuccessHTML;
      checkoutContainer.appendChild(receiptContainer);
    }
  }

  attachCheckoutListener() {
    // Überwache verschiedene Checkout-Buttons
    const checkoutButtons = [
      '#place-order-btn',
      '#checkout-btn',
      '.checkout-button',
      '[type="submit"]'
    ];

    checkoutButtons.forEach(selector => {
      const button = document.querySelector(selector);
      if (button) {
        button.addEventListener('click', (e) => this.handleCheckout(e));
      }
    });

    // Überwache auch Stripe-Integration
    if (window.stripe) {
      this.attachStripeListener();
    }
  }

  attachStripeListener() {
    // Überwache Stripe Payment Success
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Prüfe ob es ein Stripe-Success ist
      if (args[0] && args[0].includes('/api/create-checkout-session')) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        
        if (data.id) {
          // Stripe-Session erstellt, bereite Kassenbon vor
          this.prepareReceiptData();
        }
      }
      
      return response;
    };
  }

  async handleCheckout(e) {
    // Verhindere Standard-Submit wenn wir den Kassenbon erstellen
    const form = e.target.closest('form');
    if (form) {
      e.preventDefault();
      
      // Sammle Formulardaten
      const formData = new FormData(form);
      const customerData = {
        name: formData.get('name') || formData.get('firstname') + ' ' + formData.get('lastname'),
        email: formData.get('email'),
        phone: formData.get('phone') || formData.get('tel'),
        billingAddress: {
          street: formData.get('address') || formData.get('street'),
          city: formData.get('city'),
          zip: formData.get('zip') || formData.get('postal'),
          country: formData.get('country') || 'DE'
        }
      };

      // Erstelle Kassenbon
      await this.createReceipt(customerData);
      
      // Fahre mit normalem Checkout fort
      setTimeout(() => {
        form.submit();
      }, 1000);
    }
  }

  prepareReceiptData() {
    // Sammle Warenkorb-Daten
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const shippingCost = this.calculateShipping();
    
    this.orderData = {
      cart: cart,
      shipping: {
        cost: shippingCost,
        address: this.getShippingAddress()
      },
      payment: {
        method: 'card',
        status: 'pending'
      }
    };
  }

  calculateShipping() {
    // Berechne Versandkosten basierend auf Land
    const country = document.querySelector('[name="country"]')?.value || 'DE';
    const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'GB'];
    
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Kostenloser Versand ab 50€ in Europa
    if (europeanCountries.includes(country) && subtotal >= 50) {
      return 0;
    }
    
    // Sonst: Europa 0€, Rest 4.99€
    return europeanCountries.includes(country) ? 0 : 4.99;
  }

  getShippingAddress() {
    return {
      street: document.querySelector('[name="address"]')?.value || 
              document.querySelector('[name="street"]')?.value || '',
      city: document.querySelector('[name="city"]')?.value || '',
      zip: document.querySelector('[name="zip"]')?.value || 
            document.querySelector('[name="postal"]')?.value || '',
      country: document.querySelector('[name="country"]')?.value || 'DE'
    };
  }

  async createReceipt(customerData) {
    // Zeige Status
    const statusDiv = document.getElementById('receipt-status');
    const progressBar = statusDiv?.querySelector('.progress-bar');
    const message = statusDiv?.querySelector('.receipt-message');
    
    if (statusDiv) {
      statusDiv.style.display = 'block';
      this.updateProgress(10, 'Bestellung wird vorbereitet...');
    }

    try {
      // Bereite Daten vor
      if (!this.orderData) {
        this.prepareReceiptData();
      }

      const receiptData = {
        ...this.orderData,
        customer: customerData || this.getCustomerData()
      };

      this.updateProgress(30, 'Kassenbon wird generiert...');

      // Sende an Backend
      const response = await fetch('/api/receipt/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(receiptData)
      });

      this.updateProgress(60, 'E-Mails werden versendet...');

      if (!response.ok) {
        throw new Error('Fehler bei der Kassenbon-Erstellung');
      }

      const result = await response.json();
      
      this.updateProgress(90, 'Fast fertig...');

      // Speichere Ergebnis
      this.orderData = result;
      this.receiptUrl = result.receiptUrl;
      
      // Zeige Erfolg
      this.showSuccess(result);
      
      this.updateProgress(100, 'Abgeschlossen!');
      
      // Verstecke Status nach 2 Sekunden
      setTimeout(() => {
        if (statusDiv) statusDiv.style.display = 'none';
      }, 2000);

      return result;

    } catch (error) {
      console.error('Kassenbon-Fehler:', error);
      this.showError(error.message);
      return null;
    }
  }

  getCustomerData() {
    // Fallback: Sammle Kundendaten aus dem Formular
    return {
      name: document.querySelector('[name="name"]')?.value || 
            (document.querySelector('[name="firstname"]')?.value + ' ' + 
             document.querySelector('[name="lastname"]')?.value) || '',
      email: document.querySelector('[name="email"]')?.value || '',
      phone: document.querySelector('[name="phone"]')?.value || 
             document.querySelector('[name="tel"]')?.value || ''
    };
  }

  updateProgress(percent, message) {
    const progressBar = document.querySelector('#receipt-status .progress-bar');
    const messageEl = document.querySelector('#receipt-status .receipt-message');
    
    if (progressBar) {
      progressBar.style.width = percent + '%';
    }
    
    if (messageEl && message) {
      messageEl.textContent = message;
    }
  }

  showSuccess(data) {
    const successDiv = document.getElementById('receipt-success');
    
    if (successDiv) {
      // Fülle Details
      const orderId = successDiv.querySelector('#order-id');
      const receiptNumber = successDiv.querySelector('#receipt-number');
      const totalAmount = successDiv.querySelector('#total-amount');
      
      if (orderId) orderId.textContent = data.orderId;
      if (receiptNumber) receiptNumber.textContent = data.receiptNumber;
      if (totalAmount) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalAmount.textContent = total.toFixed(2);
      }
      
      // Zeige Success
      successDiv.style.display = 'block';
      
      // Füge Event-Listener hinzu
      this.attachSuccessListeners(data);
      
      // Scrolle zu Success
      successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  attachSuccessListeners(data) {
    // Download-Button
    const downloadBtn = document.getElementById('download-receipt');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        window.open(data.receiptUrl, '_blank');
      };
    }
    
    // View Order Button
    const viewBtn = document.getElementById('view-order');
    if (viewBtn) {
      viewBtn.onclick = () => {
        window.location.href = `/order/${data.orderId}`;
      };
    }
    
    // Track Order Button
    const trackBtn = document.getElementById('track-order');
    if (trackBtn) {
      trackBtn.onclick = () => {
        window.location.href = data.trackingUrl;
      };
    }
  }

  showError(message) {
    const statusDiv = document.getElementById('receipt-status');
    
    if (statusDiv) {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.borderColor = '#dc3545';
      statusDiv.querySelector('h3').style.color = '#dc3545';
      statusDiv.querySelector('h3').innerHTML = '<i class="bi bi-exclamation-triangle"></i> Fehler beim Erstellen des Kassenbons';
      statusDiv.querySelector('.receipt-message').textContent = message;
      statusDiv.querySelector('.progress-bar').style.background = '#dc3545';
    }
  }
}

// Initialisiere beim Laden
document.addEventListener('DOMContentLoaded', () => {
  // Nur auf Checkout-Seiten aktivieren
  if (window.location.pathname.includes('checkout') || 
      window.location.pathname.includes('cart') ||
      document.querySelector('#checkout-form')) {
    new CheckoutReceipt();
  }
});
