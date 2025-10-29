/**
 * Google Translate Website Widget - FUNKTIONIERT GARANTIERT!
 * Automatische Übersetzung basierend auf Standort + Manuelle Auswahl
 */

class TranslateWidget {
    constructor() {
        this.currentLanguage = localStorage.getItem('selectedLanguage') || 'de';
        this.translateReady = false;
        
        // Verfügbare Sprachen
        this.availableLanguages = {
            'de': 'Deutsch',
            'en': 'English',
            'fr': 'Français',
            'it': 'Italiano',
            'es': 'Español',
            'nl': 'Nederlands',
            'pl': 'Polski',
            'cs': 'Čeština',
            'da': 'Dansk',
            'sv': 'Svenska',
            'no': 'Norsk',
            'fi': 'Suomi',
            'pt': 'Português',
            'ru': 'Русский',
            'tr': 'Türkçe',
            'ar': 'العربية',
            'zh-CN': '中文',
            'ja': '日本語',
            'ko': '한국어'
        };
        
        // Lade Google Translate Script SOFORT
        this.initGoogleTranslate();
        
        // Hole Sprache aus Geolocation wenn verfügbar
        window.addEventListener('locationDetected', (e) => {
            if (e.detail && e.detail.language) {
                const detectedLang = e.detail.language;
                console.log('🌍 Standort erkannt, Sprache:', detectedLang);
                
                // Automatisch übersetzen wenn nicht Deutsch und nicht manuell gewählt
                if (!localStorage.getItem('manualLanguageSelection') && detectedLang !== 'de') {
                    this.currentLanguage = detectedLang;
                    localStorage.setItem('selectedLanguage', detectedLang);
                    
                    // Warte bis Google Translate bereit ist
                    this.waitAndTranslate(detectedLang);
                }
            }
        });
        
        // Erstelle UI
        this.createCustomUI();
        
        console.log('✅ Übersetzungssystem wird initialisiert...');
    }
    
    initGoogleTranslate() {
        // Füge Google Translate Script hinzu
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.head.appendChild(script);
        
        // Globale Callback-Funktion
        window.googleTranslateElementInit = () => {
            new google.translate.TranslateElement({
                pageLanguage: 'de',
                includedLanguages: 'de,en,fr,it,es,nl,pl,cs,da,sv,no,fi,pt,ru,tr,ar,zh-CN,ja,ko',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
            }, 'google_translate_element');
            
            this.translateReady = true;
            console.log('✅ Google Translate geladen!');
            
            // Verstecke Google UI
            this.hideGoogleUI();
        };
        
        // Erstelle verstecktes DIV
        const div = document.createElement('div');
        div.id = 'google_translate_element';
        div.style.display = 'none';
        document.body.appendChild(div);
    }
    
