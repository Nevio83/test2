// Warenkorb-Initialisierung
let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

// Verhindere mehrfache Initialisierung
let addToCartButtonsInitialized = false;

// Make sure clearCart is globally available immediately
window.clearCart = function () {
  try {
    cartItems = [];
    localStorage.setItem("cart", JSON.stringify(cartItems));

    // Update counter and dropdown immediately
    if (typeof updateCartCounter === "function") {
      updateCartCounter();
    } else {
      console.log("updateCartCounter function not available");
    }

    // Sofort ausblenden
    console.log("Cart cleared, hiding dropdown");
    const cartDropdown = document.getElementById("cartDropdown");
    if (cartDropdown) {
      // Flüssige Schließ-Animation
      cartDropdown.classList.add("hiding");
      cartDropdown.classList.remove("show");

      setTimeout(() => {
        cartDropdown.style.display = "none";
        cartDropdown.classList.remove("hiding");
      }, 300);
    }

    // Show confirmation message
    if (typeof showAlert === "function") {
      showAlert("Warenkorb wurde geleert");
    } else {
      alert("Warenkorb wurde geleert");
    }

    console.log("Cart cleared successfully");
  } catch (error) {
    // Die technische Meldung gehoert in die Konsole, nicht in ein
    // Meldungsfenster vor dem Kunden. Der Erfolgsfall darueber nutzt bereits
    // showAlert — der Fehlerfall tat es nicht.
    console.error("Error in clearCart:", error);
    if (typeof showAlert === "function") {
      showAlert("Der Warenkorb konnte nicht geleert werden. Bitte lade die Seite neu.");
    }
  }
};

// Wishlist-Initialisierung
let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];

// Globale Produktliste
let products = [];

// Liefert die SEO-Slug-URL einer Produktseite (root-relativ). Sucht den Slug
// in der geladenen Produktliste bzw. im localStorage-Cache; Fallback = alte ID-URL.
function productHref(id) {
  let list = products && products.length ? products : null;
  if (!list) {
    try {
      list = JSON.parse(localStorage.getItem("allProducts") || "[]");
    } catch (e) {
      list = [];
    }
  }
  const p = list.find((x) => Number(x.id) === Number(id));
  return p && p.slug
    ? `/produkte/${p.slug}.html`
    : `/produkte/produkt-${id}.html`;
}

