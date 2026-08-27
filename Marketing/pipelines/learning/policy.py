"""Die Politik: was wird als Naechstes produziert, und was wird nachjustiert.

DREI AUFGABEN

  1. Auswahl treffen — das ist die Funktion, die brief_generator.py aufruft.
  2. Gelerntes einsammeln — Belohnungen berechnen und in die Arme einspeisen.
  3. Stellschrauben nachziehen — Trend-Gewichte, Sendeplaetze, Stil-Mischung.

DIE GRENZEN SIND FEST VERDRAHTET
Angepasst werden darf nur, was in der Positivliste steht (guardrails).
Budget, Mindestmarge, Plattformen und der Trockenlauf sind ausdruecklich
ausgenommen — ein System, das sein eigenes Budget erhoehen kann, ist kein
kontrolliertes System mehr.
"""

from __future__ import annotations

import json
from typing import Any

from .. import db
from ..orchestrator import guardrails
from . import bandit, features, reward


def waehle_auspraegung(dimension: str, optionen: list[str], *, kontext: str = "*") -> Any:
    """Von brief_generator.py aufgerufen. Gibt die gewaehlte Auspraegung zurueck.

    Die Rueckgabe hat denselben Typ wie die Eingabe: Wird eine Liste von
    Zahlen uebergeben (Videolaenge), kommt eine Zahl zurueck. Sonst muesste
    jeder Aufrufer selbst umwandeln.
    """
    als_text = [str(o) for o in optionen]
    gewaehlt = bandit.waehle(dimension, als_text, kontext=kontext)
    for original in optionen:
        if str(original) == gewaehlt:
            return original
    return optionen[0]


def offene_belohnungen(limit: int = 50) -> list[int]:
    """Beitraege, deren Belohnung noch aussteht oder noch nicht endgueltig ist."""
    if not db.verfuegbar():
        return []
    vorlaeufig_ab = float(guardrails.wert("lernen.vorlaeufig_ab_stunden", 6))
    zeilen = db.abfragen(
        """SELECT p.id
             FROM mkt_posts p
             LEFT JOIN mkt_rewards r ON r.post_id = p.id
            WHERE p.status = 'gepostet'
              AND p.gepostet_am <= now() - make_interval(secs => %s)
              AND (r.post_id IS NULL OR r.reward_final IS NULL)
            ORDER BY p.gepostet_am
            LIMIT %s""",
        (vorlaeufig_ab * 3600.0, limit),
    )
    return [int(z["id"]) for z in zeilen]


def merkmale_von_post(post_id: int) -> tuple[dict[str, str], str] | None:
    """Merkmalsvektor und Kontext eines Beitrags."""
    if not db.verfuegbar():
        return None
    zeile = db.eine_zeile(
        """SELECT b.merkmale, p.slot
             FROM mkt_posts p
             JOIN mkt_videos v ON v.id = p.video_id
             JOIN mkt_briefs b ON b.id = v.brief_id
            WHERE p.id = %s""",
        (post_id,),
    )
    if not zeile:
        return None
    merkmale = zeile["merkmale"] or {}
    if isinstance(merkmale, str):
        try:
            merkmale = json.loads(merkmale)
        except json.JSONDecodeError:
            merkmale = {}
    return features.merkmalsvektor(merkmale, slot=zeile["slot"]), features.kontext(merkmale)


def lerne_aus_post(post_id: int) -> dict[str, Any] | None:
    """Belohnung berechnen und alle Arme dieses Beitrags aktualisieren.

    Gefuettert wird NUR mit endgueltigen Belohnungen. Eine vorlaeufige Zahl
    wird berechnet und angezeigt, veraendert aber nichts — sonst wuerde ein
    Beitrag, der erst am dritten Tag anzieht, vorher schon abgewertet.
    """
    ergebnis = reward.speichere(post_id)
    if ergebnis is None:
        return None
    if not ergebnis.get("final"):
        return {"post_id": post_id, "belohnung": ergebnis["belohnung"],
                "final": False, "arme": 0}

    zuordnung = merkmale_von_post(post_id)
    if zuordnung is None:
        return None
    vektor, kontext = zuordnung

    for dimension, auspraegung in vektor.items():
        # Zweimal fuettern: einmal im Kontext (fuer die feine Aussage) und
        # einmal ohne (fuer die allgemeine). Ohne den allgemeinen Eintrag
        # haette jede neue Produktkategorie bei null angefangen.
        bandit.aktualisiere(dimension, auspraegung, kontext, ergebnis["belohnung"])
        bandit.aktualisiere(dimension, auspraegung, "*", ergebnis["belohnung"])

    return {"post_id": post_id, "belohnung": ergebnis["belohnung"],
            "final": True, "arme": len(vektor) * 2, "kontext": kontext}


