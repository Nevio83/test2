# 🎬 TikTok-Rohmaterial (SOP)

Betriebsanleitung für `tiktok-video-sync.js` — den Bot, der zu den Produkten aus
der Wurzel-`products.json` fremde TikTok-Videos sucht, sie als **Rohmaterial**
herunterlädt und zu jedem Download festhält, woher er kommt.

> **Aktueller Stand:** Trockenlauf ist **Standard**. Ohne `--laden` wird gesucht,
> bewertet und die Prüfliste geschrieben — heruntergeladen wird **nichts**.
> Das entspricht `trockenlauf.standard` im Marketing-Automaten.

> ⚠️ **Das ist internes Referenzmaterial, sonst nichts.** Fremde TikTok-Videos
> sind urheberrechtlich geschützt. Jeder Eintrag im Index startet mit
> `rechte_geprueft: false`. **Ohne manuelle Rechteprüfung wandert nichts davon
> in den Shop, in `products.json` oder in irgendeine Veröffentlichung** — weder
> ganz noch als Ausschnitt, weder als Vorlage noch als Hintergrund. Siehe §7.

---

## 1. Was es tut — und was nicht

Der Marketing-Automat unter `Marketing/` rendert **eigene** Videos nach
`Marketing/videos/`. Dieser Bot macht etwas anderes: Er lädt **fremdes**
Material zum Anschauen herunter — Recherche, was in einer Produktkategorie auf
TikTok funktioniert.

| | eigene Videos (`Marketing/`) | dieses Programm |
|---|---|---|
| Herkunft | selbst gerendert | fremde Creator |
| Ablage | `Marketing/videos/` (versioniert) | `Marketing/data/tiktok-quellen/` (**gitignored**) |
| Zweck | Veröffentlichung | nur Recherche |
| Rechte | eigene | **fremde — ungeprüft** |
| Aufräumen | `cleanup_assets` | von Hand |

**Was es bewusst nicht tut:**

* Es meldet sich **nirgends an** und umgeht **keine Sperre** — kein Login, keine
  Cookies, kein Proxy, kein CAPTCHA-Umweg. Ob eine Sperre der ganzen Leitung den
  Lauf **beendet**, steuert `bei_sperre_abbrechen` (Standard: `false`, es wird
  weitergemacht). Protokolliert wird sie in jedem Fall. Umgangen wird sie nie —
  auch nicht mit abgeschaltetem Abbruch.
* Es erfindet **keine Extractor-Fähigkeiten**. Was die installierte
  yt-dlp-Version bei TikTok kann, wird zur Laufzeit aus `--list-extractors`
  gelesen. Was nicht in der Liste steht, wird protokolliert statt umgangen.
* Es fasst `products.json` **nur lesend** an.
* Es erfindet **keine Ersatzdaten**. Fehlt yt-dlp, bricht es mit Hinweis ab,
  statt eine leere Liste als Erfolg auszugeben.

---

## 2. Voraussetzung: yt-dlp

`yt-dlp` ist ein **externes Programm**, kein npm-Paket — dieselbe Kategorie wie
ffmpeg. Es wird **nicht** durch `npm install` mitinstalliert.

```bash
py -m pip install --upgrade yt-dlp
```

oder

```bash
winget install yt-dlp.yt-dlp
```

Gefunden wird es wie Python in `Marketing/run-local.js`: **probiert, nicht
geraten.** Der Reihe nach werden `yt-dlp`, `yt-dlp.exe`, `py -m yt_dlp` und
`python -m yt_dlp` mit `--version` getestet, der erste funktionierende gewinnt.
Fester Pfad über `YTDLP_PATH`.

> **Stand auf diesem Rechner (2026-08-18):** yt-dlp **2026.07.04** ist per pip
> installiert, ffmpeg 9.0 ebenfalls. Die `yt-dlp.exe` liegt **nicht** im PATH —
> der Bot findet sie über `py -m yt_dlp`, genau dafür probiert er die Kandidaten
> durch.

### Was diese Version bei TikTok kann

`--list-extractors` liefert: `TikTok`, `tiktok:collection`, `tiktok:live`,
`tiktok:user`, `vm.tiktok` — sowie `tiktok:effect`, `tiktok:sound` und
`tiktok:tag`, **alle drei von yt-dlp selbst als `CURRENTLY BROKEN` markiert**.

| Quelle | Stand |
|---|---|
| feste Video-URLs (einzelne Videos) | ✅ nutzbar — der **einzige** funktionierende Weg |
| Creator-Profile (`tiktok:user`) | ❌ scheitert: `Unable to extract secondary user ID`; auch der vom Fehler selbst vorgeschlagene Umweg über `tiktokuser:<channel_id>` liefert eine leere Antwort. An drei Konten geprüft. |
| Hashtag-Seiten | ❌ Extractor vorhanden, aber **upstream kaputt** |
| Stichwortsuche | ❌ **gibt es gar nicht** — kein Such-Extractor in der Liste |

> **Eine automatische Stichwortsuche ist mit dieser yt-dlp-Version also nicht
> möglich — und Creator-Profile ersetzen sie auch nicht.** Wer Material will,
> trägt **Adressen einzelner Videos** in `bot/tiktok-quellen.json`
> ein (Feld `videos`). Das Feld `creators` bleibt bestehen, damit es sofort
> greift, falls yt-dlp den Extractor repariert; bis dahin wird jede darin
> eingetragene Adresse mit Fehlermeldung übersprungen.
> Das ist keine Einschränkung des Bots, sondern der Extractor-Lage — deshalb
> wird sie bei jedem Lauf frisch gelesen und nicht angenommen. Mit einer
> späteren yt-dlp-Version kann sich das ändern; `npm run tiktok:status` sagt es.

Der Marker `CURRENTLY BROKEN` wird ausgewertet, nicht nur der Name. Die erste
Fassung prüfte bloß, ob „tag" im Extractor-Namen vorkommt, und meldete deshalb
„Hashtag-Seiten: ja" für einen Extractor, den yt-dlp selbst für kaputt erklärt.

---

## 2a. Zweite Voraussetzung: die Browser-Kennung

**Ohne `curl_cffi` beantwortet TikTok keine einzige Anfrage.**

```bash
py -m pip install curl_cffi
```

TikTok liefert die Videoseite nur dann brauchbar aus, wenn die Verbindung wie
die eines gewöhnlichen Browsers aussieht. yt-dlp kann das — aber nur mit diesem
Zusatzpaket. Fehlt es, scheitert **jeder** Abruf mit:

```
ERROR: [TikTok] <id>: Unexpected response from webpage request
```

