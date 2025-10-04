// Cart Color Selector - Ermöglicht Farbänderung direkt im Warenkorb
console.log('🎨 Cart Color Selector geladen');

// Funktion zum Laden der Produktdaten mit Farben
async function loadProductColors(productId) {
    try {
        console.log(`📂 Loading colors for product ID: ${productId} (type: ${typeof productId})`);
        const response = await fetch('products.json');
        const products = await response.json();
        
        // Konvertiere productId zu Number für den Vergleich
        const numericId = Number(productId);
        console.log(`🔍 Searching for product with ID ${numericId} in ${products.length} products`);
        
        const product = products.find(p => {
            const match = Number(p.id) === numericId;
            if (match) {
                console.log(`✅ Found matching product:`, p.name, `with ${p.colors?.length || 0} colors`);
            }
            return match;
        });
        
        if (!product) {
            console.log(`❌ No product found with ID ${numericId}`);
        }
        
        return product?.colors || [];
    } catch (error) {
        console.error('Fehler beim Laden der Produktfarben:', error);
        return [];
    }
}

// Funktion zum Rendern der Farbauswahl im Warenkorb
async function renderColorSelector(item, container) {
    console.log(`🎨 renderColorSelector called for item:`, item);
    
    // Extrahiere die Basis-ID (ohne Farbzusatz)
    const baseId = String(item.id).split('-')[0];
    console.log(`📍 Base ID extracted: ${baseId} from ${item.id}`);
    
    const colors = await loadProductColors(baseId);
    console.log(`🎨 Colors loaded for product ${baseId}:`, colors);
    
    if (!colors || colors.length === 0) {
        console.log(`⚠️ No colors found for product ${baseId}`);
        return ''; // Keine Farbauswahl für dieses Produkt
    }
    
    // Finde die aktuelle Farbe
    const currentColor = colors.find(c => c.name === item.selectedColor) || colors[0];
    console.log(`✅ Current color:`, currentColor);
    
    return `
        <div class="cart-color-selector mb-2">
            <label class="small text-muted">Farbe:</label>
            <div class="d-flex gap-2 align-items-center">
                <div class="color-options-cart d-flex gap-1">
                    ${colors.map(color => `
                        <div class="color-option-cart ${color.name === item.selectedColor ? 'selected' : ''}"
                             style="background-color: ${color.code};"
                             title="${color.name}"
                             data-product-id="${item.id}"
                             data-base-id="${baseId}"
                             data-color-name="${color.name}"
                             data-color-code="${color.code}"
                             data-color-sku="${color.sku || 'default'}"
                             data-color-price="${color.price}"
                             onclick="changeCartItemColor('${item.id}', '${baseId}', '${color.name.replace(/'/g, "\\'")}', '${color.code}', '${color.sku || 'default'}', ${color.price})">
                        </div>
                    `).join('')}
                </div>
                <span class="small">${currentColor.name}</span>
            </div>
        </div>
    `;
}

