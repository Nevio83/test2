# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-21 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
auf Apex) + Fallback `https://maios-shop.onrender.com` · Repo `Nevio83/test2` (nur `main`)
· DB: Neon-Postgres · Hosting: Render (Free).

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig/optional.

> Hier stehen nur **offene** Aufgaben — Erledigtes wird entfernt.

---

## 1. Git / GitHub-Workflow

- Nur Branch **`main`**, Auto-Deploy auf Render bei Push.
- Lock-Fehler („A lock file already exists"): alle Git-Tools schließen, dann
  `Remove-Item -Force "<Projekt>\.git\index.lock"` (PowerShell).
- Push fragt nach Login → GitHub-User + **Personal Access Token** (nicht Passwort).
- Bei `package.json`-Änderungen immer `npm install --package-lock-only`, sonst zieht Render eine
  veraltete Lock-Datei (genau das war ein Deploy-Fehler).
- **Vor dem Commit prüfen:** `npm run lint` (ESLint, fängt u. a. `no-dupe-keys`) und
  `npm test` (Smoke-Tests für Preis-/Versandlogik). `npm run format` formatiert mit Prettier.
  ESLint/Prettier sind devDependencies — in Prod (Render) nicht zur Laufzeit nötig.
- **Umlaute/UTF-8:** HTML-Dateien sind UTF-8 **ohne BOM**. NICHT mit Windows-PowerShell-5.1
  `Get-Content -Raw` + `WriteAllText` bulk-bearbeiten (zerstört Umlaute → Mojibake `Ã¼`).
  Edit-Tool oder `[System.IO.File]::ReadAllBytes/WriteAllBytes` mit korrektem Encoding nutzen.
- `.env` ist gitignored und nicht getrackt — Prod-Werte gehören ins **Render-Dashboard**, nie ins Repo.

---

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).

---

## 2. Belegvorhalte­pflichten prüfen 🟡

**Frage:** Sind die Kassenbons/Rechnungen so aufgebaut, dass sie den deutschen steuerlichen
Belegvorhalte­pflichten entsprechen?

**Prüfpunkte (§14 UStG + GoBD):**
- Vollständiger Name + Anschrift des leistenden Unternehmens (Maios)
- Vollständiger Name + Anschrift des Leistungsempfängers (Käufer)
- Steuer­nummer oder USt-IdNr. des Ausstellers
- Ausstellungsdatum + fortlaufende Rechnungsnummer
- Menge + handelsübliche Bezeichnung der gelieferten Gegenstände
- Netto-Entgelt, anzuwendender Steuersatz, Steuer­betrag, Brutto-Betrag
- Bei Kleinbetragsrechnungen (≤ 250 €): vereinfachte Pflichtangaben ausreichend
- Aufbewahrungsfrist: 10 Jahre (Rechnungen müssen maschinell lesbar archiviert sein)

**Aufgabe:** `receipt-generator.js` + HTML-Beleg-Template prüfen ob alle Pflichtfelder
vorhanden sind. Fehlende Felder ergänzen. Prüfen ob Rechnungsnummern fortlaufend und
lückenlos sind (Spalte in `receipts`-Tabelle). Gegebenenfalls Hinweis in Datenschutz/AGB.

---

## 3. Produktseiten nach Produktnamen umbenennen 🟢

**Ist-Stand:** Produktseiten heißen `produkte/produkt-10.html`, `produkt-11.html` … `produkt-50.html`
(~45 Dateien). URLs sind technisch (ID-basiert), nicht sprechend.

**Ziel:** URLs sollen den Produktnamen enthalten, z.B.:
`produkte/elektrischer-wasserspender-fuer-schreibtisch.html`

**Umsetzung:**
- Produktnamen aus `products.json` in URL-Slugs umwandeln (Kleinbuchstaben, Leerzeichen → `-`,
  Umlaute ersetzen: ä→ae, ö→oe, ü→ue, ß→ss, Sonderzeichen entfernen)
- Alle ~45 HTML-Dateien umbenennen
- Weiterleitungen (301) von alten ID-URLs auf neue Slug-URLs in `server.js` einrichten
  (damit alte Links/SEO nicht verloren gehen)
- `products.json` um Feld `slug` oder `url` ergänzen
- Alle internen Links in `app.js`, `index.html`, Kategorieseiten (`infos/`), `cart.js` aktualisieren
- Produktgalerie-Logik (`product-gallery-complete.js`) und Farb-Bridge (`color-cart-bridge.js`)
  anpassen falls sie ID-basiert auf Dateinamen zugreifen
- SEO: `<title>`, `<meta name="description">`, `<h1>` auf jeder Produktseite prüfen/anpassen

**Wichtig:** Galerie liest aus `produkt bilder/<Name> bilder/<Name> <farbe>.jpg` — Ordnerstruktur
bleibt unverändert, nur die HTML-Dateinamen ändern sich. ID-Logik in `app.js` (numerischer Vergleich)
bleibt erhalten, URL-Mapping in `server.js` übernimmt die Zuordnung.
