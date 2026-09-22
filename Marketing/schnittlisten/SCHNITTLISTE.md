# Schnittlisten (Stil C)

Eine Schnittliste ist **eine Fassung eines Videos als Datei**. Sie sagt, welcher
Ausschnitt welches Rohclips wann kommt — und sonst nichts.

## Warum es sie gibt

Der erste veröffentlichungsreife Clip dieses Projekts (Wasserspender, 19,5 s)
ist von Hand entstanden: 23 Rohclips gesichtet, fünf Fassungen geschnitten,
jede in einem ffmpeg-Aufruf neben dem Automaten.

Dieser Clip hat **nichts** von dem gesehen, was den Automaten ausmacht — keine
Lizenzprüfung des Materials, keine Ausgangsprüfung, keinen Eintrag in
`mkt_videos`, kein Lernen, keine Umsatzzuordnung. Er ist gut, und er ist blind
entstanden.

Stil C schließt diese Lücke. Die Entscheidung bleibt beim Menschen; sie steht
nur ab jetzt in einer Datei statt in einem Befehl.

Drei Dinge ändert das:

1. **Fünf Fassungen vergleichen** heißt fünf Dateien nebeneinanderlegen, nicht
   fünf Videos ansehen.
2. **Die Fassung ist versionierbar.** Eine 4-KB-Liste gehört ins Repository,
   ein 40-MB-Video nicht.
3. **Die Fassung läuft durch dieselben Kontrollen** wie Stil A und B.

## Format

```json
{
  "produkt_id": 10,
  "musik": "bett-ruhig-90bpm.mp3",
  "hook": "Nie wieder Flaschen schleppen",
  "cta": "Jetzt im Shop. Werbung.",
  "hashtags": ["wasserspender", "kueche", "gadget"],
  "segmente": [
    { "quelle": "10_7300000000001.mp4", "von": 1.2, "bis": 3.4,
      "text": "Nie wieder Flaschen schleppen" },
    { "quelle": "10_7300000000002.mp4", "von": 0.0, "bis": 2.1 },
    { "quelle": "eigene-aufnahme.mp4", "von": 4.0 }
  ]
}
```

### Kopf

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `produkt_id` | ja | Produkt aus `products.json`. Bestimmt Preis und Shop-Adresse. |
| `musik` | nein | Dateiname aus `Marketing/musik`. Ohne Angabe wird nach Produkt-ID gewählt (gleiche Liste → gleiche Musik). |
| `hook` | nein* | Erste Zeile der Bildunterschrift. Der Satz, der über Weiterschauen entscheidet. |
| `cta` | nein | Aufruf samt Werbekennzeichnung. Ohne Angabe: „Link im Profil. Werbung." |
| `hashtags` | nein* | Liste, mit oder ohne Raute. Die ersten fünf landen im Beitrag. |
| `endkarte` | nein | Schlussbild mit Name, Preis und Adresse. Vorgabe: an. |
| `segmente` | ja | Mindestens eines. Reihenfolge = Reihenfolge im Video. |

\* Formal freiwillig, praktisch nicht. Siehe unten.

### Der Text ist kein Beiwerk

Bei Stil A und B kommen Hook, Aufruf und Hashtags aus dem Briefing
(`mkt_briefs`). Eine Schnittliste hat kein Briefing — deshalb standen dort bis
zum 18.09. alle drei Felder auf `NULL`, und heraus kam:

```
Link im Profil. Werbung.
https://…?utm_campaign=mkt_78
```

Eine Leerzeile, der Standardaufruf, die Adresse. **Null Hashtags.** Der
schwächste Text der ganzen Kette ausgerechnet unter dem Video, in dem die
meiste Handarbeit steckt — und auf TikTok heißt „keine Hashtags" kaum
Reichweite.

Fehlen `hook` oder `hashtags`, wird die Liste trotzdem gerendert, aber:

- beim Einlesen steht eine Warnung im Protokoll,
- beim Einplanen des Beitrags eine zweite,
- und in der **Freigabeliste** im Dashboard steht es rot an der Karte.

Abgebrochen wird nicht: Ein Video, das gar nicht erst entsteht, sieht man
nicht — und was man nicht sieht, bessert man nicht nach.

### Wo der Hook landet

`hook` steht an **zwei** Stellen: als erste Zeile der Bildunterschrift und als
Text im Bild, über die ersten 2,5 Sekunden. Das zweite ist das wichtigere — ein
großer Teil schaut ohne Ton, und die Bildunterschrift liest niemand, bevor er
weiterwischt. Abschalten geht über `video.hook_overlay` in
`config/marketing.config.json`, für alle Stile gemeinsam.

### Endkarte

Am Ende hängt ein Schlussbild aus einem echten Produktfoto: Name, Preis,
Shop-Adresse — dieselbe wie bei Stil A und B. Findet sich kein Produktfoto,
wird es gemeldet und der Clip endet ohne. Stil A bricht an dieser Stelle ab;
dort *ist* das Foto aber das Video, hier nur das letzte Bild.

Die Endkarte zählt zur Gesamtlänge. Da die fertige Datei gemessen und nicht
gerechnet wird, stimmt die Länge trotzdem.

