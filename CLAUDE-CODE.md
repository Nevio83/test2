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

## 3. Git / GitHub-Workflow

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

## 4. Nächste sinnvolle Schritte (Reihenfolge)

1. 🟡 Code-Härtung #10 (Robustheit) (§1).
2. 🟢 Restliches Aufräumen (§2).

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).
