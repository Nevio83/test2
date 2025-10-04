// Bundle Color Selection - Ermöglicht Farbauswahl für Bundle-Produkte
console.log('🎁 Bundle Color Selection geladen');

// Mapping von Bundle-IDs zu den enthaltenen Produkten mit Farben
const bundleProductMapping = {
    // 2er Bundles (2 gleiche Produkte)
    'bundle-2x-10': [10, 10], // 2x Elektrischer Wasserspender
    'bundle-2x-11': [11, 11], // 2x Elektrischer Mixer
    'bundle-2x-12': [12, 12], // 2x Gemüseschneider
    'bundle-2x-17': [17, 17], // 2x Bluetooth Finder
    'bundle-2x-21': [21, 21], // 2x LED Lampe
    'bundle-2x-26': [26, 26], // 2x Hair Brush
    
    // 3er Bundles (3 gleiche Produkte)
    'bundle-3x-10': [10, 10, 10], // 3x Elektrischer Wasserspender
    'bundle-3x-11': [11, 11, 11], // 3x Elektrischer Mixer
    'bundle-3x-12': [12, 12, 12], // 3x Gemüseschneider
    'bundle-3x-17': [17, 17, 17], // 3x Bluetooth Finder
    'bundle-3x-21': [21, 21, 21], // 3x LED Lampe
    'bundle-3x-26': [26, 26, 26], // 3x Hair Brush
    
    // Gemischte Bundles
    'bundle-mix-kitchen': [10, 11, 12], // Küchen-Bundle
    'bundle-mix-tech': [17, 21], // Tech-Bundle
};

// Funktion zum Rendern der Bundle-Farbauswahl
async function renderBundleColorSelector(bundleId, container) {
    const productIds = bundleProductMapping[bundleId];
    if (!productIds) {
        console.log(`⚠️ Kein Bundle-Mapping für ${bundleId}`);
        return '';
    }
    
    let html = '<div class="bundle-color-selectors">';
    html += '<h6 class="mb-2">Wählen Sie Farben für jedes Produkt im Bundle:</h6>';
    
    for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        const colors = await loadProductColors(productId);
        
        if (colors && colors.length > 0) {
            // Lade Produktname
            const products = await loadProducts();
            const product = products.find(p => p.id === productId);
            const productName = product ? product.name : `Produkt ${productId}`;
            
            html += `
                <div class="bundle-item-color mb-3" data-bundle-item="${i}">
                    <label class="small text-muted">Artikel ${i + 1}: ${productName}</label>
                    <div class="d-flex gap-2 align-items-center">
                        <div class="color-options-bundle d-flex gap-1">
                            ${colors.map(color => `
                                <div class="color-option-bundle" 
                                     data-bundle-id="${bundleId}"
                                     data-item-index="${i}"
                                     data-product-id="${productId}"
                                     data-color-name="${color.name}"
                                     data-color-code="${color.code}"
                                     data-color-sku="${color.sku || 'default'}"
                                     data-color-price="${color.price}"
                                     style="background-color: ${color.code};"
                                     title="${color.name}"
                                     onclick="selectBundleColor('${bundleId}', ${i}, '${color.name}', '${color.code}', '${color.sku || 'default'}', ${color.price})">
                                </div>
                            `).join('')}
                        </div>
                        <span class="small selected-color-name">${colors[0].name}</span>
                    </div>
                </div>
            `;
        }
    }
    
    html += '</div>';
    return html;
}

// Funktion zum Auswählen einer Farbe für ein Bundle-Produkt
function selectBundleColor(bundleId, itemIndex, colorName, colorCode, colorSku, colorPrice) {
    console.log(`🎨 Bundle ${bundleId}, Item ${itemIndex}: Farbe ${colorName} ausgewählt`);
    
    // Speichere die Auswahl im localStorage
    const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}');
    
    if (!bundleSelections[bundleId]) {
        bundleSelections[bundleId] = {};
    }
    
    bundleSelections[bundleId][itemIndex] = {
        name: colorName,
        code: colorCode,
        sku: colorSku,
        price: colorPrice
    };
    
    localStorage.setItem('bundleColorSelections', JSON.stringify(bundleSelections));
    
    // Update UI
    updateBundleColorUI(bundleId, itemIndex, colorName);
    
    // Wenn auf Produktseite, update auch den Preis
    if (window.location.pathname.includes('produkt-')) {
        updateBundlePrice(bundleId);
    }
}

