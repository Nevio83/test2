// Product Image Gallery Functionality

class ProductImageGallery {
    constructor(productId, productName) {
        this.productId = productId;
        this.productName = productName;
        this.currentImageIndex = 0;
        this.images = [];
        this.galleryContainer = null;
        this.mainImage = null;
        this.thumbnailsContainer = null;
        
        // Mapping der Produkt-IDs zu ihren Bildordnern
        this.productImageFolders = {
            10: 'Elektrischer Wasserspender für Schreibtisch bilder',
            11: '350ml Elektrischer Mixer Entsafter bilder',
            17: 'Bluetooth Anti-Lost Finder Wassertropfen bilder',
            26: '4 In 1 Self Cleaning Hair Brush bilder'
        };
        
        this.init();
    }
    
    init() {
        // Prüfe ob dieses Produkt einen Bildordner hat
        if (this.productImageFolders[this.productId]) {
            this.loadProductImages();
            this.createGalleryStructure();
            this.attachEventListeners();
            this.attachColorChangeListener();
        }
    }
    
    loadProductImages() {
        const folderName = this.productImageFolders[this.productId];
        
        // Definiere die Bilder basierend auf der Produkt-ID
        switch(this.productId) {
            case 10: // Elektrischer Wasserspender
                this.images = [
                    {
                        src: `../produkt bilder/Elektrischer Wasserspender für Schreibtisch.jpg`,
                        alt: 'Elektrischer Wasserspender für Schreibtisch - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Elektrischer Wasserspender für Schreibtisch schwarz.jpg`,
                        alt: 'Elektrischer Wasserspender für Schreibtisch - Blau',
                        color: 'Blau'  // Geändert zu Blau, da das die Farboption ist
                    },
                    {
                        src: `../produkt bilder/${folderName}/Elektrischer Wasserspender für Schreibtisch weiß.jpg`,
                        alt: 'Elektrischer Wasserspender für Schreibtisch - Weiß',
                        color: 'Weiß'
                    }
                ];
                break;
                
            case 11: // 350ml Elektrischer Mixer
                this.images = [
                    {
                        src: `../produkt bilder/350ml Elektrischer Mixer Entsafter.jpg`,
                        alt: '350ml Elektrischer Mixer Entsafter - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/350ml Elektrischer Mixer Entsafter Weiß.jpg`,
                        alt: '350ml Elektrischer Mixer Entsafter - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/350ml Elektrischer Mixer Entsafter Rosa.png`,
                        alt: '350ml Elektrischer Mixer Entsafter - Rosa/Pink',
                        color: 'Pink'
                    }
                ];
                break;
                
            case 17: // Bluetooth Anti-Lost Finder
                this.images = [
                    {
                        src: `../produkt bilder/Bluetooth Anti-Lost Finder Wassertropfen.jpg`,
                        alt: 'Bluetooth Anti-Lost Finder - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Bluetooth Anti-Lost Finder Wassertropfen schwarz.png`,
                        alt: 'Bluetooth Anti-Lost Finder - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Bluetooth Anti-Lost Finder Wassertropfen weiß.png`,
                        alt: 'Bluetooth Anti-Lost Finder - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Bluetooth Anti-Lost Finder Wassertropfen grün.png`,
                        alt: 'Bluetooth Anti-Lost Finder - Grün',
                        color: 'Grün'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Bluetooth Anti-Lost Finder Wassertropfen pink.png`,
                        alt: 'Bluetooth Anti-Lost Finder - Pink',
                        color: 'Pink'
                    }
                ];
                break;
                
            case 26: // 4 In 1 Self Cleaning Hair Brush
                this.images = [
                    {
                        src: `../produkt bilder/4 In 1 Self Cleaning Hair Brush.jpg`,
                        alt: '4 In 1 Self Cleaning Hair Brush - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/4 In 1 Self Cleaning Hair Brush roland purple.jpg`,
                        alt: '4 In 1 Self Cleaning Hair Brush - Roland Purple',
                        color: 'Roland Purple'
                    },
                    {
                        src: `../produkt bilder/${folderName}/4 In 1 Self Cleaning Hair Brush lunar rock.jpg`,
                        alt: '4 In 1 Self Cleaning Hair Brush - Lunar Rock',
                        color: 'Lunar Rock'
                    }
                ];
                break;
        }
    }
    
