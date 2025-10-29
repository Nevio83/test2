// Warenkorb-Initialisierung
let cartItems = JSON.parse(localStorage.getItem('cart')) || [];

// Verhindere mehrfache Initialisierung
let addToCartButtonsInitialized = false;

// Make sure clearCart is globally available immediately
window.clearCart = function() {
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
      // FlÃ¼ssige SchlieÃŸ-Animation
      cartDropdown.classList.add('hiding');
      cartDropdown.classList.remove('show');
      
      setTimeout(() => {
        cartDropdown.style.display = 'none';
        cartDropdown.classList.remove('hiding');
      }, 300);
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

// Globale Produktliste
let products = [];

function initializeProductPageWishlist() {
    const productPageButtons = document.querySelectorAll('.wishlist-button');
    if (productPageButtons.length > 0 && window.product) {
        console.log(`ðŸ’œ Initializing ${productPageButtons.length} wishlist buttons on product page...`);
        productPageButtons.forEach(button => {
            // Remove old listeners to be safe
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                // Use the global product object defined on the page
                toggleWishlist(window.product);
            });
        });
        // Update state on load
        updateAllWishlistButtonsStates(window.product.id);
    }
}

function updateAllWishlistButtonsStates(productId) {
    const isInList = isInWishlist(productId);
    document.querySelectorAll(`[data-product-id="${productId}"]`).forEach(btn => {
        if (btn.classList.contains('wishlist-button') || btn.classList.contains('lumiere-wishlist-btn')) {
            // Toggle active state and icon
            btn.classList.toggle('active', isInList);
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = isInList ? 'bi bi-heart-fill' : 'bi bi-heart';
            }
            // If this is a product page wishlist button with text, update the label like product 10
            if (btn.classList.contains('wishlist-button')) {
                btn.innerHTML = isInList
                    ? '<i class="bi bi-heart-fill"></i> Entfernen'
                    : '<i class="bi bi-heart"></i> Zur Wunschliste';
            }
        }
    });
}

// Produktdaten laden mit Cache-Busting
async function loadProducts() {
  try {
    // Cache-busting für products.json
    const cacheBuster = Date.now();
    // Prüfe ob wir auf einer Produktseite sind (im produkte/ Ordner)
    const isProductPage = window.location.pathname.includes('/produkte/');
    const jsonPath = isProductPage ? '../products.json' : 'products.json';
    const response = await fetch(`${jsonPath}?v=${cacheBuster}`);
    products = await response.json(); // Nutze die globale Variable
    
    // Speichere im localStorage als Backup
    localStorage.setItem('allProducts', JSON.stringify(products));
    
    console.log('ðŸ“‹ Products loaded with cache-busting:', products.length);
    
    // Validiere kritische Produkte (die 6 problematischen)
    const criticalIds = [10, 11, 19, 20, 24, 25];
    criticalIds.forEach(id => {
      const product = products.find(p => Number(p.id) === id);
      if (product) {
        console.log(`âœ… Critical product ${id} found:`, product.name);
        // Prüfe auf kaputte Preise
        if (typeof product.price !== 'number' || isNaN(product.price)) {
          console.error(`âŒ Product ${id} has invalid price:`, product.price);
        }
      } else {
        console.error(`âŒ Critical product ${id} NOT FOUND!`);
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

function toggleWishlist(productOrId) {
  // Handle both product object and product ID
  let productId, productObj;
  
  if (typeof productOrId === 'object' && productOrId !== null) {
    // It's a product object
    productObj = productOrId;
    productId = productOrId.id;
  } else {
    // It's a product ID
    productId = productOrId;
    productObj = null;
  }
  
  // Trigger animation immediately for better responsiveness
  //triggerWishlistButtonAnimation(productId);
  
  // If we already have the product object, use it directly
  if (productObj) {
    handleWishlistToggle(productObj);
  } else {
    // Load products and find the one we need
    loadProducts().then(products => {
      const product = products.find(p => Number(p.id) === Number(productId));
      if (!product) {
        console.error('Produkt für die Wunschliste nicht gefunden! ID:', productId, products);
        alert('Produkt konnte nicht zur Wunschliste hinzugefügt werden.');
        return;
      }
      handleWishlistToggle(product);
    });
  }
}

function handleWishlistToggle(product) {
  let wishlist = getWishlist();
  const wasInWishlist = isInWishlist(product.id);
  
  if (wasInWishlist) {
    wishlist = wishlist.filter(item => Number(item.id) !== Number(product.id));
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
  const wishlistButtons = document.querySelectorAll(`.lumiere-wishlist-btn[data-product-id="${product.id}"]`);
  wishlistButtons.forEach(wishlistButton => {
    if (wishlistButton) {
      wishlistButton.classList.toggle('active', !wasInWishlist);
      const icon = wishlistButton.querySelector('i');
      if (icon) {
        icon.className = wasInWishlist ? 'bi bi-heart' : 'bi bi-heart-fill';
      }
    }
  });
  // Also update product page wishlist buttons instantly
  try {
    updateAllWishlistButtonsStates(product.id);
  } catch (_) {}
  
  // Update navigation wishlist counter if it exists
  updateWishlistCounter();
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

// Produktgrid rendern - LumiÃ¨re Design Style
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
          <img src="${product.image}" class="lumiere-product-image" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" loading="lazy">
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
  initializeProductPageWishlist(); // <-- HIER HINZUGEFÜGT
  observeProductCards();
  
  // Images are now loaded directly with native lazy loading
  
  // No need to optimize images anymore
}

// Ensure product page wishlist init runs on product pages too
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.product) {
      initializeProductPageWishlist();
      updateAllWishlistButtonsStates(window.product.id);
    }
  } catch (e) {
    console.warn('Product page wishlist init failed:', e);
  }
});

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
  console.log('ðŸ›’ Initializing AddToCart buttons...');
  
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
        console.log(`ðŸ” SPECIAL: Initializing problematic product button ${productId}`);
        console.log(`ðŸ” Button parent:`, button.parentNode?.className);
        console.log(`ðŸ” Button data-product-id:`, button.getAttribute('data-product-id'));
      }
      
      // Klone Button um alle Event-Listener zu entfernen
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // FÃ¼ge den Event Listener zum neuen Button hinzu
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
            this.innerHTML = '<i class="bi bi-check"></i> HinzugefÃ¼gt';
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
    
    console.log('âœ… AddToCart buttons initialization completed');
  }, 100);
}

