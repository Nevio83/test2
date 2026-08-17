"""ExplodingTopics — nur wenn ein Schluessel gesetzt ist.

Bewusst die schlankste Quelle: kostenpflichtiger Dienst, der ohne bezahlten
Zugang gar nichts liefert. Ohne Schluessel wird sie sauber uebersprungen
statt, wie bisher, eine erfundene Zeile zurueckzugeben.
"""

from __future__ import annotations

import os
from typing import Any

from ..orchestrator import guardrails
from .base import TrendQuelle, TrendZeile

ENDPUNKT = "https://api.explodingtopics.com/v1/topics"


class ExplodingTopics(TrendQuelle):
    name = "exploding_topics"
    anbieter = "exploding_topics"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("EXPLODING_TOPICS_API_KEY"):
            return False, "EXPLODING_TOPICS_API_KEY fehlt (kostenpflichtiger Dienst)"
        return True, None

    def hole(self) -> list[TrendZeile]:
        import requests

        antwort = requests.get(
            ENDPUNKT,
            headers={"Authorization": f"Bearer {os.environ['EXPLODING_TOPICS_API_KEY']}"},
            params={"limit": 30, "country": "DE"},
            timeout=25,
        )
        antwort.raise_for_status()
        zeilen: list[TrendZeile] = []
        for eintrag in antwort.json().get("topics", []) or []:
            begriff = (eintrag.get("topic") or eintrag.get("name") or "").strip()
            if not begriff:
                continue
            zeilen.append(
                TrendZeile(
                    quelle=self.name,
                    keyword=begriff,
                    volumen=_zahl(eintrag.get("search_volume")),
                    wachstum=_zahl(eintrag.get("growth")),
                    sprache="en",
                    rohdaten={"kategorie": eintrag.get("category"),
                              "status": eintrag.get("status")},
                )
            )
        return zeilen


def _zahl(wert: Any) -> float | None:
    try:
        return float(wert)
    except (TypeError, ValueError):
        return None
