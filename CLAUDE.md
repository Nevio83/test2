# CLAUDE.md

Leitfaden für Claude Code / Claude Designer beim Arbeiten in diesem Repository (Maios Shop).
Sprache im Repo: Deutsch (Code-Kommentare, UI, Logs). Antworten und Commits auf Deutsch halten.

> Wenn du nur wenig Kontext brauchst oder Tokens sparen willst, lies zuerst `CONTEXT-LEAN.md`.
> Für eine abfragbare Projektkarte statt Datei-für-Datei-Grep nutze **Graphify** (siehe unten).

---

## 1. Was ist das hier?

Maios ist ein **deutschsprachiger E-Commerce-/Dropshipping-Shop**. Kunden kaufen über
einen Vanilla-JS-Frontend-Shop, gezahlt wird über **Stripe**, bestellt wird automatisch
beim Lieferanten **CJ Dropshipping**, Belege/Mails laufen über **Resend** + **PDFKit**,
Mehrwährung über **ExchangeRate-API**. Dazu gibt es eine separate **Python-Marketing-
Automatisierung** (`Marketing/`), die TikTok-Creatives generiert.

**Stack:** Node.js + Express (Backend) · Vanilla JS + Bootstrap/Tailwind (Frontend) ·
SQLite (Bestellungen) · Netlify (Hosting + Functions) · Python (Marketing-Pipelines).

> ⚠️ Wichtig: Es gibt **zwei** Backend-Pfade, die auseinanderlaufen — siehe §4. Das ist die
> häufigste Fehlerquelle. Vor jeder Checkout-/Zahlungsänderung beide Pfade prüfen.

---

## 2. Befehle

```bash
npm install                  # Dependencies installieren
npm run dev                  # Dev-Server mit Auto-Reload (nodemon) -> http://localhost:3000
npm start                    # Produktions-Server (node server.js)
npm run test-cj-api          # CJ Dropshipping API-Integration testen
node test-retouren-email.js  # Retouren-/Refund-Mail-Flow testen
node test-cj-api.js          # CJ-Verbindung direkt testen
node get-cj-token.js         # CJ Access-Token holen/erneuern
node setup-stripe-cj-split.js          # Stripe-Connect-Subaccount für CJ-Split einrichten
node setup-stripe-connect-simple.js    # Vereinfachtes Stripe-Connect-Setup
```

**Kein Build-Step.** HTML/CSS/JS werden statisch ausgeliefert. Kein Bundler, kein Transpiler
in Produktion (Vite ist zwar in devDependencies, wird aber nicht im Flow benutzt).

---

## 3. Verzeichnis- & Datei-Landkarte

### Backend (Node/Express)
| Datei | Zweck |
|---|---|
| `server.js` | Express-Server, **alle** API-Routen, Stripe-Webhook, CJ-Auto-Bestellung, Retouren-Logik. ~1665 Zeilen, Herzstück. |
| `database.js` | SQLite-Schema + `dbOperations` (orders, order_items, receipts, order_tracking). |
| `cj-dropshipping-api.js` | Vollständiger CJ-API-Client (Produkte, Orders, Logistik, Disputes, Returns) mit Fallback. |
| `cj-fallback-system.js` | Lokaler Fallback, wenn CJ-API nicht erreichbar ist. |
| `cj-payment-calculator.js` | Berechnet CJ-Kosten + Gewinn-Split (auch als Netlify-Function dupliziert). |
| `price-validator.js` | **Serverseitige Preis-/Mengenvalidierung** gegen `products.json`. Von `server.js` UND der Netlify-Checkout-Function genutzt. Schützt vor Preis-Manipulation. |
| `exchange-rate-service.js` | Live-Wechselkurse, Cache, `convertPrice()`. |
| `shipping-calculator.js` | Pauschale Versandkosten nach Land. |
| `receipt-generator.js` | PDF-Kassenbon (PDFKit) + HTML-Beleg. |
| `resend-service.js` | Transaktions-Mails (Bestellbestätigung, Admin-Benachrichtigung) via Resend. |
| `geolocation-tracker.js` | Standort-/Analytics-Tracking (Backend-Helfer für Dashboard). |
| `get-cj-token.js`, `test-*.js`, `setup-stripe-*.js` | Einmal-/Hilfsskripte. |

