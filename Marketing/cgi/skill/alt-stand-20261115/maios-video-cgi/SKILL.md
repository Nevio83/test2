---
name: maios-video-cgi
description: "Maios-Produktvideo komplett in 3D (CGI, three.js, kein fremdes Material): Loop-Clip 7–9 s oder Kurzstory mit dem Produkt im Mittelpunkt, Handy-Look, eigene Musik. Fragt zuerst, welcher der vier Maios-Video-Typen gewünscht ist. Nutzen bei CGI-Video, 3D-Video, Produktanimation, KI-Video, 'erstell ein Video vom Produkt'."
---

# Maios Video 1: CGI-Produktvideo

## Schritt 0: Videotyp klären (immer zuerst)
Es gibt vier Maios-Video-Skills. Bevor du etwas baust, frage Nevio mit AskUserQuestion, welcher Typ es sein soll (eine Frage, vier Optionen):
1. **CGI-Produktvideo** → Skill `maios-video-cgi` (Produkt in 3D, Loop 7–9 s)
2. **Maskottchen Mo** → Skill `maios-video-maskottchen` (Figur Mo, Mini-Geschichte, ggf. Stimme)
3. **Story im @mehr.optic-Stil** → Skill `maios-video-story` (20–25 s, Blueprint, Explosionsansicht, Karaoke-Untertitel)
4. **Echtes Video aus Rohmaterial schneiden** → Skill `maios-video-rohschnitt`
Passt die Antwort nicht zu diesem Skill, lade den passenden mit dem Skill-Tool und arbeite dort weiter. Läuft die Aufgabe ohne Nevio (Routine/Zeitplan), nicht fragen: Typ aus `Marketing\trends\vorrat.md`-Zeile im Slot, sonst Story, und die Wahl in einem Satz nennen. Danach, falls Nevio das Produkt nicht genannt hat, auch das Produkt klären (Produkt-Nr. aus products.json).

Dieser Skill: **Typ 1**. Er enthält den gesamten bisherigen CGI-Ablauf (früher `maios-cgi` und `threejs-cgi-techniken`), ergänzt um das Wissen aus den Vorbildern @mehr.optic und @cano.essentials.

Echte KI-Videogeneratoren (Sora, Veo, Kling, Runway) sind aus dieser Umgebung nicht erreichbar. Wenn jemand „KI-Video“ sagt: einmal klar sagen und diesen Weg anbieten.

## Was neu ist (Stand 9.11.2026)
- Reines „Produkt im Raum“ holt 2K–90K Aufrufe, Mini-Geschichten mit Gegensatz 300K–1M. Auch im CGI-Loop deshalb: **ein Gegensatz** („das Übliche“ → Problem → Produkt als Lösung), nicht nur Produktfahrt.
- Schlüsselwort im Text farbig absetzen (Orange/Gold/Neon), Großbuchstaben, ein Satz pro Einstellung, kleine Label-Pill („EINE IDEE“, „WIEDERAUFLADBAR“) statt langer Texte.
- Bildwirkung: Bloom sparsam (Stärke ≈ 0,16, Schwelle 0,95), Hauptlicht nicht zu stark (Spot ≈ 70–100, Belichtung ≈ 0,8), sonst bleichen Weiß und Wasser aus. Dunkler Hintergrund (Petrol/Dunkelblau) hilft weißen Produkten.
- Blueprint-Look (Blau + Raster, gelbe Kontur-Glows, Explosionsansicht, Callouts) ist als Baustein in `lib/story_kit.js` fertig: auch im Loop für 2–3 s nutzbar (Explosionsansicht als Kernmoment).
- Standard bleibt der Loop (7–9 s, `finish.py --loop 0.4`); wer mehr Reichweite will, nimmt Typ 3 (Story).

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

## Ablauf und Technik (aus `maios-cgi`)


# Maios CGI – 3D-Produktvideos für TikTok

