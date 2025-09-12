/**
 * CJ Dropshipping Authentication Diagnostic Tool
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function diagnoseCJAuth() {
  console.log('🔍 CJ Dropshipping Authentication Diagnostic\n');
  
  // Check environment variables
  console.log('1. Checking Environment Configuration...');
  const email = process.env.CJ_EMAIL;
  const password = process.env.CJ_PASSWORD;
  const apiKey = process.env.CJ_API_KEY;
  const accessToken = process.env.CJ_ACCESS_TOKEN;
  
  console.log(`   ✅ CJ_EMAIL: ${email ? '✓ Set' : '❌ Missing'}`);
  console.log(`   ✅ CJ_PASSWORD: ${password ? '✓ Set' : '❌ Missing'}`);
  console.log(`   ✅ CJ_API_KEY: ${apiKey ? '✓ Set' : '❌ Missing'}`);
  console.log(`   ✅ CJ_ACCESS_TOKEN: ${accessToken && accessToken !== 'your_cj_access_token_here' ? '✓ Valid' : '❌ Placeholder'}\n`);
  
  if (!email || !password) {
    console.log('❌ Missing required credentials. Please check your .env file.\n');
    return;
  }
  
  // Test different authentication methods
  console.log('2. Testing Authentication Methods...\n');
  
  // Method 1: Direct token request (no auth headers)
  console.log('   Method 1: Direct token request (recommended)');
  try {
    const response1 = await testTokenRequest(email, password, null);
    console.log('   ✅ Success with direct request');
    console.log(`   📋 Response: ${JSON.stringify(response1, null, 2)}\n`);
    return response1;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}\n`);
  }
  
  // Method 2: With API key in headers
  if (apiKey) {
    console.log('   Method 2: With API key in headers');
    try {
      const response2 = await testTokenRequest(email, password, apiKey);
      console.log('   ✅ Success with API key');
      console.log(`   📋 Response: ${JSON.stringify(response2, null, 2)}\n`);
      return response2;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
    }
  }
  
  // Method 3: Test different base URLs
  console.log('   Method 3: Testing alternative base URLs');
  const baseUrls = [
    'https://developers.cjdropshipping.com',
    'https://cjdropshipping.com',
    'https://api.cjdropshipping.com'
  ];
  
  for (const baseUrl of baseUrls) {
    console.log(`   Testing: ${baseUrl}`);
    try {
      const response3 = await testTokenRequest(email, password, null, baseUrl);
      console.log(`   ✅ Success with ${baseUrl}`);
      console.log(`   📋 Response: ${JSON.stringify(response3, null, 2)}\n`);
      return response3;
    } catch (error) {
      console.log(`   ❌ Failed with ${baseUrl}: ${error.message}`);
    }
  }
  
  console.log('\n🚨 All authentication methods failed.');
  console.log('\n🔧 Troubleshooting Steps:');
  console.log('1. Verify your CJ Dropshipping account credentials');
  console.log('2. Check if your account has API access enabled');
  console.log('3. Try logging into https://cjdropshipping.com manually');
  console.log('4. Contact CJ Dropshipping support for API access');
  console.log('5. Generate a new API key at: https://cjdropshipping.com/my.html#/apikey');
}

async function testTokenRequest(email, password, apiKey = null, baseUrl = 'https://developers.cjdropshipping.com') {
  const url = `${baseUrl}/api2.0/v1/authentication/getAccessToken`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (apiKey) {
    headers['CJ-Access-Token'] = apiKey;
  }
  
  const config = {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: email,
      password: password
    })
  };
  
  const response = await fetch(url, config);
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`${result.message || response.statusText} (Status: ${response.status})`);
  }
  
  return result;
}

// Run diagnostic
if (require.main === module) {
  diagnoseCJAuth().catch(console.error);
}

module.exports = diagnoseCJAuth;
