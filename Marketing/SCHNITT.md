# ✂️ Die Schnittkette (SOP)

> Gegenstück zu `bot/TIKTOK-VIDEO-SYNC.md`. Der Bot **findet** Material,
> diese Kette **macht daraus Videos**. Was hier steht, ist gemessen oder im
> Betrieb aufgelaufen — keine Vorsätze.

---

## 1. Was die Kette tut — und was nicht

Aus einer **Schnittliste** (JSON) wird ein fertiges 1080×1920-Video: Segmente
zuschneiden, vereinheitlichen, verketten, Text einbrennen, Endkarte anhängen,
Musik unterlegen, Lautheit normieren, prüfen.

Was sie **nicht** tut:

* **Sie sucht keine Clips aus.** Dafür braucht es Augen, und die hat sie nicht.
  Der Kontaktbogen (`npm run tiktok:bogen`) legt vier Standbilder je Clip auf
  ein Blatt — gesichtet wird dort, entschieden vom Menschen.
* **Sie urteilt nicht über Rechte.** Sie setzt eine Sperre durch: Ohne
  Lizenznachweis wird nicht gerendert. Ob eine Erlaubnis trägt, ist keine
  Frage, die ein Programm beantwortet.
* **Sie veröffentlicht nichts.** Der Trockenlauf ist die Vorgabe, und drei
  Notaus stehen darüber.

---

## 2. Die Befehle

```bash
# Formen anzeigen
python -m pipelines.video.style_c_schnittliste vorlage

# Gerüst anlegen (überschreibt nie eine bestehende Datei)
python -m pipelines.video.style_c_schnittliste vorlage vorher_nachher \
  --produkt 10 --hook "Nie wieder schleppen" --ziel Marketing/schnittlisten/10_a.json

# Gegenlesen, ohne zu rendern — Sekunden statt Minuten
python -m pipelines.video.style_c_schnittliste pruefen Marketing/schnittlisten/10_a.json
python -m pipelines.video.style_c_schnittliste pruefen …/10_a.json --bauversuch
```

Die Trennung ist Absicht: Eine Vorlage kostet nichts, Gegenlesen kostet
Sekunden, Rendern kostet Minuten. Wer sie in einen Aufruf packt, zahlt beim
Gegenlesen den Preis des Renderns.

---

## 3. Die Schnittliste

```json
{
  "produkt_id": 10,
  "hook": "Nie wieder Flaschen schleppen",
  "cta": "Link im Profil. Werbung.",
  "hashtags": ["wasserspender", "desksetup"],
  "endkarte": true,
  "musik": "upbeat_house_124bpm.mp3",
  "segmente": [
    {"quelle": "07_wasserspender_14s_stil-b.mp4", "von": 1.2, "bis": 4.0,
     "text": "Kennst du das?", "variante": "weiss"},
    {"quelle": "09_wasserspender_49s_stil-b.mp4", "von": 12.0, "bis": 15.0,
     "uebergang": "blitz", "zuschnitt": "crop=1080:1620:0:150"}
  ]
}
```

| Feld | heißt |
|---|---|
| `von` / `bis` | Sekunden **in der Quelldatei**; `bis` weggelassen = bis zum Ende |
| `text` | Einblendung während dieses Segments |
| `zuschnitt` | roher ffmpeg-`crop`, kommt aus dem Bot (schwarze Balken) |
| `variante` | Farbe/Modell — gemischte Varianten werden gemeldet |
| `uebergang` | `schnitt` (Vorgabe) oder `blitz` |
| `varianten_mischen` | Kopfzeile: schaltet die Variantenwarnung ab |

**Warum JSON und nicht ein Videoprojekt:** Eine 4-KB-Liste gehört ins
Repository, ein 40-MB-Video nicht. Dieselbe Liste ergibt dasselbe Video, und
fünf Fassungen zu vergleichen heißt fünf Dateien zu lesen, nicht fünf Videos
anzusehen.

---

## 4. Geprüfte Grenzen der Werkzeuge

Alles hier ist **nachgemessen**, nicht aus einer Dokumentation abgeschrieben.

### ffmpeg / ffprobe

