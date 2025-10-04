// Default Color Handler - Wählt automatisch die erste Farbe für Produkte von index.html
console.log('🎨 Default Color Handler geladen');

// Original addProductToCart speichern
const originalAddProductToCart = window.addProductToCart;

// Liste der Produkt-IDs die Farben haben (aus products.json)
const productsWithColors = [10, 11, 12, 17, 21, 26, 30];

// Überschreibe addProductToCart
window.addProductToCart = function(productsParam, productId, fromCartDropdown = false) {
    console.log('🎨 Default Color Handler: Intercepting addProductToCart');
    
    // Prüfe ob wir auf index.html sind (nicht auf einer Produktseite)
    const isIndexPage = !window.location.pathname.includes('produkt-');
    const numericProductId = Number(productId);
    
    // Nur für index.html UND nur für Produkte die tatsächlich Farben haben
    if (isIndexPage && productsWithColors.includes(numericProductId)) {
        // Lade Produkt um zu prüfen ob es Farben hat
        const availableProducts = productsParam && productsParam.length > 0 ? productsParam : 
                                 (window.products || JSON.parse(localStorage.getItem('allProducts') || '[]'));
        
        const product = availableProducts.find(p => Number(p.id) === numericProductId);
        
        if (product && product.colors && product.colors.length > 0) {
            // Setze die erste Farbe als Standard in window.product
            const defaultColor = product.colors[0];
            
            // Simuliere eine Farbauswahl
            window.product = {
                id: product.id,
                selectedColor: defaultColor.name,
                selectedColorCode: defaultColor.code || '#000000',
                selectedColorSku: defaultColor.sku || 'default',
                price: defaultColor.price || product.price,
                originalPrice: defaultColor.originalPrice || product.originalPrice
            };
            
            console.log(`🎨 Standard-Farbe gesetzt für Produkt ${product.name}: ${defaultColor.name}`);
        }
    } else if (isIndexPage) {
        // Für Produkte ohne Farben: Stelle sicher, dass keine Farbe gesetzt ist
        window.product = null;
        console.log(`📦 Produkt ${productId} hat keine Farben - keine Standardfarbe gesetzt`);
    }
    
    // Rufe die originale Funktion auf
    return originalAddProductToCart.apply(this, arguments);
};

console.log('✅ Default Color Handler initialisiert');
