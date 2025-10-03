/**
 * CJ Dropshipping Farbauswahl-Integration
 * Überträgt ausgewählte Farben/SKUs an CJ Dropshipping API
 */

(function() {
    console.log('🎨 CJ Dropshipping Farbauswahl-Integration wird geladen...');

    // Globale Variable für CJ Integration
    window.CJColorIntegration = {
        selectedProducts: new Map(),
        
        // Speichere ausgewählte Farbe für Produkt
        setProductColor: function(productId, colorData) {
            this.selectedProducts.set(productId, {
                productId: productId,
                selectedSKU: colorData.sku,
                selectedColor: colorData.name,
                selectedColorCode: colorData.code,
                price: colorData.price,
                originalPrice: colorData.originalPrice,
                timestamp: Date.now()
            });
            
            console.log(`🎨 CJ Integration: Produkt ${productId} Farbe gesetzt:`, colorData.name, `(SKU: ${colorData.sku})`);
            
            // Trigger CJ API Update (falls verfügbar)
            this.updateCJSelection(productId, colorData);
        },
        
        // Hole ausgewählte Farbe für Produkt
        getProductColor: function(productId) {
            return this.selectedProducts.get(productId);
        },
        
        // Alle ausgewählten Produkte
        getAllSelectedProducts: function() {
            return Array.from(this.selectedProducts.values());
        },
        
        // Update CJ Dropshipping Selection
        updateCJSelection: async function(productId, colorData) {
            try {
                // Prüfe ob CJ API verfügbar ist
                if (typeof window.CJDropshippingAPI === 'undefined') {
                    console.log('📦 CJ API nicht verfügbar - Farbe wird lokal gespeichert');
                    return;
                }
                
                // Erstelle CJ API Request für Produktvariation
                const cjData = {
                    productId: productId,
                    selectedVariation: {
                        sku: colorData.sku,
                        color: colorData.name,
                        colorCode: colorData.code,
                        price: colorData.price
                    },
                    timestamp: Date.now()
                };
                
                // Simuliere CJ API Call (wird später durch echte API ersetzt)
                console.log('📦 CJ API Update (simuliert):', cjData);
                
                // Hier würde der echte CJ API Call stehen:
                // await window.CJDropshippingAPI.updateProductVariation(cjData);
                
            } catch (error) {
                console.error('❌ CJ API Update Fehler:', error);
            }
        },
        
        // Erstelle CJ Order mit ausgewählten Farben
        createCJOrderWithColors: function(cartItems) {
            const orderItems = cartItems.map(item => {
                const colorData = this.getProductColor(item.id);
                
                return {
                    productId: item.id,
                    productName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    // CJ Spezifische Felder
                    sku: colorData ? colorData.selectedSKU : item.sku,
                    selectedColor: colorData ? colorData.selectedColor : null,
                    selectedColorCode: colorData ? colorData.selectedColorCode : null,
                    variation: colorData ? {
                        color: colorData.selectedColor,
                        sku: colorData.selectedSKU
                    } : null
                };
            });
            
            console.log('📦 CJ Order mit Farbauswahl erstellt:', orderItems);
            return orderItems;
        }
    };

    // Erweitere bestehende Farbauswahl-Funktionen
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            enhanceColorSelectionWithCJ();
        }, 1000);
    });

    function enhanceColorSelectionWithCJ() {
        // Erweitere globale selectColor10 Funktion (für Produkt-10)
        if (typeof window.selectColor10 === 'function' && !window.selectColor10._cjEnhanced) {
            const originalSelectColor10 = window.selectColor10;
            
            window.selectColor10 = function(name, code, sku, price, originalPrice) {
                // Rufe ursprüngliche Funktion auf
                originalSelectColor10(name, code, sku, price, originalPrice);
                
                // CJ Integration
                window.CJColorIntegration.setProductColor(10, {
                    name, code, sku, price, originalPrice
                });
            };
            
            window.selectColor10._cjEnhanced = true;
            console.log('✅ Produkt-10 CJ Integration aktiviert');
        }

        // Erweitere ColorSelection Klasse (für andere Produkte)
        if (typeof window.ColorSelection !== 'undefined') {
            // Überschreibe selectColor Methode
            const originalSelectColor = window.ColorSelection.prototype.selectColor;
            
            if (originalSelectColor && !originalSelectColor._cjEnhanced) {
                window.ColorSelection.prototype.selectColor = function(color) {
                    // Rufe ursprüngliche Methode auf
                    originalSelectColor.call(this, color);
                    
                    // CJ Integration
                    if (this.productId) {
                        window.CJColorIntegration.setProductColor(this.productId, color);
                    }
                };
                
                originalSelectColor._cjEnhanced = true;
                console.log('✅ ColorSelection CJ Integration aktiviert');
            }
        }

        // Erweitere Bundle-Farbauswahl
        if (typeof window.selectBundleColor === 'function' && !window.selectBundleColor._cjEnhanced) {
            const originalSelectBundleColor = window.selectBundleColor;
            
            window.selectBundleColor = function(bundleIndex, setIndex, name, code, sku, price) {
                // Rufe ursprüngliche Funktion auf
                originalSelectBundleColor(bundleIndex, setIndex, name, code, sku, price);
                
                // CJ Integration für Bundle
                const productId = extractProductIdFromUrl();
                if (productId) {
                    const bundleKey = `${productId}_bundle_${bundleIndex}_set_${setIndex}`;
                    window.CJColorIntegration.setProductColor(bundleKey, {
                        name, code, sku, price: price || 0, originalPrice: price || 0
                    });
                }
            };
            
            window.selectBundleColor._cjEnhanced = true;
            console.log('✅ Bundle CJ Integration aktiviert');
        }
    }

    // Erweitere addToCart für CJ Integration
    function enhanceAddToCartWithCJ() {
        if (typeof window.addToCart === 'function' && !window.addToCart._cjColorEnhanced) {
            const originalAddToCart = window.addToCart;
            
            window.addToCart = function(product) {
                // Hole CJ Farbdaten
                const colorData = window.CJColorIntegration.getProductColor(product.id);
                
                if (colorData) {
                    // Erweitere Produkt um CJ-spezifische Daten
                    const enhancedProduct = {
                        ...product,
                        cjSKU: colorData.selectedSKU,
                        cjColor: colorData.selectedColor,
                        cjColorCode: colorData.selectedColorCode,
                        cjVariation: {
                            color: colorData.selectedColor,
                            sku: colorData.selectedSKU
                        }
                    };
                    
                    console.log('📦 Produkt mit CJ Farbdaten zum Warenkorb:', enhancedProduct.cjColor);
                    return originalAddToCart(enhancedProduct);
                } else {
                    return originalAddToCart(product);
                }
            };
            
            window.addToCart._cjColorEnhanced = true;
        }
    }

    // Hilfsfunktionen
    function extractProductIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/produkt-(\d+)\.html/);
        return match ? parseInt(match[1]) : null;
    }

    // Initialisierung
    setTimeout(() => {
        enhanceAddToCartWithCJ();
    }, 1500);

    // Debug-Funktionen für Entwicklung
    window.CJColorIntegration.debug = {
        showAllSelections: function() {
            console.table(window.CJColorIntegration.getAllSelectedProducts());
        },
        
        clearAllSelections: function() {
            window.CJColorIntegration.selectedProducts.clear();
            console.log('🧹 Alle CJ Farbauswahlen gelöscht');
        },
        
        simulateCJOrder: function() {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            const cjOrder = window.CJColorIntegration.createCJOrderWithColors(cart);
            console.log('📦 CJ Order Simulation:', cjOrder);
            return cjOrder;
        }
    };

    console.log('✅ CJ Dropshipping Farbauswahl-Integration geladen');
    console.log('🔧 Debug-Befehle: CJColorIntegration.debug.showAllSelections()');
})();
