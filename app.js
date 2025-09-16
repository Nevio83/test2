// Warenkorb-Initialisierung
let cartItems = JSON.parse(localStorage.getItem('cart')) || [];

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

// Produktdaten laden
async function loadProducts() {
  try {
    const response = await fetch('products.json');
    const products = await response.json();
    // Füge eine Standardbeschreibung hinzu, falls nicht vorhanden
    return products.map(p => ({
      ...p,
      description: p.description || ''
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
    
    // Update the wishlist button state
    const wishlistButton = document.querySelector(`[data-product-id="${productId}"] .lumiere-wishlist-btn`);
    if (wishlistButton) {
      wishlistButton.classList.toggle('active', !wasInWishlist);
      const icon = wishlistButton.querySelector('i');
      if (icon) {
        icon.className = wasInWishlist ? 'bi bi-heart' : 'bi bi-heart-fill';
      }
    }
    
    // Update navigation wishlist counter if it exists
    updateWishlistCounter();
  });
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
  
  console.log('Rendering', products.length, 'products to grid');
  
  if (products.length === 0) {
    grid.innerHTML = '<div class="no-products">Keine Produkte gefunden.</div>';
    return;
  }
  
  grid.innerHTML = products.map(product => {
    const price = product.price || product.salePrice || 0;
    const formattedPrice = typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2);
    
    return `
      <div class="lumiere-product-card" data-product-id="${product.id}">
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
          <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}" onclick="addToCart(${product.id}); return false;">
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
  // Warte kurz, um sicherzustellen, dass alle Elemente gerendert sind
  setTimeout(() => {
    const buttons = document.querySelectorAll('.lumiere-add-to-cart-btn');
    console.log('Found', buttons.length, 'lumiere-add-to-cart buttons');
    
    buttons.forEach((button, index) => {
      const productId = button.dataset.productId;
      console.log(`Initializing button ${index} for product ${productId}`);
      
      // Entferne alle bestehenden Event Listener
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Füge den Event Listener zum neuen Button hinzu
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Button clicked for product:', productId);
        
        const productId = parseInt(this.dataset.productId);
        if (productId && !isNaN(productId)) {
          addToCart(productId);
        } else {
          console.error('Invalid product ID:', productId);
        }
      });
    });
  }, 100);
}

// Produktkarten-Klicks initialisieren
function initializeProductCardClicks() {
  document.querySelectorAll('.lumiere-product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Verhindere Navigation bei Klicks auf Buttons oder deren Kinder
      if (e.target.closest('.lumiere-wishlist-btn') || 
          e.target.closest('.lumiere-add-to-cart-btn') || 
          e.target.classList.contains('lumiere-add-to-cart-btn') ||
          e.target.closest('button')) {
        return;
      }
      
      const productId = parseInt(card.dataset.productId);
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

function addProductToCart(products, productId) {
  console.log('Looking for product ID:', productId, 'in', products.length, 'products');
  
  const product = products.find(p => Number(p.id) === Number(productId));
  
  if (!product) {
    console.error('Product not found for ID:', productId);
    console.log('Available product IDs:', products.map(p => p.id));
    alert('Produkt konnte nicht gefunden werden.');
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
  
  // Show alert
  showAlert('Produkt wurde zum Warenkorb hinzugefügt');

  // Trigger button animations
  triggerCartButtonAnimation(productId);

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
  // Animate the specific add-to-cart button that was clicked
  const cartButton = document.querySelector(`[data-product-id="${productId}"] .lumiere-add-to-cart-btn`) ||
                     document.querySelector('.lumiere-add-to-cart-btn:focus') ||
                     document.querySelector('.lumiere-add-to-cart-btn:last-child');
  
  if (cartButton) {
    cartButton.classList.add('success-animation');
    setTimeout(() => {
      cartButton.classList.remove('success-animation');
    }, 800);
  }
  
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
  // Animate the specific wishlist button that was clicked
  const wishlistButton = document.querySelector(`[data-product-id="${productId}"] .lumiere-wishlist-btn`);
  
  if (wishlistButton) {
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
  }
  
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
  
  document.body.appendChild(indicator);
  
  // Remove after animation completes (different timing for cart vs wishlist)
  const duration = type === 'cart' ? 1200 : 1000;
  setTimeout(() => {
    if (document.body.contains(indicator)) {
      indicator.remove();
    }
  }, duration);
}

// Make showAlert globally available with enhanced animations
window.showAlert = function(message, redirectTo = 'cart.html') {
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

// changeQuantity function moved to cart.js to avoid duplication

// removeFromCart function moved to cart.js to avoid duplication

// Filter- und Sortierfunktionen
function debounce(func, timeout = 50) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

function filterProducts(products, searchText, category) {
  console.log('filterProducts called with:', { searchText, category, productsCount: products.length });
  
  const filtered = products.filter(product => {
    const matchesSearch = searchText === '' || product.name.toLowerCase().includes(searchText.toLowerCase());
    
    // Category matching
    let matchesCategory;
    if (category === 'alle' || category === 'Alle Kategorien') {
      matchesCategory = true; // Show all categories
    } else {
      matchesCategory = product.category === category; // Exact match only
    }
    
    console.log(`Product ${product.name} (${product.category}): search=${matchesSearch}, category=${matchesCategory}`);
    
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
    footer.style.display = 'none';
    
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
            <div class="lumiere-product-card" data-product-id="${product.id}">
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
                    <button class="lumiere-add-to-cart-btn" data-product-id="${product.id}" onclick="addToCart(${product.id}); return false;">
                        In den Warenkorb
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize buttons for bestseller section
    initializeAddToCartButtons();
    initializeWishlistButtons();
}

function initializeWishlistButtons() {
  document.querySelectorAll('.lumiere-wishlist-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Verhindert, dass das Klick-Event zur Karte weitergeht
      const productId = parseInt(button.dataset.productId);
      toggleWishlist(productId);
    });
  });
}

function initializeAddToCartButtons() {
  const addToCartButtons = document.querySelectorAll('.lumiere-add-to-cart-btn, .add-to-cart');
  addToCartButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const productId = this.getAttribute('data-product-id');
      if (productId) {
        addToCart(productId);
      }
    });
  });
}

// Initialize category navigation
function initializeCategoryNavigation() {
  const categoryTabs = document.querySelectorAll('.lumiere-category-tab');
  const categoryTitle = document.querySelector('.category-title');
  
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all tabs
      categoryTabs.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      const category = tab.dataset.category;
      const categoryName = category === 'alle' ? 'Alle Kategorien' : category;
      
      // Update title
      if (categoryTitle) {
        categoryTitle.textContent = category === 'alle' ? 'Alle Produkte' : categoryName;
      }
      
      // Filter and render products with existing search text
      const searchInput = document.getElementById('searchInput');
      const searchText = searchInput ? searchInput.value.trim() : '';
      
      console.log('Category tab clicked:', categoryName);
      console.log('Filtering products with category:', categoryName);
      
      loadProducts().then(products => {
        const filtered = filterProducts(products, searchText, categoryName);
        console.log('Filtered products count:', filtered.length);
        
        const sorted = sortProducts(
          filtered,
          document.getElementById('priceSort') ? document.getElementById('priceSort').value : 'Aufsteigend'
        );
        renderProducts(sorted);
        
        // Scroll to products
        const grid = document.getElementById('productGrid');
        if (grid) {
          console.log('Scrolling to product grid');
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          console.error('Product grid not found for scrolling');
        }
      });
    });
  });
}

// Filter- und Sortier-Event-Listener
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Starting initialization');
  updateCartCounter();
  initializeCartDropdown();
  initializeCategoryNavigation();
  initializeProductCardClicks();
  initializeWishlistButtons();
  initializeAddToCartButtons();
  
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
      
      // Prüfe ob productGrid existiert
      const productGrid = document.getElementById('productGrid');
      if (!productGrid) {
        console.error('❌ Product grid element not found!');
        return;
      }
      
      console.log('📦 Rendering products to grid...');
      renderProducts(products);
      
      // Prüfe ob Produkte tatsächlich gerendert wurden
      setTimeout(() => {
        const renderedProducts = productGrid.children.length;
        console.log('🔍 Products in grid after render:', renderedProducts);
        
        if (renderedProducts === 0) {
          console.error('❌ No products rendered to grid!');
          // Versuche nochmal
          console.log('🔄 Retrying product render...');
          renderProducts(products);
        } else {
          console.log('✅ Products successfully rendered!');
        }
      }, 100);
      
      // Speichere die Produkte im localStorage
      localStorage.setItem('allProducts', JSON.stringify(products));
      
      // Berechne Kategorie-Anzahlen und aktualisiere die Anzeige
      const counts = calculateCategoryCounts(products);
      updateCategoryTiles(counts);
      
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
      
      const categoryTitle = document.querySelector('.category-title');
      if (categoryTitle) {
        categoryTitle.textContent = 'Alle Produkte';
        console.log('✅ Category title set to "Alle Produkte"');
      }
      
      console.log('=== INITIAL SETUP COMPLETE ===');
    }).catch(error => {
      console.error('❌ Error loading products:', error);
    });
  };
  
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
  // Add product to cart using existing function
  addToCart(productId);
  
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
  // Check if notification already exists
  let notification = document.querySelector('.cart-notification');
  if (notification) {
    notification.remove();
  }
  
  // Create notification element
  notification = document.createElement('div');
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