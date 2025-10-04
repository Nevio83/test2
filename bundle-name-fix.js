// Bundle Name Fix - Stellt sicher, dass Bundle-Namen mit Farben korrekt angezeigt werden
console.log('🔧 Bundle Name Fix geladen');

// Überwache Änderungen im Cart und korrigiere Bundle-Namen
function fixBundleNames() {
    const cartItems = document.querySelectorAll('.cart-item, .cart-product, [data-cart-item]');
    
    cartItems.forEach(item => {
        const nameElement = item.querySelector('.product-name, .cart-item-name, h5, h6');
        if (!nameElement) return;
        
        const currentName = nameElement.textContent.trim();
        
        // Prüfe ob es ein Bundle ist (enthält "Sets)")
        if (currentName.includes('Sets)')) {
            // Hole die Original-Daten aus localStorage
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            
            // Finde das passende Bundle im Cart
            const bundleItem = cart.find(cartItem => {
                // Prüfe ob es ein Bundle ist und der Basis-Name übereinstimmt
                if (cartItem.isBundle || cartItem.isBundleItem) {
                    // Extrahiere Basis-Namen (ohne Farben)
                    const baseName = cartItem.name.split('(')[0].trim();
                    const currentBaseName = currentName.split('(')[0].trim();
                    return baseName === currentBaseName;
                }
                return false;
            });
            
            if (bundleItem && bundleItem.name !== currentName) {
                console.log(`🔧 Korrigiere Bundle-Name von "${currentName}" zu "${bundleItem.name}"`);
                nameElement.textContent = bundleItem.name;
            }
        }
    });
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Bundle Name Fix initialisiert');
    
    // Initial fix
    setTimeout(fixBundleNames, 500);
    
    // Bei Cart-Updates
    document.addEventListener('cart-updated', fixBundleNames);
    window.addEventListener('cartUpdated', fixBundleNames);
    
    // Observer für dynamische Änderungen
    const observer = new MutationObserver(() => {
        setTimeout(fixBundleNames, 100);
    });
    
    const cartContent = document.getElementById('cartContent');
    if (cartContent) {
        observer.observe(cartContent, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    // Periodische Überprüfung als Fallback
    setInterval(fixBundleNames, 2000);
});

// Auch beim Laden ausführen falls DOM schon bereit
if (document.readyState !== 'loading') {
    setTimeout(fixBundleNames, 500);
}

console.log('✅ Bundle Name Fix bereit');
