// ============================================
// BUNDLE COMPLETE - Alle Bundle-Funktionen
// Vereint: bundle-color-integration.js, bundle-color-selection.js, fix-bundle-naming.js
// ============================================

console.log('🎁 Bundle Complete geladen');

// Liste der Produkte die KEINE Farbauswahl haben (auch nicht bei Bundles)
const productsWithoutColors = [12, 18, 21];

// ============================================
// TEIL 1: BUNDLE COLOR INTEGRATION
// ============================================

// Erweiterte renderBundles Funktion mit optionaler Farbauswahl
function renderBundlesWithColors(productId, productColors) {
    // Prüfe ob dieses Produkt überhaupt Farben haben soll
    if (productsWithoutColors.includes(parseInt(productId))) {
        productColors = null; // Keine Farben für diese Produkte
    }
    
    // Prüfe ob Farben vorhanden sind
    const hasColors = productColors && productColors.length > 0;
    const einzelpreis = hasColors ? productColors[0].price : 24.99;
    const staffel = [
        {qty:1, price:einzelpreis, original:einzelpreis},
        {qty:2, price:(einzelpreis*0.85), original:einzelpreis},
        {qty:3, price:(einzelpreis*0.80), original:einzelpreis}
    ];
    
    const section = document.getElementById('bundle-section');
    let selected = 1; // Default: 2 Sets
    
    // Initialisiere Bundle-Farbauswahl im localStorage
    const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
    
    section.innerHTML = `
        <div class="bundle-box">
            <div class="bundle-header">BUNDLE & SPARE</div>
            <form id="bundleForm">
                ${staffel.map((s, i) => {
                    const bundleId = `bundle-${productId}-qty${s.qty}`;
                    
                    // Initialisiere oder lade Farben für dieses Bundle
                    if (productColors && productColors.length > 0) {
                        if (!bundleSelections[bundleId]) {
                            bundleSelections[bundleId] = {};
                            for (let j = 0; j < s.qty; j++) {
                                bundleSelections[bundleId][j] = productColors[0]; // Erste Farbe als Standard
                            }
                            localStorage.setItem('bundleColorSelections', JSON.stringify(bundleSelections));
                        }
                    }
                    
                    return `
                        <div class="bundle-card${i===selected?' selected':''}" data-index="${i}" data-bundle-id="${bundleId}">
                            <input type="radio" name="bundle" class="bundle-radio" id="bundleRadio${i}" value="${i}" ${i===selected?'checked':''}>
                            <div class="bundle-info">
                                <div class="bundle-title">
                                    ${s.qty} Set${s.qty>1?'s':''} kaufen
                                    ${i===1 ? '<span class="bundle-badge popular">Am beliebtesten</span>' : ''}
                                    ${i===2 ? '<span class="bundle-badge savings">Meiste Ersparnis</span>' : ''}
                                    ${i>0 ? `<span class="bundle-label">EXTRA ${i===1?'15':i===2?'20':'0'}% RABATT</span>` : ''}
                                </div>
                                
                                ${hasColors ? `
                                    <div class="bundle-color-selection">
                                        ${Array.from({length: s.qty}, (_, j) => {
                                            const selectedColor = bundleSelections[bundleId] && bundleSelections[bundleId][j] 
                                                ? bundleSelections[bundleId][j] 
                                                : productColors[0];
                                            
                                            return `
                                                <div class="bundle-item-color-inline">
                                                    <span class="bundle-item-label">Stück ${j+1}:</span>
                                                    <div class="color-options-inline">
                                                        ${productColors.map(color => `
                                                            <div class="color-circle-inline ${selectedColor.name === color.name ? 'selected' : ''}"
                                                                 style="background-color: ${color.code};"
                                                                 onclick="selectBundleItemColor('${bundleId}', ${j}, '${color.name}', '${color.code}', ${color.price})"
                                                                 title="${color.name}">
                                                                ${selectedColor.name === color.name ? '<span class="checkmark">✓</span>' : ''}
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                    <span class="selected-color-text">${selectedColor.name}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : ''}
                                
                                <div class="bundle-pricing">
                                    <span class="bundle-price">€${(s.price * s.qty).toFixed(2)}</span>
                                    ${i>0 ? `<span class="bundle-original">€${(s.original * s.qty).toFixed(2)}</span>` : ''}
                                </div>
                                ${i>0 ? `<div class="savings">Spare €${((s.original - s.price) * s.qty).toFixed(2)}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </form>
            <button class="bundle-add-btn" onclick="addBundleToCart(${productId})">
                <i class="bi bi-cart-plus"></i> Bundle zum Warenkorb hinzufügen
            </button>
        </div>
    `;
    
    // Event Listener für Bundle-Auswahl
    document.querySelectorAll('.bundle-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.color-circle-inline')) return;
            
            document.querySelectorAll('.bundle-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('.bundle-radio').checked = true;
        });
    });
}

// Funktion zum Auswählen einer Farbe für ein Bundle-Item
function selectBundleItemColor(bundleId, itemIndex, colorName, colorCode, price) {
    // Lade Bundle-Auswahl aus localStorage
    const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
    
    // Initialisiere Bundle wenn nicht vorhanden
    if (!bundleSelections[bundleId]) {
        bundleSelections[bundleId] = {};
    }
    
    // Speichere ausgewählte Farbe
    bundleSelections[bundleId][itemIndex] = {
        name: colorName,
        code: colorCode,
        price: price
    };
    
    // Speichere im localStorage
    localStorage.setItem('bundleColorSelections', JSON.stringify(bundleSelections));
    
    // Update UI
    const bundleCard = document.querySelector(`[data-bundle-id="${bundleId}"]`);
    if (bundleCard) {
        const itemColors = bundleCard.querySelectorAll('.bundle-item-color-inline')[itemIndex];
        if (itemColors) {
            // Update Checkmarks
            itemColors.querySelectorAll('.color-circle-inline').forEach(circle => {
                circle.classList.remove('selected');
                circle.innerHTML = '';
            });
            
            // Setze neuen Checkmark
            const selectedCircle = itemColors.querySelector(`[onclick*="${colorName}"]`);
            if (selectedCircle) {
                selectedCircle.classList.add('selected');
                selectedCircle.innerHTML = '<span class="checkmark">✓</span>';
            }
            
            // Update Text
            const colorText = itemColors.querySelector('.selected-color-text');
            if (colorText) {
                colorText.textContent = colorName;
            }
        }
        
        // Update Preis basierend auf ausgewählten Farben
        updateBundlePrice(bundleId, bundleCard);
    }
}

// Funktion zum Aktualisieren des Bundle-Preises
function updateBundlePrice(bundleId, bundleCard) {
    const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
    const selections = bundleSelections[bundleId];
    
    if (!selections) return;
    
    // Berechne Gesamtpreis basierend auf ausgewählten Farben
    let totalPrice = 0;
    let basePrice = 0;
    const qty = Object.keys(selections).length;
    
    Object.values(selections).forEach(color => {
        basePrice += color.price || 24.99;
    });
    
    // Wende Rabatt an basierend auf Menge
    const discountRate = qty === 2 ? 0.85 : qty === 3 ? 0.80 : 1;
    totalPrice = basePrice * discountRate;
    
    // Update Preis-Anzeige
    const priceElement = bundleCard.querySelector('.bundle-price');
    if (priceElement) {
        priceElement.textContent = `€${totalPrice.toFixed(2)}`;
    }
    
    // Update Ersparnis
    const savingsElement = bundleCard.querySelector('.savings');
    if (savingsElement) {
        const savings = basePrice - totalPrice;
        savingsElement.textContent = `Spare €${savings.toFixed(2)}`;
    }
}

// ============================================
// TEIL 2: BUNDLE COLOR SELECTION
// ============================================

console.log('🎁 Bundle Color Selection Modul geladen');

// Funktion zum Hinzufügen von Bundles zum Warenkorb
window.addBundleToCart = function(productId) {
    console.log('🎁 addBundleToCart aufgerufen mit productId:', productId);
    
    const selectedBundle = document.querySelector('.bundle-card.selected');
    console.log('Selected Bundle:', selectedBundle);
    
    if (!selectedBundle) {
        alert('Bitte wählen Sie ein Bundle aus');
        return;
    }
    
    const bundleId = selectedBundle.getAttribute('data-bundle-id');
    const qty = parseInt(bundleId.split('qty')[1]);
    
    // Hole Farbauswahl aus localStorage
    const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
    const selectedColors = bundleSelections[bundleId] || {};
    
    // Hole Produktdaten
    console.log('🎁 Lade products.json...');
    fetch('../products.json')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load products.json');
            return res.json();
        })
        .then(products => {
            console.log('🎁 Products geladen:', products.length, 'Produkte');
            const product = products.find(p => p.id === productId);
            if (!product) return;
            
            // Erstelle Bundle-Name basierend auf Anzahl
            const bundleName = `${qty} x ${product.name}`;
            
            // Sammle alle ausgewählten Farben
            const allColors = [];
            let totalBundlePrice = 0;
            
            console.log('🎨 Bundle selectedColors:', selectedColors);
            console.log('🎨 Product colors available:', product.colors);
            
            for (let i = 0; i < qty; i++) {
                const selectedColor = selectedColors[i];
                console.log(`🎨 Color for item ${i+1}:`, selectedColor);
                
                if (selectedColor && selectedColor.name) {
                    allColors.push(selectedColor.name);
                    totalBundlePrice += selectedColor.price || product.price;
                } else if (selectedColor && typeof selectedColor === 'string') {
                    // Wenn selectedColor nur ein String ist (Name)
                    allColors.push(selectedColor);
                    // Finde den Preis für diese Farbe
                    const colorData = product.colors?.find(c => c.name === selectedColor);
                    totalBundlePrice += colorData?.price || product.price;
                } else if (product.colors && product.colors.length > 0) {
                    // Fallback auf erste Farbe
                    allColors.push(product.colors[0].name);
                    totalBundlePrice += product.colors[0].price || product.price;
                } else {
                    allColors.push('Standard');
                    totalBundlePrice += product.price;
                }
            }
            
            console.log('🎨 Final colors for bundle:', allColors);
            
            // Wenn keine Farben gefunden wurden, verwende Standardfarben
            if (allColors.length === 0 || allColors.every(c => c === 'Standard')) {
                // Verwende die ersten verfügbaren Farben als Fallback
                if (product.colors && product.colors.length > 0) {
                    for (let i = 0; i < qty; i++) {
                        const colorIndex = i % product.colors.length;
                        allColors[i] = product.colors[colorIndex].name;
                    }
                    console.log('🎨 Using fallback colors:', allColors);
                }
            }
            
            // Wende Bundle-Rabatt an
            const discountRate = qty === 2 ? 0.85 : qty === 3 ? 0.80 : 1;
            totalBundlePrice = totalBundlePrice * discountRate;
            
            // Erstelle EINEN Bundle-Eintrag mit allen Farben
            const timestamp = Date.now();
            let bundleItem = { ...product };
            
            // Erstelle Bundle-Namen mit allen Farben
            // Format: "Produktname (2 Sets) (Weiß-Rosa)" oder "(3 Sets) (Schwarz-Weiß-Grün)"
            const colorString = allColors.join('-');
            
            // Nur Farben hinzufügen wenn sie nicht "Standard" sind
            if (colorString && colorString !== 'Standard' && colorString !== 'Standard-Standard' && colorString !== 'Standard-Standard-Standard') {
                bundleItem.name = `${product.name} (${qty} Sets) (${colorString})`;
            } else {
                bundleItem.name = `${product.name} (${qty} Sets)`;
            }
            bundleItem.price = totalBundlePrice;
            bundleItem.originalPrice = product.price * qty;
            bundleItem.quantity = 1; // Ein Bundle-Eintrag
            bundleItem.isBundle = true;
            bundleItem.bundleQty = qty;
            bundleItem.bundleColors = allColors;
            bundleItem.cartItemId = `${product.id}-bundle-${timestamp}`;
            bundleItem.id = product.id;
            
            // Markiere explizit als Bundle für die Anzeige
            bundleItem.isBundleItem = true;
            bundleItem.bundleDisplay = `${qty} Sets`;
            bundleItem.bundleColorDisplay = colorString;
            
            // Verwende IMMER das Hauptbild, nicht die farbspezifischen
            bundleItem.image = product.image; // Hauptbild beibehalten
            
            // Direkt in localStorage speichern
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cart.push(bundleItem);
            localStorage.setItem('cart', JSON.stringify(cart));
            
            console.log(`✅ Bundle hinzugefügt: ${qty} Sets mit Farben:`, allColors.join(', '));
            
            // Trigger cart update event (ohne Benachrichtigung)
            window.dispatchEvent(new Event('cartUpdated'));
            document.dispatchEvent(new Event('cart-updated'));
            
            // Force localStorage event für Cart-Seite
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'cart',
                newValue: localStorage.getItem('cart'),
                url: window.location.href
            }));
            
            // Wenn wir auf der Cart-Seite sind, aktualisiere sie
            if (window.location.pathname.includes('cart.html')) {
                if (typeof updateCartPage === 'function') {
                    setTimeout(() => updateCartPage(), 100);
                }
            }
            
            console.log(`✅ ${qty} Bundle-Items erfolgreich zum Warenkorb hinzugefügt`);
            
            // Aktualisiere Cart-Counter wenn vorhanden
            const cartCounter = document.querySelector('.cart-count, .cart-counter, #cartCount');
            if (cartCounter) {
                const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');
                cartCounter.textContent = currentCart.length;
                
                // Kurze Animation für visuelles Feedback
                cartCounter.style.transform = 'scale(1.5)';
                setTimeout(() => {
                    cartCounter.style.transform = 'scale(1)';
                }, 300);
            }
            
            // Zeige eine blaue Erfolgsmeldung wie bei Produkt 19
            const successMessage = document.createElement('div');
            successMessage.className = 'alert alert-success position-fixed end-0 m-4 shadow-lg fade show';
            successMessage.style.cssText = `
                z-index: 20000;
                font-size: 1rem;
                min-width: 160px;
                max-width: 320px;
                padding: 0.75rem 2rem;
                text-align: center;
                border-radius: 2rem;
                box-shadow: 0 8px 32px rgba(0,0,0,0.18);
                background: linear-gradient(90deg, #4f8cff 0%, #38c6ff 100%);
                color: #fff;
                font-weight: 500;
                letter-spacing: 0.02em;
                pointer-events: auto;
                position: fixed;
                right: 2.5rem;
                top: calc(56px + 1.2rem);
                cursor: pointer;
            `;
            successMessage.textContent = 'Bundle zum Warenkorb hinzugefügt';
            
            // Klick führt zum Warenkorb
            successMessage.addEventListener('click', () => {
                window.location.href = '../cart.html';
            });
            
            document.body.appendChild(successMessage);
            
            // Entferne Nachricht nach 1.7 Sekunden
            setTimeout(() => {
                if (document.body.contains(successMessage)) {
                    successMessage.classList.remove('show');
                    successMessage.classList.add('fade');
                    setTimeout(() => successMessage.remove(), 400);
                }
            }, 1700);
            
            // CSS für Animation hinzufügen falls nicht vorhanden
            if (!document.getElementById('bundle-success-styles')) {
                const style = document.createElement('style');
                style.id = 'bundle-success-styles';
                style.textContent = `
                    @keyframes slideInRight {
                        from { transform: translateX(100px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOut {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100px); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Optionale Weiterleitung zum Warenkorb (aktiviere diese Zeile wenn gewünscht)
            // setTimeout(() => window.location.href = '../cart.html', 500);
        })
        .catch(err => {
            console.error('❌ Fehler beim Hinzufügen des Bundles:', err);
            alert('Fehler beim Hinzufügen des Bundles. Bitte versuchen Sie es erneut.');
        });
};

// Helper-Funktion für Cart-Benachrichtigung (komplett deaktiviert)
function showCartNotification(message) {
    // Komplett deaktiviert - keine Benachrichtigungen mehr
    return;
}

// ============================================
// TEIL 3: FIX BUNDLE NAMING
// ============================================

console.log('🔧 Fix Bundle Naming Modul geladen');

// Funktion zum Korrigieren der Bundle-Bezeichnungen
function fixBundleNaming() {
    // Korrigiere "Stück" zu "Set" in Bundle-Boxen
    document.querySelectorAll('.bundle-item-label').forEach(label => {
        if (label.textContent.includes('Stück')) {
            label.textContent = label.textContent.replace('Stück', 'Set');
        }
    });
    
    // Korrigiere Bundle-Titel
    document.querySelectorAll('.bundle-title').forEach(title => {
        const text = title.textContent;
        if (text.includes('kaufen') && !text.includes('Set')) {
            // Extrahiere Anzahl
            const match = text.match(/(\d+)/);
            if (match) {
                const qty = parseInt(match[1]);
                const newText = `${qty} Set${qty > 1 ? 's' : ''} kaufen`;
                title.childNodes[0].textContent = newText;
            }
        }
    });
    
    console.log('✅ Bundle-Bezeichnungen korrigiert');
}

// Überwache DOM-Änderungen für neue Bundle-Boxen
const bundleObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && (
                    node.classList?.contains('bundle-box') ||
                    node.querySelector?.('.bundle-box')
                )) {
                    setTimeout(fixBundleNaming, 100);
                }
            });
        }
    });
});

