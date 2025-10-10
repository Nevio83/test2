// Währungseinstellungen nach Land
const currencyByCountry = {
    'DE': { symbol: '€', code: 'EUR', name: 'Deutschland' },
    'US': { symbol: '$', code: 'USD', name: 'Vereinigte Staaten' },
    'GB': { symbol: '£', code: 'GBP', name: 'Vereinigtes Königreich' },
    'FR': { symbol: '€', code: 'EUR', name: 'Frankreich' },
    'IT': { symbol: '€', code: 'EUR', name: 'Italien' },
    'ES': { symbol: '€', code: 'EUR', name: 'Spanien' },
    'AT': { symbol: '€', code: 'EUR', name: 'Österreich' },
    'CH': { symbol: 'CHF', code: 'CHF', name: 'Schweiz' },
    'NL': { symbol: '€', code: 'EUR', name: 'Niederlande' },
    'BE': { symbol: '€', code: 'EUR', name: 'Belgien' },
    'CA': { symbol: 'CAD$', code: 'CAD', name: 'Kanada' },
    'AU': { symbol: 'AUD$', code: 'AUD', name: 'Australien' },
    'JP': { symbol: '¥', code: 'JPY', name: 'Japan' },
    'BR': { symbol: 'R$', code: 'BRL', name: 'Brasilien' },
    'MX': { symbol: 'MX$', code: 'MXN', name: 'Mexiko' }
};

// Verwende currencyByCountry als COUNTRIES für Konsistenz
const COUNTRIES = currencyByCountry;

let currentCountry = 'DE';
let currentCurrency = currencyByCountry['DE']; // Initialisiere currentCurrency mit Deutschland als Standard

// Funktion zum Abrufen des farbspezifischen Bildes
function getCartItemImage(item) {
    console.log('🖼️ getCartItemImage aufgerufen für:', item.name, 'ID:', item.id);
    
    // Extrahiere Farbe aus dem Namen - suche nach dem letzten Klammerpaar
    let colorMatch = item.name.match(/\(([^)]+)\)(?!.*\([^)]*\))/);
    let color = null;
    
    if (colorMatch) {
        color = colorMatch[1];
        console.log('🎨 Extrahierte Farbe:', color);
        
        // Zusätzliches Debugging für Bundle-Namen
        if (item.name.includes('Sets')) {
            console.log('⚠️ Bundle-Produkt erkannt, Name:', item.name);
            // Bei Bundles die erste Farbe extrahieren (nicht "Sets")
            const allMatches = [...item.name.matchAll(/\(([^)]+)\)/g)];
            console.log('🔍 Alle gefundenen Klammern:', allMatches.map(m => m[1]));
            
            for (const match of allMatches) {
                if (!match[1].includes('Sets') && !match[1].includes('Set')) {
                    color = match[1];
                    console.log('🎨 Bundle Farbe gewählt:', color);
                    break;
                }
            }
        }
    }
    
    if (color) {
        
        // Produkt 10 - Elektrischer Wasserspender
        if (item.id == 10) {  // Verwende == für Type-Coercion
            if (color === 'Schwarz') {
                const path = 'produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Elektrischer Wasserspender für Schreibtisch schwarz.jpg';
                console.log('💧 Wasserspender Schwarz Bild:', path);
                return path;
            } else if (color === 'Weiß') {
                const path = 'produkt bilder/Elektrischer Wasserspender für Schreibtisch bilder/Elektrischer Wasserspender für Schreibtisch weiß.jpg';
                console.log('💧 Wasserspender Weiß Bild:', path);
                return path;
            }
        }
        
        // Produkt 11 - Elektrischer Mixer
        if (item.id == 11) {  // Verwende == für Type-Coercion
            if (color === 'Weiß') {
                const path = 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Weiß.jpg';
                console.log('🥤 Mixer Weiß Bild:', path);
                return path;
            } else if (color === 'Rosa') {
                const path = 'produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Rosa.png';
                console.log('🥤 Mixer Rosa Bild:', path);
                return path;
            }
        }
        
        // Produkt 17 - Bluetooth Finder
        if (item.id == 17) {  // Verwende == für Type-Coercion
            if (color === 'Schwarz') {
                return 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen schwarz.png';
            } else if (color === 'Weiß') {
                return 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen weiß.png';
            } else if (color === 'Grün') {
                return 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen grün.png';
            } else if (color === 'Pink') {
                return 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen bilder/Bluetooth Anti-Lost Finder Wassertropfen pink.png';
            }
        }
        
        // Produkt 18 - Home Electronic Clock
        if (item.id == 18) {
            // Beide Farben verwenden das gleiche Bild
            const path = 'produkt bilder/Home Electronic Clock Digitale Uhr.jpeg';
            console.log('🕐 Clock Bild für Farbe', color + ':', path);
            return path;
        }
        
        // Produkt 21 - LED Water Ripple Crystal
        if (item.id == 21) {  // Verwende == statt === für Type-Coercion
            console.log('🔮 Produkt 21 erkannt, Farbe:', color);
            if (color === 'Crown') {
                const path = 'produkt bilder/LED Water Ripple Crystal bilder/LED Water Ripple Crystal crown.png';
                console.log('👑 Crown Bild gewählt:', path);
                return path;
            } else if (color === 'Square') {
                const path = 'produkt bilder/LED Water Ripple Crystal bilder/LED Water Ripple Crystal square.png';
                console.log('⬜ Square Bild gewählt:', path);
                return path;
            }
        }
        
        // Produkt 26 - Hair Brush
        if (item.id == 26) {  // Verwende == für Type-Coercion
            if (color === 'Roland Purple') {
                return 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush roland purple.jpg';
            } else if (color === 'Lunar Rock') {
                return 'produkt bilder/4 In 1 Self Cleaning Hair Brush bilder/4 In 1 Self Cleaning Hair Brush lunar rock.jpg';
            }
        }
    } else {
        console.log('❌ Keine Farbe im Namen gefunden:', item.name);
        console.log('🔍 Regex-Test:', item.name.match(/\(([^)]+)\)/g));
    }
    
    console.log('⚠️ Verwende Standard-Bild:', item.image);
    return item.image;
}

// Funktion für Bildladen-Fehlerbehandlung
function handleImageError(imgElement, itemName, attemptedPath) {
    console.error('❌ Bild konnte nicht geladen werden:', attemptedPath, 'für Produkt:', itemName);
    
    // Fallback zu Standard-Bild
    const fallbackPath = 'produkt bilder/ware.png';
    console.log('🔄 Verwende Fallback-Bild:', fallbackPath);
    
    if (imgElement.src !== fallbackPath) {
        imgElement.src = fallbackPath;
        imgElement.alt = itemName + ' (Bild nicht verfügbar)';
    }
}

// Globale Funktion für HTML-Template
window.handleImageError = handleImageError;

// Funktion zum Abrufen des Warenkorbs
function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        return cart;
    } catch (e) {
        console.error("Fehler beim Laden des Warenkorbs:", e);
        return [];
    }
}

