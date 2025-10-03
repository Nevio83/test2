/**
 * Bundle-Farbauswahl-Erweiterung
 * Fügt Farbauswahl zu Bundle-Boxen hinzu
 */

(function() {
    console.log('🎨 Bundle-Farbauswahl wird initialisiert...');

    // Warte auf DOM-Ready
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(async function() {
            try {
                await enhanceBundlesWithColorSelection();
            } catch (error) {
                console.error('❌ Fehler bei Bundle-Farbauswahl:', error);
            }
        }, 500);
    });

    async function enhanceBundlesWithColorSelection() {
        // Prüfe ob wir Farbdaten haben
        const productId = extractProductIdFromUrl();
        if (!productId) return;

        const productData = await loadProductData(productId);
        if (!productData || !productData.colors || productData.colors.length === 0) {
            console.log('Keine Farbdaten für Bundle-Erweiterung gefunden');
            return;
        }

        console.log('🎨 Erweitere Bundles mit Farbauswahl für', productData.colors.length, 'Farben');

        // Überschreibe die renderBundles Funktion
        if (window.renderBundles && !window.renderBundles._colorEnhanced) {
            const originalRenderBundles = window.renderBundles;
            
            window.renderBundles = function(bundles) {
                // Rufe ursprüngliche Funktion auf
                const result = originalRenderBundles(bundles);
                
                // Erweitere mit Farbauswahl
                setTimeout(() => {
                    addColorSelectionToBundles(productData.colors);
                }, 100);
                
                return result;
            };
            
            window.renderBundles._colorEnhanced = true;
            console.log('✅ Bundle-Rendering erweitert');
        }
    }

    function addColorSelectionToBundles(colors) {
        const bundleSection = document.getElementById('bundle-section');
        if (!bundleSection) return;

        const bundleCards = bundleSection.querySelectorAll('.bundle-card');
        
        bundleCards.forEach((card, index) => {
            const radio = card.querySelector('.bundle-radio');
            if (!radio) return;

            const quantity = parseInt(radio.value) + 1; // 0=1 Set, 1=2 Sets, 2=3 Sets
            
            // Erstelle Farbauswahl für diese Menge
            const colorSelectionHTML = createColorSelectionForBundle(colors, quantity, index);
            
            // Füge nach bundle-info ein
            const bundleInfo = card.querySelector('.bundle-info');
            if (bundleInfo) {
                bundleInfo.insertAdjacentHTML('afterend', colorSelectionHTML);
            }
        });

        // Event-Listener für Bundle-Auswahl
        bundleCards.forEach((card, index) => {
            const radio = card.querySelector('.bundle-radio');
            if (radio) {
                radio.addEventListener('change', function() {
                    if (this.checked) {
                        // Zeige nur die Farbauswahl für das ausgewählte Bundle
                        bundleCards.forEach((otherCard, otherIndex) => {
                            const colorSection = otherCard.querySelector('.bundle-color-selection');
                            if (colorSection) {
                                colorSection.style.display = otherIndex === index ? 'block' : 'none';
                            }
                        });
                    }
                });
            }
        });

        // Zeige initial nur die Farbauswahl für das ausgewählte Bundle
        const selectedRadio = bundleSection.querySelector('.bundle-radio:checked');
        if (selectedRadio) {
            const selectedIndex = Array.from(bundleCards).findIndex(card => 
                card.querySelector('.bundle-radio') === selectedRadio
            );
            
            bundleCards.forEach((card, index) => {
                const colorSection = card.querySelector('.bundle-color-selection');
                if (colorSection) {
                    colorSection.style.display = index === selectedIndex ? 'block' : 'none';
                }
            });
        }

        console.log('✅ Farbauswahl zu Bundles hinzugefügt');
    }

    function createColorSelectionForBundle(colors, quantity, bundleIndex) {
        let html = `<div class="bundle-color-selection mt-3" style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px;">`;
        
        for (let i = 0; i < quantity; i++) {
            html += `
                <div class="bundle-color-set mb-3">
                    <h6 class="text-white mb-2">Set ${i + 1} - Farbe wählen:</h6>
                    <div class="color-options d-flex gap-2 flex-wrap mb-2">
                        ${colors.map(color => `
                            <div class="bundle-color-option" 
                                 style="width:35px;height:35px;border-radius:50%;background:${color.code};border:2px solid transparent;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.1);transition:all 0.3s ease;position:relative;display:flex;align-items:center;justify-content:center;" 
                                 data-bundle="${bundleIndex}"
                                 data-set="${i}"
                                 data-color="${color.code}" 
                                 data-sku="${color.sku}" 
                                 data-name="${color.name}"
                                 data-price="${color.price || 0}"
                                 title="${color.name}"
                                 onclick="selectBundleColor(${bundleIndex}, ${i}, '${color.name}', '${color.code}', '${color.sku}', ${color.price || 0})">
                            </div>
                        `).join('')}
                    </div>
                    <div class="selected-bundle-color text-white-50" style="font-size:0.85rem;">
                        Ausgewählt: <span id="bundleColor_${bundleIndex}_${i}">${colors[0].name}</span>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        return html;
    }

    // Globale Funktion für Bundle-Farbauswahl
    window.selectBundleColor = function(bundleIndex, setIndex, name, code, sku, price) {
        console.log(`🎨 Bundle ${bundleIndex}, Set ${setIndex}: ${name} ausgewählt`);
        
        // Entferne vorherige Auswahl für dieses Set
        const setOptions = document.querySelectorAll(`[data-bundle="${bundleIndex}"][data-set="${setIndex}"]`);
        setOptions.forEach(option => {
            option.style.border = '2px solid transparent';
            option.innerHTML = '';
        });
        
        // Markiere neue Auswahl
        const selectedOption = document.querySelector(`[data-bundle="${bundleIndex}"][data-set="${setIndex}"][data-sku="${sku}"]`);
        if (selectedOption) {
            selectedOption.style.border = '2px solid #fff';
            selectedOption.style.boxShadow = '0 0 0 1px #007bff, 0 2px 6px rgba(0,0,0,0.2)';
            
            // Häkchen hinzufügen
            if (code === '#FFFFFF' || code === '#FFF0F5') {
                selectedOption.innerHTML = '<span style="color:#333;font-weight:bold;font-size:14px;">✓</span>';
            } else {
                selectedOption.innerHTML = '<span style="color:white;font-weight:bold;font-size:14px;text-shadow:0 0 2px rgba(0,0,0,0.5);">✓</span>';
            }
        }
        
        // Aktualisiere Anzeige
        const selectedColorSpan = document.getElementById(`bundleColor_${bundleIndex}_${setIndex}`);
        if (selectedColorSpan) {
            selectedColorSpan.textContent = name;
        }
        
        // Speichere Auswahl
        if (!window.bundleColorSelections) {
            window.bundleColorSelections = {};
        }
        if (!window.bundleColorSelections[bundleIndex]) {
            window.bundleColorSelections[bundleIndex] = {};
        }
        window.bundleColorSelections[bundleIndex][setIndex] = {
            name, code, sku, price
        };
    };

    // Hilfsfunktionen
    function extractProductIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/produkt-(\d+)\.html/);
        return match ? parseInt(match[1]) : null;
    }

    async function loadProductData(productId) {
        try {
            const response = await fetch('../products.json');
            const products = await response.json();
            return products.find(p => p.id === productId);
        } catch (error) {
            console.error('Fehler beim Laden der Produktdaten:', error);
            return null;
        }
    }

    console.log('✅ Bundle-Farbauswahl-System geladen');
})();
