> **Galerie-Format „real“ (Nevio 13.11.):** abgenommen, als Skill `real` gespeichert (Skripte `cgi/real/`). Notiz-Liste (Format A) verworfen.
> **GILT AB SA 14.11.2026 (Nevio, 12.11.): „Echt statt KI“.** Neue Videos sollen nicht nach KI/CGI aussehen, sondern realistisch. Keine 3D-Szenen, keine Figuren, keine Knete/Papier-Welten, kein Glow, keine perfekten Kamerafahrten. Grundlage sind echte Fotos aus `produkt bilder` (inkl. Varianten-Ordner), geschnitten wie ein normales Handy-Video. Regeln ab 28.10. (Werbung-Pille, Produktwort in 0–3 s, keine Auflösung vor 3 s, Preise/Angaben nur aus products.json, keine fremden TikTok-Clips im Video) gelten weiter.
> - **Format A „Handy-Notiz-Liste“ (15–20 s):** sieht aus wie eine Bildschirmaufnahme einer Notizen-App (eigenes neutrales Design, keine fremde App-Optik/Marke). Titel wird live getippt (Cursor, Tastaturklicks), dann Punkt für Punkt Produkte mit echtem Shopfoto als Anhang, Preis exakt, Häkchen, leichtes Scrollen. Beispiel: „Wichtel-Liste 2026 – alles unter 20 €“ mit Krystall-Ball-Nachtlampe 16,99 €, Kaffee- und Gewürzmühle 18,99 €, Schallzahnbürste 18,99 €, LED Crystal Lampe 19,99 €, Bluetooth-Finder 8,99 € (Preise vorher in products.json prüfen). Am Ende „Link im Profil“.
> - **Format B „Echte Fotos, gefilmt wie mit dem Handy“ (12–18 s):** echte Produkt-/Variantenfotos, durchgewischt wie in der Galerie: leichte Handbewegung, kurze Unschärfe beim Wischen, Fokus zieht nach, Filmkorn, natürliche Farben, schnelle Schnitte im Takt, Text im TikTok-üblichen Stil (weiß mit dunkler Kontur, keine Pills/Glows). Beispiel: Krystall Ball Nachtlampe mit allen 7 Motiven („7 Motive. Ich kann mich nicht entscheiden.“).
> - **Format C (nur wenn Nevio Material liefert):** eigene Handyclips (5–10 s, Hände, kein Gesicht) → Schnitt mit `maios-video-rohschnitt`. Wirkt am echtesten.
> - Plan Sa 14.11.: 12 Uhr Format A (ersetzt dieses Mal den Satisfying-Loop), 18 Uhr Format B. Skill: `maios-video-rohschnitt` (ffmpeg, Fotos als Material) statt der CGI-Skills.
> **Neue Formate ab 14.11. (aus der Sichtung von @mehr.optic, @cano.essentials und @smart_produkt am 12.11., Details in `cgi/vorbilder.md`):**
> - **W „Warum ist das so?“, Wissensvideo (30–45 s):** eine überraschende, belegte Geschichte zum Produkt oder seiner Kategorie, z. B. warum frisch gemahlener Kaffee anders schmeckt oder woher die Schneekugel kommt. Fakten vorher per Websuche belegen und Quelle im vorrat-Abschnitt notieren. Erzählerstimme mit Untertiteln, das Produkt erst am Ende, Preis nur in der Caption. Bild aus echten Fotos und Archiv-Look, keine 3D-Figuren.
> - **H „Hände-Alltag“ (15–25 s):** echte Handyclips (nur Hände) mit Stimme und Ein-Wort-Untertiteln, Schnitt alle 1–1,5 s, Ablauf Paket → auspacken → Problem → Einsatz → Ergebnis. Braucht Clips von Nevio.
> - **K „Antwort auf Kommentar“:** Handy in der Hand zeigt den Shop bzw. das Produkt und beantwortet eine echte Frage. Braucht Clips von Nevio.
> - **Stimme:** Die Treffer leben alle von einer Erzählerstimme. Die KI-Stimme (Piper) klingt nach KI, deshalb ist Nevios eigene Stimme (Sprachmemo) am besten. Ohne Nevio-Stimme: nur mit Nevios Freigabe die KI-Stimme, dann als KI kennzeichnen.

> **Stimme, Stand 12.11. abends:** Nevio will kostenlos die eingebauten Stimmen von VoiceStudio nutzen, nicht seine eigene. **Wichtig:** Das Standardmodell OmniVoice hat laut VoiceStudio-Doku (docs/model-credits.md) **CC-BY-NC-Gewichte, also nur nichtkommerziell** und damit nicht für Maios-Werbung. In VoiceStudio stattdessen die Engine **CosyVoice 3** nehmen: kann Deutsch, Code laut Projekt Apache-2.0. Vorher im Model Manager prüfen, dass bei den Gewichten und bei der gewählten Stimme „commercial use“ erlaubt ist; die App zeigt das pro Modell an. Erlaubt der Model Manager keine kommerzielle Nutzung, keine Stimme verwenden. Beim Upload „KI-generiert“ setzen.

> **Stimme (12.11.):** Nevio hat VoiceStudio vorgeschlagen (github.com/debpalash/VoiceStudio). Das ist eine kostenlose Desktop-App, läuft lokal und ist AGPL-3.0; kommerzielle Nutzung ist laut README unter AGPL frei. Das Standardmodell OmniVoice von k2-fsa steht unter Apache-2.0 und ist auf Deutsch mit rund 21.900 Stunden trainiert. Es kann eine Stimme aus einer kurzen Aufnahme klonen, deutsche Stimmen nach Beschreibung liefern dagegen nur unsicher.
> Ablauf:
> 1. Claude schreibt den Sprechertext pro Video in den vorrat-Abschnitt.
> 2. Nevio erzeugt ihn in VoiceStudio mit der Thorsten-Vorlage (nicht mit seiner eigenen Stimme) und legt die WAV unter `Marketing/videos/rohmaterial/eigenes/stimme/<Dateiname des Videos>.wav` ab.
> 3. Claude schneidet Bild und Untertitel auf die Stimme.
> **Nevio will NICHT seine eigene Stimme (12.11.).** Stattdessen in VoiceStudio die freie deutsche Sprecherstimme „Thorsten-Voice“ als Klon-Vorlage nehmen: echte Aufnahmen von Thorsten Müller, laut Projekt frei nutzbar, Lizenz auf Zenodo prüfen (Datensatz 2022.10 Neutral, doi 10.5281/zenodo.7265581). Alternative: die Text-zu-Sprache-Funktion direkt in der TikTok-App. In der Cloud kann Claude das Modell nicht laden, weil HuggingFace dort gesperrt ist. Eine geklonte oder KI-Stimme wird beim Upload als KI-generiert gekennzeichnet.

> **Gelernt am 12.11. (eigene Zahlen aus kennzahlen.csv + Recherche):** Die alten Clips mit echtem Material und kurzem POV-Text liefen 5–10× besser als die CGI-Videos. Bürste mit POV-Text, 6 s: 28,2 % ganz angeschaut, 4,4 s Wiedergabezeit. Mixer echt: 17–25 %. Die CGI-Videos ab 26.10. lagen bei 2,5–5 %, rund 2 s Wiedergabezeit, und die meisten waren nach 1 s weg. Daraus folgt:
> 1. Echtes Bild schlägt jeden Effekt. Erste Sekunde: echtes Produkt in Aktion oder echte Situation, kein Logo, keine Animation, keine 3D-Welt.
> 2. Kürzer: 6–12 s statt 20-s-Story. Story nur, wenn jede Sekunde echtes Material zeigt.
> 3. Ein POV-/Alltagssatz oben im TikTok-Textstil (weiß, dunkle Kontur), dazu ehrliche, konkrete Hooks wie „Was kommt an, wenn man das bestellt?“, „Gleicher Tisch, eine Änderung“, „Nicht bestellen, bevor du das misst“ (Quellen: shortsfast.com, nexscope.ai, Nov. 2026).
> 4. Formate im Wechsel, nie zweimal hintereinander dasselbe:
>    (a) POV-Text über echtem Clip, 6–10 s;
>    (b) Hände-Unboxing, 15 s, 5 Einstellungen: zu → öffnen → Produkt raus → erster Test → Ergebnis;
>    (c) Problem → Beweis → Detail → Entscheidung, 4 Einstellungen;
>    (d) Vorher/Nachher mit fester Kamera;
>    (e) „Nicht kaufen, bevor …“ (ehrliche Angaben aus products.json, z. B. „Batterien nicht enthalten“);
>    (f) Notiz-Liste mit echten Shopfotos;
>    (g) Galerie-Durchwischen echter Fotos.
>    CGI nur noch als Ausnahme.
> 5. Formate (a)–(e) brauchen echte Clips. Fremde TikTok-Clips sind tabu (Für-dich-Sperre wegen „nicht originell“). Darum: Nevio filmt pro Produkt 5 kurze Einstellungen à 3–6 s (nur Hände, Anleitung in `videos/rohmaterial/eigenes/LIESMICH.md`), Claude schneidet. Bis Material da ist: Formate (f) und (g).


> **GILT AB 9.11.2026 (Nevio): Nevio lädt die Videos selbst in TikTok Studio hoch und plant sie selbst.**
> Claude baut, prüft und liefert nur, was er eingeben soll: pro Kanal (@maiosshop, @maiosshop.com) Dateiname (mit Musik), Caption zum Kopieren, Hashtags, Datum und Uhrzeit für „Zeitplan“ (12:00 / 18:00, Europe/Berlin), Titelbild-Sekunde, Text für den angepinnten Kommentar. Claude öffnet dafür kein TikTok Studio, lädt nichts hoch, plant nichts ein und postet nichts.
> Das geht den Schritten „Planen“ und „Nachlauf“ (Upload, Anpinnen) in der Routine „Maios Vorproduktion und veröffentlichung“ vor. Tageslog, Kennzahlen und Verschieben nach `hochgeladen` nur, wenn Nevio meldet, dass er gepostet hat.
> Als Status in vorrat.md statt „geplant“: „fertig, Nevio lädt hoch“ und danach „von Nevio geplant/gepostet“.

# Vorrat TikTok (Maios)

Für jeden Slot steht hier, welches Video dafür gebaut wird und wie weit es ist. Gebaut wird mindestens einen Tag vor dem Slot (Aufgabe „Maios Vorproduktion“, 09:07 und 15:07). Gepostet wird genau um 12:00 und 18:00, auf beiden Kanälen dasselbe Video (Aufgabe „Maios Veröffentlichung“, 11:37 und 17:37). Was gepostet ist, steht zusätzlich im tageslog.

Status: offen → in Arbeit (Lauf TT.MM. HH:MM) → fertig, wartet auf Freigabe → freigegeben → geplant für TT.MM. HH:MM → gepostet um HH:MM + Links. Sonst: verpasst + Grund.

Hinweise
- Stimme: Nevio findet die Erzählerstimme gut (Hörprobe am 28.10.). Test mit den Mo-Storys am 4.11. und 11.11.
- Reveal und Grusel B (alter Motion-Look) werden nicht gepostet.
- TikTok-Zeitplan: Nevio hat am 2.11. erlaubt, über „Zeitplan“ in TikTok Studio vorzuplanen. Die Aufgabe „Maios Vorproduktion“ lädt freigegebene Videos jetzt selbst hoch und plant sie auf die Slot-Zeit (beide Kanäle); „Maios Veröffentlichung“ fällt weg.
- **Standregel ab 8.11. für jedes künftige Video (nicht nur einmalig prüfen, sondern bei jedem Bau-Lauf anwenden):** vor der Hashtag-/Hook-Wahl in TikTok Studio → Inspiration (Themen, Kategorie passend zum Produkt, z. B. Lebensstil) nachsehen, was gerade zieht, und wenn's passt in Hook oder Hashtags einbauen. Die eigentliche „Search Insights“-Funktion aus TikTok ist in TikTok Studio Web für @maiosshop nicht sichtbar (vermutlich Account-/Follower-abhängig oder nur in der App) – Stand 8.11. Sobald jemand mit Zugriff auf die TikTok-App (Handy) das prüfen kann, hier nachtragen, ob es dort sichtbar ist; bis dahin gilt der Inspiration-Workaround für jedes Video.
- Claude + DaVinci-Resolve-Connector (Nevio 8.11., Punkt 3 von 4): geprüft, kein passender MCP-Connector in der Registry, und unsere Pipeline läuft komplett automatisiert über ffmpeg/three.js ohne manuellen Schnitt-Schritt – macht aktuell keinen Sinn umzusetzen. Bleibt offen, falls sich der Workflow mal ändert.
- „Claude Motion Graphics“-Skill von Drittanbieter (Nevio 8.11., Punkt 4 von 4; Quelle: TikTok-Account „Skill Stack Store“, Bio-Link): nicht blind installiert – unbekannte Skills von Fremden können versteckte Anweisungen enthalten; außerdem kostet das Original 5,99 $ (Kauf/Zahlungsdaten kann ich nicht selbst eingeben). Nevio hat den Einbau grundsätzlich erlaubt („du darfst den skill einbauen“) und danach gebeten, stattdessen auf GitHub nach einem freien Äquivalent zu suchen. Gefunden & geprüft: `github.com/CloudAI-X/threejs-skills` (MIT-Lizenz, 4,1k⭐, aktiv gepflegt) – 5 Referenzdateien (Animation, Licht, Material/Glas, Shader, Postprocessing) als reines three.js-API-Material ohne verdächtige Inhalte bestätigt. Als Skill-Paket `threejs-cgi-techniken.skill` gebaut und an Nevio geschickt (8.11.); gilt ab jetzt als zusätzliches Nachschlagewerk zum maios-cgi-Skill für alle künftigen Videos, sobald Nevio es speichert. Ziel three.js r186 vs. unser Pipeline-Stand 0.170.0 – vor Übernahme eines Snippets API/Importpfad prüfen, WebGPU/TSL-Abschnitte NICHT nutzen (wir rendern headless per SwiftShader, kein WebGPU).

## Übersicht

