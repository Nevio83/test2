"""Thompson Sampling ueber die Kreativ-Dimensionen.

WARUM DIESES VERFAHREN UND KEIN NEURONALES NETZ

  * Es funktioniert ab wenigen Dutzend Datenpunkten. Ein Netz braucht
    Tausende — die gibt es hier auf Jahre nicht.
  * Es ist nachvollziehbar: Zu jeder Entscheidung laesst sich sagen, welche
    Auspraegung wie oft ausprobiert wurde und wie gut sie lief.
  * Es loest das eigentliche Problem von selbst: die Abwaegung zwischen
    "nimm, was bisher am besten lief" und "probier etwas Neues".

WIE ES ARBEITET
Je (Dimension, Auspraegung, Kontext) werden zwei Zahlen gefuehrt: alpha
(Erfolge) und beta (Misserfolge). Zur Auswahl wird aus jeder zugehoerigen
Verteilung eine Zufallszahl gezogen und die groesste gewinnt. Auspraegungen
mit wenig Daten haben breite Verteilungen und kommen dadurch von selbst
gelegentlich dran — das ist das Ausprobieren, ohne dass man es einbauen muss.

DIE HARTE UNTERGRENZE
Zusaetzlich wird in mindestens 15 % der Faelle bewusst gleichverteilt
gewuerfelt. Ohne diese Untergrenze erstarrt das System auf einem lokalen
Optimum: Was einmal gut lief, wird immer haeufiger gewaehlt, bekommt dadurch
mehr Daten, wird noch sicherer gewaehlt — und alles andere verhungert.
Plattformen aendern sich aber; was heute funktioniert, kann in drei Monaten
tot sein.
"""

from __future__ import annotations

import random
from typing import Any

from .. import db
from ..orchestrator import guardrails
from . import features


def _beta_ziehen(alpha: float, beta: float) -> float:
    """Eine Zufallszahl aus der Beta-Verteilung.

    random.betavariate statt numpy: Es ist in der Standardbibliothek, und
    fuer eine Ziehung je Entscheidung ist die Geschwindigkeit voellig egal.
    """
    return random.betavariate(max(alpha, 1e-6), max(beta, 1e-6))


# Zwischenspeicher je Prozess. Eine Auswahl fragt sonst je Auspraegung
# einzeln die Datenbank — bei einem Briefing mit zehn Dimensionen sind das
# schon dutzende Anfragen, und der Abnahmetest mit 500 Ziehungen brauchte
# dadurch drei Minuten. Der Speicher wird bei jeder Aktualisierung geleert,
# kann also nicht veralten.
_arm_speicher: dict[tuple[str, str, str], dict[str, Any]] = {}

NEUTRAL = {"alpha": 1.0, "beta": 1.0, "versuche": 0, "erfolge": 0.0, "gesperrt_bis": None}


def leere_speicher() -> None:
    """Zwischenspeicher verwerfen — nach jeder Aenderung an den Armen."""
    _arm_speicher.clear()


def _lade_kontext(dimension: str, kontext: str) -> None:
    """Alle Arme einer Dimension auf einmal holen statt einzeln."""
    if not db.verfuegbar():
        return
    for zeile in db.abfragen(
        """SELECT auspraegung, alpha, beta, versuche, erfolge, gesperrt_bis
             FROM mkt_arms WHERE dimension = %s AND kontext = %s""",
        (dimension, kontext),
    ):
        _arm_speicher[(dimension, str(zeile["auspraegung"]), kontext)] = dict(zeile)
    # Merken, dass dieser Kontext geladen wurde — sonst wird bei jedem
    # unbekannten Arm erneut die ganze Dimension abgefragt.
    _arm_speicher[(dimension, "\x00geladen", kontext)] = {}


def hole_arm(dimension: str, auspraegung: str, kontext: str) -> dict[str, Any]:
    """Zustand eines Arms. Existiert er nicht, gilt der neutrale Startwert.

    alpha = beta = 1 heisst "keine Ahnung, koennte alles sein" — die
    Gleichverteilung. Damit startet jede neue Auspraegung fair.
    """
    schluessel = (dimension, auspraegung, kontext)
    if schluessel in _arm_speicher:
        return _arm_speicher[schluessel]
    if (dimension, "\x00geladen", kontext) not in _arm_speicher:
        _lade_kontext(dimension, kontext)
        if schluessel in _arm_speicher:
            return _arm_speicher[schluessel]
    return dict(NEUTRAL)


