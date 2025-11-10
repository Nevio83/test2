// ============================================
// PRODUCT GALLERY COMPLETE - Kombinierte Galerie & Fullscreen
// Vereint product-image-gallery.js und product-image-fullscreen.js
// ============================================

// ============================================
// TEIL 1: PRODUCT IMAGE GALLERY
// ============================================

class ProductImageGallery {
    constructor(productId, productName) {
        // Singleton Pattern für jede Produkt-ID
        if (window.galleryInstance && window.galleryInstance.productId === productId) {
            return window.galleryInstance;
        }
        
        this.productId = productId;
        this.productName = productName;
        this.currentImageIndex = 0;
        this.galleryContainer = null;
        this.mainImage = null;
        this.thumbnailsContainer = null;
        
        // Mapping der Produkte-IDs zu ihren Bildordnern
        const productImageFolders = {
            10: 'Elektrischer Wasserspender für Schreibtisch bilder',
            11: '350ml Elektrischer Mixer Entsafter bilder',
            17: 'Bluetooth Anti-Lost Finder Wassertropfen bilder',
            21: 'Led crystal lampe bilder',
            26: '4 In 1 Self Cleaning Hair Brush bilder',
            27: 'Volcanic Flame Aroma Essential Oil Diffuser bilder',
            32: 'Indoor Sensing Wall Lamp bilder',
            41: '2 In 1 Oil Sprayer Bottle bilder',
            42: 'Aroma Öl Diffusor bilder',
            43: 'Mini Thermal Drucker bilder',
            44: 'Smart Beamer bilder',
            45: 'Klimaanlage mit Displaybilder',
            46: 'Nordic Crystal Lamp bilder',
            47: 'Tumbler Becher bilder'
        };
        
        this.init();
        
        // Speichere Instanz global
        window.galleryInstance = this;
    }
    
