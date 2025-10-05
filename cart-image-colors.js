// ============================================
// CART IMAGE COLORS - Bild-basierte Farbauswahl im Warenkorb
// ============================================

// Cart Image Colors - Bild-basierte Farbauswahl

// Funktion für farbspezifische Bilder
function getColorSpecificImage(product, colorName) {
    // Spezielle Behandlung für Produkt 11 (Mixer)
    if (product.id === 11) {
        if (colorName === 'Weiß') {
            return 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Weiß.jpg';
        } else if (colorName === 'Pink') {
            return 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Rosa.png';
        }
    }
    
    // Fallback zum Hauptbild
    return product.image;
}

// Funktion zum Rendern der Farbauswahl mit Bildern für Cart Items
async function renderCartColorSelection(item, container) {
    // Skip Bundles - keine Farbauswahl für Bundles
    if (item.isBundle || item.name.includes('Sets)')) {
        return;
    }
    
    try {
        // Lade Produktdaten
        const response = await fetch('products.json');
        const products = await response.json();
        const product = products.find(p => p.id === parseInt(item.id));
        
        if (!product || !product.colors || product.colors.length === 0) {
            return; // Keine Farbauswahl für dieses Produkt
        }
        
        // Extrahiere aktuelle Farbe aus dem Produktnamen
        const currentColor = extractColorFromName(item.name) || product.colors[0].name;
        
        // Erstelle Farbauswahl HTML
        const colorSelectionHtml = `
            <div class="cart-item-color-selection">
                <span class="cart-color-label">Farbe:</span>
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
                                <img src="${getColorSpecificImage(product, color.name)}" 
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
        
        // Event Listener hinzufügen
        attachColorChangeListeners(item.id, product);
        
        // Entferne alte Event Listener und füge neue hinzu
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const colorName = e.target.value;
                const colorPrice = parseFloat(e.target.getAttribute('data-color-price'));
                
                // Update localStorage
                let cart = JSON.parse(localStorage.getItem('cart') || '[]');
                const itemIndex = cart.findIndex(cartItem => cartItem.id == item.id);
                if (itemIndex !== -1) {
                    // Update Produktname mit neuer Farbe
                    const baseName = cart[itemIndex].name.replace(/\s*\([^)]*\)$/, '');
                    cart[itemIndex].name = `${baseName} (${colorName})`;
                    cart[itemIndex].selectedColor = colorName;
                    localStorage.setItem('cart', JSON.stringify(cart));
                    
                    // Update UI
                    const nameElement = container.closest('.cart-item').querySelector('h5');
                    if (nameElement) {
                        nameElement.textContent = cart[itemIndex].name;
                    }
                    
                    // Update Bild
                    const imgElement = container.closest('.cart-item').querySelector('.cart-item-image');
                    if (imgElement) {
                        const newSrc = getColorSpecificImage(product, colorName);
                        imgElement.src = newSrc;
                    }
                    
                    console.log('✅ Farbe geändert zu:', colorName);
                }
            });
        });
        
    } catch (error) {
        console.error('Fehler beim Rendern der Farbauswahl:', error);
    }
}

// Extrahiere Farbe aus Produktnamen
function extractColorFromName(name) {
    const match = name.match(/\(([^)]+)\)$/);
    return match ? match[1] : null;
}

// Event Listener für Farbänderungen
function attachColorChangeListeners(productId, product) {
    const radioButtons = document.querySelectorAll(`input[name="cartColor-${productId}"]`);
    
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const newColorName = e.target.value;
            const newColor = product.colors.find(c => c.name === newColorName);
            
            if (newColor) {
                updateCartItemImage(productId, newColorName, newColor.price);
            }
        });
    });
}

// Funktion zum Aktualisieren des Warenkorb-Items mit neuer Farbe
function updateCartItemImage(productId, colorName, colorPrice) {
    console.log('🎨 Farbwechsel:', productId, colorName, colorPrice);
    // Finde das Cart-Item
    const cartItem = document.querySelector(`[data-product-id="${productId}"]`)?.closest('.cart-item');
    if (!cartItem) return;
    
    // Update das Hauptbild
    const mainImage = cartItem.querySelector('img');
    if (mainImage) {
        // Hole das farbspezifische Bild
        fetch('products.json')
            .then(res => res.json())
            .then(products => {
                const product = products.find(p => p.id === parseInt(productId));
                if (product) {
                    const newImageSrc = getColorSpecificImage(product, colorName);
                    mainImage.src = newImageSrc;
                    
                    // Update den Produktnamen
                    const nameElement = cartItem.querySelector('.cart-item-name, h5');
                    if (nameElement) {
                        const baseName = product.name;
                        nameElement.textContent = `${baseName} (${colorName})`;
                    }
                    
                    // Update den Preis
                    const priceElement = cartItem.querySelector('.cart-item-price');
                    if (priceElement) {
                        priceElement.textContent = `€${price.toFixed(2)}`;
                    }
                    
                    // Update im localStorage
                    updateCartItemColor(productId, colorName, price);
                }
            });
    }
}

// Funktion zum Aktualisieren der Farbe eines Cart Items
function updateCartItemColor(productId, newColor, newPrice) {
    // Hole Cart aus localStorage
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    // Finde das Item
    const itemIndex = cart.findIndex(item => item.id == productId);
    
    if (itemIndex !== -1) {
        // Update Produktname mit neuer Farbe
        const baseName = cart[itemIndex].name.replace(/\s*\([^)]*\)$/, '');
        cart[itemIndex].name = `${baseName} (${newColor.name})`;
        
        // Update Preis wenn unterschiedlich
        if (newColor.price) {
            cart[itemIndex].price = newColor.price;
        }
        
        // Speichere ausgewählte Farbe
        cart[itemIndex].selectedColor = newColor;
        
        // Speichere im localStorage
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Update Cart Display
        if (window.renderCart) {
            window.renderCart();
        }
    }
}

// Zeige kurze Bestätigung - DEAKTIVIERT
function showColorChangeSuccess(colorName) {
    // Nachricht deaktiviert - keine Anzeige beim Farbwechsel
    return;
}

// CSS für Cart Farbauswahl mit Bildern
const cartImageColorStyles = `
<style>
{{ ... }}
/* Verstecke alte Farbkreise */
.color-circle,
.color-option:not(.cart-color-option),
[style*="border-radius: 50%"][style*="background-color"] {
    display: none !important;
}

.cart-item-color-selection {
    margin-top: 12px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px;
    display: flex;
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

.color-change-success {
    position: fixed;
    top: 80px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(40,167,69,0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
}

.color-change-success.show {
    opacity: 1;
    transform: translateX(0);
}

.color-change-success i {
    font-size: 18px;
}

/* Mobile Styles */
@media (max-width: 768px) {
    .cart-item-color-selection {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
    
    .cart-color-label-image {
        width: 45px;
        height: 45px;
    }
    
    .cart-color-options {
        gap: 6px;
    }
}

/* Fallback für fehlende Bilder */
.cart-color-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    text-transform: uppercase;
    font-weight: bold;
}

.cart-fallback-white { background: #FFFFFF; border: 1px solid #e0e0e0; color: #333; }
.cart-fallback-black { background: #000000; }
.cart-fallback-blue { background: #4A90E2; }
.cart-fallback-pink { background: #FFC0CB; color: #333; }
.cart-fallback-green { background: #4CAF50; }
</style>
`;

// Füge Styles zum Dokument hinzu
if (!document.getElementById('cart-image-color-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'cart-image-color-styles';
    styleElement.innerHTML = cartImageColorStyles;
    document.head.appendChild(styleElement);
}

// Integration in bestehende Cart-Rendering-Funktion
document.addEventListener('DOMContentLoaded', () => {
    // Override oder erweitere die bestehende renderCart Funktion
    const originalRenderCart = window.renderCart;
    
    window.renderCart = function() {
        // Rufe originale Funktion auf
        if (originalRenderCart) {
            originalRenderCart();
        }
        
        // Füge Farbauswahl zu jedem Cart Item hinzu
        setTimeout(() => {
            const cartItems = document.querySelectorAll('.cart-item');
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            
            cartItems.forEach((itemElement, index) => {
                if (cart[index]) {
                    // Prüfe ob bereits Farbauswahl vorhanden
                    if (!itemElement.querySelector('.cart-item-color-selection')) {
                        renderCartColorSelection(cart[index], itemElement);
                    }
                }
            });
        }, 100);
    };
    
    // Initiale Render
    if (window.location.pathname.includes('cart.html')) {
        setTimeout(() => {
            if (window.renderCart) {
                window.renderCart();
            }
        }, 500);
    }
});

// Exportiere Funktionen
window.renderCartColorSelection = renderCartColorSelection;
window.updateCartItemColor = updateCartItemColor;
window.updateCartItemImage = updateCartItemImage;

// Cart Image Colors erfolgreich initialisiert
console.log('✅ Cart Image Colors geladen - Bilder-basierte Farbauswahl aktiv');

// Verstecke alle alten Farbkreise
const hideOldColorCircles = () => {
    const style = document.createElement('style');
    style.textContent = `
        /* Verstecke ALLE Farbkreise */
        .color-circle,
        .color-circle-cart,
        [style*="border-radius: 50%"][style*="background-color"],
        .cart-color-selector input[type="radio"] + span[style*="border-radius: 50%"] {
            display: none !important;
        }
        
        /* Zeige nur Bild-basierte Farbauswahl */
        .cart-color-option {
            display: inline-block !important;
        }
    `;
    document.head.appendChild(style);
};

// Führe sofort aus
hideOldColorCircles();

// Und nochmal nach DOM-Load
document.addEventListener('DOMContentLoaded', hideOldColorCircles);
