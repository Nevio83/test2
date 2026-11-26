# Skills für Maios – wann welcher (Stand 16.11.2026)

Diese Datei wird über `CLAUDE.md` (§9) automatisch mitgeladen. Passt eine Aufgabe in eine Zeile
unten, den Skill **ohne Nachfrage** laden (Skill-Tool), bevor gearbeitet wird. Bei Widerspruch gilt:
Nevios neueste Anweisung > `Marketing/UEBERGABE-CLAUDE-CODE.md` > Skill-Text.

## Videos / TikTok

| Wenn … | Skill | Hinweis |
|---|---|---|
| **irgendein Maios-Video** geplant oder gebaut werden soll | `maios-video` **zuerst** | Einstieg: gemeinsame Regeln, Formatwahl, Prüfer, Liefer-Paket, vorrat.md. Ruft dann den Format-Skill. |
| Produkt hat ≥ 5 Farben/Motive mit Foto (17, 33, 43, 47, 50) | `maios-real` | Galerie echter Fotos, 12 s. Skripte `Marketing/cgi/real/` (brauchen Pillow). |
| Motion-Design-Spot (Typo, Suchfeld, Fotowand, Produktkarte, Preis) | `maios-motion-spot` | Neues Format aus der Sichtung 15.11.; rendert ohne Installation (`Marketing/cgi/spot/`). |
| Bewegung im Motion-Spot/Duell soll sich echter anfühlen (Federn, Schwung, Übergänge) | `apple-design` zusätzlich | Nur die Bewegungsregeln (Abschnitte Response, Springs, Momentum) auf die Animationen in `spot.html` anwenden. Gestaltungsregeln der Maios-Skills gehen vor. |
| Motion-Grafik, die die Spot-Vorlage nicht kann (kinetische Typo, Übergänge, Charts, Untertitel, neuer Look) | `maios-hyperframes` | Neu 16.11. (HyperFrames von HeyGen, Apache-2.0). Upstream-Skills liegen gesperrt in `.claude/hyperframes/`, Telemetrie aus, kein HeyGen-Konto, nichts Kostenpflichtiges. Ton weiter über `spot_ton.py`. Erster Lauf noch offen. |
| „Was wäre wenn …“-Video, Szenario mit Auflösung, Serie Teil 1/2 | `maios-wasweare` | Neu 16.11. (Formel von @claude_ai4, ohne 3D-Figur). Teil 2 muss fertig sein, bevor Teil 1 rausgeht. Keine Notfall-Dramatik, Produkt kann nur, was in products.json steht. |
| Wissensvideo W mit Erzählerstimme | `maios-wissen` | Stimme VoiceStudio „Thorsten CC0“, KI-Kennzeichnung ja. |
| Stimme/Voiceover/Sprecher für ein Video erzeugen (W oder jedes andere Format) | `stimme` | Neu 26.11. **Nur am PC** (VoiceStudio auf `127.0.0.1:3900` muss offen sein). Skript `Marketing/cgi/lib/stimme_vs.mjs`, Profil Thorsten CC0, OmniVoice nie, Nevio hört vor dem Einbau an. |
| Produkt „zerlegt“ zeigen: Zubehör/Aufsätze, „Teil für Teil“, „was steckt drin“, Explosionsansicht, „so schön wie das Massagepistolen-Video“ (Produkt mit Zubehör auf weißen Shopfotos: 52, 56, 58, 60) | `maios-zerlegt` | Neu 24.11., von Nevio gelobt („richtig gut“) = Qualitätsmaßstab. Nur Freisteller echter Shopfotos (`freistellen.py`), Vorlage `zerlegt.html`, kein 3D, keine KI. Lokal `.claude/skills/maios-zerlegt/`, versioniert `Marketing/cgi/skill/maios-zerlegt/` (+ `.skill` fürs Konto). |
| edler, ruhiger Look für ein Produkt mit Glas/Metall/Holz/Licht (Geschenk, „luxuriös“, „wie Werbung für Parfum“) | `maios-video` → Vorlage `edel.html` | Neu 25.11. aus MotionForge `luxury-product` (Steckbrief in `Marketing/cgi/motionforge/stile.md`). Freisteller mit `freistellen.py`, Glas mit `"glas"`. Test 85, noch nicht abgenommen. |
| mehrere Produkte in einem Video (Geschenkideen, „4 Dinge für …“, neue Produkte, Kategorie) | `maios-video` → Vorlage `katalog.html` | Neu 25.11. aus MotionForge `catalog-grid`. Name + Preis liest die Vorlage selbst aus products.json, höchstens 4 Produkte in 12 s. Test „Wichteln“, noch nicht abgenommen. |
| ein neuer Look gesucht wird / „mach mal einen anderen Stil“ | `maios-video` + `Marketing/cgi/motionforge/stile.md` | Alle 100 MotionForge-Stile mit Urteil für Maios: 7 vorhanden, 8 Kandidaten, 14 Ideen, 71 raus. Kandidat → erst Standbilder an Nevio. |
| ein Video vor dem Liefer-Paket geprüft wird (jedes Format) | `Marketing/cgi/pruefung/` | `text_check.mjs` (Text, Sperrzonen, Lesezeit), `video_check.py` (Technik, Lautheit, 10 MB), `kontaktbogen.py`; Kritiker-Subagent nach `Marketing/cgi/motionforge/kritiker.md`. |
| „Dies oder das“: zwei Farben/Motive gegeneinander, Kommentare holen | `maios-duell` | Neu 15.11.; Videos aus echten Clips (`maios-schnitt`) sind pausiert und der Skill entfernt. |
| KI-Baustein aus Shopfoto (Wan-Modell, lokal) | `maios-ki-lokal` | Nur auf dem RTX-PC, noch nicht eingerichtet. |
| fremde TikToks als Vorbild gesucht/angesehen werden | `tiktok-videos` | Nur Referenz, `rechte_geprueft: false`. **Nie** ins eigene Video. |
| Fakten für ein Wissensvideo W belegt werden müssen | `anthropic-skills:deep-research` | Quellen in den vorrat-Abschnitt schreiben. |
| Caption, Hook-Varianten, Hashtag-Ideen, Übersetzungen | `free-modus` (auch ohne Stichwort, laut globaler CLAUDE.md) | Ergebnis gegen `products.json` und `Marketing/config/` prüfen. Code nur mit „Free-claude“. |
| Hook, Caption oder Shop-Text soll überzeugender werden | `marketing-psychology` (seit 16.11., coreyhaines31, MIT) | Maios-Filter steht oben in der SKILL.md: keine vorgetäuschte Knappheit, kein Countdown, keine Streichpreise/Anker, kein „Bestseller“, keine erfundenen Bewertungen. Erlaubt: Neugierlücke, Konkretheit, Nutzen-Framing, Entweder-oder-Frage. Kontext: `.claude/product-marketing.md`. |
| Trend- oder Themenrecherche für Hooks, Hashtags, Wissensvideo W („was sagen die Leute gerade über …“) | `last30days` (seit 16.11., mvanhorn, MIT) | Ohne Schlüssel: Reddit, HN, GitHub, Polymarket. X/TikTok/YouTube nur mit Schlüssel, Browser-Cookies nur nach Nevios Ja, keine Anmeldung/Zahlung. Braucht Python 3.12+. Ergänzt die Standregel „TikTok Studio → Inspiration“. |
| ein deutscher Text nach KI klingt und Nevio das entkitschen will | `humanizer-deutsch` | Nur auf Wunsch, nicht für jedes Korrektorat. |
| TikTok Studio / Profile **lesen** | `anthropic-skills:built-in-browser` bzw. `anthropic-skills:chrome-browser` | Nur lesen, keine Anmeldung, nichts hochladen. |

