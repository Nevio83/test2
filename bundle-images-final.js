// Bundle Images Final - Komplette Lösung für Bundle-Bilder
console.log('🎨 Bundle Images Final wird geladen...');

// Globale Variable um mehrfaches Laden zu verhindern
let bundleSystemInitialized = false;

// Globale Funktion zum Aktualisieren der Bundle-Preise (sofort verfügbar)
window.updateBundlePricesWithNewPrice = function(newPrice) {
    if (!window.product) {
        console.log('⚠️ window.product nicht verfügbar');
        return;
    }
    
    console.log('🔄 Aktualisiere Bundle-Preise auf:', newPrice);
    
    // Update product price
    window.product.price = newPrice;
    
    // Setze das Flag zurück damit Neu-Rendering erlaubt wird
    const bundleSection = document.getElementById('bundle-section');
    if (bundleSection) {
        bundleSection.dataset.bundleRendered = 'false';
    }
    
    // Re-render bundles with new price if function exists
    if (typeof window.renderBundlesWithImages === 'function') {
        window.renderBundlesWithImages();
        console.log('✅ Bundles mit neuem Preis neu gerendert:', newPrice);
    } else {
        console.log('⚠️ renderBundlesWithImages noch nicht verfügbar, versuche später...');
        setTimeout(() => {
            if (typeof window.renderBundlesWithImages === 'function') {
                // Setze Flag auch hier zurück
                if (bundleSection) {
                    bundleSection.dataset.bundleRendered = 'false';
                }
                window.renderBundlesWithImages();
            }
        }, 100);
    }
};

