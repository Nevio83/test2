# RUNDE 10 — Vollautomatisches, selbstlernendes Marketing-System (Maios)

Denke sorgfältig, bevor du anfängst. Diese Runde baut **ausschließlich** das Marketing-System. Kein Shop-Feature, kein Design, kein Refactoring außerhalb des unten definierten Bereichs.

---

## 0. Pflichtlektüre vor der ersten Änderung

Lies diese Dateien **vollständig**, bevor du irgendetwas schreibst. Rate nichts:

- `CLAUDE.md` (§0 Stand, §3 Landkarte, §5 Datenbank, §6 ENV, §7 Deployment, §8 Konventionen)
- `CLAUDE-CODE.md` (§1 Git/Windows-Regeln — die gelten hier vollständig)
- `job-scheduler.js` — **das ist das Vorbild für den 24/7-Betrieb.** Fälligkeit statt Intervall, letzter Lauf in der DB, `claimJobRun` als eine einzige SQL-Anweisung. Denselben Mechanismus baust du für Marketing nach.
- `database.js` — Schema-Stil (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, kein Migrationssystem)
- `Marketing/pipelines/*.py` — alle sieben Dateien, komplett
- `Marketing/.env.example`, `.env.example` (Wurzel)
- `.github/workflows/pruefung.yml` und `keep-alive.yml`
- `render.yaml`
- `test/lauf.js` und zwei Beispieltests (`job-scheduler.test.js`, `cj-stock-sync.test.js`) — für den Teststil

Nutze einen **Subagenten** für die Bestandsaufnahme der sieben Python-Dateien und für die Recherche der Plattform-APIs (Punkt 9), damit die Zwischenergebnisse nicht deinen Hauptkontext füllen. Der Subagent liefert eine Zusammenfassung, keine Volltexte.

---

## 1. Ziel

Ein Marketing-System, das **ohne menschliches Zutun rund um die Uhr** läuft: Es zieht laufend aktuelle Trends, verknüpft sie mit den Produkten aus `products.json`, schreibt Kreativ-Briefings, produziert Videos in **zwei Stilen**, veröffentlicht sie zeitgesteuert, misst den Erfolg bis hinunter zur Bestellung im Shop und **verbessert sich mit jedem Durchlauf selbst**, indem es lernt, welche Kombination aus Trend, Produkt, Hook, Stil, Stimme, Länge und Uhrzeit tatsächlich Umsatz bringt.

Warum das so gebaut werden muss: Der Shop läuft auf Render-Free, der Dienst schläft und startet ständig neu. Ein Marketing-Loop, der auf `setInterval` steht, läuft praktisch nie — genau dieser Fehler ist im Projekt am 02.08. schon einmal nachgewiesen worden (siehe Kommentarkopf in `job-scheduler.js`). Deshalb ist **jeder Zustand persistent** und jede Fälligkeit wird aus der Datenbank berechnet, nie aus der Prozesslaufzeit.

---

## 2. Ausgangslage (so ist es JETZT — nicht daran glauben, sondern prüfen)

`Marketing/` existiert, ist aber fast vollständig Attrappe:

- `fetch_trends.py` — TikTok und ExplodingTopics geben **fest verdrahtete Beispielzeilen** zurück; nur Google Trends versucht einen echten Aufruf über `pytrends` und fällt bei jedem Fehler still auf eine Beispielzeile zurück. Speichert in **SQLite** (`data/trends.db`) — nicht in Postgres.
- `product_matcher.py` — Zuordnung über reine Token-Überschneidung; `PerformanceMemory` liegt als JSON-Datei und wird **nur von Hand** über CLI-Flags gefüttert. Es gibt also heute keinen geschlossenen Lernkreis.
- `creative_generator.py` — setzt Briefings aus `story`-Feldern zusammen, **kein LLM**, keine Varianten, keine Compliance-Prüfung.
- `video_builder.py` — erzeugt Standbilder mit Default-Font über Pillow/imageio; Runway ist halb implementiert, Pika legt eine **leere Datei** an, `synthesize_voiceover` macht bei gesetztem ElevenLabs-Key nur `touch()`. Hintergrundbilder kommen von `source.unsplash.com` (Endpunkt ist tot und lizenzrechtlich unsauber). In `data/renders/` liegen entsprechend **0-Byte-MP4s**.
- `tiktok_uploader.py` — Selenium füllt Datei und Caption aus und **hört dann auf**; der Mensch muss „Posten" klicken. Also nicht automatisch.
- `analytics_collector.py` — liefert **erfundene Zahlen** (1234 Views, 210 Likes) in eine CSV.
- `run_pipeline.py` — vier `subprocess`-Aufrufe mit `py`, ohne Fehlerbehandlung, ohne Zustand, ohne Wiederholung.
- `Marketing/products.json` ist eine **zweite Kopie** der Wurzel-`products.json` und driftet. Genau diese Klasse Fehler (zweite abweichende Liste) hat im Projekt schon einmal echtes Geld gekostet — siehe `voucher-validator.test.js` in `CLAUDE.md` §2.

Vorhanden und **nutzbar**: Neon-Postgres über `DATABASE_URL`, `job_runs`-Muster mit atomarem Claim, Resend für Mails, GitHub Actions (gratis), `chromedriver-win64` lokal, Admin-Bereich `a29715347575/` mit Basic Auth, Shop-Telemetrie (`page_views`, `search_events`, `orders`, `order_items`).

