"""Von der Reichweite zur Bestellung.

DER ZUSTAND, EHRLICH BENANNT

Die Kette Beitrag -> Klick -> Sitzung -> Bestellung ist im Shop an ZWEI
Stellen unterbrochen. Beide wurden am 15.08.2026 an der echten Datenbank
nachgemessen:

  1. view-tracker.js speichert `location.pathname`. Das schneidet die
     Parameter ab — die Kennung `?utm_campaign=mkt_42` landet also NIE in
     page_views. Nachgemessen: kein einziger Pfad in der Tabelle enthaelt ein
     Fragezeichen.

  2. `orders` hat keine Spalte fuer Sitzung, Kampagne oder Herkunft. Selbst
     mit gespeicherter Kennung liesse sich eine Bestellung keiner Sitzung
     zuordnen.

Beide Aenderungen liegen ausserhalb dessen, was diese Runde anfassen darf
(Kundenseiten und bestehende Tabellen). Sie sind in FORTSCHRITT.md als
Rueckfrage vermerkt.

WAS DIESES MODUL TROTZDEM TUT

Es rechnet, was sich mit den vorhandenen Daten ehrlich rechnen laesst, und
sagt bei allem anderen ausdruecklich "nicht messbar" statt eine Zahl zu
liefern, die niemand hinterfragt.

  * `utm_sitzungen()` — echte Zuordnung. Liefert 0 und einen Grund, solange
    die Kennung nicht gespeichert wird.
  * `produktseiten_nach_post()` — was NACH einer Veroeffentlichung auf der
    beworbenen Produktseite passiert ist. Das ist KEINE Zuordnung, sondern
    ein zeitlicher Zusammenhang; es ist entsprechend benannt und wird auch
    so gespeichert.

Warum nicht einfach zeitlich zuordnen und es Attribution nennen? Weil das
Lernmodul in Etappe 10 mit 40 % Gewicht auf den Deckungsbeitrag schaut. Eine
erfundene Zuordnung wuerde dort zu echten Fehlentscheidungen fuehren — und
zwar dauerhaft, weil niemand die Zahl anzweifelt.
"""

from __future__ import annotations

from typing import Any

from .. import db, products


def utm_wird_gespeichert() -> tuple[bool, str | None]:
    """Kann die Kennung ueberhaupt ankommen?

    Geprueft wird an den echten Daten, nicht an einer Annahme: Gibt es
    ueberhaupt einen Seitenaufruf mit Parametern?
    """
    if not db.verfuegbar():
        return False, db.grund_fuer_fehlende_db()
    zeile = db.eine_zeile(
        "SELECT count(*)::int AS n FROM page_views WHERE path LIKE '%%utm_campaign%%'"
    )
    if zeile and int(zeile["n"]) > 0:
        return True, None
    return False, (
        "keine Seitenaufrufe mit utm_campaign — view-tracker.js speichert "
        "location.pathname und schneidet die Parameter ab"
    )


def bestellung_hat_herkunft() -> tuple[bool, str | None]:
    """Laesst sich eine Bestellung einer Sitzung zuordnen?"""
    if not db.verfuegbar():
        return False, db.grund_fuer_fehlende_db()
    zeile = db.eine_zeile(
        """SELECT count(*)::int AS n FROM information_schema.columns
            WHERE table_name = 'orders'
              AND (column_name ILIKE '%%utm%%' OR column_name ILIKE '%%session%%')"""
    )
    if zeile and int(zeile["n"]) > 0:
        return True, None
    return False, "orders hat keine Spalte fuer Sitzung oder Kampagne"


def utm_sitzungen(kampagne: str, *, seit_stunden: int = 168) -> int:
    """Sitzungen, die ueber diese Kampagne kamen — echte Zuordnung.

    Gibt 0 zurueck, solange die Kennung nicht gespeichert wird. Das ist
    keine Null-Messung, sondern eine fehlende Messung; der Aufrufer erfaehrt
    ueber utm_wird_gespeichert(), welcher der beiden Faelle vorliegt.
    """
    moeglich, _ = utm_wird_gespeichert()
    if not moeglich:
        return 0
    zeile = db.eine_zeile(
        """SELECT count(DISTINCT session_id)::int AS n
             FROM page_views
            WHERE path LIKE %s
              AND created_at > now() - make_interval(hours => %s)""",
        (f"%utm_campaign={kampagne}%", seit_stunden),
    )
    return int(zeile["n"]) if zeile else 0


def produktseiten_nach_post(produkt_id: int, gepostet_am, *, fenster_stunden: int = 72
                            ) -> dict[str, Any]:
    """Was nach der Veroeffentlichung auf der Produktseite passierte.

    ACHTUNG: Das ist ein ZEITLICHER ZUSAMMENHANG, keine Zuordnung. Ein
    Besucher, der zufaellig eine Stunde spaeter ueber Google kommt, zaehlt
    hier mit. Der Wert taugt als Hinweis, nicht als Erfolgsnachweis —
    deshalb heisst er auch nicht "Zuordnung".
    """
    produkt = products.nach_id(produkt_id)
    if produkt is None or not db.verfuegbar():
        return {"aufrufe": 0, "sitzungen": 0, "belastbar": False}

    zeile = db.eine_zeile(
        """SELECT count(*)::int AS aufrufe,
                  count(DISTINCT session_id)::int AS sitzungen
             FROM page_views
            WHERE path LIKE %s
              AND created_at BETWEEN %s AND %s + make_interval(hours => %s)""",
        (f"%/{produkt.slug}.html", gepostet_am, gepostet_am, fenster_stunden),
    )
    return {
        "aufrufe": int(zeile["aufrufe"]) if zeile else 0,
        "sitzungen": int(zeile["sitzungen"]) if zeile else 0,
        "belastbar": False,   # ausdruecklich: nur zeitlicher Zusammenhang
    }