### Frontend (statisch)
| Datei | Zweck |
|---|---|
| `index.html` (165 KB) | Startseite/Shop. Nutzt **Tailwind (CDN)**. `indexoriginal.html` = alte Version. |
| `app.js` (192 KB) | Haupt-Frontend-Logik: Produkt-Laden, Suche, Kategorien, Warenkorb, Wishlist. |
| `cart.html` / `cart.js` (101 KB) / `cart.css` (102 KB) | Warenkorb-Seite + Logik + Styles. Nutzt **Bootstrap**. |
| `products.json` (64 KB) | **Single Source of Truth** für Produkte: id, Preis, SKU, Farben, Bilder, Bundles. |
| `color-image-selection.js` / `.css` | Farbvarianten-Auswahl auf Produktseiten. |
| `bundle-images-final.js` | Bundle-/Set-Bildlogik. |
| `color-cart-bridge.js` | Brücke Farbauswahl → Warenkorb. |
| `product-gallery-complete.js` (60 KB) | Produkt-Bildergalerie/Lightbox. |
| `cart-color-images-only.js` | Injiziert Warenkorb-Farb-Thumbnails (+ CSS). |
| `checkout-receipt.js` | Beleg-Anzeige im Checkout. |
| `gutschein-system.js` (34 KB) / `gutscheine.html/.css` | Gutschein-/Rabattsystem (localStorage). |
| `keyboard-shortcuts.js` | Tastenkürzel (Capture-Phase; nur **ein** `app.js`-Include erwartet). |
| `ai-chat-integration.js` | Tawk.to-Live-Chat + OpenAI-Fallback (standardmäßig inaktiv, Platzhalter-IDs). |
| `wishlist.html/.css`, `success.html/.css`, `tracking.html`, `location-analytics-dashboard.html` | Weitere Seiten. |
| `styles.css` (219 KB) | Globale Styles (zusätzlich zu Tailwind/Bootstrap — viel Overlap). |
| `produkte/produkt-10.html … produkt-50.html` | ~45 einzelne Produktseiten. Nutzen **Bootstrap** + Kategorie-CSS (`elektronik.css`, `haushalt-kueche.css`, `beleuchtung.css`, `koerperpflege-wellness.css`). |
| `infos/` | Statische Seiten: AGB, Datenschutz, Impressum, Versand, Retouren, Kontakt, Kategorien, Cookies. |
| `a29715347575/` | Admin-Dashboards (orders, Gutscheine). Jetzt per **HTTP Basic Auth** geschützt (`requireAdminAuth` in `server.js`, ENV `ADMIN_USER`/`ADMIN_PASSWORD`). |
| `karten/` | Kartendaten/Assets für Geo-Dashboard. |

### Infrastruktur / Daten
| Pfad | Zweck |
|---|---|
| `netlify.toml` | Hosting: publish `.`, Functions in `netlify/functions`, Redirect `/api/*` → Functions. |
| `netlify/functions/` | **Produktions-Backend**: nur `create-checkout-session.js` + `cj-payment-calculator.js` (+ `test-server.js`). |
| `database/orders.db`, `orders.db`, `test.db` | SQLite-Dateien (Test vs. Prod gemischt). |
| `Marketing/` | Python-Pipelines (`pipelines/*.py`), eigene `products.json`, chromedriver, Daten/Renders. |
| `.env`, `Marketing/.env` | Secrets. **Aktuell fälschlich eingecheckt — siehe Review, kritisch.** |
| `*.md` (CJ-, RETOUREN-, VOLLAUTOMATISCH-, VERSANDMETHODEN-, KASSENBON-, EXCHANGE_RATE-, DEPLOYMENT-) | Betriebs-Handbücher / SOPs. |

