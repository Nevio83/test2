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

## 5a. In welcher Reihenfolge gesucht wird

Drei Fragen entscheiden, wo das Abrufbudget landet: **wo** gesucht wird, **bei
wem** und **womit**. Alle drei wurden bis zum 18.09.2026 gar nicht gestellt —
der Lauf nahm schlicht die Reihenfolge, in der die Sachen in den Dateien
standen.

### Wo: das Produkt mit der größten Lücke zuerst

Ein Ladelauf hört auf, sobald `max_downloads` erreicht ist. Vorher lief er
`products.json` von vorne durch, also bekam Produkt 10 in jedem Lauf das ganze
Budget. Gemessen am 18.09.: **3 von 41 Produktordnern gefüllt**.

Jetzt gilt ein Zielwert je Produkt (`ziel_clips_je_produkt`, Standard 15). Der
Lauf sortiert die Produkte nach der Lücke zum Ziel, größte zuerst; bei
Gleichstand entscheidet die kleinere Nummer, damit zwei Läufe dieselbe
Reihenfolge ergeben.

**Volle Produkte fallen nicht heraus** — sie rutschen ans Ende. Sonst fände ein
Trockenlauf über alle Produkte eines davon nie wieder, und niemand sähe, dass es
fehlt.

`npm run tiktok:status` zeigt dieselbe Rechnung als Liste, samt fertigem Befehl
für das Produkt, das am dringendsten dran ist.

### Bei wem: Creator, die schon geliefert haben

Die Spalte `creator` wird seit dem ersten Tag mitgeschrieben und wurde nie
gelesen. Dabei ist sie das stärkste Signal im Index: Wer zweimal brauchbares
Material zu einem Produkt gemacht hat, macht mit hoher Wahrscheinlichkeit mehr
davon.

Ab **zwei** angenommenen Clips wird das Profil des Creators bei jedem weiteren
Lauf für dieses Produkt mit abgefragt — vor Hashtags und Suche. Einer kann
Zufall sein, zwei sind ein Muster. Gezählt wird je Produkt: Wer beim
Wasserspender liefert, liefert nicht zwangsläufig beim Mixer.

Von Hand unter `creators` eingetragene Profile werden nicht doppelt abgefragt
(der Vergleich ignoriert den Schrägstrich am Ende).

**Ablehnungen zählen hier nicht mit.** Sie fallen, bevor etwas geladen ist — da
gibt es nur den Untertitel aus dem Seitentext, keinen Creator. „Ab drei
Ablehnungen fliegt er raus" wäre eine Regel ohne Daten.

Nebeneffekt für die Rechtefrage: Ein Profil liefert Videos **eines** Menschen.
Zweimal denselben anzuschreiben ist ungleich einfacher als vierzig Einzelfälle.

### Womit: erschöpfte Suchbegriffe wandern nach hinten

`bot/tiktok-quellen.json` hält 492 deutsche Suchbegriffe über 40 Produkte, die
längste Liste hat 24 (Produkt 10). Der Lauf kommt nie bis zum Ende — er hört
auf, sobald seine Zahl steht. Im Protokoll vom 18.09. steht der Normalfall:

```
0 von 3 geladen, 60 Adressen geprueft, 1 von 24 Suchbegriffen gebraucht
```

Ohne Gedächtnis fängt der nächste Lauf wieder bei Begriff 1 an. Die Begriffe 2
bis 24 kommen nie dran, und das Budget geht an eine Themenseite, die schon
abgegrast ist — gemessen: der zweite Lauf mit identischem Aufruf brachte **0
Downloads**.

Der Index führt deshalb je Produkt und Begriff Buch:

| Feld | Bedeutung |
|---|---|
| `zuletzt_benutzt` | wann der Begriff zuletzt rausging |
| `zuletzt_neu` | wann er zuletzt eine noch unbekannte Adresse brachte |
| `leer_seit` | seit wann er leer ausgeht (der **erste** Leerlauf, nicht der letzte) |
| `leer_in_folge` | wie oft hintereinander |

Gezählt wird, was **wirklich** neu ist — weder in diesem Lauf schon gesehen noch
aus einem früheren bekannt. „20 Adressen" klingt nach Ertrag; sind es dieselben
20 wie letzte Woche, ist der Begriff erschöpft.

Die Reihenfolge ergibt sich daraus in fünf Stufen:

1. wach vor ruhend
2. nie benutzte zuerst — sie sind der unerschlossene Teil
3. dann die, die am längsten nicht dran waren
4. dann die mit den wenigsten Leerläufen hintereinander
5. bei Gleichstand die ursprüngliche Reihenfolge

**Ruhezeit**: `begriff_ruhe_tage` (Standard 21), multipliziert mit der Zahl der
Leerläufe hintereinander und gedeckelt bei Faktor 6. Einmal leer heißt 21 Tage
Pause, dreimal leer 63, zwanzigmal leer trotzdem nur 126.

**Aussortiert wird nichts.** Eine Themenseite füllt sich nach; ein erschöpfter
Begriff wird nur befristet gebremst. Der Deckel ist genau dafür da: Ohne ihn
wäre ein Begriff nach genug Leerläufen faktisch ausgemustert.

Gemessen an Produkt 10 über zehn aufeinanderfolgende Läufe, in denen jeder
Begriff leer ausging:

| | verschiedene Begriffe in 10 Läufen |
|---|---|
| vorher | 1 |
| nachher | 10 |

Zwei Fallstricke stecken in der Sortierung, beide beim Bauen aufgelaufen:

