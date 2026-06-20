# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-21 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
auf Apex) + Fallback `https://maios-shop.onrender.com` · Repo `Nevio83/test2` (nur `main`)
· DB: Neon-Postgres · Hosting: Render (Free).

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig/optional.

> Hier stehen nur **offene** Aufgaben — Erledigtes wird entfernt.

---

## 1. Offene Code-Themen (Performance)

| # | Prio | Thema | Datei(en) |
|---|---|---|---|
| 11 | 🟢 | **Performance — Rest, braucht Build-Step-Entscheidung:** Assets minifizieren/bündeln (styles.css ~215 KB, app.js ~190 KB), Bilder auf WebP umstellen, ~1000 `console.*` per Log-Level dämpfen. **Konflikt mit „Kein Build-Step" (`CLAUDE.md`)** — erst entscheiden, ob ein Build-Step eingeführt wird. | Frontend gesamt |

> **Bereits erledigt (2026-06-21):** `products.json`-Mehrfach-Fetch behoben (memoized,
> 1× statt ~20× pro Seite, im Browser verifiziert) · `compression` (gzip) ist serverseitig
> aktiv · Bestseller-/Kategorie-Grids nutzen bereits `loading="lazy"`.

> **Hinweis:** Minify/Bundle/WebP brauchen einen Build-Schritt + `render.yaml`-Anpassung
> (Architektur-Entscheidung). Der `console.*`-Punkt ist Low-ROI, da gzip die Übertragung
> bereits deckt — eher zusammen mit dem Build-Step lösen.

---

## 2. Git / GitHub-Workflow

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

## 3. Nächste sinnvolle Schritte

1. 🟢 Entscheidung: Build-Step einführen? Wenn ja → Minify/Bundle + WebP (#11).
   Wenn nein → #11 bleibt offen/abgehakt (gzip + lazy decken das Wesentliche).

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).
