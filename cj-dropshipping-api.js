/**
 * CJ Dropshipping API Integration
 * Complete API client for all CJ Dropshipping endpoints
 * Documentation: https://cjdropshipping.com/my.html#/apikey
 */

require('dotenv').config();
// Natives fetch (Node 18+/20). node-fetch wird nicht mehr gebraucht.
const fetch = globalThis.fetch;
const CJFallbackSystem = require('./cj-fallback-system');

class CJDropshippingAPI {
  constructor(config = {}) {
    this.baseURL = config.baseURL || process.env.CJ_BASE_URL || 'https://developers.cjdropshipping.com';
    this.apiKey = config.apiKey || process.env.CJ_API_KEY;
    this.accessToken = config.accessToken || process.env.CJ_ACCESS_TOKEN;
    this.email = config.email || process.env.CJ_EMAIL;
    this.password = config.password || process.env.CJ_PASSWORD;
    this.fallbackSystem = new CJFallbackSystem();

    // Zur Laufzeit geholter Token (siehe ensureAccessToken). Bewusst nur im
    // Speicher: er laeuft ohnehin ab und hat in keiner Datei etwas zu suchen.
    this.runtimeToken = null;
    this.runtimeTokenExpiry = 0;
    this.lastTokenAttempt = 0;

    if (!this.apiKey && !this.accessToken && !(this.email && this.password)) {
      console.warn('⚠️  CJ API credentials not found. Using fallback mode.');
      console.warn('📖 Get your credentials from: https://cjdropshipping.com/my.html#/apikey');
    } else {
      const wege = [];
      if (this.email && this.password) wege.push('E-Mail+Passwort (Token wird selbst geholt)');
      if (this.accessToken && this.accessToken !== 'your_cj_access_token_here') wege.push('CJ_ACCESS_TOKEN');
      if (this.apiKey) wege.push('CJ_API_KEY');
      console.log('✅ CJ Dropshipping API bereit — Zugang über:', wege.join(', '));
    }
  }

  /**
   * Besorgt bei Bedarf einen gueltigen Access-Token ueber E-Mail + Passwort.
   *
   * Warum das noetig ist: CJ akzeptiert den API-Key nicht als Zugangsschluessel.
   * Man muss sich damit einen zeitlich begrenzten Token holen (CJs Fehlermeldung
   * verweist genau darauf). getAccessToken() gab es zwar schon, wurde vom Server
   * aber NIE aufgerufen — nur vom Hilfsskript get-cj-token.js. Dadurch lief der
   * Shop dauerhaft im Notbetrieb, sobald der von Hand eingetragene Token ablief.
   *
   * CJ begrenzt diesen Aufruf streng (etwa einmal alle 5 Minuten je Konto),
   * deshalb die Sperre ueber lastTokenAttempt — sonst sperrt CJ das Konto aus.
   *
   * @param {boolean} erzwingen  true = auch einen noch gueltigen Token erneuern
   * @returns {Promise<string|null>}
   */
  async ensureAccessToken(erzwingen = false) {
    if (!this.email || !this.password) return null;

    const jetzt = Date.now();
    // Eine Minute Sicherheitsabstand vor dem Ablauf.
    if (!erzwingen && this.runtimeToken && this.runtimeTokenExpiry > jetzt + 60000) {
      return this.runtimeToken;
    }

    // Sperre gegen zu haeufige Abrufe — CJ begrenzt das streng und sperrt bei
    // Missbrauch das Konto. Die Dauer haengt davon ab, WARUM gefragt wird:
    //   * abgelaufener Token nach erfolgreichem Abruf -> kurz. Genau dafuer ist
    //     die Erneuerung da; eine lange Sperre wuerde sie aushebeln (beim Test
    //     gegen einen CJ-Nachbau lief der Shop dadurch in den Notbetrieb,
    //     obwohl gueltige Zugangsdaten vorlagen).
    //   * letzter Abruf gescheitert -> lang. Dann stimmen vermutlich die
    //     Zugangsdaten nicht, und haeufiges Nachfragen macht es nur schlimmer.
    const letzterVersuchGescheitert = !this.runtimeToken;
    const sperre = (erzwingen && !letzterVersuchGescheitert) ? 10 * 1000 : 5 * 60 * 1000;
    if (jetzt - this.lastTokenAttempt < sperre) {
      return this.runtimeToken; // Sperre laeuft noch -> nicht erneut anfragen
    }
    this.lastTokenAttempt = jetzt;

    try {
      const antwort = await this.getAccessToken();
      const daten = antwort && antwort.data;
      const token = daten && (daten.accessToken || daten.access_token);
      if (!token) {
        console.warn('⚠️ CJ lieferte keinen Token:', (antwort && antwort.message) || 'unbekannter Grund');
        return this.runtimeToken;
      }
      this.runtimeToken = token;
      // CJ nennt ein Ablaufdatum; ohne Angabe konservativ 12 Stunden annehmen.
      const ablauf = daten.accessTokenExpiryDate || daten.expiryDate;
      const ts = ablauf ? Date.parse(String(ablauf).replace(' ', 'T')) : NaN;
      this.runtimeTokenExpiry = Number.isFinite(ts) ? ts : jetzt + 12 * 60 * 60 * 1000;
      console.log('🔑 CJ-Access-Token geholt, gültig bis',
        new Date(this.runtimeTokenExpiry).toISOString().slice(0, 16).replace('T', ' '));
      return this.runtimeToken;
    } catch (e) {
      console.warn('⚠️ CJ-Token konnte nicht geholt werden:', e.message);
      return this.runtimeToken;
    }
  }

