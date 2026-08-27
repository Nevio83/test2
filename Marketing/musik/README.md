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
