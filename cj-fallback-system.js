/**
 * CJ Dropshipping Fallback System
 * Provides mock data and fallback functionality when CJ API is unavailable
 */

require('dotenv').config();

class CJFallbackSystem {
    constructor() {
        this.mockProducts = {
            '1621032671155597312': {
                id: '1621032671155597312',
                sku: 'CJHS1674158',
                nameDE: 'Elektrischer Wasserspender für Schreibtisch',
                nameEN: 'Desk Dispenser Electric Water Gallon Automatic Water Bottle Dispenser Rechargeable',
                price: 45.99,
                originalPrice: 65.99,
                description: 'Praktischer elektrischer Wasserspender für den Schreibtisch. Automatisches Pumpen, wiederaufladbar, perfekt für Büro und Zuhause.',
                features: [
                    'Automatisches Pumpen',
                    'Wiederaufladbar (USB)',
                    'Passt auf Standard-Wasserflaschen',
                    'Leise Bedienung',
                    'Einfache Installation'
                ],
                specifications: {
                    'Material': 'ABS Kunststoff',
                    'Akkulaufzeit': '30-40 Tage',
                    'Ladezeit': '3-4 Stunden',
                    'Flaschengrößen': '5-19 Liter',
                    'Abmessungen': '15 x 10 x 25 cm'
                },
                images: ['../produkt bilder/ware.png'],
                inStock: true,
                supplier: 'CJ Dropshipping',
                shippingTime: '7-15 Werktage'
            },
            '1392009095543918592': {
                id: '1392009095543918592',
                sku: 'CJHS1392009',
                nameDE: '350ml Elektrischer Mixer USB Wiederaufladbar',
                nameEN: '350ml Electric Juicer Blender Mixer USB Rechargeable Machine Household Portable',
                price: 29.99,
                originalPrice: 39.99,
                description: 'Kompakter elektrischer Mixer mit 350ml Fassungsvermögen. USB-wiederaufladbar, perfekt für Smoothies und Säfte unterwegs.',
                features: [
                    '350ml Fassungsvermögen',
                    'USB-wiederaufladbar',
                    'Tragbar und kompakt',
                    'Einfache Reinigung',
                    'Sicherheitsverschluss'
                ],
                specifications: {
                    'Kapazität': '350ml',
                    'Leistung': '45W',
                    'Ladezeit': '2-3 Stunden',
                    'Betriebszeit': '15-20 Zyklen',
                    'Material': 'BPA-freier Kunststoff'
                },
                images: ['../produkt bilder/ware.png'],
                inStock: true,
                supplier: 'CJ Dropshipping',
                shippingTime: '7-15 Werktage'
            }
        };
    }

    /**
     * Get product by ID with fallback data
     */
    async getProduct(productId) {
        console.log(`🔄 Using fallback data for product: ${productId}`);
        
        if (this.mockProducts[productId]) {
            return {
                success: true,
                data: this.mockProducts[productId],
                source: 'fallback'
            };
        }
        
        return {
            success: false,
            error: 'Product not found in fallback data',
            source: 'fallback'
        };
    }

    /**
     * Query products with fallback data
     */
    async queryProducts(params = {}) {
        console.log('🔄 Using fallback product list');
        
        const products = Object.values(this.mockProducts);
        
        return {
            success: true,
            data: {
                list: products,
                total: products.length,
                pageNum: params.pageNum || 1,
                pageSize: params.pageSize || 10
            },
            source: 'fallback'
        };
    }

    /**
     * Create order with fallback (simulation)
     */
    async createOrder(orderData) {
        console.log('🔄 Simulating order creation (fallback mode)');
        
        return {
            success: true,
            data: {
                orderId: `MOCK_${Date.now()}`,
                status: 'pending',
                message: 'Order created in simulation mode - CJ API unavailable',
                trackingNumber: null
            },
            source: 'fallback'
        };
    }

    /**
     * Get shipping cost calculation (mock)
     */
    async calculateShipping(params) {
        console.log('🔄 Using fallback shipping calculation');
        
        return {
            success: true,
            data: {
                cost: 0, // Free shipping
                currency: 'EUR',
                estimatedDays: '7-15',
                method: 'Standard Shipping'
            },
            source: 'fallback'
        };
    }

    /**
     * Check if API is available
     */
    async checkAPIStatus() {
        return {
            available: false,
            reason: 'CJ Dropshipping API is currently under improvement',
            fallbackActive: true,
            lastChecked: new Date().toISOString()
        };
    }
}

module.exports = CJFallbackSystem;
