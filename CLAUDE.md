# CLAUDE.md

Leitfaden für Claude Code / Claude Designer beim Arbeiten in diesem Repository (Maios Shop).
Sprache im Repo: Deutsch (Code-Kommentare, UI, Logs). Antworten und Commits auf Deutsch halten.

> **Drei Doku-Dateien:** `CLAUDE.md` (dieser Guide: Architektur, Stand, Setup) ·
> `CLAUDE-CODE.md` (Backlog: Sicherheit, Bugs, Aufräumen, Ausbau, Git) ·
> `CLAUDE-DESIGN.md` (UI/UX, Design-System, Accessibility, SEO).
> Für eine abfragbare Projektkarte statt Datei-für-Datei-Grep nutze **Graphify** (siehe §10).

---

## 0. Aktueller Stand (2026-06-21)

- **Live:** **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet auf Apex) +
  Fallback `https://maios-shop.onrender.com`. Free-Plan (schläft nach 15 Min → erster Aufruf
  ~50 s; Fix in `CLAUDE-CODE.md` §2). Repo `Nevio83/test2`, nur Branch `main`, Auto-Deploy bei Push.
- **Datenbank:** **Neon-Postgres** (dauerhaft, kostenlos) via `DATABASE_URL`. SQLite ist Geschichte.
- **Hosting:** Netlify ist komplett raus (Domain auf Render, Repo entkoppelt, `netlify/`-Ordner
  **gelöscht**). **Render = einzige Quelle der Wahrheit.**
- **SEO-URLs:** Produktseiten haben **sprechende Slug-URLs** (`/produkte/<slug>.html`, z.B.
  `elektrischer-wasserspender-fuer-schreibtisch.html`). `products.json` hat ein Feld `slug`;
  `server.js` leitet alte ID-URLs (`/produkte/produkt-NN.html`) per **301** auf den Slug um.
  Produkt-ID steht zur Laufzeit in `<body data-product-id="NN">` (siehe §4).
- **Cookie-Consent (DSGVO):** Eigener Banner `cookie-consent.js/.css` (kein Drittanbieter),
  Zwei-Stufen-Einwilligung (Alle / Nur notwendige), `window.MaiosConsent`-API, 12-Monats-TTL.
- **Aufrufe-/Besucher-Tracking** (consent-gated): `page_views` + `user_consent_events`,
  `POST /api/track/view|duration|consent`, Client `view-tracker.js`; Besucher-Insights
  (Gerät/Browser/OS, Einstiegsseiten, Verweildauer, Wiederkehrer) im Dashboard `orders.html`.
- **Belege rechtskonform:** Kleinunternehmer **§19 UStG** (kein USt-Ausweis + Pflichthinweis),
  fortlaufende Rechnungsnummer (`RE-000001`, Postgres-Sequence), echte Firmendaten (ENV),
  **GoBD**-Archiv: Beleg-PDF zusätzlich per Mail an `RECEIPT_ARCHIVE_EMAIL` (Renders FS ist flüchtig).
- **EU-Widerruf:** `infos/widerruf.html` (Belehrung + Online-Formular), `POST /api/widerruf`,
  `widerruf-button.js` (Footer-Button auf allen Seiten).
- **Stripe-Webhook:** zeigt auf `https://maiosshop.com/stripe-webhook` (Events
  `checkout.session.completed` + `payment_intent.succeeded`).
- **Admin-Dashboard:** `…/a29715347575/orders.html` (+ `produkt-analyse.html`), Login via
  `ADMIN_USER`/`ADMIN_PASSWORD`.
- **Wo anfangen:** offene Aufgaben stehen in `CLAUDE-CODE.md`, Design-Themen in
  `CLAUDE-DESIGN.md`. Großes Repo → erst `/graphify .` (§10).

---

## 1. Was ist das hier?

