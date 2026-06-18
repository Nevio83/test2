# GITHUB-UPDATE — Repo aktualisieren & auf einen Branch (main)

In **deinem Terminal** ausführen (nicht in Cowork — dort ist der Git-Index gesperrt).
Repo: `https://github.com/Nevio83/test2`

---

## Vorbedingungen (wichtig!)

1. **VS Code komplett schließen** (und jedes andere Git-Tool). Das hält die Sperre
   `.git/index.lock`, die alle Git-Schreibbefehle blockiert.
2. **Repo auf privat stellen**, bis die History bereinigt ist (deine `.env` mit Live-Keys
   liegt aktuell auf `origin/main`). GitHub → Repo → Settings → General → „Change visibility".
3. **Keys rotieren** (Stripe, Resend, CJ, ExchangeRate, OpenAI) — siehe `SECURITY-SOFORT.md`.
   Das `ADMIN_PASSWORD` gehört NICHT ins Repo, sondern ins Render-Dashboard.

---

## Schritt 0 — Index reparieren

```bash
cd <Projektordner>
rm -f .git/index.lock
git reset            # baut den Index aus HEAD neu auf; Arbeitskopie bleibt
git status           # muss wieder normal laufen
```
Falls weiterhin „index corrupt":
```bash
rm -f .git/index
git reset
```

## Schritt 1 — Secrets untracken + Änderungen committen

```bash
git rm --cached .env Marketing/.env database/orders.db test.db 2>/dev/null
git add -A
git commit -m "Sicherheit: Preisvalidierung, Webhook-Fix, Admin-Auth, Render-Setup; Secrets untrackt"
```

## Schritt 2 — neues-design in main mergen

```bash
git checkout main
git merge neues-design
# Bei Konflikten: Dateien bereinigen, dann:
#   git add <datei> && git commit
# „Already up to date" = neues-design war schon drin (ok).
```

## Schritt 3 — Secrets aus der GESAMTEN History entfernen

```bash
pip install git-filter-repo

git filter-repo --path .env --path Marketing/.env --invert-paths --force
# Hinweis: filter-repo entfernt danach den Remote 'origin' -> neu hinzufügen:
git remote add origin https://github.com/Nevio83/test2.git
```

## Schritt 4 — Push + alten Branch löschen (nur noch main)

```bash
git push origin main --force
git push origin --delete neues-design
git branch -D neues-design          # lokalen Branch entfernen
```

Ergebnis: nur noch `main`, aktuell, ohne `.env` in der History.

---

## Troubleshooting

- **`git push` fragt nach Login:** GitHub-Benutzername + ein **Personal Access Token**
  (nicht das Passwort). Token: GitHub → Settings → Developer settings → Tokens.
- **`filter-repo: command not found`:** `python -m pip install git-filter-repo`, oder
  `pip install --user git-filter-repo` und `~/.local/bin` zum PATH.
- **Merge-Konflikte:** betroffene Dateien öffnen, `<<<<<<<`/`=======`/`>>>>>>>` auflösen,
  `git add` + `git commit`.
- **`git branch -D` meckert nicht-gemergt:** ist hier ok (`-D` erzwingt das Löschen).

> Erst nach erfolgreichem Push und **rotierten Keys** ist die Secret-Exponierung wirklich
> behoben. Reihenfolge: Keys rotieren → History bereinigen → pushen.