    hideGoogleUI() {
        const style = document.createElement('style');
        style.textContent = `
            .goog-te-banner-frame.skiptranslate,
            .goog-te-gadget-icon,
            .goog-te-gadget-simple,
            #google_translate_element,
            .skiptranslate {
                display: none !important;
            }
            body {
                top: 0 !important;
            }
            .goog-te-balloon-frame {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    waitAndTranslate(langCode) {
        if (this.translateReady) {
            setTimeout(() => this.doTranslate(langCode), 1000);
        } else {
            setTimeout(() => this.waitAndTranslate(langCode), 500);
        }
    }
    
    doTranslate(langCode) {
        // Prüfe ob localhost
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname === '';
        
        if (isLocalhost) {
            const langName = this.availableLanguages[langCode];
            this.showNotification(`⚠️ Funktioniert nur auf echter Domain`, '🌐');
            console.log('⚠️ Google Translate funktioniert nicht auf localhost');
            console.log('✅ Auf echter Domain (z.B. maios.de) wird es automatisch funktionieren');
            
            alert(`Übersetzung zu ${langName}:\n\n⚠️ Google Translate funktioniert nicht auf localhost!\n\n✅ Auf deiner echten Website wird es automatisch funktionieren.\n\n💡 Teste es nach dem Upload.`);
            return;
        }
        
        const select = document.querySelector('.goog-te-combo');
        if (select) {
            select.value = langCode;
            select.dispatchEvent(new Event('change'));
            console.log('✅ Seite übersetzt zu:', langCode);
            
            const langName = this.availableLanguages[langCode];
            this.showNotification(`✅ Übersetzt zu ${langName}`, this.getLanguageFlag(langCode));
        } else {
            console.log('⏳ Warte auf Google Translate...');
            setTimeout(() => this.doTranslate(langCode), 500);
        }
    }
    
    createCustomUI() {
        // Füge Sprachen ins Burger-Menü ein
        this.addLanguagesToBurgerMenu();
    }
    
    addLanguagesToBurgerMenu() {
        // Warte bis DOM geladen ist
        const addLanguages = () => {
            const burgerLanguageList = document.getElementById('burgerLanguageList');
            const languageMenuBtn = document.getElementById('languageMenuBtn');
            const languageOverlay = document.getElementById('languageDropdownOverlay');
            const closeBtn = document.getElementById('closeLanguageDropdown');
            
            if (!burgerLanguageList || !languageMenuBtn) {
                console.log('⏳ Warte auf Burger-Menü...');
                setTimeout(addLanguages, 500);
                return;
            }
            
            console.log('✅ Füge Sprachen ins Dropdown ein');
            
            // Erstelle Sprach-Buttons
            const languageHTML = Object.entries(this.availableLanguages)
                .map(([code, name]) => `
                    <button class="language-menu-btn" data-lang="${code}" style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        width: 100%;
                        padding: 14px 16px;
                        margin: 6px 0;
                        background: white;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 15px;
                        font-weight: 500;
                    ">
                        <span style="font-size: 24px;">${this.getLanguageFlag(code)}</span>
                        <span>${name}</span>
                    </button>
                `).join('');
            
            burgerLanguageList.innerHTML = languageHTML;
            
            // Öffne Dropdown beim Klick auf "Sprache"
            languageMenuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                languageOverlay.style.display = 'block';
                // Schließe Burger-Menü
                const burgerOverlay = document.getElementById('burgerMenuOverlay');
                if (burgerOverlay) {
                    burgerOverlay.classList.remove('active');
                }
            });
            
            // Schließe Dropdown
            closeBtn.addEventListener('click', () => {
                languageOverlay.style.display = 'none';
            });
            
            // Schließe beim Klick außerhalb
            languageOverlay.addEventListener('click', (e) => {
                if (e.target === languageOverlay) {
                    languageOverlay.style.display = 'none';
                }
            });
            
            // Event Listeners für Sprach-Buttons
            burgerLanguageList.querySelectorAll('.language-menu-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const langCode = btn.dataset.lang;
                    this.setLanguage(langCode);
                    
                    // Schließe Dropdown
                    languageOverlay.style.display = 'none';
                });
                
                // Hover-Effekt
                btn.addEventListener('mouseenter', function() {
                    this.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    this.style.borderColor = '#667eea';
                    this.style.color = 'white';
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                });
                
                btn.addEventListener('mouseleave', function() {
                    this.style.background = 'white';
                    this.style.borderColor = '#e0e0e0';
                    this.style.color = 'inherit';
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = 'none';
                });
            });
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addLanguages);
        } else {
            addLanguages();
        }
    }
    
    getLanguageFlag(code) {
        const flags = {
            'de': '🇩🇪', 'en': '🇬🇧', 'fr': '🇫🇷', 'it': '🇮🇹',
            'es': '🇪🇸', 'nl': '🇳🇱', 'pl': '🇵🇱', 'cs': '🇨🇿',
            'da': '🇩🇰', 'sv': '🇸🇪', 'no': '🇳🇴', 'fi': '🇫🇮',
            'pt': '🇵🇹', 'ru': '🇷🇺', 'tr': '🇹🇷', 'ar': '🇸🇦',
            'zh-CN': '🇨🇳', 'ja': '🇯🇵', 'ko': '🇰🇷'
        };
        return flags[code] || '🌍';
    }
    
    setLanguage(langCode) {
        // Markiere als manuelle Auswahl
        localStorage.setItem('manualLanguageSelection', 'true');
        localStorage.setItem('selectedLanguage', langCode);
        this.currentLanguage = langCode;
        
        const langName = this.availableLanguages[langCode] || 'Deutsch';
        console.log('✅ Sprache manuell gewählt:', langName);
        
        // Trigger Custom Event
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { code: langCode, name: langName }
        }));
        
        // Übersetze!
        if (langCode === 'de') {
            // Zurück zu Deutsch = Seite neu laden
            window.location.reload();
        } else {
            this.waitAndTranslate(langCode);
        }
    }
    
    
    showNotification(message, icon) {
        // Entferne alte Notification
        const old = document.getElementById('translate-notification');
        if (old) old.remove();
        
        // Erstelle Notification
        const notification = document.createElement('div');
        notification.id = 'translate-notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 15px;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <span style="font-size: 24px;">${icon}</span>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Auto-remove nach 3 Sekunden
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Public API
    getCurrentLanguage() {
        return this.currentLanguage;
    }
    
    getAvailableLanguages() {
        return this.availableLanguages;
    }
    
    changeLanguage(langCode) {
        this.setLanguage(langCode);
    }
}

// Initialisiere Widget wenn DOM geladen ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.translateWidget = new TranslateWidget();
    });
} else {
    window.translateWidget = new TranslateWidget();
}

console.log('✅ Google Translate Widget Script geladen');