    init() {
        // Mapping der Produkte-IDs zu ihren Bildordnern
        this.productImageFolders = {
            10: 'Elektrischer Wasserspender für Schreibtisch bilder',
            11: '350ml Elektrischer Mixer Entsafter bilder',
            17: 'Bluetooth Anti-Lost Finder Wassertropfen bilder',
            21: 'Led crystal lampe bilder',
            26: '4 In 1 Self Cleaning Hair Brush bilder',
            32: 'Indoor Sensing Wall Lamp bilder',
            33: 'Aromatherapy essential oil humidifier bilder',
            34: 'Gesichtssauna bilder',
            35: 'Thermische Massage bilder',
            38: 'Jade Massager bilder',
            40: 'Mug Warmer Pad bilder',
            42: 'Aroma Öl Diffusor bilder',
            43: 'Mini Thermal Drucker bilder',
            44: 'Smart Beamer bilder',
            45: 'Klimaanlage mit Displaybilder',
            46: 'Nordic Crystal Lamp bilder',
            47: 'Tumbler Becher bilder',
            48: 'Tumbler becher winter bilder',
            49: '40 Oz Tumbler With Handle Straw Insulated Halloween bilder',
            50: 'Krystall Ball Nachtlampe bilder'
        };
        
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
                        alt: 'Elektrischer Wasserspender für Schreibtisch - Schwarz',
                        color: 'Schwarz'
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
                    },
                    {
                        src: `../produkt bilder/${folderName}/350ml Elektrischer Mixer Entsafter Blau.jpg`,
                        alt: '350ml Elektrischer Mixer Entsafter - Blau',
                        color: 'Blau'
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
                    },
                    {
                        src: `../produkt bilder/${folderName}/Bluetooth Anti-Lost Finder Wassertropfen gold.jpg`,
                        alt: 'Bluetooth Anti-Lost Finder - Gold',
                        color: 'Gold'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Bluetooth Anti-Lost Finder Wassertropfen Silber.jpg`,
                        alt: 'Bluetooth Anti-Lost Finder - Silber',
                        color: 'Silber'
                    }
                ];
                break;
                
            case 21: // Led crystal lampe
                this.images = [
                    {
                        src: `../produkt bilder/Led crystal lampe .jpg`,
                        alt: 'Led crystal lampe - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/Led crystal lampe  bilder/Led crystal Krone .png`,
                        alt: 'Led crystal lampe - Krone',
                        color: 'Krone'
                    },
                    {
                        src: `../produkt bilder/Led crystal lampe  bilder/Led Crystal Holz boden.png`,
                        alt: 'Led crystal lampe - Holz boden',
                        color: 'Holz boden'
                    },
                    {
                        src: `../produkt bilder/Led crystal lampe  bilder/Led crystal Krone anleitung.png`,
                        alt: 'Led crystal lampe - Krone Anleitung',
                        color: 'Krone Anleitung'
                    },
                    {
                        src: `../produkt bilder/Led crystal lampe  bilder/Led Crystal Holz boden anleitung.png`,
                        alt: 'Led crystal lampe - Holz boden Anleitung',
                        color: 'Holz boden Anleitung'
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
                
            case 32: // Indoor Sensing Wall Lamp
                this.images = [
                    {
                        src: `../produkt bilder/Indoor Sensing Wall Lamp.jpg`,
                        alt: 'Indoor Sensing Wall Lamp - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Indoor Sensing Wall Lamp schwarz.jpg`,
                        alt: 'Indoor Sensing Wall Lamp - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Indoor Sensing Wall Lamp weiß.jpg`,
                        alt: 'Indoor Sensing Wall Lamp - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Indoor Sensing Wall Lamp anleitung.jpg`,
                        alt: 'Indoor Sensing Wall Lamp - Anleitung',
                        color: 'Anleitung'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Indoor Sensing Wall Lamp level.jpg`,
                        alt: 'Indoor Sensing Wall Lamp - Level',
                        color: 'Level'
                    }
                ];
                break;
                
            case 50: // Krystall Ball Nachtlampe
                const folderName50 = 'Krystall Ball Nachtlampe bilder';
                this.images = [
                    {
                        src: `../produkt bilder/Krystall Ball Nachtlampe.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Krystall Ball Mond.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Mond',
                        color: 'Mond'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Riesenrad.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Riesenrad',
                        color: 'Riesenrad'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Wassermolch.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Wassermolch',
                        color: 'Wassermolch'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Saturn.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Saturn',
                        color: 'Saturn'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Segelboot.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Segelboot',
                        color: 'Segelboot'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Schneemann.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Schneemann',
                        color: 'Schneemann'
                    },
                    {
                        src: `../produkt bilder/${folderName50}/Sternenhimmel.jpg`,
                        alt: 'Krystall Ball Nachtlampe - Sternenhimmel',
                        color: 'Sternenhimmel'
                    }
                ];
                break;
                
            case 33: // Aromatherapy Essential Oil Humidifier
                this.images = [
                    {
                        src: `../produkt bilder/Aromatherapy essential oil humidifier.jpg`,
                        alt: 'Aromatherapy Humidifier - Hauptansicht',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier Cherry blossoms.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Kirschblüte',
                        color: 'Cherry Blossoms'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier green tea.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Grüner Tee',
                        color: 'Green Tea'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier jasmine.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Jasmin',
                        color: 'Jasmine'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier lavender.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Lavendel',
                        color: 'Lavender'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier lemon.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Zitrone',
                        color: 'Lemon'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier lily.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Lilie',
                        color: 'Lily'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier ocean.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Ozean',
                        color: 'Ocean'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier rose.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Rose',
                        color: 'Rose'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier sandalwood.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Sandelholz',
                        color: 'Sandalwood'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier sweet.jpg`,
                        alt: 'Aromatherapy Humidifier - Süßlicher Duft',
                        color: 'Sweet'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier vanilla.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Vanille',
                        color: 'Vanilla'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aromatherapy essential oil humidifier violet.jpg`,
                        alt: 'Aromatherapy Humidifier - Duftrichtung Veilchen',
                        color: 'Violet'
                    }
                ];
                break;

            case 34: // Gesichtssauna
                this.images = [
                    {
                        src: `../produkt bilder/Gesichtssauna.jpg`,
                        alt: 'Gesichtssauna - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Gesichtssauna blau.jpg`,
                        alt: 'Gesichtssauna - Blau',
                        color: 'Blau'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Gesichtssauna weiß.jpg`,
                        alt: 'Gesichtssauna - Weiß',
                        color: 'Weiß'
                    }
                ];
                break;

            case 35: // Thermische Massage
                this.images = [
                    {
                        src: `../produkt bilder/Thermische Massage.jpg`,
                        alt: 'Thermische Massage - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Thermische Massage schwarz.jpg`,
                        alt: 'Thermische Massage - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Thermische Massage weiß.jpg`,
                        alt: 'Thermische Massage - Weiß',
                        color: 'Weiß'
                    }
                ];
                break;

            case 38: // Jade Massager
                this.images = [
                    {
                        src: `../produkt bilder/Jade Massager.jpg`,
                        alt: 'Jade Massager - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager schwarz.jpg`,
                        alt: 'Jade Massager - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager grün.jpg`,
                        alt: 'Jade Massager - Grün',
                        color: 'Grün'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager hell grün.jpg`,
                        alt: 'Jade Massager - Hellgrün',
                        color: 'Hellgrün'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager pink.jpg`,
                        alt: 'Jade Massager - Pink',
                        color: 'Pink'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager lila.jpg`,
                        alt: 'Jade Massager - Lila',
                        color: 'Lila'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager weiß.jpg`,
                        alt: 'Jade Massager - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Jade Massager gelb.jpg`,
                        alt: 'Jade Massager - Gelb',
                        color: 'Gelb'
                    }
                ];
                break;

            case 40: // Mug Warmer Pad
                this.images = [
                    {
                        src: `../produkt bilder/Mug Warmer Pad.jpg`,
                        alt: 'Mug Warmer Pad - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mug Warmer Pad pink.jpg`,
                        alt: 'Mug Warmer Pad - Pink',
                        color: 'Pink'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mug Warmer Pad grün.jpg`,
                        alt: 'Mug Warmer Pad - Grün',
                        color: 'Grün'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mug Warmer Pad weiß.jpg`,
                        alt: 'Mug Warmer Pad - Weiß',
                        color: 'Weiß'
                    }
                ];
                break;

            case 41: // 2 In 1 Oil Sprayer Bottle
                this.images = [
                    {
                        src: `../produkt bilder/2 In 1 Oil Sprayer Bottle.jpg`,
                        alt: '2 In 1 Oil Sprayer Bottle - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/2 In 1 Oil Sprayer Bottle.jpg`,
                        alt: '2 In 1 Oil Sprayer Bottle - Detailansicht',
                        color: 'Detail'
                    },
                    {
                        src: `../produkt bilder/${folderName}/2 In 1 Oil Sprayer Bottle maße.jpg`,
                        alt: '2 In 1 Oil Sprayer Bottle - Maße',
                        color: 'Maße'
                    }
                ];
                break;

            case 42: // Aroma Öl Diffusor
                this.images = [
                    {
                        src: `../produkt bilder/Aroma Öl Diffusor.jpg`,
                        alt: 'Aroma Öl Diffusor - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aroma Öl Diffusor schwarz.jpg`,
                        alt: 'Aroma Öl Diffusor - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aroma Öl Diffusor weiß.jpg`,
                        alt: 'Aroma Öl Diffusor - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aroma Öl Diffusor schwarz an.jpg`,
                        alt: 'Aroma Öl Diffusor - Schwarz An',
                        color: 'Schwarz An'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aroma Öl Diffusor weiß an.jpg`,
                        alt: 'Aroma Öl Diffusor - Weiß An',
                        color: 'Weiß An'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Aroma Öl Diffusor ansicht.jpg`,
                        alt: 'Aroma Öl Diffusor - Ansicht',
                        color: 'Ansicht'
                    }
                ];
                break;
                
            case 43: // Mini Thermal Drucker
                this.images = [
                    {
                        src: `../produkt bilder/Mini Thermal Drucker.jpg`,
                        alt: 'Mini Thermal Drucker - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker grün.jpg`,
                        alt: 'Mini Thermal Drucker - Grün',
                        color: 'Grün'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker blau.jpg`,
                        alt: 'Mini Thermal Drucker - Blau',
                        color: 'Blau'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker pink.jpg`,
                        alt: 'Mini Thermal Drucker - Pink',
                        color: 'Pink'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker gelb.jpg`,
                        alt: 'Mini Thermal Drucker - Gelb',
                        color: 'Gelb'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker weiß.jpg`,
                        alt: 'Mini Thermal Drucker - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker rollen A.jpg`,
                        alt: 'Mini Thermal Drucker - Style A Rollen',
                        color: 'Style A Rollen'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker rollen B.jpg`,
                        alt: 'Mini Thermal Drucker - Style B Rollen',
                        color: 'Style B Rollen'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Mini Thermal Drucker rollen C.jpg`,
                        alt: 'Mini Thermal Drucker - Style C Rollen',
                        color: 'Style C Rollen'
                    }
                ];
                break;
                
            case 44: // Smart Beamer
                this.images = [
                    {
                        src: `../produkt bilder/Smart Beamer.jpg`,
                        alt: 'Smart Beamer - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Smart Beamer weiß.jpg`,
                        alt: 'Smart Beamer - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Smart Beamer silber.jpg`,
                        alt: 'Smart Beamer - Silber',
                        color: 'Silber'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Smart Beamer auflösung.jpg`,
                        alt: 'Smart Beamer - Auflösung',
                        color: 'Auflösung'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Smart Beamer anschlüsse.jpg`,
                        alt: 'Smart Beamer - Anschlüsse',
                        color: 'Anschlüsse'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Smart Beamer.jpg`,
                        alt: 'Smart Beamer - Detailansicht',
                        color: 'Detail'
                    }
                ];
                break;
                
            case 45: // Klimaanlage mit Display
                this.images = [
                    {
                        src: `../produkt bilder/Klimaanlage mit Display.jpg`,
                        alt: 'Klimaanlage mit Display - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Klimaanlage mit Display funktion.jpg`,
                        alt: 'Klimaanlage mit Display - Funktion',
                        color: 'Funktion'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Klimaanlage mit Display.jpg`,
                        alt: 'Klimaanlage mit Display - Detail',
                        color: 'Detail'
                    }
                ];
                break;
                
            case 46: // Nordic Crystal Lamp
                this.images = [
                    {
                        src: `../produkt bilder/Nordic Crystal Lamp.jpg`,
                        alt: 'Nordic Crystal Lamp - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Nordic Crystal Lamp schwarz.jpg`,
                        alt: 'Nordic Crystal Lamp - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Nordic Crystal Lamp weiß.jpg`,
                        alt: 'Nordic Crystal Lamp - Weiß',
                        color: 'Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Nordic Crystal Lamp gelb.jpg`,
                        alt: 'Nordic Crystal Lamp - Gelb',
                        color: 'Gelb'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Nordic Crystal Lamp beispiel.jpg`,
                        alt: 'Nordic Crystal Lamp - Beispiel',
                        color: 'Beispiel'
                    }
                ];
                break;
                
            case 47: // Tumbler Becher
                this.images = [
                    {
                        src: `../produkt bilder/Tumbler Becher.jpg`,
                        alt: 'Tumbler Becher - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher schwarz.jpg`,
                        alt: '40 Oz Tumbler - Schwarz',
                        color: 'Schwarz'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher cream white.jpg`,
                        alt: '40 Oz Tumbler - Cream Weiß',
                        color: 'Cream Weiß'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher hell blau.jpg`,
                        alt: '40 Oz Tumbler - Hell Blau',
                        color: 'Hell Blau'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher bay leaves.jpg`,
                        alt: '40 Oz Tumbler - Bay Leaves',
                        color: 'Bay Leaves'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher red rust.jpg`,
                        alt: '40 Oz Tumbler - Red Rust',
                        color: 'Red Rust'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher pink love b.jpg`,
                        alt: '40 Oz Tumbler - Pink Love B',
                        color: 'Pink Love B'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher peony color.jpg`,
                        alt: '40 Oz Tumbler - Peony Color',
                        color: 'Peony Color'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher hell lila.jpg`,
                        alt: '40 Oz Tumbler - Hell Lila',
                        color: 'Hell Lila'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher storm sea.jpg`,
                        alt: '40 Oz Tumbler - Storm Sea',
                        color: 'Storm Sea'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher Strohalm.jpg`,
                        alt: '40 Oz Tumbler - Straw',
                        color: 'Strohalm'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler Becher thermal sublimation.jpg`,
                        alt: '40 Oz Tumbler - Thermal Sublimation',
                        color: 'Thermal Sublimation'
                    }
                ];
                break;
                
            case 48: // Tumbler Becher Winter
                this.images = [
                    {
                        src: `../produkt bilder/Tumbler becher winter.jpg`,
                        alt: 'Tumbler Becher Winter - Hauptbild',
                        color: 'Standard'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler becher merry christmas.jpg`,
                        alt: 'Tumbler Becher Winter - Merry Christmas',
                        color: 'Merry Christmas'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler becher Weihnachtszauber.jpg`,
                        alt: 'Tumbler Becher Winter - Weihnachtszauber',
                        color: 'Weihnachtszauber'
                    },
                    {
                        src: `../produkt bilder/${folderName}/Tumbler becher winter Strohalm.jpg`,
                        alt: 'Tumbler Becher Winter - Strohalm',
                        color: 'Strohalm'
                    }
                ];
                break;
        }
    }
    
    createGalleryStructure() {
        // Finde das existierende Produktbild
        console.log('Suche nach existierendem Produktbild...');
        const existingImage = document.querySelector('.product-image, .main-product-image');
        console.log('Gefundenes Bild:', existingImage);
        console.log('Alle Bilder auf der Seite:', document.querySelectorAll('img'));
        if (!existingImage) {
            console.error('Kein existierendes Produktbild gefunden!');
            return;
        }
        
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
        
        // Entferne die Begrenzung - Buttons sind immer aktiviert für endlose Navigation
        if (prevBtn) {
            prevBtn.disabled = false;
        }
        if (nextBtn) {
            nextBtn.disabled = false;
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

// ============================================
// TEIL 2: PRODUCT IMAGE FULLSCREEN
// ============================================

class ProductImageFullscreen {
    constructor() {
        // Singleton Pattern - nur eine Instanz erlauben
        if (window.fullscreenInstance) {
            return window.fullscreenInstance;
        }
        
        this.modal = null;
        this.modalImg = null;
        this.captionText = null;
        this.galleryKeyHandler = null;
        this.init();
        
        // Speichere Instanz global
        window.fullscreenInstance = this;
    }

    init() {
        // Create modal structure
        this.createModal();

        // Add click listeners to all product images
        this.attachImageListeners();
        
        // Add keyboard navigation
        this.attachKeyboardListeners();
    }

    createModal() {
        // Check if modal already exists
        if (document.getElementById('imageFullscreenModal')) {
            this.modal = document.getElementById('imageFullscreenModal');
            this.modalImg = document.getElementById('fullscreenImage');
            this.captionText = document.getElementById('fullscreenCaption');
            return;
        }

        // Create modal HTML
        const modalHTML = `
            <div id="imageFullscreenModal" class="image-fullscreen-modal">
                <span class="fullscreen-close">&times;</span>
                <div class="image-loading" id="imageLoading" style="display: none;">
                    <div class="spinner"></div>
                    <p>Lädt...</p>
                </div>
                <img class="fullscreen-image-content" id="fullscreenImage">
                <div class="fullscreen-caption" id="fullscreenCaption"></div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get references
        this.modal = document.getElementById('imageFullscreenModal');
        this.modalImg = document.getElementById('fullscreenImage');
        this.captionText = document.getElementById('fullscreenCaption');

        // Add event listeners to modal controls
        this.attachModalControls();
    }

    attachModalControls() {
        // Close button
        const closeBtn = this.modal.querySelector('.fullscreen-close');
        closeBtn.onclick = () => this.closeModal();

        // Click outside image to close
        this.modal.onclick = (e) => {
            if (e.target === this.modal || e.target === this.modalImg) {
                this.closeModal();
            }
        };
    }

    attachImageListeners() {
        // Main product images
        const mainImages = document.querySelectorAll('.main-product-image, .product-image[style*="max-height: 500px"], .product-image[style*="max-height: 400px"], .product-image[style*="max-height: 350px"]');
        mainImages.forEach(img => {
            img.style.cursor = 'zoom-in';
            img.classList.add('main-product-image');
            img.onclick = () => this.openModal(img);
        });

        // Color variant images if they exist
        const colorImages = document.querySelectorAll('.color-image-preview');
        colorImages.forEach(img => {
            img.style.cursor = 'zoom-in';
            img.onclick = () => this.openModal(img);
        });
    }

    attachKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.modal && this.modal.style.display === 'block') {
                if (e.key === 'Escape') {
                    this.closeModal();
                }
            }
        });
    }

    openModal(img) {
        // Show loading spinner
        const loadingDiv = document.getElementById('imageLoading');
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
        }

        // Show modal
        this.modal.style.display = 'block';
        
        // Create new image to load
        const tempImg = new Image();
        tempImg.onload = () => {
            // Hide loading spinner
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            
            // Set image source
            this.modalImg.src = tempImg.src;
            
            // Set caption
            this.captionText.innerHTML = img.alt || 'Produktbild';
            
            // Add animation class
            this.modalImg.classList.add('fullscreen-image-content');
            
            // Setup gallery navigation if available
            this.setupGalleryNavigation(img);
        };
        
        // Handle high resolution images
        const highResSrc = img.getAttribute('data-highres') || img.src;
        tempImg.src = highResSrc;

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
    
    setupGalleryNavigation(currentImg) {
        // WICHTIG: Erst alle alten Navigations-Elemente entfernen
        const existingNavs = document.querySelectorAll('.fullscreen-nav-btn, .fullscreen-counter');
        existingNavs.forEach(el => el.remove());
        
        // Check if ProductImageGallery exists
        const urlPath = window.location.pathname;
        const match = urlPath.match(/produkt-(\d+)\.html/);
        if (!match) return;
        
        const productId = parseInt(match[1]);
        
        // Get gallery images if available
        let galleryImages = [];
        
        // Try to get images from existing ProductImageGallery instance
        if (window.galleryInstance && window.galleryInstance.images) {
            galleryImages = window.galleryInstance.images;
        } else if (window.ProductImageGallery) {
            // Fallback: Lade Bilder direkt ohne neue Instanz zu erstellen
            const tempGallery = Object.create(ProductImageGallery.prototype);
            tempGallery.productId = productId;
            tempGallery.images = [];
            tempGallery.productImageFolders = {
                10: 'Elektrischer Wasserspender für Schreibtisch bilder',
                11: '350ml Elektrischer Mixer Entsafter bilder',
                17: 'Bluetooth Anti-Lost Finder Wassertropfen bilder',
                21: 'Led crystal lampe bilder',
                26: '4 In 1 Self Cleaning Hair Brush bilder',
                32: 'Indoor Sensing Wall Lamp bilder',
                42: 'Aroma Öl Diffusor bilder',
                47: 'Tumbler Becher bilder',
                48: 'Tumbler becher winter bilder',
                49: '40 Oz Tumbler With Handle Straw Insulated Halloween bilder'
            };
            
            if (tempGallery.productImageFolders[productId]) {
                tempGallery.loadProductImages();
                galleryImages = tempGallery.images;
            }
        }
        
        // If no gallery images, try to find all product images on page
        if (galleryImages.length === 0) {
            const allImages = document.querySelectorAll('.gallery-image, .main-product-image, .gallery-thumbnail img');
            if (allImages.length > 1) {
                galleryImages = Array.from(allImages).map(img => ({
                    src: img.src,
                    alt: img.alt || 'Produktbild'
                }));
            }
        }
        
        if (galleryImages.length <= 1) return; // No navigation needed
        
        // Find current image index
        let currentIndex = galleryImages.findIndex(img => 
            img.src === currentImg.src || 
            currentImg.src.includes(img.src.split('/').pop())
        );
        
        if (currentIndex === -1) currentIndex = 0;
        
        // Create navigation buttons
        const prevBtn = document.createElement('button');
        prevBtn.className = 'fullscreen-nav-btn fullscreen-nav-prev';
        prevBtn.innerHTML = '‹';
        prevBtn.setAttribute('aria-label', 'Vorheriges Bild');
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'fullscreen-nav-btn fullscreen-nav-next';
        nextBtn.innerHTML = '›';
        nextBtn.setAttribute('aria-label', 'Nächstes Bild');
        
        // Create counter
        const counter = document.createElement('div');
        counter.className = 'fullscreen-counter';
        counter.textContent = `${currentIndex + 1} / ${galleryImages.length}`;
        
        // Navigation function
        const navigateImage = (direction) => {
            if (direction === 'next') {
                currentIndex = (currentIndex + 1) % galleryImages.length;
            } else {
                currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
            }
            
            this.modalImg.src = galleryImages[currentIndex].src;
            this.captionText.innerHTML = galleryImages[currentIndex].alt;
            counter.textContent = `${currentIndex + 1} / ${galleryImages.length}`;
        };
        
        // Add event listeners
        prevBtn.onclick = () => navigateImage('prev');
        nextBtn.onclick = () => navigateImage('next');
        
        // Add keyboard navigation
        const keyHandler = (e) => {
            if (this.modal.style.display !== 'block') return;
            if (e.key === 'ArrowLeft') navigateImage('prev');
            if (e.key === 'ArrowRight') navigateImage('next');
        };
        
        // Remove old handler if exists
        if (this.galleryKeyHandler) {
            document.removeEventListener('keydown', this.galleryKeyHandler);
        }
        this.galleryKeyHandler = keyHandler;
        document.addEventListener('keydown', keyHandler);
        
        // Add elements to body (not modal) with higher z-index
        document.body.appendChild(prevBtn);
        document.body.appendChild(nextBtn);
        document.body.appendChild(counter);
    }

    closeModal() {
        // Entferne alle Navigations-Elemente beim Schließen
        const navElements = document.querySelectorAll('.fullscreen-nav-btn, .fullscreen-counter');
        navElements.forEach(el => el.remove());
        
        // Entferne Event-Handler
        if (this.galleryKeyHandler) {
            document.removeEventListener('keydown', this.galleryKeyHandler);
            this.galleryKeyHandler = null;
        }
        
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ============================================
// INITIALISIERUNG
// ============================================

// Initialisiere Gallery wenn DOM bereit ist
document.addEventListener('DOMContentLoaded', function() {
    // Extrahiere Produkt-ID aus der URL oder Seite
    const urlPath = window.location.pathname;
    const match = urlPath.match(/produkt-(\d+)\.html/);
    
    if (match) {
        const productId = parseInt(match[1]);
        
        const productName = document.querySelector('h1')?.textContent || 
                          document.querySelector('.product-title')?.textContent || 
                          'Produkt';
        
        // Initialisiere Gallery nur für Produkte mit Bildordnern
        if ([10, 11, 17, 21, 26, 32, 33, 43, 50].includes(productId)) {
            new ProductImageGallery(productId, productName);
        }
    }
    
    // Initialisiere Fullscreen immer
    new ProductImageFullscreen();
});

// Export für andere Scripts
window.ProductImageGallery = ProductImageGallery;
window.ProductImageFullscreen = ProductImageFullscreen;

console.log('✅ Product Gallery Complete geladen');
