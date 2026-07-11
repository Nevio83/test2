# Handoff: MAIOS Shop – Redesign 2 („Editorial Dark & Gold")

## Overview
Neugestaltung der Startseite (`index.html`) eines deutschsprachigen Online-Shops (MAIOS) für kuratierte Technik-, Wohn- und Wellness-Produkte. Das Design ist ein dunkles, editorial-anmutendes Premium-Layout mit Gold-Leitfarbe und einem farbcodierten Kategoriesystem. Ziel ist maximale Conversion: prominente Suche, Live-Mini-Warenkorb, Deal-of-the-Day-Countdown, Quick-Add/Quick-View, Trust-Elemente und Scroll-Reveals.

## About the Design Files
Die Dateien in diesem Bundle sind **Design-Referenzen in HTML** — ein Prototyp, der Aussehen und Verhalten zeigt, **kein production-ready Code zum 1:1-Kopieren**. Die Aufgabe ist, dieses Design in der **bestehenden Umgebung des Ziel-Codebase** nachzubauen (React, Vue, Svelte, Shopify Liquid o. ä.) mit dessen etablierten Mustern und Bibliotheken. Existiert noch keine Umgebung, das für das Projekt am besten geeignete Framework wählen und das Design dort umsetzen.

> Technischer Hinweis: `Maios Redesign 2.dc.html` ist als „Design Component" (DC) mit einem internen Template-/Logik-Runtime gebaut. Die **Werte** (Farben, Typo, Abstände, Copy, Verhalten) sind maßgeblich — die DC-Runtime selbst NICHT übernehmen. Produktdaten liegen in `products.json` und werden zur Laufzeit geladen.

## Fidelity
**High-fidelity (hifi).** Finale Farben, Typografie, Abstände, Radien und Interaktionen. Die UI pixelnah mit den Bibliotheken/Mustern des Ziel-Codebase nachbauen. Exakte Hex-Werte und Maße stehen unten.

---

## Design Tokens

### Farben – Basis
| Token | Hex | Verwendung |
|---|---|---|
| Background (Seite) | `#13100B` | Grundfläche, warmes Fast-Schwarz |
| Background (tiefer) | `#0B0A09` / `#0C0A07` | Footer, Overlays, Announcement |
| Surface Card | linear-gradient(180deg, `#211C12` → `#17130D`) | Produktkarten, Stat-Karten |
| Surface Panel | linear-gradient(135deg, `#16130D` → `#0F0D0A`) | Deal-Panel, Showreel |
| Gold (Primär/CTA) | `#D8B56C` | Buttons, Preise, Akzentlinien, Leitfarbe |
| Gold hell (Hover) | `#E9CD8C` | CTA-Hover |
| Gold hell (Preis) | `#E4C077` | Preiszahlen auf Karten |
| Text hell | `#F2ECDF` / `#F5F0E6` | Überschriften, Produktnamen |
| Text muted | `#A79E8B` | Fließtext, Sekundärinfos |
| Text dim | `#6F675A` / `#8C8677` | Labels, Metadaten |
| Creme (Newsletter-Sektion) | linear-gradient(160deg, `#F0E7D4` → `#E7DBC2`) | heller Highlight-Block |
| Creme-Text dunkel | `#1A150E` (Headline), `#6B6152` (Body), `#9A7B34` (Overline) | auf Creme |

### Farben – Kategorie-Akzente (farbcodiertes System, seitenweit)
| Kategorie (in Daten) | Kurzlabel | Akzent Hex | RGB | Icon (Bootstrap Icons) |
|---|---|---|---|---|
| `Technik/Gadgets` | Technik | `#7FA8C9` (Stahlblau) | 127,168,201 | `bi-cpu` |
| `Beleuchtung` | Licht | `#E4B053` (Amber-Gold) | 228,176,83 | `bi-lightbulb` |
| `Haushalt und Küche` | Haushalt | `#C98A6A` (Terracotta) | 201,138,106 | `bi-house-heart` |
| `Körperpflege/Wellness` | Wellness | `#8FB08A` (Salbeigrün) | 143,176,138 | `bi-flower1` |
| Fallback / „Alle" | — | `#D8B56C` (Gold) | 216,181,108 | `bi-grid` / `bi-gem` |

Akzentnutzung: Gold bleibt Leitfarbe für **CTAs**. Die Kategoriefarben dienen nur der **Kategorie-Identität** (Karten-Rail oben, Kategorie-Tag + Icon, Hover-Rahmen/Schatten, dezenter Radial-Schein hinter dem Produktbild, Filter-Chip-Füllung im aktiven Zustand). Töne bewusst gedämpft.

