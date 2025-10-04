// Cart Addon Colors - Automatische Farbauswahl für Addons und Empfehlungen

(function() {
    console.log('🎨 Cart Addon Colors geladen');
    
    // Funktion um die erste Farbe für Addons/Empfehlungen zu setzen
    function autoSelectFirstColor() {
        console.log('🎨 Auto-selecting first color for addons...');
        
        // Suche nach allen Radio-Buttons in der gesamten Seite die zu Farben gehören
        const allColorRadios = document.querySelectorAll('input[type="radio"][name*="color"]');
        console.log(`Found ${allColorRadios.length} color radio buttons`);
        
        // Gruppiere Radio-Buttons nach Namen
        const radioGroups = {};
        allColorRadios.forEach(radio => {
            const name = radio.name;
            if (!radioGroups[name]) {
                radioGroups[name] = [];
            }
            radioGroups[name].push(radio);
        });
        
        // Für jede Gruppe, wähle den ersten aus wenn keiner ausgewählt ist
        Object.keys(radioGroups).forEach(groupName => {
            const radios = radioGroups[groupName];
            const hasSelection = radios.some(r => r.checked);
            
            if (!hasSelection && radios.length > 0) {
                console.log(`Selecting first color for group: ${groupName}`);
                radios[0].checked = true;
                // Trigger change event
                const event = new Event('change', { bubbles: true });
                radios[0].dispatchEvent(event);
            }
        });
        
        // Spezifisch für die sichtbaren Produktkarten
        const visibleProducts = document.querySelectorAll('.product-card:not([style*="display: none"]), .addon-item, .suggestion-item');
        console.log(`Found ${visibleProducts.length} visible product cards`);
        
        visibleProducts.forEach(productCard => {
            // Finde Radio-Buttons innerhalb dieser Karte
            const colorRadios = productCard.querySelectorAll('input[type="radio"][name*="color"]');
            
            if (colorRadios.length > 0) {
                const hasSelection = Array.from(colorRadios).some(r => r.checked);
                if (!hasSelection) {
                    colorRadios[0].checked = true;
                    colorRadios[0].click();
                    console.log('✅ Selected first color for product card');
                }
            }
        });
        
        // Original-Code als Fallback
        const addonSections = document.querySelectorAll('.addon-products, .recommended-products, .suggestions-section, #addonProducts, #recommendedProducts');
        
        addonSections.forEach(section => {
            const addToCartButtons = section.querySelectorAll('.add-to-cart-btn, .addon-add-btn, button[onclick*="addToCart"]');
            
            addToCartButtons.forEach(button => {
                // Hole Produkt-ID
                const productId = button.getAttribute('data-product-id') || 
                                button.getAttribute('data-id') ||
                                button.dataset.productId;
                
                if (productId) {
                    // Lade Produktdaten
                    fetch('products.json')
                        .then(res => res.json())
                        .then(products => {
                            const product = products.find(p => p.id === parseInt(productId));
                            
                            if (product && product.colors && product.colors.length > 0) {
                                // Setze die erste Farbe als Standard
                                const firstColor = product.colors[0];
                                
                                // Speichere die ausgewählte Farbe im Button
                                button.setAttribute('data-selected-color', firstColor.name);
                                button.setAttribute('data-color-code', firstColor.code);
                                button.setAttribute('data-color-price', firstColor.price);
                                
                                // Modifiziere onclick um Farbe mitzugeben
                                const originalOnclick = button.getAttribute('onclick');
                                if (originalOnclick && !originalOnclick.includes('selectedColor')) {
                                    // Erweitere den onclick Handler
                                    button.onclick = function(e) {
                                        e.preventDefault();
                                        
                                        // Füge Farbe zum localStorage hinzu für dieses Produkt
                                        const colorKey = `selectedColor_${productId}`;
                                        localStorage.setItem(colorKey, JSON.stringify(firstColor));
                                        
                                        // Führe originalen onclick aus
                                        eval(originalOnclick);
                                    };
                                }
                                
                                console.log(`✅ Auto-selected color "${firstColor.name}" for product ${productId}`);
                            }
                        })
                        .catch(err => console.error('Error loading product colors:', err));
                }
            });
        });
    }
    
    // Überwache auch dynamisch hinzugefügte Buttons
    function observeNewButtons() {
        const observer = new MutationObserver((mutations) => {
            let hasNewButtons = false;
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            if (node.querySelector && (
                                node.querySelector('.add-to-cart-btn') ||
                                node.querySelector('.addon-add-btn') ||
                                node.classList?.contains('addon-products') ||
                                node.classList?.contains('recommended-products')
                            )) {
                                hasNewButtons = true;
                            }
                        }
                    });
                }
            });
            
            if (hasNewButtons) {
                setTimeout(autoSelectFirstColor, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialisierung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('🚀 Initialisiere Cart Addon Colors');
        
        // Mehrfache Ausführung mit verschiedenen Timings
        autoSelectFirstColor(); // Sofort
        setTimeout(autoSelectFirstColor, 100);   // Nach 100ms
        setTimeout(autoSelectFirstColor, 500);   // Nach 500ms
        setTimeout(autoSelectFirstColor, 1000);  // Nach 1 Sekunde
        setTimeout(autoSelectFirstColor, 2000);  // Nach 2 Sekunden
        setTimeout(autoSelectFirstColor, 3000);  // Nach 3 Sekunden
        
        // Überwache neue Buttons
        observeNewButtons();
        
        // Reagiere auf Scroll-Events (falls Inhalte lazy-loaded werden)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(autoSelectFirstColor, 300);
        });
        
        console.log('✅ Cart Addon Colors initialisiert');
    }
    
    // Exportiere für andere Scripts
    window.autoSelectFirstColor = autoSelectFirstColor;
})();