| Slot | Format (Plan) | Produkt | Datei | Status |
|---|---|---|---|---|
| Mi 28.10. 12 Uhr | Halloween-Format, neu im Handy-Look: „Das ist kein Hexentrank.“ | 11 Mixer (Weiß) | 11_mixer_hexe_cgi_20261029.mp4 | um 12 Uhr verpasst (nichts fertig); auf Nevios Wunsch („Mixer jetzt posten“) nachgeholt: gepostet um 12:53 (@maiosshop) und 12:57 (@maiosshop.com) + https://www.tiktok.com/@maiosshop/video/7701685645437111574 + https://www.tiktok.com/@maiosshop.com/video/7701686478971211030. Auf @maiosshop fehlen die Hashtags (beim Hochladen verloren, Nachtragen ging nicht). Frage: auf @maiosshop als Kommentar gesetzt (13:56), Anheften geht nur in der App; auf @maiosshop.com um 18:05 gesetzt (Anheften nur in der App) |
| Mi 28.10. 18 Uhr | Handy-Look-Pointe: „Das Licht geht von allein an.“ | 25 Nachtlichter mit Bewegungsmelder | 25_nachtlicht_flur_cgi_20261029.mp4 | gepostet um 18:00 (@maiosshop und @maiosshop.com) + https://www.tiktok.com/@maiosshop/video/7701764588538170646 + https://www.tiktok.com/@maiosshop.com/video/7701764673254771990. beide „Alle“. Frage auf beiden Kanälen als Kommentar gesetzt (@maiosshop.com 18:04, @maiosshop 18:40); Anheften nur in der App |
| Mi 28.10. 20 Uhr (Sonderslot, Nevio 28.10. 18:4x: „bau ein Video für 20 Uhr … zusammengeschnitten“) | Schnitt aus Rohmaterial: „Mein Nachttisch hat ein Geheimnis.“ (11 s) | 10 Wasserspender (Weiß) | 10_wasserspender_nachttisch_20261028.mp4 | gepostet um 20:00 (@maiosshop) und 20:01 (@maiosshop.com) + https://www.tiktok.com/@maiosshop/video/7701795563531980054 + https://www.tiktok.com/@maiosshop.com/video/7701795711838424342; Kommentar gesetzt, Anheften in der App |
| Do 29.10. 12 Uhr | Halloween im Handy-Look: „Halloween. Ich frag die Kugel.“ (Loop 8 s) | 50 Krystall Ball Nachtlampe (Saturn) | 50_krystall-ball_wahrsager_cgi_20261029.mp4 | gepostet um 12:37 (@maiosshop) und 12:38 (@maiosshop.com) + https://www.tiktok.com/@maiosshop/video/7702052288357092630 + https://www.tiktok.com/@maiosshop.com/video/7702052375623896343. Erster Klick um 12:20 blockiert, nach Nevios „ja“ im Chat gepostet. Beide „Alle“; Frage „Saturn oder Mond?“ um 19:0x auf beiden Kanälen kommentiert, Anheften nur in der App |
| Do 29.10. 18 Uhr | Handy-Look-Pointe: „Dieses Feuer ist kalt.“ (Loop 8 s) | 42 Aroma Öl Diffusor (Schwarz) | 42_aroma-diffusor_feuer_cgi_20261029.mp4 | gepostet um 19:04 (@maiosshop) und 19:05 (@maiosshop.com, Nevio 18:5x „uploade es jetzt“) + https://www.tiktok.com/@maiosshop/video/7702152368204320022 + https://www.tiktok.com/@maiosshop.com/video/7702152408704552214. Beide „Alle“ (19:2x geprüft); Frage „Schlafzimmer oder Wohnzimmer?“ um 19:2x auf beiden Kanälen kommentiert, Anheften nur in der App |
| Fr 30.10. 12 Uhr | Halloween im Handy-Look: „Halloween. Meine Wände bewegen sich.“ (Loop 8 s) | 21 Led crystal lampe (Krone) | 21_crystal-lampe_halloween_cgi_20261030.mp4 | freigegeben (Nevio 29.10. abends im Chat: „ja“, beide Kanäle) |
| Fr 30.10. 18 Uhr | Handy-Look-Pointe: „Homeoffice. Ich steh nicht mehr auf.“ (Loop 8 s) | 10 Wasserspender (Schwarz) | 10_wasserspender_homeoffice_cgi_20261029.mp4 | nicht gepostet, verschoben auf Mo 2.11. 18 Uhr; vorher freigegeben (Nevio 28.10. 19:45, von Do 18 Uhr auf Fr verschoben, weil am 28.10. um 20 Uhr schon ein Wasserspender lief) |
| Sa 31.10. 12 Uhr | Satisfying-Loop, 1. Folge: Mixer-Wirbel (Loop 8 s) | 11 Mixer (Rosa) | 11_mixer_satisfying_cgi_20261031.mp4 (geplant) | verpasst (nicht gerendert); verschoben auf Mo 2.11. 12 Uhr. Szene steht: `scenes/mixer_satisfying.js` + `_ton.py` (Lauf 29.10. 19:20). Runde-1-Einwände des zweiten Prüfers sind eingearbeitet: Deckel rosa statt schwarz, Hals als Trichter, sichtbarer Spiralwirbel mit Erdbeerstücken, Untersicht neu. Nächster Lauf: rendern (ca. 25 min), Videocheck, zweiter Blick Runde 2, Freigabe |
| Sa 31.10. 18 Uhr | Halloween zum Schluss | | | offen |
| So 1.11. 12 Uhr | Trend-Format | | | offen |
| So 1.11. 18 Uhr | Trend-Format | | | offen |
| Mo 2.11. 12 Uhr | Satisfying-Loop: Mixer-Wirbel (Loop 8 s), vom Sa 31.10. verschoben (Nevio 1.11. abends: „ja“) | 11 Mixer (Rosa) | 11_mixer_satisfying_cgi_20261102.mp4 | gepostet um 22:00 (geplant, auf Nevios Wunsch statt 12 Uhr) + https://www.tiktok.com/@maiosshop/video/7703646629659806998 („Alle“, Frage „Rosa oder Blau?“ gesetzt 03.11., Anheften in der App); @maiosshop.com nicht geprüft (Profil nicht verbunden) |
| Mo 2.11. 18 Uhr | Handy-Look-Pointe: „Homeoffice. Ich steh nicht mehr auf.“ (Loop 8 s), vom Fr 30.10. 18 Uhr übernommen (nie gepostet) | 10 Wasserspender (Schwarz) | 10_wasserspender_homeoffice_cgi_20261029.mp4 | freigegeben (Nevio 1.11. abends: „ja“ für Mo 18 Uhr; Captions wie im Abschnitt Fr 30.10. 18 Uhr); verpasst (zu spät): Lauf 15:07 startete erst 19:15, Slot + 60 min vorbei, nicht geplant und nicht gepostet. Video bleibt freigegeben für einen neuen Slot, Nevio gefragt; am 2.11. ca. 19:55 gepostet (siehe Sonderslot) |
| Mo 2.11. 19:55 (Sonderslot, Nevio: „mach Homeoffice jetzt“) | Handy-Look-Pointe: „Homeoffice. Ich steh nicht mehr auf.“ (Loop 8 s) | 10 Wasserspender (Schwarz) | 10_wasserspender_homeoffice_cgi_20261029.mp4 | gepostet 19:53 (@maiosshop, „Alle“) + https://www.tiktok.com/@maiosshop/video/7703649305084661014, Frage „Schwarz oder Weiß?“ gesetzt 03.11., Anheften in der App; @maiosshop.com nicht geprüft (Profil nicht verbunden) |
| Di 3.11. 12 Uhr | Handy-Look-Pointe: „Mein Kaminfeuer ist kaputt.“ (Farbwechsel, Loop 8 s) | 42 Aroma Öl Diffusor (Weiß) | 42_aroma-diffusor_farben_cgi_20261103.mp4 | gepostet um 12:00 (geplant) + https://www.tiktok.com/@maiosshop/video/7703664692929039638 („Alle“, Frage gesetzt, Anheften in der App); @maiosshop.com nicht geprüft (Profil nicht verbunden) |
| Di 3.11. 18 Uhr | Geschenkidee unter 20 €: „Bei mir schneit es schon.“ (Loop 8 s) | 50 Krystall Ball Nachtlampe (Schneemann) | 50_krystall-ball_schnee_cgi_20261103.mp4 | gepostet um 18:00 (geplant) + https://www.tiktok.com/@maiosshop/video/7703665700618915094 („Alle“, Frage gesetzt, Anheften in der App); @maiosshop.com nicht geprüft (Profil nicht verbunden) |
| Mi 4.11. 12 Uhr | Mo-Story mit Erzählerstimme (Test 1 von 2): „Drei Uhr nachts. Ich muss mal.“ (Story 23,4 s) | 25 Nachtlichter mit Bewegungsmelder | 25_nachtlicht_mo-story_cgi_20261104.mp4 | geplant für 04.11. 12:00 (beide Kanäle, TikTok-Zeitplan; Freigabe Nevio 3.11. ca. 20:4x „mach für beide Kanäle die beiden Videos“; KI-Kennzeichnung an, Titelbild ca. 20 s, Hashtags geprüft) |
| Di 3.11. 20 Uhr (Sonderslot, Nevio 3.11. 19:3x: „lade um 20 Uhr noch ein Video hoch“) | Handy-Look-Pointe: „17 Uhr. Draußen schon dunkel.“ (Loop 8 s) | 21 Led crystal lampe (Krone) | 21_crystal-lampe_polarlicht_cgi_20261104.mp4 | gepostet um 20:00 (beide Kanäle, laut Studio; vorher geplant, TikTok-Zeitplan; Captions wie Abschnitt Mi 4.11. 18 Uhr; Titelbild auf @maiosshop 4 s, auf @maiosshop.com Standard, weil das Chrome-Fenster dort zu klein war) |
| Mi 4.11. 18 Uhr | Handy-Look-Pointe: „Nach dem Training. Shake? Läuft schon.“ (Loop 8 s), Ersatz für die Lampe (läuft schon 3.11. 20 Uhr) | 11 Mixer (Blau) | 11_mixer_gym_cgi_20261104.mp4 | geplant für 04.11. 18:00 (beide Kanäle, TikTok-Zeitplan; Freigabe Nevio 3.11. ca. 20:4x; Titelbild Standard = erstes Bild mit Mixer + Produktwort; Hashtags geprüft) |
| Do 5.11. 12 Uhr | Geschenkidee unter 20 €: „Das Riesenrad steht schon. Im Glas, auf meinem Regal.“ (Loop 8 s) | 50 Krystall Ball Nachtlampe (Riesenrad) | 50_krystall-ball_riesenrad_cgi_20261105.mp4 | geplant für 05.11. 12:00 (beide Kanäle, TikTok-Zeitplan; auf Nevios Wunsch von 18 Uhr auf 12 Uhr verlegt, siehe Detail) |
| Do 5.11. 18 Uhr | Handy-Look-Pointe: „Schlauch rein. Läuft.“ (Loop 8 s) | 10 Wasserspender (Weiß) | 10_wasserspender_kueche_cgi_20261105.mp4 | geplant für 05.11. 18:00 (beide Kanäle, TikTok-Zeitplan; siehe Detail) |
| Fr 6.11. 12 Uhr | Trend-Format | | | offen |
| Fr 6.11. 18 Uhr | Trend-Format | | | offen |
| Mo 9.11. 12 Uhr | Handy-Look-Pointe: „An meiner Decke läuft was.“ (Loop 8 s, Schlafzimmer-POV, Würfel-Lampe) | 21 Led crystal lampe (Holz boden) | 21_crystal-lampe_decke_cgi_20261109.mp4 | gepostet um 12:00 (@maiosshop „Alle“, laut Studio 11.11.) + https://www.tiktok.com/@maiosshop/video/7705945963394993410; @maiosshop.com nicht geprüft (Profil nicht verbunden) |
| Mo 9.11. 18 Uhr | „Wichteln unter 20 €“ (feste Reihe ab 9.11.): „Wichteln. Limit: 20 €.“ (Loop 8 s, Geschenkbox geht auf, Saturn) | 50 Krystall Ball Nachtlampe (Saturn) | 50_krystall-ball_wichteln_cgi_20261109.mp4 | gepostet um 18:00 (@maiosshop „Alle“, laut Studio 11.11.) + https://www.tiktok.com/@maiosshop/video/7705946365968272662; @maiosshop.com nicht geprüft |
| Di 10.11. 12 Uhr | Christmas Switch: „Mein Kürbis muss jetzt ausziehen.“ (Loop 8 s, Halloween-Regal wird Weihnachtsregal) | 42 Aroma Öl Diffusor (Schwarz) | 42_aroma-diffusor_weihnachtsmodus_cgi_20261110.mp4 | gepostet um 12:00 (@maiosshop „Alle“, laut Studio 11.11.) + https://www.tiktok.com/@maiosshop/video/7706194863909391638; @maiosshop.com nicht geprüft |
| Di 10.11. 18 Uhr | Handy-Look-Pointe: „7:12 Uhr. Frühstück fährt mit.“ (Loop 8 s, Pendlerzug) | 11 Mixer (Rosa) | 11_mixer_zug_cgi_20261110.mp4 | gepostet um 18:00 (@maiosshop „Alle“, laut Studio 11.11.) + https://www.tiktok.com/@maiosshop/video/7706200919502900502; @maiosshop.com nicht geprüft |
| Mi 11.11. 12 Uhr | Mo-Story mit Erzählerstimme (Test 2 von 2, Story 20–25 s): verschoben, Slot jetzt Wasserspender-Story | | | verschoben, Nevio entscheidet (18 Uhr oder entfällt) |
| Mi 11.11. 12 Uhr (Nevio 9.11.: „mach das für übermorgen 12 Uhr“) | Story im @mehr.optic-Stil (20,5 s): „Jeden Morgen dieselbe Gallone.“ (Figurenmenge, Blueprint, Explosionsansicht, Neon-Preis); Loop-Version bleibt Reserve | 10 Wasserspender (Weiß/Schwarz) | 10_wasserspender_story-mehroptic_cgi_20261111.mp4 | gepostet um 12:00 (@maiosshop „Alle“, laut Studio 11.11.) + https://www.tiktok.com/@maiosshop/video/7706660931551497494; @maiosshop.com nicht geprüft |
| Mi 11.11. 18 Uhr (Nevio 10.11.: „noch ein Video, das wir noch nicht hatten“) | Story im @mehr.optic-Stil (20,5 s): „Jeden Morgen dieselbe Suche.“ (Figurenmenge, Blueprint, Explosionsansicht, Radar im Wohnzimmer, Neon-Preis) | 17 Bluetooth Anti-Lost Finder Wassertropfen | 17_bluetooth-finder_story-mehroptic_cgi_20261111.mp4 | von Nevio geplant für 18:00 (@maiosshop „Alle“, laut Studio 11.11. 18:0x) + https://www.tiktok.com/@maiosshop/video/7706662035202772246; @maiosshop.com nicht geprüft |
| Do 12.11. 12 Uhr | Story im @mehr.optic-Stil (20,5 s): „Nachts leuchtet jeder mit dem Handy.“ (Figurenmenge mit Handylampen, Stufe, Blueprint, Explosionsansicht, Treppe, Neon-Preis) | 25 Nachtlichter mit Bewegungsmelder | 25_nachtlicht_story-mehroptic_cgi_20261112.mp4 | von Nevio veröffentlicht/geplant für 12.11. 12:00 (beide Kanäle, Meldung 12.11. nachts; Freigabe damit erteilt). Links folgen im Nachlauf |
| Do 12.11. 18 Uhr | Handy-Look-Loop (8 s, Zweitformat): „Heute Morgen um 7 eingefüllt.“ (Zeitraffer am Schreibtisch, Uhr rast, Sonne wandert) | 47 Tumbler Becher (Storm Sea) | 47_tumbler_zeitraffer_cgi_20261112.mp4 | von Nevio veröffentlicht/geplant für 12.11. 18:00 (beide Kanäle, Meldung 12.11. nachts; Freigabe damit erteilt). Links folgen im Nachlauf |
| Fr 13.11. 12 Uhr | Neuer Stil auf Nevios Wunsch (12.11. nachts: „ganz neu, neuer Artstyle“): Knetanimation, Stop-Motion 12 fps (20,5 s) „Mein Kaffee fängt hier an.“ | 55 Elektrische Kaffee- und Gewürzmühle | 55_kaffeemuehle_knete-story_cgi_20261113.mp4 | von Nevio hochgeladen/geplant für 13.11. 12:00 (beide Kanäle, Meldung 12.11.; Freigabe damit erteilt). Links folgen im Nachlauf |
| Fr 13.11. 18 Uhr | Neuer Stil: Pop-up-Buch aus Papier (20,5 s) „Zwei Minuten können lang sein.“ | 57 Elektrische Schallzahnbürste (Schwarz, am Ende Schwarz + Weiß) | 57_zahnbuerste_popup-story_cgi_20261113.mp4 | von Nevio hochgeladen/geplant für 13.11. 18:00 (beide Kanäle, Meldung 12.11.; Freigabe damit erteilt). Links folgen im Nachlauf |
| Sa 14.11. 12 Uhr | „Echt statt KI“ Format B: Galerie-Wischen durch 7 Farben (Notiz-Liste auf Nevios Wunsch 13.11. gelöscht) | 47 Tumbler Becher | 47_tumbler_farben_echt_20261114.mp4 | von Nevio hochgeladen/geplant für 14.11. 12:00 (Meldung 13.11. abends). Links folgen im Nachlauf |
| Sa 14.11. 18 Uhr | „Echt statt KI“ Format B: Galerie-Wischen, 7 Motive (überarbeitet: ohne Unschärfe-Balken, neuer Hook) | 50 Krystall Ball Nachtlampe | 50_krystall-ball_galerie_echt_20261114.mp4 | von Nevio hochgeladen/geplant für 14.11. 18:00 (Meldung 13.11. abends). Links folgen im Nachlauf |
| So 15.11. 18 Uhr (Nevio 15.11.: „mach ein Video für heute 18 Uhr“) | Motion-Spot (2D, echte Fotos): „Was druckt dieses kleine Ding?“ | 43 Mini Thermal Drucker | 43_mini-thermal-drucker_spot_20261115.mp4 | von Nevio hochgeladen/geplant für 15.11. 18:00 (beide Kanäle, Meldung 15.11. nachmittags). Links folgen im Nachlauf |
| Mo 16.11. 12 Uhr | real-Galerie (echte Fotos, 6 Farben): „Wo ist mein Schlüssel?“ | 17 Bluetooth Anti-Lost Finder | 17_bluetooth-finder_farben_echt_20261116.mp4 | von Nevio hochgeladen/geplant für 16.11. 12:00 (beide Kanäle, Meldung 15.11. abends). Links folgen im Nachlauf |
| Mo 16.11. 18 Uhr | Motion-Spot OHNE Fotos (Nevio 15.11.: „ohne Bilder, anderer Skill, komplett neu“): „Lohnt sich frisch mahlen?“ (13,1 s) | 55 Elektrische Kaffee- und Gewürzmühle | 55_kaffeemuehle_spot_20261116.mp4 | von Nevio hochgeladen/geplant für 16.11. 18:00 (beide Kanäle, Meldung 15.11. abends). Links folgen im Nachlauf |
| Di 17.11. 12 Uhr (Nevio 16.11.: „2 neue Videos für morgen, etwas, das es noch nicht gab“) | NEU: Zoom-Rätsel „Rate mal, was das ist.“ (Nahaufnahme zoomt auf, Auflösung ab 3 s) | 63 Akku-Reifenpumpe mit Display | 63_akku-reifenpumpe_raetsel_20261117.mp4 | fertig, Nevio lädt hoch |
| Di 17.11. 18 Uhr (Nevio 16.11., wie oben) | NEU: Karten mischen „Behalt den rosa Mixer im Blick.“ (3 Farben, mischen, aufdecken) | 11 Mixer (Weiß, Rosa, Blau) | 11_mixer_mischen_20261117.mp4 | fertig, Nevio lädt hoch |
| Reserve | Wissensvideo (Format W, KI-Stimme): „Warum schmeckt frisch gemahlener Kaffee anders?“ (44,9 s), von Nevio für 16.11. durch den Spot ersetzt | 55 Elektrische Kaffee- und Gewürzmühle | 55_kaffeemuehle_wissen_20261116.mp4 | fertig, nicht eingeplant (KI-Kennzeichnung ja) |
| Reserve | zeitloser Satisfying-Loop für Notfälle, ohne Datum und Anlass | | | offen |