---

## 3. Architektur, die du bauen sollst

### 3.1 Betriebsmodell (drei Ebenen, alle drei müssen funktionieren)

Der Orchestrator ist **eine** Implementierung, die in drei Umgebungen laufen kann. Welche aktiv ist, entscheidet `MARKETING_RUNNER` (`actions` | `local` | `worker`):

1. **`actions` — GitHub Actions, Standard, kostenlos.** Neuer Workflow `.github/workflows/marketing.yml`, `schedule: cron` alle 30 Minuten plus `workflow_dispatch`. Jeder Lauf ruft `python -m pipelines.orchestrator.run_loop --once --max-minutes 25` auf. Übernimmt: Trends, Shop-Signale, Matching, Briefings, Analytics, Lernen, Reports — und Rendering **nur** für Stil A (ffmpeg ist im Runner vorhanden).
2. **`local` — Windows-PC, für alles, was einen Browser oder GPU braucht.** Ein Node-Wrapper `Marketing/run-local.js` (start über `npm run marketing:local`), der dieselbe Job-Tabelle abfragt und nur Jobs mit `requires_local = true` übernimmt (Selenium-Upload, lokale Diffusion-Renders). Läuft als Dauerprozess mit 5-Minuten-Takt, exakt wie `job-scheduler.js`.
3. **`worker` — Render Background Worker,** vorbereitet in `render.yaml` als **auskommentierter** Block plus Anleitung in `Marketing/README.md`. Nicht aktivieren, nicht deployen.

**Verpflichtend für alle drei:** Der Zustand liegt ausschließlich in Postgres. Zwei parallel laufende Runner dürfen denselben Job **nie doppelt** ausführen — das erzwingst du mit einer einzigen SQL-Anweisung nach dem Vorbild `dbOperations.claimJobRun` (`UPDATE … WHERE naechster_lauf <= now() RETURNING …`), nicht mit „erst lesen, dann schreiben".

### 3.2 Datenhaltung

**SQLite fliegt raus.** Alles nach Postgres, gleiche `DATABASE_URL` wie der Shop, Tabellen mit Präfix `mkt_`. Bestehende Shop-Tabellen werden **nicht** verändert.

Lege in `database.js` **nur zusätzliche** `CREATE TABLE IF NOT EXISTS`-Einträge an, im vorhandenen Stil, in der vorhandenen `SCHEMA`-Liste, und schreibe die Python-Seite so, dass sie dieselben Tabellen benutzt (kein zweites Schema-Management in Python — Python legt nichts an, es setzt voraus).

Tabellen:

| Tabelle | Inhalt |
|---|---|
| `mkt_jobs` | Job-Name, Abstand in Sekunden, letzter Lauf, nächster Lauf, Fehlerzähler, `requires_local`, `enabled` |
| `mkt_job_events` | Lauf-Protokoll: Start, Ende, Ergebnis, Fehlertext, Dauer |
| `mkt_trends` | Quelle, Keyword, normalisiertes Keyword, Sprache, Volumen, Wachstum, Sättigung, Sentiment, Rohdaten (JSONB), erfasst_am |
| `mkt_trend_scores` | Trend-ID, Score, Score-Bestandteile (JSONB), gültig_bis |
| `mkt_matches` | Trend-ID, Produkt-ID, Passungs-Score, Begründung, Marge zum Zeitpunkt |
| `mkt_briefs` | Match-ID, Hook-Varianten, Skript, Overlays, CTA, Hashtags, Stil (A/B), Kreativ-Merkmale (JSONB), Compliance-Status |
| `mkt_assets` | Pfad, Typ, Quelle, **Lizenz**, Lizenz-Nachweis-URL, Produkt-ID, Hash |
| `mkt_videos` | Brief-ID, Stil, Pfad, Dauer, Auflösung, Loudness, Renderdauer, Kosten, Prüfergebnis |
| `mkt_posts` | Video-ID, Plattform, externe Post-ID, Caption, Hashtags, geplant_für, gepostet_am, Slot, Idempotenz-Schlüssel |
| `mkt_metrics` | Post-ID, Zeitpunkt-Fenster (1h/6h/24h/72h/7d), Views, 3s-Retention, Watchtime, Likes, Shares, Saves, Kommentare, Profilklicks, Linkklicks |
| `mkt_attribution` | Post-ID, UTM-Kampagne, Shop-Sessions, Warenkorb-Ereignisse, Bestellungen, Umsatz, Deckungsbeitrag |
| `mkt_arms` | Kreativ-Dimension, Ausprägung, Alpha, Beta, Versuche, Erfolge, letzte Aktualisierung |
| `mkt_rewards` | Post-ID, vorläufiger Reward, finaler Reward, Bestandteile (JSONB), berechnet_am |
| `mkt_experiments` | Hypothese, Arme, Mindest-Stichprobe, Status, Ergebnis |
| `mkt_cost_ledger` | Anbieter, Endpunkt, Einheiten, Kosten in Cent, Job, Zeitpunkt |
| `mkt_audit_log` | Jede automatische Entscheidung: was, warum, welche Alternativen, welcher Score |