| Sache | Messwert | Folge |
|---|---|---|
| Reines Schwarz in yuv420p | **YAVG 16**, nicht 0 | TV-Range 16–235. Eine Schwarz-Grenze bei 12 löst **nie** aus. |
| Reines Weiß | **YAVG 235** | Die Hell-Grenze liegt bei 200. |
| Szenenerkennung auf Flächenfarbe | 1 von 2 Schnitten, selbst bei Schwelle 0.1 | Deshalb gibt es `_achtung: Ausschnitt geraten`. |
| `-ss` auf ein **Standbild** | Rücklaufwert 0, **keine Datei** | Immer die Datei prüfen, nie den Rücklaufwert. |
| Segment 1080×1920 vs. 540×960 `ultrafast` | 1,81 s gegen **0,26 s** | 7× — daher die Vorschau (§6). |

### ASS-Untertitel

* Farben sind **AABBGGRR**, nicht RGB. `#ff8c00` → `&H00008CFF`.
  `hex_zu_ass()` macht das; von Hand geht es schief.
* `alpha` ist die **Durchsichtigkeit**, nicht die Deckkraft — 0 ist deckend.
* Schriftgrößen sind Anteile der Bildhöhe (64/1920 usw.), damit die Vorschau
  dasselbe Bild zeigt.
* Rund **20 Zeichen** passen sicher in eine Zeile.
* `drawtext` wurde bewusst aufgegeben: Es kann weder umbrechen noch an die
  Breite anpassen.

### Sperrzonen der Plattform

Unten 320, rechts 160, oben 120 Pixel — **Schätzungen**, keine Messungen an
unserem Bild. TikTok veröffentlicht keine Maße, und die Bedienelemente wandern
zwischen App-Versionen.

Nachgemessen am 23.09.: Weißer Text auf schwarzem Bild, rechte 160 Pixel
abgetastet. Eine Zeile mit 20 Zeichen ergibt **YMAX 235** — da steht Text. Eine
kurze Zeile ergibt **16**, also nichts. Bei voller Zeilenlänge läuft der
Untertitel wirklich unter die Symbolspalte; kurze Zeilen bleiben davor, weil
ASS zentriert.

`zonenbild()` legt die drei Zonen rot über ein Standbild — zum Ansehen.

---

## 5. Die Sperren

### Lizenz

> „Ein Asset ohne Lizenzeintrag kommt nicht ins Video. Punkt."

Gilt für **Bild und Musik**. Beim Rendern steht die Prüfung **vor allem
anderen**: Rechenzeit für ein Video, das ohnehin nicht raus darf, ist
verschwendet — und ein fertiges Video im Ordner sieht aus wie ein
freigegebenes.

Musik zusätzlich mit `gewerblich_erlaubt`: Der kommerzielle Katalog einer
Plattform ist kleiner als der private, und ein Werbeclip ist gewerblich. Stand
23.09.: 5 von 8 Stücken frei, 3 gesperrt.

### Ausgangsprüfung

Geprüft wird die **Datei**, nicht der Rücklaufwert des Renderers — bis Runde 10
lagen neun 0-Byte-MP4s im Ordner, die aussahen wie fertige Arbeit.

| Sperrt | Hinweist |
|---|---|
| Mindestgröße, Dauer, 1080×1920, h264+AAC | Lautheit weicht vom Ziel ab |
| keine Tonspur | erste 0,3 s schwarz |
| Tonspur praktisch still (< −45 LUFS) | Untertitelbereich sehr hell |
| | Text in einer Sperrzone |

**Warum so wenig sperrt:** Der erste Entwurf der Lautheitsprüfung wies alles
ab, was mehr als 6 LU unter −14 LUFS lag — und ließ prompt die vorhandene
Gegenprobe durchfallen (das Testvideo liegt bei −21,9 LUFS). Eine Sperre, die
eingeführte Fälle abweist, wird nach zwei Tagen abgeschaltet; dann prüft gar
nichts mehr.

---

## 6. Vorschau und Endfassung

`rendere(..., vorschau=True)` rechnet die **ganze Kette** in 540×960 mit
`ultrafast`: **3,6 s statt 16,6 s** (4,6×).

Der erste Entwurf verkleinerte nur den letzten Kodierschritt — 13,3 s statt
16,8 s, also 1,3×. Die Zeit steckt in den **Segmenten**, nicht in der
Verkettung.

**Gleich bleibt:** Segmentgrenzen, Texte, Musik, Reihenfolge, Endkarte,
gemessene Länge. Eine Vorschau, die etwas anderes zeigt, ist keine.

**Anders ist:** Auflösung, und die Untertitelspur bleibt aus (ASS-Größen sind
absolut gesetzt und wirkten im halben Bild doppelt so groß). Sie wird trotzdem
gebaut, damit ein Fehler darin auffällt.

