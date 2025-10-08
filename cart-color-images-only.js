// ============================================
// CART COLOR IMAGES ONLY - Nur bildbasierte Farbauswahl
// Keine Farbkreise, nur Produktbilder für Farbauswahl
// ============================================

console.log('🖼️ Cart Color Images Only geladen');

// Funktion zum Rendern der bildbasierten Farbauswahl
async function renderImageColorSelection(item, container) {
    // Skip Bundles - keine Farbauswahl für Bundles
    if (item.isBundle || item.name.includes('Sets)') || item.name.includes('Bundle')) {
        console.log('⏭️ Überspringe Bundle:', item.name);
        return;
    }
    
    try {
        // Lade Produktdaten
        const response = await fetch('products.json');
        const products = await response.json();
        const product = products.find(p => p.id === parseInt(item.id));
        
        if (!product || !product.colors || product.colors.length === 0) {
            console.log('❌ Keine Farben für Produkt:', item.id);
            return; // Keine Farbauswahl für dieses Produkt
        }
        
        console.log('✅ Erstelle Farbauswahl für:', product.name, 'Farben:', product.colors.length);
        
        // Extrahiere aktuelle Farbe aus dem Produktnamen
        const currentColor = extractColorFromName(item.name) || product.colors[0].name;
        console.log('🎨 Aktuelle Farbe:', currentColor);
        
        // Erstelle bildbasierte Farbauswahl HTML
        const isModelProduct = item.id === 21; // LED Water Ripple Crystal
        const selectionLabel = isModelProduct ? 'Modell:' : 'Farbe:';
        
        const colorSelectionHtml = `
            <div class="cart-item-color-selection" data-product-id="${item.id}">
                <span class="cart-color-label">${selectionLabel}</span>
                <div class="cart-color-options">
                    ${product.colors.map(color => `
                        <div class="cart-color-option" title="${color.name}">
                            <input type="radio" 
                                   id="cart-${item.id}-color-${color.name.toLowerCase().replace(/\s+/g, '-')}" 
                                   name="cartColor-${item.id}" 
                                   value="${color.name}"
                                   data-product-id="${item.id}"
                                   data-color-code="${color.code}"
                                   data-color-price="${color.price}"
                                   ${color.name === currentColor ? 'checked' : ''}>
                            <label for="cart-${item.id}-color-${color.name.toLowerCase().replace(/\s+/g, '-')}" 
                                   class="cart-color-label-image">
                                <img src="${getColorSpecificImagePath(product, color.name)}" 
                                     alt="${color.name}" 
                                     class="cart-color-image"
                                     onerror="this.src='${product.image}'">
                                <span class="cart-color-tooltip">${color.name}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Füge Farbauswahl zum Container hinzu
        const colorDiv = document.createElement('div');
        colorDiv.innerHTML = colorSelectionHtml;
        container.appendChild(colorDiv);
        
        // Automatisch erste Farbe auswählen und UI aktualisieren wenn noch keine Farbe gewählt
        const firstRadio = container.querySelector('input[type="radio"]:checked');
        if (firstRadio) {
            const selectedColorName = firstRadio.value;
            console.log('🎯 Erste Farbe automatisch gewählt:', selectedColorName);
            
            // Update Hauptbild sofort
            setTimeout(() => {
                const imgElement = container.closest('.cart-item').querySelector('.cart-item-image');
                if (imgElement) {
                    const newSrc = getColorSpecificImagePath(product, selectedColorName);
                    console.log('🖼️ Setze initiales Hauptbild:', newSrc);
                    imgElement.src = newSrc;
                }
            }, 200);
        }

        // Event Listener für Farbwechsel hinzufügen
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const colorName = e.target.value;
                console.log('🔄 Farbwechsel zu:', colorName);
                
                // Update localStorage
                let cart = JSON.parse(localStorage.getItem('cart') || '[]');
                const itemIndex = cart.findIndex(cartItem => cartItem.id == item.id);
                if (itemIndex !== -1) {
                    // Update Produktname mit neuer Farbe
                    const baseName = cart[itemIndex].name.replace(/\s*\([^)]*\)$/, '');
                    cart[itemIndex].name = `${baseName} (${colorName})`;
                    cart[itemIndex].selectedColor = colorName;
                    localStorage.setItem('cart', JSON.stringify(cart));
                    
                    // Update UI - Produktname
                    const nameElement = container.closest('.cart-item').querySelector('h5');
                    if (nameElement) {
                        nameElement.textContent = cart[itemIndex].name;
                    }
                    
                    // Update UI - Hauptbild mit kleiner Verzögerung
                    setTimeout(() => {
                        const imgElement = container.closest('.cart-item').querySelector('.cart-item-image');
                        if (imgElement) {
                            const newSrc = getColorSpecificImagePath(product, colorName);
                            console.log('🖼️ Neues Hauptbild:', newSrc);
                            imgElement.src = newSrc;
                        }
                    }, 100);
                    
                    console.log('✅ Farbe erfolgreich geändert zu:', colorName);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Fehler beim Rendern der Farbauswahl:', error);
    }
}

