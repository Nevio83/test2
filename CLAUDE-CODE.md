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

## 2. Preise — Anpassung 2026-06-24 erledigt ✅ (Rest-Punkte 🟢)

Die Margen-Anpassung aus `excel/Maios Preisanalyse 2026-06.xlsx` (Blatt „Maios-Shop
Preischeck“) ist **umgesetzt**: 15 Produkte (Daten-Bugs A + Pflicht B + optional C) in
`products.json` + den Produktseiten aktualisiert. Entscheidungen: **COBLED id 24 → 29,99 €**,
**Nachtlichter id 25 → 23,99 €** (Streichpreis 34,99 €), Smart Beamer 96,99 €, Haartrockner
76,99 € (orig 99,99 €), Premium Jade 37,99 €, Mixer 40,99 €, Drucker 32,99 € + Rollen 12,99 €,
Tumbler/Winter 23,99 € + Strohhalm 6,99 €, Klimaanlage/Wasserspender 33,99 €, Krystall 15,99 €,
Thermische Massage 24,99 €, Distanzmessgerät 21,99 €, Wärmender Untersetzer 18,99 €.

> ⚠️ **Produktseiten hardcoden den Preis.** Jede Preisänderung an **fünf** Stellen pflegen:
> `products.json` · `produkte/<slug>.html` price-tag (`<span class="price-tag">€…`) · das
> eingebettete Produkt-JSON in derselben HTML (`price`/`"price"` inkl. `colors[]`) · die
> „Preis: €…“-Detailzeile · die **„Ähnliche Produkte“-Karten** auf ALLEN Seiten (jede Karte
> trägt den Slug im `onclick`-href → darüber zuordnen, **nicht** über den Preis, da Preise
> kollidieren). Praktisch: per Node-Skript (JSON-Roundtrip von `products.json` ist byte-identisch)
> + gezählten String-Replacements je Seite (zwei Stile: `price: X` ohne Quotes bzw. `"price": X`
> mit Quotes). Der `price-validator` lehnt falsche Client-Preise **nicht** ab, sondern nutzt den
> `products.json`-Basispreis → Kunden zahlen immer korrekt.

**Noch offen (🟢 niedrig):**
- **ALI-Produkte ohne Kaufpreis** (~17 Stück) haben in der CSV **keine Kostendaten** → Marge
  ungeprüft. Kosten in der Excel nachtragen, dann ggf. Preise anpassen.

> „Ähnliche Produkte“-Karten sind erledigt: 57 Karten auf 31 Seiten an `products.json` angeglichen
> (slug-basiert), per Verifikations-Skript geprüft (139 Karten, 0 Abweichungen).

---

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).

---

> **Offen:** nur noch die 🟢-Rest-Punkte aus §2 (ALI-Kostendaten, Related-Karten-Kosmetik).
> Weitere Bugs/Features hier eintragen.
