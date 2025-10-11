// ============================================
// CART COLOR IMAGES ONLY - Finale Version
// ============================================

console.log("🖼️ Cart Color Images Only geladen");

async function renderImageColorSelection(item, container) {
  if (!item || !container) return;

  try {
    const response = await fetch("products.json");
    const products = await response.json();
    const product = products.find((p) => p.id === parseInt(item.id));

    if (!product || !product.colors || product.colors.length === 0) return;

    const selectionContainer = document.createElement("div");
    selectionContainer.className = "cart-item-color-selection";
    // Auf großen Bildschirmen Full-bleed aktivieren
    try {
      if (window && window.innerWidth >= 1000) {
        selectionContainer.classList.add("full-bleed");
      }
    } catch (e) {
      // window might not be available in some contexts
    }

    const labelSpan = document.createElement("span");
    labelSpan.className = "cart-color-main-label";
    labelSpan.textContent = "Farbe:";
    selectionContainer.appendChild(labelSpan);

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "cart-color-options-scroll";
    selectionContainer.appendChild(optionsContainer);

    const currentColor =
      extractColorFromName(item.name) || product.colors[0].name;

    product.colors.forEach((color) => {
      const optionDiv = document.createElement("div");
      optionDiv.className = `cart-color-option ${
        color.name === currentColor ? "selected" : ""
      }`;

      const label = document.createElement("label");
      const img = document.createElement("img");
      img.src = getColorSpecificImagePath(product, color.name);
      img.alt = color.name;
      img.className = "cart-color-image";

      const nameSpan = document.createElement("span");
      nameSpan.className = "cart-color-name";
      nameSpan.textContent = color.name;

      label.appendChild(img);
      label.appendChild(nameSpan);
      optionDiv.appendChild(label);
      optionsContainer.appendChild(optionDiv);

      label.addEventListener("click", (e) => {
        e.preventDefault();
        const colorName = color.name;
        optionsContainer
          .querySelectorAll(".cart-color-option")
          .forEach((opt) => opt.classList.remove("selected"));
        optionDiv.classList.add("selected");

        let cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const itemIndex = cart.findIndex((cartItem) => cartItem.id == item.id);
        if (itemIndex !== -1) {
          const baseName = cart[itemIndex].name.replace(/\s*\([^)]*\)$/, "");
          cart[itemIndex].name = `${baseName} (${colorName})`;
          cart[itemIndex].selectedColor = colorName;
          
          // Aktualisiere Preis basierend auf der gewählten Farbe
          if (color.price) {
            cart[itemIndex].price = color.price;
            console.log(`💰 Preis aktualisiert für ${colorName}: €${color.price}`);
          }
          
          localStorage.setItem("cart", JSON.stringify(cart));

          const cartItem = container.closest(".cart-item");
          const nameElement = cartItem?.querySelector("h5");
          if (nameElement) nameElement.textContent = cart[itemIndex].name;
          
          // Aktualisiere Preisanzeige im DOM
          if (color.price) {
            const priceElement = cartItem?.querySelector(".cart-item-price, .price, .item-price");
            if (priceElement) {
              priceElement.textContent = `€${color.price.toFixed(2)}`;
              console.log(`💰 Preisanzeige aktualisiert: €${color.price.toFixed(2)}`);
            }
            
            // Aktualisiere Warenkorb-Gesamtsumme
            setTimeout(() => {
              if (typeof updateCartDisplay === 'function') {
                updateCartDisplay();
                console.log('🔄 Warenkorb-Gesamtsumme aktualisiert');
              }
            }, 200);
          }

          const imgElement = cartItem?.querySelector(".cart-item-image");
          if (imgElement) {
            const newImagePath = getColorSpecificImagePath(product, colorName);
            imgElement.src = newImagePath;
            console.log('🖼️ Hauptbild aktualisiert auf:', newImagePath);
          }
          
          // Aktualisiere nur das Hauptproduktbild, NICHT die Farbauswahl-Thumbnails
          setTimeout(() => {
            const mainImages = cartItem?.querySelectorAll('.cart-item-image');
            mainImages?.forEach(img => {
              const correctPath = getColorSpecificImagePath(product, colorName);
              img.src = correctPath;
              console.log('🔄 Hauptbild aktualisiert auf:', correctPath);
            });
          }, 100);
        }
      });
    });

    const oldSelection = container.querySelector(".cart-item-color-selection");
    if (oldSelection) oldSelection.remove();
    container.appendChild(selectionContainer);

    // WICHTIG: Setze das initiale Hauptbild UND Produktname basierend auf der aktuell ausgewählten Farbe
    const cartItem = container.closest(".cart-item");
    const mainImage = cartItem?.querySelector(".cart-item-image, img");
    const nameElement = cartItem?.querySelector("h5, .cart-item-name, .product-name");
    
    if (mainImage && currentColor) {
      const initialImagePath = getColorSpecificImagePath(product, currentColor);
      mainImage.src = initialImagePath;
      console.log('🎯 INITIALES Hauptbild gesetzt für Farbe', currentColor, ':', initialImagePath);
    }
    
    if (nameElement && currentColor) {
      // Aktualisiere auch den Produktnamen mit der Farbe
      let baseName = product.name.replace(/\s*\([^)]*\)$/, '');
      const newName = `${baseName} (${currentColor})`;
      nameElement.textContent = newName;
      console.log('📝 INITIALER Produktname gesetzt:', newName);
      
      // Aktualisiere auch den localStorage
      let cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const itemIndex = cart.findIndex((cartItem) => cartItem.id == item.id);
      if (itemIndex !== -1) {
        cart[itemIndex].name = newName;
        cart[itemIndex].selectedColor = currentColor;
        localStorage.setItem("cart", JSON.stringify(cart));
        console.log('💾 Warenkorb aktualisiert mit Farbe:', currentColor);
      }
    }
  } catch (error) {
    console.error("Fehler beim Rendern der Farbauswahl:", error);
  }
}

