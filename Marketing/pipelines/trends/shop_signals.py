"""Die eigenen Shop-Daten als Trendquelle.

WARUM DAS DIE WICHTIGSTE QUELLE IST

Google Trends, TikTok und Reddit sehen alle dasselbe wie jeder Wettbewerber.
Die Daten dieses Shops sieht sonst niemand. Sie sind ausserdem die einzigen,
die schon eine Kaufabsicht enthalten — jemand war hier und hat etwas gesucht.

Vier Signale, absteigend nach Aussagekraft:

  1. SUCHEN OHNE TREFFER — das ist Nachfrage ohne Angebot. Jemand wollte
     etwas kaufen, das es hier nicht gibt. Kein anderes Signal ist so nah an
     einer verpassten Bestellung; deshalb bekommt es das hoechste Gewicht.
  2. Verkaeufe — was tatsaechlich gekauft wird, mit Deckungsbeitrag.
  3. Warenkorbabbrueche — Interesse, das an der letzten Huerde scheitert.
  4. Seitenaufrufe — Aufmerksamkeit, aber noch keine Absicht.

DATENSCHUTZ
Alles hier ist aggregiert: Zaehlungen, keine Personen. Es werden keine
Sitzungen, E-Mail-Adressen oder IPs gelesen. Das ist dieselbe Linie wie das
Marktforschungs-Dashboard des Shops.
"""

from __future__ import annotations

import json
from typing import Any

from .. import db, products
from .base import TrendQuelle, TrendZeile

# Wie weit zurueck geschaut wird. 30 Tage: kurz genug, dass es aktuell ist,
# lang genug, dass bei diesem Besucheraufkommen ueberhaupt Zeilen zusammen-
# kommen (der Shop hatte im Messzeitraum 59 Besucher).
FENSTER_TAGE = 30


