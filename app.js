// Warenkorb-Initialisierung
let cartItems = JSON.parse(localStorage.getItem('cart')) || [];

// Verhindere mehrfache Initialisierung
let addToCartButtonsInitialized = false;

// Make sure clearCart is globally available immediately
window.clearCart = function() {
  console.log('clearCart function called');
  try {
    cartItems = [];
    localStorage.setItem('cart', JSON.stringify(cartItems));
    
    // Update counter and dropdown immediately
    if (typeof updateCartCounter === 'function') {
      updateCartCounter();
    } else {
      console.log('updateCartCounter function not available');
    }
    
    // Sofort ausblenden
    console.log('Cart cleared, hiding dropdown');
    const cartDropdown = document.getElementById('cartDropdown');
    if (cartDropdown) {
      cartDropdown.classList.remove('show');
      cartDropdown.style.display = 'none';
    }
    
    // Show confirmation message
    if (typeof showAlert === 'function') {
      showAlert('Warenkorb wurde geleert');
    } else {
      alert('Warenkorb wurde geleert');
    }
    
    console.log('Cart cleared successfully');
  } catch (error) {
    console.error('Error in clearCart:', error);
    alert('Fehler beim Leeren des Warenkorbs: ' + error.message);
  }
};

// Wishlist-Initialisierung
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

// Produktdaten laden mit Cache-Busting
async function loadProducts() {
  try {
    // Cache-busting für products.json
    const cacheBuster = Date.now();
    const response = await fetch(`products.json?v=${cacheBuster}`);
    const products = await response.json();
    
    console.log('📋 Products loaded with cache-busting:', products.length);
    
    // Validiere kritische Produkte (die 6 problematischen)
    const criticalIds = [10, 11, 19, 20, 24, 25];
    criticalIds.forEach(id => {
      const product = products.find(p => Number(p.id) === id);
      if (product) {
        console.log(`✅ Critical product ${id} found:`, product.name);
        // Prüfe auf kaputte Preise
        if (typeof product.price !== 'number' || isNaN(product.price)) {
          console.error(`❌ Product ${id} has invalid price:`, product.price);
        }
      } else {
        console.error(`❌ Critical product ${id} NOT FOUND!`);
      }
    });
    
    // Füge eine Standardbeschreibung hinzu, falls nicht vorhanden
    return products.map(p => ({
      ...p,
      description: p.description || '',
      // Repariere kaputte Preise
      price: typeof p.price === 'number' && !isNaN(p.price) ? p.price : 0
    }));
  } catch (error) {
    console.error('Fehler beim Laden der Produkte:', error);
    return [];
  }
}

// Wishlist-Logik (bereits initialisiert oben)

function getWishlist() {
  return JSON.parse(localStorage.getItem('wishlist')) || [];
}

function setWishlist(wishlist) {
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
}

function isInWishlist(productId) {
  return getWishlist().some(item => Number(item.id) === Number(productId));
}

function toggleWishlist(productId) {
  // Trigger animation immediately for better responsiveness
  triggerWishlistButtonAnimation(productId);
  
  loadProducts().then(products => {
    const product = products.find(p => Number(p.id) === Number(productId));
    if (!product) {
      console.error('Produkt für die Wunschliste nicht gefunden! ID:', productId, products);
      alert('Produkt konnte nicht zur Wunschliste hinzugefügt werden.');
      return;
    }
    
    let wishlist = getWishlist();
    const wasInWishlist = isInWishlist(productId);
    
    if (wasInWishlist) {
      wishlist = wishlist.filter(item => Number(item.id) !== Number(productId));
      showAlert('Produkt von der Wunschliste entfernt', 'wishlist.html');
    } else {
      wishlist.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        description: product.description
      });
      showAlert('Produkt zur Wunschliste hinzugefügt', 'wishlist.html');
    }
    
    setWishlist(wishlist);
    
    // Update all wishlist button states for this product - NEW: Direct selector
    const wishlistButtons = document.querySelectorAll(`.lumiere-wishlist-btn[data-product-id="${productId}"]`);
    wishlistButtons.forEach(wishlistButton => {
      if (wishlistButton) {
        wishlistButton.classList.toggle('active', !wasInWishlist);
        const icon = wishlistButton.querySelector('i');
        if (icon) {
          icon.className = wasInWishlist ? 'bi bi-heart' : 'bi bi-heart-fill';
        }
      }
    });
    
    // Update navigation wishlist counter if it exists
    updateWishlistCounter();
  });
}

function updateWishlistCounter() {
  const wishlistCounter = document.getElementById('wishlistCounter');
  if (wishlistCounter) {
    const wishlistCount = getWishlist().length;
    wishlistCounter.textContent = wishlistCount;
    wishlistCounter.style.display = wishlistCount > 0 ? 'block' : 'none';
  }
}

function updateWishlistButtonState(productId) {
  const button = document.querySelector(`[data-product-id="${productId}"] .wishlist-btn`);
  if (button) {
    if (isInWishlist(productId)) {
      button.classList.add('active');
      button.innerHTML = '<i class="bi bi-heart-fill"></i>';
    } else {
      button.classList.remove('active');
      button.innerHTML = '<i class="bi bi-heart"></i>';
    }
  }
}

