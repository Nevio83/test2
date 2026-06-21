# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-21 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
auf Apex) + Fallback `https://maios-shop.onrender.com` · Repo `Nevio83/test2` (nur `main`)
· DB: Neon-Postgres · Hosting: Render (Free).

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig/optional.

> Hier stehen nur **offene** Aufgaben — Erledigtes wird entfernt.

---

## 1. Git / GitHub-Workflow

- Nur Branch **`main`**, Auto-Deploy auf Render bei Push.
- Lock-Fehler („A lock file already exists"): alle Git-Tools schließen, dann
  `Remove-Item -Force "<Projekt>\.git\index.lock"` (PowerShell).
- Push fragt nach Login → GitHub-User + **Personal Access Token** (nicht Passwort).
- Bei `package.json`-Änderungen immer `npm install --package-lock-only`, sonst zieht Render eine
  veraltete Lock-Datei (genau das war ein Deploy-Fehler).
- **Vor dem Commit prüfen:** `npm run lint` (ESLint, fängt u. a. `no-dupe-keys`) und
  `npm test` (Smoke-Tests für Preis-/Versandlogik). `npm run format` formatiert mit Prettier.
  ESLint/Prettier sind devDependencies — in Prod (Render) nicht zur Laufzeit nötig.
- **Umlaute/UTF-8:** HTML-Dateien sind UTF-8 **ohne BOM**. NICHT mit Windows-PowerShell-5.1
  `Get-Content -Raw` + `WriteAllText` bulk-bearbeiten (zerstört Umlaute → Mojibake `Ã¼`).
  Edit-Tool oder `[System.IO.File]::ReadAllBytes/WriteAllBytes` mit korrektem Encoding nutzen.
- `.env` ist gitignored und nicht getrackt — Prod-Werte gehören ins **Render-Dashboard**, nie ins Repo.

---

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).

---

## 2. Ladezeit-Problem lösen (Free-Plan Sleep) 🟠

**Problem:** Render Free-Plan schläft nach 15 Minuten Inaktivität — erster Besucher wartet ~50 Sekunden.
Das kostet messbar Conversions.

**Lösung (kostenlos):** Externer Cron-Dienst pingt alle 14 Minuten die Shop-URL und hält den Service wach.

**Umsetzung:**
- Bei **cron-job.org** (kostenlos) oder **UptimeRobot** (kostenlos) einen Monitor anlegen:
  URL: `https://maiosshop.com/` · Intervall: 14 Minuten · HTTP GET
- Alternativ: GitHub Actions Workflow mit `schedule: cron: '*/14 * * * *'` der einen curl-Request sendet
- **Kein Code-Änderung nötig** — reine Infrastruktur-Aufgabe

**Langfristig:** Wenn erste Einnahmen fließen, Render Free → **Starter-Plan (7 $/Monat)** upgraden.
Dann entfällt der Sleep komplett und die Instanz läuft dauerhaft.

---

## 3. Node.js 18 → 20 upgraden 🟢

**Problem:** Node 18 ist End-of-Life (EOL). Render zeigt Warnung beim Deploy.

**Umsetzung:**
1. `.nvmrc` ändern: `18` → `20`
2. `package.json` engines-Feld (falls vorhanden) aktualisieren
3. `render.yaml` `NODE_VERSION` auf `20` setzen (falls dort gesetzt)
4. Render-Dashboard → Environment → `NODE_VERSION=20` setzen
5. Lokal testen: `nvm use 20 && npm run dev`
6. **Bonus:** `node-fetch` v2 kann durch natives `fetch()` (Node 20 built-in) ersetzt werden —
   `require('node-fetch')` in `cj-dropshipping-api.js` und `exchange-rate-service.js` entfernen.
   Achtung: erst testen, native fetch hat leicht andere API bei Timeouts/Abbruch.

**Risiko:** Niedrig — keine Breaking Changes zwischen 18 und 20 erwartet.
