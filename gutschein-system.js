// ===== NEUES EINFACHES GUTSCHEIN-SYSTEM =====
(function() {
    console.log('🎫 Gutschein-System NEU geladen');

    // ===== GUTSCHEIN-DATEN =====
    const availableVouchers = [
        {
            id: 1,
            code: 'SAVE10',
            title: '10% Rabatt',
            description: 'Spare 10% bei Bestellungen ab 50€',
            discount: 0.10,
            minOrder: 50,
            type: 'percentage',
            image: 'infos/Gutschein.jpg'
        },
        {
            id: 2,
            code: 'SAVE15',
            title: '15% Rabatt',
            description: 'Spare 15% bei Bestellungen ab 100€',
            discount: 0.15,
            minOrder: 100,
            type: 'percentage',
            image: 'infos/Gutschein.jpg'
        },
        {
            id: 3,
            code: 'SAVE20',
            title: '20% Rabatt',
            description: 'Spare 20% bei Bestellungen ab 150€',
            discount: 0.20,
            minOrder: 150,
            type: 'percentage',
            image: 'infos/Gutschein.jpg'
        },
        {
            id: 4,
            code: 'FREESHIP',
            title: 'Gratis Versand',
            description: 'Kostenloser Versand für deine Bestellung',
            discount: 0,
            minOrder: 0,
            type: 'shipping',
            image: 'infos/Gutschein.jpg'
        },
        {
            id: 5,
            code: 'WELCOME25',
            title: '25% Willkommensrabatt',
            description: 'Exklusiv für Neukunden',
            discount: 0.25,
            minOrder: 0,
            type: 'percentage',
            image: 'infos/Gutschein.jpg'
        },
        {
            id: 6,
            code: 'BUNDLE30',
            title: '30% Bundle-Rabatt',
            description: 'Spare 30% ab 3 Produkten',
            discount: 0.30,
            minOrder: 0,
            minItems: 3,
            type: 'percentage',
            image: 'infos/Gutschein.jpg'
        }
    ];

    // ===== HELPER FUNKTIONEN =====
    
    // Hole gesammelte Gutscheine aus localStorage
    function getMyVouchers() {
        const vouchers = localStorage.getItem('myVouchers');
        return vouchers ? JSON.parse(vouchers) : [];
    }

    // Speichere gesammelte Gutscheine
    function saveMyVouchers(vouchers) {
        localStorage.setItem('myVouchers', JSON.stringify(vouchers));
        updateGutscheineCounter();
    }

    // Hole Gutschein-Daten anhand ID
    function getVoucherById(id) {
        return availableVouchers.find(v => v.id === parseInt(id));
    }

    // Hole Gutschein-Daten anhand Code
    function getVoucherByCode(code) {
        return availableVouchers.find(v => v.code === code.toUpperCase());
    }

    // ===== GUTSCHEIN HINZUFÜGEN (für index.html) =====
    window.addVoucherToUser = function(voucherId) {
        const myVouchers = getMyVouchers();
        const id = parseInt(voucherId);
        
        // Erlaube mehrfache Gutscheine - entferne die Duplikat-Prüfung
        myVouchers.push(id);
        saveMyVouchers(myVouchers);
        console.log('✅ Gutschein hinzugefügt:', id, '(Gesamt:', myVouchers.length, ')');
        return true;
    };

    // ===== COUNTER UPDATE (für index.html) =====
    function updateGutscheineCounter() {
        const counter = document.getElementById('gutscheineCounter');
        if (counter) {
            const count = getMyVouchers().length;
            // Zeige "99+" wenn mehr als 99 Gutscheine
            counter.textContent = count > 99 ? '99+' : count;
            counter.style.display = count > 0 ? 'block' : 'none';
        }
    }

    // ===== GUTSCHEINE-SEITE (gutscheine.html) =====
    if (window.location.pathname.includes('gutscheine.html')) {
        console.log('📄 Gutscheine-Seite erkannt');
        
        // Warte auf DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGutscheinePage);
        } else {
            initGutscheinePage();
        }
    }

    function initGutscheinePage() {
        renderGutscheine();
        
        // Event Delegation für Buttons
        document.addEventListener('click', function(e) {
            // Copy Code Button
            if (e.target.closest('.copy-code-btn')) {
                const btn = e.target.closest('.copy-code-btn');
                const code = btn.dataset.code;
                copyCode(code, btn);
            }
            
            // Apply Voucher Button
            if (e.target.closest('.apply-voucher-btn')) {
                const btn = e.target.closest('.apply-voucher-btn');
                const code = btn.dataset.code;
                applyVoucher(code);
            }
        });
    }

    function renderGutscheine() {
        const container = document.getElementById('vouchersContainer');
        if (!container) return;

        const myVoucherIds = getMyVouchers();
        
        if (myVoucherIds.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <i class="bi bi-ticket-perforated" style="font-size: 64px; color: #ddd; margin-bottom: 20px;"></i>
                    <h3 style="color: #333; margin-bottom: 10px;">Keine Gutscheine gesammelt</h3>
                    <p>Du hast noch keine Gutscheine. Schau regelmäßig vorbei!</p>
                </div>
            `;
            return;
        }

        // Zähle wie oft jeder Gutschein vorhanden ist
        const voucherCounts = {};
        myVoucherIds.forEach(id => {
            voucherCounts[id] = (voucherCounts[id] || 0) + 1;
        });

        // Erstelle Array mit einzigartigen Gutscheinen und deren Anzahl
        const uniqueVoucherIds = [...new Set(myVoucherIds)];
        const myVouchers = uniqueVoucherIds
            .map(id => {
                const voucher = getVoucherById(id);
                if (voucher) {
                    return { ...voucher, count: voucherCounts[id] };
                }
                return null;
            })
            .filter(v => v !== null);

        container.innerHTML = myVouchers.map(voucher => `
            <div class="voucher-card">
                <div class="voucher-image" style="position: relative;">
                    <img src="${voucher.image}" alt="${voucher.title}">
                    ${voucher.count > 1 ? `<div style="position: absolute; top: 10px; right: 10px; background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; z-index: 10; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);">x${voucher.count}</div>` : ''}
                </div>
                <div class="voucher-content">
                    <h3 class="voucher-title">${voucher.title} ${voucher.count > 1 ? `<span style="color: #667eea; font-size: 0.9em;">(${voucher.count}x)</span>` : ''}</h3>
                    <p class="voucher-description">${voucher.description}</p>
                    <div class="voucher-code">
                        <span class="code-text">${voucher.code}</span>
                        <button class="copy-code-btn" data-code="${voucher.code}">
                            <i class="bi bi-clipboard"></i> Kopieren
                        </button>
                    </div>
                    <button class="apply-voucher-btn" data-code="${voucher.code}">
                        Jetzt einlösen
                    </button>
                </div>
            </div>
        `).join('');
    }

    function copyCode(code, button) {
        navigator.clipboard.writeText(code).then(() => {
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check"></i> Kopiert!';
            button.style.background = '#10b981';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
        });
    }

    function applyVoucher(code) {
        localStorage.setItem('appliedVoucher', code);
        
        // Zeige Notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 600;
        `;
        notification.textContent = `Gutschein "${code}" wird angewendet!`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            window.location.href = 'cart.html';
        }, 1500);
    }

    // ===== WARENKORB-SEITE (cart.html) =====
    if (window.location.pathname.includes('cart.html')) {
        console.log('🛒 Warenkorb-Seite erkannt');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCartVouchers);
        } else {
            initCartVouchers();
        }
    }

    function initCartVouchers() {
        // Warte kurz bis cart.html geladen ist
        setTimeout(() => {
            createVoucherSection();
            checkAppliedVoucher();
            updateCartSummary();
            
            // Beobachte Warenkorb-Änderungen (später)
            setTimeout(observeCartChanges, 2000);
        }, 500);
    }
    
    // Beobachte Warenkorb-Änderungen für automatische Updates (mit Debounce)
    function observeCartChanges() {
        const cartContent = document.getElementById('cartContent');
        if (!cartContent) return;
        
        let updateTimeout;
        const debouncedUpdate = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                updateCartSummary();
            }, 500); // Warte 500ms bevor Update
        };
        
        const observer = new MutationObserver(debouncedUpdate);
        observer.observe(cartContent, { childList: true, subtree: false }); // Nur direkte Kinder
        
        // Auch bei localStorage-Änderungen
        window.addEventListener('storage', (e) => {
            if (e.key === 'cart' || e.key === 'appliedVoucher') {
                debouncedUpdate();
            }
        });
    }

    function createVoucherSection() {
        // Prüfe ob bereits vorhanden
        if (document.getElementById('voucherSection')) {
            console.log('✅ Gutschein-Sektion bereits vorhanden');
            return;
        }

        const voucherHTML = `
            <style>
                @media (max-width: 768px) {
                    #voucherSection {
                        padding: 15px !important;
                        margin: 10px 0 !important;
                        max-width: 100% !important;
                    }
                    
                    #voucherSection h3 {
                        font-size: 1.1rem !important;
                    }
                    
                    #voucherSection .voucher-input-wrapper {
                        flex-direction: column !important;
                        gap: 0 !important;
                    }
                    
                    #voucherSection input {
                        width: 100% !important;
                        margin-bottom: 10px !important;
                        box-sizing: border-box !important;
                        font-size: 0.95rem !important;
                    }
                    
                    #voucherSection button {
                        width: 100% !important;
                        padding: 12px !important;
                        box-sizing: border-box !important;
                        font-size: 0.95rem !important;
                    }
                }
            </style>
            <div id="voucherSection" style="background: white; border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 800px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin-bottom: 15px; color: #333;">
                    <i class="bi bi-ticket-perforated" style="color: #667eea;"></i>
                    Gutschein einlösen
                </h3>
                
                <div class="voucher-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input 
                        type="text" 
                        id="voucherInput" 
                        placeholder="Gutscheincode eingeben (z.B. WELCOME25)..."
                        style="flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem;"
                    >
                    <button 
                        id="applyVoucherBtn" 
                        style="padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;"
                    >
                        Einlösen
                    </button>
                </div>
                
                <div id="voucherMessage" style="display: none; padding: 10px; border-radius: 8px; margin-top: 10px;"></div>
                
                <div id="appliedVoucherDisplay" style="display: none; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 15px; margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: #16a34a; margin-bottom: 5px;">
                                <i class="bi bi-check-circle-fill"></i> Gutschein angewendet
                            </div>
                            <div id="voucherDetails" style="color: #15803d; font-size: 0.9rem;"></div>
                        </div>
                        <button 
                            id="removeVoucherBtn"
                            style="background: transparent; border: none; color: #dc2626; cursor: pointer; font-size: 1.2rem;"
                        >
                            <i class="bi bi-x-circle"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Füge direkt nach page-header ein
        const pageHeader = document.querySelector('.page-header');
        if (pageHeader) {
            pageHeader.insertAdjacentHTML('afterend', voucherHTML);
            console.log('✅ Gutschein-Sektion nach page-header eingefügt');
        } else {
            // Fallback: Füge am Anfang von cartContent ein
            const cartContent = document.getElementById('cartContent');
            if (cartContent) {
                cartContent.insertAdjacentHTML('afterbegin', voucherHTML);
                console.log('✅ Gutschein-Sektion in cartContent eingefügt');
            } else {
                console.error('❌ Konnte Gutschein-Sektion nicht einfügen');
                return;
            }
        }

        // Event Listeners
        setTimeout(() => {
            const applyBtn = document.getElementById('applyVoucherBtn');
            const input = document.getElementById('voucherInput');
            const removeBtn = document.getElementById('removeVoucherBtn');
            
            if (applyBtn) {
                applyBtn.addEventListener('click', applyCartVoucher);
                console.log('✅ Apply-Button Event-Listener hinzugefügt');
            }
            
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') applyCartVoucher();
                });
                console.log('✅ Input Event-Listener hinzugefügt');
            }
            
            if (removeBtn) {
                removeBtn.addEventListener('click', removeCartVoucher);
                console.log('✅ Remove-Button Event-Listener hinzugefügt');
            }
        }, 100);
    }

    function checkAppliedVoucher() {
        const appliedCode = localStorage.getItem('appliedVoucher');
        if (appliedCode) {
            const voucher = getVoucherByCode(appliedCode);
            if (voucher) {
                showAppliedVoucher(voucher);
            }
        }
    }

    function applyCartVoucher() {
        const input = document.getElementById('voucherInput');
        const code = input.value.trim().toUpperCase();
        
        if (!code) {
            showVoucherMessage('Bitte gib einen Gutscheincode ein.', 'error');
            return;
        }

        const voucher = getVoucherByCode(code);
        
        if (!voucher) {
            showVoucherMessage('Ungültiger Gutscheincode.', 'error');
            return;
        }

        // Prüfe Bedingungen
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        if (voucher.minOrder > 0 && subtotal < voucher.minOrder) {
            showVoucherMessage(
                `Mindestbestellwert von ${voucher.minOrder}€ nicht erreicht. Aktuell: ${subtotal.toFixed(2)}€`,
                'error'
            );
            return;
        }

        if (voucher.minItems && itemCount < voucher.minItems) {
            showVoucherMessage(
                `Mindestens ${voucher.minItems} Produkte erforderlich. Aktuell: ${itemCount}`,
                'error'
            );
            return;
        }

        // Gutschein anwenden
        localStorage.setItem('appliedVoucher', code);
        showAppliedVoucher(voucher);
        showVoucherMessage('Gutschein erfolgreich angewendet!', 'success');
        input.value = '';
        
        // Aktualisiere Zusammenfassung
        updateCartSummary();
        
        console.log('✅ Gutschein angewendet:', code);
    }

    function removeCartVoucher() {
        localStorage.removeItem('appliedVoucher');
        document.getElementById('appliedVoucherDisplay').style.display = 'none';
        showVoucherMessage('Gutschein entfernt.', 'info');
        
        // Aktualisiere Zusammenfassung
        updateCartSummary();
        
        console.log('🗑️ Gutschein entfernt');
    }

    function showAppliedVoucher(voucher) {
        const display = document.getElementById('appliedVoucherDisplay');
        const details = document.getElementById('voucherDetails');
        
        let discountText = '';
        if (voucher.type === 'percentage') {
            discountText = `${(voucher.discount * 100)}% Rabatt`;
        } else if (voucher.type === 'shipping') {
            discountText = 'Kostenloser Versand';
        }
        
        details.innerHTML = `<strong>${voucher.code}</strong>: ${voucher.description} (${discountText})`;
        display.style.display = 'block';
    }

    function showVoucherMessage(message, type) {
        const messageDiv = document.getElementById('voucherMessage');
        
        const colors = {
            success: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
            error: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
            info: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' }
        };
        
        const color = colors[type] || colors.info;
        
        messageDiv.style.cssText = `
            display: block;
            background: ${color.bg};
            border: 2px solid ${color.border};
            color: ${color.text};
            padding: 10px;
            border-radius: 8px;
            margin-top: 10px;
        `;
        
        messageDiv.textContent = message;
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }

    // ===== WARENKORB-ZUSAMMENFASSUNG MIT RABATT =====
    function updateCartSummary() {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const appliedCode = localStorage.getItem('appliedVoucher');
        
        // Hole aktuelle Währung und Land aus cart.js
        const currentCurrency = window.currentCurrency || { code: 'EUR', symbol: '€', factor: 1 };
        const currentCountry = localStorage.getItem('selectedCountry') || 'DE';
        
        // Berechne Zwischensumme mit Währungsumrechnung
        const subtotal = cart.reduce((sum, item) => {
            const priceInCurrency = window.convertPrice ? window.convertPrice(item.price, currentCurrency.code) : item.price;
            return sum + (priceInCurrency * item.quantity);
        }, 0);
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        let discount = 0;
        // Hole Versandkosten basierend auf Land
        let shippingCost = window.getShippingCost ? window.getShippingCost(currentCountry) : 0;
        // Konvertiere Versandkosten in aktuelle Währung
        shippingCost = window.convertPrice ? window.convertPrice(shippingCost, currentCurrency.code) : shippingCost;
        let discountInfo = '';
        
        // Gutschein anwenden
        if (appliedCode) {
            const voucher = getVoucherByCode(appliedCode);
            if (voucher) {
                if (voucher.type === 'percentage') {
                    discount = subtotal * voucher.discount;
                    discountInfo = `${(voucher.discount * 100)}% Rabatt`;
                } else if (voucher.type === 'shipping') {
                    shippingCost = 0;
                    discountInfo = 'Kostenloser Versand';
                }
            }
        }
        
        const total = subtotal - discount + shippingCost;
        
        // Speichere Werte global für Checkout
        window.cartTotals = {
            subtotal: subtotal,
            discount: discount,
            shipping: shippingCost,
            total: total,
            discountInfo: discountInfo
        };
        
        // Erstelle oder aktualisiere Zusammenfassung
        displayCartSummary(subtotal, discount, shippingCost, total, discountInfo);
        
        // Update alle Preis-Anzeigen auf der Seite NUR wenn ein Gutschein aktiv ist
        if (appliedCode) {
            updateAllPriceDisplays(total);
        }
        
        console.log('💰 Zusammenfassung aktualisiert:', {
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            shipping: shippingCost.toFixed(2),
            total: total.toFixed(2)
        });
    }
    
    // Aktualisiere alle Preis-Anzeigen auf der Seite
    function updateAllPriceDisplays(total) {
        // Hole aktuelles Währungssymbol
        const currentCurrency = window.currentCurrency || { code: 'EUR', symbol: '€', factor: 1 };
        const currencySymbol = currentCurrency.symbol;
        
        // Suche nach allen Elementen die den Gesamtpreis anzeigen
        const priceElements = document.querySelectorAll('[data-total-price], .total-price, #totalPrice, .checkout-total');
        
        priceElements.forEach(element => {
            element.textContent = `${currencySymbol}${total.toFixed(2)}`;
        });
        
        // Update ALLE Buttons die einen Preis enthalten
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach(button => {
            const text = button.textContent || button.innerText;
            
            // Prüfe ob Button "JETZT BESTELLEN" oder einen Preis enthält
            // Unterstütze verschiedene Währungssymbole
            const currencyPattern = new RegExp(`[€$£¥₹A-Z]{1,3}\\s*[\\d,.]+`, 'g');
            if ((text.toUpperCase().includes('JETZT BESTELLEN') || text.toUpperCase().includes('BESTELLEN')) && currencyPattern.test(text)) {
                const newText = text.replace(currencyPattern, `${currencySymbol}${total.toFixed(2)}`);
                button.textContent = newText;
                console.log('✅ Button aktualisiert:', text, '→', newText);
            }
        });
        
        console.log('💳 Alle Preis-Anzeigen aktualisiert auf:', total.toFixed(2));
    }

    function displayCartSummary(subtotal, discount, shipping, total, discountInfo) {
        // Lösche separate Zusammenfassung falls vorhanden
        const oldSummary = document.getElementById('cartSummaryBox');
        if (oldSummary) {
            oldSummary.remove();
        }
        
        // Füge Rabatt in die bestehende Bestellung-Box ein
        updateExistingOrderBox(subtotal, discount, shipping, total, discountInfo);
    }
    
    function updateExistingOrderBox(subtotal, discount, shipping, total, discountInfo) {
        // Hole aktuelles Währungssymbol
        const currentCurrency = window.currentCurrency || { code: 'EUR', symbol: '€', factor: 1 };
        const currencySymbol = currentCurrency.symbol;
        
        // Suche nach "Zwischensumme:" in der Bestellung-Box
        const allElements = document.querySelectorAll('*');
        let zwischensummeRow = null;
        let versandRow = null;
        let gesamtRow = null;
        
        allElements.forEach(el => {
            const text = el.textContent || '';
            if (text.includes('Zwischensumme:') && !text.includes('Rabatt')) {
                zwischensummeRow = el.closest('div');
            }
            if (text.includes('Versand:') && !text.includes('kosten')) {
                versandRow = el.closest('div');
            }
            if (text.includes('Gesamt:') && !text.includes('summe')) {
                gesamtRow = el.closest('div');
            }
        });
        
        // Füge Rabatt-Zeile nach Zwischensumme ein
        if (zwischensummeRow && discount > 0) {
            // Entferne alte Rabatt-Zeile
            const oldRabatt = document.getElementById('voucherDiscountRow');
            if (oldRabatt) oldRabatt.remove();
            
            const rabattHTML = `
                <div id="voucherDiscountRow" style="display: flex; justify-content: space-between; padding: 12px 0; color: #16a34a; font-weight: 600;">
                    <span><i class="bi bi-tag-fill"></i> Rabatt (${discountInfo}):</span>
                    <span>-${currencySymbol}${discount.toFixed(2)}</span>
                </div>
            `;
            zwischensummeRow.insertAdjacentHTML('afterend', rabattHTML);
            console.log('✅ Rabatt-Zeile eingefügt');
        } else if (discount === 0) {
            // Entferne Rabatt-Zeile wenn kein Rabatt
            const oldRabatt = document.getElementById('voucherDiscountRow');
            if (oldRabatt) oldRabatt.remove();
        }
        
        // Update Versand und Gesamt NUR wenn ein Gutschein aktiv ist
        const appliedCode = localStorage.getItem('appliedVoucher');
        if (appliedCode) {
            // Update Versand
            if (versandRow) {
                const versandPrice = versandRow.querySelector('span:last-child');
                if (versandPrice) {
                    versandPrice.textContent = shipping === 0 ? 'Kostenlos' : `${currencySymbol}${shipping.toFixed(2)}`;
                    versandPrice.style.color = shipping === 0 ? '#16a34a' : '';
                    versandPrice.style.fontWeight = shipping === 0 ? '600' : '';
                    console.log('✅ Versand aktualisiert:', shipping === 0 ? 'Kostenlos' : shipping.toFixed(2));
                }
            }
            
            // Update Gesamt
            if (gesamtRow) {
                const gesamtPrice = gesamtRow.querySelector('span:last-child');
                if (gesamtPrice) {
                    gesamtPrice.textContent = `${currencySymbol}${total.toFixed(2)}`;
                    console.log('✅ Gesamt aktualisiert:', total.toFixed(2));
                }
            }
        }
    }

    // Mache Funktionen global verfügbar
    window.updateCartSummary = updateCartSummary;
    window.getCartTotals = function() {
        return window.cartTotals || {
            subtotal: 0,
            discount: 0,
            shipping: 0,
            total: 0,
            discountInfo: ''
        };
    };

    // ===== INITIALISIERUNG =====
    
    // Update Counter beim Laden
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateGutscheineCounter);
    } else {
        updateGutscheineCounter();
    }

    // Willkommens-Gutschein für Neukunden
    const hasVisited = localStorage.getItem('hasVisited');
    if (!hasVisited) {
        setTimeout(() => {
            window.addVoucherToUser(5); // WELCOME25
            localStorage.setItem('hasVisited', 'true');
            console.log('🎁 Willkommens-Gutschein hinzugefügt!');
        }, 2000);
    }

    console.log('✅ Gutschein-System initialisiert');
})();