function initializeProductPageWishlist() {
  const productPageButtons = document.querySelectorAll(".wishlist-button");
  if (productPageButtons.length > 0 && window.product) {
    console.log(
      `💜 Initializing ${productPageButtons.length} wishlist buttons on product page...`,
    );
    productPageButtons.forEach((button) => {
      // Remove old listeners to be safe
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", function (e) {
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
  document
    .querySelectorAll(`[data-product-id="${productId}"]`)
    .forEach((btn) => {
      if (
        btn.classList.contains("wishlist-button") ||
        btn.classList.contains("lumiere-wishlist-btn")
      ) {
        // Toggle active state and icon
        btn.classList.toggle("active", isInList);
        const icon = btn.querySelector("i");
        if (icon) {
          icon.className = isInList ? "bi bi-heart-fill" : "bi bi-heart";
        }
        // If this is a product page wishlist button with text, update the label like product 10
        if (btn.classList.contains("wishlist-button")) {
          btn.innerHTML = isInList
            ? '<i class="bi bi-heart-fill"></i> Entfernen'
            : '<i class="bi bi-heart"></i> Zur Wunschliste';
        }
      }
    });
}

// Produktdaten laden mit Cache-Busting
// Gecachtes Promise: products.json wird pro Seitenaufruf nur EINMAL geladen
// (vorher fetchte jeder der ~20 Aufrufe die 64-KB-Datei neu). Parallele Aufrufe
// teilen sich denselben Fetch.
let _productsPromise = null;
async function loadProducts(forceReload = false) {
  if (_productsPromise && !forceReload) return _productsPromise;
  _productsPromise = (async () => {
  try {
    // Cache-busting für products.json
    const cacheBuster = Date.now();
    // Prüfe ob wir auf einer Produktseite sind (im produkte/ Ordner)
    const isProductPage = window.location.pathname.includes("/produkte/");
    const jsonPath = isProductPage ? "../products.json" : "products.json";
    const response = await fetch(`${jsonPath}?v=${cacheBuster}`);
    products = await response.json(); // Nutze die globale Variable

    // Speichere im localStorage als Backup
    localStorage.setItem("allProducts", JSON.stringify(products));

    console.log("📋 Products loaded with cache-busting:", products.length);

    // Validiere kritische Produkte (die 6 problematischen)
    const criticalIds = [10, 11, 19, 20, 24, 25];
    criticalIds.forEach((id) => {
      const product = products.find((p) => Number(p.id) === id);
      if (product) {
        console.log(`✅ Critical product ${id} found:`, product.name);
        // Prüfe auf kaputte Preise
        if (typeof product.price !== "number" || isNaN(product.price)) {
          console.error(`❌ Product ${id} has invalid price:`, product.price);
        }
      } else {
        console.error(`❌ Critical product ${id} NOT FOUND!`);
      }
    });

    // Füge eine Standardbeschreibung hinzu, falls nicht vorhanden
    return products.map((p) => ({
      ...p,
      description: p.description || "",
      // Repariere kaputte Preise
      price: typeof p.price === "number" && !isNaN(p.price) ? p.price : 0,
    }));
  } catch (error) {
    console.error("Fehler beim Laden der Produkte:", error);
    _productsPromise = null; // bei Fehler nächsten Versuch erlauben
    return [];
  }
  })();
  return _productsPromise;
}

// Wishlist-Logik (bereits initialisiert oben)

function getWishlist() {
  return JSON.parse(localStorage.getItem("wishlist")) || [];
}

function setWishlist(wishlist) {
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
}

function isInWishlist(productId) {
  return getWishlist().some((item) => Number(item.id) === Number(productId));
}

function toggleWishlist(productOrId) {
  // Handle both product object and product ID
  let productId, productObj;

  if (typeof productOrId === "object" && productOrId !== null) {
    // It's a product object
    productObj = productOrId;
    productId = productOrId.id;
  } else {
    // It's a product ID
    productId = productOrId;
    productObj = null;
  }

  // Trigger animation immediately for better responsiveness

  // If we already have the product object, use it directly
  if (productObj) {
    handleWishlistToggle(productObj);
  } else {
    // Load products and find the one we need
    loadProducts().then((products) => {
      const product = products.find((p) => Number(p.id) === Number(productId));
      if (!product) {
        console.error(
          "Produkt für die Wunschliste nicht gefunden! ID:",
          productId,
          products,
        );
        alert("Produkt konnte nicht zur Wunschliste hinzugefügt werden.");
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
    wishlist = wishlist.filter(
      (item) => Number(item.id) !== Number(product.id),
    );
    showAlert("Produkt von der Wunschliste entfernt", "wishlist.html");
  } else {
    wishlist.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      description: product.description,
    });
    showAlert("Produkt zur Wunschliste hinzugefügt", "wishlist.html");
  }

  setWishlist(wishlist);

  // Update all wishlist button states for this product - NEW: Direct selector
  const wishlistButtons = document.querySelectorAll(
    `.lumiere-wishlist-btn[data-product-id="${product.id}"]`,
  );
  wishlistButtons.forEach((wishlistButton) => {
    if (wishlistButton) {
      wishlistButton.classList.toggle("active", !wasInWishlist);
      const icon = wishlistButton.querySelector("i");
      if (icon) {
        icon.className = wasInWishlist ? "bi bi-heart" : "bi bi-heart-fill";
      }
    }
  });
  // Also update product page wishlist buttons instantly
  try {
    updateAllWishlistButtonsStates(product.id);
  } catch (_) {
    /* Produktseiten-Buttons optional – Fehler bewusst ignorieren */
  }

  // Update navigation wishlist counter if it exists
  updateWishlistCounter();
}

function updateWishlistCounter() {
  const wishlistCounter = document.getElementById("wishlistCounter");
  if (wishlistCounter) {
    const wishlistCount = getWishlist().length;
    wishlistCounter.textContent = wishlistCount;
    wishlistCounter.style.display = wishlistCount > 0 ? "block" : "none";
  }
}



// Ensure product page wishlist init runs on product pages too
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (window.product) {
      initializeProductPageWishlist();
      updateAllWishlistButtonsStates(window.product.id);
    }
  } catch (e) {
    console.warn("Product page wishlist init failed:", e);
  }
});


// Add-to-cart Buttons initialisieren
function initializeAddToCartButtons() {
  console.log("🛒 Initializing AddToCart buttons...");

  // Warte kurz, um sicherzustellen, dass alle Elemente gerendert sind
  setTimeout(() => {
    // Get ALL add-to-cart buttons (including cart dropdown ones)
    const buttons = document.querySelectorAll(
      ".lumiere-add-to-cart-btn:not(.recommendation-add-btn)",
    );
    console.log(
      "Initializing",
      buttons.length,
      "lumiere-add-to-cart buttons (excluding recommendations)",
    );

    // Entferne alle bestehenden Event-Listener durch Klonen
    buttons.forEach((button, index) => {
      const productId = button.dataset.productId;
      console.log(`Initializing button ${index} for product ${productId}`);

      // Special attention to the problematic products
      const problematicIds = [10, 11, 19, 20, 24, 25];
      if (problematicIds.includes(parseInt(productId))) {
        console.log(
          `🔍 SPECIAL: Initializing problematic product button ${productId}`,
        );
        console.log(`🔍 Button parent:`, button.parentNode?.className);
        console.log(
          `🔍 Button data-product-id:`,
          button.getAttribute("data-product-id"),
        );
      }

      // Klone Button um alle Event-Listener zu entfernen
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      // Füge den Event Listener zum neuen Button hinzu
      newButton.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const productIdFromButton = parseInt(this.dataset.productId);
        const isFromCartDropdown = this.closest("#cartDropdown") !== null;
        console.log(
          "Button clicked for product:",
          productIdFromButton,
          "from cart dropdown:",
          isFromCartDropdown,
        );

        if (productIdFromButton && !isNaN(productIdFromButton)) {
          // Verhindere mehrfache Klicks
          if (this.disabled) return;
          this.disabled = true;

          // Use different logic for cart dropdown buttons
          if (isFromCartDropdown) {
            // For cart dropdown: use addProductToCart directly with flag
            loadProducts().then((products) => {
              addProductToCart(products, productIdFromButton, true);
            });

            // Visual feedback for cart dropdown buttons
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bi bi-check"></i> Hinzugefügt';
            this.style.background = "var(--success-color)";

            setTimeout(() => {
              this.innerHTML = originalText;
              this.style.background = "";
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
          console.error("Invalid product ID:", productIdFromButton);
        }
      });
    });

    console.log("✅ AddToCart buttons initialization completed");
  }, 100);
}

// Produktkarten-Klicks initialisieren
function initializeProductCardClicks() {
  console.log("🔗 Initializing product card clicks...");

  document.querySelectorAll(".lumiere-product-card").forEach((card) => {
    const productId = parseInt(card.dataset.productId);
    console.log(`Setting up click for product card ${productId}`);

    card.addEventListener("click", (e) => {
      // Verhindere Navigation bei Klicks auf Buttons oder deren Kinder
      if (
        e.target.closest(".lumiere-wishlist-btn") ||
        e.target.closest(".lumiere-add-to-cart-btn") ||
        e.target.classList.contains("lumiere-add-to-cart-btn") ||
        e.target.closest("button")
      ) {
        console.log("Click on button - preventing navigation");
        return;
      }

      console.log(`🔗 Navigating to product page for ID: ${productId}`);

      // Only navigate to existing product pages (10+)
      if (productId >= 10) {
        window.location.href = productHref(productId);
      } else {
        console.log("Product page does not exist for ID:", productId);
      }
    });

    // Cursor-Pointer für bessere UX
    card.style.cursor = "pointer";
  });

  console.log("✅ Product card clicks initialized");
}

// Warenkorb-Funktionen
function addToCart(productId) {
  console.log("addToCart called with productId:", productId);

  if (!productId || isNaN(productId)) {
    console.error("Invalid product ID:", productId);
    return;
  }

  // Versuche zuerst, das Produkt aus dem localStorage zu laden (falls verfügbar)
  let products = JSON.parse(localStorage.getItem("allProducts") || "[]");

  if (products.length === 0) {
    // Wenn keine Produkte im localStorage sind, lade sie von der Datei
    loadProducts()
      .then((loadedProducts) => {
        console.log("Products loaded from file:", loadedProducts.length);
        // Speichere die Produkte im localStorage für zukünftige Verwendung
        localStorage.setItem("allProducts", JSON.stringify(loadedProducts));
        addProductToCart(loadedProducts, productId);
      })
      .catch((error) => {
        console.error("Error loading products:", error);
        alert("Fehler beim Laden der Produkte.");
      });
  } else {
    console.log("Products loaded from localStorage:", products.length);
    addProductToCart(products, productId);
  }
}

function addProductToCart(productsParam, productId, fromCartDropdown = false) {
  // Fallback: Wenn keine Produkte übergeben wurden oder die globale Variable leer ist, lade sie
  if (
    (!productsParam || productsParam.length === 0) &&
    (!products || products.length === 0)
  ) {
    console.log(
      "⚠️ Keine Produkte verfügbar, lade aus localStorage oder JSON...",
    );
    // Versuche aus localStorage
    const storedProducts = localStorage.getItem("allProducts");
    if (storedProducts) {
      products = JSON.parse(storedProducts);
      console.log("📦 Produkte aus localStorage geladen:", products.length);
    }
  }

  // Verwende die übergebenen Produkte oder die globale Variable
  const availableProducts =
    productsParam && productsParam.length > 0 ? productsParam : products;
  console.log(
    "Looking for product ID:",
    productId,
    "in",
    availableProducts.length,
    "products",
  );

  const product = availableProducts.find(
    (p) => Number(p.id) === Number(productId),
  );

  if (!product) {
    console.error("Product not found for ID:", productId);
    console.log(
      "Available product IDs:",
      availableProducts.map((p) => p.id),
    );
    if (!fromCartDropdown) {
      alert("Produkt konnte nicht gefunden werden.");
    }
    return;
  }

  console.log("Found product:", product.name);

  // Check if cart dropdown is currently open before adding product
  const cartDropdown = document.getElementById("cartDropdown");
  const wasDropdownOpen =
    cartDropdown && cartDropdown.classList.contains("show");
  console.log("Cart dropdown was open before adding product:", wasDropdownOpen);

  // Always read from localStorage to ensure we have the latest data
  cartItems = JSON.parse(localStorage.getItem("cart")) || [];

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
      price: window.product.price,
    };
    console.log("🎨 Farbe von window.product:", currentColor);
  }

  // Methode 2: getSelectedColor() (für Produkt 11, 12, 17, 21, 26)
  else if (
    window.getSelectedColor &&
    typeof window.getSelectedColor === "function"
  ) {
    const selectedColorObj = window.getSelectedColor();
    console.log("🔍 getSelectedColor() Ergebnis:", selectedColorObj);

    if (selectedColorObj && selectedColorObj.name) {
      currentColor = selectedColorObj.name;
      currentColorData = selectedColorObj;
      console.log(
        `getSelectedColor() returned color: ${currentColor}, data:`,
        selectedColorObj,
      );
    } else {
      console.log("getSelectedColor() did not return valid data");
    }
  } else {
    console.log("getSelectedColor() function not found");
  }

  console.log('Finale Farbe für Warenkorb:', currentColor);

  if (currentColor) {
    // Bei Produkten mit Farbe: Nur EXAKT gleiche ID + Farbe ist "existing"
    // WICHTIG: Bundles NIE zusammenführen
    existingItem = cartItems.find(
      (item) =>
        item.isBundle !== true &&
        Number(item.id) === Number(productId) &&
        item.selectedColor === currentColor,
    );
    console.log(
      `🎨 Suche nach Produkt ${productId} mit Farbe "${currentColor}":`,
      existingItem ? "GEFUNDEN - Menge erhöhen" : "NEUER ARTIKEL",
    );
  } else {
    // Bei Produkten ohne Farbe: Nur ID prüfen (und keine Farbe vorhanden)
    // WICHTIG: Bundles NIE zusammenführen
    existingItem = cartItems.find(
      (item) =>
        item.isBundle !== true &&
        Number(item.id) === Number(productId) &&
        !item.selectedColor,
    );
    console.log(
      `📦 Suche nach Produkt ${productId} OHNE Farbe:`,
      existingItem ? "GEFUNDEN - Menge erhöhen" : "NEUER ARTIKEL",
    );
  }

  if (existingItem) {
    existingItem.quantity++;
    console.log("Updated existing item quantity:", existingItem.quantity);
  } else {
    // Erstelle neuen Warenkorb-Artikel
    let productToAdd = { ...product, quantity: 1 };

    if (currentColor && currentColorData) {
      // Produkt MIT Farbe - erstelle eindeutigen Artikel
      let cleanName = product.name.replace(/\s*\([^)]*\)$/, "");
      productToAdd = {
        ...productToAdd,
        name: `${cleanName} (${currentColor})`,
        selectedColor: currentColor,
        selectedColorCode: currentColorData.code || "#000000",
        selectedColorSku: currentColorData.sku || "default",
        price: currentColorData.price || product.price,
        originalPrice: currentColorData.originalPrice || product.originalPrice,
        // Eindeutige ID für verschiedene Farben
        cartItemId: `${productId}-${currentColor.replace(/\s+/g, "-").toLowerCase()}`,
      };
      console.log(
        "🎨 NEUER Artikel mit Farbe:",
        productToAdd.name,
        "- ID:",
        productToAdd.cartItemId,
        "- Preis:",
        productToAdd.price,
      );
    } else {
      // Produkt OHNE Farbe
      productToAdd.cartItemId = `${productId}-no-color`;
      console.log(
        "📦 NEUER Artikel ohne Farbe:",
        productToAdd.name,
        "- ID:",
        productToAdd.cartItemId,
      );
    }

    cartItems.push(productToAdd);
    console.log("✅ Artikel zum Warenkorb hinzugefügt:", productToAdd);
  }

  // Speichere den aktuellen Warenkorb immer im localStorage
  // Nutze saveCartWithColor falls verfügbar (aus cart.js)
  if (typeof saveCartWithColor === "function") {
    saveCartWithColor(cartItems);
  } else {
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }

  // Update counter and dropdown immediately
  updateCartCounter();

  // Show alert only if not from cart dropdown
  if (!fromCartDropdown) {
    showAlert("Produkt wurde zum Warenkorb hinzugefügt");
  }

  // (Die Knopf-Animation gehoerte zum aufklappbaren Warenkorb-Fenster, das es
  // nicht mehr gibt — siehe Entfernung des toten Fensters.)

  // (Hier wurde das aufklappbare Warenkorb-Fenster nachgezeichnet und offen
  // gehalten. Es gibt kein solches Fenster mehr.)

  // --- NEU: Wenn der User auf cart.html ist, direkt die Seite aktualisieren ---
  if (window.location.pathname.endsWith("cart.html")) {
    if (typeof updateCartPage === "function") {
      updateCartPage();
    } else if (typeof window.location.reload === "function") {
      window.location.reload();
    }
  }
}

