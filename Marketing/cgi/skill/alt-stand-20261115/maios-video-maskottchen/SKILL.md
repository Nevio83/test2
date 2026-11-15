---
name: maios-video-maskottchen
description: "Maios-Videos mit dem Maskottchen Mo (eigene 3D-Comicfigur): Mini-Geschichte mit Gegensatz Problem → Produkt, Untertitel statt Stimme, optional Erzählerstimme für die Mo-Story-Serie (mittwochs 12 Uhr). Fragt zuerst, welcher der vier Maios-Video-Typen gewünscht ist. Nutzen bei Mo, Maskottchen, Figur, Mo-Story, Story mit Figur."
---

# Maios Video 2: Maskottchen Mo

## Schritt 0: Videotyp klären (immer zuerst)
Es gibt vier Maios-Video-Skills. Bevor du etwas baust, frage Nevio mit AskUserQuestion, welcher Typ es sein soll (eine Frage, vier Optionen):
1. **CGI-Produktvideo** → Skill `maios-video-cgi` (Produkt in 3D, Loop 7–9 s)
2. **Maskottchen Mo** → Skill `maios-video-maskottchen` (Figur Mo, Mini-Geschichte, ggf. Stimme)
3. **Story im @mehr.optic-Stil** → Skill `maios-video-story` (20–25 s, Blueprint, Explosionsansicht, Karaoke-Untertitel)
4. **Echtes Video aus Rohmaterial schneiden** → Skill `maios-video-rohschnitt`
Passt die Antwort nicht zu diesem Skill, lade den passenden mit dem Skill-Tool und arbeite dort weiter. Läuft die Aufgabe ohne Nevio (Routine/Zeitplan), nicht fragen: Typ aus `Marketing\trends\vorrat.md`-Zeile im Slot, sonst Story, und die Wahl in einem Satz nennen. Danach, falls Nevio das Produkt nicht genannt hat, auch das Produkt klären (Produkt-Nr. aus products.json).

Dieser Skill: **Typ 2**. Grundlage ist der CGI-Ablauf aus `maios-video-cgi` (Generator holen, Modell, Storyboard, Stills, Ton, Render, Finish). Lade ihn zusätzlich, wenn du Details zu three.js, Licht oder Materialien brauchst.

