---
name: maios-motion-spot
description: "Maios-Motion-Spot: 10–13-s-Werbespot als 2D-Motion-Design im Stil der 'mit Claude gebaut'-TikToks – Fotowand aus echten Shopfotos ab Bild 0, Produktkarte mit Herz 'Gespeichert', Zähler mit Ring, Haken-Liste, Preis-Endkarte mit Versandhinweis, Klick-/Whoosh-Töne genau auf der Animation; optional Typo Wort für Wort und Suchfeld, das sich tippt. Rendert ohne Installation (Chrome + ffmpeg). Nutzen bei Motion-Spot, Motion Design, Animation, 'wie die Claude-Videos', App-Look, Spot, '3 Dinge vor dem Kauf'. Gemeinsame Regeln: Skill maios-video."
---

# maios-motion-spot – 2D-Motion-Design aus echten Fotos

Gelernt aus 5 Vorbildern (Runde 2 in `Marketing/cgi/vorbilder.md`): Was trägt, ist **sauberes 2D-Motion-Design** – ein Gedanke pro Bild, Elemente, die sich selbst bedienen, eine Markenfarbe, weiche Unschärfe-Übergänge. **Keine 3D-Welt, kein KI-Look.** Gemeinsame Regeln, Prüfer, Liefer-Paket: **Skill `maios-video`** (dort u. a.: echtes Produkt in der ersten Sekunde, Einstellungen ≤ 2 s, Versandhinweis).

## Werkzeuge (im Repo, getestet am 15.11.)
- `Marketing/cgi/spot/spot.html` – Vorlage; Szenen aus einer JSON-Konfiguration, alles hängt nur an der Zeit (deterministisch).
- `Marketing/cgi/spot/render_spot.mjs` – rendert mit installiertem Chrome (eigenes Profil) + ffmpeg, **keine Pakete nötig**, braucht **Node ≥ 22** (lokal 24). 11 s Video ≈ 30 s Rechenzeit.
- `Marketing/cgi/spot/spot_ton.py` – Musik + synthetische Klänge auf die Ereignisse, normalisiert auf −14 LUFS (nur numpy + ffmpeg).
- `Marketing/cgi/lib/finish.py` – Bild + Ton zusammen, misst Lautheit, Titelbild (normalisiert **nicht**).
- Beispiel: `Marketing/cgi/spot/beispiel_kugel.json` (Produkt 50, 11,2 s, −14,2 LUFS, −1,4 dBTP, 3,9 MB).

## Szenen-Bausteine (`"typ"` in `szenen`)
| typ | Felder | Wirkung | Klänge |
|---|---|---|---|
| `galerie` | `fotos` [[Name, Pfad]…] (bis 9), `held` (Index), `held_ab` (s), `namen: true` = Etiketten (liegen im Foto → nur bei freiem Rand) | Bildwand fliegt ein und driftet, eine Karte wird groß – endet genau auf dem Foto der `karte` (Anschluss ohne Sprung) | whoosh, pop |
| `karte` | `foto`, `name`, `nutzen`, `tap` (s), `toast` | Produktkarte, Herz wird angetippt → „Gespeichert“ | whoosh, klick, pop |
| `zahl` | `wert`, `label`, `zaehl` (s), `ring_an` | Zahl zählt hoch, Ring füllt sich – nur echte Zahlen (Anzahl Motive/Farben) | tipp, ting |
| `nutzen` | `zeilen` (2–3, je ≤ 30 Zeichen, nur aus products.json), `takt` | Haken zeichnen sich, Zeilen gleiten ein | ting |
| `typo` | `text` (`\|` = Zeilenumbruch, `*wort*` = Akzentfarbe), `klein`, `takt` | Wörter erscheinen nacheinander, unscharf → scharf | tipp |
| `suche` | `text`, `platzhalter`, `status`, `cps` | Suchfeld fährt ein, tippt, Lupe wird gedrückt | whoosh, tipp, klick |
| `ende` | `wort`, `preis` („16,99 €“ exakt; leer bei Format W), `hinweis` (Standard „Versandkostenfrei in Deutschland“), `link` | Produktwort, Preis, „Link im Profil“, Versandhinweis, MAIOS | whoosh, ting |

Oben: `wort` (Produktwort neben „Werbung“, immer sichtbar), `oben` (Hook als feste Zeile im weißen TikTok-Kasten, y ≈ 300 – so steht der Hook ab Bild 0 über dem echten Produkt), `farbe` (Akzent passend zum Produkt), `hintergrund` [hell, etwas dunkler].
`typo` und `suche` zeigen kein Produkt → **nie als erste Szene** (Übergabe §5), außer Nevio gibt diesen Einstieg ausdrücklich frei; in der Mitte höchstens 2 s.

