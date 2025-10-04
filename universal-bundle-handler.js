// Universal Bundle Handler - Funktioniert für alle Produkte (mit und ohne Farben)
console.log('📦 Universal Bundle Handler geladen');

// Überschreibe die globale addBundleToCart Funktion
window.addBundleToCart = function(bundle) {
    console.log('🎁 Universal Bundle Handler: addBundleToCart', bundle);
    
    // Extrahiere Produkt-ID und Menge aus bundleId
    const matches = bundle.bundleId.match(/(\d+)-qty(\d+)/);
    if (!matches) {
        console.error('Invalid bundleId format:', bundle.bundleId);
        return;
    }
    
    const productId = parseInt(matches[1]);
    const qty = parseInt(matches[2]);
    
    // Lade Produktdaten
    fetch('../products.json')
        .then(res => res.json())
        .then(products => {
            const product = products.find(p => p.id === productId);
            if (!product) {
                console.error('Product not found:', productId);
                return;
            }
            
            // Prüfe ob Produkt Farben hat
            const hasColors = product.colors && product.colors.length > 0;
            
            // Hole Farbauswahl wenn vorhanden
            let bundleName = product.name;
            let totalPrice = bundle.price; // Verwende den übergebenen Preis
            
            // Füge Sets-Angabe hinzu
            bundleName += ` (${qty} Set${qty > 1 ? 's' : ''})`;
            
            if (hasColors) {
                // Hole gewählte Farben aus localStorage
                const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
                const bundleId = `bundle-${productId}-qty${qty}`;
                const selections = bundleSelections[bundleId] || {};
                
                const allColors = [];
                for (let j = 0; j < qty; j++) {
                    const colorSelection = selections[j] || product.colors[0];
                    if (colorSelection) {
                        allColors.push(colorSelection.name);
                    }
                }
                
                // Füge Farben zum Namen hinzu
                if (allColors.length > 0) {
                    const uniqueColors = [...new Set(allColors)];
                    uniqueColors.forEach(color => {
                        bundleName += ` (${color})`;
                    });
                }
            }
            
            // Erstelle Warenkorb-Item
            const cartItem = {
                id: productId,
                name: bundleName,
                price: totalPrice,
                originalPrice: bundle.originalPrice || totalPrice,
                image: product.image,
                quantity: 1,
                bundleId: bundle.bundleId,
                bundleQuantity: qty,
                isBundle: true
            };
            
            // Füge zum Warenkorb hinzu
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            
            // Prüfe ob Bundle bereits existiert
            const existingIndex = cart.findIndex(item => 
                item.bundleId === bundle.bundleId &&
                item.name === bundleName
            );
            
            if (existingIndex >= 0) {
                cart[existingIndex].quantity++;
            } else {
                cart.push(cartItem);
            }
            
            localStorage.setItem('cart', JSON.stringify(cart));
            
            // Zeige Erfolgs-Nachricht
            if (typeof showAlert === 'function') {
                showAlert(`${qty} Set${qty>1?'s':''} zum Warenkorb hinzugefügt`, 'cart.html');
            } else if (typeof showNotification === 'function') {
                showNotification(`${qty} Set${qty>1?'s':''} zum Warenkorb hinzugefügt`);
            } else {
                alert(`${qty} Set${qty>1?'s':''} zum Warenkorb hinzugefügt`);
                window.location.href = '../cart.html';
            }
        })
        .catch(err => {
            console.error('Fehler beim Laden der Produkte:', err);
        });
};

console.log('✅ Universal Bundle Handler initialisiert');