Maios ist ein **deutschsprachiger E-Commerce-/Dropshipping-Shop**. Kunden kaufen über
einen Vanilla-JS-Frontend-Shop, gezahlt wird über **Stripe**, bestellt wird automatisch
beim Lieferanten **CJ Dropshipping**, Belege/Mails laufen über **Resend** + **PDFKit**,
Mehrwährung über **ExchangeRate-API**. Dazu gibt es eine separate **Python-Marketing-
Automatisierung** (`Marketing/`), die TikTok-Creatives generiert.

**Stack:** Node.js + Express (Backend) · Vanilla JS + Bootstrap/Tailwind (Frontend) ·
PostgreSQL/Neon (Bestellungen) · **Render** (Hosting, live) · Python (Marketing-Pipelines).

> ⚠️ Produktion läuft komplett aus `server.js` auf **Render**. Der alte `netlify/`-Pfad wurde
> **entfernt** — `server.js` ist die alleinige Quelle der Wahrheit für Checkout/Zahlung (siehe §4).

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
| `server.js` | Express-Server, **alle** API-Routen, Stripe-Webhook, CJ-Auto-Bestellung, Retouren-Logik, Tracking-/Consent-Endpoints, 301-Slug-Redirects. ~1980 Zeilen, Herzstück. |
| `database.js` | **PostgreSQL** (`pg`) — Schema + `dbOperations` (orders, order_items, receipts, order_tracking). Verbindung via `DATABASE_URL` (Neon). |
| `cj-dropshipping-api.js` | Vollständiger CJ-API-Client (Produkte, Orders, Logistik, Disputes, Returns) mit Fallback. |
| `cj-fallback-system.js` | Lokaler Fallback, wenn CJ-API nicht erreichbar ist. |
| `cj-payment-calculator.js` | Berechnet CJ-Kosten + Gewinn-Split. |
| `price-validator.js` | **Serverseitige Preis-/Mengenvalidierung** gegen `products.json` (in `server.js`). Schützt vor Preis-Manipulation. |
| `exchange-rate-service.js` | Live-Wechselkurse, Cache, `convertPrice()`. |
| `shipping-calculator.js` | Pauschale Versandkosten nach Land. |
| `receipt-generator.js` | **Rechnung** (PDFKit-PDF + HTML), Kleinunternehmer §19 UStG ohne USt-Ausweis, echte Firmendaten aus ENV. |
| `resend-service.js` | Transaktions-Mails (Bestellbestätigung, Admin-Benachrichtigung, **GoBD-Beleg-Archiv** mit PDF-Anhang) via Resend. |
| `geolocation-tracker.js` | Standort-/Analytics-Tracking (Backend-Helfer für Dashboard). |
| `get-cj-token.js`, `test-*.js`, `setup-stripe-*.js` | Einmal-/Hilfsskripte. |

