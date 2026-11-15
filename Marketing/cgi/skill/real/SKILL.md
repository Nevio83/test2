---
name: real
description: Maios-Video „Echt statt KI“ im Galerie-Stil – echte Shopfotos aller Farben/Motive eines Produkts (z. B. 7 Motive der Kristallkugel, 7 Farben des Tumblers), gewischt wie in der Handy-Galerie, 12 s, Handbewegung, Fokus-Ziehen, Filmkorn, Text oben. Nutzen bei „real“, „wie das mit dem Mond“, „Galerie-Video“, „echte Fotos durchwischen“, „Echt statt KI Format B“ oder wenn ein Produkt mehrere Farben/Motive in products.json hat.
---

> **Hinweis für Claude Code (lokal):** Diese Anleitung wurde in Cowork geschrieben. Lokal gilt: Es gibt kein `device_stage_files`, die Fotos liegen direkt unter `produkt bilder\`. Die Skripte liegen in `Marketing/cgi/real/` (oder in `scripts/` neben dieser Datei, wenn du sie kopiert hast). Pfade im JSON (`pb/…`) auf `produkt bilder/…` ändern oder einen Link `pb` setzen. `mix.sh` ist Bash (Git Bash/WSL). Weitere Zusammenhänge: `Marketing/UEBERGABE-CLAUDE-CODE.md`, Abschnitt 7.1.

# real – Galerie-Video aus echten Shopfotos

Von Nevio am 13.11.2026 abgenommen („das ist gut“). Vorlagen:
- `50_krystall-ball_galerie_echt_20261114.mp4` (Nachtlampe, 7 Motive)
- `47_tumbler_farben_echt_20261114.mp4` (Tumbler, 7 Farben)

Beide Videos liegen unter `Marketing\videos\geschnitten\`. Notiz-Listen-Videos (Format A) hat Nevio verworfen und gelöscht, also nicht mehr bauen.

## Wann
- Das Produkt hat in `products.json` mindestens 5 Farben/Motive mit eigenem Foto (`colors[].image`), z. B. 50 Nachtlampe, 47 Tumbler, 33 Aroma-Humidifier, 17 Finder, 43 Thermodrucker.
- Kein 3D, keine Figuren, kein Glow. Nur die echten Fotos aus `produkt bilder\<Produkt> bilder\`.
- Zwei Videos am selben Tag nehmen zwei verschiedene Produkte.

## Aufbau (12 s, 30 fps, 1080x1920)
| Zeit | Bild | Text oben (Zeile 1 / Zeile 2) |
|---|---|---|
| 0–1,5 s | Foto 1, Fokus zieht scharf | Hook als Aussage / Name der Farbe bzw. des Motivs |
| alle 1,5 s | Wischen nach links (0,22 s, Bewegungsunschärfe), dann Fokus-Ziehen | Hook bleibt bis 4,5 s, danach ein Nutzen aus products.json / Farbname |
| letzte 3 s | letztes Foto, hält | „<Produktwort> <Preis exakt> €“ / „Link im Profil“ (ab 0,4 s nach dem Wechsel) |

- **Hook:** eine Aussage, die eine Frage aufmacht, ohne Preis und ohne Auflösung. Abgenommene Beispiele: „Eine kommt unter den Baum.“ und „Einer wird mein Winterbecher.“ Höchstens 6 Wörter. Jedes Video bekommt einen neuen Hook, nie einen kopierten.
- **Mitte:** ein echter Nutzen aus der Beschreibung („Hält bis zu 12 Stunden.“) oder „Ich kann mich nicht entscheiden.“
- **Reihenfolge:** Fotos von dunkel nach hell sortieren, damit der Hintergrund nicht hart springt.
- **Immer im Bild:** oben links die Pille „Werbung“ (schwarz) und daneben das Produktwort (hellgrau), beide bei y = 200, also unter der oberen Sperrzone.
- **Text:** steht oben bei y ≈ 280 und 352, nie auf dem Produkt. Auf dunklem Hintergrund weiß mit dunkler Kontur, auf hellem Hintergrund dunkel ohne Kontur. `gal.py` entscheidet das selbst.
- **Foto:** füllt das Bild (Quadrat auf 1450 px, Oberkante bei y = 420). Die Ränder oben und unten werden aus der Randfarbe gestreckt, ohne unscharfe Balken und ohne Spiegelung. Dazu leichte Handbewegung, 5 % Zoom pro Einstellung und Filmkorn.

## Bauen
Die Skripte liegen in `scripts/`, eine Kopie unter `Marketing\cgi\real\`.
1. Die Fotos aus `products.json` (`colors[].image`) per `device_stage_files` holen. Danach `ln -sfn "/mnt/user-data/uploads/Maios/produkt bilder" pb` im Arbeitsordner.
2. Eine JSON-Datei nach dem Muster `beispiel_*.json` anlegen: `seg` 1.5, `last` 3.0, `wort`, `hook`, `mid_at` 4.5, `mid`, `end1` (Preis exakt aus products.json), `end2` „Link im Profil“ und `items` als Paare [Name wie in products.json, Fotopfad].
3. Zur Probe Standbilder erzeugen: `python3 gal.py x.json probe 0.5 3.4 5.0 11.5`. Dann rendern: `python3 gal.py x.json x_video.mp4` (etwa 1–2 min).
4. Verkleinern: `ffmpeg -i x_video.mp4 -c:v libx264 -b:v 3200k -maxrate 3600k -bufsize 6400k -pix_fmt yuv420p x_small.mp4`.
5. Musik dazu: `./mix.sh x_small.mp4 <musik>.mp3 12.0 X_mit.mp4`. Das macht zweistufiges loudnorm plus Limiter (`level=0`!). Danach mit `ebur128=peak=true` nachmessen. Ziel ist −14 LUFS ±1 und eine Spitze ≤ −1 dBFS, sonst `volume=-0.7dB` drüber. Für die Musik nur eigene Stücke aus `Marketing\musik` (lizenzen.json, gewerblich_erlaubt). Die Fassung ohne Musik bekommt eine stumme Tonspur (`anullsrc`).
6. Dateien: `<NN>_<produkt>_<galerie|farben>_echt_<YYYYMMDD>.mp4` + `_ohne_musik.mp4` + `_titelbild.jpg` (Titelbild 0,8 s) nach `Marketing\videos\geschnitten\`.

## Prüfen
- Standbilder bei 0 / 0,5 / 1,5 / 3 / 6 s und beim letzten Bild ansehen.
- Bis 3 s weder Preis noch Link, Werbung und Produktwort durchgehend, Text nicht auf dem Produkt, nichts in den Sperrzonen (oben 10 %, unten 20 %, rechts 14 %).
- Farb- und Motivnamen sowie den Preis gegen products.json prüfen. Datei ≤ 10 MB.

## Caption (Muster)
- Zeile 1: Produktbegriff, z. B. „Kristallkugel Nachtlampe mit 7 Motiven“ oder „Tumbler Becher mit Griff und Strohhalm“.
- Danach Hook, Nutzen bzw. Aufzählung der Motive, Preis, „Link im Profil“ und eine Entweder-oder-Frage aus zwei Farben/Motiven (gleich dem angepinnten Kommentar).
- Für @maiosshop.com die Hook-Zeile leicht umformulieren.
- Hashtags: #werbung + 2 Suchbegriffe + 1 Anlass/Kategorie.
- KI-Kennzeichnung: nein.

## Grenzen
- Fotos mit weißem Hintergrund (Freisteller) wirken sauber, aber weniger „echt“ als Fotos mit Szene. Szenenfotos bevorzugen, wenn vorhanden.
- Nichts erfinden: nur Farben/Motive, die products.json führt, keine Rabatte, keine Bewertungen.
