---
name: maios-video
description: "Maios-TikTok-Video planen und bauen – Einstieg für JEDES Maios-Video. Wählt das Format (real, Motion-Spot, Wissensvideo, Schnitt aus eigenen Clips, lokale KI), hält die gemeinsamen Regeln (products.json, Werbung-Pille, Sperrzonen, Prüfer, Liefer-Paket, vorrat.md) und ruft den passenden Format-Skill. Nutzen bei: Video bauen/erstellen/machen, TikTok für Slot, Vorproduktion, 'mach ein Video vom …', 'nächstes Video', 'für morgen 12 Uhr'."
argument-hint: "[optional: Produkt-ID/-name, Slot (z. B. 'Mo 12 Uhr'), Format]"
---

# Maios-Video – Einstieg und gemeinsame Regeln

Stand 15.11.2026. Hintergrund: `Marketing/UEBERGABE-CLAUDE-CODE.md`, Vorbilder: `Marketing/cgi/vorbilder.md`.
Bei Widerspruch gilt: Nevios neueste Anweisung im Chat > Übergabe-Datei > `Marketing/trends/vorrat.md` (Kopf) > dieser Skill.

## Harte Regeln (immer)
1. **Nevio lädt selbst hoch und plant selbst.** Claude lädt nichts hoch, plant nichts, postet und kommentiert nichts. TikTok Studio nur lesen, ohne Anmeldung.
2. **Aussagen nur aus `products.json`:** Preis exakt, Farben/Motive, Eigenschaften aus der Beschreibung. Nichts erfinden (keine Funktion, keine Zahl, keine Bewertung, kein Rabatt).
3. **Sperren:** `Marketing/config/compliance_rules.json` (gesperrte Themen, Heilversprechen, Superlative, vorgetäuschte Knappheit) und `Marketing/config/brand_voice.md` vor jedem Text prüfen. Seit 11/2026: keine Streichpreise, kein Countdown, kein „Bestseller“, kein Mengenrabatt.
4. **Keine fremden Clips, Bilder, Texte oder Marken** im Video. Fremde TikToks nur als Referenz (`Marketing/data/tiktok-quellen/`, gitignored). Eigenes Material nur aus `Marketing/videos/rohmaterial/eigenes/`, Fotos aus `produkt bilder/`.
5. **Musik** nur aus `Marketing/musik/` mit `gewerblich_erlaubt: true` in `lizenzen.json` (derzeit: upbeat_house_124bpm, bright_pop_128bpm, clean_minimal_112bpm, lofi_chill_88bpm, cinematic_soft_96bpm). `bett_*.mp3` sind gesperrt.
6. **KI-Kennzeichnung:** KI-Stimme oder KI-Bild/-Video → Nevio sagen: beim Upload „KI-generiert“ setzen. Echte Fotos + eigene Animation + synthetische Klänge = keine Kennzeichnung.
7. Der Projekt-Skill `veroeffentlichen` (lädt über Chrome hoch) gilt seit 9.11. **nicht** – auch bei „poste …“ nicht benutzen, sondern das Liefer-Paket geben.
8. Installieren/Herunterladen nur nach Nevios Ja. Nichts löschen, ohne vorher zu prüfen, was es ist. Secrets nie anfassen.

## Format wählen
| Format | Skill | Wann | Länge |
|---|---|---|---|
| **real** – Galerie echter Shopfotos | `maios-real` (lokal; Konto-Skill `real` = Cloud-Fassung) | Produkt hat ≥ 5 Farben/Motive mit Foto: **17, 33, 43, 47, 50** | 12 s |
| **Motion-Spot** – Fotowand, Produktkarte, Zähler, Haken, Preis (2D-Motion-Design) | `maios-motion-spot` | jedes Produkt mit gutem Foto; neues Format neben real | 10–13 s |
| **W Wissensvideo** – belegte Geschichte, Erzählerstimme, Wort-genaue Untertitel | `maios-wissen` | Stimme freigegeben (VoiceStudio „Thorsten CC0“) | 30–45 s |
| **Schnitt aus eigenen Clips** (POV, Hände-Alltag, Antwort auf Kommentar) | `maios-schnitt` | nur wenn Nevio Clips geliefert hat | 6–25 s |
| **Lokale KI** (Bild-zu-Video aus Shopfoto) | `maios-ki-lokal` | nur auf Nevios RTX-PC, nur als Baustein | 2–4 s Baustein |

Abwechseln: nie zweimal hintereinander dasselbe Format; 12- und 18-Uhr-Video am selben Tag mit verschiedenen Produkten.
Verworfen, nicht wieder bauen: Notiz-Liste (Format A), 3D-Welten/CGI als ganzes Video, Figuren/Mo, Knete, Pop-up-Papier, Glow, Callout-Pills im @mehr.optic-Stil.
Die alten Konto-Skills `maios-video-cgi`, `maios-video-story`, `maios-video-maskottchen` sind durch diese Skills ersetzt (Sicherung: `Marketing/cgi/skill/alt-stand-20261115/`); nur auf Nevios ausdrücklichen Wunsch nutzen.

