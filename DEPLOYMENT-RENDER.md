# DEPLOYMENT — Maios auf Render (persistenter Node-Host)

Diese Anleitung bringt den **kompletten** Shop (Frontend + API + Stripe-Webhook + SQLite +
CJ + Mails) auf **einen** persistenten Node-Service. Damit laufen Bestellspeicherung,
Belege, Mails und CJ-Bestellung in Produktion — was mit den Netlify-Functions nicht geht.

## Warum Render statt Netlify-Functions?

`server.js` schreibt in eine **SQLite-Datei** (`database/orders.db`) und legt PDF-Belege auf
der Platte ab. Serverless-Functions (Netlify/Lambda) haben **kein dauerhaftes Dateisystem** —
nach jedem Aufruf wäre die Bestelldatenbank weg. Außerdem braucht der Stripe-Webhook einen
stabilen, immer erreichbaren Endpunkt mit rohem Request-Body. Beides liefert ein **persistenter
Node-Host**. Render gewählt wegen einfachem Blueprint (`render.yaml`) + persistenter Disk.

> Bonus: Da `server.js` das Frontend selbst per `express.static` ausliefert, fällt die bisherige
> Zwei-Backend-Divergenz (Review #6) weg — eine Codebasis, ein Deploy.

## Vorbereitet im Repo (bereits erledigt)

- `render.yaml` — Blueprint: Web-Service + Disk `/data` + Env-Variablen.
- `database.js` — DB-Pfad jetzt über `SQLITE_DB_PATH` steuerbar (Default unverändert lokal).
- `package.json` — `engines.node = 18.x`.
- `server.js` — bindet bereits an `process.env.PORT` und `0.0.0.0` (Render-kompatibel).

## Voraussetzungen

- Repo bei GitHub/GitLab (Render zieht von dort).
- **Zuerst Secrets rotieren** (siehe `SECURITY-SOFORT.md`) — die alten Keys gelten als geleakt.
- Render-Account (render.com).

---

## Schritt 1 — Blueprint anlegen

1. Render Dashboard → **New** → **Blueprint**.
2. Repo `Maios` auswählen. Render liest `render.yaml` und schlägt den Service `maios-shop`
   mit Disk vor.
3. **Apply** klicken. Der Service wird erstellt (Build: `npm install`, Start: `npm start`).

> Persistente Disk = bezahlter Plan (Blueprint nutzt `plan: starter`). Ohne Disk wäre die
> SQLite-DB nach jedem Deploy leer.

## Schritt 2 — Secrets setzen

Im Service → **Environment** alle mit `sync: false` markierten Variablen füllen (echte,
**rotierte** Werte):

`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`CJ_STRIPE_ACCOUNT_ID`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CJ_API_KEY`,
`CJ_ACCESS_TOKEN`, `CJ_EMAIL`, `CJ_PASSWORD`, `EXCHANGE_RATE_API_KEY`, `SITE_URL`, `REPL_URL`.

`SQLITE_DB_PATH=/data/orders.db` und `NODE_VERSION` kommen schon aus dem Blueprint.

> `STRIPE_WEBHOOK_SECRET` setzt du erst in Schritt 4 final (kommt aus dem Stripe-Dashboard).

## Schritt 3 — Erst-Deploy & Smoke-Test

1. Deploy abwarten → Render gibt eine URL wie `https://maios-shop.onrender.com`.
2. Aufrufen: Startseite lädt? Produktseite? Warenkorb?
3. Test-Checkout im **Stripe-Testmodus** (Test-Keys verwenden), bis alles steht.

## Schritt 4 — Stripe-Webhook verbinden

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint-URL: `https://maios-shop.onrender.com/stripe-webhook`
3. Events: mindestens `checkout.session.completed` (optional `payment_intent.succeeded`).
4. Den angezeigten **Signing secret** (`whsec_…`) als `STRIPE_WEBHOOK_SECRET` in Render
   eintragen → Service neu deployen.
5. In Stripe „Send test event" → in den Render-Logs muss die Bestellung verarbeitet werden
   (DB-Eintrag, Mail, CJ). Kein „No signatures found…" mehr (Body-Parser-Fix ist drin).

## Schritt 5 — Domain umstellen

1. Render → Service → **Settings → Custom Domains** → `maiosshop.com` (+ `www`) hinzufügen.
2. Beim Domain-Provider die von Render genannten DNS-Einträge setzen.
3. `SITE_URL`/`REPL_URL` auf die finale Domain setzen.
4. Netlify kann danach abgeschaltet werden (oder nur als Redirect bleiben).

---

## Nacharbeiten / Hinweise

- **PDF-Belege:** `receipt-generator.js` schreibt nach `receipts/` (ephemer auf Render). Für
  dauerhafte Ablage entweder auch auf die Disk legen (z.B. `RECEIPTS_PATH=/data/receipts`)
  oder in S3/Cloud-Storage. Unkritisch, da Belege per Mail rausgehen.
- **Backups:** Render-Disk regelmäßig sichern (z.B. `orders.db` per Cron kopieren) oder
  langfristig auf eine gehostete DB (Postgres) migrieren.
- **Marketing/** (Python) läuft NICHT auf diesem Web-Service — separat betreiben.
- **netlify/** + `netlify.toml`: nach der Migration entfernen oder ignorieren, damit nicht
  zwei Checkout-Pfade gepflegt werden (Review #6).

## Alternative Hosts (gleiches Prinzip)

- **Railway** / **Fly.io**: ebenfalls persistente Volumes; `SQLITE_DB_PATH` auf den Volume-
  Mount zeigen, Start `npm start`, Webhook-URL analog. Render hier nur wegen Blueprint-Komfort.

> Bezug: `REVIEW-CLAUDE-CODE.md` #4 (Prod-Bereitstellung) und #6 (Backend-Konsolidierung).