**Diese Meldung ist die trügerischste im ganzen Projekt.** Sie klingt nach einem
einzelnen kaputten Video, betrifft aber alle. Sie passt in kein Sperrmuster
(`captcha`, `429`, `rate limit`). Und sie hat hier zweimal in die Irre geführt:

| Vermutung | wie sie widerlegt wurde |
|---|---|
| Ratenbegrenzung durch zu viele Abrufe | eine Adresse, die eine Stunde vorher ging, scheiterte auch nach Stunden Pause |
| veraltetes yt-dlp | die Nightly vom selben Tag tat exakt dasselbe |

Der eigentliche Hinweis stand die ganze Zeit da — aber nur als **Warnung** neben
dem Fehler, und der Bot setzt `--no-warnings`, damit die Ausgabe lesbar bleibt:

> `The extractor is attempting impersonation, but no impersonate target is available.`

Deshalb wird jetzt **direkt gefragt** statt geraten:

* `npm run tiktok:status` zeigt eine Zeile **Browser-Kennung** (✅ mit Anzahl
  der Ziele, ❌ mit dem Installationsbefehl).
* `npm run tiktok` prüft es **vor dem ersten Abruf** und bricht mit klarer
  Ansage ab, statt fünf Anfragen ins Leere zu schicken.

## 2b. Der Fundweg: suchen ohne Suchextractor

Weil yt-dlp für TikTok keine Stichwortsuche anbietet, wird **außerhalb** gesucht
— mit einer gewöhnlichen Websuche, die TikTok-Videoseiten indexiert. Was dabei
herauskommt, ist eine Liste von Adressen. Die prüft und sortiert dieser Befehl:

```bash
npm run tiktok:finden -- "https://www.tiktok.com/@handle/video/123" "https://www.tiktok.com/@x/video/456"
```

Er holt zu jeder URL die Metadaten (kein Download), misst sie gegen **alle 40
Produkte** und zeigt, welches am besten passt. **Standard ist Vorschau** — erst
`--schreiben` trägt die Treffer in `tiktok-quellen.json` ein:

```bash
npm run tiktok:finden -- --schreiben "https://www.tiktok.com/@handle/video/123"
```

Danach normal weiter mit `tiktok:probe` und `tiktok:laden`.

> Eine URL, die niemand aufgerufen hat, ist eine Behauptung. Deshalb wandert
> nichts ungeprüft in die Konfiguration — jede Adresse wird einmal wirklich
> abgefragt, bevor sie eingetragen wird.

---

## 3. Die Befehle

### Der normale Weg: `npm run tiktok`

```bash
npm run tiktok
```

Fragt vier Dinge und macht den Rest allein:

```
Produktnummer? 10
   → Elektrischer Wasserspender für Schreibtisch
Wie viele Videos? [5, hoechstens 50] 8
Sprache?  1 = deutsch  2 = englisch  [2] 1
Ton?  1 = keine Sprache  2 = mit Sprache  [1] 2
```

Danach: sucht Adressen, prüft jede, überspringt bereits Geladenes, lädt bis zur
gewünschten Zahl, benennt auf `NN_<slug>_<dauer>s_stil-b.mp4` um, legt alles in
den **Ordner dieses Produkts** (§3b) und schreibt den Herkunftsnachweis.

**Bis zu 50 Videos je Lauf.** Die `5` in der Frage ist nur die Vorgabe. Wer
mehr will, bekommt auch mehr **Abruf-Budget**: `max_anfragen` (60) war auf drei
bis fünf Videos gemünzt, und gemessen über mehrere echte Läufe wird etwa jede
zehnte bis zwölfte geprüfte Adresse ein brauchbares Video — der Rest fällt durch
Sprache, Ausschluss, Merkmale oder das Abhören. Das Budget wächst deshalb mit
der gewünschten Anzahl (`Anzahl × 12`), nach oben begrenzt auf 300: Mehr wären
mit drei Sekunden Pause über eine Viertelstunde am Stück gegen TikTok, und das
ist nicht klug.

**Was die Sprachwahl umfasst** — drei Dinge, nicht eines:

| | wird geprüft an | wann |
|---|---|---|
| **Suche** | mit welchen Begriffen gefragt wird | vor dem Laden |
| **Untertitel** | Funktionswörter im Videotext (`spracheDesTextes`) | vor dem Laden |
| **Ansage** | der Ton selbst, per Spracherkenner | **nach** dem Laden |

Die dritte Stufe kam zuletzt dazu und schließt eine echte Lücke: Untertitel und
Ansage sind zwei verschiedene Dinge. Ein **deutsch beschriftetes, englisch
gesprochenes** Video kam vorher als „deutsch" durch, weil bei „mit Sprache"
überhaupt nicht hingehört wurde. Jetzt wird **jedes** geladene Video abgehört;
passt die Ansage nicht, fliegt die Datei wieder weg.

**Wo der Erkenner schweigt, wird nicht geraten.** Gemessen an den 16 Videos im
Ordner:

| | Sicherheit der Spracherkennung | Wörter |
|---|---|---|
| es wird geredet | 0,977 – 0,998 | 28 – 173 |
| niemand redet | 0,258 – 0,580 | 0 |

Bei Stille nennt der Erkenner trotzdem eine Sprache — ausnahmslos „en", obwohl
kein Wort fällt. Unterhalb von **0,7** (mitten in der Lücke) gilt die Angabe
deshalb als *keine* Sprache: Im Nachweis steht dann `null`, nicht der Ratewert.
Früher stand dort „en" als Tatsache.

**Voraussetzung für die Suche** ist ein Schlüssel in der `.env` — einer reicht:

| Schlüssel | Kontingent | Kreditkarte |
|---|---|---|
| `TAVILY_API_KEY` | 1000 Abfragen/Monat | **nein** (tavily.com) |
| `BRAVE_API_KEY` | 5 USD Guthaben/Monat | ja, seit 2026 |

Ist Tavily gesetzt, wird Tavily benutzt. Ein Durchgang kostet **eine** Abfrage,
egal wie viele Videos dabei herauskommen. Ohne Schlüssel läuft der Ablauf
trotzdem und nutzt nur die Adressen aus `tiktok-quellen.json`.

### So testest du es — Schritt für Schritt

**1. Vorbedingungen:** `npm run tiktok:status` → erwartet `yt-dlp: ✅` mit
Version und `Notaus: nicht aktiv`.

**2. Schlüssel sichtbar?**

```bash
node -e "require('dotenv').config();console.log(process.env.TAVILY_API_KEY?'gesetzt':'FEHLT')"
```

