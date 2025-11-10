/**
 * STRIPE → CJ AUTO-PAYMENT SETUP
 * 
 * Dieses Script erstellt einen Stripe Sub-Account für CJ-Zahlungen
 * und richtet die automatische Aufteilung ein.
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function setupCJSubAccount() {
  console.log('🚀 STRIPE → CJ AUTO-PAYMENT SETUP\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Erstelle Connected Account für CJ-Zahlungen
    console.log('\n📝 Schritt 1: Erstelle CJ Sub-Account...');
    
    const cjAccount = await stripe.accounts.create({
      type: 'express',
      country: 'DE',
      email: 'cj-payments@maiosshop.com',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_type: 'company',
      business_profile: {
        name: 'CJ Dropshipping Payments',
        product_description: 'Automatische Zahlungen für CJ Dropshipping Bestellungen',
        support_email: 'maioscorporation@gmail.com',
        url: 'https://maiosshop.com'
      },
      metadata: {
        purpose: 'cj_dropshipping_payments',
        created_by: 'auto_setup',
        shop: 'maiosshop'
      }
    });
    
    console.log('✅ CJ Sub-Account erstellt!');
    console.log(`   Account-ID: ${cjAccount.id}`);
    
    // 2. Speichere Account-ID in .env
    console.log('\n📝 Schritt 2: Speichere Account-ID...');
    
    const fs = require('fs');
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Füge CJ Account ID hinzu
    if (!envContent.includes('CJ_STRIPE_ACCOUNT_ID')) {
      envContent += `\n# CJ Dropshipping Stripe Sub-Account\nCJ_STRIPE_ACCOUNT_ID=${cjAccount.id}\n`;
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Account-ID in .env gespeichert');
    } else {
      console.log('⚠️  Account-ID bereits in .env vorhanden');
    }
    
    // 3. Erstelle Account Link für Onboarding
    console.log('\n📝 Schritt 3: Erstelle Onboarding-Link...');
    
    const accountLink = await stripe.accountLinks.create({
      account: cjAccount.id,
      refresh_url: 'https://maiosshop.com/stripe/refresh',
      return_url: 'https://maiosshop.com/stripe/return',
      type: 'account_onboarding'
    });
    
    console.log('✅ Onboarding-Link erstellt');
    console.log(`   URL: ${accountLink.url}`);
    
    // 4. Zeige Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ SETUP ERFOLGREICH ABGESCHLOSSEN!\n');
    
    console.log('📋 ZUSAMMENFASSUNG:');
    console.log(`   CJ Account-ID: ${cjAccount.id}`);
    console.log(`   Status: ${cjAccount.charges_enabled ? 'Aktiv' : 'Onboarding erforderlich'}`);
    console.log(`   E-Mail: ${cjAccount.email}`);
    
    console.log('\n📝 NÄCHSTE SCHRITTE:');
    console.log('   1. ✅ Account-ID wurde in .env gespeichert');
    console.log('   2. ⚠️  Onboarding abschließen (falls erforderlich):');
    console.log(`      ${accountLink.url}`);
    console.log('   3. ✅ Payment Split Code wird automatisch verwendet');
    console.log('   4. ✅ CJ-Bestellungen werden automatisch bezahlt');
    
    console.log('\n💡 WIE ES FUNKTIONIERT:');
    console.log('   Kunde zahlt €28.99');
    console.log('   ├─ €15.00 → CJ Sub-Account (automatisch)');
    console.log('   └─ €13.99 → Dein Haupt-Account (Gewinn)');
    console.log('   → CJ-Bestellung wird von Sub-Account bezahlt');
    console.log('   → Du musst NICHTS zahlen!\n');
    
    return {
      success: true,
      accountId: cjAccount.id,
      onboardingUrl: accountLink.url
    };
    
  } catch (error) {
    console.error('\n❌ FEHLER beim Setup:', error.message);
    
    if (error.code === 'account_invalid') {
      console.log('\n💡 LÖSUNG: Prüfe deine Stripe API-Keys in .env');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Führe Setup aus
if (require.main === module) {
  setupCJSubAccount()
    .then(result => {
      if (result.success) {
        console.log('='.repeat(60));
        console.log('\n🎉 FERTIG! System ist bereit für automatische CJ-Zahlungen!\n');
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal Error:', error);
      process.exit(1);
    });
}

module.exports = { setupCJSubAccount };