Die Vorschau fällt **absichtlich** durch die Ausgangsprüfung — 540×960 ist die
falsche Auflösung, also kann sie nie versehentlich veröffentlicht werden.

---

## 7. Gelöste Fehler, mit Datum

| Datum | Fehler | Lehre |
|---|---|---|
| 18.09. | Musik riss mitten im Takt ab | `afade` **nach** `loudnorm` — andersherum hebt die Normalisierung die Blende wieder an. |
| 18.09. | `dauer_soll` zählte die Endkarte nicht mit | 2,5 s Abweichung, knapp unter der 3-s-Grenze der Ausgangsprüfung. Gefunden vom echten Lauf. |
| 18.09. | Stil C hatte kein Wort Text | Ein handgeschnittener Beitrag ging mit „Link im Profil. Werbung." und **null** Hashtags raus. |
| 20.09. | Schwarz-Grenze bei 12 | Reines Schwarz misst 16. Die Prüfung war eingebaut und prüfte nichts. |
| 20.09. | Kontaktbogen-Meldung im Ablehnungsblock | Ein Lauf ohne Ablehnung zeigte den Bogen nie an, obwohl er im Ordner lag. |
| 23.09. | `hex_zu_ass("orange")` | Zählte nur die Zeichen — „orange" hat sechs. Ergab `&H00EGNARO`, das ffmpeg still ignoriert. |
| 23.09. | Preis im Video war Gelb | `&H0000E5FF` = RGB(255,229,0). Der Shop ist `#ff8c00`. Niemand konnte es sehen, weil die Zahl nirgends als Farbe lesbar war. |
| 23.09. | `zonenbild()` meldete Erfolg ohne Datei | `-ss` auf ein Standbild. Derselbe 0-Byte-Fehler, eine Etage tiefer. |

---

## 8. Regeln, die aus der Handarbeit kommen

* **Varianten nicht mischen.** Aus der Notiz zu Produkt 10: „Clips mit dem
  SCHWARZEN Spender nicht mit den weissen mischen — wirkt wie ein anderes
  Produkt." Jetzt Feld `variante`; bewusstes Mischen über `varianten_mischen`.
* **Fremder Originalton fliegt raus** (`-an`). Zwei Gründe: die Stimme eines
  fremden Creators und lizenzierte Musik, die nur innerhalb der App erlaubt
  ist. Wer Originalton will, vermerkt es ausdrücklich.
* **Zwei Übergänge, mehr nicht.** Wiedererkennbarkeit entsteht durch
  Wiederholung; zwanzig Möglichkeiten wären dieselbe Beliebigkeit wie keine.
* **Werbung steht fest in der Endkarte**, oben. Kein Schalter, kein Parameter
  — wird es je Beitrag von Hand gesetzt, fehlt es irgendwann.

---

## 9. Was jede Fassung hinterlässt

Neben jedem Video liegt `<name>.mp4.fassung.json`: Datum, Produkt,
Schnittliste samt Prüfsumme, gemessene Dauer, Tempo, Varianten, Musik und
Lizenz, ob der Fremdton entfernt wurde, und **alle Rohclips mit sha256**.

Ein Feld bleibt leer: `aenderung`. Was von Fassung 3 zu 4 anders ist, weiß nur
ein Mensch — ein erfundener Satz wäre schlimmer als ein leeres Feld.

**Wofür das gut ist:** Zieht ein Creator seine Erlaubnis zurück, geht
`node bot/tiktok-video-sync.js --rueckruf <name>` rückwärts durch diese
Dateien und nennt alle betroffenen Fassungen samt Handlungsanweisung.

---

## 10. Tests

```bash
python -m pytest Marketing/tests/test_stil_c.py Marketing/tests/test_video.py -q
```

Projektregel `CLAUDE.md` §2: **Ein Test, der nur grün werden kann, ist
wertlos.** Zu jeder Prüfung steht eine Gegenprobe.

Videos in Tests sind **echt** (per `lavfi` erzeugt), nie Dummies mit beliebigen
Bytes — sonst liefe die Zeitprüfung gegen die echte Dateilänge ins Leere.

---

## 11. Verwandte Dokumente

* `bot/TIKTOK-VIDEO-SYNC.md` — wie das Material gefunden wird
* `Marketing/README.md` — der Automat als Ganzes
* `Marketing/VideosVerbessern.html` — die Vorschlagsliste, aus der das hier stammt
