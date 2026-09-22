# Musikordner

Betten fuer Kurzvideos. Alle Tracks sind synthetisch erzeugt (`scripts/musik.py`
im Skill `tiktok-editor`) — keine Samples, keine Lizenz noetig, du kannst sie
kommerziell verwenden.

| Datei | BPM | Stimmung | passt zu |
|---|---|---|---|
| `upbeat_house_124bpm.mp3` | 124 | treibend, Four-on-the-Floor | schnelle Schnitte, Unboxing, Ads |
| `bright_pop_128bpm.mp3` | 128 | hell, poppig, Claps | junge Zielgruppe, Lifestyle |
| `clean_minimal_112bpm.mp3` | 112 | ruhig, Mallets, viel Luft | Produktdetails, Erklaerclips |
| `lofi_chill_88bpm.mp3` | 88 | warm, entspannt, Vinylrauschen | Wohnen, Schlafzimmer, Abend |
| `cinematic_soft_96bpm.mp3` | 96 | weiche Flaechen, langsam | Beauty-Shots, Zeitlupe |

Alle auf −14 LUFS normalisiert und 64 s lang. Das BPM steht im Dateinamen, damit
auf den Beat geschnitten werden kann:

```
python3 edit.py bauen edl.txt --quellen <videos> --out ad.mp4 \
    --musik <musikordner>/upbeat_house_124bpm.mp3 --beat 124
```

## Eigene Tracks

Lizenzierte Tracks (Epidemic Sound, Artlist, TikTok Commercial Music Library)
einfach hier ablegen. Wenn das BPM im Dateinamen steht, funktioniert `--beat`
genauso. Eigene Tracks haben Vorrang — die synthetischen sind nur der Notnagel,
damit ueberhaupt etwas unter dem Video liegt.

## Neue Varianten erzeugen

```
python3 scripts/musik.py <zielordner> --stil lofi_chill --sekunden 90
```

Ohne `--stil` werden alle fuenf gerendert. Dauert ungefaehr zwei Minuten.

## Sofort auf den Beat einsteigen

Jeder Track hat ein bis zwei Takte Intro ohne Drums. Wer sofort Beat will,
steigt bei Takt 2 ein — `@` hinter dem Dateinamen:

| Track | sofort ab |
|---|---|
| `upbeat_house_124bpm.mp3` | `@1.935` |
| `bright_pop_128bpm.mp3` | `@1.875` |
| `clean_minimal_112bpm.mp3` | `@2.143` |
| `lofi_chill_88bpm.mp3` | `@2.727` |
| `cinematic_soft_96bpm.mp3` | `@5.0` (zwei Takte Intro) |