Muss `gesetzt` sagen. Hier lag ein Fehler: Der Schlüssel stand richtig in der
`.env`, aber das Programm las die Datei nicht — und meldete „kein Suchschlüssel
gesetzt". Man verdächtigt dann den Schlüssel statt das Programm.

**3. Kleinster echter Lauf:** `npm run tiktok`, Produkt **10**, Anzahl **1**.
Mit einem Video anfangen, nicht mit fünf.

**4. Kontrolle:** `git status` — **es darf kein Video auftauchen.** Tut es das
doch, greift der Schutz nicht und die Datei landet beim nächsten Hochladen
öffentlich im Netz. Dazu `ls Marketing/videos` und ein Blick in
`Marketing/data/tiktok-quellen/index.json` (Urheber, Quelle, Prüfsumme,
`rechte_geprueft: false`).

**5. Zweiter Lauf, gleiche Eingabe:** Er darf **nicht** erneut laden. Das ist
die Probe darauf, dass der Nachweis gelesen wird.

> **Kommt weniger als gewünscht?** Normalfall. Der Musikfilter ist streng. Der
> Hebel sind **mehr Suchbegriffe**, nicht eine niedrigere Hürde — das Feld
> `suchbegriff` nimmt eine Liste. Gemessen: ein Begriff → 6 Adressen → 0
> brauchbar; vier Begriffe → 34 Adressen → Ziel erreicht. Und **englisch
> suchen**: „elektrischer wasserspender schreibtisch" lieferte 7 Treffer, davon
> null zum Produkt — lauter Tischlerei-Videos, weil „Schreibtisch" dort als
> Möbelstück trifft.

### Die Einzelbefehle

```bash
npm run tiktok:status
```

Zeigt Ablageort, Konfiguration, Notaus, Index-Stand und **was yt-dlp bei TikTok
tatsächlich kann**. Ändert nichts, lädt nichts. **Läuft auch ohne installiertes
yt-dlp durch** und benennt dann, was fehlt — bewusst mit Rückgabewert 0, damit
der Bericht nicht hinter npm-Fehlermeldungen verschwindet.

```bash
npm run tiktok:probe
```

Der **Trockenlauf**: sucht Kandidaten, bewertet die Zuordnung, schreibt
`pruefliste.json`. **Lädt nichts herunter.**

```bash
npm run tiktok:laden -- --max 2
```

Der Ladelauf. Lädt höchstens so viele Videos, wie `--max` erlaubt (Standard 5).
Das `--` davor gehört dazu, sonst frisst npm den Schalter.

```bash
npm run tiktok:ordner
```

Legt unter `rohmaterial/` für **jedes** Produkt einen Ordner an (siehe §3b) und
den Ordner `geschnitten/` dazu. Vorhandene bleiben unberührt — ein Befehl, der
Ordner anlegt, darf niemals Inhalte kosten. Braucht **kein yt-dlp**.

```bash
npm run tiktok:aufraeumen
```

Räumt **Einträge ohne Datei** aus dem Herkunftsnachweis. Zeigt standardmäßig nur
an, was ginge; geschrieben wird erst mit `-- --schreiben` — dieselbe Linie wie
beim Laden, wo `--laden` nötig ist. Braucht **kein yt-dlp**.

Wozu: Der Index beantwortet die Frage „wem gehört diese Datei und woher stammt
sie". Für eine gelöschte Datei gibt es darauf keine Antwort mehr — der Eintrag
behauptet nur noch Bestand, den es nicht gibt, und fälscht die Zahl in
`tiktok:status`. Beim ersten Lauf waren es **26 von 36 Einträgen**.

Die Kennungen der entfernten Videos bleiben in der schmalen Liste
`frueher_geladen` stehen. **Ohne sie holt das Aufräumen genau das zurück, was
es gerade entfernt hat:** Die Suche fände dieselben Adressen wieder, und nichts
wüsste mehr, dass diese Videos schon einmal hier waren.

Weitere Schalter:

```bash
node tiktok-video-sync.js --laden --schwelle 0.7    # strengere Zuordnung
node tiktok-video-sync.js --help                    # Kurzhilfe
```

---

## 3b. Wo die Videos liegen

```
Marketing/videos/
├── rohmaterial/                                        ← der Bot legt hier ab
│   ├── 10_elektrischer-wasserspender-fuer-schreibtisch/
│   │   ├── 01_elektrischer-wasserspender_14s_stil-b.mp4
│   │   └── 02_elektrischer-wasserspender_49s_stil-b.mp4
│   └── 28_mini-muskel-massage-pistole/
├── geschnitten/                                        ← eigene Schnitte daraus
│   └── README.md
└── 01_nordic-crystal-lamp_20s_stil-a.mp4               ← eigene Renderings
```

**Für alle 40 Produkte liegt ein Ordner bereit**, auch für die noch leeren:

```bash
npm run tiktok:ordner
```

Legt die fehlenden an, fasst vorhandene nicht an. Die leeren Ordner sind das
**Inhaltsverzeichnis**: Wer Material sucht oder von Hand ablegt, sieht auf einen
Blick, welche Produktnummer zu welchem Produkt gehört — ohne `products.json`
aufzuschlagen — und legt nichts mehr in einem selbst erfundenen Ordnernamen ab.

Bewusst als Befehl und nicht einmalig von Hand: Der Zweig ist gitignoriert,
existiert also auf keinem anderen Rechner und überlebt kein frisches Auschecken.
Wiederherstellbar zu sein ist hier mehr wert als einmal angelegt.

**Je Produkt ein Ordner**, benannt mit Nummer *und* Slug: Die Nummer sortiert,
der Slug sagt, was drin ist. Die laufende Nummer der Dateien beginnt in jedem
Ordner wieder bei `01`. Flach in einem Ordner war es ab etwa zwanzig Dateien
unbrauchbar — alles hieß gleich, und welches Video zu welchem Produkt gehörte,
stand nur im Dateinamen.

**Der Zwischenordner `rohmaterial` ist kein Schmuck.** Er trägt die Grenze
zwischen fremdem Material und den eigenen Renderings, und damit reicht **eine**
`.gitignore`-Zeile für alles:

```
Marketing/videos/rohmaterial/
Marketing/videos/geschnitten/
```

Vorher stand dort **je Datei eine Zeile**, weil nur das Namensmuster fremdes von
eigenem Material trennte. Beim Umbenennen fiel das **zweimal** auseinander, und
fremde Videos tauchten im Status eines öffentlichen Repos auf. Eine Ordner-Regel
kann man beim Umbenennen nicht vergessen. 24 Einzelzeilen sind entfallen.