// UI Update für Bundle-Farbauswahl
function updateBundleColorUI(bundleId, itemIndex, colorName) {
    // Entferne "selected" von allen Farben dieses Items
    const itemContainer = document.querySelector(`.bundle-item-color[data-bundle-item="${itemIndex}"]`);
    if (itemContainer) {
        itemContainer.querySelectorAll('.color-option-bundle').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Füge "selected" zur gewählten Farbe hinzu
        const selectedOption = itemContainer.querySelector(`[data-color-name="${colorName}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // Update Farbnamen-Anzeige
        const nameDisplay = itemContainer.querySelector('.selected-color-name');
        if (nameDisplay) {
            nameDisplay.textContent = colorName;
        }
    }
}

// Preis-Update für Bundles
function updateBundlePrice(bundleId) {
    const selections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}')[bundleId];
    if (!selections) return;
    
    let totalPrice = 0;
    Object.values(selections).forEach(selection => {
        totalPrice += selection.price || 0;
    });
    
    // Update Preis-Anzeige
    const priceElement = document.querySelector('.bundle-total-price');
    if (priceElement) {
        priceElement.textContent = `€${totalPrice.toFixed(2)}`;
    }
}

// Hilfsfunktion zum Laden der Produkte
async function loadProducts() {
    try {
        const response = await fetch('products.json');
        return await response.json();
    } catch (error) {
        console.error('Fehler beim Laden der Produkte:', error);
        return [];
    }
}

// CSS für Bundle-Farbauswahl
const bundleColorStyles = `
<style>
.bundle-color-selectors {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    margin: 10px 0;
}

.bundle-item-color {
    padding: 10px;
    background: white;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}

.color-options-bundle {
    display: flex;
    gap: 6px;
}

.color-option-bundle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid #ddd;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
}

.color-option-bundle:hover {
    transform: scale(1.15);
    border-color: #007bff;
    box-shadow: 0 2px 8px rgba(0,123,255,0.3);
}

.color-option-bundle.selected {
    border: 3px solid #28a745;
    box-shadow: 0 0 10px rgba(40, 167, 69, 0.4);
}

.color-option-bundle.selected::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 0 0 3px rgba(0,0,0,0.8);
}

.selected-color-name {
    font-weight: 600;
    color: #495057;
    min-width: 80px;
}
</style>
`;

// Füge Styles zum Head hinzu
if (!document.getElementById('bundle-color-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'bundle-color-styles';
    styleElement.innerHTML = bundleColorStyles;
    document.head.appendChild(styleElement);
}

// Exportiere Funktionen
window.renderBundleColorSelector = renderBundleColorSelector;
window.selectBundleColor = selectBundleColor;
window.bundleProductMapping = bundleProductMapping;

// Integration mit addProductToCart für Bundles
const originalAddToCart = window.addProductToCart;
if (originalAddToCart) {
    window.addProductToCart = function(productsParam, productId, fromCartDropdown = false) {
        // Prüfe ob es ein Bundle ist
        const isBundleId = String(productId).startsWith('bundle-');
        
        if (isBundleId) {
            console.log('🎁 Bundle zum Warenkorb hinzufügen:', productId);
            
            // Hole die Farbauswahl für dieses Bundle
            const bundleSelections = JSON.parse(localStorage.getItem('bundleColorSelections') || '{}')[productId];
            const productIds = bundleProductMapping[productId];
            
            if (productIds && bundleSelections) {
                // Füge jedes Produkt mit seiner gewählten Farbe hinzu
                productIds.forEach((prodId, index) => {
                    const selection = bundleSelections[index];
                    if (selection) {
                        // Setze temporär die Farbe für dieses Produkt
                        window.product = {
                            id: prodId,
                            selectedColor: selection.name,
                            selectedColorCode: selection.code,
                            selectedColorSku: selection.sku,
                            price: selection.price
                        };
                    }
                    
                    // Füge das Produkt hinzu
                    originalAddToCart.call(this, productsParam, prodId, fromCartDropdown);
                });
                
                return; // Verhindere das normale Hinzufügen
            }
        }
        
        // Normale Produkte
        return originalAddToCart.apply(this, arguments);
    };
}

console.log('✅ Bundle Color Selection initialisiert');
