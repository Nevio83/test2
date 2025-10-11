const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Erstelle Receipts-Ordner falls nicht vorhanden
const receiptsDir = path.join(__dirname, 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir);
}

class ReceiptGenerator {
  constructor() {
    this.companyInfo = {
      name: 'Smart Home Shop',
      address: 'Musterstraße 123',
      city: '12345 Berlin',
      country: 'Deutschland',
      email: 'info@smarthomeshop.de',
      phone: '+49 30 123456789',
      website: 'www.smarthomeshop.de',
      taxId: 'DE123456789',
      logo: null // Logo-Pfad kann später hinzugefügt werden
    };
  }

  generateReceipt(orderData) {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `receipt_${orderData.receipt_number}.pdf`;
        const filePath = path.join(receiptsDir, fileName);
        
        // Erstelle PDF-Dokument
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Kassenbon ${orderData.receipt_number}`,
            Author: this.companyInfo.name,
            Subject: `Bestellung ${orderData.order_id}`,
            Keywords: 'kassenbon, rechnung, bestellung'
          }
        });

        // Stream zu Datei
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Kopfbereich mit Firmeninformationen
        this.addHeader(doc, orderData);

        // Kundeninformationen
        this.addCustomerInfo(doc, orderData);

        // Bestellpositionen
        this.addOrderItems(doc, orderData);

        // Zusammenfassung und Summen
        this.addSummary(doc, orderData);

        // Fußbereich
        this.addFooter(doc, orderData);

        // PDF finalisieren
        doc.end();

        stream.on('finish', () => {
          resolve({
            fileName,
            filePath,
            relativePath: `/receipts/${fileName}`
          });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  addHeader(doc, orderData) {
    const startY = 50;
    
    // Firmenlogo (falls vorhanden)
    if (this.companyInfo.logo && fs.existsSync(this.companyInfo.logo)) {
      doc.image(this.companyInfo.logo, 50, startY, { width: 150 });
    }

    // Firmenname und Adresse
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(this.companyInfo.name, 50, startY);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(this.companyInfo.address, 50, startY + 30)
       .text(`${this.companyInfo.city}, ${this.companyInfo.country}`, 50, startY + 45)
       .text(`Tel: ${this.companyInfo.phone}`, 50, startY + 60)
       .text(`E-Mail: ${this.companyInfo.email}`, 50, startY + 75)
       .text(`USt-IdNr.: ${this.companyInfo.taxId}`, 50, startY + 90);

    // Kassenbon-Titel und Nummer
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('KASSENBON', 350, startY, { align: 'right' });
    
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Nr: ${orderData.receipt_number}`, 350, startY + 35, { align: 'right' })
       .text(`Datum: ${new Date(orderData.created_at).toLocaleDateString('de-DE')}`, 350, startY + 55, { align: 'right' })
       .text(`Zeit: ${new Date(orderData.created_at).toLocaleTimeString('de-DE')}`, 350, startY + 75, { align: 'right' });

    // Trennlinie
    doc.moveTo(50, startY + 120)
       .lineTo(545, startY + 120)
       .stroke();
    
