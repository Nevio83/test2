# Produkt-Videos

Hier liegen die Videos, die in der Bildergalerie einer Produktseite als erstes
Thumbnail mit Play-Symbol erscheinen (z.B. das TikTok-Creative zum Produkt).

## Video zu einem Produkt hinzufügen — 2 Schritte

**1. Videodatei hier ablegen.** Dateiname am besten der Produkt-Slug:

```
produkt videos/zigbee-smart-diy-motorisierte-rollos.mp4
```

**2. In `products.json` beim passenden Produkt eintragen:**

```json
{
  "id": 20,
  "name": "ZigBee Smart DIY Motorisierte Rollos",
  "video": "produkt videos/zigbee-smart-diy-motorisierte-rollos.mp4"
}
```

Fertig — das Thumbnail erscheint automatisch. Ohne `video`-Feld passiert nichts,
die Galerie bleibt exakt wie vorher.

Optional lässt sich ein eigenes Vorschaubild setzen (sonst wird automatisch das
Produkt-Hauptbild genommen):

```json
"videoPoster": "produkt bilder/Mein Vorschaubild.jpg"
```

## Worauf achten

- **Format:** MP4 mit H.264-Video und AAC-Audio — das läuft in allen Browsern.
  TikTok-Exporte erfüllen das von Haus aus.
- **Hochformat ist okay.** 720×1280 wird sauber in die quadratische Bildfläche
  eingepasst (mit schwarzen Rändern links/rechts), nichts wird abgeschnitten.
- **Dateigröße:** unter ~10 MB halten. Das Video wird erst geladen, wenn der
  Kunde auf das Thumbnail klickt — die Seite wird also nicht langsamer. Trotzdem
  gilt: je kleiner, desto schneller startet es auf dem Handy.
- **Kaputter Pfad ist harmlos.** Findet der Browser die Datei nicht, schließt
  sich das Video-Fenster einfach wieder und die Bildergalerie funktioniert normal.

Technik dahinter: [`product-video.js`](../product-video.js)
