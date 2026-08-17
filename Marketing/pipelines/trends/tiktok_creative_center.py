"""TikTok Creative Center — oeffentliche Hashtag-Ranglisten fuer Region DE.

DIESE QUELLE IST DIE ZERBRECHLICHSTE

Sie haengt an einem Endpunkt, den TikTok nicht als API zusagt. Er kann sich
jederzeit aendern. Genau deshalb ist hier eine Regel eingebaut, die es sonst
nirgends gibt:

  Aendert sich die ANTWORTSTRUKTUR, gibt es null Zeilen UND einen Alarm.

Ohne den Alarm waere ein Strukturbruch der perfekte stille Fehler: Die Quelle
liefert nichts, das System laeuft weiter, niemand merkt monatelang, dass die
wichtigste externe Plattform fehlt. Ein leeres Ergebnis ist hier also nicht
dasselbe wie "gerade kein Trend" — es ist verdaechtig.

Die Saettigung kommt hier echt aus den Daten: Wie viele Videos es zu einem
Hashtag schon gibt, ist genau die Zahl, die sagt, wie umkaempft ein Thema ist.
"""

from __future__ import annotations

from typing import Any

from .. import db
from ..orchestrator import guardrails
from .base import TrendQuelle, TrendZeile

ENDPUNKT = (
    "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list"
)
KOPF = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class TiktokCreativeCenter(TrendQuelle):
    name = "tiktok"
    anbieter = "tiktok"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        return True, None

    def hole(self) -> list[TrendZeile]:
        import requests

        if not guardrails.ratenbegrenzer.warte_bis_erlaubt(self.anbieter, max_sek=20):
            return []

        antwort = requests.get(
            ENDPUNKT,
            params={"page": 1, "limit": 30, "period": 7, "country_code": "DE",
                    "sort_by": "popular"},
            headers=KOPF,
            timeout=25,
        )
        if antwort.status_code >= 400:
            raise RuntimeError(f"TikTok antwortete mit {antwort.status_code}")

        try:
            nutzlast = antwort.json()
        except ValueError:
            self._strukturbruch("Antwort ist kein JSON")
            return []

        liste = (nutzlast.get("data") or {}).get("list")
        if not isinstance(liste, list):
            self._strukturbruch(
                f"erwartet wurde data.list als Liste, bekam {type(liste).__name__}"
            )
            return []

        zeilen: list[TrendZeile] = []
        for eintrag in liste:
            if not isinstance(eintrag, dict):
                continue
            name = (eintrag.get("hashtag_name") or "").strip()
            if not name:
                continue
            veroeffentlichungen = _zahl(eintrag.get("publish_cnt"))
            zeilen.append(
                TrendZeile(
                    quelle=self.name,
                    keyword=f"#{name}" if not name.startswith("#") else name,
                    volumen=_zahl(eintrag.get("video_views")),
                    wachstum=_zahl(eintrag.get("trend_score")),
                    # Viele Videos = umkaempft. Auf 0..1 gestaucht, Grenze
                    # bei 100.000 Veroeffentlichungen.
                    saettigung=(
                        min(veroeffentlichungen / 100_000.0, 1.0)
                        if veroeffentlichungen is not None else None
                    ),
                    sprache="de",
                    rohdaten={
                        "veroeffentlichungen": veroeffentlichungen,
                        "rang": eintrag.get("rank"),
                        "land": "DE",
                    },
                )
            )

        if not zeilen:
            self._strukturbruch("Liste war leer — TikTok liefert normalerweise Eintraege")
        return zeilen

    def _strukturbruch(self, was: str) -> None:
        """Laut sein. Ein stiller Strukturbruch ist der teuerste Fehler hier."""
        meldung = f"TikTok Creative Center: Struktur hat sich geaendert — {was}"
        print(f"[tiktok] ⚠️ {meldung}")
        db.audit(
            "quelle_strukturbruch",
            job="trends_ingest",
            begruendung=meldung,
            alternativen={"endpunkt": ENDPUNKT},
        )


def _zahl(wert: Any) -> float | None:
    try:
        return float(wert)
    except (TypeError, ValueError):
        return None
