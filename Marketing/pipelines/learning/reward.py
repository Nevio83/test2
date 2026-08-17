"""Belohnung: wie gut war ein Beitrag wirklich?

DIE GEWICHTUNG IST DIE WICHTIGSTE ENTSCHEIDUNG DES GANZEN SYSTEMS

    0,15  Haltequote (schauen die Leute ueber die ersten 3 Sekunden hinaus?)
    0,15  Anteil gesehener Laufzeit
    0,10  Interaktionen (Likes, Teilen, Speichern, Kommentare)
    0,20  Klicks auf den Link
    0,40  DECKUNGSBEITRAG

Geld schlaegt Eitelkeitszahlen. Ein Video mit 100.000 Aufrufen und null
Bestellungen ist fuer diesen Shop schlechter als eines mit 2.000 Aufrufen und
drei Bestellungen — die Gewichtung bildet das ab.

VERZOEGERTE BEWERTUNG
Ab 6 Stunden gibt es eine vorlaeufige Zahl, endgueltig wird erst nach 72
Stunden entschieden. Vorher wird kein Arm abgeschaltet. Der Grund: Ein
Beitrag, der in der ersten Stunde schlecht laeuft, kann am zweiten Tag
anziehen; wer nach einer Stunde urteilt, wirft genau die weg.

AUSREISSERSCHUTZ
Ein viraler Einzeltreffer wird auf das 95. Perzentil gestutzt. Ohne das
wuerde ein Zufallstreffer die gesamte Politik kippen: Das System wuerde
monatelang eine Kombination bevorzugen, die genau einmal Glueck hatte.
"""

from __future__ import annotations

from typing import Any

from .. import db
from ..analytics import metrics
from ..orchestrator import guardrails


def gewichte() -> dict[str, float]:
    roh = guardrails.wert("lernen.reward_gewichte", {}) or {}
    return {
        "hook_rate": float(roh.get("hook_rate", 0.15)),
        "watch_ratio": float(roh.get("watch_ratio", 0.15)),
        "engagement": float(roh.get("engagement", 0.10)),
        "ctr_link": float(roh.get("ctr_link", 0.20)),
        "deckungsbeitrag": float(roh.get("deckungsbeitrag", 0.40)),
    }


def _anteil(zaehler: Any, nenner: Any) -> float | None:
    """Verhaeltnis — None, wenn es sich nicht bilden laesst.

    None statt 0.0: "nicht gemessen" darf nicht wie "gemessen und null"
    wirken. Sonst wuerde eine fehlende Kennzahl als schlechtes Ergebnis
    gewertet.
    """
    try:
        z, n = float(zaehler), float(nenner)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    return max(0.0, min(z / n, 1.0))


def bestandteile(post_id: int) -> dict[str, Any]:
    """Die einzelnen Anteile der Belohnung — nachvollziehbar gemacht."""
    kennzahlen = metrics.juengste_kennzahlen(post_id) or {}
    zuordnung = {}
    if db.verfuegbar():
        zeile = db.eine_zeile(
            """SELECT shop_sessions, bestellungen, umsatz, deckungsbeitrag
                 FROM mkt_attribution WHERE post_id = %s""",
            (post_id,),
        )
        zuordnung = dict(zeile) if zeile else {}

    aufrufe = kennzahlen.get("views")
    interaktionen = sum(
        int(kennzahlen.get(feld) or 0)
        for feld in ("likes", "shares", "saves", "kommentare")
    )
    videolaenge = None
    if db.verfuegbar():
        zeile = db.eine_zeile(
            """SELECT v.dauer_sek FROM mkt_videos v
                 JOIN mkt_posts p ON p.video_id = v.id WHERE p.id = %s""",
            (post_id,),
        )
        videolaenge = float(zeile["dauer_sek"]) if zeile and zeile["dauer_sek"] else None

    return {
        "hook_rate": kennzahlen.get("retention_3s"),
        "watch_ratio": _anteil(kennzahlen.get("watchtime_sek"), videolaenge),
        "engagement": _anteil(interaktionen, aufrufe),
        "ctr_link": _anteil(kennzahlen.get("linkklicks"), aufrufe),
        "deckungsbeitrag_roh": float(zuordnung.get("deckungsbeitrag") or 0.0),
        "_aufrufe": aufrufe,
        "_bestellungen": int(zuordnung.get("bestellungen") or 0),
    }