`mkt_audit_log` ist nicht optional. Ein System, das ohne Aufsicht postet, muss im Nachhinein erklärbar sein.

### 3.3 Verzeichnisstruktur (neu anzulegen)

    Marketing/
      README.md                        Betriebshandbuch: Start, Stopp, Notaus, Kosten, Fehlerbilder
      FORTSCHRITT.md                   Arbeitsstand für die nächste Sitzung (s. §11)
      requirements.txt                 exakt gepinnte Versionen
      run-local.js                     lokaler Dauerläufer (Node), nutzt dieselbe mkt_jobs-Tabelle
      config/
        marketing.config.json          Zeitpläne, Budgets, Limits, Gewichte, Kill-Switch
        brand_voice.md                 Markenstimme, Tabuwörter, Tonalität, Beispielsätze
        compliance_rules.json          Verbotslisten, Pflichtangaben je Plattform
      pipelines/
        env_loader.py                  vorhanden, beibehalten
        db.py                          Postgres-Zugriff (psycopg), Verbindungspool, Transaktionen
        products.py                    liest AUSSCHLIESSLICH ../../products.json (Wurzel)
        trends/
          base.py                      Schnittstelle TrendSource: fetch() -> list[TrendRow]
          google_trends.py
          tiktok_creative_center.py
          reddit.py
          youtube_trending.py
          exploding_topics.py
          shop_signals.py              EIGENE Daten aus Postgres (s. 4.2)
          normalize.py                 Dedupe, Sprache, Stemming, Velocity, Sättigung, Decay
        matcher.py                     Trend -> Produkt
        creative/
          llm_client.py                Adapter + Kostenzähler + Budget-Sperre
          brief_generator.py
          compliance.py                Sperrt Veröffentlichung, warnt nicht nur
        video/
          common.py                    ffmpeg-Hüllen, Untertitel, Safe Areas, Loudness
          assets.py                    Asset-Katalog inkl. Lizenzpflicht
          style_a_realvoice.py         Stil 1
          style_b_aigen.py             Stil 2
          quality_gate.py              Prüft jedes Rendering, bevor es in die Warteschlange darf
          tts/
            base.py
            human_takes.py             echte, vorab aufgenommene Stimme
            elevenlabs.py              Voice-Clone der echten Stimme
            piper_local.py             kostenloser Rückfall
        publish/
          base.py
          tiktok.py
          instagram.py
          youtube.py
          slots.py                     gelernte Posting-Zeiten
        analytics/
          collectors.py                echte Plattform-Insights
          attribution.py               UTM -> Shop-Bestellung
          metrics.py
        learning/
          features.py                  Kreativ-Merkmale als diskrete Dimensionen
          reward.py
          bandit.py                    Thompson Sampling
          policy.py                    entscheidet, was als Nächstes produziert wird
          experiments.py
          report.py                    Wochenbericht
        orchestrator/
          jobs.py                      Job-Katalog mit Abständen
          state.py                     Claim/Lease/Heartbeat gegen mkt_jobs
          guardrails.py                Budget, Rate-Limits, Notaus
          run_loop.py                  Einstiegspunkt
      tests/                           pytest
      data/
        voice/takes/                   deine echten Sprachaufnahmen (gitignored)
        assets/                        Clips, Bilder, Musik (gitignored)
        renders/  videos/  audio/      (gitignored)

**Alle `data/`-Unterordner und `Marketing/.env` gehören in `.gitignore`.** Das Repo ist öffentlich. Prüfe vor jedem `git add`, was reinkommt — nie `git add -A`.

---

## 4. Trends — echte Daten statt Attrappen

### 4.1 Quellen

Implementiere jede Quelle hinter `TrendSource` mit einheitlicher Rückgabe. **Jede Quelle muss ohne Zugangsdaten sauber leer zurückkommen** (`return []` plus Protokollzeile), nicht abstürzen und **nie** eine erfundene Zeile liefern. Der heutige Rückfall auf Beispieldaten ist ein Fehler: Er sieht wie Betrieb aus, obwohl nichts läuft — genau das Muster, das dieses Projekt schon mehrfach getroffen hat.

- **Google Trends** (`pytrends`): `trending_searches(pn='germany')` + `related_queries` zu den Produkt-Kategorien + `interest_over_time` für Velocity.
- **TikTok Creative Center**: öffentlich abrufbare Hashtag-/Sound-/Creative-Ranglisten für Region DE. Wenn nur über HTML erreichbar: sauber parsen, Änderungen abfangen, bei Strukturbruch leer zurückgeben und Alarm auslösen.
- **Reddit** (`REDDIT_CLIENT_ID`/`SECRET`): aufstrebende Beiträge in themenrelevanten Subreddits, Wachstum je Stunde.
- **YouTube**: `videos.list(chart=mostPopular, regionCode=DE)` plus Titel-/Tag-Tokenisierung.
- **ExplodingTopics**: nur wenn `EXPLODING_TOPICS_API_KEY` gesetzt ist.

### 4.2 Die wichtigste Quelle: eure eigenen Shop-Daten

Das ist der Vorteil, den kein Trend-Tool hat. `shop_signals.py` liest aus Postgres:

- `search_events` — was Besucher suchen. **Null-Treffer-Suchen sind Nachfrage ohne Angebot** und bekommen den höchsten Gewichtungsfaktor.
- `page_views` — welche Produktseiten gerade Zulauf haben, inklusive Verweildauer.
- `orders` + `order_items` — was tatsächlich gekauft wird, mit Deckungsbeitrag.
- Warenkorbabbrüche je Produkt.

Diese Signale fließen als eigene Quelle `shop` mit in `mkt_trends` ein.

### 4.3 Trend-Score

Berechne in `normalize.py` je Trend einen Score aus benannten Bestandteilen und **speichere die Bestandteile mit** (`mkt_trend_scores.bestandteile`), damit später nachvollziehbar ist, warum ein Trend gewählt wurde:

    score = w1*velocity + w2*volumen_norm + w3*passung_sortiment
          + w4*shop_signal + w5*saisonalitaet
          - w6*saettigung - w7*alter_in_stunden

Gewichte `w1..w7` stehen in `config/marketing.config.json` und werden vom Lernmodul (§7) angepasst — **nicht im Code hartkodieren**. Startwerte plausibel wählen und im Kommentar begründen.

Regeln: Sprache DE bevorzugt, Dubletten über normalisiertes Keyword zusammenführen, Trends älter als 72 h fallen raus, gesperrte Themen (`compliance_rules.json`) fliegen sofort raus.

---

## 5. Matching und Briefing

`matcher.py`: Token-Überschneidung bleibt als Basis, kommt aber zusätzlich zu

- Kategorie- und `tags`-Abgleich aus der **Wurzel**-`products.json`,
- Marge-Filter: Produkte unter der Mindestmarge aus der Konfiguration werden nicht beworben (die Preisformel steht in `CLAUDE-CODE.md` §2 — VK ≥ (EK + Versand) × 1,20),
- Verfügbarkeitsprüfung: ausverkaufte Produkte werden nicht beworben (`cj-stock-sync.js`-Daten nutzen),
- Erschöpfungsschutz: dasselbe Produkt nicht öfter als `max_posts_pro_produkt_pro_woche` bewerben,
- dem gelernten Boost aus `mkt_arms`.

`brief_generator.py` erzeugt pro Match ein Briefing mit:

- **3–5 Hook-Varianten** (unterschiedliche Hook-Typen: Frage, Behauptung, Vorher-Nachher, Zahl, POV, Fehler-Aufdeckung) — der Hook-Typ ist eine gelernte Dimension
- Skript, sekundengenau auf 15–35 s getaktet, Nutzen vor Merkmal
- Overlay-Texte inkl. Zeitmarken
- CTA-Variante
- Hashtag-Set (Mischung: 1 breit, 2 mittel, 2 nischig)
- Stilentscheidung A oder B — **kommt vom Lernmodul, nicht vom Zufall**
- vollständigem Merkmalsvektor für das Lernen

`llm_client.py` ist ein Adapter mit einheitlicher Schnittstelle für OpenAI / Anthropic / lokales Modell. Jeder Aufruf schreibt eine Zeile nach `mkt_cost_ledger`. Ist das Tagesbudget erschöpft, liefert der Adapter regelbasierte Briefings aus Vorlagen statt zu blockieren.

`compliance.py` prüft **vor** dem Rendern und **erneut vor** dem Posten und setzt `mkt_briefs.compliance_status`. Bei `blocked` wird nicht gerendert und nicht gepostet:

- keine Gesundheits-, Heil- oder Wirkversprechen
- keine fremden Marken, Logos, Prominenten
- Preisangaben nur wenn korrekt inkl. Versandhinweis; Kleinunternehmer §19 UStG beachten (kein USt-Ausweis)
- Werbekennzeichnung vorhanden (eigener Shop = Werbung)
- KI-Kennzeichnung bei Stil B verpflichtend gesetzt
- Musik nur aus lizenzfreier Bibliothek oder Plattform-eigenem Sound-Katalog; Lizenz in `mkt_assets` belegt

---

## 6. Videoproduktion — zwei Stile, beide vollautomatisch

Beide Stile liefern: **1080×1920, 9:16, H.264, ≤ 60 s, Audio −14 LUFS, eingebrannte Untertitel, Endkarte mit echtem Produktbild + Shop-URL.** Beides läuft durch `quality_gate.py`; besteht ein Rendering die Prüfung nicht, wird es verworfen und einmal neu versucht, danach als Fehler protokolliert. **Ein 0-Byte-MP4 darf nie in die Veröffentlichungs-Warteschlange gelangen** — genau das passiert heute.

### Stil A — Zusammengeschnittene Clips mit echter Stimme (`style_a_realvoice.py`)

Bildquellen, in dieser Reihenfolge:

1. eigene Produktvideos aus `produkt videos/`
2. eigene Produktbilder aus `produkt bilder/` (Ken-Burns-Fahrt, kein Standbild)
3. CJ-Produktmedien über die vorhandene `cj-dropshipping-api.js`
4. lizenzfreier Stock (Pexels/Pixabay-API, CC0) — **nur mit Lizenz-Eintrag** in `mkt_assets`

`source.unsplash.com` wird **entfernt** — der Endpunkt ist tot und die Lizenzlage unklar.

Schnitt:

- Hook in den ersten **1,5 Sekunden**, Schnittwechsel alle 1,5–3 s (Musterunterbrechung)
- Schnitte auf die Sprechpausen, nicht auf ein starres Raster
- Zoom-/Pan-Bewegung auf jedem Clip, harte Schnitte statt Überblendungen (außer eine Überblendung am Ende)
- Musikbett automatisch unter die Stimme geduckt (ffmpeg `sidechaincompress`)

Echte Stimme, drei Wege über den TTS-Adapter, in dieser Priorität:

1. **`human_takes.py`** — vorab aufgenommene Sätze aus `data/voice/takes/`. Beim Start werden alle Takes einmalig mit Whisper transkribiert und mit Wort-Zeitmarken indexiert. Der Generator setzt das Skript aus vorhandenen Sätzen und Satzteilen zusammen; was fehlt, meldet er in einer **Aufnahmeliste** `data/voice/AUFNAHMELISTE.md` (Sätze, die du einmal einsprechen solltest). Das ist der Weg zu echter Stimme ohne laufende Kosten.
2. **`elevenlabs.py`** — Voice-Clone deiner echten Stimme, wenn `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` gesetzt sind. **Echter HTTP-Aufruf mit Streaming der MP3-Antwort** — kein `touch()` mehr. Kosten je Aufruf ins `mkt_cost_ledger`.
3. **`piper_local.py`** — kostenloser lokaler Rückfall, damit die Kette nie stehen bleibt.

Untertitel wortsynchron aus den Whisper-Zeitmarken, maximal 3 Wörter pro Zeile, im unteren Drittel innerhalb der Safe Area.

### Stil B — KI-generierte Videos (`style_b_aigen.py`)

- Shot-Liste aus dem Briefing: 3–5 Einstellungen à 3–5 s, jede mit eigenem Bildprompt, Kamerabewegung und Stimmung.
- **Produkttreue ist Pflicht:** Verwende **Bild-zu-Video** mit einem echten Produktbild als erstem Frame. Reines Text-zu-Video erfindet das Produkt und darf höchstens für Stimmungs-Einstellungen ohne Produkt benutzt werden. Diese Regel im Code erzwingen, nicht nur im Kommentar.
- Anbieter hinter einem Adapter: Runway, Kling, Luma, Veo — plus lokaler Pfad (SDXL/SVD/AnimateDiff über `diffusers`), der bei `MARKETING_RENDER_BACKEND=local` greift. Der bestehende Runway-Code wird übernommen und um echtes Polling, Zeitlimit und Fehlerbehandlung ergänzt. Der **Pika-Stub, der eine leere Datei anlegt, fliegt raus** — entweder echte Anbindung oder gar nicht.
- Bildstil konstant halten: fester Seed je Kampagne, Farbpalette und Stilbeschreibung aus `brand_voice.md`.
- Vertonung identisch zu Stil A (derselbe TTS-Adapter).
- **Endkarte immer mit echtem Produktfoto**, nicht KI-generiert.
- Plattform-Kennzeichnung „KI-generierter Inhalt" wird beim Posten gesetzt.

---

## 7. Selbstlernende KI — der Kern dieser Runde

Kein Blackbox-Training, sondern ein **kontextueller Bandit mit Thompson Sampling** über diskrete Kreativ-Dimensionen. Nachvollziehbar, funktioniert ab wenigen Dutzend Datenpunkten, lässt sich testen.

### 7.1 Dimensionen (`features.py`)

Jedes Video ist ein Merkmalsvektor: Videostil (A/B), Hook-Typ, Videolänge (15/22/30/45 s), Stimme (Takes/Clone/lokal), Sprechtempo, Musik-Kategorie, Untertitel-Stil, CTA-Typ, Hashtag-Set, Produktkategorie, Trendquelle, Posting-Slot (Wochentag × Stunde), Miniaturbild-Typ.

Kontext: Produktkategorie und Trendquelle. Der Bandit lernt also nicht „Hook-Typ 3 ist gut", sondern „Hook-Typ 3 ist gut **für Küchenprodukte aus Google-Trends**".

### 7.2 Belohnung (`reward.py`)

    reward = 0.15*hook_rate        (3s-Retention)
           + 0.15*watch_ratio      (Watchtime / Videolänge)
           + 0.10*engagement       (Likes+Shares+Saves+Kommentare, je Views)
           + 0.20*ctr_link         (Linkklicks / Views)
           + 0.40*deckungsbeitrag_norm

Geld schlägt Eitelkeitszahlen — deshalb 0,40 auf den Deckungsbeitrag. Gewichte in der Konfiguration, nicht im Code.

**Verzögerte Belohnung:** Metriken werden 1 h, 6 h, 24 h, 72 h und 7 d nach dem Post eingesammelt. Vorläufiger Reward ab 6 h, **final erst nach 72 h**. Vorher wird kein Arm abgeschaltet.

**Ausreißerschutz:** Virale Einzeltreffer werden auf das 95. Perzentil gewinsorisiert, sonst kippt ein Zufallstreffer die gesamte Politik.

### 7.3 Politik (`policy.py`, `bandit.py`)