// Make updateCartCounter globally available
window.updateCartCounter = function () {
  const counter = document.getElementById("cartCounter");
  if (counter) {
    // Always read from localStorage to ensure we have the latest data
    const currentCart = JSON.parse(localStorage.getItem("cart")) || [];
    const totalItems = currentCart.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );
    console.log("Updating cart counter - total items:", totalItems);

    // Update counter text
    counter.textContent = totalItems;

    // Show/hide counter based on total items
    if (totalItems === 0) {
      counter.style.display = "none";
    } else {
      counter.style.display = "flex";
    }

  } else {
    console.log("Cart counter element not found");
  }
};
// Animation trigger functions



// Make showAlert globally available with enhanced animations
window.showAlert = function (
  message,
  redirectTo = "cart.html",
  preventDropdownClose = false,
) {
  // Korrigiere den Pfad für Produktseiten
  const isProductPage = window.location.pathname.includes("/produkte/");
  if (isProductPage && !redirectTo.startsWith("../")) {
    redirectTo = "../" + redirectTo;
  }
  // Remove any existing notifications immediately
  const existingAlerts = document.querySelectorAll(
    ".alert.alert-success.position-fixed",
  );
  existingAlerts.forEach((existingAlert) => {
    existingAlert.remove();
  });

  const alert = document.createElement("div");
  alert.className =
    "alert alert-success position-fixed end-0 m-4 shadow-lg notification-slide-in";
  alert.style.zIndex = "20000";
  alert.style.fontSize = "1rem";
  alert.style.minWidth = "160px";
  alert.style.maxWidth = "320px";
  alert.style.padding = "0.75rem 2rem";
  alert.style.textAlign = "center";
  alert.style.borderRadius = "2rem";
  alert.style.boxShadow = "0 8px 32px rgba(0,0,0,.04)";
  alert.style.background = "linear-gradient(90deg, #4f8cff 0%, #38c6ff 100%)";
  alert.style.color = "#fff";
  alert.style.fontWeight = "500";
  alert.style.letterSpacing = "0.02em";
  alert.style.pointerEvents = "auto";
  alert.style.position = "fixed";
  alert.style.right = "2.5rem";
  alert.style.top = "calc(56px + 1.2rem)";
  alert.style.cursor = "pointer";
  alert.textContent = message;
  alert.addEventListener("click", () => {
    window.location.href = redirectTo;
  });
  document.body.appendChild(alert);

  setTimeout(() => {
    if (document.body.contains(alert)) {
      alert.classList.remove("notification-slide-in");
      alert.classList.add("notification-slide-out");
      setTimeout(() => alert.remove(), 400);
    }
  }, 3000);
};

