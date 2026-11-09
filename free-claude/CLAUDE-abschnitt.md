
## Free-claude (FreeLLMAPI)
- Schreibt Nevio „Free-claude" (irgendwo in der Nachricht), erledigt Claude alles Auslagerbare über FreeLLMAPI, auch Code:
  `node C:\Users\nevio\Documents\vscode\Maios\free-claude\free-claude.mjs "<Auftrag>"`
  (Optionen --code fürs Programmieren, --smart / --fast / --free). Claude prüft das Ergebnis, passt es an und liefert es fertig.
- Auch ohne das Stichwort gehen leichte Aufgaben (Hooks, Captions, Hashtags, Varianten, Titel, Entwürfe, Übersetzungen, kurze Auswertungen) automatisch dorthin, ohne Nachfrage.
- Code nur auslagern, wenn „Free-claude" dasteht (dann mit --code). Ohne Stichwort schreibt Claude Code selbst.
- Nie auslagern, auch nicht mit Stichwort: Checkout/Stripe/CJ-Logik, Sicherheit, Rechtliches, vertrauliche Daten (.env, Keys, Kundendaten).
- Ausgelagerten Code immer selbst prüfen (lesen, lint, tests), bevor er ins Repo kommt.
- Aufträge kurz halten (nur nötige Fakten, höchstens ca. 1.000 Zeichen), mehrere Aufgaben in einen Aufruf bündeln.
- Ergebnis ist Rohmaterial: gegen products.json und die Videoregeln prüfen, Unbelegtes streichen.
- Meldet das Skript FEHLER: einmal mit gekürztem Auftrag wiederholen, sonst selbst erledigen und in einem Satz sagen, was schiefging.
- Der alte OmniRoute-Weg (ask-free.mjs, Port 20128) wird nicht mehr benutzt.