// Produktkarten-Klicks initialisieren
function initializeProductCardClicks() {
  console.log('ðŸ”— Initializing product card clicks...');
  
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
      
      console.log(`ðŸ”— Navigating to product page for ID: ${productId}`);
      
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
  
  console.log('âœ… Product card clicks initialized');
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

function addProductToCart(productsParam, productId, fromCartDropdown = false) {
  // Fallback: Wenn keine Produkte übergeben wurden oder die globale Variable leer ist, lade sie
  if ((!productsParam || productsParam.length === 0) && (!products || products.length === 0)) {
    console.log('âš ï¸ Keine Produkte verfügbar, lade aus localStorage oder JSON...');
    // Versuche aus localStorage
    const storedProducts = localStorage.getItem('allProducts');
    if (storedProducts) {
      products = JSON.parse(storedProducts);
      console.log('ðŸ“¦ Produkte aus localStorage geladen:', products.length);
    }
  }
  
  // Verwende die übergebenen Produkte oder die globale Variable
  const availableProducts = productsParam && productsParam.length > 0 ? productsParam : products;
  console.log('Looking for product ID:', productId, 'in', availableProducts.length, 'products');
  
  const product = availableProducts.find(p => Number(p.id) === Number(productId));
  
  if (!product) {
    console.error('Product not found for ID:', productId);
    console.log('Available product IDs:', availableProducts.map(p => p.id));
    if (!fromCartDropdown) {
      alert('Produkt konnte nicht gefunden werden.');
    }
    return;
  }
  
  console.log('Found product:', product.name);
  
  // Check if cart dropdown is currently open before adding product
  const cartDropdown = document.getElementById('cartDropdown');
  const wasDropdownOpen = cartDropdown && cartDropdown.classList.contains('show');
  console.log('Cart dropdown was open before adding product:', wasDropdownOpen);
  
  // Always read from localStorage to ensure we have the latest data
  cartItems = JSON.parse(localStorage.getItem('cart')) || [];
  
  // VEREINFACHTE Logik: Verschiedene Farben = Verschiedene Artikel
  let existingItem;
  
  // Hole aktuelle Farbinformationen - UNIVERSELL für alle Produkte
  let currentColor = null;
  let currentColorData = null;
  
  // Methode 1: window.product (für Produkt 10)
  if (window.product && window.product.selectedColor) {
    currentColor = window.product.selectedColor;
    currentColorData = {
      name: window.product.selectedColor,
      code: window.product.selectedColorCode,
      sku: window.product.selectedColorSku,
      price: window.product.price
    };
    console.log('ðŸŽ¨ Farbe von window.product:', currentColor);
  }
  
  // Methode 2: getSelectedColor() (für Produkt 11, 12, 17, 21, 26)
  else if (window.getSelectedColor && typeof window.getSelectedColor === 'function') {
    const selectedColorObj = window.getSelectedColor();
    console.log('ðŸ” getSelectedColor() Ergebnis:', selectedColorObj);
    
    if (selectedColorObj && selectedColorObj.name) {
      currentColor = selectedColorObj.name;
      currentColorData = selectedColorObj;
      console.log(`getSelectedColor() returned color: ${currentColor}, data:`, selectedColorObj);
    } else {
      console.log('getSelectedColor() did not return valid data');
    }
  } else {
    console.log('getSelectedColor() function not found');
  }
  
  console.log('ðŸ" Finale Farbe für Warenkorb:', currentColor);
  
  if (currentColor) {
    // Bei Produkten mit Farbe: Nur EXAKT gleiche ID + Farbe ist "existing"
    // WICHTIG: Bundles NIE zusammenführen
    existingItem = cartItems.find(item => 
      item.isBundle !== true &&
      Number(item.id) === Number(productId) && 
      item.selectedColor === currentColor
    );
    console.log(`ðŸŽ¨ Suche nach Produkt ${productId} mit Farbe "${currentColor}":`, existingItem ? 'GEFUNDEN - Menge erhöhen' : 'NEUER ARTIKEL');
  } else {
    // Bei Produkten ohne Farbe: Nur ID prüfen (und keine Farbe vorhanden)
    // WICHTIG: Bundles NIE zusammenführen
    existingItem = cartItems.find(item => 
      item.isBundle !== true &&
      Number(item.id) === Number(productId) && 
      !item.selectedColor
    );
    console.log(`ðŸ“¦ Suche nach Produkt ${productId} OHNE Farbe:`, existingItem ? 'GEFUNDEN - Menge erhöhen' : 'NEUER ARTIKEL');
  }

  if (existingItem) {
    existingItem.quantity++;
    console.log('Updated existing item quantity:', existingItem.quantity);
  } else {
    // Erstelle neuen Warenkorb-Artikel
    let productToAdd = { ...product, quantity: 1 };
    
    if (currentColor && currentColorData) {
      // Produkt MIT Farbe - erstelle eindeutigen Artikel
      let cleanName = product.name.replace(/\s*\([^)]*\)$/, '');
      productToAdd = {
        ...productToAdd,
        name: `${cleanName} (${currentColor})`,
        selectedColor: currentColor,
        selectedColorCode: currentColorData.code || '#000000',
        selectedColorSku: currentColorData.sku || 'default',
        price: currentColorData.price || product.price,
        originalPrice: currentColorData.originalPrice || product.originalPrice,
        // Eindeutige ID für verschiedene Farben
        cartItemId: `${productId}-${currentColor.replace(/\s+/g, '-').toLowerCase()}`
      };
      console.log('ðŸŽ¨ NEUER Artikel mit Farbe:', productToAdd.name, '- ID:', productToAdd.cartItemId, '- Preis:', productToAdd.price);
    } else {
      // Produkt OHNE Farbe
      productToAdd.cartItemId = `${productId}-no-color`;
      console.log('ðŸ“¦ NEUER Artikel ohne Farbe:', productToAdd.name, '- ID:', productToAdd.cartItemId);
    }
    
    cartItems.push(productToAdd);
    console.log('âœ… Artikel zum Warenkorb hinzugefügt:', productToAdd);
  }

  // Speichere den aktuellen Warenkorb immer im localStorage
  // Nutze saveCartWithColor falls verfügbar (aus cart.js)
  if (typeof saveCartWithColor === 'function') {
    saveCartWithColor(cartItems);
  } else {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }
  
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

  // Keep cart dropdown open if it was open before adding the product
  if (wasDropdownOpen && cartDropdown) {
    setTimeout(() => {
      console.log('Keeping cart dropdown open after adding product');
      cartDropdown.classList.add('show');
      cartDropdown.style.display = 'block';
      // Re-render the dropdown to show updated content
      if (typeof renderCartDropdown === 'function') {
        renderCartDropdown();
      }
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
    createFloatingSuccessIndicator(wishlistButton, 'â™¥', 'wishlist');
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
  // Korrigiere den Pfad für Produktseiten
  const isProductPage = window.location.pathname.includes('/produkte/');
  if (isProductPage && !redirectTo.startsWith('../')) {
    redirectTo = '../' + redirectTo;
  }
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
  console.log('ðŸš¨ RADICAL: Clearing all product grids and reloading...');
  
  // Clear all grids completely
  const grids = ['bestsellerGrid', 'technikGrid', 'beleuchtungGrid', 'haushaltGrid', 'wellnessGrid'];
  grids.forEach(gridId => {
    const grid = document.getElementById(gridId);
    if (grid) {
      grid.innerHTML = '';
      console.log(`ðŸ—‘ï¸ Cleared ${gridId}`);
    }
  });
  
  // Force reload products after clearing
  setTimeout(() => {
    console.log('ðŸ”„ Reloading products after clearing...');
    loadProducts().then(products => {
      if (products.length > 0) {
        console.log('âœ… Products reloaded, rendering to grids...');
        
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
        
        console.log('ðŸŽ‰ RADICAL reload completed!');
      }
    });
  }, 100);
}

// Make it globally available
window.radicalProductReload = radicalProductReload;

// NUCLEAR OPTION: Clear everything and start fresh
function nuclearReset() {
  console.log('ðŸ’¥ NUCLEAR RESET: Clearing all caches and restarting...');
  
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
  console.log('ðŸ” DEEP DIAGNOSIS: Analyzing the 6 problematic products...');
  
  const problematicIds = [10, 11, 19, 20, 24, 25];
  
  problematicIds.forEach(id => {
    console.log(`\nðŸ” === ANALYZING PRODUCT ${id} ===`);
    
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
  console.log('\nðŸ” === COMPARING WITH WORKING PRODUCT ===');
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
    
    // Filter AliExpress products (showInSlider: false)
    const notHidden = product.showInSlider !== false;
    
    // Einfaches Logging nur bei Problemen
    if (category === 'Technik/Gadgets' && product.category === 'Technik/Gadgets') {
      console.log(`âœ… Technik product: ${product.name}`);
    }
    
    return matchesSearch && matchesCategory && notHidden;
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
  // Skip initialization on cart.html page
  if (window.location.pathname.includes('cart.html')) {
    return;
  }
  
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
      
      // Flüssige Animation beim Öffnen/Schließen
      if (cartDropdown.classList.contains('show')) {
        // Schließen mit Animation
        cartDropdown.classList.add('hiding');
        cartDropdown.classList.remove('show');
        
        setTimeout(() => {
          cartDropdown.style.display = 'none';
          cartDropdown.classList.remove('hiding');
          console.log('Cart dropdown hidden with animation');
        }, 300); // Wartet auf die Schließ-Animation
      } else {
        // Öffnen mit Animation
        cartDropdown.style.display = 'block';
        // Kurze Verzögerung für smooth Animation
        requestAnimationFrame(() => {
          cartDropdown.classList.add('show');
          console.log('Cart dropdown shown with animation');
        });
      }
    }
    
    cartButton.addEventListener('click', handleCartClick);
  } else {
    console.error('Cart elements not found:', { cartButton: !!cartButton, cartDropdown: !!cartDropdown });
  }
  if (closeCartDropdown && cartDropdown) {
    closeCartDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      // FlÃ¼ssige SchlieÃŸ-Animation
      cartDropdown.classList.add('hiding');
      cartDropdown.classList.remove('show');
      
      setTimeout(() => {
        cartDropdown.style.display = 'none';
        cartDropdown.classList.remove('hiding');
      }, 300);
    });
  }

  // Close cart dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (cartDropdown && cartDropdown.classList.contains('show')) {
      // Check if click is outside the cart dropdown and cart button
      if (!cartDropdown.contains(e.target) && !cartButton.contains(e.target)) {
        // FlÃ¼ssige SchlieÃŸ-Animation
        cartDropdown.classList.add('hiding');
        cartDropdown.classList.remove('show');
        
        setTimeout(() => {
          cartDropdown.style.display = 'none';
          cartDropdown.classList.remove('hiding');
        }, 300);
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

  // Reset category filter when clicking on Maios logo
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
          <span class="category-icon">ðŸ“‹</span>
          <span class="category-text">Alle Kategorien</span>
          <span class="dropdown-arrow">â–¼</span>
        `;
        customDropdown.classList.remove('open');
      }
      
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  }
}

function setupClearCartButton() {
  // Skip on cart.html page as it has its own clear cart logic
  if (window.location.pathname.includes('cart.html')) {
    return;
  }
  
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
    // Footer bleibt immer sichtbar
    footer.style.display = 'block';
    footer.style.visibility = 'visible';
    totalElement.textContent = '0.00'; // Gesamt auf 0 setzen bei leerem Warenkorb
    
    // Bei leerem Warenkorb: 3 zufÃ¤llige ProduktvorschlÃ¤ge anzeigen
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
      
      // 3 zufällige Produkte auswählen (ohne AliExpress)
      const filteredProducts = products.filter(p => p.showInSlider !== false);
      const shuffled = [...filteredProducts].sort(() => 0.5 - Math.random());
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
      `;
    });
    return;
  }
  
  console.log('Rendering cart items:', cartItems.length);
  footer.style.display = 'block';
  footer.style.visibility = 'visible';
  console.log('Footer should now be visible:', footer.style.display, footer.style.visibility);
  
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
    const availableProducts = products.filter(product => !cartProductIds.includes(product.id) && product.showInSlider !== false);
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
  
  // Ensure footer is ALWAYS visible
  footer.style.display = 'block';
  footer.style.visibility = 'visible';
  footer.style.opacity = '1';
  footer.style.position = 'relative';
  console.log('Footer forced visible - items:', cartItems.length);
  
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
  
  // Final safety check - ensure footer AND buttons are always visible (especially on PC)
  setTimeout(() => {
    const finalFooter = document.getElementById('cartDropdownFooter');
    const checkoutBtn = document.querySelector('.cart-dropdown-footer .btn-primary');
    const clearBtn = document.getElementById('clearCart');
    
    console.log('PC Button visibility check - Elements found:', {
      footer: !!finalFooter,
      checkoutBtn: !!checkoutBtn,
      clearBtn: !!clearBtn
    });
    
    if (finalFooter) {
      finalFooter.style.display = 'block';
      finalFooter.style.visibility = 'visible';
      finalFooter.style.opacity = '1';
      finalFooter.style.position = 'relative';
      finalFooter.style.zIndex = '9999';
      finalFooter.style.background = 'white';
      finalFooter.style.borderTop = '1px solid #ddd';
      finalFooter.style.padding = '20px';
      console.log('Final footer visibility check completed');
    }
    
    if (checkoutBtn) {
      checkoutBtn.style.display = 'block';
      checkoutBtn.style.visibility = 'visible';
      checkoutBtn.style.opacity = '1';
      checkoutBtn.style.position = 'relative';
      checkoutBtn.style.zIndex = '9999';
      checkoutBtn.style.width = '100%';
      checkoutBtn.style.height = '44px';
      checkoutBtn.style.lineHeight = '44px';
      checkoutBtn.style.textAlign = 'center';
      checkoutBtn.style.marginBottom = '8px';
      checkoutBtn.style.background = '#007bff';
      checkoutBtn.style.color = 'white';
      checkoutBtn.style.border = 'none';
      checkoutBtn.style.borderRadius = '8px';
      checkoutBtn.style.textDecoration = 'none';
      console.log('Checkout button forced visible with full styling');
    }
    
    if (clearBtn) {
      clearBtn.style.display = 'block';
      clearBtn.style.visibility = 'visible';
      clearBtn.style.opacity = '1';
      clearBtn.style.position = 'relative';
      clearBtn.style.zIndex = '9999';
      clearBtn.style.width = '100%';
      clearBtn.style.height = '44px';
      clearBtn.style.border = '2px solid #dc3545';
      clearBtn.style.color = '#dc3545';
      clearBtn.style.background = 'white';
      clearBtn.style.borderRadius = '8px';
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.fontSize = '16px';
      clearBtn.style.lineHeight = '40px';
      clearBtn.style.textAlign = 'center';
      // Ensure button has text content
      if (!clearBtn.textContent.includes('Löschen')) {
        clearBtn.innerHTML = '<i class="bi bi-trash" style="font-size: 1.2rem; margin-right: 8px;"></i> Löschen';
      }
      console.log('Clear button forced visible with full styling and text');
    }
    
    // Extra check for PC browsers
    if (window.innerWidth >= 769) {
      console.log('PC detected - applying extra button visibility measures');
      const allFooterBtns = document.querySelectorAll('.cart-dropdown-footer .btn');
      allFooterBtns.forEach((btn, index) => {
        btn.style.display = 'block';
        btn.style.visibility = 'visible';
        btn.style.opacity = '1';
        btn.style.position = 'relative';
        btn.style.zIndex = '9999';
        console.log(`PC Button ${index + 1} forced visible`);
      });
    }
  }, 200);
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
                    <img src="${product.image}" class="lumiere-product-image" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
    
    console.log(`ðŸ”§ Scrolling ${gridId} ${direction}`);
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
    // Skip on cart.html page
    if (window.location.pathname.includes('cart.html')) {
        return;
    }
    
    const grids = ['bestsellerGrid', 'technikGrid', 'beleuchtungGrid', 'haushaltGrid', 'wellnessGrid'];
    
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (!grid) {
            // Only log if we're on index.html where these should exist
            if (!window.location.pathname.includes('cart.html')) {
                console.log(`Grid ${gridId} not found for scrollbar tracking`);
            }
            return;
        }
        
        console.log(`Initializing scrollbar tracking for ${gridId}`);
        
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
    console.log(`ðŸŽ¯ Setting up drag scroll for grid: ${container.id}`);
    
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
        console.log('ðŸŽ¯ Container drag started for:', container.id);
    });
    
    // Mouse up event
    container.addEventListener('mouseup', () => {
        if (isDown) {
            isDown = false;
            container.style.cursor = 'grab';
            console.log('ðŸŽ¯ Container drag ended for:', container.id);
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
    
    console.log(`âœ… Drag scroll initialized for: ${container.id}`);
}

// Create and initialize a custom scrollbar for a specific grid
function createCustomScrollbarForGrid(gridId) {
    console.log(`ðŸŽ¯ Creating custom scrollbar for: ${gridId}`);
    
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
        cursor: pointer;
        z-index: 1;
    `;
    
    // Add hover effects for the track
    scrollbarTrack.addEventListener('mouseenter', () => {
        scrollbarTrack.style.background = '#e0e0e0';
        scrollbarTrack.style.cursor = 'grab';
    });
    
    scrollbarTrack.addEventListener('mouseleave', () => {
        scrollbarTrack.style.background = '#f0f0f0';
        scrollbarTrack.style.cursor = 'pointer';
    });
    
    // Make the track draggable too
    let isTrackDragging = false;
    let trackStartX;
    let trackStartScrollLeft;
    
    scrollbarTrack.addEventListener('mousedown', (e) => {
        // Check if we're clicking on the thumb area
        const trackRect = scrollbarTrack.getBoundingClientRect();
        const thumbRect = scrollbarThumb.getBoundingClientRect();
        const clickX = e.clientX;
        
        // If clicking on thumb area, let thumb handle it
        if (clickX >= thumbRect.left && clickX <= thumbRect.right) {
            return;
        }
        
        isTrackDragging = true;
        scrollbarTrack.style.cursor = 'grabbing';
        trackStartX = e.clientX;
        trackStartScrollLeft = grid.scrollLeft;
        
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        
        e.preventDefault();
        e.stopPropagation();
        console.log('ðŸŽ¯ Track drag started for:', gridId);
    });
    
    // Add click-to-jump functionality for the track (when not dragging)
    scrollbarTrack.addEventListener('click', (e) => {
        if (isTrackDragging) return; // Don't jump if we were dragging
        
        const trackRect = scrollbarTrack.getBoundingClientRect();
        const clickX = e.clientX - trackRect.left;
        const trackWidth = trackRect.width;
        const thumbWidth = 100;
        
        // Calculate where to position the thumb center
        const thumbCenterX = Math.max(thumbWidth/2, Math.min(trackWidth - thumbWidth/2, clickX));
        const thumbLeftX = thumbCenterX - thumbWidth/2;
        
        // Calculate scroll percentage
        const maxThumbPosition = Math.max(0, trackWidth - thumbWidth);
        const scrollPercentage = maxThumbPosition > 0 ? thumbLeftX / maxThumbPosition : 0;
        const maxScrollLeft = grid.scrollWidth - grid.clientWidth;
        const newScrollLeft = scrollPercentage * maxScrollLeft;
        
        // Scroll to position
        grid.scrollTo({
            left: newScrollLeft,
            behavior: 'smooth'
        });
        
        console.log(`ðŸŽ¯ Track clicked: jumping to ${newScrollLeft}px`);
    });
    
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

    // Make scrollbar thumb draggable - IMPROVED
    let isDragging = false;
    let startX;
    let startScrollLeft;
    let startThumbLeft;

    function startDrag(clientX, event) {
        isDragging = true;
        scrollbarThumb.classList.add('dragging');
        scrollbarThumb.style.cursor = 'grabbing';
        startX = clientX;
        startScrollLeft = grid.scrollLeft;

        // Get current thumb position
        const thumbRect = scrollbarThumb.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        startThumbLeft = thumbRect.left - containerRect.left - 20; // 20px is left offset

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';

        event.preventDefault();
        event.stopPropagation();
        console.log('ðŸŽ¯ Scrollbar thumb drag started for:', gridId);
    }

    // Mouse events
    scrollbarThumb.addEventListener('mousedown', (e) => {
        startDrag(e.clientX, e);
    });

    // Touch events for mobile
    scrollbarThumb.addEventListener('touchstart', (e) => {
        startDrag(e.touches[0].clientX, e);
    }, { passive: false });

    // UNIFIED MOVE HANDLER FOR MOUSE AND TOUCH
    function handleMove(clientX, event) {
        if (isDragging) {
            event.preventDefault();
            
            const deltaX = clientX - startX;
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
            
            console.log(`ðŸŽ¯ Thumb dragging: thumbPos=${newThumbLeft}px, scrollPos=${newScrollLeft}px`);
        }
    }

    // Mouse move events
    document.addEventListener('mousemove', (e) => {
        handleMove(e.clientX, e);
        
        // Handle track dragging
        if (isTrackDragging) {
            e.preventDefault();
            
            const deltaX = e.clientX - trackStartX;
            const containerWidth = container.offsetWidth;
            const trackWidth = containerWidth - 130;
            const maxScrollLeft = grid.scrollWidth - grid.clientWidth;
            
            if (maxScrollLeft <= 0) return;
            
            // Calculate scroll movement (inverted for natural feel)
            const scrollSensitivity = 2; // Adjust sensitivity
            const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, trackStartScrollLeft + (deltaX * scrollSensitivity)));
            
            // Scroll grid
            grid.scrollTo({
                left: newScrollLeft,
                behavior: 'auto'
            });
            
            console.log(`ðŸŽ¯ Track dragging: scrollPos=${newScrollLeft}px`);
        }
    });

    // Touch move events
    document.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length > 0) {
            handleMove(e.touches[0].clientX, e);
        }
    }, { passive: false });
    
    // UNIFIED END HANDLER FOR MOUSE AND TOUCH
    function handleEnd() {
        if (isDragging) {
            isDragging = false;
            scrollbarThumb.classList.remove('dragging');
            scrollbarThumb.style.cursor = 'grab';
            
            // Restore text selection
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            
            console.log('ðŸŽ¯ Scrollbar thumb drag ended for:', gridId);
        }
        
        if (isTrackDragging) {
            isTrackDragging = false;
            scrollbarTrack.style.cursor = 'grab';
            
            // Restore text selection
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            
            console.log('ðŸŽ¯ Track drag ended for:', gridId);
        }
    }

    // Mouse and touch end events
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    
    // Update thumb position when grid scrolls (from buttons or other sources)
    grid.addEventListener('scroll', () => {
        updateCustomScrollbarPosition(gridId);
    });
    
    console.log(`âœ… Custom scrollbar created for: ${gridId}`);
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
        console.log(`ðŸ” SPECIAL: Initializing problematic wishlist button ${productId}`);
        console.log(`ðŸ” Button parent:`, button.parentNode?.className);
        console.log(`ðŸ” Button data-product-id:`, button.getAttribute('data-product-id'));
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
      
      // FÃ¼ge den Event Listener zum neuen Button hinzu
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

// Doppelte Funktion entfernt - verwende nur die geschÃ¼tzte Version oben

// Initialize category navigation
function initializeCategoryNavigation() {
  const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
  const categoryTitle = document.querySelector('.category-title');
  
  console.log('ðŸ”§ Initializing category navigation');
  console.log('ðŸ”§ Found category tabs:', categoryTabs.length);
  
  categoryTabs.forEach((tab, index) => {
    console.log(`ðŸ”§ Setting up tab ${index}:`, tab.dataset.category);
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('ðŸ”¥ Category tab clicked:', tab.dataset.category);
      
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
        console.log('âœ… Updated section title to:', allProductsTitle.textContent);
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
        // For specific categories, scroll to their specific section
        const categoryMapping = {
          'Technik/Gadgets': 'technikGrid',
          'Beleuchtung': 'beleuchtungGrid', 
          'Haushalt und Küche': 'haushaltGrid',
          'Körperpflege/Wellness': 'wellnessGrid'
        };
        
        const targetGridId = categoryMapping[category];
        if (targetGridId) {
          const targetSection = document.getElementById(targetGridId)?.closest('.product-category-section');
          if (targetSection) {
            console.log('Scrolling to specific category section:', category);
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            console.error('âŒ Target section not found for category:', category);
          }
        } else {
          console.error('âŒ No mapping found for category:', category);
        }
      }
    });
  });
}

// ... rest of the code remains the same ...
// Function to show/hide category sections based on selection
function showCategorySections(selectedCategory) {
  console.log('ðŸ”§ Showing category sections for:', selectedCategory);
  
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
    
    console.log('âœ… All category sections shown');
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
        console.log('âœ… Showing section for category:', selectedCategory);
      } else {
        console.error('âŒ Target section not found for category:', selectedCategory);
      }
    } else {
      console.error('âŒ No mapping found for category:', selectedCategory);
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
    case 'KÃ¶rperpflege/Wellness':
      document.body.classList.add('category-selected-koerperpflege');
      break;
    case 'Haushalt und KÃ¼che':
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

  // Sofortige Platzhalter fÃ¼r fehlende Bilder anwenden
  applyPlaceholdersForMissingImages();

  // SOFORT alle Produkte laden und anzeigen - MEHRFACH VERSUCHEN
  console.log('=== STARTING IMMEDIATE PRODUCT LOAD ===');

  
  const loadAndShowProducts = () => {
    loadProducts().then(products => {
      console.log('âœ… Products loaded successfully:', products.length);
      
      if (products.length === 0) {
        console.error('âŒ No products found in JSON file!');
        return;
      }
      // Lade Bestseller mit der funktionierenden Methode
      const bestsellerProducts = [];
      const categories = ['Haushalt und KÃ¼che', 'Technik/Gadgets', 'Beleuchtung', 'KÃ¶rperpflege/Wellness'];
      
      // Get 1-2 products from each category for variety (exclude products with showInSlider: false)
      categories.forEach(category => {
        const categoryProducts = products.filter(p => p.category === category && p.showInSlider !== false).slice(0, 2);
        bestsellerProducts.push(...categoryProducts);
      });
      
      // If we don't have enough, fill with remaining products (exclude products with showInSlider: false)
      if (bestsellerProducts.length < 6) {
        const remaining = products.filter(p => !bestsellerProducts.includes(p) && p.showInSlider !== false).slice(0, 6 - bestsellerProducts.length);
        bestsellerProducts.push(...remaining);
      }
      
      // Limit to 6 products
      const finalBestsellers = bestsellerProducts.slice(0, 6);
      console.log('ðŸ“¦ Loading bestseller products with variety:', finalBestsellers.length);
      renderBestsellers(finalBestsellers);
      
      // Lade Produkte in alle Kategorie-Container
      loadCategoryProducts(products);
      
      // PrÃ¼fe ob Produkte tatsÃ¤chlich gerendert wurden
      setTimeout(() => {
        console.log('âœ… All products loaded into containers');
      }, 500);
      
      console.log('âœ… All products loaded successfully!');
      
      // Berechne Kategorie-Anzahlen und aktualisiere die Anzeige
      const counts = calculateCategoryCounts(products);
      // updateCategoryTiles(counts); // Function not implemented yet
      
      // UI-Elemente korrekt setzen
      const categoryFilter = document.getElementById('categoryFilter');
      if (categoryFilter) {
        categoryFilter.value = 'Alle Kategorien';
        console.log('âœ… Category filter set to "Alle Kategorien"');
      }
      
      const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
      categoryTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === 'alle') {
          tab.classList.add('active');
          console.log('âœ… "Alle" tab set as active');
        }
      });
      
      // Set initial category body class
      updateCategoryBodyClass('alle');
      
      // Show all category sections initially
      showCategorySections('alle');
      
      // Nur den Titel fÃ¼r das Hauptprodukt-Grid setzen, nicht fÃ¼r Bestseller
      const categoryTitles = document.querySelectorAll('.category-title');
      categoryTitles.forEach((title, index) => {
        if (index === 1) { // Das zweite Element ist "Alle Produkte"
          title.textContent = 'Alle Produkte';
          console.log('âœ… Category title set to "Alle Produkte"');
        }
      });
      
      console.log('âœ… All bestsellers loaded and rendered');
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
      console.log('ðŸ”„ Backup product load triggered...');
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
          <span class="me-2">ðŸ›ï¸</span>
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
    
    // Event-Listener fÃ¼r das manuelle Leeren des Suchfelds
    searchInput.addEventListener('input', function() {
      if (this.value === '') {
        localStorage.removeItem('lastSearch');
      } else {
        localStorage.setItem('lastSearch', this.value);
      }
    });
  }
  const filterSelect = document.getElementById('filter-select');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      const filterValue = filterSelect.value;
      loadAndFilterProducts({ category: filterValue });
      const sorted = sortProducts(
        filtered,
        priceSort ? priceSort.value : 'Aufsteigend'
      );
      renderProducts(sorted);
      
      // Scroll to products when category changes
      const productGrid = document.getElementById('productGrid');
      if (productGrid) {
        productGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
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
    
    // Event-Listener fÃ¼r das Leeren des Suchfelds beim Verlassen der Seite
    window.addEventListener('beforeunload', function() {
      // Leere das Suchfeld und entferne den localStorage-Wert
      searchInput.value = '';
      localStorage.removeItem('lastSearch');
    });
    
    // Event-Listener fÃ¼r das Leeren des Suchfelds beim Klicken auÃŸerhalb
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

  // SekundÃ¤res Laden fÃ¼r Filter-Setup (falls das erste Laden fehlschlÃ¤gt)
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
          <span class="dropdown-arrow">â–¼</span>
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
          <span class="dropdown-arrow">â–¼</span>
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
    // Fallback fÃ¼r fehlende Bilder mit verbessertem Design
    img.addEventListener('error', function() {
      // PrÃ¼fe ob das Bild wirklich fehlt (nicht nur noch lÃ¤dt)
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
        
        // FÃ¼ge das groÃŸe Fragezeichen-Symbol hinzu (wie auf PC)
        this.innerHTML = '?';
        
        // Mobile Anpassungen fÃ¼r Platzhalter - aber einheitlich
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
    
    // BildqualitÃ¤t fÃ¼r mobile GerÃ¤te optimieren
    if (window.innerWidth <= 600) {
      img.style.imageRendering = '-webkit-optimize-contrast';
      img.style.imageRendering = 'crisp-edges';
    }
    
    // PrÃ¼fe ob das Bild bereits fehlerhaft ist (nur bei wirklich fehlenden Bildern)
    if (img.complete && img.naturalWidth === 0 && img.src && !img.src.includes('data:') && !img.src.includes('blob:')) {
      // Warte kurz und prÃ¼fe nochmal
      setTimeout(() => {
        if (img.naturalWidth === 0) {
          img.dispatchEvent(new Event('error'));
        }
      }, 100);
    }
  });
}

// Funktion zum sofortigen Anwenden von Platzhaltern fÃ¼r fehlende Bilder
function applyPlaceholdersForMissingImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    // PrÃ¼fe ob das Bild bereits fehlerhaft ist (nur bei wirklich fehlenden Bildern)
    if (img.complete && img.naturalWidth === 0 && img.src && !img.src.includes('data:') && !img.src.includes('blob:')) {
      // Warte kurz und prÃ¼fe nochmal, um sicherzustellen, dass das Bild wirklich fehlt
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
          
          // FÃ¼ge das groÃŸe Fragezeichen-Symbol hinzu (wie auf PC)
          img.innerHTML = '?';
          
          // Mobile Anpassungen fÃ¼r Platzhalter - aber einheitlich
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

// Test-Funktion fÃ¼r die Browser-Konsole
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

// Test-Funktion fÃ¼r Cart Dropdown
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

// Test-Funktion fÃ¼r Empty Cart Verhalten
window.testEmptyCart = function() {
  console.log('Testing empty cart behavior...');
  
  // Leere den Warenkorb
  clearCart();
  
  // PrÃ¼fe den ZÃ¤hler
  setTimeout(() => {
    const counter = document.getElementById('cartCounter');
    console.log('Cart counter after clearing:', counter ? counter.textContent : 'not found');
    console.log('Cart counter display:', counter ? counter.style.display : 'not found');
    
    // FÃ¼ge ein Produkt hinzu
    testAddProduct17();
    
    setTimeout(() => {
      console.log('Cart counter after adding product:', counter ? counter.textContent : 'not found');
      console.log('Cart counter display:', counter ? counter.style.display : 'not found');
    }, 500);
  }, 500);
};

// Direkte Test-Funktion fÃ¼r Produkt 17 (Smart Watch)
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
// window.testCartDropdown = testCartDropdown;
// window.testEmptyCart = testEmptyCart;
// window.testLiveUpdates = testLiveUpdates; // Wird spÃ¤ter definiert
// window.testClearCartButton = testClearCartButton; // Auskommentiert - Funktion existiert
// window.testClearCartSimple = testClearCartSimple;

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
          category = 'Haushalt und KÃ¼che';
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
        console.log('ðŸ“¦ Loading bestsellers...');
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

// Test-Funktion fÃ¼r Live Updates
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

// Test-Funktion fÃ¼r Clear Cart Button
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
  console.log('ðŸ”§ Creating product card for:', product.name);
  
  const template = document.getElementById('productTemplate');
  if (!template) {
    console.error('âŒ Product template not found!');
    return document.createElement('div');
  }
  
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.lumiere-product-card');
  
  if (!card) {
    console.error('âŒ Product card element not found in template!');
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
    img.src = product.image;
    img.alt = product.name;
    console.log('âœ… Image set for:', product.name, 'Path:', product.image);
  }
  
  if (title) {
    title.textContent = product.name;
    console.log('âœ… Title set:', product.name);
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
  
  // Event-Listener hinzufÃ¼gen
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
  
  console.log('âœ… Product card created successfully for:', product.name);
  return clone;
}

// USE THE WORKING renderBestsellers() FOR ALL CATEGORIES
function renderProductsToGrid(products, gridContainer) {
  console.log('ðŸš¨ USING WORKING renderBestsellers() logic for categories!');
  
  if (!gridContainer) {
    console.error('âŒ Grid container not found!');
    return;
  }
  
  if (!products || products.length === 0) {
    console.warn('âš ï¸ No products to render');
    return;
  }
  
  // SCROLL GRID STRUCTURE (no Bootstrap cols) - WITH WORKING ANIMATIONS
  gridContainer.innerHTML = products.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="lumiere-product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="lumiere-image-container">
                    <img src="${product.image}" class="lumiere-product-image" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
    initializeProductCardClicks(); // FÃœR NAVIGATION ZU PRODUKTSEITEN
    
    // Initialize scrollbar tracking
    setTimeout(() => {
        if (typeof initializeScrollbarTracking === 'function') {
            initializeScrollbarTracking();
        }
    }, 100);

    console.log('âœ… Categories now use EXACT renderBestsellers() logic!');
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
    const maxScroll = grid.scrollWidth - grid.clientWidth;
    
    if (direction === 'left') {
        grid.scrollTo({
            left: Math.max(0, currentScroll - scrollAmount),
            behavior: 'smooth'
        });
    } else {
        // Prüfe ob bereits am Ende des Sliders
        const isAtEnd = currentScroll >= maxScroll - 10; // 10px Toleranz
        
        if (isAtEnd) {
            // Am Ende angekommen - öffne Suche basierend auf Kategorie
            let categoryName = '';
            if (gridId === 'technikGrid') categoryName = 'Technik/Gadgets';
            else if (gridId === 'beleuchtungGrid') categoryName = 'Beleuchtung';
            else if (gridId === 'haushaltGrid') categoryName = 'Haushalt/Küche';
            else if (gridId === 'wellnessGrid') categoryName = 'Körperpflege/Wellness';
            
            // Öffne Vollbild-Suche mit der entsprechenden Kategorie
            if (typeof openSearchFromCategory === 'function') {
                openSearchFromCategory(categoryName);
            } else if (typeof openFullscreenSearch === 'function') {
                openFullscreenSearch();
                // Aktiviere den entsprechenden Tab nach dem Öffnen
                setTimeout(() => {
                    const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
                    categoryTabs.forEach(tab => {
                        if (tab.textContent.trim() === categoryName.split('/')[0]) {
                            tab.click();
                        }
                    });
                }, 100);
            }
        } else {
            // Normal scrollen
            grid.scrollTo({
                left: Math.min(maxScroll, currentScroll + scrollAmount),
                behavior: 'smooth'
            });
        }
    }
    
    // Update scrollbar if function exists
    setTimeout(() => {
        if (window.updateScrollbarPositionForGrid) {
            window.updateScrollbarPositionForGrid(gridId);
        }
    }, 100);
    
}

// Call loadCategoryProducts after products are loaded
let categoryInitAttempts = 0;
const maxCategoryInitAttempts = 10;

function initializeCategoryProducts() {
    // Skip on cart.html page
    if (window.location.pathname.includes('cart.html')) {
        return;
    }
    
    if (window.allProducts && window.allProducts.length > 0) {
        loadCategoryProducts(window.allProducts);
    } else {
        categoryInitAttempts++;
        if (categoryInitAttempts < maxCategoryInitAttempts) {
            console.log(`â³ Waiting for products to load... (attempt ${categoryInitAttempts}/${maxCategoryInitAttempts})`);
            setTimeout(initializeCategoryProducts, 500);
        } else {
            console.log('âš ï¸ Category products initialization stopped after max attempts');
        }
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
                    <img src="${product.image}" class="lumiere-product-image" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
    // Skip on cart.html page
    if (window.location.pathname.includes('cart.html')) {
        return;
    }
    console.log('ðŸ”„ Loading products into category containers...');
    console.log('ðŸ”„ Total products available:', products.length);
    
    // Define category mappings
    const categoryMappings = {
        'technikGrid': 'Technik/Gadgets',
        'beleuchtungGrid': 'Beleuchtung', 
        'haushaltGrid': 'Haushalt und Küche',
        'wellnessGrid': 'Körperpflege/Wellness'
    };
    
    // For each category
    Object.entries(categoryMappings).forEach(([gridId, categoryName]) => {
        console.log(`ðŸ”§ Processing category: ${categoryName} -> ${gridId}`);
        
        const grid = document.getElementById(gridId);
        if (!grid) {
            // Only warn if we're on a page where these grids should exist
            if (!window.location.pathname.includes('cart.html')) {
                console.warn(`âŒ Grid ${gridId} not found`);
            }
            return;
        }
        
        // Filter products for this category (exclude products with showInSlider: false)
        const categoryProducts = products.filter(p => p.category === categoryName && p.showInSlider !== false);
        
        console.log(`🔍 Category: ${categoryName}`);
        console.log(`🔍 All products in category:`, products.filter(p => p.category === categoryName).map(p => `${p.id}: ${p.name} (showInSlider: ${p.showInSlider})`));
        console.log(`🔍 Filtered products:`, categoryProducts.map(p => `${p.id}: ${p.name}`));
        
        if (categoryProducts.length > 0) {
            console.log(`✅ Rendering ${categoryProducts.length} products to ${gridId}`);
            // Render products to this container
            renderProductsToGrid(categoryProducts, grid);
        } else {
            console.warn(`⚠️ No products found for category: ${categoryName}`);
            console.warn(`⚠️ Total products in this category (including hidden):`, products.filter(p => p.category === categoryName).length);
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
    // Skip initialization on cart.html page
    if (window.location.pathname.includes('cart.html')) {
        return;
    }
    
    console.log('ðŸ” Initializing fullscreen search...');
    
    // Wait for DOM elements to be available
    setTimeout(() => {
        // Get DOM elements
        const fullscreenSearchBtn = document.getElementById('fullscreenSearchBtn');
        const closeSearchBtn = document.getElementById('closeSearchBtn');
        searchOverlay = document.getElementById('fullscreenSearchOverlay');
        searchInput = document.getElementById('fullscreenSearchInput');
        searchResults = document.getElementById('searchResults');
        searchResultsGrid = document.getElementById('searchResultsGrid');
        
        console.log('ðŸ” Search elements found:', {
            searchBtn: !!fullscreenSearchBtn,
            overlay: !!searchOverlay,
            input: !!searchInput
        });
        
        if (!fullscreenSearchBtn || !searchOverlay) {
            // Only log error if we're on a page where these elements should exist
            if (!window.location.pathname.includes('cart.html')) {
                console.error('âŒ Fullscreen search elements not found');
            }
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
        console.log('ðŸ”§ Looking for search input...');
        const testInput = document.getElementById('fullscreenSearchInput');
        console.log('ðŸ”§ Found input:', testInput);
        
        if (testInput) {
            console.log('âœ… Search input found, adding FORCE event listeners');
            
            // Multiple event listeners to catch everything
            testInput.addEventListener('input', function(e) {
                console.log('ðŸ” INPUT EVENT:', e.target.value);
                testSearchFunction(e.target.value);
            });
            
            testInput.addEventListener('keyup', function(e) {
                console.log('ðŸ” KEYUP EVENT:', e.target.value);
                testSearchFunction(e.target.value);
            });
            
            testInput.addEventListener('change', function(e) {
                console.log('ðŸ” CHANGE EVENT:', e.target.value);
                testSearchFunction(e.target.value);
            });
            
        } else {
            console.error('âŒ Search input STILL not found!');
            // Try to find it by class
            const inputByClass = document.querySelector('.fullscreen-search-input');
            console.log('ðŸ”§ Input by class:', inputByClass);
        }
        
        // Category buttons now use direct onclick handlers
        
        // Popular search tags (removed - no longer needed)
        
        console.log('âœ… Search button event listener added');
    }, 100);
}

// Handle search button click
function handleSearchButtonClick(e) {
    console.log('ðŸ” Search button clicked!');
    e.preventDefault();
    e.stopPropagation();
    openSearchOverlay();
}

// Open search overlay with specific category selected
function openSearchFromCategory(categoryName) {
    console.log('ðŸ” Opening search overlay for category:', categoryName);
    
    if (searchOverlay) {
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Load products if not already loaded
        if (allProducts.length === 0) {
            loadProducts().then(products => {
                allProducts = products;
                console.log('ðŸ"¦ Products loaded for category search:', allProducts.length);
                
                // Load all products first, then activate category
                loadAllProducts();
                
                // Aktiviere den entsprechenden Kategorie-Tab nach dem Laden
                setTimeout(() => {
                    activateCategoryTab(categoryName);
                }, 500);
            });
        } else {
            // Load all products first
            loadAllProducts();
            
            // Aktiviere den entsprechenden Kategorie-Tab
            setTimeout(() => {
                activateCategoryTab(categoryName);
            }, 300);
        }
        
        // Focus on search input after animation
        setTimeout(() => {
            if (searchInput) {
                searchInput.focus();
            }
        }, 300);
        
        console.log('âœ… Search overlay opened with category:', categoryName);
    } else {
        console.error('âŒ Search overlay not found');
    }
}

// Helper function to activate category tab
function activateCategoryTab(categoryName) {
    console.log('ðŸ"§ Activating category tab for:', categoryName);
    
    const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
    console.log('ðŸ"§ Found category tabs:', categoryTabs.length);
    
    // Entferne active von allen Tabs zuerst
    categoryTabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Finde und aktiviere den richtigen Tab (nur visuell)
    categoryTabs.forEach(tab => {
        const tabText = tab.textContent.trim().toUpperCase();
        console.log('ðŸ"§ Checking tab:', tabText, 'against category:', categoryName);
        
        let shouldActivate = false;
        
        if (categoryName === 'Technik/Gadgets' && tabText === 'TECHNIK') {
            shouldActivate = true;
        } else if (categoryName === 'Beleuchtung' && tabText === 'LICHT') {
            shouldActivate = true;
        } else if (categoryName === 'Körperpflege/Wellness' && tabText === 'WELLNESS') {
            shouldActivate = true;
        } else if (categoryName === 'Haushalt/Küche' && tabText === 'KÜCHE') {
            shouldActivate = true;
        }
        
        if (shouldActivate) {
            console.log('âœ… Found matching tab, activating visually:', tabText);
            tab.classList.add('active');
            
            // Direkt die Kategorie-Filterung auslösen, OHNE den Button zu klicken
            handleCategorySearch(categoryName);
        }
    });
}

// Open search overlay
function openSearchOverlay() {
    console.log('ðŸ” Opening search overlay...');
    
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
                console.log('ðŸ“¦ Products loaded for search:', allProducts.length);
                loadAllProducts();
                
            });
        } else {
            loadAllProducts();
        }
    }
}

// Close search overlay
function closeSearchOverlay() {
    console.log('ðŸ” Closing search overlay...');
    
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
    console.log('ðŸ” REAL SEARCH FUNCTION CALLED WITH:', `"${query}"`);
    
    const grid = document.getElementById('searchAllProductsGrid');
    if (!grid) {
        console.error('âŒ Grid not found!');
        return;
    }
    
    // Reset category buttons
    const allButtons = document.querySelectorAll('.lumiere-category-tab');
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    if (query.length === 0) {
        console.log('ðŸ” Empty query - loading all products');
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
    
    console.log('ðŸ” Searching for products with:', query);
    
    // Load products and filter
    loadProducts().then(products => {
        console.log('ðŸ“¦ Total products:', products.length);
        
        const searchText = query.toLowerCase();
        const filtered = products.filter(product => {
            const name = (product.name || '').toLowerCase();
            const match = name.includes(searchText);
            if (match) {
                console.log('âœ… Found match:', product.name);
            }
            return match;
        });
        
        console.log('ðŸ” Filtered results:', filtered.length);
        
        // Clear and render
        grid.innerHTML = '';
        
        if (filtered.length === 0) {
            grid.innerHTML = `<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte mit "${query}" im Namen gefunden</div>`;
        } else {
            // Group products by category
            const groupedProducts = {};
            filtered.forEach(product => {
                const category = product.category || 'Andere';
                if (!groupedProducts[category]) {
                    groupedProducts[category] = [];
                }
                groupedProducts[category].push(product);
            });
            
            console.log('ðŸ“¦ Grouped products:', groupedProducts);
            
            // Create sorted product array (grouped by category but no titles)
            let sortedProducts = [];
            
            // Category order
            const categoryOrder = ['Technik/Gadgets', 'Beleuchtung', 'KÃ¶rperpflege/Wellness', 'Haushalt und KÃ¼che'];
            
            // Add products in category order
            categoryOrder.forEach(category => {
                if (groupedProducts[category] && groupedProducts[category].length > 0) {
                    sortedProducts = sortedProducts.concat(groupedProducts[category]);
                }
            });
            
            // Add any remaining categories not in the predefined order
            Object.keys(groupedProducts).forEach(category => {
                if (!categoryOrder.includes(category) && groupedProducts[category].length > 0) {
                    sortedProducts = sortedProducts.concat(groupedProducts[category]);
                }
            });
            
            // Render all products in one grid (but grouped by category)
            grid.innerHTML = sortedProducts.map(product => {
                const price = product.price || product.salePrice || 0;
                const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
                
                return `
                    <div class="lumiere-product-card search-product-card" data-product-id="${product.id}" data-category="${product.category}">
                        <div class="lumiere-image-container">
                            <img src="${product.image}" class="lumiere-product-image" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" loading="lazy">
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
                ? `SUCHERGEBNISSE FÃœR "${query.toUpperCase()}" (${filtered.length})`
                : `KEINE ERGEBNISSE FÃœR "${query.toUpperCase()}"`;
        }
        
    }).catch(error => {
        console.error('âŒ Search error:', error);
    });
}

