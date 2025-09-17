// Lazy Loading Implementation
class LazyLoader {
    constructor() {
        this.imageObserver = null;
        this.init();
    }

    init() {
        // Check if Intersection Observer is supported
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        this.loadImage(img);
                        observer.unobserve(img);
                    }
                });
            }, {
                // Load images when they are 100px away from viewport
                rootMargin: '100px 0px',
                threshold: 0.01
            });
            
            this.observeImages();
        } else {
            // Fallback for older browsers
            this.loadAllImages();
        }
    }

    observeImages() {
        const lazyImages = document.querySelectorAll('img.lazy-load');
        lazyImages.forEach(img => {
            this.imageObserver.observe(img);
        });
    }

    loadImage(img) {
        const src = img.getAttribute('data-src');
        if (src) {
            // Create a new image to preload
            const imageLoader = new Image();
            
            imageLoader.onload = () => {
                // Image loaded successfully, update src
                img.src = src;
                img.classList.remove('lazy-load');
                img.classList.add('lazy-loaded');
                
                // Add fade-in effect
                img.style.opacity = '0';
                img.style.transition = 'opacity 0.3s ease-in-out';
                
                // Trigger fade-in
                requestAnimationFrame(() => {
                    img.style.opacity = '1';
                });
            };
            
            imageLoader.onerror = () => {
                // If image fails to load, remove lazy-load class and show placeholder
                img.classList.remove('lazy-load');
                img.classList.add('lazy-error');
                console.warn('Failed to load image:', src);
            };
            
            // Start loading the image
            imageLoader.src = src;
        }
    }

    loadAllImages() {
        // Fallback: load all images immediately
        const lazyImages = document.querySelectorAll('img.lazy-load');
        lazyImages.forEach(img => {
            this.loadImage(img);
        });
    }

    // Method to add new images to observer (for dynamically loaded content)
    observeNewImages() {
        if (this.imageObserver) {
            const newLazyImages = document.querySelectorAll('img.lazy-load:not([data-observed])');
            newLazyImages.forEach(img => {
                img.setAttribute('data-observed', 'true');
                this.imageObserver.observe(img);
            });
        }
    }
}

// Initialize lazy loading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.lazyLoader = new LazyLoader();
    });
} else {
    window.lazyLoader = new LazyLoader();
}

// Export for use in other scripts
window.LazyLoader = LazyLoader;