// Funktion zum Extrahieren der Farbe aus dem Produktnamen
function extractColorFromName(name) {
    const match = name.match(/\(([^)]+)\)$/);
    return match ? match[1] : null;
}

// Funktion zum Holen des farbspezifischen Bildpfads
function getColorSpecificImagePath(product, colorName) {
    console.log('🖼️ getColorSpecificImagePath aufgerufen für Produkt:', product.id, 'Farbe:', colorName);
    
    // Mapping basierend auf der products.json und den verfügbaren Bildern
    const colorImageMappings = {
        10: { // Elektrischer Wasserspender
            'Schwarz': 'produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Elektrischer Wasserspender für Schreibtisch schwarz.jpg',
            'Weiß': 'produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Elektrischer Wasserspender für Schreibtisch weiß.jpg'
        },
        11: { // 350ml Elektrischer Mixer
            'Weiß': 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Weiß.jpg',
            'Rosa': 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Rosa.png'
        },
        17: { // Bluetooth Anti-Lost Finder
            'Schwarz': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen schwarz.png',
            'Weiß': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen weiß.png',
            'Grün': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen grün.png',
            'Pink': 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen pink.png'
        },
        18: { // Home Electronic Clock
            'Schwarz': 'produkt bilder/Home Electronic Clock Digitale Uhr.jpeg',
            'Weiß': 'produkt bilder/Home Electronic Clock Digitale Uhr.jpeg'
        },
        21: { // LED Water Ripple Crystal
            'Crown': 'produkt bilder/LED Water Ripple Crystal bilder/LED Water Ripple Crystal crown.png',
            'Square': 'produkt bilder/LED Water Ripple Crystal bilder/LED Water Ripple Crystal square.png'
        },
        26: { // 4 In 1 Self Cleaning Hair Brush
            'Roland Purple': 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush roland purple.jpg',
            'Lunar Rock': 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush lunar rock.jpg'
        },
        32: { // Indoor Sensing Wall Lamp
            'Schwarz': 'produkt bilder/Indoor Sensing Wall Lamp bilder/Indoor Sensing Wall Lamp schwartz.jpg',
            'Weiß': 'produkt bilder/Indoor Sensing Wall Lamp bilder/Indoor Sensing Wall Lamp weiß.jpg'
        }
    };
    
    const mapping = colorImageMappings[product.id];
    if (mapping && mapping[colorName]) {
        console.log('✅ Farbbild gefunden:', mapping[colorName]);
        return mapping[colorName];
    }
    
    console.log('⚠️ Kein Farbbild gefunden, verwende Hauptbild:', product.image);
    // Fallback zum Hauptbild
    return product.image;
}

// Funktion zum Korrigieren der ersten Farbe nach dem Hinzufügen
function ensureFirstColorSelected() {
    console.log('🔧 Überprüfe erste Farbauswahl...');
    
    setTimeout(() => {
        const cartItems = document.querySelectorAll('.cart-item');
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        cartItems.forEach((itemElement, index) => {
            if (cart[index]) {
                const item = cart[index];
                
                // Prüfe ob Produkt Farben hat aber keine Farbe im Namen
                const hasColorInName = item.name.match(/\(([^)]+)\)$/);
                const colorSelection = itemElement.querySelector('.cart-item-color-selection');
                
                if (!hasColorInName && colorSelection) {
                    const firstRadio = colorSelection.querySelector('input[type="radio"]:checked');
                    if (firstRadio) {
                        const colorName = firstRadio.value;
                        console.log('🎯 Setze fehlende Farbe:', colorName, 'für Produkt:', item.name);
                        
                        // Update localStorage
                        let updatedCart = JSON.parse(localStorage.getItem('cart') || '[]');
                        const itemIndex = updatedCart.findIndex(cartItem => cartItem.id == item.id);
                        if (itemIndex !== -1) {
                            const baseName = updatedCart[itemIndex].name.replace(/\s*\([^)]*\)$/, '');
                            updatedCart[itemIndex].name = `${baseName} (${colorName})`;
                            updatedCart[itemIndex].selectedColor = colorName;
                            localStorage.setItem('cart', JSON.stringify(updatedCart));
                            
                            // Update UI
                            const nameElement = itemElement.querySelector('h5');
                            if (nameElement) {
                                nameElement.textContent = updatedCart[itemIndex].name;
                            }
                            
                            // Update Hauptbild
                            setTimeout(() => {
                                const imgElement = itemElement.querySelector('.cart-item-image');
                                if (imgElement) {
                                    // Hole Produktdaten für Bildpfad
                                    fetch('products.json')
                                        .then(res => res.json())
                                        .then(products => {
                                            const product = products.find(p => p.id === parseInt(item.id));
                                            if (product) {
                                                const newSrc = getColorSpecificImagePath(product, colorName);
                                                console.log('🖼️ Update Hauptbild nach Farbkorrektur:', newSrc);
                                                imgElement.src = newSrc;
                                            }
                                        });
                                }
                            }, 300);
                        }
                    }
                }
            }
        });
    }, 500);
}

