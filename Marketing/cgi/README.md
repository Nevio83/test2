> **GILT AB 9.11.2026 (Nevio): Nevio lädt die Videos selbst in TikTok Studio hoch und plant sie selbst.**
> Claude baut, prüft und liefert nur, was er eingeben soll: pro Kanal (@maiosshop, @maiosshop.com) Dateiname (mit Musik), Caption zum Kopieren, Hashtags, Datum und Uhrzeit für „Zeitplan“ (12:00 / 18:00, Europe/Berlin), Titelbild-Sekunde, Text für den angepinnten Kommentar. Claude öffnet dafür kein TikTok Studio, lädt nichts hoch, plant nichts ein und postet nichts.
> Das geht den Schritten „Planen“ und „Nachlauf“ (Upload, Anpinnen) in der Routine „Maios Vorproduktion und veröffentlichung“ vor. Tageslog, Kennzahlen und Verschieben nach `hochgeladen` nur, wenn Nevio meldet, dass er gepostet hat.
> Als Status in vorrat.md statt „geplant“: „fertig, Nevio lädt hoch“ und danach „von Nevio geplant/gepostet“.

# Maios CGI – Produktvideos aus dem Rechner

Hier entstehen die 3D-Werbevideos im Stil **Maios Motion** (Markensystem: Farben, Schrift,
Signatur-Elemente, Schnitt- und Klangregeln). Kein fremdes Material, keine Lizenzfragen:
Produkt, Licht, Animation, Musik und Geräusche werden komplett hier erzeugt.

## Regeln ab 28.10.2026 (gehen vor)

Diese Regeln gehen den älteren Regeln weiter unten, dem Skill maios-cgi, dem Design-System „Maios Motion“
und den Zeiten, Längen und Endkarten im Trend-Doc vor, wo sie sich widersprechen.

**Einstieg (0–3 s)**
- Der Hook ist eine Aussage, die eine Frage aufmacht. Die Auflösung (Lösung, „Nie wieder“, „ein Knopf“, Preis)
  kommt erst nach dem Kernmoment, nie in den ersten 3 s.
- Ab Bild 0 passiert etwas im Bild: Licht, Wasser, Figur oder das Produkt in Aktion. Eine langsame Kamerafahrt
  allein reicht nicht. „Ergebnis zuerst“ heißt jetzt: das stärkste bewegte Produktbild zuerst, der Text löst
  trotzdem nicht auf.
- Das Produktwort (wie in products.json, z. B. „Wasserspender“, „Nachtlampe“) steht in den ersten 3 s einmal
  klein im Bild, z. B. neben der Werbung-Pille.
- Effekte (Spuk, Magie) nur an Raum, Licht oder Figur. Das Produkt macht nur, was products.json hergibt: kein
  Knopf, der sich selbst drückt, keine erfundene Funktion.

**Look**
- Standard ist der Handy-Look. Vorlage für Overlay und Schrift ist `scenes/nacht.js` (nicht für den Hook):
  weiße Schrift mittig, eine Pointe pro Einblendung, höchstens 6 Wörter.
- Keine Maios-Motion-Bausteine im Ablauf: kein Siegel, keine Eckmarken, keine Schritt-Nummern 01–04,
  keine Gold-Headlines, keine 2-s-Endkarte.
- Die Marke kommt nur als Abbinder: höchstens 1 s (Story) oder gar nicht (Loop-Clip).
- Die Werbung-Pille ist durchgehend sichtbar (wie in `scenes/nacht.js`).

**Länge, Tempo, Loop**
- Loop-Clip ist der Standard: 7–9 s. Die letzte Einstellung endet mit Kamera, Licht und Text wie Bild 0
  (z. B. Licht geht wieder aus, zurück zum dunklen Anfang). Preis und „Link im Profil“ stehen als Textzeile
  vor dem Ende, nicht im letzten Bild. Kein Klang-Logo, kein Schlussakkord, die Musik läuft in den Anfang.
  Fertigstellen mit `finish.py --loop 0.4` (siehe Rendern).
- Story: 20–25 s, nur wenn alle 2–3 s etwas Neues passiert (neuer Text, neue Einstellung, neue Wendung).
  Abbinder höchstens 1 s mit Preis und Link, Klang-Logo erlaubt.
- Eine Einstellung dauert höchstens 2 s. Ausnahmen: Die erste Einstellung darf bis 4 s laufen, wenn sich
  darin etwas bewegt; Story-Einstellungen bis 3 s.

**Caption, Hashtags, Titelbild** (gilt beim Hochladen)
- Zeile 1 ist eine Suchphrase: der Produktbegriff aus products.json (z. B. „Elektrischer Wasserspender für
  Gallon-Flaschen“) oder Anlass plus Preis, wenn der Preis es hergibt („Geschenkidee unter 20 €“ bei 17,99 €).
  Danach Hook, Nutzen, Preis, „Link im Profil“ und die Frage.