## Details

Je fertigem Video ein Abschnitt „### <Slot>“ mit: Datei (+ `_ohne_musik`), Titelbild-Sekunde, Caption @maiosshop, Caption @maiosshop.com, Hashtags, Frage für den angehefteten Kommentar, Trend + Quelle, Vorlage-Videos, Ergebnis Videocheck und zweiter Blick, KI-Kennzeichnung ja/nein.

### Mi 28.10. 12 Uhr
- Gebaut für Do 29.10. 12 Uhr, auf Nevios Wunsch am 28.10. als Ersatz für den verpassten 12-Uhr-Slot nachgeholt
- Datei: `11_mixer_hexe_cgi_20261029.mp4` + `11_mixer_hexe_cgi_20261029_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −14 LUFS, Spitze −1,6 dBTP)
- Titelbild: 1,1 s (Mixer läuft, „Mixer“ neben der Werbung-Pille)
- Caption @maiosshop: Elektrischer Mixer Entsafter, 350 ml / Das ist kein Hexentrank. Nur mein Frühstück. Kompakter Mixer für Smoothies und frische Säfte unterwegs. 40,99 €, Link im Profil. Weiß oder Rosa?
- Caption @maiosshop.com: Elektrischer Mixer Entsafter, 350 ml / Sieht aus wie ein Hexentrank, ist aber keiner. Kompakter Mixer für Smoothies und frische Säfte unterwegs. 40,99 €, Link im Profil. Weiß oder Rosa?
- Hashtags: #werbung #mixer #smoothie #halloween
- Angehefteter Kommentar: Weiß oder Rosa?
- Trend + Quelle: Halloween-Formate bis 31.10. (Doc „TikTok-Trends → Maios“, Plan bis Weihnachten; newengen.com/insights/october-tiktok-trends)
- Vorlage-Videos: Wasserspender-Gruselfakt 27.10. (Handy-Look, Nacht); 72-h-Werte liegen noch nicht vor
- Szene vom Lauf 28.10. 01:00 vorbereitet (`scenes/mixer_hexe.js`), in diesem Lauf gerendert und geprüft
- Videocheck: ok. Bewegung ab Bild 0 (Mixer läuft, lila Wirbel), keine Auflösung bis 3 s, „Mixer“ bis 2,95 s, Werbung durchgehend, letztes Bild = Bild 0, Einstellungen ≤ 2,2 s, Text außerhalb der Sperrzonen
- Zweiter Blick: Einwände: Deckel/Schlaufe weichen vom Shopfoto Weiß ab (bestehendes Modell aus `mixer_models.js`, Chromdeckel mit dunkler Platte, Ring-Schlaufe; so auch in den geposteten Mixer-Videos); Weiß wirkt im Nachtlicht cremefarben; Wirbel könnte lebendiger sein. Loop-Ende geprüft: passt (Einwand dazu nicht bestätigt). Nicht geändert, Nevio entscheidet.
- KI-Kennzeichnung: nein (keine Stimme)

### Mi 28.10. 18 Uhr
- Gebaut für Do 29.10. 18 Uhr, auf Nevios Wunsch vorgezogen: Freigabe 28.10. 12:58 für heute 18 Uhr, beide Kanäle
- Datei: `25_nachtlicht_flur_cgi_20261029.mp4` + `25_nachtlicht_flur_cgi_20261029_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −13,8 LUFS, Spitze −1,3 dBTP)
- Titelbild: 2,4 s (Sensor nah, „Nachtlicht“ neben der Pille)
- Caption @maiosshop: Nachtlicht mit Bewegungsmelder für den Flur / 3 Uhr nachts im Flur: Das Licht geht von allein an. Kein Spuk, ein Bewegungsmelder. Warmes Licht, batteriebetrieben, klebt einfach an die Wand. 23,99 €, Link im Profil. Flur oder Kinderzimmer?
- Caption @maiosshop.com: Nachtlicht mit Bewegungsmelder für den Flur / Nachts im Flur geht das Licht von allein an? Kein Spuk, ein Bewegungsmelder. Warmes Licht, batteriebetrieben, klebt einfach an die Wand. 23,99 €, Link im Profil. Flur oder Kinderzimmer?
- Hashtags: #werbung #nachtlicht #bewegungsmelder #beleuchtung
- Angehefteter Kommentar: Flur oder Kinderzimmer?
- Trend + Quelle: Halloween-/Spuk-Pointe im Handy-Look (Doc „TikTok-Trends → Maios“)
- Vorlage-Videos: Wasserspender-Gruselfakt 27.10. (Handy-Look); erstes Video dieses Produkts
- Szene vom Lauf 28.10. 01:00 vorbereitet (`scenes/nachtlicht_flur.js`); in diesem Lauf Nah-Einstellungen knapper belichtet und Holz abgedunkelt (war rosa/kupfer), Produktwort mit dunklem Hintergrund
- Videocheck: ok. Licht geht bei 0,1 s an, keine Auflösung bis 3 s („Kein Spuk. Bewegungsmelder.“ ab 3,5 s), „Nachtlicht“ bis 2,95 s, Werbung durchgehend, letztes Bild = Bild 0 (dunkler Flur), Einstellungen ≤ 2 s
- Zweiter Blick: ok mit kleinen Änderungen: Produkt im Einstieg klein, Maserung schwach; Loop-Ende geprüft: passt
- KI-Kennzeichnung: nein (keine Stimme)

### Do 29.10. 12 Uhr
- Datei: `50_krystall-ball_wahrsager_cgi_20261029.mp4` + `50_krystall-ball_wahrsager_cgi_20261029_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −13,9 LUFS, Spitze −1,4 dBTP)
- Titelbild: 1,2 s (Kugel mit Saturn leuchtet, „Nachtlampe“ neben der Werbung-Pille)
- Caption @maiosshop: Kristallkugel Nachtlampe mit Saturn / Halloween. Ich frag die Kugel. Keine Magie, nur meine Nachtlampe: leuchtende Kristallkugel mit Saturn im Glas, 7 Motive zur Auswahl. 17,99 €, Link im Profil. Saturn oder Mond?
- Caption @maiosshop.com: Kristallkugel Nachtlampe mit Saturn / Halloween: einmal die Kugel gefragt. Keine Magie, nur meine Nachtlampe: leuchtende Kristallkugel mit Saturn im Glas, 7 Motive zur Auswahl. 17,99 €, Link im Profil. Saturn oder Mond?
- Hashtags: #werbung #nachtlampe #kristallkugel #halloween
- Angehefteter Kommentar: Saturn oder Mond?
- Trend + Quelle: Halloween-Formate bis 31.10. (Doc „TikTok-Trends → Maios“, Plan bis Weihnachten; newengen.com/insights/october-tiktok-trends), Wahrsager-Pointe im Handy-Look
- Vorlage-Videos: Mixer „Hexentrank“ 28.10. und Nachtlicht 28.10. (Handy-Look-Loop, Pointe im Text); 72-h-Werte liegen noch nicht vor
- Neu gegenüber früheren Kugel-Videos (25.10. Tiefe/Mond, 27.10. Mo-Story/Mond): Wahrsagertisch mit lila Samt, Kerzen, Tarotkarten, Nebel; Motiv Saturn; keine Figur, kein Licht-aus/an
- Szene: `scenes/kugel_wahrsager.js`, Ton `scenes/kugel_wahrsager_ton.py` (Dream-Lo-Fi d-Moll, Spieluhr, ohne Klang-Logo)
- Videocheck: ok. Ab Bild 0 Nebel zieht vor und um den Tisch, Kerzen flackern, Kamerafahrt; keine Auflösung bis 3 s („Keine Magie. Nur meine Nachtlampe.“ ab 3,9 s); „Nachtlampe“ bis 2,95 s; Werbung durchgehend; letztes Bild = Bild 0; Einstellungen: 2,2 / 1,6 / 1,4 / 1,4 / 1,4 s; Text außerhalb der Sperrzonen, nie auf dem Produkt
- Zweiter Blick: erste Runde 3 Einwände (Einstieg zu ruhig, Hook-Einblendung über 6 Wörter, „Link im Profil“ prüfen) + Gravur zu kühl, Kerzenstreifen in der Nahaufnahme. Behoben (Nebel, neuer Hook, wärmere Gravur, neuer Winkel), zweite Runde: alles erledigt. Offen als „Kann“: Sockel-Einstellung unten viel Holz
- KI-Kennzeichnung: nein (keine Stimme)

### Fr 30.10. 18 Uhr
- Gebaut für Do 29.10. 18 Uhr, auf Fr verschoben (Dateiname behält das Baudatum)
- Datei: `10_wasserspender_homeoffice_cgi_20261029.mp4` + `_ohne_musik` (Loop 8,0 s, 5,5 MB, −14,1 LUFS, Spitze −1,4 dBTP)
- Titelbild: 1,5 s (Strahl ins Glas, „Wasserspender“ neben der Pille)
- Caption @maiosshop: Elektrischer Wasserspender für Schreibtisch / Homeoffice. Ich steh nicht mehr auf. Der Spender holt das Wasser direkt aus der Flasche. Wiederaufladbar, für Büro und Zuhause. 38,99 €, Link im Profil. Schwarz oder Weiß?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Im Homeoffice steh ich fürs Wasser nicht mehr auf.“
- Hashtags: #werbung #wasserspender #schreibtisch #homeoffice
- Angehefteter Kommentar: Schwarz oder Weiß?
- Trend + Quelle: Handy-Look-Pointe mit Kontrast-Witz (Doc „TikTok-Trends → Maios“)
- Neu gegenüber früheren Wasserspender-Videos: Tag, Homeoffice, salbeigrüne Wand mit Sonnenkreuz, Farbe Schwarz, Wasser läuft ab Bild 0 (kein Knopf bewegt sich)
- Szene: `scenes/wasser_buero.js`, Ton `scenes/wasser_buero_ton.py` (Tropical House A-Dur, ohne Klang-Logo)
- Videocheck: ok (Bewegung ab Bild 0, keine Auflösung vor 3 s, Hook 6 Wörter, Werbung durchgehend, letztes Bild = Bild 0, Einstellungen ≤ 2,2 s)
- Zweiter Blick: Runde 1: Schlauch unsichtbar, Hook-Bewegung in der unteren Sperrzone, Kupferscheibe vorne am Auslauf; Runde 2: Schlauch endete frei über dem Hals. Alles behoben (Schlauch hinter der Flasche hoch, über den Hals, innen bis zum Boden; Kamera höher; Auslauf dunkel; Glas nicht mehr in der Säule). Letzte Fassung nach Runde 2 selbst geprüft.
- KI-Kennzeichnung: nein

### Do 29.10. 18 Uhr
- Datei: `42_aroma-diffusor_feuer_cgi_20261029.mp4` + `_ohne_musik` (Loop 8,0 s, 5,4 MB, −13,9 LUFS, Spitze −3,2 dBTP)
- Titelbild: 1,0 s (Flamme an, „Diffusor“ neben der Pille)
- Caption @maiosshop: Aroma Öl Diffusor mit Flammeneffekt / Dieses Feuer ist kalt. Nur Nebel mit Licht: Ultraschall-Diffusor mit 3D-Flammeneffekt, 130 ml Tank für bis zu 6 Stunden. 26,99 €, Link im Profil. Schlafzimmer oder Wohnzimmer?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Sieht aus wie Feuer, ist aber kalt.“
- Hashtags: #werbung #aromadiffusor #aromatherapie #schlafzimmer
- Angehefteter Kommentar: Schlafzimmer oder Wohnzimmer?
- Trend + Quelle: Handy-Look-Pointe / Satisfying-Kernmoment (Doc „TikTok-Trends → Maios“)
- Vorlage-Videos: Handy-Look-Loops vom 28.10.; erstes Video dieses Produkts, neues Modell `lib/diffusor_models.js` (Vulkanform mit Spiralrillen, Lichtring, Flammen-Nebel-Shader)
- Szene: `scenes/diffusor_feuer.js`, Ton `scenes/diffusor_feuer_ton.py` (Chill F-Dur, Marimba, ohne Klang-Logo)
- Videocheck: ok (Flamme flackert ab Bild 0, keine Auflösung vor 3 s, „Diffusor“ bis 3,1 s, Werbung durchgehend, letztes Bild = Bild 0, Einstellungen ≤ 2,2 s)
- Zweiter Blick: 2 Muss-Punkte (#luftbefeuchter steht nicht in products.json → #aromatherapie; Produktwort bis 3,1 s) behoben. Offen als „Kann“: Rillen feiner und nur unten, rundere Schulter, Flamme breiter/orangener, weniger blauer Glanz
- KI-Kennzeichnung: nein

### Fr 30.10. 12 Uhr
- Datei: `21_crystal-lampe_halloween_cgi_20261030.mp4` + `21_crystal-lampe_halloween_cgi_20261030_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −14,0 LUFS, Spitze −1,1 dBTP)
- Titelbild: 4,6 s (Lampe nah, lila, „LED Crystal Lampe“ neben der Pille)
- Caption @maiosshop: LED Crystal Lampe mit Projektion, 16 Farben / Halloween, 3 Uhr nachts: Meine Wände bewegen sich. Ist nur meine Lampe: drehende Lichtprojektion an die Wand, 16 Farben, dimmbar, läuft über USB. 18,99 €, Link im Profil. Rot oder Lila?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Warum bewegen sich um 3 Uhr nachts meine Wände?“
- Hashtags: #werbung #ledlampe #projektionslampe #halloween
- Angehefteter Kommentar: Rot oder Lila?
- Trend + Quelle: Halloween-Formate bis 31.10. (Doc „TikTok-Trends → Maios“, Plan bis Weihnachten; newengen.com/insights/october-tiktok-trends), Spuk-Pointe im Handy-Look, Effekt nur am Raum (Projektion)
- Vorlage-Videos: Handy-Look-Loops vom 28./29.10. (Nachtlicht, Kugel); 72-h-Werte liegen noch nicht vor
- Erstes Video dieses Produkts. Neues Modell `lib/crystal_models.js` (Holzsockel mit Touch-Symbol, Krone aus gehämmertem Acryl, Projektion als Raum-Shader, periodisch in 8 s); Szene `scenes/crystal_halloween.js`, Ton `scenes/crystal_halloween_ton.py` (Glas-Arpeggios e-Moll → G-Dur, ohne Klang-Logo)
- Ablauf: rote Wellen an der Schlafzimmerwand (Hook) → Totale, Farben Rot/Lila/Grün/Blau → Lampe nah („Nur meine Lampe. 16 Farben.“ ab 3,8 s) → Nachttisch, Preis + Link → zurück zur roten Wand
- Videocheck: ok. Bewegung ab Bild 0 (Projektion zieht), keine Auflösung vor 3,8 s, Produktwort durchgehend, Werbung durchgehend, letztes Bild = Bild 0, Einstellungen 2,0/1,8/1,8/1,2/1,2 s, Text außerhalb der Sperrzonen und nie auf dem Produkt
- Zweiter Blick: Runde 1: 2 Muss (Hook 8 Wörter in zwei Pointen; Lampe zu dunkel/rissig, Zacken zu dünn) + Kann (Farbwechsel-Text, „Decke“ in der Caption, Frage). Alles behoben. Runde 2: keine Muss-Punkte. Offen als „Kann“: Einstieg noch heller, Acryl noch klarer, Zimmer schlicht
- KI-Kennzeichnung: nein (keine Stimme)