---

## 4. Architektur & Datenflüsse

### Bestellfluss (gewünschter Soll-Zustand)
```
Kunde legt in Warenkorb (localStorage)
  → Checkout: POST /api/create-checkout-session  (Stripe-Session)
  → Stripe Checkout (Hosted)
  → Stripe-Webhook  POST /stripe-webhook
      → SQLite-Bestelldatensatz (database.js)
      → Stripe-Invoice + PDF-Beleg (receipt-generator.js)
      → Mail an Kunde + Admin (resend-service.js)
      → CJ-Bestellung automatisch (cj-dropshipping-api.js)
      → Tracking-Eintrag
```

### ⚠️ Die zwei divergierenden Backends
- **`server.js`** = vollständiges Express-Backend (Webhook, DB, CJ, Mails, Retouren, ~30 Routen).
  Läuft lokal mit `npm run dev`/`npm start`.
- **`netlify/functions/`** = Produktion auf Netlify. Hier existieren **nur** Checkout-Session +
  Payment-Calculator. `netlify.toml` leitet **alle** `/api/*` dorthin um.

**Folge:** In Produktion existieren `/stripe-webhook`, `/api/receipt/*`, `/api/cj/*`,
`/api/contact`, `/api/return-request` **nicht** → die DB-/Mail-/CJ-Automatik läuft live nicht.
Außerdem rechnet die Netlify-Function `item.price` direkt in Cents (ohne Währungsumrechnung)
und nutzt andere Payment-Methoden als `server.js`. **Vor Checkout-Änderungen beide Stellen
synchron halten** oder die Architektur konsolidieren (Empfehlung im Review).