### Segment

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `quelle` | ja | Dateiname oder Pfad. Ein bloßer Dateiname wird gesucht (siehe unten). |
| `von` | nein | Startsekunde im Quellclip. Vorgabe 0. |
| `bis` | nein | Endsekunde. **Fehlt sie, läuft das Segment bis zum Ende der Datei** — geraten wird nichts. |
| `text` | nein | Einblendung während dieses Segments. Gleiche Schrift und Ränder wie bei Stil A. |
| `zuschnitt` | nein | Roher ffmpeg-crop, z. B. `crop=1080:1350:0:200` — um ein fremdes Wasserzeichen wegzuschneiden. Wird **vor** dem Einpassen angewandt. |

### Wo Quellen gesucht werden

Ein bloßer Dateiname wird der Reihe nach gesucht in:

1. `Marketing/videos/rohmaterial/eigenes/` — **selbst gefilmt**
2. `Marketing/videos/geschnitten/`
3. `Marketing/videos/rohmaterial/` (samt Produktordnern)
4. `Marketing/data/tiktok-quellen/`

Die Reihenfolge ist Absicht: Bei gleichem Dateinamen gewinnt **selbst
Aufgenommenes** — der rechtlich unbedenkliche Fall.

Hier stand bis zum 18.09. `geschnitten/` an erster Stelle, mit derselben
Begründung. Das war falsch: Dort liegen **Schnitte**, und ein Schnitt erbt die
Rechte seiner Quellen. Die sieben fertigen Wasserspender-Clips sind aus 23
fremden TikTok-Videos entstanden — „eigener Schnitt" heißt nicht „eigenes
Material".

### Eigenes Material

`rohmaterial/eigenes/` ist der einzige Videoordner, der **ohne Datenbank**
durch die Lizenzsperre kommt. Was dort liegt, hat jemand selbst aufgenommen;
damit ist die Rechtefrage erledigt, und es braucht keinen Eintrag in
`mkt_assets`. Ist eine Datenbank da, wird der Eintrag beim ersten Rendern
automatisch nachgetragen.

Deshalb gilt dort auch die umgekehrte Regel: **Nichts Fremdes hineinlegen.**
Eine fremde Datei in diesem Ordner umgeht jede Kontrolle des Projekts.

## Die Sperre, die zählt

**Jeder Quellclip braucht einen Lizenznachweis** (`mkt_assets`, oder er liegt
in `rohmaterial/eigenes/`). Fehlt er, bricht das Rendern ab, *bevor* ffmpeg
läuft:

```
5 Quellclip(s) ohne Lizenznachweis: 10_730.mp4, 10_731.mp4 …
Erst die Rechte klären und das Material eintragen (assets.registriere), dann rendern.
```

Das ist kein Schikane-Schritt. Fremdes TikTok-Material startet im Bot-Index auf
`rechte_geprueft: false`, und ein Video, das auf TikTok steht, kann man nicht
nachträglich kurz zurückholen. Dieselbe Regel gilt im Materialkatalog seit
jeher für Bildmaterial: *Ein Asset ohne Lizenzeintrag kommt nicht ins Video.*

## Der Ton

**Der Originalton fremder Clips fällt grundsätzlich weg.** Er bringt zwei
Probleme mit: die Stimme eines fremden Creators und häufig lizenzierte Musik,
die nur innerhalb der TikTok-App erlaubt ist. Beides wandert stillschweigend
mit, wenn man einen Clip einfach schneidet — deshalb ist die sichere
Einstellung der Standardweg und keine Option.

Stattdessen kommt ein Musikbett aus `Marketing/musik` darunter, auf dieselbe
Lautheit normiert wie bei Stil A und B (−14 LUFS). Liegt dort nichts, bricht
der Lauf ab: Ein stummes Video fällt ohnehin in der Ausgangsprüfung durch.

**Auch die Musik braucht einen Nachweis.** Seit dem 18.09. gilt für sie
dieselbe Sperre wie für die Quellclips: Was nicht in `musik/lizenzen.json`
steht, kommt nicht ins Video. Der Beleg liegt als Datei neben der Musik statt
in der Datenbank, weil `Marketing/musik/` nicht versioniert ist — eine mp3 ist
jederzeit neu geladen, der Beleg dafür nicht.

## Ablauf

```bash
# 1. Rohmaterial sichten — welcher Clip taugt, und ab welcher Sekunde?
#    Mit --schnittliste kommt ein fertiges Gerüst dazu.
npm run tiktok:bogen -- --produkt 10 --schnittliste

# 2. Marketing/schnittlisten/_entwurf-10.json öffnen: streichen, umsortieren,
#    Zeitmarken setzen, hook/cta/hashtags ausfüllen — dann OHNE führenden
#    Unterstrich speichern. (Ohne --schnittliste: Liste von Hand schreiben.)

# 3. Rendern (läuft im normalen Marketing-Takt mit)
py -m pipelines.orchestrator.run_loop --job render_style_c --once
```