`geschnitten/` ist ebenfalls ausgenommen, und das ist Absicht: **Ein Schnitt aus
fremdem Material bleibt fremdes Material.** Die Begründung steht als `README.md`
im Ordner selbst.

### Nummern werden nicht wiederverwendet

Die nächste Nummer kommt aus **zwei** Quellen: dem Ordner *und* dem
Herkunftsnachweis. Aus dem Ordner allein gelesen wird sie nach jedem Löschen neu
vergeben — und dann bekommt ein *anderes* Video denselben Dateinamen. Genau das
ist passiert, zweimal an einem Tag:

```
16_…_12s_stil-b.mp4  (15:42)  ← überschrieben, Video verloren
16_…_12s_stil-b.mp4  (16:41)  ← anderes Video, gleicher Name
```

Der Nachweis vergisst nicht, wenn jemand eine Datei löscht — deshalb zählt er
mit. Und `npm run tiktok:aufraeumen` vergleicht jetzt die **Prüfsumme**: Ein
Eintrag, unter dessen Dateinamen eine *andere* Datei liegt, gilt ebenfalls als
verwaist. Vorher galt er als in Ordnung, weil ja eine Datei da war — und der
Nachweis behauptete weiter eine Herkunft, die nicht stimmte.

## 4. Anhalten

Zwei der drei Wege aus `Marketing/README.md` §4 gelten auch hier:

| Weg | wie |
|---|---|
| **Datei** | eine Datei `Marketing/STOP` anlegen (Inhalt egal) |
| **Umgebung** | `MARKETING_ENABLED=false` |

Greift einer davon, geht **kein einziger** yt-dlp-Aufruf raus — auch nicht das
harmlose `--list-extractors`. Der Grund wird protokolliert.

Der dritte Weg (Dashboard) hängt an der Marketing-Datenbank und steuert deren
Abläufe, nicht dieses Programm.

---

## 5. Wie ein Kandidat gefunden wird

**Suchbegriffe** kommen aus `name` und `slug` des Produkts, plus optionalen
Ergänzungen aus `bot/tiktok-quellen.json`. Umlaute werden
angeglichen (`Küchenwaage` → `kuechenwaage`), Füllwörter wie „für" fliegen raus
— sonst wäre jedes beliebige Video schon deshalb ein Treffer.

**Quellen** werden in dieser Reihenfolge aufgelöst:

| | Quelle | Bedingung |
|---|---|---|
| (a) | fest hinterlegte Video-URLs | immer — praktisch der einzige Weg |
| (b) | Hashtag-Seiten | nur wenn ein TikTok-**Hashtag**-Extractor vorhanden ist |
| (c) | Stichwortsuche | nur wenn ein TikTok-**Such**-Extractor vorhanden **und** `suche_praefix` konfiguriert ist |

Bei (c) reicht der Extractor allein nicht: Ohne konfiguriertes Präfix wäre die
Such-URL **geraten**, und eine geratene URL fällt bei yt-dlp nicht auf die Nase,
sondern auf die allgemeine URL-Behandlung — die lädt dann irgendetwas. Was
fehlt, landet mit Grund in `pruefliste.json` unter `uebersprungen`.

**Erst Metadaten, dann Datei.** Der erste Schritt läuft mit `--dump-json
--flat-playlist`; in diesem Schritt wird nichts heruntergeladen.

---

## 6. Wie bewertet wird

Der **Trefferwert** (0–1) ist der Anteil der Produktbegriffe, die im Titel, in
der Beschreibung oder in den Hashtags des Videos vorkommen.

| Trefferwert | Folge |
|---|---|
| **≥ Schwelle** (Standard 0.5) **und ≥ 2 getroffene Begriffe** | Kandidat für den Download |
| alles andere | **kein** Download → Eintrag in `pruefliste.json` |

**Warum zusätzlich zwei Begriffe?** Das Verhältnis allein genügt nicht, und das
fiel beim ersten echten Lauf gegen TikTok sofort auf: Ein Video über eine
Küchenwaage landete bei Produkt 44 „Smart Beamer" — Trefferwert 0.5, weil im
Text „SmartKitchen" steht und „smart" die Hälfte von zwei Begriffen ist. Bei
kurzen Produktnamen reißt ein einzelnes Modewort die Schwelle. Seitdem müssen
**zwei verschiedene** Begriffe treffen; nur bei einem Produkt, das überhaupt
bloß einen Begriff hat, zählt dieser eine.

> **Eine stille Fehlzuordnung ist schlimmer als gar keine.** Ein falsch
> zugeordnetes Video sieht im Ordner exakt aus wie ein Treffer — es fällt erst
> auf, wenn jemand es öffnet. Deshalb wird im Zweifel **nicht** geladen,
> sondern in die Prüfliste geschrieben.

Schwelle ändern: `--schwelle 0.7`, `TIKTOK_SYNC_SCHWELLE` oder
`standard.schwelle` in der Konfiguration. Reihenfolge: Kommandozeile schlägt
Umgebungsvariable schlägt Datei.

### Die Prüfkette im Ganzen

Der Trefferwert ist nur eine von sieben Hürden. Jede hat einen Fehlfund als
Anlass, keine ist ausgedacht:

| # | Hürde | wogegen | wann |
|---|---|---|---|
| 1 | schon im Nachweis (Adresse oder Video-ID) | dasselbe zweimal holen | vorher |
| 2 | Tonspur (`original sound`) — **nur Reihenfolge** | teure Downloads zuerst sparen | vorher |
| 3 | **Sprache des Untertitels** | deutsch gewählt, englischer Untertitel | vorher |
| 4 | **Ausschlussliste** | der Katzenbrunnen *ist* ein automatischer Wasserspender | vorher |
| 5 | **Kernwort** | zwei Ortswörter reichten für ein Nachttisch-Dekovideo | vorher |
| 6 | Trefferwert ≥ Schwelle **und** ≥ 2 Begriffe | Möbelvideos über „Schreibtisch" | vorher |
| 7 | **Merkmale** — ist es *dieses* Gerät? | Standgerät, Kühlschrankspender, Filterkanne | vorher |
| 8 | **Prüfsumme** | derselbe Clip, unter anderem Konto neu hochgeladen | nachher |
| 9 | **abgehört** (Ton + gesprochene Sprache) | das `track`-Feld log bei 4 von 7 | nachher |

### Hürde 7: Merkmale — die zweite, unabhängige Prüfung

Das Kernwort beantwortet nur die halbe Frage: Im Text steht „Wasserspender".
Davon gibt es Standgeräte fürs Büro, Kühlschrankspender, Filterkannen,
Katzenbrunnen — und dieses kleine Gerät, das auf einer Gallonenflasche sitzt
und mit Akku pumpt.