### Frontend-State
Warenkorb & Wishlist liegen in `localStorage` (keine Session). Mehrwährung wird clientseitig
berechnet. **Quelle der Wahrheit für Beträge ist serverseitig:** `price-validator.js` prüft
den Warenkorb gegen `products.json` (beide Checkout-Pfade), bevor Stripe-Beträge gebildet
werden. Offen bleibt die Währungsumrechnung in der Netlify-Function (siehe Review #6).

### Produkt-/Bild-Konvention (nicht brechen!)
Galerien lesen aus `produkt bilder/<Name> bilder/<Name> <farbe>.jpg`. Ordnerstruktur muss 1:1
zu `products.json` passen, sonst brechen Galerie/Bundle/Farb-Bridge. SKUs, die mit `ALI`
beginnen, werden überall außer auf direkten Produkt-URLs herausgefiltert (`app.js`).
Produkt 21 nutzt „Modell" statt „Farbe".

---

## 5. Datenbank

SQLite via `database.js`. Tabellen: `orders`, `order_items`, `receipts`, `order_tracking`
(+ Indizes). **Kein Migrationssystem** — Schemaänderungen per manuellem `ALTER TABLE` oder
DB neu anlegen. Prod-DB: `database/orders.db`. `test.db`/`orders.db` im Root sind Altlasten.

---

## 6. Umgebungsvariablen

Alle Secrets in `.env` (Backend) und `Marketing/.env` (Marketing). Kategorien:
Stripe (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
optional `CJ_STRIPE_ACCOUNT_ID`), CJ (`CJ_API_KEY`, `CJ_ACCESS_TOKEN`, `CJ_EMAIL`,
`CJ_PASSWORD`, Warehouses), Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`),
`EXCHANGE_RATE_API_KEY`, sowie `SESSION_SECRET`/`JWT_SECRET`/`ENCRYPTION_KEY`,
Versand-/Shop-Defaults und Analytics-IDs.

> 🔴 **`.env` und `Marketing/.env` waren in Git eingecheckt** (Live-Keys). `.gitignore` und
> `.env.example` sind gefixt; Untracken/History-Rewrite/**Key-Rotation** stehen noch aus —
> Schritt-für-Schritt in `SECURITY-SOFORT.md`. Niemals neue Secrets hart codieren; immer aus
> `process.env` lesen. Neue Werte zusätzlich ins Netlify-Dashboard (Netlify liest nicht `.env`).

---

## 7. Deployment

**Aktuell (Altbestand):** Netlify (`netlify.toml`, Node via `.nvmrc` = 18.18.0). `/api/*` →
Netlify Functions, sonst SPA-Fallback. Problem: nur Checkout-Function vorhanden → Webhook/DB/
CJ/Mail laufen live nicht (siehe §4).

**Geplanter Weg (vorbereitet):** **Render** als ein persistenter Node-Service, der Frontend
+ komplette API aus `server.js` bedient — beseitigt die Zwei-Backend-Divergenz und gibt SQLite
eine persistente Disk. Dateien dafür liegen bereit: `render.yaml`, DB-Pfad via `SQLITE_DB_PATH`
(`database.js`), `engines` in `package.json`. Schritt-für-Schritt: `DEPLOYMENT-RENDER.md`.
Env-Vars im jeweiligen Dashboard setzen (nicht aus `.env`). Stripe-Webhook-URL nach Deploy auf
`/stripe-webhook` zeigen lassen.

---

## 8. Konventionen & Stolperfallen

- **Deutsch** in UI, Logs, Kommentaren, Commits.
- Emojis in `console.log` sind projektweit Standard (✅/⚠️/❌). ~1000 Log-Statements — vor
  Produktion über ein Log-Level dämpfen (siehe Review), aber Stil beim Bearbeiten beibehalten.
- **Skript-Ladereihenfolge** zählt: `app.js` → `cart.js` → Feature-Skripte. Nur **ein**
  `app.js`-Include (sonst Shortcut-Konflikte).
- Preise sind in EUR in `products.json`; Umrechnung serverseitig. IDs immer numerisch vergleichen
  (`Number(p.id) === Number(id)`), wie im Bestandscode.
- Zwei CSS-Frameworks im Einsatz (Tailwind auf `index.html`, Bootstrap auf Produkt-/Cart-Seiten)
  — beim Bearbeiten das jeweilige Framework der Seite verwenden.
- Retouren werden bewusst **manuell** genehmigt (Auto-Approve ist im Code mit `if (false && …)`
  deaktiviert). Nicht „aufräumen", ohne Rücksprache.

---

## 9. Nützliche Skills (im Cowork/Claude-Umfeld)

Beim Arbeiten an diesem Projekt sind diese Skills typischerweise relevant:

| Skill | Wofür hier |
|---|---|
| **graphify** | Projekt in einen abfragbaren Knowledge-Graph verwandeln statt Datei-für-Datei zu grep’en. Spart bei diesem großen Repo massiv Tokens. Siehe §10. |
| **frontend-design** | Neue/überarbeitete UI-Komponenten, Produktseiten, Redesign (passt zum Designer-Review). |
| **frontend-slides** | Pitch-/Investoren- oder Marketing-Decks aus dem Shop-Content. |
| **pdf** | Belege/Rechnungen lesen, prüfen, neu generieren (ergänzt `receipt-generator.js`). |
| **xlsx** | Produkt-/Preis-/Bestelllisten als Excel (z. B. aus `excel/Maios Produkte.csv` oder DB-Export). |
| **docx** | Betriebs-Handbücher, AGB/Datenschutz-Entwürfe, Audit-Dokumente als Word. |
| **mcp-builder** | Falls eine CJ-/Stripe-/Resend-Integration als sauberer MCP-Server gekapselt werden soll. |
| **humanizer-deutsch** | Produkttexte/Mails entkitschen, KI-Sprachmuster im deutschen Copy entfernen. |
| **skill-creator** | Eigene wiederkehrende Workflows (z. B. „neue Produktseite anlegen") als Skill formalisieren. |
| **caveman** | Token-sparender Kommunikationsmodus (siehe `CONTEXT-LEAN.md`). |

Document-Skills (pdf/xlsx/docx/pptx) erst **nach** der Recherche laden — zuerst Fakten/Daten
sammeln, dann das Format-Skill für die Ausgabe.

---

## 10. Graphify — Verwendung

Graphify (Repo: https://github.com/safishamsi/graphify, PyPI-Paket: **`graphifyy`**) baut aus
diesem Ordner einen Knowledge-Graph aus Code, DB-Schema, Docs, Bildern und Videos. Bei einem
Repo dieser Größe (≈19k JS-Zeilen, 64 HTML-Dateien) ist das der schnellste Weg, Zusammenhänge
zu finden, ohne große Dateien komplett zu lesen.

**Einmalige Installation (CLI):**
```bash
uv tool install graphifyy        # empfohlen (isolierte Umgebung, CLI heißt weiterhin "graphify")
# Alternativen:
pipx install graphifyy
pip  install graphifyy           # nur wenn nötig; PATH/venv beachten
```

**Skill ins Tool installieren:**
```bash
graphify install                         # Claude Code (Linux/Mac)
graphify install --platform windows      # Claude Code unter Windows
graphify install --project               # projekt-lokal -> .claude/skills/graphify/SKILL.md
```

**Benutzen (im Assistenten):**
```
/graphify .          # gesamtes Projekt grafisch erfassen
                     # (PowerShell: "graphify ." ohne führenden Slash)
```
Ergebnis liegt in `graphify-out/`:
- `graph.html` — interaktiver Graph im Browser (Knoten anklicken, filtern, suchen)
- `GRAPH_REPORT.md` — Highlights: Kernkonzepte, überraschende Verbindungen, Fragen
- `graph.json` — vollständiger Graph, jederzeit abfragbar **ohne** Dateien neu zu lesen

**Lesbare Architektur-Seite mit Mermaid-Callflow:**
```bash
graphify export callflow-html
```

**Optionale Extras** (nach Bedarf): `graphifyy[sql]` (DB-Schema), `graphifyy[mcp]`
(MCP-Server), `graphifyy[svg]` (Graph-Export), `graphifyy[anthropic]` (Claude-Backend).

**Empfehlung für dieses Repo:** `graphify-out/` in `.gitignore` aufnehmen und vor größeren
Refactorings einmal `/graphify .` laufen lassen, um die zwei Backend-Pfade (§4) und die
Skript-Abhängigkeiten sichtbar zu machen.

---

## 11. Weitere Reviews / Dokumente in diesem Repo

- `REVIEW-CLAUDE-CODE.md` — tiefer Code-/Bug-/Sicherheits-/Performance-Review (für Claude Code).
- `REVIEW-CLAUDE-DESIGNER.md` — tiefer UI-/UX-/Accessibility-/SEO-Review (für Claude Designer).
- `CONTEXT-LEAN.md` — komprimierter Projekt-Spickzettel + Token-Spar-Regeln.
- `SECURITY-SOFORT.md` — Sofortmaßnahmen: Secrets aus Git entfernen + Keys rotieren.
- `external-audit-review.txt` — bestehendes Audit-Paket (Logging, Migration, Verzeichnisse).
- Betriebs-SOPs: `CJ-AUTOMATISIERUNG.md`, `RETOUREN-AUTOMATISIERUNG.md`,
  `VOLLAUTOMATISCHE-RETOUREN.md`, `VOLLAUTOMATISCH-FERTIG.md`, `VERSANDMETHODEN.md`,
  `KASSENBON-SYSTEM.md`, `EXCHANGE_RATE_SETUP.md`, `DEPLOYMENT.md`.

> Hinweis: `README.md` ist teils veraltet (nennt **MongoDB**, tatsächlich ist es **SQLite**).
> Bei Doku-Arbeiten zuerst Code prüfen, dann README angleichen.