**Ersetzt** (nur auf Nevios ausdrücklichen Wunsch): Konto-Skills `maios-video-cgi`, `maios-video-story`, `maios-video-maskottchen` (seit 14.11. verworfen, Sicherung `Marketing/cgi/skill/alt-stand-20261115/`), `maios-video-rohschnitt` und `maios-schnitt` (echte Clips, pausiert seit 15.11.), `real` (Cloud) → `maios-real` (lokal). `veroeffentlichen` nicht benutzen: seit 9.11. lädt Nevio selbst hoch. Die neuen Skills liegen in `.claude/skills/` (nicht versioniert), Sicherung in `Marketing/cgi/skill/neu-20261115/`.

## Shop (Code, Design, Daten)

| Wenn … | Skill |
|---|---|
| Notiz im Maios-Vault anlegen/verlinken (Ideen, Entscheidungen, Produktnotizen in `notizen/`) | `obsidian-markdown` (seit 16.11., kepano, MIT); Tabellenansicht über Notizen: `obsidian-bases`; Canvas/Mindmap: `json-canvas`; Vault per Befehl durchsuchen: `obsidian-cli` (Obsidian-App muss offen sein). Ersetzt graphify (nie ausgeführt). **Pflicht:** nach jeder Sitzung mit Änderungen `notizen/Entscheidungen.md` ergänzen (CLAUDE.md §10). |
| UI/UX, Design-System, Barrierefreiheit, SEO am Shop | Befehl `/design` (`.claude/commands/design.md`) |
| neue Seite oder Komponente gestalten | `frontend-design:frontend-design` |
| Ideen gesucht („wie machen das andere“, bessere Produktkarte, Warenkorb, Endkarte im Video) | `design-ideen` (seit 16.11., VoltAgent/awesome-design-md, MIT: 84 Design-Systeme in `.claude/design-ideen/`) – nur Prinzipien übernehmen, Marke bleibt Editorial Dark, keine fremde Marke nachbauen. |
| eine Seite sieht nach KI aus / soll aufgeräumt werden (Lila-Verläufe, Glow, Emojis, ungleiche Abstände, „New ✨“) | `unslop` (seit 16.11., heydamir, CC BY 4.0) – Audit, dann Richtung zeigen und auf Nevio warten, dann 9 Durchgänge (Abstände → Farbe → Icons → Text → Schrift → Layout → Details → Bilder → Bewegung). Richtung = „Editorial Dark“, Maios-Block oben in der SKILL.md. |
| Bedienung und Bewegung am Shop: Antippen von Knöpfen, Wischen in der Galerie, Warenkorb-Leiste, Übergänge, Popups (Newsletter, Cookie), `prefers-reduced-motion` | `apple-design` (seit 16.11., Grundlage für jede UI-Arbeit) – Apples WWDC-Prinzipien für flüssige Oberflächen, fürs Web übersetzt (CSS, Pointer Events). Mit `frontend-design` kombinieren. Kein neues Paket einbauen (keine Motion-/Framer-Bibliothek), alles in Vanilla JS/CSS. |
| Swift-/SwiftUI-Code (iOS-/macOS-App, z. B. eine spätere Maios-App) | `swiftui-expert-skill` (seit 16.11.) – für den Web-Shop **nicht** laden. |
| Design einer Seite prüfen lassen | `unslop` (KI-Look) + `web-design-guidelines` (seit 16.11., Vercel, MIT: Barrierefreiheit, Fokus, Formulare, Tippflächen, Zoom, Ladezustände; Regeln lokal in `regeln.md`). impeccable und taste-skill nicht nötig (doppelt zu unslop, Marke steht schon). |
| Belege/Rechnungen (PDF) | `anthropic-skills:pdf` |
| Preis-/Produktlisten (`excel/`, CSV, XLSX) | `anthropic-skills:xlsx` |
| AGB/Datenschutz-Entwurf als Word | `anthropic-skills:docx` |
| CJ/Stripe/Resend als MCP-Server kapseln | `anthropic-skills:mcp-builder` |
| einen wiederkehrenden Ablauf als eigenen Skill festhalten | `anthropic-skills:skill-creator` |
| Code schreiben, fixen oder umbauen (jede Shop-Code-Aufgabe) | `ponytail` (seit 16.11., Stufe `full`) – kleinste vollständige Änderung: erst vorhandenen Code/Helfer nutzen, dann Standardbibliothek, keine Abstraktion „für später“, keine neue Abhängigkeit. Spart Tokens und passt zu „keine neuen Pakete“. Nie gekürzt wird: Prüfung an Vertrauensgrenzen (Preis, Gutschein, Webhook), Fehlerbehandlung, Sicherheit, Barrierefreiheit, Tests mit Gegenprobe. Nur der Kern-Skill, ohne Plugin-Hooks. Nicht für Videos und Texte. |
| Code-Änderung vor dem Commit prüfen | `code-review` |
| großer Umbau am Shop-Code (mehrere Dateien/Commits, Kasse/Warenkorb/Galerie umbauen, Fehler nach 2 Anläufen nicht gefunden) | `grossumbau` (seit 16.11.) – Superpowers-Ablauf Spec → Plan → Subagenten, Tests zuerst. Superpowers liegt absichtlich in `.claude/superpowers/` (nicht in `skills/`), weil sich `using-superpowers`/`brainstorming` sonst bei jeder Aufgabe einschalten. Maios-Regeln gehen vor. |
| Shop-Abläufe im echten Browser durchklicken (Warenkorb, Kasse bis Stripe, Galerie, Popups, Konsole) | `webapp-testing` (seit 16.11.) – Playwright-Skripte, Server über `scripts/with_server.py --server "npm run dev" --port 3000`. Unter Windows `py` statt `python`. Nur gegen `localhost` bzw. Stripe-Testmodus, nie echte Zahlungen, nie gegen maiosshop.com abschicken. Neue Prüfungen gehören danach als Test in `test/`, wenn sie dauerhaft gelten sollen. |

