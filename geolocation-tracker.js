/**
 * IP-basierte Geolocation und Standort-Tracking System
 * Ländererkennung für die Besucher-Statistik.
 *
 * ⚠️ DSGVO: Dieses Skript reicht die IP-Adresse des Besuchers an externe
 * Dienste weiter. Eine IP ist ein personenbezogenes Datum — das darf NICHT
 * ohne Einwilligung passieren. Frueher lief die Abfrage direkt im Konstruktor
 * los, also noch bevor der Besucher den Cookie-Banner ueberhaupt gesehen hatte;
 * damit lief die eigene Einwilligungsabfrage ins Leere.
 *
 * Jetzt gilt dieselbe Regel wie in site-integrations.js: erst bei
 * „Alle Cookies akzeptieren" (window.MaiosConsent). Wer ablehnt oder noch
 * nicht entschieden hat, loest keine einzige externe Anfrage aus.
 *
 * Kostet nichts an Funktion: die Laenderkennung wird ausschliesslich von
 * view-tracker.js verwendet, und der ist selbst einwilligungsgesteuert — ohne
 * Einwilligung wird ohnehin nichts erfasst, wofuer das Land gebraucht wuerde.
 */

class GeolocationTracker {
    constructor() {
        this.userLocation = null;
        this.ipData = null;
        this.initialized = false;
        this.started = false;

        // Kostenlose IP-Geolocation APIs (keine API-Keys erforderlich)
        this.apis = [
            'https://ipapi.co/json/',
            'https://ip-api.com/json/',
            'https://ipwhois.app/json/',
            'https://geolocation-db.com/json/'
        ];

        // Bewusst KEIN init() hier — siehe Kopfkommentar.
    }

    /** Einwilligung fuer Tracking erteilt? Gleiche Pruefung wie site-integrations.js. */
    static consentOK() {
        return !!(window.MaiosConsent &&
                  window.MaiosConsent.allowsTracking &&
                  window.MaiosConsent.allowsTracking());
    }

    async init() {
        // Doppelstart verhindern: onChange und das Event koennen beide feuern.
        if (this.started) return;
        if (!GeolocationTracker.consentOK()) return;
        this.started = true;

        console.log('🌍 Geolocation Tracker wird initialisiert (Einwilligung liegt vor)...');

        // Versuche Standort aus localStorage zu laden
        const cached = this.loadFromCache();
        if (cached && this.isCacheValid(cached)) {
            this.userLocation = cached;
            this.applyLocationData(cached);
            console.log('✅ Standort aus Cache geladen:', cached.country);
            return;
        }

        // Hole neue Standortdaten
        await this.fetchLocation();
        this.initialized = true;
    }
    
    async fetchLocation() {
        for (const apiUrl of this.apis) {
            try {
                console.log(`🔍 Versuche API: ${apiUrl}`);
                const response = await fetch(apiUrl);
                
                if (!response.ok) continue;
                
                const data = await response.json();
                this.ipData = this.normalizeData(data, apiUrl);
                
                if (this.ipData && this.ipData.country) {
                    this.userLocation = this.ipData;
                    this.saveToCache(this.ipData);
                    this.applyLocationData(this.ipData);
                    this.trackLocation(this.ipData);
                    console.log('✅ Standort erfolgreich ermittelt:', this.ipData);
                    return;
                }
            } catch (error) {
                console.warn(`⚠️ API ${apiUrl} fehlgeschlagen:`, error.message);
                continue;
            }
        }
        
        console.error('❌ Alle Geolocation APIs fehlgeschlagen');
        this.useFallback();
    }
    
    normalizeData(data, apiUrl) {
        // Normalisiere verschiedene API-Formate zu einheitlichem Format
        const normalized = {
            ip: data.ip || data.query || 'Unknown',
            country: data.country || data.country_name || data.country_code || 'Unknown',
            countryCode: data.country_code || data.countryCode || data.country || 'XX',
            region: data.region || data.region_name || data.regionName || '',
            city: data.city || '',
            latitude: data.latitude || data.lat || 0,
            longitude: data.longitude || data.lon || 0,
            timezone: data.timezone || data.time_zone || '',
            currency: data.currency || data.currency_code || 'EUR',
            language: data.languages || this.getLanguageFromCountry(data.country_code || data.countryCode),
            isp: data.isp || data.org || '',
            timestamp: Date.now(),
            source: apiUrl
        };
        
        return normalized;
    }
    