### Typografie
- **Display/Serif:** `Marcellus` (Google Fonts), weight 400 & 700. Für Headlines, Preise, Countdown, Logo.
- **Body/Sans:** `Manrope` (Google Fonts), weights 300–800. Für Fließtext, Buttons, Labels, UI.
- Hero-Headline: Marcellus 700, `clamp(32px, 3.7vw, 56px)`, line-height 1.1, letter-spacing −.015em.
- Section-Headings: Marcellus 700, `clamp(46px, 5vw, 78px)`, letter-spacing −.015em.
- Produktname (Karte): Manrope 600, 16px, line-height 1.4, min-height 45px.
- Preis (Karte): Marcellus 700, 31px, Farbe `#E4C077`.
- Labels/Overlines: Manrope, 10–12px, uppercase, letter-spacing .24–.3em.

### Spacing / Form
- Sektions-Padding: horizontal 52px (Desktop), vertikal ~50–74px. Mobile 20–22px horizontal.
- Content max-width: `1360px`, zentriert.
- Border-Radius: Karten/Kacheln 14–16px, Panels 18–22px, Buttons/Chips 999px (Pill), kleine Badges 8–12px.
- Border: `1px solid rgba(216,181,108,.15–.35)` (Gold-transparent), im Kategorie-Kontext `rgba(<accent-rgb>,.32–.7)`.
- Shadow (Karte Hover): `0 34px 70px rgba(0,0,0,.55)` plus Akzent-Ring `0 0 0 1px rgba(<accent-rgb>,.35)`.
- Grid Produkte: `repeat(auto-fill, minmax(280px, 1fr))`, gap 18px → 1/2/4 Spalten responsiv.