// changeQuantity function
function changeQuantity(productId, change) {
  console.log("changeQuantity called:", productId, change);

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const itemIndex = cart.findIndex(
    (item) => Number(item.id) === Number(productId),
  );

  if (itemIndex !== -1) {
    cart[itemIndex].quantity += change;

    // Entferne Item wenn Quantity 0 oder weniger
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCounter();
  }
}

// removeFromCart function
function removeFromCart(productId) {
  console.log("removeFromCart called:", productId);

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart = cart.filter((item) => Number(item.id) !== Number(productId));

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCounter();
}


// Make it globally available





// Deep diagnosis removed - problem solved!



// Entprelltes Such-Tracking: protokolliert erst ~1,2 s nach dem letzten Tastendruck
// den finalen Begriff + Trefferzahl (nicht jeden Zwischenstand).
let _searchTrackTimer = null;




// Warenkorb Dropdown öffnen/schließen und rendern









function initializeWishlistButtons() {
  // Warte kurz, um sicherzustellen, dass alle Elemente gerendert sind
  setTimeout(() => {
    const buttons = document.querySelectorAll(".lumiere-wishlist-btn");
    console.log("Found", buttons.length, "wishlist buttons");

    buttons.forEach((button, index) => {
      const productId = button.dataset.productId;
      console.log(
        `Initializing wishlist button ${index} for product ${productId}`,
      );

      // Special attention to the problematic products
      const problematicIds = [10, 11, 19, 20, 24, 25];
      if (problematicIds.includes(parseInt(productId))) {
        console.log(
          `🔍 SPECIAL: Initializing problematic wishlist button ${productId}`,
        );
        console.log(`🔍 Button parent:`, button.parentNode?.className);
        console.log(
          `🔍 Button data-product-id:`,
          button.getAttribute("data-product-id"),
        );
      }

      // Entferne alle bestehenden Event Listener
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      // Setze den korrekten Zustand basierend auf der Wunschliste
      const isInWish = isInWishlist(productId);
      newButton.classList.toggle("active", isInWish);
      const icon = newButton.querySelector("i");
      if (icon) {
        icon.className = isInWish ? "bi bi-heart-fill" : "bi bi-heart";
      }

      // Füge den Event Listener zum neuen Button hinzu
      newButton.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log("Wishlist button clicked for product:", productId);

        const productIdNum = parseInt(this.dataset.productId);
        if (productIdNum && !isNaN(productIdNum)) {
          toggleWishlist(productIdNum);
        } else {
          console.error("Invalid product ID for wishlist:", productId);
        }
      });
    });
  }, 100);
}

// Doppelte Funktion entfernt - verwende nur die geschützte Version oben




// Start auf jeder Seite, die app.js laedt (Produktseiten, Warenkorb, Merkzettel).
//
// Hier standen zusaetzlich rund 250 Zeilen fuer Bestseller-Streifen,
// Kategorie-Kacheln, Suche und Sortierung. Die Elemente dafuer gibt es in
// KEINER Seite: die Startseite laeuft seit ihrem Umbau auf home.js und bindet
// app.js nicht einmal ein, und ein Suchfeld existiert nur in 404.html — die
// wiederum laedt app.js ebenfalls nicht. Uebrig ist, was wirklich etwas tut.
document.addEventListener("DOMContentLoaded", () => {
  updateCartCounter();
  applyPlaceholdersForMissingImages();

  // Die Produktliste wird gebraucht: addProductToCart() greift auf sie zurueck,
  // wenn eine Produktseite nur die ID uebergibt (window.addProductToCart([], id)).
  loadProducts().catch((e) =>
    console.warn("Produkte konnten nicht geladen werden:", e.message),
  );
});