// Starte Überwachung wenn DOM bereit ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        fixBundleNaming();
        bundleObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
} else {
    fixBundleNaming();
    bundleObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ============================================
// AUTO-INITIALISIERUNG
// ============================================

// Auto-initialisiere für Produkte mit Farben
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Prüfe ob wir auf einer Produktseite sind
        const urlPath = window.location.pathname;
        const match = urlPath.match(/produkt-(\d+)\.html/);
        
        if (match) {
            const productId = parseInt(match[1]);
            
            // Produkte die Farbauswahl bei Bundles haben sollen
            const productsWithBundleColors = [10, 11, 17, 26];
            
            if (productsWithBundleColors.includes(productId)) {
                // Lade Produktdaten und initialisiere Bundles mit Farben
                fetch('../products.json')
                    .then(res => res.json())
                    .then(products => {
                        const prod = products.find(p => p.id === productId);
                        if (prod && prod.colors && prod.colors.length > 0) {
                            const bundleSection = document.getElementById('bundle-section');
                            if (bundleSection && !bundleSection.querySelector('.bundle-box')) {
                                console.log(`Auto-initializing bundle colors for product ${productId}`);
                                renderBundlesWithColors(productId, prod.colors);
                            }
                        }
                    })
                    .catch(err => console.error('Error loading products for bundle colors:', err));
            }
        }
    }, 2000); // Warte 2 Sekunden um sicherzustellen, dass alles geladen ist
});

