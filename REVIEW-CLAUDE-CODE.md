# REVIEW · Claude Code — Fehler, Risiken & Verbesserungen

Tiefgründiger Code-, Sicherheits- und Architektur-Review des Maios-Shops.
Stand: 2026-06-18. Geprüft: `server.js`, `database.js`, `cj-dropshipping-api.js`,
`netlify/functions/*`, `ai-chat-integration.js`, `exchange-rate-service.js`, Configs,
Git-Status, Frontend-Loader.

**Prioritäten:** 🔴 kritisch (sofort) · 🟠 hoch · 🟡 mittel · 🟢 niedrig/Aufräumen.
Empfehlung: 🔴 zuerst, dann 🟠. Geschätzte Reihenfolge unten in §0.

---

## 0. Sofort-Reihenfolge (TL;DR)

1. 🔴 Secrets aus Git entfernen **und rotieren** (#1) — `.gitignore`/`.env.example` erledigt, Rest im Terminal (`SECURITY-SOFORT.md`).
2. ✅ Preis-Manipulation im Checkout geschlossen (#2) — `price-validator.js`, beide Pfade.
3. ✅ Webhook-Body-Parser-Konflikt behoben (#3). 🔴 Offen: Webhook/API in Prod bereitstellen (#4).
4. 🟠 Render-Deploy durchführen + Stripe-Webhook-URL setzen (#4 — `DEPLOYMENT-RENDER.md`).
5. ✅ Auth für Admin-/Receipt-/CJ-Endpunkte (#5 — Basic Auth, `ADMIN_PASSWORD` setzen).
6. 🟠 Nach Migration: Netlify-Checkout entfernen (#6 erledigt sich mit #4).
6. Danach 🟡/🟢 abarbeiten.

---

> **Status (2026-06-18):** ✅ `.gitignore`/`.env.example` gefixt; ✅ `.env`+`Marketing/.env`
> untrackt und Commit „fix 1" auf `main` (GitHub Desktop). **Offen & wichtig:** Secrets sind
> noch in der **Git-History** auf GitHub (`origin/main`) → History-Purge (`git filter-repo`)
> + **Key-Rotation** stehen aus. Schritte: `SECURITY-SOFORT.md` / `GITHUB-UPDATE.md`.

## 1. 🔴 Secrets sind in Git eingecheckt

**Befund:** `git ls-files` listet `.env` **und** `Marketing/.env`. `.gitignore` enthält nur
`.netlify` und `node_modules` — **nicht** `.env`. Die `.env` enthält u. a. `STRIPE_SECRET_KEY`,
`RESEND_API_KEY`, CJ-Zugangsdaten, `SESSION_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`.
Zusätzlich getrackt: `database/orders.db`, `test.db`, `Marketing/data/trends.db`,
`__pycache__/*.pyc`.

**Risiko:** Jeder mit Repo-Zugriff (oder bei öffentlichem Repo: jeder) hat Live-Schlüssel →
Zahlungsbetrug, Mailversand-Missbrauch, Datenabfluss.

**Maßnahmen:**
- **Alle Schlüssel sofort rotieren** (Stripe, Resend, CJ, ExchangeRate, selbst gesetzte Secrets).
- `.gitignore` erweitern:
  ```gitignore
  .env
  .env.*
  !.env.example
  Marketing/.env
  *.db
  **/__pycache__/
  graphify-out/
  .vscode/
  ```
- Aus dem Git-**Verlauf** entfernen (nicht nur aus HEAD): `git filter-repo` oder BFG; danach
  force-push und alle Klone neu ziehen.
- `.env.example` mit Platzhaltern bereitstellen (Marketing hat schon eins; fürs Root anlegen).
- DB-Dateien nicht versionieren; nur Schema (`database.js`) bleibt im Repo.

---

> **Status (2026-06-18): ✅ ERLEDIGT.** `price-validator.js` angelegt; `server.js` und
> `netlify/functions/create-checkout-session.js` validieren den Warenkorb jetzt server-
> seitig gegen `products.json` (Basis-/Farb-/Bundle-Preise erlaubt, Rest → Basispreis,
> unbekannte Produkte abgelehnt, Mengen gesäubert). Getestet. **Rest-Todo:** Währungs-
> umrechnung in der Netlify-Function (rechnet EUR noch direkt in Cents → siehe #6) und die
> Route `/api/create-payment-intent` in `server.js` (nutzt noch `item.price` direkt).

## 2. 🔴 Preis-Manipulation im Checkout (Netlify)

**Datei:** `netlify/functions/create-checkout-session.js`, Z. 150–163.
```js
const line_items = cart.map(item => {
  const amountInCents = Math.round(item.price * 100);   // <-- Client-Preis!
  return { price_data: { currency, product_data:{name:item.name}, unit_amount: amountInCents }, quantity:item.quantity };
});
```
Der Warenkorb kommt aus `localStorage` (clientseitig manipulierbar). Die Function übernimmt
`item.price` **ungeprüft** als Stripe-Betrag. Ein Angreifer setzt `price: 0.01` und kauft alles
für Cent-Beträge. `server.js` rechnet zwar Währung um, übernimmt aber ebenfalls `item.price`
als Basis — gleiches Grundproblem.

**Fix:** Preise **serverseitig** aus `products.json` (bzw. DB) anhand `item.id` nachschlagen und
**nur** Menge/ID vom Client akzeptieren:
```js
const catalog = require('../../products.json');
const line_items = cart.map(item => {
  const p = catalog.find(x => Number(x.id) === Number(item.id));
  if (!p) throw new Error(`Unbekanntes Produkt ${item.id}`);
  return { price_data:{ currency, product_data:{name:p.name}, unit_amount: Math.round(p.price*100) }, quantity: Math.max(1, parseInt(item.quantity)||1) };
});
```
Zusätzlich Mengen validieren (Integer > 0, Obergrenze). Rabatt-`percent` ebenfalls server-
seitig gegen erlaubte Gutscheine prüfen, nicht aus dem Request glauben.

---

> **Status (2026-06-18): ✅ ERLEDIGT (Code).** In `server.js` ist der Raw-Body-Parser jetzt
> **vor** `express.json()` registriert (`app.use('/stripe-webhook', express.raw(...))`), das
> doppelte `express.json()` ist entfernt. `node --check` grün. Signaturprüfung funktioniert
> damit lokal. **Bleibt offen: #4** (Webhook muss in Produktion überhaupt erst bereitstehen).

## 3. 🔴 Stripe-Webhook-Signatur bricht (Body-Parser-Konflikt)

**Datei:** `server.js`. Global registriert: `app.use(express.json())` (sogar **doppelt**,
Z. 115 und Z. 129). Der Webhook nutzt `express.raw(...)` (Z. 439), aber `express.json()` läuft
als globale Middleware **vorher** und konsumiert/parst den Body. `stripe.webhooks.constructEvent`
braucht den **rohen** Buffer → Signaturprüfung schlägt fehl bzw. wirft.

**Fix:** Raw-Body **vor** `express.json()` und nur für die Webhook-Route:
```js
app.post('/stripe-webhook', express.raw({type:'application/json'}), webhookHandler);
app.use(express.json());   // erst danach global
```
Und das doppelte `app.use(express.json())` entfernen.

---

> **Status (2026-06-18): Lösung vorbereitet (Variante B).** `render.yaml` (persistenter Node-
> Service + Disk), `database.js` (DB-Pfad via `SQLITE_DB_PATH`) und `package.json` (`engines`)
> sind eingerichtet; Schritt-für-Schritt in `DEPLOYMENT-RENDER.md`. **Offen:** tatsächliches
> Deploy + Stripe-Webhook-URL setzen (musst du im Render-/Stripe-Dashboard machen).

## 4. 🔴 Webhook & halbe API existieren in Produktion nicht

**Befund:** `netlify.toml` leitet **alle** `/api/*` an Netlify Functions, aber dort liegen nur
`create-checkout-session` und `cj-payment-calculator`. Es gibt **keine** Function für
`/stripe-webhook`, `/api/receipt/*`, `/api/cj/*`, `/api/contact`, `/api/return-request`.

**Folge:** In Produktion werden Bestellungen **nicht** in die DB geschrieben, **keine**
Belege/Mails erzeugt, **keine** CJ-Bestellung ausgelöst, Kontakt-/Retouren-Formulare laufen ins
Leere (404/SPA-Fallback). Der komplette Post-Payment-Flow aus `server.js` ist live tot.

**Optionen:**
- **A (empfohlen):** Express-App über `serverless-http` als **eine** Netlify-Function mounten,
  Webhook als eigene Function mit Raw-Body. Dann läuft derselbe Code lokal und in Prod.
- **B:** Persistente Node-Plattform nutzen (Render/Railway/Fly) und `server.js` direkt
  betreiben; Netlify nur fürs statische Frontend.
- Stripe-Webhook-URL im Dashboard entsprechend setzen; `STRIPE_WEBHOOK_SECRET` in Netlify-Env.

---

> **Status (2026-06-18): ✅ ERLEDIGT.** HTTP-Basic-Auth-Middleware (`requireAdminAuth`) in
> `server.js`: schützt den Admin-Ordner `/a29715347575`, **alle** `/api/cj/*` und die Admin-
> Routen unter `/api/receipt/*`. Öffentlich bleiben bewusst: `POST /api/receipt/create`
> (Checkout) sowie die Kunden-Tracking-Lookups `GET /api/receipt/order/:id` und
> `GET /api/receipt/orders/email/:email`. Zugang via `ADMIN_USER`/`ADMIN_PASSWORD` (ENV);
> ohne gesetztes Passwort verweigert die Middleware den Zugriff. Pfad- und Auth-Logik getestet.
> **Hinweis:** Browser fragt beim Öffnen des Dashboards einmal nach Login; die Fetch-Aufrufe
> tragen die Zugangsdaten danach automatisch (same-origin) — keine Frontend-Änderung nötig.
> **Follow-up (optional):** echtes Session-/JWT-Login mit `SESSION_SECRET` statt Basic Auth.

## 5. 🟠 Keine Authentifizierung für Admin- & Daten-Endpunkte

**Befund:** Admin-Dashboards liegen unter `a29715347575/` (Security-by-Obscurity). Die
genutzten Endpunkte `/api/receipt/orders`, `/api/receipt/statistics`, diverse `/api/cj/*`
(Balance, Orders, Disputes) sind in `server.js` **ohne Auth** erreichbar. Damit sind
Kundendaten (Namen, Mails, Adressen, Umsätze) und CJ-Kontostand offen abrufbar, sobald der
Server erreichbar ist.

**Fix:** Auth-Middleware (mind. Token/Basic-Auth, besser Session/JWT mit `SESSION_SECRET`,
das ohnehin in `.env` steht) vor alle `/api/receipt/*`, `/api/cj/*` und Admin-Routen hängen.
CORS nicht pauschal `*` (siehe #8).

---

> **Status (2026-06-18): Weg gewählt.** Mit dem Render-Deploy (#4) bedient **ein** Service
> Frontend + API aus `server.js` → die Netlify-Function entfällt, sobald migriert. Bis dahin
> beide Pfade synchron halten (Preisvalidierung ist bereits in beiden, #2).

## 6. 🟠 Zwei divergierende Checkout-Implementierungen

**Befund:** `server.js` und `netlify/functions/create-checkout-session.js` unterscheiden sich in:
Währungsumrechnung (server: via `exchange-rate-service`; netlify: keine), Payment-Methoden
(server: `['card']` + automatic_payment_methods; netlify: `['card','link','paypal']`),
CJ-Split (server: aktiv; netlify: deaktiviert), Erfolgs-/Abbruch-URLs (`REPL_URL` vs `URL`).

**Folge:** Verhalten lokal ≠ Verhalten live; Bugs sind schwer reproduzierbar.

**Fix:** Gemeinsame Logik in **ein** Modul (z. B. `lib/checkout.js`) auslagern, das beide
Einstiegspunkte importieren. Idealerweise mit #4-Option A komplett zusammenführen.

---

## 7. 🟠 Doppelte/überschriebene `payment_intent_data` (Datenverlust)

**Datei:** `server.js`, `sessionConfig`. Der Schlüssel `payment_intent_data` wird im selben
Objekt-Literal **zweimal** gesetzt (≈ Z. 297 mit `setup_future_usage:'on_session'` + Metadaten,
und erneut ≈ Z. 332 mit `setup_future_usage:'off_session'`). In JS gewinnt die **letzte**
Definition → die erste (inkl. `order_id`/`shop_domain`-Metadaten) geht verloren, noch bevor der
spätere Spread-Merge (Z. 355) greift. Inkonement und fehleranfällig.

**Fix:** `payment_intent_data` **einmal** definieren, danach gezielt erweitern.
Linter mit `no-dupe-keys` aktivieren (hätte das gefangen).

---

## 8. 🟠 CORS/Header zu offen + Clickjacking

**Datei:** `server.js`, Z. 83–143. Es gibt eine Allowlist, der Fallback setzt aber
`Access-Control-Allow-Origin: '*'`. Direkt danach setzt eine zweite Middleware erneut hart
`'*'` für alle Routen, plus `X-Frame-Options: ALLOWALL` und
`Content-Security-Policy: frame-ancestors *`. Damit ist die Allowlist wirkungslos und die Seite
in fremde iframes einbettbar (Clickjacking; relevant fürs Checkout).

**Fix:** Eine einzige CORS-Schicht mit echter Allowlist (kein `*` bei Cookies/Auth),
`X-Frame-Options: SAMEORIGIN`, restриktive CSP. Replit-spezifische iframe-Header entfernen,
falls nicht mehr auf Replit gehostet.

---

## 9. 🟠 Toter Code in der Retouren-Auto-Genehmigung

**Datei:** `server.js`, Z. 830: `if (false && orderAge <= 14 && …)`. Der gesamte
Auto-Approve-/Auto-Refund-/CJ-Retoure-Block ist dauerhaft deaktiviert (~80 Zeilen). Laut SOP
gewollt (manuelle Freigabe), aber als `if(false)` ein Wartungsrisiko.

**Fix:** Hinter ein **Env-Flag** legen (`RETURNS_AUTO_APPROVE=false`) statt `if(false)`, oder
den Block entfernen und in `RETOUREN-AUTOMATISIERUNG.md` dokumentieren. So bleibt die Absicht
klar und reaktivierbar.

---

## 10. 🟠 OpenAI-Key-Leak-Risiko im Client-Chat

**Datei:** `ai-chat-integration.js`. `getAIResponse()` ruft `api.openai.com` direkt aus dem
Browser mit `Authorization: Bearer ${this.apiKey}`. Wird der Key clientseitig gesetzt, ist er
**öffentlich** sichtbar. Aktuell durch Platzhalter-IDs inaktiv — aber ein scharfer Key wäre
sofort kompromittiert. Außerdem `data.choices[0].message.content` ohne Null-Check (crasht bei
API-Fehlern/Rate-Limit).

**Fix:** OpenAI nur **serverseitig** aufrufen (Proxy-Endpoint), Key nie ins Frontend. Antwort
defensiv parsen (`data?.choices?.[0]?.message?.content ?? fallback`).

---

## 11. 🟡 Robustheit & Konsistenz Backend

- **`server.js` MwSt.-Berechnung** (`/api/receipt/create`, Z. ~1329): Steuer wird aus
  `subtotal + shippingCost` als Brutto extrahiert (19 %). Prüfen, ob Versand steuerlich so
  gewollt ist; Rundungsdifferenzen zu Stripe möglich.
- **`item.id === 1` Sonderfall** (Checkout, Z. 249/720) mit Platzhalter
  `price_XXXXXXXXXXXX` und `10.00 * quantity` — wirkt wie Test-Altlast. Entfernen, sonst kann
  ein Item mit `id:1` einen Hardcoded-Preis ziehen.
- **`Math.random().toString(36).substr(2,9)`** für Order-IDs: `substr` ist deprecated,
  Kollisionsrisiko gering aber vorhanden. `crypto.randomUUID()` nutzen (uuid ist schon dep).
- **`database.js`**: `db.parallelize` für `CREATE TABLE`/`CREATE INDEX`, die FKs voraussetzen —
  Reihenfolge nicht garantiert. `db.serialize` ist bereits außen; das innere `parallelize`
  entfernen. FK-Enforcement ist in SQLite default **aus** → `PRAGMA foreign_keys = ON` setzen.
- **`exchange-rate-service.js`**: Fällt bei API-Ausfall hoffentlich auf 1:1 zurück — prüfen,
  dass keine falsche Währung mit Faktor 1 berechnet wird (sonst Preisfehler). Kurse cachen mit TTL.
- **Fehler-Responses** geben teils `details: err.message` an den Client zurück (Stack-/Intern-
  Infos). In Produktion generische Meldung, Details nur ins Log.

---

## 12. 🟡 Performance

- **Riesige, ungebündelte Assets:** `styles.css` 219 KB, `app.js` 192 KB, `index.html` 165 KB,
  `cart.js`/`cart.css` ~100 KB, `bundle-images-final.js` 66 KB. Alles unminifiziert, einzeln.
  → Build-Step (Vite ist schon devDep) für Minify/Bundle/Tree-Shaking; HTTP-Caching aktivieren
  (aktuell `Cache-Control: no-cache` für **alle** statischen Dateien — gut für Dev, schlecht für
  Prod). 139 JPGs + 22 PNGs unoptimiert → WebP/AVIF + `loading="lazy"`.
- **`products.json` 64 KB** wird mehrfach per `fetch` mit Cache-Buster geladen (u. a. in
  `cart.js getCartItemImage` pro Artikel erneut!). → Einmal laden, im Speicher halten.
- **`fetch('products.json')` in Schleifen** (Bild-Auflösung) erzeugt N Requests pro Render.
- **~1028 `console.*`-Aufrufe** in 29 Dateien (z. B. `app.js` 373, `server.js` 122). In Prod
  über ein Log-Level/`LOG_LEVEL` dämpfen; Frontend-Logs hinter `if (DEBUG)`.

---

## 13. 🟡 Fehlende Tests / CI / Tooling

- Nur manuelle `test-*.js`-Skripte, kein Test-Runner, keine Assertions, keine CI.
  → Mindestens Smoke-Tests für `cj-payment-calculator` (Split-Mathematik), `shipping-calculator`,
  `getCurrencyByCountry`, und einen Webhook-Signatur-Test mit Stripe-CLI.
- Kein Linter/Formatter. → ESLint (`no-dupe-keys`, `no-unused-vars`, `no-undef`) + Prettier.
- `package.json`: `"name": "marktplatz"` (generisch), kein `engines`-Feld (Node-Version nur in
  `.nvmrc`). `"main": "server.js"`, aber Prod nutzt Netlify Functions — irreführend.

---

## 14. 🟢 Aufräumen / Hygiene

- Altlasten löschen/zusammenführen: `indexoriginal.html`, `orders.db` + `test.db` im Root,
  `__pycache__/`, doppelter `cj-payment-calculator.js` (root vs. netlify) → in ein gemeinsames
  Modul.
- `README.md` korrigieren: nennt **MongoDB** + `mongod`-Schritte, real ist **SQLite**. Auch
  `external-audit-review.txt` §8 erbt diesen Fehler. Setup-Schritte an Realität angleichen.
- Produktnummerierung hat Lücken (`produkt-30`, `-49`, `-51` fehlen) — prüfen, ob beabsichtigt
  und ob `products.json` dazu konsistent ist.
- Geheimer Admin-Ordnername `a29715347575` durch echte Auth ersetzen (siehe #5), dann sprechenden
  Pfad nutzen.
- `graphify-out/` (falls Graphify genutzt) in `.gitignore`.

---

## 15. Schnell-Checkliste

| # | Prio | Thema | Datei |
|---|---|---|---|
| 1 | 🔴 | Secrets in Git → rotieren + untracken | `.env`, `Marketing/.env`, `.gitignore` |
| 2 | ✅ | Client-Preis → server-seitig validiert (`price-validator.js`) | erledigt; FX-Rest siehe #6 |
| 3 | ✅ | Webhook Raw-Body vor `express.json` + Dupe entfernt | `server.js` (erledigt) |
| 4 | 🟠 | Webhook/API in Prod bereitstellen — vorbereitet (`render.yaml`, Doku), Deploy offen | `DEPLOYMENT-RENDER.md` |
| 5 | ✅ | Auth für Admin/Receipt/CJ-Routen (Basic Auth) | `server.js` (erledigt) |
| 6 | 🟠 | Zwei Checkouts konsolidieren | `server.js` + Netlify-Function |
| 7 | 🟠 | Doppelter `payment_intent_data`-Key | `server.js` |
| 8 | 🟠 | CORS/CSP/X-Frame härten | `server.js` |
| 9 | 🟠 | `if(false)`-Retouren-Block → Env-Flag | `server.js` |
| 10 | 🟠 | OpenAI-Key nicht im Client | `ai-chat-integration.js` |
| 11 | 🟡 | Backend-Robustheit (FK-Pragma, IDs, MwSt., Fehlertexte) | `database.js`, `server.js` |
| 12 | 🟡 | Performance (Bundle/Bilder/Cache/Logs) | Frontend gesamt |
| 13 | 🟡 | Tests + Lint + CI | Projektweit |
| 14 | 🟢 | Aufräumen + README-Fix | diverse |

> Tipp: Vor dem Refactoring `/graphify .` laufen lassen — der Call-Flow-Graph macht die
> Backend-Divergenz (#4/#6) und die Skript-Abhängigkeiten sichtbar, ohne die Großdateien
> komplett zu lesen.