    createGalleryStructure() {
        // Finde das existierende Produktbild
        const existingImage = document.querySelector('.product-image, .main-product-image');
        if (!existingImage) return;
        
        const parentContainer = existingImage.parentElement;
        
        // Erstelle Gallery Container
        this.galleryContainer = document.createElement('div');
        this.galleryContainer.className = 'product-gallery-container';
        
        // Erstelle Hauptbild Container
        const mainImageContainer = document.createElement('div');
        mainImageContainer.className = 'gallery-main-image';
        
        // Bildcounter
        const counter = document.createElement('div');
        counter.className = 'gallery-counter';
        counter.textContent = `1 / ${this.images.length}`;
        mainImageContainer.appendChild(counter);
        
        // Hauptbild
        this.mainImage = document.createElement('img');
        this.mainImage.src = this.images[0].src;
        this.mainImage.alt = this.images[0].alt;
        this.mainImage.className = 'gallery-image main-product-image fade-in';
        mainImageContainer.appendChild(this.mainImage);
        
        // Zoom Hinweis
        const zoomHint = document.createElement('div');
        zoomHint.className = 'zoom-hint';
        zoomHint.textContent = '🔍 Klicken für Vollbild';
        mainImageContainer.appendChild(zoomHint);
        
        // Navigation Buttons
        if (this.images.length > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'gallery-nav prev';
            prevBtn.innerHTML = '‹';
            prevBtn.onclick = () => this.previousImage();
            mainImageContainer.appendChild(prevBtn);
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'gallery-nav next';
            nextBtn.innerHTML = '›';
            nextBtn.onclick = () => this.nextImage();
            mainImageContainer.appendChild(nextBtn);
        }
        
        this.galleryContainer.appendChild(mainImageContainer);
        
        // Erstelle Thumbnails
        if (this.images.length > 1) {
            this.thumbnailsContainer = document.createElement('div');
            this.thumbnailsContainer.className = 'gallery-thumbnails';
            
            this.images.forEach((image, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = 'gallery-thumbnail';
                if (index === 0) thumbnail.classList.add('active');
                
                const thumbImg = document.createElement('img');
                thumbImg.src = image.src;
                thumbImg.alt = image.alt;
                thumbnail.appendChild(thumbImg);
                
                // Farblabel
                if (image.color && image.color !== 'Standard') {
                    const label = document.createElement('div');
                    label.className = 'thumbnail-color-label';
                    label.textContent = image.color;
                    thumbnail.appendChild(label);
                }
                
                thumbnail.onclick = () => this.selectImage(index);
                this.thumbnailsContainer.appendChild(thumbnail);
            });
            
            this.galleryContainer.appendChild(this.thumbnailsContainer);
        }
        
        // Ersetze das alte Bild mit der Gallery
        parentContainer.replaceChild(this.galleryContainer, existingImage);
        
        // Füge Fullscreen-Funktionalität hinzu
        this.attachFullscreenListener();
    }
    
    selectImage(index) {
        if (index < 0 || index >= this.images.length) return;
        
        this.currentImageIndex = index;
        
        // Update Hauptbild mit Fade-Effekt
        this.mainImage.classList.remove('fade-in');
        setTimeout(() => {
            this.mainImage.src = this.images[index].src;
            this.mainImage.alt = this.images[index].alt;
            this.mainImage.classList.add('fade-in');
        }, 50);
        
        // Update Counter
        const counter = this.galleryContainer.querySelector('.gallery-counter');
        if (counter) {
            counter.textContent = `${index + 1} / ${this.images.length}`;
        }
        
        // Update Thumbnails
        const thumbnails = this.thumbnailsContainer?.querySelectorAll('.gallery-thumbnail');
        thumbnails?.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
        
        // Update Navigation Buttons
        this.updateNavigationButtons();
    }
    
    nextImage() {
        const nextIndex = (this.currentImageIndex + 1) % this.images.length;
        this.selectImage(nextIndex);
    }
    
    previousImage() {
        const prevIndex = (this.currentImageIndex - 1 + this.images.length) % this.images.length;
        this.selectImage(prevIndex);
    }
    
