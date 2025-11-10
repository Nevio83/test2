const { Resend } = require('resend');
require('dotenv').config();

class ResendService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.fromName = process.env.RESEND_FROM_NAME || 'Maios Shop';
    
    if (!this.apiKey) {
      console.warn('⚠️ Resend nicht konfiguriert - E-Mails werden nicht gesendet');
      return;
    }
    
    this.resend = new Resend(this.apiKey);
    console.log('✅ Resend E-Mail-Service initialisiert');
  }

  /**
   * Generiere HTML für Bestellbestätigung
   */
  generateOrderConfirmationHTML(orderData) {
    const items = orderData.items.map(item => 
      `${item.product_name} ${item.color ? `(${item.color})` : ''} x${item.quantity} = €${item.total_price.toFixed(2)}`
    ).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    
                    <!-- Logo Header -->
                    <tr>
                        <td style="text-align: center; padding: 40px 0; background-color: #000000;">
                            <img src="https://i.imgur.com/KqgoTsN.jpeg" alt="Maios" style="width: 150px; height: auto; display: block; margin: 0 auto;">
                        </td>
                    </tr>
                    
                    <!-- Titel -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">Vielen Dank für Ihre Bestellung!</h1>
                        </td>
                    </tr>
                    
                    <!-- Hauptinhalt -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
                                Hallo ${orderData.customer_name || 'Kunde'},<br><br>
                                wir haben Ihre Bestellung erhalten und werden diese schnellstmöglich bearbeiten.
                            </p>
                            
                            <!-- Bestellnummer Box -->
                            <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Bestellnummer</p>
                                <p style="margin: 5px 0 0 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">${orderData.order_id}</p>
                            </div>
                            
                            <!-- Bestelldetails -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 15px 0; border-bottom: 1px solid #e9ecef;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td>
                                                    <p style="margin: 0; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Kassenbon-Nr</p>
                                                    <p style="margin: 5px 0 0 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${orderData.receipt_number}</p>
                                                </td>
                                                <td align="right">
                                                    <p style="margin: 0; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Datum</p>
                                                    <p style="margin: 5px 0 0 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${new Date(orderData.created_at).toLocaleDateString('de-DE')}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Artikel Liste -->
                            <div style="margin: 0 0 30px 0;">
                                <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">Ihre Artikel</h2>
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                    <pre style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #495057; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${items}</pre>
                                </div>
                            </div>
                            
                            <!-- Gesamtbetrag -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 25px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; border: 2px solid #28a745;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #666666; font-size: 16px; font-weight: 600;">Gesamtbetrag</td>
                                                <td align="right" style="color: #28a745; font-size: 28px; font-weight: 700;">€${orderData.total_amount.toFixed(2)}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Lieferadresse -->
                            <div style="margin: 0 0 30px 0;">
                                <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">🚚 Lieferadresse</h2>
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
                                    ${typeof orderData.shipping_address === 'string' ? orderData.shipping_address : JSON.stringify(orderData.shipping_address, null, 2)}
                                </div>
                            </div>
                            
                            <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                                Bei Fragen stehen wir Ihnen gerne zur Verfügung.<br>
                                <strong style="color: #1a1a1a;">Ihr Maios Shop Team</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1a1a1a; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: 1px;">MAIOS SHOP</p>
                            <p style="margin: 0; color: #999999; font-size: 13px;">
                                <a href="https://maiosshop.com" style="color: #28a745; text-decoration: none; font-weight: 500;">maiosshop.com</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
  }

  /**
   * Sende Bestellbestätigung an Kunden
   */
  async sendOrderConfirmation(orderData) {
    try {
      if (!this.resend) {
        console.warn('⚠️ Resend nicht initialisiert');
        return { success: false, error: 'Resend not configured' };
      }

      const html = this.generateOrderConfirmationHTML(orderData);

      // Hinweis: Gmail blockiert externe Bilder standardmäßig
      // Der Kunde muss auf "Bilder anzeigen" klicken
      const data = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [orderData.customer_email],
        subject: `Bestellung ${orderData.order_id} - Vielen Dank!`,
        html: html,
        headers: {
          'X-Entity-Ref-ID': orderData.order_id
        }
      });

      console.log('✅ Bestellbestätigung gesendet an:', orderData.customer_email);
      console.log('ℹ️  Hinweis: Gmail blockiert Bilder - Kunde muss "Bilder anzeigen" klicken');
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('❌ Resend Fehler:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sende Admin-Benachrichtigung
   */
  async sendAdminNotification(orderData) {
    try {
      if (!this.resend) {
        return { success: false, error: 'Resend not configured' };
      }

      const items = orderData.items.map(item => 
        `${item.product_name} ${item.color ? `(${item.color})` : ''} x${item.quantity} = €${item.total_price.toFixed(2)}`
      ).join('\n');

      const html = `
        <h2>🛒 Neue Bestellung erhalten!</h2>
        <p><strong>Bestellnummer:</strong> ${orderData.order_id}</p>
        <p><strong>Kunde:</strong> ${orderData.customer_name} (${orderData.customer_email})</p>
        <p><strong>Gesamtbetrag:</strong> €${orderData.total_amount.toFixed(2)}</p>
        <h3>Artikel:</h3>
        <pre>${items}</pre>
        <p><a href="${process.env.SITE_URL || 'https://maiosshop.com'}/admin/orders/${orderData.order_id}">Bestellung anzeigen</a></p>
      `;

      const data = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: ['maioscorporation@gmail.com'], // Admin E-Mail
        subject: `🛒 Neue Bestellung: ${orderData.order_id}`,
        html: html
      });

      console.log('✅ Admin-Benachrichtigung gesendet');
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('❌ Admin-Benachrichtigung Fehler:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generische E-Mail senden
   */
  async sendEmail({ to, subject, html, text, replyTo }) {
    try {
      if (!this.resend) {
        console.warn('⚠️ Resend nicht initialisiert');
        return { success: false, error: 'Resend not configured' };
      }

      const emailData = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      };

      if (text) {
        emailData.text = text;
      }

      if (replyTo) {
        emailData.replyTo = replyTo;
      }

      const data = await this.resend.emails.send(emailData);

      console.log('✅ E-Mail gesendet an:', to);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('❌ Resend Fehler:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test-E-Mail senden
   */
  async sendTestEmail(toEmail) {
    try {
      if (!this.resend) {
        return { success: false, error: 'Resend not configured' };
      }

      const testOrderData = {
        order_id: 'TEST-12345',
        receipt_number: 'KB-TEST-001',
        customer_name: 'Test Kunde',
        customer_email: toEmail,
        total_amount: 99.99,
        created_at: new Date().toISOString(),
        items: [
          {
            product_name: 'Test Produkt',
            color: 'Schwarz',
            quantity: 1,
            total_price: 99.99
          }
        ],
        shipping_address: 'Teststraße 1\n12345 Teststadt\nDeutschland'
      };

      const result = await this.sendOrderConfirmation(testOrderData);
      
      if (result.success) {
        return { success: true, message: 'Test-E-Mail erfolgreich gesendet!', messageId: result.messageId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Test-E-Mail Fehler:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ResendService();