  /**
   * Make authenticated request to CJ API with fallback support
   */
  async makeRequest(endpoint, method = 'GET', data = null, useAuth = true, istWiederholung = false,
                    istRatenWiederholung = false) {
    try {
      const url = `${this.baseURL}${endpoint}`;

      const headers = {
        'Content-Type': 'application/json',
      };

      // Die Authentifizierungs-Aufrufe selbst duerfen keinen Token anfordern —
      // sonst ruft sich das gegenseitig endlos auf.
      const istAuthAufruf = endpoint.includes('/authentication/');

      if (useAuth) {
        // Reihenfolge nach Verlaesslichkeit: selbst geholter Token zuerst, dann
        // ein von Hand hinterlegter, zuletzt der API-Key. Frueher gewann der
        // hinterlegte Token immer — ein abgelaufener Wert machte damit jeden
        // frisch eingetragenen API-Key wirkungslos.
        const geholt = istAuthAufruf ? null : await this.ensureAccessToken();
        const hinterlegt = (this.accessToken && this.accessToken !== 'your_cj_access_token_here')
          ? this.accessToken : null;
        const schluessel = geholt || hinterlegt || this.apiKey;

        if (!schluessel) {
          console.log('⚠️ Keine gültigen CJ-Zugangsdaten — Notbetrieb');
          return this.handleFallback(endpoint, data);
        }
        headers['CJ-Access-Token'] = schluessel;
        this.zuletztVerwendet = geholt ? 'E-Mail+Passwort (selbst geholter Token)'
          : (hinterlegt ? 'CJ_ACCESS_TOKEN' : 'CJ_API_KEY');
      }

      const config = {
        method,
        headers
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);
      const result = await response.json();

      if (!response.ok) {
        const grund = (result && (result.message || result.msg)) || 'ohne Meldung';

        // Zu schnell gefragt? CJ laesst rund eine Anfrage pro Sekunde zu. Das
        // ist kein Fehler, sondern eine Bitte um Geduld — also EINMAL kurz
        // warten und denselben Aufruf wiederholen. Ohne das rutschte jeder
        // Abgleich bei mehreren Produkten in den Notbetrieb, obwohl der Zugang
        // einwandfrei war (live gesehen: von drei Produkten kamen nur zwei an).
        const zuSchnell = response.status === 429 || /too many requests|qps/i.test(grund);
        if (zuSchnell && !istRatenWiederholung) {
          await new Promise((r) => setTimeout(r, 1500));
          return this.makeRequest(endpoint, method, data, useAuth, istWiederholung, true);
        }

        // Abgelehnt wegen Zugangsdaten? Dann EINMAL einen frischen Token holen
        // und den Aufruf wiederholen — Token laufen ab, das ist der Normalfall
        // und kein Grund, in den Notbetrieb zu gehen.
        const wirktWieAbgelaufen = response.status === 401 || response.status === 403 ||
          /token|unauthor/i.test(grund);
        if (wirktWieAbgelaufen && !istWiederholung && !istAuthAufruf && this.email && this.password) {
          const neu = await this.ensureAccessToken(true);
          // Nur melden, wenn wirklich ein neuer Token kam. Sonst hat die Sperre
          // gegriffen (CJ erlaubt den Abruf nur alle paar Minuten) — dann waere
          // "hole frischen Token" eine irrefuehrende Zeile im Protokoll.
          if (neu) {
            console.log('🔑 Zugang war abgelaufen — mit frischem Token erneut versucht');
            return this.makeRequest(endpoint, method, data, useAuth, true, istRatenWiederholung);
          }
        }

        // Grund festhalten, statt ihn zu verschlucken. Vorher stand im Log nur
        // "API failed" und nach aussen "CJ API unavailable" — ohne Statuscode
        // und ohne CJs Meldung war nicht unterscheidbar, ob das Token abgelaufen
        // ist, das Konto gesperrt oder nur ein Rate-Limit zuschlug.
        this.lastError = {
          status: response.status,
          message: grund,
          endpoint,
          verwendet: this.zuletztVerwendet || 'keine',
          at: new Date().toISOString()
        };
        console.log(`🔄 CJ lehnte ab (HTTP ${response.status}, ${this.lastError.verwendet}): ${grund} — nutze Notbetrieb`);
        return this.handleFallback(endpoint, data);
      }

      this.lastError = null;
      return result;
    } catch (error) {
      this.lastError = { status: null, message: error.message, endpoint, at: new Date().toISOString() };
      console.log('🔄 CJ nicht erreichbar, Notbetrieb:', error.message);
      return this.handleFallback(endpoint, data);
    }
  }

