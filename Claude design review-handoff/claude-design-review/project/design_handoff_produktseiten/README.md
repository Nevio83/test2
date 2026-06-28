# Handoff: Produktseiten Premium Dark Redesign

## Übersicht
Der Maios-Shop (maiosshop.com) hat aktuell zwei visuelle Systeme:
- **Startseite** (`index.html`): Premium Dark/Neon-Look mit Tailwind — stark und kohärent
- **Produktseiten** (`produkte/*.html`): Bootstrap 5, helles Layout — bricht die Marke beim ersten Klick

**Aufgabe:** Alle 40 Produktseiten auf den Premium Dark-Look der Startseite bringen.  
Die Design-Referenz liegt als `Produktseite Premium Dark.dc.html` im Projekt.

---

## Fidelity: HIGH-FIDELITY

Das DC ist ein pixel-perfektes Mockup mit finalen Farben, Typografie, Spacing und Interaktionen.  
Die Produktseiten sollen dieses Design 1:1 nachbauen — **in den bestehenden `.html`-Dateien**, ohne Framework-Wechsel. Bootstrap 5 kann entfernt werden, da alles auf Inline-Styles + Custom CSS umgestellt wird.

---

## Ziel-Dateien

```
produkte/elektrischer-wasserspender-fuer-schreibtisch.html  ← Hauptreferenz (Produkt ID 10)
produkte/aroma-oel-diffusor.html
produkte/350ml-elektrischer-mixer-entsafter.html
... (insgesamt 40 Dateien in produkte/)
```

Repo: https://github.com/Nevio83/test2

---

## Design-Tokens

### Farben
```css
--bg-base:       #030304;   /* Seitenhintergrund */
--bg-surface:    #0a0a0b;   /* Raised surfaces */
--bg-elevated:   #141415;   /* Dropdowns, Cards */
--bg-footer:     #020202;   /* Footer */

--brand-violet:  #8b5cf6;   /* PRIMARY */
--brand-cyan:    #22d3ee;   /* SECONDARY */
--brand-pink:    #f472b6;   /* ACCENT */

--text-primary:  #ffffff;
--text-secondary:#9ca3af;
--text-muted:    #6b7280;

--green-stock:   #43e97b;   /* Auf Lager */
--green-emerald: #10b981;   /* Confirmations */
--gold-sale:     #ffd700;   /* Sale-Badge */

--white-a02: rgba(255,255,255,0.02);
--white-a05: rgba(255,255,255,0.05);
--white-a10: rgba(255,255,255,0.10);
--white-a20: rgba(255,255,255,0.20);
```

### Typografie
```css
/* Display / Headlines */
font-family: 'Outfit', sans-serif;
font-weight: 800-900;
letter-spacing: -0.03em bis -0.05em;

/* Body / UI */
font-family: 'Inter', sans-serif;
font-weight: 300-600;

/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap');
```

### Radii
```
999px — Pills (Buttons, Badges, Swatches)
24px  — Produktbild-Container
20px  — Produktkarten
16px  — Bundle-Cards
14px  — Trust-Badges
12px  — Inputs, Thumbnails
```

### Shadows / Glow
```css
/* Primärer CTA-Glow */
box-shadow: 0 0 32px rgba(139,92,246,0.35);
/* Hover */
box-shadow: 0 0 48px rgba(34,211,238,0.4);
/* Karten-Depth */
box-shadow: 0 16px 40px rgba(0,0,0,0.4);
/* Text-Glow (Headlines) */
text-shadow: 0 0 40px rgba(139,92,246,0.2);
```

### Glass-Effekt
```css
background: rgba(255,255,255,0.02);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid rgba(255,255,255,0.06);
border-radius: 24px;
```

### Nav (stickig, oben)
```css
background: rgba(3,3,4,0.75);
backdrop-filter: blur(20px);
border-bottom: 1px solid rgba(255,255,255,0.06);
height: 72px;
position: sticky;
top: 0;
z-index: 100;
```

---

## Seitenstruktur (alle Produktseiten)

### 1. Navigation
- Sticky, Glass-Effekt (siehe oben)
- Links: MAIOS Wordmark (Outfit 900, 1.6rem) + Violet Pulse-Dot (7px, animiert)
- Rechts: "Startseite" Link + Warenkorb-Icon mit Badge (Anzahl aus localStorage)
- Hover-State: `background: rgba(255,255,255,0.05)`, border-radius 999px

### 2. Breadcrumb
```
Startseite > [Kategorie] > [Produktname gekürzt]
font-size: 0.78rem, color: rgba(255,255,255,0.35)
```

### 3. Produkt-Hero (2-Spalten Grid)
```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: 64px;
max-width: 1280px;
padding: 0 24px 80px;
```

**Linke Spalte — Bilder:**
- Hauptbild-Container: `aspect-ratio: 1`, `border-radius: 24px`, Glass-Hintergrund
- Bild als CSS `background-image: url(...)` mit `background-size: contain`
- Hover: `transform: scale(1.05)` auf dem Bild-Div
- Sale-Badge oben links: Violet Pill (`background: #8b5cf6`)
- Thumbnail-Reihe darunter: 72×72px Divs mit `border-radius: 12px`, Klick wechselt Hauptbild
- 3er Trust-Grid darunter: Truck (Cyan), Shield (Violet), Return (Pink)

