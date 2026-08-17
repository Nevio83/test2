# Marketing-Automat — Bedienungsanleitung

Was das System tut, wie du es startest, wie du es **anhältst**, was es kosten kann
und woran du erkennst, dass etwas klemmt.

> **Der Zustand liegt in Postgres, nicht im Prozess.** Ein Neustart, ein
> abgestürzter Lauf oder ein ausgefallener Cron werfen den Zeitplan nicht
> zurück — sie verzögern ihn höchstens um einen Takt. Alles andere wäre in
> dieser Umgebung wertlos: Der Shop läuft auf Render-Free und startet ständig
> neu, und GitHubs Cron ist ausdrücklich „best effort".

---

## 1. In einem Satz

Der Automat zieht laufend Trends, verknüpft sie mit den Produkten aus der
Wurzel-`products.json`, schreibt Kreativ-Briefings, rendert daraus Videos in
zwei Stilen, plant sie für Veröffentlichungszeitpunkte ein, misst hinterher bis
zur Bestellung im Shop, was funktioniert hat — und wählt beim nächsten Mal
danach aus.

**Standardmäßig veröffentlicht er nichts.** Siehe §4.

---

## 2. Die drei Orte, an denen er läuft

Es gibt **eine** Implementierung (`pipelines/orchestrator/run_loop.py`), die an
drei Orten laufen kann. Welcher gerade dran ist, sagt `MARKETING_RUNNER`.

| Ort | `MARKETING_RUNNER` | macht | Zustand |
|---|---|---|---|
| **GitHub Actions** | `actions` | alles außer Browser/GPU: Trends, Shop-Signale, Matching, Briefings, Stil A, Kennzahlen, Lernen, Wochenbericht | **aktiv** — `.github/workflows/marketing.yml`, alle 30 Min |
| **Dein PC** | `local` | die Abläufe mit `requires_local = true`: Veröffentlichen (Browser) und Stil B (Grafikkarte) | **bereit** — `npm run marketing:local` |
| **Render-Worker** | `worker` | alles zusammen, dauerhaft | **nicht eingerichtet** — Vorlage in §8 |

Die Aufteilung erzwingt der Orchestrator selbst, nicht die Einstellung: In
`state.uebernimm()` steht `AND (NOT requires_local OR %s)`. Ein Actions-Runner
bekommt einen lokalen Ablauf also gar nicht erst zugeteilt — selbst wenn jemand
die Variable falsch setzt.

**Zwei Runner gleichzeitig sind unbedenklich.** Ob ein Ablauf fällig ist *und*
das Belegen passieren in **einer** SQL-Anweisung (Vorbild: `dbOperations.claimJobRun`
im Shop). Derselbe Ablauf kann daher nicht doppelt starten.

---

## 3. Starten

### Auf dem eigenen PC

```bash
npm run marketing:status
```

Zeigt Runner, Trockenlauf, Notaus, Budgetstand und die Fälligkeit jedes Ablaufs.
Ändert nichts. **Immer der erste Befehl, wenn etwas unklar ist.**

```bash
npm run marketing:local
```

Dauerläufer, 5-Minuten-Takt. Beenden mit `Strg+C` — der gerade laufende
Durchgang wird noch fertig, damit kein Ablauf mitten im Rendern als „belegt"
hängen bleibt. Ein zweites `Strg+C` bricht sofort ab (dann gibt der
Herzschlag-Timeout ihn nach 30 Minuten wieder frei).

```bash
npm run marketing:once
```

Genau ein Durchgang, dann Schluss. Gut zum Ausprobieren.

Weitere Schalter:

```bash
node Marketing/run-local.js --job trends_ingest    # nur diesen Ablauf
node Marketing/run-local.js --takt 60              # anderer Takt in Sekunden
node Marketing/run-local.js --max-minutes 5        # kürzere Frist je Durchgang
```

*Python wird nicht geraten, sondern gesucht:* `py`, `python`, `python3` werden
der Reihe nach mit `--version` getestet. Ein fester Pfad geht über
`MARKETING_PYTHON`.

### In GitHub Actions

Läuft von selbst alle 30 Minuten. Von Hand: **Actions → Marketing-Automat →
Run workflow**. Dort kannst du einen einzelnen Ablauf angeben oder „nur Status"
ankreuzen.

Der Workflow braucht **ein** Secret, um überhaupt etwas zu tun: `DATABASE_URL`.
Alle anderen sind optional — fehlt einer, wird der betroffene Schritt mit Grund
übersprungen, nie durch Beispieldaten ersetzt.

---

## 4. Anhalten — drei Wege, einer reicht

| Weg | wirkt auf | wie |
|---|---|---|
| **Dashboard** | einzelne Abläufe oder alle | `…/a29715347575/marketing.html` → „Alles anhalten" |
| **Datei** | alles, sofort, ohne Deploy | eine Datei `Marketing/STOP` anlegen (Inhalt egal) |
| **Umgebung** | alles, an diesem Ort | `MARKETING_ENABLED=false` |