    getLanguageFromCountry(countryCode) {
        const languageMap = {
            'DE': 'de',
            'AT': 'de',
            'CH': 'de',
            'FR': 'fr',
            'IT': 'it',
            'ES': 'es',
            'GB': 'en',
            'US': 'en',
            'NL': 'nl',
            'BE': 'nl',
            'PL': 'pl',
            'CZ': 'cs',
            'DK': 'da',
            'SE': 'sv',
            'NO': 'no',
            'FI': 'fi'
        };
        
        return languageMap[countryCode] || 'de';
    }
    
    applyLocationData(location) {
        // Setze Sprache basierend auf Land
        this.setLanguageByLocation(location);
        
        // Zeige Standort-Banner (optional)
        this.showLocationBanner(location);
        
        // Passe Versandkosten an
        this.updateShippingCosts(location);
        
        // Trigger Custom Event für andere Scripts
        window.dispatchEvent(new CustomEvent('locationDetected', {
            detail: location
        }));
    }
    
    setLanguageByLocation(location) {
        const language = location.language || this.getLanguageFromCountry(location.countryCode);
        
        // Speichere bevorzugte Sprache
        localStorage.setItem('preferredLanguage', language);
        
        // Setze Google Translate auf diese Sprache (wenn Widget geladen ist)
        if (window.googleTranslateElementInit) {
            setTimeout(() => {
                this.setGoogleTranslateLanguage(language);
            }, 1000);
        }
        
        console.log(`🌐 Sprache auf ${language} gesetzt (Land: ${location.country})`);
    }
    
    setGoogleTranslateLanguage(language) {
        try {
            const select = document.querySelector('.goog-te-combo');
            if (select) {
                select.value = language;
                select.dispatchEvent(new Event('change'));
            }
        } catch (error) {
            console.warn('Google Translate Sprache konnte nicht gesetzt werden:', error);
        }
    }
    
    showLocationBanner(location) {
        // Banner ist deaktiviert - alles läuft automatisch im Hintergrund
        return;
    }
    
    getCountryFlag(countryCode) {
        const flags = {
            'DE': '🇩🇪', 'AT': '🇦🇹', 'CH': '🇨🇭', 'FR': '🇫🇷',
            'IT': '🇮🇹', 'ES': '🇪🇸', 'GB': '🇬🇧', 'US': '🇺🇸',
            'NL': '🇳🇱', 'BE': '🇧🇪', 'PL': '🇵🇱', 'CZ': '🇨🇿',
            'DK': '🇩🇰', 'SE': '🇸🇪', 'NO': '🇳🇴', 'FI': '🇫🇮'
        };
        return flags[countryCode] || '🌍';
    }
    
    updateShippingCosts(location) {
        // Europa: Kostenloser Versand
        const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'GB', 'NL', 'BE', 'PL', 'CZ', 'DK', 'SE', 'NO', 'FI'];
        const isEurope = europeanCountries.includes(location.countryCode);
        
        const shippingCost = isEurope ? 0 : 4.99;
        localStorage.setItem('shippingCost', shippingCost);
        localStorage.setItem('userCountry', location.countryCode);
        