// Funktion zum sofortigen Anwenden von Platzhaltern für fehlende Bilder
function applyPlaceholdersForMissingImages() {
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    // Prüfe ob das Bild bereits fehlerhaft ist (nur bei wirklich fehlenden Bildern)
    if (
      img.complete &&
      img.naturalWidth === 0 &&
      img.src &&
      !img.src.includes("data:") &&
      !img.src.includes("blob:")
    ) {
      // Warte kurz und prüfe nochmal, um sicherzustellen, dass das Bild wirklich fehlt
      setTimeout(() => {
        if (img.naturalWidth === 0) {
          // Entferne das alte src-Attribut
          img.removeAttribute("src");

          // Setze den Platzhalter-Hintergrund - Einheitlich wie auf PC
          img.style.background = "#f8fafc";
          img.style.display = "flex";
          img.style.alignItems = "center";
          img.style.justifyContent = "center";
          img.style.color = "#2c3e50";
          img.style.fontSize = "4rem";
          img.style.fontWeight = "700";
          img.style.borderRadius = "16px 16px 0 0";
          img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
          img.style.position = "relative";
          img.style.overflow = "hidden";
          img.style.objectFit = "contain";
          img.style.padding = "20px";

          // Füge das große Fragezeichen-Symbol hinzu (wie auf PC)
          img.innerHTML = "?";

          // Mobile Anpassungen für Platzhalter - aber einheitlich
          if (window.innerWidth <= 768) {
            img.style.fontSize = "3rem";
          }
          if (window.innerWidth <= 600) {
            img.style.fontSize = "2.5rem";
          }
          if (window.innerWidth <= 414) {
            img.style.fontSize = "2rem";
          }
          if (window.innerWidth <= 375) {
            img.style.fontSize = "1.8rem";
          }
        }
      }, 200);
    }
  });
}

// Test-Funktion für die Browser-Konsole
window.testProduct1Button = function () {
  console.log("Testing Product 1 button...");
  const button = document.querySelector('.add-to-cart[data-product-id="1"]');
  if (button) {
    console.log("Product 1 button found:", button);
    console.log("Button text:", button.textContent);
    console.log("Button onclick:", button.onclick);
    console.log("Button data-product-id:", button.dataset.productId);

    // Test click
    button.click();
  } else {
    console.error("Product 1 button not found!");
    console.log(
      "All add-to-cart buttons:",
      document.querySelectorAll(".add-to-cart"),
    );
  }
};

// Test-Funktion für Cart Dropdown
window.testCartDropdown = function () {
  console.log("Testing cart dropdown functionality...");

  // Test cart counter
  const counter = document.getElementById("cartCounter");
  console.log("Cart counter element:", counter);
  console.log(
    "Cart counter text:",
    counter ? counter.textContent : "not found",
  );

  // Test cart dropdown
  const dropdown = document.getElementById("cartDropdown");
  console.log("Cart dropdown element:", dropdown);
  console.log(
    "Cart dropdown classes:",
    dropdown ? dropdown.className : "not found",
  );

  // Test cart dropdown body
  const body = document.getElementById("cartDropdownBody");
  console.log("Cart dropdown body:", body);
  console.log(
    "Cart dropdown body HTML:",
    body ? body.innerHTML.substring(0, 200) + "..." : "not found",
  );

  // Test quantity buttons
  const quantityButtons = document.querySelectorAll(
    "#cartDropdown .quantity-btn",
  );
  console.log("Quantity buttons found:", quantityButtons.length);
  quantityButtons.forEach((btn, index) => {
    console.log(`Quantity button ${index}:`, btn);
    console.log(`Button onclick:`, btn.onclick);
    console.log(`Button text:`, btn.textContent);
  });

  // Test remove buttons
  const removeButtons = document.querySelectorAll("#cartDropdown .remove-item");
  console.log("Remove buttons found:", removeButtons.length);
  removeButtons.forEach((btn, index) => {
    console.log(`Remove button ${index}:`, btn);
    console.log(`Button onclick:`, btn.onclick);
    console.log(`Button text:`, btn.textContent);
  });

  // Test current cart state
  const currentCart = JSON.parse(localStorage.getItem("cart")) || [];
  console.log("Current cart from localStorage:", currentCart);
  console.log("Cart items count:", currentCart.length);
};

// Test-Funktion für Empty Cart Verhalten
window.testEmptyCart = function () {
  console.log("Testing empty cart behavior...");

  // Leere den Warenkorb
  clearCart();

  // Prüfe den Zähler
  setTimeout(() => {
    const counter = document.getElementById("cartCounter");
    console.log(
      "Cart counter after clearing:",
      counter ? counter.textContent : "not found",
    );
    console.log(
      "Cart counter display:",
      counter ? counter.style.display : "not found",
    );

    // Füge ein Produkt hinzu
    testAddProduct17();

    setTimeout(() => {
      console.log(
        "Cart counter after adding product:",
        counter ? counter.textContent : "not found",
      );
      console.log(
        "Cart counter display:",
        counter ? counter.style.display : "not found",
      );
    }, 500);
  }, 500);
};

// Direkte Test-Funktion für Produkt 17 (Smart Watch)
window.testAddProduct17 = function () {
  console.log("Directly adding product 17 to cart...");
  const product17 = {
    id: 17,
    name: "Smart Watch Pro",
    price: 299.99,
    category: "Technik/Gadgets",
    image: "produkt bilder/ware.png",
    description: "Moderne Smartwatch mit vielen Features.",
  };

  const existingItem = cartItems.find((item) => Number(item.id) === 17);
  if (existingItem) {
    existingItem.quantity++;
    console.log("Updated existing item quantity:", existingItem.quantity);
  } else {
    cartItems.push({ ...product17, quantity: 1 });
    console.log("Added new item to cart");
  }

  localStorage.setItem("cart", JSON.stringify(cartItems));
  updateCartCounter();
  showAlert("Produkt wurde zum Warenkorb hinzugefügt");

  console.log("Product 17 added to cart successfully!");
};

