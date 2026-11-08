
## Leichte Aufgaben an kostenlose Modelle (OmniRoute)

Für Routinejobs, bei denen viel gelesen und wenig entschieden wird, nicht selbst grübeln, sondern auslagern:

`node "%USERPROFILE%\.claude\tools\ask-free.mjs" "Aufgabe" --file <datei> [--file <datei2>] [--system "Rolle"]`

**Auslagern (gut geeignet):**
- Zusammenfassen von Logs, Testausgaben, langen Dateien, Doku
- Texte für Maios-Videos: Hooks, Captions, Hashtags, Varianten, Kommentarantworten, Übersetzungen
- Entwürfe von Schnittlisten-JSON (Struktur vorgeben, Ergebnis danach selbst prüfen)
- Alternativen sammeln, Titel, Commit-Message-Entwürfe

**Nicht auslagern (bei Claude bleiben):**
- Code ändern, Dateien editieren, Tool-Aufrufe mit Folgen
- Checkout, Stripe, CJ, CSP, Rechtliches (UWG, Preisangaben), alles mit Geld oder Kundendaten
- Videoschnitt/Rendern (läuft lokal mit ffmpeg, nicht über ein Modell)

**Regeln:**
- Das Skript blockt `.env`, Keys und Secrets selbst. Nie umgehen, nie Kundendaten mitschicken.
- Die Antwort des Free-Modells ist ein Entwurf: kurz gegenlesen, Fakten und Zahlen nicht blind übernehmen.
- Exit 1 (alle Modelle down oder Limit erreicht) → die Aufgabe selbst erledigen, nicht wiederholen.
