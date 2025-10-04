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
        };
        
        // Handle high resolution images
        const highResSrc = img.getAttribute('data-highres') || img.src;
        tempImg.src = highResSrc;

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
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
