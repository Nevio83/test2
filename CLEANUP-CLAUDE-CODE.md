# CLEANUP — Überflüssige Dateien, Duplikate & toter Code (für Claude Code)

Stand: 2026-06-19. Nach der Migration auf **Render (Live) + Neon-Postgres**. Diese Liste sagt,
was weg/zusammengeführt werden kann. Vor dem Löschen committen, damit reversibel.

Live-URL: https://maios-shop.onrender.com · Repo: `Nevio83/test2` (nur Branch `main`).

---

## 1. 🔴 Sicher löschbar (tot / überflüssig)

| Datei | Warum |
|---|---|
| `indexoriginal.html` (135 KB) | Alte Kopie von `index.html`. Wird nirgends verlinkt. |
| `test-require.js` | Wegwerf-Test, lädt `sqlite3` — das Paket ist entfernt → bricht. Tote Datei. |
| `external-audit-review.txt` (26 KB) | Altes Audit, nennt **MongoDB/SQLite** (beides überholt). Durch `REVIEW-CLAUDE-*.md` ersetzt. |
| `netlify/` (ganzer Ordner) + `netlify.toml` | Alter Hosting-Pfad. Produktion läuft jetzt auf Render aus `server.js`. Enthält `create-checkout-session.js`, `cj-payment-calculator.js`, `test-server.js`, eigenes `package.json`. |
| `state.json` | 55 Bytes, unklarer/ungenutzter Zweck — prüfen, dann entfernen. |
| `setup-stripe-cj-split.js`, `setup-stripe-connect-simple.js` | Einmalige Stripe-Connect-Setups. Nach erfolgtem Setup nur noch Referenz → nach `scripts/` verschieben oder löschen. |

> Bereits weg (gut): `orders.db`, `test.db`, `database/`-Ordner — SQLite-Reste sind nach der
> Postgres-Migration entfernt. `*.db` ist in `.gitignore`.

## 2. 🟠 Duplikate zusammenführen

| Duplikat | Empfehlung |
|---|---|
| `cj-payment-calculator.js` (root) **und** `netlify/functions/cj-payment-calculator.js` | Identische Logik, doppelt gepflegt. Mit dem Entfernen von `netlify/` (siehe #1) löst sich das auf. Sonst in **ein** Modul. |
| `create-checkout-session`: Logik in `server.js` **und** `netlify/functions/create-checkout-session.js` | Zwei Checkout-Pfade, die auseinanderliefen (FX, Payment-Methoden). Mit Render ist `server.js` der einzige Pfad → Netlify-Version weg. |
| `products.json` (root) **und** `Marketing/products.json` | **Beabsichtigt** verschieden (Shop vs. Marketing). NICHT zusammenführen, nur dokumentieren. |
| `package.json` (root) **und** `netlify/functions/package.json` | Zweites fällt mit `netlify/` weg. |

## 3. 🟡 Toter / unnötiger Code

- **`server.js` – Auto-Retoure-Block** (`if (false && orderAge <= 14 …)`): ~80 Zeilen
  dauerhaft deaktiviert. Hinter ein Env-Flag (`RETURNS_AUTO_APPROVE`) legen oder entfernen.
- **`server.js` – `item.id === 1`-Sonderfall** im Checkout/Payment-Intent: Test-Altlast mit
  Hardcoded-Preis/Platzhalter `price_XXXX`. Im Checkout-Session-Pfad bereits entfernt; in
  `/api/create-payment-intent` (Z. ~720) noch vorhanden → prüfen/entfernen.
- **`server.js` – Replit-iframe-Middleware** (`X-Frame-Options: ALLOWALL`, CSP `frame-ancestors *`):
  Replit wird nicht mehr genutzt → entfernen (zugleich Clickjacking-Härtung, Review #8).
- **`server.js` – Legacy `/api/send-confirmation`** (SendGrid): SendGrid ist nicht initialisiert
  (`SENDGRID_API_KEY` fehlt, Resend ist aktiv) → toter Endpunkt, entfernen.
- **`@sendgrid/mail`** in `package.json`: ungenutzt (Mails laufen über Resend). Dependency raus.
- **`ai-chat-integration.js`**: inaktiv (Tawk.to-Platzhalter-IDs, OpenAI-Key clientseitig).
  Erst aktivieren, wenn Key serverseitig liegt — sonst belassen/entfernen.
- **`vite` / `vite-plugin-html`** in devDependencies: kein Build-Step im Einsatz → entfernen,
  oder echten Build einführen (siehe Performance-Empfehlung Review).

## 4. 🟡 Veraltete Doku angleichen

- `README.md`: nennt **MongoDB** + `mongod`-Schritte → real **PostgreSQL/Neon**. Setup-Teil neu.
- Drei überlappende Retouren-SOPs: `RETOUREN-AUTOMATISIERUNG.md`,
  `VOLLAUTOMATISCHE-RETOUREN.md`, `VOLLAUTOMATISCH-FERTIG.md` → auf **eine** Datei konsolidieren.
- `DEPLOYMENT.md` (alt, Netlify) vs. `DEPLOYMENT-RENDER.md` (aktuell) → alte entfernen/umleiten.

## 5. 🟢 Front-End-Fragmentierung (größeres Refactoring, optional)

- **CSS-Redundanz:** `styles.css` (215 KB) + `cart.css` (101 KB) + Tailwind-CDN (index) +
  Bootstrap (Produktseiten) — viel Overlap/Dead-CSS. Ein System wählen, Tokens zentralisieren
  (Details: `REVIEW-CLAUDE-DESIGNER.md` #1).
- **Farb-/Bundle-Logik** über viele Dateien verteilt (`color-image-selection.js`,
  `color-cart-bridge.js`, `bundle-images-final.js`, `cart-color-images-only.js`,
  `cart-color-selection-fix.css`) — funktioniert, ist aber fragmentiert. Bei Gelegenheit zu
  einer Komponente bündeln. **Reihenfolge-Abhängigkeit beachten** (siehe CLAUDE.md §8).

---

## Empfohlene Sofort-Aktion (geringes Risiko)

```bash
git rm indexoriginal.html test-require.js external-audit-review.txt state.json
git rm -r netlify
git rm netlify.toml DEPLOYMENT.md
# @sendgrid/mail, vite, vite-plugin-html aus package.json entfernen, dann:
npm install --package-lock-only
git add -A && git commit -m "cleanup: tote Dateien, Netlify-Altpfad, ungenutzte Deps entfernen"
```
> Danach `npm start` lokal testen (✅ Stripe + ✅ Postgres) und auf Render deployen.
> Punkte #3/#4/#5 sind eigene, größere Schritte — nicht im selben Commit.