- Beta-Posterior je (Dimension, Ausprägung, Kontext) in `mkt_arms`, Aktualisierung über `alpha += reward`, `beta += (1 - reward)`.
- **Explorationsquote sinkt nie unter 15 %** (harte Untergrenze, testbar). Ohne das erstarrt das System auf einem lokalen Optimum und lernt nie wieder etwas Neues.
- Ein Arm wird erst deaktiviert, wenn er mindestens `min_stichprobe` (Vorgabe 8) finale Rewards hat.
- Gewinnerkombinationen wandern in eine **Vorlagenbibliothek** (`mkt_experiments`, Status `gewinner`) und werden bevorzugt neu bespielt — mit variiertem Trend, nicht als Kopie.
- Verlierer landen auf einer Sperrliste mit Ablaufdatum (30 Tage), danach wieder erlaubt — Plattformen ändern sich.
- Alle 6 h passt `policy.py` die Trend-Score-Gewichte `w1..w7` und die Slot-Verteilung an. Jede Änderung wird in `mkt_audit_log` mit Vorher-/Nachher-Wert protokolliert.
- **Grenzen der Selbstanpassung:** Das System darf Gewichte, Slots, Stil-Mix, Hook-Verteilung und Hashtag-Sets ändern. Es darf **nicht** Budgets erhöhen, Compliance-Regeln lockern, neue Plattformen aktivieren oder Produkte unterhalb der Mindestmarge freigeben. Diese Sperre gehört in `guardrails.py` und braucht einen Test.

### 7.4 Wochenbericht (`report.py`)

Jeden Montag 08:00 Uhr: HTML-Bericht per Resend an `ADMIN_EMAIL` — beste/schlechteste Kreative, gelernte Änderungen, Kosten, Umsatzzuordnung, Ausfälle, was das System als Nächstes ausprobieren will. Derselbe Bericht ist im Admin-Dashboard abrufbar.

---

## 8. Veröffentlichung

- **Idempotenz:** `mkt_posts.idempotenz_schluessel` = Hash aus (Video-ID, Plattform, geplanter Slot), `UNIQUE`-Index. Ein Wiederholungslauf darf **niemals** doppelt posten. Test dafür ist Pflicht.
- **TikTok:** bevorzugt offizielle Content Posting API (`TIKTOK_CLIENT_KEY`/`SECRET`, OAuth-Refresh in der DB). Fehlen die Zugangsdaten, greift der Selenium-Weg über `chromedriver-win64` — dieser muss dann aber **bis zum Absenden durchlaufen**, inklusive Warten auf die Upload-Bestätigung. Der heutige Halb-Weg, der auf einen Menschen wartet, ist keine Automatisierung.
- **Instagram Reels** und **YouTube Shorts** hinter derselben `Publisher`-Schnittstelle, aktivierbar über `MARKETING_PLATTFORMEN` in der Konfiguration. Ohne Zugangsdaten: sauber übersprungen, protokolliert, kein Abbruch.
- **UTM-Parameter** an jeder Shop-URL: `?utm_source=tiktok&utm_medium=organic&utm_campaign=mkt_<post_id>`. `attribution.py` verknüpft das über die vorhandene Shop-Telemetrie mit Sessions und Bestellungen — das ist die Brücke von Reichweite zu echtem Geld.
- **Slots:** Startverteilung fest (z. B. 07:30, 12:30, 17:30, 20:30), danach vom Bandit gelernt. Mindestabstand zwischen zwei Posts derselben Plattform: 3 h. Maximal `max_posts_pro_tag` je Plattform (Vorgabe 3).

---

## 9. 24/7-Betrieb, Schutzschalter, Notaus

### Job-Katalog (`jobs.py`) — Abstände in `marketing.config.json`

| Job | Abstand | Ort |
|---|---|---|
| `trends_ingest` | 30 min | überall |
| `shop_signals` | 60 min | überall |
| `match_and_brief` | 60 min | überall |
| `render_style_a` | 30 min | überall |
| `render_style_b` | 60 min | lokal/Worker (GPU) |
| `publish_due` | 15 min | lokal bei Selenium, sonst überall |
| `metrics_collect` | 60 min | überall |
| `learning_update` | 6 h | überall |
| `weekly_report` | 7 d | überall |
| `cleanup_assets` | 24 h | überall |
| `budget_rollover` | 24 h | überall |

### Pflichten

- **Fälligkeit statt Intervall.** Nächster Lauf = letzter Lauf + Abstand, aus der DB. Ein Neustart verzögert höchstens um einen Takt.
- **Atomarer Claim** in einer SQL-Anweisung. Zwei Runner dürfen sich nicht in die Quere kommen.
- **Heartbeat** je laufendem Job; ein Job ohne Heartbeat seit 30 min gilt als abgestürzt und wird freigegeben.
- **Wiederholung** mit exponentiellem Backoff (1, 4, 16 min), nach 3 Fehlversuchen: Job pausiert + Alarm-Mail über Resend.
- **Notaus:** `MARKETING_ENABLED=false` **oder** `mkt_jobs.enabled = false` **oder** Datei `Marketing/STOP` → alle Jobs halten sofort an, kein Post geht raus. In allen drei Varianten testbar.
- **Trockenlauf:** `MARKETING_DRY_RUN` ist standardmäßig **`true`**. Es wird alles gebaut und geplant, aber **nichts veröffentlicht**; stattdessen landet der geplante Post in `mkt_posts` mit Status `dry_run`. Auf `false` stellt **nur der Mensch**, niemals der Code.
- **Budgetwächter:** Tages- und Monatsobergrenze in Euro aus der Konfiguration. Vor jedem kostenpflichtigen Aufruf wird `mkt_cost_ledger` summiert; bei Überschreitung Umschalten auf den kostenlosen Pfad (lokales TTS, lokales Rendering, Vorlagen-Briefings) statt Abbruch.
- **Degradation statt Absturz:** Fehlt ein Schlüssel, fehlt ffmpeg, ist eine API tot — das System protokolliert, wechselt auf den nächstbesten Pfad und läuft weiter. Das ist Projektkonvention: Der Shop startet auch ohne `DATABASE_URL`.
- **Ratenbegrenzung** je Anbieter mit Token-Bucket.