### Mo 2.11. 12 Uhr
- Datei: `11_mixer_satisfying_cgi_20261102.mp4` + `11_mixer_satisfying_cgi_20261102_ohne_musik.mp4` (Loop 8,0 s, 5,4 MB, −14,0 LUFS, Spitze −3,3 dBTP)
- Titelbild: 1,0 s (Mixer mit Wirbel, „Mixer“ neben der Werbung-Pille, Hook darüber)
- Caption @maiosshop: Elektrischer Mixer Entsafter, 350 ml / Hier hat niemand umgerührt. Das war der Mixer: Milch und Erdbeere, einmal durchgewirbelt. Kompakter Mixer für Smoothies und frische Säfte unterwegs. 40,99 €, Link im Profil. Rosa oder Blau?
- Caption @maiosshop.com: Elektrischer Mixer Entsafter, 350 ml / Umgerührt hat hier keiner. (Rest wie oben)
- Hashtags: #werbung #mixer #smoothie #küchengadget
- Angehefteter Kommentar: Rosa oder Blau?
- Trend + Quelle: festes Format Satisfying-Loop (Trend-Doc „TikTok-Trends → Maios“, Abschnitt „Zusätzliche Formate ab 28.10.“), Folge 1, vom Sa 31.10. verschoben
- Vorlage-Videos: Handy-Look-Loops 28./29.10. (Mixer „Hexentrank“, Kugel, Diffusor); 72-h-Werte nicht neu ausgewertet
- Neu gegenüber früheren Mixer-Videos: helles Mint-Studio, Podest, Marmor-Wirbel Milch/Erdbeere, Farbe Rosa, keine Nacht, keine Figur
- Szene: `scenes/mixer_satisfying.js` (Lauf 01.11.: Hook-Zeile 0–2 s und 7–8 s, erste Einstellung weiter weg, Deckelrand verspiegelt hell-türkis, Erdbeerstücke unregelmäßig), Ton `scenes/mixer_satisfying_ton.py`
- Videocheck: ok. Bewegung ab Bild 0 (Wirbel, Stücke, Kamerafahrt), keine Auflösung bis 3 s, „Mixer“ durchgehend, Werbung durchgehend, Preis + Link 5,6–7,0 s, letztes Bild = Bild 0 (Abweichung 2,8/255), Einstellungen 2,0 / 1,8 / 1,8 / 1,4 / 1,0 s (erste und letzte zusammen 3 s), Text außerhalb der Sperrzonen und nicht auf dem Produkt
- Zweiter Blick: Runde 1 „ändern“ (Hook fehlte, #satisfying, Pille am Deckel, Deckelrand, Beeren rund) → alles umgesetzt; Runde 2 „freigabefähig“. Offene Empfehlung: Erdbeerstücke wirken nah eher wie Granatapfelkerne, Deckel etwas zu türkis
- Kommentare 1.11.: @maiosshop keine echten Fragen (nur „wow“); Profil @maiosshop.com nicht mit Chrome verbunden, nicht geprüft
- KI-Kennzeichnung: nein (keine Stimme)

### Di 3.11. 18 Uhr
- Datei: `50_krystall-ball_schnee_cgi_20261103.mp4` + `50_krystall-ball_schnee_cgi_20261103_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −13,9 LUFS, Spitze −1,5 dBTP)
- Titelbild: 1,2 s (Kugel mit Schneemann leuchtet, Regen am Fenster, „Nachtlampe“ neben der Pille, Hook darüber)
- Caption @maiosshop: Geschenkidee unter 20 € / Draußen Regen, bei mir schneit's. Kristallkugel Nachtlampe mit Schneemann im Glas, 7 Motive zur Auswahl. 17,99 €, Link im Profil. Schneemann oder Mond?
- Caption @maiosshop.com: Geschenkidee unter 20 € / Bei mir schneit's schon, draußen nur Regen. (Rest wie oben)
- Hashtags: #werbung #nachtlampe #kristallkugel #geschenkidee
- Angehefteter Kommentar: Schneemann oder Mond?
- Trend + Quelle: Geschenkideen-Saison ab November (Plan bis Weihnachten im Doc „TikTok-Trends → Maios“), Kontrast-Pointe im Handy-Look; Suchphrase „Geschenkidee unter 20 €“ nach README
- Vorlage-Videos: Kugel „Wahrsager“ 29.10. und Diffusor 29.10. (Handy-Look-Loop, Pointe im Text); 72-h-Werte nicht neu ausgewertet
- Neu gegenüber früheren Kugel-Videos (25.10. Tiefe/Mond, 27.10. Mo-Story, 29.10. Wahrsager/Saturn): Fensterbrett im November, Regen am Fenster (Streifen, Tropfen, Läufer), Teetasse, Motiv Schneemann; keine Figur, kein Nebel, kein Licht-aus/an
- Szene: `scenes/kugel_schnee.js`, Ton `scenes/kugel_schnee_ton.py` (Winter-Lo-Fi F-Dur, Spieluhr, Regen, ohne Klang-Logo); Motiv Schneemann in `lib/kugel_models.js` nach Shopfoto neu (kleiner Schneemann mit Mütze, großer mit Zylinder, Schals, Tanne, Haus, Schlitten, Mond)
- Ablauf: Totale Fensterbrett mit Regen, Hook „Draußen Regen. Bei mir schneit's.“ → nah in die Kugel „Schneemann, Tanne und Mond.“ → Sockel leicht seitlich „Ist meine Nachtlampe.“ (ab 3,8 s) → Preis + Link → zurück zur Totale
- Videocheck: ok. Bewegung ab Bild 0 (Regen, Tropfen, Kamerafahrt, Gravur funkelt leicht), keine Auflösung vor 3,8 s, „Nachtlampe“ bis 3,8 s, Werbung durchgehend, Preis + Link 5,3–6,6 s, letztes Bild = Bild 0 (Abweichung 2,6/255), Einstellungen 2,2/1,6/1,4/1,4/1,4 s, Text außerhalb der Sperrzonen und nicht auf dem Produkt
- Zweiter Blick: Runde 1 „ändern“ (Produktwort bei 3,0 s fehlte, Gravur wich vom Shopfoto ab, Sockel zu breit, blauer Lichtstreifen) → behoben. Runde 2 „ändern“ (Motiv aus Seiten- und Aufsicht nicht erkennbar, Beleg „Link im Profil“) → Winkel näher an frontal, neu gerendert, Link steht 5,75–6,6 s; selbst geprüft. Offen als „Kann“: Schlitten eher Kästchen als Rentier, Schals schwach, Glas nah leicht bernstein, Ablauf ähnlich wie Wahrsager-Video
- Kommentare 2.11. (beide Kanäle, letzte 3 Videos): keine echten Fragen
- KI-Kennzeichnung: nein (keine Stimme)

### Di 3.11. 12 Uhr
- Datei: `42_aroma-diffusor_farben_cgi_20261103.mp4` + `_ohne_musik` (Loop 8,0 s, 5,4 MB, −13,9 LUFS, Spitze −3,2 dBTP)
- Titelbild: 1,5 s (lila Flamme, „Diffusor“ neben der Pille)
- Caption @maiosshop: Aroma Öl Diffusor mit Flammeneffekt / Mein Kaminfeuer ist kaputt. Nicht kaputt, nur bunt: Nebel und LED-Licht machen die Flamme, und die leuchtet in bunten Farben. 130 ml Kapazität. 26,99 €, Link im Profil. Schwarz oder Weiß?
- Caption @maiosshop.com: gleich, Hook-Zeile „Ich dachte, mein Kaminfeuer ist kaputt.“
- Hashtags: #werbung #aromadiffusor #aromatherapie #wohnzimmer
- Angehefteter Kommentar: Schwarz oder Weiß?
- Trend + Quelle: Handy-Look-Pointe mit Kontrast (Doc „TikTok-Trends → Maios“); RGB-Flamme laut products.json
- Vorlage-Videos: Handy-Look-Loops 28./29.10.; Abgrenzung zum Diffusor-Video 29.10. (schwarz, Schlafzimmer, orange)
- Neu: Weiß, Wohnzimmer zur blauen Stunde, helles Eichen-Sideboard, Flamme wechselt Farbe (orange → lila → blau → grün → rot), Aufsicht 45°, neue Produktform nach Shopfoto (`makeDiffusor('weiss', 'shop')`)
- Szene: `scenes/diffusor_farben.js`, Ton `scenes/diffusor_farben_ton.py` (G-Dur, Marimba, ohne Klang-Logo)
- Videocheck: ok (Bewegung ab Bild 0, Farbwechsel ab 0,3 s, keine Auflösung vor 3,9 s, Werbung + „Diffusor“ durchgehend, Preis + Link 5,3–6,6 s, letztes Bild = Bild 0, Einstellungen 2,2/1,6/1,4/1,4/1,4 s)
- Zweiter Blick: Runde 1 „ändern“ (Form wich vom Shopfoto ab, „Tank für Duftöl“ nicht belegt, Aufsicht zu abstrakt) → behoben; Runde 2 „freigabefähig“. Offen: Rillen wirken in voller Auflösung leicht gestuft
- KI-Kennzeichnung: nein (keine Stimme)

### Mi 4.11. 12 Uhr
- Datei: `25_nachtlicht_mo-story_cgi_20261104.mp4` + `25_nachtlicht_mo-story_cgi_20261104_ohne_musik.mp4` (Story 23,4 s, 9,3 MB, −13,9 LUFS, Spitze −1,3 dBTP; beide Fassungen mit Stimme)
- Titelbild: 19,0 s (Nachtlicht leuchtet an der Wand, „Nachtlicht mit Bewegungsmelder“ darüber)
- Caption @maiosshop: Nachtlicht mit Bewegungsmelder für Flur und Kinderzimmer / Drei Uhr nachts, ich muss mal, und irgendwo im Flur liegen Bausteine. Das Nachtlicht geht an, sobald man vorbeiläuft: warmes Licht, batteriebetrieben, klebt einfach an die Wand. 23,99 €, Link im Profil. Flur oder Badezimmer?
- Caption @maiosshop.com: gleich, Hook-Zeile „Wer muss auch immer um drei Uhr nachts?“
- Hashtags: #werbung #nachtlicht #bewegungsmelder #kinderzimmer
- Angehefteter Kommentar: Flur oder Badezimmer?
- Trend + Quelle: festes Format Mo-Story (Trend-Doc „TikTok-Trends → Maios“, Abschnitt „Zusätzliche Formate ab 28.10.“), Folge mit Erzählerstimme, Test 1 von 2
- Vorlage-Videos: Mo-Story 27.10. (Figur Mo, Untertitel-Look); Nachtlicht „Flur“ 28.10. als Abgrenzung. 72-h-Werte: alle CGI-Videos steigen bei 0:01 aus (Story 27.10.: 1,1 % ganz angeschaut)
- Ablauf: Mo schreckt im Bett hoch („Drei Uhr nachts. Ich muss mal.“) → Tür, Flur stockdunkel → Bodenperspektive, Bausteine im Dunkeln → Mo tastet → Mo läuft am Nachtlicht vorbei, Licht geht an (11,55 s) → Flur leuchtet, Mo steigt über die Bausteine, zweites Licht geht an → zurück im Bett → Produkt nah, Name, Preis → Abbinder 1 s „Link im Profil“ mit Klang-Logo
- Neu gegenüber dem Nachtlicht-Video 28.10.: Figur Mo mit Beinen (läuft), Kinderzimmer + Flur im Toon-Look, Bausteine, zwei Lichter, Stimme
- Szene: `scenes/story_nachtlicht.js`, Ton `scenes/story_nachtlicht_ton.py` (a-Moll Pizzicato → F-Dur Marimba), Stimme `lib/stimme.py` (Thorsten), alle Zeilen passen in ihr Zeitfenster
- Videocheck: ok. Bewegung ab Bild 0 (Mo schreckt hoch), keine Auflösung vor 3 s, „Nachtlicht“ 0–3 s neben der Pille, Werbung durchgehend, Einstellungen 2,1–2,9 s, neue Zeile alle 2,6–2,9 s, Abbinder 1 s, Text außerhalb der Sperrzonen
- Zweiter Blick: „ändern“, 1 Muss: Text „Dann ein Schritt …“ lag auf dem Leuchtenkopf → Kamera neu, Abschnitt neu gerendert, geprüft. Kann umgesetzt: „Lego“ (Marke) → „Bausteine“ in Bild, Stimme und Caption. Offen als Kann: Schlussbilder ähneln dem 28.10., Holz im warmen Licht heller als Walnuss
- KI-Kennzeichnung: ja (Stimme); falls kein Schalter: „Stimme: KI“ ans Ende der Caption

### Mi 4.11. 18 Uhr (gepostet als Sonderslot Di 3.11. 20 Uhr)
- Datei: `21_crystal-lampe_polarlicht_cgi_20261104.mp4` + `21_crystal-lampe_polarlicht_cgi_20261104_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −14,0 LUFS, Spitze −2,3 dBTP)
- Titelbild: 4,6 s (Krone lila nah, „LED Crystal Lampe“ neben der Pille)
- Caption @maiosshop: LED Crystal Lampe mit Projektion, 16 Farben / 17 Uhr und draußen schon dunkel. Drinnen hab ich Polarlicht: Die Lampe wirft drehende Lichtwellen an Wand und Decke, 16 Farben, dimmbar, läuft über USB. 18,99 €, Link im Profil. Krone oder Holzboden?
- Caption @maiosshop.com: gleich, Hook-Zeile „Um fünf schon dunkel? Bei mir gibt's Polarlicht.“
- Hashtags: #werbung #ledlampe #projektionslampe #wohnzimmer
- Angehefteter Kommentar: Krone oder Holzboden?
- Trend + Quelle: November-Dunkelheit / Cozy-Abend (Plan bis Weihnachten im Doc „TikTok-Trends → Maios“), Handy-Look-Pointe, Effekt nur am Raum (Projektion)
- Vorlage-Videos: Handy-Look-Loops (Kugel „Schnee“ 3.11., Diffusor „Farben“ 3.11.)
- Neu gegenüber dem Halloween-Video (30.10., nie gepostet): Wohnzimmer mit Stadtfenster, Sofa, Beistelltisch, Polarlicht-Türkis/Grün, Krone mit 6 höheren Zacken (näher am Shopfoto)
- Szene: `scenes/crystal_polar.js`, Ton `scenes/crystal_polar_ton.py` (D-Dur E-Piano + Glocken, ohne Klang-Logo); `lib/crystal_models.js`: 6 Zacken statt 5
- Videocheck: ok. Projektion bewegt sich ab Bild 0, keine Auflösung vor 3,9 s, Produktwort + Werbung durchgehend, Preis + Link 5,6–6,8 s, letztes Bild = Bild 0, Einstellungen 2,0/1,8/1,8/1,2/1,2 s, Text außerhalb der Sperrzonen
- Zweiter Blick: „freigabefähig“, kein Muss. Kann umgesetzt: Hook zeitlich stimmig (17 Uhr statt 16:30), „Polarlicht“ weiß, Krone mit mehr/höheren Zacken. Offen: Lampe in 0–3 s klein rechts unten, Mitte (lila Nahaufnahme) ähnelt dem Halloween-Video
- KI-Kennzeichnung: nein

