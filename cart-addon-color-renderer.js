// Cart Addon Color Renderer - Fügt Farbauswahl zu Addons und Empfehlungen hinzu

(function() {
    console.log('🎨 Cart Addon Color Renderer geladen');
    
    // Funktion um Farbauswahl-HTML zu erstellen
    function createColorSelectionHTML(product, containerId) {
        if (!product.colors || product.colors.length === 0) {
            return ''; // Keine Farben verfügbar
        }
        
        let html = '<div class="addon-color-selection" style="margin: 10px 0;">';
        
        product.colors.forEach((color, index) => {
            const isChecked = index === 0 ? 'checked' : ''; // Erste Farbe automatisch auswählen
            const colorId = `color_${containerId}_${product.id}_${index}`;
            
            html += `
                <label style="margin-right: 10px; cursor: pointer;">
                    <input type="radio" 
                           name="color_${containerId}_${product.id}" 
                           value="${color.name}"
                           data-color-code="${color.code}"
                           data-color-price="${color.price}"
                           ${isChecked}
                           style="margin-right: 5px;">
                    <span style="display: inline-block; 
                                width: 20px; 
                                height: 20px; 
                                background-color: ${color.code}; 
                                border: 2px solid #ccc; 
                                border-radius: 50%; 
                                vertical-align: middle;
                                margin-right: 5px;"></span>
                    ${color.name}
                </label>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    // Funktion um Addons/Empfehlungen mit Farbauswahl zu erweitern
    function addColorSelectionsToAddons() {
        console.log('🎨 Adding color selections to addons...');
        
        // Lade Produktdaten
        fetch('products.json')
            .then(res => res.json())
            .then(products => {
                // Finde alle Addon/Empfehlungs-Container - erweiterte Suche
                const addonContainers = document.querySelectorAll(
                    '.addon-product, .recommended-product, .suggestion-item, ' +
                    '[data-addon-product], .product-card, .addon-item, ' +
                    '.recommendation-item, .suggested-product, ' +
                    '#addonProducts .product, #recommendedProducts .product, ' +
                    '[id*="addon"] .product-item, [class*="addon"] .item, ' +
                    '[class*="recommend"] .item, [class*="suggestion"] .item'
                );
                
                console.log(`Found ${addonContainers.length} addon containers`);
                
                // Debug: Zeige alle gefundenen Container
                if (addonContainers.length === 0) {
                    console.log('🔍 Searching for any product-like elements...');
                    const allProducts = document.querySelectorAll('[class*="product"]');
                    console.log(`Found ${allProducts.length} elements with "product" in class`);
                    allProducts.forEach(el => {
                        console.log('Element:', el.className, el.id || 'no-id');
                    });
                }
                
                addonContainers.forEach(container => {
                    // Prüfe ob bereits Farbauswahl vorhanden
                    if (container.querySelector('.addon-color-selection')) {
                        return; // Bereits vorhanden
                    }
                    
                    // Finde Produkt-ID
                    let productId = null;
                    
                    // Versuche verschiedene Wege die ID zu finden
                    const button = container.querySelector('[data-product-id]');
                    if (button) {
                        productId = parseInt(button.getAttribute('data-product-id'));
                    }
                    
                    // Alternative: Aus dem Produktnamen
                    if (!productId) {
                        const nameElement = container.querySelector('.product-name, h3, h4, h5');
                        if (nameElement) {
                            const productName = nameElement.textContent.trim();
                            const product = products.find(p => p.name === productName);
                            if (product) {
                                productId = product.id;
                            }
                        }
                    }
                    
                    if (productId) {
                        const product = products.find(p => p.id === productId);
                        
                        if (product && product.colors && product.colors.length > 0) {
                            console.log(`Adding color selection for product ${productId}: ${product.name}`);
                            
                            // Erstelle Farbauswahl-HTML
                            const colorHTML = createColorSelectionHTML(product, 'addon');
                            
                            // Füge es nach dem Preis ein
                            const priceElement = container.querySelector('.price, .product-price');
                            if (priceElement) {
                                priceElement.insertAdjacentHTML('afterend', colorHTML);
                            } else {
                                // Fallback: Füge es am Ende des Containers ein
                                container.insertAdjacentHTML('beforeend', colorHTML);
                            }
                            
                            // Update Button mit ausgewählter Farbe
                            const colorRadios = container.querySelectorAll('input[type="radio"][name*="color"]');
                            const addButton = container.querySelector('.add-to-cart-btn, button[onclick*="addToCart"]');
                            
                            if (addButton && colorRadios.length > 0) {
                                // Setze initiale Farbe
                                const firstColor = product.colors[0];
                                addButton.setAttribute('data-selected-color', firstColor.name);
                                
                                // Update bei Farbwechsel
                                colorRadios.forEach(radio => {
                                    radio.addEventListener('change', (e) => {
                                        if (e.target.checked) {
                                            addButton.setAttribute('data-selected-color', e.target.value);
                                            console.log(`Color selected for addon: ${e.target.value}`);
                                        }
                                    });
                                });
                            }
                        }
                    }
                });
                
                // Trigger auto-select nach dem Hinzufügen
                if (typeof window.autoSelectFirstColor === 'function') {
                    setTimeout(window.autoSelectFirstColor, 100);
                }
            })
            .catch(err => console.error('Error loading products for addon colors:', err));
    }
    
    // Initialisierung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('🚀 Initialisiere Cart Addon Color Renderer');
        
        // Warte bis Addons geladen sind
        setTimeout(addColorSelectionsToAddons, 1000);
        setTimeout(addColorSelectionsToAddons, 2000);
        setTimeout(addColorSelectionsToAddons, 3000);
        
        // Überwache DOM-Änderungen
        const observer = new MutationObserver((mutations) => {
            let hasNewAddons = false;
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.classList) {
                            if (node.classList.contains('addon-product') ||
                                node.classList.contains('recommended-product') ||
                                node.querySelector && node.querySelector('.addon-product, .recommended-product')) {
                                hasNewAddons = true;
                            }
                        }
                    });
                }
            });
            
            if (hasNewAddons) {
                setTimeout(addColorSelectionsToAddons, 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Cart Addon Color Renderer initialisiert');
    }
    
    // Exportiere für andere Scripts
    window.addColorSelectionsToAddons = addColorSelectionsToAddons;
})();
