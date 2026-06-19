# DEPLOYMENT — Maios auf Render (Free) + Neon-Postgres (dauerhaft, kostenlos)

Kompletter Shop (Frontend + API + Stripe-Webhook + CJ + Mails) auf **einem** Render-Service,
Bestelldaten dauerhaft in einer **kostenlosen Neon-Postgres-DB**. Damit laufen Bestell-
speicherung, Belege, Mails und das Admin-Dashboard live — und die Daten bleiben erhalten.

## Warum dieses Setup?

- **Render Web Service (Free):** keine Kreditkarte. Trade-off: schläft nach ~15 Min Inaktivität
  (erster Aufruf danach ~1 Min). Reicht zum Start.
- **Neon-Postgres (Free):** läuft **dauerhaft** (anders als Renders eigene Free-DB, die nach
  30 Tagen gelöscht wird). 0,5 GB Speicher gratis, keine Karte.
- `server.js` liefert das Frontend selbst aus → keine Zwei-Backend-Divergenz.

## Vorbereitet im Repo (erledigt)

- `database.js` — auf **Postgres (`pg`)** umgestellt, verbindet über `DATABASE_URL`. Getestet.
- `package.json` — `sqlite3` raus, `pg` rein (kein nativer Build mehr → robuster Deploy).
- `render.yaml` — Free-Plan, Env inkl. `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`.
- `server.js` — bindet an `process.env.PORT`/`0.0.0.0` (Render-kompatibel).

---

## Schritt 1 — Neon-Datenbank anlegen (kostenlos)

1. Auf [neon.tech](https://neon.tech) mit GitHub anmelden (keine Karte).
2. **Create project** → Region z.B. Frankfurt/Europe → erstellen.
3. Im Dashboard den **Connection string** kopieren (Format:
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).
   Das ist dein **`DATABASE_URL`**.

## Schritt 2 — Code committen & pushen

Die DB-Umstellung muss ins Repo, damit Render sie deployt (GitHub Desktop):
- Geänderte Dateien (`database.js`, `package.json`, `render.yaml`) → Commit „postgres/neon" →
  **Push origin**.

## Schritt 3 — Render-Service + Env

- Falls noch nicht geschehen: render.com → **New + → Blueprint** → Repo `test2` → Apply
  (Free-Plan, keine Karte).
- Im Service → **Environment** setzen:
  - **`DATABASE_URL`** = der Neon-String aus Schritt 1.
  - `ADMIN_USER=nevio`, `ADMIN_PASSWORD=932571294lslfrjsnas`.
  - Stripe/Resend/CJ/ExchangeRate-Keys (`sync:false`-Felder), `SITE_URL`, `REPL_URL`.
- Deploy starten/abwarten.

## Schritt 4 — Test

- Render-URL öffnen (z.B. `https://maios-shop.onrender.com`): Startseite + Produktseite.
- Dashboard `…/a29715347575/orders.html` → Login `nevio` / dein Passwort.
- In den Render-**Logs** muss stehen: `✅ Datenbank initialisiert (Postgres)`.
- Testbestellung im **Stripe-Testmodus** → danach erscheint sie im Dashboard und **bleibt**
  auch nach einem Redeploy erhalten (das war das Ziel).

## Schritt 5 — Stripe-Webhook

- Stripe → Developers → Webhooks → Endpoint `https://<render-url>/stripe-webhook`,
  Event `checkout.session.completed`. Das `whsec_…` als `STRIPE_WEBHOOK_SECRET` in Render →
  neu deployen.

## Schritt 6 — Domain (optional, zuletzt)

- Render → Settings → Custom Domains → `maiosshop.com` + DNS-Einträge setzen.
- `SITE_URL`/`REPL_URL` auf die finale Domain.

---

## Lokal entwickeln

Dieselbe `DATABASE_URL` (Neon) in die `.env` eintragen, dann:
```bash
npm install     # installiert pg
npm start
```
`http://localhost:3000` — nutzt dieselbe dauerhafte DB wie live.

## Hinweise

- **PDF-Belege** (`receipt-generator.js` → `receipts/`) sind auf dem Free-Plan ephemer;
  unkritisch, da Belege per Mail rausgehen. Für dauerhafte Ablage später S3 o.ä.
- **Marketing/** (Python) läuft separat, nicht auf diesem Web-Service.
- **netlify/** + `netlify.toml`: nach der Migration entfernen/ignorieren (eine Codebasis).