### Mi 4.11. 18 Uhr
- Gebaut am 3.11. abends auf Nevios Wunsch („bau für morgen ein neues“), weil die Lampe schon am 3.11. um 20 Uhr läuft
- Datei: `11_mixer_gym_cgi_20261104.mp4` + `11_mixer_gym_cgi_20261104_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −14,0 LUFS, Spitze −1,8 dBTP)
- Titelbild: 1,0 s (Mixer auf der Hantelbank, „Mixer“ neben der Pille, Hook darüber)
- Caption @maiosshop: Elektrischer Mixer Entsafter, 350 ml / Nach dem Training: Shake? Läuft schon. Kompakter Mixer für Smoothies und frische Säfte unterwegs. 40,99 €, Link im Profil. Blau oder Rosa?
- Caption @maiosshop.com: gleich, Hook-Zeile „Nach dem Gym ist mein Shake schon fertig.“
- Hashtags: #werbung #mixer #smoothie #fitness
- Angehefteter Kommentar: Blau oder Rosa?
- Trend + Quelle: Handy-Look-Pointe, Alltag nach dem Sport („unterwegs“ laut products.json); Doc „TikTok-Trends → Maios“
- Vorlage-Videos: Mixer-Satisfying 2.11. (Wirbel ab Bild 0), Handy-Look-Loops
- Neu gegenüber früheren Mixer-Videos: Farbe Blau (erstmals), dunkles Gym mit Neonleiste, Hantelbank, Kurzhanteln, Handtuch, Heidelbeer-Milch-Wirbel
- Szene: `scenes/mixer_gym.js`, Ton `scenes/mixer_gym_ton.py` (a-Moll E-Piano-Groove, Kick auf jedem Viertel, ohne Klang-Logo)
- Videocheck: ok. Wirbel ab Bild 0, keine Auflösung vor 3,9 s, „Mixer“ + Werbung durchgehend, Preis + Link 5,65–7,0 s, letztes Bild = Bild 0, Einstellungen ≤ 2 s, Text außerhalb der Sperrzonen und nicht auf dem Produkt
- Zweiter Blick: „freigabefähig“, kein Muss. Kann: „Shake“ → „Smoothie“, Messer im Sockel nicht sichtbar, Wirbel bleibt marmoriert, Kernbild wieder „Wirbel in der Flasche“
- KI-Kennzeichnung: nein

### Do 5.11. 12 Uhr
- Gebaut am 4./5.11. (Nevio: „mach TikTok Videos für morgen, wenn es keine gibt erstell welche“); zweiter Blick Runde 1 forderte Änderungen (Riesenrad-Form wich vom Shopfoto ab, zu ähnlich zur Schnee-Kugel), Runde 2 „freigabefähig“
- Auf Nevios Wunsch („änder beides für 12 Uhr“) von 18 Uhr auf 12 Uhr verlegt; beim selben Slot läuft damit auch der Wasserspender (18 Uhr), beide mit unterschiedlichem Produkt
- Datei: `50_krystall-ball_riesenrad_cgi_20261105.mp4` + `_ohne_musik.mp4` (Loop 8,0 s, −14,0/−14,1 LUFS)
- Caption @maiosshop: Geschenkidee unter 20 € / Der Weihnachtsmarkt hat noch zu, das Riesenrad steht bei mir schon: Kristallkugel Nachtlampe mit Riesenrad im Glas, 7 Motive zur Auswahl. 16,99 €, Link im Profil. Riesenrad oder Sternenhimmel?
- Hashtags: #werbung #nachtlampe #kristallkugel #geschenkidee
- Angehefteter Kommentar: Riesenrad oder Sternenhimmel?
- Szene: `scenes/kugel_riesenrad.js` + `_ton.py` (Riesenrad-Motiv in `lib/kugel_models.js` neu gebaut, 2. Runde mit H-Stützen, mehr Speichen, Kapsel-Gondeln)
- Zweiter Blick Runde 2: freigabefähig, keine offenen Muss-Punkte
- KI-Kennzeichnung: nein
- Geplant auf beiden Kanälen für 05.11. 12:00 über TikTok-Zeitplan

### Do 5.11. 18 Uhr
- Gebaut am 4./5.11. zusammen mit dem Kugel-Video; zweiter Blick Runde 1 forderte Änderungen (Produktwort verschwand vor 3,0 s; Text zu ähnlich zum Homeoffice-Video; Hashtag #wasserflasche nicht in products.json verankert)
- Fixes: Produktwort jetzt bis 3,75 s sichtbar; Text „Pumpt's direkt aus der Flasche.“ ersetzt durch „Schlauch rein. Läuft.“; Hashtag #wasserflasche ersetzt durch #schreibtisch (Produktslug elektrischer-wasserspender-fuer-schreibtisch); betroffene Sekunden (3,2–5,6 s) neu gerendert und in den Gesamt-Clip gespleißt
- Bleibt auf 18 Uhr (Nevio: „Wasserspender soll 18“), nicht wie der Kugel-Slot auf 12 Uhr verlegt
- Datei: `10_wasserspender_kueche_cgi_20261105.mp4` + `_ohne_musik.mp4` (Loop 8,0 s, −14,0/−14,1 LUFS, Titelbild 1,5 s)
- Caption @maiosshop: Elektrischer Wasserspender für Gallon-Flaschen / Ich hab die Flasche nicht angefasst, und das Glas ist trotzdem voll. Schlauch rein, fertig – läuft direkt aus der Flasche. Wiederaufladbar, für Büro und Zuhause. 35,99 €, Link im Profil. Weiß oder Schwarz?
- Caption @maiosshop.com: gleich, Hook-Zeile „Die Flasche bleibt stehen, das Glas wird trotzdem voll.“
- Hashtags: #werbung #wasserspender #schreibtisch #küche
- Angehefteter Kommentar: Weiß oder Schwarz?
- Szene: `scenes/wasser_kueche.js` + `_ton.py`
- Zweiter Blick Runde 2 (nach Fix nicht erneut vorgelegt, Muss-Punkte direkt behoben und per Stichprobe auf den fertigen Stills geprüft: Wortzeit, neuer Text, Preis 35,99 € stimmen)
- KI-Kennzeichnung: nein
- Geplant auf beiden Kanälen für 05.11. 18:00 über TikTok-Zeitplan

### Mo 9.11. 12 Uhr
- Gebaut am 8.11. (Nevio: „mach 2 videos für morgen mit dem neuen threejs-cgi-techniken skill“). Neues Modell: Wellenglas-Würfel auf dunklem Sockel (`makeCube` in `lib/crystal_models.js`, Variante „Holz boden“ laut Shopfoto), Bloom über `lib/post.js`.
- Datei: `21_crystal-lampe_decke_cgi_20261109.mp4` + `_ohne_musik.mp4` (Loop 8,0 s, −14,1 LUFS, Datei 5,5 MB, Titelbild 4,0 s: Würfel + Produktwort)
- Caption @maiosshop: LED Crystal Lampe mit Projektion / An meiner Decke läuft was. Rotierende Projektion, 16 Farben, per USB betrieben. 19,99 €, Link im Profil. Krone oder Holz boden?
- Caption @maiosshop.com: gleich, Hook-Zeile „Nachts läuft bei mir was an der Decke.“
- Hashtags: #werbung #crystallampe #projektionslampe #schlafzimmer
- Angehefteter Kommentar: Krone oder Holz boden?
- Szene: `scenes/crystal_decke.js` + `_ton.py` (Dream-Pop a-Moll). Farbe wechselt von Einstellung zu Einstellung (Schnitte), nicht live.
- Trend/Quelle: Handy-Look-Loop (Regeln 28.10.), keine neue Trend-Recherche in diesem Lauf; TikTok-Studio-Inspiration (Standregel 8.11.) nicht geprüft (Chrome nicht genutzt). Kommentare der letzten Videos nicht gelesen.
- Zweiter Blick: Runde 1 „nicht freigabefähig“ (Einstieg nur Nebel, Würfel flach/ausgewaschen, Schnitt vor 3 s). Behoben: Kamera startet an der leuchtenden Lampe und kippt zur Decke, Würfel kräftiger, Text/Schnitt ab Datei-Sekunde 3,2. Runde 2 nicht erneut vorgelegt.
- Hinweis: Würfel in der Nahaufnahme noch recht hell (wirkt mehr Eis als Wellenglas).
- KI-Kennzeichnung: nein

### Mo 9.11. 18 Uhr
- Gebaut am 8.11. für die feste Reihe „Wichteln unter 20 €“ (erste Folge). Bloom über `lib/post.js`.
- Datei: `50_krystall-ball_wichteln_cgi_20261109.mp4` + `_ohne_musik.mp4` (Loop 8,0 s, −14,0 LUFS, Datei 5,5 MB, Titelbild 4,2 s: Kugel mit Saturn + Produktwort)
- Caption @maiosshop: Geschenkidee unter 20 € / Wichteln. Limit: 20 €. Das steckt in meiner Box: Kristallkugel Nachtlampe mit Saturn im Glas, 7 Motive zur Auswahl. 16,99 €, Link im Profil. Saturn oder Mond?
- Caption @maiosshop.com: gleich, Hook-Zeile „Wichtelgeschenk unter 20 €? Das hier.“
- Hashtags: #werbung #nachtlampe #kristallkugel #wichteln
- Angehefteter Kommentar: Saturn oder Mond?
- Szene: `scenes/kugel_wichteln.js` + `_ton.py` (Weihnachts-Lo-Fi C-Dur, eigene Melodie). Box schließt sich am Ende (Loop).
- Zweiter Blick: Runde 1 „nicht freigabefähig“ (zu wenig Bewegung im Einstieg, Kugel angeschnitten, Endbild ähnlich früheren). Behoben: Fugenlicht pulsiert, Bokeh driftet, weitere Kamera, Kugel komplett im Bild, Endbild schräg gerahmt. Der Einwand „Text fehlt“ war ein Stichproben-Effekt (Text läuft Datei 3,1–4,4 s). Runde 2 nicht erneut vorgelegt.
- KI-Kennzeichnung: nein

### Di 10.11. 12 Uhr
- Datei: `42_aroma-diffusor_weihnachtsmodus_cgi_20261110.mp4` + `_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −14,0 LUFS, Spitze −4,3 dBTP)
- Zeitplan: Di 10.11.2026, 12:00 (Europe/Berlin), erst @maiosshop, dann @maiosshop.com
- Titelbild: 2,4 s (Diffusor mit Tannenbaum, „Ab heute: Weihnachtsmodus.“, „Diffusor“ neben der Pille)
- Caption @maiosshop: Aroma Öl Diffusor mit Flammeneffekt / Mein Kürbis muss jetzt ausziehen. Ab heute Weihnachtsmodus, die Flamme darf bleiben: Ultraschall-Nebel mit LED-Licht, 130 ml Tank für bis zu 6 Stunden. 25,99 €, Link im Profil. Schwarz oder Weiß?
- Caption @maiosshop.com: Aroma Öl Diffusor mit Flammeneffekt / Halloween ist durch, der Kürbis zieht aus. Ab heute Weihnachtsmodus, die Flamme darf bleiben: Ultraschall-Nebel mit LED-Licht, 130 ml Tank für bis zu 6 Stunden. 25,99 €, Link im Profil. Schwarz oder Weiß?
- Hashtags: #werbung #aromadiffusor #aromatherapie #weihnachtsdeko
- Angehefteter Kommentar: Schwarz oder Weiß?
- Preis: products.json steht seit 8.11. auf 25,99 € (vorher 26,99 €)
- Trend + Quelle: „Christmas Switch“ (Halloween-Deko wird Weihnachtsdeko in einer Einstellung), socialpilot.co/blog/tiktok-trends (Nov. 2026); newengen.com/insights/tiktok-trends (Stand 5.11.) ohne passenden Trend für Produkte ohne Person
- Vorlage-Videos: Handy-Look-Loops (Diffusor 29.10./3.11., Mixer 4.11.); 72-h-Werte in kennzahlen.csv noch leer, Kommentare nicht gelesen (kein TikTok Studio ab 9.11.)
- Neu gegenüber den Diffusor-Videos 29.10. (Schlafzimmer, „Feuer ist kalt“) und 3.11. (Sideboard, Farbwechsel): Wandregal aus Nussbaum vor salbeigrauer Wand, Kürbis rollt ab Bild 0 aus dem Bild, Raumlicht flackert, danach Tannenbaum, rote Kugeln und Lichterkette; Flamme bleibt orange (kein Farbwechsel), Einstellung von rechts hinten auf Öffnung und Lichtring
- Szene: `scenes/diffusor_switch.js` + `diffusor_switch.html`, Ton `scenes/diffusor_switch_ton.py` (Spieluhr d-Moll → F-Dur mit Glocken und Schellen, ohne Klang-Logo)
- Videocheck: ok. Bewegung ab Bild 0 (Kürbis rollt, Flamme, Kerzen, Kamera), keine Auflösung bis 3 s („Ab heute: Weihnachtsmodus.“ ist die Wendung, Nutzen ab 4,2 s, Preis ab 5,45 s), „Diffusor“ + „Werbung“ durchgehend, letztes Bild = Bild 0, Einstellungen 2,5 (erste, mit Bewegung) / 1,6 / 1,3 / 1,2 s, Text außerhalb der Sperrzonen und nicht auf dem Produkt
- Zweiter Blick: Runde 1 „freigabefähig“, keine Muss-Punkte. Kann-Punkte umgesetzt: Kürbis zieht sichtbar aus (rollt ab Bild 0), Nahaufnahme frontal mit „Nur Nebel und LED-Licht.“ (zu ähnlich zum Feuer-Video) ersetzt durch neue Einstellung von hinten oben mit „130 ml Tank. Bis zu 6 Stunden.“, Text nicht mehr über der Flamme. Offen als „Kann“: Rillen in der Nahaufnahme etwas verschmiert, Unterkante im Einstieg dunkel
- KI-Kennzeichnung: nein (keine Stimme)