// Simple and direct search function
function performSearch(query) {
    console.log('ðŸ” performSearch called with:', `"${query}"`);
    
    const grid = document.getElementById('searchAllProductsGrid');
    if (!grid) {
        console.error('âŒ Grid not found!');
        return;
    }
    
    console.log('âœ… Grid found:', grid);
    
    if (query.length === 0) {
        console.log('ðŸ” Empty query - showing all products');
        loadAllProducts();
        return;
    }
    
    console.log('ðŸ” Filtering products for:', query);
    
    // Get all products and filter immediately
    if (window.allProducts && window.allProducts.length > 0) {
        console.log('ðŸ“¦ Using cached products:', window.allProducts.length);
        filterAndDisplay(window.allProducts, query, grid);
    } else {
        console.log('ðŸ“¦ Loading products from JSON...');
        loadProducts().then(products => {
            console.log('ðŸ“¦ Products loaded:', products.length);
            window.allProducts = products; // Cache for next time
            filterAndDisplay(products, query, grid);
        }).catch(error => {
            console.error('âŒ Error loading products:', error);
        });
    }
}

function filterAndDisplay(products, query, grid) {
    console.log('ðŸ” filterAndDisplay called with:', products.length, 'products, query:', `"${query}"`);
    
    const searchText = query.toLowerCase();
    const filtered = products.filter(product => {
        const name = (product.name || '').toLowerCase();
        const match = name.includes(searchText);
        if (match) {
            console.log('âœ… Match:', product.name);
        }
        return match;
    });
    
    console.log('ðŸ” Filtered results:', filtered.length);
    
    // Clear grid completely
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte mit "${query}" im Namen gefunden</div>`;
        console.log('âŒ No matches - showing empty message');
    } else {
        console.log('âœ… Rendering', filtered.length, 'products');
        renderAllProducts(grid, filtered);
    }
    
    // Update title
    const title = document.querySelector('.search-all-products .search-section-title');
    if (title) {
        title.textContent = filtered.length > 0 
            ? `SUCHERGEBNISSE FÃœR "${query.toUpperCase()}" (${filtered.length})`
            : `KEINE ERGEBNISSE FÃœR "${query.toUpperCase()}"`;
    }
}

// Handle category search
function handleCategorySearch(category) {
    console.log('ðŸ” Category search:', category);
    
    // Load products first, then filter
    loadProducts().then(products => {
        let filteredProducts = [];
        
        if (category === 'alle') {
            filteredProducts = products;
        } else {
            // Filter products by exact category match
            filteredProducts = products.filter(product => {
                const productCategory = product.category;
                console.log(`ðŸ” Checking product: ${product.name} - Category: "${productCategory}" vs Filter: "${category}"`);
                return productCategory === category;
            });
        }
        
        console.log('ðŸ” Found', filteredProducts.length, 'products for category:', category);
        console.log('ðŸ” Available categories:', [...new Set(products.map(p => p.category))]);
        console.log('ðŸ” Filtered products:', filteredProducts.map(p => p.name));
        
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
                    'KÃ¶rperpflege/Wellness': 'WELLNESS PRODUKTE',
                    'Haushalt und KÃ¼che': 'KÃœCHEN PRODUKTE'
                };
                sectionTitle.textContent = categoryNames[category] || category.toUpperCase() + ' PRODUKTE';
            }
        }
    }).catch(error => {
        console.error('âŒ Error during category search:', error);
    });
}

// Display search results
function displaySearchResults(products, query) {
    if (!searchResults || !searchResultsGrid) {
        console.error('âŒ Search results elements not found');
        return;
    }
    
    // Show results section
    searchResults.style.display = 'block';
    
    // Update title
    const title = searchResults.querySelector('.search-section-title');
    if (title) {
        title.textContent = `Suchergebnisse fÃ¼r "${query}" (${products.length})`;
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
                <img src="${product.image}" alt="${product.name}" class="search-result-image" loading="lazy">
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
    console.log('ðŸ” Loading all products...');
    
    const allProductsGrid = document.getElementById('searchAllProductsGrid');
    if (!allProductsGrid) {
        console.log('âŒ All products grid not found');
        return;
    }
    
    // Always load products fresh
    loadProducts().then(products => {
        console.log('ðŸ“¦ Products loaded for search grid:', products.length);
        renderAllProducts(allProductsGrid, products);
    }).catch(error => {
        console.error('âŒ Error loading products:', error);
    });
}

function renderAllProducts(allProductsGrid, products) {
    console.log('ðŸŽ¨ renderAllProducts called with:', products ? products.length : 'null', 'products');
    
    if (!allProductsGrid) {
        console.error('âŒ Grid element is null!');
        return;
    }
    
    if (!products || products.length === 0) {
        console.log('âŒ No products to render - clearing grid');
        allProductsGrid.innerHTML = '<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte gefunden</div>';
        return;
    }
    
    console.log('ðŸŽ¨ Rendering products with category grouping:', products.length);
    
    // Group products by category
    const groupedProducts = {};
    products.forEach(product => {
        const category = product.category || 'Andere';
        if (!groupedProducts[category]) {
            groupedProducts[category] = [];
        }
        groupedProducts[category].push(product);
    });
    
    console.log('ðŸ“¦ Grouped products:', groupedProducts);
    
    // Create sorted product array (grouped by category but no titles)
    let sortedProducts = [];
    
    // Category order
    const categoryOrder = ['Technik/Gadgets', 'Beleuchtung', 'KÃ¶rperpflege/Wellness', 'Haushalt und KÃ¼che'];
    
    // Add products in category order
    categoryOrder.forEach(category => {
        if (groupedProducts[category] && groupedProducts[category].length > 0) {
            sortedProducts = sortedProducts.concat(groupedProducts[category]);
        }
    });
    
    // Add any remaining categories not in the predefined order
    Object.keys(groupedProducts).forEach(category => {
        if (!categoryOrder.includes(category) && groupedProducts[category].length > 0) {
            sortedProducts = sortedProducts.concat(groupedProducts[category]);
        }
    });
    
    // Render all products in one grid (but grouped by category)
    allProductsGrid.innerHTML = sortedProducts.map(product => {
        const price = product.price || product.salePrice || 0;
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
        
        return `
            <div class="lumiere-product-card search-product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="lumiere-image-container">
                    <img src="${product.image}" class="lumiere-product-image" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" loading="lazy">
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
    
    console.log('âœ… Products rendered with category grouping');
    
    // Initialize buttons like on main page
    initializeAddToCartButtons();
    initializeWishlistButtons();
    initializeProductCardClicks();
}

