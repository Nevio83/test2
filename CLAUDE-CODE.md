# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: Bug-/Review-Liste (mit Status), Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-19 · Live: https://maios-shop.onrender.com · Repo `Nevio83/test2` (nur `main`)
· DB: Neon-Postgres · Hosting: Render (Free).

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig/optional · ✅ erledigt.

---

## 1. Code-Review (Bugs/Sicherheit/Performance) — Status

| # | Prio | Thema | Datei(en) |
|---|---|---|---|
| 1 | ✅ | Preis-Manipulation geschlossen: Warenkorb serverseitig gegen `products.json` validiert | `price-validator.js`, `server.js`, netlify-fn |
| 2 | ✅ | Stripe-Webhook-Body-Parser gefixt (Raw vor `express.json`, Dupe entfernt) | `server.js` |
| 3 | 🟠 | Webhook/API live auf Render. **Offen:** Stripe-Webhook-URL auf `…onrender.com/stripe-webhook` zeigen lassen | Stripe-Dashboard |
| 4 | ✅ | Auth für Admin/`/api/cj`/Admin-`/api/receipt` (HTTP Basic Auth, `ADMIN_USER`/`ADMIN_PASSWORD`) | `server.js` |
| 5 | 🟠 | Zwei Checkout-Pfade konsolidieren → mit Render fällt `netlify/` weg (siehe §2) | `server.js`, `netlify/` |
| 6 | 🟠 | Doppelter `payment_intent_data`-Key im `sessionConfig` (zweiter überschreibt ersten → Metadaten weg) | `server.js` |
| 7 | 🟠 | CORS/CSP härten: `Access-Control-Allow-Origin:'*'`, `X-Frame-Options:ALLOWALL`, CSP `frame-ancestors *` (Replit-Altlast) → Allowlist + `SAMEORIGIN` | `server.js` |
| 8 | 🟠 | Toter `if(false && …)`-Auto-Retoure-Block → Env-Flag `RETURNS_AUTO_APPROVE` oder entfernen | `server.js` |
| 9 | 🟠 | OpenAI-Key nicht im Client (`ai-chat-integration.js`) → serverseitiger Proxy; Antwort defensiv parsen | `ai-chat-integration.js` |
| 10 | 🟡 | Robustheit: MwSt.-Berechnung prüfen; `crypto.randomUUID()` statt `substr`; Fehler-Responses ohne interne Details | `server.js`, `database.js` |
| 11 | 🟡 | Performance: Assets unminifiziert/ungebündelt (styles.css 215 KB, app.js 188 KB), Bilder unoptimiert (WebP/lazy), `products.json` mehrfach pro Render gefetcht, ~1000 `console.*` → Log-Level | Frontend gesamt |
| 12 | 🟡 | Tests/CI/Lint fehlen: ESLint (`no-dupe-keys`!), Prettier, Smoke-Tests (Split-Mathematik, Webhook-Signatur) | Projektweit |

**Bereits gefixt nebenbei:** `sqlite3`→`pg` (Build-Fehler weg), `node-fetch`→v2 (ESM-Crash weg),
`package-lock.json` neu generiert.

---

## 2. Aufräumen (überflüssig / Duplikate / toter Code)

**Sicher löschbar:**
- `indexoriginal.html` (alte index-Kopie), `test-require.js` (lädt entferntes `sqlite3`),
  `external-audit-review.txt` (veraltet, MongoDB), `state.json` (ungenutzt prüfen),
  `DEPLOYMENT.md` (alt, Netlify).
- **`netlify/`-Ordner + `netlify.toml`** — Render ist jetzt der Weg. Damit verschwinden auch die
  Duplikate `netlify/functions/cj-payment-calculator.js` und die zweite Checkout-Implementierung.

**Duplikate:** `cj-payment-calculator.js` (root + netlify) · zwei Checkout-Pfade → lösen sich mit
dem Entfernen von `netlify/`. `products.json` (root) vs. `Marketing/products.json` sind
**beabsichtigt** verschieden — nicht zusammenführen.

**Ungenutzte Dependencies:** `@sendgrid/mail` (Mails laufen über Resend), `vite`/`vite-plugin-html`
(kein Build-Step). Aus `package.json` raus, danach `npm install --package-lock-only`.

