/**
 * Warenkorb Farbänderungs-Funktionalität
 * Ermöglicht das Ändern von Farben direkt im Warenkorb
 */

(function() {
    console.log('🎨 Warenkorb Farbänderungs-System wird geladen...');

    // Warte auf DOM-Ready
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            enhanceCartWithColorChanger();
        }, 1000);
    });

    async function enhanceCartWithColorChanger() {
        // Überschreibe die Cart-Rendering-Funktion
        if (typeof window.renderCartItems === 'function' && !window.renderCartItems._colorChangerEnhanced) {
            const originalRenderCartItems = window.renderCartItems;
            
            window.renderCartItems = function(...args) {
                const result = originalRenderCartItems.apply(this, args);
                
                // Füge Farbänderungs-Buttons hinzu
                setTimeout(() => {
                    addColorChangeButtons();
                }, 100);
                
                return result;
            };
            
            window.renderCartItems._colorChangerEnhanced = true;
            console.log('✅ Cart-Rendering für Farbänderung erweitert');
        }

        // Falls renderCartItems nicht verfügbar, überwache DOM-Änderungen
        observeCartChanges();
    }

    function observeCartChanges() {
        const cartContent = document.getElementById('cartItemsList') || document.querySelector('.cart-items-section');
        
        if (cartContent) {
            const observer = new MutationObserver(() => {
                setTimeout(() => {
                    addColorChangeButtons();
                }, 100);
            });
            
            observer.observe(cartContent, {
                childList: true,
                subtree: true
            });
            
            console.log('✅ Cart-Observer für Farbänderung aktiviert');
        }
    }

    async function addColorChangeButtons() {
        const cartItems = document.querySelectorAll('.cart-item');
        
        for (const item of cartItems) {
            const productId = item.getAttribute('data-id');
            if (!productId || item.querySelector('.color-change-btn')) continue;
            
            // Lade Produktdaten
            const productData = await loadProductData(parseInt(productId));
            if (!productData || !productData.colors || productData.colors.length === 0) continue;
            
            // Füge Farbänderungs-Button hinzu
            const itemDetails = item.querySelector('.cart-item-details');
            if (itemDetails) {
                const colorChangeHTML = createColorChangeInterface(productId, productData.colors);
                itemDetails.insertAdjacentHTML('beforeend', colorChangeHTML);
            }
        }
    }

    function createColorChangeInterface(productId, colors) {
        return `
            <div class="color-change-interface mt-2">
                <button class="color-change-btn btn btn-sm btn-outline-primary" onclick="toggleColorSelector(${productId})">
                    <i class="bi bi-palette"></i> Farbe ändern
                </button>
                <div class="color-selector" id="colorSelector_${productId}" style="display: none; margin-top: 8px;">
                    <div class="d-flex gap-1 flex-wrap">
                        ${colors.map(color => `
                            <div class="cart-color-option" 
                                 style="width:25px;height:25px;border-radius:50%;background:${color.code};border:2px solid #ddd;cursor:pointer;transition:all 0.3s ease;" 
                                 data-product-id="${productId}"
                                 data-color-name="${color.name}"
                                 data-color-code="${color.code}"
                                 data-sku="${color.sku}"
                                 data-price="${color.price || 0}"
                                 title="${color.name}"
                                 onclick="changeCartItemColor(${productId}, '${color.name}', '${color.code}', '${color.sku}', ${color.price || 0})">
                            </div>
                        `).join('')}
                    </div>
                    <small class="text-muted mt-1 d-block">Klicken Sie auf eine Farbe zum Ändern</small>
                </div>
            </div>
        `;
    }

    // Globale Funktionen für Farbänderung
    window.toggleColorSelector = function(productId) {
        const selector = document.getElementById(`colorSelector_${productId}`);
        if (selector) {
            const isVisible = selector.style.display !== 'none';
            selector.style.display = isVisible ? 'none' : 'block';
        }
    };

    window.changeCartItemColor = function(productId, colorName, colorCode, sku, price) {
        console.log(`🎨 Ändere Farbe für Produkt ${productId}: ${colorName} (€${price})`);
        
        // Hole aktuellen Warenkorb
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        // Finde das Produkt im Warenkorb
        const itemIndex = cart.findIndex(item => item.id == productId);
        if (itemIndex === -1) return;
        
        const item = cart[itemIndex];
        
        // Aktualisiere Produktdaten
        const originalName = item.name.replace(/\s*\([^)]*\)$/, ''); // Entferne alte Farbe
        item.name = `${originalName} (${colorName})`;
        item.selectedColor = colorName;
        item.selectedColorCode = colorCode;
        item.selectedColorSku = sku;
        if (price > 0) {
            item.price = price;
        }
        
        // Speichere Warenkorb
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Aktualisiere CJ Integration
        if (window.CJColorIntegration) {
            window.CJColorIntegration.setProductColor(productId, {
                name: colorName,
                code: colorCode,
                sku: sku,
                price: price
            });
        }
        
        // Verstecke Farbauswahl
        const selector = document.getElementById(`colorSelector_${productId}`);
        if (selector) {
            selector.style.display = 'none';
        }
        
        // Lade Seite neu um Änderungen zu zeigen
        setTimeout(() => {
            window.location.reload();
        }, 500);
        
        // Zeige Erfolgs-Nachricht
        showColorChangeNotification(colorName);
    };

    function showColorChangeNotification(colorName) {
        // Erstelle Notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;
        notification.innerHTML = `
            <i class="bi bi-check-circle-fill me-2"></i>
            Farbe geändert zu: ${colorName}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Hilfsfunktionen
    async function loadProductData(productId) {
        try {
            const response = await fetch('products.json');
            const products = await response.json();
            return products.find(p => p.id === productId);
        } catch (error) {
            console.error('Fehler beim Laden der Produktdaten:', error);
            return null;
        }
    }

    console.log('✅ Warenkorb Farbänderungs-System geladen');
})();