// Funktion zum Rendern des Warenkorbs
function renderCart() {
    updateCartPage();
}

// Funktion zum Speichern des Warenkorbs mit Farbauswahl
function saveCartWithColor(cart) {
    // Stelle sicher, dass Farben korrekt gespeichert werden
    const processedCart = cart.map(item => {
        // Wenn selectedColor vorhanden ist, stelle sicher dass der Name die Farbe enthält
        if (item.selectedColor && !item.name.includes(`(${item.selectedColor})`)) {
            item.name = item.name.replace(/\s*\([^)]*\)$/, '') + ` (${item.selectedColor})`;
        }
        return item;
    });
    localStorage.setItem('cart', JSON.stringify(processedCart));
    console.log('🛒 Warenkorb mit Farbauswahl gespeichert:', processedCart);
}

const currencyConversion = {
    'EUR': 1,
    'USD': 1.08,
    'GBP': 0.85,
    'CHF': 0.95,
    'CAD': 1.45,
    'AUD': 1.65,
    'JPY': 170,
    'BRL': 5.5,
    'MXN': 19.5
};

function convertPrice(eurPrice, currencyCode) {
    const factor = currencyConversion[currencyCode] || 1;
    return eurPrice * factor;
}

// Versandkosten nach Land
function getShippingCost(countryCode) {
    // Europäische Länder haben keinen Versand
    const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'GB'];
    return europeanCountries.includes(countryCode) ? 0 : 4.99;
}

// Nominatim OpenStreetMap API für Adressvorschläge
let addressTimeout;

function searchAddresses(query) {
    if (query.length < 2) {
        document.getElementById('address-suggestions').style.display = 'none';
        return;
    }
    
    clearTimeout(addressTimeout);
    addressTimeout = setTimeout(async () => {
        try {
            const selectedCountry = document.getElementById('country').value;
            let searchQuery = query;
            
            // Wenn ein Land ausgewählt ist, nur in diesem Land suchen
            if (selectedCountry && selectedCountry !== '') {
                const countryName = currencyByCountry[selectedCountry]?.name || selectedCountry;
                searchQuery += `, ${countryName}`;
            }
            
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=50&q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            showAddressSuggestions(data);
        } catch (error) {
            console.error('Fehler beim Laden der Adressvorschläge:', error);
        }
    }, 100);
}

function showAddressSuggestions(addresses) {
    const suggestionsDiv = document.getElementById('address-suggestions');
    if (!suggestionsDiv) return;
    if (addresses.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    suggestionsDiv.innerHTML = addresses.map(addr => `
        <div class="address-suggestion" data-address="${addr.display_name.replace(/"/g, '&quot;')}">
            ${addr.display_name}
        </div>
    `).join('');
    suggestionsDiv.style.display = 'block';
    // Event-Delegation für Klicks auf Vorschläge
    suggestionsDiv.querySelectorAll('.address-suggestion').forEach(el => {
        el.onclick = function() {
            window.selectAddress(this.getAttribute('data-address'));
        };
    });
}
window.showAddressSuggestions = showAddressSuggestions;

function selectAddress(address) {
    document.getElementById('address').value = address;
    document.getElementById('address-suggestions').style.display = 'none';
    
    // Stadt aus Adresse extrahieren (normalerweise vor dem letzten Komma)
    const addressParts = address.split(',');
    if (addressParts.length >= 2) {
        const cityPart = addressParts[addressParts.length - 2].trim();
        const cityInput = document.getElementById('city');
        if (cityInput && cityPart) {
            // Entferne Postleitzahlen aus dem Stadtname falls vorhanden
            const cleanCity = cityPart.replace(/^\d{4,5}\s*/, '');
            cityInput.value = cleanCity;
        }
    }
    
    // Land aus Adresse extrahieren und automatisch im Dropdown setzen
    const countryMatch = address.match(/,\s*([A-Za-z\s]+)$/);
    if (countryMatch) {
        const country = countryMatch[1].trim();
        const countryCode = getCountryCodeFromName(country);
        if (countryCode && currencyByCountry[countryCode]) {
            const countrySelect = document.getElementById('country');
            if (countrySelect) {
                countrySelect.value = countryCode;
            }
            currentCountry = countryCode;
            currentCurrency = currencyByCountry[countryCode];
            updateCartPage();
        }
    }
    showHouseNumberHint();
}
window.selectAddress = selectAddress;

function showHouseNumberHint() {
    const hintDiv = document.getElementById('house-number-hint');
    
    if (hintDiv) {
        hintDiv.style.display = 'block';
        hintDiv.innerHTML = '<div class="alert alert-info mt-2"><i class="bi bi-info-circle"></i> Bitte Hausnummer eingeben</div>';
        setTimeout(() => {
            hintDiv.style.display = 'none';
        }, 5000);
    }
}

function getCountryCodeFromName(countryName) {
    const countryMap = {
        'Deutschland': 'DE',
        'Germany': 'DE',
        'United States': 'US',
        'USA': 'US',
        'United Kingdom': 'GB',
        'UK': 'GB',
        'Schweiz': 'CH',
        'Switzerland': 'CH',
        'Österreich': 'AT',
        'Austria': 'AT',
        'Frankreich': 'FR',
        'France': 'FR',
        'Italien': 'IT',
        'Italy': 'IT',
        'Spanien': 'ES',
        'Spain': 'ES',
        'Niederlande': 'NL',
        'Netherlands': 'NL',
        'Belgien': 'BE',
        'Belgium': 'BE',
        'Canada': 'CA',
        'Kanada': 'CA',
        'Australia': 'AU',
        'Australien': 'AU',
        'Japan': 'JP',
        'Brasil': 'BR',
        'Brazil': 'BR',
        'Brasilien': 'BR',
        'Mexico': 'MX',
        'Mexiko': 'MX'
    };
    return countryMap[countryName];
}

function onCountryChange() {
    const selectedCountry = document.getElementById('country').value;
    if (selectedCountry && currencyByCountry[selectedCountry]) {
        currentCountry = selectedCountry;
        currentCurrency = currencyByCountry[selectedCountry];
        updateCartPage();
        
        // Adressfeld leeren wenn Land geändert wird
        document.getElementById('address').value = '';
    }
}

// Karten-Dropdown Funktionalität mit Touch-Unterstützung
function toggleCardDropdown() {
    const dropdown = document.getElementById('card-dropdown');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    
    // Touch-Optimierung für mobile Geräte
    if (isVisible) {
        document.addEventListener('touchstart', handleOutsideClick, { passive: true, capture: true });
    } else {
        document.removeEventListener('touchstart', handleOutsideClick, { passive: true, capture: true });
    }
}

function handleOutsideClick(e) {
    const dropdown = document.getElementById('card-dropdown');
    const button = document.querySelector('[onclick="toggleCardDropdown()"]');
    
    if (!dropdown.contains(e.target) && !button.contains(e.target)) {
        dropdown.style.display = 'none';
        document.removeEventListener('touchstart', handleOutsideClick, { passive: true, capture: true });
    }
}

function selectCard(cardType) {
    const cardInput = document.getElementById('card-number');
    cardInput.placeholder = `${cardType} Kartennummer eingeben`;
    document.getElementById('card-dropdown').style.display = 'none';
}

// Timer-Logik für Bestellübersicht
let timerInterval;
function startCartTimer() {
    let timeLeft = 600; // 10 Minuten in Sekunden
    const timerDiv = document.getElementById('cart-timer');
    if (!timerDiv) return;
    timerDiv.textContent = `Ihr Warenkorb leert sich in 10:00 Minuten`;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const sec = (timeLeft % 60).toString().padStart(2, '0');
        timerDiv.textContent = `Ihr Warenkorb leert sich in ${min}:${sec} Minuten`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            localStorage.removeItem('cart');
            updateCartPage();
            timerDiv.textContent = 'Ihr Warenkorb wurde geleert.';
        }
    }, 1000);
}

