---
tags: [maios, entscheidungen]
---
# Entscheidungen

Neueste oben. Je Eintrag: Datum, was entschieden wurde, Link auf die Datei, in der es umgesetzt ist.
Wird von Claude nach jeder Sitzung mit einer Entscheidung ergänzt (siehe [[CLAUDE#10. Obsidian — Wissensablage (seit 16.11.2026, ersetzt Graphify)|CLAUDE §10]]).

## 2026-11-25
- **Nur noch Ware aus dem deutschen CJ-Lager** (Nevio: „Ich will die China Produkte nicht mehr im Sortiment“,
  danach „bau alle ein und die anderen raus und such mehr produkte … ca. 30“). Alle 41 China-/AliExpress-Produkte
  entfernt, 42 neue aus dem DE-Lager (IDs 76–117) in [[products.json]]: 17 Ersatz für alte Produkte, 25 neu.
  Preise nach der 40-%-Formel (Einkauf inkl. Versand × 0,92 × 1,19 + Klarna, auf x,99), Holzpuzzles wegen
  Mindestpreis des Herstellers 36,99 €. Weiterleitungen in [[server.js]] (`ENTFERNTE_PRODUKTE`), Startseite
  ([[home.js]] Showreel), Lieferzeit-Texte (Startseite, [[infos/versand.html]], [[infos/kontakt.html]]) auf 3–8 Werktage.
- Bewusst **nicht** aufgenommen: Turbo-Gebläse und Kfz-Batterieladegerät (Bilder zeigen UK-Stecker),
  Glättbürste (unklar ob elektrisch, 11 Stück Bestand), Gesichtssprüher (sieht aus wie ein Inhalator),
  Kinder-Zahnbürste (nur spanische Bilder), Walking Pad (Bestand 0), Tablet und Speisenwärmematte (Versand nicht DE→DE).
- Bot: dreistellige Produktnummern erlaubt, Wasserspender als eingefrorene Testdaten
  ([[bot/test-daten/produkt-10-wasserspender.json]]).
- Lieferländer auf DE, FR, IT, ES, IE gekürzt (dorthin liefert CJ DE-Lager-Ware), überall versandkostenfrei: [[shipping-calculator.js]], AGB, [[infos/versand.html]], Warenkorb.
- OmniRoute wird nicht mehr genutzt, nur noch FreeLLMAPI; der OmniRoute-Rückfall in `Marketing/cgi/spot/spot_ki.mjs` ist raus.

## 2026-11-24
- **Neues Format „Zerlegt“** nach Nevios Vorbild (@aiagentgeorg, „6 Animations-Stile mit Claude“, Sichtung in
  [[Marketing/cgi/vorbilder.md]] Runde 7): dunkles Studio, ein Teil springt ab, Zubehör fliegt in eine Reihe mit Nummern,
  Linien-Etiketten am Gerät, Maßlinien, Endkarte. Vorlage [[Marketing/cgi/spot/zerlegt.html]], Freisteller
  [[Marketing/cgi/spot/freistellen.py]]. **Bewusst ohne 3D-Modell und ohne KI:** alle Teile sind Freisteller echter Shopfotos,
  Etiketten nur aus [[products.json]]. Erstes Video: 58 Mini-Massagepistole (DE-Lager, lief noch nie),
  `58_mini-massagepistole_zerlegt_20261125.mp4`, von Nevio freigegeben für Mi 25.11. 12:00.
  Format in [[Marketing/VIDEO-HANDBUCH.md]] §4.
- Gelernt: TikTok liefert manche Videos im Web gar nicht aus (keine Abspieladresse) – dann über die Begleitseite des
  Creators sichten. Zweiter Prüfer fand: Zubehör, das „aus dem Gerät“ fliegt, behauptet, es werde darin aufbewahrt –
  Zubehör kommt jetzt von außen ins Bild.
- **Nevio: „das Video ist richtig gut“** → Zerlegt-Look ist Qualitätsmaßstab. Daraus der **Skill `maios-zerlegt`**
  (lokal `.claude/skills/maios-zerlegt/`, versioniert [[Marketing/cgi/skill/maios-zerlegt/SKILL.md]] + `maios-zerlegt.skill`
  fürs Konto). Dafür Vorlage und Freisteller auf die Konfiguration umgestellt (Boxen, Lagen, Etiketten mit Anker oder
  Rundbild, auch ohne abnehmbares Teil); `freistellen_58.py` ist im allgemeinen `freistellen.py` aufgegangen. Gegenprobe:
  die 58-Konfiguration ergibt pixelgleiche Freisteller und bis auf JPEG-Rauschen gleiche Bilder. Eingetragen in
  [[SKILLS-MAIOS.md]].
- **Zweites Zerlegt-Video mit dem Skill:** 52 Akku-Reinigungsbürste (Nevio: „Ja, 52 bauen“),
  `52_akku-reinigungsbuerste_zerlegt_20261126.mp4`, von Nevio freigegeben und selbst auf Mi 25.11. 18:00 gelegt
  (58 läuft am selben Tag um 12:00 – Zahlen beider Zerlegt-Videos vergleichen).
  Vorlage dafür erweitert (zwei Reihen, Etiketten ohne Nummer, Takt/Einblendzeiten einstellbar, Umbruch langer Namen),
  Freisteller um `schwelle` und `boden` (Ellipsen-Unterkante gegen Fotoschatten). 58 nach jeder Änderung gegengeprüft:
  unverändert. Konfiguration [[Marketing/cgi/spot/52_akku-reinigungsbuerste_zerlegt.json]].

## 2026-11-23
- **CGI/3D wieder erlaubt, als Ausnahme:** Nevio wollte ausdrücklich ein „CGI/3D-Animationsvideo“ nach dem Vorbild der
  „mit Claude gebauten“ 3D-TikToks (Sichtung in [[Marketing/cgi/vorbilder.md]], Runde 6). Gebaut als neue Vorlage
  [[Marketing/cgi/spot/haus3d.html]] (three.js, isometrisches Puppenhaus). Das Produkt ist ein 3D-Körper in echter Größe mit
  dem echten Shopfoto als Vorderseite – kein KI-Bild, keine KI-Rekonstruktion. Erstes Video: 69 WLAN-Repeater (DE-Lager),
  `69_wlan-repeater-dual-band_3d_20261124.mp4`, von Nevio freigegeben für Di 24.11. 18:00. Format in [[Marketing/VIDEO-HANDBUCH.md]] §4.
- **three.js installiert** (Nevios Ja): `Marketing/cgi/node_modules` (gitignored) + `package-lock.json`. HyperFrames fehlt in
  diesem Ordner; `render_spot.mjs` rendert das 3D genauso Bild für Bild, gemessen 0,1 s/Bild auf dem Laptop.
- **Recherche** „Claude TikTok CGI Produktvideos“ (Bericht in `Marketing/videos/geschnitten/reports/`, gitignored): Blender-MCP
  und Bild-zu-3D nicht nehmen (Sicherheit, Lizenz – Hunyuan3D schließt die EU aus –, Rechenzeit); echte Fotos + Code-Animation
  brauchen nach dem Wortlaut der Regeln kein KI-Label; TikTok Shop verbietet „fake 3D“ aus flachen Fotos.

## 2026-11-22
- **Motion-Spots ohne KI und ohne Claude:** neuer Befehl `npm run spot` ([[Marketing/cgi/spot/spot.mjs]]) über der
  vorhandenen Vorlage `spot.html`. `neu <ID>` legt ein Gerüst aus [[products.json]] an (Fotos, Name, Preis; Platzhalter
  `HIER_` für Hook und Nutzen), `<ID>` prüft (Preis = products.json, Fotos vorhanden, keine Platzhalter, Szenen ≤ 4 s) und
  rendert Bild, Musik, Ton und eine Fassung ohne Musik nach `Marketing/videos/geschnitten/`. Erstes Beispiel:
  `Marketing/cgi/spot/11_350ml-elektrischer-mixer_spot.json` (9,6 s, −14,3 LUFS, 1,7 MB). Galerie erst ab 5 Fotos.
- **Mehr Abwechslung:** `npm run spot -- neu` wechselt zwischen 7 Formen, 8 Farbpaletten und je zwei Musikstücken pro Stimmung.
  Mit `--ki` schreibt eine lokale/kostenlose KI (OmniRoute, sonst Ollama) Hook und Texte ([[Marketing/cgi/spot/spot_ki.mjs]]);
  geprüft werden Länge, Hook als Aussage, keine Zahlen außerhalb von products.json, kein Preis, keine Werbe-/Gesundheitswörter,
  keine Doppelungen. Nevio hat das am 22.11. ausdrücklich gewollt (Ausnahme zur Regel „Maios-Videos nur mit Claude“, nur für die Texte).
- **Lokale KI (Wan2GP, Arena) getestet:** KI-Videos verformen den Mixer (Henkel, Farbe, Sockel), nur Arena B blieb sauber.
  KI bleibt Baustein, das Produkt im Shop bleibt das echte Foto.

## 2026-11-18
- **Preischeck 18.11. (`npm run preischeck`, Ergebnis `Claude outputs/cj-preischeck.json`):** 49/50 ok.
  **57 Schallzahnbürste** ist bei CJ ausgelistet („removed from shelves“), **66 Monitorständer** hat nur noch das
  China-Lager mit Bestand 0 und keinen Versandweg nach DE. Beide in [[products.json]] auf `inStock: false`.
  Neu in `server.js`: `inStock: false` aus der Datei sperrt jetzt auch die Kasse (409), nicht nur der CJ-Abgleich
  aus der Datenbank – vorher war die Datei-Angabe an der Kasse wirkungslos. Strukturdaten neu geschrieben (`npm run seo`).
- **Margen laut Preischeck** (EK + günstigster Versand, × 0,92 × 1,19, + Klarna; grob gerechnet): DE-Lager-Ware 37–68 %,
  Runde 2 aus China 39–45 %, aber viele ältere China-Produkte nur 15–30 %, am schwächsten 43 Mini-Thermodrucker (≈ 7 %)
  und 51 Auto-Bildschirm (≈ 8 %). Preise unverändert (Nevio 08.11.: gesenkte Preise erstmal lassen).
- **Video für Do 19.11. 18 Uhr gebaut:** Motion-Spot „3 Dinge vor dem Kauf.“ für Produkt 70 (Magnetische Powerbank,
  erstes Video eines Produkts aus Runde 2), Liefer-Paket in `Marketing/trends/vorrat.md`. `spot.html` kann jetzt
  `karte` mit `sofort: true` (ab Bild 0 sichtbar) und Zahlen mit Tausenderpunkt; im Skill `maios-motion-spot` vermerkt.
- **Rechtstexte-Fix aus dem Worktree übernommen** (Commit `22bb2c4` vom 21.10., war nie auf `main`): AGB nennen jetzt
  die elf Lieferländer und 12 € für die USA, Versandseite 3–20 Werktage je Artikel und Rechner ohne CA/AU/JP/BR/MX,
  Warenkorb ohne PayPal-Knopf, 20 Produktseiten mit Lieferzeit aus [[products.json]], Datenschutz mit jsDelivr,
  Google Analytics, Standortdiensten und TDDDG. Neu dazu: Adresssuche (OpenStreetMap/Nominatim) und technische
  Dienstleister (Render, Neon, Resend) in [[infos/datenschutz.html]]. Prüfung: `test/rechtstexte-kasse.test.js`.
- **Prüfliste ElektroG/BattDG/LUCID** angelegt: [[Pflichten-ElektroG-BattDG-Verpackung]]. Nächster Schritt: CJ nach
  WEEE-, Batterie- und LUCID-Nummern fragen.
- **AGB und Datenschutz an den echten Stand angepasst** ([[infos/agb.html]], [[infos/datenschutz.html]], Stand November 2026):
  PayPal und „Vorkasse“ raus (gibt es nicht), Zahlarten = Karte, Apple/Google Pay über Stripe, Klarna. Versand außerhalb
  Europas nicht mehr „4,99 €“ (Kasse rechnet 12–20 €), sondern Verweis auf die Kasse. §5 Lieferung: kein „DHL/UPS,
  nur DE/AT, 3–5 Werktage“ mehr, sondern Lieferländer laut Kasse, Lager DE oder China, Lieferzeit laut Produktseite.
- **9 neue Produkte (IDs 67–75)**, Auswahl von Nevio aus CJ-Recherche (Projektor 360° bewusst nicht):
  Mini-Schlafkopfhörer 14,99 €, USB-Ladegerät 7 Anschlüsse 19,99 €, WLAN-Repeater 30,99 €, magnetische Powerbank 21,99 €,
  Laptopständer 15,99 € (diese vier aus dem DE-Lager), Salz-/Pfeffermühle 35,99 €, Thermobecher mit Temperaturanzeige
  21,99 €, Akku-Munddusche 28,99 €, Astronaut-Projektor 34,99 € (China). Eingetragen in [[products.json]], Seiten unter
  `produkte/`, Marge in `Marketing/config/marketing.config.json`, CSV-Zeilen in `excel/Maios Produkte.csv`, Bot-Quellen
  in `bot/tiktok-quellen.json`. Ladegerät bewusst ohne „120 W“ im Namen (Herstellerbilder zeigen 15 W je Anschluss).
- **Offen:** Astronaut-Projektor nutzt laut CJ einen grünen Laser (532 nm), Laserklasse unbekannt; ElektroG/BattDG
  gilt für alle neun.

## 2026-11-17
- **Neue Vollbild-Vorlage `Marketing/cgi/spot/voll.html`** (Editorial Dark: warmes Schwarz, Gold, Marcellus + Manrope,
  Federn nach `apple-design`): große echte Fotos statt kleiner Karten, umgesetzt aus der Lehre des HyperFrames-Tests vom
  16.11. Läuft über `render_spot.mjs --seite`, also ohne Installation und ohne CDN. Bausteine: `duell` (Runden als Feed),
  `finale` (Fächer → Endkarte), `bild` (Foto-Band über Unschärfe, Untertitel Wort für Wort), `typo`, `ende`. Siehe
  [[VIDEO-HANDBUCH]] §9.
- **Nevio: „mach ohne Bilder“** – die Herstellerfotos sahen in den ersten Fassungen schlecht aus. Beide Videos sind jetzt
  reine 2D-Animation ohne Produktfoto (Einstieg ohne Foto damit freigegeben): Tumbler-Duell mit Farbflächen in den aus
  den Shopfotos gemessenen Becherfarben und gezeichnetem Becher (`farbduell`, `farbfinale`), Lunchbox-„Was wäre wenn“
  mit eigenen Strich-Piktogrammen in Gold (`zeichen`). Slots Mi 18.11. 18 Uhr und Do 19.11. 12 Uhr, Details in
  `Marketing/trends/vorrat.md`.
- **Tumbler 47 hat 8 Becherfarben, nicht 7:** „Thermal Sublimation“ ist ein weißer Becher und im Shop wählbar
  (CSV „Tumbler Weiß“), nur „Strohalm“ ist keine Farbe. Fund des zweiten Prüfers, im [[VIDEO-HANDBUCH]] §4 korrigiert.
  Das real-Video vom 14.11. nannte noch „7“.
- **Gelernt:** Klänge direkt nach einem Whoosh gehen unter (Tipp je Wort ab 0,3 s nach dem Schnitt ist hörbar);
  Herstellerfotos tragen oft englische Schilder mit abweichenden Werten („220V“ statt 230 V laut products.json),
  deshalb immer auf Ausschnitt prüfen. Neue Dateien in `Marketing/videos/geschnitten/` legt die Shell hier nicht an,
  Python und PowerShell schon.

## 2026-11-16
- **Neues Videoformat Vision-Edit (Marken-Video)** auf Nevios Wunsch, Vorbild @lowkey.focus: Figurenreihe im Dunkeln,
  Drop, Vision „Jedes Zuhause ein Stück besser“, Kategorien mit echten Shopfotos, MAIOS am Ende, kein Preis. Vorlage
  `Marketing/cgi/spot/vision.html`, Renderer kann jetzt `--seite`. Nevios Satz „wir verbessern das Leben von jedem“
  bewusst entschärft (steht fast wörtlich als Negativbeispiel in `Marketing/config/brand_voice.md`). Siehe
  [[VIDEO-HANDBUCH]] §4 und `Marketing/cgi/vorbilder.md` Runde 5. Erstes Video: Mi 18.11. 12 Uhr.
- **Skills aus TikTok-Sichtung eingebaut** (alle in `.claude/skills/`, Übersicht in [[SKILLS-MAIOS]]):
  `apple-design` (Grundlage für Bedienung/Bewegung, siehe [[CLAUDE-DESIGN]]), `swiftui-expert-skill`
  (nur Swift), `webapp-testing` (Shop durchklicken gegen localhost), `grossumbau` mit Superpowers
  (nur große Umbauten), `ponytail` (kleinste vollständige Code-Änderung), `marketing-psychology`
  (mit Maios-Filter), `last30days` (Trendrecherche ohne Schlüssel), Obsidian-Skills von kepano.
- **Nicht genommen:** Karpathy-Regeln, Addy Osmanis Agent Skills, Chief of Staff (doppelt zu
  Superpowers, viele Tokens), Anatomy, Teach, Chrome DevTools MCP, Obsidian-Copilot-Plugin.
- **Frei-Modus:** bei erreichtem Claude-Limit Claude Code über FreeLLMAPI starten
  (`free-claude/claude-free.cmd`, Anleitung `free-claude/ANLEITUNG.md`). Kein Abo in Drittanbieter-Gateways.
- **Neues Videoformat WW „Was wäre wenn …“** (Skill `maios-wasweare`): Frage → Szenario → Produkt als Auflösung, optional Serie Teil 1/2. Vorbild-Formel übernommen, nicht der 3D-Figuren-Look.
- **GSAP, Lenis, React Bits nicht in den Shop:** GSAP läuft schon in den Videos (HyperFrames). Lenis = Scroll-Übernahme (KI-Merkmal laut unslop), React Bits braucht React. Shop-Bewegung bleibt CSS nach `apple-design`.
- **awesome-design-md** als Ideen-Bibliothek eingebaut (Skill `design-ideen`, 84 Systeme in `.claude/design-ideen/`): nur Prinzipien, Marke bleibt Editorial Dark.
- **web-design-guidelines** (Vercel, MIT) eingebaut, Regeln lokal statt Abruf aus dem Netz. Nicht genommen: impeccable, taste-skill (doppelt zu unslop), Playwright-MCP (doppelt zu webapp-testing).
- **unslop-Audit** gemacht: Emoji-Icons auf bunten Kacheln (alle 51 Produktseiten), Lila-Glow in `styles.css`, pulsierender Punkt auf der Startseite. Umbau wartet auf Nevios Ok.
- **unslop** (heydamir, CC BY 4.0) für Design-Aufräumen eingebaut: Richtung „Editorial Dark“, erst Audit, dann umbauen ([[CLAUDE-DESIGN]]).
- **HyperFrames für TikTok-Videos** (heygen-com/hyperframes, Apache-2.0): neuer Skill `maios-hyperframes`,
  Format „HyperFrames-Spot“ in `maios-video`. Lokal, Telemetrie aus, kein HeyGen-Konto. Upstream-Skills
  gesperrt in `.claude/hyperframes/`. Probe-Spot Produkt 50 gerendert (11 s, −14,2 LUFS, 3,8 MB, Render 1:17 min auf dem Laptop). Technik läuft; erstes Layout zu klein/zu viel Leerfläche gegenüber dem Galerie-Video vom 14.11. Windows braucht `HYPERFRAMES_RENDER_DETACHED=1`. Quelle `Marketing/cgi/hyperframes/_quelle/50_krystall-ball/`, Start `probe.ps1`.
- **Weitere MCPs aus dem Video nicht genommen:** Perplexity, Firecrawl (kosten), Playwright-MCP, Chrome-MCP (doppelt).
- **Obsidian statt graphify:** graphify lief nie. Maios-Ordner ist jetzt der Vault, Einstieg [[Start]],
  Obsidian-CLI eingeschaltet und im PATH.