Baut TikTok/Reels-Videos (1080 x 1920, 30 fps) komplett im Rechner: das Produkt als 3D-Modell (three.js im Headless-Chromium), Animation, Text-Overlays im Handy-Look, eigene Musik und Geräusche. Kein fremdes UGC, keine Rechtefragen. Standard ist ein Loop-Clip mit 7–9 s, daneben Story-Videos mit 20–25 s. Maios Motion kommt nur noch als Abbinder vor.

Echte KI-Videogeneratoren (Sora, Veo, Kling, Runway) sind aus dieser Umgebung nicht erreichbar. Wenn jemand "KI-Video" sagt: das einmal klar sagen und diesen Weg anbieten.

## Quellen

- **Regeln:** `Marketing\cgi\README.md`, Abschnitt „Regeln ab 28.10.2026“. Sie gehen allem anderen vor, auch diesem Skill und dem Design-System, wo sich etwas widerspricht. Immer zuerst lesen.
- Generator: `C:\Users\nevio\Documents\vscode\Maios\Marketing\cgi\` (`lib/`, `scenes/`, die `*.html`-Seiten, `README.md`); `lib/tiefe.js` ist die Farbwelt Tiefe als Baustein
- Markensystem: Design-System-Artefakt "Maios Motion" (Farben, Schrift, Timing). Im Video nur noch für den Abbinder, nicht für den Ablauf.
- Produktdaten: `products.json` – einzige Quelle für Aussagen, Farben und Preis
- Referenzen: `produkt bilder/<Name> bilder/` (Fotos je Farbe), `Marketing/videos/rohmaterial/<NN>_<slug>/` (Rohclips für Ablauf und Proportionen)
- Vorlagen: `scenes/nacht.js` (Handy-Look, Overlay und Schrift; für den Hook gelten die neuen Regeln), `scenes/story_kugel.js` mit `lib/figur.js` (Story mit Figur Mo). `scenes/mixer.js`, `wasser*.js`, `kugel.js`, `grusel.js`, `reveal.js` sind alter Motion-Look: nur noch für Modelle, Licht und Technik ansehen.

## Ablauf

1. **Generator holen**: alle Dateien unter `Marketing\cgi` per device_stage_files in den Container (ohne node_modules/out), nach `/home/claude/studio` kopieren, `npm install` (three@0.170.0). Playwright + Chromium sind vorinstalliert, WebGL läuft über SwiftShader. README lesen.
2. **Produkt verstehen**: products.json-Eintrag lesen; Fotos je Farbe ansehen; aus 2-3 Rohclips Standbilder ziehen. Proportionen vermessen (Durchmesser = Einheit), Bedienelemente, typischer Ablauf.
3. **Format und Licht wählen**: Loop-Clip 7–9 s (Standard) oder Story 20–25 s. Overlay immer im Handy-Look wie `scenes/nacht.js`. Sichtbarkeitsregel fürs Licht: weißes Gehäuse, Glas, Wasser oder durchsichtige Teile -> Farbwelt **Tiefe** (`lib/tiefe.js`, `mood(room)` von hell 1 bis Nacht 0) oder dunkler Raum wie in `scenes/nacht.js`. Weiß, Glas und Wasser nie vor hellem Papier: der Kontrast reicht nicht.
4. **Modell** `lib/<produkt>_models.js`: Drehkörper (LatheGeometry) aus dem vermessenen Profil, Zylinder, Torus. Glas `transmission`, Chrom `metalness 1`, Kunststoff mit `clearcoat`, Farbvarianten als Tabelle. Aufdrucke des echten Produkts als Canvas-Textur. Lookdev: 4 Standbilder (dunkel, hell, Detail, Unterseite) gegen die Fotos prüfen.
5. **Storyboard** `scenes/<produkt>_<format>.js`: `SHOTS = [[von, bis, name], ...]`, `frame(t)` setzt alles zustandslos aus t. Aufbau nach den Regeln im README:
   - **Einstieg 0–3 s**: Ab Bild 0 passiert etwas im Bild (Licht, Wasser, Figur, Produkt in Aktion). Hook als Aussage, die eine Frage aufmacht; die Auflösung kommt erst nach dem Kernmoment. Produktwort klein im Bild.
   - **Kernmoment**: zeigt, was der Text verspricht, und nichts, was das Produkt nicht kann.
   - **Ende**: Loop-Clip: Preis und „Link im Profil“ als Textzeile vor dem Ende, die letzte Einstellung endet mit Kamera, Licht und Text wie Bild 0; 0,4 s länger rendern. Story: Abbinder höchstens 1 s mit Preis und Link.
   - Einstellungen höchstens 2 s; die erste bis 4 s, wenn sich darin etwas bewegt; Story-Einstellungen bis 3 s.
   - Kamera immer mit `lens(fov)` + `aim()` setzen (siehe Fallstricke).
6. **Standbilder prüfen**: `python3 lib/render.py <seite>.html --stills 0,0.5,1.5,3,...` und zu einem Board zusammensetzen. Prüfen: In jedem Bild passiert etwas, bis 3 s keine Auflösung im Text, Produktwort und Werbung sichtbar, Text nie auf dem Produkt, nichts in den Sperrzonen (oben 10 %, unten 20 %, rechts 14 %), Produkt erkennbar, Farben echt, **jede Produktkante hebt sich vom Grund ab** (Weiß vor Hell, Schwarz vor Dunkel, Wasser vor Grau sind Fehler), Bedienelemente der Aktion sichtbar (Knopf, Stecker, Anschluss). Beim Loop-Clip das letzte Bild neben Bild 0 legen: gleiche Kamera, gleiches Licht.
7. **Ton** `scenes/<produkt>_<format>_ton.py`: `K.song(...)` oder eigener Aufbau mit eigener Tonart/Akkordfolge (120 BPM, Drop beim ersten Schnitt, Pause vor dem Spannungsmoment), Geräusch auf jede sichtbare Aktion. Jedes Produkt bekommt eine eigene Klangfarbe (Mixer: E-Piano-Groove; Wasserspender: Tropical House mit `K.marimba`-Melodie, `K.pluckchord` auf den Offbeats und `K.plip`-Tropfen; Nachtlampe: Dream-Lo-Fi mit `K.spieluhr`-Melodie, Rhodes und `K.vinyl`-Knistern). Loop-Clip: kein Klang-Logo, kein Schlussakkord, die Musik läuft in den Anfang. Story: `K.soundlogo` im Abbinder erlaubt, das Stück endet dann auf D-Dur. Zwei Mischungen (mit/ohne Musik). Spektrogramm mit Schnittmarken ansehen.
8. **Rendern** im Hintergrund (`run_in_background`), in der Cloud etwa 9–10 s pro Bild (9 s Video ≈ 40 min). Kleine Korrekturen nur für den betroffenen Abschnitt neu rendern (`--von/--bis`) und an Schnittgrenzen per ffmpeg-trim einsetzen.
9. **Fertigstellen**: `python3 lib/finish.py bild.mp4 ton.wav ziel.mp4 --titel <s>` (<= 10 MB, -14 LUFS, Spitze <= -1 dBTP nach AAC, Titelbild). Loop-Clips mit `--loop 0.4`: Ende und Anfang werden überblendet, die Datei wird 0,4 s kürzer, `--titel` zählt in der fertigen Datei. Titelbild = ein Bild mit Produkt und Produktwort. Prüfsheet mit `edit.py pruefen` aus dem tiktok-editor-Skill ansehen.
10. **Ausliefern**: nach `Marketing\videos\geschnitten\` kommen nur Videos: `<NN>_<produkt>_<format>_cgi_<YYYYMMDD>.mp4` (Überarbeitung `_v2`) und `_ohne_musik.mp4`. In die Abschlussnachricht: Caption nach README (Zeile 1 Suchphrase, dann Hook, Nutzen, Preis aus products.json, „Link im Profil“, Entweder-oder-Frage), Hashtags (#werbung, 2 Suchbegriffe, 1 Anlass), Titelbild-Sekunde, Text für den angehefteten Kommentar, Musik-Hinweis. Geänderte Generator-Dateien nach `Marketing\cgi\` zurückschreiben. Videos per SendUserFile schicken.

## Regeln

- Die Regeln im README gehen vor. Kurz: Hook als Aussage ohne Auflösung in den ersten 3 s, ab Bild 0 Bewegung im Bild, Produktwort in den ersten 3 s, Handy-Look ohne Siegel, Eckmarken, Schritt-Nummern, Gold-Headlines und 2-s-Endkarte, Werbung-Pille oben links durchgehend sichtbar.
- „Ergebnis zuerst“ heißt: das stärkste bewegte Produktbild zuerst, der Text löst trotzdem nicht auf. Höchstens 6 Wörter pro Einblendung, Text zeigt nur, was das Bild zeigt.
- Effekte (Spuk, Magie) nur an Raum, Licht oder Figur. Das Produkt macht nur, was products.json hergibt: kein Knopf, der sich selbst drückt, keine erfundene Funktion.
- Nur Angaben aus products.json: Preis exakt, kein Streichpreis, keine Bewertungen, Bestände oder Mengenangaben, die nicht dort stehen.
- Eine Produktfarbe im ganzen Ablauf; weitere Farben höchstens am Ende oder in der Frage.
- Produktfarben echt: Licht im Papier-Look `#fffaf3`, im Nacht-Look `#fff1de`, in Tiefe neutral weiß `#ffffff` mit kühlem Randlicht `#bff1ff`; Chrom bleibt silbern, Weiß bleibt weiß. Gold gehört höchstens in den Abbinder, nie ins Produktlicht.
- Stimmungen (Abend, Lampe, Zuhause) nur über Hintergrund und ein Akzentlicht zeigen, das Produktlicht bleibt neutral: warmes Hauptlicht macht Weiß beige und Wasser sieht aus wie Saft. Vorlage: Einstellung `zuhause` mit `mood('abend')` in `scenes/wasser2.js` (zweiter, warmer Lichthof hinter dem Lampenschirm).
- Tiefe: Petrol-Verlauf `#1f6273` -> `#05181e`, eisblauer Halo `#c9f3ff` genau hinter Glas und Wasser, Kaustik-Licht `#8fe9ff` am Boden (Stärke 0,05-0,12), Vignette petrolfarben `rgba(0,12,16,.42)`.
- Varianten Weiß + Schwarz nebeneinander: Grund teilen (links Tiefe hinter Weiß, rechts hell `#e4eff0` hinter Schwarz), Farbnamen in der jeweiligen Kontrastfarbe (`vlabels(names, colors, textColors)`).