- **Nicht nach dem letzten Fund sortieren.** Ein Begriff, der noch nie etwas
  geliefert hat, hat kein Funddatum — das zählt als Jahr 0, und Jahr 0 ist älter
  als alles. Ausgerechnet der aussichtsloseste Begriff bekäme das Budget.
- **Leerläufe nicht als feste Stufe davor.** Dann käme ein Begriff mit fünf
  Leerläufen nie wieder dran, solange irgendein anderer bei null steht. Das ist
  Aussortieren durch die Hintertür.

Der letzte **Gebrauch** löst beides: immer gesetzt, sobald ein Begriff einmal
draußen war, und er wächst bei jedem, der wartet. Das Bremsen übernimmt allein
die Ruhezeit.

**Die Bilanz wird auch dann gespeichert, wenn der Lauf nichts lädt.** Der Index
wurde vorher nur beim erfolgreichen Download geschrieben — also war die Bilanz
genau in dem Fall weg, für den sie da ist. Aufgefallen ist das erst im
Durchlauf, nicht im Einzeltest der Sortierfunktion.

---

## 5b. Was vor dem Laden geprüft wird — und was danach

### Technisch unbrauchbar, bevor der Abruf rausgeht

Neun Hürden prüfen, ob es das **richtige Produkt** ist. Eine prüft, ob der Clip
überhaupt **brauchbar** ist: mindestens `min_hoehe` (720) Pixel, mindestens
`min_dauer_sek` (5) Sekunden, Querformat nur wenn `quer_ablehnen` gesetzt ist.

Sie steht bewusst am Ende der Vorprüfung — die Textprüfungen sind billiger, und
was inhaltlich nicht passt, muss gar nicht erst vermessen werden. Aber sie steht
**vor dem Download**. Ein Abruf für 480p-Querformat ist keiner zu viel, sondern
einer zu blind, und das zählt doppelt, seit bekannt ist, dass nach rund 50
Abrufen die Sperre kommt.

Der geführte Ablauf tat das seit jeher. Der **Sammellauf über alle Produkte tat
es nicht** — dort ging ein Drei-Sekunden-Clip mit perfektem Untertitel als
Download raus, und die Ausgangsprüfung des Automaten lehnte ihn am Ende ab. Der
Abruf war da schon verbraucht. Seit dem 20.09. gilt die Hürde in beiden Wegen.

**Eine fehlende Angabe ist keine Aussage.** Mit `--flat-playlist` liefert yt-dlp
nicht immer Höhe und Breite; die Dauer steht meist da. Geprüft wird nur, wo eine
Angabe ist — sonst fiele bei jeder Quelle, die keine Maße mitschickt, alles
durch.

### Fremde Werbung: markiert, nicht abgelehnt

Ein Teil des Materials ist die Werbung eines Mitbewerbers — fremder Rabattcode,
fremder Shop, Kennzeichnungshinweis. Erkannt wird das am **Rohtext**, nicht am
normalisierten: `videoText()` macht aus `#ad` ein bloßes `ad` und schreibt alles
klein, und damit wäre `Code SAVE20` von jedem Satz mit dem Wort „code" nicht mehr
zu trennen.

| Art | Beispiele |
|---|---|
| Kennzeichnung | „Werbung", „gesponsert", `#ad`, `#sponsored` |
| Rabatt | „Rabattcode", „promo code", `Code SAVE20`, „20% off" |
| Kaufweg | „link in bio", „shop now", „jetzt kaufen" |
| fremder Shop | „TikTok Shop", „temu", „aliexpress" |

Eine **Kennzeichnung allein** genügt — sie steht da, weil jemand rechtlich dazu
verpflichtet ist. Sonst braucht es **zwei** Arten: „shop now" rutscht in jede
zweite Unterschrift, und daraus einen Mitbewerber zu machen wäre geraten.

