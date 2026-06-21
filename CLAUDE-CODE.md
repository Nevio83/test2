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

## 2. Ladezeit / Free-Plan-Sleep — Keep-Alive aktiv ✅ (Rest: optionales Upgrade) 🟢

**Erledigt:** GitHub-Actions-Cron `.github/workflows/keep-alive.yml` pingt alle 10 Min den
leichtgewichtigen Endpoint **`GET /health`** (in `server.js`) und hält den Render-Free-Service
wach (kein Cold-Start mehr für Besucher). Gratis, da das Repo öffentlich ist (unbegrenzte
Actions-Minuten). GitHub-Cron ist „best effort", daher 10-Min-Intervall als Puffer zum 15-Min-Sleep.

**Prüfen nach Deploy:** GitHub → Actions → „Keep Render awake" → erster Lauf grün?
(Scheduled Workflows starten erst, sobald die Datei auf `main` liegt; ggf. einmal manuell
„Run workflow" auslösen.)

**Langfristig (optional):** Wenn erste Einnahmen fließen, Render Free → **Starter-Plan (7 $/Monat)**.
Dann entfällt der Sleep komplett, der Keep-Alive-Workflow kann weg.

---

> **Keine weiteren offenen Code-Aufgaben.** Node 18→20 ist erledigt (Node 20.19.0 in
> `.nvmrc`/`render.yaml`/`engines`, `node-fetch` → natives `fetch`). Nach dem nächsten Deploy
> einmal im Render-Dashboard prüfen, dass keine alte `NODE_VERSION=18.x` als Env-Var den
> Blueprint überschreibt.
