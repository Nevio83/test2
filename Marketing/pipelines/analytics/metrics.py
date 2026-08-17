"""Messfenster: wann welche Kennzahl eingesammelt wird.

WARUM MEHRERE FENSTER UND NICHT EINMAL AM ENDE

Ein Beitrag entwickelt sich. Nach einer Stunde sieht man, ob der Aufhaenger
zieht; nach drei Tagen, ob er getragen hat. Wer nur einmal misst, verwechselt
beides.

Die Fenster sind 1 h, 6 h, 24 h, 72 h und 7 d. Das Lernmodul (Etappe 10)
braucht genau diese Staffelung: Ab 6 h gibt es eine vorlaeufige Bewertung,
endgueltig wird erst nach 72 h entschieden. Ohne diese Verzoegerung wuerde
ein Beitrag abgeschaltet, bevor er seine Reichweite ueberhaupt entfaltet hat.

JEDES FENSTER WIRD NUR EINMAL GESCHRIEBEN
Ein eindeutiger Eintrag je (Beitrag, Fenster) verhindert, dass ein
Wiederholungslauf dieselbe Messung doppelt zaehlt — dieselbe Ueberlegung wie
beim Doppelpost-Schutz.
"""

from __future__ import annotations

from typing import Any

from .. import db
from ..orchestrator import guardrails

# Bezeichnungen, wie sie in mkt_metrics.fenster stehen.
FENSTER_NAMEN = {1: "1h", 6: "6h", 24: "24h", 72: "72h", 168: "7d"}


def fenster_stunden() -> list[int]:
    roh = guardrails.wert("lernen.messfenster_stunden", [1, 6, 24, 72, 168]) or []
    return [int(s) for s in roh]


def fenster_name(stunden: int) -> str:
    return FENSTER_NAMEN.get(stunden, f"{stunden}h")


def faellige_messungen(limit: int = 20) -> list[dict[str, Any]]:
    """Welche (Beitrag, Fenster) sind jetzt dran?

    Faellig ist ein Fenster, wenn seit der Veroeffentlichung genug Zeit
    vergangen ist UND es noch keine Messung dafuer gibt. Der Trockenlauf
    zaehlt bewusst NICHT mit: Ein Beitrag, der nie rausging, hat auch keine
    Kennzahlen.
    """
    if not db.verfuegbar():
        return []

    faellig: list[dict[str, Any]] = []
    for stunden in fenster_stunden():
        name = fenster_name(stunden)
        zeilen = db.abfragen(
            """SELECT p.id AS post_id, p.plattform, p.externe_post_id, p.gepostet_am,
                      p.video_id
                 FROM mkt_posts p
                WHERE p.status = 'gepostet'
                  AND p.externe_post_id IS NOT NULL
                  AND p.gepostet_am <= now() - make_interval(hours => %s)
                  AND NOT EXISTS (SELECT 1 FROM mkt_metrics m
                                   WHERE m.post_id = p.id AND m.fenster = %s)
                ORDER BY p.gepostet_am
                LIMIT %s""",
            (stunden, name, limit),
        )
        for zeile in zeilen:
            zeile["fenster"] = name
            zeile["fenster_stunden"] = stunden
            faellig.append(zeile)
    return faellig[:limit]


def speichere(post_id: int, fenster: str, werte: dict[str, Any]) -> bool:
    """Eine Messung ablegen. Doppelte werden stillschweigend verworfen.

    Rueckgabe True, wenn wirklich geschrieben wurde.
    """
    if not db.verfuegbar():
        return False
    zeile = db.eine_zeile(
        """INSERT INTO mkt_metrics
             (post_id, fenster, views, retention_3s, watchtime_sek, likes, shares,
              saves, kommentare, profilklicks, linkklicks)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (post_id, fenster) DO NOTHING
           RETURNING id""",
        (
            post_id, fenster,
            werte.get("views"), werte.get("retention_3s"), werte.get("watchtime_sek"),
            werte.get("likes"), werte.get("shares"), werte.get("saves"),
            werte.get("kommentare"), werte.get("profilklicks"), werte.get("linkklicks"),
        ),
    )
    return zeile is not None


def kennzahlen(post_id: int) -> dict[str, dict[str, Any]]:
    """Alle Messungen eines Beitrags, nach Fenster geordnet."""
    if not db.verfuegbar():
        return {}
    zeilen = db.abfragen(
        """SELECT fenster, views, retention_3s, watchtime_sek, likes, shares,
                  saves, kommentare, profilklicks, linkklicks, erfasst_am
             FROM mkt_metrics WHERE post_id = %s""",
        (post_id,),
    )
    return {str(z["fenster"]): dict(z) for z in zeilen}


def juengste_kennzahlen(post_id: int) -> dict[str, Any] | None:
    """Die aktuellste Messung — Grundlage fuer die Belohnung."""
    alle = kennzahlen(post_id)
    if not alle:
        return None
    reihenfolge = [fenster_name(s) for s in fenster_stunden()]
    for name in reversed(reihenfolge):
        if name in alle:
            return alle[name]
    return next(iter(alle.values()))
