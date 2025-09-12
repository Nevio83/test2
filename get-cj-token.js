/**
 * Script zum Abrufen des CJ Access Tokens
 */

require('dotenv').config();
const CJDropshippingAPI = require('./cj-dropshipping-api');

async function getCJAccessToken() {
  console.log('🔑 CJ Access Token abrufen...\n');
  
  const cjAPI = new CJDropshippingAPI();
  
  try {
    // Access Token mit Email und Passwort abrufen
    const response = await cjAPI.getAccessToken();
    
    if (response && response.data && response.data.accessToken) {
      console.log('✅ Access Token erfolgreich abgerufen!');
      console.log('📋 Access Token:', response.data.accessToken);
      console.log('\n📝 Fügen Sie diesen Token in Ihre .env Datei ein:');
      console.log(`CJ_ACCESS_TOKEN=${response.data.accessToken}`);
      
      return response.data.accessToken;
    } else {
      console.log('❌ Fehler beim Abrufen des Access Tokens');
      console.log('📋 Response:', JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    console.log('\n🔧 Stellen Sie sicher, dass Sie folgende Werte in der .env gesetzt haben:');
    console.log('- CJ_EMAIL (Ihre CJ Dropshipping E-Mail)');
    console.log('- CJ_PASSWORD (Ihr CJ Dropshipping Passwort)');
  }
}

// Script ausführen
if (require.main === module) {
  getCJAccessToken();
}

module.exports = getCJAccessToken;