// Cart Color Images - Zeigt farbspezifische Bilder im Warenkorb

(function() {
    console.log('🎨 Cart Color Images geladen');
    
    // Mapping der Produkte zu ihren farbspezifischen Bildern
    const colorImageMappings = {
        10: { // Elektrischer Wasserspender
            'Blau': 'produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Elektrischer Wasserspender für Schreibtisch schwarz.jpg',
            'Weiß': 'produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Elektrischer Wasserspender für Schreibtisch weiß.jpg',
            'default': 'produkt bilder/Elektrischer Wasserspender für Schreibtisch.jpg'
        },
        11: { // 350ml Elektrischer Mixer
            'Weiß': 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Weiß.jpg',
            'Pink': 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Rosa.png',
            'default': 'produkt bilder/350ml Elektrischer Mixer Entsafter.jpg'
        },
        17: { // Bluetooth Anti-Lost Finder
            'Schwarz': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen schwarz.png',
            'Weiß': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen weiß.png',
            'Grün': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen grün.png',
            'Pink': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen pink.png',
            'default': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen.jpg'
        },
        26: { // 4 In 1 Self Cleaning Hair Brush
            'Roland Purple': 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush roland purple.jpg',
            'Lunar Rock Gray': 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush lunar rock.jpg',
            'Lunar Rock': 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush lunar rock.jpg',
            'default': 'produkt bilder/4 In 1 Self Cleaning Hair Brush.jpg'
        }
    };
    
    // Funktion zum Extrahieren der Farbe aus dem Produktnamen
    function extractColorFromName(productName) {
        // Suche nach Farbe in Klammern am Ende des Namens
        const colorMatch = productName.match(/\(([^)]+)\)$/);
        if (colorMatch) {
            return colorMatch[1].trim();
        }
        return null;
    }
    
    // Funktion zum Aktualisieren der Produktbilder
    function updateCartProductImages() {
        console.log('🖼️ Aktualisiere Warenkorb-Bilder nach Farbe');
        
        // Finde alle Produktbilder im Warenkorb
        const cartItems = document.querySelectorAll('.cart-item, .cart-product, [data-cart-item]');
        
        cartItems.forEach(item => {
            const img = item.querySelector('img');
            if (!img) return;
            
            // Hole Produktname
            const nameElement = item.querySelector('.product-name, .cart-item-name, h5, h6');
            if (!nameElement) return;
            
            const fullName = nameElement.textContent.trim();
            
            // Überspringe Bundle-Produkte
            if (fullName.includes('Sets') || fullName.includes('Bundle')) {
                console.log('⏭️ Überspringe Bundle:', fullName);
                return;
            }
            
            // Extrahiere Farbe aus dem Namen
            const color = extractColorFromName(fullName);
            if (!color) {
                console.log('❌ Keine Farbe gefunden in:', fullName);
                return;
            }
            
            // Finde Produkt-ID
            let productId = null;
            
            // Versuche ID aus data-product-id zu holen
            productId = item.getAttribute('data-product-id');
            
            // Wenn nicht gefunden, versuche aus dem Namen zu ermitteln
            if (!productId) {
                for (const [id, mappings] of Object.entries(colorImageMappings)) {
                    // Prüfe ob der Produktname zum Mapping passt
                    if (fullName.includes('Wasserspender') && id === '10') productId = 10;
                    else if (fullName.includes('Mixer') && id === '11') productId = 11;
                    else if (fullName.includes('Bluetooth') && id === '17') productId = 17;
                    else if (fullName.includes('Hair Brush') && id === '26') productId = 26;
                }
            }
            
            productId = parseInt(productId);
            
            if (!productId || !colorImageMappings[productId]) {
                console.log('❌ Kein Mapping für Produkt-ID:', productId);
                return;
            }
            
            // Hole das passende Bild für die Farbe
            const mapping = colorImageMappings[productId];
            const newImageSrc = mapping[color] || mapping['default'];
            
            if (newImageSrc) {
                console.log(`✅ Ändere Bild für ${fullName} zu:`, newImageSrc);
                img.src = newImageSrc;
                img.alt = fullName;
            }
        });
    }
    
    // Warte bis DOM geladen ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        // Initial ausführen
        setTimeout(updateCartProductImages, 500);
        
        // Bei Änderungen im Warenkorb erneut ausführen
        const observer = new MutationObserver(() => {
            setTimeout(updateCartProductImages, 100);
        });
        
        // Beobachte Änderungen im gesamten Dokument für dynamische Updates
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['src', 'data-product-id']
        });
        
        // Auch bei cart-updated Event ausführen
        document.addEventListener('cart-updated', updateCartProductImages);
        window.addEventListener('cartUpdated', updateCartProductImages);
        
        // Regelmäßige Überprüfung für dynamische Änderungen
        setInterval(updateCartProductImages, 2000);
        
        console.log('✅ Cart Color Images initialisiert');
    }
    
    // Exportiere für andere Scripts
    window.updateCartProductImages = updateCartProductImages;
})();
