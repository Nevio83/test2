---
name: maios-story-stil
description: Plant und baut Maios-Story-Videos (20-25 s, 3D/CGI) im Stil von @mehr.optic und @cano.essentials - Blueprint-Look, Explosionsansicht mit Callouts, Karaoke-Untertitel, Menge von Figuren, Neon-Preis. Nutzen bei "Story-Video", "wie mehr.optic", "Video planen", "Beat-Sheet", neuem Produktvideo fuer @maiosshop / @maiosshop.com.
---

# Maios Story-Stil (nach @mehr.optic)

## Wann
Jedes neue Produktvideo. Story-Clips dieser Art holen bei den Vorbildern 300K-1M Views, reine Produktclips 2K-90K. Standard ist deshalb die Story (20-25 s, kein Loop). Loop (7-9 s) nur als Zweitversion.

## Ablauf
1. Produkt + Aussagen NUR aus products.json (Preis, Farben, Beschreibung). Nichts erfinden.
2. Beat-Sheet schreiben (Vorlage unten), pro Beat: Dauer, Bild, Untertitel (max. 6 Woerter), Einblendung.
3. Szene bauen: `scenes/<name>_story.js/.html`, Vorlage `scenes/wasser_story.js`; Einblendungen mit `lib/story_kit.js` (`makeKit`).
4. Stills pruefen (`render.py --stills ...`), Board ansehen: Text nicht auf dem Produkt, Sperrzonen frei (oben 10 %, unten 20 %, rechts 14 %), Werbung-Pill immer da.
5. Rendern, Ton (`scenes/<name>_ton.py`, -14 LUFS, Spitze <= -1 dBTP), `finish.py` OHNE `--loop`, `--titel` = Sekunde mit Produkt/Preis, <= 10 MB.
6. Zweitblick durch Subagent, dann an Nevio per SendUserFile. Er laedt selbst hoch: Eingabe-Paket (Dateiname, Caption, Hashtags, Datum/Uhrzeit, Cover-Sekunde, Pin-Kommentar, KI-Label ja/nein). Claude laedt NICHT hoch.

## Beat-Sheet (Vorlage, ~20 s)
| Zeit | Beat | Inhalt |
|---|---|---|
| 0-2.6 | Hook als Aussage | Menge gleicher Figuren, Neon-Stadt, Problem als Satz ("Jeden Morgen dieselbe Gallone."). Bewegung ab Frame 0, keine Aufloesung in 3 s |
| 2.6-5 | Problem | Eine Figur faellt aus der Reihe (goldener Ring, rotes X, Pfuetze) |
| 5-7.6 | Eine Idee | Blueprint-Hintergrund (Blau + Raster), Produkt weiss mit gelben Kontur-Glows, Tag "Eine Idee" |
| 7.6-11 | Teile | Explosionsansicht, 2 Callouts (Pill + Punkt-Leitlinie), Tag mit Hauptvorteil |
| 11-16 | Beweis | Produkt in echter Szene (Schreibtisch), Funktion sichtbar (Wasser fuellt Glas) |
| 16-20.5 | Preis + CTA | Neon-Preis, Tag mit Farben, "Link im Profil" ab ~1 s nach Preis, Ende <= 1 s nach CTA |

## Stilregeln
- Untertitel: Grossbuchstaben, fett kursiv (Manrope 74 px), Karaoke: gesprochene Woerter weiss, kommende gedimmt, bei y ~1350 px, nie auf dem Produkt.
- Tag-Pills: weiss oder gold, klein, oben ueber dem Produkt. Callouts: dunkle Pill + gepunktete Linie.
- Preis: Neon pink mit Glow. Alle 2-3 s etwas Neues im Bild, Schnitte <= 3 s.
- Figuren: eigene Figur (Mo / erwachsene Variante `lib/figur_pro.js`), nie fremde Figuren 1:1 kopieren.
- Keine Stimme (ausser Mo-Stories 4.11./11.11.). Musik Lo-Fi, Pops auf Einblendungen.
- Pflichtregeln: "Regeln ab 28.10.2026" in `Marketing\cgi\README.md`.

## Dateien
`lib/story_kit.js`, `lib/figur_pro.js`, `scenes/wasser_story.js` (Referenz), `scenes/wasser_story_ton.py`, `Marketing\cgi\vorbilder.md`.