Der Kontaktbogen aus Schritt 1 nennt zu jedem Clip Dauer, Auflösung und
Dateinamen — genau die Angaben, die in die Liste gehören. `--schnittliste`
schreibt sie gleich mit: ein Segment je Clip, Vorgabelänge aus
`video.schnitt_max_sek`, dazu Felder mit Unterstrich (`_dauer`, `_format`,
`_creator`, `_achtung`), die der Renderer ignoriert und die beim Streichen
zeigen, was man streicht.

### Die Schnittpunkte kommen aus dem Material

`--schnittliste` sucht in jedem Clip nach **Szenenwechseln** (ffmpeg
`select=gt(scene,0.3)`) und schlägt den Ausschnitt daraus vor: die längste
Einstellung, die nicht ganz am Anfang liegt. Lang heißt meist: ruhige
Einstellung, in der das Gerät zu sehen ist. Der Anfang wird übersprungen, weil
dort fast immer ein Titeleinblender steht — derselbe Grund, aus dem kein
Standbild bei 0 % gezogen wird.

Die übrigen Schnittpunkte stehen als `_szenen` daneben, damit man den Vorschlag
verschieben kann, ohne das Video zu öffnen.

**Wo das Werkzeug an seine Grenze kommt:** ffmpeg rechnet den Szenenwert aus
der Helligkeit. Nachgemessen an drei aneinandergehängten Vier-Sekunden-Clips:
einfarbig rot → grün → blau wurde nur *ein* Wechsel gefunden, auch mit Schwelle
0,1. Dasselbe mit gemustertem Material: beide Wechsel exakt. Echtes
TikTok-Material ist gemustert, dort stimmt es — aber ein Clip ohne gefundenen
Wechsel heißt nicht „eine Einstellung", er heißt „nicht erkannt". Deshalb steht
in so einem Fall `_achtung: kein Szenenwechsel erkannt — Ausschnitt geraten`
im Entwurf, statt einen geratenen Ausschnitt wie einen gemessenen aussehen zu
lassen.

Das Ergebnis wird neben den Standbildern gemerkt (`<clip>.szenen.json`): Anders
als beim Standbild springt ffmpeg hier nicht, sondern dekodiert den ganzen
Clip.

Der Entwurf ist eine Liste zum **Streichen**, keine fertige Fassung. Er
entscheidet nichts — er tippt nur ab. Schwaches Material (Querformat, unter
720p, unter zwei Sekunden) wird markiert statt weggelassen: Ein Querformat-Clip
taugt als Einblendung, und ein 480p-Clip kann die einzige Aufnahme sein, die
das Produkt in Betrieb zeigt.

Ein vorhandener Entwurf wird **nie** überschrieben. Wer den Bogen neu baut,
weil zwei Clips dazugekommen sind, verliert seine Zeitmarken nicht;
`--neu` erzwingt das Überschreiben.

## Was beim Lesen geprüft wird

Bevor ffmpeg startet, prüft `lies()` die Liste gegen die echten Dateien und
nennt bei jedem Fehler die **Segmentnummer** (bei zwanzig Segmenten ist
„`bis` liegt vor `von`" ohne Nummer keine Hilfe):

- Datei nicht gefunden → Abbruch, mit Angabe der durchsuchten Orte
- `bis` liegt nicht nach `von` → Abbruch
- `von` liegt **hinter dem Dateiende** → Abbruch. Ohne diese Prüfung liefert
  ffmpeg ein **leeres Ergebnis ohne Fehlermeldung** — das Video wäre still
  kürzer als geplant.
- `bis` liegt hinter dem Dateiende → wird gekürzt, aber **gemeldet**
- Gesamtdauer außerhalb `video.min_dauer_sek` / `max_dauer_sek` → Warnung,
  damit es nicht erst nach dem Rendern auffällt

## Wiederholtes Rendern

Erkannt wird an **Name und Prüfsumme des Inhalts**. Gleicher Name, anderer
Inhalt heißt: neue Fassung, wird gerendert. Gleicher Inhalt heißt:
übersprungen, egal wie die Datei heißt.

Bis zum 18.09. entschied allein der Dateiname. Wer eine Fassung korrigierte —
zwei Segmente getauscht, ein Text geändert — musste die Datei umbenennen, sonst
passierte nichts; danach hießen zwei Dateien unterschiedlich, die dieselbe
Fassung meinen.

**Ohne Datenbank** entscheidet die Zieldatei: Ist `renders/<name>_stil_c.mp4`
jünger als die Liste, ist nichts zu tun. Vorher wurde beim lokalen Lauf jedes
Mal alles neu gerendert.

Pro Lauf werden höchstens **zwei** Listen gerendert — Rendern dauert, und ein
Lauf soll nicht eine Stunde blockieren. Wie viele warten, steht am Ende im
Protokoll.

## Was im Nachweis landet

Jedes Stil-C-Video trägt in `mkt_videos` die Spalte `schnittliste` (Dateiname)
und im Bericht die Liste der verwendeten Quellclips. Ohne diese Angabe könnte
das Lernmodul nie feststellen, dass Material eines bestimmten Creators
funktioniert — und genau das soll es können.
