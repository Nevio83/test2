// Color Cart Bridge - Verbindet Farbauswahl mit Warenkorb
// Diese Datei stellt sicher, dass Farbinformationen korrekt übertragen werden

(function() {
    console.log('🌈 Color Cart Bridge geladen');
    
    // Warte bis app.js geladen ist
    function waitForAppJS() {
        if (window.addProductToCart && typeof window.addProductToCart === 'function') {
            console.log('✅ app.js gefunden, initialisiere Bridge');
            initializeBridge();
        } else {
            console.log('⏳ Warte auf app.js...');
            setTimeout(waitForAppJS, 100);
        }
    }
    
    function initializeBridge() {
        // Speichere die originale lokale addToCart Funktion
        const originalAddToCart = window.addToCart;
        
        // Überschreibe die lokale addToCart Funktion
        window.addToCart = function(product) {
            console.log('🔄 Color Cart Bridge: addToCart aufgerufen für:', product);
            
            // Hole die aktuelle Farbauswahl
            let selectedColorData = null;
            
            if (window.getSelectedColor && typeof window.getSelectedColor === 'function') {
                selectedColorData = window.getSelectedColor();
                console.log('🎨 Ausgewählte Farbe:', selectedColorData);
                
                if (selectedColorData && selectedColorData.name) {
                    // Erweitere das Produkt mit Farbinformationen
                    const coloredProduct = {
                        ...product,
                        // WICHTIG: Füge Farbe zum Namen hinzu für cart.js getCartItemImage
                        name: product.name.includes(`(${selectedColorData.name})`) 
                            ? product.name 
                            : `${product.name} (${selectedColorData.name})`,
                        selectedColor: selectedColorData.name,
                        selectedColorCode: selectedColorData.code || '#000000',
                        selectedColorSku: selectedColorData.sku || 'default',
                        price: selectedColorData.price || product.price,
                        // Eindeutige ID für verschiedene Farben
                        cartItemId: `${product.id}-${selectedColorData.name.replace(/\s+/g, '-').toLowerCase()}`
                    };
                    
                    // Setze auch in window.product für Kompatibilität
                    window.product = {
                        id: product.id,
                        selectedColor: selectedColorData.name,
                        selectedColorCode: selectedColorData.code || '#000000',
                        selectedColorSku: selectedColorData.sku || 'default',
                        price: selectedColorData.price || product.price
                    };
                    
                    console.log('📦 Produkt mit Farbe:', coloredProduct);
                    console.log('🎯 window.product gesetzt:', window.product);
                }
            }
            
            // Rufe die globale addProductToCart Funktion auf
            if (window.addProductToCart && typeof window.addProductToCart === 'function') {
                console.log('✅ Rufe globale addProductToCart auf mit ID:', product.id);
                // Wichtig: Übergebe ein leeres Array als products Parameter
                window.addProductToCart([], product.id);
            } else {
                console.error('❌ Globale addProductToCart nicht gefunden!');
                // Fallback zur originalen Funktion
                if (originalAddToCart) {
                    originalAddToCart(product);
                }
            }
        };
        
        console.log('✅ Color Cart Bridge aktiviert');
    }
    
    // Starte die Initialisierung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForAppJS);
    } else {
        waitForAppJS();
    }
})();