// Force Bundle Colors Code direkt integriert
window.addEventListener('load', () => {
    setTimeout(() => {
        const urlPath = window.location.pathname;
        const match = urlPath.match(/produkt-(\d+)\.html/);
        
        if (match) {
            const productId = parseInt(match[1]);
            
            // Nur für Produkte 17 und 26
            if (productId === 17 || productId === 26) {
                console.log(`🔧 Forcing bundle colors for product ${productId}`);
                
                const bundleSection = document.getElementById('bundle-section');
                
                if (bundleSection && !bundleSection.querySelector('.bundle-color-selection')) {
                    console.log('🔧 No color bundles found, creating them...');
                    
                    fetch('../products.json')
                        .then(res => res.json())
                        .then(products => {
                            const prod = products.find(p => p.id === productId);
                            
                            if (prod && prod.colors && prod.colors.length > 0) {
                                console.log(`🔧 Found ${prod.colors.length} colors, rendering bundles...`);
                                bundleSection.innerHTML = '';
                                
                                // Stelle sicher, dass renderBundlesWithColors verfügbar ist
                                if (typeof renderBundlesWithColors === 'function') {
                                    renderBundlesWithColors(productId, prod.colors);
                                    console.log('✅ Bundle colors forced successfully!');
                                }
                            }
                        })
                        .catch(err => console.error('Error forcing bundle colors:', err));
                }
            }
        }
    }, 3000);
});

