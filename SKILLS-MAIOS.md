# Skills für Maios – wann welcher (Stand 15.11.2026)

Diese Datei wird über `CLAUDE.md` (§9) automatisch mitgeladen. Passt eine Aufgabe in eine Zeile
unten, den Skill **ohne Nachfrage** laden (Skill-Tool), bevor gearbeitet wird. Bei Widerspruch gilt:
Nevios neueste Anweisung > `Marketing/UEBERGABE-CLAUDE-CODE.md` > Skill-Text.

## Videos / TikTok

| Wenn … | Skill | Hinweis |
|---|---|---|
| **irgendein Maios-Video** geplant oder gebaut werden soll | `maios-video` **zuerst** | Einstieg: gemeinsame Regeln, Formatwahl, Prüfer, Liefer-Paket, vorrat.md. Ruft dann den Format-Skill. |
| Produkt hat ≥ 5 Farben/Motive mit Foto (17, 33, 43, 47, 50) | `maios-real` | Galerie echter Fotos, 12 s. Skripte `Marketing/cgi/real/` (brauchen Pillow). |
| Motion-Design-Spot (Typo, Suchfeld, Fotowand, Produktkarte, Preis) | `maios-motion-spot` | Neues Format aus der Sichtung 15.11.; rendert ohne Installation (`Marketing/cgi/spot/`). |
| Wissensvideo W mit Erzählerstimme | `maios-wissen` | Stimme VoiceStudio „Thorsten CC0“, KI-Kennzeichnung ja. |
| „Dies oder das“: zwei Farben/Motive gegeneinander, Kommentare holen | `maios-duell` | Neu 15.11.; Videos aus echten Clips (`maios-schnitt`) sind pausiert und der Skill entfernt. |
| KI-Baustein aus Shopfoto (Wan-Modell, lokal) | `maios-ki-lokal` | Nur auf dem RTX-PC, noch nicht eingerichtet. |
| fremde TikToks als Vorbild gesucht/angesehen werden | `tiktok-videos` | Nur Referenz, `rechte_geprueft: false`. **Nie** ins eigene Video. |
| Fakten für ein Wissensvideo W belegt werden müssen | `anthropic-skills:deep-research` | Quellen in den vorrat-Abschnitt schreiben. |
| Caption, Hook-Varianten, Hashtag-Ideen, Übersetzungen | `free-modus` (auch ohne Stichwort, laut globaler CLAUDE.md) | Ergebnis gegen `products.json` und `Marketing/config/` prüfen. Code nur mit „Free-claude“. |
| ein deutscher Text nach KI klingt und Nevio das entkitschen will | `humanizer-deutsch` | Nur auf Wunsch, nicht für jedes Korrektorat. |
| TikTok Studio / Profile **lesen** | `anthropic-skills:built-in-browser` bzw. `anthropic-skills:chrome-browser` | Nur lesen, keine Anmeldung, nichts hochladen. |

**Ersetzt** (nur auf Nevios ausdrücklichen Wunsch): Konto-Skills `maios-video-cgi`, `maios-video-story`, `maios-video-maskottchen` (seit 14.11. verworfen, Sicherung `Marketing/cgi/skill/alt-stand-20261115/`), `maios-video-rohschnitt` und `maios-schnitt` (echte Clips, pausiert seit 15.11.), `real` (Cloud) → `maios-real` (lokal). `veroeffentlichen` nicht benutzen: seit 9.11. lädt Nevio selbst hoch. Die neuen Skills liegen in `.claude/skills/` (nicht versioniert), Sicherung in `Marketing/cgi/skill/neu-20261115/`.

## Shop (Code, Design, Daten)

| Wenn … | Skill |
|---|---|
| Frage zur Architektur oder „wo hängt was zusammen“ im großen Repo | `graphify` (vorher `graphify-out/` prüfen) |
| UI/UX, Design-System, Barrierefreiheit, SEO am Shop | Befehl `/design` (`.claude/commands/design.md`) |
| neue Seite oder Komponente gestalten | `frontend-design:frontend-design` |
| Design einer Seite prüfen lassen | **impeccable** (noch nicht installiert, nur mit Nevios Zustimmung, Telemetrie aus, kein Live-Modus) |
| Belege/Rechnungen (PDF) | `anthropic-skills:pdf` |
| Preis-/Produktlisten (`excel/`, CSV, XLSX) | `anthropic-skills:xlsx` |
| AGB/Datenschutz-Entwurf als Word | `anthropic-skills:docx` |
| CJ/Stripe/Resend als MCP-Server kapseln | `anthropic-skills:mcp-builder` |
| einen wiederkehrenden Ablauf als eigenen Skill festhalten | `anthropic-skills:skill-creator` |
| Code-Änderung vor dem Commit prüfen | `code-review` |