// Simple onclick function for search categories
function searchCategoryClick(button, category) {
    console.log('ðŸ” Search category clicked:', category);
    
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
    console.log('ðŸ”— Navigating to product:', productId);
    
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
window.openSearchFromCategory = openSearchFromCategory;
window.closeSearchOverlay = closeSearchOverlay;
window.loadAllProducts = loadAllProducts;
window.searchCategoryClick = searchCategoryClick;
window.testSearchFunction = testSearchFunction;
// Funktion zum Öffnen der Suche mit vorausgewählter Kategorie
window.openSearchWithCategory = function(category) {
  console.log('🔍 Opening search with category:', category);
  
  // Öffne die Suche
  openSearchOverlay();
  
  // Warte kurz, bis die Suche geöffnet ist
  setTimeout(() => {
      // Finde das Search Overlay
      const searchOverlay = document.querySelector('.fullscreen-search-overlay, #fullscreenSearchOverlay');
      if (!searchOverlay) {
          console.error('Search overlay not found!');
          return;
      }
      
      console.log('✅ Search overlay found');
      
      // Suche nach Kategorie-Buttons im Search Overlay
      const categoryTabs = searchOverlay.querySelectorAll('.lumiere-category-tab');
      console.log('Found category buttons:', categoryTabs.length);
      
      if (categoryTabs.length === 0) {
          console.error('No category tabs found in search overlay!');
          return;
      }
      
      // Flag ob Button gefunden wurde
      let buttonFound = false;
      
      // Durchlaufe alle Buttons
      categoryTabs.forEach(button => {
          const buttonCategory = button.getAttribute('data-category');
          console.log('Checking button:', buttonCategory, 'against:', category);
          
          // Entferne active von allen
          button.classList.remove('active');
          
          // Aktiviere den richtigen Button
          if (buttonCategory === category) {
              console.log('✅ Found matching button, activating:', category);
              button.classList.add('active');
              buttonFound = true;
              
              // Rufe searchCategoryClick direkt auf
              searchCategoryClick(button, category);
          }
      });
      
      if (!buttonFound) {
          console.warn('⚠️ No matching category button found for:', category);
      }
  }, 500);
};

// Funktion zum Überprüfen, ob ein Grid am Ende gescrollt ist
window.checkScrollEndForMoreProducts = function(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  const container = grid.closest('.product-scroll-container');
  if (!container) return;
  
  let moreButton = container.querySelector('.more-products-button');
  
  // Erstelle den Button, wenn er noch nicht existiert
  if (!moreButton) {
      moreButton = document.createElement('button');
      moreButton.className = 'more-products-button';
      moreButton.innerHTML = `
          <span>Weitere Produkte</span>
          <i class="bi bi-arrow-right-circle"></i>
      `;
      
      // Bestimme die Kategorie basierend auf der Grid-ID
      let category = '';
      
      switch(gridId) {
          case 'technikGrid':
              category = 'Technik/Gadgets';
              break;
          case 'beleuchtungGrid':
              category = 'Beleuchtung';
              break;
          case 'haushaltGrid':
              category = 'Haushalt und Küche';
              break;
          case 'wellnessGrid':
              category = 'Körperpflege/Wellness';
              break;
          default:
              category = 'alle';
      }
      moreButton.setAttribute('data-category', category);
      moreButton.onclick = function() {
          openSearchWithCategory(category);
      };
      
      container.appendChild(moreButton);
  }
  
  // Überprüfe, ob das Grid am Ende ist
  const scrollLeft = grid.scrollLeft;
  const scrollWidth = grid.scrollWidth;
  const clientWidth = grid.clientWidth;
  
  // Zeige den Button, wenn wir am Ende sind (mit 50px Toleranz)
  if (scrollLeft + clientWidth >= scrollWidth - 50) {
      moreButton.classList.add('show');
  } else {
      moreButton.classList.remove('show');
  }
};

// Initialisiere More Products Buttons
window.initializeMoreProductsButtons = function() {
  const grids = ['technikGrid', 'beleuchtungGrid', 'haushaltGrid', 'wellnessGrid'];
  
  grids.forEach(gridId => {
      const grid = document.getElementById(gridId);
      if (grid) {
          // Initial check
          checkScrollEndForMoreProducts(gridId);
          
          // Check on scroll
          grid.addEventListener('scroll', () => {
              checkScrollEndForMoreProducts(gridId);
          });
      }
  });
};

// CSS-Styles dynamisch hinzufügen
function addMoreProductsStyles() {
  if (document.getElementById('more-products-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'more-products-styles';
  style.textContent = `
      .more-products-button {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 15px 25px;
          border-radius: 30px 0 0 30px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: none;
          align-items: center;
          gap: 10px;
          z-index: 100;
          box-shadow: -5px 5px 20px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
      }
      
      .more-products-button:hover {
          transform: translateY(-50%) translateX(-10px);
          box-shadow: -10px 5px 30px rgba(0, 0, 0, 0.3);
          background: linear-gradient(135deg, #764ba2, #667eea);
      }
      
      .more-products-button.show {
          display: flex;
      }
      
      .more-products-button i {
          font-size: 20px;
      }
      
      .category-technik .more-products-button {
          background: linear-gradient(135deg, #43e97b, #38a169);
      }
      
      .category-beleuchtung .more-products-button {
          background: linear-gradient(135deg, #ffd700, #ffb347);
          color: #333;
      }
      
      .category-haushalt .more-products-button {
          background: linear-gradient(135deg, #fce7f3, #fbcfe8);
          color: #be185d;
      }
      
      .category-koerperpflege .more-products-button {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      }
  `;
  document.head.appendChild(style);
}

// Initialisierung beim DOM Ready
document.addEventListener('DOMContentLoaded', function() {
  addMoreProductsStyles();
  setTimeout(() => {
      initializeMoreProductsButtons();
  }, 1000);
});
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFullscreenSearch);
} else {
    initializeFullscreenSearch();
}

// Additional initialization after window load
window.addEventListener('load', () => {
    console.log('ðŸ” Window loaded, ensuring search is initialized...');
    
    // Double-check initialization
    const searchBtn = document.getElementById('fullscreenSearchBtn');
    if (searchBtn && !searchBtn.hasAttribute('data-initialized')) {
        console.log('ðŸ” Re-initializing search...');
        searchBtn.setAttribute('data-initialized', 'true');
        searchBtn.addEventListener('click', handleSearchButtonClick);
    }
});

// Emergency fallback - direct event binding
document.addEventListener('click', (e) => {
    if (e.target.id === 'fullscreenSearchBtn' || e.target.closest('#fullscreenSearchBtn')) {
        console.log('ðŸ” Emergency search activation!');
        e.preventDefault();
        e.stopPropagation();
        openSearchOverlay();
    }
});

// Global event delegation for search functionality - removed, using direct event listeners instead

// ===== INTEGRIERTE BUTTON COLOR FUNKTIONEN =====

// Dynamic button color management based on selected category
function updateButtonColors(selectedCategory) {
  const allButtons = document.querySelectorAll('.lumiere-add-to-cart-btn');
  
  // Define color schemes for each category - matching category backgrounds
  const categoryColors = {
    'alle': {
      bg: 'linear-gradient(135deg, #f0f4ff, #e0e8ff)',
      color: '#4a5fc8',
      border: '#c8d4ff',
      hoverBg: 'linear-gradient(135deg, #e0e8ff, #d0dcff)',
      hoverColor: '#3a4fb8',
      hoverBorder: '#a8b8ff'
    },
    'Technik/Gadgets': {
      bg: 'linear-gradient(135deg, #e8fff4, #d0f5e8)',
      color: '#0a7ea4',
      border: '#b8f0e0',
      hoverBg: 'linear-gradient(135deg, #d0f5e8, #b8e8d8)',
      hoverColor: '#086a8a',
      hoverBorder: '#8edcc8'
    },
    'Beleuchtung': {
      bg: 'linear-gradient(135deg, #fffaeb, #fff3d1)',
      color: '#8b6914',
      border: '#ffe4a1',
      hoverBg: 'linear-gradient(135deg, #fff3d1, #ffe8b8)',
      hoverColor: '#6b5010',
      hoverBorder: '#ffd480'
    },
    'KÃ¶rperpflege/Wellness': {
      bg: 'linear-gradient(135deg, #f0d9ff, #e8c8ff)',
      color: '#7a2e9d',
      border: '#d9b3ff',
      hoverBg: 'linear-gradient(135deg, #e8c8ff, #ddb8ff)',
      hoverColor: '#5e1d7a',
      hoverBorder: '#cc99ff'
    },
    'Haushalt und KÃ¼che': {
      bg: 'linear-gradient(135deg, #d4f5e0, #b8ecd0)',
      color: '#0a7a3c',
      border: '#9ce0b8',
      hoverBg: 'linear-gradient(135deg, #b8ecd0, #9ce0b8)',
      hoverColor: '#086030',
      hoverBorder: '#7dd8a0'
    }
  };
  
  const colors = categoryColors[selectedCategory] || categoryColors['alle'];
  
  // Apply colors to all buttons when a specific category is selected
  if (selectedCategory !== 'alle') {
    allButtons.forEach(btn => {
      // Skip disabled buttons
      if (btn.disabled) return;
      
      btn.style.background = colors.bg;
      btn.style.color = colors.color;
      btn.style.border = `1px solid ${colors.border}`;
      
      // Remove existing event listeners
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add hover effect
      newBtn.addEventListener('mouseenter', function() {
        if (!this.disabled) {
          this.style.background = colors.hoverBg;
          this.style.color = colors.hoverColor;
          this.style.borderColor = colors.hoverBorder;
        }
      });
      
      newBtn.addEventListener('mouseleave', function() {
        if (!this.disabled) {
          this.style.background = colors.bg;
          this.style.color = colors.color;
          this.style.borderColor = colors.border;
        }
      });
      
      // Re-attach click event for add to cart
      newBtn.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        if (productId && window.addToCart) {
          window.addToCart(productId);
        }
      });
    });
  } else {
    // Reset to original category-specific colors when "alle" is selected
    allButtons.forEach(btn => {
      // Skip disabled buttons
      if (btn.disabled) return;
      
      // Remove inline styles to revert to CSS-defined styles
      btn.style.background = '';
      btn.style.color = '';
      btn.style.border = '';
      btn.style.borderColor = '';
      
      // Remove event listeners by replacing the element
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Re-attach click event for add to cart
      newBtn.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        if (productId && window.addToCart) {
          window.addToCart(productId);
        }
      });
    });
  }
}