// Produktgrid rendern - Lumière Design Style
function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) {
    console.error('Product grid element not found!');
    return;
  }
  
  // Reset button initialization flag when rendering new products
  addToCartButtonsInitialized = false;
  
  console.log('Rendering', products.length, 'products to grid');
  
  if (products.length === 0) {
    grid.innerHTML = '<div class="no-products">Keine Produkte gefunden.</div>';
    return;
  }
  
  grid.innerHTML = products.map(product => {
    const price = product.price || product.salePrice || 0;
    const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
    
    return `
      <div class="lumiere-product-card" data-product-id="${product.id}" data-category="${product.category}">
        <div class="lumiere-image-container">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E" data-src="produkt bilder/ware.png" class="lumiere-product-image lazy-load" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div style="display:none; align-items:center; justify-content:center; height:100%; background:#f5f5f5; color:#999; font-size:12px;">Bild nicht verfügbar</div>
          <button class="lumiere-wishlist-btn" data-product-id="${product.id}" aria-label="Zur Wunschliste">
            <i class="bi bi-heart"></i>
          </button>
        </div>
        <div class="lumiere-card-content">
          <h3 class="lumiere-product-title">${product.name}</h3>
          <div class="lumiere-price-section">
            <span class="lumiere-price">€${formattedPrice}</span>
          </div>
          <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}">
            In den Warenkorb
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('Products rendered, initializing buttons...');
  initializeAddToCartButtons();
  initializeWishlistButtons();
  initializeProductCardClicks();
  observeProductCards();
  
  // Initialize lazy loading for new images
  if (window.lazyLoader) {
    window.lazyLoader.observeNewImages();
  }
  
  optimizeImages(); // Bilder nach dem Rendern optimieren
}

function observeProductCards() {
  const cards = document.querySelectorAll('.lumiere-product-card');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(card => observer.observe(card));
}

// Add-to-cart Buttons initialisieren
function initializeAddToCartButtons() {
  console.log('🛒 Initializing AddToCart buttons...');
  
  // Warte kurz, um sicherzustellen, dass alle Elemente gerendert sind
  setTimeout(() => {
    // Get ALL add-to-cart buttons (including cart dropdown ones)
    const buttons = document.querySelectorAll('.lumiere-add-to-cart-btn:not(.recommendation-add-btn)');
    console.log('Initializing', buttons.length, 'lumiere-add-to-cart buttons (excluding recommendations)');
    
    // Entferne alle bestehenden Event-Listener durch Klonen
    buttons.forEach((button, index) => {
      const productId = button.dataset.productId;
      console.log(`Initializing button ${index} for product ${productId}`);
      
      // Special attention to the problematic products
      const problematicIds = [10, 11, 19, 20, 24, 25];
      if (problematicIds.includes(parseInt(productId))) {
        console.log(`🔍 SPECIAL: Initializing problematic product button ${productId}`);
        console.log(`🔍 Button parent:`, button.parentNode?.className);
        console.log(`🔍 Button data-product-id:`, button.getAttribute('data-product-id'));
      }
      
      // Klone Button um alle Event-Listener zu entfernen
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Füge den Event Listener zum neuen Button hinzu
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const productIdFromButton = parseInt(this.dataset.productId);
        const isFromCartDropdown = this.closest('#cartDropdown') !== null;
        console.log('Button clicked for product:', productIdFromButton, 'from cart dropdown:', isFromCartDropdown);
        
        if (productIdFromButton && !isNaN(productIdFromButton)) {
          // Verhindere mehrfache Klicks
          if (this.disabled) return;
          this.disabled = true;
          
          // Use different logic for cart dropdown buttons
          if (isFromCartDropdown) {
            // For cart dropdown: use addProductToCart directly with flag
            loadProducts().then(products => {
              addProductToCart(products, productIdFromButton, true);
            });
            
            // Visual feedback for cart dropdown buttons
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bi bi-check"></i> Hinzugefügt';
            this.style.background = 'var(--success-color)';
            
            setTimeout(() => {
              this.innerHTML = originalText;
              this.style.background = '';
              this.disabled = false;
            }, 1000);
          } else {
            // For normal buttons: use regular addToCart
            addToCart(productIdFromButton);
            
            // Button nach kurzer Zeit wieder aktivieren
            setTimeout(() => {
              this.disabled = false;
            }, 1000);
          }
        } else {
          console.error('Invalid product ID:', productIdFromButton);
        }
      });
    });
    
    console.log('✅ AddToCart buttons initialization completed');
  }, 100);
}

// Produktkarten-Klicks initialisieren
function initializeProductCardClicks() {
  console.log('🔗 Initializing product card clicks...');
  
  document.querySelectorAll('.lumiere-product-card').forEach(card => {
    const productId = parseInt(card.dataset.productId);
    console.log(`Setting up click for product card ${productId}`);
    
    card.addEventListener('click', (e) => {
      // Verhindere Navigation bei Klicks auf Buttons oder deren Kinder
      if (e.target.closest('.lumiere-wishlist-btn') || 
          e.target.closest('.lumiere-add-to-cart-btn') || 
          e.target.classList.contains('lumiere-add-to-cart-btn') ||
          e.target.closest('button')) {
        console.log('Click on button - preventing navigation');
        return;
      }
      
      console.log(`🔗 Navigating to product page for ID: ${productId}`);
      
      // Only navigate to existing product pages (10+)
      if (productId >= 10) {
        window.location.href = `produkte/produkt-${productId}.html`;
      } else {
        console.log('Product page does not exist for ID:', productId);
      }
    });
    
    // Cursor-Pointer für bessere UX
    card.style.cursor = 'pointer';
  });
  
  console.log('✅ Product card clicks initialized');
}

// Warenkorb-Funktionen
function addToCart(productId) {
  console.log('addToCart called with productId:', productId);
  
  if (!productId || isNaN(productId)) {
    console.error('Invalid product ID:', productId);
    return;
  }
  
  // Versuche zuerst, das Produkt aus dem localStorage zu laden (falls verfügbar)
  let products = JSON.parse(localStorage.getItem('allProducts') || '[]');
  
  if (products.length === 0) {
    // Wenn keine Produkte im localStorage sind, lade sie von der Datei
    loadProducts().then(loadedProducts => {
      console.log('Products loaded from file:', loadedProducts.length);
      // Speichere die Produkte im localStorage für zukünftige Verwendung
      localStorage.setItem('allProducts', JSON.stringify(loadedProducts));
      addProductToCart(loadedProducts, productId);
    }).catch(error => {
      console.error('Error loading products:', error);
      alert('Fehler beim Laden der Produkte.');
    });
  } else {
    console.log('Products loaded from localStorage:', products.length);
    addProductToCart(products, productId);
  }
}

function addProductToCart(products, productId, fromCartDropdown = false) {
  console.log('Looking for product ID:', productId, 'in', products.length, 'products');
  
  const product = products.find(p => Number(p.id) === Number(productId));
  
  if (!product) {
    console.error('Product not found for ID:', productId);
    console.log('Available product IDs:', products.map(p => p.id));
    if (!fromCartDropdown) {
      alert('Produkt konnte nicht gefunden werden.');
    }
    return;
  }
  
  console.log('Found product:', product.name);
  
  // Always read from localStorage to ensure we have the latest data
  cartItems = JSON.parse(localStorage.getItem('cart')) || [];
  const existingItem = cartItems.find(item => Number(item.id) === Number(productId));

  if (existingItem) {
    existingItem.quantity++;
    console.log('Updated existing item quantity:', existingItem.quantity);
  } else {
    cartItems.push({ ...product, quantity: 1 });
    console.log('Added new item to cart');
  }

  // Speichere den aktuellen Warenkorb immer im localStorage
  localStorage.setItem('cart', JSON.stringify(cartItems));
  
  // Update counter and dropdown immediately
  updateCartCounter();
  
  // Show alert only if not from cart dropdown
  if (!fromCartDropdown) {
    showAlert('Produkt wurde zum Warenkorb hinzugefügt');
  }

  // Trigger button animations
  triggerCartButtonAnimation(productId);
  
  // Update cart dropdown if it's open
  if (fromCartDropdown) {
    setTimeout(() => {
      renderCartDropdown();
    }, 100);
  }

  // --- NEU: Wenn der User auf cart.html ist, direkt die Seite aktualisieren ---
  if (window.location.pathname.endsWith('cart.html')) {
    if (typeof updateCartPage === 'function') {
      updateCartPage();
    } else if (typeof window.location.reload === 'function') {
      window.location.reload();
    }
  }
}

// Make updateCartCounter globally available
window.updateCartCounter = function() {
  const counter = document.getElementById('cartCounter');
  if (counter) {
    // Always read from localStorage to ensure we have the latest data
    const currentCart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    console.log('Updating cart counter - total items:', totalItems);
    
    // Update counter text
    counter.textContent = totalItems;
    
    // Show/hide counter based on total items
    if (totalItems === 0) {
      counter.style.display = 'none';
    } else {
      counter.style.display = 'flex';
    }
    
    // Update dropdown if it's currently open
    const cartDropdown = document.getElementById('cartDropdown');
    if (cartDropdown && cartDropdown.classList.contains('show')) {
      if (typeof renderCartDropdown === 'function') {
        renderCartDropdown();
      }
    }
  } else {
    console.log('Cart counter element not found');
  }
};
// Animation trigger functions
function triggerCartButtonAnimation(productId) {
  // Find ALL buttons for this product and animate them
  const cartButtons = document.querySelectorAll(`.lumiere-add-to-cart-btn[data-product-id="${productId}"]`);
  
  cartButtons.forEach((cartButton) => {
    cartButton.classList.add('success-animation');
    setTimeout(() => {
      cartButton.classList.remove('success-animation');
    }, 800);
  });
  
  // Enhanced colorful cart icon animation (no emojis)
  const navCartButton = document.querySelector('#cartButton');
  const cartIcon = document.querySelector('#cartButton i');
  if (navCartButton && cartIcon) {
    // Add colorful bounce animation class
    navCartButton.classList.add('cart-rainbow-bounce');
    
    setTimeout(() => {
      navCartButton.classList.remove('cart-rainbow-bounce');
    }, 800);
  }
}

function triggerWishlistButtonAnimation(productId) {
  // Find ALL wishlist buttons for this product
  const wishlistButtons = document.querySelectorAll(`.lumiere-wishlist-btn[data-product-id="${productId}"]`);
  
  wishlistButtons.forEach((wishlistButton) => {
    // Add success animation class
    wishlistButton.classList.add('success-animation');
    
    // Toggle active state and update icon
    const isActive = wishlistButton.classList.toggle('active');
    const icon = wishlistButton.querySelector('i');
    if (icon) {
      icon.className = isActive ? 'bi bi-heart-fill' : 'bi bi-heart';
    }
    
    // Remove animation class after it completes
    setTimeout(() => {
      wishlistButton.classList.remove('success-animation');
    }, 600);
    
    // Create floating success indicator for wishlist
    createFloatingSuccessIndicator(wishlistButton, '♥', 'wishlist');
  });
  
  // Animate the heart icon in the navigation
  const heartIcon = document.querySelector('#heartIcon');
  if (heartIcon) {
    heartIcon.classList.add('heart-pulse');
    setTimeout(() => {
      heartIcon.classList.remove('heart-pulse');
    }, 500);
  }
}

function createFloatingSuccessIndicator(button, icon, type = 'cart') {
  const indicator = document.createElement('div');
  indicator.className = `floating-success ${type}`;
  indicator.textContent = icon;
  
  // Position relative to the button
  const buttonRect = button.getBoundingClientRect();
  indicator.style.position = 'fixed';
  indicator.style.left = buttonRect.left + buttonRect.width / 2 + 'px';
  indicator.style.top = buttonRect.top + buttonRect.height / 2 + 'px';
  indicator.style.fontSize = '2rem';
  indicator.style.zIndex = '99999';
  indicator.style.pointerEvents = 'none';
  indicator.style.color = type === 'wishlist' ? '#e74c3c' : '#4CAF50';
  
  document.body.appendChild(indicator);
  
  // Remove after animation completes
  const duration = type === 'cart' ? 1200 : 1000;
  setTimeout(() => {
    if (document.body.contains(indicator)) {
      indicator.remove();
    }
  }, duration);
}

// Make showAlert globally available with enhanced animations
window.showAlert = function(message, redirectTo = 'cart.html', preventDropdownClose = false) {
  // Remove any existing notifications immediately
  const existingAlerts = document.querySelectorAll('.alert.alert-success.position-fixed');
  existingAlerts.forEach(existingAlert => {
    existingAlert.remove();
  });
  
  const alert = document.createElement('div');
  alert.className = 'alert alert-success position-fixed end-0 m-4 shadow-lg notification-slide-in';
  alert.style.zIndex = '20000';
  alert.style.fontSize = '1rem';
  alert.style.minWidth = '160px';
  alert.style.maxWidth = '320px';
  alert.style.padding = '0.75rem 2rem';
  alert.style.textAlign = 'center';
  alert.style.borderRadius = '2rem';
  alert.style.boxShadow = '0 8px 32px rgba(0,0,0,.04)';
  alert.style.background = 'linear-gradient(90deg, #4f8cff 0%, #38c6ff 100%)';
  alert.style.color = '#fff';
  alert.style.fontWeight = '500';
  alert.style.letterSpacing = '0.02em';
  alert.style.pointerEvents = 'auto';
  alert.style.position = 'fixed';
  alert.style.right = '2.5rem';
  alert.style.top = 'calc(56px + 1.2rem)';
  alert.style.cursor = 'pointer';
  alert.textContent = message;
  alert.addEventListener('click', () => {
    window.location.href = redirectTo;
  });
  document.body.appendChild(alert);
  
  setTimeout(() => {
    if (document.body.contains(alert)) {
      alert.classList.remove('notification-slide-in');
      alert.classList.add('notification-slide-out');
      setTimeout(() => alert.remove(), 400);
    }
  }, 3000);
};

// changeQuantity function
function changeQuantity(productId, change) {
  console.log('changeQuantity called:', productId, change);
  
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  const itemIndex = cart.findIndex(item => Number(item.id) === Number(productId));
  
  if (itemIndex !== -1) {
    cart[itemIndex].quantity += change;
    
    // Entferne Item wenn Quantity 0 oder weniger
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
    renderCartDropdown();
  }
}

// removeFromCart function
function removeFromCart(productId) {
  console.log('removeFromCart called:', productId);
  
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(item => Number(item.id) !== Number(productId));
  
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCounter();
  renderCartDropdown();
}

// RADICAL FIX: Clear and reload all product cards
function radicalProductReload() {
  console.log('🚨 RADICAL: Clearing all product grids and reloading...');
  
  // Clear all grids completely
  const grids = ['bestsellerGrid', 'technikGrid', 'beleuchtungGrid', 'haushaltGrid', 'wellnessGrid'];
  grids.forEach(gridId => {
    const grid = document.getElementById(gridId);
    if (grid) {
      grid.innerHTML = '';
      console.log(`🗑️ Cleared ${gridId}`);
    }
  });
  
  // Force reload products after clearing
  setTimeout(() => {
    console.log('🔄 Reloading products after clearing...');
    loadProducts().then(products => {
      if (products.length > 0) {
        console.log('✅ Products reloaded, rendering to grids...');
        
        // Render bestsellers
        const bestsellerGrid = document.getElementById('bestsellerGrid');
        if (bestsellerGrid) {
          const bestsellers = products.slice(0, 8);
          renderProductsToGrid(bestsellers, bestsellerGrid);
        }
        
        // Render categories
        const categoryMappings = {
          'technikGrid': 'Technik/Gadgets',
          'beleuchtungGrid': 'Beleuchtung',
          'haushaltGrid': 'Haushalt und Küche',
          'wellnessGrid': 'Körperpflege/Wellness'
        };
        
        Object.entries(categoryMappings).forEach(([gridId, categoryName]) => {
          const grid = document.getElementById(gridId);
          if (grid) {
            const categoryProducts = products.filter(p => p.category === categoryName);
            renderProductsToGrid(categoryProducts, grid);
          }
        });
        
        console.log('🎉 RADICAL reload completed!');
      }
    });
  }, 100);
}

// Make it globally available
window.radicalProductReload = radicalProductReload;

// NUCLEAR OPTION: Clear everything and start fresh
function nuclearReset() {
  console.log('💥 NUCLEAR RESET: Clearing all caches and restarting...');
  
  // Clear all localStorage
  localStorage.removeItem('allProducts');
  localStorage.removeItem('cart');
  localStorage.removeItem('wishlist');
  
  // Clear all grids
  const grids = ['bestsellerGrid', 'technikGrid', 'beleuchtungGrid', 'haushaltGrid', 'wellnessGrid'];
  grids.forEach(gridId => {
    const grid = document.getElementById(gridId);
    if (grid) {
      grid.innerHTML = '<div class="col-12 text-center p-4">Loading...</div>';
    }
  });
  
  // Force reload everything after 500ms
  setTimeout(() => {
    window.location.reload(true);
  }, 500);
}

window.nuclearReset = nuclearReset;

// DEEP DIAGNOSIS: Analyze the 6 problematic products
function deepDiagnosis() {
  console.log('🔍 DEEP DIAGNOSIS: Analyzing the 6 problematic products...');
  
  const problematicIds = [10, 11, 19, 20, 24, 25];
  
  problematicIds.forEach(id => {
    console.log(`\n🔍 === ANALYZING PRODUCT ${id} ===`);
    
    // Find all possible selectors for this product
    const selectors = [
      `.lumiere-add-to-cart-btn[data-product-id="${id}"]`,
      `.lumiere-wishlist-btn[data-product-id="${id}"]`,
      `[data-product-id="${id}"] .lumiere-add-to-cart-btn`,
      `[data-product-id="${id}"] .lumiere-wishlist-btn`,
      `.lumiere-product-card[data-product-id="${id}"]`
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`  ${selector}: ${elements.length} found`);
      
      elements.forEach((el, index) => {
        console.log(`    [${index}] Classes:`, el.className);
        console.log(`    [${index}] Parent:`, el.parentNode?.className);
        console.log(`    [${index}] Has onclick:`, el.onclick !== null);
        console.log(`    [${index}] Data-product-id:`, el.dataset.productId);
        
        // Test if clicking works
        if (el.classList.contains('lumiere-add-to-cart-btn')) {
          console.log(`    [${index}] TESTING CLICK...`);
          try {
            // Simulate click and see what happens
            const clickEvent = new MouseEvent('click', { bubbles: true });
            el.dispatchEvent(clickEvent);
            console.log(`    [${index}] Click dispatched successfully`);
          } catch (e) {
            console.log(`    [${index}] Click failed:`, e.message);
          }
        }
      });
    });
    
    // Test if product exists in products array
    const products = JSON.parse(localStorage.getItem('allProducts') || '[]');
    const product = products.find(p => Number(p.id) === id);
    console.log(`  Product in localStorage:`, product ? product.name : 'NOT FOUND');
  });
  
  // Compare with a working product (from bestsellers)
  console.log('\n🔍 === COMPARING WITH WORKING PRODUCT ===');
  const workingButton = document.querySelector('#bestsellerGrid .lumiere-add-to-cart-btn');
  if (workingButton) {
    console.log('Working button classes:', workingButton.className);
    console.log('Working button parent:', workingButton.parentNode?.className);
    console.log('Working button has click:', workingButton.onclick !== null);
    console.log('Working button product-id:', workingButton.dataset.productId);
  }
}

window.deepDiagnosis = deepDiagnosis;

// Deep diagnosis removed - problem solved!

// Filter- und Sortierfunktionen
function debounce(func, timeout = 50) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

function filterProducts(products, searchText, category) {
  console.log('filterProducts called:', { searchText, category, productsCount: products.length });
  
  const filtered = products.filter(product => {
    const matchesSearch = searchText === '' || product.name.toLowerCase().includes(searchText.toLowerCase());
    
    // Category matching - ERWEITERTE DEBUG VERSION
    let matchesCategory;
    if (category === 'alle' || category === 'Alle Kategorien' || !category) {
      matchesCategory = true; // Show all categories
    } else {
      matchesCategory = product.category === category; // Exact match only
    }
    
    // Einfaches Logging nur bei Problemen
    if (category === 'Technik/Gadgets' && product.category === 'Technik/Gadgets') {
      console.log(`✅ Technik product: ${product.name}`);
    }
    
    return matchesSearch && matchesCategory;
  });
  
  console.log('Filtered result:', filtered.length, 'products');
  return filtered;
}

function sortProducts(products, sortOrder) {
  return [...products].sort((a, b) =>
    sortOrder === 'Aufsteigend' || sortOrder === 'Preis: Aufsteigend'
      ? a.price - b.price
      : b.price - a.price
  );
}

// Funktion zum Berechnen der Produktanzahl pro Kategorie
function calculateCategoryCounts(products) {
  const counts = {
    'Technik/Gadgets': 0,
    'Beleuchtung': 0,
    'Haushalt und Küche': 0,
    'Körperpflege/Wellness': 0
  };
  
  products.forEach(product => {
    if (counts.hasOwnProperty(product.category)) {
      counts[product.category]++;
    }
  });
  
  return counts;
}

// Warenkorb Dropdown öffnen/schließen und rendern
function initializeCartDropdown() {
  const cartButton = document.getElementById('cartButton');
  const cartDropdown = document.getElementById('cartDropdown');
  const closeCartDropdown = document.getElementById('closeCartDropdown');

  console.log('Initializing cart dropdown:', { cartButton: !!cartButton, cartDropdown: !!cartDropdown });

  if (cartButton && cartDropdown) {
    // Remove any existing event listeners
    cartButton.removeEventListener('click', handleCartClick);
    
    function handleCartClick(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Cart button clicked');
      
      // Always render fresh data when opening dropdown
      renderCartDropdown();
      cartDropdown.classList.toggle('show');
      
      // Ensure visibility
      if (cartDropdown.classList.contains('show')) {
        cartDropdown.style.display = 'block';
        console.log('Cart dropdown shown');
      } else {
        cartDropdown.style.display = 'none';
        console.log('Cart dropdown hidden');
      }
    }
    
    cartButton.addEventListener('click', handleCartClick);
  } else {
    console.error('Cart elements not found:', { cartButton: !!cartButton, cartDropdown: !!cartDropdown });
  }
  if (closeCartDropdown && cartDropdown) {
    closeCartDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      cartDropdown.classList.remove('show');
      cartDropdown.style.display = 'none';
      cartDropdown.style.display = 'none'; // Overlay immer ausblenden
    });
  }

  // Close cart dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (cartDropdown && cartDropdown.classList.contains('show')) {
      // Check if click is outside the cart dropdown and cart button
      if (!cartDropdown.contains(e.target) && !cartButton.contains(e.target)) {
        cartDropdown.classList.remove('show');
        cartDropdown.style.display = 'none';
      }
    }
  });

  // Prevent cart dropdown from closing when clicking on interactive elements inside it
  if (cartDropdown) {
    cartDropdown.addEventListener('click', (e) => {
      // Check if the clicked element is an interactive element that should not close the dropdown
      const interactiveElements = [
        '.quantity-btn',
        '.remove-item', 
        '.recommendation-add-btn',
        '.cart-item-controls',
        '.quantity-controls',
        '.quantity-display',
        'button',
        'input'
      ];
      
      // If the clicked element or its parent matches any interactive element, prevent closing
      const isInteractiveElement = interactiveElements.some(selector => 
        e.target.matches(selector) || e.target.closest(selector)
      );
      
      if (isInteractiveElement) {
        e.stopPropagation(); // Prevent the click from bubbling up and closing the dropdown
      }
    });
  }

  // Reset category filter when clicking on Marktplatz logo
  const navbarBrand = document.querySelector('.navbar-brand');
  if (navbarBrand) {
    navbarBrand.addEventListener('click', (e) => {
      e.preventDefault();
      const categoryFilter = document.getElementById('categoryFilter');
      const searchInput = document.getElementById('searchInput');
      
      if (categoryFilter) {
        categoryFilter.value = 'Alle Kategorien';
        categoryFilter.dispatchEvent(new Event('change'));
      }
      
      // Reset custom dropdown
      const customDropdown = document.getElementById('categoryDropdown');
      const categorySelected = document.getElementById('categorySelected');
      if (customDropdown && categorySelected) {
        categorySelected.innerHTML = `
          <span class="category-icon">📋</span>
          <span class="category-text">Alle Kategorien</span>
          <span class="dropdown-arrow">▼</span>
        `;
        customDropdown.classList.remove('open');
      }
      
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  
  // Initialize clear cart button
  const clearCartBtn = document.getElementById('clearCart');
  if (clearCartBtn) {
    console.log('Clear cart button found, adding event listener');
    // Remove any existing event listeners
    clearCartBtn.removeEventListener('click', clearCart);
    clearCartBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Clear cart button clicked');
      clearCart();
    });
  } else {
    console.log('Clear cart button not found');
  }
}

function renderCartDropdown() {
  console.log('renderCartDropdown called');
  cartItems = JSON.parse(localStorage.getItem('cart')) || [];
  console.log('Cart items loaded:', cartItems);
  
  const body = document.getElementById('cartDropdownBody');
  const footer = document.getElementById('cartDropdownFooter');
  const totalElement = document.getElementById('cartTotal');

  if (!body || !footer || !totalElement) {
    console.error('Required cart dropdown elements not found:', {
      body: !!body,
      footer: !!footer,
      totalElement: !!totalElement
    });
    return;
  }

  if (cartItems.length === 0) {
    console.log('Cart is empty, showing empty state');
    footer.style.display = 'none'; // Footer verstecken bei leerem Warenkorb
    totalElement.textContent = '0.00'; // Gesamt auf 0 setzen bei leerem Warenkorb
    
    // Bei leerem Warenkorb: 3 zufällige Produktvorschläge anzeigen
    loadProducts().then(products => {
      if (products.length === 0) {
        body.innerHTML = `
          <div class="empty-cart text-center py-4" id="emptyCartMessage">
            <i class="bi bi-cart-x fs-1 text-muted"></i>
            <p class="text-muted mt-2">Ihr Warenkorb ist leer</p>
          </div>
        `;
        return;
      }
      
      // 3 zufällige Produkte auswählen
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      const randomProducts = shuffled.slice(0, 3);
      
      body.innerHTML = `
        <div class="empty-cart text-center py-3" id="emptyCartMessage">
          <i class="bi bi-cart-x fs-1 text-muted"></i>
          <p class="text-muted mt-2 mb-3">Ihr Warenkorb ist leer</p>
          
          <!-- Enhanced Produktvorschläge -->
          <div class="cart-recommendations">
            <h6><i class="bi bi-lightbulb"></i> Das könnte Ihnen gefallen</h6>
            <div class="recommendations-grid">
              ${randomProducts.map((product, index) => `
                <div class="recommendation-card" style="animation-delay: ${(index + 1) * 0.1}s;">
                  <img src="${product.image}" class="recommendation-image" alt="${product.name}">
                  <div class="recommendation-details">
                    <div class="recommendation-name">${product.name}</div>
                    <div class="recommendation-price">€${product.price.toFixed(2)}</div>
                  </div>
                  <button class="recommendation-add-btn" onclick="addRecommendationToCart(${product.id}, this)" title="Zum Warenkorb hinzufügen">
                    <i class="bi bi-cart-plus"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    });
    return;
  }
  
  console.log('Rendering cart items:', cartItems.length);
  footer.style.display = 'block';
  
  // Calculate total for display
  const total = cartItems.reduce((sum, item) => sum + (typeof item.price === 'number' ? item.price * item.quantity : 0), 0);
  console.log('Cart total calculated:', total);
  
  // Render cart items and add recommendations
  const cartItemsHTML = cartItems.map(item => `
    <div class="cart-item">
      <img src="${item.image}" class="cart-item-image" alt="${item.name}">
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">
          €${(typeof item.price === 'number' ? item.price.toFixed(2) : '0.00')} x 
          <span class="quantity-display">${item.quantity}</span> = 
          <strong>€${(typeof item.price === 'number' ? (item.price * item.quantity).toFixed(2) : '0.00')}</strong>
        </div>
      </div>
      <div class="cart-item-controls">
        <div class="quantity-controls" style="display: flex; align-items: center; gap: 4px;">
          <button class="quantity-btn" onclick="changeQuantity(${Number(item.id)}, -1)" style="cursor: pointer; pointer-events: auto;">-</button>
          <span class="quantity-display">${item.quantity}</span>
          <button class="quantity-btn" onclick="changeQuantity(${Number(item.id)}, 1)" style="cursor: pointer; pointer-events: auto;">+</button>
        </div>
        <button class="remove-item" onclick="removeFromCart('${item.id}')" style="cursor: pointer; pointer-events: auto;">&times;</button>
      </div>
    </div>
  `).join('');

  // Add recommendations when cart has items
  loadProducts().then(products => {
    const cartProductIds = cartItems.map(item => item.id);
    const availableProducts = products.filter(product => !cartProductIds.includes(product.id));
    const shuffled = [...availableProducts].sort(() => 0.5 - Math.random());
    const randomProducts = shuffled.slice(0, 2); // Show 2 recommendations when cart has items
    
    let recommendationsHTML = '';
    if (randomProducts.length > 0) {
      recommendationsHTML = `
        <div class="cart-recommendations">
          <h6><i class="bi bi-lightbulb"></i> Das könnte Ihnen gefallen</h6>
          <div class="recommendations-grid">
            ${randomProducts.map((product, index) => `
              <div class="recommendation-card" style="animation-delay: ${(index + 1) * 0.1}s;">
                <img src="${product.image}" class="recommendation-image" alt="${product.name}">
                <div class="recommendation-details">
                  <div class="recommendation-name">${product.name}</div>
                  <div class="recommendation-price">€${product.price.toFixed(2)}</div>
                </div>
                <button class="recommendation-add-btn" onclick="addRecommendationToCart(${product.id}, this)" title="Zum Warenkorb hinzufügen">
                  <i class="bi bi-cart-plus"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    body.innerHTML = cartItemsHTML + recommendationsHTML;
  });
  
  // Set initial content without recommendations for immediate rendering
  body.innerHTML = cartItemsHTML;
  
  // Update total immediately
  totalElement.textContent = total.toFixed(2);
  console.log('Cart dropdown rendered successfully with total:', total.toFixed(2));
  
  // Re-initialize add-to-cart buttons for new dropdown content
  setTimeout(() => {
    initializeAddToCartButtons();
  }, 100);
  
  // Re-initialize clear cart button after rendering
  setTimeout(() => {
    const clearCartBtn = document.getElementById('clearCart');
    if (clearCartBtn) {
      console.log('Re-initializing clear cart button');
      // Remove any existing event listeners
      const newClearCartBtn = clearCartBtn.cloneNode(true);
      clearCartBtn.parentNode.replaceChild(newClearCartBtn, clearCartBtn);
      
      newClearCartBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Clear cart button clicked (re-initialized)');
        clearCart();
      });
    }
  }, 100);
}

// Render Bestseller Section with horizontal scroll
function renderBestsellers(products) {
    const grid = document.getElementById('bestsellerGrid');
    if (!grid) return;
    
    grid.innerHTML = products.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="lumiere-product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="lumiere-image-container">
                    <img src="produkt bilder/ware.png" class="lumiere-product-image" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none; align-items:center; justify-content:center; height:100%; background:#f5f5f5; color:#999; font-size:12px;">Bild nicht verfügbar</div>
                    <button class="lumiere-wishlist-btn" data-product-id="${product.id}" aria-label="Zur Wunschliste">
                        <i class="bi bi-heart"></i>
                    </button>
                </div>
                <div class="lumiere-card-content">
                    <h3 class="lumiere-product-title">${product.name}</h3>
                    <div class="lumiere-price-section">
                        <span class="lumiere-price">€${formattedPrice}</span>
                    </div>
                    <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}">
                        In den Warenkorb
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize wishlist buttons for bestsellers
    initializeWishlistButtons();
    initializeAddToCartButtons();
    
    // Initialize scrollbar tracking
    setTimeout(() => {
        initializeScrollbarTracking();
    }, 100);
}

// Scroll function for bestseller slider
function scrollBestsellers(direction) {
    const grid = document.getElementById('bestsellerGrid');
    if (!grid) return;
    
    const cardWidth = 280 + 20; // Card width + gap
    const scrollAmount = cardWidth; // Scroll exactly one card
    const currentScroll = grid.scrollLeft;
    
    if (direction === 'left') {
        grid.scrollTo({
            left: Math.max(0, currentScroll - scrollAmount),
            behavior: 'smooth'
        });
    } else {
        const maxScroll = grid.scrollWidth - grid.clientWidth;
        grid.scrollTo({
            left: Math.min(maxScroll, currentScroll + scrollAmount),
            behavior: 'smooth'
        });
    }
    
    // Update scrollbar position during and after scroll
    const updateDuringScroll = () => {
        updateScrollbarPosition();
        if (Math.abs(grid.scrollLeft - (direction === 'left' ? Math.max(0, currentScroll - scrollAmount) : Math.min(grid.scrollWidth - grid.clientWidth, currentScroll + scrollAmount))) > 1) {
            requestAnimationFrame(updateDuringScroll);
        }
    };
    requestAnimationFrame(updateDuringScroll);
}

// Generic scroll function for all category grids
function scrollCategory(gridId, direction) {
    const grid = document.getElementById(gridId);
    if (!grid) {
        console.error('Grid not found:', gridId);
        return;
    }
    
    console.log(`🔧 Scrolling ${gridId} ${direction}`);
    console.log(`Grid scrollWidth: ${grid.scrollWidth}, clientWidth: ${grid.clientWidth}`);
    
    // Calculate scroll amount - always use a reasonable amount
    const cardWidth = 280 + 20; // Card width + gap
    const scrollAmount = cardWidth * 0.8; // Always scroll by 80% of a card
    
    const currentScroll = grid.scrollLeft;
    const maxScroll = grid.scrollWidth - grid.clientWidth;
    
    console.log(`Current scroll: ${currentScroll}, Max scroll: ${maxScroll}`);
    
    // Force scroll even if there's little content
    if (direction === 'left') {
        const newScroll = Math.max(0, currentScroll - scrollAmount);
        console.log(`Scrolling left to: ${newScroll}`);
        grid.scrollTo({
            left: newScroll,
            behavior: 'smooth'
        });
    } else {
        const newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
        console.log(`Scrolling right to: ${newScroll}`);
        grid.scrollTo({
            left: newScroll,
            behavior: 'smooth'
        });
    }
    
    // Update scrollbar position for this specific grid
    setTimeout(() => {
        updateScrollbarPositionForGrid(gridId);
    }, 100);
}

// Update scrollbar position - NEUE METHODE (for bestsellers)
function updateScrollbarPosition() {
    updateScrollbarPositionForGrid('bestsellerGrid');
}

// Generic scrollbar position update function for any grid
function updateScrollbarPositionForGrid(gridId) {
    // Use the new custom scrollbar update function
    updateCustomScrollbarPosition(gridId);
}

// Initialize scrollbar tracking for all grids
function initializeScrollbarTracking() {
    const grids = [
        'bestsellerGrid',
        'technikGrid', 
        'beleuchtungGrid',
        'haushaltGrid',
        'wellnessGrid'
    ];
    
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (!grid) {
            console.log(`Grid ${gridId} not found for scrollbar tracking`);
            return;
        }
        
        console.log(`Initializing scrollbar tracking for ${gridId}`);
        
        // Force scrollbar to start at 0px
        const container = grid.parentElement;
        if (container) {
            container.style.setProperty('--scroll-position', '0px');
        }
        
        // Add scroll event listener for this specific grid
        grid.addEventListener('scroll', () => updateScrollbarPositionForGrid(gridId));
        
        // Force initial position update
        updateScrollbarPositionForGrid(gridId);
        setTimeout(() => updateScrollbarPositionForGrid(gridId), 50);
        setTimeout(() => updateScrollbarPositionForGrid(gridId), 200);
        setTimeout(() => updateScrollbarPositionForGrid(gridId), 500);
        
        // Initialize drag scroll functionality for this grid
        initializeDragScrollForGrid(grid);
        
        // Create custom scrollbar for this grid
        createCustomScrollbarForGrid(gridId);
    });
    
    // Also update all scrollbars on window resize
    window.addEventListener('resize', () => {
        grids.forEach(gridId => updateScrollbarPositionForGrid(gridId));
    });
}

// Initialize drag scroll functionality for a specific grid
function initializeDragScrollForGrid(container) {
    console.log(`🎯 Setting up drag scroll for grid: ${container.id}`);
    
    let isDown = false;
    let startX;
    let scrollLeft;
    
    // Make the whole container draggable
    container.style.cursor = 'grab';
    
    // Mouse down event
    container.addEventListener('mousedown', (e) => {
        // Skip if clicking on buttons or links
        if (e.target.tagName === 'BUTTON' || 
            e.target.closest('button') || 
            e.target.closest('a') ||
            e.target.closest('.lumiere-wishlist-btn') ||
            e.target.closest('.lumiere-add-to-cart-btn')) {
            return;
        }
        
        isDown = true;
        container.style.cursor = 'grabbing';
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        e.preventDefault();
        console.log('🎯 Container drag started for:', container.id);
    });
    
    // Mouse up event
    container.addEventListener('mouseup', () => {
        if (isDown) {
            isDown = false;
            container.style.cursor = 'grab';
            console.log('🎯 Container drag ended for:', container.id);
        }
    });
    
    // Mouse leave event
    container.addEventListener('mouseleave', () => {
        if (isDown) {
            isDown = false;
            container.style.cursor = 'grab';
        }
    });
    
    // Mouse move event
    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed
        const newScrollLeft = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, scrollLeft - walk));
        
        // Use scrollTo for smooth scrolling
        container.scrollTo({
            left: newScrollLeft,
            behavior: 'auto' // No smooth during drag
        });
        
        // Update scrollbar position immediately
        updateScrollbarPositionForGrid(container.id);
    });
    
    // Touch events for mobile
    let touchStartX;
    let touchScrollLeft;
    
    container.addEventListener('touchstart', (e) => {
        // Don't interfere with button clicks
        if (e.target.closest('button') || 
            e.target.closest('a') || 
            e.target.closest('.lumiere-product-card')) {
            return;
        }
        
        touchStartX = e.touches[0].pageX;
        touchScrollLeft = container.scrollLeft;
        container.classList.add('dragging');
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
        if (touchStartX === undefined) return;
        
        const touchX = e.touches[0].pageX;
        const walk = (touchStartX - touchX) * 1.5; // Touch scroll speed
        const newScrollLeft = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, touchScrollLeft + walk));
        
        container.scrollTo({
            left: newScrollLeft,
            behavior: 'auto'
        });
        
        // Update scrollbar position immediately
        updateScrollbarPositionForGrid(container.id);
    }, { passive: true });
    
    container.addEventListener('touchend', () => {
        touchStartX = undefined;
        container.classList.remove('dragging');
    });
    
    console.log(`✅ Drag scroll initialized for: ${container.id}`);
}

// Create and initialize a custom scrollbar for a specific grid
function createCustomScrollbarForGrid(gridId) {
    console.log(`🎯 Creating custom scrollbar for: ${gridId}`);
    
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    const container = grid.parentElement;
    if (!container) return;
    
    // Remove any existing scrollbars
    const existingTrack = container.querySelector('.custom-scrollbar-track');
    const existingThumb = container.querySelector('.custom-scrollbar-thumb');
    if (existingTrack) existingTrack.remove();
    if (existingThumb) existingThumb.remove();
    
    // Create scrollbar track (gray background)
    const scrollbarTrack = document.createElement('div');
    scrollbarTrack.className = 'custom-scrollbar-track';
    scrollbarTrack.style.cssText = `
        position: absolute;
        bottom: 12px;
        left: 20px;
        right: 110px;
        height: 6px;
        background: #f0f0f0;
        border-radius: 3px;
        pointer-events: none;
        z-index: 1;
    `;
    
    // Create scrollbar thumb (black draggable part)
    const scrollbarThumb = document.createElement('div');
    scrollbarThumb.className = 'custom-scrollbar-thumb';
    scrollbarThumb.id = `${gridId}ScrollbarThumb`;
    scrollbarThumb.style.cssText = `
        position: absolute;
        bottom: 12px;
        left: 20px;
        width: 100px;
        height: 6px;
        background: #000000;
        border-radius: 3px;
        cursor: grab;
        pointer-events: auto;
        z-index: 2;
        transition: all 0.1s ease-out;
    `;
    
    // Add elements to container
    container.appendChild(scrollbarTrack);
    container.appendChild(scrollbarThumb);
    
    // Add hover effects
    scrollbarThumb.addEventListener('mouseenter', () => {
        scrollbarThumb.style.height = '8px';
        scrollbarThumb.style.bottom = '11px';
        scrollbarThumb.style.background = '#333333';
    });
    
    scrollbarThumb.addEventListener('mouseleave', () => {
        scrollbarThumb.style.height = '6px';
        scrollbarThumb.style.bottom = '12px';
        scrollbarThumb.style.background = '#000000';
    });
    
    // Make scrollbar thumb draggable
    let isDragging = false;
    let startX;
    let startScrollLeft;
    let startThumbLeft;
    
    scrollbarThumb.addEventListener('mousedown', (e) => {
        isDragging = true;
        scrollbarThumb.style.cursor = 'grabbing';
        startX = e.clientX;
        startScrollLeft = grid.scrollLeft;
        
        // Get current thumb position
        const thumbRect = scrollbarThumb.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        startThumbLeft = thumbRect.left - containerRect.left - 20; // 20px is left offset
        
        e.preventDefault();
        e.stopPropagation();
        console.log('🎯 Scrollbar thumb drag started for:', gridId);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const deltaX = e.clientX - startX;
        const containerWidth = container.offsetWidth;
        const trackWidth = containerWidth - 130; // 20px left + 110px right
        const thumbWidth = 100;
        const maxThumbPosition = Math.max(0, trackWidth - thumbWidth);
        
        if (maxThumbPosition <= 0) return;
        
        // Calculate new thumb position
        const newThumbLeft = Math.max(0, Math.min(maxThumbPosition, startThumbLeft + deltaX));
        
        // Calculate scroll percentage
        const scrollPercentage = newThumbLeft / maxThumbPosition;
        const maxScrollLeft = grid.scrollWidth - grid.clientWidth;
        const newScrollLeft = scrollPercentage * maxScrollLeft;
        
        // Move thumb
        scrollbarThumb.style.transform = `translateX(${newThumbLeft}px)`;
        
        // Scroll grid
        grid.scrollTo({
            left: newScrollLeft,
            behavior: 'auto'
        });
        
        console.log(`🎯 Dragging: thumbPos=${newThumbLeft}px, scrollPos=${newScrollLeft}px`);
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            scrollbarThumb.style.cursor = 'grab';
            console.log('🎯 Scrollbar thumb drag ended for:', gridId);
        }
    });
    
    // Update thumb position when grid scrolls (from buttons or other sources)
    grid.addEventListener('scroll', () => {
        updateCustomScrollbarPosition(gridId);
    });
    
    console.log(`✅ Custom scrollbar created for: ${gridId}`);
    return scrollbarThumb;
}

// Update the position of a custom scrollbar based on grid scroll position
function updateCustomScrollbarPosition(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    const container = grid.parentElement;
    if (!container) return;
    
    const scrollbarThumb = container.querySelector('.custom-scrollbar-thumb');
    if (!scrollbarThumb) return;
    
    const scrollLeft = grid.scrollLeft;
    const maxScrollLeft = grid.scrollWidth - grid.clientWidth;
    
    if (maxScrollLeft <= 0) {
        scrollbarThumb.style.transform = 'translateX(0px)';
        return;
    }
    
    const scrollPercentage = scrollLeft / maxScrollLeft;
    const containerWidth = container.offsetWidth;
    const trackWidth = containerWidth - 130; // 20px left + 110px right
    const thumbWidth = 100;
    const maxThumbPosition = Math.max(0, trackWidth - thumbWidth);
    const thumbPosition = scrollPercentage * maxThumbPosition;
    
    scrollbarThumb.style.transform = `translateX(${thumbPosition}px)`;
}

function initializeWishlistButtons() {
  // Warte kurz, um sicherzustellen, dass alle Elemente gerendert sind
  setTimeout(() => {
    const buttons = document.querySelectorAll('.lumiere-wishlist-btn');
    console.log('Found', buttons.length, 'wishlist buttons');
    
    buttons.forEach((button, index) => {
      const productId = button.dataset.productId;
      console.log(`Initializing wishlist button ${index} for product ${productId}`);
      
      // Special attention to the problematic products
      const problematicIds = [10, 11, 19, 20, 24, 25];
      if (problematicIds.includes(parseInt(productId))) {
        console.log(`🔍 SPECIAL: Initializing problematic wishlist button ${productId}`);
        console.log(`🔍 Button parent:`, button.parentNode?.className);
        console.log(`🔍 Button data-product-id:`, button.getAttribute('data-product-id'));
      }
      
      // Entferne alle bestehenden Event Listener
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Setze den korrekten Zustand basierend auf der Wunschliste
      const isInWish = isInWishlist(productId);
      newButton.classList.toggle('active', isInWish);
      const icon = newButton.querySelector('i');
      if (icon) {
        icon.className = isInWish ? 'bi bi-heart-fill' : 'bi bi-heart';
      }
      
      // Füge den Event Listener zum neuen Button hinzu
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Wishlist button clicked for product:', productId);
        
        const productIdNum = parseInt(this.dataset.productId);
        if (productIdNum && !isNaN(productIdNum)) {
          toggleWishlist(productIdNum);
        } else {
          console.error('Invalid product ID for wishlist:', productId);
        }
      });
    });
  }, 100);
}

// Doppelte Funktion entfernt - verwende nur die geschützte Version oben

// Initialize category navigation
function initializeCategoryNavigation() {
  const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
  const categoryTitle = document.querySelector('.category-title');
  
  console.log('🔧 Initializing category navigation');
  console.log('🔧 Found category tabs:', categoryTabs.length);
  
  categoryTabs.forEach((tab, index) => {
    console.log(`🔧 Setting up tab ${index}:`, tab.dataset.category);
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔥 Category tab clicked:', tab.dataset.category);
      
      // Remove active class from all tabs
      categoryTabs.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      const category = tab.dataset.category;
      const categoryName = category === 'alle' ? 'Alle Kategorien' : category;
      
      // Update body class for category-specific styling
      updateCategoryBodyClass(category);
      
      // Update the "Alle Produkte" section title
      const allProductsTitle = document.querySelector('.category-header[style*="margin-top: 3rem"] h2.category-title');
      if (allProductsTitle) {
        allProductsTitle.textContent = category === 'alle' ? 'Alle Produkte' : categoryName;
        console.log('✅ Updated section title to:', allProductsTitle.textContent);
      }
      
      // Show/hide category sections based on selection
      showCategorySections(category);
      
      // Scroll to the appropriate section based on category selection
      if (category === 'alle') {
        // Scroll to "Alle Produkte" header when showing all categories
        const scrollTarget = document.querySelector('.category-header[style*="margin-top: 3rem"]');
        if (scrollTarget) {
          console.log('Scrolling to Alle Produkte header');
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        // Scroll to the specific category section when only one category is shown
        const firstVisibleSection = document.querySelector('.product-category-section:not([style*="display: none"])');
        if (firstVisibleSection) {
          console.log('Scrolling to visible category section');
          firstVisibleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

// Function to show/hide category sections based on selection
function showCategorySections(selectedCategory) {
  console.log('🔧 Showing category sections for:', selectedCategory);
  
  // Get all product category sections (but NOT the bestseller section)
  const categorySections = document.querySelectorAll('.product-category-section');
  
  // Get the bestseller section (should always stay visible)
  const bestsellerSection = document.querySelector('#bestsellerGrid')?.closest('.product-category-section');
  
  // Get the "Alle Produkte" header section
  const alleProduktHeader = document.querySelector('.category-header[style*="margin-top: 3rem"]');
  
  // Define category mapping for section identification
  const categoryMapping = {
    'Technik/Gadgets': 'technikGrid',
    'Beleuchtung': 'beleuchtungGrid', 
    'Haushalt und Küche': 'haushaltGrid',
    'Körperpflege/Wellness': 'wellnessGrid'
  };
  
  if (selectedCategory === 'alle') {
    // Show "Alle Produkte" header
    if (alleProduktHeader) {
      alleProduktHeader.style.display = 'block';
    }
    
    // Show all category sections
    categorySections.forEach(section => {
      section.style.display = 'block';
    });
    
    // Ensure bestseller section is always visible
    if (bestsellerSection) {
      bestsellerSection.style.display = 'block';
    }
    
    console.log('✅ All category sections shown');
  } else {
    // Hide "Alle Produkte" header when specific category is selected
    if (alleProduktHeader) {
      alleProduktHeader.style.display = 'none';
    }
    
    // Hide all sections first (except bestseller)
    categorySections.forEach(section => {
      // Don't hide the bestseller section
      if (section !== bestsellerSection) {
        section.style.display = 'none';
      }
    });
    
    // Always keep bestseller section visible
    if (bestsellerSection) {
      bestsellerSection.style.display = 'block';
    }
    
    // Show only the selected category section
    const targetGridId = categoryMapping[selectedCategory];
    if (targetGridId) {
      const targetSection = document.getElementById(targetGridId)?.closest('.product-category-section');
      if (targetSection) {
        targetSection.style.display = 'block';
        console.log('✅ Showing section for category:', selectedCategory);
      } else {
        console.error('❌ Target section not found for category:', selectedCategory);
      }
    } else {
      console.error('❌ No mapping found for category:', selectedCategory);
    }
  }
}

// Function to update body class for category-specific styling
function updateCategoryBodyClass(category) {
  // Remove all existing category classes
  document.body.classList.remove(
    'category-selected-alle',
    'category-selected-technik', 
    'category-selected-beleuchtung',
    'category-selected-koerperpflege',
    'category-selected-haushalt'
  );
  
  // Add appropriate category class
  switch(category) {
    case 'alle':
      document.body.classList.add('category-selected-alle');
      break;
    case 'Technik/Gadgets':
      document.body.classList.add('category-selected-technik');
      break;
    case 'Beleuchtung':
      document.body.classList.add('category-selected-beleuchtung');
      break;
    case 'Körperpflege/Wellness':
      document.body.classList.add('category-selected-koerperpflege');
      break;
    case 'Haushalt und Küche':
      document.body.classList.add('category-selected-haushalt');
      break;
  }
}

// Filter- und Sortier-Event-Listener
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Starting initialization');
  // Initialize cart dropdown
  initializeCartDropdown();
  initializeCategoryNavigation();
  initializeProductCardClicks();
  initializeWishlistButtons();
  initializeAddToCartButtons();

  // Initialize wishlist counter
  updateWishlistCounter();
  
  // Initialize cart counter
  updateCartCounter();

  // Sofortige Platzhalter für fehlende Bilder anwenden
  applyPlaceholdersForMissingImages();

  // SOFORT alle Produkte laden und anzeigen - MEHRFACH VERSUCHEN
  console.log('=== STARTING IMMEDIATE PRODUCT LOAD ===');

  
  const loadAndShowProducts = () => {
    loadProducts().then(products => {
      console.log('✅ Products loaded successfully:', products.length);
      
      if (products.length === 0) {
        console.error('❌ No products found in JSON file!');
        return;
      }
      
      // Lade Bestseller mit der funktionierenden Methode
      const bestsellerProducts = [];
      const categories = ['Haushalt und Küche', 'Technik/Gadgets', 'Beleuchtung', 'Körperpflege/Wellness'];
      
      // Get 1-2 products from each category for variety
      categories.forEach(category => {
        const categoryProducts = products.filter(p => p.category === category).slice(0, 2);
        bestsellerProducts.push(...categoryProducts);
      });
      
      // If we don't have enough, fill with remaining products
      if (bestsellerProducts.length < 6) {
        const remaining = products.filter(p => !bestsellerProducts.includes(p)).slice(0, 6 - bestsellerProducts.length);
        bestsellerProducts.push(...remaining);
      }
      
      // Limit to 6 products
      const finalBestsellers = bestsellerProducts.slice(0, 6);
      console.log('📦 Loading bestseller products with variety:', finalBestsellers.length);
      renderBestsellers(finalBestsellers);
      
      // Lade Produkte in alle Kategorie-Container
      loadCategoryProducts(products);
      
      // Prüfe ob Produkte tatsächlich gerendert wurden
      setTimeout(() => {
        console.log('✅ All products loaded into containers');
      }, 500);
      
      console.log('✅ All products loaded successfully!');
      
      // Berechne Kategorie-Anzahlen und aktualisiere die Anzeige
      const counts = calculateCategoryCounts(products);
      // updateCategoryTiles(counts); // Function not implemented yet
      
      // UI-Elemente korrekt setzen
      const categoryFilter = document.getElementById('categoryFilter');
      if (categoryFilter) {
        categoryFilter.value = 'Alle Kategorien';
        console.log('✅ Category filter set to "Alle Kategorien"');
      }
      
      const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
      categoryTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === 'alle') {
          tab.classList.add('active');
          console.log('✅ "Alle" tab set as active');
        }
      });
      
      // Set initial category body class
      updateCategoryBodyClass('alle');
      
      // Show all category sections initially
      showCategorySections('alle');
      
      // Nur den Titel für das Hauptprodukt-Grid setzen, nicht für Bestseller
      const categoryTitles = document.querySelectorAll('.category-title');
      categoryTitles.forEach((title, index) => {
        if (index === 1) { // Das zweite Element ist "Alle Produkte"
          title.textContent = 'Alle Produkte';
          console.log('✅ Category title set to "Alle Produkte"');
        }
      });
      
      console.log('✅ All bestsellers loaded and rendered');
  }).catch(error => {
    console.error('Error loading bestsellers:', error);
  });
}


  // Sofort laden
  loadAndShowProducts();
  
  // Backup nach 500ms
  setTimeout(() => {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid || productGrid.children.length === 0) {
      console.log('🔄 Backup product load triggered...');
      loadAndShowProducts();
    }
  }, 500);

  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const priceSort = document.getElementById('priceSort');
  const dealsNotice = document.getElementById('dealsNotice');

  function updateDealsNotice(products) {
    if (!dealsNotice) return;
    const hasDeals = products.some(p => getDiscountInfo(p).isDeal);
    if (!hasDeals) {
      dealsNotice.innerHTML = `
        <div class="alert alert-light border rounded-4 d-flex align-items-center" role="alert" style="box-shadow: 0 4px 14px rgba(0,0,0,.04);">
          <span class="me-2">🛍️</span>
          <div>
            <strong>Es gibt gerade keine Angebote.</strong>
            <a class="ms-2" href="infos/angebote.html">Zur Angebotsseite</a>
          </div>
        </div>`;
    } else {
      dealsNotice.innerHTML = '';
    }
  }

  // URL-Parameter (z.B. ?category=Technik/Gadgets) auslesen und Filter setzen
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam && categoryFilter) {
      categoryFilter.value = categoryParam;
    }
  } catch (e) {
    console.warn('Konnte URL-Parameter nicht lesen:', e);
  }

  const updateFilters = debounce(() => {
    loadProducts().then(products => {
      updateDealsNotice(products);
      const searchText = searchInput ? searchInput.value.trim() : '';
      const category = categoryFilter ? categoryFilter.value : 'Alle Kategorien';
      
      const filtered = filterProducts(products, searchText, category);
      const sorted = sortProducts(
        filtered,
        priceSort ? priceSort.value : 'Aufsteigend'
      );
      renderProducts(sorted);
    });
  }, 50);

  if (searchInput) {
    searchInput.addEventListener('input', updateFilters);
    
    // Event-Listener für das manuelle Leeren des Suchfelds
    searchInput.addEventListener('input', function() {
      if (this.value === '') {
        localStorage.removeItem('lastSearch');
      } else {
        localStorage.setItem('lastSearch', this.value);
      }
    });
  }
  if (categoryFilter) categoryFilter.addEventListener('change', () => {
    // Force immediate filter update
    const searchText = searchInput ? searchInput.value.trim() : '';
    const category = categoryFilter ? categoryFilter.value : 'Alle Kategorien';
    
    loadProducts().then(products => {
      updateDealsNotice(products);
      const filtered = filterProducts(products, searchText, category);
      const sorted = sortProducts(
        filtered,
        priceSort ? priceSort.value : 'Aufsteigend'
      );
      renderProducts(sorted);
    });
    
    // Scroll to products when category changes
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
      productGrid.scrollIntoView({ behavior: 'smooth' });
    }
  });
  if (priceSort) priceSort.addEventListener('change', debounce(updateFilters, 50));

  // Speichere die Sucheingabe bei Enter und verhindere Seitenreload
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        localStorage.setItem('lastSearch', searchInput.value);
        updateFilters();
        searchInput.blur(); // Fokus entfernen
      }
    });
    
    // Event-Listener für das Leeren des Suchfelds beim Verlassen der Seite
    window.addEventListener('beforeunload', function() {
      // Leere das Suchfeld und entferne den localStorage-Wert
      searchInput.value = '';
      localStorage.removeItem('lastSearch');
    });
    
    // Event-Listener für das Leeren des Suchfelds beim Klicken außerhalb
    searchInput.addEventListener('blur', function() {
      // Kurze Verzögerung, um sicherzustellen, dass der Benutzer wirklich weg ist
      setTimeout(() => {
        if (searchInput.value === '') {
          localStorage.removeItem('lastSearch');
        }
      }, 100);
    });
    
    // Optional: Beim Laden den letzten Suchbegriff wiederherstellen (nur wenn nicht leer)
    const lastSearch = localStorage.getItem('lastSearch');
    if (lastSearch && lastSearch.trim() !== '') {
      searchInput.value = lastSearch;
      updateFilters();
    }
  }

  // Sekundäres Laden für Filter-Setup (falls das erste Laden fehlschlägt)
  setTimeout(() => {
    console.log('Secondary product loading check...');
    const productGrid = document.getElementById('productGrid');
    if (productGrid && productGrid.children.length === 0) {
      console.log('No products found in grid, loading again...');
      loadProducts().then(products => {
        console.log('Secondary load - Products loaded:', products.length);
        renderProducts(products);
        console.log('Secondary load - Products rendered');
      });
    }
  }, 1000);
  
  // Initialize other components after a short delay
  setTimeout(() => {
    initializeCustomDropdown();
    
    // Ensure category tiles are initialized even if products aren't loaded yet
    console.log('Initializing category tiles from timeout');
    initializeCategoryTiles();
  }, 500);
});

// Custom Category Dropdown Functionality
function initializeCustomDropdown() {
  // Initialize Category Dropdown
  const customDropdown = document.getElementById('categoryDropdown');
  const categorySelected = document.getElementById('categorySelected');
  const categoryOptions = document.getElementById('categoryOptions');
  const categoryFilter = document.getElementById('categoryFilter');
  
  if (customDropdown && categorySelected && categoryOptions && categoryFilter) {
    // Toggle dropdown
    categorySelected.addEventListener('click', (e) => {
      e.stopPropagation();
      customDropdown.classList.toggle('open');
      // Close price sort dropdown if open
      const priceSortDropdown = document.getElementById('priceSortDropdown');
      if (priceSortDropdown) {
        priceSortDropdown.classList.remove('open');
      }
    });
    
    // Handle option selection
    const options = categoryOptions.querySelectorAll('.custom-option');
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const value = option.getAttribute('data-value');
        const icon = option.querySelector('.category-icon').textContent;
        const text = option.querySelector('.category-text').textContent;
        
        // Update selected display
        categorySelected.innerHTML = `
          <span class="category-icon">${icon}</span>
          <span class="category-text">${text}</span>
          <span class="dropdown-arrow">▼</span>
        `;
        
        // Update hidden select
        categoryFilter.value = value;
        categoryFilter.dispatchEvent(new Event('change'));
        
        // Close dropdown
        customDropdown.classList.remove('open');
      });
    });
  }
  
  // Initialize Price Sort Dropdown
  const priceSortDropdown = document.getElementById('priceSortDropdown');
  const priceSortSelected = document.getElementById('priceSortSelected');
  const priceSortOptions = document.getElementById('priceSortOptions');
  const priceSort = document.getElementById('priceSort');
  
  if (priceSortDropdown && priceSortSelected && priceSortOptions && priceSort) {
    // Toggle dropdown
    priceSortSelected.addEventListener('click', (e) => {
      e.stopPropagation();
      priceSortDropdown.classList.toggle('open');
      // Close category dropdown if open
      if (customDropdown) {
        customDropdown.classList.remove('open');
      }
    });
    
    // Handle option selection
    const options = priceSortOptions.querySelectorAll('.custom-option');
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const value = option.getAttribute('data-value');
        const icon = option.querySelector('.category-icon').textContent;
        const text = option.querySelector('.category-text').textContent;
        
        // Update selected display
        priceSortSelected.innerHTML = `
          <span class="category-icon">${icon}</span>
          <span class="category-text">${text}</span>
          <span class="dropdown-arrow">▼</span>
        `;
        
        // Update hidden select
        priceSort.value = value;
        priceSort.dispatchEvent(new Event('change'));
        
        // Close dropdown
        priceSortDropdown.classList.remove('open');
      });
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (customDropdown && !customDropdown.contains(e.target)) {
      customDropdown.classList.remove('open');
    }
    if (priceSortDropdown && !priceSortDropdown.contains(e.target)) {
      priceSortDropdown.classList.remove('open');
    }
  });
}

// Bilder optimieren
function optimizeImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    // Fallback für fehlende Bilder mit verbessertem Design
    img.addEventListener('error', function() {
      // Prüfe ob das Bild wirklich fehlt (nicht nur noch lädt)
      if (this.src && !this.src.includes('data:') && !this.src.includes('blob:')) {
        // Entferne das alte src-Attribut
        this.removeAttribute('src');
        
        // Setze den Platzhalter-Hintergrund - Einheitlich wie auf PC
        this.style.background = '#f8fafc';
        this.style.display = 'flex';
        this.style.alignItems = 'center';
        this.style.justifyContent = 'center';
        this.style.color = '#2c3e50';
        this.style.fontSize = '4rem';
        this.style.fontWeight = '700';
        this.style.borderRadius = '16px 16px 0 0';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.style.objectFit = 'contain';
        this.style.padding = '20px';
        
        // Füge das große Fragezeichen-Symbol hinzu (wie auf PC)
        this.innerHTML = '?';
        
        // Mobile Anpassungen für Platzhalter - aber einheitlich
        if (window.innerWidth <= 768) {
          this.style.fontSize = '3rem';
        }
        if (window.innerWidth <= 600) {
          this.style.fontSize = '2.5rem';
        }
        if (window.innerWidth <= 414) {
          this.style.fontSize = '2rem';
        }
        if (window.innerWidth <= 375) {
          this.style.fontSize = '1.8rem';
        }
      }
    });
    
    // Lade-Animation mit verbesserter Performance
    img.addEventListener('load', function() {
      this.style.opacity = '1';
      this.style.transform = 'scale(1)';
      this.style.filter = 'brightness(1.02) contrast(1.05) saturate(1.08)';
      
      // Entferne Platzhalter-Styles wenn Bild geladen ist
      this.style.background = '';
      this.style.display = '';
      this.style.alignItems = '';
      this.style.justifyContent = '';
      this.style.color = '';
      this.style.fontSize = '';
      this.style.fontWeight = '';
      this.style.borderRadius = '';
      this.style.boxShadow = '';
      this.style.position = '';
      this.style.overflow = '';
      this.style.objectFit = '';
      this.style.padding = '';
      this.innerHTML = '';
    });
    
    // Initiale Lade-Animation
    img.style.opacity = '0.8';
    img.style.transform = 'scale(0.98)';
    img.style.transition = 'opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease';
    
    // Bildqualität für mobile Geräte optimieren
    if (window.innerWidth <= 600) {
      img.style.imageRendering = '-webkit-optimize-contrast';
      img.style.imageRendering = 'crisp-edges';
    }
    
    // Prüfe ob das Bild bereits fehlerhaft ist (nur bei wirklich fehlenden Bildern)
    if (img.complete && img.naturalWidth === 0 && img.src && !img.src.includes('data:') && !img.src.includes('blob:')) {
      // Warte kurz und prüfe nochmal
      setTimeout(() => {
        if (img.naturalWidth === 0) {
          img.dispatchEvent(new Event('error'));
        }
      }, 100);
    }
  });
}

// Funktion zum sofortigen Anwenden von Platzhaltern für fehlende Bilder
function applyPlaceholdersForMissingImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    // Prüfe ob das Bild bereits fehlerhaft ist (nur bei wirklich fehlenden Bildern)
    if (img.complete && img.naturalWidth === 0 && img.src && !img.src.includes('data:') && !img.src.includes('blob:')) {
      // Warte kurz und prüfe nochmal, um sicherzustellen, dass das Bild wirklich fehlt
      setTimeout(() => {
        if (img.naturalWidth === 0) {
          // Entferne das alte src-Attribut
          img.removeAttribute('src');
          
          // Setze den Platzhalter-Hintergrund - Einheitlich wie auf PC
          img.style.background = '#f8fafc';
          img.style.display = 'flex';
          img.style.alignItems = 'center';
          img.style.justifyContent = 'center';
          img.style.color = '#2c3e50';
          img.style.fontSize = '4rem';
          img.style.fontWeight = '700';
          img.style.borderRadius = '16px 16px 0 0';
          img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          img.style.position = 'relative';
          img.style.overflow = 'hidden';
          img.style.objectFit = 'contain';
          img.style.padding = '20px';
          
          // Füge das große Fragezeichen-Symbol hinzu (wie auf PC)
          img.innerHTML = '?';
          
          // Mobile Anpassungen für Platzhalter - aber einheitlich
          if (window.innerWidth <= 768) {
            img.style.fontSize = '3rem';
          }
          if (window.innerWidth <= 600) {
            img.style.fontSize = '2.5rem';
          }
          if (window.innerWidth <= 414) {
            img.style.fontSize = '2rem';
          }
          if (window.innerWidth <= 375) {
            img.style.fontSize = '1.8rem';
          }
        }
      }, 200);
    }
  });
}

// Test-Funktion für die Browser-Konsole
window.testProduct1Button = function() {
  console.log('Testing Product 1 button...');
  const button = document.querySelector('.add-to-cart[data-product-id="1"]');
  if (button) {
    console.log('Product 1 button found:', button);
    console.log('Button text:', button.textContent);
    console.log('Button onclick:', button.onclick);
    console.log('Button data-product-id:', button.dataset.productId);
    
    // Test click
    button.click();
  } else {
    console.error('Product 1 button not found!');
    console.log('All add-to-cart buttons:', document.querySelectorAll('.add-to-cart'));
  }
};

// Test-Funktion für Cart Dropdown
window.testCartDropdown = function() {
  console.log('Testing cart dropdown functionality...');
  
  // Test cart counter
  const counter = document.getElementById('cartCounter');
  console.log('Cart counter element:', counter);
  console.log('Cart counter text:', counter ? counter.textContent : 'not found');
  
  // Test cart dropdown
  const dropdown = document.getElementById('cartDropdown');
  console.log('Cart dropdown element:', dropdown);
  console.log('Cart dropdown classes:', dropdown ? dropdown.className : 'not found');
  
  // Test cart dropdown body
  const body = document.getElementById('cartDropdownBody');
  console.log('Cart dropdown body:', body);
  console.log('Cart dropdown body HTML:', body ? body.innerHTML.substring(0, 200) + '...' : 'not found');
  
  // Test quantity buttons
  const quantityButtons = document.querySelectorAll('#cartDropdown .quantity-btn');
  console.log('Quantity buttons found:', quantityButtons.length);
  quantityButtons.forEach((btn, index) => {
    console.log(`Quantity button ${index}:`, btn);
    console.log(`Button onclick:`, btn.onclick);
    console.log(`Button text:`, btn.textContent);
  });
  
  // Test remove buttons
  const removeButtons = document.querySelectorAll('#cartDropdown .remove-item');
  console.log('Remove buttons found:', removeButtons.length);
  removeButtons.forEach((btn, index) => {
    console.log(`Remove button ${index}:`, btn);
    console.log(`Button onclick:`, btn.onclick);
    console.log(`Button text:`, btn.textContent);
  });
  
  // Test current cart state
  const currentCart = JSON.parse(localStorage.getItem('cart')) || [];
  console.log('Current cart from localStorage:', currentCart);
  console.log('Cart items count:', currentCart.length);
};

// Test-Funktion für Empty Cart Verhalten
window.testEmptyCart = function() {
  console.log('Testing empty cart behavior...');
  
  // Leere den Warenkorb
  clearCart();
  
  // Prüfe den Zähler
  setTimeout(() => {
    const counter = document.getElementById('cartCounter');
    console.log('Cart counter after clearing:', counter ? counter.textContent : 'not found');
    console.log('Cart counter display:', counter ? counter.style.display : 'not found');
    
    // Füge ein Produkt hinzu
    testAddProduct17();
    
    setTimeout(() => {
      console.log('Cart counter after adding product:', counter ? counter.textContent : 'not found');
      console.log('Cart counter display:', counter ? counter.style.display : 'not found');
    }, 500);
  }, 500);
};

// Direkte Test-Funktion für Produkt 17 (Smart Watch)
window.testAddProduct17 = function() {
  console.log('Directly adding product 17 to cart...');
  const product17 = {
    id: 17,
    name: "Smart Watch Pro",
    price: 299.99,
    category: "Technik/Gadgets",
    image: "produkt bilder/ware.png",
    description: "Moderne Smartwatch mit vielen Features."
  };
  
  const existingItem = cartItems.find(item => Number(item.id) === 17);
  if (existingItem) {
    existingItem.quantity++;
    console.log('Updated existing item quantity:', existingItem.quantity);
  } else {
    cartItems.push({ ...product17, quantity: 1 });
    console.log('Added new item to cart');
  }
  
  localStorage.setItem('cart', JSON.stringify(cartItems));
  updateCartCounter();
  renderCartDropdown();
  showAlert('Produkt wurde zum Warenkorb hinzugefügt');
  
  console.log('Product 17 added to cart successfully!');
};

// Stelle sicher, dass changeQuantity, removeFromCart und clearCart global verfügbar sind:
window.changeQuantity = changeQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.addToCart = addToCart;
window.addProductToCart = addProductToCart;
window.initializeAddToCartButtons = initializeAddToCartButtons;
window.renderProducts = renderProducts;
window.loadProducts = loadProducts;
window.scrollBestsellers = scrollBestsellers;
window.scrollCategory = scrollCategory;
window.initializeScrollbarTracking = initializeScrollbarTracking;
window.updateScrollbarPositionForGrid = updateScrollbarPositionForGrid;
window.initializeDragScrollForGrid = initializeDragScrollForGrid;
window.createCustomScrollbarForGrid = createCustomScrollbarForGrid;
window.updateCustomScrollbarPosition = updateCustomScrollbarPosition;
window.testCartDropdown = testCartDropdown;
window.testEmptyCart = testEmptyCart;
window.testLiveUpdates = testLiveUpdates;
window.testClearCartButton = testClearCartButton;
window.testClearCartSimple = testClearCartSimple;

// Initialize category tiles and "Alle Produkte entdecken" button
function initializeCategoryTiles(products) {
  console.log('Initializing category tiles with products:', products ? products.length : 'no products');
  
  const categoryTiles = document.querySelectorAll('.lumiere-feature-item');
  console.log('Found category tiles:', categoryTiles.length);
  
  categoryTiles.forEach((tile, index) => {
    console.log('Setting up tile', index);
    
    // Entferne alte Event Listener
    tile.removeAttribute('onclick');
    
    // Entferne alle existierenden Event Listener
    const newTile = tile.cloneNode(true);
    tile.parentNode.replaceChild(newTile, tile);
    
    newTile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Category tile clicked, index:', index);
      
      let category;
      switch(index) {
        case 0:
          category = 'Technik/Gadgets';
          break;
        case 1:
          category = 'Beleuchtung';
          break;
        case 2:
          category = 'Haushalt und Küche';
          break;
        default:
          category = 'Alle Kategorien';
      }
      
      console.log('Selected category:', category);
      
      // Update body class for category-specific styling
      const categoryForClass = category === 'Alle Kategorien' ? 'alle' : category;
      updateCategoryBodyClass(categoryForClass);
      
      // Lade Bestseller (erste 8 Produkte)
      const bestsellerGrid = document.getElementById('bestsellerGrid');
      if (bestsellerGrid) {
        console.log('📦 Loading bestsellers...');
        const bestsellers = products.slice(0, 8); // Erste 8 als Bestseller
        renderProductsToGrid(bestsellers, bestsellerGrid);
      }
      
      // Aktualisiere auch die Kategorie-Navigation-Tabs
      const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
      categoryTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category || 
            (category === 'Alle Kategorien' && tab.dataset.category === 'alle')) {
          tab.classList.add('active');
        }
      });
      
      // Aktualisiere Kategorie-Titel
      const categoryTitle = document.querySelector('.category-title');
      if (categoryTitle) {
        categoryTitle.textContent = category === 'Alle Kategorien' ? 'Alle Produkte' : category;
      }
      
      // Lade Produkte und filtere sie
      loadProducts().then(loadedProducts => {
        console.log('Products loaded for filtering:', loadedProducts.length);
        
        const searchInput = document.getElementById('searchInput');
        const searchText = searchInput ? searchInput.value.trim() : '';
        
        console.log('Filtering with:', { searchText, category });
        
        const filtered = filterProducts(loadedProducts, searchText, category);
        console.log('Filtered products count:', filtered.length);
        
        const sorted = sortProducts(
          filtered,
          document.getElementById('priceSort') ? document.getElementById('priceSort').value : 'Aufsteigend'
        );
        renderProducts(sorted);
        
        // Scrolle zu den Produkten
        const grid = document.getElementById('productGrid');
        if (grid) {
          console.log('Scrolling to product grid');
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          console.error('Product grid not found for scrolling');
        }
      }).catch(error => {
        console.error('Error loading products for tile click:', error);
      });
    });
    
    console.log('Event listener added to tile', index);
  });
}

// Test-Funktion für Live Updates
window.testLiveUpdates = function() {
  console.log('Testing live updates...');
  
  // Test 1: Add product and check counter
  console.log('=== Test 1: Adding product ===');
  testAddProduct1();
  
  setTimeout(() => {
    const counter = document.getElementById('cartCounter');
    console.log('Counter after adding product:', counter ? counter.textContent : 'not found');
    console.log('Counter display:', counter ? counter.style.display : 'not found');
    
    // Test 2: Open dropdown and check content
    console.log('=== Test 2: Opening dropdown ===');
    const cartButton = document.getElementById('cartButton');
    if (cartButton) {
      cartButton.click();
      
      setTimeout(() => {
        const dropdown = document.getElementById('cartDropdown');
        const body = document.getElementById('cartDropdownBody');
        const footer = document.getElementById('cartDropdownFooter');
        const total = document.getElementById('cartTotal');
        
        console.log('Dropdown visible:', dropdown ? dropdown.classList.contains('show') : 'not found');
        console.log('Dropdown body content length:', body ? body.innerHTML.length : 'not found');
        console.log('Footer visible:', footer ? footer.style.display : 'not found');
        console.log('Total amount:', total ? total.textContent : 'not found');
        
        // Test 3: Change quantity
        console.log('=== Test 3: Changing quantity ===');
        const quantityBtn = document.querySelector('#cartDropdown .quantity-btn');
        if (quantityBtn) {
          console.log('Quantity button found, clicking...');
          quantityBtn.click();
          
          setTimeout(() => {
            console.log('Counter after quantity change:', counter ? counter.textContent : 'not found');
            console.log('Total after quantity change:', total ? total.textContent : 'not found');
            
            // Test 4: Remove item
            console.log('=== Test 4: Removing item ===');
            const removeBtn = document.querySelector('#cartDropdown .remove-item');
            if (removeBtn) {
              console.log('Remove button found, clicking...');
              removeBtn.click();
              
              setTimeout(() => {
                console.log('Counter after removal:', counter ? counter.textContent : 'not found');
                console.log('Counter display after removal:', counter ? counter.style.display : 'not found');
                console.log('Dropdown visible after removal:', dropdown ? dropdown.classList.contains('show') : 'not found');
              }, 500);
            } else {
              console.log('Remove button not found');
            }
          }, 500);
        } else {
          console.log('Quantity button not found');
        }
      }, 500);
    } else {
      console.log('Cart button not found');
    }
  }, 500);
};

// Test-Funktion für Clear Cart Button
window.testClearCartButton = function() {
  console.log('Testing clear cart button...');
  
  // First, add some items to cart
  console.log('=== Step 1: Adding items to cart ===');
  testAddProduct1();
  
  setTimeout(() => {
    // Open dropdown
    console.log('=== Step 2: Opening dropdown ===');
    const cartButton = document.getElementById('cartButton');
    if (cartButton) {
      cartButton.click();
      
      setTimeout(() => {
        // Check if clear cart button exists
        console.log('=== Step 3: Checking clear cart button ===');
        const clearCartBtn = document.getElementById('clearCart');
        console.log('Clear cart button found:', !!clearCartBtn);
        
        if (clearCartBtn) {
          console.log('Clear cart button text:', clearCartBtn.textContent);
          console.log('Clear cart button HTML:', clearCartBtn.outerHTML);
          
          // Test clicking the button
          console.log('=== Step 4: Clicking clear cart button ===');
          clearCartBtn.click();
          
          setTimeout(() => {
            console.log('=== Step 5: Checking result ===');
            const counter = document.getElementById('cartCounter');
            const dropdown = document.getElementById('cartDropdown');
            
            console.log('Cart counter after clear:', counter ? counter.textContent : 'not found');
            console.log('Cart counter display:', counter ? counter.style.display : 'not found');
            console.log('Dropdown visible:', dropdown ? dropdown.classList.contains('show') : 'not found');
            
            // Check localStorage
            const currentCart = JSON.parse(localStorage.getItem('cart')) || [];
            console.log('Cart in localStorage after clear:', currentCart);
            console.log('Cart items count:', currentCart.length);
          }, 500);
        } else {
          console.log('Clear cart button not found!');
        }
      }, 500);
    } else {
      console.log('Cart button not found!');
    }
  }, 500);
};

// Simple test function to check if clearCart is working
window.testClearCartSimple = function() {
  console.log('Testing clearCart function availability...');
  console.log('window.clearCart available:', typeof window.clearCart === 'function');
  console.log('window.updateCartCounter available:', typeof window.updateCartCounter === 'function');
  console.log('window.showAlert available:', typeof window.showAlert === 'function');
  
  if (typeof window.clearCart === 'function') {
    console.log('clearCart function is available, testing...');
    window.clearCart();
  } else {
    console.error('clearCart function is not available!');
  }
};

// Hilfsfunktion zum Leeren des Suchfelds
function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    localStorage.removeItem('lastSearch');
    // Aktualisiere die Filter, um alle Produkte anzuzeigen
    const updateFilters = debounce(() => {
      loadProducts().then(products => {
        const categoryFilter = document.getElementById('categoryFilter');
        const priceSort = document.getElementById('priceSort');
        const filtered = filterProducts(
          products,
          '',
          categoryFilter ? categoryFilter.value : 'Alle Kategorien'
        );
        const sorted = sortProducts(
          filtered,
          priceSort ? priceSort.value : 'Aufsteigend'
        );
        renderProducts(sorted);
      });
    }, 300);
    updateFilters();
  }
}

// Funktion global verfügbar machen
window.clearSearchInput = clearSearchInput;


// Enhanced function to add recommendations to cart with animation
function addRecommendationToCart(productId, buttonElement) {
  // Add product to cart WITHOUT closing dropdown
  loadProducts().then(products => {
    addProductToCart(products, productId, true); // fromCartDropdown = true
  });
  
  // Add visual feedback animation
  const card = buttonElement.closest('.recommendation-card');
  if (card) {
    // Add success animation class
    card.classList.add('added');
    
    // Show brief success feedback
    const originalIcon = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="bi bi-check"></i>';
    buttonElement.style.background = 'var(--success-color)';
    
    // Reset after animation
    setTimeout(() => {
      card.classList.remove('added');
      buttonElement.innerHTML = originalIcon;
      buttonElement.style.background = '';
    }, 600);
  }
  
  // Optionally show a subtle notification
  // showAddToCartNotification(); // Disabled: No notification for recommendations
}

// Show subtle notification when item is added
function showAddToCartNotification() {
  // Remove any existing cart notifications immediately
  const existingNotifications = document.querySelectorAll('.cart-notification');
  existingNotifications.forEach(notification => {
    notification.remove();
  });
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'cart-notification';
  notification.innerHTML = `
    <i class="bi bi-check-circle-fill"></i>
    <span>Artikel hinzugefügt!</span>
  `;
  
  // Add styles inline for immediate effect
  Object.assign(notification.style, {
    position: 'fixed',
    top: '80px',
    right: '20px',
    background: 'var(--success-color)',
    color: 'white',
    padding: '12px 20px',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--shadow-medium)',
    zIndex: '10000',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    fontWeight: '600',
    transform: 'translateX(100%)',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  });
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2000);
}

// Make functions globally available
window.addRecommendationToCart = addRecommendationToCart;
window.showAddToCartNotification = showAddToCartNotification;

// Rabatt-/Angebotsinfo ermitteln (kompatibel zur Angebotsseite)
function getDiscountInfo(product) {
  const hasSalePrice = typeof product.salePrice === 'number' && product.salePrice < product.price;
  const hasDiscountPercent = typeof product.discountPercent === 'number' && product.discountPercent > 0 && product.discountPercent < 1;
  if (hasSalePrice) {
    const discount = Math.max(0, 1 - (product.salePrice / product.price));
    return { isDeal: true, discount, newPrice: product.salePrice };
  }
  if (hasDiscountPercent) {
    const newPrice = Math.max(0, product.price * (1 - product.discountPercent));
    return { isDeal: true, discount: product.discountPercent, newPrice };
  }
  return { isDeal: false, discount: 0, newPrice: product.price };
}

// Erstelle eine Produktkarte
function createProductCard(product) {
  console.log('🔧 Creating product card for:', product.name);
  
  const template = document.getElementById('productTemplate');
  if (!template) {
    console.error('❌ Product template not found!');
    return document.createElement('div');
  }
  
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.lumiere-product-card');
  
  if (!card) {
    console.error('❌ Product card element not found in template!');
    return document.createElement('div');
  }
  
  // Setze Produktdaten
  const img = clone.querySelector('.lumiere-product-image');
  const title = clone.querySelector('.lumiere-product-title');
  const description = clone.querySelector('.lumiere-product-description');
  const price = clone.querySelector('.lumiere-price');
  const addToCartBtn = clone.querySelector('.lumiere-add-to-cart-btn');
  const wishlistBtn = clone.querySelector('.lumiere-wishlist-btn');
  
  if (img) {
    img.setAttribute('data-src', product.image);
    img.alt = product.name;
    console.log('✅ Image set for:', product.name);
  }
  
  if (title) {
    title.textContent = product.name;
    console.log('✅ Title set:', product.name);
  }
  
  if (description) {
    description.textContent = product.description || 'Keine Beschreibung verfügbar';
  }
  
  if (price) {
    if (product.originalPrice && product.originalPrice > product.price) {
      price.innerHTML = `
        <span class="current-price">€${product.price}</span>
        <span class="original-price">€${product.originalPrice}</span>
      `;
    } else {
      price.innerHTML = `<span class="current-price">€${product.price}</span>`;
    }
  }
  
  // Set data attributes for buttons
  if (addToCartBtn) {
    addToCartBtn.setAttribute('data-product-id', product.id);
  }
  
  if (wishlistBtn) {
    wishlistBtn.setAttribute('data-product-id', product.id);
  }
  
  // Event-Listener hinzufügen
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof addToCart === 'function') {
        addToCart(product.id);
      }
    });
  }
  
  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof toggleWishlist === 'function') {
        toggleWishlist(product.id);
      }
    });
  }
  
  // Produktkarte klickbar machen
  if (card) {
    card.addEventListener('click', () => {
      window.location.href = `product.html?id=${product.id}`;
    });
  }
  
  console.log('✅ Product card created successfully for:', product.name);
  return clone;
}

// USE THE WORKING renderBestsellers() FOR ALL CATEGORIES
function renderProductsToGrid(products, gridContainer) {
  console.log('🚨 USING WORKING renderBestsellers() logic for categories!');
  
  if (!gridContainer) {
    console.error('❌ Grid container not found!');
    return;
  }
  
  if (!products || products.length === 0) {
    console.warn('⚠️ No products to render');
    return;
  }
  
  // SCROLL GRID STRUCTURE (no Bootstrap cols) - WITH WORKING ANIMATIONS
  gridContainer.innerHTML = products.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="lumiere-product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="lumiere-image-container">
                    <img src="produkt bilder/ware.png" class="lumiere-product-image" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none; align-items:center; justify-content:center; height:100%; background:#f5f5f5; color:#999; font-size:12px;">Bild nicht verfügbar</div>
                    <button class="lumiere-wishlist-btn" data-product-id="${product.id}" aria-label="Zur Wunschliste">
                        <i class="bi bi-heart"></i>
                    </button>
                </div>
                <div class="lumiere-card-content">
                    <h3 class="lumiere-product-title">${product.name}</h3>
                    <div class="lumiere-price-section">
                        <span class="lumiere-price">€${formattedPrice}</span>
                    </div>
                    <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}">
                        In den Warenkorb
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // COPY EXACT INITIALIZATION FROM renderBestsellers()
    initializeWishlistButtons();
    initializeAddToCartButtons();
    initializeProductCardClicks(); // FÜR NAVIGATION ZU PRODUKTSEITEN
    
    // Initialize scrollbar tracking
    setTimeout(() => {
        if (typeof initializeScrollbarTracking === 'function') {
            initializeScrollbarTracking();
        }
    }, 100);

    console.log('✅ Categories now use EXACT renderBestsellers() logic!');
}

// Scroll functions for arrow buttons
function scrollBestsellers(direction) {
    const grid = document.getElementById('bestsellerGrid');
    if (!grid) return;
    
    const scrollAmount = 300;
    const currentScroll = grid.scrollLeft;
    
    if (direction === 'left') {
        grid.scrollTo({
            left: Math.max(0, currentScroll - scrollAmount),
            behavior: 'smooth'
        });
    } else {
        grid.scrollTo({
            left: Math.min(grid.scrollWidth - grid.clientWidth, currentScroll + scrollAmount),
            behavior: 'smooth'
        });
    }
    
    // Update scrollbar if function exists
    setTimeout(() => {
        if (window.updateScrollbarPositionForGrid) {
            window.updateScrollbarPositionForGrid('bestsellerGrid');
        }
    }, 100);
}

function scrollCategory(gridId, direction) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    const scrollAmount = 300;
    const currentScroll = grid.scrollLeft;
    
    if (direction === 'left') {
        grid.scrollTo({
            left: Math.max(0, currentScroll - scrollAmount),
            behavior: 'smooth'
        });
    } else {
        grid.scrollTo({
            left: Math.min(grid.scrollWidth - grid.clientWidth, currentScroll + scrollAmount),
            behavior: 'smooth'
        });
    }
    
    // Update scrollbar if function exists
    setTimeout(() => {
        if (window.updateScrollbarPositionForGrid) {
            window.updateScrollbarPositionForGrid(gridId);
        }
    }, 100);
    
}

// Call loadCategoryProducts after products are loaded
function initializeCategoryProducts() {
    if (window.allProducts && window.allProducts.length > 0) {
        loadCategoryProducts(window.allProducts);
    } else {
        console.log('⏳ Waiting for products to load...');
        setTimeout(initializeCategoryProducts, 500);
    }
}

// Initialize category products when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCategoryProducts);
} else {
    initializeCategoryProducts();
}

// Render Bestseller Section with horizontal scroll (funktionierender Code)
function renderBestsellers(products) {
    const grid = document.getElementById('bestsellerGrid');
    if (!grid) return;
    
    grid.innerHTML = products.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="lumiere-product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="lumiere-image-container">
                    <img src="produkt bilder/ware.png" class="lumiere-product-image" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none; align-items:center; justify-content:center; height:100%; background:#f5f5f5; color:#999; font-size:12px;">Bild nicht verfügbar</div>
                    <button class="lumiere-wishlist-btn" data-product-id="${product.id}" aria-label="Zur Wunschliste">
                        <i class="bi bi-heart"></i>
                    </button>
                </div>
                <div class="lumiere-card-content">
                    <h3 class="lumiere-product-title">${product.name}</h3>
                    <div class="lumiere-price-section">
                        <span class="lumiere-price">€${formattedPrice}</span>
                    </div>
                    <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}">
                        In den Warenkorb
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize wishlist buttons for bestsellers
    initializeWishlistButtons();
    initializeAddToCartButtons();
    
    // Initialize scrollbar tracking
    setTimeout(() => {
        initializeScrollbarTracking();
    }, 100);
}

// Load products into category containers
function loadCategoryProducts(products) {
    console.log('🔄 Loading products into category containers...');
    console.log('🔄 Total products available:', products.length);
    
    // Define category mappings
    const categoryMappings = {
        'technikGrid': 'Technik/Gadgets',
        'beleuchtungGrid': 'Beleuchtung', 
        'haushaltGrid': 'Haushalt und Küche',
        'wellnessGrid': 'Körperpflege/Wellness'
    };
    
    // For each category
    Object.entries(categoryMappings).forEach(([gridId, categoryName]) => {
        console.log(`🔧 Processing category: ${categoryName} -> ${gridId}`);
        
        const grid = document.getElementById(gridId);
        if (!grid) {
            console.warn(`❌ Grid ${gridId} not found`);
            return;
        }
        
        // Filter products for this category
        const categoryProducts = products.filter(product => product.category === categoryName);
        console.log(`📦 ${categoryName}: ${categoryProducts.length} products found`);
        
        if (categoryProducts.length > 0) {
            console.log(`✅ Rendering ${categoryProducts.length} products to ${gridId}`);
            // Render products to this container
            renderProductsToGrid(categoryProducts, grid);
        } else {
            console.warn(`⚠️ No products found for category: ${categoryName}`);
        }
    });
    
    console.log('✅ Category products loading completed');
    
    // Initialize scrollbar tracking for all category grids after products are loaded
    setTimeout(() => {
        if (typeof initializeScrollbarTracking === 'function') {
            initializeScrollbarTracking();
        }
    }, 200);
}

// Make function globally available
window.loadCategoryProducts = loadCategoryProducts;

// ===== FULLSCREEN SEARCH FUNCTIONALITY =====

// Global search variables
let allProducts = [];
let searchOverlay = null;
let searchInput = null;
let searchResults = null;
let searchResultsGrid = null;

// Initialize fullscreen search when DOM is ready
function initializeFullscreenSearch() {
    console.log('🔍 Initializing fullscreen search...');
    
    // Wait for DOM elements to be available
    setTimeout(() => {
        // Get DOM elements
        const fullscreenSearchBtn = document.getElementById('fullscreenSearchBtn');
        const closeSearchBtn = document.getElementById('closeSearchBtn');
        searchOverlay = document.getElementById('fullscreenSearchOverlay');
        searchInput = document.getElementById('fullscreenSearchInput');
        searchResults = document.getElementById('searchResults');
        searchResultsGrid = document.getElementById('searchResultsGrid');
        
        console.log('🔍 Search elements found:', {
            searchBtn: !!fullscreenSearchBtn,
            overlay: !!searchOverlay,
            input: !!searchInput
        });
        
        if (!fullscreenSearchBtn || !searchOverlay) {
            console.error('❌ Fullscreen search elements not found');
            // Try again in 1 second
            setTimeout(initializeFullscreenSearch, 1000);
            return;
        }
        
        // Remove any existing event listeners
        fullscreenSearchBtn.removeEventListener('click', handleSearchButtonClick);
        
        // Open search overlay
        fullscreenSearchBtn.addEventListener('click', handleSearchButtonClick);
        
        // Close search overlay
        if (closeSearchBtn) {
            closeSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeSearchOverlay();
            });
        }
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
                closeSearchOverlay();
            }
        });
        
        // Close on overlay background click
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                closeSearchOverlay();
            }
        });
        
        // Search input functionality - FORCE TEST
        console.log('🔧 Looking for search input...');
        const testInput = document.getElementById('fullscreenSearchInput');
        console.log('🔧 Found input:', testInput);
        
        if (testInput) {
            console.log('✅ Search input found, adding FORCE event listeners');
            
            // Multiple event listeners to catch everything
            testInput.addEventListener('input', function(e) {
                console.log('🔍 INPUT EVENT:', e.target.value);
                testSearchFunction(e.target.value);
            });
            
            testInput.addEventListener('keyup', function(e) {
                console.log('🔍 KEYUP EVENT:', e.target.value);
                testSearchFunction(e.target.value);
            });
            
            testInput.addEventListener('change', function(e) {
                console.log('🔍 CHANGE EVENT:', e.target.value);
                testSearchFunction(e.target.value);
            });
            
        } else {
            console.error('❌ Search input STILL not found!');
            // Try to find it by class
            const inputByClass = document.querySelector('.fullscreen-search-input');
            console.log('🔧 Input by class:', inputByClass);
        }
        
        // Category buttons now use direct onclick handlers
        
        // Popular search tags (removed - no longer needed)
        
        console.log('✅ Search button event listener added');
    }, 100);
}

// Handle search button click
function handleSearchButtonClick(e) {
    console.log('🔍 Search button clicked!');
    e.preventDefault();
    e.stopPropagation();
    openSearchOverlay();
}

// Open search overlay
function openSearchOverlay() {
    console.log('🔍 Opening search overlay...');
    
    if (searchOverlay) {
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Focus on search input after animation
        setTimeout(() => {
            if (searchInput) {
                searchInput.focus();
            }
        }, 300);
        
        // Load products if not already loaded
        if (allProducts.length === 0) {
            loadProducts().then(products => {
                allProducts = products;
                console.log('📦 Products loaded for search:', allProducts.length);
                loadAllProducts();
                
            });
        } else {
            loadAllProducts();
        }
    }
}

// Close search overlay
function closeSearchOverlay() {
    console.log('🔍 Closing search overlay...');
    
    if (searchOverlay) {
        searchOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        
        // Clear search
        if (searchInput) {
            searchInput.value = '';
        }
        if (searchResults) {
            searchResults.style.display = 'none';
        }
    }
}

// REAL SEARCH FUNCTION
function testSearchFunction(query) {
    console.log('🔍 REAL SEARCH FUNCTION CALLED WITH:', `"${query}"`);
    
    const grid = document.getElementById('searchAllProductsGrid');
    if (!grid) {
        console.error('❌ Grid not found!');
        return;
    }
    
    // Reset category buttons
    const allButtons = document.querySelectorAll('.lumiere-category-tab');
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    if (query.length === 0) {
        console.log('🔍 Empty query - loading all products');
        const allButton = document.querySelector('.lumiere-category-tab[data-category="alle"]');
        if (allButton) {
            allButton.classList.add('active');
        }
        
        // Reset title
        const title = document.querySelector('.search-all-products .search-section-title');
        if (title) {
            title.textContent = 'VIELLEICHT INTERESSIERT SIE DAS FOLGENDE';
        }
        
        loadAllProducts();
        return;
    }
    
    console.log('🔍 Searching for products with:', query);
    
    // Load products and filter
    loadProducts().then(products => {
        console.log('📦 Total products:', products.length);
        
        const searchText = query.toLowerCase();
        const filtered = products.filter(product => {
            const name = (product.name || '').toLowerCase();
            const match = name.includes(searchText);
            if (match) {
                console.log('✅ Found match:', product.name);
            }
            return match;
        });
        
        console.log('🔍 Filtered results:', filtered.length);
        
        // Clear and render
        grid.innerHTML = '';
        
        if (filtered.length === 0) {
            grid.innerHTML = `<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte mit "${query}" im Namen gefunden</div>`;
        } else {
            // Render filtered products
            grid.innerHTML = filtered.map(product => {
                const price = product.price || product.salePrice || 0;
                const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
                
                return `
                    <div class="lumiere-product-card search-product-card" data-product-id="${product.id}" data-category="${product.category}">
                        <div class="lumiere-image-container">
                            <img src="produkt bilder/ware.png" data-src="produkt bilder/ware.png" class="lumiere-product-image lazy-load" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="display:none; align-items:center; justify-content:center; height:100%; background:#f5f5f5; color:#999; font-size:12px;">Bild nicht verfügbar</div>
                            <button class="lumiere-wishlist-btn" data-product-id="${product.id}" aria-label="Zur Wunschliste">
                                <i class="bi bi-heart"></i>
                            </button>
                        </div>
                        <div class="lumiere-card-content">
                            <h3 class="lumiere-product-title">${product.name}</h3>
                            <div class="lumiere-price-section">
                                <span class="lumiere-price">€${formattedPrice}</span>
                            </div>
                            <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}">
                                In den Warenkorb
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Initialize buttons for new products
            initializeAddToCartButtons();
            initializeWishlistButtons();
            initializeProductCardClicks();
        }
        
        // Update title
        const title = document.querySelector('.search-all-products .search-section-title');
        if (title) {
            title.textContent = filtered.length > 0 
                ? `SUCHERGEBNISSE FÜR "${query.toUpperCase()}" (${filtered.length})`
                : `KEINE ERGEBNISSE FÜR "${query.toUpperCase()}"`;
        }
        
    }).catch(error => {
        console.error('❌ Search error:', error);
    });
}

// Simple and direct search function
function performSearch(query) {
    console.log('🔍 performSearch called with:', `"${query}"`);
    
    const grid = document.getElementById('searchAllProductsGrid');
    if (!grid) {
        console.error('❌ Grid not found!');
        return;
    }
    
    console.log('✅ Grid found:', grid);
    
    if (query.length === 0) {
        console.log('🔍 Empty query - showing all products');
        loadAllProducts();
        return;
    }
    
    console.log('🔍 Filtering products for:', query);
    
    // Get all products and filter immediately
    if (window.allProducts && window.allProducts.length > 0) {
        console.log('📦 Using cached products:', window.allProducts.length);
        filterAndDisplay(window.allProducts, query, grid);
    } else {
        console.log('📦 Loading products from JSON...');
        loadProducts().then(products => {
            console.log('📦 Products loaded:', products.length);
            window.allProducts = products; // Cache for next time
            filterAndDisplay(products, query, grid);
        }).catch(error => {
            console.error('❌ Error loading products:', error);
        });
    }
}

function filterAndDisplay(products, query, grid) {
    console.log('🔍 filterAndDisplay called with:', products.length, 'products, query:', `"${query}"`);
    
    const searchText = query.toLowerCase();
    const filtered = products.filter(product => {
        const name = (product.name || '').toLowerCase();
        const match = name.includes(searchText);
        if (match) {
            console.log('✅ Match:', product.name);
        }
        return match;
    });
    
    console.log('🔍 Filtered results:', filtered.length);
    
    // Clear grid completely
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte mit "${query}" im Namen gefunden</div>`;
        console.log('❌ No matches - showing empty message');
    } else {
        console.log('✅ Rendering', filtered.length, 'products');
        renderAllProducts(grid, filtered);
    }
    
    // Update title
    const title = document.querySelector('.search-all-products .search-section-title');
    if (title) {
        title.textContent = filtered.length > 0 
            ? `SUCHERGEBNISSE FÜR "${query.toUpperCase()}" (${filtered.length})`
            : `KEINE ERGEBNISSE FÜR "${query.toUpperCase()}"`;
    }
}

// Handle category search
function handleCategorySearch(category) {
    console.log('🔍 Category search:', category);
    
    // Load products first, then filter
    loadProducts().then(products => {
        let filteredProducts = [];
        
        if (category === 'alle') {
            filteredProducts = products;
        } else {
            // Filter products by exact category match
            filteredProducts = products.filter(product => {
                const productCategory = product.category;
                console.log(`🔍 Checking product: ${product.name} - Category: "${productCategory}" vs Filter: "${category}"`);
                return productCategory === category;
            });
        }
        
        console.log('🔍 Found', filteredProducts.length, 'products for category:', category);
        console.log('🔍 Available categories:', [...new Set(products.map(p => p.category))]);
        console.log('🔍 Filtered products:', filteredProducts.map(p => p.name));
        
        // Update the main products grid instead of search results
        const allProductsGrid = document.getElementById('searchAllProductsGrid');
        if (allProductsGrid) {
            renderAllProducts(allProductsGrid, filteredProducts);
        }
        
        // Hide "VIELLEICHT INTERESSIERT SIE DAS FOLGENDE" title when filtering
        const sectionTitle = document.querySelector('.search-all-products .search-section-title');
        if (sectionTitle) {
            if (category === 'alle') {
                sectionTitle.textContent = 'VIELLEICHT INTERESSIERT SIE DAS FOLGENDE';
            } else {
                const categoryNames = {
                    'Technik/Gadgets': 'TECHNIK PRODUKTE',
                    'Beleuchtung': 'BELEUCHTUNG PRODUKTE',
                    'Körperpflege/Wellness': 'WELLNESS PRODUKTE',
                    'Haushalt und Küche': 'KÜCHEN PRODUKTE'
                };
                sectionTitle.textContent = categoryNames[category] || category.toUpperCase() + ' PRODUKTE';
            }
        }
    }).catch(error => {
        console.error('❌ Error during category search:', error);
    });
}

// Display search results
function displaySearchResults(products, query) {
    if (!searchResults || !searchResultsGrid) {
        console.error('❌ Search results elements not found');
        return;
    }
    
    // Show results section
    searchResults.style.display = 'block';
    
    // Update title
    const title = searchResults.querySelector('.search-section-title');
    if (title) {
        title.textContent = `Suchergebnisse für "${query}" (${products.length})`;
    }
    
    // Clear previous results
    searchResultsGrid.innerHTML = '';
    
    if (products.length === 0) {
        searchResultsGrid.innerHTML = `
            <div class="no-results">
                <i class="bi bi-search" style="font-size: 48px; color: var(--lumiere-gray-400); margin-bottom: 20px;"></i>
                <h4>Keine Ergebnisse gefunden</h4>
                <p>Versuche es mit anderen Suchbegriffen oder durchsuche unsere Kategorien.</p>
            </div>
        `;
        return;
    }
    
    // Render search results
    searchResultsGrid.innerHTML = products.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="search-result-item" data-product-id="${product.id}" onclick="navigateToProduct(${product.id})">
                <div class="search-result-category">${product.category}</div>
                <img src="produkt bilder/ware.png" alt="${product.name}" class="search-result-image" loading="lazy">
                <h4 class="search-result-title">${product.name}</h4>
                <div class="search-result-price">€${formattedPrice}</div>
            </div>
        `;
    }).join('');
    
    // Scroll to results
    searchResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Hide search results
