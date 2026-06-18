# REVIEW · Claude Designer — UI/UX, Accessibility, SEO, Design-System

Tiefgründiger Design-Review des Maios-Shops für gestalterische/Frontend-Arbeit.
Stand: 2026-06-18. Geprüft: `index.html`, Produktseiten (`produkte/`), `cart.html`,
CSS-Bestand, Meta/SEO über alle 61 HTML-Dateien, Accessibility-Stichproben.

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 Feinschliff.

---

## 0. TL;DR

- 🔴 **Zwei Design-Systeme parallel** (Tailwind auf der Startseite, Bootstrap auf Produkt-/
  Cart-Seiten) → optischer Bruch zwischen Landing und Produkt. Vereinheitlichen.
- 🔴 **SEO praktisch nicht vorhanden** auf Produktseiten: 0/40 Meta-Description, 0 Open Graph,
  0 Canonical, 0 Product-JSON-LD. Für einen Shop geschäftskritisch.
- 🔴 **Zoom gesperrt** (`user-scalable=no`) → WCAG-Verstoß.
- 🟠 Kaputte Logo-/Favicon-Referenz (`logo.png` existiert nicht, nur `logo.jpg`).
- 🟠 Accessibility dünn: nur 4/61 Seiten nutzen `aria-`, keine Skip-Links, kein
  `prefers-reduced-motion`.

---

## 1. 🔴 Inkonsistentes Design-System (zwei Frameworks)

**Befund:** `index.html` lädt **Tailwind via CDN** (`cdn.tailwindcss.com`) mit eigenem Dark-/
Neon-Theme (Violett `#8b5cf6`, Cyan, Pink, Glow-Shadows, Glas-Effekte). Produktseiten,
`cart.html`, Gutschein- und Admin-Seiten laden dagegen **Bootstrap 5** + Kategorie-CSS
(`elektronik.css` etc.) mit hellem, klassischem Look. Dazu kommt eine **219 KB `styles.css`**
mit globalen Overrides und pro Produktseite ein eigener `<style>`-Block.

**Wirkung:** Der Übergang von der hochwertig wirkenden Startseite zur biederen Bootstrap-
Produktseite bricht die Marke. Wartung doppelt (zwei Token-/Spacing-/Farbsysteme).

**Empfehlung:**
- Ein System wählen. Bei dem premium Neon-Look der Landing: **Tailwind** projektweit, mit
  echtem Build (Purge/Minify) statt CDN. Produktseiten-Template darauf migrieren.
- Design-Tokens (Farben, Typo, Spacing, Radius, Schatten) **einmal** zentral definieren und
  überall referenzieren. Inline-`<style>` aus den 40 Produktseiten in ein gemeinsames
  Komponenten-CSS heben.
- Komponenten vereinheitlichen: Buttons, Farb-Swatches, Karten, Badges, Galerie, Header/Footer.

---

## 2. 🔴 SEO fehlt auf Produktebene

**Messwerte (über `produkte/*.html`, 40 Seiten):**
- Meta-Description: **0/40**
- Open-Graph-Tags (`og:*`): **0/61** im ganzen Projekt
- `rel="canonical"`: **0/61**
- Product-JSON-LD (`@type: Product` mit Preis/Verfügbarkeit): **0/40**

**Wirkung:** Google zeigt keine Rich-Results (Preis, Bewertung, Verfügbarkeit); Social-Shares
ohne Vorschaubild/Text; Risiko von Duplicate-Content ohne Canonicals. Für einen Dropshipping-
Shop ist organische/soziale Sichtbarkeit der wichtigste kostenlose Trafficka­nal.

**Empfehlung pro Produktseite (Template):**
- `<meta name="description">` aus der Produktbeschreibung (150–160 Zeichen).
- Open Graph + Twitter Cards: `og:title`, `og:description`, `og:image` (echtes Produktbild),
  `og:type=product`, `og:url`.
