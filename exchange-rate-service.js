/**
 * Exchange Rate Service
 * Live currency conversion using exchangerate-api.com
 * Free tier: 1,500 requests/month
 * Get your API key: https://www.exchangerate-api.com/
 */

require('dotenv').config();
// Natives fetch (Node 18+/20). node-fetch wird nicht mehr gebraucht.
const fetch = globalThis.fetch;

class ExchangeRateService {
  constructor() {
    this.apiKey = process.env.EXCHANGE_RATE_API_KEY || 'your_api_key_here';
    this.baseURL = 'https://v6.exchangerate-api.com/v6';
    this.baseCurrency = 'EUR';
    
    // Cache für Wechselkurse (1 Stunde gültig)
    this.cache = {
      rates: null,
      timestamp: null,
      ttl: 3600000 // 1 Stunde in Millisekunden
    };
    
    // Fallback-Kurse wenn API nicht verfügbar
    this.fallbackRates = {
      'EUR': 1.00,
      'USD': 1.09,
      'GBP': 0.86,
      'CHF': 0.96,
      'CAD': 1.48,
      'AUD': 1.66,
      'NZD': 1.79,
      'JPY': 163.50,
      'CNY': 7.85,
      'INR': 91.20,
      'KRW': 1450.00,
      'SEK': 11.50,
      'NOK': 11.80,
      'DKK': 7.46,
      'PLN': 4.35,
      'CZK': 25.20,
      'HUF': 395.00,
      'RON': 4.97,
      'BRL': 6.10,
      'MXN': 18.50,
      'TRY': 37.50,
      'RUB': 105.00
    };
    
    if (this.apiKey === 'your_api_key_here') {
      console.warn('⚠️  Exchange Rate API key not configured. Using fallback rates.');
      console.warn('📖 Get your free API key from: https://www.exchangerate-api.com/');
    } else {
      console.log('✅ Exchange Rate Service initialized');
    }
  }

  /**
   * Prüfe ob Cache noch gültig ist
   */
  isCacheValid() {
    if (!this.cache.rates || !this.cache.timestamp) {
      return false;
    }
    
    const now = Date.now();
    const age = now - this.cache.timestamp;
    
    return age < this.cache.ttl;
  }

  /**
   * Hole aktuelle Wechselkurse von API
   */
  async fetchLiveRates() {
    try {
      // Verwende Cache wenn noch gültig
      if (this.isCacheValid()) {
        console.log('📊 Using cached exchange rates');
        return this.cache.rates;
      }

      // Wenn kein API Key, verwende Fallback
      if (this.apiKey === 'your_api_key_here') {
        console.log('📊 Using fallback exchange rates (no API key)');
        return this.fallbackRates;
      }

      const url = `${this.baseURL}/${this.apiKey}/latest/${this.baseCurrency}`;
      console.log('🌐 Fetching live exchange rates from API...');
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.result === 'success') {
        // Speichere in Cache
        this.cache.rates = data.conversion_rates;
        this.cache.timestamp = Date.now();
        
        console.log('✅ Live exchange rates updated successfully');
        console.log(`📅 Last updated: ${new Date(data.time_last_update_unix * 1000).toLocaleString()}`);
        console.log(`🔄 Next update: ${new Date(data.time_next_update_unix * 1000).toLocaleString()}`);
        
        return data.conversion_rates;
      } else {
        console.warn('⚠️  API returned error, using fallback rates');
        return this.fallbackRates;
      }
    } catch (error) {
      console.error('❌ Exchange Rate API Error:', error.message);
      console.log('📊 Using fallback exchange rates');
      return this.fallbackRates;
    }
  }

  /**
   * Hole Wechselkurs für eine bestimmte Währung
   */
  async getExchangeRate(currency) {
    const rates = await this.fetchLiveRates();
    return rates[currency.toUpperCase()] || 1.00;
  }

  /**
   * Rechne Preis von EUR in andere Währung um
   */
  async convertPrice(priceInEUR, targetCurrency) {
    const rate = await this.getExchangeRate(targetCurrency);
    const convertedPrice = priceInEUR * rate;
    
    // Runde auf 2 Dezimalstellen, außer bei JPY, KRW (keine Dezimalstellen)
    if (targetCurrency === 'JPY' || targetCurrency === 'KRW') {
      return Math.round(convertedPrice);
    }
    
    return Math.round(convertedPrice * 100) / 100;
  }

  /**
   * Rechne Preis von einer Währung in eine andere um
   */
  async convertBetweenCurrencies(amount, fromCurrency, toCurrency) {
    const rates = await this.fetchLiveRates();
    
    // Wenn beide Währungen gleich sind
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    // Konvertiere zu EUR, dann zur Zielwährung
    const fromRate = rates[fromCurrency.toUpperCase()] || 1.00;
    const toRate = rates[toCurrency.toUpperCase()] || 1.00;
    
    const amountInEUR = amount / fromRate;
    const convertedAmount = amountInEUR * toRate;
    
    // Runde auf 2 Dezimalstellen, außer bei JPY, KRW
    if (toCurrency === 'JPY' || toCurrency === 'KRW') {
      return Math.round(convertedAmount);
    }
    
    return Math.round(convertedAmount * 100) / 100;
  }

  /**
   * Hole alle verfügbaren Währungen
   */
  async getSupportedCurrencies() {
    const rates = await this.fetchLiveRates();
    return Object.keys(rates);
  }

  /**
   * Formatiere Preis mit Währungssymbol
   */
  formatPrice(amount, currency) {
    const symbols = {
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'CHF': 'CHF',
      'CAD': 'CA$',
      'AUD': 'A$',
      'NZD': 'NZ$',
      'INR': '₹',
      'KRW': '₩',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'CZK': 'Kč',
      'HUF': 'Ft',
      'RON': 'lei',
      'BRL': 'R$',
      'MXN': 'MX$',
      'TRY': '₺',
      'RUB': '₽'
    };
    
    const symbol = symbols[currency.toUpperCase()] || currency;
    
    // Formatiere Betrag
    if (currency === 'JPY' || currency === 'KRW') {
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    }
    
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Cache manuell leeren
   */
  clearCache() {
    this.cache.rates = null;
    this.cache.timestamp = null;
    console.log('🗑️  Exchange rate cache cleared');
  }

  /**
   * Hole Cache-Status
   */
  getCacheStatus() {
    if (!this.isCacheValid()) {
      return {
        valid: false,
        message: 'Cache is empty or expired'
      };
    }
    
    const age = Date.now() - this.cache.timestamp;
    const remaining = this.cache.ttl - age;
    
    return {
      valid: true,
      age: Math.round(age / 1000), // Sekunden
      remaining: Math.round(remaining / 1000), // Sekunden
      lastUpdate: new Date(this.cache.timestamp).toISOString()
    };
  }
}

module.exports = ExchangeRateService;
