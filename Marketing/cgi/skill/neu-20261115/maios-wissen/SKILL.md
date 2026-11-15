---
name: maios-wissen
description: "Maios-Wissensvideo (Format W, 30–45 s): belegte, überraschende Geschichte zu Produkt oder Kategorie, Erzählerstimme (VoiceStudio, Profil 'Thorsten CC0'), Untertitel und Bildwechsel wortgenau auf der Stimme, Produkt erst am Ende, Preis nur in der Caption. Nutzen bei Wissensvideo, 'Warum ist das so?', Erklärvideo, Geschichte zum Produkt, Video mit Stimme/Erzähler. Gemeinsame Regeln: Skill maios-video."
---

# maios-wissen – Format W „Warum ist das so?“

Vorbilder: @mehr.optic (Wissen zu einem Produktdetail, 300K–1M Aufrufe), Ablauf „Claude + Remotion“ von @aiagentgeorg (`Marketing/cgi/vorbilder.md`). Gemeinsame Regeln: **Skill `maios-video`**.

## Ablauf (7 Schritte)
1. **Thema:** eine überraschende, nachprüfbare Frage zum Produkt oder seiner Kategorie (Beispiel: „Warum schmeckt frisch gemahlener Kaffee anders?“ – Produkt 55). Die Brücke zum Produkt muss stimmen: Produkt 50 ist laut products.json eine *leuchtende Kristallkugel mit Motiven*, keine Schneekugel – das Schneekugel-Beispiel aus der Übergabe passt deshalb nicht. Keine gesperrten Themen (compliance_rules), keine Gesundheitsversprechen.
2. **Fakten belegen:** Skill `anthropic-skills:deep-research` oder Websuche; mindestens 2 unabhängige Quellen je Behauptung. Quellen in den vorrat-Abschnitt schreiben. Was nicht belegt ist, fliegt raus.
3. **Sprechertext** (75–110 Wörter für 30–45 s): Hook-Frage (≤ 8 Wörter) → 3–4 Wendungen, je ein Satz, alle 3–5 s etwas Neues → Brücke zum Produkt → Schluss mit Produktwort. Keine Preise sprechen. In den vorrat-Abschnitt.
4. **Stimme:** VoiceStudio mit MOSS-TTS-Nano und Profil **„Thorsten CC0“** (Apache-2.0 + CC0, kommerziell erlaubt). OmniVoice **nie** (nicht kommerziell). Wege:
   - VoiceStudio-MCP, falls eingebunden (`claude mcp add --transport http voicestudio http://127.0.0.1:3900/mcp/ --header "X-OmniVoice-Client-Id: claude-code"`, App muss offen sein; Einbinden nur nach Nevios Ja). Welche Werkzeuge der Server hat, ist ungeprüft.
   - sonst Nevio erzeugt den Satz in VoiceStudio; Ergebnis liegt in `%APPDATA%\OmniVoice\outputs\<id>.wav` → nach `Marketing/videos/rohmaterial/eigenes/stimme/<videoname>.wav`.
   - Fallen: Übergabe-Datei Abschnitt 8 (Patch in v0.5.8, Neustart, Strg+R, „Speichern unter“ kaputt). `test.wav` ist noch nicht von Nevio freigegeben – **vor dem ersten W-Video fragen.**
5. **Wörter timen:** Ziel ist ein Zeitstempel je Wort, damit Untertitel und Bildwechsel genau auf dem gesprochenen Wort sitzen.
   - Besser: **Whisper** lokal (z. B. `faster-whisper`, Modell klein, CPU) mit Wort-Zeitstempeln. **Nicht installiert** – nur nach Nevios Ja.
   - Bis dahin: Sätze einzeln erzeugen und ihre Länge mit `ffprobe` messen; Wörter innerhalb eines Satzes nach Silbenzahl verteilen. Ergebnis als `[[sekunde, "Wort"], …]`.
6. **Szenen bauen:** mit dem Motion-Spot (`maios-motion-spot`, `spot.html`): je Satz eine Szene, `typo`-Szenen mit `takt` aus den Wortzeiten (Karaoke-Effekt), dazwischen echte Fotos (`galerie`/`karte`), Zahlen (`zahl`) und belegte Fakten (`nutzen`). Produkt erst im letzten Drittel. `ende` mit leerem `preis` („Link im Profil“ darf bleiben).
   Hinweis: Wenn öfter W-Videos kommen, lohnt **Remotion** (für Nevio kostenlos, offizielle Claude-Skills `remotion-captions`, `remotion-render`) – Installation nur nach Nevios Ja.
7. **Rendern + Ton:** Musik mit `py Marketing/cgi/spot/musik.py wahl --dauer <s> --stimmung warm --stimme` wählen (ruhiger Abschnitt, Startsekunde `--musik-ab`), dann `render_spot.mjs` → `py Marketing/cgi/spot/spot_ton.py <x>.events.json Marketing/musik/cinematic_soft_96bpm.mp3 --musik-ab <s> <scratch>/ton.wav --spur <stimme>.wav --spur-ab 0.3 --musik-db -10 --ducking 12 --sfx-db -6` (mischt Stimme, Musik unter der Stimme abgesenkt, und normalisiert alles zusammen auf −14 LUFS) → `py Marketing/cgi/lib/finish.py <bild>.mp4 <scratch>/ton.wav <ziel>.mp4 --titel <s> --maxrate 1700k` (45 s × 1,7 Mbit ≈ 9,5 MB). Danach Größe prüfen (≤ 10 MB), sonst `--maxrate` senken, und mit `ton_check.py` prüfen: Stimme muss im Spektrogramm klar über der Musik liegen.

## Untertitel
Fett, groß, mittig im oberen Drittel bis Mitte (nicht in den Sperrzonen), aktuelles Wort in Akzentfarbe, höchstens 2 Zeilen, ganze Sinneinheiten.

## Caption und Kennzeichnung
Zeile 1 Suchphrase mit Thema + Produktbegriff, dann die Frage, ein Satz Neugier, Produkt mit Preis aus products.json, „Link im Profil“, Frage für den Kommentar. Hashtags `#werbung` + 2 Suchbegriffe + 1 Thema. **KI-Kennzeichnung: ja** (KI-Stimme) – Nevio beim Liefer-Paket ausdrücklich sagen.
