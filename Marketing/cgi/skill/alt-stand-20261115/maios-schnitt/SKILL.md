---
name: maios-schnitt
description: "Maios-Video aus Nevios EIGENEN Handyclips schneiden (ffmpeg): POV-Clip, Hände-Alltag (Paket → auspacken → Problem → Einsatz → Ergebnis), Antwort auf einen echten Kommentar. Nur Material aus Marketing/videos/rohmaterial/eigenes/. Nutzen bei Clips schneiden, Rohschnitt, eigene Aufnahmen, Hände-Video, Unboxing, Antwortvideo, Format C/H/K. Gemeinsame Regeln: Skill maios-video."
---

# maios-schnitt – eigene Clips zum fertigen Video

Wirkt laut Zahlen am besten (alte echte Clips: 17–28 % ganz angeschaut, CGI: 2,5–5 %). Gemeinsame Regeln: **Skill `maios-video`**. Ältere, ausführliche ffmpeg-Notizen: Archiv `Marketing/cgi/skill/maios-video-rohschnitt.skill` (dessen Teil „fremdes TikTok-Material verwenden“ gilt **nicht** mehr).

## Material
- **Nur** `Marketing/videos/rohmaterial/eigenes/` (Nevios Aufnahmen; Anleitung zum Filmen: `LIESMICH.md` dort – 5 Einstellungen à 3–6 s, nur Hände, kein Gesicht).
- Fremde Clips nie, auch nicht als Ausschnitt. Fehlt Material: Nevio konkret sagen, welche 5 Einstellungen er filmen soll.

## Formen
| Form | Aufbau | Länge |
|---|---|---|
| **POV** | ein echter Clip, oben ein Alltagssatz („POV: …“), Produkt in Aktion ab Bild 0 | 6–10 s |
| **Hände-Alltag (H)** | Paket kommt → öffnen → Problem („nervt“) → Produkt im Einsatz → Ergebnis; Schnitt alle 1–1,5 s; optional Stimme mit Ein-Wort-Untertiteln | 15–25 s |
| **Vorher/Nachher** | feste Kamera, gleicher Ausschnitt, eine Änderung | 8–12 s |
| **Antwort auf Kommentar (K)** | Frage oben als Text (ohne Nutzernamen), Antwort nur aus products.json; Nevio postet in der App über „Mit Video antworten“ | 7–15 s |
| **Liste „3 Dinge vor dem Kauf“** | drei Clips, je eine ehrliche Angabe aus products.json als Text | 12–15 s |

## Technik (ffmpeg, vom Repo-Stamm)
- Auf 9:16 bringen: `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30"`
- Ausschnitt: `-ss <start> -t <dauer>` vor `-i` (schnell) – danach Länge prüfen.
- Zusammenfügen: Clips einzeln auf gleiches Format rendern, dann `concat`-Filter (nicht den concat-Demuxer bei gemischten Quellen).
- **Text-Overlays:** ffmpeg `drawtext` stürzte am 15.11. hier mit Fontconfig-Fehler ab. Daher Overlays als transparentes PNG erzeugen – z. B. mit `render_spot.mjs --stills` aus einer Seite mit transparentem Hintergrund – und per `overlay` einblenden; oder `drawtext` mit `fontfile='C\:/Windows/Fonts/segoeuib.ttf'` vorher an einem Bild testen.
- Werbung-Pille + Produktwort (y = 200) und Textstil wie in `maios-real`/`maios-motion-spot`: weiß mit dunkler Kontur oder weißer TikTok-Kasten, keine Pills im Text, kein Glow.
- Ton: Originalton behalten, wenn er echt wirkt (Auspacken, Klicken). Originalton aus dem Schnitt ziehen (`ffmpeg -i schnitt.mp4 -vn -ac 2 -ar 48000 S/original.wav`), Musik vorher mit `py Marketing/cgi/spot/musik.py wahl --dauer <s> --stimmung <…>` wählen (Schnitte möglichst auf den Schlag), dann `py Marketing/cgi/spot/spot_ton.py S/ev.json Marketing/musik/<stück>.mp3 S/ton.wav --musik-ab <s> --spur S/original.wav --ducking 6`; Klänge auf Bewegungen (Deckel auf, Klick am Gerät) als Ereignisse eintragen; zum Schluss `ton_check.py` (`S/ev.json` = `{"dauer": <s>, "events": []}` oder mit Klängen) – das mischt und **normalisiert** auf −14 LUFS. Dann `py Marketing/cgi/lib/finish.py schnitt.mp4 S/ton.wav <ziel>.mp4 --titel <s>` (finish.py misst nur). Zwischendateien ins Scratchpad.

## Prüfen
Kein Gesicht, keine fremden Marken/Logos/Personen im Bild, keine Adressen oder Paketlabels mit Namen lesbar, Produkt zeigt nur, was products.json hergibt. Danach Standard-Prüfung und zweiter Prüfer (`maios-video`). KI-Kennzeichnung nur, wenn eine KI-Stimme drin ist.
