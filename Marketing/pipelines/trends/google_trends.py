"""Google Trends ueber pytrends.

UNTERSCHIED ZUM BISHERIGEN STAND

Der alte fetch_trends.py hat bei JEDEM Fehler still eine erfundene Zeile
zurueckgegeben ("cozy home office", Sentiment 0.57). Damit war nicht
unterscheidbar, ob Google geantwortet hat oder nicht.

Hier gilt: Fehlt pytrends, gibt es null Zeilen und den Grund. Antwortet
Google nicht, wird der Fehler nach oben gereicht und protokolliert. Es wird
nichts ersetzt.

pytrends ist bewusst OPTIONAL (auskommentiert in requirements.txt): Es zieht
pandas mit, und die Bibliothek bricht regelmaessig, wenn Google seine
internen Endpunkte aendert. Ohne sie laeuft alles Uebrige weiter.
"""

from __future__ import annotations

from typing import Any

from .. import products
from ..orchestrator import guardrails
from .base import TrendQuelle, TrendZeile


class GoogleTrends(TrendQuelle):
    name = "google_trends"
    anbieter = "google_trends"

    def bereit(self) -> tuple[bool, str | None]:
        try:
            from pytrends.request import TrendReq  # noqa: F401
        except ImportError:
            return False, "pytrends ist nicht installiert (optional, siehe requirements.txt)"
        return True, None

    def hole(self) -> list[TrendZeile]:
        from pytrends.request import TrendReq

        anfrage = TrendReq(hl="de-DE", tz=60, retries=2, backoff_factor=0.3)
        zeilen: list[TrendZeile] = []

        # 1) Was Deutschland gerade sucht.
        if guardrails.ratenbegrenzer.warte_bis_erlaubt(self.anbieter, max_sek=20):
            tabelle = anfrage.trending_searches(pn="germany")
            for begriff in tabelle[0].tolist()[:20]:
                zeilen.append(
                    TrendZeile(
                        quelle=self.name,
                        keyword=str(begriff),
                        sprache="de",
                        rohdaten={"art": "trending_search", "region": "DE"},
                    )
                )

        # 2) Verwandte, aufsteigende Suchen zu den eigenen Kategorien.
        #    Das ist der Teil, der wirklich zum Sortiment passt.
        for kategorie in products.kategorien():
            begriff = kategorie.split("/")[0].strip()
            if not begriff:
                continue
            if not guardrails.ratenbegrenzer.warte_bis_erlaubt(self.anbieter, max_sek=20):
                break
            try:
                anfrage.build_payload([begriff], timeframe="now 7-d", geo="DE")
                verwandt = anfrage.related_queries().get(begriff, {}) or {}
                aufsteigend = verwandt.get("rising")
                if aufsteigend is None:
                    continue
                for _, reihe in aufsteigend.head(10).iterrows():
                    zeilen.append(
                        TrendZeile(
                            quelle=self.name,
                            keyword=str(reihe.get("query", "")),
                            # pytrends liefert bei "rising" den prozentualen
                            # Zuwachs; 'Breakout' steht fuer >5000 %.
                            wachstum=_zu_zahl(reihe.get("value")),
                            sprache="de",
                            rohdaten={"art": "related_rising", "kategorie": kategorie,
                                      "wert": str(reihe.get("value"))},
                        )
                    )
            except Exception as fehler:
                # Eine kaputte Kategorie darf die uebrigen nicht mitreissen.
                print(f"[google_trends] Kategorie '{kategorie}' uebersprungen: {fehler}")
                continue

        return zeilen


def _zu_zahl(wert: Any) -> float | None:
    """'Breakout' bzw. '+250%' in eine Zahl uebersetzen — sonst None.

    None statt 0: "unbekannt" und "kein Wachstum" duerfen sich im Score nicht
    gleich auswirken.
    """
    if wert is None:
        return None
    text = str(wert).strip().lower()
    if text in ("breakout", "ausbruch"):
        return 5000.0
    ziffern = "".join(c for c in text if c.isdigit())
    return float(ziffern) if ziffern else None
