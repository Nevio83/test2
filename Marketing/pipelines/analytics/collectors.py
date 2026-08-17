"""Kennzahlen von den Plattformen holen.

WAS SICH GEGENUEBER DEM ALTEN STAND AENDERT

Der bisherige analytics_collector.py gab feste Fantasiezahlen zurueck — 1234
Aufrufe, 210 Likes, jedes Mal dieselben. Damit war jede Auswertung wertlos
und, schlimmer, jede daraus abgeleitete Entscheidung ebenfalls.

Hier gilt dieselbe Regel wie bei den Trends: Ohne Zugangsdaten gibt es
**null Zahlen** und eine Begruendung. Lieber eine leere Auswertung als eine
erfundene — auf erfundenen Zahlen wuerde das Lernmodul in Etappe 10
Entscheidungen treffen.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any

from .. import db
from ..orchestrator import guardrails
from . import metrics


class Sammler(ABC):
    plattform: str = "unbekannt"

    @abstractmethod
    def bereit(self) -> tuple[bool, str | None]:
        """(True, None) wenn abrufbar — sonst der Grund im Klartext."""

    @abstractmethod
    def hole(self, externe_post_id: str) -> dict[str, Any]:
        """Kennzahlen eines Beitrags. Wirft bei Fehlern."""


class TikTokSammler(Sammler):
    plattform = "tiktok"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not (os.environ.get("TIKTOK_ACCESS_TOKEN") or self._marke_aus_db()):
            return False, "TIKTOK_ACCESS_TOKEN fehlt"
        return True, None

    def _marke_aus_db(self) -> str | None:
        if not db.verfuegbar():
            return None
        zeile = db.eine_zeile(
            "SELECT wert FROM mkt_config_overrides WHERE pfad = 'tiktok.access_token'"
        )
        return str(zeile["wert"]) if zeile and zeile["wert"] else None

    def hole(self, externe_post_id: str) -> dict[str, Any]:
        import requests

        marke = os.environ.get("TIKTOK_ACCESS_TOKEN") or self._marke_aus_db()
        if not guardrails.ratenbegrenzer.warte_bis_erlaubt("tiktok", max_sek=30):
            raise RuntimeError("TikTok: Kontingent erschoepft")

        antwort = requests.post(
            "https://open.tiktokapis.com/v2/video/query/",
            headers={"Authorization": f"Bearer {marke}", "Content-Type": "application/json"},
            params={"fields": "id,view_count,like_count,comment_count,share_count,"
                              "play_duration,duration"},
            json={"filters": {"video_ids": [externe_post_id]}},
            timeout=45,
        )
        antwort.raise_for_status()
        videos = ((antwort.json() or {}).get("data") or {}).get("videos") or []
        if not videos:
            raise RuntimeError(f"TikTok kennt den Beitrag {externe_post_id} nicht")
        v = videos[0]

        aufrufe = int(v.get("view_count") or 0)
        laenge = float(v.get("duration") or 0) or None
        gespielt = float(v.get("play_duration") or 0) or None
        return {
            "views": aufrufe,
            "likes": int(v.get("like_count") or 0),
            "kommentare": int(v.get("comment_count") or 0),
            "shares": int(v.get("share_count") or 0),
            # TikTok liefert keine 3-Sekunden-Haltequote ueber diese
            # Schnittstelle. None statt einer geschaetzten Zahl — sonst
            # rechnet das Lernmodul spaeter mit einer Erfindung.
            "retention_3s": None,
            "watchtime_sek": (gespielt / aufrufe) if (gespielt and aufrufe) else None,
            "saves": None, "profilklicks": None, "linkklicks": None,
            "_videolaenge": laenge,
        }


class InstagramSammler(Sammler):
    plattform = "instagram"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("IG_ACCESS_TOKEN"):
            return False, "IG_ACCESS_TOKEN fehlt"
        return True, None

    def hole(self, externe_post_id: str) -> dict[str, Any]:
        import requests

        antwort = requests.get(
            f"https://graph.facebook.com/v21.0/{externe_post_id}/insights",
            params={"metric": "plays,reach,likes,comments,shares,saved,total_interactions",
                    "access_token": os.environ["IG_ACCESS_TOKEN"]},
            timeout=45,
        )
        antwort.raise_for_status()
        werte = {e.get("name"): (e.get("values") or [{}])[0].get("value")
                 for e in (antwort.json() or {}).get("data", [])}
        return {
            "views": werte.get("plays"),
            "likes": werte.get("likes"),
            "kommentare": werte.get("comments"),
            "shares": werte.get("shares"),
            "saves": werte.get("saved"),
            "retention_3s": None, "watchtime_sek": None,
            "profilklicks": None, "linkklicks": None,
        }


class YoutubeSammler(Sammler):
    plattform = "youtube"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        for name in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"):
            if not os.environ.get(name):
                return False, f"{name} fehlt"
        return True, None

    def hole(self, externe_post_id: str) -> dict[str, Any]:
        import requests

        from ..publish.youtube import YouTube

        marke = YouTube()._zugriffsmarke()
        antwort = requests.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "statistics", "id": externe_post_id},
            headers={"Authorization": f"Bearer {marke}"},
            timeout=45,
        )
        antwort.raise_for_status()
        eintraege = (antwort.json() or {}).get("items") or []
        if not eintraege:
            raise RuntimeError(f"YouTube kennt das Video {externe_post_id} nicht")
        s = eintraege[0].get("statistics", {})
        return {
            "views": int(s.get("viewCount") or 0),
            "likes": int(s.get("likeCount") or 0),
            "kommentare": int(s.get("commentCount") or 0),
            "shares": None, "saves": None,
            "retention_3s": None, "watchtime_sek": None,
            "profilklicks": None, "linkklicks": None,
        }


def sammler_fuer(plattform: str) -> Sammler | None:
    for sammler in (TikTokSammler(), InstagramSammler(), YoutubeSammler()):
        if sammler.plattform == plattform:
            return sammler
    return None


def job_metriken_sammeln() -> dict[str, Any]:
    """Faellige Messfenster einsammeln."""
    if not db.verfuegbar():
        return {"grund": db.grund_fuer_fehlende_db()}

    faellig = metrics.faellige_messungen(limit=20)
    if not faellig:
        return {"gemessen": 0, "grund": "kein Messfenster faellig"}

    gemessen = 0
    uebersprungen: dict[str, str] = {}
    for eintrag in faellig:
        plattform = str(eintrag["plattform"])
        sammler = sammler_fuer(plattform)
        if sammler is None:
            uebersprungen[plattform] = "kein Sammler fuer diese Plattform"
            continue
        bereit, grund = sammler.bereit()
        if not bereit:
            uebersprungen[plattform] = grund or "nicht bereit"
            continue
        try:
            werte = sammler.hole(str(eintrag["externe_post_id"]))
            if metrics.speichere(int(eintrag["post_id"]), str(eintrag["fenster"]), werte):
                gemessen += 1
        except Exception as fehler:
            print(f"[metrics] {plattform} #{eintrag['post_id']} {eintrag['fenster']}: {fehler}")
            uebersprungen[plattform] = str(fehler)[:120]

    for plattform, grund in uebersprungen.items():
        print(f"[metrics] {plattform}: nicht gemessen — {grund}")
    print(f"[metrics] {gemessen} Messung(en) gespeichert")
    return {"gemessen": gemessen, "faellig": len(faellig), "uebersprungen": uebersprungen}
