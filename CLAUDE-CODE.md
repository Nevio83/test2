# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-24 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
auf Apex) + Fallback `https://maios-shop.onrender.com` · Repo `Nevio83/test2` (nur `main`,
**öffentlich**) · DB: Neon-Postgres · Hosting: Render (Free).

**Prioritäten:** 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig/optional.

> Hier stehen nur **offene** Aufgaben — Erledigtes wird entfernt.

---

## 1. Git / GitHub-Workflow

- Nur Branch **`main`**, Auto-Deploy auf Render bei Push.
- **Git über PowerShell ausführen, nicht über das Bash-Tool (Git Bash/MSYS).** Unter Windows
  schlägt `git add`/`git commit` via Git Bash hier reproduzierbar mit
  `fatal: Unable to create '…/.git/index.lock': No such file or directory` (ENOENT) fehl,
  obwohl `git status` (read-only) geht. PowerShell-Git funktioniert zuverlässig.
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
- **🔴 Secrets niemals committen (Repo ist ÖFFENTLICH).** Vor jedem `git add` prüfen, was reinkommt;
  nie `git add -A`/blind den ganzen Ordner stagen. Schon passiert: ein privater SSL-Key +
  Stripe-Backup-Code landeten via `excel/` im öffentlichen Repo. Bereinigt mit `git filter-branch`
  (`--index-filter` + `git rm --cached`, Globs `*.key`/`stripe_backup_code.txt`/`~*`) + `--force`-Push
  + lokalem `gc`. **Wichtig:** History-Rewrite ist nur Schadensbegrenzung — ein einmal gepushtes
  Secret gilt als kompromittiert und **muss rotiert** werden (Zertifikat neu, Stripe-Codes neu).
  `.gitignore` deckt jetzt `*.key`/`*.pem`/`*_private_key*`/`stripe_backup_code.txt`/`~$*` ab.
- **Commit-Messages mit `"` (Anführungszeichen):** PowerShell 5.1 zerlegt bei nativen Befehlen
  Variablen mit `"` falsch in Argumente → `git commit` schlägt fehl. Lösung: Message BOM-frei in
  eine Datei schreiben (Write-Tool) und `git commit -F <datei>` nutzen, oder `"` in der Message meiden.

---

## 2. Preise aktualisieren (Shop) — Stand 2026-06-24

Quelle/Details: `excel/Maios Preisanalyse 2026-06.xlsx`, Blatt **„Maios-Shop Preischeck“**.
Kritischer Wert ist die **Marge nach 20 % Rabatt** (der Shop gewährt 20 %-Gutscheine);
regulär sehen die Preise gut aus, mit Gutschein rutschen viele ins Minus/fast-null.

> ⚠️ **Produktseiten hardcoden den Preis.** Jede Preisänderung an **drei** Stellen pflegen:
> `products.json` · `produkte/<slug>.html` (`<span class="price-tag">€…`) · das eingebettete
> Produkt-JSON in derselben HTML (`"price": …` inkl. `colors[]`). Sonst driften Seite und Daten.

### 🔴 A) Seitenpreis ≠ products.json (Daten-Bug, sofort beheben)
- **COBLED Arbeitsleuchte** (id 24, `produkte/cobled-arbeitsleuchte.html`):
  Seite zeigt **29,99 €**, `products.json` sagt **12,99 €** → klären welcher korrekt ist, beide angleichen.
- **Nachtlichter mit Bewegungsmelder** (id 25, `produkte/nachtlichter-mit-bewegungsmelder.html`):
  Seite **16,99 €**, `products.json` **23,99 €** → angleichen.

### 🟠 B) Marge kritisch/Verlust nach 20 % Rabatt → Preis erhöhen (Pflicht)
| Produkt | id | jetzt | neu |
|---|---|---|---|
| Smart Beamer | 44 | 74,99 € | **96,99 €** *(oder vom 20 %-Gutschein ausnehmen)* |
| Professioneller 5-in-1 Haartrockner | 37 | 59,99 € | **76,99 €** *(oder vom Gutschein ausnehmen)* |
| Elektronischer Premium Jade Stein | 39 | 29,99 € | **37,99 €** |
| 350ml Mixer Entsafter | 11 | 32,99 € | **40,99 €** |
| Mini Thermal Drucker | 43 | 26,99 € | **32,99 €** |

Dazu die **Rollen-Varianten** des Druckers (Style A/B/C, je **8,99 €**) — Style C macht nach
Rabatt **Verlust**; alle drei auf **12,99 €** (in `products.json` `colors[]` + HTML-JSON).

### 🟡 C) Marge dünn (10–20 %) → optional erhöhen
| Produkt | id | jetzt | neu |
|---|---|---|---|
| Tumbler Becher (+ Winter) | 47/48 | 19,99 € | 23,99 € |
| └ Variante „Strohhalm“ | — | 4,99 € | 6,99 € *(kritisch)* |
| Klimaanlage mit Display | 45 | 28,99 € | 33,99 € |
| Elektrischer Wasserspender | 10 | 28,99 € | 33,99 € |
| Krystall Ball Nachtlampe | 50 | 13,99 € | 15,99 € |
| Thermische Massage | 35 | 21,99 € | 24,99 € |
| Elektronisches Distanzmessgerät | 19 | 19,99 € | 21,99 € |
| Wärmender Untersetzer | 40 | 16,99 € | 18,99 € |

Annahmen: 20 % Rabatt, Ziel **≥ 30 % Marge nach Rabatt** → kleinster `x,99`-Preis.
17 weitere Shop-Produkte (ALI-Lieferant) haben **keinen Kaufpreis** in der CSV — dort Kosten
nachtragen, um die Marge zu prüfen.

---

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).

---

> **Offen:** Shop-Preise aktualisieren (§2). Weitere Bugs/Features hier eintragen.
