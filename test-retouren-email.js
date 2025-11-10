/**
 * TEST: Retouren E-Mail senden
 * Sendet eine Test-E-Mail um zu zeigen wie Retouren-Benachrichtigungen aussehen
 */

require('dotenv').config();
const emailService = require('./resend-service');

async function sendTestReturnEmail() {
  console.log('📧 SENDE TEST-RETOUREN E-MAIL\n');
  console.log('='.repeat(60));
  
  const testOrderId = 'ORD-TEST-' + Date.now();
  const autoApproved = true; // Simuliere automatische Genehmigung
  
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
                                <p style="margin: 10px 0 0 0; color: #155724; font-size: 12px;">Kunde erhält Geld automatisch zurück. CJ-Retoure wurde automatisch erstellt.</p>
                            </div>
                            ` : `
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600;">⚠️ NEUE RETOURE-ANFRAGE - MANUELLE PRÜFUNG ERFORDERLICH</p>
                            </div>
                            `}
                            
                            <!-- Bestellnummer -->
                            <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 0 0 20px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Bestellnummer</p>
                                <p style="margin: 5px 0 0 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">${testOrderId}</p>
                                <p style="margin: 10px 0 0 0; color: #28a745; font-size: 13px;">✅ TEST-BESTELLUNG</p>
                            </div>
                            
                            <!-- Kundendaten -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 12px; text-transform: uppercase;">Kunden-E-Mail</p>
                                        <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">test@kunde.de</p>
                                        <p style="margin: 10px 0 0 0; color: #666666; font-size: 14px;">Kunde: Max Mustermann (TEST)</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Retouren-Grund -->
                            <div style="margin: 0 0 20px 0;">
                                <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">Grund der Retoure</h2>
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                    <p style="margin: 0; color: #495057; font-size: 15px; line-height: 1.6;">Produkt defekt (TEST-RETOURE)</p>
                                </div>
                            </div>
                            
                            <!-- Bestelldetails -->
                            <div style="margin: 0 0 20px 0;">
                                <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">Bestelldetails</h2>
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;"><strong>Bestelldatum:</strong> ${new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;"><strong>Gesamtbetrag:</strong> €28.99</p>
                                    <p style="margin: 0; color: #666666; font-size: 14px;"><strong>Status:</strong> ${autoApproved ? 'Automatisch erstattet' : 'Manuelle Prüfung'}</p>
                                </div>
                            </div>
                            
                            <!-- Aktionen -->
                            <div style="margin: 30px 0 0 0; padding: 20px; background: linear-gradient(135deg, #e9ecef 0%, #f8f9fa 100%); border-radius: 8px; border: 2px solid ${autoApproved ? '#28a745' : '#dc3545'};">
                                <p style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">📋 ${autoApproved ? 'Automatisch erledigt:' : 'Nächste Schritte:'}</p>
                                ${autoApproved ? `
                                <ul style="margin: 0; padding-left: 20px; color: #155724; font-size: 14px; line-height: 1.8;">
                                    <li>✅ Stripe Refund erstellt</li>
                                    <li>✅ Geld zurück an Kunden</li>
                                    <li>✅ CJ-Retoure automatisch erstellt</li>
                                    <li>✅ Kunde wurde informiert</li>
                                    <li>⏳ CJ prüft Retoure (1-2 Tage)</li>
                                    <li>⏳ CJ erstattet automatisch</li>
                                </ul>
                                <p style="margin: 15px 0 0 0; color: #155724; font-size: 14px; font-weight: 600;">
                                    ✅ Du musst NICHTS machen!
                                </p>
                                ` : `
                                <ol style="margin: 0; padding-left: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
                                    <li>Retoure prüfen und entscheiden</li>
                                    <li>Refund in Stripe Dashboard erstellen</li>
                                    <li>CJ kontaktieren (falls nötig)</li>
                                    <li>Kunde informieren</li>
                                </ol>
                                `}
                            </div>
                            
                            <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; text-align: center;">
                                Dies ist eine TEST-E-Mail.<br>
                                So sehen echte Retouren-Benachrichtigungen aus.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1a1a1a; padding: 20px; text-align: center;">
                            <p style="margin: 0; color: #999999; font-size: 13px;">Maios Shop - Retouren-System (TEST)</p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
  
  try {
    console.log('\n📤 Sende E-Mail an: maioscorporation@gmail.com');
    console.log(`📝 Betreff: ${autoApproved ? '✅ TEST: RETOURE AUTOMATISCH GENEHMIGT' : '🔄 TEST: Retoure-Anfrage'} #${testOrderId}`);
    
    const result = await emailService.sendEmail({
      to: 'maioscorporation@gmail.com',
      subject: `${autoApproved ? '✅ TEST: RETOURE AUTOMATISCH GENEHMIGT' : '🔄 TEST: Retoure-Anfrage'} #${testOrderId}`,
      html: htmlContent,
      replyTo: 'test@kunde.de'
    });
    
    if (result.success) {
      console.log('\n✅ TEST-E-MAIL ERFOLGREICH GESENDET!\n');
      console.log('='.repeat(60));
      console.log('\n📧 PRÜFE DEIN POSTFACH:');
      console.log('   E-Mail: maioscorporation@gmail.com');
      console.log('   Betreff: ✅ TEST: RETOURE AUTOMATISCH GENEHMIGT');
      console.log('   Von: noreply@maiosshop.com');
      console.log('\n💡 TIPPS:');
      console.log('   - Prüfe auch Spam-Ordner');
      console.log('   - E-Mail kann 1-2 Minuten dauern');
      console.log('   - Erstelle Gmail-Filter für Shop-E-Mails\n');
      console.log('='.repeat(60));
    } else {
      console.error('\n❌ E-Mail konnte nicht gesendet werden');
      console.error('Fehler:', result.error);
    }
    
  } catch (error) {
    console.error('\n❌ FEHLER beim Senden:', error.message);
  }
}

// Führe Test aus
if (require.main === module) {
  sendTestReturnEmail()
    .then(() => {
      console.log('\n✅ Test abgeschlossen!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal Error:', error);
      process.exit(1);
    });
}

module.exports = { sendTestReturnEmail };
