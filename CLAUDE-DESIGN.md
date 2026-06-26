# CLAUDE-DESIGN.md — UI/UX, Design-System, Accessibility & SEO

Alles fürs Design des Maios-Shops. Technik/Architektur stehen in `CLAUDE.md`, Code-Backlog in
`CLAUDE-CODE.md`. Sprache überall **Deutsch**. Stand: 2026-06-24.

## Design-Kontext (wo was liegt)

- **Startseite** `index.html`: nutzt **Tailwind (CDN)**, eigenes Dark-/Neon-Theme (Violett
  `#8b5cf6`, Cyan `#22d3ee`, Pink `#f472b6`, Glow-Shadows, Glas-Effekte), Fonts Inter + Outfit.
- **Produktseiten** `produkte/<slug>.html` (sprechende Slug-URLs): **Bootstrap 5** + Kategorie-CSS
  (`elektronik.css`, `haushalt-kueche.css`, `beleuchtung.css`, `koerperpflege-wellness.css`) +
  je Seite ein eigener `<style>`-Block.
- **Cart/Wishlist/Gutscheine/Admin:** Bootstrap. Globale Styles in `styles.css` (215 KB),
  `cart.css` (101 KB).
- **Farb-/Bundle-Auswahl:** `color-image-selection.js/.css`, `bundle-images-final.js`,
  `color-cart-bridge.js`, `cart-color-images-only.js`. Produkt 21 nutzt „Modell" statt „Farbe".
- **Bild-Konvention:** `produkt bilder/<Name> bilder/<Name> <farbe>.jpg` — 1:1 zu `products.json`.

---

## TL;DR

- 🔴 **Zwei Design-Systeme parallel** (Tailwind-Landing vs. Bootstrap-Produktseiten) → Markenbruch.
- 🟠 **SEO teilweise:** Meta-Description, Open Graph & Canonical sind jetzt **40/40 ✓** — es fehlt nur noch **Product-JSON-LD (0/40)** für Rich Snippets.
- 🔴 **Zoom gesperrt** (`user-scalable=no`) → WCAG-Verstoß.
- 🟠 Kaputte Logo-/Favicon-Referenz (`logo.png` fehlt, nur `logo.jpg`).
- 🟠 Accessibility dünn: nur 4/61 Seiten mit `aria-`, keine Skip-Links, kein `prefers-reduced-motion`.

---

## 1. 🔴 Inkonsistentes Design-System

Tailwind-CDN auf der Landing, Bootstrap auf Produkt-/Cart-/Admin-Seiten, dazu 215 KB `styles.css`
+ Inline-`<style>` je Produktseite. Der Übergang von der hochwertigen Startseite zur biederen
Bootstrap-Produktseite bricht die Marke; Wartung doppelt.

**Empfehlung:** Ein System wählen (beim Premium-Look: **Tailwind projektweit** mit echtem Build
statt CDN). Design-Tokens (Farben, Typo, Spacing, Radius, Schatten) **einmal** zentral, überall
referenzieren. Inline-Styles der 40 Produktseiten in ein gemeinsames Komponenten-CSS. Komponenten
vereinheitlichen: Buttons, Farb-Swatches, Karten, Badges, Galerie, Header/Footer.

## 2. 🟠 SEO auf Produktebene — fast fertig

Stand 2026-06-24 (`produkte/*.html`, 40 Seiten): Meta-Description **40/40 ✓**, Open Graph
**40/40 ✓**, `rel="canonical"` **40/40 ✓** — **erledigt**. Offen: Product-JSON-LD **0/40**.

**Noch offen — pro Produktseite (Template, aus `products.json` generieren):**
- **Product-JSON-LD** (`name, image, description, sku, brand, offers{price, priceCurrency,
  availability}`) + `BreadcrumbList` → Rich Snippets (Preis/Verfügbarkeit/Sterne) in Google.
- Startseite: `<meta name="keywords">` ist veraltet → weg; `sameAs` zeigt auf Platzhalter
  `facebook.com/deinprofil` → echte Profile oder entfernen.

## 3. 🔴 Zoom gesperrt (WCAG)

`index.html` Viewport: `user-scalable=no, maximum-scale=1.0` → Pinch-Zoom blockiert (WCAG 1.4.4).
**Fix:** `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`.

