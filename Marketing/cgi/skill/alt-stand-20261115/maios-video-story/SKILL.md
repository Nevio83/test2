---
name: maios-video-story
description: "Maios-Story-Videos (20–25 s, 3D/CGI) im Stil von @mehr.optic: Menge gleicher Figuren als Hook, Blueprint-Hintergrund, Explosionsansicht mit Callout-Pills, Tag-Pills, Karaoke-Untertitel in fetter Kursivschrift, Neon-Preis. Fragt zuerst, welcher der vier Maios-Video-Typen gewünscht ist. Nutzen bei Story-Video, 'wie mehr.optic', Video planen, Beat-Sheet."
---

# Maios Video 3: Story im @mehr.optic-Stil

## Schritt 0: Videotyp klären (immer zuerst)
Es gibt vier Maios-Video-Skills. Bevor du etwas baust, frage Nevio mit AskUserQuestion, welcher Typ es sein soll (eine Frage, vier Optionen):
1. **CGI-Produktvideo** → Skill `maios-video-cgi` (Produkt in 3D, Loop 7–9 s)
2. **Maskottchen Mo** → Skill `maios-video-maskottchen` (Figur Mo, Mini-Geschichte, ggf. Stimme)
3. **Story im @mehr.optic-Stil** → Skill `maios-video-story` (20–25 s, Blueprint, Explosionsansicht, Karaoke-Untertitel)
4. **Echtes Video aus Rohmaterial schneiden** → Skill `maios-video-rohschnitt`
Passt die Antwort nicht zu diesem Skill, lade den passenden mit dem Skill-Tool und arbeite dort weiter. Läuft die Aufgabe ohne Nevio (Routine/Zeitplan), nicht fragen: Typ aus `Marketing\trends\vorrat.md`-Zeile im Slot, sonst Story, und die Wahl in einem Satz nennen. Danach, falls Nevio das Produkt nicht genannt hat, auch das Produkt klären (Produkt-Nr. aus products.json).

Dieser Skill: **Typ 3**. Story-Clips der Vorbilder holen 300K–1M Aufrufe, reine Produktclips 2K–90K. Deshalb ist die Story ab 9.11.2026 der Standard für die Routine, der Loop (Typ 1) das Zweitformat.

## Planen (vor dem Bauen)
1. Produkt und Aussagen NUR aus products.json (Preis, Farben, Beschreibung).
2. Beat-Sheet schreiben: pro Beat Dauer, Bild, Untertitel (≤ 6 Wörter), Einblendung.
3. Referenz ansehen: `Marketing\cgi\vorbilder.md`, bei Bedarf @mehr.optic erneut ansehen (nur lesen).

## Beat-Sheet (Vorlage, ca. 20 s)
| Zeit | Beat | Inhalt |
|---|---|---|
| 0–2,6 | Hook als Aussage | Menge gleicher Figuren (7) vor Neon-Stadt, Problem als Satz („Jeden Morgen dieselbe Gallone.“). Bewegung ab Frame 0 |
| 2,6–5 | Problem | Eine Figur fällt aus der Reihe (goldener Ring, rotes ✕, Pfütze) |
| 5–7,6 | Eine Idee | Blueprint-Hintergrund (Blau + Raster), Produkt weiß mit gelben Kontur-Glows, Tag „EINE IDEE“ |
| 7,6–11 | Teile | Explosionsansicht, zwei Callouts (dunkle Pill + gepunktete Linie), Tag mit Hauptvorteil |
| 11–16 | Beweis | Produkt in echter Szene (Schreibtisch), Funktion sichtbar (Wasser füllt Glas) |
| 16–20,5 | Preis + CTA | Neon-Preis (pink), Tag mit Farben („WEISS ODER SCHWARZ“), „Link im Profil“ ab ca. 1 s nach dem Preis, Ende ≤ 1 s nach CTA |

## Stilregeln (aus der @mehr.optic-Analyse)
- Untertitel: Großbuchstaben, fett kursiv (Manrope 74 px), Karaoke (gesprochene Wörter weiß, kommende gedimmt), Position y ≈ 1350 px, nie auf dem Produkt.
- Tag-Pills klein, weiß oder gold, oben über dem Produkt. Callouts: dunkle Pill mit gepunkteter Leitlinie. Preis in Neon pink mit Glow.
- Alle 2–3 s etwas Neues, harte Schnitte, Zeitraffer-/Wisch-Übergänge, Kamera immer in Bewegung.
- Figuren: eigene Figur (`lib/figur_pro.js`, matt, erwachsen), nie fremde Figuren kopieren.
- Caption: Geschichte in einem Satz + Neugier, Produktbegriff als Suchphrase; Produktclips laufen daneben als zweite Reihe.

## Baukasten
- `lib/story_kit.js`: `makeKit(ov)` → `subtitle(words, nWhite, tl, out)`, `tagPill(text, tl, gold, out, top)`, `callout(i, text, tl, fromPx, toPx, out)`, `mark(i, 'no'|'ok', tl, x, y, out)`, `neonNum(text, tl, out, top)`, `hideAll()`; `STORY_CSS` einbinden.
- Referenz-Szene: `scenes/wasser_story.js` + `wasser_story.html` (Beats `BEATS = [[0,2.6,'crowd'],[2.6,5.0,'kipp'],[5.0,7.6,'idee'],[7.6,11.0,'teile'],[11.0,13.8,'hero1'],[13.8,16.2,'hero2'],[16.2,20.5,'preis']]`), Ton `scenes/wasser_story_ton.py` (Lo-Fi, schleppend bis zum Drop bei Beat „Idee“).
- Ablauf: Szene bauen → `py lib/render.py <seite>.html --stills 1,3.9,6,9.6,12.5,15,18.5 --stilldir out/E` → Board ansehen (Callout nicht auf Untertitel, Produkt nicht abgeschnitten, Ring/Pfütze nicht zu groß) → Render im Hintergrund mit `setsid nohup … &` (ca. 4–6 s/Bild, 20 s ≈ 40–60 min; ein einfaches `&` kann beim Verzeichniswechsel der Shell sterben) → Ton → `finish.py` **ohne** `--loop`, `--titel` = Sekunde mit Produkt/Preis.
- Belichtung: Spot ≈ 70, Key 0,8, Belichtung 0,8, Bloom 0,16/0,95; sonst überstrahlt der Beweis-Shot.

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

