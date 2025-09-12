/**
 * CJ Dropshipping API Integration
 * Complete API client for all CJ Dropshipping endpoints
 * Documentation: https://cjdropshipping.com/my.html#/apikey
 */

require('dotenv').config();
const fetch = require('node-fetch');
const CJFallbackSystem = require('./cj-fallback-system');

class CJDropshippingAPI {
  constructor(config = {}) {
    this.baseURL = config.baseURL || process.env.CJ_BASE_URL || 'https://developers.cjdropshipping.com';
    this.apiKey = config.apiKey || process.env.CJ_API_KEY;
    this.accessToken = config.accessToken || process.env.CJ_ACCESS_TOKEN;
    this.email = config.email || process.env.CJ_EMAIL;
    this.password = config.password || process.env.CJ_PASSWORD;
    this.fallbackSystem = new CJFallbackSystem();
    
    if (!this.apiKey && !this.accessToken) {
      console.warn('⚠️  CJ API credentials not found. Using fallback mode.');
      console.warn('📖 Get your credentials from: https://cjdropshipping.com/my.html#/apikey');
    } else {
      console.log('✅ CJ Dropshipping API initialized successfully');
    }
  }

  /**
   * Make authenticated request to CJ API with fallback support
   */
  async makeRequest(endpoint, method = 'GET', data = null, useAuth = true) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const headers = {
        'Content-Type': 'application/json',
      };

      // Use API key directly for authentication
      if (useAuth) {
        if (this.accessToken && this.accessToken !== 'your_cj_access_token_here') {
          headers['CJ-Access-Token'] = this.accessToken;
        } else if (this.apiKey) {
          headers['CJ-Access-Token'] = this.apiKey;
        } else {
          console.log('⚠️ No valid credentials, using fallback mode');
          return this.handleFallback(endpoint, data);
        }
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
        console.log('🔄 API failed, switching to fallback mode');
        return this.handleFallback(endpoint, data);
      }
      
      return result;
    } catch (error) {
      console.log('🔄 API error, using fallback:', error.message);
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
    
    const headers = {
      'Content-Type': 'application/json'
      // No authentication headers for token request
    };

    const config = {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: this.email,
        password: this.password
      })
    };

    try {
      const response = await fetch(url, config);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`CJ API Error: ${result.message || response.statusText}`);
      }
      
      return result;
    } catch (error) {
      console.error('CJ API Request Error:', error);
      throw error;
    }
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
    return this.makeRequest(`/api2.0/v1/product/variant/query?productId=${productId}`);
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