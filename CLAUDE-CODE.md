# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-06-29 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
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

## 2. CJ Dropshipping & Preisanalyse — Stand 2026-06-29

### CJ-Verbindung (getestet 29.06.2026)

`node test-cj-api.js` ergab **100 % Erfolg (29/29 Tests)**:
- API-Verbindung, alle 45 Methoden (Auth/Produkte/Bestellungen/Logistik/Lager) verfügbar.
- Alle Endpoints strukturell valide.
- ⚠️ `CJ_EMAIL` + `CJ_PASSWORD` fehlen in `.env` → im Render-Dashboard nachtragen (für
  Token-Refresh via E-Mail/Passwort notwendig, aktuelle `CJ_API_KEY`/`CJ_ACCESS_TOKEN` reichen
  aber für den normalen Bestellbetrieb).

### Preis-Analyse: 20 % Gewinn inkl. CJ-Versandkosten

**Formel:** VK ≥ (Einkaufspreis + CJ-Versandkosten nach DE) × 1,20, aufgerundet auf x,99.

**Ergebnis:** 4 Produkte lagen darunter → `products.json` am 29.06.2026 korrigiert:

| ID | Produkt | Alt | Neu | EK | CJ-Versand |
|----|---------|-----|-----|----|-----------|
| 10 | Elektrischer Wasserspender | 33,99 € | **34,99 €** | 20,50 € | 8,00 € (bestätigt, CSV) |
| 17 | Bluetooth Anti-Lost Finder | 6,99 € | **8,99 €** | 4,47 € | 2,50 € (geschätzt) |
| 22 | Waterproof RGB LED Solar | 12,99 € | **13,99 €** | 8,43 € | 3,00 € (geschätzt) |
| 38 | Jade Stein | 11,99 € | **12,99 €** | 7,79 € | 3,00 € (geschätzt) |

Alle übrigen CJ-Produkte liegen bei ≥ 23 % Gewinn inkl. geschätztem Versand.

⚠️ **TODO (🟠):** CJ-Versandkosten für ID 17, 22, 38 (und alle anderen Produkte) in der CJ-App
unter „Logistics → Freight Calculate" pro Produkt nachschlagen und `excel/Maios Produkte.csv`
aktualisieren. Aktuell sind nur für ID 10 (Wasserspender) die 8 € aus dem CSV-Kommentar bekannt.

⚠️ **HTML-Produktseiten müssen ebenfalls angepasst werden!** Die 4 geänderten Produkte haben den
Preis an 5 Stellen in der jeweiligen `produkte/<slug>.html` (price-tag, eingebettetes JSON,
Detailzeile, „Ähnliche Produkte"-Karten). Procedure: siehe §2 „Preise ändern — Arbeitsanweisung".

**Produkte ohne Kaufpreis-Daten** (anderer Lieferant, nicht CJ): ID 13, 14, 15, 16, 20, 23,
24, 25, 28, 29, 31, 51 → Einkaufspreise manuell nachtragen, dann Gewinn-Check wiederholen.

---

## 3. Preise ändern — Arbeitsanweisung

> ⚠️ **Produktseiten hardcoden den Preis an FÜNF Stellen.** Jede Preisänderung überall pflegen,
> sonst driften Seite und Daten:
> 1. `products.json` — Basispreis + `colors[]` (der `price-validator` nutzt diesen Wert → Kunde zahlt immer korrekt).
> 2. `produkte/<slug>.html` — price-tag (`<span class="price-tag">€…`).
> 3. eingebettetes Produkt-JSON in derselben HTML — `price: X` (ohne) bzw. `"price": X` (mit Quotes), inkl. `colors[]`.
> 4. die „Preis: €…“-Detailzeile.
> 5. die **„Ähnliche Produkte“-Karten** auf ALLEN Seiten — Zuordnung über den Slug im `onclick`-href,
>    **nicht** über den Preis (Preise kollidieren).
>
> Praktisch per Node-Skript: `products.json`-Roundtrip ist byte-identisch; Seiten/Karten per
> gezählten String-Replacements (beide Quote-Stile). 