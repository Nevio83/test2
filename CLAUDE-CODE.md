# CLAUDE-CODE.md — Backlog & Arbeitsanweisungen für Claude Code

Alles, was an Code zu tun ist: offene Bugs/Sicherheit, Aufräumen, Ausbau, Git-Workflow.
Architektur & Setup stehen in `CLAUDE.md`, Design in `CLAUDE-DESIGN.md`.

Stand: 2026-09-07 · Live: **https://maiosshop.com** (Custom-Domain auf Render, `www` leitet
auf Apex) + Fallback `https://maios-shop.onrender.com` · Repo `Nevio83/test2` (nur `main`,
**öffentlich**) · DB: Neon-Postgres · Hosting: Render (Free).

> **Kein Auto-Deploy mehr.** Seit dem 03.08. rollt Render nicht mehr von selbst aus
> (`autoDeploy: false`); der Prüflauf ist die Sperre. Ein Push allein reicht nicht — ist der
> Lauf rot, bleibt der alte Stand live.

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

### 🔴 CJ-Versandkosten nachgeschlagen (07.09.2026) — die Margen brechen weg

Nicht in der CJ-App abgetippt, sondern über die API abgefragt: `queryProductVariant` →
`freightCalculate` (CN → DE, Menge 1), **20 von 27 Produkten** erfolgreich.

**Ergebnis: Der echte Versand liegt bei ausnahmslos allen 20 über der Schätzung — im Schnitt
beim 2,18-fachen.**

| ID | Produkt | geschätzt | CJ real | Faktor |
|---|---|---|---|---|
| 37 | Professioneller 5 in 1 Haar Trockner | 8,00 | **30,53** | ×3,8 |
| 11 | 350ml Elektrischer Mixer Entsafter | 5,00 | **15,38** | ×3,1 |
| 45 | Klimaanlage mit Display | 5,00 | **14,86** | ×3,0 |
| 41 | 2 in 1 Öl Sprayer Flasche | 3,50 | **9,20** | ×2,6 |
| 50 | Krystall Ball Nachtlampe | 3,00 | **7,75** | ×2,6 |
| 47/48 | Tumbler Becher (+ Winter) | 4,00 | **10,12** | ×2,5 |
| 10 | Elektrischer Wasserspender | 8,00 *(galt als bestätigt)* | **9,71** | ×1,2 |

**Folge — mit den echten Zahlen fallen 14 von 20 unter die Mindestmarge, zwei ins Minus:**

| ID | Produkt | VK | Kosten | Marge vorher | **jetzt** |
|---|---|---|---|---|---|
| 37 | Haar Trockner | 74,99 | 77,65 | 36,0 % | **−3,4 %** |
| 45 | Klimaanlage | 34,99 | 35,45 | 36,7 % | **−1,3 %** |
| 11 | Mixer | 40,99 | 40,36 | 36,7 % | **1,6 %** |
| 47/48 | Tumbler | 24,99 | 24,57 | 35,4 % | **1,7 %** |
| 41 | Öl Sprayer | 20,99 | — | 41,5 % | **2,2 %** |

Der Marketing-Automat **sperrt diese 14 Produkte jetzt von selbst** (`marge_ok` → False). Das
ist die Guardrail, die tut, wofür sie da ist — aber es heißt auch: Die Preise im Shop tragen
den Versand nicht.

⚠️ **Drei Vorbehalte, damit die Zahlen nicht besser aussehen als sie sind:**

1. **Genommen wurde die günstigste von je ~12 Optionen.** Die Realität kann nur schlechter sein.
2. **CJ weist keine Währung aus.** Die Zahl ist roh übernommen (also als € gelesen). Als USD
   gelesen wären es ~8 % weniger — an der Aussage ändert das nichts: dann sind es
   14 von 20 unter der Grenze und **eines** im Minus statt zwei.
3. **7 Produkte konnten nicht abgefragt werden** (ID 17, 18, 19, 33, 36: keine CJ-Nummer im
   CSV-Link; ID 34 und 46: siehe unten). Bei denen steht weiter die Schätzung — und die ist
   nach allem, was die 20 anderen zeigen, zu niedrig.