function updateCartPage() {
    console.log('updateCartPage called');
    // Aktualisiere cartItems aus dem localStorage
    const cartItems = getCart();
    console.log('Cart items from getCart:', cartItems);
    const cartContent = document.getElementById('cartContent');
    
    // Debug-Ausgabe
    console.log('Cart Items:', cartItems);
    
    if (cartItems.length === 0) {
        // Bei leerem Warenkorb: 3 zufällige Produktvorschläge anzeigen
        let allProducts = [];
        try {
            allProducts = JSON.parse(localStorage.getItem('allProducts')) || [];
        } catch (e) { allProducts = []; }
        if (!allProducts.length) {
            fetch('products.json')
                .then(res => res.json())
                .then(data => {
                    localStorage.setItem('allProducts', JSON.stringify(data));
                    updateCartPage();
                });
            return;
        }
        
        // 3 zufällige Produkte auswählen
        const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
        const randomProducts = shuffled.slice(0, 3);
        
        cartContent.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">
                    <i class="bi bi-cart-x"></i>
                </div>
                <h3>Ihr Warenkorb ist leer</h3>
                <p>Entdecken Sie unsere Produkte und fügen Sie Artikel zu Ihrem Warenkorb hinzu.</p>
                <a href="index.html" class="continue-shopping">
                    <i class="bi bi-arrow-left"></i> Weiter einkaufen
                </a>
                
                <!-- Zufällige Produktvorschläge -->
                <div class="mt-5">
                    <h4 class="mb-3"><i class="bi bi-lightbulb"></i> Das könnte Ihnen gefallen</h4>
                    <div class="addon-list">
                        ${randomProducts.map(product => `
                            <div class="addon-card">
                                <a href="produkte/produkt-${product.id}.html" style="text-decoration: none;">
                                    <img src="${product.image}" class="addon-card-img" alt="${product.name}" style="cursor: pointer;" onerror="this.src='produkt bilder/ware.png'">
                                </a>
                                <div class="addon-card-info">
                                    <div class="addon-card-title">${product.name}</div>
                                    <div class="addon-card-price">${currentCurrency.symbol}${product.price.toFixed(2)}</div>
                                </div>
                                <button class="addon-btn" onclick="addAddonToCart(${product.id})">
                                    <i class="bi bi-cart-plus"></i> Hinzufügen
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    // --- Add-on-Logik: Maximal 2 Vorschläge aus unterschiedlichen Kategorien im Warenkorb, zufällig ausgewählt ---
    let allProducts = [];
    try {
        allProducts = JSON.parse(localStorage.getItem('allProducts')) || [];
    } catch (e) { allProducts = []; }
    if (!allProducts.length) {
        fetch('products.json')
            .then(res => res.json())
            .then(data => {
                localStorage.setItem('allProducts', JSON.stringify(data));
                updateCartPage();
            });
        return;
    }
    const cartIds = cartItems.map(item => item.id);
    const cartCategories = [...new Set(cartItems.map(item => item.category))];
    // Für jede Kategorie ein zufälliges Add-on, das nicht im Warenkorb ist
    let categoryAddons = cartCategories.map(cat => {
        const candidates = allProducts.filter(p => p.category === cat && !cartIds.includes(p.id));
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }).filter(Boolean);
    // Maximal 2 Add-ons, zufällig aus den Kategorien
    if (categoryAddons.length > 2) {
        // Shuffle und nimm die ersten 2
        for (let i = categoryAddons.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [categoryAddons[i], categoryAddons[j]] = [categoryAddons[j], categoryAddons[i]];
        }
        categoryAddons = categoryAddons.slice(0, 2);
    }
    const addonProducts = categoryAddons;
    // --- Ende Add-on-Logik ---

    // Preise umrechnen für Anzeige
    const subtotal = cartItems.reduce((sum, item) => sum + (convertPrice(item.price, currentCurrency.code) * item.quantity), 0);
    const shipping = getShippingCost(currentCountry);
    const shippingConverted = convertPrice(shipping, currentCurrency.code);
    const total = subtotal + shippingConverted;
    
    cartContent.innerHTML = `
        <div class="cart-layout">
            <div class="cart-items-section">
                <h3 class="mb-4">
                    <i class="bi bi-bag-check"></i> Ihre Artikel (${cartItems.length})
                </h3>
                <div id="cartItemsList">
                    ${cartItems.map(item => `
                        <div class="cart-item" data-id="${item.id}">
                            <a href="produkte/produkt-${item.id}.html" style="text-decoration: none;">
                                <img src="${item.image}" alt="${item.name}" class="cart-item-image" style="cursor: pointer;" onerror="handleImageError(this, '${item.name}', '${item.image}')" loading="eager" onload="console.log('Bild erfolgreich geladen:', '${item.name}')">
                            </a>
                            <div class="cart-item-details">
                                <h5>${item.name}</h5>
                                <div class="cart-item-price">${currentCurrency.symbol}${convertPrice(item.price, currentCurrency.code).toFixed(2)}</div>
                            </div>
                            <div class="quantity-controls">
                                <button class="quantity-btn" onclick="changeQuantity(${item.id}, -1)">
                                    <i class="bi bi-dash"></i>
                                </button>
                                <span class="quantity-display">${item.quantity}</span>
                                <button class="quantity-btn" onclick="changeQuantity(${item.id}, 1)">
                                    <i class="bi bi-plus"></i>
                                </button>
                            </div>
                            <button class="remove-btn" onclick="removeFromCart('${item.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <!-- Add-ons Bereich -->
                ${addonProducts.length > 0 ? `
                <div class="addon-section-divider"></div>
                <div class="addon-section">
                    <div class="addon-section-header">
                        <h4 class="addon-section-title">
                            <i class="bi bi-plus-circle"></i>Add-ons
                        </h4>
                        <p class="addon-section-subtitle">Ergänzen Sie Ihre Bestellung mit passenden Produkten</p>
                    </div>
                    <div class="addon-list">
                        ${addonProducts.map(addon => `
                            <div class="addon-card">
                                <a href="produkte/produkt-${addon.id}.html" style="text-decoration: none;">
                                    <img src="${addon.image}" class="addon-card-img" alt="${addon.name}" style="cursor: pointer;" onerror="this.src='produkt bilder/ware.png'">
                                </a>
                                <div class="addon-card-info">
                                    <div class="addon-card-title">${addon.name}</div>
                                    <div class="addon-card-price">${currentCurrency.symbol}${convertPrice(addon.price, currentCurrency.code).toFixed(2)}</div>
                                </div>
                                <button class="addon-btn" onclick="addAddonToCart(${addon.id})">
                                    <i class="bi bi-cart-plus"></i> Hinzufügen
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                <!-- Ende Add-ons Bereich -->
                
                <!-- Clear Cart Button -->
                <div class="text-center mt-4 mb-3">
                    <button type="button" onclick="clearCart()" class="btn btn-outline-danger w-100" style="border-radius: 12px; padding: 12px 24px; font-weight: 500; max-width: 400px;">
                        <i class="bi bi-trash"></i> Warenkorb leeren
                    </button>
                </div>
            </div>
            
            <div class="checkout-section">
                <div class="checkout-header">
                    <h3 class="checkout-title">
                        <i class="bi bi-credit-card"></i> Bestellung
                    </h3>
                </div>
                
                <div class="order-summary">
                    <div id="cart-timer" class="mb-2 text-danger fw-bold"></div>
                    <div class="summary-row">
                        <span>Zwischensumme:</span>
                        <span>${currentCurrency.symbol}${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Versand:</span>
                        <span>${shipping === 0 ? 'Kostenlos' : currentCurrency.symbol + shippingConverted.toFixed(2)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Gesamt:</span>
                        <span>${currentCurrency.symbol}${total.toFixed(2)}</span>
                    </div>
                </div>
                
                <!-- Express-Checkout Bereich -->
                <div class="text-center mb-3">
                    <div class="fw-semibold mb-3" style="font-size:1.1rem;">Express-Checkout</div>
                    <div class="d-flex justify-content-center gap-2 flex-wrap mb-2">
                        <button class="btn px-3 py-2 d-flex align-items-center justify-content-center" style="background:#000; color:#fff; border-radius:12px; font-weight:600; font-size:0.9rem; border:none; min-width:120px;" onclick="alert('Google Pay Checkout (Demo)')">
                            Google Pay
                        </button>
                        <button class="btn px-3 py-2 d-flex align-items-center justify-content-center" style="background:#0070ba; color:#fff; border-radius:12px; font-weight:600; font-size:0.9rem; border:none; min-width:120px;" onclick="alert('PayPal Checkout (Demo)')">
                            <svg width="20" height="20" viewBox="0 0 24 24" style="margin-right:6px;">
                                <path fill="#fff" d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                            </svg>
                            PayPal
                        </button>
                    </div>
                    <div class="d-flex justify-content-center gap-2 flex-wrap mb-2">
                        <button class="btn px-3 py-2 d-flex align-items-center justify-content-center" style="background:#fff; color:#222; border-radius:12px; font-weight:600; font-size:0.9rem; border:1.5px solid #222; min-width:120px;" onclick="alert('Apple Pay Checkout (Demo)')">
                            <i class="bi bi-apple" style="font-size:18px; margin-right:6px;"></i> Apple Pay
                        </button>
                        <button class="btn px-3 py-2 d-flex align-items-center justify-content-center" style="background:#ffdaec; color:#222; border-radius:12px; font-weight:600; font-size:0.9rem; border:none; min-width:120px;" onclick="alert('Klarna Checkout (Demo)')">
                            <img src="karten/klarna.png" alt="Klarna" style="height:20px; margin-right:6px;"> Klarna
                        </button>
                    </div>
                    <div class="d-flex align-items-center justify-content-center my-3" style="gap:1rem;">
                        <hr style="flex:1; border-top:1.5px solid #cfd8dc; margin:0;">
                        <span class="text-muted fw-semibold" style="font-size:0.9rem;">ODER</span>
                        <hr style="flex:1; border-top:1.5px solid #cfd8dc; margin:0;">
                    </div>
                </div>
                
                <form id="stripe-form" class="payment-form">
                    <div class="form-group">
                        <label for="email" class="form-label">
                            <i class="bi bi-envelope"></i> E-Mail-Adresse
                        </label>
                        <input type="email" id="email" class="form-control" required autocomplete="email" placeholder="ihre@email.de">
                    </div>
                    
                    <div class="row">
                        <div class="col-6">
                            <div class="form-group">
                                <label for="firstname" class="form-label">
                                    <i class="bi bi-person"></i> Vorname
                                </label>
                                <input type="text" id="firstname" class="form-control" required placeholder="Vorname">
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="form-group">
                                <label for="lastname" class="form-label">
                                    <i class="bi bi-person-fill"></i> Nachname
                                </label>
                                <input type="text" id="lastname" class="form-control" required placeholder="Nachname">
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="country" class="form-label">
                            <i class="bi bi-globe"></i> Land
                        </label>
                        <select id="country" class="form-control" onchange="onCountryChange()" required>
                            <option value="">Land auswählen</option>
                            <option value="DE" ${currentCountry === 'DE' ? 'selected' : ''}>Deutschland</option>
                            <option value="AT" ${currentCountry === 'AT' ? 'selected' : ''}>Österreich</option>
                            <option value="CH" ${currentCountry === 'CH' ? 'selected' : ''}>Schweiz</option>
                            <option value="FR" ${currentCountry === 'FR' ? 'selected' : ''}>Frankreich</option>
                            <option value="IT" ${currentCountry === 'IT' ? 'selected' : ''}>Italien</option>
                            <option value="ES" ${currentCountry === 'ES' ? 'selected' : ''}>Spanien</option>
                            <option value="NL" ${currentCountry === 'NL' ? 'selected' : ''}>Niederlande</option>
                            <option value="BE" ${currentCountry === 'BE' ? 'selected' : ''}>Belgien</option>
                            <option value="US" ${currentCountry === 'US' ? 'selected' : ''}>Vereinigte Staaten</option>
                            <option value="GB" ${currentCountry === 'GB' ? 'selected' : ''}>Vereinigtes Königreich</option>
                            <option value="CA" ${currentCountry === 'CA' ? 'selected' : ''}>Kanada</option>
                            <option value="AU" ${currentCountry === 'AU' ? 'selected' : ''}>Australien</option>
                            <option value="JP" ${currentCountry === 'JP' ? 'selected' : ''}>Japan</option>
                            <option value="BR" ${currentCountry === 'BR' ? 'selected' : ''}>Brasilien</option>
                            <option value="MX" ${currentCountry === 'MX' ? 'selected' : ''}>Mexiko</option>
                        </select>
                        <div class="form-text text-info">
                            <i class="bi bi-info-circle"></i> Europäische Länder haben kostenlosen Versand
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="city" class="form-label">
                            <i class="bi bi-building"></i> Stadt
                        </label>
                        <input type="text" id="city" class="form-control" required placeholder="Stadt eingeben">
                    </div>
                    
                    <div class="form-group position-relative">
                        <label for="address" class="form-label">
                            <i class="bi bi-geo-alt"></i> Adresse
                        </label>
                        <input type="text" id="address" class="form-control" required placeholder="Straße und Hausnummer">
                    </div>
                    
                    <div class="form-group">
                        <label for="postcode" class="form-label">
                            <i class="bi bi-mailbox"></i> Postleitzahl
                        </label>
                        <input type="text" id="postcode" class="form-control" required placeholder="Postleitzahl">
                    </div>
                    
                    <div id="address-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:1000;max-height:200px;overflow-y:auto;"></div>
                    
                    <div class="payment-section">
                        <h4 class="payment-title">
                            <i class="bi bi-credit-card"></i> Zahlungsinformationen
                        </h4>
                        
                        <!-- Kreditkarte -->
                        <div class="form-group">
                            <label class="form-label">
                                <i class="bi bi-credit-card"></i> Kreditkarte
                            </label>
                            
                            <!-- Kartenbilder mit Dropdown -->
                            <div class="card-images mb-3">
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <img src="karten/visa.png" class="card-img-static">
                                    <img src="karten/mastercard.jpg" class="card-img-static">
                                    <img src="karten/bancontact.png" class="card-img-static">
                                    <img src="karten/cartes bancaires.jpg" class="card-img-static">
                                    <div class="position-relative">
                                        <button type="button" class="btn btn-outline-secondary d-flex align-items-center" style="height:24px; padding:0 8px; font-size:0.8rem; border-radius:4px;" onclick="toggleCardDropdown()">
                                            +3
                                        </button>
                                        <div id="card-dropdown" style="display:none; position:absolute; top:100%; left:0; background:#fff; border:1px solid #ddd; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); z-index:1000; padding:8px;">
                                            <div class="d-flex flex-column gap-2">
                                                <img src="karten/EPS.png" class="card-img-static" style="margin:0; cursor: pointer;" onclick="handleRedirectCheckout('EPS')">
                                                <img src="karten/giropay.png" class="card-img-static" style="margin:0; cursor: pointer;" onclick="handleRedirectCheckout('giropay')">
                                                <img src="karten/blik.png" class="card-img-static" style="margin:0; cursor: pointer;" onclick="handleRedirectCheckout('blik')">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="card-input-container" style="background: #f8f9fa; border-radius: 12px; padding: 20px; border: 1px solid #e9ecef;">
                                <div class="form-group mb-3">
                                    <div id="card-number-element" class="stripe-element-container"></div>
                                </div>
                                <div class="row">
                                    <div class="col-6">
                                        <div class="form-group">
                                            <div id="card-expiry-element" class="stripe-element-container"></div>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="form-group">
                                            <div id="card-cvc-element" class="stripe-element-container"></div>
                                        </div>
                                    </div>
                                </div>
                                <div id="card-errors" role="alert" class="text-danger mt-2"></div>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" id="submit-button" class="btn btn-primary w-100 checkout-btn">
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="display: none;"></span>
                        <span class="button-text"><i class="bi bi-lock"></i> Jetzt bestellen - ${currentCurrency.symbol}${total.toFixed(2)}</span>
                    </button>
                    
                </form>
            </div>
        </div>
    `;
    
    startCartTimer();
    // Stripe-Elemente nach dem Neuzeichnen des DOMs einhängen
    setupPostcodeAutocomplete();
    
    // Adressfeld ohne Hausnummer-Validierung
    const addressInput = document.getElementById('address');
    if (addressInput) {
        addressInput.addEventListener('input', function() {
            // Keine spezielle Validierung mehr nötig
            this.setCustomValidity('');
            this.classList.remove('is-invalid');
        });
    }
    setupStripeForm(); // Diese Zeile hinzufügen
    mountStripeElements();
    
    // Füge Farbauswahl zu Warenkorb-Artikeln hinzu (falls verfügbar)
    setTimeout(async () => {
        if (window.addColorSelectorsToCart) {
            console.log('🎨 Rufe addColorSelectorsToCart auf...');
            await window.addColorSelectorsToCart();
        } else if (window.renderColorSelector) {
            console.log('🎨 Fallback: Füge Farbauswahl manuell hinzu...');
            const cartItems = getCart();
            for (const item of cartItems) {
                const container = document.querySelector(`.cart-item[data-id="${item.id}"] .cart-item-details`);
                if (container && !container.querySelector('.cart-color-selector')) {
                    const colorDiv = document.createElement('div');
                    colorDiv.className = 'cart-color-selector-wrapper';
                    const selectorHtml = await window.renderColorSelector(item, colorDiv);
                    if (selectorHtml) {
                        colorDiv.innerHTML = selectorHtml;
                        const title = container.querySelector('h5');
                        if (title) {
                            title.insertAdjacentElement('afterend', colorDiv);
                        }
                    }
                }
            }
        }
    }, 500);
}

async function handleRedirectCheckout(methodName) {
    const form = document.getElementById('stripe-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const checkoutSection = document.querySelector('.checkout-section');
    if (checkoutSection) {
        checkoutSection.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary" role="status"></div>
                <h4 class="mt-3">Sie werden zu ${methodName} weitergeleitet...</h4>
            </div>`;
    }
    
    setTimeout(() => {
        localStorage.removeItem('cart');
        window.location.href = 'success.html';
    }, 2000);
}

function changeQuantity(productId, change) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const itemIndex = cart.findIndex(item => item.id === productId);
    
    if (itemIndex !== -1) {
        // Bundles können jetzt auch in der Menge geändert werden
        // if (cart[itemIndex].bundleId) {
        //     return; // Keine Änderung bei Bundles
        // }
        
        cart[itemIndex].quantity += change;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        if (typeof updateCartCounter === 'function') {
            updateCartCounter();
        }
        
        // Check if we're on the cart page or main page
        if (window.location.pathname.includes('cart.html')) {
            // If on cart page, update the cart page
            if (typeof updateCartPage === 'function') {
                updateCartPage();
            }
        } else {
            // If on main page, update the dropdown
            if (typeof renderCartDropdown === 'function') {
                renderCartDropdown();
            }
        }
    }
}

function removeFromCart(productId) {
    console.log('removeFromCart called with productId:', productId, 'type:', typeof productId);
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    console.log('Cart before removal:', cart);
    
    // Prüfe ob es ein Bundle-Item ist
    const itemToRemove = cart.find(item => Number(item.id) === Number(productId));
    
    if (itemToRemove && itemToRemove.isBundle) {
        // Es ist ein neues Bundle-Format - lösche nur dieses eine Item
        const originalLength = cart.length;
        cart = cart.filter(item => {
            const itemId = Number(item.id);
            const targetId = Number(productId);
            // Zusätzliche Prüfung für Bundles mit gleichen Farben
            if (itemToRemove.bundleId && item.bundleId === itemToRemove.bundleId) {
                return JSON.stringify(item.bundleColors) !== JSON.stringify(itemToRemove.bundleColors);
            }
            return itemId !== targetId;
        });
        console.log(`🗑️ Bundle gelöscht - ${originalLength - cart.length} Item(s) entfernt`);
    } else if (itemToRemove && itemToRemove.bundleId && !itemToRemove.isBundle) {
        // Altes Bundle-Format (falls noch vorhanden) - lösche alle mit gleicher bundleId
        const bundleId = itemToRemove.bundleId;
        const originalLength = cart.length;
        cart = cart.filter(item => item.bundleId !== bundleId);
        console.log(`🗑️ Alte Bundle-Items mit ID ${bundleId} gelöscht`);
    } else {
        // Normales Item - lösche nur dieses
        const originalLength = cart.length;
        cart = cart.filter(item => {
            const itemId = Number(item.id);
            const targetId = Number(productId);
            console.log('Comparing item ID:', itemId, 'with target ID:', targetId, 'match:', itemId === targetId);
            return itemId !== targetId;
        });
        console.log('Items removed:', originalLength - cart.length);
    }
    
    console.log('Cart after removal:', cart);
    
    localStorage.setItem('cart', JSON.stringify(cart));
    if (typeof updateCartCounter === 'function') {
        updateCartCounter();
    }
    
    // Check if we're on the cart page or main page
    if (window.location.pathname.includes('cart.html')) {
        // If on cart page, update the cart page instead of redirecting
        if (typeof updateCartPage === 'function') {
            updateCartPage();
        }
    } else {
        // If on main page, just update the dropdown
        if (typeof renderCartDropdown === 'function') {
            renderCartDropdown();
        }
    }
}

function clearCart() {
    localStorage.removeItem('cart');
    cartItems = [];
    
    // Check if we're on the cart page or main page
    if (window.location.pathname.includes('cart.html')) {
        // If on cart page, update the cart page
        if (typeof updateCartPage === 'function') {
            updateCartPage();
        }
    } else {
        // If on main page, update the dropdown
        if (typeof renderCartDropdown === 'function') {
            renderCartDropdown();
        }
    }
    
    if (typeof updateCartCounter === 'function') {
        updateCartCounter();
    }
}

// Add-on zum Warenkorb hinzufügen
function addAddonToCart(productId) {
    let allProducts = [];
    try {
        allProducts = JSON.parse(localStorage.getItem('allProducts')) || [];
    } catch (e) { 
        allProducts = []; 
    }
    
    const product = allProducts.find(p => Number(p.id) === Number(productId));
    if (!product) return;
    
    // Lade den aktuellen Warenkorb aus dem localStorage
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(item => Number(item.id) === Number(productId));
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    // Speichere den aktualisierten Warenkorb
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Aktualisiere die Anzeige
    updateCartPage();
    // Sofort zur cart.html navigieren
    window.location.href = 'cart.html';
}

// Stripe initialisieren - mit Fehlerbehandlung
let stripe, elements, cardNumber, cardExpiry, cardCvc;
let stripeInitialized = false;

// Stripe sicher initialisieren
function initializeStripe() {
  try {
    if (typeof Stripe !== 'undefined') {
      stripe = Stripe('pk_test_XXXXXXXXXXXXXXXXXXXXXXXX');
      return true;
    } else {
      console.warn('Stripe is not loaded yet');
      return false;
    }
  } catch (error) {
    console.warn('Stripe initialization failed:', error);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', function() {
    updateCartPage();
    
    // Stripe sicher initialisieren
    if (initializeStripe()) {
        setupStripeForm();
    }
    
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('card-dropdown');
        const button = event.target.closest('button');
        if (dropdown && !button?.onclick?.toString().includes('toggleCardDropdown')) {
            dropdown.style.display = 'none';
        }
        
        const suggestions = document.getElementById('address-suggestions');
        if (suggestions && !event.target.closest('#address') && !event.target.closest('#address-suggestions')) {
            suggestions.style.display = 'none';
        }
    });

    // Prevent clicks on interactive elements from causing unwanted behavior
    document.addEventListener('click', function(event) {
        // Check if the clicked element is an interactive element that should not trigger default behaviors
        const interactiveElements = [
            '.quantity-btn',
            '.remove-btn', 
            '.addon-btn',
            '.cart-item',
            '.quantity-controls',
            '.quantity-display',
            'button[onclick*="changeQuantity"]',
            'button[onclick*="removeFromCart"]',
            'button[onclick*="addAddonToCart"]',
            'button[onclick*="clearCart"]'
        ];
        
        // If the clicked element or its parent matches any interactive element, prevent unwanted propagation
        const isInteractiveElement = interactiveElements.some(selector => 
            event.target.matches(selector) || event.target.closest(selector)
        );
        
        if (isInteractiveElement) {
            // Allow the click to proceed normally but prevent unwanted side effects
            event.stopPropagation();
        }
    });
});

function setupStripeForm() {
    if (stripeInitialized) return;

    elements = stripe.elements({
        locale: 'de'
    });

    // Stil für das Innere der Stripe-Elemente (iFrames)
    const style = {
        base: {
            fontSize: '16px',
            color: '#32325d',
            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            '::placeholder': {
                color: '#aab7c4'
            }
        },
        invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
        }
    };

    cardNumber = elements.create('cardNumber', { style: style, placeholder: 'Kartennummer' });
    cardExpiry = elements.create('cardExpiry', { style: style });
    cardCvc = elements.create('cardCvc', { style: style, placeholder: 'CVC' });

    [cardNumber, cardExpiry, cardCvc].forEach(element => {
        element.on('change', event => {
            const errorDiv = document.getElementById('card-errors');
            if (!errorDiv) return;
            if (event.error) {
                errorDiv.textContent = event.error.message;
            } else {
                errorDiv.textContent = '';
            }
        });
    });

    const form = document.getElementById('stripe-form');
    if (form) {
        form.addEventListener('submit', handleStripeSubmit);
    }
    stripeInitialized = true;
}

function mountStripeElements() {
    if (!stripeInitialized || !document.getElementById('card-number-element')) return;
    cardNumber.mount('#card-number-element');
    cardExpiry.mount('#card-expiry-element');
    cardCvc.mount('#card-cvc-element');
}

async function handleStripeSubmit(event) {
    event.preventDefault();
    
    const submitButton = document.getElementById('submit-button');
    const spinner = submitButton.querySelector('.spinner-border');
    const buttonText = submitButton.querySelector('.button-text');
    const errorDiv = document.getElementById('card-errors');

    // Spinner anzeigen und Button deaktivieren
    spinner.style.display = 'inline-block';
    buttonText.style.display = 'none';
    submitButton.disabled = true;
    errorDiv.textContent = '';

    try {
        // 1. Daten aus dem Formular und Warenkorb holen
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const email = document.getElementById('email').value;
        const firstname = document.getElementById('firstname').value;
        const lastname = document.getElementById('lastname').value;
        const country = document.getElementById('country').value;
        const city = document.getElementById('city').value;
        const address = document.getElementById('address').value;
        const postalCode = document.getElementById('postcode').value;

        if (cart.length === 0) {
            throw new Error("Ihr Warenkorb ist leer.");
        }

        // 2. PaymentIntent auf dem Server erstellen (Demo-Modus)
        // Da kein echter Server vorhanden ist, simulieren wir einen Fehler
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, email, country, city, firstname, lastname })
        }).catch(error => {
            // Netzwerkfehler abfangen
            throw new Error('Server nicht erreichbar. Dies ist eine Demo-Version ohne echte Zahlungsabwicklung.');
        });

        let responseData;
        try {
            const responseText = await response.text();
            if (!responseText) {
                throw new Error('Server antwortet nicht. Dies ist eine Demo-Version ohne echte Zahlungsabwicklung.');
            }
            responseData = JSON.parse(responseText);
        } catch (parseError) {
            // JSON Parse Fehler - wahrscheinlich weil kein Server läuft
            throw new Error('Zahlungsserver nicht verfügbar. Dies ist eine Demo-Version. Für eine echte Bestellung kontaktieren Sie uns bitte direkt.');
        }

        const { clientSecret, error: backendError } = responseData;

        if (backendError || !clientSecret) {
            throw new Error(backendError || 'Fehler bei der Zahlungsinitialisierung. Server nicht konfiguriert.');
        }

        // 3. Zahlung auf dem Client bestätigen
        const { error, paymentIntent } = await stripe.confirmCardPayment(
            clientSecret, {
                payment_method: {
                    card: cardNumber,
                    billing_details: {
                        name: `${firstname} ${lastname}`,
                        email: email,
                        address: {
                            line1: address,
                            city: city,
                            country: country,
                            postal_code: postalCode
                        }
                    },
                },
            }
        );

        if (error) {
            throw new Error(error.message);
        }

        // 4. Bei Erfolg weiterleiten
        if (paymentIntent.status === 'succeeded') {
            localStorage.removeItem('cart');
            window.location.href = 'success.html';
        } else {
            throw new Error(`Zahlung fehlgeschlagen: ${paymentIntent.status}`);
        }

    } catch (err) {
        // Alle Fehler hier abfangen und anzeigen
        errorDiv.textContent = err.message;
        
        // Neue auffällige Fehlerbenachrichtigung
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        alertDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            animation: slideIn 0.3s ease-out;
        `;
        alertDiv.innerHTML = `
            <div class="d-flex align-items-start">
                <i class="bi bi-exclamation-triangle-fill me-2" style="font-size: 1.2rem;"></i>
                <div>
                    <strong>Zahlung fehlgeschlagen!</strong>
                    <div class="mt-1" style="font-size: 0.9rem;">${err.message}</div>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // CSS Animation hinzufügen falls noch nicht vorhanden
        if (!document.querySelector('#payment-error-animation')) {
            const style = document.createElement('style');
            style.id = 'payment-error-animation';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(alertDiv);
        
        // Alert nach 7 Sekunden automatisch entfernen
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, 7000);
        
        // Button und Spinner zurücksetzen
        spinner.style.display = 'none';
        buttonText.style.display = 'inline-block';
        submitButton.disabled = false;
        
        // Scroll zum Fehler
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// --- NEUE ADRESSVORSCHLAG-LOGIK ---
function setupPostcodeAutocomplete() {
    const postcodeInput = document.getElementById('postcode');
    const cityInput = document.getElementById('city');
    const addressInput = document.getElementById('address');
    const suggestionsDiv = document.getElementById('address-suggestions');
    if (!postcodeInput || !suggestionsDiv) return;

    let lastQuery = '';
    let debounceTimeout;

    // Setup for postcode field
    postcodeInput.addEventListener('input', function() {
        const value = postcodeInput.value.trim();
        const country = document.getElementById('country')?.value || '';
        if (value.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            lastQuery = value;
            try {
                let query = value;
                let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=100&q=${encodeURIComponent(query)}`;
                if (country) {
                    url += `&countrycodes=${country.toLowerCase()}`;
                }
                const response = await fetch(url);
                const data = await response.json();
                if (postcodeInput.value.trim() !== lastQuery) return;
                // Filter: Zeige alle Vorschläge, die die Eingabe irgendwo in PLZ oder Ort enthalten
                const filtered = data.filter(addr => {
                    if (!addr.address) return false;
                    const plz = (addr.address.postcode || '').toLowerCase();
                    const ort = (addr.address.city || addr.address.town || addr.address.village || addr.address.hamlet || '').toLowerCase();
                    const val = value.toLowerCase();
                    // Filtere nach Land
                    if (country && addr.address.country_code && addr.address.country_code.toLowerCase() !== country.toLowerCase()) return false;
                    return plz.includes(val) || ort.includes(val);
                });
                if (!Array.isArray(filtered) || filtered.length === 0) {
                    suggestionsDiv.style.display = 'none';
                    return;
                }
                suggestionsDiv.innerHTML = await Promise.all(filtered.map(async addr => {
                    let plz = addr.address.postcode || '';
                    const ort = addr.address.city || addr.address.town || addr.address.village || addr.address.hamlet || '';
                    const land = addr.address.country || '';
                    const countryCode = addr.address.country_code ? addr.address.country_code.toUpperCase() : '';
                    // Wenn keine PLZ vorhanden, versuche alle PLZ für die Stadt zu finden
                    if (!plz && ort && land) {
                        try {
                            let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=50&q=${encodeURIComponent(ort + ' ' + land)}`;
                            if (country) {
                                url += `&countrycodes=${country.toLowerCase()}`;
                            }
                            const resp = await fetch(url);
                            const res = await resp.json();
                            const plzSet = new Set();
                            res.forEach(r => {
                                if (r.address && r.address.postcode) plzSet.add(r.address.postcode);
                            });
                            if (plzSet.size > 0) {
                                plz = Array.from(plzSet).join(', ');
                            } else {
                                plz = '';
                            }
                        } catch (e) {
                            plz = '';
                        }
                    }
                    // Immer einen Vorschlag anzeigen, auch wenn keine PLZ gefunden wurde
                    if (plz) {
                        // Wenn mehrere PLZ vorhanden sind, nimm die erste für data-plz
                        const firstPlz = plz.split(',')[0].trim();
                        return `<div class="address-suggestion" tabindex="0" data-plz="${firstPlz}" data-country="${countryCode}">${plz} ${ort}, ${land}</div>`;
                    } else {
                        return `<div class="address-suggestion" tabindex="0" data-plz="" data-country="${countryCode}">${ort}, ${land} (PLZ nicht gefunden)</div>`;
                    }
                })).then(htmlArr => htmlArr.join(''));
                const rect = postcodeInput.getBoundingClientRect();
                suggestionsDiv.style.position = 'absolute';
                suggestionsDiv.style.top = (postcodeInput.offsetTop + postcodeInput.offsetHeight) + 'px';
                suggestionsDiv.style.left = postcodeInput.offsetLeft + 'px';
                suggestionsDiv.style.width = postcodeInput.offsetWidth + 'px';
                suggestionsDiv.style.display = 'block';
            } catch (e) {
                suggestionsDiv.style.display = 'none';
            }
        }, 50);
    });

    // Setup for city field
    if (cityInput) {
        cityInput.addEventListener('input', function() {
            const value = cityInput.value.trim();
            const country = document.getElementById('country')?.value || '';
            const postcode = postcodeInput.value.trim();
            
            if (value.length < 2) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                try {
                    let query = value;
                    if (postcode) query = `${postcode} ${value}`;
                    
                    let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=50&q=${encodeURIComponent(query)}`;
                    if (country) {
                        url += `&countrycodes=${country.toLowerCase()}`;
                    }
                    
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    const filtered = data.filter(addr => {
                        if (!addr.address) return false;
                        const city = (addr.address.city || addr.address.town || addr.address.village || '').toLowerCase();
                        return city.includes(value.toLowerCase());
                    });
                    
                    if (filtered.length === 0) {
                        suggestionsDiv.style.display = 'none';
                        return;
                    }
                    
                    suggestionsDiv.innerHTML = filtered.map(addr => {
                        const plz = addr.address.postcode || '';
                        const city = addr.address.city || addr.address.town || addr.address.village || '';
                        const country = addr.address.country || '';
                        return `<div class="address-suggestion" data-type="city" data-plz="${plz}" data-city="${city}">${plz} ${city}, ${country}</div>`;
                    }).join('');
                    
                    positionSuggestions(cityInput);
                    suggestionsDiv.style.display = 'block';
                } catch (e) {
                    suggestionsDiv.style.display = 'none';
                }
            }, 50);
        });
    }
    
    // Setup for address/street field
    if (addressInput) {
        addressInput.addEventListener('input', function() {
            const value = addressInput.value.trim();
            const country = document.getElementById('country')?.value || '';
            const postcode = postcodeInput.value.trim();
            const city = cityInput.value.trim();
            
            if (value.length < 3) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                try {
                    let query = value;
                    if (city) query = `${value}, ${city}`;
                    if (postcode) query = `${value}, ${postcode} ${city}`;
                    
                    let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=30&q=${encodeURIComponent(query)}`;
                    if (country) {
                        url += `&countrycodes=${country.toLowerCase()}`;
                    }
                    
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    const filtered = data.filter(addr => {
                        if (!addr.address) return false;
                        const street = (addr.address.road || addr.address.pedestrian || '').toLowerCase();
                        const houseNumber = addr.address.house_number || '';
                        return street.includes(value.toLowerCase()) || 
                               (street + ' ' + houseNumber).toLowerCase().includes(value.toLowerCase());
                    });
                    
                    if (filtered.length === 0) {
                        suggestionsDiv.style.display = 'none';
                        return;
                    }
                    
                    suggestionsDiv.innerHTML = filtered.map(addr => {
                        const street = addr.address.road || addr.address.pedestrian || '';
                        const houseNumber = addr.address.house_number || '';
                        const plz = addr.address.postcode || '';
                        const city = addr.address.city || addr.address.town || addr.address.village || '';
                        const fullAddress = `${street}${houseNumber ? ' ' + houseNumber : ''}`;
                        return `<div class="address-suggestion" data-type="street" data-street="${fullAddress}" data-plz="${plz}" data-city="${city}">${fullAddress}, ${plz} ${city}</div>`;
                    }).join('');
                    
                    positionSuggestions(addressInput);
                    suggestionsDiv.style.display = 'block';
                } catch (e) {
                    suggestionsDiv.style.display = 'none';
                }
            }, 50);
        });
    }
    
    function positionSuggestions(inputElement) {
        suggestionsDiv.style.position = 'absolute';
        suggestionsDiv.style.top = (inputElement.offsetTop + inputElement.offsetHeight) + 'px';
        suggestionsDiv.style.left = inputElement.offsetLeft + 'px';
        suggestionsDiv.style.width = inputElement.offsetWidth + 'px';
    }

    suggestionsDiv.onclick = function(e) {
        const el = e.target.closest('.address-suggestion');
        if (el) {
            const type = el.getAttribute('data-type');
            
            if (type === 'city') {
                const city = el.getAttribute('data-city');
                if (city) cityInput.value = city;
            } else if (type === 'street') {
                const street = el.getAttribute('data-street');
                const plz = el.getAttribute('data-plz');
                const city = el.getAttribute('data-city');
                if (street) addressInput.value = street;
                if (plz) postcodeInput.value = plz;
                if (city) cityInput.value = city;
            } else {
                // Original postcode logic
                const plz = el.getAttribute('data-plz');
                if (plz) {
                    postcodeInput.value = plz;
                } else {
                    // Fallback: extract postcode from text content
                    const suggestionText = el.textContent;
                    const plzMatch = suggestionText.match(/^(\d{4,5})/);
                    if (plzMatch) {
                        postcodeInput.value = plzMatch[1];
                    }
                }
                
                // Stadt aus dem Vorschlagstext extrahieren und setzen
                const suggestionText = el.textContent;
                const cityMatch = suggestionText.match(/^\d*\s*([^,]+)/);
                if (cityMatch && cityInput) {
                    cityInput.value = cityMatch[1].trim();
                }
            }
            
            // Land setzen, falls noch nicht gewählt
            const countrySelect = document.getElementById('country');
            const countryCode = el.getAttribute('data-country');
            if (countrySelect && countryCode && (!countrySelect.value || countrySelect.value !== countryCode)) {
                countrySelect.value = countryCode;
            }
            suggestionsDiv.style.display = 'none';
            postcodeInput.focus();
        }
    };
    suggestionsDiv.onkeydown = function(e) {
        if (e.key === 'Enter' && document.activeElement.classList.contains('address-suggestion')) {
            postcodeInput.value = document.activeElement.textContent;
            suggestionsDiv.style.display = 'none';
            postcodeInput.focus();
            e.preventDefault();
        }
    };
    let suggestionsHasFocus = false;
    suggestionsDiv.addEventListener('mouseenter', function() { suggestionsHasFocus = true; });
    suggestionsDiv.addEventListener('mouseleave', function() { suggestionsHasFocus = false; });
    // Add blur event listeners for all input fields with longer delay
    [postcodeInput, cityInput, addressInput].forEach(input => {
        if (input) {
            input.addEventListener('blur', function() {
                setTimeout(function() {
                    if (!suggestionsHasFocus && 
                        document.activeElement !== postcodeInput && 
                        document.activeElement !== cityInput && 
                        document.activeElement !== addressInput) {
                        suggestionsDiv.style.display = 'none';
                    }
                }, 800);
            });
        }
    });
    suggestionsDiv.addEventListener('blur', function() {
        setTimeout(function() {
            if (!postcodeInput.matches(':focus') && 
                !cityInput.matches(':focus') && 
                !addressInput.matches(':focus')) {
                suggestionsDiv.style.display = 'none';
            }
        }, 800);
    }, true);
    // Only hide suggestions when clicking far outside the form area
    document.addEventListener('click', function(e) {
        const formArea = document.querySelector('.payment-form') || document.querySelector('form');
        if (!suggestionsDiv.contains(e.target) && 
            e.target !== postcodeInput && 
            e.target !== cityInput && 
            e.target !== addressInput &&
            (!formArea || !formArea.contains(e.target))) {
            suggestionsDiv.style.display = 'none';
        }
    });
}