def deckungsbeitrag_normiert(betrag: float) -> float:
    """Deckungsbeitrag auf 0..1 bringen — mit Ausreisserschutz.

    Bezugsgroesse ist das 95. Perzentil der bisherigen Betraege. Ein
    einzelner Ausreisser hebt die Messlatte damit nicht fuer alle anderen.
    Ohne Vergleichsdaten wird auf einen Zielwert aus der Konfiguration
    bezogen, damit die ersten Videos ueberhaupt eine Zahl bekommen.
    """
    if betrag <= 0:
        return 0.0
    obergrenze = None
    if db.verfuegbar():
        try:
            perzentil = float(guardrails.wert("lernen.winsorisieren_perzentil", 95)) / 100.0
            zeile = db.eine_zeile(
                """SELECT percentile_cont(%s) WITHIN GROUP (ORDER BY deckungsbeitrag)::float AS p
                     FROM mkt_attribution WHERE deckungsbeitrag > 0""",
                (perzentil,),
            )
            if zeile and zeile["p"]:
                obergrenze = float(zeile["p"])
        except Exception:
            obergrenze = None
    if not obergrenze or obergrenze <= 0:
        obergrenze = float(guardrails.wert("lernen.deckungsbeitrag_zielwert_eur", 15.0))
    return max(0.0, min(betrag / obergrenze, 1.0))


def berechne(post_id: int) -> tuple[float, dict[str, Any]]:
    """Belohnung zwischen 0 und 1 samt Bestandteilen.

    Fehlende Kennzahlen werden NICHT als 0 gewertet, sondern aus der
    Rechnung genommen; die Gewichte der vorhandenen Anteile werden dann
    entsprechend hochskaliert. Sonst wuerde eine Plattform, die keine
    Haltequote liefert, jedes Video kuenstlich schlecht aussehen lassen.
    """
    teile = bestandteile(post_id)
    g = gewichte()

    beitraege: dict[str, float] = {}
    genutzte_gewichte = 0.0

    for name in ("hook_rate", "watch_ratio", "engagement", "ctr_link"):
        wert = teile.get(name)
        if wert is None:
            continue
        beitraege[name] = g[name] * float(wert)
        genutzte_gewichte += g[name]

    # Der Deckungsbeitrag zaehlt IMMER — auch wenn er 0 ist. Null Umsatz ist
    # hier eine echte Messung, keine fehlende: Der Beitrag lief, und es kam
    # nichts dabei heraus.
    db_norm = deckungsbeitrag_normiert(float(teile["deckungsbeitrag_roh"]))
    beitraege["deckungsbeitrag"] = g["deckungsbeitrag"] * db_norm
    genutzte_gewichte += g["deckungsbeitrag"]

    roh = sum(beitraege.values())
    belohnung = roh / genutzte_gewichte if genutzte_gewichte > 0 else 0.0
    belohnung = max(0.0, min(belohnung, 1.0))

    return round(belohnung, 4), {
        **teile,
        "deckungsbeitrag_norm": round(db_norm, 4),
        "beitraege": {k: round(v, 4) for k, v in beitraege.items()},
        "genutzte_gewichte": round(genutzte_gewichte, 3),
        "belohnung": round(belohnung, 4),
    }


def ist_final(post_id: int) -> bool:
    """Ist der Beitrag alt genug fuer eine endgueltige Bewertung?"""
    if not db.verfuegbar():
        return False
    stunden = float(guardrails.wert("lernen.final_ab_stunden", 72))
    zeile = db.eine_zeile(
        """SELECT gepostet_am <= now() - make_interval(secs => %s) AS reif
             FROM mkt_posts WHERE id = %s AND gepostet_am IS NOT NULL""",
        (stunden * 3600.0, post_id),
    )
    return bool(zeile and zeile["reif"])


def speichere(post_id: int) -> dict[str, Any] | None:
    """Belohnung berechnen und ablegen — vorlaeufig oder endgueltig."""
    if not db.verfuegbar():
        return None
    vorlaeufig_ab = float(guardrails.wert("lernen.vorlaeufig_ab_stunden", 6))
    reif = db.eine_zeile(
        """SELECT gepostet_am <= now() - make_interval(secs => %s) AS reif
             FROM mkt_posts WHERE id = %s AND gepostet_am IS NOT NULL""",
        (vorlaeufig_ab * 3600.0, post_id),
    )
    if not reif or not reif["reif"]:
        return None

    import json

    wert, details = berechne(post_id)
    final = ist_final(post_id)
    db.ausfuehren(
        """INSERT INTO mkt_rewards (post_id, reward_vorlaeufig, reward_final, bestandteile)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (post_id) DO UPDATE
             SET reward_vorlaeufig = EXCLUDED.reward_vorlaeufig,
                 reward_final = COALESCE(EXCLUDED.reward_final, mkt_rewards.reward_final),
                 bestandteile = EXCLUDED.bestandteile,
                 berechnet_am = now()""",
        (post_id, wert, wert if final else None,
         json.dumps(details, ensure_ascii=False, default=str)),
    )
    return {"post_id": post_id, "belohnung": wert, "final": final, **details}