### Frontend (statisch)
| Datei | Zweck |
|---|---|
| `index.html` (165 KB) | Startseite/Shop. Nutzt **Tailwind (CDN)**. |
| `app.js` (192 KB) | Haupt-Frontend-Logik: Produkt-Laden, Suche, Kategorien, Warenkorb, Wishlist. Helper `productHref(id)` baut Slug-URLs. |
| `cart.html` / `cart.js` (101 KB) / `cart.css` (102 KB) | Warenkorb-Seite + Logik + Styles. Nutzt **Bootstrap**. Helper `cartProductHref(id)` für Slug-URLs. |
| `products.json` (64 KB) | **Single Source of Truth** für Produkte: id, name, **slug**, Preis, SKU, Farben, Bilder, Bundles. |
| `color-image-selection.js` / `.css` | Farbvarianten-Auswahl auf Produktseiten. |
| `bundle-images-final.js` | Bundle-/Set-Bildlogik. |
| `color-cart-bridge.js` | Brücke Farbauswahl → Warenkorb. |
| `product-gallery-complete.js` (60 KB) | Produkt-Bildergalerie/Lightbox. |
| `cart-color-images-only.js` | Injiziert Warenkorb-Farb-Thumbnails (+ CSS). |
| `checkout-receipt.js` | Beleg-Anzeige im Checkout. |
| `gutschein-system.js` (34 KB) / `gutscheine.html/.css` | Gutschein-/Rabattsystem (localStorage). |
| `keyboard-shortcuts.js` | Tastenkürzel (Capture-Phase; nur **ein** `app.js`-Include erwartet). |
| `ai-chat-integration.js` | Tawk.to-Live-Chat + OpenAI-Fallback (standardmäßig inaktiv, Platzhalter-IDs). |
| `cookie-consent.js/.css` | DSGVO-Banner (Zwei-Stufen-Consent, `window.MaiosConsent`-API). Global eingebunden. |
| `view-tracker.js` | Consent-gated Aufrufe-/Verweildauer-Tracking → `/api/track/*`. |
| `widerruf-button.js` | Injiziert EU-Widerrufsbutton (Footer) auf allen Kundenseiten. |
| `wishlist.html/.css`, `success.html/.css`, `tracking.html`, `location-analytics-dashboard.html` | Weitere Seiten. |
| `styles.css` (219 KB) | Globale Styles (zusätzlich zu Tailwind/Bootstrap — viel Overlap). |
| `produkte/<slug>.html` | 40 einzelne Produktseiten mit **sprechenden Slug-Dateinamen** (aus `products.json`). Jede trägt `<body data-product-id="NN">`. Nutzen **Bootstrap** + Kategorie-CSS (`elektronik.css`, `haushalt-kueche.css`, `beleuchtung.css`, `koerperpflege-wellness.css`). |
| `infos/` | Statische Seiten: AGB, Datenschutz, Impressum, Versand, Retouren, Kontakt, Kategorien, Cookies, **Widerruf**. |
| `a29715347575/` | Admin-Dashboards (orders, Gutscheine, **produkt-analyse**). Per **HTTP Basic Auth** geschützt (`requireAdminAuth` in `server.js`, ENV `ADMIN_USER`/`ADMIN_PASSWORD`). |
| `karten/` | Kartendaten/Assets für Geo-Dashboard. |

### Infrastruktur / Daten
| Pfad | Zweck |
|---|---|
| `render.yaml` | **Render-Blueprint** (Live-Hosting, Free): ein Node-Service bedient Frontend + API aus `server.js`. |
| `Marketing/` | Python-Pipelines (`pipelines/*.py`), eigene `products.json`, chromedriver, Daten/Renders. |
| `.env`, `Marketing/.env` | Secrets, **gitignored & nicht getrackt**. `.env.example` listet alle Schlüssel; Prod-Werte ins Render-Dashboard. |
| `*.md` | Betriebs-SOPs (CJ, Retouren, Versand, Kassenbon, Exchange) + die drei Kern-Docs (§11). |

---

## 4. Architektur & Datenflüsse

### Bestellfluss (gewünschter Soll-Zustand)
```
Kunde legt in Warenkorb (localStorage)
  → Checkout: POST /api/create-checkout-session  (Stripe-Session)
  → Stripe Checkout (Hosted)
  → Stripe-Webhook  POST /stripe-webhook
      → Postgres-Bestelldatensatz (database.js, Neon)
      → Stripe-Invoice + PDF-Beleg (receipt-generator.js)
      → Mail an Kunde + Admin (resend-service.js)
      → CJ-Bestellung automatisch (cj-dropshipping-api.js)
      → Tracking-Eintrag
```

### Production = `server.js` auf Render
- **`server.js`** = vollständiges Express-Backend (Webhook, DB, CJ, Mails, Retouren, Tracking,
  ~30 Routen). Läuft **live auf Render** (`npm start`) und lokal mit `npm run dev`. **Maßgeblich.**
- Der alte `netlify/`-Pfad ist **entfernt** — keine doppelte Checkout-Logik mehr.

### Frontend-State
Warenkorb & Wishlist liegen in `localStorage` (keine Session). Mehrwährung wird clientseitig
berechnet. **Quelle der Wahrheit für Beträge ist serverseitig:** `price-validator.js` prüft
den Warenkorb gegen `products.json`, bevor Stripe-Beträge gebildet werden.