## Fallstricke

- three.js-Transmission zeigt durch Glas nur undurchsichtige Objekte: Flüssigkeit im Glas undurchsichtig (Mixer) oder transmissives Wasser in einem transparenten Fake-Glas (Wasserspender).
- Ein Hintergrund, der durch Glas und Wasser zu sehen sein soll, ist ein undurchsichtiges Shader-Rechteck statt `scene.background`: `PlaneGeometry(2,2)`, Vertex `gl_Position = vec4(position.xy, 0.9999, 1.0)`, `renderOrder -1000`, `depthTest/depthWrite false`, `toneMapped false`, am Ende `#include <colorspace_fragment>`. Den Halo per Projektion eines Weltpunkts (`haloAt`) hinter das Glas legen.
- Wasser vor dunklem Grund wird grau: Halo genau hinter das Glas legen. Wasserstrahl im Papier-Look ohne Emissive, sonst wirkt er milchig.
- Kaustik im Hintergrund nur rund um den Halo und schwach zeichnen (Maske `1 - smoothstep(0.04, 0.3, Abstand)`), sonst wird der ganze Grund unruhig.
- Vor `localToWorld`/`project`: `group.updateMatrixWorld(true)` und die Kamera-Matrix aktualisieren (`aim()` in core.js macht das), sonst sitzen Overlays (Ripple, Farbnamen) falsch.
- Obst/Teile im Glas werfen keinen Schatten (schwebende Schattenpunkte).
- Prozesse nie mit `pkill -f <muster>` beenden, wenn das Muster im eigenen Befehl steht (beendet die eigene Shell). Stattdessen `pgrep -f "lib/render[.]py"`.
- `cam.fov` wirkt erst nach `cam.updateProjectionMatrix()`; `aim()` macht das nicht. In neuen Szenen `lens(fov)` aus `scenes/kugel.js` nehmen. `wasser.js`/`wasser2.js` laufen deshalb durchgehend mit 26 Grad.
- Hochformat: die Bildbreite ist nur 56 % der Höhe, bei breiten Produkten bestimmt die Breite den Kamera-Abstand. Liegt das Bedienteil unten (Buchse, Schalter), die ganze Lampe zeigen statt Nahaufnahme, sonst liegt der Text auf dem Produkt; den Klick mit `BR.ripple` an der Buchse zeigen.
- Vollglas mit Innengravur (Kristallkugel): keine Transmission. Glas als Shader-Schale (dunkler Rand, dünne helle Silhouette, harte Glanzpunkte), Gravur als additive Punktwolke zwischen Rück- und Vorderschale, Lichtkappe oben als Kugelkalotte (`lib/kugel_models.js`).
- Warme Lichthöfe klein halten (Radius bis 0,2, Stärke bis 0,3) und die Aura schwach, sonst wird der Petrol-Grund braun.
- Helle Requisiten (Geschenkbox) im Nacht-Look brauchen Raumlicht (`mood(0.45)`), sonst sind sie braun und verschwinden im Grund.
- Eine Vordergrund-Warteschleife darf höchstens 10 min laufen; lange Renders immer im Hintergrund.
- In `edit.py` (tiktok-editor) überschreibt `--push` das `tempo=` einer Zeile; die korrigierte Fassung liegt in `Marketing\cgi` nicht bei, also für beschleunigte Zeilen `push=0` setzen oder den Fix übernehmen (Push nach setpts anhängen).
- `finish.py --loop` braucht mindestens viermal so viele Bilder wie die Überblendung; Klang-Logo oder Schlussakkord am Ende hört man an der Naht.