Alle drei setzen **nur ein Flag**. Sie schießen keinen laufenden Prozess ab —
ein Ablauf mitten im Rendern oder Veröffentlichen wird zu Ende gebracht, der
nächste startet nicht mehr. Das ist Absicht: Ein Notaus, der einen Upload
mittendrin abschneidet, hinterlässt einen halb veröffentlichten Beitrag.

### Der Trockenlauf ist das Wichtigere

`trockenlauf.standard` steht in `config/marketing.config.json` auf `true`.
Solange das so ist, wird **alles gebaut und geplant, aber nichts veröffentlicht** —
Beiträge landen mit Status `dry_run` in der Warteschlange und sind im Dashboard
zu sehen.

Zum Abschalten: `MARKETING_DRY_RUN=false`. Das steht bewusst **nicht** im
Workflow, sondern muss als Repository-Secret gesetzt werden. Eine Zeile, die man
beim Aufräumen übersieht, darf nicht dazu führen, dass der Shop plötzlich
öffentlich postet.

**Vor dem ersten echten Beitrag:** Warteschlange und verworfene Videos im
Dashboard durchsehen und mindestens ein fertiges Video wirklich anschauen.

---

## 5. Was Geld kostet

| Posten | wann | Grenze |
|---|---|---|
| Sprachmodell (Briefings) | je Briefing, wenn ein Schlüssel gesetzt ist | `budget.tag_euro` / `budget.monat_euro` |
| ElevenLabs (Stimme) | je Video Stil A, wenn ein Schlüssel gesetzt ist | dieselbe Grenze |
| KI-Video (Runway o.ä.) | je Video Stil B | dieselbe Grenze |
| GitHub Actions | — | **kostenlos**, Repo ist öffentlich |
| Neon-Postgres | — | **kostenlos** im Free-Tarif |

Startwerte: **3 € am Tag, 40 € im Monat.** Jeder kostenpflichtige Aufruf wird in
`mkt_cost_ledger` verbucht; vor dem nächsten wird die Summe geprüft.

**Bei Erreichen der Grenze bricht nichts ab** — es wird auf den kostenlosen Weg
umgeschaltet: Briefings aus Vorlagen, lokale Stimme, lokales Rendern. Ein
Budgetwächter, der abbricht, ist schlechter als keiner: Dann steht das System
still und niemand weiß warum.

Ohne gesetzte Schlüssel kostet der Betrieb **nichts** und läuft trotzdem — mit
Vorlagen-Briefings und lokaler Stimme.

---

## 6. Woran du siehst, dass etwas klemmt

Zuerst immer: `npm run marketing:status` oder das Dashboard.

