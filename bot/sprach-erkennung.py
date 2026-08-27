"""Erkennt, ob in einem Video gesprochen wird.

WOZU
Das `track`-Feld von TikTok ist nur ein Indiz: "original sound" heisst eigene
Aufnahme, ein lizenzierter Titel heisst Musik. Beides kann taeuschen — jemand
kann ueber einen Musiktitel reden. Gemessen wurde ausserdem, dass einfache
Ton-Kennzahlen (Pausenanteil, Energie im Sprachband) die beiden Faelle NICHT
trennen: Die Werte ueberlappen vollstaendig.

Deshalb hier ein echter Spracherkenner (faster-whisper). Er hoert den Ton ab und
meldet, wie viel davon gesprochen wird.

WAS BEWUSST NICHT PASSIERT
Der erkannte TEXT wird nirgends ausgegeben oder gespeichert — nur Kennzahlen.
Der Ton fremder Videos enthaelt Liedtexte und die Stimmen anderer Leute; beides
gehoert nicht in eine Protokolldatei dieses Projekts.

Aufruf:
    py bot/sprach-erkennung.py <videodatei>
Ausgabe: eine Zeile JSON.
"""

import json
import sys


def main(pfad: str) -> int:
    try:
        from faster_whisper import WhisperModel
    except ImportError as fehler:
        # Den ECHTEN Namen nennen: Der Import scheitert genauso, wenn nur eine
        # Abhaengigkeit fehlt (real passiert: numpy). Eine pauschale Meldung
        # "faster-whisper fehlt" schickt einen dann in die falsche Richtung —
        # man installiert etwas, das laengst da ist.
        fehlt = getattr(fehler, "name", None) or "faster-whisper"
        print(json.dumps({
            "ok": False,
            "grund": f"Python-Paket '{fehlt}' fehlt ({fehler}). "
                     f"Installieren: py -m pip install {fehlt}",
        }))
        return 2

    try:
        # "tiny" reicht fuer die Frage "wird geredet?" und ist um ein Vielfaches
        # schneller als die grossen Modelle. int8 auf der CPU, keine Grafikkarte
        # noetig.
        modell = WhisperModel("tiny", device="cpu", compute_type="int8")
        segmente, info = modell.transcribe(pfad, beam_size=1, vad_filter=True)

        rededauer = 0.0
        woerter = 0
        anzahl = 0
        for s in segmente:
            # Segmente, die das Modell selbst fuer Nicht-Sprache haelt, zaehlen
            # nicht mit. Ohne diese Grenze zaehlt jedes Rauschen als Rede.
            if getattr(s, "no_speech_prob", 0.0) > 0.6:
                continue
            rededauer += max(0.0, s.end - s.start)
            woerter += len(s.text.split())
            anzahl += 1

        gesamt = float(info.duration or 0.0)
        print(json.dumps({
            "ok": True,
            "sprache": info.language,
            "sprache_sicherheit": round(float(info.language_probability or 0), 3),
            "dauer": round(gesamt, 2),
            "redeanteil": round(rededauer / gesamt, 3) if gesamt > 0 else 0.0,
            "woerter": woerter,
            "segmente": anzahl,
        }))
        return 0
    except Exception as fehler:  # noqa: BLE001 - der Aufrufer soll den Grund sehen
        print(json.dumps({"ok": False, "grund": f"{type(fehler).__name__}: {fehler}"}))
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "grund": "keine Videodatei angegeben"}))
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