function extractColorFromName(name) {
  const match = name.match(/\(([^)]+)\)$/);
  return match ? match[1] : null;
}

function getColorSpecificImagePath(product, colorName) {
  console.log('🖼️ GLOBALER getColorSpecificImagePath für Produkt', product.id, 'Farbe:', colorName);
  
  // GLOBALER ANSATZ: Verwende immer die Farb-Daten aus products.json
  if (product.colors && Array.isArray(product.colors)) {
    const colorData = product.colors.find((c) => c.name === colorName);
    if (colorData && colorData.image) {
      console.log('✅ Globale Farb-Daten gefunden:', colorData.image);
      return colorData.image;
    }
  }

  console.log('⚠️ Fallback zum Hauptbild:', product.image);
  return product.image;
}

function initCartColorSelection() {
  const cartItems = JSON.parse(localStorage.getItem("cart") || "[]");
  const cartItemElements = document.querySelectorAll(".cart-item");

  cartItemElements.forEach((element, index) => {
    const itemData = cartItems[index];
    if (itemData) {
      if (!element.querySelector(".cart-item-color-selection")) {
        renderImageColorSelection(itemData, element);
      }
    }
  });
}

// Funktion zum Korrigieren aller Hauptbilder UND Produktnamen basierend auf Farben
async function fixAllCartImages() {
  try {
    const response = await fetch("products.json");
    const products = await response.json();
    const cartItems = JSON.parse(localStorage.getItem("cart") || "[]");
    let cartUpdated = false;
    
    document.querySelectorAll(".cart-item").forEach((cartElement, index) => {
      const cartItem = cartItems[index];
      if (!cartItem) return;
      
      const currentColor = extractColorFromName(cartItem.name);
      const product = products.find(p => p.id === parseInt(cartItem.id));
      
      if (product) {
        // Korrigiere das Hauptbild
        const mainImage = cartElement.querySelector(".cart-item-image, img");
        if (mainImage && currentColor) {
          const correctImagePath = getColorSpecificImagePath(product, currentColor);
          mainImage.src = correctImagePath;
          console.log('🔧 Bild korrigiert für', cartItem.name, ':', correctImagePath);
        }
        
        // Korrigiere den Produktnamen falls nötig
        const nameElement = cartElement.querySelector("h5, .cart-item-name, .product-name");
        if (nameElement && product.colors && product.colors.length > 0) {
          let shouldUpdateName = false;
          let newName = cartItem.name;
          
          // Wenn keine Farbe im Namen, aber Produkt hat Farben -> erste Farbe hinzufügen
          if (!currentColor) {
            const firstColor = product.colors[0].name;
            newName = `${product.name} (${firstColor})`;
            shouldUpdateName = true;
            console.log('🎨 Erste Farbe hinzugefügt:', newName);
          }
          // Wenn Farbe im Namen, aber Name nicht korrekt formatiert
          else if (!cartItem.name.includes(`(${currentColor})`)) {
            const baseName = product.name.replace(/\s*\([^)]*\)$/, '');
            newName = `${baseName} (${currentColor})`;
            shouldUpdateName = true;
            console.log('📝 Produktname korrigiert:', newName);
          }
          
          if (shouldUpdateName) {
            nameElement.textContent = newName;
            cartItems[index].name = newName;
            cartItems[index].selectedColor = currentColor || product.colors[0].name;
            cartUpdated = true;
          }
        }
      }
    });
    
    // Speichere aktualisierte Warenkorb-Daten
    if (cartUpdated) {
      localStorage.setItem("cart", JSON.stringify(cartItems));
      console.log('💾 Warenkorb global aktualisiert');
    }
  } catch (error) {
    console.error('❌ Fehler beim Korrigieren der Bilder und Namen:', error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver(() => {
    const cartContent = document.getElementById("cartContent");
    if (cartContent && cartContent.querySelector(".cart-item")) {
      initCartColorSelection();
      // Zusätzlich: Korrigiere alle Bilder
      setTimeout(fixAllCartImages, 500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => {
    initCartColorSelection();
    fixAllCartImages();
  }, 1000);
});