Was einen Rabattcode von einem Wort unterscheidet: eine **Ziffer** oder
durchgehende **Großschreibung**. Zwei frühere Fassungen scheiterten daran — eine
zu streng (nur Großbuchstaben, damit fiel „code save20" durch), eine zu weich
(`/i` über alles, damit traf „no code needed").

**Abgelehnt wird nicht.** Die Erkennung ist Textarbeit und damit unscharf; eine
Markierung darf danebenliegen, eine Ablehnung soll es nicht. Und der markierte
Bestand ist nebenbei die laufende Mitbewerber-Beobachtung, die sonst niemand
macht.

Gemessen an **15 echten Untertiteln** aus dem Herkunftsnachweis: **0
Fehlalarme**, nicht einmal ein Einzelsignal unterhalb der Schwelle.

### Drei Zustände je Clip

| Zustand | heißt |
|---|---|
| `vorrat` | geladen, noch nicht beurteilt — die Vorgabe |
| `verwendet` | steckt in einem Beitrag |
| `verworfen` | angesehen und aussortiert, **mit Grund** |

Ein Eintrag ohne Feld gilt als `vorrat`. Das ist die ehrliche Lesart:
`verwendet` wäre geraten, `verworfen` eine Behauptung über Material, das niemand
angesehen hat.

Der Grund ist beim Verwerfen **Pflicht und kommt aus einer festen Liste**
(`falsches_modell`, `zu_dunkel`, `fremdes_wasserzeichen`, `person_im_bild`,
`ton_unbrauchbar`, `doppelgaenger`, `fremde_werbung`, `technisch`). Freitext
ließe sich nicht zählen — „zu dunkel", „düster" und „schlecht belichtet" wären
drei Gründe statt einem. Ein eigener Satz darf als `notiz` daneben stehen, nicht
an seiner Stelle. Bei `vorrat` und `verwendet` gibt es nichts zu begründen; ein
Pflichtfeld dort erzeugt nur Füllwörter.

Ein unbekannter Zustand oder Grund bricht den Lauf **nicht** ab, sondern kommt
als Antwort zurück — ein Tippfehler soll keinen Lauf beenden.

---

## 5c. Was der Zustandsbericht seit dem 20.09. zusätzlich sagt

### Platz und Alter (`npm run tiktok:status`)

Gezählt wird, **was wirklich auf der Platte liegt** — nicht die Zahl der
Indexeinträge. Ein Eintrag ohne Datei belegt keinen Platz. Das Alter kommt aus
dem **Eintrag**, nicht vom Dateidatum: Eine Datei, die beim Umkopieren einen
neuen Zeitstempel bekam, ist deshalb kein neueres Material.

Aufbewahrung: **verworfenes** Rohmaterial älter als 90 Tage wird als Kandidat
genannt. Verwendetes und Vorrat bleiben — die Frist ist eine Platzregel, keine
Bewertung. **Gelöscht wird nichts automatisch**, und der Indexeintrag mit
Prüfsumme bleibt in jedem Fall: Sonst lädt der nächste Lauf genau das wieder,
was eben weggeworfen wurde.

### Werkzeugversionen

Die ganze Kette hängt an zwei fremden Programmen. yt-dlp ändert sich fast
wöchentlich, weil sich die Plattformen ändern — die Lehre aus dem
`CURRENTLY BROKEN`-Marker am Hashtag-Extractor ist genau die: Fähigkeiten
verschwinden, ohne dass jemand es sagt.

Jeder Lauf schreibt `yt_dlp`, `ffmpeg`, `node` und die Fähigkeiten in den Index,
und der nächste vergleicht. Eine Änderung steht dann in einer Zeile da statt in
einer Stunde Suche:

```
🔧 yt-dlp 2026.09.15 · ffmpeg 6.1.1 · node v22.22.2 · Hashtag nein · Suche ja
   ⚠️  seit dem letzten Lauf geaendert — Hashtag-Extractor: true → false
```

Ein **neu hinzugekommenes Feld ist keine Änderung am Werkzeug**, sondern eine an
diesem Programm — verglichen werden nur Felder, die in beiden Ständen stehen.
Sonst meldet der erste Lauf nach einem Update lauter Wechsel, die keine sind.

Der Werkzeugstand kostet **keinen zusätzlichen Abruf**: Die yt-dlp-Version fällt
bei `findeYtdlp()` ohnehin ab, die Fähigkeiten stehen nach `--list-extractors`
fest. Der geführte Ablauf schreibt sie **ohne** Fähigkeitsfelder — er ruft
`--list-extractors` gar nicht auf, und sie zu füllen hieße, sie zu erfinden.

### Ablage und Herkunft

Zwei Prüfungen, die melden statt zu handeln:

**Ablage** — zeigt ein Indexeintrag aus `Marketing/videos/rohmaterial/` oder
`Marketing/videos/geschnitten/` heraus? Die `.gitignore` macht die Regel seit dem
18.09. am **Ordner** fest statt am Dateinamen, weil sie beim Umbenennen zweimal
auseinanderfiel und fremde Videos prompt im `git status` standen. Diese Prüfung
ist die Gegenprobe dazu: Sie schützt davor, dass etwas an einem Ort landet, den
die `.gitignore` nie gesehen hat.

**Herkunft im Namen** — und hier steht ein unerfreulicher Befund. Der Bot tauft
geladenes Fremdmaterial auf `NN_<slug>_<dauer>s_stil-b.mp4`. Das ist **exakt die
Form der eigenen Renderings**; „stil-b" heißt dort „KI-erzeugt". Am Dateinamen
ist fremdes Material also nicht mehr von eigenem zu unterscheiden. Das alte
Schema konnte das — nach dem letzten Unterstrich standen die Ziffern der
TikTok-ID, und genau daran erkennt die `.gitignore` den Altbestand bis heute.

Umbenannt wird trotzdem **nichts**: Jeder Indexeintrag zeigt auf seinen
Dateinamen, ein Umtaufen im Hintergrund bricht sie alle auf einmal. Der Bericht
nennt die betroffenen Dateien samt Vorschlag; der Umzug ist ein eigener,
bewusster Schritt. Die Ordnerregel bleibt die eigentliche Absicherung — der Name
ist der zweite Gürtel, und der sitzt derzeit locker.

---

## 5d. Rechte, Anfragen und die wachsende Messlatte

### Rechteakte je Clip

Der Materialkatalog des Automaten sperrt hart: „Ein Asset ohne Lizenzeintrag
kommt nicht ins Video. Punkt." Für fremde TikTok-Clips — das Material mit dem
**höchsten** Risiko — galt bis zum 20.09. nur ein `rechte_geprueft: true`. Ein
Wahrheitswert kann keine Einwilligung belegen: Was, wann, durch wen und in
welchem Umfang geprüft wurde, stand nirgends.

Jeder Eintrag trägt jetzt eine Akte:

| Feld | heißt |
|---|---|
| `art` | `eigen`, `einwilligung`, `lizenz` oder `keine` |
| `datum` | wann die Erlaubnis erteilt wurde |
| `inhaber` / `kontakt` | wer, und wie erreichbar (fällt aus `creator` und `quelle_url` ab) |
| `beleg` | Screenshot, Mail, Lizenzdatei |
| `zwecke` | `organisch` und/oder `anzeige` — **getrennt** |
| `bis` | wann sie ausläuft, falls befristet |
| `widerrufen_am` | gesetzt beim Widerruf; der Eintrag bleibt |

**Die Zwecke sind getrennt, weil sie es rechtlich sind.** Eine Einwilligung für
einen organischen Beitrag deckt keine bezahlte Anzeige — das ist der häufigste
Punkt, an dem eine Zusage endet.

**Ein altes Häkchen wird nicht aufgewertet.** Es gilt als „geprüft, Art
unbekannt", und die Sperre bleibt zu. Aus einem Wahrheitswert nachträglich eine
Einwilligung zu machen wäre genau die Behauptung, die dieser Punkt abstellt.

Beim Widerruf bleibt die Akte lesbar. Ein gelöschter Eintrag wäre das Gegenteil
eines Nachweises — und ein Video lässt sich auf TikTok nicht nachträglich kurz
zurückholen.

Was das Programm **nicht** entscheidet: ob eine Erlaubnis rechtlich trägt. Das
ist keine Frage, die ein Programm beantwortet. Festgehalten wird, was vorliegt
und was fehlt.

### Anfragen an Creator

```bash
node tiktok-video-sync.js --anfragen --absender "Nevio (Maios)" --produkt 10 \
  --zwecke organisch anzeige --dauer "12 Monate" \
  --gegenleistung "das Gerät geschenkt"
```

**Verschickt wird nichts.** Der Text geht ins Protokoll, abgeschickt wird er von
Hand. Eine Nachricht, die ein Programm ungelesen an einen fremden Menschen
schickt, ist genau das, was eine Anfrage unglaubwürdig macht.

**Ein Creator, eine Nachricht** — und darin stehen *alle* seine Clips. Wer elf
Clips desselben Menschen geladen hat, schreibt ihn nicht elfmal an; aber eine
Anfrage, die „dein Video X" sagt und später elf verwendet, ist auch keine
Einwilligung für die elf. Die Creator mit den meisten Clips kommen zuerst, denn
dort lohnt eine dauerhafte Absprache (§5a, Punkt 02).

Der Text nennt Umfang, Dauer, Nennung und Gegenleistung, und er sagt zu, dass
der Clip auf Wunsch wieder verschwindet. Der Rückzieher ist kein Beiwerk — er
ist der Grund, warum jemand überhaupt zusagt. Die Zeile zum **Umfang** ist
Pflicht: Genau sie fehlt ohne Vorlage.

Zwei Kleinigkeiten, die beim Ansehen des ersten Ausdrucks auffielen: Der
Produktname kommt im Nominativ aus `products.json`, „ich verkaufe" verlangt den
Akkusativ — deshalb steht dort ein Doppelpunkt statt einer geratenen Beugung.
Und wenn Creator-Name und Profiladresse auseinandergehen, wird das gemeldet:
Dann führt die Anfrage womöglich zum falschen Konto.

### Die Messlatte wächst mit

Die Prüfkette wurde an **80 echten Untertiteln** aus den eigenen Protokollen
entwickelt: vorher 22 angenommen, davon 4 falsch — nachher 18 angenommen, 0
falsch, ohne dass ein richtiger Treffer verlorenging. Die Sammlung wuchs aber
nicht mit; bei 492 Suchbegriffen und 403 Kernwörtern, die weiterwachsen, bliebe
die Messlatte im August stehen.

Jeder Lauf schreibt seine Urteile der **Textkette** nach `urteile.json` neben
den Index — Untertitel, Produkt, Urteil, Trefferwert. Was nach dem Laden
entschieden wird (Doppelgänger, Ton, schwarze Balken), ist kein Urteil über
einen Untertitel und gehört nicht hinein.

Erkannt wird ein bekannter Fall an der **Video-ID**, nicht am Text: Derselbe
Clip taucht unter mehreren Adressen auf. Ändert sich sein Urteil, wird das
festgehalten (`vorher`, `geaendert_am`) statt überschrieben — **das** ist der
Wert der Sammlung. Wer die Wortlisten verschärft, sieht sofort, wie viele früher
angenommene Clips jetzt durchfallen.

**Daraus wird kein Test erzeugt.** Die Sammlung ist Material zum Gegenlaufen.
Ein Test, der sich seine eigene Erwartung schreibt, kann nur grün werden — und
ein Test, der nur grün werden kann, ist wertlos (`CLAUDE.md` §2).

---

## 5e. Der Kontaktbogen entsteht jetzt von selbst

Den Kontaktbogen gibt es seit dem 18.09. als eigenen Befehl
(`npm run tiktok:bogen`). Ein Befehl, den man nach jedem Lauf von Hand tippen
muss, wird nach dem dritten Mal nicht mehr getippt — dabei ist die Sichtung der
teuerste Handgriff der ganzen Kette: 23 Clips einzeln öffnen war ein Nachmittag.

Seit dem 20.09. baut der geführte Ablauf ihn am Ende selbst, **nur wenn dieser
Lauf etwas geladen hat**. Ein Lauf ohne Fund hat nichts Neues zu zeigen, und der
alte Bogen liegt ja noch da. Fehlt ffmpeg oder ffprobe, wird das gesagt statt
geschwiegen; ein fehlgeschlagener Bogen färbt den Lauf nicht — die Videos
liegen da, der Index steht, das Blatt ist eine Lesehilfe.

Zwei Dinge, die dabei auffielen:

`kontaktbogen.js` verlangt `tiktok-video-sync.js`. Ein `require` oben am
Dateianfang wäre ein **Ring**: Beim Laden von `kontaktbogen.js` wären die
Exporte der anderen Datei noch leer und `sync.ladeIndex` undefined. Deshalb
steht das `require` im Lauf drin, nicht oben — und deshalb prüft ein Test beide
Ladereihenfolgen.

Und die Meldung stand zuerst **innerhalb** des Ablehnungsblocks, also hinter
`if (auswertung.length)`. Ein Lauf, in dem nichts abgelehnt wurde, zeigte den
Bogen damit nie an, obwohl er gebaut war und im Ordner lag. Gefunden hat das der
Durchlauf mit echtem ffmpeg, nicht das Lesen.

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

### Der Seitentext trägt mehr als die Adresse

Auf den Themenseiten steht die **komplette Bildunterschrift direkt hinter dem
Link** und davor die Zahl der **Likes**:

```
… **3.374**](https://www.tiktok.com/@x/video/706…?lang=en)

No more midnight trips to the kitchen for water! 😴 #waterdispenser
```

Beides wird mitgelesen (`fundeAusText`) und für zwei Dinge benutzt:

**1. Aussortieren, bevor ein Abruf fällig wird.** Gemessen an vier echten
Anfragen: 396 Funde, 338 mit brauchbarer Unterschrift, davon **168 (50 %)**
vorab durchgefallen — 168 gesparte Abrufe, rund 14 Minuten Laufzeit. Im
Livelauf danach: **17 ohne Abruf aussortiert, nur 5 echte Abrufe** (77 % der
Kandidaten geklärt, ohne TikTok anzufassen). Die Ablehnungen sind sichtbar
richtig: Brio-Standgeräte, Osmose-Anlagen, Stanley-Thermosbecher.

**Abgelehnt wird nur auf positiven Beweis.** Die Unterschrift kann
abgeschnitten oder leer sein; unter 25 Zeichen wird gar nicht geurteilt,
sondern normal abgerufen. Ein Abruf zu viel ist billiger als ein gutes Video,
das nie angesehen wurde. Gegenprobe an den 18 bisher angenommenen
Untertiteln: **keiner** fällt vorab durch.

**2. Nach Beliebtheit sortieren.** Die Adressen aus dem Seitentext stehen in
zufälliger Seitenreihenfolge. Da eine Anfrage über 200 liefert und das Budget
bei 60–300 Abrufen liegt, entscheidet die Reihenfolge, welche geprüft werden —
und ein Video mit 3374 Likes ist eher brauchbar als eines mit 12.

> **Zwei Fallen beim Auslesen**, beide selbst hineingetappt: Zwischen Klammer
> und Unterschrift stehen **Leerzeilen** — wer am ersten Zeilenumbruch
> abschneidet, bekommt einen leeren String und merkt nichts davon; die
> Vorprüfung läuft dann stumm ins Leere (**338 statt 12** Unterschriften nach
> der Korrektur). Und `**1,2K**` sind **1200**, nicht 12000: Mit K/M ist das
> Zeichen ein Dezimaltrenner, ohne Einheit ein Tausendertrenner.

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

### Derselbe Clip, neu kodiert

Dubletten erkennt der Index an drei Stellen: gleiche Quell-Adresse, gleiche
Video-ID (dasselbe Video unter mehreren Adressen) und gleiche SHA-256-Summe
(dieselbe Datei unter einem anderen Konto). Alle drei scheitern am häufigsten
Fall auf TikTok: Ein **Repost wird neu kodiert** — andere Auflösung, andere
Bitrate, manchmal ein schwarzer Rand. Das Bild ist dasselbe, die Prüfsumme
eine völlig andere.

Deshalb bekommt jeder geladene Clip einen **Bildfingerabdruck**: vier winzige
Graustufenbilder (9×8 Pixel), je Bild ein dHash — jedes Pixel gegen seinen
rechten Nachbarn, ein Bit pro Vergleich, 64 Bit pro Bild. Das überlebt
Skalierung, Bitrate und mäßige Helligkeitsänderungen und braucht **keine
zusätzliche Bibliothek**; ffmpeg liefert die Rohbytes direkt.

An echtem Material gemessen — fünf Clips desselben Produkts und drei
nachgebaute Reposts:

| Fall | Bit-Abstand |
|---|---|
| Repost 720p, halbe Bitrate | **0 – 1** |
| Repost 576p, leicht aufgehellt | **0 – 1** |
| Repost mit schwarzem Rand | 5 – 9 |
| verschiedene Clips (10 Paare) | **19 – 40** |

Das Fenster für die Schwelle ist also **10 bis 18**; eingestellt sind **12** —
Mitte, Abstand nach beiden Seiten statt knapp neben dem schwierigsten Fall.

Zwei Regeln dabei:

- **Bild gegen Bild an derselben Stelle**, nicht jeder gegen jeden. Zwei Clips,
  die dieselbe Szene an verschiedenen Stellen zeigen, sind nicht dasselbe
  Video — ein Vergleich aller gegen alle würde sie dazu erklären.
- **Zwei von vier Bildern** müssen passen. Ein einzelnes gleiches Bild kann
  Zufall sein (zwei Clips mit weißem Hintergrund); vier zu verlangen scheitert
  an einer eingeblendeten Zeile.

Geprüft wird **nach** dem Laden — vorher gibt es kein Bild. Der Abruf ist damit
nicht gespart; gespart sind Platz, Sichtungszeit und ein Clip, der im Schnitt
zweimal dasselbe zeigt. Beim *nächsten* Lauf ist auch der Abruf gespart: Die
Adresse wandert nach `frueher_geladen`.

Fehlt ffmpeg, fällt nur der Fingerabdruck aus — gemeldet einmal, nicht bei
jedem Video. Die Prüfsumme greift weiter. Ein fehlendes Werkzeug darf kein
stiller Filter sein.

### Schwarze Balken: was von der Datei wirklich Bild ist

Hürde 8 misst die **Datei**. Viel Material auf TikTok ist aber schon
umformatiert: ein Querformat-Video mit schwarzen Balken oben und unten. Die
Datei misst 1080×1920 und besteht die Prüfung — der echte Bildinhalt ist
1080×1620. Wer das ungeprüft in einen 1080×1920-Schnitt legt, bekommt **Balken
im Balken**, und das ist der erste Eindruck des Clips.

`cropdetect` misst das, gemessen an einem nachgebauten Fall:

```
ohne Balken    crop=1080:1920:0:0     →   0 % Rand
mit Balken     crop=1080:1620:0:150   →  15,6 % Rand
```

Gemessen wird **zwei Sekunden aus der Mitte**, nicht am Anfang: Eine Blende
macht jedes Video kurz schwarz, und daraus läse cropdetect einen Rand von
hundert Prozent. Ein Test hält genau diesen Fall fest.

Liegt der echte Bildinhalt unter `min_hoehe`, wird der Clip abgelehnt — die
Datei sah nur aus wie 1080p. Ab 5 % Rand wandert der Ausschnitt als
`zuschnitt` in den Index, und von dort in den Schnittlisten-Entwurf des
Kontaktbogens. Der Renderer wendet ihn **vor** dem Einpassen an.

### Ein Treffer muss unterscheiden

Die Prüfkette fragte bis zum 18.09.: *wie viele* Begriffe des Produkts stehen
im Text? `bewerte()` rechnet Treffer geteilt durch Gruppengröße. Was sie nicht
fragte: **sagen diese Treffer überhaupt etwas über dieses Gerät?**

An der eigenen Konfiguration nachgemessen, über alle 40 Produkte:

| Begriff | steht bei … Produkten |
|---|---|
| `usb` | **18** |
| `akku` | 15 |
| `rechargeable` | 13 |
| `light` | 12 |
| `portable` | 10 |
| `bedroom` | 10 |

**42 Begriffe stehen bei fünf oder mehr Produkten.** Ein Video mit „Mini USB
rechargeable LED light for bedroom" kam damit auf Wert **0,5** und hielt —
ohne ein einziges Wort, das dieses Gerät von zwölf anderen unterscheidet.

Aufgehalten hat solche Videos bisher allein die **Kernwort-Hürde**. Und auch
die trägt nicht überall: **34 Kernwörter stehen bei zwei oder drei Produkten**
— `diffuser` bei 27, 33 und 42; `nachtlicht` bei 25 und 50; `jade` bei 38 und
39. Für diese Paare unterscheidet sie nichts.

Deshalb gilt jetzt: **Mindestens ein Treffer muss von einem Begriff kommen, den
höchstens `hoechstens_produkte_je_begriff` Produkte führen** (Vorgabe 2, 0
schaltet es ab).

Der Abstand ist groß genug für eine Grenze — gemessen:

| | unterscheidendster Treffer |
|---|---|
| die sechs echten, angenommenen Untertitel | bei **1 oder 2** Produkten |
| drei Fremdgeräte mit nur Allerweltsbegriffen | bei **6, 13 und 13** |

Ergebnis der Messung: **0 von 6 richtigen verloren, 3 von 3 falschen zusätzlich
gefangen.** Beide Hälften stehen als Test im Testlauf — die Gegenprobe ist die
wichtigere, denn eine Verschärfung, die richtiges Material wegwirft, ist keine
Verbesserung.

Im Ablehnungsbuch steht das als **eigene Zeile** (`nur Allerweltsbegriffe`) und
nicht zusammen mit `trefferwert zu klein`. Die beiden justiert man an
verschiedenen Stellen: das eine an der Schwelle, das andere an den Wortlisten.
Wer sie zusammenzählt, sieht keins von beiden.

### Hashtags: Reichweite ist kein Inhalt

Eine TikTok-Unterschrift besteht meist aus einem kurzen Satz und danach zwanzig
Hashtags. `normalisiere()` macht aus `#fyp` schlicht `fyp` — danach war ein
Reichweiten-Tag von einem Produktwort nicht mehr zu unterscheiden.

Entfernt werden jetzt **nur** Tags, die reine Reichweite meinen: `#fyp`,
`#viral`, `#trending`, `#foryoupage` und so weiter. Fachliche Tags bleiben, und
zwar bewusst: `#waterdispenser` ist bei manchen Untertiteln das **einzige**
Produktwort. Wer Hashtags pauschal abwertet, wirft angenommenes Material weg —
„The one thing you need on your nightstand💧#waterdispenser" ist genau so ein
Fall. `#tiktokmademebuyit` bleibt ebenfalls: Es benennt keine Reichweite,
sondern eine Produktvorführung.

**Ehrlich gesagt bringt das für die Genauigkeit fast nichts.** Nachgemessen:
**kein einziger Reichweiten-Tag ist zugleich ein Produktbegriff** — die
Hashtag-Wolke hat also nie ein falsches Urteil verursacht. Ein Test hält das
fest und schlägt an, falls sich das je ändert.

Was es wirklich ändert, ist die **Vorprüfung**: Sie urteilt ab 25 Zeichen, und
das war die Länge des *ganzen* Textes. Eine Wolke aus zwanzig Hashtags hat
leicht 200 Zeichen und trotzdem keinen Satz — sie wurde beurteilt, als stünde
dort etwas. Gemessen wird jetzt der Fließtext. Wenig Fließtext heißt: nicht
urteilen, normal abrufen. Das kostet Abrufe und ist die richtige Richtung —
abgelehnt wird nur auf positiven Beweis.

### Das Datum steht schon in der Adresse

Sortiert wurde bis zum 18.09. nach **rohen Likes**. Ein Clip mit 800.000 Likes
aus 2023 stand damit vor jedem frischen Fund — und wirkt im Schnitt von 2026
alt: anderer Schnittrhythmus, andere Textgestaltung, oft ein sichtbar
veraltetes Produktmodell. Da eine Anfrage über 200 Adressen liefert und das
Budget bei 60 Abrufen liegt, entscheidet die Reihenfolge, **welche 60 überhaupt
geprüft werden**.

Der naheliegende Weg wäre `yt-dlp --dump-json` gewesen. Der kostet aber einen
Abruf je Kandidat, und genau die sind das knappe Gut. Es geht ohne:

> Eine TikTok-Video-ID ist eine 64-Bit-Zahl. Die **oberen 32 Bit sind der
> Unix-Zeitstempel** der Veröffentlichung.

Das Datum steht also in der Adresse, die ohnehin dasteht. Kein Abruf, keine
Metadaten, kein yt-dlp.

```
7299987550293196800  >> 32  →  1699660800  →  11.11.2023
```

**BigInt, nicht Number.** Eine 19-stellige ID liegt weit über
`Number.MAX_SAFE_INTEGER`, und JavaScript rechnet Bitoperationen auf 32 Bit —
`Number(id) >> 32` liefert eine *plausible, falsche* Zahl. Genau die Sorte
Fehler, die niemandem auffällt. Ein Test hält beide Rechenwege nebeneinander.

Was vor 2016 liegt oder in der Zukunft, ist keine alte Adresse, sondern eine
falsch gelesene: dann gibt es **kein** Datum, und die rohe Zahl gilt weiter.
Geraten wird nicht.

#### Die Rate, und was sie wirklich tut

Sortiert wird nach **Likes je Tag**. Der Satz aus dem Arbeitspapier — „ein
frischer Clip mit 20.000 Likes gewinnt gegen einen alten mit 800.000" — stimmt
so allerdings **nicht**, nachgerechnet:

| | Likes | Alter | je Tag |
|---|---|---|---|
| alt | 800.000 | 1042 Tage | **767** |
| frisch, langsam | 20.000 | 30 Tage | 666 |
| frisch, schnell | 20.000 | 7 Tage | **2857** |

Der alte Clip gewinnt gegen den ersten frischen — und zu Recht, denn 800.000
sind wirklich viel. Die Rate bevorzugt nicht das *Neue*, sondern das **schnell
Wachsende**. Das ist das richtige Signal, nur ein anderes als gedacht. Ein Test
hält die Korrektur fest.

#### Altersgrenze: eingebaut, aber aus

`hoechstalter_tage` wirft Material weg, sobald es größer als 0 ist. Vorgabe ist
**0 = aus**, und zwar bewusst: Die Reihenfolge nach Wachstum holt den Nutzen
schon fast ganz, ohne Risiko. Wie alt das Material zu den vierzig Produkten
überhaupt ist, weiß zurzeit niemand — der Index ist leer. Das Alter steht ab
jetzt bei jedem Fund im Protokoll; wer es eingeschaltet hat, sieht im
Ablehnungsbuch, wieviel die Grenze wegnimmt. 540 (18 Monate) ist ein
brauchbarer Startwert. Erst messen, dann bewusst enger ziehen.

### Die Pause wird gewürfelt

Der feste Abstand von 3,00 Sekunden zwischen zwei Abrufen ist selbst ein
Muster — er sieht für die Gegenseite genau nach dem aus, was er ist. Gewürfelt
wird jetzt zwischen `pause_zwischen_anfragen_sek` und `pause_hoechstens_sek`
(3 bis 12 s).

Das kostet im Schnitt mehr Zeit. Der Preis eines abgebrochenen Laufs ist höher:
Der kostet nicht die Abrufe, er kostet den Nachschub der Woche. Fehlt die
Obergrenze oder ist sie unbrauchbar, gilt der feste Wert — eine kaputte
Einstellung darf die Pause nicht abschalten.

### Sperren und Fehler zählen

Eine Regionssperre wird übersprungen und vermerkt. Der Vermerk lag bisher im
Protokoll **eines** Laufs. Ob Sperren zunehmen, ob eine Quelle systematisch
sperrt, ob sich nach einem TikTok-Update etwas geändert hat: nicht sichtbar.

Je Lauf steht deshalb jetzt in `ablehnungen.json` eine Zeile mit `sperren`,
`fehler` und `regionssperren`. Nach zehn Läufen ist das eine Kurve statt eines
Bauchgefühls — man merkt, dass eine Quelle tot ist, bevor man drei Läufe lang
nichts bekommt.

### Warum abgelehnt wurde, nicht nur dass

Bis zum 18.09. war die Entscheidung binär: durch oder nicht. Bei **168
Ablehnungen aus 338 Untertiteln** ist aber der *Grund* die eigentliche
Information — und der stand verstreut im Protokoll eines Laufs und war danach
weg. Die Beispiele oben („Standgerät", „Osmose-Anlage", „Thermosbecher") waren
von Hand herausgelesen. Das sollte die Maschine selbst sagen können.

Am Ende jedes Laufs steht deshalb:

```
   Abgelehnt: 168 — welche Regel wie oft gegriffen hat:
      61  trefferwert zu klein  (Wert 1×47, Wert 0×14)
      44  ausschlussliste  (standgeraet×19, osmose×11, thermosbecher×7)
      28  sprache  (en×21, nicht erkennbar (nur Hashtags)×7)
      21  kein Merkmal
      14  technisch unbrauchbar  (Hoehe 480×9, Dauer 3s×5)
   Verlauf:  …/tiktok-quellen/ablehnungen.json
```

Die Datei daneben hält die **letzten 20 Läufe**. Nach zehn Läufen ist das eine
Kurve statt eines Bauchgefühls — dieselbe Überlegung wie bei den Sperren.

Zwei Dinge liest man daraus sofort:

- Eine Regel, die **nie** auftaucht, greift nie. Dann gehört sie geprüft — sie
  ist entweder überflüssig oder falsch geschrieben.
- Ein Auslöser, der **ständig** oben steht, gehört in die Feinjustierung. Steht
  bei `trefferwert zu klein` fast überall „Wert 1", ist die Schwelle um genau
  einen Treffer zu hoch — und das sieht man sonst nirgends.

**Nichts davon ändert automatisch eine Regel.** Eine Regel, die nie greift,
wird gemeldet und nicht entfernt: Vielleicht ist sie richtig und das Material
war nur brav. Das ist eine Entscheidung für einen Menschen mit den Zahlen in
der Hand.

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
| `pause_hoechstens_sek` | 12 | ein gleichmäßiger Takt, an dem eine Gegenseite ein Programm erkennt |
| `wiederholungen` | 2 | Dauerschleifen bei Fehlern (`--retries`) |
| `ziel_clips_je_produkt` | 15 | dass ein Produkt alles bekommt und die anderen nichts (§5a) |
| `begriff_ruhe_tage` | 21 | dass jeder Lauf dieselbe abgegraste Themenseite abfragt (§5a) |
| `hoechstens_produkte_je_begriff` | 2 | Allerweltsbegriffe, die jedem Video Punkte geben |

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
| der Ladelauf nimmt das Produkt mit der größten Lücke | sind beide gleich leer, bleibt es bei der Listenreihenfolge |
| ein Creator ab zwei Clips wird wieder abgefragt | bei Schwelle 1 käme jedes zufällig einmal durchgekommene Profil mit |
| Lauf 2 nimmt den nächsten Suchbegriff | in einem frischen Datenordner fängt er wieder bei Begriff 1 an |
| die Bilanz wird auch ohne Download gespeichert | es wurde nachweislich nichts geladen — geschrieben wurde trotzdem |
| ein nie ergiebiger Begriff drängelt sich nicht vor | nach reinem Funddatum stünde er vorne (Zeitwert 0) |
| ein 2-Sekunden-Clip wird nicht geladen | derselbe Clip mit 20 Sekunden lädt sehr wohl |
| fehlende Maße sind keine Ablehnung | mit Angabe (480p) greift die Hürde |
| fremde Werbung wird erkannt | ein einzelnes schwaches Signal trägt allein kein Urteil |
| kein Fehlalarm auf 15 echten Untertiteln | derselbe Text mit Rabattcode wird erkannt |
| „verworfen" braucht einen Grund aus der Liste | bei „verwendet" gibt es nichts zu begründen |
| gezählt wird, was auf der Platte liegt | nach Indexeinträgen wären es zwei statt einer Datei |
| das Alter kommt aus dem Eintrag | nach Dateidatum wäre das Material null Tage alt |
| nur Verworfenes läuft ab | ein gleich alter, verwendeter Clip bleibt draußen |
| ein Werkzeugwechsel wird gemeldet | gleicher Stand meldet nichts |
| ein neues Feld ist kein Werkzeugwechsel | ein Feld, das beide haben, wird sehr wohl verglichen |
| ein Eintrag außerhalb der Ordner wird rot | „rohmaterial-alt" zählt nicht als „rohmaterial" |
| ein altes Häkchen belegt keine Einwilligung | mit vollständiger Akte geht dieselbe Prüfung durch |
| eine Erlaubnis für Beiträge deckt keine Anzeige | mit beiden Zwecken geht beides |
| eine abgelaufene Erlaubnis sperrt wieder | vor dem Stichtag war derselbe Clip frei |
| ein unbekannter Zweck wird abgelehnt | auch beim Setzen, nicht nur beim Prüfen |
| ein Creator, eine Anfrage | wer schon zugestimmt hat, wird nicht erneut gefragt |
| alle Clips stehen in der Nachricht | bei einem Clip bleibt es beim einfachen Satz |
| dasselbe Video wird nicht zweimal gesammelt | andere Video-ID, anderer Fall |
| ein gekipptes Urteil wird festgehalten | ein gleichbleibendes hinterlässt keine Änderung |
| eine kaputte Urteilsdatei gilt als leer | die Sammlung ist Beiwerk, der Index ist das Wertvolle |
| nach einem Fund wird der Bogen gebaut | ohne Fund entsteht keiner |
| beide Module laden sich ohne Ring | auch in umgekehrter Reihenfolge |

---

## 11. Verwandte Dokumente

* `Marketing/README.md` — der Marketing-Automat: Notaus (§4), Abläufe (§7),
  Umgebungsvariablen (§9). Dieser Bot ist **nicht** Teil davon, teilt sich aber
  Notaus und Ablageort.
* `CLAUDE.md` §2 (Befehle), §3 (Landkarte), §8 (Konventionen).
* `bot/tiktok-quellen.json` — die Suchkonfiguration selbst; die
  Kommentare darin erklären jedes Feld an Ort und Stelle.