⚠️ **Nebenbefund (🔴): Zwei verkaufte Produkte gibt es bei CJ nicht mehr.**
`queryProductVariant` meldet für ID **46** (Nordic Crystal Lamp) und ID **34** (Gesichtssauna)
„Product has been removed from shelves". Beide stehen im Shop weiter zum Verkauf.

⚠️ **Nebenbefund (🟠): Der Shop bestellt mit einer Versandart, die CJ nicht anbietet.**
`getShippingMethod()` in `server.js:2089` gibt für Europa `"CJ Packet Registered"` zurück. In
den Frachtantworten für **alle 20** abgefragten Produkte kommt dieser Name **kein einziges Mal**
vor — angeboten werden „CJPacket Sensitive", „CJPacket Ordinary Express", „YunExpress …" usw.
Was CJ bei einer Bestellung mit unbekanntem `logisticName` tut, ist ungeprüft.

**Was jetzt zu entscheiden ist (nicht von mir):** Preise anheben, günstigere Versandart
festlegen, Sortiment ausdünnen — oder die Mindestmarge bewusst senken.

⚠️ **HTML-Produktseiten müssen ebenfalls angepasst werden!** Die 4 geänderten Produkte haben den
Preis an 5 Stellen in der jeweiligen `produkte/<slug>.html` (price-tag, eingebettetes JSON,
Detailzeile, „Ähnliche Produkte"-Karten). Procedure: siehe §2 „Preise ändern — Arbeitsanweisung".

**Produkte ohne Kaufpreis-Daten (13):** ID 13, 14, 15, 16, 20, 23, 24, 25, 28, 29, 31 (alle
AliExpress, anderer Lieferant), **42** (Aroma Öl Diffusor) und **51** (Auto Bildschirm).
→ Einkaufspreise manuell nachtragen, dann Gewinn-Check wiederholen.

> **42 ist am 07.09. neu dazugekommen** und stand vorher nicht in dieser Liste: Das Produkt hat
> eine CJ-SKU, aber keine Zeile in der CSV. Die CSV-Zeile 51 heißt zwar „Aroma Öl Diffusor",
> verlinkt aber den *Volcanic Flame Diffuser* — also Produkt **27**, nicht 42. Beide kosten
> 26,99 €; nach Name und Preis wären sie nicht auseinanderzuhalten gewesen.

### Einkaufspreise je Produkt-ID (erledigt am 07.09.2026)

27 von 40 Produkten stehen jetzt mit EK und Versand in `Marketing/config/marketing.config.json`
unter `matching.einkaufspreise`. Der Automat rechnet damit echte Margen statt „ungeprüft".

**Zugeordnet wurde über den LINK der CSV-Zeile, nicht über ihre Namensspalte.** Die trägt
Spitznamen und stimmt stellenweise nicht:

- Zeile 37/38 heißen „LED Water in Crown" / „Led Water Wooden base", verlinken aber ein
  **Solarlicht** (denselben Artikel wie Zeile 46, dort aber mit anderem EK: 10,50 gegen 8,43).
  Nach Name und Verkaufspreis (18,99 €) gehören sie zu Produkt **21** (Led crystal lampe) —
  übernommen, aber im Eintrag als `zahlen` gekennzeichnet, weil der Link widerspricht.
- Zeile 52 heißt nur „Aroma Öl", ist aber laut Link und SKU-Fragment eindeutig Produkt **33**
  (Aromatherapy Essential Oil Humidifier).

Jeder Eintrag wurde zusätzlich gegen den Verkaufspreis in `products.json` gegengeprüft; bei
Abweichung wäre er **nicht** übernommen worden. Es gab keine einzige Abweichung.

⚠️ **Nebenbefund (🟡): Die SKU von Produkt 11 ist vermutlich falsch.** Sie lautet
`CJ1621032671155597313` — das ist die SKU von Produkt 10 (`…597312`) **plus eins**. Die echte
CJ-Nummer des Mixers steht im CSV-Link: `1392009095543918592`. Folge heute: `cj-price-sync.js`
ordnet über `sku.includes(pid)` zu und findet für den Mixer **nichts** — er läuft im
Preis-Abgleich stillschweigend nicht mit. Für die Bestellung selbst wird die SKU nicht benutzt,
es entsteht also keine Fehllieferung.

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