// ============================================
// CART COLORS COMPLETE - Alle Cart-Farb-Funktionen
// Vereint: cart-color-images.js, cart-color-selector.js, 
//         cart-addon-colors.js, cart-addon-color-renderer.js
// ============================================

console.log('🎨 Cart Colors Complete geladen');

// ============================================
// TEIL 1: CART COLOR IMAGES
// ============================================

(function() {
    console.log('🎨 Cart Color Images Modul geladen');
    
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
        const colorMatch = productName.match(/\(([^)]+)\)$/);
        if (colorMatch) {
            return colorMatch[1].trim();
        }
        return null;
    }
    
    // Funktion zum Holen der ausgewählten Farbe aus dem Color Selector
    function getSelectedColorFromSelector(productId) {
        const selector = document.querySelector(`.cart-color-selector[data-product-id="${productId}"]`);
        if (selector) {
            const selectedRadio = selector.querySelector('input[type="radio"]:checked');
            if (selectedRadio) {
                return selectedRadio.value;
            }
        }
        
        const colorKey = `selectedColor_${productId}`;
        const storedColor = localStorage.getItem(colorKey);
        if (storedColor) {
            try {
                const colorData = JSON.parse(storedColor);
                return colorData.name || colorData;
            } catch {
                return storedColor;
            }
        }
        
        return null;
    }
    
    // Funktion zum Aktualisieren der Produktbilder
    function updateCartProductImages() {
        console.log('🖼️ Aktualisiere Warenkorb-Bilder nach Farbe');
        
        const cartItems = document.querySelectorAll('.cart-item, .cart-product, [data-cart-item]');
        
        cartItems.forEach(item => {
            const img = item.querySelector('img');
            if (!img) return;
            
            const nameElement = item.querySelector('.product-name, .cart-item-name, h5, h6');
            if (!nameElement) return;
            
            const fullName = nameElement.textContent.trim();
            
            // Überspringe Bundles - sie sollen immer das Hauptbild behalten
            if (fullName.includes('Sets') || fullName.includes('Bundle') || item.getAttribute('data-is-bundle') === 'true' || item.classList.contains('bundle-item')) {
                console.log('⏭️ Überspringe Bundle (Hauptbild beibehalten):', fullName);
                return;
            }
            
            let color = extractColorFromName(fullName);
            
            if (!color) {
                const productIdAttr = item.getAttribute('data-product-id') || 
                                     item.getAttribute('data-id');
                
                if (productIdAttr) {
                    color = getSelectedColorFromSelector(productIdAttr);
                    if (color) {
                        console.log(`✅ Farbe aus Selector geholt: ${color} für Produkt ${productIdAttr}`);
                    }
                }
                
                if (!color) {
                    if (fullName.includes('Hair Brush')) {
                        color = getSelectedColorFromSelector(26) || 'Roland Purple';
                        console.log(`📌 Using color for Hair Brush: ${color}`);
                    } else if (fullName.includes('Mixer')) {
                        color = getSelectedColorFromSelector(11) || 'Weiß';
                    } else if (fullName.includes('Wasserspender')) {
                        color = getSelectedColorFromSelector(10) || 'Blau';
                    } else if (fullName.includes('Bluetooth')) {
                        color = getSelectedColorFromSelector(17) || 'Schwarz';
                    }
                }
            }
            
            if (!color) {
                console.log('❌ Keine Farbe gefunden in:', fullName);
                return;
            }
            
            let productId = item.getAttribute('data-product-id');
            
            if (!productId) {
                for (const [id, mappings] of Object.entries(colorImageMappings)) {
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
            
            const mapping = colorImageMappings[productId];
            const newImageSrc = mapping[color] || mapping['default'];
            
            if (newImageSrc) {
                console.log(`✅ Ändere Bild für ${fullName} zu:`, newImageSrc);
                img.src = newImageSrc;
                img.alt = fullName;
            }
        });
    }
    
    // Initialisierung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCartColorImages);
    } else {
        initCartColorImages();
    }
    
    function initCartColorImages() {
        setTimeout(updateCartProductImages, 500);
        
        const observer = new MutationObserver(() => {
            setTimeout(updateCartProductImages, 100);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['src', 'data-product-id']
        });
        
        document.addEventListener('cart-updated', updateCartProductImages);
        window.addEventListener('cartUpdated', updateCartProductImages);
        
        setInterval(updateCartProductImages, 2000);
        
        console.log('✅ Cart Color Images initialisiert');
    }
    
    window.updateCartProductImages = updateCartProductImages;
})();

// ============================================
// TEIL 2: CART ADDON COLORS (Auto-Select)
// ============================================

