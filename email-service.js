const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    // Verwende SendGrid wenn verfügbar, sonst Nodemailer mit SMTP
    this.useSendGrid = process.env.SENDGRID_API_KEY && 
                       process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here';
    
    if (this.useSendGrid) {
      this.sgMail = require('@sendgrid/mail');
      this.sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('📧 E-Mail-Service: SendGrid aktiviert');
    } else {
      // Fallback zu Nodemailer mit Gmail oder anderem SMTP
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || process.env.ADMIN_EMAIL,
          pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD
        }
      });
      console.log('📧 E-Mail-Service: SMTP/Nodemailer aktiviert');
    }

    // Admin-E-Mail für Benachrichtigungen
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@smarthomeshop.de';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@smarthomeshop.de';
    this.fromName = process.env.FROM_NAME || 'Smart Home Shop';
  }

  // Kassenbon an Kunden senden
  async sendReceiptToCustomer(orderData, receiptHTML, pdfPath) {
    const subject = `Ihr Kassenbon - Bestellung ${orderData.receipt_number}`;
    
    const textContent = `
Vielen Dank für Ihre Bestellung!

Ihre Bestellnummer: ${orderData.order_id}
Kassenbon-Nummer: ${orderData.receipt_number}
Gesamtbetrag: € ${orderData.total_amount.toFixed(2)}

Sie finden Ihren Kassenbon als PDF im Anhang dieser E-Mail.

Verfolgen Sie Ihre Bestellung online:
${process.env.SITE_URL || 'http://localhost:5000'}/tracking/${orderData.order_id}

Mit freundlichen Grüßen
Ihr ${this.fromName} Team
    `;

    // PDF-Anhang vorbereiten
    const attachments = [];
    if (pdfPath && fs.existsSync(pdfPath)) {
      attachments.push({
        filename: `Kassenbon_${orderData.receipt_number}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf'
      });
    }

    try {
      if (this.useSendGrid) {
        // SendGrid
        const msg = {
          to: orderData.customer_email,
          from: {
            email: this.fromEmail,
            name: this.fromName
          },
          subject: subject,
          text: textContent,
          html: receiptHTML,
          attachments: attachments.map(att => ({
            content: fs.readFileSync(att.path).toString('base64'),
            filename: att.filename,
            type: att.contentType,
            disposition: 'attachment'
          }))
        };

        await this.sgMail.send(msg);
        console.log(`✅ Kassenbon an ${orderData.customer_email} gesendet (SendGrid)`);
        return { success: true, method: 'sendgrid' };

      } else {
        // Nodemailer
        const mailOptions = {
          from: `"${this.fromName}" <${this.fromEmail}>`,
          to: orderData.customer_email,
          subject: subject,
          text: textContent,
          html: receiptHTML,
          attachments: attachments
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Kassenbon an ${orderData.customer_email} gesendet (SMTP)`);
        return { success: true, method: 'smtp', messageId: info.messageId };
      }
    } catch (error) {
      console.error('❌ Fehler beim E-Mail-Versand an Kunden:', error);
      throw error;
    }
  }

  // Benachrichtigung an Admin senden
  async sendAdminNotification(orderData, receiptHTML, pdfPath) {
    const subject = `🛍️ Neue Bestellung #${orderData.receipt_number} - € ${orderData.total_amount.toFixed(2)}`;
    
    const adminHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Neue Bestellung</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0f8ff; padding: 30px; border-radius: 10px; border: 2px solid #007bff;">
    <h1 style="color: #007bff; margin: 0;">🎉 Neue Bestellung eingegangen!</h1>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Bestellübersicht</h2>
      
      <table style="width: 100%; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0;"><strong>Bestellnummer:</strong></td>
          <td>${orderData.order_id}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Kassenbon-Nr:</strong></td>
          <td>${orderData.receipt_number}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Datum/Zeit:</strong></td>
          <td>${new Date(orderData.created_at).toLocaleString('de-DE')}</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px 0;"><strong>Gesamtbetrag:</strong></td>
          <td style="font-size: 20px; color: #28a745;"><strong>€ ${orderData.total_amount.toFixed(2)}</strong></td>
        </tr>
      </table>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #333;">Kundeninformationen</h3>
      <p><strong>Name:</strong> ${orderData.customer_name}</p>
      <p><strong>E-Mail:</strong> <a href="mailto:${orderData.customer_email}">${orderData.customer_email}</a></p>
      ${orderData.customer_phone ? `<p><strong>Telefon:</strong> <a href="tel:${orderData.customer_phone}">${orderData.customer_phone}</a></p>` : ''}
      ${orderData.shipping_address ? `
        <p><strong>Lieferadresse:</strong><br>
        ${(() => {
          try {
            const addr = JSON.parse(orderData.shipping_address);
            return `${addr.street || ''}<br>${addr.zip || ''} ${addr.city || ''}<br>${addr.country || ''}`;
          } catch {
            return orderData.shipping_address;
          }
        })()}
        </p>
      ` : ''}
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #333;">Bestellte Artikel (${orderData.items.length} Positionen)</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 10px; text-align: left;">Artikel</th>
            <th style="padding: 10px; text-align: left;">Farbe</th>
            <th style="padding: 10px; text-align: center;">Menge</th>
            <th style="padding: 10px; text-align: right;">Preis</th>
          </tr>
        </thead>
        <tbody>
          ${orderData.items.map(item => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px;">
                ${item.product_name}
                ${item.product_sku ? `<br><small style="color: #666;">SKU: ${item.product_sku}</small>` : ''}
              </td>
              <td style="padding: 10px;">${item.color || '-'}</td>
              <td style="padding: 10px; text-align: center;">${item.quantity}</td>
              <td style="padding: 10px; text-align: right;">€ ${item.total_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;">
      <h3 style="color: #856404; margin: 0 0 10px 0;">⚡ Erforderliche Aktionen</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Bestellung im CJ Dropshipping System verarbeiten</li>
        <li>Versand vorbereiten und Tracking-Nummer generieren</li>
        <li>Kunde über Versandstatus informieren</li>
      </ul>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.SITE_URL || 'http://localhost:5000'}/admin/orders/${orderData.order_id}" 
         style="display: inline-block; padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Bestellung im Admin-Panel anzeigen
      </a>
    </div>
  </div>

  <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; text-align: center; color: #666;">
    <p style="margin: 0;">Diese E-Mail wurde automatisch generiert.</p>
    <p style="margin: 5px 0;">Smart Home Shop | ${new Date().toLocaleString('de-DE')}</p>
  </div>
</body>
</html>
    `;

    const textContent = `
NEUE BESTELLUNG EINGEGANGEN!

Bestellnummer: ${orderData.order_id}
Kassenbon-Nr: ${orderData.receipt_number}
Datum/Zeit: ${new Date(orderData.created_at).toLocaleString('de-DE')}
Gesamtbetrag: € ${orderData.total_amount.toFixed(2)}

KUNDE:
Name: ${orderData.customer_name}
E-Mail: ${orderData.customer_email}
${orderData.customer_phone ? `Telefon: ${orderData.customer_phone}` : ''}

ARTIKEL (${orderData.items.length} Positionen):
${orderData.items.map(item => 
  `- ${item.product_name} ${item.color ? `(${item.color})` : ''} x${item.quantity} = € ${item.total_price.toFixed(2)}`
).join('\n')}

ERFORDERLICHE AKTIONEN:
1. Bestellung im CJ Dropshipping System verarbeiten
2. Versand vorbereiten und Tracking-Nummer generieren
3. Kunde über Versandstatus informieren

Bestellung anzeigen: ${process.env.SITE_URL || 'http://localhost:5000'}/admin/orders/${orderData.order_id}
    `;

    // PDF-Anhang
    const attachments = [];
    if (pdfPath && fs.existsSync(pdfPath)) {
      attachments.push({
        filename: `Kassenbon_${orderData.receipt_number}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf'
      });
    }

    try {
      if (this.useSendGrid) {
        // SendGrid
        const msg = {
          to: this.adminEmail,
          from: {
            email: this.fromEmail,
            name: this.fromName
          },
          subject: subject,
          text: textContent,
          html: adminHTML,
          attachments: attachments.map(att => ({
            content: fs.readFileSync(att.path).toString('base64'),
            filename: att.filename,
            type: att.contentType,
            disposition: 'attachment'
          }))
        };

        await this.sgMail.send(msg);
        console.log(`✅ Admin-Benachrichtigung gesendet (SendGrid)`);
        return { success: true, method: 'sendgrid' };

      } else {
        // Nodemailer
        const mailOptions = {
          from: `"${this.fromName}" <${this.fromEmail}>`,
          to: this.adminEmail,
          subject: subject,
          text: textContent,
          html: adminHTML,
          attachments: attachments
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Admin-Benachrichtigung gesendet (SMTP)`);
        return { success: true, method: 'smtp', messageId: info.messageId };
      }
    } catch (error) {
      console.error('❌ Fehler beim E-Mail-Versand an Admin:', error);
      throw error;
    }
  }

  // Test-E-Mail senden
  async sendTestEmail(to) {
    const subject = 'Test-E-Mail - Kassenbon-System';
    const html = `
      <h1>Test-E-Mail erfolgreich!</h1>
      <p>Das E-Mail-System funktioniert korrekt.</p>
      <p>Methode: ${this.useSendGrid ? 'SendGrid' : 'SMTP'}</p>
      <p>Zeit: ${new Date().toLocaleString('de-DE')}</p>
    `;

    try {
      if (this.useSendGrid) {
        await this.sgMail.send({
          to: to,
          from: { email: this.fromEmail, name: this.fromName },
          subject: subject,
          html: html
        });
      } else {
        await this.transporter.sendMail({
          from: `"${this.fromName}" <${this.fromEmail}>`,
          to: to,
          subject: subject,
          html: html
        });
      }
      return { success: true, message: 'Test-E-Mail gesendet' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;
