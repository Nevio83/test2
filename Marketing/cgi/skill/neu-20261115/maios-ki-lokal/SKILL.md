---
name: maios-ki-lokal
description: "Lokale KI-Video-Bausteine für Maios auf Nevios zweitem PC (i5-14400F + RTX 4060, 8 GB): Bild-zu-Video aus einem echten Shopfoto mit einem Wan-Modell (Modell vor Einrichtung prüfen) über Open Generative AI / Wan2GP, kostenlos und offline. NICHT auf dem Laptop (Intel UHD 620). Nur als kurzer Baustein, immer mit Kennzeichnung 'KI-generiert'. Nutzen bei lokale KI, Wan, Wan2GP, Open Generative AI, Higgsfield-Alternative, 'Foto bewegen', KI-Clip."
---

# maios-ki-lokal – KI-Baustein auf dem RTX-PC

Stand 15.11.2026: **noch nicht eingerichtet.** Nevio will das „für später“. Gemeinsame Regeln: **Skill `maios-video`**.

## Konflikt offen ansprechen
Seit 14.11. gilt „Echt statt KI“. KI-Clips nur als **kurzer Baustein (2–4 s)** in einem sonst echten Video (z. B. Dampf aus dem Humidifier 33, Licht in der Kristallkugel 50), nie als ganzes Video. Jedes Mal sagen: braucht „KI-generiert“ beim Upload.

## Rechner
- **Laptop** (hier läuft Claude Code): i5-8250U, Intel UHD 620, 16 GB RAM, ~25 GB frei → **kein lokales Video möglich.**
- **RTX-PC:** i5-14400F, RTX 4060 (8 GB VRAM). Claude erreicht ihn von hier nicht. Wege: (1) Claude Code dort installieren und das Repo klonen (`Nevio83/test2`), oder (2) Nevio installiert selbst und schickt Ergebnisse.

## Werkzeuge und Lizenzen
- **Open Generative AI** (`github.com/Anil-matcha/Open-Generative-AI`, MIT): Desktop-App. Cloud-Modelle laufen über einen **kostenpflichtigen** Muapi.ai-Schlüssel → nicht nutzen. Lokal: sd.cpp (Bilder) und **Wan2GP** (Video, braucht CUDA).
- **Modellwahl unsicher – vor dem Einrichten prüfen:** Wan 2.1 **1.3B** ist nach letztem Stand nur Text-zu-Video (plus VACE); Bild-zu-Video gibt es bei Wan 2.1 nur als **14B** (in Wan2GP mit Auslagern evtl. auf 8 GB, langsam). Kandidat: **Wan 2.2 TI2V-5B** (Text+Bild-zu-Video) mit Auslagern. Lizenz der Wan-Modelle: Apache-2.0 (kommerziell erlaubt) – je Modell nachsehen.
- **LTX-Video**: eigene Lizenz, vor Einsatz prüfen (nach letztem Stand frei unter 10 Mio. $ Umsatz).
- **Hunyuan Video**: **tabu** (Tencent-Lizenz schließt nach letztem Stand die EU aus).
- **Wan 2.2 14B (A14B)**: für 8 GB zu knapp.
- Alternative Oberfläche: Pinokio (installiert Wan2GP mit einem Klick).
Installation/Download (Modelle mehrere GB) **nur nach Nevios Ja.**

## Ablauf (wenn eingerichtet)
1. Echtes Shopfoto aus `produkt bilder/` als Startbild (Bild-zu-Video, nicht Text-zu-Video).
2. Prompt beschreibt nur Bewegung, die das Produkt wirklich hat (products.json): „sanfter Dampf steigt auf“, „Licht glimmt warm“. Keine neuen Teile, Knöpfe, Texte, Personen.
3. 2–4 s, 9:16 oder Ausschnitt; mehrere Seeds, den besten nehmen.
4. **Prüfen Bild für Bild:** Form, Farbe, Details gleich dem Shopfoto? Erfundene Elemente → verwerfen.
5. Einbauen in `maios-motion-spot` (als Video-Element); Liefer-Paket mit **KI-Kennzeichnung: ja**.
