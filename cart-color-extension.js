/**
 * Warenkorb-Erweiterung für Farbauswahl
 * Erweitert die bestehende cart.js um Farbfunktionalität
 */

// Überschreibe die addToCart Funktion um Farbinformationen zu speichern
(function() {
    // Warte bis die ursprüngliche addToCart Funktion verfügbar ist
    function enhanceCartWithColors() {
        if (typeof window.addToCart !== 'function') {
            setTimeout(enhanceCartWithColors, 100);
            return;
        }

        // Prüfe ob bereits erweitert
        if (window.addToCart._cartColorEnhanced) {
            return;
        }

        const originalAddToCart = window.addToCart;
        
        window.addToCart = function(product) {
            // Erweitere Produkt um Farbinformationen falls vorhanden
            if (product.selectedColor) {
                // Ändere den Namen um Farbe in Klammern hinzuzufügen
                const originalName = product.name;
                product.name = `${originalName} (${product.selectedColor})`;
                
                console.log('🎨 Produkt mit Farbe zum Warenkorb hinzugefügt:', product.name);
            }
            
            return originalAddToCart(product);
        };
        
        window.addToCart._cartColorEnhanced = true;
        console.log('✅ Warenkorb-Farbauswahl-Erweiterung aktiviert');
    }

    // Starte die Erweiterung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceCartWithColors);
    } else {
        enhanceCartWithColors();
    }
})();

// Erweitere auch die Schnellbestellung-Funktionen
function enhanceQuickOrderWithColors() {
    // Überschreibe updateTotalPrice um Farbpreise zu berücksichtigen
    const originalUpdateTotalPrice = window.updateTotalPrice;
    
    if (originalUpdateTotalPrice) {
        window.updateTotalPrice = function() {
            // Prüfe ob eine Farbe ausgewählt ist
            const selectedColor = window.getSelectedColor ? window.getSelectedColor() : null;
            
            if (selectedColor && selectedColor.price && window.product) {
                // Temporär den Produktpreis überschreiben
                const originalPrice = window.product.price;
                window.product.price = selectedColor.price;
                
                // Rufe die ursprüngliche Funktion auf
                const result = originalUpdateTotalPrice();
                
                // Stelle den ursprünglichen Preis wieder her
                window.product.price = originalPrice;
                
                return result;
            } else {
                return originalUpdateTotalPrice();
            }
        };
    }
}

// Erweitere addToCartWithQuantity für Farbunterstützung
function enhanceAddToCartWithQuantity() {
    const originalAddToCartWithQuantity = window.addToCartWithQuantity;
    
    if (originalAddToCartWithQuantity) {
        window.addToCartWithQuantity = function(event) {
            // Hole die ausgewählte Farbe
            const selectedColor = window.getSelectedColor ? window.getSelectedColor() : null;
            
            if (selectedColor && window.product) {
                // Erweitere das Produkt um Farbinformationen
                window.product.selectedColor = selectedColor.name;
                window.product.selectedColorCode = selectedColor.code;
                window.product.selectedColorSku = selectedColor.sku;
                window.product.price = selectedColor.price || window.product.price;
            }
            
            return originalAddToCartWithQuantity(event);
        };
    }
}

// Initialisiere die Erweiterungen
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        enhanceQuickOrderWithColors();
        enhanceAddToCartWithQuantity();
    }, 200);
});
