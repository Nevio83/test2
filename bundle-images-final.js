// Bundle Images Final - Komplette Lösung für Bundle-Bilder
console.log('🎨 Bundle Images Final wird geladen...');

// Warte bis DOM bereit ist
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Initialisiere Bundle-Bilder...');
    
    // Funktion zum Rendern der Bundles mit Bildern
    function renderBundlesWithImages() {
        const bundleSection = document.getElementById('bundle-section');
        if (!bundleSection) {
            console.log('❌ Bundle-Section nicht gefunden');
            return;
        }
        
        // Produkt 11 Farben
        const colors = [
            { name: 'Weiß', image: '../produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Weiß.jpg' },
            { name: 'Pink', image: '../produkt bilder/350ml Elektrischer Mixer Entsafter bilder/350ml Elektrischer Mixer Entsafter Rosa.png' }
        ];
        
        // Bundle-Optionen
        const bundles = [
            { qty: 1, price: 24.99, discount: 0 },
            { qty: 2, price: 21.24, discount: 15 },
            { qty: 3, price: 19.99, discount: 20 }
        ];
        
        // Erstelle HTML
        let html = `
            <div class="bundle-container">
                <h2 class="bundle-title">BUNDLE & SPARE</h2>
                
                ${bundles.map((bundle, index) => `
                    <div class="bundle-card ${index === 1 ? 'selected' : ''}" data-bundle-id="${bundle.qty}">
                        <input type="radio" name="bundle" value="${bundle.qty}" ${index === 1 ? 'checked' : ''} class="bundle-radio" style="display: none;">
                        
                        <div class="bundle-content">
                            <div class="bundle-left">
                                <h3 class="bundle-qty">${bundle.qty} Set${bundle.qty > 1 ? 's' : ''} kaufen</h3>
                            </div>
                            
                            ${bundle.discount > 0 ? `
                                <div class="bundle-badges">
                                    <span class="discount-badge">EXTRA ${bundle.discount}% RABATT</span>
                                    ${index === 1 ? '<span class="popular-badge">Am beliebtesten</span>' : ''}
                                    ${index === 2 ? '<span class="best-badge">Meiste Ersparnis</span>' : ''}
                                </div>
                            ` : ''}
                            
                            <div class="bundle-colors">
                                ${Array.from({length: bundle.qty}, (_, i) => `
                                    <div class="bundle-set">
                                        <span class="set-label">Set ${i + 1}:</span>
                                        <div class="color-images">
                                            ${colors.map((color, colorIndex) => `
                                                <div class="color-image-option ${colorIndex === 0 ? 'selected' : ''}" 
                                                     data-set="${i}" 
                                                     data-color="${color.name}"
                                                     onclick="selectBundleColor(${bundle.qty}, ${i}, '${color.name}', this)">
                                                    ${colorIndex === 0 ? '<span class="checkmark">✓</span>' : ''}
                                                    <img src="${color.image}" alt="${color.name}" class="color-img">
                                                    <span class="color-name">${color.name}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="bundle-pricing">
                                <div class="price-display">
                                    <span class="price">€${(bundle.price * bundle.qty).toFixed(2)}</span>
                                    ${bundle.discount > 0 ? `<span class="original">€${(24.99 * bundle.qty).toFixed(2)}</span>` : ''}
                                    ${bundle.discount > 0 ? 
                                        `<span class="savings-text">Spare €${((24.99 - bundle.price) * bundle.qty).toFixed(2)}</span>` : 
                                        ''
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                <button class="add-bundle-btn" onclick="addSelectedBundleToCart()">
                    <i class="bi bi-cart-plus"></i> Bundle in den Warenkorb
                </button>
            </div>
        `;
        
        bundleSection.innerHTML = html;
        
        // Füge CSS hinzu
        if (!document.getElementById('bundle-images-styles')) {
            const style = document.createElement('style');
            style.id = 'bundle-images-styles';
            style.textContent = `
                .bundle-container {
                    padding: 25px;
                    max-width: 900px;
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
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                }
                
                .bundle-card:hover {
                    border-color: #007bff;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .bundle-card.selected {
                    border-color: #28a745;
                    background: linear-gradient(135deg, #f0fff4 0%, #e8f5e9 100%);
                    box-shadow: 0 4px 16px rgba(40, 167, 69, 0.2);
                }
                
                .bundle-content {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .bundle-qty {
                    margin: 0;
                    font-size: 20px;
                    color: #333;
                }
                
                .bundle-badges {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                
                .bundle-radio {
                    position: absolute;
                    left: 20px;
                    top: 50%;
                    transform: translateY(-50%);
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
                    background: #28a745;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .popular-badge {
                    background: #6f42c1;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .best-badge {
                    background: #ff6b6b;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .bundle-colors {
                    margin: 15px 0;
                }
                
                .bundle-set {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .set-label {
                    min-width: 60px;
                    font-size: 14px;
                    color: #666;
                }
                
                .color-images {
                    display: flex;
                    gap: 10px;
                }
                
                .color-image-option {
                    position: relative !important;
                    border: 3px solid #e0e0e0;
                    border-radius: 10px;
                    padding: 5px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-block;
                    background: white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                }
                
                .color-image-option:hover {
                    border-color: #6c757d;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.12);
                }
                
                .color-image-option.selected {
                    border-color: #28a745;
                    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.25);
                }
                
                .color-img {
                    width: 80px;
                    height: 80px;
                    object-fit: cover;
                    border-radius: 6px;
                    display: block;
                }
                
                .color-name {
                    display: block;
                    text-align: center;
                    font-size: 13px;
                    margin-top: 6px;
                    color: #495057;
                    font-weight: 500;
                }
                
                .checkmark {
                    position: absolute !important;
                    top: 2px !important;
                    right: 2px !important;
                    background: #28a745 !important;
                    color: white !important;
                    width: 18px !important;
                    height: 18px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 12px !important;
                    font-weight: bold !important;
                    z-index: 100 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .color-image-option .checkmark {
                    display: flex !important;
                }
                
                .color-image-option:not(.selected) .checkmark {
                    display: none !important;
                }
                
                .bundle-pricing {
                    margin-top: 20px;
                    padding: 15px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    border: 1px solid #dee2e6;
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
                    color: #212529;
                }
                
                .original {
                    text-decoration: line-through;
                    color: #6c757d;
                    font-size: 20px;
                    opacity: 0.7;
                }
                
                .savings-text {
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
                }
                
                .add-bundle-btn {
                    width: 100%;
                    padding: 15px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: all 0.3s ease;
                }
                
                .add-bundle-btn:hover {
                    background: #218838;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
            `;
            document.head.appendChild(style);
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
    };
    
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
    
    // Globale Funktion für Bundle zum Warenkorb
    window.addSelectedBundleToCart = function() {
        const selectedCard = document.querySelector('.bundle-card.selected');
        if (!selectedCard) return;
        
        const qty = parseInt(selectedCard.dataset.bundleId);
        const bundleColors = [];
        
        // Sammle ausgewählte Farben
        selectedCard.querySelectorAll('.bundle-set').forEach(set => {
            const selectedColor = set.querySelector('.color-image-option.selected');
            if (selectedColor) {
                bundleColors.push(selectedColor.dataset.color);
            }
        });
        
        // Erstelle Bundle-Item
        const bundleItem = {
            id: 11,
            name: `350ml Elektrischer Mixer Entsafter (${qty} Sets) ${bundleColors.map(c => `(${c})`).join(' ')}`,
            price: qty === 1 ? 24.99 : qty === 2 ? 42.48 : 59.98,
            quantity: 1,
            image: 'produkt bilder/350ml Elektrischer Mixer Entsafter.jpg',
            isBundle: true,
            bundleQuantity: qty,
            bundleColors: bundleColors
        };
        
        // Füge zum Warenkorb hinzu
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart.push(bundleItem);
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Zeige schöne Erfolgs-Nachricht
        window.showBundleSuccessMessage(qty);
        
        // Debug-Log
        console.log('🎉 Bundle wurde zum Warenkorb hinzugefügt:', bundleItem);
        
        // Optional: Weiterleitung zum Warenkorb nach 2 Sekunden
        // setTimeout(() => window.location.href = '../cart.html', 2000);
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