---

## 10. Admin-Oberfläche und Shop-Anbindung

- Neue Seite `a29715347575/marketing.html` im Stil der vorhandenen Dashboards, geschützt über `requireAdminAuth`. Inhalt: Systemzustand (Jobs, letzter Lauf, Fehler), Trend-Rangliste, Warteschlange, veröffentlichte Posts mit Kennzahlen, Lernstand je Dimension, Kosten des Monats, Notaus-Schalter, Wochenbericht.
- Neue Routen in `server.js` **ausschließlich** unter `/a29715347575/api/marketing/*`, im Stil der vorhandenen Insights-Routen. Nichts an bestehenden Routen ändern.
- Der Notaus-Schalter im Dashboard setzt `mkt_jobs.enabled` — er startet keine Prozesse.
- Neue Skripte in `package.json`: `marketing:local`, `marketing:once`, `marketing:status`, `marketing:dryrun`. Nach jeder Änderung an `package.json`: `npm install --package-lock-only`.

---

## 11. Arbeitsweise, Etappen, Übergabe

Arbeite in dieser Reihenfolge und gib nach **jeder** Etappe aus: `✅ [was fertig ist] — [betroffene Dateien]`.

1. Bestandsaufnahme + `Marketing/FORTSCHRITT.md` anlegen
2. Datenbankschema (`database.js`) + `pipelines/db.py` + `products.py` (Wurzel-`products.json`)
3. Orchestrator: `state.py`, `jobs.py`, `guardrails.py`, `run_loop.py` + Tests — **das Fundament zuerst, nicht die Videos**
4. Trends inklusive `shop_signals.py` + Normalisierung + Score
5. Matcher + Briefing + Compliance
6. Stil A (echte Stimme) inklusive `quality_gate.py`
7. Stil B (KI-Video)
8. Veröffentlichung inklusive Idempotenz
9. Analytics + Attribution
10. Lernmodul + Wochenbericht
11. Admin-Dashboard + Server-Routen
12. GitHub-Actions-Workflow + `run-local.js` + `README.md`
13. Vollständiger Trockenlauf über alle Jobs, Fehlerbilder dokumentieren

**`Marketing/FORTSCHRITT.md`** hältst du nach jeder Etappe aktuell: erledigt, offen, bekannte Fehler, nächster Schritt, benötigte Zugangsdaten. Ein Kontextverlust darf diese Runde nicht zurückwerfen.

---

## 12. Tests

Projektregel aus `CLAUDE.md` §2: **Ein Test, der nur grün werden kann, ist wertlos.** Zu jedem Test gehört die Gegenprobe, die belegt, dass er das alte Verhalten rot gemeldet hätte.

Pflichttests (pytest in `Marketing/tests/`, plus Node-Tests in `test/` für Schema und Routen):

| Test | sichert ab |
|---|---|
| `test_claim_race` | zwei gleichzeitige Runner starten denselben Job nicht doppelt |
| `test_faelligkeit` | Neustart setzt den Zeitplan nicht zurück |
| `test_notaus` | alle drei Notaus-Wege stoppen sofort |
| `test_dry_run` | im Trockenlauf verlässt kein Post das System |
| `test_budget_guard` | bei erschöpftem Budget wird umgeschaltet, nicht abgebrochen |
| `test_idempotenz_publish` | derselbe Post geht nie zweimal raus |
| `test_quality_gate` | 0-Byte- und zu kurze Videos werden abgewiesen |
| `test_compliance_blockt` | ein Briefing mit Heilversprechen wird nicht gerendert |
| `test_reward_verzoegert` | vor 72 h kein finaler Reward, kein Arm-Abschaltung |
| `test_exploration_untergrenze` | Explorationsquote fällt nie unter 15 % |
| `test_ausreisser` | ein viraler Einzeltreffer kippt die Politik nicht |
| `test_guardrail_selbstanpassung` | das System kann sein eigenes Budget nicht erhöhen |
| `test_keine_erfundenen_trends` | ohne Zugangsdaten kommen 0 Zeilen zurück, keine Beispieldaten |
| `test_products_single_source` | Marketing liest die Wurzel-`products.json`, nicht die Kopie |
| `test_lizenz_pflicht` | ein Asset ohne Lizenzeintrag kommt nicht ins Video |
| `test_marketing_schema` | Shop startet weiterhin ohne `DATABASE_URL` |

`npm run lint` und `npm test` müssen grün sein. `pytest Marketing/tests` ebenso.

---

## 13. Bereich und Verbote

**Du arbeitest nur in:**