// Integration in bestehende Cart-Rendering-Funktion
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM geladen, initialisiere Cart Color Images Only');
    
    // Override der bestehenden renderCart Funktion
    const originalUpdateCartPage = window.updateCartPage;
    
    if (originalUpdateCartPage) {
        window.updateCartPage = function() {
            console.log('🔄 updateCartPage überschrieben');
            // Rufe originale Funktion auf
            const result = originalUpdateCartPage.apply(this, arguments);
            
            // Füge bildbasierte Farbauswahl hinzu
            setTimeout(() => {
                const cartItems = document.querySelectorAll('.cart-item');
                const cart = JSON.parse(localStorage.getItem('cart') || '[]');
                
                console.log('🛒 Füge Farbauswahl zu', cartItems.length, 'Cart Items hinzu');
                
                cartItems.forEach((itemElement, index) => {
                    if (cart[index]) {
                        // Prüfe ob bereits Farbauswahl vorhanden
                        if (!itemElement.querySelector('.cart-item-color-selection')) {
                            renderImageColorSelection(cart[index], itemElement);
                        }
                    }
                });
                
                // Korrigiere erste Farbauswahl nach dem Rendern
                ensureFirstColorSelected();
            }, 200);
            
            return result;
        };
    }
    
    // Initiale Render für cart.html
    if (window.location.pathname.includes('cart.html')) {
        setTimeout(() => {
            if (window.updateCartPage) {
                console.log('🚀 Initiale Cart-Render');
                window.updateCartPage();
            }
        }, 500);
    }
});

// CSS für bildbasierte Farbauswahl
const imageColorStyles = `
<style id="cart-image-color-styles">
.cart-item-color-selection {
    margin-top: 12px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px;
    display: flex !important;
    align-items: center;
    gap: 12px;
}

.cart-color-label {
    font-size: 14px;
    font-weight: 500;
    color: #555;
    white-space: nowrap;
}

.cart-color-options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.cart-color-option {
    position: relative;
}

.cart-color-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.cart-color-label-image {
    display: block;
    cursor: pointer;
    position: relative;
    width: 50px;
    height: 50px;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
    transition: all 0.2s ease;
    background: white;
}

.cart-color-label-image:hover {
    border-color: #007bff;
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0,123,255,0.2);
}

.cart-color-option input[type="radio"]:checked + .cart-color-label-image {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0,123,255,0.15);
}

.cart-color-option input[type="radio"]:checked + .cart-color-label-image::after {
    content: '✓';
    position: absolute;
    top: 2px;
    right: 2px;
    background: #007bff;
    color: white;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: bold;
}

.cart-color-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 4px;
}

.cart-color-tooltip {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 10;
}

.cart-color-label-image:hover .cart-color-tooltip {
    opacity: 1;
}

/* Mobile Styles */
@media (max-width: 768px) {
    .cart-item-color-selection {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        width: 100vw !important;
    }
    
    .cart-color-label-image {
        width: 60px !important;
        height: 60px !important;
        border: 4px solid #ffffff !important;
        border-radius: 12px !important;
        box-shadow: 0 6px 20px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15) !important;
        background: #ffffff !important;
        transition: all 0.3s ease !important;
    }
    
    .cart-color-label-image:hover {
        transform: scale(1.1) !important;
        border-color: #007bff !important;
        box-shadow: 0 6px 16px rgba(0,123,255,0.3) !important;
    }
    
    .cart-color-option input[type="radio"]:checked + .cart-color-label-image {
        border-color: #007bff !important;
        border-width: 5px !important;
        box-shadow: 0 8px 25px rgba(0,123,255,0.4), 0 0 0 2px rgba(0,123,255,0.3) !important;
        transform: scale(1.05) !important;
    }
    
    .cart-color-option input[type="radio"]:checked + .cart-color-label-image::after {
        content: '✓' !important;
        position: absolute !important;
        top: 2px !important;
        right: 2px !important;
        background: #007bff !important;
        color: white !important;
        width: 18px !important;
        height: 18px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 11px !important;
        font-weight: bold !important;
    }
    
    .cart-color-options {
        gap: 30px !important;
        padding: 8px 0 !important;
    }
    
    .cart-item-color-selection {
        padding: 16px 12px !important;
        margin: 12px 0 !important;
        background: transparent !important;
        border-radius: 0 !important;
        border: none !important;
    }
    
    .cart-color-label {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #495057 !important;
        margin-bottom: 12px !important;
        display: block !important;
    }
    
    .cart-color-image {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        padding: 6px !important;
        max-width: 52px !important;
        max-height: 52px !important;
    }
}
</style>
`;

// Füge Styles zum Dokument hinzu
if (!document.getElementById('cart-image-color-styles')) {
    document.head.insertAdjacentHTML('beforeend', imageColorStyles);
}

// Exportiere Funktionen
window.renderImageColorSelection = renderImageColorSelection;
window.ensureFirstColorSelected = ensureFirstColorSelected;

console.log('✅ Cart Color Images Only vollständig geladen - Nur bildbasierte Farbauswahl aktiv');
