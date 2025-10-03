# 🔧 Finale Fixes - Noch zu beheben

## **Problem 1: Schnellbestellung-Preis bei 26, 12, 22**

Die minifizierte ColorSelection in Produkt 12 und 22 hat eine unvollständige `updatePrices()` Funktion.

**Lösung:**
Die minifizierte Version muss durch die vollständige Version ersetzt werden (wie bei Produkt 26).

**Betroffene Dateien:**
- `produkt-12.html` - Zeile 869 (minifizierte ColorSelection)
- `produkt-22.html` - Zeile 918 (minifizierte ColorSelection)

**Zu ersetzen mit:**
```javascript
updatePrices(color) {
    const priceTag = document.querySelector('.price-tag');
    if (priceTag && color.price) {
        priceTag.textContent = `€${color.price}`;
    }
    
    const priceSelectors = ['.price-tag', '.current-price', '.hero-price', 'h2.display-4', '#totalPrice', '#totalPrice-mobile'];
    priceSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (color.price && el.textContent.includes('€')) {
                el.textContent = `€${color.price}`;
            }
        });
    });

    if (typeof updateTotalPrice === 'function') {
        if (window.product) {
            window.product.price = color.price || window.product.price;
        }
        updateTotalPrice();
    }
}
```

## **Problem 2: Warenkorb zeigt keine Farbe/Preis**

Die `enhanceAddToCartButtons()` Funktion wird aufgerufen, aber die Farbe wird nicht korrekt übertragen.

**Mögliche Ursachen:**
1. `cart.js` überschreibt die Produktdaten
2. Die Farbe wird nicht im localStorage gespeichert
3. `cart-color-extension.js` greift nicht

**Lösung:**
Prüfen ob `cart-color-extension.js` richtig funktioniert und ob die Farbe im Produktnamen enthalten ist.

**Debug-Schritte:**
1. F12 → Console öffnen
2. Farbe wählen
3. "Jetzt kaufen" klicken
4. Console-Log prüfen: "🎨 Produkt mit Farbe zum Warenkorb hinzugefügt: ..."
5. localStorage prüfen: `localStorage.getItem('cart')`

## **Schnelle Lösung:**

### **Für Produkt 12 und 22:**
Ersetze die minifizierte ColorSelection durch die vollständige Version von Produkt 26 (Zeilen 863-1101).

### **Für Warenkorb:**
Stelle sicher, dass in `enhanceAddToCartButtons()` der Name korrekt gesetzt wird:
```javascript
name: `${product.name.replace(/\s*\([^)]*\)$/, '')} (${selectedColor.name})`
```

**Status:**
- ⏳ Schnellbestellung-Preis: Muss manuell gefixt werden
- ⏳ Warenkorb: Debugging erforderlich