Die **Merkmale** beantworten die andere Hälfte. Sie stammen aus der
Produktbeschreibung in `products.json`, nicht aus einer Vermutung:

> „Automatischer Wasserspender für Gallon-Flaschen. Wiederaufladbar und perfekt
> für Büro und Zuhause."

Daraus vier Gruppen: sitzt auf einer **Flasche/Gallone/Kanister** · hat einen
**Akku/USB/wiederaufladbar** · **pumpt elektrisch/automatisch** · steht auf
einem **Schreibtisch/Nachttisch/im Büro**.

**Eines genügt.** Untertitel sind kurz; zwei zu verlangen hieße, fast alles
abzulehnen. Die Härte kommt daher, dass diese Prüfung *zusätzlich* zu Kernwort,
Ausschlussliste und Trefferwert kommt. Fehlt das Feld `merkmale` (39 der 40
Produkte), greift die Prüfung nicht — ein leeres Feld darf nicht dazu führen,
dass gar nichts mehr durchkommt.

Was getroffen hat, steht im Nachweis (`"merkmale": ["akku","flasche",…]`).
Damit lässt sich später prüfen, worauf die Zuordnung beruhte — der Trefferwert
allein stünde auch unter einem Standgerät.

### Hürde 2: warum die Tonspur nur noch die Reihenfolge bestimmt

`original sound` heißt: Der Ton ist eine eigene Aufnahme statt eines
lizenzierten Titels. Das ist ein **Indiz und sonst nichts** — nachgemessen lag
es bei **vier von sieben** angeblichen Musikvideos falsch. Als hartes Urteil ist
es sogar teuer: In einem echten Lauf fielen daran **34 von 50** Kandidaten, und
davon waren nachweislich viele still (Produktgeräusche, in der App hinterlegte
Musik).

Solche Kandidaten werden deshalb **zurückgestellt, nicht verworfen**. Reicht der
Rest nicht für die gewünschte Zahl, kommt eine **zweite Runde**: Sie werden
geladen und abgehört, und dann entscheidet nicht mehr das Feld, sondern der Ton.

> Gemessen an einem Lauf über drei Videos: 34 zurückgestellt, in der zweiten
> Runde 9 wegen echtem Gerede verworfen (71–310 Wörter) — und **alle drei
> geladenen Videos hatten `original sound`**. Mit dem alten harten Filter wäre
> derselbe Lauf bei **0 von 3** geendet.

**Fällt das Abhören aus** (Python fehlt, Datei unlesbar), gilt die Tonspur
wieder als Urteil und das Video bleibt draußen. Die Lockerung existiert nur,
*weil* abgehört wird; ohne Abhören wäre sie im Fehlerfall eine
Verschlechterung.

### Die Wortlisten — und wie sie sich selbst prüfen

Alle 40 Produkte sind gepflegt, nicht nur das eine in Benutzung:

| | Anzahl |
|---|---|
| Suchbegriffe (je Produkt ~24, zweisprachig) | **984** |
| Kernwörter — benennen das Produkt | **403** |
| Merkmale — unterscheiden *dieses* Gerät | **820** |
| Ausschlusswörter je Produkt | **552** |
| Ausschlusswörter allgemein | 28 |

Alle Wörter stammen aus Name, Kategorie und Beschreibung in `products.json`.

Das kann niemand mehr von Hand überblicken, also prüft es sich selbst. Beim
Anlegen fanden diese Prüfungen **212 echte Fehler**; sie laufen als Tests weiter:

**1. Jeder Suchbegriff muss das Produkt benennen.** Aus jedem Begriff wird auch
eine Prüfgruppe für die Bewertung — ein Begriff wie „tiktok made me buy it"
ergäbe die Gruppe `[made, buy]` und gäbe jedem beliebigen Einkaufsvideo Punkte.
*210 Verstöße gefunden.*

**2. Kein Ausschlusswort darf ein eigenes Wort treffen.** Verglichen wird als
Wortanfang. `gun` als Ausschluss für die Massagepistole hätte das englische
„massage gun" ausgeschlossen — das Produkt wäre unauffindbar gewesen, ohne dass
irgendwo ein Fehler erschiene.

**3. Jedes Produkt muss seinen eigenen Text erkennen.** Name und Beschreibung
aus `products.json` sind der ehrlichste denkbare Untertitel für genau dieses
Produkt. Fällt der durch die eigene Prüfkette, sind die Listen falsch.
*Zwei Verstöße gefunden* — bei „Mini Muskel Massage Pistole" und „Aroma-Pads"
schreibt der deutsche Name das Produkt **getrennt**, die Kernwörter waren
zusammengeschrieben. Beide hätten ihren eigenen Namen nicht erkannt.

**Getrennt und zusammen gehören beide hinein.** Ab fünf Zeichen wird als
Teilstring verglichen, und der Videotext ist auf einfache Leerzeichen
normalisiert:

| Schreibweise | trifft | trifft nicht |
|---|---|---|
| `massage gun` | „mini massage gun" | „#massagegun" |
| `massagegun` | „#massagegun" | „mini massage gun" |

Mehrwortige Einträge verlangen, dass die Wörter **nebeneinander** stehen:
`solar light` trifft „solar lights fence", aber nicht „solar fence lights".
Deshalb wurden fünf Suchbegriffe umgestellt statt die Hürde zu senken.

### Woher die Adressen wirklich kommen

Die Suchmaschine findet fast nur Seiten **über** das Thema, kaum einzelne
Videos. Gemessen an sechs echten Anfragen:

| | Anzahl | was es ist |
|---|---|---|
| `/discover/…` | 53 | TikToks eigene Themenseiten |
| `shop.tiktok.com` u. ä. | 33 | Shop-Seiten, unbrauchbar |
| **`/@x/video/…`** | **6** | tatsächliche Videos |
| `/tag/…`, `/photo/…` | 2 | Hashtag- und Bildbeiträge |
| Creator-Profile | **0** | |

Deshalb blieb die Ausbeute bei rund **zwei Adressen je Anfrage** hängen — und
deshalb brauchte ein Lauf über drei Videos alle 24 Suchbegriffe.

Auf genau diesen Themenseiten stehen aber die gesuchten Videos. Die Such-API
liefert den **Seitentext** auf Wunsch gleich mit (`include_raw_content`) — sie
hat die Seite ohnehin abgerufen. Daraus werden die Videoadressen gelesen
(`adressenAusText`). Gemessen an denselben vier Begriffen:

| | Videoadressen |
|---|---|
| nur Trefferadressen (vorher) | **5** |
| plus Seitentext (jetzt) | **413** |

