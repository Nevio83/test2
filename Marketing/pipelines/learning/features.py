"""Kreativ-Merkmale als abzaehlbare Dimensionen.

WARUM ABZAEHLBAR UND NICHT FREI

Ein Sprachmodell kann unendlich viele verschiedene Videos schreiben. Aus
unendlich vielen Einzelstuecken laesst sich aber nichts lernen — jedes waere
ein Unikat mit genau einem Datenpunkt.

Deshalb wird jedes Video auf eine Handvoll Entscheidungen heruntergebrochen:
Hook-Machart, Laenge, Stimme, Musik, Untertitelstil, Handlungsaufforderung,
Sendeplatz. Jede hat wenige moegliche Werte. Darueber laesst sich nach ein
paar Dutzend Videos etwas sagen.

DER KONTEXT IST TEIL DES SCHLUESSELS
Gelernt wird nicht "Hook-Typ 3 ist gut", sondern "Hook-Typ 3 ist gut FUER
Kuechenprodukte aus Google-Trends". Ohne Kontext mittelt man ueber
Sortimente hinweg und bekommt eine Aussage, die fuer kein einzelnes Produkt
stimmt.
"""

from __future__ import annotations

from typing import Any

# Die lernbaren Dimensionen und ihre erlaubten Werte. Diese Liste ist die
# Wahrheit — was hier nicht steht, wird nicht gelernt.
DIMENSIONEN: dict[str, tuple[str, ...]] = {
    "videostil": ("A", "B"),
    "hook_typ": ("frage", "behauptung", "vorher_nachher", "zahl", "pov", "fehler"),
    "videolaenge": ("15", "22", "30", "45"),
    "stimme": ("takes", "clone", "lokal"),
    "sprechtempo": ("ruhig", "normal", "schnell"),
    "musik": ("ruhig", "treibend", "verspielt", "keine"),
    "untertitel_stil": ("wort_fuer_wort", "drei_woerter", "satzweise"),
    "cta_typ": ("link_in_bio", "direkt", "frage_zurueck", "kein_cta"),
    "miniaturbild": ("produkt_frei", "produkt_in_szene", "text_gross"),
    "posting_slot": (),          # frei: "Di 12:30" — waechst mit den Daten
    "produktkategorie": (),      # kommt aus products.json
}

# Dimensionen, die das Lernmodul selbst waehlen darf. Alles andere wird
# beobachtet, aber nicht gesteuert (z.B. die Produktkategorie ergibt sich
# aus dem Trend, nicht aus einer Entscheidung des Systems).
STEUERBAR = (
    "videostil", "hook_typ", "videolaenge", "stimme", "sprechtempo",
    "musik", "untertitel_stil", "cta_typ", "miniaturbild", "posting_slot",
)


def kontext(merkmale: dict[str, Any]) -> str:
    """Kontextschluessel aus Produktkategorie und Trendquelle.

    Bewusst grob: Zu feiner Kontext zersplittert die Daten so stark, dass
    jede Kombination nur ein oder zwei Beobachtungen hat — dann lernt das
    System gar nichts mehr.
    """
    kategorie = str(merkmale.get("produktkategorie") or "?").split("/")[0].strip()
    quelle = str(merkmale.get("trendquelle") or "?").strip()
    return f"{kategorie}|{quelle}"


def merkmalsvektor(merkmale: dict[str, Any], *, slot: str | None = None) -> dict[str, str]:
    """Die steuerbaren Auspraegungen eines Videos, als Text.

    Text, weil die Werte so in der Datenbank stehen und dort lesbar sein
    muessen — eine Zahlenkodierung waere im Dashboard unbrauchbar.
    """
    vektor: dict[str, str] = {}
    for dimension in STEUERBAR:
        if dimension == "posting_slot":
            if slot:
                vektor[dimension] = str(slot)
            continue
        wert = merkmale.get(dimension)
        if wert is None:
            continue
        vektor[dimension] = str(wert)
    return vektor


def ist_gueltig(dimension: str, auspraegung: str) -> bool:
    """Gehoert dieser Wert zu dieser Dimension?

    Schuetzt davor, dass ein Tippfehler eine neue Auspraegung erfindet und
    damit die Statistik verwaessert.
    """
    erlaubt = DIMENSIONEN.get(dimension)
    if erlaubt is None:
        return False
    if not erlaubt:          # freie Dimension (Sendeplatz, Kategorie)
        return bool(auspraegung)
    return str(auspraegung) in erlaubt