## Vertiefte three.js-Technik (aus `threejs-cgi-techniken`)
Referenzdateien liegen in `references/` dieses Skills (Animation, Licht, Material, Shader, Postprocessing; Quelle: github.com/CloudAI-X/threejs-skills, MIT-Lizenz, Copyright (c) 2026 CloudAI-X).


# Three.js-Techniken für Maios-CGI

Kostenlose, offene Ergänzung zum `maios-cgi`-Skill – gefunden als Ersatz für den
kostenpflichtigen "Claude Motion Graphics Skill Pack" (5,99 $, anonymer Anbieter).
Diese Dateien stammen stattdessen aus einem öffentlichen, MIT-lizenzierten
GitHub-Repo mit 4,1k Sternen: **github.com/CloudAI-X/threejs-skills** – geprüft
(Lizenz, Historie, Inhalt) statt blind installiert, und ohne Kauf nutzbar.

**Lizenzhinweis (MIT):** Copyright (c) 2026 CloudAI-X. Permission is hereby
granted, free of charge, to any person obtaining a copy of this software and
associated documentation files, to deal in the Software without restriction,
including the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies, subject to including this notice. Volltext:
https://github.com/CloudAI-X/threejs-skills/blob/main/LICENSE

## Wann benutzen

Zusätzlich zum `maios-cgi`-Skill, an genau der Stelle im Ablauf, wo es um die
three.js-Umsetzung geht (Schritt 4 Modell, Schritt 5 Storyboard/Kamera):

