---
name: maios-duell
description: "Maios-Duell-Video ('Dies oder das', ~10 s): zwei echte Shopfotos treten gegeneinander an – Karten fliegen von links und rechts ein, 'oder' springt auf, erst links, dann rechts wird angetippt, 2–3 Runden, danach Anzahl der Motive und Preis-Endkarte. Lädt zum Kommentieren ein ('Welche nimmst du?'). Ohne echte Clips, rendert ohne Installation. Nutzen bei Duell, 'dies oder das', 'this or that', Entweder-oder, Abstimmung, 'welche Farbe', Produkte mit mehreren Farben/Motiven. Gemeinsame Regeln: Skill maios-video."
---

# maios-duell – „Dies oder das“ mit echten Fotos

Neu am 15.11. statt `maios-schnitt` (Nevio: erstmal nicht mit echten Clips arbeiten). Abgeschaut aus den Vorbildern
(`Marketing/cgi/vorbilder.md`): App-Elemente, die sich selbst bedienen (Antippen, Hervorheben), ein Gedanke pro Bild,
eine Markenfarbe – dazu das TikTok-typische „This or That“, das Kommentare auslöst. Gemeinsame Regeln, Ton-Pflicht,
Prüfer, Liefer-Paket: **Skill `maios-video`** und `Marketing/VIDEO-HANDBUCH.md`.

## Wann
- Produkt mit ≥ 4 Farben/Motiven mit eigenem Foto (17, 33, 43, 47, 50) – oder zwei verschiedene Produkte derselben
  Kategorie (dann zwei Produktwörter und zwei Preise korrekt; Endkarte nur für eines).
- Nicht zweimal hintereinander mit `maios-real` am selben Produkt (beide zeigen die Farben).

## Aufbau (Standard ~10 s, Einstellungen 2 s)
| Zeit | Szene | Inhalt |
|---|---|---|
| 0–2 s | `duell` Runde 1 | Hook oben (`oben`, z. B. „Du darfst nur eine behalten.“), zwei Motive, „oder“, links → rechts angetippt |
| 2–4 s | `duell` Runde 2 | zwei andere Motive |
| 4–6 s | `duell` Runde 3 | zwei andere Motive (optional) |
| 6–7,6 s | `zahl` | Anzahl Motive/Farben aus products.json („7“ / „Motive zur Wahl“) |
| 7,6–10,2 s | `ende` | Produktwort, Preis exakt, „Link im Profil“, Versandhinweis |

- Echtes Produkt ab Bild 0 (Karten fliegen sofort ein), bis 3 s kein Preis.
- Unter den Karten nur „Runde 1/2/3“ oder eine kurze Frage (`frage`), **keine Zahlen, die wie Abstimmungsergebnisse aussehen**
  (keine Prozente, keine „87 % wählen …“) – das wäre erfunden.
- Die angetippte Karte ist keine Empfehlung, nur Bewegung: immer erst links, dann rechts.
- Caption und angepinnter Kommentar: dieselbe Entweder-oder-Frage („Mond oder Saturn?“).

## Bauen (vom Repo-Stamm aus)
1. Musik zuerst: `py Marketing/cgi/spot/musik.py wahl --dauer 10.2 --stimmung lebhaft` (bei Nachtlampe/Diffusor „ruhig“).
2. Konfiguration nach `Marketing/cgi/spot/beispiel_duell.json` (UTF-8): je Runde `{"typ":"duell","dauer":2.0,"links":[Name, Foto],"rechts":[Name, Foto],"frage":"Runde 1"}`;
   optional `tipp_a`/`tipp_b` (Sekunden der Antipp-Momente, Standard 0,85/1,3), `vs` (Standard „oder“).
   Namen exakt wie `colors[].name` in products.json.
3. Standbilder: `node Marketing/cgi/spot/render_spot.mjs <cfg>.json --stills 0.15,0.5,1.0,1.5,2.5,6.5,9.5 --dir <scratch>/duell` → ansehen.
4. Video: `node Marketing/cgi/spot/render_spot.mjs <cfg>.json --out <scratch>/x_bild.mp4` (10 s ≈ 50–65 s Rechenzeit).
5. Ton: `py Marketing/cgi/spot/spot_ton.py <scratch>/x_bild.events.json Marketing/musik/<stück> <scratch>/ton.wav --musik-ab <s>` →
   `py Marketing/cgi/lib/finish.py <scratch>/x_bild.mp4 <scratch>/ton.wav Marketing/videos/geschnitten/<NN>_<slug>_duell_<YYYYMMDD>.mp4 --titel 1.0` →
   `py Marketing/cgi/spot/ton_check.py <fertig>.mp4 <scratch>/check --events <scratch>/x_bild.events.json`.
6. Fassung ohne Musik mit stummer Spur (siehe `maios-motion-spot`, Schritt 6).

Getestet 15.11. mit `beispiel_duell.json` (Produkt 50, 3 Runden): 10,2 s, 3,8 MB, −14,7 LUFS, −2,7 dBTP, 10/17 Klänge hörbar.
Testvideo: `Marketing/videos/geschnitten/_test_50_krystall-ball_duell_20261115.mp4`.

## Prüfen
Prüfliste aus `maios-video`, plus: Namen unter den Karten = products.json, Fotos zeigen wirklich das genannte Motiv,
keine erfundenen Stimmen-/Prozentzahlen, „oder“-Badge über den Karten sichtbar, Karten innerhalb x ≤ 930.
KI-Kennzeichnung: nein.