def passe_gewichte_an() -> dict[str, Any]:
    """Trend-Gewichte und Stil-Mischung nachziehen.

    Vorsichtig und in kleinen Schritten: Hoechstens 10 % Veraenderung je
    Durchgang. Ein Lernmodul, das die Stellschrauben ruckartig verdreht,
    macht das System unberechenbar — und man kann Ursache und Wirkung nicht
    mehr auseinanderhalten.
    """
    if not db.verfuegbar():
        return {}

    min_stichprobe = int(guardrails.wert("lernen.min_stichprobe", 8))
    aenderungen: dict[str, Any] = {}

    # Stil-Mischung an die tatsaechlichen Ergebnisse anpassen.
    a = db.eine_zeile(
        """SELECT alpha, beta, versuche FROM mkt_arms
            WHERE dimension = 'videostil' AND auspraegung = 'A' AND kontext = '*'"""
    )
    b = db.eine_zeile(
        """SELECT alpha, beta, versuche FROM mkt_arms
            WHERE dimension = 'videostil' AND auspraegung = 'B' AND kontext = '*'"""
    )
    if a and b and int(a["versuche"]) >= min_stichprobe and int(b["versuche"]) >= min_stichprobe:
        wert_a = float(a["alpha"]) / (float(a["alpha"]) + float(a["beta"]))
        wert_b = float(b["alpha"]) / (float(b["alpha"]) + float(b["beta"]))
        summe = wert_a + wert_b
        if summe > 0:
            alt = guardrails.wert("video.stil_mix", {"A": 0.7, "B": 0.3}) or {}
            ziel_a = wert_a / summe
            # Hoechstens 10 Prozentpunkte je Durchgang.
            neu_a = max(0.1, min(0.9, float(alt.get("A", 0.7)) + max(-0.1, min(0.1, ziel_a - float(alt.get("A", 0.7))))))
            aenderungen["video.stil_mix"] = {"A": round(neu_a, 3), "B": round(1 - neu_a, 3)}

    if aenderungen:
        uebernommen = guardrails.uebernehme_gelernte_werte(aenderungen, job="learning_update")
        return uebernommen
    return {}


def job_lernen() -> dict[str, Any]:
    """Belohnungen einsammeln, Arme aktualisieren, Stellschrauben nachziehen."""
    if not db.verfuegbar():
        return {"grund": db.grund_fuer_fehlende_db()}

    offen = offene_belohnungen()
    if not offen:
        return {"gelernt": 0, "grund": "kein Beitrag reif fuer eine Bewertung"}

    endgueltig = 0
    vorlaeufig = 0
    for post_id in offen:
        ergebnis = lerne_aus_post(post_id)
        if ergebnis is None:
            continue
        if ergebnis["final"]:
            endgueltig += 1
        else:
            vorlaeufig += 1

    gesperrt: dict[str, list[str]] = {}
    for dimension in features.STEUERBAR:
        erlaubt = features.DIMENSIONEN.get(dimension) or ()
        if len(erlaubt) < 2:
            continue
        verlierer = bandit.sperre_verlierer(dimension, "*")
        if verlierer:
            gesperrt[dimension] = verlierer

    angepasst = passe_gewichte_an()

    print(f"[lernen] {endgueltig} endgueltig, {vorlaeufig} vorlaeufig bewertet"
          + (f", {sum(len(v) for v in gesperrt.values())} Arm(e) gesperrt" if gesperrt else "")
          + (f", angepasst: {list(angepasst)}" if angepasst else ""))
    return {"gelernt": endgueltig, "vorlaeufig": vorlaeufig,
            "gesperrt": gesperrt, "angepasst": angepasst}