def ist_gesperrt(arm: dict[str, Any]) -> bool:
    """Verlierer werden befristet gesperrt — nicht fuer immer.

    Nach Ablauf darf die Auspraegung wieder mitspielen: Plattformen aendern
    sich, und was im Winter nicht lief, kann im Sommer funktionieren.
    """
    from datetime import datetime, timezone

    bis = arm.get("gesperrt_bis")
    if not bis:
        return False
    if bis.tzinfo is None:
        bis = bis.replace(tzinfo=timezone.utc)
    return bis > datetime.now(timezone.utc)


def _favorit(dimension: str, optionen: list[str], kontext: str) -> str | None:
    """Die Auspraegung mit dem hoechsten Erwartungswert.

    Bewusst der Erwartungswert alpha/(alpha+beta) und keine frische
    Thompson-Ziehung: Wer beim Erkunden ausgeschlossen wird, soll nicht selbst
    vom Zufall abhaengen — sonst ist die Untergrenze wieder keine.
    """
    if not optionen:
        return None
    bester, bester_wert = None, -1.0
    for auspraegung in optionen:
        arm = hole_arm(dimension, auspraegung, kontext)
        a, b = float(arm["alpha"]), float(arm["beta"])
        wert = a / (a + b) if (a + b) > 0 else 0.5
        if wert > bester_wert:
            bester, bester_wert = auspraegung, wert
    return bester


def waehle(dimension: str, optionen: list[str], *, kontext: str = "*") -> str:
    """Eine Auspraegung waehlen.

    Zuerst die harte Untergrenze fuers Ausprobieren, dann Thompson Sampling
    ueber die nicht gesperrten Auspraegungen.

    WARUM BEIM ERKUNDEN DER FAVORIT AUSGESCHLOSSEN WIRD

    Die erste Fassung zog beim Erkunden gleichverteilt aus ALLEN Optionen —
    also auch aus dem Favoriten. Damit war die Untergrenze in Wahrheit um den
    Faktor (n-1)/n kleiner als konfiguriert:

        6 Optionen, exploration_min = 0.15  ->  tatsaechlich 12.5 %
        2 Optionen, exploration_min = 0.15  ->  tatsaechlich  7.5 %

    Aufgefallen ist das beim Trockenlauf der Etappe 13: Die gemessene Quote
    lag bei 0.093 und riss die Pruefung. Vorher war sie meistens gruen — die
    Pruefschwelle lag mit 0.12 knapp UNTER dem Erwartungswert 0.125, also
    innerhalb des Rauschens. Ein Test, der so knapp liegt, meldet mal rot und
    mal gruen; man gewoehnt sich an, ihn nochmal laufen zu lassen. Das ist
    schlimmer als kein Test.

    Jetzt wird beim Erkunden aus allen Auspraegungen AUSSER dem Favoriten
    gezogen. Damit gilt die konfigurierte Zahl wortwoertlich: Mindestens
    15 % der Entscheidungen gehen an etwas anderes als den Spitzenreiter —
    unabhaengig davon, wie viele Optionen eine Dimension hat.
    """
    if not optionen:
        raise ValueError(f"keine Optionen fuer Dimension '{dimension}'")

    exploration = float(guardrails.wert("lernen.exploration_min", 0.15))
    if random.random() < exploration:
        favorit = _favorit(dimension, optionen, kontext)
        andere = [o for o in optionen if o != favorit]
        # Nur eine Option? Dann gibt es nichts zu erkunden.
        return random.choice(andere) if andere else optionen[0]

    verfuegbar = []
    for auspraegung in optionen:
        arm = hole_arm(dimension, auspraegung, kontext)
        if ist_gesperrt(arm):
            continue
        verfuegbar.append((auspraegung, arm))

    # Alles gesperrt? Dann ist die Sperre offensichtlich zu streng — lieber
    # irgendetwas waehlen als gar nichts produzieren.
    if not verfuegbar:
        return random.choice(optionen)

    bewertet = [
        (auspraegung, _beta_ziehen(float(arm["alpha"]), float(arm["beta"])))
        for auspraegung, arm in verfuegbar
    ]
    bewertet.sort(key=lambda x: -x[1])
    return bewertet[0][0]


