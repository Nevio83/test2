# FORTSCHRITT — Runde 10 (Marketing-System)

> Übergabe-Datei. Nach **jeder** Etappe aktualisieren. Ein Kontextverlust darf diese
> Runde nicht zurückwerfen.

**Stand:** 2026-08-18 · Etappen 1–14 abgeschlossen · 135 pytest-Tests grün · **Kette läuft vom Trend bis zum Lernen**
· Etappe 14 (fremdes TikTok-Material) mit 29 eigenen Node-Tests, am laufenden TikTok nachgemessen

---

## Etappen-Status

| # | Etappe | Status |
|---|---|---|
| 1 | Bestandsaufnahme + diese Datei | ✅ fertig |
| 2 | DB-Schema `mkt_*` + `db.py` + `products.py` | ✅ fertig |
| 3 | Orchestrator (`state`/`jobs`/`guardrails`/`run_loop`) + Tests | ✅ fertig |
| 4 | Trends inkl. `shop_signals` + Normalisierung + Score | ✅ fertig |
| 5 | Matcher + Briefing + Compliance | ✅ fertig |
| 6 | Stil A (echte Stimme) + `quality_gate` | ✅ fertig |
| 7 | Stil B (KI-Video) | ✅ fertig |
| 8 | Veröffentlichung + Idempotenz | ✅ fertig |
| 9 | Analytics + Attribution | ✅ fertig — **Kette zum Umsatz geschlossen** |
| 10 | Lernmodul + Wochenbericht | ✅ fertig |
| 11 | Admin-Dashboard + Server-Routen | ✅ fertig — **Fund: dasselbe Thema wurde bei jedem Lauf neu beworben** |
| 12 | Actions-Workflow + `run-local.js` + README | ✅ fertig |
| 13 | Trockenlauf + Abnahme §15 | ✅ fertig — **14 von 16 Punkten bestanden, 2 brauchen Zugangsdaten** |
| 14 | Fremdes TikTok-Material als Recherche (`tiktok-video-sync.js`) | ✅ fertig — **Fund: yt-dlp kann bei TikTok gar nicht suchen** |

---

## Etappe 1 — Bestandsaufnahme (gemessen, nicht geschätzt)

### Die sieben Python-Dateien (1.364 Zeilen)

| Datei | Zeilen | Befund |
|---|---|---|
| `fetch_trends.py` | 187 | TikTok/ExplodingTopics liefern **fest verdrahtete Beispielzeilen**. Google Trends versucht `pytrends`, fällt bei **jedem** Fehler still auf eine erfundene Zeile zurück (Zeile 145–154). Auch `sentiment`/`engagement_score` sind erfundene Konstanten. Speichert in **SQLite** (`data/trends.db`, 20 KB). |
| `product_matcher.py` | 229 | Token-Überschneidung; `PerformanceMemory` als JSON-Datei, nur per CLI-Flag gefüttert → **kein geschlossener Lernkreis**. |
| `creative_generator.py` | 100 | Setzt Briefings aus `story`-Feldern zusammen. Kein LLM, keine Varianten, keine Compliance. |
| `video_builder.py` | 504 | Runway halb implementiert, Pika legt **leere Datei** an, `synthesize_voiceover` macht bei gesetztem Key nur `touch()`. Hintergrundbilder von `source.unsplash.com` (toter Endpunkt). |
| `tiktok_uploader.py` | 217 | Selenium füllt Datei + Caption aus und **hört dann auf** — Mensch muss „Posten" klicken. Also nicht automatisch. |
| `analytics_collector.py` | 69 | Liefert **erfundene Zahlen** in eine CSV. |
| `run_pipeline.py` | 23 | Vier `subprocess`-Aufrufe, ohne Fehlerbehandlung, ohne Zustand, ohne Wiederholung. |
| `env_loader.py` | 35 | **Funktioniert und bleibt.** Lädt `Marketing/.env` + Wurzel-`.env`, `override=False`. |

### Belege für die Attrappen

- **9 von 11 MP4s in `data/renders/` sind 0 Byte.** Ebenso `data/audio/placeholder.mp3`. Die
  drei anderen Audio-Dateien haben 22–124 Byte — auch kein echtes Audio.
- Nur `data/videos/product_20.mp4` (12 KB) und `product_50.mp4` (50 KB) sind echte Dateien.

### 🔴 Neuer Befund: `Marketing/products.json` driftet massiv

Die zweite Produktliste ist **nicht nur eine Kopie, sie ist falsch**:

- **17 statt 40 Produkte** — 23 Produkte fehlen dem Marketing komplett.
- **11 der 17 haben einen abweichenden Preis.** Beispiele:

  | ID | Wurzel (Wahrheit) | Marketing-Kopie | Abweichung |
  |---|---|---|---|
  | 24 | 29,99 € | 12,99 € | **−17,00 €** |
  | 10 | 38,99 € | 28,99 € | −10,00 € |
  | 11 | 40,99 € | 32,99 € | −8,00 € |
  | 19 | 22,99 € | 19,99 € | −3,00 € |
  | 12 | 14,99 € | 16,99 € | +2,00 € |

  Ein Video mit dem Preis aus der Kopie hätte **einen Preis beworben, den es im Shop nicht
  gibt** — bei ID 24 um 17 € zu niedrig. Genau die Fehlerklasse, die laut `CLAUDE.md` §2
  schon einmal Geld gekostet hat (zweite abweichende Gutscheinliste).

- **Feld-Unterschied:** Die Wurzel hat `slug` (braucht das Marketing für die Shop-URL), die
  Kopie hat `story` (nutzt der `creative_generator`). Beim Umstellen auf die Wurzel geht
  `story` verloren → das Briefing muss aus `name` + `category` + `description` + `tags`
  gebaut werden. **Das ist kein Verlust:** `description` steht in der Wurzel bei allen 40
  Produkten, `category` ebenfalls, `tags` bei 33.

### Umgebung (gemessen)

| | |
|---|---|
| Python | **3.14.5**, keine venv |
| pip-Pakete | 35 gesamt; von den benötigten ist **nur `numpy`** da |
| **fehlt:** | `psycopg`, `pytest`, `python-dotenv`, `requests`, `pytrends`, `selenium`, `pillow` |
| **ffmpeg** | **nicht im PATH** (weder Bash noch Windows) |
| `requirements.txt` | existiert **nicht** |
| Node/Postgres | vorhanden und nutzbar (`DATABASE_URL` in `.env`) |

---

## Etappe 2 — Datenhaltung

- **17 `mkt_*`-Tabellen** in `database.js` (16 aus §3.2 + `mkt_config_overrides`, siehe unten).
  Rein additiv, keine bestehende Tabelle angefasst. Live in Neon angelegt, zweiter Lauf
  idempotent, Shop startet weiterhin ohne `DATABASE_URL` (`/health` → 200 geprüft).
- `db.py` — psycopg-Zugriff, Pool wenn `psycopg_pool` da ist, sonst wiederverwendete
  Einzelverbindung. Ohne psycopg/`DATABASE_URL`: `verfuegbar()` = False + Klartext-Grund,
  kein Absturz.
- `products.py` — liest **nur** die Wurzel-`products.json`. 40 Produkte, ID 24 mit den
  echten 29,99 €.
- **Erledigt (mit deiner Freigabe):** `Marketing/products.json` gelöscht; 13 leere Artefakte
  (9× 0-Byte-MP4, 4 Mini-Audios) aus dem öffentlichen Repo entfernt, Dateien lokal behalten.

## Etappe 3 — Fundament (Orchestrator)

- `state.py` — Fälligkeit **und** Belegen in **einer** SQL-Anweisung, nach dem Vorbild
  `dbOperations.claimJobRun`. Zusätzlich Lease + Herzschlag: ein abgestürzter Lauf wird nach
  30 Min automatisch freigegeben, statt den Job für immer zu blockieren.
- `guardrails.py` — Notaus (3 Wege), Trockenlauf (Standard **an**), Budgetwächter
  (umschalten statt abbrechen), Token-Bucket, Positivliste für die Selbstanpassung.
