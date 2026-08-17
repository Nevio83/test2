"""ElevenLabs — Stimmklon, echter Aufruf.

WAS SICH GEGENUEBER DEM ALTEN STAND AENDERT

Der bisherige video_builder.py hat bei gesetztem ELEVENLABS_API_KEY nur
`Path(ziel).touch()` aufgerufen — eine leere Datei. Das Video bekam damit eine
Tonspur von 0 Byte: stumm, aber "fertig". Der Fehlschlag war unsichtbar, weil
alles danach normal weiterlief.

Hier wird die Antwort wirklich gestreamt und danach geprueft, ob ueberhaupt
Ton drin ist. Eine leere oder tonlose Datei fuehrt zu einem Fehler, nicht zu
einem stummen Video.
"""

from __future__ import annotations

import os
from pathlib import Path

from ...orchestrator import guardrails
from .base import Sprachausgabe, Stimme

ENDPUNKT = "https://api.elevenlabs.io/v1/text-to-speech"


class ElevenLabsStimme(Stimme):
    name = "elevenlabs"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("ELEVENLABS_API_KEY"):
            return False, "ELEVENLABS_API_KEY fehlt"
        if not os.environ.get("ELEVENLABS_VOICE_ID"):
            return False, "ELEVENLABS_VOICE_ID fehlt"
        darf, grund = guardrails.darf_kosten_verursachen()
        if not darf:
            return False, grund
        return True, None

    def sprich(self, text: str, ziel: Path) -> Sprachausgabe:
        import requests

        from .. import common

        if not guardrails.ratenbegrenzer.warte_bis_erlaubt("elevenlabs", max_sek=30):
            raise RuntimeError("ElevenLabs: Kontingent erschoepft")

        stimme_id = os.environ["ELEVENLABS_VOICE_ID"]
        ziel.parent.mkdir(parents=True, exist_ok=True)

        antwort = requests.post(
            f"{ENDPUNKT}/{stimme_id}/stream",
            headers={
                "xi-api-key": os.environ["ELEVENLABS_API_KEY"],
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": text,
                "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.8},
            },
            timeout=120,
            stream=True,
        )
        antwort.raise_for_status()

        roh = ziel.with_suffix(".mp3")
        geschrieben = 0
        with open(roh, "wb") as datei:
            for stueck in antwort.iter_content(chunk_size=8192):
                if stueck:
                    datei.write(stueck)
                    geschrieben += len(stueck)

        if geschrieben == 0:
            raise RuntimeError("ElevenLabs lieferte 0 Byte — genau der alte stille Fehlschlag")

        # In ein einheitliches Format bringen, damit der Schnitt spaeter nicht
        # ueber unterschiedliche Abtastraten stolpert.
        common.lauf(["-i", str(roh), "-ar", "48000", "-ac", "1", str(ziel)])
        dauer = common.tondauer(ziel)
        if dauer <= 0.05:
            raise RuntimeError("ElevenLabs-Datei enthaelt keinen hoerbaren Ton")

        # Abrechnung nach Zeichen — so rechnet der Anbieter auch.
        cent = int(round(len(text) / 1000.0 * float(
            guardrails.wert("llm.preise.elevenlabs.cent_pro_1000_zeichen", 30)
        )))
        guardrails.buche_kosten("elevenlabs", cent, endpunkt="tts",
                                einheiten=len(text), job="render_style_a")
        try:
            roh.unlink()
        except OSError:
            pass
        return Sprachausgabe(ziel, dauer, self.name, cent)