## Mo – die Figur
- Zwei Varianten im Generator (`Marketing\cgi\lib\`):
  - `figur_pro.js`: erwachsene, matte Variante (dunkle Haare, Pullover, matte Materialien, dünne Gesichtslinien). **Standard**, seit Nevio die erste Version „zu kindlich“ fand (9.11.2026).
  - `figur.js`: Comicfigur mit großem Kopf, Kulleraugen, Schlafanzug mit Sternen. Nur für Gute-Nacht-Stories (Nachtlampe, Projektor), wo es passt, und nur wenn Nevio nichts anderes will.
- API: `makeKid()` liefert `{group, body, arms, head, eyes, torso, set()}`; `set({look, blink, eye, mouth, open, brow, armL, armR, fwd, headTilt, headTurn, nod})` ist zustandslos pro Bild.
- Mo ist die wiederkehrende Marken-Figur: gleiche Form und Farben in jedem Video, neue Szene, neues Problem. Nicht anderen Figuren (@mehr.optic orange Kugelköpfe, @cano Kioskfigur) nachbauen.

## Geschichten-Bauplan (wie bei den Vorbildern: Gegensatz pro Clip)
1. **Hook (0–3 s):** Mo steckt im Alltagsproblem, Satz als Aussage („Jeden Morgen dieselbe Gallone.“). Bewegung ab Bild 0, keine Auflösung.
2. **Problem eskaliert (3–7 s):** das Übliche geht schief (Gallone kippt, Pfütze; Socken als Wichtelgeschenk). Gestik und Gesicht tragen die Geschichte (Brauen, Mund, Augen).
3. **Wendung (7–12 s):** Produkt tritt auf, Mo reagiert (Staunen).
4. **Beweis (12–17 s):** Produkt in Aktion, nur was products.json hergibt.
5. **Abbinder (bis 1 s):** Preis + „Link im Profil“.
Länge: Loop-Variante 8 s (Ende läuft in den Anfang) oder Story 20–25 s (Untertitel im Karaoke-Stil, `lib/story_kit.js`).
Referenzen: `scenes/wasser_figur2.js` (Loop), `scenes/story_kugel.js` (Story, Nachtlampe), `scenes/wasser_story.js` (Story, Figurenmenge).

## Stimme (nur Mo-Story 4.11. und 11.11., Test, nur auf Wunsch)
- `lib/stimme.py` (Piper, deutsche Stimme Thorsten): Text mit Startsekunden als JSON `[[0.1, "Als Kind hatte ich …"], …]`, Modell `Marketing\data\piper\piper\de_DE-thorsten-high.onnx` + `.onnx.json` in den Container holen, `pip install piper-tts`.
- `py lib/stimme.py out/ton_mit_musik.wav out/text.json out/ton_mit_stimme.wav --modell <onnx>`, dann `py lib/finish.py out/bild.mp4 out/ton_mit_stimme.wav out/<ziel>.mp4 --titel <s>`. Meldet das Werkzeug „Zeile zu lang“: Text kürzen. Beide Fassungen bekommen die Stimme. Nevio findet die Stimme gut. Beim Upload „KI-generiert“ = ja.
- Ohne Stimme: Untertitel lesen die Geschichte, Musik Lo-Fi, Pops auf Einblendungen.

## Mo bauen: Fallstricke
- Kopf nicht vor dem Text (Kopf, Ring und Text überlappen leicht): Kamera und Text getrennt prüfen.
- Figur nicht zu groß im Bild beim Beweis-Shot; Produkt muss lesbar bleiben.
- Menge gleicher Figuren (Hook): Kamera auf (0,1.3,10) mit fov 40, Hauptfigur in der Mitte, Ring (gold) und rotes ✕ nur an ihr.
- Wasser/Weiß vor hellem Grund verschwindet: dunkle Wand (z. B. `#16232b`), Randlicht kühl, Sonne nur als schwacher Fleck.

## Gemeinsame Regeln (gelten für alle vier Typen)
- **Quellen:** `Marketing\cgi\README.md` Abschnitt „Regeln ab 28.10.2026“ geht vor; `Marketing\cgi\vorbilder.md` (Vorbilder @mehr.optic, @cano.essentials); `products.json` ist die einzige Quelle für Preis, Farben, Beschreibung. Alles liegt auf Nevios PC unter `C:\Users\nevio\Documents\vscode\Maios` (remote-devices-Tools; Generator per `device_stage_files` in den Container nach `/home/claude/studio`, `npm install`, three@0.170.0).
- **Hook:** Aussage statt Frage, keine Auflösung in den ersten 3 s (Dateizeit), ab Bild 0 Bewegung, Produktwort klein in den ersten 3 s, „Werbung“-Pille oben links durchgehend.
- **Tempo:** Einstellungen höchstens 2 s (erste bis 4 s, wenn sich darin etwas bewegt; Story bis 3 s), etwas Neues alle 1,5–3 s. Text zeigt nur, was das Bild zeigt, höchstens 6 Wörter pro Einblendung.
- **Textzonen:** Nie auf dem Produkt, nicht in den Sperrzonen (oben 10 %, unten 20 %, rechts 14 %).
- **Inhalt:** Nur Angaben aus products.json; kein Streichpreis, keine Rabatt-Sticker, keine erfundenen Bewertungen/Bestände. Eine Produktfarbe im Ablauf, die lieferbaren Farben höchstens am Ende. Produkt macht nur, was es kann. Keine Fake-Reichweite. Massagepistole: nichts über Schmerz/Heilung. Kein Religions-/Identitäts-Hook.
- **Stimme:** Keine Stimme im Video, außer in den zwei Mo-Storys (4.11./11.11.) und nur wenn Nevio es verlangt; dann Upload als KI-generiert kennzeichnen.
- **Ton/Datei:** 1080x1920, 30 fps, −14 LUFS, Spitze ≤ −1 dBTP nach AAC, ≤ 10 MB, Fassung mit und ohne Musik, Musik muss für Business-Konten taugen (eigene Stücke aus `lib/klang.py`/`lib/musik.py`).
- **Dateinamen:** `<NN>_<produkt>_<format>_<art>_<YYYYMMDD>.mp4` (+ `_ohne_musik.mp4`, `_titelbild.jpg`) nach `Marketing\videos\geschnitten\` (Datum = Slot-Datum; Überarbeitung `_v2`); geänderte Generator-Dateien zurück nach `Marketing\cgi\`.
- **Prüfen vor Nevio:** Standbilder bei 0 / 0,5 / 1,5 / 3 s, Mitte, Ende; Board ansehen; Prüfsheet; Zweitblick durch einen Subagenten, der den Bau nicht kennt (Einstieg, Auflösung zu früh, Produkt echt, anders als frühere Videos, Preis/Angaben gegen products.json).
- **Lieferung (Nevio lädt selbst hoch, seit 9.11.2026):** Claude lädt NICHTS hoch, plant nichts, postet, kommentiert und pinnt nichts, öffnet TikTok Studio nur lesend. Pro Kanal (@maiosshop, dann @maiosshop.com, dieselbe Datei) ein kopierbares **Eingabe-Paket**: Dateiname (mit Musik; Datei per SendUserFile), Caption (Zeile 1 Suchphrase aus products.json oder Anlass + Preis, dann Hook, Nutzen, Preis, „Link im Profil“, Entweder-oder-Frage), Hashtags (#werbung + 2 Suchbegriffe + 1 Anlass, keine Trend-Tags ohne Suchabsicht), Datum + Uhrzeit für „Zeitplan“ (12:00 oder 18:00 Europe/Berlin), Titelbild-Sekunde (Produkt + Produktwort sichtbar), Text für den angepinnten Kommentar, KI-Kennzeichnung ja/nein. Freigabe durch Nevio vor dem Eingabe-Paket; Abschnitt „### <Slot>“ in `Marketing\trends\vorrat.md` führen.
- **Vorbilder, Urheberrecht:** Figuren, Layouts und Marken der Vorbilder nie 1:1 nachbauen; eigene Form, eigene Marken-Farben.