- `jobs.py` — 11 Jobs, Zuordnung als Text (`modul:funktion`). Ein fehlendes Modul ist ein
  **Zustand**, kein Fehler: der Job wird mit Grund übersprungen, der Lauf geht weiter.
- `run_loop.py` — `--once`, `--status`, `--list`, `--job`, `--max-minutes`.

**18 pytest-Tests, alle grün.** Gegenproben an der echten Funktion durchgeführt:
Neuterminierung entfernt → `test_faelligkeit` rot; beide Schutzschichten entfernt →
`test_claim_race` meldet „es waren 2". Danach zurückgesetzt, wieder grün.

### 🔧 Architektur-Korrektur gegenüber dem Aufgabenzettel

§7.3 verlangt, dass `policy.py` alle 6 h die Gewichte anpasst. Der naheliegende Weg wäre,
`marketing.config.json` zu überschreiben — **das wäre kaputt gewesen:** Der Hauptbetrieb
läuft in GitHub Actions mit flüchtigem Checkout, eine dort geschriebene Datei ist beim
nächsten Lauf weg. Gelerntes hätte nach 30 Minuten wieder bei den Startwerten gestanden,
ohne dass es jemand merkt — genau die Fehlerklasse, gegen die diese ganze Runde gebaut ist.

**Gelöst:** neue Tabelle `mkt_config_overrides`. Die Datei hält die *Startwerte*, die
Datenbank die *gelernten Abweichungen*; `guardrails.wert()` bevorzugt die Datenbank, aber
nur für Pfade auf der Positivliste. Test `test_gelernte_werte_ueberleben_prozessende`
sichert genau das ab.

*(Aufgefallen ist es, weil Python in dieser Umgebung gar nicht in den Projektordner schreiben
darf — der Fehlschlag hat den Konstruktionsfehler sichtbar gemacht.)*

## Etappe 4 — Trends

Sechs Quellen hinter einer Schnittstelle (`TrendQuelle`), plus Normalisierung und Score.

- **`shop_signals.py` ist die wichtigste Quelle** — die einzige, die sonst niemand hat.
  Fünf Signale, gewichtet: Suche ohne Treffer (1,00) > Verkauf (0,80) > Warenkorbabbruch
  (0,60) > Suche (0,50) > Seitenaufruf (0,30). *Live gelaufen: 6 echte Zeilen aus dem Shop.*
- **Extern:** TikTok Creative Center, Google Trends, Reddit, YouTube, ExplodingTopics.
  Vier davon brauchen nur `requests` (schon da), nur Google Trends braucht `pytrends`.
- **Score** aus benannten Bestandteilen, die **mitgespeichert** werden
  (`mkt_trend_scores.bestandteile`) — sonst ist die Auswahl später nicht erklärbar.
  Rang-Normierung **je Quelle**, weil Reddit-Punkte und Shop-Suchen keine vergleichbaren
  Skalen sind.

**37 pytest-Tests grün** (18 Orchestrator + 19 Trends).

### Live bestätigt: die Kernregel greift

```
[trends] tiktok:           0 Zeilen — Struktur hat sich geändert (Alarm im Nachweis-Protokoll)
[trends] google_trends:    0 Zeilen — pytrends ist nicht installiert
[trends] reddit:           0 Zeilen — REDDIT_CLIENT_ID fehlt
[trends] youtube:          0 Zeilen — YOUTUBE_API_KEY fehlt
[trends] exploding_topics: 0 Zeilen — EXPLODING_TOPICS_API_KEY fehlt
[trends] keine einzige Quelle lieferte Daten — es wird NICHTS erfunden.
```

Der TikTok-Strukturbruch-Alarm hat **echt ausgelöst** — der Endpunkt hat sich tatsächlich
geändert. Genau dafür ist er da: 0 Zeilen **und** ein Eintrag in `mkt_audit_log`, statt still
nichts zu liefern.

### 🔴 Zwei echte Fehler im eigenen Code, beide vom Test gefunden

1. **Sperrliste hätte umgangen werden können.** Der Stemmer kürzte „bitcoin" zu „bitcoi" —
   und der Sperrlisten-Eintrag „bitcoin" griff nicht mehr. Ein gesperrtes Thema (Krypto,
   Politik, Heilversprechen) wäre durchgerutscht. **Behoben** durch Trennung in zwei
   Funktionen: `normalisiere()` (unverkürzt, für Sperrliste) und `stamm()` (gekürzt, nur für
   Dubletten). Test `test_gesperrte_themen_ueberleben_die_wortkuerzung` hält es fest.
2. **Trend ohne Score.** Trend und Bewertung wurden einzeln geschrieben. Als der erste Lauf
   dazwischen scheiterte, blieb eine Trend-Zeile **ohne Bewertung** liegen — unsichtbar für
   jede Rangliste, aber vorhanden. **Behoben** durch eine gemeinsame Transaktion; Test
   `test_trend_und_score_gehoeren_zusammen` prüft die Datenbank direkt.

## Etappe 5 — Matcher, Briefing, Compliance

- **`matcher.py`** — vier Filter, jeder mit Begründung im Nachweis-Protokoll: Passung,
  Marge, Verfügbarkeit, Erschöpfung (max. 2 Posts je Produkt je Woche). Dazu ein gedeckelter
  gelernter Aufschlag (±0,15), damit eine Kategorie mit Anfängerglück nicht alle Videos
  bekommt.
- **`creative/llm_client.py`** — Anthropic/OpenAI über `requests`, ohne SDK. **Jeder Aufruf
  wird mit echten Token-Zahlen gebucht.** Kein Schlüssel oder Budget erschöpft → `None`, und
  der Generator baut aus Vorlagen weiter statt stehenzubleiben.
- **`creative/brief_generator.py`** — 6 Hook-Typen, sekundengenaues Skript (Hook in den
  ersten 1,5 s), Overlays, CTA, Hashtag-Mischung (1 breit / 2 mittel / 2 nischig) und der
  **vollständige Merkmalsvektor** für das spätere Lernen.
- **`creative/compliance.py`** — sperrt statt zu warnen, zweimal geprüft (vor Rendern, vor
  Posten).
- **`config/brand_voice.md`** — Markenstimme mit Tabuwörtern; wird dem Sprachmodell wirklich
  mitgegeben.

**56 pytest-Tests grün** (18 Orchestrator + 19 Trends + 19 Creative).
*Live gelaufen: 5 Trends → 5 Briefings, 0 blockiert.*

### 🔴 Zwei weitere echte Fehler, beide live aufgefallen

1. **Die Verfügbarkeitsprüfung lief ins Leere.** Meine Abfrage zeigte auf eine Spalte
   `in_stock`, die es in `cj_stock_watch` nicht gibt (sie heißt `available` + `stock`). Der
   Fehler wurde abgefangen und lieferte ein leeres Ergebnis — was „keine Aussage" bedeutet.
   Es hätte also **jedes ausverkaufte Produkt beworben werden können**. Behoben, Test
   `test_bestand_wird_aus_der_richtigen_spalte_gelesen` prüft die echte Tabelle.
2. **Stil B konnte nie ein Video erzeugen.** Der Vorlagen-Weg setzte die
   KI-Kennzeichnung nicht, also blockierte die Compliance *jedes* Stil-B-Briefing — im ersten
   Lauf waren exakt die 2 von 5 blockierten Briefings die beiden Stil-B-Fälle. Behoben; nach
   dem Fix 5 von 5 durch.

Beide Gegenproben an der echten Funktion durchgeführt: Fehler wieder eingebaut → Tests rot →
zurückgesetzt → grün.

## Etappe 6 — Stil A (echte Videos)

**Es entstehen echte, abspielbare Videos.** Zwei Stück live gerendert:
Smart Beamer 24,1 s / 3,8 MB und Nordic Crystal Lamp 20,2 s / 4,0 MB, beide
1080×1920, H.264 + AAC, mit eingebrannten Untertiteln und Endkarte.