### Di 10.11. 18 Uhr
- Datei: `11_mixer_zug_cgi_20261110.mp4` + `_ohne_musik.mp4` (Loop 8,0 s, 5,5 MB, −14,1 LUFS, Spitze −3,9 dBTP)
- Zeitplan: Di 10.11.2026, 18:00 (Europe/Berlin), erst @maiosshop, dann @maiosshop.com
- Titelbild: 1,2 s (Mixer im Zug am Fenster, Hook, „Mixer“ neben der Pille)
- Caption @maiosshop: Elektrischer Mixer Entsafter, 350 ml / 7:12 Uhr, Frühstück fährt mit. Kompakter Mixer für Smoothies und frische Säfte unterwegs. 47,99 €, Link im Profil. Rosa oder Weiß?
- Caption @maiosshop.com: Elektrischer Mixer Entsafter, 350 ml / Frühstück im Zug um 7:12? Läuft. Kompakter Mixer für Smoothies und frische Säfte unterwegs. 47,99 €, Link im Profil. Rosa oder Weiß?
- Hashtags: #werbung #mixer #smoothie #frühstück
- Angehefteter Kommentar: Rosa oder Weiß?
- Preis: products.json steht seit 8.11. auf 47,99 € (vorher 40,99 €)
- Trend + Quelle: kein passender Wochen-Trend ohne Person/Song (newengen 5.11., socialpilot Nov. 2026); Handy-Look-Pointe mit Alltagsszene nach den Regeln vom 28.10.
- Vorlage-Videos: Mixer „Gym“ 4.11. (Loop, Wirbel), Satisfying 2.11.; 72-h-Werte noch leer
- Neu gegenüber früheren Mixer-Videos (Hexe 28.10., Satisfying 2.11., Gym 4.11.): Pendlerzug zur blauen Stunde, Klapptisch am Fenster, draußen ziehen Hügel, Bäume und Masten vorbei (Shader, periodisch), Mango-Milch-Wirbel, Schienenstöße im Ton
- Szene: `scenes/mixer_zug.js` + `mixer_zug.html`, Ton `scenes/mixer_zug_ton.py` (Lo-Fi D-Dur, Pluck-Melodie, Mixer-Motor, ohne Klang-Logo)
- Videocheck: ok. Mixer läuft und Landschaft zieht ab Bild 0, keine Auflösung bis 3 s (Nahaufnahme 2,4–3,2 ohne Text), „Mixer“ + „Werbung“ durchgehend, letztes Bild = Bild 0, Einstellungen 2,4 (erste, mit Bewegung) / 1,8 / 1,3 / 1,2 s, Text nicht auf dem Produkt, außerhalb der Sperrzonen
- Zweiter Blick: Runde 1 „nicht freigabefähig“ (Zutaten-Text schon ab 2,5 s; Zug kaum zu erkennen; Henkel/Logo verdeckt; Text wie Gym-Video). Behoben: Text ab 3,22 s, Fensterrahmen hellgrau + Sitzlehne im Einstieg, Flasche gedreht (Ring + „FRESH JUICE“ sichtbar), „Nächster Halt: Büro.“ statt „Für unterwegs. 350 ml.“. Runde 2: „freigabefähig“. Offen als „Kann“: Rosa etwas zu lachsfarben, Deckel mint statt rosa (Modell vom 2.11.), Glashals vor dunklen Bäumen schwach, Füllung wie Gym/Satisfying (nächstes Mixer-Video andere Füllung oder Kamera)
- KI-Kennzeichnung: nein (keine Stimme)

### Mi 11.11. 12 Uhr
- Design v2 (Nevio 9.11.: „nicht so kindlich“): dunkle, filmische Szene, Figur mit erwachsenen Proportionen (`lib/figur_pro.js`, `scenes/wasser_figur2.js`), Großbuchstaben mit farbigem Schlüsselwort. Die erste Kinder-Fassung (`wasser_figur.js`) ist verworfen.
- **Neu (9.11. abends): Story-Fassung** `10_wasserspender_story-mehroptic_cgi_20261111.mp4` (+ `_ohne_musik.mp4`, `_titelbild.jpg`), 20,5 s, −14,1 LUFS, Spitze −2,4 dBFS, 9,2 MB, Titelbild-Sekunde 17,0 (Preis + Produktwort). Szene `cgi/scenes/wasser_story.js`, Ton `wasser_story_ton.py`, Kit `lib/story_kit.js`. Zweiter Blick durch Subagent gelaufen (Einstieg ok, keine Auflösung bis 3 s); behoben: Schlussbild ohne Text auf dem Produkt, Untertitel nicht auf dem Sockel. Captions unten gelten auch für die Story. Die Loop-Fassung `10_wasserspender_figur-mo_cgi_20261111.mp4` bleibt als Reserve.
- Loop-Fassung: `10_wasserspender_figur-mo_cgi_20261111.mp4` (+ `_ohne_musik.mp4`), Loop 8 s, −14,0 LUFS, Spitze −2,0 dBFS, 5,4 MB. Titelbild-Sekunde 6,5 (Spender, Glas gefüllt, 35,99 €). Szene: `cgi/scenes/wasser_figur.js` + `wasser_figur_ton.py`.
- Trend/Muster: Figuren-Geschichte nach @mehr.optic und @cano.essentials (`cgi/vorbilder.md`): eigene Figur Mo, „das Übliche“ (Gallone schleppen, kippen, Pfütze) gegen Produkt (Schlauch rein, Glas füllt sich). Testclip, nicht an einem Slot festgemacht; Slot Mi 11.11. 18 Uhr nur Vorschlag.
- Caption @maiosshop: Elektrischer Wasserspender für Gallon-Flaschen
Jeden Morgen dasselbe: Gallone schleppen, kippen, Pfütze. Schlauch rein, fertig – das Glas füllt sich direkt aus der Flasche. Wiederaufladbar, für Büro und Zuhause. 35,99 €, Link im Profil. Weiß oder Schwarz? #werbung #wasserspender #schreibtisch #küche
- Caption @maiosshop.com: Elektrischer Wasserspender für Gallon-Flaschen
Schleppen, kippen, Pfütze. Das war einmal. Schlauch rein, fertig – das Glas füllt sich direkt aus der Flasche. Wiederaufladbar, für Büro und Zuhause. 35,99 €, Link im Profil. Weiß oder Schwarz? #werbung #wasserspender #schreibtisch #küche
- Frage für den angepinnten Kommentar: „Weiß oder Schwarz?“
- KI-Kennzeichnung: nein (keine Stimme).
- Videocheck: Bild 0 und letztes Bild gleich, Hook „Jeden Morgen dasselbe.“ ohne Auflösung bis 3 s (Dateizeit), Werbung-Pille und Produktwort sichtbar, Einstellungen ≤ 2,4 s. Zweiter Blick durch Subagent noch nicht gelaufen.

### Mi 11.11. 18 Uhr
- Produkt: 17 Bluetooth Anti-Lost Finder Wassertropfen, 8,99 €, Farben Schwarz/Weiß/Grün/Pink/Gold/Silber. Aussagen nur: Bluetooth-Tracker, Tropfenform, per Handy finden.
- Story 20,5 s im @mehr.optic-Stil, Datei 17_bluetooth-finder_story-mehroptic_cgi_20261111.mp4 (+ _ohne_musik, _titelbild). Titelbild bei 16,8 s. Zweitblick durch Subagent gelaufen, Bildfehler behoben.
- Status: von Nevio veröffentlicht/geplant (Meldung 10.11.: „beide veröffentlicht“). Dateien nach `hochgeladen` verschoben. Eingabe-Paket (Captions, Hashtags, Kommentar) am 10.11. im Chat geliefert.

### Do 12.11. 12 Uhr
- Datei: `25_nachtlicht_story-mehroptic_cgi_20261112.mp4` + `_ohne_musik.mp4` + `_titelbild.jpg` (Story 20,5 s, kein Loop, 9,4 MB, −14,1 LUFS, Spitze −1,9 dBFS nach AAC; ohne Musik −14,2 LUFS)
- Zeitplan: Do 12.11.2026, 12:00 (Europe/Berlin), erst @maiosshop, dann @maiosshop.com
- Titelbild: 17,5 s (zwei leuchtende Nachtlichter, Neon-Preis, „Nachtlicht“ neben der Pille)
- Caption @maiosshop: Nachtlichter mit Bewegungsmelder / Nachts leuchtet jeder mit dem Handy, die Stufe sieht trotzdem keiner. Das Nachtlicht geht von allein an, wenn du kommst: warmes Licht, batteriebetrieben bis zu 12 Monate, klebt einfach an die Wand. 23,99 €, Link im Profil. Flur oder Schlafzimmer?
- Caption @maiosshop.com: Nachtlichter mit Bewegungsmelder / Mit der Handylampe die Treppe runter? Die Stufe sieht trotzdem keiner. Das Nachtlicht geht von allein an, wenn du kommst: warmes Licht, batteriebetrieben bis zu 12 Monate, klebt einfach an die Wand. 23,99 €, Link im Profil. Flur oder Schlafzimmer?
- Hashtags: #werbung #nachtlicht #bewegungsmelder #beleuchtung
- Angehefteter Kommentar: Flur oder Schlafzimmer?
- Trend + Quelle: Story im @mehr.optic-Stil (Standard ab 9.11., `cgi/vorbilder.md`); Wochen-Trends (socialpilot.co/blog/tiktok-trends, Nov. 2026) ohne passendes Format ohne Person/Song
- Vorlage-Videos: Wasserspender-Story 11.11. (`wasser_story.js`), Finder-Story 11.11. (`finder_story.js`); 11.11. 12 Uhr laut Studio 242 Aufrufe, die Loops 9./10.11. je ca. 250
- Neu gegenüber Flur 28.10. und Mo-Story 4.11.: keine Kinderfigur, kein Flur/Lego; erwachsene Figuren mit Handy-Lichtkegeln vor der Nachtstadt, Stufe, Blaupause mit Explosionsansicht (Bewegungsmelder, Klebestreifen), Treppe mit zwei Lichtern, Preis vor dunkelblauer Wand
- Neu gerendert 11./12.11. auf Nevios Wunsch („deutlich realistischer, bessere Animationen“): Szene jetzt `cgi/scenes/nachtlicht_story2.js` + `nachtlicht_story2.html` mit `lib/post_pro.js` (Kantenglättung, Umgebungsverdeckung, Tiefenunschärfe, Grading), nasse Straße mit Spiegelung, weiche Lichtkegel + Staub, Armschwung, echtes Stolpern über die Kante, Gehen die Stufen runter, lackierte Treppe mit Sockelleiste und Bildern, Schatten der Nachtlichter, Nahaufnahme beim Einschalten (12,3–13,8 s). Zweiter Blick zur neuen Fassung: 3 Muss (Callout auf dem Holzstab, Lichtkegel durch den Körper beim Stolpern, Holz im Preisbild zu hell) behoben. Titelbild weiter 17,5 s.
- Szene alt: `cgi/scenes/nachtlicht_story.js` + `nachtlicht_story.html`, Ton `scenes/nachtlicht_story_ton.py` (Lo-Fi a-Moll, Drop bei 5 s, Schritte, Stolpern, ohne Stimme)
- Videocheck: ok. Bewegung ab Bild 0 (Menge läuft, Lichtkegel), bis 3 s keine Auflösung („Nachts leuchtet jeder mit dem Handy.“ / „Die Stufe sieht keiner.“), „Nachtlicht“ bis 3,3 s und ab 16,4 s, Werbung durchgehend, Einstellungen ≤ 3 s (Schnitt bei 9,3 s, Preis 16,2/18,3), „Link im Profil“ ab 19,5 s (letzte Sekunde), Text nicht auf dem Produkt, Untertitel x 105–929
- Zweiter Blick (Subagent, 2 Runden): Runde 1 nicht freigabefähig (Untertitel in rechter Sperrzone, Preis-Einstellung 4,3 s, Explosionsansicht 3,4 s, Holzfarbe). Alles behoben; Runde 2: nur noch Holzfarbe im Preis-Ende, danach behoben (Lampenlicht auf dem Holz reduziert, Walnuss wie in der Blaupause). Offen als „Kann“: Stufe im Hook kaum zu sehen, Lampen auf der Treppe klein, gelber Ring schneidet bei 3,0 s die Pille „Nachtlicht“
- Kommentare (Lauf 11.11.): @maiosshop nur ein Spam-Kommentar („follow back“), keine echte Frage; @maiosshop.com nicht gelesen (nur ein Chrome-Profil verbunden)
- KI-Kennzeichnung: nein (keine Stimme)

