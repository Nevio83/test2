// Debug-Skript für Cart-Bilder
// Dieses Skript hilft dabei, die Bildpfade in cart.html zu debuggen

(function() {
    console.log('=== CART IMAGE DEBUG STARTED ===');
    
    // Warte bis die Seite geladen ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', debugCartImages);
    } else {
        debugCartImages();
    }
    
    function debugCartImages() {
        console.log('Debugging cart images...');
        
        // Prüfe alle Bilder in Add-ons und "Das könnte Ihnen gefallen"
        setTimeout(() => {
            // Finde alle addon-card-img Bilder
            const addonImages = document.querySelectorAll('.addon-card-img');
            console.log(`Found ${addonImages.length} addon images`);
            
            addonImages.forEach((img, index) => {
                console.log(`Image ${index + 1}:`, {
                    src: img.src,
                    alt: img.alt,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    complete: img.complete,
                    currentSrc: img.currentSrc
                });
                
                // Prüfe ob das Bild geladen wurde
                if (img.naturalWidth === 0) {
                    console.warn(`⚠️ Image ${index + 1} failed to load:`, img.src);
                    console.log('Expected path should be like: "produkt bilder/COBLED Arbeitsleuchte.jpeg"');
                }
            });
            
            // Prüfe localStorage für Produkte
            const allProducts = JSON.parse(localStorage.getItem('allProducts') || '[]');
            console.log('Sample products from localStorage:');
            allProducts.slice(0, 5).forEach(p => {
                console.log(`- ${p.name}: "${p.image}"`);
            });
            
            // Prüfe speziell nach COBLED Arbeitsleuchte
            const cobled = allProducts.find(p => p.name.includes('COBLED'));
            if (cobled) {
                console.log('COBLED Arbeitsleuchte found:', {
                    name: cobled.name,
                    image: cobled.image,
                    id: cobled.id
                });
            }
            
        }, 1000); // Warte 1 Sekunde damit die Seite Zeit hat zu laden
    }
})();