## Was jedes Video braucht (alle Formate)
- **Erste Sekunde: echtes Produkt** (Foto/Clip) und Bewegung – kein Logo, kein leerer Typo-Bildschirm (Übergabe §5). Ein reiner Typo-/Suchfeld-Einstieg wie in den Claude-Vorbildern nur mit Nevios ausdrücklicher Freigabe.
- **Hook in 0–1 s:** eine Aussage, die eine Frage aufmacht, höchstens 6 Wörter. Kein Preis, keine Auflösung, kein „Link im Profil“ vor 3 s.
- **Werbung-Pille** (oben links, y = 200) und das **Produktwort** daneben – durchgehend sichtbar.
- **Sperrzonen:** oben 10 % (192 px), unten 20 % (ab y 1536), rechts 14 % (ab x 930). Kein Text, kein Preis dort.
- **Eine Aussage pro Einstellung**, jede Einstellung ≤ 2 s (erste bis 4 s, wenn sich darin etwas bewegt; Schlussbild mit Preis bis 3 s). Länge 6–12 s, Motion-Spot bis ~13 s, W 30–45 s.
- **Ende:** Produktwort + Preis exakt + „Link im Profil“ + **Versandhinweis** („Versandkostenfrei in Deutschland“ – Pflicht bei Preisnennung laut `compliance_rules.json` → `preisangaben`; Versand DE = 0 € laut `shipping-calculator.js`). Kein „zzgl./inkl. MwSt.“ (Kleinunternehmer). Format W: kein Preis im Bild, dann auch kein Hinweis nötig.
- **Ton:** −14 LUFS ±1, Spitze ≤ −1 dBTP nach AAC; Datei ≤ 10 MB, 1080×1920, 30 fps, H.264 + AAC. **`finish.py` misst die Lautheit nur, es normalisiert nicht** – normalisiert wird vorher (`spot_ton.py` oder `mix.sh`). Fassung „ohne Musik“ = stumme Tonspur (`anullsrc`).

## Ablauf pro Slot
1. `Marketing/trends/vorrat.md` lesen: welcher Slot ist frei, was lief zuletzt (Format/Produkt-Wechsel). Slot auf „in Arbeit (Lauf TT.MM. HH:MM)“ setzen.
2. **Inspiration (nur lesen):** TikTok Studio → Inspiration, was gerade zieht; optional Kandidat `last30days` (siehe SKILLS-MAIOS.md). Passt es, in Hook oder Hashtags.
3. Format wählen (Tabelle), Format-Skill laden, bauen.
4. **Prüfen:** Standbilder bei 0 / 0,5 / 1,5 / 3 s / Mitte / letztes Bild. Dann **zweiter Prüfer**: Subagent ohne Bau-Vorgeschichte bekommt nur Standbilder, Konfiguration/Text, products.json-Auszug und diese Prüfliste: Hook ohne Auflösung, Preis/Namen exakt, Sperrzonen, Text nicht auf dem Produkt, Einstellungslängen, Tabuwörter, erfundene Funktionen. Muss-Punkte beheben.
5. Dateien nach `Marketing/videos/geschnitten/`: `<NN>_<produkt-slug>_<format>_<YYYYMMDD>.mp4`, dazu `…_ohne_musik.mp4` (stumme Tonspur) und `…_titelbild.jpg`.
6. **Liefer-Paket** in den vorrat-Abschnitt und in den Chat, je Kanal (@maiosshop, @maiosshop.com): Dateiname (mit Musik) · Caption · Hashtags · Datum + Uhrzeit für „Zeitplan“ (12:00/18:00 Europe/Berlin) · Titelbild-Sekunde · angepinnter Kommentar · KI-Kennzeichnung ja/nein.
7. Status in vorrat.md: **„fertig, Nevio lädt hoch“**. Erst wenn Nevio „gepostet/hochgeladen“ meldet: tageslog.md, kennzahlen.csv, Datei nach `geschnitten/hochgeladen/`, Status „von Nevio geplant/gepostet“.

## Caption und Hashtags
- Zeile 1: Suchphrase mit dem Produktbegriff aus products.json (z. B. „Kristallkugel Nachtlampe mit 7 Motiven“). Dann Hook, Nutzen, Preis + „versandkostenfrei in Deutschland“, „Link im Profil“, Entweder-oder-Frage (zwei Farben/Motive/Einsätze aus products.json, gleich dem angepinnten Kommentar).
- @maiosshop.com: Hook-Zeile leicht anders formulieren.
- Hashtags: `#werbung` + 2 Suchbegriffe zum Produkt + 1 Anlass/Kategorie. Keine fremden Trend-Tags ohne Produktbezug.
- Speicher-Treiber (aus der Sichtung 15.11.): Listen-/Wissensinhalte werden gespeichert. Eine ehrliche Zeile wie „Speicher dir das für die Geschenkesuche“ ist erlaubt; keine Belohnung, keine Bedingung fürs Kommentieren.
