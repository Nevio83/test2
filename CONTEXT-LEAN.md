# CONTEXT-LEAN.md — Token-Spar-Modus für Maios

Zweck: maximale Wirkung pro Token. Lies **diese** Datei statt großer Dateien, wenn du nur
Orientierung brauchst. Vollversion: `CLAUDE.md`.

---

## Regeln (für den Agenten)

1. **Graphify zuerst.** Bei „wo ist X / wer ruft Y / Abhängigkeiten" → `graph.json`
   abfragen statt grep durch 19k Zeilen. Bauen: `/graphify .` (PowerShell: `graphify .`).
2. **Nie ganze Großdateien lesen.** `app.js` 192 KB, `cart.js`/`cart.css` ~100 KB,
   `styles.css` 219 KB, `index.html` 165 KB, `products.json` 64 KB. Immer gezielt:
   `Grep` mit Pattern + `Read` mit `offset/limit`. Nur die relevante Funktion holen.
3. **Antworten knapp.** Kein Vorgeplänkel, keine Wiederholung der Aufgabe, keine
   Datei-für-Datei-Nacherzählung. Ergebnis + Diff genügt.
4. **Keine Voll-Dumps.** Tool-Ausgaben nicht zwischenkommentieren; Befund am Ende bündeln.
5. **Bei Routine-Kommunikation** Caveman-Skill nutzen (`/caveman`) → ~75 % weniger Tokens
   bei gleicher technischer Genauigkeit.
6. **Plane mit dieser Datei**, lade Detail nur bei Bedarf nach.

---

## Projekt in 12 Zeilen

- Deutscher E-Commerce-/Dropshipping-Shop „Maios".
- Stack: Express (`server.js`) + Vanilla JS Frontend + SQLite (`database.js`); Hosting Netlify.
- Zahlungen Stripe · Lieferant CJ Dropshipping · Mails Resend · PDF PDFKit · FX ExchangeRate-API.
- **Quelle der Produktwahrheit:** `products.json` (id, price EUR, sku, colors, bundles).
- **Frontend-State:** Warenkorb/Wishlist in `localStorage`. Mehrwährung clientseitig.
- **Zwei Backends, divergent:** `server.js` (lokal, voll) vs. `netlify/functions/` (prod, nur
  Checkout + Payment-Calc). `netlify.toml` leitet `/api/*` → Functions. → Webhook/DB/CJ/Mail
  laufen **live nicht**. Vor Checkout-Edits beide prüfen.
- Produktseiten `produkte/produkt-10..50.html` (Bootstrap). Startseite `index.html` (Tailwind).
- Bild-Konvention: `produkt bilder/<Name> bilder/<Name> <farbe>.jpg` — 1:1 zu `products.json`.
- SKUs mit `ALI…` werden außer auf Produkt-URLs gefiltert (`app.js`).
- Retouren: **manuelle** Freigabe (Auto-Approve via `if(false&&…)` deaktiviert).
- Skript-Reihenfolge: `app.js` → `cart.js` → Feature-Skripte; nur **ein** `app.js`-Include.
- Sprache überall Deutsch; Log-Emojis (✅⚠️❌) sind Standard.

---

## Wichtigste Schnell-Pfade

| Aufgabe | Datei(en) | Hinweis |
|---|---|---|
| Checkout/Zahlung | `server.js` + `netlify/functions/create-checkout-session.js` | beide synchron halten |
| DB-Schema/Queries | `database.js` | kein Migrationssystem |
| CJ-Bestellung/Tracking | `cj-dropshipping-api.js`, `cj-fallback-system.js` | Fallback aktiv |
| Preis-Split/Gewinn | `cj-payment-calculator.js` (×2: root + netlify) | dupliziert |
| Belege/PDF | `receipt-generator.js` | + `pdf`-Skill |
| Mails | `resend-service.js` | Resend |
| Wechselkurs | `exchange-rate-service.js` | gecacht |
| Warenkorb-UI | `cart.js`, `cart.css`, `cart-color-images-only.js` | Bootstrap |
| Farbvarianten | `color-image-selection.js`, `color-cart-bridge.js`, `bundle-images-final.js` | Reihenfolge! |
| Gutscheine | `gutschein-system.js` | localStorage |
| Admin | `a29715347575/` | keine echte Auth |

---

## Offene Top-Risiken (Details: REVIEW-CLAUDE-CODE.md)

1. 🔴 `.env` + `Marketing/.env` in Git (Live-Keys). `.gitignore`/`​.env.example` gefixt; Rest
   (untracken, History-Rewrite, **Rotation**) → `SECURITY-SOFORT.md` im Terminal ausführen.
2. ✅ Preis-Manipulation geschlossen: `price-validator.js` prüft Warenkorb gegen `products.json`
   (in `server.js` + Netlify-Function). Rest: FX-Umrechnung in der Netlify-Function (#6).
3. ✅ Webhook-Signaturfix in `server.js`. Prod-Deploy vorbereitet (Render: `render.yaml`,
   `SQLITE_DB_PATH`, `DEPLOYMENT-RENDER.md`). 🟠 Offen: tatsächliches Deploy + Webhook-URL.
4. ✅ Admin/`/api/cj`/Admin-`/api/receipt` per Basic Auth geschützt (`ADMIN_USER`/`ADMIN_PASSWORD`).
   Öffentlich bleiben Checkout + Kunden-Tracking-Lookups.
5. 🟠 README/Doku nennt MongoDB statt SQLite.

---

## Befehle (Kurz)

```bash
npm run dev            # lokal
npm start              # prod-server
npm run test-cj-api    # CJ test
/graphify .            # Knowledge-Graph bauen -> graphify-out/
/caveman               # Token-Sparmodus an
```