// Hook into existing showCategorySections function to update button colors
const originalShowCategorySections = window.showCategorySections;
window.showCategorySections = function(selectedCategory) {
  // Call original function
  if (originalShowCategorySections) {
    originalShowCategorySections.call(this, selectedCategory);
  }
  // Update button colors
  updateButtonColors(selectedCategory);
};

// Initialisierung beim Laden der Seite
document.addEventListener('DOMContentLoaded', function() {
  // Set initial state to 'alle'
  setTimeout(() => {
    updateButtonColors('alle');
  }, 100);
});


// === DROPDOWN-BILDER KLICKBAR MACHEN ===
// FÃ¼gen Sie diesen Code am Ende Ihrer app.js Datei hinzu

// Macht Dropdown-Bilder klickbar
function makeDropdownImagesClickable() {
  setTimeout(() => {
    // Produkt-ID Mapping
    const productIdMap = {
      // Technik/Gadgets
      'Elektrischer Wasserspender fÃ¼r Schreibtisch': 10,
      '350ml Elektrischer Mixer Entsafter': 11,
      'Bluetooth Anti-Lost Finder Wassertropfen': 17,
      'Home Electronic Clock Digitale Uhr': 18,
      'Elektronisches DistanzmessgerÃ¤t Digital': 19,
      'ZigBee Smart DIY Motorisierte Rollos': 20,
      
      // Beleuchtung
      'LED Water Ripple Crystal': 21,
      'LED Wasserwellen Kristall Tischlampe': 21,
      'Waterproof RGB LED Solar Light': 22,
      'Waterproof RGB LED Solarleuchte': 22,
      'Solarleuchte Metall Laterne': 23,
      'COBLED Arbeitsleuchte': 24,
      'Nachtlichter mit Bewegungsmelder': 25,
      
      // Haushalt & KÃ¼che
      'Multifunktions GemÃ¼seschneider': 12,
      'Elektrische KÃ¼chenwaage Digital': 13,
      'Automatischer Seifenspender': 14,
      'Vakuum Aufbewahrungsbeutel Set': 15,
      'Silikon Stretch Deckel 6er Set': 16,
      
      // Wellness & KÃ¶rperpflege
      '4 In 1 Self Cleaning Hair Brush': 26,
      'Volcanic Flame Aroma Essential Oil Diffuser': 27,
      'Mini Muskel Massage Pistole': 28,
      'HaarÃ¶l-Applikator Kopfhaut Massager': 29,
      'Mini Electric Shoulder And Neck Massager': 30,
      'Elektrischer Kopfhaut-Massagekamm': 31
    };
    
    // Verarbeite Warenkorb-Artikel
    document.querySelectorAll('#cartDropdown .cart-item').forEach(item => {
      const img = item.querySelector('.cart-item-image');
      if (!img || img.parentElement.tagName === 'A') return;
      
      const nameEl = item.querySelector('.cart-item-name');
      if (!nameEl) return;
      
      const productName = nameEl.textContent.trim();
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const product = cart.find(p => p.name === productName);
      
      if (product && product.id) {
        const link = document.createElement('a');
        link.href = 'produkte/produkt-' + product.id + '.html';
        link.style.textDecoration = 'none';
        
        img.style.cursor = 'pointer';
        img.parentNode.insertBefore(link, img);
        link.appendChild(img);
      }
    });
    
    // Verarbeite Empfehlungen
    document.querySelectorAll('#cartDropdown .recommendation-card').forEach(card => {
      const img = card.querySelector('.recommendation-image');
      if (!img || img.parentElement.tagName === 'A') return;
      
      const nameEl = card.querySelector('.recommendation-name');
      if (!nameEl) return;
      
      const productName = nameEl.textContent.trim();
      const productId = productIdMap[productName] || 
                       (window.products && window.products.find(p => p.name === productName)?.id);
      
      if (productId) {
        const link = document.createElement('a');
        link.href = 'produkte/produkt-' + productId + '.html';
        link.style.textDecoration = 'none';
        
        img.style.cursor = 'pointer';
        img.parentNode.insertBefore(link, img);
        link.appendChild(img);
      }
    });
  }, 200);
}

