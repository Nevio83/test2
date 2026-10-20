# Schriften und Icons, selbst ausgeliefert

Seit dem 20.10.2026 (Punkt 60 in `Marketing/VideosVerbessern.html`). Vorher kamen
beide von fremden Servern:

| was | vorher | jetzt |
|---|---|---|
| Inter, Outfit, Manrope, Marcellus | `fonts.googleapis.com` + `fonts.gstatic.com` | `schriften/schriften.css` + 8 × `.woff2` |
| Bootstrap Icons 1.11.3 | `cdn.jsdelivr.net` | `schriften/bootstrap-icons/` |

**Warum:** Auf dem Handy hielten genau diese beiden fremden Stylesheets die
Darstellung auf (eigene Verbindung je Server, das eigene CSS war nach 0,6 s da,
die fremden nach 1,7 und 2,0 s). Und Google Fonts übertrug bei jedem
Seitenaufruf die Adresse des Besuchers an Google — ohne Einwilligung und ohne
Erwähnung in der Datenschutzerklärung.

Bootstrap selbst (`bootstrap.min.css`, `bootstrap.bundle.min.js`) und `chart.js`
im Admin-Bereich kommen weiter von jsdelivr — sie waren nicht Teil dieser
Umstellung.

## Was hier liegt

- `schriften.css` — eine `@font-face`-Regel je Familie und Zeichensatz.
  Nur **latin** und **latin-ext**; Deutsch braucht nichts anderes. Inter,
  Manrope und Outfit sind **variable Schriften**: eine Datei je Zeichensatz
  deckt alle Gewichte ab, deshalb steht ein Bereich (`font-weight: 400 800`)
  statt einer Regel je Gewicht. Der Browser lädt eine Datei erst, wenn die
  Seite die Familie benutzt **und** ein Zeichen aus ihrem Bereich vorkommt.
- `bootstrap-icons/` — `bootstrap-icons.min.css` unverändert aus dem Paket,
  daneben `fonts/` mit `.woff2` und `.woff` (die relativen Verweise im CSS
  zeigen dorthin).

## Lizenzen

- Inter, Outfit, Manrope, Marcellus: **SIL Open Font License 1.1**. Der
  Lizenzhinweis steht in den Metadaten jeder `.woff2`-Datei.
- Bootstrap Icons: **MIT**, Lizenztext in `bootstrap-icons/LICENSE`, Hinweis
  im Kopf von `bootstrap-icons.min.css`.

## Neu bauen

Die Google-CSS mit Browser-Kennung abrufen (ohne sie liefert Google kein WOFF2):

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700;800&family=Marcellus&family=Outfit:wght@400;500;600;700;800;900&display=swap
```

Daraus je Familie die Blöcke `/* latin */` und `/* latin-ext */` nehmen; alle
Gewichte einer Familie zeigen auf **dieselbe** Datei. Die Dateien heißen hier
`<familie>-<zeichensatz>.woff2`. Bootstrap Icons:
`https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/` (CSS + `fonts/`).

Wer eine neue Schrift oder ein neues Gewicht einbaut: hier eintragen, nicht
wieder einen Google-Link in eine Seite setzen — `test/schriften-selbst.test.js`
meldet das.