function hideSearchResults() {
    if (searchResults) {
        searchResults.style.display = 'none';
    }
}

// Load all products for search overlay
function loadAllProducts() {
    console.log('🔍 Loading all products...');
    
    const allProductsGrid = document.getElementById('searchAllProductsGrid');
    if (!allProductsGrid) {
        console.log('❌ All products grid not found');
        return;
    }
    
    // Always load products fresh
    loadProducts().then(products => {
        console.log('📦 Products loaded for search grid:', products.length);
        renderAllProducts(allProductsGrid, products);
    }).catch(error => {
        console.error('❌ Error loading products:', error);
    });
}

function renderAllProducts(allProductsGrid, products) {
    console.log('🎨 renderAllProducts called with:', products ? products.length : 'null', 'products');
    
    if (!allProductsGrid) {
        console.error('❌ Grid element is null!');
        return;
    }
    
    if (!products || products.length === 0) {
        console.log('❌ No products to render - clearing grid');
        allProductsGrid.innerHTML = '<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte gefunden</div>';
        return;
    }
    
    console.log('🎨 Rendering products to grid:', products.length);
    
    // Render all products with new style
    allProductsGrid.innerHTML = products.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="lumiere-product-card search-product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="lumiere-image-container">
                    <img src="produkt bilder/ware.png" data-src="produkt bilder/ware.png" class="lumiere-product-image lazy-load" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none; align-items:center; justify-content:center; height:100%; background:#f5f5f5; color:#999; font-size:12px;">Bild nicht verfügbar</div>
                    <button class="lumiere-wishlist-btn" data-product-id="${product.id}" aria-label="Zur Wunschliste">
                        <i class="bi bi-heart"></i>
                    </button>
                </div>
                <div class="lumiere-card-content">
                    <h3 class="lumiere-product-title">${product.name}</h3>
                    <div class="lumiere-price-section">
                        <span class="lumiere-price">€${formattedPrice}</span>
                    </div>
                    <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}">
                        In den Warenkorb
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Products rendered successfully:', products.length);
    
    // Initialize buttons like on main page
    initializeAddToCartButtons();
    initializeWishlistButtons();
    initializeProductCardClicks();
}

