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
          localStorage.setItem("cart", JSON.stringify(cart));

          const cartItem = container.closest(".cart-item");
          const nameElement = cartItem?.querySelector("h5");
          if (nameElement) nameElement.textContent = cart[itemIndex].name;

          const imgElement = cartItem?.querySelector(".cart-item-image");
          if (imgElement)
            imgElement.src = getColorSpecificImagePath(product, colorName);
        }
      });
    });

    const oldSelection = container.querySelector(".cart-item-color-selection");
    if (oldSelection) oldSelection.remove();
    container.appendChild(selectionContainer);
  } catch (error) {
    console.error("Fehler beim Rendern der Farbauswahl:", error);
  }
}

function extractColorFromName(name) {
  const match = name.match(/\(([^)]+)\)$/);
  return match ? match[1] : null;
}

function getColorSpecificImagePath(product, colorName) {
  const colorImageMappings = {
    33: {
      "Cherry Blossoms":
        "produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier Cherry blossoms.jpg",
      "Green Tea":
        "produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier green tea.jpg",
      Jasmine:
        "produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier jasmine.jpg",
      Lavender:
        "produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lavender.jpg",
      Lemon:
        "produkt bilder/Aromatherapy essential oil humidifier bilder/Aromatherapy essential oil humidifier lemon.jpg",
    },
  };
  const mapping = colorImageMappings[product.id];
  if (mapping && mapping[colorName]) return mapping[colorName];

  const colorData = product.colors.find((c) => c.name === colorName);
  if (colorData && colorData.image) return colorData.image;

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

document.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver(() => {
    const cartContent = document.getElementById("cartContent");
    if (cartContent && cartContent.querySelector(".cart-item")) {
      initCartColorSelection();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(initCartColorSelection, 1000);
});
