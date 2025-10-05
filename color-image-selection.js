// Image Color Selection - Originale funktionierende Version
console.log('🎨 Image Color Selection wird geladen...');

class ImageColorSelection {
    constructor() {
        this.productId = null;
        this.productData = null;
        this.selectedColor = null;
        this.productImages = {};
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            setTimeout(() => this.initialize(), 100);
        }
    }
    
    async initialize() {
        try {
            // Extrahiere Produkt-ID aus URL
            this.productId = this.extractProductIdFromUrl();
            if (!this.productId) {
                console.error('Keine Produkt-ID gefunden');
                return;
            }
            
            // Lade Produktdaten
            await this.loadProductData();
            
            // Rendere die Farbauswahl UI und markiere erste Farbe (aber behalte Hauptbild)
            if (this.productData.colors && this.productData.colors.length > 0) {
                this.renderColorSelection();
                // Markiere erste Farbe visuell, aber OHNE Bildwechsel
                setTimeout(() => {
                    this.markFirstColorAsSelected();
                }, 100);
            }
            
        } catch (error) {
            console.error('Fehler bei der Initialisierung:', error);
        }
    }
    
    extractProductIdFromUrl() {
        const urlPath = window.location.pathname;
        const match = urlPath.match(/produkt-?(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }
    
    async loadProductData() {
        try {
            const response = await fetch('../products.json');
            const products = await response.json();
            this.productData = products.find(p => p.id === this.productId);
            
            if (!this.productData) {
                throw new Error(`Produkt mit ID ${this.productId} nicht gefunden`);
            }
            
            console.log('✅ Produktdaten geladen:', this.productData);
            
            // Lade farbspezifische Bilder
            this.loadColorImages();
        } catch (error) {
            console.error('Fehler beim Laden der Produktdaten:', error);
            throw error;
        }
    }
    
    loadColorImages() {
        if (!this.productData.colors) return;
        
        this.productData.colors.forEach(color => {
            // Verwende das Bild aus products.json wenn vorhanden
            let colorImagePath = this.productData.image;
            
            if (color.image) {
                // Füge ../ hinzu für Pfade aus products.json (da wir im produkte/ Ordner sind)
                colorImagePath = '../' + color.image;
            }
            
            // Speichere den Bildpfad für diese Farbe
            this.productImages[color.name] = colorImagePath;
            console.log(`📸 Bild für ${color.name}: ${colorImagePath}`);
        });
    }
    
    getColorSpecificImage(colorName) {
        return this.productImages[colorName] || this.productData.image;
    }
    
    getCategoryColor() {
        // Bestimme die Rahmenfarbe basierend auf der Kategorie
        const category = this.productData.category;
        
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
    
    renderColorSelection() {
        // Finde oder erstelle Container
        let container = document.getElementById('colorSelection');
        
        if (!container) {
            container = this.createColorSelectionContainer();
        }
        
        if (!container) {
            console.warn('⚠️ Kein Container für Farbauswahl gefunden');
            return;
        }
        
        const categoryColor = this.getCategoryColor();
        
        // Erstelle HTML für Farbauswahl - RAHMEN NUR UM BILD
        const colorOptionsHtml = this.productData.colors.map(color => {
            const imageUrl = this.getColorSpecificImage(color.name);
            return `
                <div class="color-option" data-color="${color.name}" style="
                    position: relative; 
                    display: inline-flex; 
                    flex-direction: column; 
                    align-items: center; 
                    margin: 0 8px; 
                    cursor: pointer; 
                    transition: all 0.3s ease;
                    background: transparent;
                    min-width: 85px;
                ">
                    <div style="
                        position: relative;
                        border: 3px solid #e0e0e0; 
                        border-radius: 12px; 
                        padding: 3px;
                        background: white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                    ">
                        <img src="${imageUrl}" alt="${color.name}" class="color-option-image" style="
                            width: 75px; 
                            height: 75px; 
                            object-fit: cover; 
                            border-radius: 8px; 
                            display: block;
                        ">
                    </div>
                    <span class="color-name" style="
                        display: block; 
                        text-align: center; 
                        font-size: 14px; 
                        margin-top: 5px;
                        margin-bottom: 3px;
                        color: #333;
                        font-weight: 500;
                    ">${color.name}</span>
                </div>
            `;
        }).join('');
        
        const html = `
            <div class="color-selection-wrapper" style="
                margin: 15px 0; 
                padding: 18px; 
                background: #ffffff; 
                border-radius: 12px; 
                border: 1px solid #e9ecef;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            ">
                <h4 style="
                    font-size: 16px; 
                    margin-bottom: 12px; 
                    color: #333; 
                    font-weight: 600;
                    margin-top: 0;
                ">Farbe wählen:</h4>
                <div class="color-options" style="
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 0; 
                    justify-content: flex-start;
                    align-items: center;
                ">
                    ${colorOptionsHtml}
                </div>
                <div class="selected-color-text" style="
                    margin-top: 12px; 
                    font-size: 14px; 
                    color: ${categoryColor}; 
                    font-weight: 500;
                    padding: 6px 12px;
                    background: ${categoryColor}15;
                    border-radius: 6px;
                    border-left: 3px solid ${categoryColor};
                    display: none;
                "></div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Event Listener hinzufügen
        this.attachColorEventListeners();
        
        console.log('✅ Farbauswahl gerendert');
    }
    
    createColorSelectionContainer() {
        // Suche nach dem Hero-Bereich mit den Produktinfos
        const heroSection = document.querySelector('.product-hero .col-lg-6:first-child');
        
        if (heroSection) {
            const container = document.createElement('div');
            container.id = 'colorSelection';
            
            // Finde die Stelle nach dem Lead-Text und vor den Buttons
            const leadText = heroSection.querySelector('.lead');
            const buttonsContainer = heroSection.querySelector('.d-flex.align-items-center.gap-3');
            
            if (leadText && buttonsContainer) {
                // Füge zwischen Lead-Text und Buttons ein
                leadText.parentNode.insertBefore(container, buttonsContainer);
            } else if (buttonsContainer) {
                // Füge vor den Buttons ein
                heroSection.insertBefore(container, buttonsContainer);
            } else {
                // Füge am Ende des Hero-Bereichs ein
                heroSection.appendChild(container);
            }
            
            return container;
        }
        
        // Fallback auf alte Methode
        const parent = document.querySelector('.product-hero .container .row .col-lg-6') || 
                      document.querySelector('main') || 
                      document.body;
        
        if (parent) {
            const container = document.createElement('div');
            container.id = 'colorSelection';
            parent.appendChild(container);
            return container;
        }
        
        return null;
    }
    
    markFirstColorAsSelected() {
        // Markiere erste Farbe visuell OHNE Bildwechsel
        const firstColor = this.productData.colors[0];
        this.selectedColor = firstColor;
        const categoryColor = this.getCategoryColor();
        
        const firstOption = document.querySelector('.color-option');
        if (firstOption) {
            firstOption.classList.add('selected');
            const imageContainer = firstOption.querySelector('div');
            if (imageContainer) {
                imageContainer.style.borderColor = categoryColor;
                imageContainer.style.boxShadow = `0 4px 12px ${categoryColor}40`;
            }
            
            // KEIN Checkmark - nur kategorie-spezifischer Rahmen
        }
        
        // Zeige ausgewählte Farbe Text
        const selectedColorText = document.querySelector('.selected-color-text');
        if (selectedColorText) {
            selectedColorText.textContent = `Ausgewählte Farbe: ${firstColor.name}`;
            selectedColorText.style.display = 'block';
        }
    }
    
    attachColorEventListeners() {
        const categoryColor = this.getCategoryColor();
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            // Hover-Effekte - nur für Bildrahmen mit Kategorie-Farbe
            option.addEventListener('mouseenter', (e) => {
                if (!e.currentTarget.classList.contains('selected')) {
                    const imgContainer = e.currentTarget.querySelector('div');
                    if (imgContainer) {
                        imgContainer.style.borderColor = categoryColor;
                        imgContainer.style.boxShadow = `0 4px 12px ${categoryColor}20`;
                    }
                }
            });
            
            option.addEventListener('mouseleave', (e) => {
                if (!e.currentTarget.classList.contains('selected')) {
                    const imgContainer = e.currentTarget.querySelector('div');
                    if (imgContainer) {
                        imgContainer.style.borderColor = '#e0e0e0';
                        imgContainer.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                    }
                }
            });
            
            // Klick-Event
            option.addEventListener('click', (e) => {
                const colorName = e.currentTarget.getAttribute('data-color');
                const color = this.productData.colors.find(c => c.name === colorName);
                if (color) {
                    this.selectColor(color);
                }
            });
        });
    }
    
    selectColor(color) {
        this.selectedColor = color;
        const categoryColor = this.getCategoryColor();
        
        // Update angezeigter Farbname
        const selectedColorText = document.querySelector('.selected-color-text');
        if (selectedColorText) {
            selectedColorText.textContent = `Ausgewählte Farbe: ${color.name}`;
            selectedColorText.style.display = 'block';
        }
        
        // Update Hauptbild
        this.updateMainImage(color);
        
        // Update Preis
        this.updatePrice(color);
        
        // Update ausgewählte Option visuell - NUR RAHMEN UM BILD
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
            const imgContainer = opt.querySelector('div');
            if (imgContainer) {
                imgContainer.style.borderColor = '#e0e0e0';
                imgContainer.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
            }
        });
        
        // Markiere ausgewählte Farbe - NUR RAHMEN UM BILD mit Kategorie-Farbe
        const selectedOption = document.querySelector(`[data-color="${color.name}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
            const imgContainer = selectedOption.querySelector('div');
            if (imgContainer) {
                imgContainer.style.borderColor = categoryColor;
                imgContainer.style.boxShadow = `0 4px 12px ${categoryColor}40`;
            }
            
            // KEIN Checkmark - nur blauer Rahmen um das Bild
        }
        
    }
    
    updateMainImage(color) {
        // Nur das Hauptproduktbild ändern, nicht alle Bilder
        const mainProductImage = document.querySelector('.product-gallery img, .hero-image img, .main-product-image');
        const newImageUrl = this.getColorSpecificImage(color.name);
        
        if (mainProductImage) {
            mainProductImage.src = newImageUrl;
        } else {
            // Fallback: Suche nach dem ersten großen Bild
            const allImages = document.querySelectorAll('img');
            allImages.forEach(img => {
                // Nur Bilder ändern die größer als 200px sind (Hauptbilder)
                if (img.naturalWidth > 200 && (img.src.includes('350ml') || img.src.includes('Mixer'))) {
                    img.src = newImageUrl;
                }
            });
        }
    }
    
    updatePrice(color) {
        if (color.price !== this.productData.price) {
            const priceElements = document.querySelectorAll('.price-tag, .product-price');
            priceElements.forEach(el => {
                el.textContent = `€${color.price.toFixed(2)}`;
            });
        }
    }
}

// Globale Funktionen
window.getSelectedColor = function() {
    return window.imageColorSelection ? window.imageColorSelection.selectedColor : null;
};

// Initialisiere die Farbauswahl
window.imageColorSelection = new ImageColorSelection();

console.log('✅ Image Color Selection geladen');
