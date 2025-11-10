/**
 * VEREINFACHTE STRIPE CONNECT AKTIVIERUNG
 * 
 * Prüft ob Stripe Connect aktiv ist und gibt Anleitung
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkStripeConnect() {
  console.log('🔍 PRÜFE STRIPE CONNECT STATUS\n');
  console.log('='.repeat(60));
  
  try {
    // Versuche Account-Informationen abzurufen
    const account = await stripe.accounts.retrieve();
    
    console.log('\n✅ STRIPE ACCOUNT GEFUNDEN\n');
    console.log(`Account-ID: ${account.id}`);
    console.log(`E-Mail: ${account.email || 'Nicht gesetzt'}`);
    console.log(`Land: ${account.country}`);
    console.log(`Charges enabled: ${account.charges_enabled ? 'Ja' : 'Nein'}`);
    console.log(`Payouts enabled: ${account.payouts_enabled ? 'Ja' : 'Nein'}`);
    
    // Prüfe Connect-Fähigkeiten
    if (account.capabilities) {
      console.log('\n📋 CAPABILITIES:');
      Object.entries(account.capabilities).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    
    // Prüfe ob Connect verfügbar ist
    console.log('\n🔍 PRÜFE CONNECT-VERFÜGBARKEIT...');
    
    try {
      // Versuche eine Test-Account-Liste abzurufen
      const accounts = await stripe.accounts.list({ limit: 1 });
      console.log('✅ STRIPE CONNECT IST AKTIV!');
      console.log(`   Verbundene Accounts: ${accounts.data.length}`);
      
      console.log('\n' + '='.repeat(60));
      console.log('\n🎉 PERFEKT! Du kannst jetzt fortfahren:\n');
      console.log('   node setup-stripe-cj-split.js\n');
      
      return true;
      
    } catch (connectError) {
      if (connectError.code === 'account_invalid') {
        console.log('❌ STRIPE CONNECT NICHT AKTIVIERT\n');
        console.log('📝 AKTIVIERE STRIPE CONNECT:');
        console.log('   1. Öffne: https://dashboard.stripe.com/connect/overview');
        console.log('   2. Klicke "Get started with Connect"');
        console.log('   3. Wähle "Platform or marketplace"');
        console.log('   4. Bestätige die Nutzungsbedingungen');
        console.log('\n   ODER direkt hier:');
        console.log('   https://dashboard.stripe.com/settings/connect\n');
        console.log('⏱️  Dauert nur 2-3 Minuten!\n');
        
        return false;
      }
      throw connectError;
    }
    
  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    
    if (error.type === 'StripeAuthenticationError') {
      console.log('\n💡 LÖSUNG: Prüfe deinen STRIPE_SECRET_KEY in .env');
    }
    
    return false;
  }
}

// Führe Check aus
if (require.main === module) {
  checkStripeConnect()
    .then(isActive => {
      console.log('='.repeat(60));
      if (isActive) {
        console.log('\n✅ BEREIT FÜR CJ AUTO-PAYMENT SETUP!\n');
        process.exit(0);
      } else {
        console.log('\n⚠️  BITTE ERST STRIPE CONNECT AKTIVIEREN\n');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal Error:', error);
      process.exit(1);
    });
}

module.exports = { checkStripeConnect };
