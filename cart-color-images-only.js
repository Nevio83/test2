// ============================================
// CART COLOR IMAGES ONLY - Nur bildbasierte Farbauswahl
// Keine Farbkreise, nur Produktbilder für Farbauswahl
// ============================================

console.log('🖼️ Cart Color Images Only geladen');

async function renderImageColorSelection(item, container) {
    console.log('🎨 renderImageColorSelection aufgerufen für:', item.name, 'ID:', item.id);
    
    // Create a unique ID for this instance to avoid CSS conflicts
    const uniqueId = `_${Math.random().toString(36).substr(2, 9)}`;

    // Define class names with the unique ID
    const classNames = {
        selection: `cart-item-color-selection-${uniqueId}`,
        mainLabel: `cart-color-main-label-${uniqueId}`,
        scroll: `cart-color-options-scroll-${uniqueId}`,
        option: `cart-color-option-${uniqueId}`,
        selected: `selected-${uniqueId}`
    };

    // Inject styles for these unique classes
    const styles = `
        .${classNames.selection} {
            margin-top: 15px;
            margin-bottom: 10px;
            width: 100%;
            box-sizing: border-box; /* Stellt sicher, dass Padding die Breite nicht beeinflusst */
            grid-column: 1 / -1; /* Erstreckt sich über alle Grid-Spalten */
        }
        .${classNames.mainLabel} {
            font-weight: 600; font-size: 16px; margin-bottom: 12px; display: block; color: #333;
        }
        .${classNames.scroll} {
            display: flex; overflow-x: auto; padding-bottom: 15px; gap: 15px;
            scrollbar-width: thin; scrollbar-color: #E91E63 #f1f1f1;
        }
        .${classNames.option} {
            flex-shrink: 0; position: relative;
        }
        .${classNames.option} input { display: none; }
        .${classNames.option} label {
            display: flex; flex-direction: column; align-items: center; cursor: pointer;
            border: 2px solid #e0e0e0; border-radius: 12px; padding: 8px; width: 100px;
            background-color: #fff; transition: all 0.2s ease-in-out;
        }
        .${classNames.option} label img {
            width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px; border-radius: 8px;
        }
        .${classNames.option} label span { font-size: 14px; font-weight: 500; text-align: center; color: #555; }
        .${classNames.option}.${classNames.selected} label { border-color: #E91E63; box-shadow: 0 0 10px rgba(233, 30, 99, 0.3); }
        .${classNames.option}.${classNames.selected} label::after {
            content: '✓'; position: absolute; top: 5px; right: 5px; background-color: #E91E63; color: white;
            width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: bold;
        }
        .${classNames.scroll}::-webkit-scrollbar { height: 12px; }
        .${classNames.scroll}::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .${classNames.scroll}::-webkit-scrollbar-thumb { background: #E91E63; border-radius: 10px; }
        .${classNames.scroll}::-webkit-scrollbar-thumb:hover { background: #c2185b; }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    if (item.isBundle || item.name.includes('Sets)') || item.name.includes('Bundle')) return;

    try {
        const response = await fetch('products.json');
        const products = await response.json();
        const product = products.find(p => p.id === parseInt(item.id));

        if (!product || !product.colors || product.colors.length === 0) return;

        const currentColor = extractColorFromName(item.name) || product.colors[0].name;
        const isModelProduct = item.id === 21;
        const selectionLabel = isModelProduct ? 'Modell:' : 'Set:';

        const selectionContainer = document.createElement('div');
        selectionContainer.className = classNames.selection;

        const labelSpan = document.createElement('span');
        labelSpan.className = classNames.mainLabel;
        labelSpan.textContent = selectionLabel;
        selectionContainer.appendChild(labelSpan);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = classNames.scroll;
        selectionContainer.appendChild(optionsContainer);

        product.colors.forEach(color => {
            const optionDiv = document.createElement('div');
            optionDiv.className = `${classNames.option} cart-color-option`;
            if (color.name === currentColor) optionDiv.classList.add(classNames.selected);

            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `cart-${item.id}-color-${color.name.toLowerCase().replace(/\s+/g, '-')}-${uniqueId}`;
            input.name = `cartColor-${item.id}-${uniqueId}`;
            input.value = color.name;
            if (color.name === currentColor) input.checked = true;

            const label = document.createElement('label');
            label.htmlFor = input.id;

            const img = document.createElement('img');
            img.src = getColorSpecificImagePath(product, color.name);
            img.alt = color.name;
            img.className = 'cart-color-image';
            img.onerror = () => { img.src = product.image; };

            const nameSpan = document.createElement('span');
            nameSpan.className = 'cart-color-name';
            nameSpan.textContent = color.name;

            label.appendChild(img);
            label.appendChild(nameSpan);
            optionDiv.appendChild(input);
            optionDiv.appendChild(label);
            optionsContainer.appendChild(optionDiv);
        });

        const oldSelection = container.querySelector(`[class^='cart-item-color-selection-']`);
        if (oldSelection) oldSelection.remove();

        container.appendChild(selectionContainer);

        // Update the main image immediately
        const mainImage = container.closest('.cart-item').querySelector('.cart-item-image');
        if (mainImage) {
            mainImage.src = getColorSpecificImagePath(product, currentColor);
        }

        // Event-Listener für Farbauswahl - sowohl auf Radio als auch auf Label
        optionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const colorName = e.target.value;
                console.log('🎨 Farbe ausgewählt:', colorName);
                optionsContainer.querySelectorAll(`.${classNames.option}`).forEach(opt => opt.classList.remove(classNames.selected));
                e.target.closest(`.${classNames.option}`).classList.add(classNames.selected);

                let cart = JSON.parse(localStorage.getItem('cart') || '[]');
                const itemIndex = cart.findIndex(cartItem => cartItem.id == item.id);
                if (itemIndex !== -1) {
                    // Entferne bestehende Farbangabe aus dem Namen
                    const baseName = cart[itemIndex].name.replace(/\s*\([^)]*\)$/, '');
                    const newName = `${baseName} (${colorName})`;
                    
                    cart[itemIndex].name = newName;
                    cart[itemIndex].selectedColor = colorName;
                    localStorage.setItem('cart', JSON.stringify(cart));

                    // Update Name im DOM - alle möglichen Selektoren versuchen
                    const cartItem = container.closest('.cart-item');
                    console.log('🔍 Suche Name-Element in:', cartItem);
                    
                    const possibleSelectors = [
                        'h5', 'h4', 'h3', 'h2', 'h1',
                        '.product-name', '.cart-item-name', '.item-name',
                        '[class*="name"]', '[class*="title"]',
                        'strong', 'b', '.fw-bold'
                    ];
                    
                    let nameElement = null;
                    for (const selector of possibleSelectors) {
                        nameElement = cartItem.querySelector(selector);
                        if (nameElement && nameElement.textContent.includes('Elektrischer Wasserspender')) {
                            console.log('✅ Name-Element gefunden mit Selektor:', selector);
                            break;
                        }
                    }
                    
                    if (nameElement) {
                        nameElement.textContent = newName;
                        console.log('📝 Produktname aktualisiert:', newName);
                    } else {
                        console.warn('⚠️ Name-Element nicht gefunden, verfügbare Elemente:');
                        console.log(cartItem.innerHTML);
                    }

                    setTimeout(() => {
                        const imgElement = container.closest('.cart-item').querySelector('.cart-item-image');
                        if (imgElement) imgElement.src = getColorSpecificImagePath(product, colorName);
                    }, 100);
                }
            });
        });
        
        // Zusätzliche Event-Listener für Labels (falls Radio-Buttons nicht funktionieren)
        optionsContainer.querySelectorAll('label').forEach(label => {
            label.addEventListener('click', (e) => {
                const radio = label.querySelector('input[type="radio"]') || document.getElementById(label.getAttribute('for'));
                if (radio && !radio.checked) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                    console.log('🖱️ Label geklickt, Radio aktiviert:', radio.value);
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
            'Schwarz': 'produkt bilder/Indoor Sensing Wall Lamp bilder/Indoor Sensing Wall Lamp schwarz.jpg',
            'Weiß': 'produkt bilder/Indoor Sensing Wall Lamp bilder/Indoor Sensing Wall Lamp weiß.jpg'
        },
        33: { // Aromatherapy Essential Oil Humidifier
            'Cherry Blossoms': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier Cherry blossoms.jpg',
            'Green Tea': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier green tea.jpg',
            'Jasmine': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier jasmine.jpg',
            'Lavender': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lavender.jpg',
            'Lemon': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lemon.jpg',
            'Lily': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lily.jpg',
            'Ocean': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier ocean.jpg',
            'Rose': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier rose.jpg',
            'Sandalwood': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier sandalwood.jpg',
            'Sweet': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier sweet.jpg',
            'Vanilla': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier vanilla.jpg',
            'Violet': 'produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier violet.jpg'
        },
        34: { // Moisturizing Face Steamer
            'Blau': 'produkt bilder/Moisturizing Face Steamer bilder/Moisturizing Face Steamer blau.jpg',
            'Weiß': 'produkt bilder/Moisturizing Face Steamer bilder/Moisturizing Face Steamer weiß.jpg'
        },
        35: { // Thermal Neck Lifting And Tighten Massager
            'Schwarz': 'produkt bilder/Thermal Neck Lifting And Tighten Massager bilder/Thermal Neck Lifting And Tighten Massager schwarz.jpg',
            'Weiß': 'produkt bilder/Thermal Neck Lifting And Tighten Massager bilder/Thermal Neck Lifting And Tighten Massager weiß.jpg'
        },
        38: { // Jade Massager
            'Schwarz': 'produkt bilder/Jade Massager bilder/Jade Massager schwarz.jpg',
            'Grün': 'produkt bilder/Jade Massager bilder/Jade Massager grün.jpg',
            'Hellgrün': 'produkt bilder/Jade Massager bilder/Jade Massager hell grün.jpg',
            'Pink': 'produkt bilder/Jade Massager bilder/Jade Massager pink.jpg',
            'Lila': 'produkt bilder/Jade Massager bilder/Jade Massager lila.jpg',
            'Weiß': 'produkt bilder/Jade Massager bilder/Jade Massager weiß.jpg',
            'Gelb': 'produkt bilder/Jade Massager bilder/Jade Massager gelb.jpg'
        },
        40: { // Mug Warmer Pad
            'Pink': 'produkt bilder/Mug Warmer Pad bilder/Mug Warmer Pad pink.jpg',
            'Grün': 'produkt bilder/Mug Warmer Pad bilder/Mug Warmer Pad grün.jpg',
            'Weiß': 'produkt bilder/Mug Warmer Pad bilder/Mug Warmer Pad weiß.jpg'
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
                            const newName = `${baseName} (${colorName})`;
                            updatedCart[itemIndex].name = newName;
                            updatedCart[itemIndex].selectedColor = colorName;
                            localStorage.setItem('cart', JSON.stringify(updatedCart));
                            
                            // Update UI - alle möglichen Selektoren versuchen
                            console.log('🔍 Suche Name-Element für automatische Aktualisierung...');
                            
                            const possibleSelectors = [
                                'h5', 'h4', 'h3', 'h2', 'h1',
                                '.product-name', '.cart-item-name', '.item-name',
                                '[class*="name"]', '[class*="title"]',
                                'strong', 'b', '.fw-bold'
                            ];
                            
                            let nameElement = null;
                            for (const selector of possibleSelectors) {
                                nameElement = itemElement.querySelector(selector);
                                if (nameElement && (nameElement.textContent.includes(baseName) || nameElement.textContent.includes('Wasserspender'))) {
                                    console.log('✅ Name-Element für Auto-Update gefunden mit:', selector);
                                    nameElement.textContent = newName;
                                    console.log('📝 Produktname automatisch aktualisiert:', newName);
                                    break;
                                }
                            }
                            
                            if (!nameElement) {
                                console.warn('⚠️ Name-Element für automatische Aktualisierung nicht gefunden');
                                console.log('🔍 Verfügbare Elemente im Cart-Item:');
                                console.log(itemElement.innerHTML);
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
<<<<<<< Updated upstream
=======
            
            let result;
            try {
                // Rufe originale Funktion auf
                result = originalUpdateCartPage.apply(this, arguments);
            } catch (error) {
                console.warn('⚠️ Fehler in originalUpdateCartPage:', error);
                // Trotzdem weitermachen mit Farbauswahl
            }
            
            console.log('🔄 Füge Farbauswahl-Timeout hinzu...');
>>>>>>> Stashed changes
            
            // SOFORT Farbauswahl hinzufügen, bevor originale Funktion
            setTimeout(() => {
                console.log('🔄 Timeout erreicht, suche nach Cart Items...');
                const cartItems = document.querySelectorAll('.cart-item');
                const cart = JSON.parse(localStorage.getItem('cart') || '[]');
                
                console.log('🛒 Füge Farbauswahl zu', cartItems.length, 'Cart Items hinzu');
                console.log('🛒 Cart Inhalt:', cart);
                
                cartItems.forEach((itemElement, index) => {
                    if (cart[index]) {
                        console.log(`🛒 Prüfe Item ${index}:`, cart[index].name, 'ID:', cart[index].id);
                        
                        // Prüfe ob bereits Farbauswahl vorhanden
                        if (!itemElement.querySelector('.cart-item-color-selection')) {
                            console.log(`🎨 Starte Farbauswahl für Item ${index}`);
                            renderImageColorSelection(cart[index], itemElement);
                            
                            // Sofort nach dem Rendern prüfen ob Name aktualisiert werden muss
                            setTimeout(() => {
                                const item = cart[index];
                                const hasColorInName = item.name.match(/\(([^)]+)\)$/);
                                
                                if (!hasColorInName) {
                                    console.log('🎯 SOFORT-CHECK: Produkt hat keine Farbe im Namen:', item.name);
                                    
                                    const colorSelection = itemElement.querySelector('[class*="cart-item-color-selection"]');
                                    if (colorSelection) {
                                        const firstRadio = colorSelection.querySelector('input[type="radio"]:checked');
                                        if (firstRadio) {
                                            const colorName = firstRadio.value;
                                            const baseName = item.name.replace(/\s*\([^)]*\)$/, '');
                                            const newName = `${baseName} (${colorName})`;
                                            
                                            console.log('🔄 Aktualisiere Name von', baseName, 'zu', newName);
                                            
                                            // Update localStorage
                                            let updatedCart = JSON.parse(localStorage.getItem('cart') || '[]');
                                            const itemIndex = updatedCart.findIndex(cartItem => cartItem.id == item.id);
                                            if (itemIndex !== -1) {
                                                updatedCart[itemIndex].name = newName;
                                                updatedCart[itemIndex].selectedColor = colorName;
                                                localStorage.setItem('cart', JSON.stringify(updatedCart));
                                                
                                                // Update UI - einfacher Ansatz
                                                const nameElement = itemElement.querySelector('h5') || itemElement.querySelector('h4') || itemElement.querySelector('strong');
                                                if (nameElement) {
                                                    nameElement.textContent = newName;
                                                    console.log('✅ Name erfolgreich aktualisiert!');
                                                } else {
                                                    console.warn('⚠️ Name-Element nicht gefunden');
                                                }
                                            }
                                        }
                                    }
                                }
                            }, 500);
                        } else {
                            console.log(`⏭️ Farbauswahl bereits vorhanden für Item ${index}`);
                        }
                    }
                });
                
                // Korrigiere erste Farbauswahl nach dem Rendern
                ensureFirstColorSelected();
            }, 200);
            
            // Dann versuche originale Funktion (mit Try-Catch)
            let result;
            try {
                result = originalUpdateCartPage.apply(this, arguments);
            } catch (error) {
                console.warn('⚠️ Fehler in originalUpdateCartPage:', error);
                // Farbauswahl läuft trotzdem weiter
            }
            
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


// Exportiere Funktionen
window.renderImageColorSelection = renderImageColorSelection;
window.ensureFirstColorSelected = ensureFirstColorSelected;

console.log('✅ Cart Color Images Only vollständig geladen - Nur bildbasierte Farbauswahl aktiv');
