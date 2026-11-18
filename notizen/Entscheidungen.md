---
tags: [maios, entscheidungen]
---
# Entscheidungen

Neueste oben. Je Eintrag: Datum, was entschieden wurde, Link auf die Datei, in der es umgesetzt ist.
Wird von Claude nach jeder Sitzung mit einer Entscheidung ergänzt (siehe [[CLAUDE#10. Obsidian — Wissensablage (seit 16.11.2026, ersetzt Graphify)|CLAUDE §10]]).

## 2026-11-18
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