Es bleibt **eine** Anfrage je Suchbegriff.

**Warum nicht die Seite selbst abrufen?** Ausprobiert: TikTok beantwortet einen
eigenen Abruf mit 385 000 Zeichen Prüfseite und **null** Videoadressen. Das zu
umgehen verbietet die Aufgabenstellung ausdrücklich — und es wäre ohnehin
aussichtslos.

**Warum yt-dlp die Themenseiten nicht selbst öffnet:** ebenfalls geprüft, mit
der aktuellen Fassung 2026.08.19:

| Adresse | Antwort von yt-dlp |
|---|---|
| `/discover/…` | `Unsupported URL` — dafür gibt es keinen Extractor |
| `/tag/…` | `No working app info is available` |
| `/@handle` | `Failed to parse JSON` |

**Reihenfolge ist wichtig geworden.** Die Trefferadressen sind von der
Suchmaschine *sortiert*, die aus dem Seitentext stehen in zufälliger
Seitenreihenfolge. Da eine einzige Anfrage über 200 Adressen liefern kann und
die Obergrenze bei 60 Abrufen liegt, entscheidet die Reihenfolge, **welche 60**
geprüft werden. Deshalb: erst die sortierten, dann die Masse.

### Pause zwischen den Abrufen

`pause_zwischen_anfragen_sek` stand in der Konfiguration, wirkte im geführten
Ablauf aber **nicht**: Weitergereicht wurde sie als `--sleep-requests`, und das
bremst nur *innerhalb* eines yt-dlp-Aufrufs. Jeder Abruf ist aber ein eigener
Prozess mit genau einer Adresse — zwischen zwei Abrufen lag nichts.

Das ist keine Theorie: Nach rund **50 Abrufen ohne Pause** beantwortete TikTok
auch eine Adresse nicht mehr, die eine Stunde vorher noch funktioniert hatte.
Ein Lauf, der in die Ratenbegrenzung fährt, bringt gar nichts mehr — die Pause
ist also nicht bloß Anstand, sie ist der günstigere Weg. Umso wichtiger, seit
eine Anfrage über hundert Adressen liefert.

### Wenn TikTok aufhört zu antworten

Ein einzelner Fehlschlag heißt „dieses Video gibt es nicht mehr". **Fünf
hintereinander, ohne einen einzigen Erfolg dazwischen**, heißen etwas anderes:
Die Gegenseite redet nicht mehr mit uns. Dann hört der Lauf auf und sagt das —
statt die restlichen Adressen ebenfalls abzuklopfen und jedes Mal dieselbe
Antwort zu bekommen.

Die Meldung dazu lautet `Unexpected response from webpage request` und passt in
**kein** Sperrmuster (`captcha`, `429`, `rate limit`) — sie sieht aus wie ein
gewöhnlicher Einzelfehler. Erkannt wird sie deshalb am **Muster**, nicht am
Wortlaut.

> Zwei Ursachen, in dieser Reihenfolge: (1) zu viele Abrufe in kurzer Zeit —
> später erneut versuchen; (2) veraltetes yt-dlp — `py -m pip install --upgrade
> yt-dlp`. Beide erzeugen dieselbe Meldung, was schon einmal einen Tag gekostet
> hat.

### Es wird nachgelegt, bis die Zahl steht

Suchbegriffe gehen **einer nach dem anderen** raus, nicht alle vorweg. Der
nächste erst, wenn die Warteschlange leer und die gewünschte Zahl noch nicht
erreicht ist. Reihenfolge im Ganzen:

1. fest hinterlegte Adressen aus `tiktok-quellen.json`
2. Suchbegriff 1 → prüfen → reicht es? → Suchbegriff 2 → …
3. sind alle Begriffe durch: **zweite Runde** mit den zurückgestellten
4. erst dann Schluss — mit Angabe, **warum** (Begriffe erschöpft,
   Anfrage-Obergrenze, Suche nicht möglich)

Das spart nebenbei Abfragen: Bei 48 hinterlegten Begriffen wären 48 Anfragen im
Voraus reine Verschwendung, wenn die erste schon reicht. Die Obergrenzen aus
`standard` gelten unverändert — `max_anfragen` (60) begrenzt die Anfragen an
TikTok, `max_downloads` die Dateien.

**Ein Begriff bekommt nur sein Kontingent.** Seit die Adressen aus dem Seitentext
kommen, liefert eine Anfrage über 200 Stück. Ungebremst arbeitet der Lauf die
alle ab, rennt in die 60er-Grenze und kommt nie zu Begriff 2 — live gemessen:
*„0 von 3 geladen, 60 Adressen geprüft, 1 von 24 Suchbegriffen gebraucht."* Zwei
Dutzend gute Begriffe blieben ungenutzt. Jeder Begriff nimmt deshalb nur
`max_kandidaten_je_quelle` (Standard 20) — vorne stehen ohnehin die von der
Suchmaschine sortierten. Der Rest wandert in eine **Reserve** und kommt dran,
wenn alle Begriffe durch sind. Danach: *3 von 3 geladen, 20 Adressen geprüft.*

**Die Obergrenze stoppt nicht, was schon geprüft ist.** Sie zählt *Abrufe* bei
TikTok; zurückgestellte Kandidaten brauchen keinen einzigen mehr, ihre Angaben
liegen vor. Sie mit abzuwürgen war schlicht falsch — ein Lauf endete mit „2 von
3", während 39 fertig geprüfte Kandidaten unangetastet in der zweiten Reihe
standen.

Die letzten beiden gehen zwangsläufig erst *nach* dem Laden: Vorher gibt es
weder eine Prüfsumme noch eine Tonspur zum Anhören. Fällt eine davon, wird die
Datei wieder entfernt.

**Vergleichsregel — kurz ist nicht gleich lang.** Ein Begriff ab 5 Zeichen darf
*im* Wort stehen, damit `dispenser` den Hashtag `#waterdispenser` trifft.
Kürzere müssen ganze Wörter sein, sonst findet `cup` jedes „cupcake", `eis`
jede „Reise" und `cat` jede „Kategorie". Dieselbe Regel gilt für Kernwörter —
erst dadurch lassen sich gängige kurze Bezeichnungen wie `jug` oder `gallon`
überhaupt eintragen.