- `<link rel="canonical">` auf die kanonische Produkt-URL.
- **Product-JSON-LD** mit `name`, `image`, `description`, `sku`, `brand`, `offers`
  (`price`, `priceCurrency`, `availability`). Quelle: `products.json`.
- `BreadcrumbList`-JSON-LD für Kategorie-Navigation.
- Startseite: `<meta name="keywords">` ist veraltet (von Google ignoriert) — kann weg;
  Description aussagekräftiger machen (aktuell nur „Premium Electronics & Lifestyle").
- `sameAs` im Organization-Schema zeigt auf Platzhalter `facebook.com/deinprofil` /
  `instagram.com/deinprofil` → echte Profile oder entfernen.

---

## 3. 🔴 Zoom gesperrt (Accessibility / WCAG)

**Datei:** `index.html` (und `indexoriginal.html`), Z. 5:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no, maximum-scale=1.0, minimum-scale=1.0">
```
`user-scalable=no` + `maximum-scale=1.0` verhindern das Pinch-Zoom. Das verstößt gegen
WCAG 2.1 (1.4.4 Resize Text) und schließt seh­eingeschränkte Nutzer aus.

**Fix:** `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`
— Skalierung erlauben.

---

## 4. 🟠 Kaputtes Logo / Favicon / OG-Bild

**Befund:** `index.html` referenziert an mehreren Stellen `https://maiosshop.com/images/logo.png`
(Favicon 32/192, Apple-Touch-Icon, Organization-Logo im JSON-LD). Im Repo existiert aber nur
`images/logo.jpg` — **`logo.png` fehlt**. README verweist ebenfalls auf `logo.jpg`.

**Wirkung:** Kein Favicon, kaputtes Touch-Icon, fehlendes Logo in Rich-Results und (sobald OG
existiert) im Social-Preview.

**Fix:** Entweder `logo.png` (idealerweise transparent, mehrere Größen + `favicon.ico` +
`apple-touch-icon` 180×180) erzeugen und ablegen, oder alle Referenzen auf `logo.jpg` ändern.
Außerdem `site.webmanifest` prüfen (wird per `<link rel="manifest">` geladen — existiert es?).

---

## 5. 🟠 Accessibility-Grundlagen

**Messwerte:** nur **4/61** HTML-Dateien nutzen `aria-`; **0** Skip-Links; **0**
`prefers-reduced-motion`.

**Empfehlungen:**
- **Skip-Link** („Zum Inhalt springen") als erstes fokussierbares Element je Seite.
- **Tastatur:** Warenkorb-Dropdown, Galerie/Lightbox, Farb-Swatches müssen fokussierbar und mit
  Enter/Space/Pfeiltasten bedienbar sein; sichtbarer `:focus-visible`-Stil (beim Dark-Theme
  besonders wichtig).
- **ARIA/Semantik:** Farb-Swatches als `role="radiogroup"`/`radio` mit `aria-checked` und
  `aria-label` (Farbname). Mengen-Stepper, Tabs, Modals korrekt auszeichnen. Icon-only-Buttons
  (Warenkorb, Wishlist, Schließen) brauchen `aria-label`.
- **Dynamische Bilder:** statische `<img>` haben `alt` (gut), aber per JS injizierte
  Produkt-/Farbbilder (`cart.js`, Galerie) müssen ebenfalls sinnvolles `alt` bekommen.
- **Kontrast:** Neon-Akzente auf sehr dunklem Grund (`#030304`) auf ≥ 4.5:1 für Text prüfen
  (Cyan/Pink-Text auf Schwarz kann knapp sein).
- **`prefers-reduced-motion`:** Glow-/Scroll-/Hover-Animationen der Landing für Nutzer mit
  reduzierter Bewegung abschalten.
- Formulare (Kontakt, Retoure, Checkout-Felder): `<label>`-Verknüpfung, `:invalid`-Feedback,
  Fehlertexte mit `aria-describedby`.

---

## 6. 🟠 Performance-wirksame Design-Entscheidungen

- **Tailwind-CDN in Produktion** ist offiziell nicht empfohlen: großes JS, Flash-of-Unstyled-
  Content, kein Purging. → Build-Pipeline (nur genutzte Klassen).
- **Bildlast:** 139 JPGs + 22 PNGs, unoptimiert. → WebP/AVIF, responsive `srcset`/`sizes`,
  `loading="lazy"`, `width`/`height` gegen Layout-Shift (CLS).
- **Schriften:** zwei Familien (Inter + Outfit) mit vielen Schnitten von Google Fonts. Nur
  benötigte Schnitte laden, `font-display: swap` ist gesetzt (gut), ggf. selbst hosten.
- **CSS-Größe:** `styles.css` 219 KB + `cart.css` 102 KB + Bootstrap + Tailwind = viel
  Redundanz/Dead CSS. Konsolidierung (siehe #1) senkt Gewicht spürbar.

---

## 7. 🟡 UX-Detailpunkte

- **Konsistente Komponenten:** Farb-Auswahl existiert in mehreren Varianten
  (`color-image-selection`, `bundle-images-final`, Inline-CSS je Seite) — vereinheitlichen für
  gleiches Verhalten/Look auf allen Produkten. (Produkt 21 nutzt „Modell" statt „Farbe" — als
  bewusste Variante des gleichen Patterns umsetzen, nicht als Sonderfall-Code.)
- **Warenkorb-Feedback:** Dropdown bleibt nach „In den Warenkorb" offen (bewusst). Sicherstellen,
  dass es eine klare, nicht-störende Bestätigung (Toast) + erreichbares Schließen gibt.
- **Leere Zustände:** Leerer Warenkorb/Wishlist/Suchergebnis mit hilfreichem Empty-State + CTA.
- **Trust-Elemente** auf Produkt-/Checkout-Seiten: Versandkosten/-zeit, Rückgabe (30 Tage),
  Zahlungslogos, Bewertungen — sichtbar und konsistent (Daten existieren in Texten/Chat-Prompts).
- **Mobile:** Galerie, Farb-Swatches und Warenkorb auf kleinen Viewports testen (es gibt
  historische „mobile-cart-overflow"-Fixes — Zeichen für frühere Layout-Probleme).
- **404-/Erfolgs-/Tracking-Seiten** ins einheitliche Design bringen.

---

## 8. 🟡 Konsistenz & Markenführung

- Einheitliche **Tonalität** (Deutsch, Du/Sie konsistent — aktuell gemischt zwischen Seiten und
  Chat-Prompts). Eine Entscheidung treffen und durchziehen.
- **Footer/Header** als **eine** Komponente über alle Seiten (derzeit pro Seite dupliziert →
  Drift). Da kein Framework: per kleinem JS-Include oder Build-Partial zentralisieren.
- **Favicon/Logo/Brand-Assets** in einem `brand/`-Ordner bündeln, einheitliche Größen.
- Info-Seiten (`infos/`) optisch an Shop angleichen (gleiche Typo/Spacing).

---

## 9. Umsetzungsreihenfolge (Vorschlag)

1. 🔴 Viewport-Zoom freigeben (#3) — 1 Zeile, sofort.
2. 🔴 Logo-/Favicon-Pfade reparieren (#4).
3. 🔴 SEO-Template für Produktseiten (Meta + OG + Canonical + Product-JSON-LD) (#2) —
   einmal als Template, dann über `products.json` für alle 40 generieren.
4. 🔴 Design-System-Entscheidung + gemeinsames Produktseiten-Template (#1).
5. 🟠 Accessibility-Pass (Skip-Link, Fokus, ARIA, Kontrast, reduced-motion) (#5).
6. 🟠 Build-Pipeline + Bildoptimierung (#6).
7. 🟡 UX-/Konsistenz-Feinschliff (#7, #8).

> Tipp für die Bestandsaufnahme: `/graphify .` liefert eine Übersicht, welche Seite welches CSS/
> JS lädt — hilfreich, um die Tailwind-/Bootstrap-Grenze und doppelte Komponenten sichtbar zu
> machen, bevor du das Design-System vereinheitlichst.
