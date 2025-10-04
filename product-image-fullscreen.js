// Product Image Fullscreen Functionality - Simplified Version

class ProductImageFullscreen {
    constructor() {
        this.modal = null;
        this.modalImg = null;
        this.captionText = null;
        this.init();
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

        // Create modal HTML - ohne Zoom-Buttons
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
        // Main product images (now 400px and 500px for compatibility)
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
        // Check if ProductImageGallery exists
        const urlPath = window.location.pathname;
        const match = urlPath.match(/produkt-(\d+)\.html/);
        if (!match) return;
        
        const productId = parseInt(match[1]);
        
        // Get gallery images if available
        let galleryImages = [];
        
        // Try to get images from ProductImageGallery instance
        if (window.ProductImageGallery) {
            const gallery = new window.ProductImageGallery(productId, '');
            if (gallery.images && gallery.images.length > 0) {
                galleryImages = gallery.images;
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
        
        // Remove old navigation if exists
        const oldNav = this.modal.querySelectorAll('.fullscreen-nav-btn, .fullscreen-counter');
        oldNav.forEach(el => el.remove());
        
        // Create navigation buttons
        const prevBtn = document.createElement('button');
        prevBtn.className = 'fullscreen-nav-btn fullscreen-nav-prev';
        prevBtn.innerHTML = '‹';
        prevBtn.style.cssText = `
            position: absolute;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            background: rgba(0,0,0,0.5);
            color: white;
            border: 2px solid white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            font-size: 30px;
            cursor: pointer;
            z-index: 100002;
            transition: all 0.3s;
        `;
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'fullscreen-nav-btn fullscreen-nav-next';
        nextBtn.innerHTML = '›';
        nextBtn.style.cssText = prevBtn.style.cssText;
        nextBtn.style.left = 'auto';
        nextBtn.style.right = '20px';
        
        // Create counter
        const counter = document.createElement('div');
        counter.className = 'fullscreen-counter';
        counter.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 100002;
        `;
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
        
        // Add elements to modal
        this.modal.appendChild(prevBtn);
        this.modal.appendChild(nextBtn);
        this.modal.appendChild(counter);
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ProductImageFullscreen();
    });
} else {
    // DOM is already loaded
    new ProductImageFullscreen();
}

// Export for use in other scripts if needed
window.ProductImageFullscreen = ProductImageFullscreen;