// Stelle sicher, dass changeQuantity, removeFromCart und clearCart global verfügbar sind:
window.changeQuantity = changeQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.addToCart = addToCart;
window.addProductToCart = addProductToCart;
window.initializeAddToCartButtons = initializeAddToCartButtons;
window.loadProducts = loadProducts;
// window.testCartDropdown = testCartDropdown;
// window.testEmptyCart = testEmptyCart;
// window.testLiveUpdates = testLiveUpdates; // Wird später definiert
// window.testClearCartButton = testClearCartButton; // Auskommentiert - Funktion existiert
// window.testClearCartSimple = testClearCartSimple;


// Test-Funktion für Live Updates
window.testLiveUpdates = function () {
  console.log("Testing live updates...");

  // Test 1: Add product and check counter
  console.log("=== Test 1: Adding product ===");
  testAddProduct1();

  setTimeout(() => {
    const counter = document.getElementById("cartCounter");
    console.log(
      "Counter after adding product:",
      counter ? counter.textContent : "not found",
    );
    console.log(
      "Counter display:",
      counter ? counter.style.display : "not found",
    );

    // Test 2: Open dropdown and check content
    console.log("=== Test 2: Opening dropdown ===");
    const cartButton = document.getElementById("cartButton");
    if (cartButton) {
      cartButton.click();

      setTimeout(() => {
        const dropdown = document.getElementById("cartDropdown");
        const body = document.getElementById("cartDropdownBody");
        const footer = document.getElementById("cartDropdownFooter");
        const total = document.getElementById("cartTotal");

        console.log(
          "Dropdown visible:",
          dropdown ? dropdown.classList.contains("show") : "not found",
        );
        console.log(
          "Dropdown body content length:",
          body ? body.innerHTML.length : "not found",
        );
        console.log(
          "Footer visible:",
          footer ? footer.style.display : "not found",
        );
        console.log("Total amount:", total ? total.textContent : "not found");

        // Test 3: Change quantity
        console.log("=== Test 3: Changing quantity ===");
        const quantityBtn = document.querySelector(
          "#cartDropdown .quantity-btn",
        );
        if (quantityBtn) {
          console.log("Quantity button found, clicking...");
          quantityBtn.click();

          setTimeout(() => {
            console.log(
              "Counter after quantity change:",
              counter ? counter.textContent : "not found",
            );
            console.log(
              "Total after quantity change:",
              total ? total.textContent : "not found",
            );

            // Test 4: Remove item
            console.log("=== Test 4: Removing item ===");
            const removeBtn = document.querySelector(
              "#cartDropdown .remove-item",
            );
            if (removeBtn) {
              console.log("Remove button found, clicking...");
              removeBtn.click();

              setTimeout(() => {
                console.log(
                  "Counter after removal:",
                  counter ? counter.textContent : "not found",
                );
                console.log(
                  "Counter display after removal:",
                  counter ? counter.style.display : "not found",
                );
                console.log(
                  "Dropdown visible after removal:",
                  dropdown ? dropdown.classList.contains("show") : "not found",
                );
              }, 500);
            } else {
              console.log("Remove button not found");
            }
          }, 500);
        } else {
          console.log("Quantity button not found");
        }
      }, 500);
    } else {
      console.log("Cart button not found");
    }
  }, 500);
};

// Test-Funktion für Clear Cart Button
window.testClearCartButton = function () {
  console.log("Testing clear cart button...");

  // First, add some items to cart
  console.log("=== Step 1: Adding items to cart ===");
  testAddProduct1();

  setTimeout(() => {
    // Open dropdown
    console.log("=== Step 2: Opening dropdown ===");
    const cartButton = document.getElementById("cartButton");
    if (cartButton) {
      cartButton.click();

      setTimeout(() => {
        // Check if clear cart button exists
        console.log("=== Step 3: Checking clear cart button ===");
        const clearCartBtn = document.getElementById("clearCart");
        console.log("Clear cart button found:", !!clearCartBtn);

        if (clearCartBtn) {
          console.log("Clear cart button text:", clearCartBtn.textContent);
          console.log("Clear cart button HTML:", clearCartBtn.outerHTML);

          // Test clicking the button
          console.log("=== Step 4: Clicking clear cart button ===");
          clearCartBtn.click();

          setTimeout(() => {
            console.log("=== Step 5: Checking result ===");
            const counter = document.getElementById("cartCounter");
            const dropdown = document.getElementById("cartDropdown");

            console.log(
              "Cart counter after clear:",
              counter ? counter.textContent : "not found",
            );
            console.log(
              "Cart counter display:",
              counter ? counter.style.display : "not found",
            );
            console.log(
              "Dropdown visible:",
              dropdown ? dropdown.classList.contains("show") : "not found",
            );

            // Check localStorage
            const currentCart = JSON.parse(localStorage.getItem("cart")) || [];
            console.log("Cart in localStorage after clear:", currentCart);
            console.log("Cart items count:", currentCart.length);
          }, 500);
        } else {
          console.log("Clear cart button not found!");
        }
      }, 500);
    } else {
      console.log("Cart button not found!");
    }
  }, 500);
};

// Simple test function to check if clearCart is working
window.testClearCartSimple = function () {
  console.log("Testing clearCart function availability...");
  console.log(
    "window.clearCart available:",
    typeof window.clearCart === "function",
  );
  console.log(
    "window.updateCartCounter available:",
    typeof window.updateCartCounter === "function",
  );
  console.log(
    "window.showAlert available:",
    typeof window.showAlert === "function",
  );

  if (typeof window.clearCart === "function") {
    console.log("clearCart function is available, testing...");
    window.clearCart();
  } else {
    console.error("clearCart function is not available!");
  }
};


// Funktion global verfügbar machen



// Make functions globally available

// Rabatt-/Angebotsinfo ermitteln (kompatibel zur Angebotsseite)
function getDiscountInfo(product) {
  const hasSalePrice =
    typeof product.salePrice === "number" && product.salePrice < product.price;
  const hasDiscountPercent =
    typeof product.discountPercent === "number" &&
    product.discountPercent > 0 &&
    product.discountPercent < 1;
  if (hasSalePrice) {
    const discount = Math.max(0, 1 - product.salePrice / product.price);
    return { isDeal: true, discount, newPrice: product.salePrice };
  }
  if (hasDiscountPercent) {
    const newPrice = Math.max(0, product.price * (1 - product.discountPercent));
    return { isDeal: true, discount: product.discountPercent, newPrice };
  }
  return { isDeal: false, discount: 0, newPrice: product.price };
}





