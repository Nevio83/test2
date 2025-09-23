/**
 * KEYBOARD SHORTCUTS SYSTEM FÜR TEST2 MARKTPLATZ
 * Zentrale Keyboard Shortcuts Bibliothek mit visuellen Feedback
 */

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = {
            // Navigation Shortcuts
            'h': { action: 'home', description: 'Zur Startseite', category: 'Navigation' },
            's': { action: 'search', description: 'Suche öffnen/fokussieren', category: 'Navigation' },
            'c': { action: 'cart', description: 'Warenkorb öffnen/schließen', category: 'Navigation' },
            'w': { action: 'wishlist', description: 'Zur Wunschliste', category: 'Navigation' },
            'escape': { action: 'close', description: 'Schließen/Zurück', category: 'Navigation' },
            
            // Kategorie Shortcuts
            '1': { action: 'category-alle', description: 'Alle Produkte', category: 'Kategorien' },
            '2': { action: 'category-haushalt', description: 'Haushalt & Küche', category: 'Kategorien' },
            '3': { action: 'category-elektronik', description: 'Elektronik', category: 'Kategorien' },
            '4': { action: 'category-beleuchtung', description: 'Beleuchtung', category: 'Kategorien' },
            '5': { action: 'category-wellness', description: 'Körperpflege & Wellness', category: 'Kategorien' },
            
            // Hilfe Shortcuts
            'f': { action: 'help', description: 'Keyboard Shortcuts Hilfe', category: 'Hilfe' },
            '?': { action: 'help', description: 'Keyboard Shortcuts Hilfe', category: 'Hilfe' },
            
            // Produkt Shortcuts (mit Modifiern)
            'ctrl+a': { action: 'add-to-cart', description: 'Gehövertes Produkt zum Warenkorb hinzufügen', category: 'Produkte' },
            'ctrl+l': { action: 'add-to-wishlist', description: 'Gehövertes Produkt zur Wunschliste hinzufügen', category: 'Produkte' },
            
            // Warenkorb Shortcuts
            'p': { action: 'go-to-cart', description: 'Zum Warenkorb (cart.html)', category: 'Warenkorb' },
            'e': { action: 'empty-cart', description: 'Warenkorb leeren', category: 'Warenkorb' }
        };
        
        this.isActive = true;
        this.notificationTimeout = null;
        this.currentHoveredProduct = null;
        this.init();
    }
    
    init() {
        this.createKeyboardIndicator();
        this.bindEvents();
        console.log('🎹 Keyboard Shortcuts System aktiviert');
    }
    
    createKeyboardIndicator() {
        // Keyboard Indikator entfernt - wird nicht mehr angezeigt
        console.log('🎹 Keyboard Indicator deaktiviert');
    }
    
    bindEvents() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e), true); // Use capture phase
        
        // Hover-Tracking für Produktkarten - Lumière spezifische Selektoren
        document.addEventListener('mouseover', (e) => {
            // Suche nach Lumière Produktkarten mit verbesserter Selektor-Logik
            const productCard = e.target.closest('.lumiere-product-card') || 
                               e.target.closest('[data-product-id]') ||
                               e.target.closest('.product-card') ||
                               e.target.closest('.card[data-product-id]');
            
            if (productCard && productCard.dataset.productId) {
                this.currentHoveredProduct = productCard;
                const productId = productCard.dataset.productId;
                const productTitle = productCard.querySelector('.lumiere-product-title, .card-title, .product-title, h5, h4, h3')?.textContent;
                console.log('🎯 Hovered product card:', productCard.className);
                console.log('🎯 Product ID:', productId);
                console.log('🎯 Product title:', productTitle);
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            const productCard = e.target.closest('.lumiere-product-card') || 
                               e.target.closest('[data-product-id]') ||
                               e.target.closest('.product-card') ||
                               e.target.closest('.card[data-product-id]');
            
            if (productCard === this.currentHoveredProduct) {
                this.currentHoveredProduct = null;
                console.log('🎯 Mouse left product');
            }
        });
    }
    
    handleKeydown(e) {
        console.log('🎹 Keydown event received:', e.key, 'Active element:', document.activeElement.tagName);
        
        // Ignoriere Shortcuts in Input-Feldern
        if (this.isInputFocused()) {
            console.log('🎹 Input focused, ignoring shortcut');
            return;
        }
        
        // Baue Shortcut-String
        let shortcut = '';
        if (e.ctrlKey) shortcut += 'ctrl+';
        if (e.altKey) shortcut += 'alt+';
        if (e.shiftKey) shortcut += 'shift+';
        
        // Spezielle Behandlung für Sonderzeichen
        let key = e.key.toLowerCase();
        if (key === '?') {
            key = '?';
        }
        shortcut += key;
        
        console.log('🎹 Built shortcut string:', shortcut);
        
        // Führe Shortcut aus
        if (this.shortcuts[shortcut]) {
            console.log('🎹 Shortcut found, executing:', shortcut);
            e.preventDefault();
            e.stopPropagation();
            this.executeShortcut(shortcut);
        } else {
            console.log('🎹 No shortcut found for:', shortcut);
        }
    }
    
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
    }
    
    executeShortcut(shortcut) {
        const action = this.shortcuts[shortcut].action;
        const description = this.shortcuts[shortcut].description;
        
        console.log(`🎹 Executing shortcut: ${shortcut} (${action})`);
        
        // Zeige visuelles Feedback
        this.showNotification(shortcut, description);
        
        // Führe Aktion aus
        switch (action) {
            case 'home':
                this.goHome();
                break;
            case 'search':
                this.toggleSearch();
                break;
            case 'cart':
                this.toggleCart();
                break;
            case 'wishlist':
                this.goToWishlist();
                break;
            case 'close':
                this.closeOverlays();
                break;
            case 'category-alle':
                this.selectCategory('alle');
                break;
            case 'category-haushalt':
                this.selectCategory('Haushalt und Küche');
                break;
            case 'category-elektronik':
                this.selectCategory('Technik/Gadgets');
                break;
            case 'category-beleuchtung':
                this.selectCategory('Beleuchtung');
                break;
            case 'category-wellness':
                this.selectCategory('Körperpflege/Wellness');
                break;
            case 'help':
                this.showHelpModal();
                break;
            case 'add-to-cart':
                this.addToCart();
                break;
            case 'add-to-wishlist':
                this.addToWishlist();
                break;
            case 'go-to-cart':
                this.goToCart();
                break;
            case 'empty-cart':
                this.emptyCart();
                break;
        }
    }
    
    showNotification(shortcut, description) {
        // Benachrichtigungen deaktiviert
        console.log(`🎹 Shortcut ausgeführt: ${shortcut} (${description})`);
    }
    
    // Shortcut Aktionen
    goHome() {
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
            window.location.href = this.getRelativePath('index.html');
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
    
    toggleSearch() {
        const searchBtn = document.getElementById('fullscreenSearchBtn');
        const searchOverlay = document.getElementById('fullscreenSearchOverlay');
        
        if (searchOverlay && searchOverlay.classList.contains('active')) {
            // Schließe Suche
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
        } else if (searchBtn) {
            // Öffne Suche
            searchBtn.click();
        }
    }
    
    toggleCart() {
        const cartButton = document.getElementById('cartButton');
        const cartDropdown = document.getElementById('cartDropdown');
        
        if (cartDropdown && cartDropdown.classList.contains('show')) {
            // Schließe Warenkorb
            cartDropdown.classList.remove('show');
            document.body.classList.remove('cart-open');
        } else if (cartButton) {
            // Öffne Warenkorb
            cartButton.click();
        }
    }
    
    goToWishlist() {
        window.location.href = this.getRelativePath('wishlist.html');
    }
    
    closeOverlays() {
        // Schließe alle Overlays
        const searchOverlay = document.getElementById('fullscreenSearchOverlay');
        const cartDropdown = document.getElementById('cartDropdown');
        const hilfePanel = document.getElementById('hilfePanel');
        
        if (searchOverlay && searchOverlay.classList.contains('active')) {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        if (cartDropdown && cartDropdown.classList.contains('show')) {
            cartDropdown.classList.remove('show');
            document.body.classList.remove('cart-open');
        }
        
        if (hilfePanel && hilfePanel.classList.contains('offen')) {
            hilfePanel.classList.remove('offen');
            hilfePanel.style.display = 'none';
            document.body.classList.remove('help-panel-open');
        }
        
        // Schließe Help Modal
        const helpModal = document.getElementById('keyboard-help-modal');
        if (helpModal) {
            helpModal.remove();
        }
    }
    
    selectCategory(category) {
        // Für Hauptseite - Kategorie-Navigation
        const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
        categoryTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-category') === category) {
                tab.classList.add('active');
                tab.click();
            }
        });
    }
    
    addToCart() {
        console.log('🛒 Ctrl+A pressed - trying to add to cart');
        console.log('🛒 Current hovered product:', this.currentHoveredProduct);
        console.log('🛒 Current URL:', window.location.pathname);
        
        // Prüfe ob wir auf einer Produktseite sind
        const isProductPage = window.location.pathname.includes('/produkte/') || 
                             window.location.pathname.includes('produkt-');
        
        if (isProductPage) {
            // Auf Produktseiten: Funktioniert ohne Hover (nur 1 Produkt)
            console.log('🛒 On product page - searching for any add-to-cart button');
            const addToCartBtn = document.querySelector('.lumiere-add-to-cart-btn, .add-to-cart, button[onclick*="addToCart"]');
            
            if (addToCartBtn) {
                console.log('🛒 Found add-to-cart button on product page:', addToCartBtn);
                addToCartBtn.click();
                return;
            }
        } else {
            // Auf anderen Seiten: Funktioniert wenn über Produktkarte gehövert wird
            if (!this.currentHoveredProduct) {
                console.log('🛒 No product hovered - Ctrl+A disabled');
                console.log('🛒 Available product cards:', document.querySelectorAll('.lumiere-product-card').length);
                return;
            }
            
            console.log('🛒 Hovered product card classes:', this.currentHoveredProduct.className);
            console.log('🛒 Hovered product ID:', this.currentHoveredProduct.dataset.productId);
            
            // Suche nach Lumière Add-to-Cart Button
            const addToCartBtn = this.currentHoveredProduct.querySelector('.lumiere-add-to-cart-btn');
            
            if (addToCartBtn) {
                const productId = addToCartBtn.dataset.productId;
                console.log('🛒 Found lumiere-add-to-cart button for product ID:', productId);
                console.log('🛒 Button element:', addToCartBtn);
                console.log('🛒 Clicking button...');
                addToCartBtn.click();
                return;
            } else {
                console.log('🛒 No add-to-cart button found in hovered product');
                console.log('🛒 Available buttons in product:', this.currentHoveredProduct.querySelectorAll('button'));
            }
        }
        
        console.log('🛒 No add-to-cart functionality found');
    }
    
    addToWishlist() {
        console.log('❤️ Ctrl+L pressed - trying to add to wishlist');
        console.log('❤️ Current hovered product:', this.currentHoveredProduct);
        console.log('❤️ Current URL:', window.location.pathname);
        
        // Prüfe ob wir auf einer Produktseite sind
        const isProductPage = window.location.pathname.includes('/produkte/') || 
                             window.location.pathname.includes('produkt-');
        
        if (isProductPage) {
            // Auf Produktseiten: Funktioniert ohne Hover (nur 1 Produkt)
            console.log('❤️ On product page - searching for any wishlist button');
            const wishlistBtn = document.querySelector('.lumiere-wishlist-btn, .wishlist-btn, button[onclick*="wishlist"]');
            
            if (wishlistBtn) {
                console.log('❤️ Found wishlist button on product page:', wishlistBtn);
                wishlistBtn.click();
                return;
            }
        } else {
            // Auf anderen Seiten: Funktioniert wenn über Produktkarte gehövert wird
            if (!this.currentHoveredProduct) {
                console.log('❤️ No product hovered - Ctrl+L disabled');
                console.log('❤️ Available product cards:', document.querySelectorAll('.lumiere-product-card').length);
                return;
            }
            
            console.log('❤️ Hovered product card classes:', this.currentHoveredProduct.className);
            console.log('❤️ Hovered product ID:', this.currentHoveredProduct.dataset.productId);
            
            // Suche nach Lumière Wishlist Button
            const wishlistBtn = this.currentHoveredProduct.querySelector('.lumiere-wishlist-btn');
            
            if (wishlistBtn) {
                const productId = wishlistBtn.dataset.productId;
                console.log('❤️ Found lumiere-wishlist button for product ID:', productId);
                console.log('❤️ Button element:', wishlistBtn);
                console.log('❤️ Clicking button...');
                wishlistBtn.click();
                return;
            } else {
                console.log('❤️ No wishlist button found in hovered product');
                console.log('❤️ Available buttons in product:', this.currentHoveredProduct.querySelectorAll('button'));
            }
        }
        
        console.log('❤️ No wishlist functionality found');
    }
    
    goToCart() {
        // Navigiere direkt zu cart.html
        window.location.href = this.getRelativePath('cart.html');
    }
    
    emptyCart() {
        // Direkt leeren ohne Popup
        console.log('🗑️ Clearing cart via E shortcut');
        
        // Versuche verschiedene Methoden den Warenkorb zu leeren
        if (window.location.pathname.includes('cart.html')) {
            // Im Warenkorb: Suche nach Clear-Button
            const emptyBtn = document.querySelector('#clearCart, .clear-cart, .empty-cart, button[onclick*="clear"], button[onclick*="empty"], .btn[onclick*="clearCart"]');
            if (emptyBtn) {
                emptyBtn.click();
                return;
            }
        }
        
        // Versuche localStorage/sessionStorage zu leeren
        try {
            localStorage.removeItem('cart');
            localStorage.removeItem('cartItems');
            sessionStorage.removeItem('cart');
            sessionStorage.removeItem('cartItems');
            
            // Versuche globale Cart-Funktionen
            if (typeof clearCart === 'function') {
                clearCart();
            } else if (typeof window.clearCart === 'function') {
                window.clearCart();
            } else if (typeof emptyCart === 'function') {
                emptyCart();
            }
            
            console.log('🗑️ Cart cleared via storage');
        } catch (e) {
            console.log('Could not clear cart storage:', e);
        }
    }
    
    showHelpModal() {
        // Entferne vorheriges Modal
        const existing = document.getElementById('keyboard-help-modal');
        if (existing) existing.remove();
        
        // Erstelle Help Modal
        const modal = document.createElement('div');
        modal.id = 'keyboard-help-modal';
        modal.innerHTML = this.generateHelpModalContent();
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(modal);
        
        // Schließe bei Klick außerhalb
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Schließe bei ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    generateHelpModalContent() {
        const categories = {};
        
        // Gruppiere Shortcuts nach Kategorien
        Object.entries(this.shortcuts).forEach(([key, shortcut]) => {
            if (!categories[shortcut.category]) {
                categories[shortcut.category] = [];
            }
            categories[shortcut.category].push({ key, ...shortcut });
        });
        
        let content = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 40px;
                width: 90vw;
                max-width: 1200px;
                height: 85vh;
                max-height: 900px;
                overflow-y: auto;
                box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
                position: relative;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 3px solid #667eea; padding-bottom: 16px;">
                    <h2 style="margin: 0; color: #333; font-size: 32px; font-weight: 800;">🎹 Keyboard Shortcuts</h2>
                    <button onclick="this.closest('#keyboard-help-modal').remove()" style="
                        background: #f8f9fa;
                        border: 2px solid #dee2e6;
                        font-size: 28px;
                        cursor: pointer;
                        color: #666;
                        padding: 8px 12px;
                        border-radius: 8px;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='#e9ecef'; this.style.borderColor='#667eea';" onmouseout="this.style.background='#f8f9fa'; this.style.borderColor='#dee2e6';">&times;</button>
                </div>
        `;
        
        // Erstelle Kategorien
        Object.entries(categories).forEach(([category, shortcuts]) => {
            content += `
                <div style="margin-bottom: 32px;">
                    <h3 style="color: #667eea; font-size: 24px; margin-bottom: 16px; border-bottom: 2px solid #667eea; padding-bottom: 8px; font-weight: 700;">
                        ${category}
                    </h3>
                    <div style="display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
            `;
            
            shortcuts.forEach(shortcut => {
                content += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef; transition: all 0.2s ease;" onmouseover="this.style.background='#e9ecef'; this.style.borderColor='#667eea';" onmouseout="this.style.background='#f8f9fa'; this.style.borderColor='#e9ecef';">
                        <span style="color: #333; font-size: 16px; font-weight: 500;">${shortcut.description}</span>
                        <kbd style="
                            background: linear-gradient(135deg, #667eea, #764ba2);
                            color: white;
                            padding: 8px 12px;
                            border-radius: 4px;
                            font-family: monospace;
                            font-size: 12px;
                            font-weight: bold;
                        ">${shortcut.key.toUpperCase()}</kbd>
                    </div>
                `;
            });
            
            content += `
                    </div>
                </div>
            `;
        });
        
        content += `
                <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
                    Drücke <kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">ESC</kbd> zum Schließen
                </div>
            </div>
        `;
        
        return content;
    }
    
    getRelativePath(filename) {
        // Intelligente Pfad-Erkennung
        const currentPath = window.location.pathname;
        if (currentPath.includes('/produkte/') || currentPath.includes('/infos/')) {
            return '../' + filename;
        }
        return filename;
    }
}

// CSS für Animationen hinzufügen
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        0% { transform: translateX(100%); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Initialisiere System wenn DOM geladen ist
function initializeKeyboardShortcuts() {
    console.log('🎹 Initializing keyboard shortcuts system...');
    if (window.keyboardShortcuts) {
        console.log('🎹 Keyboard shortcuts already initialized');
        return;
    }
    
    try {
        window.keyboardShortcuts = new KeyboardShortcuts();
        console.log('🎹 Keyboard shortcuts system successfully initialized');
    } catch (error) {
        console.error('🎹 Error initializing keyboard shortcuts:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeKeyboardShortcuts);
} else {
    // DOM is already loaded, initialize immediately
    setTimeout(initializeKeyboardShortcuts, 100); // Small delay to ensure other scripts are loaded
}

console.log('🎹 Keyboard Shortcuts System geladen');