// Funktion zum Ändern der Farbe eines Warenkorb-Artikels
function changeCartItemColor(cartItemId, baseProductId, colorName, colorCode, colorSku, colorPrice) {
    console.log(`🎨 Ändere Farbe für Artikel ${cartItemId} (Basis-ID: ${baseProductId}) zu ${colorName}`);
    
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Finde den Artikel im Warenkorb
    const itemIndex = cart.findIndex(item => {
        // Vergleiche sowohl mit der vollen ID als auch mit der Basis-ID
        return String(item.id) === String(cartItemId) || 
               String(item.id) === String(baseProductId) ||
               Number(item.id) === Number(baseProductId);
    });
    
    if (itemIndex !== -1) {
        // Entferne alte Farbe aus dem Namen
        let cleanName = cart[itemIndex].name.replace(/\s*\([^)]*\)$/, '');
        
        // Aktualisiere Artikel mit neuer Farbe
        cart[itemIndex].selectedColor = colorName;
        cart[itemIndex].selectedColorCode = colorCode;
        cart[itemIndex].selectedColorSku = colorSku;
        cart[itemIndex].price = colorPrice;
        cart[itemIndex].name = `${cleanName} (${colorName})`;
        
        // Aktualisiere auch die cartItemId für eindeutige Identifikation
        cart[itemIndex].cartItemId = `${baseProductId}-${colorName.replace(/\s+/g, '-').toLowerCase()}`;
        
        // Speichere aktualisierten Warenkorb
        localStorage.setItem('cart', JSON.stringify(cart));
        
        console.log(`✅ Farbe geändert zu ${colorName} - Neuer Preis: €${colorPrice}`);
        console.log('📦 Aktualisierter Artikel:', cart[itemIndex]);
        
        // Aktualisiere die Seite
        if (typeof updateCartPage === 'function') {
            updateCartPage();
        } else if (typeof updateCart === 'function') {
            updateCart();
        } else {
            // Fallback: Seite neu laden
            location.reload();
        }
        
        // Zeige Erfolgs-Feedback
        showColorChangeSuccess(cartItemId, colorName);
    } else {
        console.error(`❌ Artikel mit ID ${cartItemId} oder ${baseProductId} nicht im Warenkorb gefunden`);
        console.log('Warenkorb-Inhalt:', cart);
    }
}

// Erfolgs-Feedback anzeigen
function showColorChangeSuccess(productId, colorName) {
    const cartItem = document.querySelector(`.cart-item[data-id="${productId}"]`);
    if (cartItem) {
        // Füge temporäre Erfolgs-Animation hinzu
        cartItem.classList.add('color-changed');
        setTimeout(() => {
            cartItem.classList.remove('color-changed');
        }, 500);
    }
}

// CSS für Farbauswahl im Warenkorb
const cartColorStyles = `
<style>
.cart-color-selector {
    padding: 8px 0;
    margin-bottom: 8px;
}

.cart-color-selector-wrapper {
    width: 100%;
    clear: both;
}

.color-options-cart {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 4px;
}

.color-option-cart {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #ddd;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
}

.color-option-cart:hover {
    transform: scale(1.1);
    border-color: #007bff;
}

.color-option-cart.selected {
    border: 3px solid #28a745;
    box-shadow: 0 0 8px rgba(40, 167, 69, 0.4);
}

.color-option-cart.selected::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 12px;
    font-weight: bold;
    text-shadow: 0 0 2px rgba(0,0,0,0.5);
}

.cart-item.color-changed {
    animation: colorChangeFlash 0.5s ease;
}

@keyframes colorChangeFlash {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(40, 167, 69, 0.1); }
}
</style>
`;