### Produkt-URL- & Bild-Konvention (nicht brechen!)
- **URLs:** Produktseiten heißen `produkte/<slug>.html` (Slug aus `products.json`, root-relativ
  verlinkt: `/produkte/<slug>.html`). Alte ID-URLs `/produkte/produkt-NN.html` werden in
  `server.js` per **301** auf den Slug umgeleitet (Map aus `products.json`, vor `express.static`).
- **Produkt-ID zur Laufzeit:** kommt aus `<body data-product-id="NN">` (nicht mehr aus dem
  Dateinamen!). `product-gallery-complete.js`, `color-image-selection.js`, `bundle-images-final.js`
  lesen sie von dort (URL-Regex nur noch als Fallback). Interne Links über `productHref(id)`
  (app.js) bzw. `cartProductHref(id)` (cart.js) — beide lösen den Slug aus der Produktliste auf.
- **Bilder:** Galerien lesen aus `produkt bilder/<Name> bilder/<Name> <farbe>.jpg`. Ordnerstruktur
  muss 1:1 zu `products.json` passen (Name-basiert, **unabhängig vom Slug**), sonst brechen
  Galerie/Bundle/Farb-Bridge. SKUs mit `ALI`-Präfix werden außer auf direkten Produkt-URLs
  herausgefiltert (`app.js`). Produkt 21 nutzt „Modell" statt „Farbe".

---

## 5. Datenbank

**PostgreSQL** via `database.js` (`pg`-Pool, Verbindung über `DATABASE_URL`). Tabellen:
`orders`, `order_items`, `receipts`, `order_tracking` (+ Indizes), werden beim Start
automatisch angelegt (`CREATE TABLE IF NOT EXISTS`). Empfohlen: **Neon** (kostenlos & dauerhaft).
Lokal dieselbe `DATABASE_URL` in `.env`. Ohne `DATABASE_URL` läuft der Shop, aber Bestell-/
Beleg-/Tracking-Funktionen sind deaktiviert. **Kein Migrationssystem** — Schemaänderungen per
manuellem `ALTER TABLE`. (Frühere SQLite-Dateien `*.db` sind Altlasten.)

---

## 6. Umgebungsvariablen

Alle Secrets in `.env` (Backend) und `Marketing/.env` (Marketing). Kategorien:
Stripe (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
optional `CJ_STRIPE_ACCOUNT_ID`), CJ (`CJ_API_KEY`, `CJ_ACCESS_TOKEN`, `CJ_EMAIL`,
`CJ_PASSWORD`, Warehouses), Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`),
`EXCHANGE_RATE_API_KEY`, **`DATABASE_URL`** (Neon-Postgres), `ADMIN_USER`/`ADMIN_PASSWORD`
(Admin-Login), sowie `SESSION_SECRET`/`JWT_SECRET`/`ENCRYPTION_KEY`, Versand-/Shop-Defaults
und Analytics-IDs.

> **Secrets:** `.env` ist gitignored und nicht getrackt; `.env.example` listet alle Schlüssel.
> Niemals Secrets hart codieren; immer aus `process.env` lesen. Prod-Werte gehören ins
> **Render-Dashboard** (Render liest nicht `.env`).

---

## 7. Deployment

**Live auf Render** (Free-Plan): ein Node-Web-Service (`render.yaml`) bedient Frontend +
komplette API aus `server.js`. URL: **https://maiosshop.com** (Fallback
`https://maios-shop.onrender.com`). **Auto-Deploy** bei Push auf `main`. Node-Version via
`NODE_VERSION`/`.nvmrc` (18.x — EOL-Warnung, Upgrade auf 20 in `CLAUDE-CODE.md` §3).

- **Datenbank:** Neon-Postgres über `DATABASE_URL` (im Render-Dashboard gesetzt).
- **Env-Vars:** alle Secrets im **Render-Dashboard → Environment** (Stripe, Resend, CJ,
  ExchangeRate, `DATABASE_URL`, `ADMIN_USER`/`ADMIN_PASSWORD`, Firmendaten/`RECEIPT_ARCHIVE_EMAIL`)
  — nicht aus `.env`.