// (Hier standen die Behaelter-Liste der Startseiten-Logik und zwei Zaehler
//  fuer deren Wiederholversuche. Keines der sieben Raster existiert noch in
//  einer Seite — die Startseite laeuft auf home.js —, also ist die gesamte
//  Logik dahinter entfallen.)






// Make function globally available

// ===== FULLSCREEN SEARCH FUNCTIONALITY =====

// Global search variables
let allProducts = [];
let searchOverlay = null;
let searchInput = null;
let searchResults = null;
let searchResultsGrid = null;

// Initialize fullscreen search when DOM is ready

// Handle search button click
function handleSearchButtonClick(e) {
  console.log("🔍 Search button clicked!");
  e.preventDefault();
  e.stopPropagation();
  openSearchOverlay();
}



// Open search overlay
function openSearchOverlay() {
  console.log("🔍 Opening search overlay...");

  if (searchOverlay) {
    searchOverlay.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent background scrolling

    // Focus on search input after animation
    setTimeout(() => {
      if (searchInput) {
        searchInput.focus();
      }
    }, 300);

    // Load products if not already loaded
    if (allProducts.length === 0) {
      loadProducts().then((products) => {
        allProducts = products;
        console.log("📦 Products loaded for search:", allProducts.length);
        loadAllProducts();
      });
    } else {
      loadAllProducts();
    }
  }
}

// Close search overlay

// REAL SEARCH FUNCTION

// Simple and direct search function


// Handle category search
function handleCategorySearch(category) {
  console.log("🔍 Category search:", category);

  // Load products first, then filter
  loadProducts()
    .then((products) => {
      let filteredProducts = [];

      if (category === "alle") {
        // Filter out AliExpress products even for "alle"
        filteredProducts = products.filter(
          (product) => !product.sku || !product.sku.startsWith("ALI"),
        );
      } else {
        // Filter products by exact category match AND exclude AliExpress
        filteredProducts = products.filter((product) => {
          const productCategory = product.category;
          const isNotAliExpress =
            !product.sku || !product.sku.startsWith("ALI");
          console.log(
            `🔍 Checking product: ${product.name} - Category: "${productCategory}" vs Filter: "${category}", isNotAli: ${isNotAliExpress}`,
          );
          return productCategory === category && isNotAliExpress;
        });
      }

      console.log(
        "🔍 Found",
        filteredProducts.length,
        "products for category:",
        category,
      );
      console.log("🔍 Available categories:", [
        ...new Set(products.map((p) => p.category)),
      ]);
      console.log(
        "🔍 Filtered products:",
        filteredProducts.map((p) => p.name),
      );

      // Update the main products grid instead of search results
      const allProductsGrid = document.getElementById("searchAllProductsGrid");
      if (allProductsGrid) {
        renderAllProducts(allProductsGrid, filteredProducts);
      }

      // Hide "VIELLEICHT INTERESSIERT SIE DAS FOLGENDE" title when filtering
      const sectionTitle = document.querySelector(
        ".search-all-products .search-section-title",
      );
      if (sectionTitle) {
        if (category === "alle") {
          sectionTitle.textContent = "VIELLEICHT INTERESSIERT SIE DAS FOLGENDE";
        } else {
          const categoryNames = {
            "Technik/Gadgets": "TECHNIK PRODUKTE",
            Beleuchtung: "BELEUCHTUNG PRODUKTE",
            "Körperpflege/Wellness": "WELLNESS PRODUKTE",
            "Haushalt und Küche": "KÜCHEN PRODUKTE",
          };
          sectionTitle.textContent =
            categoryNames[category] || category.toUpperCase() + " PRODUKTE";
        }
      }
    })
    .catch((error) => {
      console.error("❌ Error during category search:", error);
    });
}

// Display search results

// Hide search results

// Load all products for search overlay
function loadAllProducts() {
  console.log("🔍 Loading all products...");

  const allProductsGrid = document.getElementById("searchAllProductsGrid");
  if (!allProductsGrid) {
    console.log("❌ All products grid not found");
    return;
  }

  // Always load products fresh
  loadProducts()
    .then((products) => {
      console.log("📦 Products loaded for search grid:", products.length);
      // Filter out AliExpress products (SKU starts with "ALI")
      const filteredProducts = products.filter(
        (p) => !p.sku || !p.sku.startsWith("ALI"),
      );
      console.log("📦 After filtering AliExpress:", filteredProducts.length);
      renderAllProducts(allProductsGrid, filteredProducts);
    })
    .catch((error) => {
      console.error("❌ Error loading products:", error);
    });
}

function renderAllProducts(allProductsGrid, products) {
  console.log(
    "🎨 renderAllProducts called with:",
    products ? products.length : "null",
    "products",
  );

  if (!allProductsGrid) {
    console.error("❌ Grid element is null!");
    return;
  }

  if (!products || products.length === 0) {
    console.log("❌ No products to render - clearing grid");
    allProductsGrid.innerHTML =
      '<div style="color: white; text-align: center; padding: 40px; font-size: 16px;">Keine Produkte gefunden</div>';
    return;
  }

  console.log(
    "🎨 Rendering products with category grouping:",
    products.length,
  );

  // Group products by category
  const groupedProducts = {};
  products.forEach((product) => {
    const category = product.category || "Andere";
    if (!groupedProducts[category]) {
      groupedProducts[category] = [];
    }
    groupedProducts[category].push(product);
  });

  console.log("📦 Grouped products:", groupedProducts);

  // Create sorted product array (grouped by category but no titles)
  let sortedProducts = [];

  // Category order
  const categoryOrder = [
    "Technik/Gadgets",
    "Beleuchtung",
    "Körperpflege/Wellness",
    "Haushalt und Küche",
  ];

  // Add products in category order
  categoryOrder.forEach((category) => {
    if (groupedProducts[category] && groupedProducts[category].length > 0) {
      sortedProducts = sortedProducts.concat(groupedProducts[category]);
    }
  });

  // Add any remaining categories not in the predefined order
  Object.keys(groupedProducts).forEach((category) => {
    if (
      !categoryOrder.includes(category) &&
      groupedProducts[category].length > 0
    ) {
      sortedProducts = sortedProducts.concat(groupedProducts[category]);
    }
  });

  // Render all products in one grid (but grouped by category)
  allProductsGrid.innerHTML = sortedProducts
    .map((product) => {
      const price = product.price || product.salePrice || 0;
      const formattedPrice =
        typeof price === "number"
          ? price.toFixed(2)
          : parseFloat(price || 0).toFixed(2);

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
    })
    .join("");

  console.log("✅ Products rendered with category grouping");

  // Initialize buttons like on main page
  initializeAddToCartButtons();
  initializeWishlistButtons();
  initializeProductCardClicks();
}

