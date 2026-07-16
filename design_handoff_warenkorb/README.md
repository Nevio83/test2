# Handoff: Warenkorb-Redesign (Maios Shop) — „Editorial Dark & Gold"

## Overview
Neue Warenkorb-Seite („Cart") für den Maios E-Commerce-Shop. Sie zeigt denselben Inhalt und Aufbau wie der ursprüngliche Warenkorb (`cart.html` / `cart.js`), aber in der neuen visuellen Richtung **„Editorial Dark & Gold"**, die exakt die Optik der `index.html` übernimmt. Der Nutzer sieht seine Artikel, passt Mengen/Farben an, löst einen Gutschein ein, gibt Kontakt-/Länderdaten ein, akzeptiert die rechtlichen Bedingungen und schließt die Bestellung ab (inkl. Express-Zahlung).

> **Nur dieses eine Design soll umgesetzt werden.** (Die weiteren Explorationsvarianten sind bewusst nicht Teil dieses Pakets.)

## About the Design Files
Die Datei in diesem Bundle ist eine **Design-Referenz, erstellt in HTML** — ein Prototyp, der das beabsichtigte Aussehen und Verhalten zeigt, **kein** Produktionscode zum direkten Kopieren. Aufgabe ist es, dieses HTML-Design in der bestehenden Umgebung der Zielcodebase (hier: Vanilla JS / HTML-Shop, `cart.js` rendert das Markup als Template-String) mit deren etablierten Mustern nachzubauen. Der Prototyp ist als **Design Component** (`.dc.html`) geschrieben; die eigentliche Logik (Warenkorb-State, Preisberechnung, Gutschein-Validierung, Länder-Versandlogik) existiert bereits in `cart.js` und soll wiederverwendet werden — nur das Markup/Styling der Renderfunktion wird ersetzt.

## Fidelity
**High-fidelity (hifi).** Finale Farben, Typografie, Abstände und Hover-Zustände. Bitte pixelgenau mit den Mitteln der Codebase nachbauen. Die exakten Werte stehen unten unter *Design Tokens*.

## Screen / View
**Informationsarchitektur** (identisch zum Original-Warenkorb):

1. **Navbar** — Logo „MAIOS." links, Button „Zurück zum Shop" rechts (Outline-Pill, füllt sich gold bei Hover).
2. **Titel** — Eyebrow „MAIOS SHOP" + goldene Trennlinie, Überschrift „Ihr Warenkorb." (Marcellus).
3. **Linke Spalte — Artikelliste** (Überschrift „Ihre Artikel (3)"), 3 Artikel:
   - Produktbild 104×104 (klickbar), Name, aktueller Preis + durchgestrichener UVP, Lieferhinweis „Lieferung in 7–13 Werktagen · Gratis".
   - **Bild-Farbauswahl**: Kacheln 62×62 mit Produktfoto je Farbe + Farbname darunter; aktive Farbe mit Gold-Rahmen + Glow hervorgehoben; Label „Farbe: X".
   - **Mengensteuerung** −/Zahl/+ (Pill-Rahmen) und **Löschen**-Button (Mülleimer, runder Outline-Button).
4. **Add-ons-Sektion** — Überschrift „Add-ons" + Untertitel „Ergänzen Sie Ihre Bestellung mit passenden Produkten"; Karten mit „Hinzufügen"-Button (Cart-Plus-Icon).
5. **„Warenkorb leeren"**-Button (voll­breit, Outline in Warnfarbe).
6. **Rechte Spalte — „Bestellung"** (Checkout-Panel, scrollt normal mit — **nicht** sticky):
   - Reservierungs-Timer „Ihr Warenkorb leert sich in MM:SS Minuten" (pulsierender Punkt).
   - Zwischensumme, Gutschein-Zeile (−10 %), Versand (Kostenlos), **Gesamt** (Marcellus 34px, gold).
   - Gutschein-Feld (Code + „Einlösen") bzw. eingelöster Zustand: Chip „WILLKOMMEN10 · −10 %" + „Entfernen".
   - E-Mail-Feld, Land-Dropdown (Standard „Deutschland") + Hinweis „Europäische Länder haben kostenlosen Versand".
   - Box „Rechtliche Vereinbarungen": AGB/Datenschutz-Checkbox (Pflicht, vorausgewählt), Werbe-Einwilligung-Checkbox, Links zu Datenschutz/Cookies.
   - „Jetzt bestellen — {Gesamt}"-Button (voll­breit, gold) + Express-Zahlung (PayPal / Google Pay / Klarna).
   - Trust-Badges: Käuferschutz · 30 Tage Rückgabe · SSL.

### Layout
- Zweispaltig, `grid-template-columns: 1fr 408px`, `gap: 26px`, zentriert in `max-width: 1340px`, Seiten-Padding `52px`. Navbar und Titel in derselben Max-Breite.
- Artikel-Karten gestapelt (`flex-direction: column; gap: 16px`).
- **Artikel-Karte**: Gradient `linear-gradient(180deg,#211C12,#17130D)`, Rahmen `1px solid rgba(216,181,108,.2)`, `border-radius: 16px`, Padding `20px 22px`. Innerhalb: obere Reihe (Bild · Name/Preis/Liefertext · Menge+Löschen), darunter durch `1px`-Trenner die Farbauswahl.
- Bild 104×104 px, `border-radius: 12px`, `object-fit: cover`. Preis in **Marcellus 24px** `#E4C077`, UVP durchgestrichen `#6F675A 13px`.
- **Farbkacheln**: 62×62 px, `border-radius: 10px`; aktiv `2px solid #D8B56C` + `box-shadow: 0 0 0 3px rgba(216,181,108,.2)`; Label aktiv `#D8B56C`, sonst `#A79E8B`.
- **Bestellbox**: Gradient `linear-gradient(135deg,#16130D,#0F0D0A)`, Rahmen `rgba(216,181,108,.28)`, `border-radius: 18px`, Inhalt-Padding `20px 26px 26px`. Reihen `space-between`, Labels `uppercase letter-spacing:.1em #A79E8B`.

## Interactions & Behavior
- **Menge −/+**: erhöht/verringert die Artikelmenge, aktualisiert Zeilensumme, Zwischensumme, Rabatt und Gesamt.
- **Löschen / Warenkorb leeren**: entfernt Artikel bzw. leert den Warenkorb.
- **Farbkachel-Klick**: wechselt die gewählte Variante (Bild + Label „Farbe: X" aktualisieren; aktive Kachel-Hervorhebung wandert).
- **Gutschein**: „Einlösen" validiert den Code (Original: `WILLKOMMEN10` = −10 %). Eingelöst → Chip mit Code + „Entfernen"; Rabattzeile erscheint in der Summe; Gesamt neu berechnen.
- **Land-Dropdown**: setzt Versandkosten (EU-Länder = kostenlos, sonst Länderpauschale — Logik in `cart.js`).
- **Timer**: Countdown ab 10:00, sekündlich, Format `MM:SS`; bei 0 stopp (Original leert den Warenkorb).
- **„Jetzt bestellen" / Express**: startet den Checkout / die jeweilige Express-Zahlung.
- **Hover**: gold gefüllte Buttons → `#E9CD8C`; Outline-Buttons füllen sich (`background:#D8B56C; color:#0B0A09`); Löschen-Button füllt sich `#C97A5A`.

## State Management
Benötigte State-Variablen (überwiegend bereits in `cart.js` vorhanden):
- `items[]`: `{ id, name, farbe, bild, einzelpreis, uvp, menge, kategorie }`
- `zwischensumme`, `ersparnis`, `gutschein` (`{ code, prozent }` | null), `versand`, `gesamt`
- `land` (Default `"Deutschland"`), `email`
- `agbAkzeptiert` (bool, Pflicht), `werbungEinwilligung` (bool), `newsletter` (bool)
- `timerSekunden` (Countdown; im Prototyp Start bei 600)
- Im Prototyp steuern zwei Props die Anzeige: `gutscheinAngewendet` (bool) und `expressZahlung` (bool) — im Produkt entsprechen sie „Gutschein eingelöst?" und „Express-Buttons anzeigen?".

**Beispieldaten des Prototyps**: Smart Beamer ×1 = 93,99 € (UVP 125,99 €); Nordic Crystal Lamp ×2 = 55,98 € (Einzel 27,99 €, UVP 37,99 €); Aroma Öl Diffusor ×1 = 26,99 € (UVP 35,99 €). Zwischensumme **176,96 €**, Gutschein −10 % = **−17,70 €**, Versand kostenlos, **Gesamt 159,26 €** (ohne Gutschein 176,96 €).

## Design Tokens — Editorial Dark & Gold
- Hintergrund Seite `#13100B`; Karten-Gradient `#211C12 → #17130D`; Panel-Gradient `#16130D → #0F0D0A`
- Gold primär `#D8B56C`; Gold hell (Hover) `#E9CD8C`; Preis-Gold `#E4C077`
- Text `#F2ECDF` / `#F5F0E6`; sekundär `#A79E8B`; gedämpft `#6F675A`
- Kategorie-Akzente: Technik `#7FA8C9`, Licht `#E4B053`, Wellness `#8FB08A`; Löschen/Warnung `#C97A5A`
- Rahmen `rgba(216,181,108,.15–.35)`; Radien: Karten `16px`, Panel `18px`, Bilder `10–12px`, Pills/Buttons `999px`
- Schatten Panel/Seite dezent; Trennlinien `1px rgba(216,181,108,.14–.2)`
- Fonts: **Marcellus** (Headlines/Preise/Gesamt), **Manrope** 300–800 (UI-Text/Buttons)
- Icons: **Bootstrap Icons** 1.11.3
- Mengensteuerung Hit-Target ≥ 34px

## Assets
Im Ordner `assets/` (aus dem Maios-Repo, `produkt bilder/…` und `karten/…`) — für dieses Design tatsächlich genutzt:
- `beamer.jpg` (Smart Beamer weiß), `beamer-silber.jpg`
- `lampe.jpg` (Nordic Crystal Lamp gelb), `lampe-schwarz.jpg`, `lampe-weiss.jpg`
- `diffusor.jpg` (Aroma Öl Diffusor schwarz), `diffusor-weiss.jpg`
- `untersetzer.jpg`, `klima.jpg` (Add-ons)
- Zahlungslogos: `pay-paypal.jpg`, `pay-gpay.png`, `pay-klarna.png`
> Hinweis: Einige Original-Produktbilder sind Lieferanten-Collagen mit eingebranntem Text; hier wurden die sauberen Einzelfarb-Fotos verwendet. Das Lampen-Bild wird per `object-fit: cover` + Offset (`left:-25%; top:-24%; 150%×150%`) zugeschnitten, um das Collagen-Raster zu vermeiden.
> (`tumbler.jpg`, `pay-visa.png`, `pay-mastercard.jpg` liegen im Ordner, werden in diesem Design aber nicht referenziert.)

## Files
- `Warenkorb 1 - Editorial Dark.dc.html` — der umzusetzende Design-Prototyp (Design Component, öffnet direkt im Browser).
- `support.js` — Laufzeit der Design Component (nur für die Prototyp-Vorschau nötig, **nicht** in Produktion übernehmen).

Original-Referenz im angehängten `Maios/`-Ordner: `index.html` (Theme-Quelle), `cart.html`, `cart.js` (bestehende Warenkorb-Logik zum Wiederverwenden), `products.json` (Produktdaten).
