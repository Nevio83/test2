// Fix Bundle Naming - Stellt sicher, dass alle Bundles die Sets-Angabe haben
console.log('🔧 Fix Bundle Naming geladen');

// Speichere die originale addBundleToCart Funktion (falls vorhanden)
const originalAddBundleToCart = window.addBundleToCart;

// Überschreibe addBundleToCart global
window.addBundleToCart = function(bundle) {
    console.log('🎁 Fix Bundle Naming: Intercepting addBundleToCart', bundle);
    
    // Extrahiere die Anzahl der Sets aus dem Bundle
    let qty = 1;
    
    // Versuche qty aus bundleId zu extrahieren
    if (bundle.bundleId) {
        const qtyMatch = bundle.bundleId.match(/qty(\d+)/);
        if (qtyMatch) {
            qty = parseInt(qtyMatch[1]);
        }
    }
    
    // Oder aus quantity
    if (bundle.quantity) {
        qty = bundle.quantity;
    }
    
    // Oder aus dem Namen (z.B. "2 Sets")
    const nameMatch = bundle.name && bundle.name.match(/(\d+)\s+Sets?/);
    if (nameMatch) {
        qty = parseInt(nameMatch[1]);
    }
    
    // Stelle sicher, dass der Name die Sets-Angabe hat
    let fixedName = bundle.name || '';
    
    // Prüfe ob bereits eine Sets-Angabe vorhanden ist
    const hasSetInfo = /\(\d+\s+Sets?\)/i.test(fixedName);
    
    // Füge Sets-Angabe hinzu wenn nicht vorhanden
    if (!hasSetInfo) {
        // Entferne alte Formate wie "(2 Sets kaufen)"
        fixedName = fixedName.replace(/\s*\(\d+\s+Sets?\s+kaufen\)/gi, '');
        fixedName = fixedName.replace(/\s*\(\d+\s+Sets?\)/gi, '');
        
        // Füge korrekte Sets-Angabe hinzu
        fixedName = fixedName.trim() + ` (${qty} Set${qty > 1 ? 's' : ''})`;
    }
    
    // Update bundle object
    bundle.name = fixedName;
    
    // Rufe die originale Funktion auf oder füge direkt zum Warenkorb hinzu
    if (originalAddBundleToCart && typeof originalAddBundleToCart === 'function') {
        return originalAddBundleToCart.call(this, bundle);
    } else {
        // Fallback: Füge direkt zum Warenkorb hinzu
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const bundleId = bundle.bundleId;
        const existing = cart.find(item => item.bundleId === bundleId);
        
        if (existing) {
            existing.quantity++;
        } else {
            cart.push({
                ...bundle,
                quantity: 1,
                isBundle: true
            });
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Zeige Erfolgs-Nachricht
        if (typeof showAlert === 'function') {
            showAlert('Bundle zum Warenkorb hinzugefügt', 'cart.html');
        } else if (typeof showNotification === 'function') {
            showNotification('Bundle zum Warenkorb hinzugefügt');
        }
    }
};

console.log('✅ Fix Bundle Naming initialisiert');