// Füge Styles zum Head hinzu
if (!document.getElementById('cart-color-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'cart-color-styles';
    styleElement.innerHTML = cartColorStyles;
    document.head.appendChild(styleElement);
}

// Exportiere Funktionen für globale Nutzung
window.renderColorSelector = renderColorSelector;
window.changeCartItemColor = changeCartItemColor;
window.loadProductColors = loadProductColors;
window.addColorSelectorsToCart = addColorSelectorsToCart;

// Automatisch Farbauswahl nach updateCart hinzufügen
const originalUpdateCart = window.updateCart;
if (originalUpdateCart) {
    window.updateCart = function(...args) {
        const result = originalUpdateCart.apply(this, args);
        
        // Füge Farbauswahl nach dem Update hinzu
        setTimeout(async () => {
            console.log('🎨 Auto-adding color selectors after updateCart...');
            const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
            for (const item of cartItems) {
                const container = document.querySelector(`.cart-item[data-id="${item.id}"] .cart-item-details`);
                if (container && !container.querySelector('.cart-color-selector')) {
                    const colorDiv = document.createElement('div');
                    colorDiv.className = 'cart-color-selector-wrapper';
                    colorDiv.innerHTML = await renderColorSelector(item, colorDiv);
                    
                    // Füge es nach dem Titel ein
                    const title = container.querySelector('h5');
                    if (title && title.nextSibling) {
                        container.insertBefore(colorDiv, title.nextSibling);
                    }
                }
            }
        }, 200);
        
        return result;
    };
}

// Funktion zum Hinzufügen der Farbauswahl
async function addColorSelectorsToCart() {
    console.log('🎨 Adding color selectors to cart items...');
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    console.log('📦 Cart items found:', cartItems);
    
    for (const item of cartItems) {
        console.log(`🔍 Processing item ${item.id}: ${item.name}`);
        
        // Versuche verschiedene Selektoren für cart.html
        let containers = [
            document.querySelector(`.cart-item[data-id="${item.id}"] .cart-item-details`),
            document.querySelector(`.cart-item[data-id="${item.id}"]`),
            // Für Dropdown in index.html
            document.querySelector(`.dropdown-cart-item[data-id="${item.id}"] .dropdown-item-details`),
            document.querySelector(`.dropdown-cart-item[data-id="${item.id}"]`)
        ].filter(Boolean);
        
        console.log(`📍 Found ${containers.length} containers for item ${item.id}`);
        
        for (const container of containers) {
            if (container && !container.querySelector('.cart-color-selector')) {
                console.log(`🎯 Adding color selector to container for item ${item.id}`);
                
                const colorDiv = document.createElement('div');
                colorDiv.className = 'cart-color-selector-wrapper';
                const selectorHtml = await renderColorSelector(item, colorDiv);
                
                console.log(`📝 Selector HTML generated:`, selectorHtml ? 'Yes' : 'No');
                
                if (selectorHtml) {
                    colorDiv.innerHTML = selectorHtml;
                    
                    // Finde den besten Platz zum Einfügen
                    const title = container.querySelector('h5') || 
                                 container.querySelector('.dropdown-item-name') ||
                                 container.querySelector('[class*="name"]');
                    
                    if (title) {
                        console.log(`📌 Inserting after title element`);
                        // Füge nach dem Titel ein
                        if (title.nextSibling) {
                            title.parentNode.insertBefore(colorDiv, title.nextSibling);
                        } else {
                            title.parentNode.appendChild(colorDiv);
                        }
                    } else {
                        console.log(`📌 Inserting in details section`);
                        // Füge in cart-item-details ein, falls vorhanden
                        const details = container.querySelector('.cart-item-details') || container;
                        const price = details.querySelector('.cart-item-price');
                        if (price) {
                            details.insertBefore(colorDiv, price);
                        } else {
                            details.appendChild(colorDiv);
                        }
                    }
                    
                    console.log(`✅ Color selector added for item ${item.id}`);
                    break; // Nur einmal pro Item hinzufügen
                } else {
                    console.log(`⚠️ No color selector HTML generated for item ${item.id}`);
                }
            } else {
                console.log(`⏭️ Container already has color selector or not found for item ${item.id}`);
            }
        }
    }
}

// Warte auf DOMContentLoaded und füge dann Farbauswahl hinzu
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(addColorSelectorsToCart, 1000);
    });
} else {
    // DOM bereits geladen
    setTimeout(addColorSelectorsToCart, 1000);
}

// Überwache Änderungen im DOM für dynamisch geladene Inhalte
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Prüfe ob Warenkorb-Items hinzugefügt wurden
            const hasCartItems = Array.from(mutation.addedNodes).some(node => 
                node.nodeType === 1 && (
                    node.classList?.contains('cart-item') || 
                    node.querySelector?.('.cart-item') ||
                    node.classList?.contains('dropdown-cart-item') ||
                    node.querySelector?.('.dropdown-cart-item')
                )
            );
            
            if (hasCartItems) {
                setTimeout(addColorSelectorsToCart, 100);
            }
        }
    }
});

// Starte Observer
observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('✅ Cart Color Selector initialisiert');