### Icons
[Bootstrap Icons](https://icons.getbootstrap.com/) (CDN). U. a. `bi-search, bi-globe2, bi-heart, bi-bag, bi-list, bi-x-lg, bi-arrow-right/left, bi-arrow-up-right, bi-lightning-charge-fill, bi-fire, bi-eye, bi-shield-check, bi-truck, bi-gift, bi-cpu, bi-lightbulb, bi-house-heart, bi-flower1`.

---

## Screens / Views

Single-Page-Layout, top → bottom. Reihenfolge:

### 1. Announcement-Leiste (oben, sticky-nah)
- Voll-Breite, dunkler Verlauf (`#0B0A09→#1C1812→#0B0A09`), Gold-Text, uppercase, letter-spacing .22em, padding 10px.
- Text: **„10 % Willkommensrabatt — jetzt zum Newsletter anmelden & Code sichern"** (der Teil nach dem Gedankenstrich fett).
- Ist ein Link auf `#newsletter` → smooth-scroll zur Newsletter-Sektion.
- Abschaltbar per Flag `showAnnouncement` (default true).

### 2. Navigation (Header) — sticky, reveal-on-scroll
- `position: sticky; top: 0; z-index: 100`, Hintergrund `rgba(11,10,9,.86)` + `backdrop-filter: blur(16px)`, Gold-Bottom-Border, Shadow.
- **Reveal-Verhalten:** beim Runterscrollen (>4px, ab y>120) gleitet der Header per `transform: translateY(-108%)` weg; beim Hochscrollen kommt er zurück (`translateY(0)`), Transition .38s. Oben (y<120) immer sichtbar. WICHTIG: der Zustand muss nach jedem Re-Render neu angewandt werden (sonst überschreiben State-Updates die Transform). Der horizontale Overflow-Clip gehört auf `html` (`overflow-x:hidden`), NICHT auf einen Wrapper — sonst bricht `position: sticky`.
- Links: Logo „MAIOS." (Marcellus 34px, Punkt in Gold). Rechts Gruppe: Suche, Sprach-Button, Wunschliste, Warenkorb.
- Desktop-Nav-Links (uppercase, Manrope 15px, letter-spacing .14em): **Mitternachts-Deal** (Gold), **Bestseller**, **Sortiment**. (Kein „Stimmen".)
- **Suche:** Pill-Feld (240px), Live-Dropdown mit bis zu 6 Treffern (Bild 46px, Kategorie-Kurzlabel, Name 1 Zeile, Preis in Gold). „Keine Treffer"-Zustand. X-Button zum Leeren.
- **Sprach-Button:** Globus-Icon + aktuelles Kürzel (DE), Dropdown mit Sprachen (DE, EN, FR, ES, IT, …) — Kürzel + Name.
- **Wunschliste:** Herz-Icon, 46×46 Pill-Button, Badge mit Anzahl (Gold) oben rechts.
- **Warenkorb:** Gold-Pill-Button „⌾ Warenkorb <count>". Badge animiert (Puls) beim Hinzufügen. **Hover → Mini-Cart-Vorschau** (340px): bis zu 3 Positionen (Bild, Name, „<qty>× · <Zeilensumme>"), „+N weitere", Zwischensumme, „Warenkorb ansehen"-Button.
- Alle Header-Elemente sind bewusst etwas größer dimensioniert (Buttons 46px, Nav-Text 15px).
- **Mobil (≤860px):** Nav-Links + Suche ausgeblendet, Hamburger sichtbar → **Slide-in-Menü von links** (320px): Logo, Suchfeld mit Live-Ergebnissen, Nav-Links, Trust-Zeile, Warenkorb-Button. Overlay mit Blur. Zusätzlich unten **fixierter Mobile-Sticky-CTA** (Deal-Button + Warenkorb-Icon, daumen-erreichbar).

### 3. Showreel-Hero
- Radiale dunkle Bühne. Oben: Overline „Maios Kollektion" (Gold, Icon `bi-gem`) + Value-Proposition-Headline in EINEM Satz: „Kuratierte Technik- & Wohn-Essentials — handverlesen, geprüft, in 6–13 Tagen bei dir." (zweiter Teil in Gold).
- **Rechteckiges Panel** (border-radius 22px, Gold-Border, Shadow): Kopfzeile „● Im Rampenlicht" + Zähler „<n> / <total>". Zweispaltig (grid auto-fit minmax 330px):
  - Links: Produktbild auf radialem Gold-Schein, Rabatt-Badge oben links, **Prev-Pfeil** (links, 48px, rounded) + **großer Next-Pfeil** (rechts, 56px, Gold, Shadow).
  - Rechts: Kategorie-Tagline, Produktname (Marcellus 700, `clamp(38px,4.2vw,60px)`), Kurzbeschreibung (2 Zeilen), Preis groß (54px Gold) + durchgestrichener Originalpreis + Sterne, CTAs „In den Warenkorb" (Gold) & „Details" (outline).
  - Unten: **Thumbnail-Leiste** (74×58px Kacheln) zum Direktspringen, aktive Kachel mit Gold-Border + Fortschrittsbalken (Auto-Advance, Dauer per `reelSeconds`, default 5s).
- Produkte im Reel: IDs `[44, 46, 43, 33, 47]`.

### 4. Kategorie-Sektion „Nach Kategorie stöbern"
- Overline „ENTDECKEN" + Headline (Marcellus 700, groß) + Sublabel „Vier Welten, ein Anspruch".
- Grid `auto-fit minmax(230px,1fr)`, 4 Kacheln (aspect 3/4). Jede Kachel in ihrer **Kategoriefarbe**:
  - Verlauf-Hintergrund mit Akzent-Tint, farbiger Border, farbiger **Seiten-Rail links** (4px), **Icon-Badge oben links** (42px, rounded), Produkt-Repräsentant-Bild auf farbigem Radial-Schein, Verlaufs-Overlay unten, farbige Tag-Zeile, Label (Marcellus 25px), runder Pfeil-Button (Hover füllt in Akzentfarbe), „<n> Produkte".
  - Klick → setzt Kategorie-Filter + smooth-scroll zu `#sortiment`.
- Labels/Tags: Technik & Gadgets „Smarte Helfer", Beleuchtung „Licht & Stimmung", Haushalt & Küche „Alltag, veredelt", Wellness „Zeit für dich".

### 5. Deal des Tages (`#deal`)
- Panel (grid auto-fit minmax 400px): links Produktbild auf Schein + Rabatt-Badge; rechts: „● Deal des Tages — endet in", **Countdown** HH:MM:SS (Marcellus 58px, Labels STUNDEN/MINUTEN/SEKUNDEN), Produktname, Sterne + Bewertungen, Beschreibung, Preis (52px Gold) + Originalpreis + „Du sparst X", **Stock-Fortschrittsbalken** („Nur noch X Stück" / „Y % verkauft"), CTAs.
- **Täglich rotierendes Produkt:** aus Pool `[44,46,43,33,27,18,50,37,47,21]`, Auswahl per `floor(Date.now()/86400000) % pool.length`. Abschaltbar per `dailyDeal` (default true) → dann festes `dealProductId` (default 44). Countdown läuft bis Mitternacht.

### 6. Stats-Band
- 4 Karten (Zufriedene Kunden, Durchschnittsbewertung, Kuratierte Produkte, Tage Rückgaberecht). Zahlen Marcellus 62px Gold, animierter Count-up beim Reveal.

### 7. Bestseller (`#bestseller`) „Die Hauptdarsteller"
- Header „Die Hauptdarsteller" + „AM HÄUFIGSTEN GEKAUFT". Grid wie Sortiment.
- Reihenfolge IDs `[46,37,47,43,33,50,27,18]`. Karten mit **Rang-Nummer 01–08** (Marcellus 20px Gold) links neben dem Kategorie-Tag.
- **Skeleton-Loading** beim ersten Laden (schimmernde Platzhalterkarten), ersetzt durch echte Karten sobald Daten da sind.

### 8. Sortiment (`#sortiment`) „Die ganze Sammlung"
- **Filter-Chips** (eine pro Kategorie + „Alle"): Pill mit Kategorie-Icon; aktive Chip in Kategoriefarbe gefüllt (Text dunkel), inaktiv Akzent-Border + heller Text. Zeigt Produktanzahl.
- **Sortierung** (segmentierte Pill-Gruppe): „Beliebt / Preis ↑ / Preis ↓ / Rabatt" + Live-Produktzähler rechts.
- Grid wie Bestseller, Skeleton beim Laden.

### Produktkarte (gemeinsames Muster in Bestseller & Sortiment)
- Card: Verlauf-Surface, 1px Gold-Border, radius 16px, `height:100%`. **Farbiger Akzent-Rail oben** (3px, Kategoriefarbe). Hover: `translateY(-6px)` + Border/Shadow in Kategoriefarbe.
- Bildbereich (aspect 1): Produktbild auf dezent kategoriegetöntem Radial-Schein; Hover zoomt Bild (`scale(1.09)`); **Zweitbild** (falls Variantenbild vorhanden) faded beim Hover ein; **Quick-Add-Button** (Blitz-Icon, unten, faded beim Hover ein, Hover Gold); Rabatt-Badge oben links; Wunschlisten-Herz oben rechts.
- Textbereich: Kategorie-Tag mit Icon in Kategoriefarbe (+ Rang bei Bestseller); Produktname; Sterne + Rating + Reviews; „🔥 X heute gekauft" (Social Proof); Preis (Marcellus 700, `#E4C077`) + Originalpreis; „Nur noch X Stück" bei lowStock (≤8); CTAs „In den Warenkorb" (outline→Gold Hover) + Quick-View-Auge.

### 9. Quick-View-Modal
- Overlay `z-index 320` + Blur. Zweispaltig: links großes (Varianten-)Bild + Thumbnails/Farb-Swatches; rechts Kategorie-Zeile (mit Icon, Kategoriefarbe), Name, Sterne, Beschreibung, Preis, **Varianten-Auswahl**, Mengen-Stepper, „In den Warenkorb — <Betrag>"-Button, Versand-/Feature-Infos.
- **Variantengetrieben:** Klick auf Variante aktualisiert Bild, Name, Beschreibung, Preis, Rabatt-Badge und den Button-Betrag. Gewählte Variante wird als eigene Warenkorb-Zeile aufgenommen (`key = id::variantname`).
- **Varianten-Darstellung:** echte Farben (Schwarz, Blau, …) → runde Farb-Swatches (30px, `c.code`); Nicht-Farb-Varianten mit Bild (z. B. „Mond", „Segelboot", „Style C Rollen") → **Bild-Thumbnails** (48px, rounded). Label wechselt: alle Motive → „Motiv", gemischt → „Variante", nur Farben → „Farbe". Erkennung über DE/EN-Farbwortliste.

### 10. Warenkorb-Drawer
- Rechts einfahrendes Panel (`z-index 300`): Positionen mit Bild, Name, Variante, Mengen-Stepper (+/−), Entfernen; Zwischensumme; **Gratis-Versand-Fortschritt** (Schwelle per `freeShippingThreshold`, default 39 €); Checkout-CTA.

### 11. Kundenstimmen „Der Applaus" (`#stimmen`)
- Karten mit Sternebewertung, Zitat, Name.

### 12. Newsletter / Willkommensgeschenk (`#newsletter`)
- **Helle Creme-Sektion** (Kontrast-Highlight). Overline „Willkommensgeschenk" (Icon `bi-gift`), Headline **„10 % Rabatt mit dem Newsletter."** (Marcellus 700, dunkel), Subtext, E-Mail-Feld + „Code sichern"-Button (dunkel), Trust-Zeile („Kein Spam", „Jederzeit abbestellbar").
- Submit → Toast „Danke! Dein Code WILLKOMMEN10 ist unterwegs." (bzw. Aufforderung bei leerer Eingabe).

### 13. „Kürzlich angesehen"
- Horizontale, scrollbare Karten-Leiste (158px Karten) vor dem Footer. Gefüllt aus zuletzt in Quick-View geöffneten Produkten. **Persistiert in `localStorage` (`maios_recent`, max 12).** Kategorie-Tags farbcodiert. Nur sichtbar, wenn Verlauf existiert.

### 14. Footer
- Dunkelster Ton (`#0C0A07`), Marken-/Link-Spalten.

---

## Interactions & Behavior
- **Header reveal-on-scroll** (siehe Nav). Transition transform .38s cubic-bezier(.2,.8,.2,1).
- **Scroll-Reveals:** Sektionen faden/gleiten beim Sichtbarwerden ein (opacity + translateY 46px→0, ~.9s). Via IntersectionObserver-Äquivalent.
- **Warenkorb-Badge-Puls** beim Add (~600ms).
- **Showreel-Auto-Advance** (`reelSeconds`), Fortschrittsbalken auf aktiver Thumbnail; Pfeile + Thumbnails zum manuellen Wechsel.
- **Countdown** tickt jede Sekunde (nur DOM-Text-Update, kein Full-Rerender) bis Mitternacht.
- **Stat-Count-up** beim Reveal.
- **Spotlight-Cursor:** dezenter, dem Cursor folgender Radial-Schein (pointermove) — optional, rein dekorativ.
- **Hover-States:** Karten heben an + Akzent-Rahmen; Buttons Gold-Fill; Bild-Zoom; Zweitbild-Crossfade; Quick-Add-Einblendung.
- **Filter/Sortierung:** ohne Reload, sanfte Neuanordnung (fadeUp-Stagger).
- **Suche:** Live-Filter über Name + Kategorie, max 6 Treffer.
- **Responsive:** Grid 1→2→4 Spalten; Header kollabiert zu Hamburger + Slide-in; Mobile-Sticky-CTA unten.

## State Management
- `products` (aus `products.json`), `loading` (Skeletons bis geladen).
- `cart` [{key, id, name, price, image, qty}], `wishlist` [ids], `recent` [ids] (localStorage `maios_recent`).
- `drawerOpen`, `cartPreview`, `mobileMenu`, `langOpen`, `qvId` + `qvQty` + `qvColorIdx` (Quick-View), `search`, `cat` (Filter), `sortKey`, `revealed` (Scroll-Reveals), `toast`, `pulse`, Countdown-/Reel-/Stat-Interna.
- Cart-Key-Logik: Varianten erzeugen eigene Zeilen (`id::variantname`).

## Data / Products
- `products.json` — 40 Produkte, Felder u. a.: `id, name, slug, price, originalPrice, category, image, description, features[], shippingTime, inStock, colors[]`. `colors[]` = Varianten mit `name, code (Hex), image, sku, price?`.
- Kategorien exakt: `Technik/Gadgets`, `Beleuchtung`, `Haushalt und Küche`, `Körperpflege/Wellness`.
- Rating/Reviews/Stock/„heute gekauft" sind im Prototyp **deterministisch aus der id abgeleitet** (Pseudo-Zufall) — im echten Shop durch reale Daten ersetzen.

## Assets
- **Produktbilder:** Ordner `produkt bilder/` im Ur-Repo (nicht in diesem Bundle, 144 Dateien inkl. Varianten-Unterordner). `product.image` und `color.image` sind relative Pfade dorthin. Diese Bilder in den Ziel-Codebase/CDN übernehmen.
- **Fonts:** Google Fonts `Marcellus` + `Manrope`.
- **Icons:** Bootstrap Icons (CDN).
- Kein eigenes Logo — Wortmarke „MAIOS." in Marcellus.

## Files
- `Maios Redesign 2.dc.html` — der vollständige High-Fidelity-Prototyp (Design-Referenz; DC-Runtime nicht übernehmen, nur Werte/Verhalten).
- `products.json` — Produktdaten.

## SEO / A11y
- `lang="de"`, sprechende Alt-Texte an allen Produktbildern, aria-labels an Icon-Buttons, ausreichende Kontraste (Gold/Text auf Dunkel = WCAG AA), Tastaturbedienbarkeit der interaktiven Elemente sind Vorgaben — im Nachbau erhalten.