// Erweitere renderCartDropdown Funktion
(function() {
  if (typeof window.renderCartDropdown === 'function') {
    const originalRender = window.renderCartDropdown;
    window.renderCartDropdown = function() {
      const result = originalRender.apply(this, arguments);
      makeDropdownImagesClickable();
      return result;
    };
    console.log('âœ… renderCartDropdown erweitert - Bilder sind klickbar');
  } else {
    // Fallback: Warte auf die Funktion
    const checkInterval = setInterval(() => {
      if (typeof window.renderCartDropdown === 'function') {
        clearInterval(checkInterval);
        const originalRender = window.renderCartDropdown;
        window.renderCartDropdown = function() {
          const result = originalRender.apply(this, arguments);
          makeDropdownImagesClickable();
          return result;
        };
        console.log('âœ… renderCartDropdown erweitert - Bilder sind klickbar');
      }
    }, 100);
    
    setTimeout(() => clearInterval(checkInterval), 5000);
  }
})();

// Fix: Warenkorb-Dropdown soll offen bleiben bei " Das könnte Ihnen gefallen\ Produkten
(function() {
 setTimeout(() => {
 if (window.addRecommendationToCart) {
 const originalAddRecommendationToCart = window.addRecommendationToCart;
 
 window.addRecommendationToCart = function(productId, buttonElement) {
 const cartDropdown = document.getElementById('cartDropdown');
 const wasDropdownOpen = cartDropdown && cartDropdown.classList.contains('show');
 
 originalAddRecommendationToCart(productId, buttonElement);
 
 if (wasDropdownOpen && cartDropdown) {
 setTimeout(() => {
 cartDropdown.classList.add('show');
 cartDropdown.style.display = 'block';
 if (window.renderCartDropdown) {
 window.renderCartDropdown();
 }
 }, 100);
 }
 };
 }
 
 if (window.addProductToCart) {
 const originalAddProductToCart = window.addProductToCart;
 
 window.addProductToCart = function(productsParam, productId, fromCartDropdown = false) {
 const cartDropdown = document.getElementById('cartDropdown');
 const wasDropdownOpen = cartDropdown && cartDropdown.classList.contains('show');
 
 const result = originalAddProductToCart(productsParam, productId, fromCartDropdown);
 
 if (fromCartDropdown && wasDropdownOpen && cartDropdown) {
 setTimeout(() => {
 cartDropdown.classList.add('show');
 cartDropdown.style.display = 'block';
 }, 150);
 }
 
 return result;
 };
 }
 }, 500);
})();
// Fix: Warenkorb-Dropdown soll offen bleiben bei "Das könnte Ihnen gefallen" Produkten
setTimeout(() => {
    if (window.addRecommendationToCart) {
        const originalAddRecommendationToCart = window.addRecommendationToCart;
        
        window.addRecommendationToCart = function(productId, buttonElement) {
            const cartDropdown = document.getElementById('cartDropdown');
            const wasDropdownOpen = cartDropdown && cartDropdown.classList.contains('show');
            
            originalAddRecommendationToCart(productId, buttonElement);
            
            if (wasDropdownOpen && cartDropdown) {
                setTimeout(() => {
                    cartDropdown.classList.add('show');
                    cartDropdown.style.display = 'block';
                    if (window.renderCartDropdown) {
                        window.renderCartDropdown();
                    }
                }, 100);
            }
        };
        console.log('âœ… Warenkorb-Dropdown Fix aktiviert');
    }
}, 1000);
// Fix: Warenkorb-Dropdown soll offen bleiben bei "Das könnte Ihnen gefallen" Produkten
setTimeout(() => {
    if (window.addRecommendationToCart) {
        const originalAddRecommendationToCart = window.addRecommendationToCart;
        
        window.addRecommendationToCart = function(productId, buttonElement) {
            const cartDropdown = document.getElementById('cartDropdown');
            const wasDropdownOpen = cartDropdown && cartDropdown.classList.contains('show');
            
            originalAddRecommendationToCart(productId, buttonElement);
            
            if (wasDropdownOpen && cartDropdown) {
                setTimeout(() => {
                    cartDropdown.classList.add('show');
                    cartDropdown.style.display = 'block';
                    if (window.renderCartDropdown) {
                        window.renderCartDropdown();
                    }
                }, 100);
            }
        };
        console.log('âœ… Warenkorb-Dropdown Fix aktiviert');
    }
}, 1000);
// Fix: Warenkorb-Dropdown soll offen bleiben bei "Das könnte Ihnen gefallen" Produkten
setTimeout(() => {
    if (window.addRecommendationToCart) {
        const originalAddRecommendationToCart = window.addRecommendationToCart;
        
        window.addRecommendationToCart = function(productId, buttonElement) {
            const cartDropdown = document.getElementById('cartDropdown');
            const wasDropdownOpen = cartDropdown && cartDropdown.classList.contains('show');
            
            originalAddRecommendationToCart(productId, buttonElement);
            
            if (wasDropdownOpen && cartDropdown) {
                setTimeout(() => {
                    cartDropdown.classList.add('show');
                    cartDropdown.style.display = 'block';
                    if (window.renderCartDropdown) {
                        window.renderCartDropdown();
                    }
                }, 100);
            }
        };
        console.log('âœ… Warenkorb-Dropdown Fix aktiviert');
    }
}, 1000)