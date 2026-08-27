"""Instagram Reels ueber die Graph API.

Braucht ein Geschaeftskonto, eine verknuepfte Facebook-Seite und eine
oeffentlich erreichbare Videoadresse — Instagram laedt das Video selbst
herunter, man kann es nicht hochladen. Genau deshalb ist diese Plattform in
der Konfiguration standardmaessig NICHT freigeschaltet: Ohne oeffentlichen
Speicherort funktioniert sie nicht, und ein Weg, der nur so aussieht als
funktioniere er, ist schlimmer als keiner.
"""

from __future__ import annotations

import os
import time

from ..orchestrator import guardrails
from .base import Beitrag, Plattform, Veroeffentlichungsfehler

BASIS = "https://graph.facebook.com/v21.0"


class Instagram(Plattform):
    name = "instagram"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("IG_ACCESS_TOKEN"):
            return False, "IG_ACCESS_TOKEN fehlt"
        if not os.environ.get("IG_USER_ID"):
            return False, "IG_USER_ID fehlt"
        if not os.environ.get("MARKETING_PUBLIC_VIDEO_BASE"):
            return False, ("MARKETING_PUBLIC_VIDEO_BASE fehlt — Instagram laedt das Video "
                           "selbst von einer oeffentlichen Adresse")
        return True, None

    def _oeffentliche_url(self, beitrag: Beitrag) -> str:
        basis = os.environ["MARKETING_PUBLIC_VIDEO_BASE"].rstrip("/")
        return f"{basis}/{beitrag.video_pfad.name}"

    def poste(self, beitrag: Beitrag) -> str:
        import requests

        if not guardrails.ratenbegrenzer.warte_bis_erlaubt("instagram", max_sek=30):
            raise Veroeffentlichungsfehler("Instagram: Kontingent erschoepft")

        marke = os.environ["IG_ACCESS_TOKEN"]
        konto = os.environ["IG_USER_ID"]

        # 1) Container anlegen.
        anlegen = requests.post(
            f"{BASIS}/{konto}/media",
            data={
                "media_type": "REELS",
                "video_url": self._oeffentliche_url(beitrag),
                "caption": beitrag.caption[:2200],
                "share_to_feed": "true",
                "access_token": marke,
            },
            timeout=90,
        )
        anlegen.raise_for_status()
        container = anlegen.json().get("id")
        if not container:
            raise Veroeffentlichungsfehler(f"Instagram lieferte keine Container-Nummer: {anlegen.text[:200]}")

        # 2) Warten, bis Instagram das Video geholt und verarbeitet hat.
        frist = time.monotonic() + 420
        while time.monotonic() < frist:
            time.sleep(10)
            stand = requests.get(
                f"{BASIS}/{container}",
                params={"fields": "status_code,status", "access_token": marke},
                timeout=30,
            )
            stand.raise_for_status()
            zustand = stand.json().get("status_code")
            if zustand == "FINISHED":
                break
            if zustand == "ERROR":
                raise Veroeffentlichungsfehler(f"Instagram-Verarbeitung fehlgeschlagen: {stand.text[:200]}")
        else:
            raise TimeoutError("Instagram verarbeitete das Video nicht innerhalb von 7 Minuten")

        # 3) Veroeffentlichen.
        senden = requests.post(
            f"{BASIS}/{konto}/media_publish",
            data={"creation_id": container, "access_token": marke},
            timeout=60,
        )
        senden.raise_for_status()
        beitrag_id = senden.json().get("id")
        if not beitrag_id:
            raise Veroeffentlichungsfehler("Instagram bestaetigte die Veroeffentlichung nicht")
        return str(beitrag_id)
