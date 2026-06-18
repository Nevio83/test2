# 🔴 SECURITY-SOFORT — Secrets aus Git entfernen & rotieren

Diese Anleitung ist **dringend**. `.env` und `Marketing/.env` mit Live-Keys liegen im Git-
Verlauf. Reihenfolge: **erst rotieren, dann bereinigen** — sobald Keys neu sind, ist ein
eventueller Leak entwertet.

> Vorbereitet in Cowork: `.gitignore` ist bereits gefixt, `.env.example` liegt bereit.
> Die git-Schritte musst du selbst im Terminal ausführen (Cowork-Sandbox darf den git-Index
> dieses Repos nicht schreiben). **Schließe vorher VS Code / git-Tools**, die das Repo offen
> halten.

---

## Schritt 0 — Git-Index reparieren (falls nötig)

Beim Cowork-Versuch ist eine leere `\.git/index.lock` übriggeblieben und der Index muss neu
aufgebaut werden. **Deine Historie und Dateien sind unversehrt** (`git log` funktioniert) —
nur die Staging-Liste. Im Terminal im Projektordner:

```bash
# 1. VS Code / alle git-Tools schließen
# 2. Stale Lock entfernen
rm -f .git/index.lock
# 3. Index aus HEAD neu aufbauen (Arbeitskopie bleibt unberührt)
git reset
git status        # sollte wieder normal laufen
```

Falls `git status` weiter „index corrupt" meldet:
```bash
rm -f .git/index
git reset
```

---

## Schritt 1 — Keys ROTIEREN (zuerst!)

Erzeuge überall neue Schlüssel und widerrufe die alten:

| Dienst | Aktion |
|---|---|
| **Stripe** | Dashboard → Developers → API keys → Secret Key **roll**; Webhook-Signing-Secret neu erzeugen. Publishable Key neu setzen. |
| **Resend** | Dashboard → API Keys → alten Key löschen, neuen erstellen. |
| **CJ Dropshipping** | my.html#/apikey → API-Key/Token neu generieren; ggf. Passwort ändern. |
| **ExchangeRate-API** | neuen API-Key anfordern, alten deaktivieren. |
| **OpenAI** (Marketing/.env) | platform.openai.com → alten Key revoken, neuen anlegen. |
| **ElevenLabs / Runway / Pika / Reddit / Exploding Topics / Mailchimp / TikTok** | jeweils im Dienst neu erzeugen, alte widerrufen. |
| **Selbst gesetzte Secrets** | `SESSION_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_PASSWORD` neu generieren: `openssl rand -hex 32` |

Neue Werte in die **lokale** `.env` eintragen (nicht committen) **und** ins
**Netlify-Dashboard** (Site → Settings → Environment variables) — Netlify liest nicht aus `.env`.

---

## Schritt 2 — Aus Tracking nehmen (lokale Dateien bleiben)

```bash
git rm --cached .env Marketing/.env
git rm --cached database/orders.db test.db orders.db 2>/dev/null
git rm --cached Marketing/data/trends.db 2>/dev/null
git rm -r --cached Marketing/pipelines/__pycache__ 2>/dev/null

git add .gitignore .env.example
git commit -m "chore(security): Secrets & DB-Dateien aus Tracking entfernen, .gitignore + .env.example"
```

Prüfen, dass nichts Sensibles mehr getrackt ist:
```bash
git ls-files | grep -iE 'env|\.db$|\.pyc$'
# Erwartet: nur .env.example und Marketing/.env.example
```

---

## Schritt 3 — Aus der GESAMTEN Historie löschen

Schritt 2 entfernt die Dateien nur ab jetzt; in alten Commits stecken die Keys weiter. Daher
Historie umschreiben. **Vorher Backup/Klon anlegen.**

**Variante A — git-filter-repo (empfohlen):**
```bash
pip install git-filter-repo        # einmalig
git filter-repo --path .env --path Marketing/.env \
                --path database/orders.db --path test.db \
                --path Marketing/data/trends.db --invert-paths
```

**Variante B — BFG:**
```bash
bfg --delete-files .env
bfg --delete-files "*.db"
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

---

## Schritt 4 — Force-Push & Nachsorge

```bash
git push origin --force --all
git push origin --force --tags
```

- Alle anderen Klone müssen **neu geklont** werden (alte Historie ist tot).
- Falls das Repo **öffentlich** war: Keys gelten als kompromittiert — Rotation aus Schritt 1
  ist damit Pflicht, nicht optional.
- Danach prüfen, ob Stripe/Resend/CJ mit den **neuen** Keys laufen (`npm run dev`, Test-Checkout
  im Stripe-Testmodus, `npm run test-cj-api`).

---

## Schritt 5 — Vorbeugen

- Pre-Commit-Hook gegen Secret-Leaks: `gitleaks` oder `git-secrets` einrichten.
- Niemals Keys hart codieren — immer `process.env`.
- Prod-Secrets nur im Netlify-Dashboard, nicht in Dateien.

> Status der Code-Findings insgesamt: `REVIEW-CLAUDE-CODE.md` (dies ist Punkt #1).