- **Build/Start:** `npm install` → `npm start`. Bei Dependency-Änderungen vorher
  `npm install --package-lock-only`, sonst zieht Render eine veraltete Lock-Datei.
- **Free-Plan-Haken:** Service schläft nach 15 Min (erster Aufruf ~50 s). Daten bleiben (Neon).
  Abhilfe (Ping-Cron) in `CLAUDE-CODE.md` §2.
- **Stripe-Webhook:** zeigt im Stripe-Dashboard auf `https://maiosshop.com/stripe-webhook`
  (erledigt — sonst landen Bestellungen nicht in der DB).

---

## 8. Konventionen & Stolperfallen

- **Deutsch** in UI, Logs, Kommentaren, Commits.
- Emojis in `console.log` sind projektweit Standard (✅/⚠️/❌). ~1000 Log-Statements — vor
  Produktion über ein Log-Level dämpfen (siehe Review), aber Stil beim Bearbeiten beibehalten.
- **Skript-Ladereihenfolge** zählt: `app.js` → `cart.js` → Feature-Skripte. Nur **ein**
  `app.js`-Include (sonst Shortcut-Konflikte).
- Preise sind in EUR in `products.json`; Umrechnung serverseitig. IDs immer numerisch vergleichen
  (`Number(p.id) === Number(id)`), wie im Bestandscode.
- **Produkt-URLs:** intern nie `produkt-NN.html` hart verlinken — `productHref(id)` (app.js) /
  `cartProductHref(id)` (cart.js) bzw. `p.slug` nutzen. Neue Produktseite: Slug in `products.json`
  setzen, Datei `produkte/<slug>.html` mit `<body data-product-id="NN">` anlegen. Bei umbenanntem
  Produkt 301-Redirect-Map in `server.js` greift automatisch (liest `slug` aus `products.json`).
- Zwei CSS-Frameworks im Einsatz (Tailwind auf `index.html`, Bootstrap auf Produkt-/Cart-Seiten)
  — beim Bearbeiten das jeweilige Framework der Seite verwenden.
- Retouren werden bewusst **manuell** genehmigt. Auto-Approve ist per Flag `RETURNS_AUTO_APPROVE`
  gesteuert (Standard: aus). Nur bei `RETURNS_AUTO_APPROVE=true` + Bestellung ≤14 Tage + Grund in
  der Liste greift die Automatik (Stripe-Refund + CJ-Retoure). Details: `RETOUREN-AUTOMATISIERUNG.md`.
- **`node-fetch` muss v2 bleiben** (`require()`-kompatibel). v3 ist ESM-only und crasht
  `cj-dropshipping-api.js` + `exchange-rate-service.js` beim Start. Alternativ auf Node 20+
  heben und global `fetch` nutzen.
- **DB ist Postgres** (`pg`), nicht mehr SQLite. Bei `package.json`-Änderungen
  `npm install --package-lock-only` laufen lassen, sonst zieht Render eine veraltete Lock-Datei.
- **Secrets nie committen** — `.env` ist gitignored. Prod-Werte ins Render-Dashboard.

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
| **caveman** | Token-sparender Kommunikationsmodus für lange Sessions. |

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

**Die drei Kern-Dokumente:**
- `CLAUDE.md` — dieser Guide (Architektur, aktueller Stand, Setup, Deployment, Konventionen).
- `CLAUDE-CODE.md` — Backlog für Claude Code: Bug-/Review-Liste mit Status, Aufräumen
  (überflüssige Dateien/Duplikate/toter Code), Ausbau (Aufrufe-Tracking u.a.), Git-Workflow.
- `CLAUDE-DESIGN.md` — alles fürs Design: Design-System, UI/UX, Accessibility, SEO.

**Betriebs-SOPs (Domänen-Handbücher):** `CJ-AUTOMATISIERUNG.md`, `RETOUREN-AUTOMATISIERUNG.md`,
`VERSANDMETHODEN.md`, `KASSENBON-SYSTEM.md`, `EXCHANGE_RATE_SETUP.md`.