- `Marketing/**`
- `a29715347575/marketing.html`
- `.github/workflows/marketing.yml` (neu)
- `database.js` — **nur zusätzliche** `mkt_*`-Tabellen in der bestehenden `SCHEMA`-Liste
- `server.js` — **nur ein neuer Routen-Block** `/a29715347575/api/marketing/*`
- `package.json` — nur neue Skripte
- `.gitignore`, `.env.example`, `Marketing/.env.example`
- `test/` — nur neue Testdateien
- `CLAUDE.md` — nur ein neuer Abschnitt zum Marketing-System am Ende

**Nicht anfassen:** Checkout- und Stripe-Logik, `stripe-webhook`, `price-validator.js`, `cj-*.js`, `receipt-generator.js`, `resend-service.js` (nur aufrufen, nicht ändern), `products.json` in der Wurzel, `produkte/**`, alle Kundenseiten, bestehende Tests, `.env`, `render.yaml` (außer auskommentiertem Worker-Block), `package-lock.json` von Hand, `job-scheduler.js`.

**Zusätzlich verboten:** Zugangsdaten in Code oder Repo (Repo ist öffentlich), `git add -A`, `git push`, Deploy auslösen, `MARKETING_DRY_RUN` auf `false` setzen, Beispieldaten als Ersatz für fehlende API-Antworten, Dateien löschen ohne Rückfrage, Bibliotheken installieren ohne Rückfrage, Umlaute per PowerShell-5.1-Bulk-Bearbeitung zerstören (UTF-8 ohne BOM, Edit-Werkzeug benutzen).

**Baue genau die oben gelisteten Module. Keine zusätzlichen Funktionen, keine Abstraktionen auf Vorrat, kein Refactoring bestehender Shop-Logik.**

---

## 14. Halte an und frage nach, bevor du

- den ersten echten Post absetzt oder `MARKETING_DRY_RUN` änderst
- eine Datei löschst (auch `Marketing/products.json` und die 0-Byte-MP4s in `data/renders/`)
- eine Abhängigkeit installierst (npm oder pip)
- eine bestehende Tabelle oder Spalte änderst
- etwas außerhalb von §13 anfasst
- einen kostenpflichtigen API-Aufruf zum ersten Mal scharf schaltest
- committest oder pushst
- ein Fehler nach zwei Versuchen nicht behoben ist
- zwei gleichwertige Architekturwege offenstehen und die Wahl das Datenmodell betrifft

---

## 15. Abnahme — binäre Prüfpunkte

- [ ] `python -m pipelines.orchestrator.run_loop --once` läuft ohne gesetzte Zugangsdaten fehlerfrei durch und protokolliert je Job, warum er übersprungen wurde
- [ ] Alle `mkt_*`-Tabellen werden beim Shop-Start idempotent angelegt; der Shop startet weiterhin **ohne** `DATABASE_URL`
- [ ] `trends_ingest` schreibt echte Zeilen aus mindestens zwei Quellen, darunter `shop_signals`; **ohne** Zugangsdaten schreibt es null Zeilen und keine Beispieldaten
- [ ] Stil A erzeugt aus einem Briefing ein abspielbares MP4: 1080×1920, 15–60 s, hörbare Stimme, wortsynchrone Untertitel, Endkarte mit echtem Produktbild
- [ ] Stil B erzeugt ein MP4 mit dem echten Produktbild als erstem Frame mindestens einer Einstellung, Kennzeichnung „KI-generiert" gesetzt
- [ ] `quality_gate` weist ein 0-Byte- und ein 4-Sekunden-Video nachweislich ab
- [ ] Zwei parallel gestartete Runner führen denselben Job nachweislich nur einmal aus
- [ ] Zweimaliger Aufruf von `publish_due` erzeugt genau einen Eintrag in `mkt_posts`
- [ ] Notaus über ENV, DB-Flag und `STOP`-Datei stoppt jeweils sofort
- [ ] Nach 20 simulierten Posts mit gestreuten Rewards haben sich die Arm-Werte messbar verschoben und die Explorationsquote liegt weiterhin ≥ 15 %
- [ ] Der Wochenbericht wird als HTML erzeugt (Versand im Trockenlauf nur protokolliert)
- [ ] `a29715347575/marketing.html` zeigt Jobs, Trends, Warteschlange, Posts, Lernstand und Kosten und ist ohne Basic Auth nicht erreichbar
- [ ] `npm run lint`, `npm test` und `pytest Marketing/tests` sind grün
- [ ] `git status` zeigt keine Datei mit Zugangsdaten und keine `data/`-Artefakte
- [ ] `Marketing/README.md` erklärt Start, Stopp, Notaus, Kosten, benötigte Schlüssel und die drei Betriebsarten
- [ ] `Marketing/FORTSCHRITT.md` ist aktuell

---

## Sitzungsstrategie

Neue Sitzung, unabhängig von vorherigem Kontext. Nutze einen Subagenten für die Bestandsaufnahme (§0) und für die API-Recherche (§9), damit deren Zwischenergebnisse den Hauptkontext nicht füllen. Führe `/compact` bei etwa 50 % Kontextauslastung mit Fokus auf den aktuellen Etappenschritt aus — nicht erst bei 90 %. `Marketing/FORTSCHRITT.md` ist die Übergabe an die nächste Sitzung.