- **Modell wirkt flach, Licht banal** → `references/threejs-lighting.md`
- **Material/Glas/Chrom/Kunststoff soll echter aussehen** → `references/threejs-materials.md`
  (ergänzt, ersetzt nicht, die bestehende Glas-Rezeptur in `lib/tiefe.js`/den
  `*_models.js`-Dateien – gleiche Transmission-Technik, mehr Optionen)
- **Produkt/Teil soll sich bewegen, Keyframes, Crossfade zwischen Clips** → `references/threejs-animation.md`
- **Eigener Shader-Effekt** (Auflösen, Fresnel, Wellen, Dissolve) → `references/threejs-shaders.md`
- **Bildwirkung am Ende**: Glanzlicht-Glow (Bloom), Tiefenunschärfe, Vignette,
  Film-Grain, Farbkorrektur als letzter Schliff vor dem Export → `references/threejs-postprocessing.md`

## Wichtig für diese Pipeline

- Die Referenzdateien zielen auf **three.js r186**; unser Generator läuft auf
  **three@0.170.0** (`Marketing\cgi\package.json`). Vor Übernahme eines Snippets
  kurz prüfen, ob der API-Name/Import-Pfad in 0.170 schon existiert (z. B. sind
  `RenderPipeline`/TSL/WebGPU-Abschnitte neuer als 0.170 und nur als Ideengeber
  zu lesen, nicht 1:1 copy-paste-fähig). Die klassischen WebGL-Abschnitte
  (Lights, PBR-Materialien, EffectComposer-Passes, ShaderMaterial, AnimationMixer)
  sind seit vielen Versionen stabil und passen direkt.
