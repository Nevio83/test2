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
    // Echte Firmendaten (Impressum). Maios ist Kleinunternehmer gemaess § 19 UStG
    // -> KEINE Umsatzsteuer ausweisen, KEINE USt-IdNr. Die Steuernummer ist
    // optional (Pflicht erst bei Rechnungen > 250 €) und kommt aus der ENV, damit
    // sie nicht im Repo steht.
    // Werte aus ENV (Render-Dashboard) mit den echten Impressum-Daten als Default.
    this.companyInfo = {
      name: process.env.COMPANY_NAME || 'Maios',
      owner: process.env.COMPANY_OWNER || 'Noah Michelhans',
      address: process.env.COMPANY_ADDRESS || 'Oberer Burggarten 12',
      city: process.env.COMPANY_CITY || '69221 Dossenheim',
      country: process.env.COMPANY_COUNTRY || 'Deutschland',
      email: process.env.COMPANY_EMAIL || 'maioscorporation@gmail.com',
      phone: process.env.COMPANY_PHONE || '',
      website: process.env.COMPANY_WEBSITE || 'maiosshop.com',
      // Steuernummer (optional, Pflicht erst bei Rechnungen > 250 €). Kleinunternehmer
      // hat KEINE USt-IdNr. -> nur Steuernummer. COMPANY_TAX_ID als Alt-Name akzeptiert.
      taxNumber: process.env.COMPANY_TAX_NUMBER || process.env.COMPANY_TAX_ID || '',
      smallBusiness: true, // Kleinunternehmer § 19 UStG
      logo: null // Logo-Pfad kann später hinzugefügt werden
    };
    // Pflicht-Hinweis fuer Kleinunternehmer auf jedem Beleg.
    this.smallBusinessNote = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';
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

    // Firmenname und Adresse (echte Maios-Daten)
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(this.companyInfo.name, 50, startY);

    doc.fontSize(10)
       .font('Helvetica');
    let y = startY + 28;
    const line = (txt) => { doc.text(txt, 50, y); y += 14; };
    if (this.companyInfo.owner) line(`Inhaber: ${this.companyInfo.owner}`);
    line(this.companyInfo.address);
    line(`${this.companyInfo.city}, ${this.companyInfo.country}`);
    if (this.companyInfo.phone) line(`Tel: ${this.companyInfo.phone}`);
    line(`E-Mail: ${this.companyInfo.email}`);
    if (this.companyInfo.taxNumber) line(`Steuernummer: ${this.companyInfo.taxNumber}`);

    // Beleg-Titel und Nummer (Rechnungsnummer = fortlaufende Belegnummer)
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('RECHNUNG', 350, startY, { align: 'right' });

    doc.fontSize(12)
       .font('Helvetica')
       .text(`Rechnungs-Nr: ${orderData.receipt_number}`, 350, startY + 35, { align: 'right' })
       .text(`Datum: ${new Date(orderData.created_at).toLocaleDateString('de-DE')}`, 350, startY + 55, { align: 'right' })
       .text(`Zeit: ${new Date(orderData.created_at).toLocaleTimeString('de-DE')}`, 350, startY + 75, { align: 'right' });

    // Trennlinie (unter den hoeheren der beiden Bloecke)
    const lineY = Math.max(y + 6, startY + 120);
    doc.moveTo(50, lineY)
       .lineTo(545, lineY)
       .stroke();

    return lineY + 20;
  }

  // Adresse robust parsen (Stripe: line1/postal_code | manuell: street/zip).
  parseAddress(raw) {
    if (!raw) return null;
    let a = raw;
    if (typeof raw === 'string') {
      try { a = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!a || typeof a !== 'object') return null;
    const street = a.street || a.line1 || '';
    const line2 = a.line2 || '';
    const zip = a.zip || a.postal_code || a.postalCode || '';
    const city = a.city || '';
    const country = a.country || '';
    if (!street && !zip && !city) return null;
    return { street, line2, zip, city, country };
  }

  addCustomerInfo(doc, orderData) {
    const startY = 210;

    // Leistungsempfaenger = Rechnungsadresse (§ 14 UStG). Faellt auf Lieferadresse
    // zurueck, falls keine separate Rechnungsadresse vorliegt.
    const billing = this.parseAddress(orderData.billing_address) ||
                    this.parseAddress(orderData.shipping_address);
    const shipping = this.parseAddress(orderData.shipping_address);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Rechnungsempfänger:', 50, startY);

    doc.fontSize(11)
       .font('Helvetica');
    let y = startY + 22;
    const put = (x, txt) => { if (txt) { doc.text(txt, x, y); y += 16; } };
    doc.text(orderData.customer_name || '', 50, y); y += 16;
    if (billing) {
      put(50, billing.street);
      put(50, billing.line2);
      put(50, `${billing.zip} ${billing.city}`.trim());
      put(50, billing.country);
    }
    put(50, `E-Mail: ${orderData.customer_email}`);
    if (orderData.customer_phone) put(50, `Telefon: ${orderData.customer_phone}`);

    // Lieferadresse nur zeigen, wenn sie von der Rechnungsadresse abweicht.
    if (shipping) {
      const differs = !billing ||
        shipping.street !== billing.street || shipping.zip !== billing.zip ||
        shipping.city !== billing.city || shipping.country !== billing.country;
      if (differs) {
        doc.fontSize(12).font('Helvetica-Bold').text('Lieferadresse:', 300, startY);
        doc.fontSize(11).font('Helvetica');
        let ys = startY + 22;
        const puts = (txt) => { if (txt) { doc.text(txt, 300, ys); ys += 16; } };
        puts(orderData.customer_name);
        puts(shipping.street);
        puts(shipping.line2);
        puts(`${shipping.zip} ${shipping.city}`.trim());
        puts(shipping.country);
      }
    }

    // Trennlinie unter dem hoeheren Block
    const lineY = Math.max(y + 6, startY + 110);
    doc.moveTo(50, lineY).lineTo(545, lineY).stroke();
    return lineY + 20;
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

    // Kleinunternehmer § 19 UStG -> KEINE Umsatzsteuer ausweisen.

    // Trennlinie
    doc.moveTo(350, currentY)
       .lineTo(545, currentY)
       .stroke();
    currentY += 10;

    // Gesamtsumme (= Endbetrag, ohne gesonderten USt-Ausweis)
    doc.fontSize(14)
       .font('Helvetica-Bold');
    doc.text('Gesamtbetrag:', 350, currentY);
    doc.text(`€ ${orderData.total_amount.toFixed(2)}`, 490, currentY, { align: 'right' });
    currentY += 26;

    // Pflicht-Hinweis Kleinunternehmer
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#444444')
       .text(this.smallBusinessNote, 300, currentY, { width: 245, align: 'right' })
       .fillColor('#000000');
    currentY += 24;

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
    const trackingUrl = `https://${this.companyInfo.website}/tracking/${orderData.order_id}`;
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
       .text('Diese Rechnung dient als Kaufbeleg und ist 10 Jahre aufzubewahren. ' + this.smallBusinessNote,
             50, startY + 108, { align: 'center', width: 495 })
       .text(`Erstellt am ${new Date().toLocaleString('de-DE')} | ${this.companyInfo.name} | ${this.companyInfo.website}`,
             50, startY + 128, { align: 'center', width: 495 });
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

  // Adresse als HTML-Zeilen (Kleinunternehmer: keine USt).
  addressToHTML(addr, name) {
    const a = this.parseAddress(addr);
    if (!a) return name ? `<p style="margin:2px 0;">${name}</p>` : '';
    const parts = [name, a.street, a.line2, `${a.zip} ${a.city}`.trim(), a.country]
      .filter(Boolean)
      .map(p => `<p style="margin:2px 0;">${p}</p>`);
    return parts.join('');
  }

  // HTML-Version für E-Mail
  generateHTMLReceipt(orderData) {
    const billingHTML = this.addressToHTML(
      orderData.billing_address || orderData.shipping_address, orderData.customer_name
    );
    const stNr = this.companyInfo.taxNumber
      ? `<p style="color: #666; margin: 5px 0;">Steuernummer: ${this.companyInfo.taxNumber}</p>` : '';

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
      <p style="color: #666; margin: 5px 0;">${this.companyInfo.owner ? 'Inhaber: ' + this.companyInfo.owner + ' &middot; ' : ''}${this.companyInfo.address}, ${this.companyInfo.city}</p>
      <p style="color: #666; margin: 5px 0;">${this.companyInfo.phone ? 'Tel: ' + this.companyInfo.phone + ' | ' : ''}E-Mail: ${this.companyInfo.email}</p>
      ${stNr}
    </div>

    <!-- Rechnung Info -->
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">RECHNUNG</h2>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <p><strong>Rechnungs-Nr:</strong> ${orderData.receipt_number}</p>
          <p><strong>Bestell-Nr:</strong> ${orderData.order_id}</p>
        </div>
        <div style="text-align: right;">
          <p><strong>Datum:</strong> ${new Date(orderData.created_at).toLocaleDateString('de-DE')}</p>
          <p><strong>Zeit:</strong> ${new Date(orderData.created_at).toLocaleTimeString('de-DE')}</p>
        </div>
      </div>
    </div>

    <!-- Rechnungsempfaenger -->
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #333;">Rechnungsempfänger</h3>
      ${billingHTML}
      <p style="margin:2px 0;"><strong>E-Mail:</strong> ${orderData.customer_email}</p>
      ${orderData.customer_phone ? `<p style="margin:2px 0;"><strong>Telefon:</strong> ${orderData.customer_phone}</p>` : ''}
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
        <tr style="border-top: 2px solid #333;">
          <td style="text-align: right; padding: 10px; font-size: 18px;"><strong>Gesamtbetrag:</strong></td>
          <td style="text-align: right; padding: 10px; font-size: 18px; color: #007bff;"><strong>€ ${orderData.total_amount.toFixed(2)}</strong></td>
        </tr>
        <tr>
          <td colspan="2" style="text-align: right; padding: 5px; color: #666; font-size: 12px;">${this.smallBusinessNote}</td>
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
      <a href="https://${this.companyInfo.website}/tracking/${orderData.order_id}" style="color: white; text-decoration: underline;">
        ${this.companyInfo.website}/tracking/${orderData.order_id}
      </a>
    </div>

    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
      <p>Diese Rechnung dient als Kaufbeleg und ist 10 Jahre aufzubewahren. ${this.smallBusinessNote}</p>
      <p>${this.companyInfo.name}${this.companyInfo.owner ? ' &middot; Inhaber: ' + this.companyInfo.owner : ''} &middot; ${this.companyInfo.website}</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

module.exports = ReceiptGenerator;