// CSS für inline Farbauswahl in Bundles
const bundleColorStyles = `
<style>
/* Verstecke ALLE Farbkreise in Bundles - KOMPLETT */
.bundle-color-selection .color-circle,
.bundle-color-selection [style*="border-radius: 50%"],
.bundle-color-selection [style*="background-color"],
.bundle-item-color .color-circle,
.bundle-item-color [style*="border-radius: 50%"],
.bundle-item-color [style*="background-color"],
.bundle-box .color-circle,
.bundle-box [style*="border-radius: 50%"] {
    display: none !important;
}
.bundle-color-selection {
    background: rgba(255,255,255,0.5);
    border-radius: 8px;
}

.bundle-item-color-inline {
    display: flex;
    margin: 8px 0;
    gap: 10px;
}

.bundle-item-label {
    font-size: 13px;
    color: #666;
    min-width: 60px;
}

.color-options-inline {
    display: flex;
    gap: 8px;
}

.color-circle-inline {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #ddd;
    cursor: pointer;
    position: relative;
    transition: all 0.3s ease;
}

.color-circle-inline:hover {
    transform: scale(1.1);
    border-color: #007bff;
}

.color-circle-inline.selected {
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.color-circle-inline .checkmark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 0 0 2px rgba(0,0,0,0.8);
}

.selected-color-text {
    font-size: 12px;
    color: #28a745;
    margin-left: 10px;
}
</style>`;
if (!document.getElementById('bundle-color-inline-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'bundle-color-inline-styles';
    styleElement.innerHTML = bundleColorStyles;
    document.head.appendChild(styleElement);
}

// Exportiere Funktionen
window.renderBundlesWithColors = renderBundlesWithColors;
window.selectBundleItemColor = selectBundleItemColor;

// Stelle sicher dass addBundleToCart verfügbar ist
if (typeof window.addBundleToCart !== 'function') {
    console.error('❌ addBundleToCart wurde nicht korrekt definiert!');
} else {
    console.log('✅ addBundleToCart ist verfügbar');
}

// ============================================
// BUNDLE NAME FIX - Korrigiert Bundle-Namen in Cart
// ============================================

function fixBundleNamesInCart() {
    // Nur auf cart.html ausführen
    if (!window.location.pathname.includes('cart.html')) return;
    
    const cartItems = document.querySelectorAll('.cart-item, .cart-product, [data-cart-item]');
    
    cartItems.forEach(item => {
        const nameElement = item.querySelector('.product-name, .cart-item-name, h5, h6');
        if (!nameElement) return;
        
        const currentName = nameElement.textContent.trim();
        
        // Prüfe ob es ein Bundle ist
        if (currentName.includes('Sets)') && !currentName.includes('(', currentName.indexOf('Sets)') + 5)) {
            // Bundle hat keine Farben im Namen - hole sie aus localStorage
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            
            // Finde das passende Bundle
            const bundleItem = cart.find(cartItem => {
                if (cartItem.isBundle || cartItem.isBundleItem) {
                    const baseName = cartItem.name.split('(')[0].trim();
                    const currentBaseName = currentName.split('(')[0].trim();
                    return baseName === currentBaseName;
                }
                return false;
            });
            
            if (bundleItem && bundleItem.name.includes('(') && bundleItem.name !== currentName) {
                console.log('🔧 Korrigiere Bundle-Name: ' + bundleItem.name);
                nameElement.textContent = bundleItem.name;
            }
        }
    });
}

// Initialisiere Bundle Name Fix
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(fixBundleNamesInCart, 1000);
        setInterval(fixBundleNamesInCart, 2000);
    });
} else {
    setTimeout(fixBundleNamesInCart, 1000);
    setInterval(fixBundleNamesInCart, 2000);
}

// Bei Cart-Updates
document.addEventListener('cart-updated', () => setTimeout(fixBundleNamesInCart, 100));
window.addEventListener('cartUpdated', () => setTimeout(fixBundleNamesInCart, 100));

console.log('✅ Bundle Complete vollständig geladen');
