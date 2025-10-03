// Fix für Produkt-10 Farbauswahl
// Dieses Script repariert die Farbauswahl für Produkt-10

(function() {
    console.log('🔧 Repariere Produkt-10 Farbauswahl...');
    
    // Warte auf DOM-Ready
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(async function() {
            try {
                // Prüfe ob wir auf Produkt-10 sind
                const path = window.location.pathname;
                const match = path.match(/produkt-(\d+)\.html/);
                const productId = match ? parseInt(match[1]) : null;
                
                if (productId !== 10) {
                    console.log('Nicht Produkt-10, überspringe Fix');
                    return;
                }
                
                console.log('🎯 Produkt-10 erkannt, lade Farbdaten...');
                
                // Lade Produktdaten
                const response = await fetch('../products.json');
                const products = await response.json();
                const product = products.find(p => p.id === 10);
                
                if (!product || !product.colors) {
                    console.log('❌ Keine Farbdaten für Produkt-10 gefunden');
                    return;
                }
                
                console.log('✅ Farbdaten geladen:', product.colors);
                
                // Erstelle Farbauswahl-Container
                const heroSection = document.querySelector('.product-hero .col-lg-6');
                if (!heroSection) {
                    console.log('❌ Hero-Section nicht gefunden');
                    return;
                }
                
                const priceSection = heroSection.querySelector('.d-flex.align-items-center.gap-3.mb-4');
                if (!priceSection) {
                    console.log('❌ Preis-Section nicht gefunden');
                    return;
                }
                
                // Erstelle Farbauswahl-HTML
                const colorSelectionHTML = `
                    <div class="color-selection mb-4" id="colorSelection">
                        <h5 class="mb-3 text-white">Farbe wählen:</h5>
                        <div class="color-options d-flex gap-2 flex-wrap" id="colorOptions">
                            ${product.colors.map(color => `
                                <div class="color-option" 
                                     style="width:45px;height:45px;border-radius:50%;background:${color.code};border:3px solid transparent;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:all 0.3s ease;position:relative;display:flex;align-items:center;justify-content:center;" 
                                     data-color="${color.code}" 
                                     data-sku="${color.sku}" 
                                     data-price="${color.price}"
                                     data-original-price="${color.originalPrice}"
                                     title="${color.name}"
                                     onclick="selectColor10('${color.name}', '${color.code}', '${color.sku}', ${color.price}, ${color.originalPrice})">
                                </div>
                            `).join('')}
                        </div>
                        <div class="selected-color-info mt-2" style="font-size:1rem;background:rgba(255,255,255,0.2);padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.3);">
                            <small><span style="font-weight:700;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.3);">Ausgewählte Farbe: <span id="selectedColorName10">${product.colors[0].name}</span></span></small>
                        </div>
                    </div>
                `;
                
                // Füge nach Preis-Section ein
                priceSection.insertAdjacentHTML('afterend', colorSelectionHTML);
                
                // Wähle erste Farbe als Standard
                selectColor10(product.colors[0].name, product.colors[0].code, product.colors[0].sku, product.colors[0].price, product.colors[0].originalPrice);
                
                console.log('✅ Farbauswahl für Produkt-10 erfolgreich erstellt!');
                
            } catch (error) {
                console.error('❌ Fehler beim Reparieren von Produkt-10:', error);
            }
        }, 300);
    });
})();

// Globale Funktion für Farbauswahl
function selectColor10(name, code, sku, price, originalPrice) {
    console.log(`🎨 Farbe ausgewählt: ${name} - €${price}`);
    
    // Setze Produkt-10 Zustand für Warenkorb-Integration
    if (typeof window.setProdukt10Color === 'function') {
        window.setProdukt10Color(name, code, sku, price, originalPrice);
    }
    
    // Entferne vorherige Auswahl
    document.querySelectorAll('.color-option').forEach(option => {
        option.style.border = '3px solid transparent';
        option.innerHTML = '';
    });
    
    // Markiere neue Auswahl
    const selectedOption = document.querySelector(`[data-sku="${sku}"]`);
    if (selectedOption) {
        selectedOption.style.border = '3px solid #fff';
        selectedOption.style.boxShadow = '0 0 0 2px #007bff, 0 4px 12px rgba(0,0,0,0.2)';
        selectedOption.innerHTML = '<span style="color:white;font-weight:bold;font-size:18px;text-shadow:0 0 3px rgba(0,0,0,0.5);">✓</span>';
        
        // Spezielle Behandlung für weiße Farben
        if (code === '#FFFFFF' || code === '#FFF0F5') {
            selectedOption.innerHTML = '<span style="color:#333;font-weight:bold;font-size:18px;">✓</span>';
        }
    }
    
    // Aktualisiere Anzeige
    const selectedColorName = document.getElementById('selectedColorName10');
    if (selectedColorName) {
        selectedColorName.textContent = name;
    }
    
    // Aktualisiere Preise
    const priceTag = document.querySelector('.price-tag');
    if (priceTag) {
        priceTag.textContent = `€${price}`;
    }
    
    const originalPriceSpan = document.querySelector('.text-decoration-line-through');
    if (originalPriceSpan) {
        originalPriceSpan.textContent = `€${originalPrice}`;
    }
    
    // Aktualisiere Schnellbestellung-Preise
    const currentPrices = document.querySelectorAll('.current-price');
    currentPrices.forEach(priceElement => {
        priceElement.textContent = `€${price}`;
    });
    
    // Aktualisiere alle Preis-Displays in Schnellbestellungen
    const priceSelectors = [
        '.current-price',
        '.price-section .current-price', 
        '#totalPrice',
        '#totalPrice-mobile',
        '.total-price span'
    ];
    
    priceSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element.textContent.includes('€')) {
                // Berechne Gesamtpreis basierend auf Menge
                const quantityInput = document.getElementById('quantity') || document.getElementById('quantity-mobile');
                const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
                const totalPrice = (price * quantity).toFixed(2);
                
                if (selector.includes('total') || selector.includes('Total')) {
                    element.textContent = `€${totalPrice}`;
                } else {
                    element.textContent = `€${price}`;
                }
            }
        });
    });
    
    console.log(`💰 Alle Preise aktualisiert: €${price} (Menge: ${document.getElementById('quantity')?.value || 1})`);
    
    // Stelle sicher, dass addToCart überschrieben wird - mehrere Versuche
    function enhanceAddToCartForProduct10() {
        if (window.addToCart && !window.addToCart._product10Enhanced) {
            const originalAddToCart = window.addToCart;
            window.addToCart = function(product) {
                if (window.product && window.product.selectedColor) {
                    const enhancedProduct = {
                        ...product,
                        name: `${product.name} (${window.product.selectedColor})`,
                        selectedColor: window.product.selectedColor,
                        selectedColorCode: window.product.selectedColorCode,
                        selectedColorSku: window.product.selectedColorSku,
                        price: window.product.price,
                        originalPrice: window.product.originalPrice
                    };
                    console.log('🎨 Produkt-10 mit Farbe zum Warenkorb:', enhancedProduct.name, 'Preis:', enhancedProduct.price);
                    return originalAddToCart(enhancedProduct);
                } else {
                    return originalAddToCart(product);
                }
            };
            window.addToCart._product10Enhanced = true;
            console.log('✅ Produkt-10 addToCart überschrieben');
            return true;
        }
        return false;
    }
    
    // Mehrere Versuche mit unterschiedlichen Delays
    setTimeout(enhanceAddToCartForProduct10, 100);
    setTimeout(enhanceAddToCartForProduct10, 500);
    setTimeout(enhanceAddToCartForProduct10, 1000);
}
