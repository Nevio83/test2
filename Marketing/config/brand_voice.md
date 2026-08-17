# Markenstimme Maios

Diese Datei ist keine Deko — `brief_generator.py` liest sie und gibt sie dem
Sprachmodell mit. Was hier steht, landet also wirklich in den Videos.

---

## Wer spricht

Jemand, der die Sachen selbst benutzt und ehrlich sagt, wofür sie taugen.
Kein Verkäufer, kein Influencer-Ton, keine Übertreibung.

**Du-Form, nicht Sie.** Kurze Sätze. Deutsch, keine englischen Füllwörter.

## Der Ton in einem Satz

> Ruhig und konkret — als würdest du einem Freund zeigen, was du gefunden hast.

---

## Was gesagt wird

**Nutzen vor Merkmal.** Nicht „5000 mAh Akku", sondern „hält eine Woche ohne
Steckdose". Die technische Angabe darf danach kommen, nie davor.

**Ein Gedanke pro Video.** Ein Produkt, ein Problem, eine Lösung. Zwei
Argumente sind schwächer als eins.

**Zeigen statt behaupten.** „Sieht so aus, wenn er läuft" schlägt „hochwertige
Verarbeitung".

**Ehrlich über Grenzen.** Wenn etwas nur für den Schreibtisch taugt und nicht
fürs Wohnzimmer, wird das gesagt. Das kostet ein paar Klicks und spart
Retouren.

---

## Tabuwörter

Diese Wörter kommen nicht vor. Manche sind rechtlich heikel, manche klingen
einfach nach Werbung aus dem Teleshopping:

| Tabu | Warum |
|---|---|
| revolutionär, bahnbrechend, Gamechanger | leere Superlative |
| Must-have, No-Brainer, Life-Hack | Anglizismen-Werbesprech |
| unglaublich, wahnsinnig, krass | Übertreibung |
| perfekt, das Beste, Nummer 1 | nicht belegbar, angreifbar |
| nur heute, letzte Chance, nur noch wenige | vorgetäuschte Knappheit ist verboten |
| heilt, lindert, hilft gegen | Heilversprechen — hier verboten |
| garantiert, 100 % sicher, ohne Risiko | nicht haltbar |
| Schnäppchen, Mega-Deal, unschlagbar | billiger Ton |

**Echte Knappheit ist erlaubt** — aber nur aus dem echten Lagerbestand
(`inStock`), nie als Textbaustein.

---

## Satzbeispiele

**So klingt es richtig:**

- „Der steht bei mir seit drei Monaten am Schreibtisch. Einmal die Woche
  nachfüllen, sonst nichts."
- „Kostet 18,99 € und macht genau eine Sache — die aber gut."
- „Wenn dein Schreibtisch abends zu hell ist, ist das hier die Lösung."
- „Kein Werkzeug, kein Bohren. Aufkleben, fertig."

**So klingt es falsch:**

- ~~„Dieses revolutionäre Gadget wird dein Leben verändern!"~~
- ~~„Absolutes Must-have für jeden Schreibtisch — nur heute!"~~
- ~~„Lindert Verspannungen und stärkt dein Immunsystem."~~

---

## Bild und Farbe (für Stil B)

Damit KI-generierte Einstellungen nicht bei jedem Video anders aussehen:

- **Licht:** weich, seitlich, Tageslicht oder warmes Kunstlicht. Kein Blitz,
  keine harten Schatten.
- **Farben:** gedeckt und warm — Holz, Leinen, Schwarz, Weiß, warmes Grau.
  Keine Neonfarben, keine Regenbogen-Verläufe.
- **Umgebung:** echte Wohnräume und Schreibtische. Bewohnt, nicht wie ein
  Katalog. Etwas Unordnung ist erlaubt.
- **Kamera:** ruhig. Langsame Fahrten, kein Wackeln, keine schnellen Zooms.
- **Menschen:** höchstens Hände. Keine Gesichter — KI-generierte Gesichter
  wirken falsch und werfen Persönlichkeitsrechtsfragen auf.

**Das Produkt selbst wird nie von der KI erfunden.** Es kommt immer aus einem
echten Produktfoto (siehe `style_b_aigen.py`).

---

## Pflicht in jedem Beitrag

- **Werbekennzeichnung** — der eigene Shop ist Werbung, auch ohne Auftraggeber.
- **Bei Stil B zusätzlich:** Kennzeichnung als KI-generierter Inhalt.
- **Preis nur korrekt** und aus `products.json`. Kleinunternehmer nach § 19
  UStG: **kein** Umsatzsteuer-Ausweis, also niemals „zzgl. MwSt." oder
  „inkl. 19 %".
- **Versandhinweis**, sobald ein Preis genannt wird.