// Simple onclick function for search categories
function searchCategoryClick(button, category) {
    console.log('🔍 Search category clicked:', category);
    
    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.lumiere-category-tab');
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    button.classList.add('active');
    
    // Handle the category search
    handleCategorySearch(category);
}

// Navigate to product
function navigateToProduct(productId) {
    console.log('🔗 Navigating to product:', productId);
    
    // Close search overlay first
    closeSearchOverlay();
    
    // Navigate to product page (only for products with ID >= 10)
    if (productId >= 10) {
        setTimeout(() => {
            window.location.href = `produkte/produkt-${productId}.html`;
        }, 300);
    } else {
        console.log('Product page does not exist for ID:', productId);
    }
}

// Make functions globally available
window.navigateToProduct = navigateToProduct;
window.openSearchOverlay = openSearchOverlay;
window.closeSearchOverlay = closeSearchOverlay;
window.loadAllProducts = loadAllProducts;
window.searchCategoryClick = searchCategoryClick;
window.testSearchFunction = testSearchFunction;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFullscreenSearch);
} else {
    initializeFullscreenSearch();
}

// Additional initialization after window load
window.addEventListener('load', () => {
    console.log('🔍 Window loaded, ensuring search is initialized...');
    
    // Double-check initialization
    const searchBtn = document.getElementById('fullscreenSearchBtn');
    if (searchBtn && !searchBtn.hasAttribute('data-initialized')) {
        console.log('🔍 Re-initializing search...');
        searchBtn.setAttribute('data-initialized', 'true');
        searchBtn.addEventListener('click', handleSearchButtonClick);
    }
});

// Emergency fallback - direct event binding
document.addEventListener('click', (e) => {
    if (e.target.id === 'fullscreenSearchBtn' || e.target.closest('#fullscreenSearchBtn')) {
        console.log('🔍 Emergency search activation!');
        e.preventDefault();
        e.stopPropagation();
        openSearchOverlay();
    }
});

// Global event delegation for search functionality - removed, using direct event listeners instead
window.loadCategoryProducts = loadCategoryProducts;