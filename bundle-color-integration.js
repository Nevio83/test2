// Bundle Color Integration - Integriert Farbauswahl in Bundle-Boxen auf Produktseiten
console.log('🎨 Bundle Color Integration geladen');

// Erweiterte renderBundles Funktion mit optionaler Farbauswahl
function renderBundlesWithColors(productId, productColors) {
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
                                        ${Array.from({length: s.qty}, (_, j) => `
                                            <div class="bundle-item-color-inline">
                                                <span class="color-label">Stück ${j+1}:</span>
                                                <div class="color-options-inline">
                                                    ${productColors.map(color => `
                                                        <div class="color-dot ${bundleSelections[bundleId] && bundleSelections[bundleId][j] && bundleSelections[bundleId][j].name === color.name ? 'selected' : ''}"
                                                             style="background-color: ${color.code};"
                                                             title="${color.name}"
                                                             data-bundle-id="${bundleId}"
                                                             data-item-index="${j}"
                                                             data-color='${JSON.stringify(color)}'
                                                             onclick="selectBundleItemColor('${bundleId}', ${j}, '${JSON.stringify(color).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
                                                        </div>
                                                    `).join('')}
                                                </div>
                                                <span class="selected-color-text">${bundleSelections[bundleId] && bundleSelections[bundleId][j] ? bundleSelections[bundleId][j].name : productColors[0].name}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                
                                <div class="bundle-prices">
                                    €<span class="bundle-price-per-set">${s.price.toFixed(2)}</span> pro Set
                                    <span class="savings">Spare €${((s.original-s.price)*s.qty).toFixed(2)}</span>
                                </div>
                                ${s.qty>1?`<div class='bundle-total'>Gesamt: <b>€<span class="bundle-total-price">${(s.price*s.qty).toFixed(2)}</span></b></div>`:''}
                            </div>
                        </div>
                    `;
                }).join('')}
                <button type="submit" class="btn bundle-add-btn">In den Warenkorb</button>
            </form>
        </div>
    `;
    
    // Event-Listener für Bundle-Auswahl
    const cards = section.querySelectorAll('.bundle-card');
    const radios = section.querySelectorAll('.bundle-radio');
    
    radios.forEach((radio, i) => {
        radio.addEventListener('change', () => {
            cards.forEach(c => c.classList.remove('selected'));
            cards[i].classList.add('selected');
        });
    });
    
    cards.forEach((card, i) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.color-dot')) return; // Ignoriere Klicks auf Farbauswahl
            if (!e.target.closest('.bundle-radio')) {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                radios[i].checked = true;
            }
        });
    });
    
    // Form Submit Handler
    section.querySelector('#bundleForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const idx = Array.from(radios).findIndex(r => r.checked);
        const s = staffel[idx];
        const bundleId = `bundle-${productId}-qty${s.qty}`;
        const selections = bundleSelections[bundleId] || {};
        
        // Hole Produktname aus products.json
        fetch('../products.json')
            .then(res => res.json())
            .then(products => {
                const product = products.find(p => p.id === productId);
                const productName = product ? product.name : `Produkt ${productId}`;
                
                // Sammle alle Farben für den Bundle-Namen
                let allColors = [];
                let basePrice = 0;
                
                // Lade aktuelle Selections aus localStorage (wichtig!)
                const currentBundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
                const currentSelections = currentBundleSelections[bundleId] || {};
                
                // Debug: Zeige aktuelle Selections
                console.log('📦 Aktuelle Bundle Selections für', bundleId, ':', currentSelections);
                
                // Berechne Basispreis basierend auf gewählten Farben
                for (let j = 0; j < s.qty; j++) {
                    // Verwende die aktuellen Selections aus localStorage
                    const colorSelection = currentSelections[j] || selections[j];
                    if (colorSelection && colorSelection.name) {
                        // Füge jede gewählte Farbe zur Liste hinzu
                        allColors.push(colorSelection.name);
                        basePrice += colorSelection.price || s.price;
                        console.log(`✅ Stück ${j+1}: ${colorSelection.name}`);
                    } else if (productColors && productColors.length > 0) {
                        // Wenn keine Farbe gewählt wurde aber Farben verfügbar sind, nimm die erste
                        const defaultColor = productColors[0];
                        allColors.push(defaultColor.name);
                        basePrice += defaultColor.price || s.price;
                        console.log(`⚠️ Stück ${j+1}: Default ${defaultColor.name}`);
                        // Speichere auch die Default-Auswahl
                        if (!currentSelections[j]) {
                            currentSelections[j] = defaultColor;
                        }
                    } else {
                        basePrice += s.price;
                    }
                }
                
                // Speichere aktualisierte Selections zurück
                if (productColors && productColors.length > 0) {
                    currentBundleSelections[bundleId] = currentSelections;
                    localStorage.setItem('bundleColorSelections', JSON.stringify(currentBundleSelections));
                }
                
                // Berechne finalen Preis basierend auf gewählten Farben
                let totalPrice = basePrice; // Verwende die Summe der Farbpreise
                
                // Wende Bundle-Rabatt an
                if (s.qty === 2) {
                    totalPrice = totalPrice * 0.85; // 15% Rabatt
                } else if (s.qty === 3) {
                    totalPrice = totalPrice * 0.80; // 20% Rabatt
                }
                
                // Erstelle Bundle-Namen
                let bundleName = productName;
                bundleName += ` (${s.qty} Set${s.qty > 1 ? 's' : ''})`;
                
                // Füge Farben hinzu wenn vorhanden
                if (allColors.length > 0 && productColors && productColors.length > 0) {
                    // Zeige ALLE gewählten Farben, auch Duplikate
                    allColors.forEach(color => {
                        bundleName += ` (${color})`;
                    });
                }
                
                // Erstelle eine eindeutige ID basierend auf Farben
                const colorSignature = allColors.join('-').toLowerCase().replace(/\s+/g, '');
                const uniqueBundleId = `${bundleId}-${colorSignature}`;
                
                // Erstelle EINEN Warenkorb-Eintrag für das gesamte Bundle
                const cartItem = {
                    id: productId,
                    name: bundleName,
                    price: totalPrice,
                    originalPrice: totalPrice / (s.qty === 2 ? 0.85 : s.qty === 3 ? 0.80 : 1),
                    image: product ? product.image : '',
                    quantity: 1,
                    bundleId: bundleId,
                    uniqueBundleId: uniqueBundleId,
                    bundleQuantity: s.qty,
                    bundleColors: allColors,
                    isBundle: true
                };
                
                // Füge zum Warenkorb hinzu
                let cart = JSON.parse(localStorage.getItem('cart') || '[]');
                
                // Prüfe ob EXAKT dieses Bundle bereits existiert (verwende uniqueBundleId)
                const existingIndex = cart.findIndex(item => 
                    item.uniqueBundleId === uniqueBundleId || 
                    (item.bundleId === bundleId && 
                     JSON.stringify(item.bundleColors) === JSON.stringify(allColors))
                );
                
                if (existingIndex >= 0) {
                    // Nur erhöhe Quantity wenn es EXAKT das gleiche Bundle ist
                    cart[existingIndex].quantity++;
                } else {
                    // Füge als neues Item hinzu
                    cart.push(cartItem);
                }
                
                localStorage.setItem('cart', JSON.stringify(cart));
                
                console.log('✅ Bundle zum Warenkorb hinzugefügt:', cartItem);
                console.log('📦 Aktueller Warenkorb:', cart);
                
                // Zeige Erfolgs-Nachricht und navigiere zum Warenkorb
                if (typeof showAlert === 'function') {
                    showAlert(`${s.qty} Set${s.qty>1?'s':''} zum Warenkorb hinzugefügt`, 'cart.html');
                } else if (typeof showNotification === 'function') {
                    showNotification(`${s.qty} Set${s.qty>1?'s':''} zum Warenkorb hinzugefügt`);
                    // Navigiere nach kurzer Verzögerung
                    setTimeout(() => {
                        window.location.href = '../cart.html';
                    }, 1000);
                } else {
                    alert(`${s.qty} Set${s.qty>1?'s':''} zum Warenkorb hinzugefügt`);
                    window.location.href = '../cart.html';
                }
            })
            .catch(err => {
                console.error('Fehler beim Laden der Produkte:', err);
            });
    });
}

// Funktion zum Auswählen einer Farbe für ein Bundle-Item
function selectBundleItemColor(bundleId, itemIndex, colorData) {
    console.log(`🎨 selectBundleItemColor aufgerufen:`, {bundleId, itemIndex, colorData});
    
    // Parse colorData wenn es ein String ist
    if (typeof colorData === 'string') {
        try {
            // Entferne escape characters
            colorData = colorData.replace(/\\/g, '');
            colorData = colorData.replace(/&quot;/g, '"');
            colorData = JSON.parse(colorData);
        } catch (e) {
            console.error('Fehler beim Parsen der Farbdaten:', e, colorData);
            return;
        }
    }
    
    console.log(`✅ Farbe geparst:`, colorData);
    
    // Speichere die Auswahl
    const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
    
    if (!bundleSelections[bundleId]) {
        bundleSelections[bundleId] = {};
    }
    
    // Speichere die komplette Farbinformation
    bundleSelections[bundleId][itemIndex] = {
        name: colorData.name,
        code: colorData.code || colorData.hex,
        price: colorData.price,
        sku: colorData.sku
    };
    
    localStorage.setItem('bundleColorSelections', JSON.stringify(bundleSelections));
    console.log(`💾 Gespeichert:`, bundleSelections);
    
    // Update UI
    updateBundleColorUI(bundleId, itemIndex, colorData.name);
    
    // Update den Preis sofort
    const bundleCard = document.querySelector(`.bundle-card[data-bundle-id="${bundleId}"]`);
    if (bundleCard) {
        updateBundlePrice(bundleId, bundleCard);
    }
}

// UI Update für Bundle-Farbauswahl
function updateBundleColorUI(bundleId, itemIndex, colorName) {
    const bundleCard = document.querySelector(`.bundle-card[data-bundle-id="${bundleId}"]`);
    if (bundleCard) {
        // Finde das spezifische Item
        const itemContainers = bundleCard.querySelectorAll('.bundle-item-color-inline');
        const itemContainer = itemContainers[itemIndex];
        
        if (itemContainer) {
            // Entferne "selected" von allen Farben dieses Items
            itemContainer.querySelectorAll('.color-dot').forEach(dot => {
                dot.classList.remove('selected');
            });
            
            // Füge "selected" zur gewählten Farbe hinzu
            const selectedDot = itemContainer.querySelector(`.color-dot[title="${colorName}"]`);
            if (selectedDot) {
                selectedDot.classList.add('selected');
            }
            
            // Update Text
            const textElement = itemContainer.querySelector('.selected-color-text');
            if (textElement) {
                textElement.textContent = colorName;
            }
        }
        
        // Update Preis basierend auf Farbauswahl
        updateBundlePrice(bundleId, bundleCard);
    }
}

// Update Bundle-Preis basierend auf Farbauswahl
function updateBundlePrice(bundleId, bundleCard) {
    const selections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}')[bundleId];
    if (!selections) return;
    
    // Extrahiere qty aus bundleId
    const qtyMatch = bundleId.match(/qty(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : Object.keys(selections).length;
    
    let basePrice = 0;
    
    // Summiere alle Preise basierend auf gewählten Farben
    for (let i = 0; i < qty; i++) {
        const selection = selections[i];
        if (selection && selection.price) {
            basePrice += parseFloat(selection.price);
            console.log(`💰 Stück ${i+1}: ${selection.name} = €${selection.price}`);
        } else {
            basePrice += 24.99; // Fallback-Preis
        }
    }
    
    // Berechne Rabatt-Preise
    let totalPrice = basePrice;
    let perSetPrice = basePrice / qty;
    
    // Wende Rabatt an
    if (qty === 2) {
        totalPrice = basePrice * 0.85; // 15% Rabatt
        perSetPrice = totalPrice / qty;
    } else if (qty === 3) {
        totalPrice = basePrice * 0.80; // 20% Rabatt  
        perSetPrice = totalPrice / qty;
    }
    
    console.log(`📊 Bundle-Preis Update: Basis €${basePrice.toFixed(2)} → Total €${totalPrice.toFixed(2)} (${qty} Sets)`);
    
    // Update pro Set Preis
    const perSetElement = bundleCard.querySelector('.bundle-price-per-set');
    if (perSetElement) {
        perSetElement.textContent = perSetPrice.toFixed(2);
    }
    
    // Update Gesamtpreis
    const totalElement = bundleCard.querySelector('.bundle-total-price');
    if (totalElement) {
        totalElement.textContent = totalPrice.toFixed(2);
    }
    
    // Update Ersparnis
    const savingsElement = bundleCard.querySelector('.savings');
    if (savingsElement) {
        const savings = basePrice - totalPrice;
        savingsElement.textContent = `Spare €${savings.toFixed(2)}`;
    }
}

// CSS für inline Farbauswahl in Bundles
const bundleColorStyles = `
<style>
.bundle-color-selection {
    margin: 15px 0;
    padding: 10px;
    background: rgba(255,255,255,0.5);
    border-radius: 8px;
}

.bundle-item-color-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
    padding: 5px;
}

.color-label {
    font-size: 13px;
    color: #666;
    min-width: 60px;
}

.color-options-inline {
    display: flex;
    gap: 5px;
}

.color-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #ddd;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.color-dot:hover {
    transform: scale(1.2);
    border-color: #007bff;
}

.color-dot.selected {
    border: 2px solid #28a745;
    box-shadow: 0 0 6px rgba(40, 167, 69, 0.4);
}

.color-dot.selected::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 10px;
    font-weight: bold;
    text-shadow: 0 0 2px rgba(0,0,0,0.8);
}

.selected-color-text {
    font-size: 12px;
    color: #333;
    font-weight: 500;
    min-width: 50px;
}

.bundle-card.selected .bundle-color-selection {
    background: rgba(255,255,255,0.8);
}
</style>
`;

// Füge Styles hinzu
if (!document.getElementById('bundle-color-inline-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'bundle-color-inline-styles';
    styleElement.innerHTML = bundleColorStyles;
    document.head.appendChild(styleElement);
}

// Exportiere Funktionen
window.renderBundlesWithColors = renderBundlesWithColors;
window.selectBundleItemColor = selectBundleItemColor;

console.log('✅ Bundle Color Integration initialisiert');