    return startY + 140;
  }

  addCustomerInfo(doc, orderData) {
    const startY = 210;
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Kundeninformationen:', 50, startY);
    
    doc.fontSize(11)
       .font('Helvetica');

    // Kunde
    doc.text(`Name: ${orderData.customer_name}`, 50, startY + 25);
    doc.text(`E-Mail: ${orderData.customer_email}`, 50, startY + 45);
    
    if (orderData.customer_phone) {
      doc.text(`Telefon: ${orderData.customer_phone}`, 50, startY + 65);
    }

    // Lieferadresse
    if (orderData.shipping_address) {
      const address = JSON.parse(orderData.shipping_address);
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Lieferadresse:', 300, startY + 25);
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(address.street || '', 300, startY + 45)
         .text(`${address.zip || ''} ${address.city || ''}`, 300, startY + 65)
         .text(address.country || '', 300, startY + 85);
    }

    // Trennlinie
    doc.moveTo(50, startY + 110)
       .lineTo(545, startY + 110)
       .stroke();
    
    return startY + 130;
  }

  addOrderItems(doc, orderData) {
    const startY = 350;
    let currentY = startY;
    
    // Tabellenkopf
    doc.fontSize(12)
       .font('Helvetica-Bold');
    
    doc.text('Pos', 50, currentY);
    doc.text('Artikel', 90, currentY);
    doc.text('Farbe', 280, currentY);
    doc.text('Menge', 350, currentY);
    doc.text('Einzelpreis', 410, currentY);
    doc.text('Gesamt', 490, currentY);

    // Linie unter Kopf
    currentY += 20;
    doc.moveTo(50, currentY)
       .lineTo(545, currentY)
       .stroke();
    
    currentY += 10;

    // Artikel
    doc.fontSize(10)
       .font('Helvetica');
    
    orderData.items.forEach((item, index) => {
      // Prüfe ob neue Seite benötigt wird
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(`${index + 1}.`, 50, currentY);
      
      // Artikelname (kann mehrzeilig sein)
      const nameLines = doc.heightOfString(item.product_name, { width: 180 });
      doc.text(item.product_name, 90, currentY, { width: 180 });
      
      doc.text(item.color || '-', 280, currentY);
      doc.text(item.quantity.toString(), 350, currentY);
      doc.text(`€ ${item.unit_price.toFixed(2)}`, 410, currentY);
      doc.text(`€ ${item.total_price.toFixed(2)}`, 490, currentY);
      
      if (item.product_sku) {
        doc.fontSize(8)
           .fillColor('#666666')
           .text(`SKU: ${item.product_sku}`, 90, currentY + 12);
        doc.fillColor('#000000');
      }
      
      currentY += Math.max(nameLines, 15) + 10;
    });

    // Trennlinie
    currentY += 10;
    doc.moveTo(50, currentY)
       .lineTo(545, currentY)
       .stroke();
    
    return currentY + 20;
  }

  addSummary(doc, orderData) {
    const startY = 550;
    let currentY = startY;

    // Prüfe ob neue Seite benötigt wird
    if (currentY > 650) {
      doc.addPage();
      currentY = 50;
    }

    doc.fontSize(11)
       .font('Helvetica');

    // Zwischensumme
    doc.text('Zwischensumme:', 350, currentY);
    doc.text(`€ ${orderData.subtotal.toFixed(2)}`, 490, currentY, { align: 'right' });
    currentY += 20;

    // Versandkosten
    if (orderData.shipping_cost > 0) {
      doc.text('Versandkosten:', 350, currentY);
      doc.text(`€ ${orderData.shipping_cost.toFixed(2)}`, 490, currentY, { align: 'right' });
      currentY += 20;
    }

    // MwSt (19%)
    const taxRate = 0.19;
    const taxAmount = orderData.tax_amount || (orderData.total_amount * taxRate / (1 + taxRate));
    doc.text(`MwSt. (19%):`, 350, currentY);
    doc.text(`€ ${taxAmount.toFixed(2)}`, 490, currentY, { align: 'right' });
    currentY += 20;

    // Trennlinie
    doc.moveTo(350, currentY)
       .lineTo(545, currentY)
       .stroke();
    currentY += 10;

    // Gesamtsumme
    doc.fontSize(14)
       .font('Helvetica-Bold');
    doc.text('Gesamtsumme:', 350, currentY);
    doc.text(`€ ${orderData.total_amount.toFixed(2)}`, 490, currentY, { align: 'right' });
    currentY += 30;

    // Zahlungsmethode
    doc.fontSize(11)
       .font('Helvetica');
    doc.text(`Zahlungsmethode: ${this.getPaymentMethodText(orderData.payment_method)}`, 50, currentY);
    doc.text(`Zahlungsstatus: ${this.getPaymentStatusText(orderData.payment_status)}`, 50, currentY + 20);

    return currentY + 50;
  }

  addFooter(doc, orderData) {
    const pageHeight = doc.page.height;
    const startY = pageHeight - 150;

    // Trennlinie
    doc.moveTo(50, startY)
       .lineTo(545, startY)
       .stroke();

    // QR-Code Platzhalter für Bestellverfolgung
    doc.fontSize(10)
       .font('Helvetica')
       .text('Bestellnummer:', 50, startY + 20)
       .font('Helvetica-Bold')
       .text(orderData.order_id, 50, startY + 35);

    // Tracking-URL
    const trackingUrl = `${this.companyInfo.website}/tracking/${orderData.order_id}`;
    doc.fontSize(9)
       .font('Helvetica')
       .text('Verfolgen Sie Ihre Bestellung:', 50, startY + 55)
       .fillColor('#0066cc')
       .text(trackingUrl, 50, startY + 70, {
         link: trackingUrl,
         underline: true
       })
       .fillColor('#000000');

    // Rechtliche Hinweise
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Vielen Dank für Ihren Einkauf!', 50, startY + 95, { align: 'center', width: 495 })
       .text('Dieser Kassenbon dient als Kaufbeleg. Bitte bewahren Sie ihn für eventuelle Rückfragen auf.', 
             50, startY + 110, { align: 'center', width: 495 })
       .text(`Erstellt am ${new Date().toLocaleString('de-DE')} | ${this.companyInfo.name} | ${this.companyInfo.website}`,
             50, startY + 125, { align: 'center', width: 495 });
  }

  getPaymentMethodText(method) {
    const methods = {
      'card': 'Kreditkarte',
      'paypal': 'PayPal',
      'sepa': 'SEPA-Lastschrift',
      'sofort': 'Sofortüberweisung',
      'invoice': 'Rechnung',
      'cash': 'Barzahlung'
    };
    return methods[method] || method || 'Unbekannt';
  }

  getPaymentStatusText(status) {
    const statuses = {
      'pending': 'Ausstehend',
      'processing': 'In Bearbeitung',
      'completed': 'Bezahlt',
      'failed': 'Fehlgeschlagen',
      'refunded': 'Erstattet',
      'cancelled': 'Storniert'
    };
    return statuses[status] || status || 'Unbekannt';
  }

  // HTML-Version für E-Mail
  generateHTMLReceipt(orderData) {
    const taxRate = 0.19;
    const taxAmount = orderData.tax_amount || (orderData.total_amount * taxRate / (1 + taxRate));

    const itemsHTML = orderData.items.map((item, index) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${index + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.product_name}
          ${item.product_sku ? `<br><small style="color: #666;">SKU: ${item.product_sku}</small>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.color || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€ ${item.unit_price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€ ${item.total_price.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kassenbon ${orderData.receipt_number}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: #f9f9f9; padding: 30px; border-radius: 10px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #333; margin: 0;">${this.companyInfo.name}</h1>
      <p style="color: #666; margin: 5px 0;">${this.companyInfo.address}, ${this.companyInfo.city}</p>
      <p style="color: #666; margin: 5px 0;">Tel: ${this.companyInfo.phone} | E-Mail: ${this.companyInfo.email}</p>
    </div>

    <!-- Kassenbon Info -->
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">KASSENBON</h2>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <p><strong>Kassenbon-Nr:</strong> ${orderData.receipt_number}</p>
          <p><strong>Bestell-Nr:</strong> ${orderData.order_id}</p>
        </div>
        <div style="text-align: right;">
          <p><strong>Datum:</strong> ${new Date(orderData.created_at).toLocaleDateString('de-DE')}</p>
          <p><strong>Zeit:</strong> ${new Date(orderData.created_at).toLocaleTimeString('de-DE')}</p>
        </div>
      </div>
    </div>

    <!-- Kundeninfo -->
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #333;">Kundeninformationen</h3>
      <p><strong>Name:</strong> ${orderData.customer_name}</p>
      <p><strong>E-Mail:</strong> ${orderData.customer_email}</p>
      ${orderData.customer_phone ? `<p><strong>Telefon:</strong> ${orderData.customer_phone}</p>` : ''}
    </div>

    <!-- Artikel -->
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #333;">Bestellte Artikel</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 10px; text-align: left;">Pos</th>
            <th style="padding: 10px; text-align: left;">Artikel</th>
            <th style="padding: 10px; text-align: left;">Farbe</th>
            <th style="padding: 10px; text-align: center;">Menge</th>
            <th style="padding: 10px; text-align: right;">Einzelpreis</th>
            <th style="padding: 10px; text-align: right;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <!-- Zusammenfassung -->
    <div style="background: white; padding: 20px; border-radius: 8px;">
      <table style="width: 100%; margin-top: 20px;">
        <tr>
          <td style="text-align: right; padding: 5px;"><strong>Zwischensumme:</strong></td>
          <td style="text-align: right; padding: 5px; width: 150px;">€ ${orderData.subtotal.toFixed(2)}</td>
        </tr>
        ${orderData.shipping_cost > 0 ? `
        <tr>
          <td style="text-align: right; padding: 5px;"><strong>Versandkosten:</strong></td>
          <td style="text-align: right; padding: 5px;">€ ${orderData.shipping_cost.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="text-align: right; padding: 5px;"><strong>MwSt. (19%):</strong></td>
          <td style="text-align: right; padding: 5px;">€ ${taxAmount.toFixed(2)}</td>
        </tr>
        <tr style="border-top: 2px solid #333;">
          <td style="text-align: right; padding: 10px; font-size: 18px;"><strong>Gesamtsumme:</strong></td>
          <td style="text-align: right; padding: 10px; font-size: 18px; color: #007bff;"><strong>€ ${orderData.total_amount.toFixed(2)}</strong></td>
        </tr>
      </table>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
        <p><strong>Zahlungsmethode:</strong> ${this.getPaymentMethodText(orderData.payment_method)}</p>
        <p><strong>Zahlungsstatus:</strong> ${this.getPaymentStatusText(orderData.payment_status)}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; padding: 20px; background: #007bff; color: white; border-radius: 8px;">
      <h3>Vielen Dank für Ihren Einkauf!</h3>
      <p>Verfolgen Sie Ihre Bestellung online:</p>
      <a href="${this.companyInfo.website}/tracking/${orderData.order_id}" style="color: white; text-decoration: underline;">
        ${this.companyInfo.website}/tracking/${orderData.order_id}
      </a>
    </div>

    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
      <p>Dieser Kassenbon dient als Kaufbeleg. Bitte bewahren Sie ihn für eventuelle Rückfragen auf.</p>
      <p>${this.companyInfo.name} | ${this.companyInfo.taxId} | ${this.companyInfo.website}</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

module.exports = ReceiptGenerator;
