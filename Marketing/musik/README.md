# Musikbett

Was hier liegt, wird automatisch unter die Videos gelegt — leise, 20 dB unter
der Stimme, ein- und ausgeblendet, mit Begrenzer. Liegt hier nichts, laufen
die Videos wie bisher ohne Musik weiter. Kein Fehler, keine Stille.

## Was hier hineingehört

| | |
|---|---|
| **Format** | `.mp3`, `.m4a`, `.wav`, `.ogg` oder `.opus` |
| **Länge** | ab 30 Sekunden — kürzere werden nahtlos wiederholt |
| **Lizenz** | **CC0 oder gemeinfrei.** Nichts, was Namensnennung verlangt |
| **Eintrag** | **Pflicht** in `lizenzen.json` — ohne Eintrag wird das Stück nicht verwendet |
| **Anzahl** | drei bis fünf reichen; das System wählt je Video eines aus |
| **Art** | ruhig, ohne Gesang, ohne markante Melodie |

**Ohne Gesang** ist keine Geschmacksfrage: Eine Singstimme kämpft mit der
Sprecherstimme um dieselbe Frequenz, und der Zuschauer versteht am Ende beides
nicht.

## Woher

Kostenlos, CC0, ohne Namensnennung:

- **pixabay.com/music** — Filter „CC0", direkter Download ohne Konto
- **chosic.com/free-music** — Filter „No attribution required"
- **free-stock-music.com** — Lizenzfilter „CC0 Universal 1.0"

## Der Eintrag ist die eigentliche Sperre

Eine Datei in diesen Ordner zu legen, ist **kein** Nachweis — „jemand hat sie
bewusst hingelegt" ist ein Vorsatz, kein Beleg. Jedes Stück braucht eine Zeile
in `lizenzen.json`:

```json
"mein_stueck.mp3": {
  "quelle": "pixabay.com/music/…",
  "lizenz": "CC0",
  "gewerblich_erlaubt": true,
  "nachweis": "Screenshot der Lizenzseite, abgelegt unter …",
  "erfasst_am": "2026-09-18"
}
```

Fehlt der Eintrag, steht `lizenz: null` darin, oder ist
`gewerblich_erlaubt: false`, dann gilt:

- **Stil C** (Schnittliste) bricht ab, bevor ffmpeg läuft — dieselbe Sperre wie
  für Quellclips ohne geklärte Rechte.
- **Stil A** lässt das Bett weg und rendert weiter. Dort ist Musik Schmuckwerk;
  ein Abbruch würde ein rechtlich einwandfreies Video verhindern.

`gewerblich_erlaubt` ist eine eigene Frage: Der kommerzielle Katalog einer
Plattform ist kleiner als der private, und ein Werbeclip für eigene Produkte
ist gewerblich — auch auf dem eigenen Kanal.

Die Datei ist versioniert, die mp3s sind es nicht. Das ist Absicht: Eine
Musikdatei ist jederzeit neu geladen, der Beleg dafür nicht.

**Finger weg von allem, was Namensnennung verlangt** (CC-BY, auch Kevin
MacLeod). Der Automat postet ohne Aufsicht — eine vergessene Namensnennung
wäre eine Urheberrechtsverletzung bei jedem einzelnen Beitrag.

## Wie ausgewählt wird

Nicht zufällig, sondern über eine Saat aus dem Briefing: Dasselbe Video
bekommt beim erneuten Rendern dasselbe Stück. Sonst wäre ein Rendern nicht
wiederholbar, und beim Lernen bliebe unklar, ob die Musik oder etwas anderes
den Unterschied gemacht hat.

## Ein Hinweis zu TikTok

Eingebrannte Musik und die plattformeigenen Sounds schließen sich halb aus:
Ein Sound aus TikToks Bibliothek bringt zusätzliche Reichweite, lässt sich
aber nur **in der App** hinzufügen — was ein Automat nicht kann. Wer beides
will, lädt ohne Musik hoch und legt den Sound von Hand darüber.

Abschalten geht über `video.stock_clips_max`-Nachbarn in
`config/marketing.config.json`: Ordner leeren genügt.