        console.log(`📦 Versandkosten: ${shippingCost}€ (${isEurope ? 'Europa' : 'International'})`);
    }
    
    trackLocation(location) {
        // Speichere Standort-Statistiken
        const stats = JSON.parse(localStorage.getItem('locationStats') || '[]');
        
        stats.push({
            timestamp: Date.now(),
            country: location.country,
            countryCode: location.countryCode,
            city: location.city,
            ip: location.ip,
            source: location.source
        });
        
        // Behalte nur letzte 50 Einträge
        if (stats.length > 50) {
            stats.splice(0, stats.length - 50);
        }
        
        localStorage.setItem('locationStats', JSON.stringify(stats));
        
        // Sende zu Analytics (optional - wenn implementiert)
        this.sendToAnalytics(location);
    }
    
    sendToAnalytics(location) {
        // Google Analytics Event (falls GA implementiert ist)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'location_detected', {
                'country': location.country,
                'country_code': location.countryCode,
                'city': location.city,
                'ip': location.ip
            });
        }
        
        // Custom Analytics Endpoint (optional)
        // fetch('/api/analytics/location', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(location)
        // }).catch(err => console.warn('Analytics fehlgeschlagen:', err));
    }
    
    saveToCache(data) {
        localStorage.setItem('userLocation', JSON.stringify(data));
    }
    
    loadFromCache() {
        try {
            const cached = localStorage.getItem('userLocation');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            return null;
        }
    }
    
    isCacheValid(cached) {
        // Cache ist 24 Stunden gültig
        const maxAge = 24 * 60 * 60 * 1000; // 24 Stunden
        return cached && cached.timestamp && (Date.now() - cached.timestamp < maxAge);
    }
    
    useFallback() {
        // Fallback auf Deutschland wenn alle APIs fehlschlagen
        this.userLocation = {
            country: 'Germany',
            countryCode: 'DE',
            city: '',
            language: 'de',
            currency: 'EUR',
            timestamp: Date.now(),
            source: 'fallback'
        };
        
        this.applyLocationData(this.userLocation);
        console.log('⚠️ Fallback auf Deutschland aktiviert');
    }
    
    // Public API
    getLocation() {
        return this.userLocation;
    }
    
    getCountry() {
        return this.userLocation?.country || 'Unknown';
    }
    
    getCountryCode() {
        return this.userLocation?.countryCode || 'XX';
    }
    
    getLanguage() {
        return this.userLocation?.language || 'de';
    }
    
    isEuropean() {
        const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'GB', 'NL', 'BE', 'PL', 'CZ', 'DK', 'SE', 'NO', 'FI'];
        return europeanCountries.includes(this.getCountryCode());
    }
    
    // Statistiken abrufen
    getStats() {
        return JSON.parse(localStorage.getItem('locationStats') || '[]');
    }
    
    clearCache() {
        localStorage.removeItem('userLocation');
        localStorage.removeItem('locationBannerClosed');
        console.log('🗑️ Geolocation Cache gelöscht');
    }
}

// Globale Instanz erstellen — startet noch NICHTS, siehe Kopfkommentar.
window.geolocationTracker = new GeolocationTracker();

// Helper-Funktionen für einfachen Zugriff. Ohne Einwilligung liefern sie die
// unverfaenglichen Standardwerte ('Unbekannt' / 'XX'), statt zu scheitern —
// view-tracker.js prueft ohnehin auf 'XX' und laesst das Feld dann leer.
window.getUserCountry = () => window.geolocationTracker.getCountry();
window.getUserCountryCode = () => window.geolocationTracker.getCountryCode();
window.getUserLanguage = () => window.geolocationTracker.getLanguage();
window.isEuropeanUser = () => window.geolocationTracker.isEuropean();

// Start erst bei vorliegender Einwilligung — und nachtraeglich, falls der
// Besucher erst spaeter zustimmt.
//
// Die Pruefung laeuft bewusst erst bei DOMContentLoaded: dieses Skript ist in
// index.html VOR cookie-consent.js eingebunden, window.MaiosConsent existiert
// zum Ausfuehrungszeitpunkt also noch nicht. Wuerde man hier sofort pruefen,
// bliebe die Erkennung bei jedem wiederkehrenden Besucher dauerhaft aus —
// dessen Einwilligung liegt ja schon gespeichert vor, es feuert also auch kein
// Aenderungs-Ereignis mehr.
(function () {
  'use strict';
  const start = () => window.geolocationTracker.init();

  // Zustimmung waehrend des Besuchs: greift unabhaengig von der Ladereihenfolge.
  window.addEventListener('maios:consent', start);

  function wire() {
    if (GeolocationTracker.consentOK()) {
      start();
      return;
    }
    console.log('🌍 Standort-Erkennung wartet auf Cookie-Einwilligung (bisher keine externe Abfrage)');
    if (window.MaiosConsent && window.MaiosConsent.onChange) window.MaiosConsent.onChange(start);
  }

  // Erst NACH DOMContentLoaded pruefen — dann sind alle defer-Skripte durch und
  // MaiosConsent steht. Achtung: waehrend der Ausfuehrung eines defer-Skripts ist
  // readyState bereits 'interactive', nicht 'loading'. Eine Pruefung auf 'loading'
  // wuerde hier also sofort durchlaufen — wieder zu frueh.
  if (document.readyState === 'complete') wire();
  else document.addEventListener('DOMContentLoaded', wire);
})();

console.log('✅ Geolocation Tracker geladen');