| Bild | Ursache | was tun |
|---|---|---|
| „Noch keine Abläufe eingetragen" | erster Lauf hat noch nicht stattgefunden | einmal `npm run marketing:once` |
| Alle Abläufe „jetzt fällig", nichts passiert | `DATABASE_URL` fehlt | Status zeigt den Grund in der Kopfzeile |
| Ein Ablauf hat einen Fehlerzähler > 0 | letzter Lauf ist gescheitert | Fehlertext steht im Dashboard und in `mkt_job_events` |
| Ablauf steht auf „läuft gerade", bewegt sich nicht | Runner abgestürzt | gibt sich nach 30 Min Herzschlag-Timeout selbst frei |
| Videos werden verworfen | Ausgangsprüfung greift | Grund steht je Video im Dashboard („Verworfene Videos") |
| Briefings „gesperrt" | rechtliche Prüfung greift | Grund im Nachweis-Protokoll, z.B. Heilversprechen, fremde Marke, falscher Preis |
| Alles läuft, aber nichts wird veröffentlicht | Trockenlauf aktiv | erwartet — siehe §4 |
| `render_style_a` scheitert mit ffmpeg-Meldung | ffmpeg fehlt oder ist nicht im PATH | in einer **neu gestarteten** Shell probieren; der Code sucht auch am Installationsort |
| `publish_due` bleibt in Actions liegen | `requires_local` | erwartet — dafür ist `npm run marketing:local` da |

**Alles Übersprungene wird mit Grund protokolliert.** Ein stiller Fehlschlag
sieht aus wie Betrieb und ist damit schlimmer als ein lauter — das ist die
Leitlinie hinter der ganzen Fehlerbehandlung.

Nachschauen kann man an drei Stellen: Dashboard (`…/marketing.html`),
`mkt_job_events` (jeder Lauf mit Dauer und Ergebnis) und `mkt_audit_log`
(jede Entscheidung mit Begründung).

---

## 7. Die Abläufe

| Ablauf | Abstand | lokal? | tut |
|---|---|---|---|
| `trends_ingest` | 30 Min | – | externe Trendquellen abfragen, bewerten, speichern |
| `shop_signals` | 1 h | – | eigene Shop-Daten als Trendquelle (Suchen ohne Treffer, Abbrüche, Verkäufe) |
| `match_and_brief` | 1 h | – | Trend → Produkt zuordnen, Briefing schreiben, rechtlich prüfen |
| `render_style_a` | 30 Min | – | Video mit echter Stimme rendern (ffmpeg) |
| `render_style_b` | 1 h | **ja** | KI-Video mit erzwungener Produkttreue |
| `publish_due` | 15 Min | **ja** | fällige Beiträge veröffentlichen (im Trockenlauf: nur vormerken) |
| `metrics_collect` | 1 h | – | Kennzahlen der Plattformen holen |
| `learning_update` | 6 h | – | Belohnungen berechnen, Auswahl anpassen |
| `weekly_report` | 7 Tage | – | Wochenbericht per Mail |
| `cleanup_assets` | 1 Tag | – | alte Renderings löschen |
| `budget_rollover` | 1 Tag | – | Tagesbudget zurücksetzen |

Abstände stehen in `config/marketing.config.json` unter `jobs` und werden bei
jedem Start aus der Datei nachgezogen. **`enabled` wird dabei nicht
überschrieben** — das ist der Schalter des Menschen.

---

## 8. Render-Worker (Vorlage, nicht eingerichtet)

`render.yaml` ist bewusst **unverändert**. Wer den Automaten dauerhaft auf
Render laufen lassen will (kostet Geld, ~7 $/Monat), hängt diesen Block dort
unter `services:` an:

```yaml
  # - type: worker
  #   name: maios-marketing
  #   runtime: python
  #   plan: starter            # Free-Tarif hat KEINE Worker
  #   buildCommand: pip install -r Marketing/requirements.txt
  #   startCommand: cd Marketing && python -m pipelines.orchestrator.run_loop --once --max-minutes 5
  #   autoDeploy: false
  #   envVars:
  #     - key: MARKETING_RUNNER
  #       value: worker
  #     - key: DATABASE_URL
  #       sync: false
```

Zwei Dinge dabei beachten:

1. **`--once` und ein Prozessmanager, keine Endlosschleife im Programm.** Render
   startet den Worker nach Abstürzen selbst neu; eine eigene Schleife würde
   diesen Mechanismus nur verdecken.
2. **`worker` bekommt auch die lokalen Abläufe** (`kann_lokale_jobs()`). Ein
   Render-Worker hat aber weder Browser noch Grafikkarte — wer ihn einsetzt,
   sollte `publish_due` und `render_style_b` im Dashboard **abschalten** und auf
   dem eigenen PC belassen.

---

## 9. Umgebungsvariablen

Keine davon ist zum **Starten** nötig — außer `DATABASE_URL` für alles, was
festgehalten werden soll. Fehlt ein Schlüssel, wird der betroffene Schritt mit
Grund übersprungen.

| Zweck | Variablen |
|---|---|
| **Datenbank (nötig)** | `DATABASE_URL` — dieselbe wie der Shop |
| Steuerung | `MARKETING_RUNNER`, `MARKETING_ENABLED`, `MARKETING_DRY_RUN`, `MARKETING_DATA_DIR`, `MARKETING_PYTHON` |
| Trends | `REDDIT_CLIENT_ID`/`_SECRET`, `YOUTUBE_API_KEY`, `EXPLODING_TOPICS_API_KEY` |
| Briefings | `ANTHROPIC_API_KEY` **oder** `OPENAI_API_KEY` |
| Stimme | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |
| KI-Video | `RUNWAY_API_KEY` |
| Veröffentlichen | `TIKTOK_CLIENT_KEY`/`_SECRET`/`_ACCESS_TOKEN`, `IG_*`, `YT_*` |
| Mail | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL` |

`MARKETING_DATA_DIR` verlegt Renderings und Zwischenstände aus dem
Projektordner heraus. Nötig überall dort, wo der Prozess nicht ins Projekt
schreiben darf.

**Secrets gehören nie ins Repository.** Es ist öffentlich. Lokal in `.env`
(gitignored), für Actions in die Repository-Secrets, für Render ins Dashboard.

---

## 10. Tests

```bash
py -m pytest Marketing/           # 141 Tests
npm test                          # 188 Tests, darunter test/marketing-dashboard.test.js
```

Projektregel aus `CLAUDE.md` §2: **Ein Test, der nur grün werden kann, ist
wertlos.** Zu jedem behobenen Fehler gehört hier eine Gegenprobe, die das alte
Verhalten nachbildet und zeigt, dass der Test es rot gemeldet hätte. Ohne
`DATABASE_URL` überspringen sich die Datenbank-Tests, statt rot zu werden — so
läuft es auch in der CI.

Was tatsächlich gebaut wurde, was noch offen ist und welche Fehler beim Bauen
gefunden wurden, steht in **`FORTSCHRITT.md`**.