  /**
   * Handle fallback when API is unavailable
   */
  async handleFallback(endpoint, data) {
    if (endpoint.includes('/product/query')) {
      return this.fallbackSystem.queryProducts(data);
    } else if (endpoint.includes('/product/list')) {
      return this.fallbackSystem.queryProducts(data);
    } else if (endpoint.includes('/order/createOrderV2')) {
      return this.fallbackSystem.createOrder(data);
    } else if (endpoint.includes('/logistic/freightCalculate')) {
      return this.fallbackSystem.calculateShipping(data);
    } else {
      return {
        success: false,
        message: 'CJ API unavailable, limited fallback for this endpoint',
        source: 'fallback'
      };
    }
  }

  // ==========================================
  // AUTHENTICATION APIs
  // ==========================================

  /**
   * Get Access Token
   */
  async getAccessToken() {
    const url = `${this.baseURL}/api2.0/v1/authentication/getAccessToken`;
    const headers = { 'Content-Type': 'application/json' };

    // CJ erwartet im Feld "password" je nach Konto entweder das Kontopasswort
    // ODER den API-Key — die Doku ist da uneindeutig, und welches gilt, merkt
    // man nur am Fehlschlag. Statt zu raten werden beide Moeglichkeiten
    // durchprobiert; welche funktioniert hat, wird gemerkt und beim naechsten
    // Mal zuerst genommen (spart Aufrufe gegen CJs strenge Begrenzung).
    const kandidaten = [];
    const nimm = (wert, name) => {
      if (wert && !kandidaten.some((k) => k.wert === wert)) kandidaten.push({ wert, name });
    };
    // API-Key zuerst: CJ empfiehlt in seiner eigenen Fehlermeldung ausdruecklich
    // den "apiKey mode". Das Kontopasswort bleibt als zweite Moeglichkeit.
    if (this.erfolgreichesGeheimnis === 'CJ_PASSWORD') { nimm(this.password, 'CJ_PASSWORD'); nimm(this.apiKey, 'CJ_API_KEY'); }
    else { nimm(this.apiKey, 'CJ_API_KEY'); nimm(this.password, 'CJ_PASSWORD'); }

    if (!kandidaten.length) throw new Error('Weder CJ_PASSWORD noch CJ_API_KEY gesetzt');

    let letzterFehler = null;
    for (let i = 0; i < kandidaten.length; i++) {
      const k = kandidaten[i];
      // CJ laesst nur EINE Anfrage pro Sekunde zu. Ohne Pause wurde der zweite
      // Versuch mit "Too Many Requests" abgewiesen — er sah dadurch aus wie ein
      // falsches Geheimnis, obwohl er nie geprueft wurde.
      if (i > 0) await new Promise((r) => setTimeout(r, 1300));
      try {
        const response = await fetch(url, {
          method: 'POST', headers,
          body: JSON.stringify({ email: this.email, password: k.wert })
        });
        const result = await response.json();
        if (response.ok && result && result.data &&
            (result.data.accessToken || result.data.access_token)) {
          if (this.erfolgreichesGeheimnis !== k.name) {
            console.log(`🔑 CJ akzeptiert ${k.name} als Zugangsgeheimnis — wird künftig zuerst genutzt`);
          }
          this.erfolgreichesGeheimnis = k.name;
          return result;
        }
        letzterFehler = (result && result.message) || `HTTP ${response.status}`;

        // Ueberlastung ist KEINE Ablehnung des Geheimnisses — es wurde gar nicht
        // geprueft. Einmal abwarten und denselben Kandidaten wiederholen, sonst
        // steht im Protokoll faelschlich "abgelehnt" und man sucht am falschen Ende.
        if (response.status === 429 || /too many requests|qps/i.test(letzterFehler)) {
          // Grosszuegig warten: CJs Grenze liegt bei 1 s, aber sie greift auf
          // das ganze Konto — laeuft parallel noch ein anderer Aufruf, reicht
          // eine knappe Pause nicht. Der Fall ist selten, die Sekunde egal.
          console.log(`🔑 CJ bremst (${letzterFehler}) — ${k.name} wurde nicht geprüft, warte und wiederhole`);
          await new Promise((r) => setTimeout(r, 2500));
          const zweiter = await fetch(url, {
            method: 'POST', headers,
            body: JSON.stringify({ email: this.email, password: k.wert })
          });
          const rr = await zweiter.json();
          if (zweiter.ok && rr && rr.data && (rr.data.accessToken || rr.data.access_token)) {
            this.erfolgreichesGeheimnis = k.name;
            console.log(`🔑 CJ akzeptiert ${k.name} als Zugangsgeheimnis`);
            return rr;
          }
          letzterFehler = (rr && rr.message) || `HTTP ${zweiter.status}`;
        }
        console.log(`🔑 CJ lehnte ${k.name} ab: ${letzterFehler}`);
      } catch (error) {
        letzterFehler = error.message;
        console.log(`🔑 Token-Anfrage mit ${k.name} fehlgeschlagen: ${error.message}`);
      }
    }
    throw new Error(`CJ verweigert den Token (${letzterFehler || 'ohne Meldung'})`);
  }

