---
name: maios-real
description: "Maios-Video „Echt statt KI“ im Galerie-Stil, lokale Fassung für Claude Code: echte Shopfotos aller Farben/Motive eines Produkts, gewischt wie in der Handy-Galerie, 12 s. Nutzen bei 'real', 'Galerie-Video', 'echte Fotos durchwischen', 'wie das mit dem Mond/Tumbler', oder wenn ein Produkt ≥ 5 Farben/Motive mit Foto hat (17, 33, 43, 47, 50). Gemeinsame Regeln: Skill maios-video."
---

# maios-real – Galerie aus echten Shopfotos (lokal)

Lokale Fassung des Cowork-Skills `real` (von Nevio am 13.11. abgenommen). Gemeinsame Regeln, Prüfer und Liefer-Paket: **Skill `maios-video`**.
Vorlagen: `Marketing/videos/geschnitten/` bzw. `hochgeladen/` – `47_tumbler_farben_echt_20261114.mp4`, `50_krystall-ball_galerie_echt_20261114.mp4`.

## Vorbedingungen (Stand 15.11. erfüllt)
- **Pillow 13.0** für `py` installiert (Nevios Ja vom 15.11.), numpy ist da.
- **Poppins** Bold/SemiBold/Medium liegen in `Marketing/cgi/real/fonts/` (SIL OFL 1.1, `OFL.txt` daneben, aus github.com/google/fonts). Fehlen sie, nimmt `common.py` Segoe UI (anderer Look).
- `mix.sh` ist Bash: in Git Bash ausführen (vorhanden).
- Getestet am 15.11. mit Probebildern aus `beispiel_tumbler.json` (+ `end3`); ein ganzes Video wurde lokal noch nicht gerendert.

## Wann
- ≥ 5 Farben/Motive mit eigenem Foto in `products.json` (`colors[].image`). Stand 15.11.: **33** (12 Düfte, englische Namen; Produktname enthält „Aromatherapy“ → keine Wirkversprechen, „therapiert“ ist gesperrt), **47** (9 Einträge, davon 7 echte Farben – „Strohalm“ und „Thermal Sublimation“ sind keine), **50** (7), **17** (6), **43** (5). 47 und 50 liefen am 14.11.
- **Länge hängt an der Fotozahl:** Dauer = 1,5 s × (Fotos − 1) + 3 s. Für 12 s genau **7 Fotos** auswählen (bei 5 Fotos: `seg` 2.0 → 11 s; bei 6: `seg` 1.8 → 12 s).
- Nur echte Fotos, kein 3D, keine Figuren, kein Glow.

## Aufbau (12 s, 30 fps, 1080×1920)
| Zeit | Bild | Text oben (Zeile 1 / Zeile 2) |
|---|---|---|
| 0–1,5 s | Foto 1, Fokus zieht scharf | Hook / Farb- bzw. Motivname |
| alle 1,5 s | Wischen nach links (0,22 s, Bewegungsunschärfe), Fokus-Ziehen | Hook bis 4,5 s, danach ein Nutzen aus products.json / Farbname |
| letzte 3 s | letztes Foto hält | „<Produktwort> <Preis> €“ / „Link im Profil“ (ab 0,4 s nach dem Wechsel) |

- Hook: Aussage mit offener Frage, ≤ 6 Wörter, jedes Mal neu (abgenommen: „Eine kommt unter den Baum.“, „Einer wird mein Winterbecher.“).
- Fotos von dunkel nach hell sortieren. Szenenfotos vor Freistellern.
- `gal.py` setzt Werbung-Pille + Produktwort (y = 200), Text bei y ≈ 280/352 und wählt die Textfarbe selbst.

## Bauen
Arbeitsordner: Repo-Stamm `C:\Users\nevio\Documents\vscode\Maios`. **Alle Zwischendateien (`S` = Scratchpad-Ordner) nie in den Repo-Stamm** (öffentliches Repo).
1. JSON nach `Marketing/cgi/real/beispiel_*.json` (UTF-8): `seg` 1.5, `last` 3.0, `wort`, `hook`, `mid_at` 4.5, `mid`, `end1` („Tumbler 24,99 €“, Preis exakt), `end2` „Link im Profil“, `end3` „Versandkostenfrei in Deutschland“ (Pflicht bei Preisnennung; im Standbild prüfen, dass er lesbar über der Fotokante steht), `items` = [Name wie in products.json, Pfad]. Pfade dürfen `produkt bilder/…` oder `pb/…` sein.
2. Probe: `py Marketing/cgi/real/gal.py x.json S/probe 0.5 3.4 5.0 11.5` → `S/probe_<t>.png` ansehen. Text steht seit 15.11. mittig im erlaubten Bereich (x 465), Hook trotzdem kurz halten.
3. Rendern: `py Marketing/cgi/real/gal.py x.json S/x_video.mp4`
4. Verkleinern: `ffmpeg -i S/x_video.mp4 -c:v libx264 -b:v 3200k -maxrate 3600k -bufsize 6400k -pix_fmt yuv420p S/x_small.mp4`
5. **Ton (Standard seit 15.11.: Musik + Klänge):** `gal.py` schreibt beim Rendern `S/x_video.events.json` (leiser Whoosh auf jedes Wischen, Ting beim Preis).
   Musik: `py Marketing/cgi/spot/musik.py wahl --dauer 12 --stimmung lebhaft` (Farben/Becher „lebhaft“, Nachtlampe/Diffusor „ruhig“, Technik „klar“).
   `py Marketing/cgi/spot/spot_ton.py S/x_video.events.json Marketing/musik/<stück> S/ton.wav --musik-ab <s>` → `py Marketing/cgi/lib/finish.py S/x_small.mp4 S/ton.wav <ziel>.mp4 --titel 0.8` → `py Marketing/cgi/spot/ton_check.py <ziel>.mp4 S/check --events S/x_video.events.json` (Bild ansehen; bei lebhafter Musik ist der Ting oft verdeckt → `--sfx-db +4`).
   Getestet 15.11. (Tumbler, bright_pop ab 3,76 s): −14,2 LUFS, −2,6 dBTP, 7,8 MB, Rendern ~2 min.
   Alter Weg ohne Klänge (Git Bash): `bash Marketing/cgi/real/mix.sh …` – nur noch als Rückfall.
6. Fassung ohne Musik mit stummer Tonspur: `ffmpeg -i S/x_small.mp4 -f lavfi -i anullsrc=r=48000:cl=stereo -shortest -c:v copy -c:a aac …_ohne_musik.mp4`
7. Dateien: `<NN>_<produkt>_<galerie|farben>_echt_<YYYYMMDD>.mp4`, `…_ohne_musik.mp4`, `…_titelbild.jpg` (0,8 s) nach `Marketing/videos/geschnitten/`.

## Prüfen
Standbilder 0 / 0,5 / 1,5 / 3 / 6 s / letztes Bild. Bis 3 s weder Preis noch Link; Werbung + Produktwort durchgehend; Text nicht auf dem Produkt; Sperrzonen frei; Namen + Preis gegen products.json; ≤ 10 MB. Danach zweiter Prüfer (siehe `maios-video`).

## Caption
Zeile 1 Produktbegriff („Tumbler Becher mit Griff und Strohhalm“), Hook, Nutzen bzw. Motive, Preis, „Link im Profil“, Entweder-oder-Frage aus zwei Farben/Motiven. Hashtags `#werbung` + 2 Suchbegriffe + 1 Anlass. KI-Kennzeichnung: nein.
