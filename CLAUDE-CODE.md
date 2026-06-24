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

## 2. Preise ändern — Arbeitsanweisung

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
> gezählten String-Replacements (beide Quote-Stile). Danach verifizieren: jede Karte Slug→`products.json`
> abgleichen, `price-tag`/embedded-JSON/Detailzeile == Basispreis, UVP (`originalPrice`) > Preis.
> Die Buy-Box-`current-price`-Platzhalter werden per JS aus `product.price` überschrieben → egal.

**Zeilenenden:** `.gitattributes` (Repo-Root) erzwingt **LF** für alle Textdateien. Zeigt Git massenhaft Dateien als „geändert“ nur wegen CRLF↔LF, **nicht** committen — stattdessen `git add --renormalize .` in PowerShell.

**Offen (🟢 sehr niedrig — ALI-Produkte sind ausgeblendet):** Alle ALI-Produkte (SKU `ALI*`)
werden in `app.js` aus **allen** Shop-Listen herausgefiltert (Suche, Kategorien, „Alle Produkte“,
Bestseller — Bedingung `!sku.startsWith("ALI")`) und sind **nur über die direkte Produkt-URL**
erreichbar. Sie sind also nicht im aktiven Verkaufsfunnel → die ungeprüfte Marge ist **unkritisch**,
solange sie ausgeblendet bleiben. Erst relevant, falls eins sichtbar geschaltet wird.

**9 ALI-Produkte** (SKU `ALI*`) fehlen in `excel/Maios Produkte.csv`
→ Marge ungeprüft (nur der Shop-Betreiber kennt die AliExpress-Einkaufspreise; nicht ableitbar).
Kosten nachtragen, dann Regel **≥ 30 % Marge nach 20 % Rabatt** prüfen/anpassen. Betroffen:
id 13 (Luft-Wasser-Flasche 24,99 €), 14 (Aroma-Pads 12,99 €), 15 (Espressomaschine 89,99 €),
16 (Küchenwaage 49,99 €), 20 (ZigBee-Rollos 89,99 €), 23 (LED Motion Sensor 19,99 €),
28 (Mini-Massagepistole 24,99 €), 29 (Haaröl-Applikator 8,99 €), 31 (Kopfhaut-Massagekamm 12,99 €).
ALI id 24 (COBLED 29,99 €) + 25 (Nachtlichter 23,99 €) sind als Daten-Bugs bereits gesetzt.
Nebenbefund: CSV-Zeile „Crystal Ball Saturn“ hat `????`/`#WERT!` (Kaufpreis fehlt), und die
`Verkaufspreis`-Spalte ist nach dem Preis-Update teils veraltet — die CSV ist nur Analyse-Quelle,
nicht maßgeblich (`products.json` zählt).

---

> Großes Repo (~19k JS-Zeilen, 60+ HTML): vor Refactorings `/graphify .` für die
> Abhängigkeiten (siehe `CLAUDE.md`).

---

> **Offen:** nur §2-Rest 🟢 (ALI-Produkte ohne Kaufpreis). Weitere Bugs/Features hier eintragen.