## Dramaturgie (Vorlagen, Einstellungen ≤ 2 s, erste ≤ 4 s)
- **Entdecken (Standard, ~11 s, = Beispiel):** `oben`-Hook · galerie 3 s → karte 2 s → zahl 1,6 s → nutzen 2 s → ende 2,6 s.
- **Drei Gründe (~11 s):** galerie oder karte zuerst → zahl („3“ / „Gründe“) → nutzen (3 Zeilen) → ende.
- **Vor dem Kauf wissen (~12 s, wird gespeichert):** karte zuerst, `oben`: „3 Dinge vor dem Kauf“ → nutzen mit ehrlichen Angaben aus products.json (auch Einschränkungen wie „Batterien nicht enthalten“, falls dort genannt) → zahl/galerie → ende.
- **Viele Motive (17/33/43/47/50):** galerie mit allen Farben (`held` = Lieblingsmotiv) → karte → zahl (Anzahl) → ende.
Hook: Aussage mit offener Frage, ≤ 6 Wörter, jedes Mal neu, ohne Preis. Bis 3 s kein Preis (auch nicht „unter 20 €“).

## Bauen (vom Repo-Stamm aus; Zwischendateien ins Scratchpad, nie in den Repo-Stamm)
1. Konfiguration `Marketing/cgi/spot/<NN>_<slug>.json` (UTF-8). Fotos = Pfade aus products.json (`colors[].image`/`image`), relativ zum Repo-Stamm.
2. Standbilder: `node Marketing/cgi/spot/render_spot.mjs Marketing/cgi/spot/<datei>.json --stills 0,0.5,1.5,3,<je Szene eins>,<Ende> --dir <scratch>/spot` → als Bogen ansehen.
3. Video: `node Marketing/cgi/spot/render_spot.mjs <datei>.json --out <scratch>/x_bild.mp4` (schreibt auch `x_bild.events.json`).
4. Musik wählen: `py Marketing/cgi/spot/musik.py wahl --dauer <s> --stimmung klar` (Spot-Standard „klar“; Geschenk/Abend „warm“/„ruhig“, viele Farben „lebhaft“). Am besten **vor** Schritt 1, damit die Szenendauern auf die Schlaglänge passen.
   Ton: `py Marketing/cgi/spot/spot_ton.py <scratch>/x_bild.events.json Marketing/musik/<stück> <scratch>/x_ton.wav --musik-ab <s>` (`--musik-db`, `--sfx-db`).
5. Fertig: `py Marketing/cgi/lib/finish.py <scratch>/x_bild.mp4 <scratch>/x_ton.wav Marketing/videos/geschnitten/<NN>_<slug>_spot_<YYYYMMDD>.mp4 --titel 0.8`, dann **hören**: `py Marketing/cgi/spot/ton_check.py <fertig>.mp4 <scratch>/check --events <scratch>/x_bild.events.json` → −14 LUFS ±1, TP ≤ −1, ≤ 10 MB, `ton_bild.png` ansehen.
6. Ohne Musik (stumme Spur): `ffmpeg -i <scratch>/x_bild.mp4 -f lavfi -i anullsrc=r=48000:cl=stereo -shortest -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac …_ohne_musik.mp4`
7. Bewegung prüfen: `ffmpeg -i <fertig>.mp4 -vf "fps=2,scale=216:-2,tile=6x4:padding=3" -frames:v 1 <scratch>/bogen.jpg`.

## Neue Bausteine ergänzen
In `spot.html` `B.<typ>={bau(r,s){…},set(lt,s){…}}`: `bau` legt Elemente an und meldet Klänge mit `ev(s.t0+sek,'klick'|'tipp'|'whoosh'|'pop'|'ting',stärke)`, `set` setzt alles nur aus der lokalen Zeit `lt` (Zufall nur über `rng(seed)`, keine CSS-Transitions). Layout in den erlaubten Bereich: x ≤ 930, y 192–1536. Ideen aus den Vorbildern, noch nicht gebaut: Karte mit Preis-Punkten, Prozentring, Buchstaben, die einzeln einfliegen, isometrische Szene mit Kamerafahrt.

## Prüfen
Prüfliste aus `maios-video` plus: Fotos unverzerrt, kein Text auf dem Produkt, Namen/Zahlen/Preis gegen products.json, keine fremden Marken. KI-Kennzeichnung: **nein** (echte Fotos, eigene Animation, synthetische Klänge).
