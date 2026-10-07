"""Monatliche Rueckschau (Punkt 62): Was gehoert in die Vorlagen, was fliegt raus?

WARUM ES DAS GIBT
Die Kette endet mit "Lernen". Der Bandit lernt aber nur, was er steuert —
Videostil, Hook-Machart, Laenge. Die Schnitt-Vorlagen (Punkt 28) aendert er
nicht; die aendert ein Mensch. Ohne einen festen Schritt, der die Ergebnisse
dorthin zurueckbringt, bleiben sie, wie sie am ersten Tag waren.

WAS DIE RUECKSCHAU TUT — UND WAS NICHT
Sie legt die fuenf besten und die fuenf schwaechsten Beitraege eines
Zeitraums nebeneinander und zaehlt je Merkmal (Vorlage, Hook, Laenge,
Musikbett, Quelle des Materials), wie oft es oben und wie oft es unten steht.
Daraus macht sie VORSCHLAEGE nach der Regel aus dem Papier: Was in mindestens
zwei der besten und in keinem der schwaechsten steckt, ist ein Kandidat fuer
die Vorlage; umgekehrt ein Kandidat zum Streichen.

Sie schreibt NICHTS in die Vorlagen. Fuenf Beitraege oben und fuenf unten
sind eine kleine Stichprobe; ob "zweimal oben" ein Muster ist oder Zufall,
entscheidet der Mensch — und traegt es mit Datum ins Handbuch ein
(Marketing/SCHNITT.md). Ein Automat, der seine eigenen Vorlagen umschreibt,
waere genau die Rueckkopplung, die man nicht mehr nachvollziehen kann.

NUR ENDGUELTIGE BELOHNUNGEN
Wie beim Lernen selbst (policy.lerne_aus_post): Eine vorlaeufige Zahl kann
sich am dritten Tag noch drehen. Eine Vorlage nach einer Zahl zu aendern, die
sich noch dreht, waere Raten mit Nachkommastellen.

Aufruf:  npm run marketing:rueckschau            (letzte 30 Tage)
         npm run marketing:rueckschau -- --tage 60 --anzahl 5
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from typing import Any

from .. import db
from . import policy

ANZAHL = 5            # je fuenf oben und unten, wie im Papier
WIEDERHOLUNG = 2      # "was zweimal zu den Besten gehoert"
TAGE = 30

# Welche Merkmale nebeneinandergelegt werden. Bewusst nicht alles, was der
# Bandit kennt: Sendeplatz und Rohclip-Kennung sind keine Frage der Vorlage.
MERKMALE = {
    "vorlage": "Vorlage",
    "hook_typ": "Hook-Machart",
    "hook": "Hook",
    "laenge": "Länge",
    "musikstueck": "Musikbett",
    "musik": "Musikstimmung",
    "material": "Material",
    "plattform": "Quelle",
    "creator": "Creator",
    "videostil": "Stil",
}

# Grenzen der Laengenklassen in Sekunden. Gemessen wird am fertigen Video
# (mkt_videos.dauer_sek), nicht an der Vorgabe der Vorlage.
LAENGEN = ((12.0, "unter 12 s"), (18.0, "12–18 s"), (25.0, "18–25 s"))


def laenge_klasse(sekunden: Any) -> str | None:
    """Laengenklasse eines Videos — None, wenn die Dauer fehlt."""
    try:
        wert = float(sekunden)
    except (TypeError, ValueError):
        return None
    if wert <= 0:
        return None
    for grenze, name in LAENGEN:
        if wert < grenze:
            return name
    return "über 25 s"


def merkmale_des_beitrags(zeile: dict[str, Any]) -> list[tuple[str, str]]:
    """Die Merkmale eines bewerteten Beitrags, die fuer die Vorlagen zaehlen.

    Dieselbe Zuordnung wie beim Lernen (policy.merkmale_aus_zeile) — zwei
    verschiedene Lesarten desselben Beitrags waeren zwei Wahrheiten. Dazu die
    gemessene Laenge, die bei Stil C sonst nirgends steht.
    """
    paare: list[tuple[str, str]] = []
    zuordnung = policy.merkmale_aus_zeile(zeile)
    if zuordnung is not None:
        vektor, _kontext, herkunft = zuordnung
        paare.extend((d, str(w)) for d, w in vektor.items() if w not in (None, ""))
        paare.extend(herkunft)
    klasse = laenge_klasse(zeile.get("dauer_sek"))
    if klasse:
        paare.append(("laenge", klasse))
    gesehen: list[tuple[str, str]] = []
    for dimension, wert in paare:
        if dimension in MERKMALE and (dimension, wert) not in gesehen:
            gesehen.append((dimension, wert))
    return gesehen


def vergleiche(beste: list[list[tuple[str, str]]], schwaechste: list[list[tuple[str, str]]], *,
               wiederholung: int = WIEDERHOLUNG) -> dict[str, list[dict[str, Any]]]:
    """Je Merkmal zaehlen, in wie vielen Beitraegen oben und unten es steckt.

    Gezaehlt werden BEITRAEGE, nicht Nennungen: Ein Video mit drei Clips
    desselben Creators zaehlt fuer diesen Creator einmal.
    """
    oben: dict[tuple[str, str], int] = defaultdict(int)
    unten: dict[tuple[str, str], int] = defaultdict(int)
    for gruppe, zaehler in ((beste, oben), (schwaechste, unten)):
        for merkmale in gruppe:
            for paar in set(merkmale):
                zaehler[paar] += 1

    def eintrag(paar: tuple[str, str]) -> dict[str, Any]:
        return {"merkmal": paar[0], "name": MERKMALE.get(paar[0], paar[0]), "wert": paar[1],
                "oben": oben.get(paar, 0), "unten": unten.get(paar, 0)}

    alle = sorted(set(oben) | set(unten))
    uebernehmen = [eintrag(p) for p in alle if oben.get(p, 0) >= wiederholung and not unten.get(p)]
    streichen = [eintrag(p) for p in alle if unten.get(p, 0) >= wiederholung and not oben.get(p)]
    # Was oben UND unten vorkommt, unterscheidet nichts — das gehoert gesagt,
    # sonst haelt man eine Vorlage fuer gut, die nur haeufig ist.
    beides = [eintrag(p) for p in alle if oben.get(p) and unten.get(p)]
    for liste in (uebernehmen, streichen, beides):
        liste.sort(key=lambda e: (-(e["oben"] + e["unten"]), e["merkmal"], e["wert"]))
    return {"uebernehmen": uebernehmen, "streichen": streichen, "beides": beides}


def bewertete_beitraege(tage: int = TAGE) -> list[dict[str, Any]]:
    """Veroeffentlichte Beitraege mit ENDGUELTIGER Belohnung, beste zuerst."""
    if not db.verfuegbar():
        return []
    # LEFT JOIN auf mkt_briefs: Stil C hat kein Briefing. Mit einem INNER JOIN
    # fiele genau das Material heraus, um dessen Vorlagen es hier geht.
    return [dict(z) for z in db.abfragen(
        """SELECT p.id, p.slot, p.plattform AS sendeplattform, p.gepostet_am,
                  r.reward_final AS wert,
                  v.stil, v.dauer_sek, v.bericht, v.schnittliste,
                  COALESCE(v.produkt_id, m.produkt_id) AS produkt_id,
                  b.merkmale
             FROM mkt_rewards r
             JOIN mkt_posts p ON p.id = r.post_id
             JOIN mkt_videos v ON v.id = p.video_id
             LEFT JOIN mkt_briefs b ON b.id = v.brief_id
             LEFT JOIN mkt_matches m ON m.id = b.match_id
            WHERE p.status = 'gepostet'
              AND r.reward_final IS NOT NULL
              AND p.gepostet_am > now() - make_interval(days => %s)
            ORDER BY r.reward_final DESC, p.id""",
        (int(tage),),
    )]


def rueckschau(beitraege: list[dict[str, Any]] | None = None, *, tage: int = TAGE,
               anzahl: int = ANZAHL, wiederholung: int = WIEDERHOLUNG) -> dict[str, Any]:
    """Beste und schwaechste nebeneinander, dazu die Vorschlaege.

    ZU WENIGE BEITRAEGE SIND EIN BEFUND, KEIN FEHLER. Unter 2 x anzahl
    ueberschneiden sich Spitze und Ende — dann waere derselbe Beitrag zugleich
    "gut" und "schlecht", und jeder Vorschlag waere Unsinn.
    """
    if beitraege is None:
        if not db.verfuegbar():
            return {"ok": False, "grund": f"keine Datenbank — {db.grund_fuer_fehlende_db()}"}
        beitraege = bewertete_beitraege(tage)
    beitraege = sorted(beitraege, key=lambda z: (-float(z["wert"]), int(z.get("id") or 0)))
    if len(beitraege) < 2 * anzahl:
        return {"ok": False, "anzahl_bewertet": len(beitraege), "tage": tage,
                "grund": (f"nur {len(beitraege)} Beiträge mit endgültiger Bewertung in {tage} Tagen — "
                          f"die Rückschau braucht mindestens {2 * anzahl}, sonst überschneiden sich "
                          "die besten und die schwächsten")}
    oben, unten = beitraege[:anzahl], beitraege[-anzahl:]

    def zeile(z: dict[str, Any]) -> dict[str, Any]:
        return {"id": z.get("id"), "wert": round(float(z["wert"]), 3), "stil": z.get("stil"),
                "schnittliste": z.get("schnittliste"), "merkmale": merkmale_des_beitrags(z)}

    beste = [zeile(z) for z in oben]
    schwaechste = [zeile(z) for z in unten]
    return {"ok": True, "tage": tage, "anzahl_bewertet": len(beitraege),
            "beste": beste, "schwaechste": schwaechste,
            **vergleiche([b["merkmale"] for b in beste], [s["merkmale"] for s in schwaechste],
                         wiederholung=wiederholung)}


def als_text(ergebnis: dict[str, Any]) -> str:
    """Fuer die Konsole."""
    if not ergebnis.get("ok"):
        return f"Rückschau nicht möglich: {ergebnis.get('grund')}"
    zeilen = [f"── Rückschau über {ergebnis['tage']} Tage, {ergebnis['anzahl_bewertet']} bewertete Beiträge ──", ""]

    def beitrag(b: dict[str, Any]) -> str:
        merkmale = ", ".join(f"{MERKMALE.get(d, d)}: {w}" for d, w in b["merkmale"]
                             if d in ("vorlage", "hook_typ", "laenge", "musikstueck", "plattform"))
        return f"  #{b['id']:<5} {b['wert']:>6.3f}  Stil {b['stil'] or '?'}  {merkmale or '(keine Merkmale erfasst)'}"

    zeilen += ["Die besten:"] + [beitrag(b) for b in ergebnis["beste"]]
    zeilen += ["", "Die schwächsten:"] + [beitrag(b) for b in ergebnis["schwaechste"]]

    def vorschlaege(titel: str, liste: list[dict[str, Any]]) -> list[str]:
        if not liste:
            return ["", f"{titel}: keine"]
        return ["", f"{titel}:"] + [f"  {e['name']}: {e['wert']}  (oben {e['oben']}×, unten {e['unten']}×)"
                                     for e in liste]

    zeilen += vorschlaege("Kandidat für die Vorlage (oben mehrfach, unten nie)", ergebnis["uebernehmen"])
    zeilen += vorschlaege("Kandidat zum Streichen (unten mehrfach, oben nie)", ergebnis["streichen"])
    zeilen += vorschlaege("Unterscheidet nichts (oben und unten)", ergebnis["beides"])
    zeilen += ["", "Geändert wurde nichts. Was übernommen oder gestrichen wird, entscheidest du —",
               "mit Datum in Marketing/SCHNITT.md (Abschnitt „Regeln, die aus der Handarbeit kommen“)."]
    return "\n".join(zeilen)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Beste und schwächste Beiträge nebeneinander (Punkt 62).")
    parser.add_argument("--tage", type=int, default=TAGE)
    parser.add_argument("--anzahl", type=int, default=ANZAHL)
    args = parser.parse_args(argv)
    ergebnis = rueckschau(tage=args.tage, anzahl=max(1, args.anzahl))
    print(als_text(ergebnis))
    return 0


if __name__ == "__main__":
    sys.exit(main())