- Unsere Szenen rendern **headless per Playwright/Chromium mit SwiftShader**
  (kein echtes GPU, kein WebGPU) – die WebGPU/TSL-Abschnitte in den
  Referenzdateien NICHT verwenden; nur die WebGLRenderer-/EffectComposer-Pfade.
- Postprocessing kostet Renderzeit pro Bild zusätzlich zur bestehenden
  9-10 s/Bild – bei Einsatz (z. B. Bloom auf Chrom-Highlights) kurz an einem
  Einzelbild testen, bevor ein ganzer 9s-Clip neu gerendert wird.
- Alles hier ist **zusätzliche Technik**, keine neue Pflicht: Die Regeln aus
  `Marketing\cgi\README.md` ("Regeln ab 28.10.2026") und der Bordstein im
  `maios-cgi`-Skill (Farbwelt Tiefe, Handy-Look, Hook-Regeln, 1-Produktfarbe
  pro Ablauf usw.) gehen immer vor – ein Bloom-Glanzlicht ändert z. B. nichts
  an der Vorgabe "Produktlicht bleibt neutral, Gold nur im Abbinder".

## Referenzdateien

- `references/threejs-animation.md` – AnimationMixer/AnimationClip, Keyframe-Tracks, Morph-Targets, Skelett-Animation, Clip-Blending
- `references/threejs-lighting.md` – Lichttypen & physikalische Einheiten, Shadow Maps, HDR/IBL, Light Probes
- `references/threejs-materials.md` – Material-Typen inkl. PBR/MeshPhysicalMaterial (Transmission-Glas, wie unsere Wasserspender-Technik), Toon/Point/Line
- `references/threejs-shaders.md` – ShaderMaterial/RawShaderMaterial, onBeforeCompile, Shader-Chunks, Fresnel, Dissolve
- `references/threejs-postprocessing.md` – EffectComposer-Passes: Bloom, Depth of Field, SSAO, Outline, Film-Grain, Vignette, eigene Passes