### Do 12.11. 18 Uhr
- Datei: `47_tumbler_zeitraffer_cgi_20261112.mp4` + `_ohne_musik.mp4` + `_titelbild.jpg` (Loop 8,0 s, 5,5 MB, −14,2 LUFS, Spitze −3,9 dBFS; ohne Musik −14,8 LUFS)
- Zeitplan: Do 12.11.2026, 18:00 (Europe/Berlin), erst @maiosshop, dann @maiosshop.com
- Titelbild: 5,2 s (Becher mit Griff nah, „Mit Griff und Strohhalm.“, „Tumbler“ neben der Pille)
- Caption @maiosshop: Tumbler Becher mit Griff und Strohhalm / Heute Morgen um 7 eingefüllt. Isoliert, hält Temperaturen bis zu 12 Stunden, für heiße und kalte Getränke. BPA-frei und spülmaschinenfest. 24,99 €, Link im Profil. Heiß oder kalt?
- Caption @maiosshop.com: Tumbler Becher mit Griff und Strohhalm / Um 7 Uhr eingefüllt, bis zum Feierabend dabei. Isoliert, hält Temperaturen bis zu 12 Stunden, für heiße und kalte Getränke. BPA-frei und spülmaschinenfest. 24,99 €, Link im Profil. Heiß oder kalt?
- Hashtags: #werbung #tumbler #becher #büroalltag
- Angehefteter Kommentar: Heiß oder kalt?
- Trend + Quelle: Handy-Look-Loop als Zweitformat (README „Regeln ab 28.10.“), Zeitraffer als Raum-Effekt; kein passender Wochen-Trend ohne Person/Song
- Vorlage-Videos: Mixer „Zug“ 10.11. (Loop mit Bewegung im Raum, Uhrzeit-Hook); erstes Video dieses Produkts, neues Modell `cgi/lib/tumbler_models.js`
- Neu gerendert 11./12.11. auf Nevios Wunsch: Szene jetzt `cgi/scenes/tumbler_tag2.js` + `tumbler_tag2.html`, Modell v2 (Deckel mit Drehschieber, Strohhalm als Rohr, Pulverstruktur), `lib/post_pro.js`, Sonnenstrahlen + Staub, Pflanze bewegt sich, Laptop, Kamerafahrt auf den Becher. Zweiter Blick: freigabefähig; Deckel danach auf Hellgrau korrigiert (war überbelichtet).
- Szene alt: `cgi/scenes/tumbler_tag.js` + `tumbler_tag.html`, Ton `scenes/tumbler_tag_ton.py` (Lo-Fi C-Dur, Uhr-Ticken, ohne Klang-Logo). Zeitraffer 7–19 Uhr in 6,6 s, Nacht im Schnelldurchlauf zurück zum Morgen (Preis steht am Abend, unter 12 h nach dem Einfüllen)
- Videocheck: ok. Licht und Uhr bewegen sich ab Bild 0, bis 3 s keine Auflösung („Isoliert. Bis zu 12 Stunden.“ ab 3,05 s), „Tumbler“ + „Werbung“ durchgehend, letztes Bild = Bild 0 (Kamera, Licht, Text), Einstellungen 2,6 (erste, mit Bewegung) / 1,7 / 1,4 / 1,5 s, Preis + Link vor dem Ende, Text nicht auf dem Produkt
- Zweiter Blick (Subagent, 2 Runden): Runde 1 nicht freigabefähig (Farbe zu dunkel, 24-h-Zeitraffer behauptet indirekt mehr als 12 h, Griff im Preisbild nicht zu sehen, #thermobecher nicht in products.json). Alles behoben; Runde 2 „freigabefähig“. Offen als „Kann“: Einstieg ruhig (nur Raum bewegt sich), „Strohhalm“ über dem Zifferblatt, Uhr nah an der Werbung-Pille im Preisbild
- KI-Kennzeichnung: nein (keine Stimme)

### Fr 13.11. 12 Uhr
- Neuer Stil auf Nevios Wunsch (12.11.: „ganz neu, neuer Artstyle, neue Animationen, neuer Aufbau“): Knetanimation als Stop-Motion mit 12 fps, Miniaturwelt aus Knete, nur die Mühle ist echt (Edelstahl, Glasdeckel)
- Datei: `55_kaffeemuehle_knete-story_cgi_20261113.mp4` + `_ohne_musik.mp4` + `_titelbild.jpg` (20,5 s, 6,4 MB, −14,2 LUFS, Spitze −3,7 dBFS)
- Zeitplan: Fr 13.11.2026, 12:00 (Europe/Berlin), erst @maiosshop, dann @maiosshop.com
- Titelbild: 17,0 s (Mühle + Tasse, Preis, „Kaffeemühle“ neben der Pille)
- Caption @maiosshop: Elektrische Kaffeemühle für Bohnen und Gewürze / Mein Kaffee fängt hier an: ganze Bohnen rein, Deckel drauf, Knopf drücken. 200-W-Motor und Messer aus Edelstahl, den Mahlgrad bestimmst du über die Mahldauer. Auch für Gewürze, Nüsse und Getreide, nur trockene Zutaten. 18,99 €, Link im Profil. Kaffee oder Gewürze?
- Caption @maiosshop.com: Elektrische Kaffeemühle für Bohnen und Gewürze / Frischer Kaffee fängt bei ganzen Bohnen an: rein, Deckel drauf, Knopf drücken. (Rest wie oben)
- Hashtags: #werbung #kaffeemühle #gewürzmühle #küche
- Angehefteter Kommentar: Kaffee oder Gewürze?
- Szene: `cgi/scenes/knete_muehle.js` + `knete_muehle.html`, Modell `cgi/lib/muehle_models.js`, Ton `scenes/knete_muehle_ton.py` (Marimba/Pizzicato G-Dur, Bohnen-Plips, Klick, Mahlwerk)
- Zweiter Blick: 3 Runden, am Ende „freigabefähig“. Offen als „Kann“: Hand liegt knapp unter dem Knopf, Nüsse wie Kekse, Dampfringe, Mühlenfuß bei 18,8 s in der unteren Sperrzone (kein Text)
- KI-Kennzeichnung: nein

### Fr 13.11. 18 Uhr
- Neuer Stil: Pop-up-Buch aus Papier (90° offen, Seiten klappen um, Papierelemente richten sich auf), Bürste echt (Schwarz, am Ende Schwarz + Weiß)
- Datei: `57_zahnbuerste_popup-story_cgi_20261113.mp4` + `_ohne_musik.mp4` + `_titelbild.jpg` (20,5 s, 6,8 MB, −14,0 LUFS, Spitze −4,0 dBFS)
- Zeitplan: Fr 13.11.2026, 18:00 (Europe/Berlin), erst @maiosshop, dann @maiosshop.com
- Titelbild: 18,6 s (Schwarz + Weiß, Preis, „Zahnbürste“ neben der Pille)
- Caption @maiosshop: Elektrische Schallzahnbürste / Zwei Minuten können lang sein. 2-Minuten-Timer mit 30-Sekunden-Intervall, bis zu 40.000 Schwingungen pro Minute, 5 Putzmodi, wasserdicht nach IPX7, mit 2 Ersatzbürstenköpfen. Läuft mit 2 AAA-Batterien (nicht enthalten). 18,99 €, Link im Profil. Schwarz oder Weiß?
- Caption @maiosshop.com: Elektrische Schallzahnbürste / Zwei Minuten Zähneputzen ziehen sich? (Rest wie oben)
- Hashtags: #werbung #zahnbürste #schallzahnbürste #mundpflege
- Angehefteter Kommentar: Schwarz oder Weiß?
- Szene: `cgi/scenes/popup_zahnbuerste.js` + `popup_zahnbuerste.html`, Modell `cgi/lib/zahnbuerste_models.js`, Ton `scenes/popup_zahnbuerste_ton.py` (gezupfte Akkorde D-Dur, Umblätter-Rascheln, Summen, Tings). Gerendert mit 15 Bildern/s (Papier-Look), ausgegeben mit 30 fps
- Zweiter Blick: 3 Runden, am Ende „freigabefähig“. Offen als „Kann“: Einstieg (nur der Arm bewegt sich), Bürstenfuß bei 10,5 und 20,0 s in der unteren Sperrzone (kein Text)
- KI-Kennzeichnung: nein

### Sa 14.11. 12 Uhr
- Notiz-Liste (`00_wichtelliste_notizen_echt_20261114*`) auf Nevios Wunsch gelöscht (13.11. abends).
- Datei: `47_tumbler_farben_echt_20261114.mp4` + `_ohne_musik` + `_titelbild.jpg` (12,0 s, 5,1 MB). Echte Shopfotos aller 7 Farben, gewischt wie in der Galerie, mit Handbewegung, Fokus-Ziehen und Filmkorn.
- Titelbild: 0,8 s
- Caption @maiosshop: Tumbler Becher mit Griff und Strohhalm / Einer davon wird mein Winterbecher. 40 oz, hält heiß und kalt bis zu 12 Stunden, BPA-frei und spülmaschinenfest. 24,99 €, Link im Profil. Storm Sea oder Red Rust?
- Caption @maiosshop.com: Tumbler Becher mit Griff und Strohhalm / Mein Winterbecher wird einer von diesen sieben. 40 oz, hält heiß und kalt bis zu 12 Stunden, BPA-frei und spülmaschinenfest. 24,99 €, Link im Profil. Storm Sea oder Red Rust?
- Hashtags: #werbung #tumbler #thermobecher #winter
- Angehefteter Kommentar: Storm Sea oder Red Rust?
- Videocheck: Hook ab Bild 0, Produktwort „Tumbler“ durchgehend, „Hält bis zu 12 Stunden“ ab 4,5 s, Preis und Link erst ab 9,4 s, Werbung durchgehend, Text über dem Becher. Farben laut products.json. −14,7 LUFS, Spitze −1,7 dBFS. Musik: bright_pop (eigen).
- KI-Kennzeichnung: nein

### Sa 14.11. 18 Uhr
- Datei: `50_krystall-ball_galerie_echt_20261114.mp4` + `_ohne_musik` + `_titelbild.jpg` (überarbeitet, 12,0 s, 5,0 MB). Kein unscharfer Füllbalken mehr, das Foto füllt das Bild. Sortiert von dunkel nach hell. Neuer Hook. Motivname, Preis und Link oben, nie auf der Kugel.
- Titelbild: 0,8 s
- Caption @maiosshop: Kristallkugel Nachtlampe mit 7 Motiven / Eine davon kommt unter den Baum. Mond, Riesenrad, Wassermolch, Sternenhimmel, Schneemann, Segelboot oder Saturn. 16,99 €, Link im Profil. Mond oder Sternenhimmel?
- Caption @maiosshop.com: Kristallkugel Nachtlampe mit 7 Motiven / Eine von diesen sieben kommt unter den Baum. Mond, Riesenrad, Wassermolch, Sternenhimmel, Schneemann, Segelboot oder Saturn. 16,99 €, Link im Profil. Mond oder Sternenhimmel?
- Hashtags: #werbung #nachtlampe #kristallkugel #geschenkidee
- Angehefteter Kommentar: Mond oder Sternenhimmel?
- Videocheck: Hook ab Bild 0, Produktwort-Pille durchgehend, Preis und Link erst ab 9,4 s, Werbung durchgehend, Text außerhalb der Sperrzonen. −13,6 LUFS, Spitze −1,4 dBFS. Musik: lofi_chill (eigen).
- KI-Kennzeichnung: nein

### So 15.11. 18 Uhr
- Auftrag: Nevio 15.11. nachmittags „mach ein Video für heute 18 Uhr“. Format Motion-Spot (2D, echte Fotos), weil am 14.11. zweimal `real` lief; Produkt 43, das noch nie lief.
- Datei: `43_mini-thermal-drucker_spot_20261115.mp4` + `_ohne_musik` (stumme Spur) + `_titelbild.jpg` (11,2 s, 2,9 MB, −14,2 LUFS, Spitze −1,4 dBTP). Konfiguration `cgi/spot/43_mini-thermal-drucker.json`. Musik: bright_pop_128bpm (eigen).
- Ablauf: Fotowand der 5 Farben (ab Bild 0 sichtbar) → Blau wird groß → Produktkarte „Gespeichert“ → „5 Farben“ → Haken „Per Bluetooth und App / Wiederaufladbar / Kompakt und leicht“ → 35,99 € + Link im Profil + „Versandkostenfrei in Deutschland“.
- Rollen-Fotos aus `produkt bilder` bewusst nicht verwendet: Verpackung zeigt eine fremde Marke.
- Titelbild: 0,8 s (alle 5 Farben, Hook, Produktwort)
- Caption @maiosshop: Mini Thermodrucker für Etiketten, Fotos und Notizen / Was druckt dieses kleine Ding? Etiketten, Fotos und Notizen, per Bluetooth und App vom Handy. Wiederaufladbar, kompakt und leicht, in 5 Farben. 35,99 €, versandkostenfrei in Deutschland. Link im Profil. Speicher dir das für die Geschenkesuche. Blau oder Gelb?
- Caption @maiosshop.com: Mini Thermodrucker für Etiketten, Fotos und Notizen / Klein, kabellos und druckt vom Handy. Etiketten, Fotos und Notizen per Bluetooth und App. Wiederaufladbar, kompakt und leicht, in 5 Farben. 35,99 €, versandkostenfrei in Deutschland. Link im Profil. Speicher dir das für die Geschenkesuche. Blau oder Gelb?
- Hashtags: #werbung #minidrucker #etikettendrucker #geschenkidee
- Angehefteter Kommentar: Blau oder Gelb?
- Inspiration TikTok Studio: in diesem Lauf nicht geöffnet (kurzfristiger Auftrag); Geschenk-Anlass aus der laufenden Weihnachtsplanung.
- Videocheck: Produkt ab Bild 0 in Bewegung, Preis/Link erst ab 8,9 s, Werbung + „Mini-Thermodrucker“ durchgehend, Sperrzonen frei, Einstellungen ≤ 2 s (Galerie 3 s mit Bewegung, Schluss 2,6 s).
- Zweiter Prüfer (Subagent): 1 Muss-Punkt – Preis stand ~0,5 s ohne Versandhinweis → behoben (Hinweis kommt jetzt mit dem Preis, größer und dunkler). Ebenfalls übernommen: Produktwort wörtlich aus products.json („Mini-Thermodrucker“ statt „Mini-Drucker“), neutraler Hook statt Ich-Form, erstes Bild deckender, „Gespeichert“-Pille 24 px höher (nicht mehr an der Sperrzone), Zähler-Klicks auf den Zahlenwechseln. Vorlage `spot.html` entsprechend angepasst (gilt für alle künftigen Spots).
- Nevio 15.11. nachmittags: „die Zahl 5 ist außerhalb des Kreises, sonst echt gut“ → Ring größer (520 px), Zahl kleiner und genau im Ring zentriert (`spot.html`, gilt für alle Spots). Neu gerendert: 11,2 s, 2,9 MB, −14,2 LUFS, −1,4 dBTP.
- KI-Kennzeichnung: nein (echte Fotos, eigene Animation, synthetische Klänge)

### Mo 16.11. 12 Uhr
- Auftrag: Nevio 15.11. abends „bau 2 weitere Videos, die andere Skills sind“ → Skill `maios-real` (Galerie echter Fotos). Produkt 17, weil 47/50 am 14.11. und 43 am 15.11. liefen. Produkt 33 verworfen: die 12 Variantenfotos zeigen 10-ml-Duftölfläschchen, products.json beschreibt einen Luftbefeuchter (Datenfehler, siehe unten).
- Datei: `17_bluetooth-finder_farben_echt_20261116.mp4` + `_ohne_musik` (stumme Spur) + `_titelbild.jpg` (11,0 s, 6,9 MB, −14,1 LUFS, −2,9 dBTP). Konfiguration `cgi/real/17_bluetooth-finder.json`. Die 4 PNG-Fotos (~390 px, transparent) wurden vorher auf Weiß mit Rand gesetzt (sonst undefinierter Hintergrund beim RGB-Wandeln). 6 Farben, 1,6 s je Foto (auf dem Schlag laut `musik.py`), Schwarz zuletzt unter dem Preis.
- Ton: clean_minimal_112bpm ab 2,438 s, Klänge +4 dB. `ton_check`: Ting bei 8,4 s zählt als „nicht hörbar“, im Spektrogramm aber deutlich (Wischgeräusch davor verdeckt den Anschlag für den Zähler).
- Titelbild: 0,8 s
- Caption @maiosshop: Bluetooth Anti-Lost Finder Wassertropfen / Wo ist mein Schlüssel? Kleiner Bluetooth-Tracker im Wassertropfen-Design: Verlorenes übers Smartphone finden. In 6 Farben. 8,99 €, versandkostenfrei in Deutschland. Link im Profil. Schwarz oder Pink?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Schon wieder den Schlüssel gesucht?“
- Hashtags: #werbung #bluetoothtracker #schlüsselfinder #geschenkidee
- Angehefteter Kommentar: Schwarz oder Pink?
- Zweiter Prüfer: kein Muss-Punkt. Übernommen: Schlussbild nicht mehr Weiß auf Weiß (Reihenfolge Grün → … → Schwarz). Offen gelassen: erstes Bild 0,3 s unscharf (Fokus-Ziehen des abgenommenen Formats), Farbname der letzten Farbe nur 0,2 s (Format-Eigenheit).
- KI-Kennzeichnung: nein

### Mo 16.11. 18 Uhr (neu: Motion-Spot ohne Fotos)
- Nevio 15.11. abends: Kaffee-Video „anders, ohne Bilder, anderer Skill, komplett neu“. Skill `maios-motion-spot`, nur 2D-Animation, kein Produktfoto (Einstieg ohne Produkt damit ausdrücklich freigegeben). Keine Stimme.
- Datei: `55_kaffeemuehle_spot_20261116.mp4` + `_ohne_musik` (stumme Spur) + `_titelbild.jpg` (13,1 s, 2,75 MB, −14,2 LUFS, −1,9 dBTP; 24/38 Klänge messbar hörbar). Konfiguration `cgi/spot/55_kaffeemuehle_spot.json`. Musik upbeat_house_124bpm ab 6,338 s (bewusst nicht clean_minimal wie um 12 Uhr).
- Ablauf: Suchfeld tippt „kaffee frisch mahlen“ → „Gemahlen entweicht das Aroma schneller.“ → „Darum direkt vor dem Aufbrühen mahlen.“ → 200 Watt Motor → Haken: Messer aus Edelstahl 304 / Mahlgrad über die Mahldauer / Auch für Gewürze und Nüsse → 18,99 € + Versandkostenfrei in Deutschland.
- Titelbild: 4,3 s („Gemahlen entweicht das Aroma schneller.“)
- Caption @maiosshop: Elektrische Kaffee- und Gewürzmühle / Lohnt sich frisch mahlen? Gemahlen entweicht das Aroma schneller, darum direkt vor dem Aufbrühen mahlen. 200-W-Motor, Messer aus Edelstahl, den Mahlgrad bestimmst du über die Mahldauer. Auch für Gewürze und Nüsse. 18,99 €, versandkostenfrei in Deutschland. Link im Profil. Speicher dir das für den nächsten Kaffee. Kaffeebohnen oder Gewürze?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Frisch gemahlen oder fertiges Pulver?“
- Hashtags: #werbung #kaffeemühle #gewürzmühle #kaffee
- Angehefteter Kommentar: Kaffeebohnen oder Gewürze?
- Zweiter Prüfer: kein Muss-Punkt. Übernommen: Zähler „Watt Motor“ statt „Watt“. Vorher selbst behoben (in `spot.html`, gilt für alle Spots): langer Produktname überlappte den Preis auf der Endkarte, dreistellige Zahl ragte aus dem Ring, Suchfeld war in Bild 0 unsichtbar.
- KI-Kennzeichnung: nein

### Di 17.11. 12 Uhr (NEU: Zoom-Rätsel)
- Auftrag: Nevio 16.11. „bau 2 neue Videos für morgen, etwas, das es noch nicht gab, aber ähnlich wie die Videos“. Neues Format im Motion-Spot-Stil (echte Fotos, 2D-Animation), Baustein `raetsel` in `cgi/spot/spot.html`. Produkt 63 (Lager DE), lief noch nie.
- Datei: `63_akku-reifenpumpe_raetsel_20261117.mp4` + `_ohne_musik` (stumme Spur) + `_titelbild.jpg` (10,3 s, 2,65 MB, −14,3 LUFS, −2,1 dBTP; 7/13 Klänge messbar hörbar). Konfiguration `cgi/spot/63_akku-reifenpumpe_raetsel.json`. Musik clean_minimal_112bpm ab 0,302 s.
- Ablauf: Nahaufnahme der Anzeige „2.50“ ab Bild 0, zoomt langsam auf → Tipps „Uhrzeit?“ und „Temperatur?“ werden rot weggekreuzt → ab 3,0 s ganzes Foto + „Reifendruck in bar.“ → „4 Modi – Auto · Motorrad · Fahrrad · Ball“ → Haken: Stoppt beim Zieldruck / Laden per USB-C / LED-Licht mit SOS-Funktion → 29,99 € + Link im Profil + Versandkostenfrei in Deutschland.
- Rätsel fragt nach dem Detail (der Anzeige), nicht nach dem Produkt: das Produktwort „Akku-Reifenpumpe“ steht laut Regel ab Bild 0 neben „Werbung“.
- Titelbild: 0,8 s (Nahaufnahme „2.50“ + Hook)
- Caption @maiosshop: Akku-Reifenpumpe mit Display / Wofür steht die 2.50? Für den Reifendruck in bar. Die Pumpe zeigt den Druck digital an und stoppt beim Zieldruck. 4 Modi für Auto, Motorrad, Fahrrad und Ball, Akku mit USB-C, LED-Licht mit SOS-Funktion. 29,99 €, versandkostenfrei in Deutschland. Link im Profil. Speicher dir das für den nächsten Reifencheck. Auto oder Fahrrad?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Was zeigt die 2.50 an?“
- Hashtags: #werbung #reifenpumpe #reifendruck #autozubehör
- Angehefteter Kommentar: Auto oder Fahrrad?
- Inspiration TikTok Studio: in diesem Lauf nicht geöffnet.
- Zweiter Prüfer: kein Muss-Punkt, „freigabefähig“. Übernommen: dritte Haken-Zeile steht länger (Takt 0,38 s, Szene 2,1 s), lange Zeilen werden in `spot.html` einzeilig gesetzt (44 px). Offen gelassen: „BAR“ ist im Zoom lesbar, das Rätsel ist also leicht lösbar. Das ist Absicht: Leichte Rätsel holen „Wusste ich“-Kommentare. Ausblenden ginge nur, wenn kaum noch gezoomt wird.
- KI-Kennzeichnung: nein (echte Fotos, eigene Animation, synthetische Klänge)

### Di 17.11. 18 Uhr (NEU: Karten mischen)
- Auftrag wie 12 Uhr. Neues Format, Baustein `mischen` in `cgi/spot/spot.html`. Produkt 11 (lief zuletzt 10.11. als CGI), 3 echte Variantenfotos.
- Datei: `11_mixer_mischen_20261117.mp4` + `_ohne_musik` (stumme Spur) + `_titelbild.jpg` (11,3 s, 3,16 MB, −14,4 LUFS, −2,8 dBTP; 8/12 Klänge messbar hörbar). Konfiguration `cgi/spot/11_mixer_mischen.json`. Musik bright_pop_128bpm ab 3,762 s.
- Ablauf: Weiß, Rosa, Blau fliegen ein (ab Bild 0 sichtbar), Rosa wird markiert → Karten drehen sich um (1,3 s) → 5 sichtbare Vertauschungen (1,75–4,05 s) → Zahlen 1–3 + „Wo ist Rosa?“ → Rosa wird auf Platz 3 aufgedeckt, dann die anderen → „Hattest du ihn?“ → Haken: Fasst 350 ml / Für Smoothies und Säfte / Kompakt für unterwegs → 47,99 € + Link im Profil + Versandkostenfrei in Deutschland. „perfekt“ aus der Beschreibung bewusst nicht übernommen (Tabuwort).
- Titelbild: 0,8 s (drei Farben offen, Rosa markiert)
- Caption @maiosshop: Elektrischer Mixer Entsafter 350 ml / Behalt den rosa Mixer im Blick. Hast du ihn gefunden? Kompakter Mixer und Entsafter für Smoothies und frische Säfte unterwegs, in Weiß, Rosa und Blau. 47,99 €, versandkostenfrei in Deutschland. Link im Profil. Rosa oder Blau?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Wo landet der rosa Mixer?“
- Hashtags: #werbung #mixer #smoothie #geschenkidee
- Angehefteter Kommentar: Rosa oder Blau?
- Zweiter Prüfer: 1 Muss-Punkt: Die Mischszene war eine Einstellung von 6,6 s, erlaubt sind höchstens 4 s. Behoben mit zwei harten Schnitten (`schnitte` im Baustein): bei 3,11 s enger (Zoom 1,1), bei 4,75 s wieder weit. Einstellungen jetzt 3,1 / 1,6 / 1,9 s. Übernommen: Kartenreihe aus der rechten Sperrzone (rechter Rand ≤ 921 px), dritte Haken-Zeile steht länger. Offen gelassen: Der Hook hat 6 Wörter, also genau die Grenze, und ist eine Aufforderung. So heißt das Spiel üblicherweise. „FRESH JUICE“ steht auf der Ware selbst, ist also kein fremdes Logo im Bild.
- KI-Kennzeichnung: nein

### Reserve: Wissensvideo Kaffeemühle (ursprünglich Mo 16.11. 18 Uhr)
- Skill `maios-wissen` (Format W), erstes Wissensvideo. Stimme auf Nevios Wunsch über den VoiceStudio-MCP erzeugt (Port 3900, MOSS-TTS-Nano, Profil „Thorsten CC0“, id 55f1d935), +6 % Tempo. Stimmspur: `videos/rohmaterial/eigenes/stimme/55_kaffeemuehle_wissen_20261116.wav`.
- Datei: `55_kaffeemuehle_wissen_20261116.mp4` + `_ohne_musik` (= nur Stimme, ohne Musik) + `_titelbild.jpg` (44,9 s, 9,5 MB, −14,6 LUFS, −3,0 dBTP). Konfiguration `cgi/spot/55_kaffeemuehle_wissen.json` (neue Bausteine `bild` und Untertitel in `spot.html`).
- Sprechertext: Warum schmeckt frisch gemahlener Kaffee anders? Eine ganze Bohne hält ihr Aroma in winzigen Zellen fest. Beim Mahlen brechen diese Zellen auf, und die Oberfläche wird um ein Vielfaches größer. Gase, die eine ganze Bohne über Wochen abgibt, entweichen aus dem Pulver zum großen Teil schon in Minuten. Und mit ihnen ein Teil des Aromas. Dazu kommt Sauerstoff. Er macht die Öle im Kaffee mit der Zeit schal. Deshalb mahlen viele erst direkt vor dem Aufbrühen. Zum Beispiel mit einer elektrischen Kaffeemühle. Ein Knopf, Messer aus Edelstahl, und wie fein es wird, hängt davon ab, wie lange sie läuft. Und Gewürze und Nüsse mahlt sie auch.
- Quellen: SCA „Coffee Decoded: What is freshly roasted coffee?“ (sca.coffee/sca-news/coffee-decoded-9-fresh-coffee) · Smrke et al. 2018, J. Agric. Food Chem., ZHAW (digitalcollection.zhaw.ch/handle/11475/12175) · Barista Hustle „Grinding Fresh“ (baristahustle.com/?p=15335) · Ratgeber roastmarket.de/magazin/kaffee-richtig-lagern, coffeeness.de/kaffeedose. Bewusst NICHT verwendet: „60 % Aroma in 15 Minuten“, „1000-fache Oberfläche“ (keine belastbare Quelle).
- Titelbild: 1,5 s
- Caption @maiosshop: Warum schmeckt frisch gemahlener Kaffee anders? Elektrische Kaffee- und Gewürzmühle / Gemahlen entweicht ein großer Teil der Gase in Minuten statt Wochen und mit ihnen ein Teil des Aromas. Darum erst direkt vor dem Aufbrühen mahlen. Ein Knopf, Messer aus Edelstahl, auch für Gewürze und Nüsse. 18,99 €, versandkostenfrei in Deutschland. Link im Profil. Speicher dir das für den nächsten Kaffee. Kaffeebohnen oder Gewürze?
- Caption @maiosshop.com: wie oben, Hook-Zeile „Frisch gemahlen schmeckt anders. Hier ist der Grund.“
- Hashtags: #werbung #kaffeemühle #kaffeewissen #kaffee
- Angehefteter Kommentar: Kaffeebohnen oder Gewürze?
- Zweiter Prüfer: 4 Muss-Punkte, alle behoben – Finger auf Herstellerfoto (Ausschnitt verschoben), überdehnte Aussage „die Gase … in wenigen Minuten“ (→ „zum großen Teil schon in Minuten“, neu gesprochen), Untertitel trennten Sinneinheiten (neue Aufteilung), Hook in Sekunde 1 nicht vollständig (steht jetzt ab Bild 0). Ebenfalls: „wie lange du drückst“ → „wie lange sie läuft“ (products.json: Mahlgrad über Mahldauer). Zweite Prüfrunde nach den Korrekturen nicht gelaufen, Standbilder selbst geprüft.
- Stimme: Claude kann sie nicht hören; Rücktranskription ging nicht (in VoiceStudio kein Spracherkennungsmodell). **Nevio hört vor dem Upload einmal komplett an.**
- KI-Kennzeichnung: **ja** (KI-Stimme) – beim Upload „KI-generiert“ setzen.

### Datenfehler Produkt 33 (gefunden 15.11.)
- products.json: „Aromatherapy Essential Oil Humidifier“, 300-ml-Tank, Ultraschall, 8,99 €; Beschreibung sagt 10 Düfte, Features 12. Die 12 Variantenfotos zeigen aber nur 10-ml-Duftöl-Fläschchen mit Karton, Aufdruck „RELAXING EFFECT“; Variante „Sweet“ zeigt „Osmanthus“. Vor einem Video (und für die Produktseite) klären, was bei CJ wirklich verkauft wird.

## Stimme, Stand 14.11. nachts (Claude)
- CosyVoice 3 lässt sich auf Nevios PC nicht installieren (braucht Microsoft C++ Build Tools für PyWorld). Stattdessen läuft **MOSS-TTS-Nano** (Apache-2.0, "Kommerziell OK", 20 Sprachen inkl. Deutsch, CPU) in VoiceStudio.
- Referenzstimme: `rohmaterial/eigenes/stimme/referenz_thorsten_cc0.wav` (Thorsten-Voice, CC0), in VoiceStudio als Profil "Thorsten CC0" gespeichert. OmniVoice nicht benutzen (CC-BY-NC).
- Testsatz `stimme/test.wav` erzeugt (4,5 s, 48 kHz). Erster Satz dauert ~3 min (Modell lädt), danach schneller. Beim Upload "KI-generiert" setzen.
- Patch nötig: VoiceStudio v0.5.8 hat einen Ladefehler mit MOSS (set + list). In `engines/moss_tts_nano_subprocess/main.py` (Programmordner und Laufzeitkopie) eine Versionsweiche eingebaut, Sicherung `main.py.bak_claude`. Ein VoiceStudio-Update kann das überschreiben.
- Speichern-Dialog der App meldet "Datei nicht gefunden": Audio liegt automatisch in `AppData\Roaming\OmniVoice\outputs\`, von dort kopieren.
