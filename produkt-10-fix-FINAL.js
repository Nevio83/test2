/**
 * FINALE LÖSUNG für Produkt-10 Farbauswahl und Warenkorb-Integration
 * Dieses Script lädt als ERSTES und sichert die korrekte Funktionalität
 */

(function() {
    console.log('🔧 PRODUKT-10 FINALE FIX wird geladen...');
    
    // Globale Variable für Produkt-10 Zustand
    window.PRODUKT10_STATE = {
        selectedColor: null,
        selectedSKU: null,
        selectedPrice: null,
        originalPrice: null
    };
    
    // Setze Farbe für Produkt-10
    window.setProdukt10Color = function(name, code, sku, price, originalPrice) {
        window.PRODUKT10_STATE = {
            selectedColor: name,
            selectedColorCode: code,
            selectedSKU: sku,
            selectedPrice: price,
            originalPrice: originalPrice
        };
        
        console.log('🎨 Produkt-10 Farbe gesetzt:', name, 'Preis:', price, 'SKU:', sku);
        
        // Aktualisiere window.product
        if (window.product) {
            window.product.selectedColor = name;
            window.product.selectedColorCode = code;
            window.product.selectedColorSku = sku;
            window.product.price = price;
            window.product.originalPrice = originalPrice;
        }
    };
    
    // Überschreibe addToCart SOFORT
    let originalAddToCart = null;
    let attempts = 0;
    const maxAttempts = 50;
    
    function hijackAddToCart() {
        attempts++;
        
        if (typeof window.addToCart === 'function' && !window.addToCart._produkt10Hijacked) {
            originalAddToCart = window.addToCart;
            
            window.addToCart = function(product) {
                console.log('🛒 Produkt-10 addToCart aufgerufen');
                console.log('📦 Original Produkt:', product);
                console.log('🎨 Produkt-10 Zustand:', window.PRODUKT10_STATE);
                
                // Erweitere Produkt mit Farbdaten
                let enhancedProduct = {...product};
                
                if (window.PRODUKT10_STATE.selectedColor) {
                    // Entferne alte Farbe aus dem Namen
                    let cleanName = product.name.replace(/\s*\([^)]*\)$/, '');
                    
                    enhancedProduct = {
                        ...product,
                        name: `${cleanName} (${window.PRODUKT10_STATE.selectedColor})`,
                        selectedColor: window.PRODUKT10_STATE.selectedColor,
                        selectedColorCode: window.PRODUKT10_STATE.selectedColorCode,
                        selectedColorSku: window.PRODUKT10_STATE.selectedSKU,
                        price: window.PRODUKT10_STATE.selectedPrice,
                        originalPrice: window.PRODUKT10_STATE.originalPrice
                    };
                    
                    console.log('✅ Produkt-10 mit Farbe erweitert:', enhancedProduct.name, 'Preis:', enhancedProduct.price);
                }
                
                return originalAddToCart(enhancedProduct);
            };
            
            window.addToCart._produkt10Hijacked = true;
            console.log('✅ Produkt-10 addToCart erfolgreich überschrieben (Versuch', attempts, ')');
            return true;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(hijackAddToCart, 50);
        } else {
            console.warn('⚠️ Konnte addToCart nicht überschreiben nach', maxAttempts, 'Versuchen');
        }
    }
    
    // Starte Hijacking sofort
    hijackAddToCart();
    
    // Auch nach DOM-Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hijackAddToCart);
    }
    
    console.log('✅ Produkt-10 FINALE FIX geladen');
})();