// Warte bis DOM bereit ist
document.addEventListener('DOMContentLoaded', function() {
    if (bundleSystemInitialized) {
        console.log('⚠️ Bundle-System bereits initialisiert, überspringe');
        return;
    }
    bundleSystemInitialized = true;
    console.log('🎨 Initialisiere Bundle-Bilder...');
    
    // Funktion zum Bestimmen der Kategorie-Farbe
    function getCategoryColor(category) {
        switch(category) {
            case 'Haushalt und Küche':
                return '#43e97b'; // Grün
            case 'Technik/Gadgets':
                return '#4A90E2'; // Blau
            case 'Beleuchtung':
                return '#FFD700'; // Gold
            case 'Körperpflege/Wellness':
                return '#E91E63'; // Pink
            default:
                return '#007bff'; // Standard Blau
        }
    }
    
    // Funktion für dunklere Variante der Kategorie-Farbe
    function getDarkerCategoryColor(category) {
        switch(category) {
            case 'Haushalt und Küche':
                return '#2ecc71'; // Dunkleres Grün
            case 'Technik/Gadgets':
                return '#2c5aa0'; // Dunkleres Blau
            case 'Beleuchtung':
                return '#FFA500'; // Orange-Gold
            case 'Körperpflege/Wellness':
                return '#c2185b'; // Dunkleres Pink
            default:
                return '#0056b3'; // Dunkleres Standard Blau
        }
    }
    
    // Funktion zum Rendern der Bundles mit Bildern
    function renderBundlesWithImages() {
        const bundleSection = document.getElementById('bundle-section');
        if (!bundleSection) {
            console.log('❌ Bundle-Section nicht gefunden');
            return;
        }
        
        // Verhindere mehrfaches Laden
        if (bundleSection.dataset.bundleRendered === 'true') {
            console.log('⚠️ Bundle bereits gerendert, überspringe');
            return;
        }
        
        // Hole Farben und Kategorie vom aktuellen Produkt
        let colors = [];
        let productCategory = 'Haushalt und Küche'; // Default
        
        // Hole Produktdaten vom globalen product-Objekt
        if (window.product) {
            productCategory = window.product.category || 'Haushalt und Küche';
            console.log('✅ Produktdaten von window.product geholt:', { category: productCategory, productId: window.product.id });
            
            // Hole Farben aus window.product.colors falls vorhanden
            if (window.product.colors && window.product.colors.length > 0) {
                colors = window.product.colors;
                console.log('✅ Farben direkt aus window.product.colors geholt:', colors.length, 'Farben:', colors.map(c => c.name));
                console.log('🎨 Alle Farbdaten:', colors);
                renderBundleContent(colors, productCategory);
                return;
            }
            
            // Fallback: Hole Farben aus products.json basierend auf der Produkt-ID
            fetch('../products.json')
                .then(res => res.json())
                .then(products => {
                    const prod = products.find(p => p.id === window.product.id);
                    if (prod && prod.colors) {
                        colors = prod.colors;
                        console.log('✅ Farben aus products.json geholt:', colors.length, 'Farben:', colors.map(c => c.name));
                        console.log('🎨 Alle Farbdaten:', colors);
                        renderBundleContent(colors, productCategory);
                    } else {
                        console.log('⚠️ Keine Farben für Produkt', window.product.id, 'Gefundenes Produkt:', prod);
                        renderBundleContent([], productCategory);
                    }
                })
                .catch(err => {
                    console.error('❌ Fehler beim Laden der products.json:', err);
                    renderBundleContent([], productCategory);
                });
            return; // Früher Return, da async
        } else if (window.imageColorSelection && window.imageColorSelection.productData) {
            const productData = window.imageColorSelection.productData;
            colors = productData.colors || [];
            productCategory = productData.category || 'Haushalt und Küche';
            console.log('✅ Produktdaten von imageColorSelection geholt:', { colors, category: productCategory });
        } else {
            console.log('⚠️ Keine Produktdaten gefunden, verwende Standard-Bundle');
            colors = [];
        }
        
        renderBundleContent(colors, productCategory, null);
    }
    
    // Separate Funktion für das eigentliche Rendering
    function renderBundleContent(colors, productCategory, productData = null) {
        
        const categoryColor = getCategoryColor(productCategory);
        const darkerCategoryColor = getDarkerCategoryColor(productCategory);
        
        // Bundle-Optionen basierend auf aktuellem Produkt
        const currentProduct = productData || window.product;
        
        // Hole Produkt-ID aus URL falls window.product nicht vorhanden
        let productId = currentProduct ? currentProduct.id : null;
        if (!productId) {
            const urlPath = window.location.pathname;
            const productMatch = urlPath.match(/produkt-(\d+)\.html/);
            if (productMatch) {
                productId = parseInt(productMatch[1]);
            }
        }
        
        const basePrice = currentProduct ? currentProduct.price : 24.99;
        const productName = currentProduct ? currentProduct.name : `Produkt ${productId || ''}`;
        
        console.log('🎁 Bundle-Rendering für:', { id: productId, name: productName, price: basePrice, windowProduct: !!window.product });
        console.log('🎨 Verfügbare Farben für Bundle:', colors.length, colors.map(c => c.name));
        console.log('🎨 WICHTIG - Colors Array:', colors);
        
        // WICHTIG: Wenn keine Farben vorhanden sind, zeige Warnung
        if (!colors || colors.length === 0) {
            console.warn('⚠️⚠️⚠️ KEINE FARBEN VERFÜGBAR - Bundle wird ohne Farbbilder gerendert!');
            console.warn('window.product:', window.product);
            console.warn('window.product.colors:', window.product?.colors);
        }
        
        const bundles = [
            { qty: 2, price: (basePrice * 0.85), discount: 15 },
            { qty: 3, price: (basePrice * 0.80), discount: 20 }
        ];
        
        // Erstelle HTML
        let html = `
            <div class="bundle-container">
                <h2 class="bundle-title">BUNDLE & SPARE</h2>
                
                ${bundles.map((bundle, index) => `
                    <div class="bundle-card ${index === 0 ? 'selected' : ''}" data-bundle-id="${bundle.qty}">
                        <input type="radio" name="bundle" value="${bundle.qty}" ${index === 0 ? 'checked' : ''} class="bundle-radio" style="display: none;">
                        
                        <div class="bundle-content">
                            <div class="bundle-left">
                                <h3 class="bundle-qty">${bundle.qty} Set${bundle.qty > 1 ? 's' : ''} kaufen</h3>
                            </div>
                            
                            <div class="bundle-colors" style="display: ${colors && colors.length > 0 ? 'block' : 'none'} !important;">
                                ${Array.from({length: bundle.qty}, (_, i) => `
                                    <div class="bundle-set" style="display: block !important; visibility: visible !important;">
                                        <span class="set-label" style="display: block !important; visibility: visible !important;">Set ${i + 1}:</span>
                                        <div class="color-images" style="display: flex !important; visibility: visible !important;">
                                            ${colors.map((color, colorIndex) => `
                                                <div class="color-image-option ${colorIndex === 0 ? 'selected' : ''}" 
                                                     data-set="${i}" 
                                                     data-color="${color.name}"
                                                     onclick="selectBundleColor(${bundle.qty}, ${i}, '${color.name}', this)">
                                                    ${colorIndex === 0 ? '<span class="checkmark">✓</span>' : ''}
                                                    <img src="${getImagePathForBundle(productId, color)}" alt="${color.name}" class="color-img">
                                                    <span class="color-name">${color.name}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="bundle-pricing">
                                <div class="price-display" style="display: flex; align-items: center; justify-content: space-between; gap: 15px; flex-wrap: wrap;">
                                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                                        <span class="price">Gesamt: €${(bundle.price * bundle.qty).toFixed(2)}</span>
                                        ${bundle.discount > 0 ? `<span class="original">€${(basePrice * bundle.qty).toFixed(2)}</span>` : ''}
                                    </div>
                                    ${bundle.discount > 0 ? `<div class="bundle-savings-badge">Spare €${((basePrice * bundle.qty) - (bundle.price * bundle.qty)).toFixed(2)}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                <button class="add-bundle-btn" onclick="addSelectedBundleToCart()">
                    <i class="bi bi-cart-plus"></i> Ausgewähltes Bundle in den Warenkorb
                </button>
            </div>
        `;
        
        const bundleSection = document.getElementById('bundle-section');
        if (bundleSection) {
            bundleSection.innerHTML = html;
            bundleSection.dataset.bundleRendered = 'true';
            console.log('✅ Bundle HTML eingefügt');
            
            // Optimierte Scrollbar-Initialisierung ohne Debug-Code
            requestAnimationFrame(() => {
                const colorContainers = bundleSection.querySelectorAll('.color-images');
                colorContainers.forEach(container => {
                    container.style.maxWidth = '400px';
                    container.style.overflowX = 'scroll';
                });
            });
            
            // Event Listener für Bundle-Karten (zum Auswählen)
            const bundleCards = bundleSection.querySelectorAll('.bundle-card');
            bundleCards.forEach(card => {
                card.addEventListener('click', function(e) {
                    // Ignoriere Klicks auf Farbauswahl
                    if (e.target.closest('.color-image-option')) return;
                    
                    // Entferne selected von allen Karten
                    bundleCards.forEach(c => c.classList.remove('selected'));
                    // Füge selected zur geklickten Karte hinzu
                    this.classList.add('selected');
                    // Setze Radio Button
                    this.querySelector('.bundle-radio').checked = true;
                });
            });
            console.log(`✅ ${bundleCards.length} Bundle-Karten Event Listener hinzugefügt`);
        } else {
            console.log('❌ Bundle-Section nicht gefunden');
        }
        
        // Füge CSS hinzu (nur einmal)
        if (!document.getElementById('bundle-images-styles')) {
            console.log('🎨 Füge Bundle-CSS hinzu');
            const style = document.createElement('style');
            style.id = 'bundle-images-styles';
            style.textContent = `
                .bundle-container {
                    padding: 70px;
                    max-width: 650px;
                    margin: 0 auto;
                }
                
                
                .bundle-title {
                    text-align: center;
                    margin-bottom: 30px;
                    font-size: 28px;
                    font-weight: bold;
                    color: #333;
                }
                
                .bundle-card {
                    background: white;
                    border: 3px solid #e0e0e0;
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 20px;
                    position: relative;
                    cursor: pointer;
                    transition: transform 0.2s ease, border-color 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    will-change: transform;
                }
                
                .bundle-savings-badge {
                    background: #28a745;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
                    white-space: nowrap;
                    flex-shrink: 0;
                    align-self: center;
                }
                
                .price-display {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                
                .bundle-card:hover {
                    border-color: rgba(255, 255, 255, 0.35);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
                }
                
                .bundle-card.selected {
                    border-color: rgba(255, 255, 255, 0.6);
                    background: rgba(255, 255, 255, 0.3);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
                    transform: scale(1.02);
                }
                
                .bundle-card.bundle-card.selected::before {
                    content: '\\2713' !important;
                    position: absolute !important;
                    top: 5px !important;
                    right: 5px !important;
                    left: auto !important;
                    bottom: auto !important;
                    width: 35px !important;
                    height: 35px !important;
                    background: rgba(255, 255, 255, 0.95) !important;
                    color: ${categoryColor} !important;
                    border-radius: 50% !important;
                    display: block !important;
                    font-weight: bold !important;
                    font-size: 1.3rem !important;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
                    z-index: 10 !important;
                    text-align: center !important;
                    line-height: 35px !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .bundle-content {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .bundle-qty {
                    margin: 0 0 20px 0;
                    font-size: 32px;
                    color: #ffffff;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                
                .bundle-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .bundle-header h3 {
                    margin: 0;
                    font-size: 18px;
                }
                
                .discount-badge {
                    background: linear-gradient(90deg, ${categoryColor} 0%, ${darkerCategoryColor} 100%);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 4px ${categoryColor}30;
                }
                
                .popular-badge {
                    background: linear-gradient(135deg, ${darkerCategoryColor} 0%, ${categoryColor} 100%);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: bold;
                    animation: pulse 2s infinite;
                    box-shadow: 0 2px 6px ${darkerCategoryColor}40;
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                .best-badge {
                    background: linear-gradient(45deg, #ff6b6b 0%, ${categoryColor} 50%, ${darkerCategoryColor} 100%);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: bold;
                    position: relative;
                    overflow: hidden;
                }
                
                .best-badge::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
                    transform: rotate(45deg);
                    animation: shine 3s infinite;
                }
                
                @keyframes shine {
                    0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
                }
                
                .bundle-colors {
                    margin: 10px 0;
                }
                
                .bundle-set {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                    width: 100%;
                    gap: 8px;
                }
                
                .set-label {
                    min-width: 60px;
                    font-size: 18px;
                    color: #ffffff;
                    flex-shrink: 0;
                    font-weight: 600;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }
                
                .color-images {
                    display: flex !important;
                    gap: 5px !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    padding: 2px 0 8px 0 !important;
                    scroll-behavior: smooth !important;
                    -webkit-overflow-scrolling: touch !important;
                    flex: 1;
                    min-width: 0;
                    scrollbar-width: thin !important;
                    scrollbar-color: ${categoryColor} #f1f1f1 !important;
                }
                
                /* Stelle sicher, dass der Container für alle Düfte scrollbar ist */
                .color-images > * {
                    flex-shrink: 0;
                }
                
                .color-images::-webkit-scrollbar {
                    height: 6px !important;
                    display: block !important;
                }
                
                .color-images::-webkit-scrollbar-track {
                    background: #f1f1f1 !important;
                    border-radius: 3px !important;
                }
                
                .color-images::-webkit-scrollbar-thumb {
                    background: ${categoryColor} !important;
                    border-radius: 3px !important;
                }
                
                .color-images::-webkit-scrollbar-thumb:hover {
                    background: ${darkerCategoryColor} !important;
                }
                
                .color-image-option {
                    position: relative !important;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 2px;
                    cursor: pointer;
                    transition: transform 0.2s ease, border-color 0.2s ease;
                    display: inline-block;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    flex-shrink: 0;
                    min-width: 56px;
                    width: 56px;
                    max-width: 56px;
                    height: auto;
                    will-change: transform;
                }
                
                .color-image-option:hover {
                    border-color: ${categoryColor}80;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px ${categoryColor}20;
                }
                
                .color-image-option.selected {
                    border-color: ${categoryColor};
                    box-shadow: 0 4px 12px ${categoryColor}40;
                }
                
                .color-img {
                    width: 52px;
                    height: 52px;
                    object-fit: cover;
                    border-radius: 5px;
                    display: block;
                }
                
                .color-name {
                    display: block;
                    text-align: center;
                    font-size: 11px;
                    margin-top: 4px;
                    color: #495057;
                    font-weight: 500;
                }
                
                @media (max-width: 768px) {
                    .bundle-set,
                    .bundle-colors {
                        margin: 8px 0 !important;
                        display: block !important;
                        visibility: visible !important;
                    }
                    
                    .set-label {
                        display: block !important;
                        visibility: visible !important;
                        color: #ffffff !important;
                        font-weight: 600 !important;
                        margin-bottom: 8px !important;
                    }
                    
                    .color-images {
                        display: flex !important;
                        visibility: visible !important;
                        gap: 6px !important;
                        overflow-x: auto !important;
                        padding: 8px 0 !important;
                        -webkit-overflow-scrolling: touch !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }
                    
                    .color-images::-webkit-scrollbar {
                        height: 6px !important;
                    }
                    
                    .color-images::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.5) !important;
                        border-radius: 3px !important;
                    }
                    
                    .color-image-option {
                        display: inline-block !important;
                        visibility: visible !important;
                        border-width: 2px !important;
                        border-radius: 8px !important;
                        padding: 3px !important;
                        flex-shrink: 0 !important;
                        min-width: 65px !important;
                        width: 65px !important;
                        height: auto !important;
                    }
                    
                    .color-img {
                        display: block !important;
                        visibility: visible !important;
                        width: 55px !important;
                        height: 55px !important;
                        border-radius: 5px !important;
                    }
                    
                    .color-image-option .color-name,
                    .color-name {
                        display: block !important;
                        font-size: 11px !important;
                        margin-top: 3px !important;
                        margin-bottom: 2px !important;
                        color: #ffffff !important;
                        text-align: center !important;
                        line-height: 1.2 !important;
                        word-break: break-word !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        max-width: 65px !important;
                        font-weight: 600 !important;
                        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
                    }
                    
                    .bundle-savings-badge {
                        padding: 6px 12px !important;
                        font-size: 12px !important;
                        margin-top: 8px !important;
                    }
                    
                    .price-display > div {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .bundle-set .set-label,
                    .set-label {
                        color: #ffffff !important;
                        font-weight: 600 !important;
                        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
                    }
                    
                    .color-images {
                        gap: 4px !important;
                    }
                    
                    .color-image-option {
                        min-width: 55px !important;
                        padding: 2px !important;
                    }
                    
                    .color-img {
                        width: 50px !important;
                        height: 50px !important;
                    }
                    
                    .color-image-option .color-name,
                    .color-name {
                        font-size: 10px !important;
                        max-width: 55px !important;
                        color: #ffffff !important;
                        font-weight: 600 !important;
                        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
                    }
                    
                    .add-individual-bundle-btn {
                        padding: 8px 10px !important;
                        font-size: 11px !important;
                        letter-spacing: 0.2px !important;
                    }
                }
                
                .checkmark {
                    position: absolute !important;
                    top: -6px !important;
                    right: -6px !important;
                    left: auto !important;
                    bottom: auto !important;
                    background: rgba(255, 255, 255, 0.95) !important;
                    color: ${categoryColor} !important;
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 12px !important;
                    font-weight: bold !important;
                    z-index: 100 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important;
                }
                
                .color-image-option .checkmark {
                    display: flex !important;
                }
                
                .color-image-option:not(.selected) .checkmark {
                    display: none !important;
                }
                
                .bundle-pricing {
                    margin-top: 12px;
                    padding: 12px;
                    background: transparent;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .price-display {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                
                .price {
                    font-size: 28px;
                    font-weight: bold;
                    color: #ffffff;
                    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .original {
                    text-decoration: line-through;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 20px;
                    opacity: 0.7;
                }
                
                .add-individual-bundle-btn {
                    display: none !important;
                }
                
                .add-bundle-btn {
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, ${categoryColor} 0%, ${darkerCategoryColor} 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .add-bundle-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s;
                }
                
                .add-bundle-btn:hover {
                    background: linear-gradient(135deg, ${darkerCategoryColor} 0%, ${categoryColor} 100%);
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 6px 20px ${categoryColor}40;
                }
                
                .add-bundle-btn:hover::before {
                    left: 100%;
                }
            `;
            document.head.appendChild(style);
        }
        
            // Funktion zum Abrufen des korrekten Bildpfads für Bundles
    function getImagePathForBundle(productId, color) {
        const imagePathMappings = {
            33: { // Aromatherapy Essential Oil Humidifier
                'Cherry Blossoms': '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier Cherry blossoms.jpg',
                'Green Tea':       '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier green tea.jpg',
                'Jasmine':         '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier jasmine.jpg',
                'Lavender':        '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lavender.jpg',
                'Lemon':           '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lemon.jpg',
                'Lily':            '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lily.jpg',
                'Ocean':           '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier ocean.jpg',
                'Rose':            '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier rose.jpg',
                'Sandalwood':      '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier sandalwood.jpg',
                'Sweet':           '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier sweet.jpg',
                'Vanilla':         '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier vanilla.jpg',
                'Violet':          '../produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier violet.jpg'
            }
        };

        if (imagePathMappings[productId] && imagePathMappings[productId][color.name]) {
            return imagePathMappings[productId][color.name];
        }

        // Fallback-Logik
        return color.image && !color.image.startsWith('../') ? '../' + color.image : color.image;
    }

    // Card-Klick Handler
        document.querySelectorAll('.bundle-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.color-image-option')) {
                    document.querySelectorAll('.bundle-card').forEach(c => c.classList.remove('selected'));
                    this.classList.add('selected');
                    this.querySelector('.bundle-radio').checked = true;
                }
            });
        });
        
        console.log('✅ Bundle-Bilder erfolgreich gerendert');
    }
    
    // Funktion zum Auswählen einer Farbe
    window.selectBundleColor = function(bundleQty, setIndex, colorName, element) {
        // Entferne selected und checkmark von allen Optionen im gleichen Set
        const parent = element.parentElement;
        parent.querySelectorAll('.color-image-option').forEach(opt => {
            opt.classList.remove('selected');
            // Entferne alle Checkmarks
            const existingCheckmark = opt.querySelector('.checkmark');
            if (existingCheckmark) {
                existingCheckmark.remove();
            }
        });
        
        // Füge selected zum geklickten Element hinzu
        element.classList.add('selected');
        
        // Füge neuen Checkmark hinzu wenn noch nicht vorhanden
        if (!element.querySelector('.checkmark')) {
            const newCheckmark = document.createElement('span');
            newCheckmark.className = 'checkmark';
            newCheckmark.textContent = '✓';
            element.insertBefore(newCheckmark, element.firstChild);
        }
        
        console.log(`✅ Farbe ${colorName} für Set ${setIndex + 1} ausgewählt`);
        
        // Aktualisiere den Bundle-Preis basierend auf allen ausgewählten Farben
        updateBundlePriceDisplay();
    };
    
    // Neue Funktion: Berechne Gesamtpreis basierend auf ausgewählten Farben in allen Sets
    function updateBundlePriceDisplay() {
        const allBundleCards = document.querySelectorAll('.bundle-card');
        
        allBundleCards.forEach((card) => {
            const selectedOptions = card.querySelectorAll('.color-image-option.selected');
            let totalPrice = 0;
            let qty = selectedOptions.length;
            
            // Berechne Gesamtpreis aller ausgewählten Farben
            selectedOptions.forEach(opt => {
                const colorName = opt.querySelector('.color-name')?.textContent;
                if (colorName && window.product && window.product.colors) {
                    const color = window.product.colors.find(c => c.name === colorName);
                    if (color) {
                        totalPrice += color.price;
                    }
                }
            });
            
            // Wende Bundle-Rabatt an
            let discount = 0;
            if (qty === 2) discount = 0.15;
            if (qty === 3) discount = 0.20;
            
            const discountedPrice = totalPrice * (1 - discount);
            
            // Update Preis-Anzeige in der Bundle-Card
            const priceDisplay = card.querySelector('.price');
            if (priceDisplay && totalPrice > 0) {
                priceDisplay.textContent = `€${discountedPrice.toFixed(2)}`;
            }
            
            // Update Original-Preis
            const originalDisplay = card.querySelector('.original');
            if (originalDisplay && discount > 0) {
                originalDisplay.textContent = `€${totalPrice.toFixed(2)}`;
            }
            
            // Update Savings
            const savingsDisplay = card.querySelector('.savings-text');
            if (savingsDisplay && discount > 0) {
                const savings = totalPrice - discountedPrice;
                savingsDisplay.textContent = `Gesamt: €${discountedPrice.toFixed(2)}`;
            }
        });
        
        console.log('✅ Bundle-Preise aktualisiert basierend auf Auswahl');
    };
    
    // Neue Funktion für spezifische Bundle-Menge zum Warenkorb hinzufügen
    window.addSpecificBundleToCart = function(bundleQty) {
        console.log(`🎯 addSpecificBundleToCart wurde aufgerufen für ${bundleQty} Set(s)`);
        
        // Finde das entsprechende Bundle-Card
        const bundleCard = document.querySelector(`.bundle-card[data-bundle-id="${bundleQty}"]`);
        if (!bundleCard) {
            console.log('❌ Bundle-Card nicht gefunden');
            alert('Bundle nicht gefunden');
            return;
        }
        
        console.log('📦 Bundle-Menge:', bundleQty);
        
        // Hole korrekte Produkt-ID und Daten
        let currentProduct = window.product;
        let productId = currentProduct ? currentProduct.id : null;
        
        // Falls window.product nicht vorhanden, versuche aus URL zu extrahieren
        if (!productId) {
            const urlPath = window.location.pathname;
            const productMatch = urlPath.match(/produkt-(\d+)\.html/);
            if (productMatch) {
                productId = parseInt(productMatch[1]);
                console.log('🔍 URL-basierte Produkt-ID:', productId);
            }
        }
        
        // Lade Produktdaten aus products.json falls nötig
        if (!currentProduct || !currentProduct.name) {
            // Verwende die korrekten Produktdaten basierend auf ID
            const productData = {
                10: { id: 10, name: 'Elektrischer Wasserspender für Schreibtisch', price: 28.99, image: 'produkt bilder/Elektrischer Wasserspender für Schreibtisch.jpg', category: 'Haushalt und Küche' },
                11: { id: 11, name: '350ml Elektrischer Mixer Entsafter', price: 32.99, image: 'produkt bilder/350ml Elektrischer Mixer Entsafter.jpg', category: 'Haushalt und Küche' },
                17: { id: 17, name: 'Bluetooth Anti-Lost Finder Wassertropfen', price: 6.99, image: 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen.jpg', category: 'Technik/Gadgets' },
                21: { id: 21, name: 'Led crystal lampe', price: 18.99, image: 'produkt bilder/Led crystal lampe .jpg', category: 'Beleuchtung' },
                26: { id: 26, name: '4 In 1 Self Cleaning Hair Brush', price: 11.99, image: 'produkt bilder/4 In 1 Self Cleaning Hair Brush.jpg', category: 'Körperpflege/Wellness' },
                32: { id: 32, name: 'Indoor Sensing Wall Lamp', price: 17.99, image: 'produkt bilder/Indoor Sensing Wall Lamp.jpg', category: 'Beleuchtung' },
                33: { id: 33, name: 'Aromatherapy Essential Oil Humidifier', price: 8.99, image: 'produkt bilder/Aromatherapy Essential Oil Humidifier.jpg', category: 'Haushalt und Küche' },
                34: { id: 34, name: 'Moisturizing Face Steamer', price: 19.99, image: 'produkt bilder/Moisturizing Face Steamer.jpg', category: 'Körperpflege/Wellness' },
                35: { id: 35, name: 'Thermal Neck Lifting And Tighten Massager', price: 16.99, image: 'produkt bilder/Thermal Neck Lifting And Tighten Massager.jpg', category: 'Körperpflege/Wellness' },
                38: { id: 38, name: 'Jade Massager', price: 10.99, image: 'produkt bilder/Jade Massager.jpg', category: 'Körperpflege/Wellness' },
                40: { id: 40, name: 'Mug Warmer Pad', price: 19.99, image: 'produkt bilder/Mug Warmer Pad.jpg', category: 'Haushalt und Küche' },
                42: { id: 42, name: 'Aroma Öl Diffusor', price: 29.99, image: 'produkt bilder/Aroma Öl Diffusor.jpg', category: 'Haushalt und Küche' },
                43: { id: 43, name: 'Mini Thermal Drucker', price: 21.99, image: 'produkt bilder/Mini Thermal Drucker.jpg', category: 'Technik/Gadgets' },
                44: { id: 44, name: 'Smart Beamer', price: 149.99, image: 'produkt bilder/Smart Beamer.jpg', category: 'Technik/Gadgets' },
                45: { id: 45, name: 'Klimaanlage mit Display', price: 28.99, image: 'produkt bilder/Klimaanlage mit Display.jpg', category: 'Technik/Gadgets' },
                46: { id: 46, name: 'Nordic Crystal Lamp', price: 24.99, image: 'produkt bilder/Nordic Crystal Lamp.jpg', category: 'Beleuchtung' },
                47: { id: 47, name: 'Tumbler Becher', price: 19.99, image: 'produkt bilder/Tumbler Becher.jpg', category: 'Haushalt und Küche' },
                48: { id: 48, name: 'Tumbler Becher Winter', price: 19.99, image: 'produkt bilder/Tumbler becher winter.jpg', category: 'Haushalt und Küche' },
                50: { id: 50, name: 'Krystall Ball Nachtlampe', price: 13.99, image: 'produkt bilder/Krystall Ball Nachtlampe.jpg', category: 'Beleuchtung' }
            };
            
            if (productData[productId]) {
                currentProduct = productData[productId];
                console.log('✅ Korrekte Produktdaten gesetzt:', currentProduct);
            } else {
                console.log('⚠️ Unbekannte Produkt-ID:', productId);
                // Fallback auf Produkt-ID ohne spezifische Daten
                currentProduct = { 
                    id: productId || 11, 
                    name: `Produkt ${productId || 11}`, 
                    price: 24.99, 
                    image: 'produkt bilder/ware.png',
                    category: 'Haushalt und Küche'
                };
            }
        }
        
        const basePrice = currentProduct.price;
        const bundlePrice = bundleQty === 1 ? basePrice : (bundleQty === 2 ? basePrice * 0.85 : basePrice * 0.80);
        
        // Sammle ausgewählte Farben für dieses spezifische Bundle
        const selectedColors = [];
        const colorOptions = bundleCard.querySelectorAll('.color-image-option.selected');
        colorOptions.forEach(option => {
            selectedColors.push(option.getAttribute('data-color'));
        });
        
        const productName = currentProduct.name;
        // Entferne ../ aus dem Bildpfad für cart.html (liegt im Root)
        const productImage = currentProduct.image.replace('../', '');
        
        console.log('🎁 Bundle wird erstellt für Produkt:', { 
            id: currentProduct.id, 
            name: productName, 
            colors: selectedColors, 
            qty: bundleQty,
            price: bundlePrice * bundleQty
        });
        
        const bundleItem = {
            id: currentProduct.id,
            name: `${productName} (${bundleQty} Set${bundleQty > 1 ? 's' : ''})${selectedColors.length > 0 ? ' (' + selectedColors.join(', ') + ')' : ''}`,
            price: bundlePrice * bundleQty,
            image: productImage,
            description: `Bundle: ${bundleQty} Set${bundleQty > 1 ? 's' : ''}`,
            bundleId: `${currentProduct.id}-qty${bundleQty}`,
            quantity: 1,
            isBundle: true,
            category: currentProduct.category || window.product?.category || 'Haushalt und Küche'
        };
        
        // Füge zum Warenkorb hinzu
        // Verwende direkt localStorage um sicherzustellen, dass das Bundle hinzugefügt wird
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        // Prüfe ob Bundle bereits im Warenkorb
        const existingIndex = cart.findIndex(item => 
            item.bundleId === bundleItem.bundleId && 
            item.name === bundleItem.name
        );
        
        if (existingIndex > -1) {
            // Bundle existiert bereits, erhöhe Menge
            cart[existingIndex].quantity += 1;
            console.log('📦 Bundle-Menge erhöht:', cart[existingIndex]);
        } else {
            // Neues Bundle hinzufügen
            cart.push(bundleItem);
            console.log('✅ Neues Bundle hinzugefügt:', bundleItem);
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Trigger cart update event
        window.dispatchEvent(new Event('storage'));
        
        // Update cart count if function exists
        if (window.updateCartCount) {
            window.updateCartCount();
        }
        
        console.log('✅ Bundle zum Warenkorb hinzugefügt:', bundleItem);
        
        // Zeige Erfolgsmeldung
        if (window.showBundleSuccessMessage) {
            window.showBundleSuccessMessage(bundleQty);
        }
    };
    
    // Globale Funktion für Bundle zum Warenkorb hinzufügen (alte Funktion für Kompatibilität)
    window.addSelectedBundleToCart = function() {
        console.log('🎯 addSelectedBundleToCart wurde aufgerufen');
        
        const selectedBundle = document.querySelector('.bundle-card.selected');
        if (!selectedBundle) {
            console.log('❌ Kein Bundle ausgewählt');
            alert('Bitte wählen Sie ein Bundle aus');
            return;
        }
        
        const qty = parseInt(selectedBundle.getAttribute('data-bundle-id'));
        console.log('📦 Bundle-Menge:', qty);
        
        // Hole korrekte Produkt-ID und Daten
        let currentProduct = window.product;
        let productId = currentProduct ? currentProduct.id : null;
        
        // Falls window.product nicht vorhanden, versuche aus URL zu extrahieren
        if (!productId) {
            const urlPath = window.location.pathname;
            const productMatch = urlPath.match(/produkt-(\d+)\.html/);
            if (productMatch) {
                productId = parseInt(productMatch[1]);
                console.log('🔍 URL-basierte Produkt-ID:', productId);
            }
        }
        
        // Lade Produktdaten aus products.json falls nötig
        if (!currentProduct || !currentProduct.name) {
            // Verwende die korrekten Produktdaten basierend auf ID
            const productData = {
                10: { id: 10, name: 'Elektrischer Wasserspender für Schreibtisch', price: 28.99, image: 'produkt bilder/Elektrischer Wasserspender für Schreibtisch.jpg', category: 'Haushalt und Küche' },
                11: { id: 11, name: '350ml Elektrischer Mixer Entsafter', price: 32.99, image: 'produkt bilder/350ml Elektrischer Mixer Entsafter.jpg', category: 'Haushalt und Küche' },
                17: { id: 17, name: 'Bluetooth Anti-Lost Finder Wassertropfen', price: 6.99, image: 'produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen.jpg', category: 'Technik/Gadgets' },
                21: { id: 21, name: 'Led crystal lampe', price: 18.99, image: 'produkt bilder/Led crystal lampe .jpg', category: 'Beleuchtung' },
                26: { id: 26, name: '4 In 1 Self Cleaning Hair Brush', price: 11.99, image: 'produkt bilder/4 In 1 Self Cleaning Hair Brush.jpg', category: 'Körperpflege/Wellness' },
                32: { id: 32, name: 'Indoor Sensing Wall Lamp', price: 17.99, image: 'produkt bilder/Indoor Sensing Wall Lamp.jpg', category: 'Beleuchtung' },
                33: { id: 33, name: 'Aromatherapy Essential Oil Humidifier', price: 8.99, image: 'produkt bilder/Aromatherapy Essential Oil Humidifier.jpg', category: 'Haushalt und Küche' },
                34: { id: 34, name: 'Moisturizing Face Steamer', price: 19.99, image: 'produkt bilder/Moisturizing Face Steamer.jpg', category: 'Körperpflege/Wellness' },
                35: { id: 35, name: 'Thermal Neck Lifting And Tighten Massager', price: 16.99, image: 'produkt bilder/Thermal Neck Lifting And Tighten Massager.jpg', category: 'Körperpflege/Wellness' },
                38: { id: 38, name: 'Jade Massager', price: 10.99, image: 'produkt bilder/Jade Massager.jpg', category: 'Körperpflege/Wellness' },
                40: { id: 40, name: 'Mug Warmer Pad', price: 19.99, image: 'produkt bilder/Mug Warmer Pad.jpg', category: 'Haushalt und Küche' },
                42: { id: 42, name: 'Aroma Öl Diffusor', price: 29.99, image: 'produkt bilder/Aroma Öl Diffusor.jpg', category: 'Haushalt und Küche' },
                43: { id: 43, name: 'Mini Thermal Drucker', price: 21.99, image: 'produkt bilder/Mini Thermal Drucker.jpg', category: 'Technik/Gadgets' },
                44: { id: 44, name: 'Smart Beamer', price: 149.99, image: 'produkt bilder/Smart Beamer.jpg', category: 'Technik/Gadgets' },
                45: { id: 45, name: 'Klimaanlage mit Display', price: 28.99, image: 'produkt bilder/Klimaanlage mit Display.jpg', category: 'Technik/Gadgets' },
                46: { id: 46, name: 'Nordic Crystal Lamp', price: 24.99, image: 'produkt bilder/Nordic Crystal Lamp.jpg', category: 'Beleuchtung' },
                47: { id: 47, name: 'Tumbler Becher', price: 19.99, image: 'produkt bilder/Tumbler Becher.jpg', category: 'Haushalt und Küche' },
                48: { id: 48, name: 'Tumbler Becher Winter', price: 19.99, image: 'produkt bilder/Tumbler becher winter.jpg', category: 'Haushalt und Küche' },
                50: { id: 50, name: 'Krystall Ball Nachtlampe', price: 13.99, image: 'produkt bilder/Krystall Ball Nachtlampe.jpg', category: 'Beleuchtung' }
            };
            
            if (productData[productId]) {
                currentProduct = productData[productId];
                console.log('✅ Korrekte Produktdaten gesetzt:', currentProduct);
            } else {
                console.log('⚠️ Unbekannte Produkt-ID:', productId);
                // Fallback auf Produkt-ID ohne spezifische Daten
                currentProduct = { 
                    id: productId || 11, 
                    name: `Produkt ${productId || 11}`, 
                    price: 24.99, 
                    image: 'produkt bilder/ware.png',
                    category: 'Haushalt und Küche'
                };
            }
        }
        
        const basePrice = currentProduct.price;
        const bundlePrice = qty === 1 ? basePrice : (qty === 2 ? basePrice * 0.85 : basePrice * 0.80);
        
        // Sammle ausgewählte Farben
        const selectedColors = [];
        const colorOptions = selectedBundle.querySelectorAll('.color-image-option.selected');
        colorOptions.forEach(option => {
            selectedColors.push(option.getAttribute('data-color'));
        });
        
        const productName = currentProduct.name;
        // Entferne ../ aus dem Bildpfad für cart.html (liegt im Root)
        const productImage = currentProduct.image.replace('../', '');
        
        console.log('🎁 Bundle wird erstellt für Produkt:', { 
            id: currentProduct.id, 
            name: productName, 
            colors: selectedColors, 
            qty: qty,
            price: bundlePrice * qty
        });
        
        const bundleItem = {
            id: currentProduct.id,
            name: `${productName} (${qty} Set${qty > 1 ? 's' : ''})${selectedColors.length > 0 ? ' (' + selectedColors.join(', ') + ')' : ''}`,
            price: bundlePrice * qty,
            image: productImage,
            description: `Bundle: ${qty} Set${qty > 1 ? 's' : ''}`,
            bundleId: `${currentProduct.id}-qty${qty}`,
            quantity: 1,
            isBundle: true,
            category: currentProduct.category || window.product?.category || 'Haushalt und Küche'
        };
        
        // Füge zum Warenkorb hinzu
        // Verwende direkt localStorage um sicherzustellen, dass das Bundle hinzugefügt wird
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        // Prüfe ob Bundle bereits im Warenkorb
        const existingIndex = cart.findIndex(item => 
            item.bundleId === bundleItem.bundleId && 
            item.name === bundleItem.name
        );
        
        if (existingIndex > -1) {
            // Bundle existiert bereits, erhöhe Menge
            cart[existingIndex].quantity += 1;
            console.log('📦 Bundle-Menge erhöht:', cart[existingIndex]);
        } else {
            // Neues Bundle hinzufügen
            cart.push(bundleItem);
            console.log('✅ Neues Bundle hinzugefügt:', bundleItem);
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Trigger cart update event
        window.dispatchEvent(new Event('storage'));
        
        // Update cart count if function exists
        if (window.updateCartCount) {
            window.updateCartCount();
        }
        
        console.log('✅ Bundle zum Warenkorb hinzugefügt:', bundleItem);
        
        // Zeige Erfolgsmeldung
        if (window.showBundleSuccessMessage) {
            window.showBundleSuccessMessage(qty);
        }
    };
    
    // Exportiere die Funktion global
    window.renderBundlesWithImages = renderBundlesWithImages;
    
    // Führe aus
    renderBundlesWithImages();
    
    // Nochmal nach kurzer Verzögerung
    setTimeout(renderBundlesWithImages, 500);
    
    // Funktion für schöne Erfolgs-Nachricht (rechts oben, klickbar)
    window.showBundleSuccessMessage = function(qty) {
        // Entferne vorherige Nachrichten
        const existingMsg = document.querySelector('.bundle-success-toast');
        if (existingMsg) existingMsg.remove();
        
        const notification = document.createElement('div');
        notification.className = 'bundle-success-toast';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(90deg, #4a90e2 0%, #63b3ed 100%);
            color: white;
            padding: 18px 30px;
            border-radius: 50px;
            box-shadow: 0 8px 24px rgba(74, 144, 226, 0.35);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            font-weight: 500;
            letter-spacing: 0.3px;
            animation: slideInRight 0.5s ease forwards;
            cursor: pointer;
            white-space: nowrap;
            transition: transform 0.3s ease;
        `;
        
        notification.textContent = 'Bundle zum Warenkorb hinzugefügt';
        
        // Hover-Effekt
        notification.onmouseenter = () => {
            notification.style.transform = 'scale(1.05)';
        };
        notification.onmouseleave = () => {
            notification.style.transform = 'scale(1)';
        };
        
        // Klickbar - führt zum Warenkorb
        notification.onclick = () => {
            window.location.href = '../cart.html';
        };
        
        
        document.body.appendChild(notification);
        
        // Animation CSS hinzufügen
        if (!document.getElementById('cart-notification-animation')) {
            const style = document.createElement('style');
            style.id = 'cart-notification-animation';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Entferne nach 3 Sekunden
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease-out forwards';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    };
    
});

console.log('✅ Bundle Images Final geladen');

// Stelle sicher, dass die Nachricht-Funktion global verfügbar ist
if (!window.showBundleSuccessMessage) {
    window.showBundleSuccessMessage = function(qty) {
        // Fallback-Nachricht falls die Hauptfunktion noch nicht geladen ist
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideInRight 0.5s ease-out;
            cursor: pointer;
        `;
        
        notification.innerHTML = `
            <div style="
                width: 28px;
                height: 28px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            ">🛒</div>
            <div>
                <div style="font-weight: 600; font-size: 16px;">
                    Bundle hinzugefügt! (${qty} Set${qty > 1 ? 's' : ''})
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    };
}

// Globale Funktion zum Hinzufügen des ausgewählten Bundles
window.addSelectedBundleToCart = function() {
    const selectedCard = document.querySelector('.bundle-card.selected');
    if (!selectedCard) {
        console.log('⚠️ Kein Bundle ausgewählt');
        return;
    }
    
    const bundleQty = parseInt(selectedCard.getAttribute('data-bundle-id'));
    console.log(`🛒 Ausgewähltes Bundle wird hinzugefügt: ${bundleQty} Set(s)`);
    
    // Rufe die bestehende Funktion auf
    if (typeof window.addSpecificBundleToCart === 'function') {
        window.addSpecificBundleToCart(bundleQty);
    } else {
        console.log('⚠️ addSpecificBundleToCart Funktion nicht gefunden');
    }
};