- **`common.py`** — ffmpeg wird *gesucht* statt vorausgesetzt (ENV → PATH →
  winget-Ort). Untertitel als ASS mit Sicherheitsabstand, Ken-Burns-Fahrt,
  Endkarte, Loudness, Musik-Duckung.
- **`assets.py`** — Reihenfolge eigene Videos → eigene Bilder → CJ → Stock.
  **Ohne Lizenzeintrag kommt nichts ins Video.** `source.unsplash.com` ist raus.
- **`quality_gate.py`** — prüft die **Datei**, nicht den Rückgabewert: Größe,
  Laufzeit, Auflösung, Tonspur, Codecs.
- **TTS-Adapter** — `human_takes` → `elevenlabs` → `lokal`. Der lokale Weg nutzt
  die **in Windows eingebaute Sprachausgabe**; ohne ihn hätte dieser Rechner gar
  keine Stimme (piper nicht installiert, kein ElevenLabs-Schlüssel, keine
  eigenen Aufnahmen). Ein Rückfall, der ausfällt, ist keiner.

**73 pytest-Tests grün.** Videos in den Tests werden wirklich erzeugt, nicht simuliert.

### 🔴 Drei echte Fehler, alle erst beim Rendern sichtbar

1. **Ken-Burns-Fahrt: 3-Sekunden-Clip wurde 270 Sekunden lang.** `zoompan` gibt
   `d` Bilder je *Eingangsbild* aus — bei 90 Eingangsbildern und `d=90` also
   8.100 statt 90. Der erste Lauf hing nach 10 Minuten immer noch. Behoben mit
   `d=1`; Gegenprobe bestätigt exakt 270,0 s.
2. **Clips waren ein Sechstel zu kurz** (2,50 s statt 3,00 s): Standbilder liest
   ffmpeg mit 25 B/s ein, der Filter rechnete mit 30. Behoben mit `-framerate 30`.
3. **Die Endkarte fehlte komplett.** `-shortest` schneidet auf die Tonlänge — und
   die Endkarte hat keinen Ton. Nachgemessen: Video 21,6 s = exakt die
   Sprechdauer. **Damit fehlte die Shop-Adresse, also der einzige Weg vom Video
   zum Kauf.** Behoben mit `apad` + fester Gesamtlänge; jetzt 24,1 s, Endkarte
   sichtbar geprüft (Produktname, 93,99 € — stimmt mit `products.json` überein —
   und Shop-URL).

### ⚠️ Inhaltlicher Befund, kein Programmfehler