**Rechte Spalte — Info:**
- Kategorie-Badge (Farbe je Kategorie, siehe unten)
- Produkttitel: Outfit 800, 2rem, `letter-spacing: -0.03em`
- Sterne-Bewertung: `#ffd700`
- Preis: Outfit 800, 2.6rem, weiß + durchgestrichener Originalpreis + Spar-Badge (Gradient-Pill)
- Lieferzeit + "Auf Lager" Badge nebeneinander
- Trennlinie: `height: 1px; background: rgba(255,255,255,0.06)`
- Farbauswahl: runde Pills (36px), Violet-Ring bei Selektion
- Mengen-Auswahl: Pill-Container mit −/+
- CTA "In den Warenkorb": weißer Pill-Button, Violet-Glow
- Wishlist: Ghost-Pill-Button
- Zahlungsarten: kleine Text-Badges (VISA, MASTERCARD, PAYPAL, KLARNA)

### 4. Beschreibung + Bundle (2-Spalten)
```css
display: grid;
grid-template-columns: 1fr 400px;
gap: 32px;
```
- Linke Seite: Glass-Card mit Beschreibung, Features (grüne Check-Icons), Specs-Grid
- Rechte Seite: Bundle-Section (sticky, `top: 88px`), 3 Optionen (1×, 2×, 3× kaufen), Violet-Gradient-Button

### 5. Ähnliche Produkte
- Eyebrow + H2 (Outfit 800, 1.8rem)
- 4-Spalten Grid, Dark Cards mit Hover-Lift und Violet-Border-Glow

### 6. Footer
- `background: #020202`
- 4-Spalten Grid: Brand + 3× Link-Spalten (SHOP, INFOS, KONTAKT)
- Copyright-Zeile, kein weiteres Gedöns

---

## Kategorie-Farben (Badges)

| Kategorie | Farbe | Icon |
|---|---|---|
| Technik/Gadgets | `#43e97b` (Grün) | `bi-cpu` |
| Beleuchtung | `#ffd700` (Gold) | `bi-lightbulb` |
| Körperpflege/Wellness | `#a855f7` (Purple) | `bi-heart-pulse` |
| Haushalt & Küche | `#f472b6` (Pink) | `bi-house` |

---

## Interaktionen

- **Farbauswahl:** Klick auf Swatch → Hauptbild + Thumbnails wechseln zur Farbvariante (Bilder aus `product.colors[i].image`)
- **Menge:** −/+ Buttons, min 1, max 99
- **In den Warenkorb:** `localStorage('cart')` Array, dann Weiterleitung zu `../cart.html` nach 500ms
- **Wishlist-Toggle:** `localStorage('wishlist')`, Heart-Icon wechselt zwischen `bi-heart` und `bi-heart-fill`
- **Bundle:** Radio-Selektion der 3 Optionen, Kauf-Button schreibt Bundle in `localStorage('cart')`
- **Animations:** `slideUp` (0.8s, `animation-fill-mode: forwards`) für die 2 Haupt-Spalten — **NICHT** `both`, sonst unsichtbar beim Screenshot

---

## Externe Abhängigkeiten behalten

Diese bestehenden Scripts müssen erhalten bleiben (sie sind Produktseiten-spezifisch):
```html
<script src="../app.js"></script>
<script src="../color-cart-bridge.js"></script>
<script src="../bundle-images-final.js"></script>
<script src="../color-image-selection.js"></script>
<script src="../product-gallery-complete.js"></script>
<script src="../cookie-consent.js" defer></script>
<script src="../view-tracker.js" defer></script>
<script src="../keyboard-shortcuts.js"></script>
```

Bootstrap 5 CSS + JS kann entfernt werden. Bootstrap Icons CDN behalten:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
```

Die kategorie-spezifischen CSS-Dateien (`elektronik.css`, `koerperpflege-wellness.css` etc.) werden durch das neue Dark-Theme ersetzt.

---

## Quick-Fixes gleichzeitig einbauen

Bitte beim Umschreiben auch folgende Bugs fixen:

1. **Viewport** (`index.html` + alle Produktseiten): `user-scalable=no` und `maximum-scale=1.0` entfernen — WCAG-Verstoß
2. **Logo-Pfad**: Alle Vorkommen von `logo.png` → `logo.jpg` (die Datei heißt `.jpg`)
3. **JSON-LD Schema** auf jeder Produktseite:
```json
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "[Produktname]",
  "image": "[Bild-URL]",
  "description": "[Beschreibung]",
  "sku": "[SKU aus product-Objekt]",
  "offers": {
    "@type": "Offer",
    "url": "[canonical URL]",
    "priceCurrency": "EUR",
    "price": "[Preis]",
    "availability": "https://schema.org/InStock"
  }
}
```

---

## Design-Referenz Dateien

- `Produktseite Premium Dark.dc.html` — vollständiges visuelles Mockup (Hauptreferenz)
- `produkte/elektrischer-wasserspender-fuer-schreibtisch.html` — Original-Produktseite zum Vergleich
- `Marketing/products.json` — alle 40 Produkte mit Preisen, Farben, SKUs, Bundles

---

## Hinweis

Die `Produktseite Premium Dark.dc.html` ist eine **Design-Referenz in HTML** — kein Produktionscode. Claude Code soll das Design 1:1 nachbauen, aber in den bestehenden Produktseiten-Dateien, mit deren bestehenden JavaScript-Funktionen (Warenkorb, Farben, Bundle) und ohne Framework-Wechsel.