## 4. 🟠 Logo / Favicon / OG-Bild kaputt

`index.html` referenziert `images/logo.png` (Favicon, Apple-Touch-Icon, Organization-JSON-LD),
aber es existiert nur `images/logo.jpg`. **Fix:** `logo.png` (transparent, mehrere Größen +
`favicon.ico` + `apple-touch-icon` 180×180) anlegen **oder** alle Referenzen auf `logo.jpg`.
`site.webmanifest` prüfen (wird per `<link rel="manifest">` geladen).

## 5. 🟠 Accessibility

Nur 4/61 Seiten mit `aria-`, 0 Skip-Links, 0 `prefers-reduced-motion`.
- **Skip-Link** „Zum Inhalt springen" als erstes fokussierbares Element.
- **Tastatur:** Warenkorb-Dropdown, Galerie/Lightbox, Farb-Swatches fokussier-/bedienbar,
  sichtbarer `:focus-visible` (wichtig im Dark-Theme).
- **ARIA:** Farb-Swatches als `radiogroup`/`radio` + `aria-label` (Farbname); Icon-only-Buttons
  (Warenkorb, Wishlist, Schließen) brauchen `aria-label`.
- **Dynamische Bilder** (per JS injiziert in `cart.js`/Galerie) brauchen sinnvolles `alt`.
- **Kontrast:** Neon-Töne auf `#030304` auf ≥ 4.5:1 für Text prüfen.
- **`prefers-reduced-motion`:** Glow-/Scroll-/Hover-Animationen abschaltbar machen.
- **Formulare** (Kontakt, Retoure, Checkout): `<label>`-Verknüpfung, `:invalid`-Feedback,
  Fehlertexte via `aria-describedby`.

## 6. 🟠 Performance (designseitig)

- **Tailwind-CDN** ist für Produktion nicht empfohlen (großes JS, FOUC, kein Purging) → Build.
- **Bilder:** 139 JPG + 22 PNG unoptimiert → WebP/AVIF, `srcset/sizes`, `loading="lazy"`,
  `width/height` gegen Layout-Shift.
- **Fonts:** nur benötigte Schnitte; `font-display:swap` ist gesetzt (gut); ggf. selbst hosten.
- **CSS-Größe:** `styles.css` + `cart.css` + Bootstrap + Tailwind = viel Dead-CSS → konsolidieren.

## 7. 🟡 UX-Detail & Konsistenz

- Farb-Auswahl in mehreren Varianten vereinheitlichen (gleiches Verhalten/Look; Produkt 21
  „Modell" als bewusste Variante, nicht Sonderfall).
- Klare, nicht-störende Warenkorb-Bestätigung (Toast) + erreichbares Schließen.
- Leere Zustände (Warenkorb/Wishlist/Suche) mit hilfreichem Empty-State + CTA.
- Trust-Elemente (Versandkosten/-zeit, 30 Tage Rückgabe, Zahlungslogos, Bewertungen) sichtbar.
- Mobile: Galerie, Swatches, Warenkorb testen (es gibt historische „mobile-cart-overflow"-Fixes).
- **Header/Footer** als **eine** Komponente über alle Seiten (derzeit dupliziert → Drift).
- Tonalität (Du/Sie) konsistent durchziehen. Info-Seiten (`infos/`) ans Shop-Design angleichen.

---

## Umsetzungsreihenfolge

1. 🔴 Viewport-Zoom freigeben (#3) — 1 Zeile.
2. 🔴 Logo-/Favicon-Pfade reparieren (#4).
3. 🟠 Product-JSON-LD ergänzen (#2) — Meta/OG/Canonical stehen bereits, nur noch JSON-LD + BreadcrumbList aus `products.json`.
4. 🔴 Design-System-Entscheidung + gemeinsames Produktseiten-Template (#1).
5. 🟠 Accessibility-Pass (#5) + Build/Bildoptimierung (#6).
6. 🟡 UX-/Konsistenz-Feinschliff (#7).

> Tipp: `/graphify .` zeigt, welche Seite welches CSS/JS lädt — hilft, die Tailwind-/Bootstrap-
> Grenze und doppelte Komponenten sichtbar zu machen, bevor du das Design-System vereinheitlichst.
