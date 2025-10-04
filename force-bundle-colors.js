// Force Bundle Colors - Erzwingt Farbauswahl für Bundles bei Produkten 17 und 26

console.log('🔧 Force Bundle Colors geladen');

// Warte bis alles geladen ist und erzwinge dann die Farbauswahl
window.addEventListener('load', () => {
    setTimeout(() => {
        const urlPath = window.location.pathname;
        const match = urlPath.match(/produkt-(\d+)\.html/);
        
        if (match) {
            const productId = parseInt(match[1]);
            
            // Nur für Produkte 17 und 26
            if (productId === 17 || productId === 26) {
                console.log(`🔧 Forcing bundle colors for product ${productId}`);
                
                // Hole Bundle-Section
                const bundleSection = document.getElementById('bundle-section');
                
                if (bundleSection) {
                    // Prüfe ob bereits Bundles vorhanden sind
                    const existingBundles = bundleSection.querySelector('.bundle-box');
                    
                    if (!existingBundles || !bundleSection.querySelector('.bundle-color-selection')) {
                        console.log('🔧 No color bundles found, creating them...');
                        
                        // Lade Produktdaten
                        fetch('../products.json')
                            .then(res => res.json())
                            .then(products => {
                                const prod = products.find(p => p.id === productId);
                                
                                if (prod && prod.colors && prod.colors.length > 0) {
                                    console.log(`🔧 Found ${prod.colors.length} colors, rendering bundles...`);
                                    
                                    // Lösche existierenden Inhalt
                                    bundleSection.innerHTML = '';
                                    
                                    // Rendere Bundles mit Farben
                                    if (typeof renderBundlesWithColors === 'function') {
                                        renderBundlesWithColors(productId, prod.colors);
                                        console.log('✅ Bundle colors forced successfully!');
                                    } else {
                                        console.error('❌ renderBundlesWithColors not found!');
                                    }
                                }
                            })
                            .catch(err => console.error('Error forcing bundle colors:', err));
                    }
                }
            }
        }
    }, 3000); // Warte 3 Sekunden
});

console.log('✅ Force Bundle Colors initialisiert');