Das verwendete Bildmaterial sind teils **Lieferanten-Datenblätter mit englischem
Text** („Smart Projector", „HD Input", „USB 2.0"). Technisch einwandfrei
eingebunden, aber als Werbevideo für deutsche Kunden schwach. Abhilfe: eigene
Produktfotos oder -videos unter `produkt videos/` ablegen — die haben Vorrang
vor allem anderen.

## Etappe 7 — Stil B (KI-Video) mit erzwungener Produkttreue

- **Die Kernregel steht im Programm, nicht im Kommentar:** Eine Einstellung, die das Produkt
  zeigt, braucht ein **echtes Produktfoto als Startbild** (Bild-zu-Video). Kann ein Anbieter
  kein Bild-zu-Video, wird eine Produkt-Einstellung **gar nicht erst versucht** — Fehler
  statt Rückfall auf Text-zu-Video. Text-zu-Video ist nur für Stimmungsbilder **ohne**
  Produkt erlaubt.
- **Shot-Liste** 3–5 Einstellungen à 3–5 s; erste *und* letzte zeigen immer das Produkt.
- **Bildstil aus `brand_voice.md`** wird wirklich ausgelesen — ändere dort die Farben, und
  die Prompts ändern sich mit. Fester Zufallswert je Kampagne, damit alle Einstellungen
  zusammenpassen.
- **Endkarte immer aus dem echten Produktfoto**, nie KI-generiert.
- **Vertonung identisch zu Stil A** (derselbe Stimmen-Adapter).

**87 pytest-Tests grün.**

### Was am alten Runway-Code repariert wurde

| Alt | Neu |
|---|---|
| `"mode": "text"` → **Text-zu-Video, erfindet das Produkt** | `image_to_video` mit echtem Produktfoto |
| Warteschleife **ohne Zeitlimit** — hängender Auftrag blockiert den Job für immer | Abbruch nach 600 s mit `TimeoutError` |
| Zufallswert je Einstellung neu gewürfelt → jede Einstellung eine andere Bildwelt | fester Wert je Kampagne |
| **Pika legte eine leere Datei an und meldete Erfolg** | ersatzlos entfernt |

### 🔧 Zwei bewusste Abweichungen vom Aufgabenzettel

1. **Kling, Luma und Veo sind *nicht* implementiert.** Ich kenne deren aktuelle
   Schnittstellen nicht sicher genug, um Code zu schreiben, den ich nicht prüfen kann.
   Ungeprüfter Anbindungscode, der behauptet zu funktionieren, ist genau die Fehlerklasse,
   die diese Runde beseitigt. Die Adapter-Struktur ist offen — ein weiterer Anbieter ist eine
   Klasse mit zwei Methoden. **Auch der Runway-Adapter ist mangels Schlüssel nicht gegen den
   echten Dienst erprobt**; er ist aber so gebaut, dass er im Zweifel *laut* scheitert
   (Zeitlimit, Statusprüfung, Größenprüfung) statt still eine leere Datei zu hinterlassen.
2. **Ohne KI-Anbieter werden keine Stil-B-Briefings mehr erzeugt.** Sonst landeten 30 % aller
   Briefings in einer Warteschlange, die nie abgearbeitet wird — und jeder einzelne Lauf
   meldete brav „keine Stil-B-Briefings gerendert". Lieber alles als Stil A produzieren als
   ein Drittel gar nicht. Test: `test_ohne_anbieter_entstehen_keine_stil_b_briefings`.

### Gesamtlauf am Stück bestätigt

```
trends_ingest   ✅  (0 Zeilen, jede Quelle mit Begründung)
shop_signals    ✅  6 echte Zeilen aus dem Shop
match_and_brief ✅  5 Trends → 5 Briefings, 0 blockiert
render_style_a  ✅  2 Videos, 21,4 s und 21,6 s
cleanup_assets  ✅
budget_rollover ✅
→ 6 gelaufen, 5 übersprungen (mit Grund), 0 fehlgeschlagen
```

## Etappe 8 — Veröffentlichung mit Doppelpost-Schutz

- **`publish/base.py`** — Planen und Absenden, beides idempotent. Bildunterschrift mit
  Hook, Handlungsaufforderung, **Shop-Link mit UTM-Kennung** (die Brücke zu Etappe 9) und
  Hashtags.
- **`publish/slots.py`** — Sendeplätze aus der Konfiguration, Mindestabstand 3 h,
  höchstens 3 Beiträge je Tag und Plattform. Slot-Name als „Di 12:30" — ein konkreter
  Zeitpunkt käme nie wieder und wäre zum Lernen wertlos.
- **`publish/tiktok.py`** — offizielle Schnittstelle bevorzugt (mit Warten auf die
  Veröffentlichungsbestätigung), Browser-Weg als Rückfall. **Der läuft jetzt bis zum
  Absenden durch** — der alte Stand hörte nach dem Ausfüllen auf und wartete auf einen
  Menschen.
- **`publish/instagram.py`, `publish/youtube.py`** — hinter derselben Schnittstelle, ohne
  Zugangsdaten sauber übersprungen.
- **KI-Kennzeichnung** wird bei Stil B an die Plattform gemeldet (`is_aigc` bzw.
  `containsSyntheticMedia`), zusätzlich zum Hinweis im Video.
- **Compliance läuft ein zweites Mal** unmittelbar vor dem Absenden — zwischen Planen und
  Senden liegen Stunden, in denen sich Preis oder Bestand ändern können.

**106 pytest-Tests grün.**

### 🔴 Der Doppelpost-Schutz war beim ersten Anlauf wirkungslos

Der Fingerabdruck aus (Video, Plattform, **Sendeplatz**) klingt richtig — ist es aber nicht:
Der Sendeplatz **verschiebt sich bei jedem Lauf**, weil der vorige Lauf den früheren Platz
schon belegt hat. Zwei Durchgänge erzeugten dadurch zwei *verschiedene, formal gültige*
Fingerabdrücke für dasselbe Video.

**Gemessen: nach zwei Läufen standen 6 statt 3 Beiträge in der Tabelle** — dasselbe Video
zweimal eingeplant. Auf TikTok ist ein doppelter Beitrag ein Grund für
Reichweitendrosselung.

**Gelöst** mit einer zweiten eindeutigen Regel in der Datenbank: *ein lebender Beitrag je
Video und Plattform* (fehlgeschlagene ausgenommen, damit ein neuer Versuch möglich bleibt).
Jetzt: 3 Läufe → 3 Beiträge. Gegenprobe: Regel entfernt → Test meldet „3 Beiträge für
dasselbe Video angelegt".

*Nebenbei hat dieselbe Regel einen Test entlarvt, der drei Beiträge für **ein** Video
anlegen wollte — auch das war falsch und ist jetzt korrekt mit drei Videos gebaut.*

## Etappe 9 — Messung und Umsatzzuordnung

- **`analytics/metrics.py`** — fünf Messfenster (1 h, 6 h, 24 h, 72 h, 7 d). Jedes wird
  **nur einmal** geschrieben; ein Wiederholungslauf zählt keine Messung doppelt.
  Trockenlauf-Beiträge werden nie gemessen — was nie rausging, hat keine Kennzahlen.
- **`analytics/collectors.py`** — echte Abrufe für TikTok, Instagram, YouTube. Ohne
  Zugangsdaten: **keine Zahlen**, mit Begründung. Was eine Plattform nicht liefert, bleibt
  `None` statt `0` — der Unterschied zwischen „gemessen und null" und „nicht gemessen".
- **`analytics/attribution.py`** — die Brücke zum Umsatz, plus eine ehrliche Auskunft
  darüber, ob sie überhaupt trägt.

**120 pytest-Tests grün.**

### 🔴 Gefundener Blocker — und mit deiner Freigabe geschlossen

Am 15.08. an der echten Datenbank nachgemessen: Die Kette Beitrag → Klick → Sitzung →
Bestellung war **an zwei Stellen unterbrochen**.

1. **`view-tracker.js` speicherte `location.pathname`** — das schneidet die Parameter ab.
   Die Kennung `?utm_campaign=mkt_42` landete **nie** in `page_views`. Nachgemessen: kein
   einziger Pfad in der Tabelle enthielt ein Fragezeichen.
2. **`orders` hatte keine Spalte für Herkunft.** Selbst mit gespeicherter Kennung ließe
   sich eine Bestellung keiner Sitzung zuordnen.

Ohne beides hätte Etappe 10 nicht sinnvoll lernen können — die Belohnung gewichtet den
Deckungsbeitrag mit 40 %, und der wäre dauerhaft 0 geblieben.

**Beide Änderungen lagen außerhalb dessen, was diese Runde anfassen darf** (§13:
Kundenseiten, bestehende Tabellen, Checkout). Nach deiner ausdrücklichen Freigabe umgesetzt,
streng minimal und **exakt nach dem Vorbild des bereits vorhandenen `device`-Feldes**, das
denselben Weg geht:

| Stelle | Änderung |
|---|---|
| `view-tracker.js` | hängt **nur** `utm_campaign` an den Pfad und merkt sie in `localStorage` — einwilligungsgebunden wie alles andere |
| `cart.js` | gibt die gemerkte Kennung beim Checkout mit |
| `server.js` | filtert sie (nur `\w-`, max. 40 Zeichen) und legt sie in die Stripe-Metadaten |
| `server.js` (Webhook) | liest sie aus den Metadaten in die Bestellung |
| `database.js` | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_campaign` + Index |

**Ende-zu-Ende im echten Browser geprüft:** Aufruf mit `?utm_campaign=mkt_42` → Tracker merkt
sie → landet in `page_views` → `utm_sitzungen('mkt_42')` findet 1 Sitzung → Testbestellung mit
Kennung angelegt und über die Kampagne wiedergefunden. `messbarkeit()` meldet jetzt
**`umsatz_zuordnung_moeglich: True`**. Testdaten anschließend wieder entfernt.

*Was bewusst NICHT gebaut wurde: eine zeitliche „Zuordnung" (Bestellungen kurz nach dem
Beitrag). Das wäre Korrelation, keine Zuordnung — bei 40 % Gewicht würde das Lernmodul
daraus dauerhaft und unbemerkt Fehlentscheidungen ableiten. Der zeitliche Zusammenhang wird
berechnet, aber ausdrücklich als `belastbar = False` gekennzeichnet.*

## Etappe 10 — Das Lernmodul

- **`learning/features.py`** — 10 steuerbare Dimensionen mit festen Werten. Was nicht in der
  Liste steht, wird nicht gelernt: Ein Tippfehler kann keine neue Ausprägung erfinden und
  damit die Statistik verwässern.
- **`learning/reward.py`** — Belohnung aus fünf Anteilen, **Deckungsbeitrag mit 40 %**.
  Fehlende Kennzahlen werden aus der Rechnung *genommen*, nicht als 0 gewertet — sonst
  ließe eine Plattform ohne Haltequote jedes Video schlecht aussehen.
- **`learning/bandit.py`** — Thompson Sampling. Nachvollziehbar, funktioniert ab wenigen
  Dutzend Datenpunkten, löst die Abwägung „nimm das Beste" vs. „probier Neues" von selbst.
- **`learning/policy.py`** — sammelt Belohnungen ein, füttert die Arme, zieht Gewichte nach
  (höchstens 10 Prozentpunkte je Durchgang, damit Ursache und Wirkung unterscheidbar bleiben).
- **`learning/report.py`** — Wochenbericht als HTML, im Trockenlauf nur erzeugt statt
  verschickt.

**135 pytest-Tests grün.**

### Der Abnahmepunkt aus §15 ist erfüllt

20 simulierte Beiträge mit gestreuten Belohnungen (guter Arm ~0,8, andere ~0,25, jeweils mit
Rauschen): Danach führt der gute Arm messbar, **und** die Erkundungsquote liegt weiterhin
über 15 %. Beides zusammen — nur eines von beidem wäre entweder Erstarrung oder Zufall.

### Zwei Funde beim Testen

1. **Die Erkundungs-Untergrenze lässt sich nicht wegkonfigurieren.** Beim Versuch, sie über
   einen Datenbank-Override auf 0 zu setzen, blieb der Test grün — weil
   `lernen.exploration_min` **nicht auf der Positivliste** steht und der Override deshalb
   ignoriert wird. Der Schutz aus Etappe 3 greift also auch hier. Die Gegenprobe habe ich
   dann direkt am Code gemacht: Untergrenze raus → **Erkundungsquote 0,000**, Test rot.
2. **Eine Auswahl kostete eine Datenbankanfrage je Ausprägung.** Der Abnahmetest mit 500
   Ziehungen brauchte dadurch **drei Minuten**. Jetzt wird die ganze Dimension auf einmal
   geladen und je Prozess zwischengespeichert (verworfen bei jeder Änderung): **181 s → 43 s.**
   Im Betrieb spart das bei jedem Briefing dutzende Anfragen.

---

## Etappe 11 — Die Übersichtsseite

`a29715347575/marketing.html` + `marketing.js` (Anzeige), `Marketing/api.js` (Abfragen),
Routen-Block `/a29715347575/api/marketing/*` in `server.js`. Elf Bereiche: Überblick,
Notaus, Abläufe, Trend-Rangliste, Warteschlange, Ergebnisse, verworfene Videos, Lernstand,
Kosten, gelernte Abweichungen, Nachweis-Protokoll.

**Warum die Abfragen in `Marketing/api.js` stehen und nicht in `database.js`:** `database.js`
gehört dem Shop. Der Automat hängt an derselben Datenbank, ist aber ein eigener Teil — so
bleibt der Eingriff in den Shop-Code ein schlanker Routen-Block statt 200 Zeilen SQL.

**Die Seite kann genau zwei Dinge schreiben:** einen Ablauf an/aus und den Sammelschalter.
Beides setzt nur `mkt_jobs.enabled` — sie startet und beendet **keine** Prozesse. Ein
Dashboard, das Prozesse abschießt, wäre die gefährlichere Bauart: Es könnte einen Lauf
mitten im Rendern oder Posten unterbrechen. Dass der Schalter wirkt, hängt nicht an der
Seite, sondern an `state.py`: Die Übernahme-Anweisung prüft `AND enabled` (Zeile 105), und
`guardrails.notaus_grund()` liest das Flag zusätzlich vor jedem Lauf.

### Am echten System nachgemessen

| geprüft | Ergebnis |
|---|---|
| Alle elf Bereiche mit echten Daten | gefüllt, kein „Lädt…" übrig |
| Einzelschalter (`cleanup_assets` aus → an) | DB folgt, beide Male im Nachweis-Protokoll |
| Notaus (alles aus → alles an) | 11/11 → 0/11 → 11/11, beide Male protokolliert |
| CSP-Verstöße nach vollem Seitenaufbau | **0** — der Stilblock wird beim Start automatisch freigegeben |
| `Marketing/api.js`, `…/config/*.json`, `…/*.py`, `Marketing/.env` von außen | **404** (static-guard) |
| `a29715347575/marketing.js` ohne Anmeldung | **401** |

### Der Fund: dasselbe Thema wurde bei jedem Lauf neu beworben

Beim ersten Blick auf die fertige Seite stand in der Trend-Rangliste dreimal dasselbe
Stichwort untereinander. Nachgezählt in der Datenbank: **18 Trend-Zeilen für 6 Stichwörter**
und **10 Briefings für 7 Themen** — davon **3 für dieselbe Kombination aus Thema und
Produkt**.

Ursache waren zwei Dinge, die sich gegenseitig verdeckt haben:

1. Jeder Durchlauf legt für dasselbe Stichwort eine **neue** `mkt_trends`-Zeile an. Das ist
   richtig so — die Historie ist die einzige Quelle für `saisonalitaet()`, die ein Jahr
   zurückschaut. Für die **Auswahl** ist dieselbe Messung zum dritten Mal aber kein neues
   Thema.
2. Die Sperre „hat schon ein Briefing" hing an der `trend_id`. Die ist bei jeder Messung
   eine andere — die Sperre hat also **nie** gegriffen.

Im Betrieb heißt das: dasselbe Thema hätte bei jedem Lauf erneut ein Briefing ausgelöst
(kostet Geld beim Sprachmodell), ein Video (kostet Rechenzeit) und später denselben Beitrag.
**Die Idempotenz-Sperre aus Etappe 8 fängt das nicht ab** — sie hängt an der `video_id`, und
die ist ehrlich jedes Mal eine andere. Aufgefallen wäre es erst an der Wochengrenze
`max_posts_pro_produkt_pro_woche`, also erst *nachdem* Briefing und Video schon bezahlt sind.

**Behoben** in `matcher.offene_trends()` und `Marketing/api.js`: `DISTINCT ON (keyword_norm)`
für eine Zeile je Thema, und die Briefing-Sperre über das **Thema** statt über die Messung —
begrenzt auf `matching.thema_cooldown_tage` (7, passend zur Wochengrenze). Ein Thema für
immer zu sperren wäre die andere Übertreibung: Was im Juni lief, kann im Dezember wieder
laufen. Rangliste danach: **12 Zeilen → 7**, eine je Thema.

### Gegenprobe

Sechs neue Tests in `tests/test_creative.py`. Zwei davon führen die **alte Abfrage im
Wortlaut** gegen dieselben Testdaten aus und belegen, dass sie 3 statt 1 Kandidaten geliefert
hätte und die Sperre trotz vorhandenem Briefing 2 Kandidaten durchgelassen hätte — sonst
könnte der neue Test grün sein, weil die Testdaten gar keine Dubletten enthalten. Zusätzlich
den alten Zustand wieder eingesetzt: **3 der 6 Tests wurden rot**, danach zurückgebaut.

Dazu `test/marketing-dashboard.test.js` (10 Tests, Shop-Seite): HTML- und Skript-IDs müssen
sich decken — **in beide Richtungen**, denn eine ID, die nur eine Seite kennt, hinterlässt
eine Kachel, die für immer auf „Lädt…" steht: keine Fehlermeldung, kein Konsoleneintrag.
Der Test hat prompt eine Stelle gefunden, an der ein Datenbankwert **ungemaskiert** ins
Markup ging (`fehler_zaehler`) — harmlos, weil ganzzahlig, aber am Verwendungsort sieht man
das nicht. Behoben statt Test aufgeweicht.

**Nicht angefasst:** die eine alte Trend-Zeile vom 15.08., 12:51 mit abweichender Normalform
(`led crystal lampe` statt `led crystal lamp`). Sie stammt aus einem Testlauf vor der
Trennung von `normalisiere()`/`stamm()` in Etappe 4; seit 12:57 ist die Form stabil. Ihr
Score läuft nach 72 Stunden von selbst aus der Rangliste.

---

## Etappe 12 — Der Takt von außen

`.github/workflows/marketing.yml` (alle 30 Min + Start von Hand), `Marketing/run-local.js`
(Dauerläufer für Browser/GPU), `Marketing/README.md` (Bedienungsanleitung), drei npm-Skripte.

**Warum der Takt von außen kommt:** Der Shop läuft auf Render-Free und startet ständig neu.
Ein Loop im Shop-Prozess liefe praktisch nie durch — genau das ist am 02.08. schon einmal
nachgewiesen worden (Kommentarkopf `job-scheduler.js`). Der Workflow ist deshalb bewusst
**dumm**: Er ruft alle 30 Minuten einen Durchgang auf, und was fällig ist, entscheidet allein
`mkt_jobs.naechster_lauf`. Fällt ein Lauf aus, holt der nächste ihn nach.

| Entscheidung | Grund |
|---|---|
| `cancel-in-progress: false` | Ein abgebrochener Lauf hinterlässt einen belegten Ablauf. Der nächste überspringt ihn dann 30 Minuten lang — es sieht aus, als passiere grundlos nichts. |
| ffmpeg wird **geprüft**, nicht vorausgesetzt | Ob ein Runner-Abbild ffmpeg mitbringt, ändert sich zwischen Abbild-Versionen. Fehlt es, rendert Stil A nicht — und der Lauf bleibt grün, weil der Job den Grund brav protokolliert. |
| Die Eingabe des manuellen Starts geht über `env:` | `${{ github.event.inputs.x }}` wird **vor** der Shell ersetzt. Ein Ablaufname wie `a; curl …` wäre sonst ein eigener Befehl. Bekannte Schwachstellenklasse, und das Repo ist öffentlich. |
| `MARKETING_DRY_RUN` steht **nicht** im Workflow | Ohne die Variable gilt `trockenlauf.standard: true`. Veröffentlichen ist damit eine bewusste Entscheidung im Repository-Secret, keine Zeile, die man beim Aufräumen übersieht. |
| `render.yaml` **unverändert** | Der Aufgabenzettel nennt sie in §13 ausdrücklich als „nicht anfassen", verlangt aber in §3.1 einen Worker-Block darin. Beim Widerspruch gilt das Verbot: Die Vorlage steht stattdessen fertig zum Einfügen in `README.md` §8. |

### Am echten System nachgemessen

`node Marketing/run-local.js --status` und ein Dauerlauf über 20 Sekunden mit
`--takt 30 --job budget_rollover` (ein Ablauf, der erst in 22 Stunden fällig ist, also
garantiert ohne Nebenwirkung):

```
▶ Dauerlaeufer gestartet — Takt 30s, Frist 25 Min je Durchgang.
▶ Lauf startet — Runner 'local' (darf lokale Jobs), Trockenlauf AN, Frist 25 Min
   ⏭️  budget_rollover: nicht faellig oder bereits belegt
◀ Lauf fertig nach 0.6s — 0 gelaufen, 1 uebersprungen, 0 fehlgeschlagen
```

Damit ist belegt: Der Läufer startet Python, meldet sich als `local` an (bekommt also die
Abläufe mit `requires_local`), fängt sofort an statt erst nach dem ersten Takt, und die
Fälligkeitsprüfung aus der Datenbank greift.

### Drei Funde beim Bauen

1. **Node warnte bei jedem Start** (`DEP0190`): `spawn` mit Argumenten **und** `shell: true`
   hängt die Argumente nur aneinander, statt sie zu maskieren. `py`/`python` liegen ohnehin
   als ausführbare Datei im PATH — die Shell war überflüssig und ist raus.
2. **Eine Warnung, die falsch war.** Der Läufer meldete „DATABASE_URL ist nicht gesetzt",
   obwohl die Datenbank einwandfrei angebunden war: Node liest `.env` nicht von selbst,
   Python schon. Eine Warnung, die grundlos erscheint, bringt einem bei, Warnungen zu
   überlesen — jetzt werden beide `.env`-Dateien mitgeprüft.
3. **Zwei gleich unsinnige Eingaben, zwei verschiedene Ergebnisse.** `--takt 0` landete über
   `|| standard` beim Standardwert, `--takt -5` dagegen bei der Untergrenze. Getrennt nach
   „unlesbar → Standardwert" und „lesbar, aber zu klein → Untergrenze". Ohne Untergrenze
   hätte ein Takt von 0 Python in einer Endlosschleife gestartet.

### Gegenprobe

`test/marketing-betrieb.test.js` (13 Tests). Zweimal den scharfen Zustand hergestellt und
belegt, dass die Tests ihn melden:

* `MARKETING_DRY_RUN: "false"` fest in den Workflow → **rot**
* `MARKETING_RUNNER: 'local'` aus `laufUmgebung()` entfernt → **rot**

Der zweite Fall ist der heimtückischere: Ohne die Zeile bekäme der lokale Läufer die Abläufe
mit `requires_local` nie zugeteilt. Veröffentlichen und Stil B liefen schlicht nicht — ohne
Fehlermeldung, denn der Durchgang meldet „nicht fällig / belegt" und ist grün.

**Stand:** Lint sauber, `npm test` 191 Tests (185 grün, 6 ohne Datenbank übersprungen),
`pytest` 141 grün.

---

## Etappe 13 — Trockenlauf und Abnahme

Alle 16 Prüfpunkte aus §15 **einzeln nachgewiesen**, nicht abgehakt. Ergebnis:
**14 bestanden, 2 nur teilweise** — und beide Teilergebnisse hängen an Zugangsdaten, nicht
am Code.

| # | Prüfpunkt | Ergebnis |
|---|---|---|
| 1 | Ein Durchgang ohne Zugangsdaten läuft fehlerfrei und nennt je Ablauf den Grund | ✅ Rückgabewert 0, **11 von 11** Abläufen mit Grund übersprungen |
| 2 | `mkt_*`-Tabellen idempotent, Shop startet ohne `DATABASE_URL` | ✅ zwei Starts hintereinander, 0 Schemafehler · **alle 16** Tabellen aus §3.2 vorhanden (+ `mkt_config_overrides`) · ohne `DATABASE_URL`: `/health` = 200 |
| 3 | Echte Trends aus ≥ 2 Quellen inkl. `shop_signals`; ohne Zugangsdaten null Zeilen | ⚠️ **teilweise** — siehe unten |
| 4 | Stil A: abspielbares MP4, 1080×1920, 15–60 s, Stimme, Untertitel, Endkarte | ✅ zwei Videos: **20,8 s** und **22,1 s**, 1080×1920, h264 + aac, 2,4 / 3,3 MB |
| 5 | Stil B: echtes Produktbild als erster Frame, KI-Kennzeichnung | ⚠️ **teilweise** — siehe unten |
| 6 | `quality_gate` weist 0-Byte- und 4-Sekunden-Video ab | ✅ |
| 7 | Zwei gleichzeitige Runner führen denselben Ablauf nur einmal aus | ✅ |
| 8 | Zweimal `publish_due` → genau ein Eintrag | ✅ mit **frischem** Video nachgestellt: Lauf 1 plant 1 ein, Lauf 2 plant 0 ein → **1 Beitrag** |
| 9 | Notaus über Umgebung, Datei und Datenbank stoppt jeweils sofort | ✅ alle drei **einzeln**; beim Datenbank-Weg zusätzlich geprüft, dass die Übernahme wirklich ablehnt (nicht nur meldet) |
| 10 | Nach 20 simulierten Beiträgen verschieben sich die Werte, Erkundung ≥ 15 % | ✅ — **und dabei ein Fehler gefunden**, siehe unten |
| 11 | Wochenbericht als HTML, Versand im Trockenlauf nur protokolliert | ✅ **1.889 Zeichen** HTML, **0 ausgehende HTTP-Aufrufe** — obwohl `RESEND_API_KEY` **und** `ADMIN_EMAIL` gesetzt sind |
| 12 | Dashboard zeigt alles und ist ohne Anmeldung nicht erreichbar | ✅ 11 Pfade: **200 mit** Anmeldung, **401 ohne** |
| 13 | `npm run lint`, `npm test`, `pytest` grün | ✅ Lint 0 · npm test **191** (185 grün, 6 ohne Datenbank übersprungen, 0 rot) · pytest **142** grün |
| 14 | `git status` ohne Zugangsdaten und ohne `data/`-Artefakte | ✅ 24 neue Pfade, kein Treffer bei der Suche nach Schlüssel-Mustern, keine Renderings |
| 15 | README erklärt Start, Stopp, Notaus, Kosten, Schlüssel, drei Betriebsarten | ✅ alle sieben Punkte belegt |
| 16 | `FORTSCHRITT.md` aktuell | ✅ dieser Abschnitt |

### Die zwei Punkte, die nicht voll erreicht sind

**Punkt 3 — nur eine Quelle liefert.** `shop_signals` schreibt echte Zeilen (6 neue in diesem
Lauf, 30 insgesamt). Die fünf externen Quellen liefern null:

| Quelle | Grund |
|---|---|
| Reddit | `REDDIT_CLIENT_ID` fehlt |
| YouTube | `YOUTUBE_API_KEY` fehlt |
| ExplodingTopics | `EXPLODING_TOPICS_API_KEY` fehlt (kostenpflichtig) |
| Google Trends | `pytrends` ist nicht installiert (bewusst auskommentiert — zieht pandas mit) |
| TikTok Creative Center | **hat die Antwortstruktur geändert** — erwartet wurde `data.list` als Liste |

Die zweite Hälfte des Prüfpunkts ist damit **belegt**: Ohne Zugangsdaten werden **null Zeilen**
geschrieben und im Protokoll steht je Quelle der Grund. Es wird nichts erfunden — genau das
war der Kernfehler des alten Stands. Zum vollen Punkt fehlt eine zweite echte Quelle;
am schnellsten geht ein **Reddit-Zugang (kostenlos)** oder `pip install pytrends`.

**Punkt 5 — kein echtes KI-Video erzeugbar.** Stil B braucht Runway (kostenpflichtiger
Schlüssel) oder `torch` + `diffusers` mit Grafikkarte. Beides fehlt, also übersprang der
Ablauf sauber mit Grund statt etwas vorzutäuschen. **Belegt ist die eigentliche Schutzregel:**
14 Tests mit echten Bilddateien zeigen, dass ein Anbieter ohne Bild-zu-Video **keine**
Produkt-Einstellung bauen darf, dass ohne echtes Foto gar nichts entsteht, dass die erste
Einstellung immer das Produkt zeigt und die Endkarte nie aus der KI kommt. Was fehlt, ist der
Beweis am echten Dienst.

### Zwei Funde im Trockenlauf

**1. Der Ausgabeordner entstand nie von selbst.** Kein Programmteil legt `data/renders` und
`data/audio` an. Beide sind gitignored, und Git kennt keine leeren Verzeichnisse — auf einem
frischen Checkout sind sie also garantiert weg. Genau so läuft **jeder GitHub-Actions-Durchgang**.
Der erste Render wäre dort mit `No such file or directory` gescheitert, und der Lauf wäre
trotzdem **grün** geblieben: Der Ablauf meldet brav `gerendert: 0, verworfen: 2` und wirft
nicht. Behoben (zwei Zeilen beim Import), Gegenprobe: ohne sie entstehen die Ordner
nachweislich nicht.

> *Zur Einordnung:* In dieser Entwicklungsumgebung scheiterte der Render **zusätzlich** daran,
> dass ein Unterprozess gar nicht in den Projektordner schreiben darf — ffmpeg meldet dabei
> denselben Text. Das ist ein anderer Fall und der Grund, warum es `MARKETING_DATA_DIR` gibt.
> Mit gesetzter Variable liefen beide Renderings sofort durch.

**2. Die Erkundungs-Untergrenze hielt nicht, was sie versprach — und der Test war selbst
Teil des Problems.** Ein Test, der eben noch grün war, fiel allein ausgeführt durch:
Erkundungsquote **0,093** statt der geforderten 0,15.

Dahinter steckten zwei Fehler, die sich gegenseitig verdeckt haben:

* **Der Bandit zog beim Erkunden den Favoriten mit.** Aus 15 % wurden dadurch nur
  `15 % × (n−1)/n` echte Abweichungen — bei 6 Ausprägungen 12,5 %, **bei 2 Ausprägungen 7,5 %**.
  Die halbe versprochene Erkundung, ausgerechnet dort, wo am wenigsten Auswahl ist.
* **Die Prüfschwelle lag mit 0,12 unter dem Erwartungswert 0,125**, also *innerhalb* der
  Streuung. Der Test meldete mal rot, mal grün — und ein solcher Test bringt einem bei, ihn
  einfach nochmal laufen zu lassen. Das ist schlimmer als kein Test.

Behoben: Beim Erkunden wird jetzt aus allen Ausprägungen **außer dem Favoriten** gezogen —
damit gilt die konfigurierte Zahl wörtlich, unabhängig von der Anzahl der Optionen. Der Test
misst mit 2.000 Ziehungen gegen eine Schwelle knapp 3 Streuungen entfernt und lief dreimal
hintereinander stabil.

**Gegenprobe:** alte Fassung wieder eingesetzt → **0,121** bei sechs Optionen und **0,072**
bei zweien. Beides trifft die vorhergesagten Werte (0,125 und 0,075) und beide Tests wurden
rot. Dazu ein neuer Test, der ausdrücklich den ungünstigsten Fall prüft — zwei Optionen.

---

## Etappe 14 — Fremdes TikTok-Material als Recherche

`tiktok-video-sync.js` (Projektwurzel), `bot/tiktok-quellen.json`,
`test/tiktok-video-sync.test.js` (29 Tests), `TIKTOK-VIDEO-SYNC.md`, vier npm-Skripte.

**Nicht zu verwechseln mit dem Rest dieser Runde.** Der Automat rendert **eigene** Videos.
Dieses Programm lädt **fremde** herunter — zum Anschauen, um zu sehen, was in einer
Produktkategorie funktioniert. Es geht nicht in den Shop, nicht in `products.json` und in
keine Veröffentlichung.

| | eigene Videos | dieses Programm |
|---|---|---|
| Herkunft | selbst gerendert | fremde Creator |
| Ablage | `Marketing/videos/` (versioniert) | `Marketing/data/tiktok-quellen/` (**gitignored**) |
| Rechte | eigene | **fremde — ungeprüft** |
| Aufräumen | `cleanup_assets` | von Hand |

### Der Fund, der die ganze Bauform bestimmt hat

**yt-dlp kann bei TikTok nicht suchen.** Das ist keine Vermutung, sondern aus
`--list-extractors` der installierten Version 2026.07.04 abgelesen:

```
TikTok, tiktok:collection, tiktok:effect (CURRENTLY BROKEN), tiktok:live,
tiktok:sound (CURRENTLY BROKEN), tiktok:tag (CURRENTLY BROKEN), tiktok:user, vm.tiktok
```

| Quelle | Stand |
|---|---|
| feste Video-URLs, Creator-Profile (`tiktok:user`) | ✅ nutzbar |
| Hashtag-Seiten (`tiktok:tag`) | ❌ vorhanden, aber **upstream als kaputt markiert** |
| Stichwortsuche | ❌ **kein Suchextractor in der Liste** |

Deshalb ist das Finden **aus dem Programm herausgezogen**: Gesucht wird mit einer
gewöhnlichen Websuche (TikTok-Videoseiten sind indexiert), und was dabei herauskommt, ist
eine Liste von Adressen. Die prüft und sortiert `--fund`. Kein Scraper, keine Anmeldung,
keine umgangene Sperre.

### So läuft es Schritt für Schritt

**Schritt 0 — einmalig: yt-dlp installieren.** Externes Programm, kein npm-Paket, genau wie
ffmpeg.

```bash
py -m pip install --upgrade yt-dlp
```

Die `yt-dlp.exe` landet in einem Ordner, der **nicht im PATH** liegt. Kein Problem: Der Bot
probiert `yt-dlp`, `yt-dlp.exe`, `py -m yt_dlp` und `python -m yt_dlp` der Reihe nach durch —
dieselbe Bauform wie die Python-Suche in `run-local.js`. Fester Pfad über `YTDLP_PATH`.

**Schritt 1 — nachsehen, was geht.** Läuft auch **ohne** installiertes yt-dlp durch und sagt
dann, was fehlt.

```bash
npm run tiktok:status
```

**Schritt 2 — Adressen finden.** Im Browser oder per Suchmaschine nach Videos zu einem
Produkt suchen und die URLs sammeln. Ergiebiger als Einzelvideos sind **Creator-Profile**:
`tiktok:user` funktioniert, und ein Profil liefert auf einen Schlag viele Kandidaten.

**Schritt 3 — Adressen prüfen und einsortieren.** Holt zu jeder URL die echten Metadaten
(kein Download), misst sie gegen **alle 40 Produkte** und zeigt, welches am besten passt.

```bash
npm run tiktok:finden -- "https://www.tiktok.com/@handle/video/123"
```

Standard ist **Vorschau**. Erst `--schreiben` trägt die Treffer in `tiktok-quellen.json` ein:

```bash
npm run tiktok:finden -- --schreiben "https://www.tiktok.com/@handle/video/123"
```

*Eine URL, die niemand aufgerufen hat, ist eine Behauptung* — deshalb wird jede Adresse
einmal wirklich abgefragt, bevor sie in die Konfiguration wandert.

**Schritt 4 — Trockenlauf.** Sucht, bewertet, schreibt `pruefliste.json`. Lädt **nichts**.

```bash
npm run tiktok:probe
```

**Schritt 5 — laden.** Erst wenn die Prüfliste plausibel aussieht.

```bash
npm run tiktok:laden -- --max 2
```

**Schritt 6 — Rechte klären.** Jeder Eintrag in `index.json` startet auf
`rechte_geprueft: false`. Das ist die einzige Stelle, an der steht, wem ein Video gehört.

### Was du tun musst

1. **yt-dlp installieren** (Schritt 0) — einmalig.
2. **URLs beschaffen** — das kann das Programm nicht, siehe Fund oben. Ohne Einträge in
   `tiktok-quellen.json` meldet jeder Lauf brav „keine nutzbare Quelle" und lädt nichts.
3. **Prüfliste durchsehen**, bevor du lädst. Passen die Treffer nicht, gehören die
   `stichworte` je Produkt geschärft — **nicht** die Schwelle gesenkt.
4. **Rechte je Video klären**, bevor irgendetwas davon weiterverwendet wird.

### Am echten System nachgemessen

Zwei echte Videos geladen, gegen das laufende TikTok:

```
✅ 10 Elektrischer Wasserspender für Schreibtisch ← 1,75 MB (Trefferwert 0.667)
✅ 28 Mini Muskel Massage Pistole                 ← 2,32 MB (Trefferwert 0.5)
— geladen: 2 · Prueflíste: 0 · uebersprungen: 17 · yt-dlp-Aufrufe: 5
```

Zweiter Lauf mit identischem Aufruf: **0 Downloads**, beide über den Index übersprungen,
Dateien unangetastet. Jeder Eintrag trägt Produkt-ID, Creator, Quell-URL, Zeitstempel,
Größe, SHA-256, Trefferwert und `rechte_geprueft: false`.

### 🔴 Drei echte Fehler, alle erst im Live-Betrieb sichtbar

1. **Ein kaputter Extractor galt als vorhandene Fähigkeit.** Die erste Fassung prüfte nur, ob
   „tag" im Extractor-Namen vorkommt, und meldete „Hashtag-Seiten: ja" für `tiktok:tag` —
   den yt-dlp selbst als `CURRENTLY BROKEN` ausweist. Der Marker wird jetzt ausgewertet.
   Folge sonst: statt einer klaren Meldung eine Fehlermeldung je Quelle.
2. **„Smart Beamer" schnappte sich eine Küchenwaage.** Trefferwert 0.5 — im Videotext stand
   „SmartKitchen", und „smart" ist die Hälfte von zwei Begriffen. Bei kurzen Produktnamen
   reißt ein einzelnes Modewort die Schwelle. Seitdem müssen **zwei verschiedene** Begriffe
   treffen; nur bei einem Produkt mit bloß einem Begriff zählt dieser eine.
3. **Eine Regionssperre riss den ganzen Lauf um.** TikTok meldete „blocked from accessing
   **this post**" für ein einzelnes Video — der Bot warf alles hin. Das ist keine
   Ratenbegrenzung: Die anderen Videos derselben Sitzung liefen einwandfrei. Jetzt getrennt:
   einzelnes gesperrtes Video → überspringen und vermerken; CAPTCHA/429/Anmeldezwang →
   sofort Schluss. Weiterzumachen ist hier keine Umgehung — das gesperrte Video wird gerade
   nicht geholt und auch nicht erneut versucht.

### Gegenproben

| Prüfung | Gegenprobe, die belegt, dass der Test rot gemeldet hätte |
|---|---|
| Trockenlauf lädt nichts | derselbe Fall mit `--laden` lädt sehr wohl |
| unter der Schwelle wird nicht geladen | mit Schwelle 0 wird geladen (Kandidat, der **nur** an der Schwelle scheitert) |
| indizierte URL wird übersprungen | bei leerem Index lädt derselbe zweite Lauf |
| `Marketing/STOP` hält an | ohne die Datei läuft genau derselbe Aufruf durch |
| kaputter Extractor zählt nicht | dieselbe Liste **ohne** den Marker → Fähigkeit ist da |
| ein Modewort reicht nicht | genau dieser Wert (0.5) lag über der Standardschwelle |
| einzelne Sperre stoppt nicht | ein 429 stoppt weiterhin sofort |

Fehler 2 hat beim Beheben eine **bestehende Gegenprobe zu Recht rot gemacht**: Sie lud bei
Schwelle 0 ein Katzenvideo, was die neue Regel verhindert. Sie wurde auf einen Kandidaten
umgebaut, der ausschließlich an der Schwelle scheitert.

### Zwei Fallen beim Ablegen

**Der Ordner `Marketing/videos/` ist versioniert und das Repo öffentlich.** Wer fremdes
Material dorthin kopiert, hat es beim nächsten `git add .` auf GitHub. Zwei Videos liegen
dort inzwischen bewusst (zum Vergleich neben den eigenen Renderings) und sind über
`.gitignore` abgesichert.

**Umbenennen hebelt diese Absicherung aus.** Das Muster in `.gitignore` unterscheidet fremd
von eigen **am Dateinamen**:

```
fremd  10_7410474104903453984.mp4              → nach dem Unterstrich: Ziffern
eigen  01_nordic-crystal-lamp_20s_stil-a.mp4   → nach dem Unterstrich: Buchstaben
```

Werden die Fremdvideos auf das Render-Schema umgetauft
(`07_elektrischer-wasserspender_14s_stil-b.mp4`), greift das Muster nicht mehr — sie standen
prompt als neu im `git status`. Solche Dateien müssen **einzeln** in `.gitignore` stehen.
Wer weiteres Fremdmaterial umbenennt, muss eine Zeile ergänzen. Und: Am Dateinamen ist die
Herkunft dann nicht mehr zu sehen — `Marketing/data/tiktok-quellen/index.json` ist die
einzige Stelle, die sie noch festhält.

---

## ⛔ Offen — braucht dich

1. ~~**ffmpeg**~~ — ✅ **erledigt am 14.08.**: FFmpeg 9.0 per winget installiert, mit einem
   echten Testrender geprüft (1080×1920, H.264 + AAC, `ffprobe` liest es sauber).
   *Hinweis:* Der PATH-Eintrag greift erst in **neu gestarteten** Shells. Die Video-Etappen
   suchen ffmpeg deshalb erst im PATH und dann am bekannten Installationsort — das ist
   ohnehin robuster, weil es auf dem PC, in Actions und auf einem Server jeweils woanders liegt.
2. **Einkaufspreise für die Margenprüfung** — stehen nur namensbasiert in
   `excel/Maios Produkte.csv`, nicht per Produkt-ID. Solange sie fehlen, gilt
   `matching.unbekannte_marge = "erlauben_mit_hinweis"`: es wird beworben, aber im
   Nachweis-Protokoll als **ungeprüft** vermerkt. Auf `"sperren"` stellen, wenn dir das zu
   locker ist — oder EK/Versand je Produkt-ID in `marketing.config.json` eintragen, dann
   wird echt gerechnet.

---

## Nächster Schritt

Alle 13 Etappen sind gebaut und geprüft. Was jetzt ansteht, ist **keine Bauarbeit mehr,
sondern eine Entscheidung von dir**:

1. **Committen und ausrollen?** Aus Runde 10 ist **nichts committet und nichts gepusht** —
   der Shop läuft unverändert weiter. 24 neue Pfade warten (siehe `git status`).
2. **Zweite Trendquelle freischalten** (Punkt 3 der Abnahme). Am schnellsten: ein
   kostenloser Reddit-Zugang. Ohne sie läuft der Automat nur auf den eigenen Shop-Daten —
   das funktioniert, nutzt aber nur die Hälfte der Idee.
3. **Erst danach** den Trockenlauf abschalten. Vorher die Warteschlange im Dashboard
   durchsehen und **mindestens ein fertiges Video ganz anschauen** — das Bildmaterial ist
   der schwächste Punkt der Kette (siehe unten).

**Wichtig für den nächsten Durchgang:** `MARKETING_DATA_DIR` setzen, wenn der Prozess nicht
in den Projektordner schreiben darf (in dieser Umgebung der Fall). Beispiel:
`MARKETING_DATA_DIR=<temp>/mkt-data`.

---

## Benötigte Zugangsdaten (für später, nichts davon ist heute nötig)

Keiner dieser Schlüssel wird zum Starten gebraucht — fehlt einer, wird der Schritt
protokolliert und übersprungen.

| Zweck | Variablen |
|---|---|
| Trends | `REDDIT_CLIENT_ID`/`_SECRET`, `YOUTUBE_API_KEY`, `EXPLODING_TOPICS_API_KEY` |
| Briefing (LLM) | `ANTHROPIC_API_KEY` **oder** `OPENAI_API_KEY` |
| Stimme | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` |
| KI-Video | `RUNWAY_API_KEY` (o. Kling/Luma/Veo) |
| Veröffentlichen | `TIKTOK_CLIENT_KEY`/`_SECRET`, `IG_*`, `YT_*` |
| Bereits vorhanden | `DATABASE_URL`, `RESEND_API_KEY`, `ADMIN_EMAIL` |
