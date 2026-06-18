# GITHUB-UPDATE — Repo aktualisieren & auf einen Branch (main)

Repo: `https://github.com/Nevio83/test2`

## Stand

- ✅ **Commit „fix 1" auf `main`** (Secrets untrackt, neue Dateien drin).
- ✅ **`neues-design` in `main` gemergt + gepusht** — main ist up to date.
- ⏳ **Jetzt:** Branch `neues-design` löschen (GitHub Desktop), dann Render-Deploy.

---

## Branch löschen (GitHub Desktop)

1. Oben auf **Current branch** klicken.
2. In der Liste `neues-design` **rechtsklicken → Delete…**
3. Haken **„Yes, delete this branch on the remote"** setzen → bestätigen.

Danach existiert nur noch `main`.

---

## Weiter mit dem Deploy

Siehe `DEPLOYMENT-RENDER.md`.

> Hinweis: Die Schritte „Secrets aus History entfernen" und „Keys rotieren" wurden aus dieser
> Checkliste entfernt. Die Anleitung dazu bleibt bei Bedarf in `SECURITY-SOFORT.md`.

---

## Troubleshooting

- **`git push` fragt nach Login:** GitHub-Benutzername + **Personal Access Token** (nicht das
  Passwort). Token: GitHub → Settings → Developer settings → Tokens.
- **Lock-Fehler („A lock file already exists"):** alle Git-Tools schließen, dann
  `Remove-Item -Force "<Projekt>\.git\index.lock"` (PowerShell), erneut versuchen.
