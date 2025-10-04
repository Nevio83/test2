// Cart Addon Colors - Automatische Farbauswahl für Addons und Empfehlungen

(function() {
    console.log('🎨 Cart Addon Colors geladen');
    
    // Funktion um die erste Farbe für Addons/Empfehlungen zu setzen
    function autoSelectFirstColor() {
        console.log('🎨 Auto-selecting first color for addons...');
        
        // Spezifisch für Cart-Seite: Suche in "Das könnte Ihnen gefallen" Bereich
        const suggestionsSection = document.querySelector('#suggestions, .suggestions-section, [class*="suggestion"], #recommendedProducts, .recommended-section');
        if (suggestionsSection) {
            console.log('Found suggestions section');
            
            // Finde alle Farb-Radio-Buttons in diesem Bereich
            const colorRadios = suggestionsSection.querySelectorAll('input[type="radio"][name*="color"]');
            console.log(`Found ${colorRadios.length} color radios in suggestions`);
            
            // Gruppiere nach Namen und wähle jeweils den ersten aus
            const radioGroups = {};
            colorRadios.forEach(radio => {
                const name = radio.name;
                if (!radioGroups[name]) {
                    radioGroups[name] = [];
                }
                radioGroups[name].push(radio);
            });
            
            // Wähle den ersten in jeder Gruppe
            Object.values(radioGroups).forEach(group => {
                if (group.length > 0 && !group.some(r => r.checked)) {
                    group[0].checked = true;
                    group[0].click();
                    console.log(`✅ Selected first color for group: ${group[0].name}`);
                }
            });
        }
        
        // Allgemeine Suche als Fallback
        const allColorRadios = document.querySelectorAll('input[type="radio"][name*="color"]');
        console.log(`Found ${allColorRadios.length} color radio buttons total`);
        
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
        const visibleProducts = document.querySelectorAll('.product-card:not([style*="display: none"]), .addon-item, .suggestion-item, .cart-item');
        console.log(`Found ${visibleProducts.length} visible product cards`);
        
        visibleProducts.forEach(productCard => {
            // Finde Radio-Buttons innerhalb dieser Karte
            const colorRadios = productCard.querySelectorAll('input[type="radio"][name*="color"]');
            
            if (colorRadios.length > 0) {
                const hasSelection = Array.from(colorRadios).some(r => r.checked);
                if (!hasSelection) {
                    colorRadios[0].checked = true;
                    colorRadios[0].click();
                    console.log('✅ Selected first color radio for product card');
                }
            }
            
            // Finde Farb-Kreise (wie im Screenshot)
            const colorCircles = productCard.querySelectorAll('.color-circle, .color-option:not(label), div[style*="background-color"][onclick], div[style*="border-radius"][style*="background"]');
            console.log(`Found ${colorCircles.length} color circles in product card`);
            
            if (colorCircles.length > 0) {
                // Prüfe ob einer bereits ausgewählt ist
                const hasSelected = Array.from(colorCircles).some(circle => {
                    const hasCheckmark = circle.innerHTML.includes('✓') || 
                                       circle.querySelector('.checkmark') ||
                                       circle.querySelector('[class*="check"]');
                    const hasActiveClass = circle.classList.contains('selected') || 
                                          circle.classList.contains('active');
                    return hasCheckmark || hasActiveClass;
                });
                
                if (!hasSelected && colorCircles[0]) {
                    console.log('🎯 Clicking first color circle...');
                    colorCircles[0].click();
                    
                    // Füge Checkmark hinzu für visuelles Feedback
                    setTimeout(() => {
                        if (!colorCircles[0].innerHTML.includes('✓')) {
                            const checkmark = document.createElement('span');
                            checkmark.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:white;font-size:14px;font-weight:bold;pointer-events:none;';
                            checkmark.textContent = '✓';
                            colorCircles[0].style.position = 'relative';
                            colorCircles[0].appendChild(checkmark);
                        }
                    }, 50);
                    
                    console.log('✅ Selected first color circle for product card');
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
        
        // Spezielle Funktion für Cart-Items
        function selectFirstColorInCartItems() {
            // Suche spezifisch in Cart-Items
            const cartItems = document.querySelectorAll('.cart-item, [data-cart-item], .product-card');
            cartItems.forEach(item => {
                // Versuche Radio-Buttons zu finden
                const radios = item.querySelectorAll('input[type="radio"][name*="color"]');
                if (radios.length > 0 && !Array.from(radios).some(r => r.checked)) {
                    radios[0].checked = true;
                    console.log('✅ Selected first color radio in cart item');
                }
                
                // Versuche Farb-Kreise zu finden (wie im Bild)
                const colorCircles = item.querySelectorAll('.color-circle, .color-option, [class*="color"][onclick]');
                if (colorCircles.length > 0) {
                    // Prüfe ob einer bereits ausgewählt ist
                    const hasSelected = Array.from(colorCircles).some(circle => 
                        circle.classList.contains('selected') || 
                        circle.classList.contains('active') ||
                        circle.querySelector('.checkmark') ||
                        circle.innerHTML.includes('✓')
                    );
                    
                    if (!hasSelected) {
                        // Klicke auf den ersten Kreis
                        colorCircles[0].click();
                        console.log('✅ Clicked first color circle in cart item');
                        
                        // Füge visuelles Feedback hinzu
                        colorCircles[0].classList.add('selected');
                        if (!colorCircles[0].innerHTML.includes('✓')) {
                            colorCircles[0].innerHTML += '<span style="position:absolute;color:white;font-size:16px;">✓</span>';
                        }
                    }
                }
            });
        }
        
        // Mehrfache Ausführung mit verschiedenen Timings
        autoSelectFirstColor(); // Sofort
        selectFirstColorInCartItems(); // Sofort für Cart-Items
        
        setTimeout(() => {
            autoSelectFirstColor();
            selectFirstColorInCartItems();
        }, 100);
        
        setTimeout(() => {
            autoSelectFirstColor();
            selectFirstColorInCartItems();
        }, 500);
        
        setTimeout(() => {
            autoSelectFirstColor();
            selectFirstColorInCartItems();
        }, 1000);
        
        setTimeout(() => {
            autoSelectFirstColor();
            selectFirstColorInCartItems();
        }, 2000);
        
        setTimeout(() => {
            autoSelectFirstColor();
            selectFirstColorInCartItems();
        }, 3000);
        
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