def aktualisiere(dimension: str, auspraegung: str, kontext: str, belohnung: float) -> None:
    """Einen Arm mit einer Belohnung fuettern.

    alpha waechst um die Belohnung, beta um den Rest. Eine Belohnung von 0,7
    zaehlt also zu 70 % als Erfolg und zu 30 % als Misserfolg — das ist
    genauer als ein Ja/Nein und braucht keinen willkuerlichen Schwellenwert.
    """
    if not db.verfuegbar():
        return
    if not features.ist_gueltig(dimension, auspraegung):
        print(f"[bandit] unbekannte Auspraegung '{auspraegung}' fuer '{dimension}' — uebersprungen")
        return

    belohnung = max(0.0, min(float(belohnung), 1.0))
    db.ausfuehren(
        """INSERT INTO mkt_arms (dimension, auspraegung, kontext, alpha, beta, versuche, erfolge)
           VALUES (%s, %s, %s, 1 + %s, 2 - %s, 1, %s)
           ON CONFLICT (dimension, auspraegung, kontext) DO UPDATE
             SET alpha = mkt_arms.alpha + %s,
                 beta = mkt_arms.beta + (1 - %s),
                 versuche = mkt_arms.versuche + 1,
                 erfolge = mkt_arms.erfolge + %s,
                 aktualisiert_am = now()""",
        (dimension, auspraegung, kontext, belohnung, belohnung, belohnung,
         belohnung, belohnung, belohnung),
    )
    # Der Zwischenspeicher haelt jetzt veraltete Werte — verwerfen.
    leere_speicher()


def erwartung(dimension: str, auspraegung: str, kontext: str = "*") -> float:
    """Erwarteter Wert eines Arms — fuer Anzeige und Vergleich."""
    arm = hole_arm(dimension, auspraegung, kontext)
    alpha, beta = float(arm["alpha"]), float(arm["beta"])
    return round(alpha / (alpha + beta), 4) if (alpha + beta) > 0 else 0.5


def sperre_verlierer(dimension: str, kontext: str = "*") -> list[str]:
    """Deutlich unterdurchschnittliche Auspraegungen befristet sperren.

    Nur mit genug Daten (min_stichprobe) und nur befristet. Ein Arm mit drei
    Beobachtungen ist keine Erkenntnis, sondern Rauschen.
    """
    if not db.verfuegbar():
        return []
    min_stichprobe = int(guardrails.wert("lernen.min_stichprobe", 8))
    tage = int(guardrails.wert("lernen.sperre_tage", 30))

    arme = db.abfragen(
        """SELECT auspraegung, alpha, beta, versuche
             FROM mkt_arms
            WHERE dimension = %s AND kontext = %s AND versuche >= %s""",
        (dimension, kontext, min_stichprobe),
    )
    if len(arme) < 2:
        return []

    werte = {a["auspraegung"]: float(a["alpha"]) / (float(a["alpha"]) + float(a["beta"]))
             for a in arme}
    durchschnitt = sum(werte.values()) / len(werte)
    gesperrt = []
    for auspraegung, wert in werte.items():
        # Deutlich schlechter als der Durchschnitt UND nicht der einzige Rest.
        if wert < durchschnitt * 0.6 and len(werte) - len(gesperrt) > 1:
            db.ausfuehren(
                """UPDATE mkt_arms SET gesperrt_bis = now() + make_interval(days => %s)
                    WHERE dimension = %s AND auspraegung = %s AND kontext = %s""",
                (tage, dimension, auspraegung, kontext),
            )
            gesperrt.append(auspraegung)
            leere_speicher()
            db.audit(
                "arm_gesperrt", job="learning_update",
                begruendung=f"{dimension}='{auspraegung}' im Kontext '{kontext}': "
                            f"{wert:.2f} gegen Durchschnitt {durchschnitt:.2f}",
                score=wert,
            )
    return gesperrt


def explorationsquote(dimension: str, optionen: list[str], *, kontext: str = "*",
                      ziehungen: int = 400) -> float:
    """Wie oft wird tatsaechlich etwas anderes als der Favorit gewaehlt?

    Gemessen statt behauptet: Der Test prueft damit das echte Verhalten,
    nicht die Konfigurationszahl.
    """
    if not optionen:
        return 0.0
    haeufigkeit: dict[str, int] = {}
    for _ in range(ziehungen):
        gewaehlt = waehle(dimension, optionen, kontext=kontext)
        haeufigkeit[gewaehlt] = haeufigkeit.get(gewaehlt, 0) + 1
    favorit = max(haeufigkeit.values())
    return round(1.0 - favorit / ziehungen, 4)