## Kandidaten (aus TikTok-Sichtung 15.11., NICHT installiert – vorschlagen, wenn die Aufgabe passt; Installation nur nach Nevios Ja, fremde Skills vorher komplett lesen)

| Wenn … | Kandidat | Haken |
|---|---|---|
| Hook-/Caption-/Shop-Texte überzeugender werden sollen | `marketing-psychology` aus `coreyhaines31/marketingskills` (MIT) | **Nur mit Filter:** keine vorgetäuschte Knappheit, kein Countdown, keine Streichpreise, kein „Bestseller“, keine erfundenen Bewertungen (UWG, `compliance_rules.json`, Nevios Entscheidung 11/2026). Erlaubt: Neugierlücke, Konkretheit, Nutzen-Framing, Entweder-oder-Frage. |
| Trend- oder Themenrecherche für Hooks, Hashtags, Wissensvideo W | `last30days` aus `mvanhorn/last30days-skill` | Reddit/HN/GitHub ohne Schlüssel. X, YouTube und TikTok nur mit eigenen API-Schlüsseln (Nevio fragen). Ergänzt die Standregel „TikTok Studio → Inspiration“, ersetzt sie nicht. |
| größere Shop-Code-Änderung in mehreren Schritten | `obra/superpowers` (MIT): Spec → Plan → Subagenten, Tests zuerst | Überschneidet sich mit unserem Ablauf (Tests mit Gegenprobe, CLAUDE-CODE.md). Nur für große Umbauten. |
| Shop-Abläufe im Browser automatisch durchtesten | `webapp-testing` aus Anthropics offiziellen Skills | Der eingebaute Browser (Konsole, Netzwerk) deckt vieles schon ab. |
| Design einer Shop-Seite prüfen | `pbakaus/impeccable` (Apache-2.0) | Telemetrie aus, kein Live-Modus. |
| Klick-/Whoosh-Töne genau auf Animationen | **schon eigenes Werkzeug:** `Marketing/cgi/spot/spot_ton.py` + `musik.py` + `ton_check.py` (siehe VIDEO-HANDBUCH §10a). Earshot (MIT), `real-sfx` (Clipwing/skills), Openverse (nur CC0) bleiben Kandidaten für mehr Klangvielfalt | Repos noch nicht geprüft. |
| Untertitel/Schnitt wortgenau auf die Stimme (W) | Whisper (lokal) | Nicht installiert. |

**Geprüft und bewusst nicht genommen** (nicht erneut vorschlagen, außer Nevio fragt): `claude-mem` (speichert alles inkl. `.env`, Cloud braucht Zahlungsmittel; wir haben eigenes Gedächtnis), Higgsfield (gratis = 0 Credits, keine kommerziellen Rechte), Open Generative AI über Muapi (kostet pro Clip), Chrome DevTools MCP (doppelt zum eingebauten Browser), Obsidian-Anbindung (Gedächtnis + graphify reichen), Apple-Design-/SwiftUI-Skills (kein iOS-App-Projekt), Karpathy-Regeln und Addy Osmanis Agent Skills (CLAUDE.md/CLAUDE-CODE.md regeln das schon), „Chief of Staff“, „Anatomy“, „Teach“ (kein Maios-Bezug). Gegen Token-Grenzen: `strategic-compact` ist schon da.

## Später einplanen
- **Remotion** (`remotion-dev/skills`): für Wissensvideo W (Karaoke-Untertitel auf die Stimme). Erst beim Bauen, nur nach Zustimmung installieren. Für Nevio kostenlos (bis 3 Mitarbeiter).
- **Lokale KI-Videos**: Skill `maios-ki-lokal` steht, Einrichtung auf dem RTX-PC noch offen.