  /**
   * Refresh Access Token
   */
  async refreshAccessToken() {
    return this.makeRequest('/api2.0/v1/authentication/refreshAccessToken', 'POST');
  }

  /**
   * Logout
   */
  async logout() {
    return this.makeRequest('/api2.0/v1/authentication/logout', 'POST');
  }

  // ==========================================
  // PRODUCT APIs
  // ==========================================

  /**
   * Get Product List
   */
  async getProductList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/product/list${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Query Products
   */
  async queryProducts(params = {}) {
    return this.makeRequest('/api2.0/v1/product/query', 'POST', params);
  }

  /**
   * Get Product Category
   */
  async getProductCategory() {
    return this.makeRequest('/api2.0/v1/product/getCategory');
  }

  /**
   * Get Product Comments
   */
  async getProductComments(productId) {
    return this.makeRequest(`/api2.0/v1/product/productComments?productId=${productId}`);
  }

  /**
   * Add Product Comments
   */
  async addProductComments(data) {
    return this.makeRequest('/api2.0/v1/product/comments', 'POST', data);
  }

  /**
   * Query Product by VID (Variant ID)
   */
  async queryProductByVid(vid) {
    return this.makeRequest(`/api2.0/v1/product/variant/queryByVid?vid=${vid}`);
  }

  /**
   * Query Product Variant
   */
  async queryProductVariant(productId) {
    // CJ erwartet "pid", nicht "productId". Mit dem falschen Namen antwortete
    // die Schnittstelle mit "pid or productSku must be not empty" — der Aufruf
    // lief also immer in den Notbetrieb, auch bei gueltigem Zugang. Am
    // 01.08. gegen die echte Schnittstelle geprueft.
    return this.makeRequest(`/api2.0/v1/product/variant/query?pid=${encodeURIComponent(productId)}`);
  }

  /**
   * Get Product Stock by VID
   */
  async getProductStockByVid(vid) {
    return this.makeRequest(`/api2.0/v1/product/stock/queryByVid?vid=${vid}`);
  }

  // ==========================================
  // PRODUCT SOURCING APIs
  // ==========================================

  /**
   * Query Product Sourcing
   */
  async queryProductSourcing(params = {}) {
    return this.makeRequest('/api2.0/v1/product/sourcing/query', 'POST', params);
  }

  /**
   * Create Product Sourcing
   */
  async createProductSourcing(data) {
    return this.makeRequest('/api2.0/v1/product/sourcing/create', 'POST', data);
  }

  // ==========================================
  // SHOPPING CART & ORDER APIs
  // ==========================================

  /**
   * Get Shopping Order List
   */
  async getShoppingOrderList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/shopping/order/list${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Create Order V2
   */
  async createOrderV2(orderData) {
    return this.makeRequest('/api2.0/v1/shopping/order/createOrderV2', 'POST', orderData);
  }

  /**
   * Confirm Order
   */
  async confirmOrder(orderId) {
    return this.makeRequest('/api2.0/v1/shopping/order/confirmOrder', 'POST', { orderId });
  }

  /**
   * Delete Order
   */
  async deleteOrder(orderId) {
    return this.makeRequest('/api2.0/v1/shopping/order/deleteOrder', 'POST', { orderId });
  }

  /**
   * Get Order Detail
   */
  async getOrderDetail(orderId) {
    return this.makeRequest(`/api2.0/v1/shopping/order/getOrderDetail?orderId=${orderId}`);
  }

  // ==========================================
  // PAYMENT APIs
  // ==========================================

  /**
   * Pay Balance
   */
  async payBalance(data) {
    return this.makeRequest('/api2.0/v1/shopping/pay/payBalance', 'POST', data);
  }

  /**
   * Get Balance
   */
  async getBalance() {
    return this.makeRequest('/api2.0/v1/shopping/pay/getBalance');
  }

  // ==========================================
  // LOGISTICS APIs
  // ==========================================

  /**
   * Get Track Info
   */
  async getTrackInfo(trackingNumber) {
    return this.makeRequest(`/api2.0/v1/logistic/getTrackInfo?trackingNumber=${trackingNumber}`);
  }

  /**
   * Track Info
   */
  async trackInfo(trackingNumber) {
    return this.makeRequest(`/api2.0/v1/logistic/trackInfo?trackingNumber=${trackingNumber}`);
  }

  /**
   * Freight Calculate
   */
  async freightCalculate(data) {
    return this.makeRequest('/api2.0/v1/logistic/freightCalculate', 'POST', data);
  }

  /**
   * Freight Calculate Tip
   */
  async freightCalculateTip(data) {
    return this.makeRequest('/api2.0/v1/logistic/freightCalculateTip', 'POST', data);
  }

  // ==========================================
  // DISPUTES APIs
  // ==========================================

  /**
   * Get Dispute List
   */
  async getDisputeList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/disputes/getDisputeList${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Create Dispute
   */
  async createDispute(data) {
    return this.makeRequest('/api2.0/v1/disputes/create', 'POST', data);
  }

  /**
   * Cancel Dispute
   */
  async cancelDispute(disputeId) {
    return this.makeRequest('/api2.0/v1/disputes/cancel', 'POST', { disputeId });
  }

  /**
   * Dispute Products
   */
  async disputeProducts(params = {}) {
    return this.makeRequest('/api2.0/v1/disputes/disputeProducts', 'POST', params);
  }

  /**
   * Dispute Confirm Info
   */
  async disputeConfirmInfo(disputeId) {
    return this.makeRequest(`/api2.0/v1/disputes/disputeConfirmInfo?disputeId=${disputeId}`);
  }

  // ==========================================
  // RETURNS APIs
  // ==========================================

  /**
   * Create Return Request
   */
  async createReturn(data) {
    console.log('📦 Erstelle CJ-Retoure...');
    return this.makeRequest('/api2.0/v1/returns/create', 'POST', data);
  }

  /**
   * Get Return List
   */
  async getReturnList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/returns/list${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Get Return Details
   */
  async getReturnDetails(returnId) {
    return this.makeRequest(`/api2.0/v1/returns/details?returnId=${returnId}`);
  }

  /**
   * Cancel Return
   */
  async cancelReturn(returnId) {
    return this.makeRequest('/api2.0/v1/returns/cancel', 'POST', { returnId });
  }

  // ==========================================
  // SETTINGS APIs
  // ==========================================

  /**
   * Get Settings
   */
  async getSettings() {
    return this.makeRequest('/api2.0/v1/setting/get');
  }

  // ==========================================
  // WAREHOUSE APIs
  // ==========================================

  /**
   * Get Warehouse List
   */
  async getWarehouseList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/warehouse/list${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Query Warehouse Stock
   */
  async queryWarehouseStock(data) {
    return this.makeRequest('/api2.0/v1/warehouse/stock/query', 'POST', data);
  }

  /**
   * Get Stock Alert
   */
  async getStockAlert(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/warehouse/stock/alert${queryString ? '?' + queryString : ''}`);
  }

  // ==========================================
  // STORE AUTHORIZATION APIs
  // ==========================================

  /**
   * Get Store List
   */
  async getStoreList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/store/list${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Authorize Store
   */
  async authorizeStore(data) {
    return this.makeRequest('/api2.0/v1/store/authorize', 'POST', data);
  }

  /**
   * Get Store Authorization Status
   */
  async getStoreAuthStatus(storeId) {
    return this.makeRequest(`/api2.0/v1/store/authStatus?storeId=${storeId}`);
  }

  // ==========================================
  // ANALYTICS APIs
  // ==========================================

  /**
   * Get Sales Report
   */
  async getSalesReport(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/analytics/sales/report${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Get Product Performance
   */
  async getProductPerformance(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/api2.0/v1/analytics/product/performance${queryString ? '?' + queryString : ''}`);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Test API Connection
   */
  async testConnection() {
    try {
      const result = await this.getSettings();
      console.log('CJ API Connection successful!');
      return { success: true, data: result };
    } catch (error) {
      console.error('CJ API Connection failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all available methods
   */
  getAvailableMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function');
    
    return {
      authentication: [
        'getAccessToken',
        'refreshAccessToken', 
        'logout'
      ],
      products: [
        'getProductList',
        'queryProducts',
        'getProductCategory',
        'getProductComments',
        'addProductComments',
        'queryProductByVid',
        'queryProductVariant',
        'getProductStockByVid'
      ],
      productSourcing: [
        'queryProductSourcing',
        'createProductSourcing'
      ],
      shopping: [
        'getShoppingOrderList',
        'createOrderV2',
        'confirmOrder',
        'deleteOrder',
        'getOrderDetail'
      ],
      payment: [
        'payBalance',
        'getBalance'
      ],
      logistics: [
        'getTrackInfo',
        'trackInfo',
        'freightCalculate',
        'freightCalculateTip'
      ],
      disputes: [
        'getDisputeList',
        'createDispute',
        'cancelDispute',
        'disputeProducts',
        'disputeConfirmInfo'
      ],
      returns: [
        'createReturn',
        'getReturnList',
        'getReturnDetails',
        'cancelReturn'
      ],
      settings: [
        'getSettings'
      ],
      warehouse: [
        'getWarehouseList',
        'queryWarehouseStock',
        'getStockAlert'
      ],
      storeAuthorization: [
        'getStoreList',
        'authorizeStore',
        'getStoreAuthStatus'
      ],
      analytics: [
        'getSalesReport',
        'getProductPerformance'
      ],
      utilities: [
        'testConnection',
        'getAvailableMethods',
        'batchRequest'
      ]
    };
  }

  /**
   * Batch request handler
   */
  async batchRequest(requests) {
    const promises = requests.map(request => 
      this.makeRequest(request.endpoint, request.method, request.data)
    );
    
    try {
      const results = await Promise.allSettled(promises);
      return results.map((result, index) => ({
        request: requests[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));
    } catch (error) {
      console.error('Batch request error:', error);
      throw error;
    }
  }
}

// Export the class and create a default instance
module.exports = CJDropshippingAPI;

// Example usage and initialization
if (require.main === module) {
  // This code runs only when the file is executed directly
  const cjAPI = new CJDropshippingAPI();
  
  // Test the connection
  cjAPI.testConnection().then(result => {
    if (result.success) {
      console.log('✅ CJ Dropshipping API ready to use!');
      console.log('Available method categories:', Object.keys(cjAPI.getAvailableMethods()));
    } else {
      console.log('❌ CJ API setup needs configuration');
      console.log('Please set the following environment variables:');
      console.log('- CJ_API_KEY');
      console.log('- CJ_ACCESS_TOKEN');
      console.log('- CJ_EMAIL (for authentication)');
      console.log('- CJ_PASSWORD (for authentication)');
    }
  });
}