    updateNavigationButtons() {
        const prevBtn = this.galleryContainer.querySelector('.gallery-nav.prev');
        const nextBtn = this.galleryContainer.querySelector('.gallery-nav.next');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentImageIndex === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentImageIndex === this.images.length - 1;
        }
    }
    
    attachEventListeners() {
        // Keyboard Navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.previousImage();
            } else if (e.key === 'ArrowRight') {
                this.nextImage();
            }
        });
        
        // Touch/Swipe Support für Mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        this.galleryContainer?.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        this.galleryContainer?.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });
        
        const handleSwipe = () => {
            if (touchEndX < touchStartX - 50) {
                this.nextImage();
            }
            if (touchEndX > touchStartX + 50) {
                this.previousImage();
            }
        };
    }
    
    attachFullscreenListener() {
        // Nutze die existierende Fullscreen-Funktionalität
        if (this.mainImage && window.ProductImageFullscreen) {
            this.mainImage.style.cursor = 'zoom-in';
            this.mainImage.onclick = () => {
                if (window.ProductImageFullscreen) {
                    const fullscreen = new window.ProductImageFullscreen();
                    fullscreen.openModal(this.mainImage);
                }
            };
        }
    }
    
    // Methode zum Wechseln des Bildes basierend auf der Farbauswahl
    switchToColorImage(colorData) {
        let colorName = colorData;
        
        // Wenn colorData ein Objekt ist (von getSelectedColor), extrahiere den Namen
        if (typeof colorData === 'object' && colorData !== null) {
            colorName = colorData.name || colorData.Name || '';
        }
        
        console.log('Gallery: Switching to color:', colorName);
        
        // Normalisiere den Farbnamen für besseren Vergleich
        const normalizedColorName = colorName.toLowerCase().trim();
        
        // Spezielle Mappings für unterschiedliche Namenskonventionen
        const colorMappings = {
            'lunar rock gray': 'lunar rock',
            'lunar rock grey': 'lunar rock',
            'roland purple': 'roland purple',
            'rosa': 'pink',
            'weiss': 'weiß',
            'gruen': 'grün',
            'schwarz': 'schwarz',
            'blau': 'blau'
        };
        
        const mappedColor = colorMappings[normalizedColorName] || normalizedColorName;
        
        // Finde das Bild mit der passenden Farbe
        const colorImageIndex = this.images.findIndex(img => {
            if (!img.color) return false;
            const imgColor = img.color.toLowerCase().trim();
            return imgColor === mappedColor || imgColor === normalizedColorName;
        });
        
        // Wenn ein passendes Bild gefunden wurde, wechsle dazu
        if (colorImageIndex !== -1) {
            console.log('Gallery: Found matching image at index:', colorImageIndex);
            this.selectImage(colorImageIndex);
        } else {
            console.log('Gallery: No matching image found for color:', colorName);
        }
    }
    
    // Listener für Farbänderungen hinzufügen
    attachColorChangeListener() {
        const self = this;
        
        // Warte kurz, bis die ColorSelection Klasse initialisiert ist
        setTimeout(() => {
            console.log('Gallery: Initializing color change listener');
            
            // Überwache die globale getSelectedColor Funktion
            if (typeof window.getSelectedColor === 'function') {
                let lastColor = window.getSelectedColor();
                console.log('Gallery: Initial color:', lastColor);
                
                // Überprüfe regelmäßig auf Farbänderungen
                setInterval(() => {
                    const currentColor = window.getSelectedColor();
                    if (currentColor && currentColor !== lastColor) {
                        console.log('Gallery: Color changed from', lastColor, 'to', currentColor);
                        lastColor = currentColor;
                        self.switchToColorImage(currentColor);
                    }
                }, 200);
            }
            
            // Alternative: Überwache Klicks auf Farb-Divs
            document.addEventListener('click', function(e) {
                // Prüfe ob ein Farbelement geklickt wurde
                const colorOption = e.target.closest('.color-option');
                if (colorOption) {
                    // Extrahiere Farbnamen aus dem Text
                    const colorText = colorOption.querySelector('.color-name')?.textContent || 
                                    colorOption.textContent.trim();
                    
                    console.log('Gallery: Color option clicked:', colorText);
                    
                    // Warte kurz bis die Auswahl verarbeitet wurde
                    setTimeout(() => {
                        if (window.getSelectedColor) {
                            const selectedColor = window.getSelectedColor();
                            console.log('Gallery: Selected color after click:', selectedColor);
                            self.switchToColorImage(selectedColor);
                        }
                    }, 100);
                }
                
                // Prüfe auch auf color-circle Klicks (für andere Produktseiten)
                const colorCircle = e.target.closest('.color-circle');
                if (colorCircle) {
                    // Hole Farbe aus onclick Attribut
                    const onclickStr = colorCircle.getAttribute('onclick') || '';
                    const match = onclickStr.match(/selectColor\([^,]*,\s*'([^']+)'/);
                    if (match) {
                        const colorName = match[1];
                        console.log('Gallery: Color circle clicked:', colorName);
                        
                        setTimeout(() => {
                            self.switchToColorImage(colorName);
                        }, 100);
                    }
                }
            });
            
            // Überwache auch Änderungen am ausgewählten Farb-Text
            const colorDisplay = document.querySelector('.selected-color-name');
            if (colorDisplay) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' || mutation.type === 'characterData') {
                            const colorName = colorDisplay.textContent.replace('Ausgewählte Farbe: ', '').trim();
                            if (colorName) {
                                console.log('Gallery: Color display changed to:', colorName);
                                self.switchToColorImage(colorName);
                            }
                        }
                    });
                });
                
                observer.observe(colorDisplay, { 
                    childList: true, 
                    characterData: true, 
                    subtree: true 
                });
            }
        }, 1000);
    }
}

// Initialisiere Gallery wenn DOM bereit ist
document.addEventListener('DOMContentLoaded', function() {
    // Extrahiere Produkt-ID aus der URL oder Seite
    const urlPath = window.location.pathname;
    const match = urlPath.match(/produkt-(\d+)\.html/);
    
    if (match) {
        const productId = parseInt(match[1]);
        
        // Hole Produktname aus dem Seitentitel oder H1
        const productName = document.querySelector('h1')?.textContent || 
                          document.querySelector('.product-title')?.textContent || 
                          'Produkt';
        
        // Initialisiere Gallery nur für Produkte mit Bildordnern
        if ([10, 11, 17, 26].includes(productId)) {
            new ProductImageGallery(productId, productName);
        }
    }
});

// Export für andere Scripts
window.ProductImageGallery = ProductImageGallery;