(function() {
    console.log('🎨 Cart Addon Colors Modul geladen');
    
    function autoSelectFirstColor() {
        console.log('🎨 Auto-selecting first color for addons...');
        
        const suggestionsSection = document.querySelector('#suggestions, .suggestions-section, [class*="suggestion"], #recommendedProducts, .recommended-section');
        if (suggestionsSection) {
            console.log('Found suggestions section');
            
            const colorRadios = suggestionsSection.querySelectorAll('input[type="radio"][name*="color"]');
            console.log(`Found ${colorRadios.length} color radios in suggestions`);
            
            const radioGroups = {};
            colorRadios.forEach(radio => {
                const name = radio.name;
                if (!radioGroups[name]) {
                    radioGroups[name] = [];
                }
                radioGroups[name].push(radio);
            });
            
            Object.values(radioGroups).forEach(group => {
                if (group.length > 0 && !group.some(r => r.checked)) {
                    group[0].checked = true;
                    group[0].click();
                    console.log(`✅ Selected first color for group: ${group[0].name}`);
                }
            });
        }
        
        const allColorRadios = document.querySelectorAll('input[type="radio"][name*="color"]');
        console.log(`Found ${allColorRadios.length} color radio buttons total`);
        
        const radioGroups = {};
        allColorRadios.forEach(radio => {
            const name = radio.name;
            if (!radioGroups[name]) {
                radioGroups[name] = [];
            }
            radioGroups[name].push(radio);
        });
        
        Object.keys(radioGroups).forEach(groupName => {
            const radios = radioGroups[groupName];
            const hasSelection = radios.some(r => r.checked);
            
            if (!hasSelection && radios.length > 0) {
                console.log(`Selecting first color for group: ${groupName}`);
                radios[0].checked = true;
                const event = new Event('change', { bubbles: true });
                radios[0].dispatchEvent(event);
            }
        });
        
        const visibleProducts = document.querySelectorAll('.product-card:not([style*="display: none"]), .addon-item, .suggestion-item, .cart-item');
        console.log(`Found ${visibleProducts.length} visible product cards`);
        
        visibleProducts.forEach(productCard => {
            const colorRadios = productCard.querySelectorAll('input[type="radio"][name*="color"]');
            
            if (colorRadios.length > 0) {
                const hasSelection = Array.from(colorRadios).some(r => r.checked);
                if (!hasSelection) {
                    colorRadios[0].checked = true;
                    colorRadios[0].click();
                    console.log('✅ Selected first color radio for product card');
                }
            }
            
            const colorCircles = productCard.querySelectorAll('.color-circle, .color-option:not(label), div[style*="background-color"][onclick], div[style*="border-radius"][style*="background"]');
            console.log(`Found ${colorCircles.length} color circles in product card`);
            
            if (colorCircles.length > 0) {
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
    }
    
    function selectFirstColorInCartItems() {
        const cartItems = document.querySelectorAll('.cart-item, [data-cart-item], .product-card');
        cartItems.forEach(item => {
            const radios = item.querySelectorAll('input[type="radio"][name*="color"]');
            if (radios.length > 0 && !Array.from(radios).some(r => r.checked)) {
                radios[0].checked = true;
                console.log('✅ Selected first color radio in cart item');
            }
            
            const colorCircles = item.querySelectorAll('.color-circle, .color-option, [class*="color"][onclick]');
            if (colorCircles.length > 0) {
                const hasSelected = Array.from(colorCircles).some(circle => 
                    circle.classList.contains('selected') || 
                    circle.classList.contains('active') ||
                    circle.querySelector('.checkmark') ||
                    circle.innerHTML.includes('✓')
                );
                
                if (!hasSelected) {
                    colorCircles[0].click();
                    console.log('✅ Clicked first color circle in cart item');
                    
                    colorCircles[0].classList.add('selected');
                    if (!colorCircles[0].innerHTML.includes('✓')) {
                        colorCircles[0].innerHTML += '<span style="position:absolute;color:white;font-size:16px;">✓</span>';
                    }
                }
            }
        });
    }
    
    function observeNewButtons() {
        const observer = new MutationObserver((mutations) => {
            let hasNewButtons = false;
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
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
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAddonColors);
    } else {
        initAddonColors();
    }
    
    function initAddonColors() {
        console.log('🚀 Initialisiere Cart Addon Colors');
        
        autoSelectFirstColor();
        selectFirstColorInCartItems();
        
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
        
        observeNewButtons();
        
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(autoSelectFirstColor, 300);
        });
        
        console.log('✅ Cart Addon Colors initialisiert');
    }
    
    window.autoSelectFirstColor = autoSelectFirstColor;
})();

// ============================================
// TEIL 3: CART COLOR SELECTOR (Farbauswahl im Warenkorb)
// ============================================

(function() {
    console.log('🎨 Cart Color Selector Modul geladen');
    
    // Funktion zum Hinzufügen der Farbauswahl zu Cart-Items
    function addColorSelectorsToCart() {
        const cartItems = document.querySelectorAll('.cart-item, .cart-product');
        
        cartItems.forEach(item => {
            // Prüfe ob bereits ein Color Selector existiert
            if (item.querySelector('.cart-color-selector')) return;
            
            // SKIP BUNDLES - keine Farbauswahl für Bundles
            const nameElement = item.querySelector('.product-name, .cart-item-name, h5, h6');
            if (nameElement) {
                const itemName = nameElement.textContent;
                if (itemName.includes('Sets)') || itemName.includes('Bundle')) {
                    console.log('⏭️ Überspringe Farbauswahl für Bundle:', itemName);
                    return;
                }
            }
            
            // Hole Produkt-ID
            const productId = item.getAttribute('data-product-id') || 
                            item.getAttribute('data-id');
            
            if (!productId) return;
            
            // Lade Produktdaten
            fetch('products.json')
                .then(res => res.json())
                .then(products => {
                    const product = products.find(p => p.id == productId);
                    
                    if (!product || !product.colors || product.colors.length === 0) return;
                    
                    // Erstelle Color Selector HTML
                    const colorSelectorHTML = `
                        <div class="cart-color-selector" data-product-id="${productId}">
                            <div class="color-options-cart">
                                ${product.colors.map(color => `
                                    <label class="color-option-cart">
                                        <input type="radio" 
                                               name="cart-color-${productId}" 
                                               value="${color.name}"
                                               data-color-code="${color.code}"
                                               data-price="${color.price}">
                                        <span class="color-circle-cart" 
                                              style="background-color: ${color.code};"
                                              title="${color.name}"></span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    
                    // Füge Selector nach dem Produktnamen ein
                    const nameElement = item.querySelector('.product-name, .cart-item-name, h5, h6');
                    if (nameElement) {
                        nameElement.insertAdjacentHTML('afterend', colorSelectorHTML);
                        
                        // Event Listener für Farbwechsel
                        const selector = item.querySelector('.cart-color-selector');
                        selector.addEventListener('change', (e) => {
                            const selectedColor = e.target.value;
                            const colorCode = e.target.getAttribute('data-color-code');
                            
                            // Update Produktname
                            const baseName = product.name;
                            nameElement.textContent = `${baseName} (${selectedColor})`;
                            
                            // Speichere Auswahl
                            localStorage.setItem(`selectedColor_${productId}`, JSON.stringify({
                                name: selectedColor,
                                code: colorCode
                            }));
                            
                            // Trigger Image Update
                            if (typeof updateCartProductImages === 'function') {
                                updateCartProductImages();
                            }
                        });
                        
                        // Setze aktuelle Farbe
                        const currentName = nameElement.textContent;
                        const colorMatch = currentName.match(/\(([^)]+)\)$/);
                        if (colorMatch) {
                            const currentColor = colorMatch[1];
                            const radio = selector.querySelector(`input[value="${currentColor}"]`);
                            if (radio) radio.checked = true;
                        }
                    }
                })
                .catch(err => console.error('Error loading products for cart selectors:', err));
        });
    }
    
    // Initialisierung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCartSelectors);
    } else {
        initCartSelectors();
    }
    
    function initCartSelectors() {
        // Initial hinzufügen
        setTimeout(addColorSelectorsToCart, 500);
        
        // Bei Cart-Updates
        document.addEventListener('cart-updated', addColorSelectorsToCart);
        window.addEventListener('cartUpdated', addColorSelectorsToCart);
        
        // Observer für dynamische Änderungen
        const observer = new MutationObserver(() => {
            setTimeout(addColorSelectorsToCart, 100);
        });
        
        const cartContent = document.getElementById('cartContent');
        if (cartContent) {
            observer.observe(cartContent, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // CSS für Cart Color Selector
    const style = document.createElement('style');
    style.textContent = `
        .cart-color-selector {
            margin: 10px 0;
        }
        
        .color-options-cart {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .color-option-cart {
            position: relative;
        }
        
        .color-option-cart input[type="radio"] {
            display: none;
        }
        
        .color-circle-cart {
            display: inline-block;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid #ddd;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .color-option-cart input[type="radio"]:checked + .color-circle-cart {
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        
        .color-circle-cart:hover {
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);
    
    console.log('✅ Cart Color Selector initialisiert');
})();

console.log('✅ Cart Colors Complete vollständig geladen');