// Simple onclick function for search categories
function searchCategoryClick(button, category) {
  console.log("🔍 Search category clicked:", category);

  // Remove active class from all buttons
  const allButtons = document.querySelectorAll(".lumiere-category-tab");
  allButtons.forEach((btn) => btn.classList.remove("active"));

  // Add active class to clicked button
  button.classList.add("active");

  // Handle the category search
  handleCategorySearch(category);
}

// Navigate to product

// Make functions globally available
window.openSearchOverlay = openSearchOverlay;
window.loadAllProducts = loadAllProducts;
window.searchCategoryClick = searchCategoryClick;
// Funktion zum Öffnen der Suche mit vorausgewählter Kategorie
window.openSearchWithCategory = function (category) {
  console.log("🔍 Opening search with category:", category);

  // Öffne die Suche
  openSearchOverlay();

  // Warte kurz, bis die Suche geöffnet ist
  setTimeout(() => {
    // Finde das Search Overlay
    const searchOverlay = document.querySelector(
      ".fullscreen-search-overlay, #fullscreenSearchOverlay",
    );
    if (!searchOverlay) {
      console.error("Search overlay not found!");
      return;
    }

    console.log("✅ Search overlay found");

    // Suche nach Kategorie-Buttons im Search Overlay
    const categoryTabs = searchOverlay.querySelectorAll(
      ".lumiere-category-tab",
    );
    console.log("Found category buttons:", categoryTabs.length);

    if (categoryTabs.length === 0) {
      console.error("No category tabs found in search overlay!");
      return;
    }

    // Flag ob Button gefunden wurde
    let buttonFound = false;

    // Durchlaufe alle Buttons
    categoryTabs.forEach((button) => {
      const buttonCategory = button.getAttribute("data-category");
      console.log("Checking button:", buttonCategory, "against:", category);

      // Entferne active von allen
      button.classList.remove("active");

      // Aktiviere den richtigen Button
      if (buttonCategory === category) {
        console.log("✅ Found matching button, activating:", category);
        button.classList.add("active");
        buttonFound = true;

        // Rufe searchCategoryClick direkt auf
        searchCategoryClick(button, category);
      }
    });

    if (!buttonFound) {
      console.warn("⚠️ No matching category button found for:", category);
    }
  }, 500);
};

// Funktion zum Überprüfen, ob ein Grid am Ende gescrollt ist
window.checkScrollEndForMoreProducts = function (gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const container = grid.closest(".product-scroll-container");
  if (!container) return;

  let moreButton = container.querySelector(".more-products-button");

  // Erstelle den Button, wenn er noch nicht existiert
  if (!moreButton) {
    moreButton = document.createElement("button");
    moreButton.className = "more-products-button";
    moreButton.innerHTML = `
          <span>Weitere Produkte</span>
          <i class="bi bi-arrow-right-circle"></i>
      `;

    // Bestimme die Kategorie basierend auf der Grid-ID
    let category = "";

    switch (gridId) {
      case "technikGrid":
        category = "Technik/Gadgets";
        break;
      case "beleuchtungGrid":
        category = "Beleuchtung";
        break;
      case "haushaltGrid":
        category = "Haushalt und Küche";
        break;
      case "wellnessGrid":
        category = "Körperpflege/Wellness";
        break;
      default:
        category = "alle";
    }
    moreButton.setAttribute("data-category", category);
    moreButton.onclick = function () {
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
    moreButton.classList.add("show");
  } else {
    moreButton.classList.remove("show");
  }
};

// Initialisiere More Products Buttons
window.initializeMoreProductsButtons = function () {
  const grids = [
    "technikGrid",
    "beleuchtungGrid",
    "haushaltGrid",
    "wellnessGrid",
  ];

  grids.forEach((gridId) => {
    const grid = document.getElementById(gridId);
    if (grid) {
      // Initial check
      checkScrollEndForMoreProducts(gridId);

      // Check on scroll
      grid.addEventListener("scroll", () => {
        checkScrollEndForMoreProducts(gridId);
      });
    }
  });
};

// CSS-Styles dynamisch hinzufügen

// Initialisierung beim DOM Ready
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    initializeMoreProductsButtons();
  }, 1000);
});

// Additional initialization after window load
window.addEventListener("load", () => {
  console.log("🔍 Window loaded, ensuring search is initialized...");

  // Double-check initialization
  const searchBtn = document.getElementById("fullscreenSearchBtn");
  if (searchBtn && !searchBtn.hasAttribute("data-initialized")) {
    console.log("🔍 Re-initializing search...");
    searchBtn.setAttribute("data-initialized", "true");
    searchBtn.addEventListener("click", handleSearchButtonClick);
  }
});

// Emergency fallback - direct event binding
document.addEventListener("click", (e) => {
  if (
    e.target.id === "fullscreenSearchBtn" ||
    e.target.closest("#fullscreenSearchBtn")
  ) {
    console.log("🔍 Emergency search activation!");
    e.preventDefault();
    e.stopPropagation();
    openSearchOverlay();
  }
});

// Global event delegation for search functionality - removed, using direct event listeners instead

// ===== INTEGRIERTE BUTTON COLOR FUNKTIONEN =====




// === DROPDOWN-BILDER KLICKBAR MACHEN ===
// Fügen Sie diesen Code am Ende Ihrer app.js Datei hinzu

// Macht Dropdown-Bilder klickbar

// (Hier bog ein Block das Zeichnen des Warenkorb-Fensters um, damit dessen
// Bilder anklickbar werden — inklusive einer Warteschleife alle 100 ms fuer
// den Fall, dass die Funktion noch nicht da ist. Das Fenster gibt es nicht
// mehr, also auch diesen Block nicht.)

// (Hier hielten vier fast gleiche Bloecke das aufklappbare Warenkorb-Fenster
//  offen, wenn ueber "Das koennte Ihnen gefallen" etwas hinzugefuegt wurde.
//  Das Fenster gibt es nicht mehr.)



