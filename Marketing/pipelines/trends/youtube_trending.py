"""YouTube als Trendquelle — die meistgesehenen Videos in Deutschland.

Nutzt die YouTube Data API v3 (videos.list, chart=mostPopular, regionCode=DE)
ueber requests. Aus Titeln und Tags werden Begriffe gezogen; das Wachstum
ergibt sich aus Aufrufen je Stunde seit Veroeffentlichung.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from ..orchestrator import guardrails
from .base import TrendQuelle, TrendZeile

ENDPUNKT = "https://www.googleapis.com/youtube/v3/videos"

# 26 = Howto & Style, 28 = Science & Technology, 24 = Entertainment.
# Bewusst nur die Kategorien, die zum Sortiment passen — die Charts sind
# sonst voll mit Musik und Sport.
KATEGORIEN = ("26", "28")


class YoutubeTrends(TrendQuelle):
    name = "youtube"
    anbieter = "youtube"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("YOUTUBE_API_KEY"):
            return False, "YOUTUBE_API_KEY fehlt"
        return True, None

    def hole(self) -> list[TrendZeile]:
        import requests

        schluessel = os.environ["YOUTUBE_API_KEY"]
        jetzt = datetime.now(timezone.utc)
        zeilen: list[TrendZeile] = []

        for kategorie in KATEGORIEN:
            if not guardrails.ratenbegrenzer.warte_bis_erlaubt(self.anbieter, max_sek=20):
                print("[youtube] Kontingent erschoepft")
                break
            antwort = requests.get(
                ENDPUNKT,
                params={
                    "part": "snippet,statistics",
                    "chart": "mostPopular",
                    "regionCode": "DE",
                    "videoCategoryId": kategorie,
                    "maxResults": 25,
                    "key": schluessel,
                },
                timeout=20,
            )
            antwort.raise_for_status()
            for eintrag in antwort.json().get("items", []):
                schnipsel = eintrag.get("snippet", {})
                statistik = eintrag.get("statistics", {})
                titel = (schnipsel.get("title") or "").strip()
                if not titel:
                    continue
                try:
                    veroeffentlicht = datetime.fromisoformat(
                        (schnipsel.get("publishedAt") or "").replace("Z", "+00:00")
                    )
                    alter_h = max((jetzt - veroeffentlicht).total_seconds() / 3600.0, 0.5)
                except ValueError:
                    alter_h = 24.0
                aufrufe = float(statistik.get("viewCount") or 0)
                zeilen.append(
                    TrendZeile(
                        quelle=self.name,
                        keyword=titel,
                        volumen=aufrufe,
                        wachstum=round(aufrufe / alter_h, 2),
                        sprache=(schnipsel.get("defaultAudioLanguage") or "de")[:2],
                        rohdaten={
                            "kategorie": kategorie,
                            "kanal": schnipsel.get("channelTitle"),
                            "tags": (schnipsel.get("tags") or [])[:12],
                            "aufrufe": aufrufe,
                            "likes": statistik.get("likeCount"),
                            "alter_stunden": round(alter_h, 1),
                        },
                    )
                )
        return zeilen
