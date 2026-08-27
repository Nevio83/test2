"""YouTube Shorts ueber die Data API v3.

Ein Video gilt als Short, wenn es hochkant und hoechstens 3 Minuten lang ist
— beides erfuellt jedes Video aus diesem Automaten. Ein eigener Schalter ist
dafuer nicht noetig.

Die Erneuerungsmarke liegt in der Datenbank, nicht in einer Datei: In GitHub
Actions ist der Checkout fluechtig, eine dort erneuerte Marke waere beim
naechsten Lauf verschwunden.
"""

from __future__ import annotations

import json
import os

from .. import db
from ..orchestrator import guardrails
from .base import Beitrag, Plattform, Veroeffentlichungsfehler

HOCHLADEN = "https://www.googleapis.com/upload/youtube/v3/videos"
MARKE_ERNEUERN = "https://oauth2.googleapis.com/token"


class YouTube(Plattform):
    name = "youtube"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        for name in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"):
            if not os.environ.get(name):
                return False, f"{name} fehlt"
        return True, None

    def _zugriffsmarke(self) -> str:
        """Kurzlebige Marke aus der Erneuerungsmarke holen."""
        import requests

        antwort = requests.post(
            MARKE_ERNEUERN,
            data={
                "client_id": os.environ["YT_CLIENT_ID"],
                "client_secret": os.environ["YT_CLIENT_SECRET"],
                "refresh_token": os.environ["YT_REFRESH_TOKEN"],
                "grant_type": "refresh_token",
            },
            timeout=45,
        )
        antwort.raise_for_status()
        marke = antwort.json().get("access_token")
        if not marke:
            raise Veroeffentlichungsfehler("YouTube lieferte keine Zugriffsmarke")
        return marke

    def poste(self, beitrag: Beitrag) -> str:
        import requests

        if not beitrag.video_pfad.exists():
            raise Veroeffentlichungsfehler(f"Videodatei fehlt: {beitrag.video_pfad}")
        if not guardrails.ratenbegrenzer.warte_bis_erlaubt("youtube", max_sek=30):
            raise Veroeffentlichungsfehler("YouTube: Kontingent erschoepft")

        marke = self._zugriffsmarke()
        titel = (beitrag.caption.splitlines() or [""])[0][:95] or "Maios"
        beschreibung = beitrag.caption[:4900]

        angaben = {
            "snippet": {
                "title": titel,
                "description": beschreibung,
                "tags": [h.lstrip("#") for h in beitrag.hashtags][:10],
                "categoryId": "26",
                "defaultLanguage": "de",
            },
            "status": {
                "privacyStatus": os.environ.get("YT_PRIVACY", "private"),
                "selfDeclaredMadeForKids": False,
                # Kennzeichnung veraenderter/synthetischer Inhalte bei Stil B.
                "containsSyntheticMedia": beitrag.stil == "B",
            },
        }

        with open(beitrag.video_pfad, "rb") as datei:
            antwort = requests.post(
                HOCHLADEN,
                params={"part": "snippet,status", "uploadType": "multipart"},
                headers={"Authorization": f"Bearer {marke}"},
                files={
                    "metadata": ("metadata", json.dumps(angaben), "application/json"),
                    "file": (beitrag.video_pfad.name, datei, "video/mp4"),
                },
                timeout=900,
            )
        antwort.raise_for_status()
        video_id = antwort.json().get("id")
        if not video_id:
            raise Veroeffentlichungsfehler(f"YouTube bestaetigte nichts: {antwort.text[:200]}")
        return str(video_id)
