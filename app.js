// MAIOS Shop Logic - Neo-Modern Design Adaptation

// --- STATE MANAGEMENT ---
let products = [];
let cartItems = JSON.parse(localStorage.getItem("cart")) || [];
let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  // Load products
  loadProducts().then((loadedProducts) => {
    products = loadedProducts;
    renderProducts(products); // Render all products to the main grid
  });

  // Initialize UI
  updateCartCounter();

  // Setup global functions for inline HTML calls
  window.toggleSearch = toggleSearch;
  window.toggleMobileMenu = toggleMobileMenu;
  window.toggleCart = toggleCart;
  window.addToCart = addToCart;
  window.changeQuantity = changeQuantity;
  window.removeFromCart = removeFromCart;
});

// --- CORE FUNCTIONS ---

// Load Products with Cache Busting
async function loadProducts() {
  try {
    const jsonPath = "products.json";
    const response = await fetch(`${jsonPath}?v=${Date.now()}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
}

// Render Products Grid (Neo-Modern Style)
function renderProducts(productData) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  if (productData.length === 0) {
    grid.innerHTML =
      '<div class="col-span-full text-center py-20 text-gray-400">Loading products...</div>';
    return;
  }

  grid.innerHTML = productData
    .map((product) => {
      const price =
        typeof product.price === "number"
          ? product.price
          : parseFloat(product.price);
      const formattedPrice = price.toFixed(2);

      // Check if image exists roughly (fallback handled by img onerror)
      const imageSrc = product.image ? product.image : "placeholder.jpg";

      return `
      <div class="glass-panel rounded-[2rem] p-6 relative overflow-hidden group hover:border-primary/50 transition-all duration-300 flex flex-col h-full">
        <!-- Image Container -->
        <div class="aspect-square rounded-2xl overflow-hidden mb-6 relative bg-white/5">
          <img src="${imageSrc}" 
               class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
               alt="${product.name}" 
               loading="lazy" 
               onerror="this.src='https://placehold.co/400x400/101010/FFF?text=No+Image';">
          
          <!-- Wishlist Toggle -->
          <button onclick="toggleWishlist(${product.id})" 
                  class="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:text-accent transition-colors ${isInWishlist(product.id) ? "text-accent" : ""}">
            <i class="bi ${isInWishlist(product.id) ? "bi-heart-fill" : "bi-heart"}"></i>
          </button>
        </div>
        
        <!-- Content -->
        <div class="relative z-10 flex flex-col flex-grow">
           <div class="flex justify-between items-start mb-2 gap-4">
              <h3 class="font-display text-xl font-bold leading-tight text-white">${product.name}</h3>
              <span class="font-bold text-primary whitespace-nowrap">${formattedPrice}€</span>
           </div>
           
           <p class="text-sm text-gray-400 mb-6 line-clamp-2 flex-grow">${product.description || "Premium quality product."}</p>
           
           <button onclick="addToCart(${product.id})" 
                   class="w-full py-4 rounded-xl bg-white/5 hover:bg-primary hover:text-white border border-white/10 transition-all font-medium flex items-center justify-center gap-2 group/btn">
              <span class="group-hover/btn:translate-x-1 transition-transform">Add to Cart</span>
              <i class="bi bi-bag-plus group-hover/btn:translate-x-1 transition-transform"></i>
           </button>
        </div>
      </div>
    `;
    })
    .join("");
}

// --- CART LOGIC ---

function addToCart(productId) {
  // Find product
  const product = products.find((p) => p.id == productId); // loose equality for string/number
  if (!product) {
    console.error("Product not found:", productId);
    return;
  }

  // Check if exists
  const existingItem = cartItems.find((item) => item.id == productId);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cartItems.push({
      ...product,
      quantity: 1,
    });
  }

  // Save and Update
  saveCart();
  updateCartCounter();
  renderCartDropdown();

  // Open dropdown to show feedback
  const dropdown = document.getElementById("cartDropdown");
  if (dropdown && dropdown.classList.contains("hidden")) {
    toggleCart();
  }
}

function changeQuantity(productId, change) {
  const itemIndex = cartItems.findIndex((item) => item.id == productId);
  if (itemIndex > -1) {
    cartItems[itemIndex].quantity += change;
    if (cartItems[itemIndex].quantity <= 0) {
      cartItems.splice(itemIndex, 1);
    }
    saveCart();
    renderCartDropdown();
    updateCartCounter();
  }
}

function removeFromCart(productId) {
  cartItems = cartItems.filter((item) => item.id != productId);
  saveCart();
  renderCartDropdown();
  updateCartCounter();
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cartItems));
}

// --- CART UI ---

function updateCartCounter() {
  const counter = document.getElementById("cartCounter");
  if (!counter) return;

  const totalCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  counter.textContent = totalCount;

  // Show/Hide counter badge
  if (totalCount > 0) {
    counter.classList.remove("hidden");
    counter.classList.add("flex");
  } else {
    counter.classList.add("hidden");
    counter.classList.remove("flex");
  }
}

function renderCartDropdown() {
  const container = document.getElementById("cartItemsContainer");
  if (!container) return;

  if (cartItems.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-8 text-gray-500 gap-2">
        <i class="bi bi-cart-x text-3xl opacity-50"></i>
        <span class="text-sm">Your cart is empty</span>
      </div>
    `;
    return;
  }

  let total = 0;

  const itemsHtml = cartItems
    .map((item) => {
      const itemPrice =
        typeof item.price === "number" ? item.price : parseFloat(item.price);
      const itemTotal = itemPrice * item.quantity;
      total += itemTotal;

      return `
      <div class="flex items-center gap-4 mb-4 p-3 rounded-xl bg-white/5 border border-white/5 group hover:border-white/10 transition-colors">
         <img src="${item.image || "placeholder.jpg"}" class="w-16 h-16 rounded-lg object-cover bg-black/50">
         <div class="flex-1 min-w-0">
            <h4 class="font-bold text-sm text-white line-clamp-1">${item.name}</h4>
            <p class="text-primary text-xs font-mono">${itemPrice.toFixed(2)}€</p>
         </div>
         <div class="flex items-center gap-2 bg-black/40 rounded-lg p-1">
            <button onclick="changeQuantity(${item.id}, -1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors">-</button>
            <span class="text-sm font-medium w-4 text-center">${item.quantity}</span>
            <button onclick="changeQuantity(${item.id}, 1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors">+</button>
         </div>
         <button onclick="removeFromCart(${item.id})" class="text-gray-500 hover:text-red-500 transition-colors px-2">
            <i class="bi bi-trash"></i>
         </button>
      </div>
    `;
    })
    .join("");

  // Append Total
  container.innerHTML =
    itemsHtml +
    `
    <div class="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
      <span class="text-gray-400 text-sm">Total</span>
      <span class="font-display font-bold text-xl text-white">${total.toFixed(2)}€</span>
    </div>
  `;
}

// --- WISHLIST LOGIC ---

function toggleWishlist(productId) {
  const index = wishlist.findIndex((item) => item.id == productId);
  if (index > -1) {
    wishlist.splice(index, 1);
  } else {
    const product = products.find((p) => p.id == productId);
    if (product) wishlist.push(product);
  }

  localStorage.setItem("wishlist", JSON.stringify(wishlist));

  // Re-render to update icons
  renderProducts(products);
}

function isInWishlist(productId) {
  return wishlist.some((item) => item.id == productId);
}

// --- UI HELPERS ---

function toggleSearch() {
  const modal = document.getElementById("searchModal");
  if (modal.classList.contains("hidden")) {
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
  } else {
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  if (menu.classList.contains("translate-x-full")) {
    menu.classList.remove("translate-x-full");
  } else {
    menu.classList.add("translate-x-full");
  }
}

function toggleCart() {
  const dropdown = document.getElementById("cartDropdown");
  const itemsContainer = document.getElementById("cartItemsContainer");

  if (dropdown.classList.contains("hidden")) {
    // Open
    dropdown.classList.remove("hidden");
    // Render content fresh
    renderCartDropdown();

    setTimeout(() => {
      dropdown.classList.remove("opacity-0", "-translate-y-2");
    }, 10);
  } else {
    // Close
    dropdown.classList.add("opacity-0", "-translate-y-2");
    setTimeout(() => dropdown.classList.add("hidden"), 200);
  }
}