class ShopSignale(TrendQuelle):
    name = "shop"
    anbieter = ""  # eigene Datenbank, keine Ratenbegrenzung noetig

    def bereit(self) -> tuple[bool, str | None]:
        if not db.verfuegbar():
            return False, db.grund_fuer_fehlende_db()
        return True, None

    def hole(self) -> list[TrendZeile]:
        zeilen: list[TrendZeile] = []
        zeilen += self._suchen_ohne_treffer()
        zeilen += self._suchen_mit_treffer()
        zeilen += self._verkaeufe()
        zeilen += self._warenkorbabbrueche()
        zeilen += self._seitenaufrufe()
        return zeilen

    # ── 1. Suchen ohne Treffer ───────────────────────────────────────

    def _suchen_ohne_treffer(self) -> list[TrendZeile]:
        """Nachfrage, fuer die es kein Produkt gibt. Das staerkste Signal."""
        rohe = db.abfragen(
            """SELECT lower(trim(term)) AS begriff,
                      COUNT(*)::int      AS anzahl,
                      MAX(created_at)    AS zuletzt
                 FROM search_events
                WHERE created_at > now() - make_interval(days => %s)
                  AND COALESCE(results_count, 0) = 0
                  AND length(trim(term)) > 2
                GROUP BY 1
                ORDER BY anzahl DESC
                LIMIT 25""",
            (FENSTER_TAGE,),
        )
        return [
            TrendZeile(
                quelle=self.name,
                keyword=z["begriff"],
                volumen=float(z["anzahl"]),
                sprache="de",
                rohdaten={"art": "null_treffer", "anzahl": z["anzahl"],
                          "zuletzt": str(z["zuletzt"])},
            )
            for z in rohe
        ]

    # ── 2. Suchen mit Treffer ────────────────────────────────────────

    def _suchen_mit_treffer(self) -> list[TrendZeile]:
        """Wonach gesucht wird und es auch gibt — bestaetigtes Interesse."""
        rohe = db.abfragen(
            """SELECT lower(trim(term)) AS begriff,
                      COUNT(*)::int      AS anzahl
                 FROM search_events
                WHERE created_at > now() - make_interval(days => %s)
                  AND COALESCE(results_count, 0) > 0
                  AND length(trim(term)) > 2
                GROUP BY 1
                ORDER BY anzahl DESC
                LIMIT 25""",
            (FENSTER_TAGE,),
        )
        return [
            TrendZeile(
                quelle=self.name,
                keyword=z["begriff"],
                volumen=float(z["anzahl"]),
                sprache="de",
                rohdaten={"art": "suche", "anzahl": z["anzahl"]},
            )
            for z in rohe
        ]

    # ── 3. Verkaeufe ─────────────────────────────────────────────────

    def _verkaeufe(self) -> list[TrendZeile]:
        """Was tatsaechlich gekauft wird. Naeher an Geld geht nicht."""
        rohe = db.abfragen(
            """SELECT oi.product_id,
                      MAX(oi.product_name)      AS name,
                      SUM(oi.quantity)::int     AS stueck,
                      SUM(oi.total_price)::float AS umsatz
                 FROM order_items oi
                 JOIN orders o ON o.order_id = oi.order_id
                WHERE o.created_at > now() - make_interval(days => %s)
                  AND o.payment_status <> 'failed'
                GROUP BY oi.product_id
                ORDER BY stueck DESC
                LIMIT 20""",
            (FENSTER_TAGE,),
        )
        zeilen = []
        for z in rohe:
            name = z["name"] or ""
            if not name:
                continue
            zeilen.append(
                TrendZeile(
                    quelle=self.name,
                    keyword=name.lower(),
                    volumen=float(z["stueck"]),
                    sprache="de",
                    rohdaten={"art": "verkauf", "produkt_id": z["product_id"],
                              "stueck": z["stueck"], "umsatz": z["umsatz"]},
                )
            )
        return zeilen

    # ── 4. Warenkorbabbrueche ────────────────────────────────────────

    def _warenkorbabbrueche(self) -> list[TrendZeile]:
        """Interesse, das an der letzten Huerde gescheitert ist.

        Der Warenkorb liegt als JSON-Text vor; die Produkte werden hier
        gezaehlt, nicht die Personen. Kaputtes JSON wird uebersprungen, nicht
        geraten.
        """
        rohe = db.abfragen(
            """SELECT cart_json
                 FROM abandoned_carts
                WHERE created_at > now() - make_interval(days => %s)
                  AND status <> 'gekauft'
                LIMIT 500""",
            (FENSTER_TAGE,),
        )
        zaehler: dict[int, int] = {}
        for z in rohe:
            try:
                inhalt = z["cart_json"]
                artikel = json.loads(inhalt) if isinstance(inhalt, str) else inhalt
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(artikel, list):
                continue
            for a in artikel:
                try:
                    pid = int(a.get("id"))
                except (TypeError, ValueError, AttributeError):
                    continue
                zaehler[pid] = zaehler.get(pid, 0) + int(a.get("quantity") or 1)

        zeilen = []
        for pid, anzahl in sorted(zaehler.items(), key=lambda x: -x[1])[:20]:
            produkt = products.nach_id(pid)
            if produkt is None:
                continue
            zeilen.append(
                TrendZeile(
                    quelle=self.name,
                    keyword=produkt.name.lower(),
                    volumen=float(anzahl),
                    sprache="de",
                    rohdaten={"art": "warenkorbabbruch", "produkt_id": pid, "anzahl": anzahl},
                )
            )
        return zeilen

    # ── 5. Seitenaufrufe ─────────────────────────────────────────────

    def _seitenaufrufe(self) -> list[TrendZeile]:
        """Welche Produktseiten Zulauf haben.

        Der Pfad enthaelt den Slug; darueber wird das Produkt aufgeloest.
        Ein Pfad ohne passendes Produkt wird ausgelassen statt geraten.
        """
        rohe = db.abfragen(
            """SELECT path,
                      COUNT(*)::int                  AS aufrufe,
                      COUNT(DISTINCT session_id)::int AS besucher,
                      AVG(NULLIF(time_on_page, 0))::float AS verweildauer
                 FROM page_views
                WHERE created_at > now() - make_interval(days => %s)
                  AND path LIKE '%%/produkte/%%'
                GROUP BY path
                ORDER BY aufrufe DESC
                LIMIT 25""",
            (FENSTER_TAGE,),
        )
        nach_slug = {p.slug: p for p in products.alle()}
        zeilen = []
        for z in rohe:
            pfad = (z["path"] or "").rstrip("/")
            slug = pfad.rsplit("/", 1)[-1].removesuffix(".html")
            produkt = nach_slug.get(slug)
            if produkt is None:
                continue
            zeilen.append(
                TrendZeile(
                    quelle=self.name,
                    keyword=produkt.name.lower(),
                    volumen=float(z["aufrufe"]),
                    sprache="de",
                    rohdaten={"art": "seitenaufruf", "produkt_id": produkt.id,
                              "aufrufe": z["aufrufe"], "besucher": z["besucher"],
                              "verweildauer": z["verweildauer"]},
                )
            )
        return zeilen


def job_shop_signale() -> dict[str, Any]:
    """Job-Einstieg: Shop-Signale holen und als Trends ablegen."""
    from .normalize import schreibe_trends

    quelle = ShopSignale()
    zeilen, grund = quelle.abrufen_sicher()
    if grund:
        print(f"[shop_signals] keine Zeilen — {grund}")
        return {"quelle": "shop", "zeilen": 0, "grund": grund}

    geschrieben = schreibe_trends(zeilen)
    nach_art: dict[str, int] = {}
    for z in zeilen:
        art = str(z.rohdaten.get("art", "?"))
        nach_art[art] = nach_art.get(art, 0) + 1
    print(f"[shop_signals] {geschrieben} Zeilen geschrieben — {nach_art}")
    return {"quelle": "shop", "zeilen": geschrieben, "nach_art": nach_art}