**Toter Code:** Legacy-Endpunkt `/api/send-confirmation` (SendGrid), Replit-iframe-Middleware,
`item.id===1`-Altlast in `/api/create-payment-intent`.

**Veraltete Docs:** `README.md` (MongoDB→Postgres, Banner gesetzt) · drei Retouren-SOPs
(`RETOUREN-AUTOMATISIERUNG.md`, `VOLLAUTOMATISCHE-RETOUREN.md`, `VOLLAUTOMATISCH-FERTIG.md`) → auf
eine konsolidieren.

**Risikoarmer erster Aufräum-Commit:**
```bash
git rm indexoriginal.html test-require.js external-audit-review.txt state.json DEPLOYMENT.md
git rm -r netlify ; git rm netlify.toml
# @sendgrid/mail, vite, vite-plugin-html aus package.json entfernen
npm install --package-lock-only
git add -A && git commit -m "cleanup: tote Dateien, Netlify-Altpfad, ungenutzte Deps"
```

---

## 3. Ausbau-Ideen (Admin-Dashboard & Shop)

Alle neuen Daten → Neon-Postgres (`database.js` `SCHEMA` + `dbOperations`). Admin-Endpunkte
hinter `requireAdminAuth`, am besten unter `/api/admin/*` gebündelt.

**1. 🟢 Aufrufe/Besucher-Tracking (vom Nutzer gewünscht):**
- Tabelle `page_views` (`id, path, referrer, country, user_agent, session_id, created_at`).
- `dbOperations`: `addPageView`, `getViewStats`, `getTopPages`, `getLiveVisitors`.
- **Öffentlicher** `POST /api/track/view` (Land via vorhandenem `geolocation-tracker.js`,
  IP nicht roh speichern). Client-Snippet in `index.html`/Produktseiten (`fetch` beim Laden,
  `session_id` aus `sessionStorage`).
- Admin-Endpunkte + Dashboard-Kacheln „Aufrufe heute / Eindeutige Besucher / Live jetzt" +
  Chart (Chart.js) + Top-Seiten/Länder. `location-analytics-dashboard.html` als Vorlage.

**2. Umsatz/Conversion:** Conversion-Rate (Views→Orders), Umsatz-Charts Tag/Woche/Monat,
Top-Produkte (aus `order_items`), AOV.

**3. Bestell-Workflow:** Suche/Filter (E-Mail, Nr., Status, Zeitraum), CSV-/Excel-Export,
Tracking-Spalte (`order_tracking` + `cjAPI.getTrackInfo`), Retouren-Übersicht (Tabelle `returns`),
Live-Benachrichtigung bei neuer Bestellung.

**4. Betrieb:** CJ-Lagerbestand/Stock-Warnungen, CJ-Status automatisch nachziehen,
Warenkorb-Abbrüche messen.

Datenschutz: Cookie-/Tracking-Hinweis in `infos/cookies.html`/Datenschutz prüfen.

---

## 4. Git / GitHub-Workflow

- Nur Branch **`main`**, Auto-Deploy auf Render bei Push.
- Lock-Fehler („A lock file already exists"): alle Git-Tools schließen, dann
  `Remove-Item -Force "<Projekt>\.git\index.lock"` (PowerShell).
- Push fragt nach Login → GitHub-User + **Personal Access Token** (nicht Passwort).
- Bei `package.json`-Änderungen immer `npm install --package-lock-only`, sonst zieht Render eine
  veraltete Lock-Datei (genau das war ein Deploy-Fehler).
- `.env` ist gitignored und nicht getrackt — Prod-Werte gehören ins **Render-Dashboard**, nie ins Repo.

---

## 5. Nächste sinnvolle Schritte (Reihenfolge)

1. 🟠 Stripe-Webhook-URL auf Render zeigen lassen (§1 #3) → dann füllt sich das Dashboard.
2. 🟢 Aufräum-Commit (§2).
3. 🟠 Code-Härtung #6/#7/#8/#9 (§1).
4. 🟢 Aufrufe-Tracking bauen (§3.1).

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).