- Hashtags: #werbung, 2 Suchbegriffe zum Produkt (Wörter aus Name oder Beschreibung in products.json) und
  1 Anlass oder Kategorie. Keine Trend-Tags, nach denen niemand das Produkt sucht (z. B. #prettylittleliars,
  #creepyfacts, #storytime).
- Titelbild-Sekunde: ein Bild mit Produkt und Produktwort. Beim Bauen mit `--titel` festlegen, beim Upload
  in TikTok Studio setzen und ansehen.

**Kommentare**
- Pro Video eine Entweder-oder-Frage aus products.json (Farben, Motive, Einsatz aus der Beschreibung),
  z. B. „Mond oder Saturn?“ oder „Weiß oder Schwarz?“. Sie steht in der Caption und nach dem Posten als
  eigener, angehefteter Kommentar.
- Keine Belohnung und keine Bedingung fürs Kommentieren.
- Antwortvideo auf eine echte Frage: Frage oben als Text ohne Nutzernamen, Antwort nur aus products.json,
  Handy-Look, 7–9 s. Nevio postet es in der App über „Mit Video antworten“, nur dort gibt es den
  Kommentar-Sticker.

**Kanäle und Zeiten**
- Gepostet wird nur um 12:00 und 18:00 (Europe/Berlin). Pro Slot ein Video, das auf beide Kanäle geht
  (erst @maiosshop, dann @maiosshop.com); auf @maiosshop.com die Hook-Zeile der Caption leicht anders.
- Das 18-Uhr-Video nimmt ein anderes Produkt als das 12-Uhr-Video vom selben Tag, mindestens aber ein klar
  anderes Format.
- Vorproduktion: Jedes Video ist mindestens einen Tag vor seinem Slot fertig gebaut, geprüft und freigegeben
  (`Marketing/trends/vorrat.md`). Kurz vor dem Slot wird nicht mehr gebaut. Vor der Freigabe schaut ein
  zweiter Prüfer (Subagent ohne Bau-Vorgeschichte) auf Standbilder, Prüfsheet und Caption.

**Stimme (Test)**
- Erzählerstimme nur in Story-Videos und nur, wenn die Aufgabe oder Nevio sie verlangt: `lib/stimme.py`
  (Piper, deutsche Stimme Thorsten). Die Stimme liest den Bildschirmtext; meldet das Werkzeug eine Zeile als
  zu lang, den Text kürzen oder `--tempo 0.9` nehmen.
- Videos mit dieser Stimme beim Upload in TikTok als KI-generiert kennzeichnen.

**Standbilder prüfen**
- 0,0 / 0,5 / 1,5 / 3,0 s und das letzte Bild: In jedem passiert etwas, bis 3 s keine Auflösung,
  Produktwort und Werbung sind sichtbar. Beim Loop-Clip das letzte Bild neben Bild 0 legen: gleiche Kamera,
  gleiches Licht.

## Was wo liegt

| Pfad | Inhalt |
|---|---|
| `lib/core.js` | Renderer, Licht, Hilfsfunktionen (Easing, Zufall, Verlaeufe, Kontaktschatten) |
| `lib/brand.js` | Markenbausteine als Overlay: Werbung-Pille, Headline, Schritt + Goldfaden, Siegel, Eckmarken, Lichtstreif, Ripple, Endkarte, Filmkorn (seit 28.10. nur noch Ripple, Filmkorn und Abbinder, siehe Regeln) |
| `lib/mixer_models.js` | 3D-Modell 350ml Mixer Entsafter (Produkt 11) in Rosa/Weiss/Blau, Obst, Fluessigkeit (Milch -> Smoothie) |
| `lib/ws_models.js` | 3D-Modell Wasserspender (Produkt 10) in Weiss/Schwarz, Glas, Kanister, Schlauch, PET-Flaschen |
| `lib/kugel_models.js` | Krystall Ball Nachtlampe (Produkt 50): Holzsockel mit LED, Vollglas-Kugel (Shader), Gravur als Lichtpunkte (Mond, Saturn, Riesenrad, Schneemann), USB-Stecker, Geschenkbox, Buecher, Pflanze |
| `lib/tiefe.js` | Farbwelt **Tiefe** als Baustein: Petrol/Nacht-Hintergrund (auch durch Glas sichtbar), zwei Lichthoefe, Sterne, Licht, Boden, `mood(room)` von hell (1) bis Nacht (0) |
| `lib/nachtlicht_models.js` | Nachtlichter mit Bewegungsmelder (Produkt 25): Nussbaum-Stab mit Sensor-Auge, opalweißer Leuchtteil, runde Wandscheibe, Licht per `setOn(k)` (Maße aus dem Shopfoto, Einheit Meter) |
| `scenes/mixer_hexe.js` | Mixer „Das ist kein Hexentrank.“ (28.10.): Halloween-Küche bei Nacht, Kürbis und Kerzen nur als unscharfe Lichter im Hintergrund, Loop-Clip 8 s im Handy-Look; Chrom mit eigener heller Spiegel-Umgebung, damit es im dunklen Raum silbern bleibt |
| `scenes/nachtlicht_flur.js` | Nachtlicht „Das Licht geht von allein an.“ (28.10.): POV im dunklen Flur, Mondlicht durchs Fenster, Belichtung je Einstellung, Loop-Clip 8 s |
| `lib/ws_szene.js` | Wasserspender-Szene als Baustein (aus `wasser2.js`): Spender Weiss/Schwarz, Glaeser, Kanister, Strahl, Tropfen, Blasen, Requisiten, `water()`, `ledOn()`, `hideAll()` |
| `scenes/kugel_schnee.js` | Nachtlampe „Draußen Regen. Bei mir schneit's.“ (2.11.): Fensterbrett im November, Regen am Fenster als Shader-Ebene (periodisch in 8,4 s), Teetasse mit Dampf, Motiv Schneemann, Loop-Clip 8 s |
| `scenes/nacht.js` | **Handy-Look-Vorlage** (Wasserspender „Gruselfakt um Mitternacht“, 9 s): weiße Text-Pointe mittig, Werbung-Pille durchgehend, Preiszeile, Link-Kachel |
| `scenes/story_kugel.js`, `lib/figur.js` | Story-Format mit eigener Figur Mo (Nachtlampe, 23 s), Untertitel im TikTok-Stil |
| `scenes/mixer.js`, `scenes/wasser.js` | Storyboards: 12 Einstellungen in 14 s, Kamera, Texte, Zeitplan (Look Nacht + Papier; alter Motion-Look, keine Vorlage mehr) |
| `scenes/wasser2.js` | Wasserspender v2 im Look **Tiefe**: Petrol-Grund, eisblauer Lichthof hinter Glas und Wasser, Kaustik-Licht, geteilter Grund bei den Farben |
| `scenes/kugel.js` | Nachtlampe im Look **Tiefe**: Licht aus -> Mond an, Geschenkbox, 4 von 7 Motiven (nutzt `lib/tiefe.js`) |
| `scenes/grusel.js` | Trend "Creepy Fact": Wasserspender, 14 s, dunkel mit Randlicht -> Gallone kippt in Zeitlupe -> Stille -> Knopf, Licht an. Zwei Hooks: `grusel.html` (A, "Jedes Glas: Gallone kippen.") und `grusel_b.html` (B, `window.HOOK = "b"`, "Flasche kippen ist vorbei.") |
| `scenes/reveal.js` | Trend "Halloween-Reveal" (Ramalama-Format ohne Song): Wasserspender, 13 s, Teaser -> dunkle Bodenfahrt mit Nebel -> Licht an auf dem Trommelschlag -> Knopf -> Zeitlupe -> Fan-Wipe Weiss/Schwarz -> Endkarte |
| `scenes/*_ton.py` | Musik + Geraeusche + Mastering je Video (`wasser2_ton.py`: Tropical House mit Marimba; `kugel_ton.py`: Dream-Lo-Fi mit Spieluhr; `grusel_ton.py`: Spieluhr in d-Moll, bricht ab, dann das Wasserspender-Thema; `reveal_ton.py`: Teaser mit Bandstopp, Herzschlag, Pause, Drop; alle enden auf D-Dur; Loop-Clips ab 28.10. ohne Schlussakkord und ohne Klang-Logo) |
| `lib/klang.py`, `lib/musik.py` | Klangbaukasten (E-Piano, Marimba, Spieluhr, Pluck, Pad, Bass, Drums, Wassertropfen, Plattenknistern, Geraeusche, Klang-Logo) |
| `lib/render.py` | rendert eine Szene Bild fuer Bild im Browser (Playwright) |
| `lib/finish.py` | Bild + Ton zusammen, <= 10 MB, Lautheit pruefen, Titelbild; `--loop` macht aus dem Render einen Loop-Clip |
| `lib/stimme.py` | Erzählerstimme (Piper) aus dem Bildschirmtext, unter die Musik gemischt, auf -14 LUFS |

## Rendern

Einmalig: `npm install` (holt three.js), `py -m pip install playwright numpy scipy` und `py -m playwright install chromium`.

```
py lib/render.py mixer.html --von 0 --bis 14 --out out/mixer_bild.mp4
py scenes/mixer_ton.py out
py lib/finish.py out/mixer_bild.mp4 out/ton_mit_musik.wav out/11_mixer_cgi.mp4 --titel 8.9
py lib/finish.py out/mixer_bild.mp4 out/ton_ohne_musik.wav out/11_mixer_cgi_ohne_musik.mp4
```

Loop-Clip: Ende und Anfang werden 0,4 s ineinander geblendet, die Datei beginnt bei 0,4 s des Renders und ist
0,4 s kürzer (für 8 s also 8,4 s rendern). `--titel` zählt in der fertigen Datei.

```
py lib/finish.py out/nacht_bild.mp4 out/ton_mit_musik.wav out/10_wasserspender_nacht_cgi.mp4 --loop 0.4 --titel 1.5
```

Story mit Erzählerstimme: Text mit Startsekunden als JSON (`[[0.1, "Als Kind hatte ich …"], …]`), dann

```
py -m pip install piper-tts   # einmalig
py lib/stimme.py out/ton_mit_musik.wav out/text.json out/ton_mit_stimme.wav --modell ../data/piper/piper/de_DE-thorsten-high.onnx
py lib/finish.py out/story_bild.mp4 out/ton_mit_stimme.wav out/50_krystall-ball_story_cgi.mp4 --titel 19
```

Einzelbilder zum Pruefen: `py lib/render.py mixer.html --stills 0.9,4.3,8.9` (landen in `out/`, mit `--stilldir out2` in einem anderen Ordner;
zwei Seiten gleichzeitig brauchen verschiedene `--port`).

Loop-Musik: die Musik als Schleife von genau der Dateilänge bauen (8,0 s = 4 Takte bei 120 BPM) und um die Überblendung
verschoben ablegen, Takt 1 also bei Render-Sekunde 0,4. Dann sind die letzten und die ersten 0,4 s gleich und die Naht ist
nicht zu hören (Vorlage: `scenes/mixer_hexe_ton.py`). Text und Kamera der ersten Einstellung so bauen, dass sie bei Render 0 schon
stehen (keine Einblendung in den ersten 0,4 s), sonst sieht man am Ende der Datei ein halbes Einblenden.
In der Cloud (2 Kerne, Software-Rendering) braucht ein 14-s-Video etwa 18 Minuten; mit Grafikkarte deutlich weniger.

## Neues Produkt

1. Produktfotos und Rohclips ansehen, Masse und Farben aus `products.json` nehmen.
2. Modell in `lib/<produkt>_models.js` (Drehkoerper, Zylinder, Torus reichen fuer die meisten Geraete).
3. Storyboard nach den Regeln oben: Loop-Clip 7–9 s (Look wie `scenes/nacht.js`) oder Story 20–25 s (`scenes/story_kugel.js`).
4. Ton: `scenes/<produkt>_ton.py` mit eigener Tonart, Geraeusche auf die Zeitpunkte der Aktionen. Loop-Clips ohne Klang-Logo und ohne Schlussakkord.
5. Regeln: siehe „Regeln ab 28.10.2026“ oben; nur Angaben aus products.json, eine Produktfarbe im Ablauf.
6. Weisse oder durchsichtige Produkte (Glas, Wasser) nie auf Papier: Look **Tiefe** nehmen, Vorlage `scenes/wasser2.js`.
   Der Hintergrund ist dort ein undurchsichtiges Shader-Rechteck hinter allem (nicht `scene.background`),
   damit Glas und Wasser mit Transmission den Lichthof durchscheinen lassen.
7. Brennweite: `cam.fov` wirkt erst nach `cam.updateProjectionMatrix()`. In `scenes/kugel.js` erledigt das `lens(fov)`;
   `wasser.js`/`wasser2.js` laufen dadurch durchgehend mit 26 Grad (so sind sie auch abgenommen).
8. Bildausschnitt im Hochformat: die Bildbreite ist nur 56 % der Hoehe - bei breiten Produkten bestimmt die Breite den Abstand der Kamera.
9. Nebel aus Sprites: Textur am Rand weich auf 0 ziehen und die Sprites mit der Unterkante auf den Boden stellen.
   Sprites stehen quer zur Blickrichtung; schneiden sie Boden oder Produkt, entsteht eine harte waagrechte Kante.
   Deshalb nur vor oder hinter das Produkt stellen, nie auf seine Hoehe (`scenes/reveal.js`).
10. Fan-Wipe (Ventilatorfluegel wischt, dahinter der neue Look): im Wipe-Fenster zuerst den alten Look rendern und per
    `drawImage` in ein 2D-Canvas ueber der Buehne kopieren, dann den neuen rendern. Das alte Bild bekommt per `clip-path`
    nur den Halbkreis vor dem Fluegel (`sector()` in `scenes/reveal.js`), der Fluegel selbst ist ein unscharfes SVG im Overlay.
11. Zwei Hook-Fassungen: eine zweite HTML-Seite setzt `window.HOOK` vor dem Modul; nur den Anfang neu rendern und per
    ffmpeg (`trim` + `concat`) vor den Rest der ersten Fassung setzen.