**Ausschlusswörter** werden dagegen als *Wortanfang* verglichen (`fellnase`
trifft „Fellnasen"). Genau deshalb stehen dort keine Kurzformen: `pet` träfe
„Peter" und „petite", `cat` jede „Kategorie" und jedes „Catering".

**Mehrere Wörter treffen als Wendung.** Die braucht es für Geräte, deren
Bezeichnung aus lauter harmlosen Wörtern besteht. Live nachgewiesen: Ein
Standgerät („Fujidenzo **Bottom Load** water dispenser") und eine fest verbaute
Anlage („**water filter** dispenser system") kamen durch — beide mit nur *einem*
allgemeinen Merkmal (`pump`, `gallon`). `bottom` allein auszuschließen wäre
unbrauchbar, die Wendung trennt sauber. Beide Dateien wurden nachträglich
entfernt.

### Was ein Kernwort sein darf — und was nicht

Ein **Kernwort benennt das Gerät**. Es ist kein Behälter, auf dem das Gerät
steht, und kein Ort, an dem es steht.

Das klingt selbstverständlich und war es nicht: `jug` und `carafe` standen als
Kernwörter für den Wasserspender, weil das Gerät auf einem Kanister sitzt.
Damit kamen zwei Videos durch, die schlicht ein **Gefäß** zeigen:

> „Replying to @Jazzy My bed side water set up ✨ I use a smaller **jug** just for…"
> „**Bedside carafe and cup set** for my nightstand ✨ #marshallsfinds"

Beide sind jetzt **Merkmale** statt Kernwörter — dort gehören sie hin, denn
„sitzt auf einem Kanister" ist eine Eigenschaft des Geräts. Als alleiniger
Nachweis, dass es um ein Spendergerät geht, taugen sie nicht.

### Verneinungen entwerten den Treffer

> „Genius DIY Water Dispenser – **No Electricity** Needed"

Angenommen, weil das Merkmal `elektrisch` im Wort „Electricity" steckt — in
einem Satz, der wörtlich das Gegenteil sagt. Steht unmittelbar davor ein
verneinendes Wort (`no`, `without`, `ohne`, `kein`, `nicht`, `statt`), zählt
der Treffer nicht.

**Bewusst nur ein Wort Abstand.** Ein größeres Fenster macht mehr kaputt als es
repariert:

> „**No** More Heavy Water Bottles! **USB** Rechargeable Automatic Water Pump"

Hier stehen vier Wörter zwischen „No" und „USB", und das Video ist genau das
Produkt. Ein Test hält beide Fälle fest.

### Gemessen an echten Untertiteln

Die Prüfkette wurde nicht an ausgedachten Beispielen entwickelt, sondern an
**80 echten Untertiteln**, gesammelt aus dem Herkunftsnachweis und den
Laufprotokollen dieses Projekts. Ergebnis:

| | angenommen | davon falsch |
|---|---|---|
| vorher | 22 | **4** |
| nachher | 18 | **0** |

Kein einziger richtiger Treffer ging dabei verloren — die vier Ausfälle waren
genau die vier Fehlgriffe. Jeder hatte eine eigene Ursache (Tierprodukt,
Verneinung, zweimal Behälter statt Gerät), und jeder steht als Test mit dem
echten Untertitel im Testlauf.

### Woran die Sprache des Untertitels erkannt wird

Zwei Merkmale, in dieser Reihenfolge:

1. **Funktionswörter** — „der/die/das/und/ist" gegen „the/and/is/for/with".
   Bewusst keine Inhaltswörter: „wasserspender" steht auch unter englischen
   Videos, „der" nicht. Umlaute zählen zusätzlich für Deutsch.
2. **Der zweisprachige Wortschatz des Produkts** — aber nur, wenn (1) schweigt.
   Aus den Suchbegriffen beider Sprachen wird behalten, was **nur in einer**
   Liste vorkommt: `wasserspender` verrät Deutsch, `dispenser` Englisch;
   `smart` und `gadget` stehen in beiden und verraten nichts.

Der Grund für (2): Gemessen an 36 echten Untertiteln bestanden **7** nur aus
Hashtags und enthielten kein einziges Funktionswort. „Smart table water
dispenser #tiktokshop" ist unübersehbar englisch, galt aber als *nicht
entscheidbar* und flog raus. Mit dem Wortschatz sinkt das von 7 auf 1 — **ohne
dass ein einziger Untertitel anders eingeordnet wird**, denn (2) greift nur bei
Gleichstand. Ein englischer Hashtag unter einem deutschen Satz überstimmt die
Funktionswörter nicht.

Die Prüfung bleibt streng: Verlangt ist ein **positiver Nachweis** der gewählten
Sprache. „Nicht entscheidbar" fällt weiterhin durch — es gibt jetzt nur eine
zweite Quelle für den Nachweis.

### Warum die Ausgabe von yt-dlp byteweise zusammengesetzt wird

Node reicht die Ausgabe eines Programms blockweise herein, und die Blockgrenze
fällt irgendwohin — auch mitten in ein Zeichen. „ü" sind als UTF-8 zwei Bytes;
liegt das erste am Blockende, ergibt jede Hälfte für sich gelesen Zeichenmüll.
Bei einer JSON-Ausgabe von zehntausenden Zeichen ist das kein Sonderfall.

Auffallen würde es nirgends — es stünde nur plötzlich Unsinn im Untertitel, und
Spracherkennung, Kernwort und Bewertung griffen alle daneben, **ausgerechnet bei
den deutschen Videos**, denn nur die haben Umlaute. Deshalb werden erst die
Bytes zusammengelegt und dann einmal am Stück gelesen (`textAusPuffern`).

---

## 7. Was auf der Platte landet

Alles unter `Marketing/data/tiktok-quellen/` — respektiert `MARKETING_DATA_DIR`,
ist **gitignored**, kollidiert nicht mit `Marketing/videos/` und wird vom
Ablauf `cleanup_assets` nicht angefasst.

| Datei | Inhalt |
|---|---|
| `<produkt-id>_<video-id>.mp4` | das Video |
| `<produkt-id>_<video-id>.info.json` | die Metadaten von yt-dlp (`--write-info-json`) |
| `index.json` | **der Herkunftsnachweis** — siehe unten |
| `pruefliste.json` | alles, was **nicht** geladen wurde, mit Grund |

Ein Eintrag in `index.json`:

```json
{
  "produkt_id": 10,
  "produkt_name": "Elektrischer Wasserspender für Schreibtisch",
  "video_id": "7300000000000000001",
  "quelle_url": "https://www.tiktok.com/@handle/video/7300000000000000001",
  "creator": "@handle",
  "titel": "Elektrischer Wasserspender am Schreibtisch im Test",
  "zeitstempel": "2026-08-18T12:00:00.000Z",
  "datei": "10_7300000000000000001.mp4",
  "groesse_bytes": 2841733,
  "sha256": "…",
  "trefferwert": 1,
  "rechte_geprueft": false
}
```

`rechte_geprueft` beginnt **immer** bei `false` und wird **nur von Hand**
umgestellt — nachdem geklärt ist, ob das Material überhaupt verwendet werden
darf. Der Wert ist der einzige Grund, warum `creator` und `quelle_url`
mitgeschrieben werden: Ohne die Herkunft ist die Frage später nicht mehr zu
beantworten.

**Wiederholte Läufe überspringen alles, was schon im Index steht** — erkannt an
Quell-URL *oder* Video-ID (dasselbe Video taucht unter mehreren Adressen auf).
Der Index wird nach **jedem** Download geschrieben, damit ein Abbruch mittendrin
die Herkunft der bereits geladenen Dateien nicht verliert.

Der Index führt dafür **zwei** Listen:

| Liste | enthält | wozu |
|---|---|---|
| `eintraege` | voller Herkunftsnachweis | Rechtefrage: wem gehört die Datei |
| `frueher_geladen` | nur Produkt, Video-ID, Adresse, Datum | Gedächtnis: schon einmal dagewesen |

Übersprungen wird, was in **einer von beiden** steht. Wer eine Datei wegwirft,
will sie meist nicht beim nächsten Lauf zurückbekommen — Herkunftsangaben
braucht es dafür aber nicht mehr, es gibt ja keine Datei, für die sie gälten.
Einträge wandern per `npm run tiktok:aufraeumen` von der ersten in die zweite
Liste.

---

## 8. Obergrenzen

Alles in `bot/tiktok-quellen.json` unter `standard`:

| Wert | Standard | wogegen |
|---|---|---|
| `max_downloads` | 5 | ein Lauf, der den Ordner vollmüllt (`--max`) |
| `max_anfragen` | 60 | hunderte Anfragen über 40 Produkte hinweg |
| `max_kandidaten_je_quelle` | 20 | endlose Hashtag-Seiten |
| `max_dateigroesse` | `40M` | einzelne Riesendateien |
| `pause_zwischen_anfragen_sek` | 3 | zu dichtes Anfragen (`--sleep-requests`) |
| `wiederholungen` | 2 | Dauerschleifen bei Fehlern (`--retries`) |

Greift `max_dateigroesse`, endet yt-dlp mit **Rückgabewert 0** und schreibt
trotzdem keine Datei. Der Bot glaubt deshalb nicht dem Rückgabewert, sondern
schaut nach, ob eine Datei da ist — sonst stünde ein Eintrag ohne Datei im Index.

---

## 9. Wenn etwas klemmt

Zuerst immer: `npm run tiktok:status`.

| Bild | Ursache | was tun |
|---|---|---|
| `❌ yt-dlp nicht gefunden` | nicht installiert oder nicht im PATH | §2; in einer **neu gestarteten** Shell probieren, sonst `YTDLP_PATH` setzen |
| `Stichwortsuche: nein` | diese yt-dlp-Version kann es nicht | (a) und (b) benutzen — feste URLs und Hashtags in die Konfiguration |
| Alles in der Prüfliste, nichts geladen | Trefferwerte unter der Schwelle | Prüfliste ansehen; passen die Treffer, `stichworte` im Konfigurationseintrag schärfen — **nicht** einfach die Schwelle senken |
| `⏹ Notaus aktiv` | `Marketing/STOP` oder `MARKETING_ENABLED=false` | erwartet — §4 |
| `⚠️ dieses Video ist gesperrt` | **einzelnes** Video regionsgesperrt (`blocked from accessing this post`) | erwartet — das Video wird übersprungen, der Lauf geht weiter |
| `❌ TikTok blockt` | Ratenbegrenzung oder CAPTCHA — betrifft die **ganze Leitung** | **abwarten.** Der Lauf endet dabei nur, wenn `bei_sperre_abbrechen` auf `true` steht (Standard: `false`, es wird weitergemacht). Weitermachen holt aber kein Video — es erzeugt nur weitere Fehlversuche. Wirksam gegen künftige Sperren ist `pause_zwischen_anfragen_sek` hoch, `max_anfragen` runter. |
| `keine Datei entstanden` | größer als `max_dateigroesse` | Grenze erhöhen oder das Video auslassen |
| `Index … ist nicht lesbar` | `index.json` beschädigt | **prüfen, nicht löschen** — ein leerer Index lädt alles neu und verliert die Herkunftsangaben |

Alles Übersprungene wird mit Grund protokolliert. Ein stiller Fehlschlag sieht
aus wie Betrieb und ist damit schlimmer als ein lauter — dieselbe Leitlinie wie
im Marketing-Automaten.

---

## 10. Tests

```bash
npm test                                  # sammelt test/*.test.js über test/lauf.js
node --test test/tiktok-video-sync.test.js
```

Die Tests brauchen **kein Netz und kein installiertes yt-dlp**: Alles, was
yt-dlp startet, läuft durch **eine** Funktion, und die wird im Test durch einen
Nachbau ersetzt. Der Nachbau legt beim Download tatsächlich eine Datei an —
sonst blieben Größe und Prüfsumme im Index ungeprüft.

Projektregel aus `CLAUDE.md` §2: **Ein Test, der nur grün werden kann, ist
wertlos.** Zu jeder Prüfung steht eine Gegenprobe daneben:

| Prüfung | Gegenprobe, die belegt, dass der Test rot gemeldet hätte |
|---|---|
| Trockenlauf lädt nichts | derselbe Fall mit `--laden` lädt sehr wohl |
| unter der Schwelle wird nicht geladen | mit Schwelle 0 landet auch das Katzenvideo im Ordner |
| indizierte URL wird übersprungen | bei leerem Index lädt derselbe zweite Lauf |
| `Marketing/STOP` hält an | ohne die Datei läuft genau derselbe Aufruf durch |
| Füllwörter zählen nicht | mit „fuer" in der Begriffsliste punktet ein Pfannkuchenvideo für einen Wasserspender |
| Umlaute werden angeglichen | reines Kleinschreiben findet „kuechenwaage" in „Küchenwaage" nicht |
| Suche wird nicht geraten | mit Extractor **und** Präfix entsteht die Quelle sehr wohl |

---

## 11. Verwandte Dokumente

* `Marketing/README.md` — der Marketing-Automat: Notaus (§4), Abläufe (§7),
  Umgebungsvariablen (§9). Dieser Bot ist **nicht** Teil davon, teilt sich aber
  Notaus und Ablageort.
* `CLAUDE.md` §2 (Befehle), §3 (Landkarte), §8 (Konventionen).
* `bot/tiktok-quellen.json` — die Suchkonfiguration selbst; die
  Kommentare darin erklären jedes Feld an Ort und Stelle.
