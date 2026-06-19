# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-20 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
auf Apex) + Fallback `https://maios-shop.onrender.com` · Repo `Nevio83/test2` (nur `main`)
· DB: Neon-Postgres · Hosting: Render (Free).

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig/optional.

> Hier stehen nur **offene** Aufgaben — Erledigtes wird entfernt.

---

## 1. Offene Code-Themen (Bugs/Sicherheit/Performance)

| # | Prio | Thema | Datei(en) |
|---|---|---|---|
| 3 | 🟠 | **Stripe-Webhook-URL** im Stripe-Dashboard auf `https://maiosshop.com/stripe-webhook` zeigen lassen (sonst landen Bestellungen nicht in der DB) | Stripe-Dashboard |
| 9 | 🟠 | OpenAI-Key nicht im Client (`ai-chat-integration.js`) → serverseitiger Proxy; Antwort defensiv parsen | `ai-chat-integration.js` |
| 10 | 🟡 | Robustheit: MwSt.-Berechnung prüfen; `crypto.randomUUID()` statt `substr`; Fehler-Responses ohne interne Details | `server.js`, `database.js` |
| 11 | 🟡 | Performance: Assets unminifiziert/ungebündelt (styles.css ~215 KB, app.js ~190 KB), Bilder unoptimiert (WebP/lazy), `products.json` mehrfach pro Render gefetcht, ~1000 `console.*` → Log-Level | Frontend gesamt |
| 12 | 🟡 | Tests/CI/Lint fehlen: ESLint (`no-dupe-keys`!), Prettier, Smoke-Tests (Split-Mathematik, Webhook-Signatur) | Projektweit |

---

## 2. Restliches Aufräumen (toter Code / Docs)

**Toter Code (prüfen & entfernen):**
- Legacy-Endpunkt `/api/send-confirmation` (alter SendGrid-Pfad, Mails laufen über Resend).
- `item.id===1`-Altlast in `/api/create-payment-intent`.

**Veraltete Docs:**
- `README.md` nennt noch MongoDB → real Postgres/Neon (Banner/Update setzen).
- Drei Retouren-SOPs (`RETOUREN-AUTOMATISIERUNG.md`, `VOLLAUTOMATISCHE-RETOUREN.md`,
  `VOLLAUTOMATISCH-FERTIG.md`) → auf eine konsolidieren.

> **Nicht zusammenführen:** `products.json` (root) vs. `Marketing/products.json` sind
> **beabsichtigt** verschieden.

---

## 3. Ausbau-Ideen (Admin-Dashboard & Shop)

Alle neuen Daten → Neon-Postgres (`database.js` `SCHEMA` + `dbOperations`). Admin-Endpunkte
hinter der Admin-Auth — Analytics-Routen liegen bewusst unter `/a29715347575/api/...` (gleicher
authentifizierter Pfad-Teilbaum wie das Dashboard, damit der Browser Basic-Auth zuverlässig mitsendet).

**1. Umsatz/Conversion:** Conversion-Rate (Views→Orders — `page_views` ist jetzt da!),
Umsatz-Charts Tag/Woche/Monat, Top-Produkte (aus `order_items`), AOV.

**2. Bestell-Workflow:** Suche/Filter (E-Mail, Nr., Status, Zeitraum), CSV-/Excel-Export,
Tracking-Spalte (`order_tracking` + `cjAPI.getTrackInfo`), Retouren-Übersicht (Tabelle `returns`),
Live-Benachrichtigung bei neuer Bestellung.

**3. Betrieb:** CJ-Lagerbestand/Stock-Warnungen, CJ-Status automatisch nachziehen,
Warenkorb-Abbrüche messen.

**4. Aufrufe-Tracking erweitern** (Basis steht, siehe unten): Bot-Filter, Verweildauer,
Referrer-Auswertung, Tages-/Stunden-Heatmap.

Datenschutz: Cookie-/Tracking-Hinweis in `infos/cookies.html`/Datenschutz prüfen
(Tracking speichert keine rohe IP, nur Land + Session-ID aus `sessionStorage`).

---

## 4. Git / GitHub-Workflow

- Nur Branch **`main`**, Auto-Deploy auf Render bei Push.
- Lock-Fehler („A lock file already exists"): alle Git-Tools schließen, dann
  `Remove-Item -Force "<Projekt>\.git\index.lock"` (PowerShell).
- Push fragt nach Login → GitHub-User + **Personal Access Token** (nicht Passwort).
- Bei `package.json`-Änderungen immer `npm install --package-lock-only`, sonst zieht Render eine
  veraltete Lock-Datei (genau das war ein Deploy-Fehler).
- **Umlaute/UTF-8:** HTML-Dateien sind UTF-8 **ohne BOM**. NICHT mit Windows-PowerShell-5.1
  `Get-Content -Raw` + `WriteAllText` bulk-bearbeiten (zerstört Umlaute → Mojibake `Ã¼`).
  Edit-Tool oder `[System.IO.File]::ReadAllBytes/WriteAllBytes` mit korrektem Encoding nutzen.
- `.env` ist gitignored und nicht getrackt — Prod-Werte gehören ins **Render-Dashboard**, nie ins Repo.

---

## 5. Nächste sinnvolle Schritte (Reihenfolge)

1. 🟠 Stripe-Webhook-URL auf `https://maiosshop.com/stripe-webhook` zeigen lassen (§1 #3)
   → dann füllt sich das Bestell-Dashboard mit echten Bestellungen.
2. 🟠 Code-Härtung #9 (OpenAI-Proxy), dann #10 (§1).
3. 🟢 Conversion/Umsatz-Auswertung (§3.1) auf Basis von `page_views` + `orders`.
4. 🟢 Restliches Aufräumen (§2).

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).
