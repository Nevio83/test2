# GITHUB-UPDATE — Repo aktualisieren & auf einen Branch (main)

<<<<<<< Updated upstream
Repo: `https://github.com/Nevio83/test2`

## Stand
=======
In **deinem Terminal / GitHub Desktop** ausführen (nicht in Cowork — dort ist `.git` gesperrt).
Repo: `https://github.com/Nevio83/test2`

## Stand

- ✅ **Schritt 0+1 erledigt:** Lock entfernt, Commit „fix 1" auf `main` (Secrets untrackt,
  neue Dateien drin).
- ⏳ **Jetzt:** Schritt 2 — `neues-design` in `main` mergen (GitHub Desktop, siehe unten).
- ⏳ **Offen:** Schritt 3 (Secrets aus History entfernen, CLI) + Schritt 4 (Branch löschen) +
  **Key-Rotation**.

## Schnellweg in GitHub Desktop (empfohlen, da du es nutzt)

**Mergen (Schritt 2):**
1. Oben sicherstellen: **Current branch = main**.
2. Menü **Branch → Merge into current branch…**
3. `neues-design` wählen → **Create a merge commit**.
4. Bei Konflikten: GitHub Desktop zeigt sie an → in VS Code/Editor auflösen → zurück, Merge
   abschließen.
5. Oben **Push origin** klicken.

**Alten Branch löschen (Schritt 4):**
1. Oben auf **Current branch** klicken → in der Liste `neues-design` rechtsklicken → **Delete…**
2. Haken **„Yes, delete this branch on the remote"** setzen → löschen.

> Schritt 3 (History bereinigen) geht nur per CLI — siehe unten. Reihenfolge: erst mergen +
> pushen, dann History-Purge, dann Keys rotieren.

---
>>>>>>> Stashed changes

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