## Kandidaten (aus TikTok-Sichtung 15.11., NICHT installiert – vorschlagen, wenn die Aufgabe passt; Installation nur nach Nevios Ja, fremde Skills vorher komplett lesen)

| Wenn … | Kandidat | Haken |
|---|---|---|
| Design einer Shop-Seite prüfen | `pbakaus/impeccable` (Apache-2.0) | Telemetrie aus, kein Live-Modus. |
| Klick-/Whoosh-Töne genau auf Animationen | **schon eigenes Werkzeug:** `Marketing/cgi/spot/spot_ton.py` + `musik.py` + `ton_check.py` (siehe VIDEO-HANDBUCH §10a). Earshot (MIT), `real-sfx` (Clipwing/skills), Openverse (nur CC0) bleiben Kandidaten für mehr Klangvielfalt | Repos noch nicht geprüft. |
| Untertitel/Schnitt wortgenau auf die Stimme (W) | Whisper (lokal) | Nicht installiert. |

**Geprüft und bewusst nicht genommen** (nicht erneut vorschlagen, außer Nevio fragt): MotionForge als Plugin (25.11.: Inhalte als Maios-Fassung in `Marketing/cgi/motionforge/` eingebaut; das Plugin selbst bräuchte GSAP/Playwright und bringt eigene Regeln mit), `claude-mem` (speichert alles inkl. `.env`, Cloud braucht Zahlungsmittel; wir haben eigenes Gedächtnis), Higgsfield (gratis = 0 Credits, keine kommerziellen Rechte), Open Generative AI über Muapi (kostet pro Clip), Chrome DevTools MCP (doppelt zum eingebauten Browser), Obsidian-Plugin „Copilot“ mit Claude-Login (Vault selbst ist seit 16.11. eingerichtet), Karpathy-Regeln und Addy Osmanis Agent Skills (CLAUDE.md/CLAUDE-CODE.md, `grossumbau` und `ponytail` decken das ab), graphify (ersetzt durch Obsidian), „Chief of Staff“, „Anatomy“, „Teach“ (kein Maios-Bezug). Gegen Token-Grenzen: `strategic-compact` ist schon da.

## Später einplanen
- **Remotion** (`remotion-dev/skills`): für Wissensvideo W (Karaoke-Untertitel auf die Stimme). Erst beim Bauen, nur nach Zustimmung installieren. Für Nevio kostenlos (bis 3 Mitarbeiter).
- **Lokale KI-Videos**: Skill `maios-ki-lokal` steht, Einrichtung auf dem RTX-PC noch offen.
