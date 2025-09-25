// Fix für localStorage - Löscht die falschen Produktdaten und lädt sie neu

(function() {
    console.log('=== FIXING LOCALSTORAGE ===');
    
    // Lösche die alten, fehlerhaften Produkte aus dem localStorage
    localStorage.removeItem('allProducts');
    console.log('✅ Removed old products from localStorage');
    
    // Lade die Produkte neu von products.json
    fetch('products.json?v=' + Date.now())
        .then(response => response.json())
        .then(products => {
            console.log('✅ Loaded fresh products:', products.length);
            
            // Zeige die ersten 5 Produkte mit ihren korrekten Bildpfaden
            console.log('Sample products with correct images:');
            products.slice(0, 5).forEach(p => {
                console.log(`- ${p.name}: "${p.image}"`);
            });
            
            // Speichere die korrekten Produkte im localStorage
            localStorage.setItem('allProducts', JSON.stringify(products));
            console.log('✅ Saved correct products to localStorage');
            
            // Prüfe speziell COBLED Arbeitsleuchte
            const cobled = products.find(p => p.name.includes('COBLED'));
            if (cobled) {
                console.log('COBLED Arbeitsleuchte correct image:', cobled.image);
            }
            
            // Lade die Seite neu, um die korrekten Bilder anzuzeigen
            console.log('🔄 Reloading page in 2 seconds...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        })
        .catch(error => {
            console.error('Error loading products:', error);
        });
})();