def bestellungen_fuer_kampagne(kampagne: str, produkt_id: int, gepostet_am,
                               *, fenster_stunden: int = 72) -> dict[str, Any]:
    """Bestellungen samt Umsatz und Deckungsbeitrag.

    Solange `orders` keine Herkunft kennt, wird NICHTS zugeordnet — die
    Funktion liefert dann Nullen mit `belastbar = False`. Sobald die Spalte
    existiert, greift der obere Zweig und rechnet echt.
    """
    ergebnis = {"bestellungen": 0, "umsatz": 0.0, "deckungsbeitrag": 0.0, "belastbar": False}
    if not db.verfuegbar():
        return ergebnis

    hat_herkunft, _ = bestellung_hat_herkunft()
    if hat_herkunft:
        zeile = db.eine_zeile(
            """SELECT count(DISTINCT o.order_id)::int AS n,
                      COALESCE(SUM(oi.total_price), 0)::float AS umsatz
                 FROM orders o
                 JOIN order_items oi ON oi.order_id = o.order_id
                WHERE o.utm_campaign = %s
                  AND o.payment_status <> 'failed'""",
            (kampagne,),
        )
        if zeile:
            ergebnis.update({
                "bestellungen": int(zeile["n"]),
                "umsatz": float(zeile["umsatz"]),
                "deckungsbeitrag": _deckungsbeitrag(produkt_id, float(zeile["umsatz"])),
                "belastbar": True,
            })
    return ergebnis


def _deckungsbeitrag(produkt_id: int, umsatz: float) -> float:
    """Deckungsbeitrag aus dem hinterlegten Einkaufspreis.

    Ohne hinterlegten Einkaufspreis gibt es 0.0 — keine Schaetzung. Eine
    geschaetzte Marge waere hier besonders heikel: Das Lernmodul gewichtet
    den Deckungsbeitrag mit 40 %.
    """
    from ..matcher import marge_prozent

    produkt = products.nach_id(produkt_id)
    if produkt is None or umsatz <= 0:
        return 0.0
    marge, _ = marge_prozent(produkt)
    if marge is None:
        return 0.0
    return round(umsatz * (marge / (100.0 + marge)), 2)


def berechne_fuer_post(post_id: int) -> dict[str, Any] | None:
    """Zuordnung eines Beitrags berechnen und ablegen."""
    if not db.verfuegbar():
        return None
    zeile = db.eine_zeile(
        """SELECT p.id, p.video_id, p.gepostet_am, p.status, m.produkt_id
             FROM mkt_posts p
             JOIN mkt_videos v ON v.id = p.video_id
             JOIN mkt_briefs b ON b.id = v.brief_id
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE p.id = %s""",
        (post_id,),
    )
    if not zeile or zeile["status"] != "gepostet" or zeile["gepostet_am"] is None:
        return None

    kampagne = f"mkt_{int(zeile['video_id'])}"
    produkt_id = int(zeile["produkt_id"])

    sitzungen = utm_sitzungen(kampagne)
    bestellungen = bestellungen_fuer_kampagne(kampagne, produkt_id, zeile["gepostet_am"])
    zeitlich = produktseiten_nach_post(produkt_id, zeile["gepostet_am"])

    db.ausfuehren(
        """INSERT INTO mkt_attribution
             (post_id, utm_kampagne, shop_sessions, warenkorb_ereignisse,
              bestellungen, umsatz, deckungsbeitrag)
           VALUES (%s, %s, %s, 0, %s, %s, %s)
           ON CONFLICT (post_id) DO UPDATE
             SET shop_sessions = EXCLUDED.shop_sessions,
                 bestellungen = EXCLUDED.bestellungen,
                 umsatz = EXCLUDED.umsatz,
                 deckungsbeitrag = EXCLUDED.deckungsbeitrag,
                 berechnet_am = now()""",
        (post_id, kampagne, sitzungen, bestellungen["bestellungen"],
         bestellungen["umsatz"], bestellungen["deckungsbeitrag"]),
    )
    return {
        "kampagne": kampagne, "sitzungen": sitzungen,
        **bestellungen, "zeitlicher_zusammenhang": zeitlich,
    }


def messbarkeit() -> dict[str, Any]:
    """Was laesst sich gerade ueberhaupt messen? Fuer Dashboard und Bericht.

    Diese Auskunft ist wichtiger als jede Zahl: Sie sagt, ob die Zahlen
    darunter etwas wert sind.
    """
    utm_ok, utm_grund = utm_wird_gespeichert()
    orders_ok, orders_grund = bestellung_hat_herkunft()
    return {
        "utm_wird_gespeichert": utm_ok,
        "utm_grund": utm_grund,
        "bestellung_hat_herkunft": orders_ok,
        "bestellung_grund": orders_grund,
        "umsatz_zuordnung_moeglich": utm_ok and orders_ok,
        "fehlt": [g for g in (utm_grund, orders_grund) if g],
    }
