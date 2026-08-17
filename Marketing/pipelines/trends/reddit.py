"""Reddit als Trendquelle.

Bewusst OHNE die Bibliothek praw: Reddit hat einen einfachen
App-only-OAuth-Weg, den requests direkt bedienen kann. Ein Paket weniger ist
ein Paket weniger, das kaputtgehen kann.

Gemessen wird das WACHSTUM je Stunde, nicht die absolute Punktzahl: Ein
Beitrag mit 5.000 Punkten von gestern ist fuer uns wertlos, einer mit 300
Punkten seit 20 Minuten ist ein Trend.
"""

from __future__ import annotations

import os
import time
from typing import Any

from ..orchestrator import guardrails
from .base import TrendQuelle, TrendZeile

# Themenrelevante Subreddits fuer dieses Sortiment (Technik/Gadgets,
# Haushalt/Kueche, Beleuchtung, Koerperpflege/Wellness).
SUBREDDITS = (
    "gadgets", "BuyItForLife", "howto", "InteriorDesign",
    "cozyplaces", "kitchen", "selfcare", "ProductPorn",
)

BASIS = "https://oauth.reddit.com"
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
KENNUNG = "maios-marketing/1.0 (Trendbeobachtung)"


class RedditTrends(TrendQuelle):
    name = "reddit"
    anbieter = "reddit"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("REDDIT_CLIENT_ID"):
            return False, "REDDIT_CLIENT_ID fehlt"
        if not os.environ.get("REDDIT_CLIENT_SECRET"):
            return False, "REDDIT_CLIENT_SECRET fehlt"
        return True, None

    def _token(self) -> str:
        import requests

        antwort = requests.post(
            TOKEN_URL,
            auth=(os.environ["REDDIT_CLIENT_ID"], os.environ["REDDIT_CLIENT_SECRET"]),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": KENNUNG},
            timeout=20,
        )
        antwort.raise_for_status()
        marke = antwort.json().get("access_token")
        if not marke:
            raise RuntimeError("Reddit lieferte kein access_token")
        return marke

    def hole(self) -> list[TrendZeile]:
        import requests

        marke = self._token()
        kopf = {"Authorization": f"bearer {marke}", "User-Agent": KENNUNG}
        jetzt = time.time()
        zeilen: list[TrendZeile] = []

        for sub in SUBREDDITS:
            if not guardrails.ratenbegrenzer.warte_bis_erlaubt(self.anbieter, max_sek=20):
                print(f"[reddit] Kontingent erschoepft, breche bei r/{sub} ab")
                break
            antwort = requests.get(
                f"{BASIS}/r/{sub}/hot",
                headers=kopf,
                params={"limit": 15, "raw_json": 1},
                timeout=20,
            )
            if antwort.status_code == 404:
                continue  # Subreddit existiert nicht mehr — auslassen, nicht raten
            antwort.raise_for_status()
            for eintrag in antwort.json().get("data", {}).get("children", []):
                d = eintrag.get("data", {})
                titel = (d.get("title") or "").strip()
                if not titel:
                    continue
                alter_h = max((jetzt - float(d.get("created_utc") or jetzt)) / 3600.0, 0.25)
                punkte = float(d.get("score") or 0)
                zeilen.append(
                    TrendZeile(
                        quelle=self.name,
                        keyword=titel,
                        volumen=punkte,
                        # Punkte je Stunde — das eigentliche Trendmass.
                        wachstum=round(punkte / alter_h, 2),
                        sprache="en",  # diese Subreddits sind englischsprachig
                        rohdaten={
                            "subreddit": sub,
                            "punkte": punkte,
                            "kommentare": d.get("num_comments"),
                            "alter_stunden": round(alter_h, 2),
                            "url": d.get("permalink"),
                        },
                    )
                )
        return zeilen
