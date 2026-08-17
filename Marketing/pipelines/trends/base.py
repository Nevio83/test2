"""Schnittstelle fuer alle Trend-Quellen.

DIE EINE REGEL, DIE HIER ZAEHLT

Eine Quelle ohne Zugangsdaten liefert **null Zeilen** und eine Protokollzeile,
warum. Sie liefert NIEMALS eine erfundene Beispielzeile.

Das ist kein Stilfrage, sondern der wichtigste Unterschied zum bisherigen
Stand. Der alte fetch_trends.py gab bei jedem Fehlschlag still Zeilen wie
"smoothie rezept" oder "cozy home office" zurueck — mit erfundenem Sentiment
(0.55) und erfundenem Engagement (0.74). Das Ergebnis sah aus wie Betrieb:
Die Datenbank fuellte sich, die Protokolle waren gruen, Videos waeren
produziert worden. Nur hatte nichts davon je etwas mit einem echten Trend zu
tun.

Ein System, das sichtbar nichts tut, kann man reparieren. Eines, das
unsichtbar Falsches tut, nicht.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class TrendZeile:
    """Ein Trend, wie ihn eine Quelle liefert.

    Alles ausser quelle/keyword ist optional. Was eine Quelle nicht misst,
    bleibt None — es wird NICHT mit einem plausiblen Wert aufgefuellt. None
    heisst "keine Aussage", 0.0 heisst "gemessen und null". Der Unterschied
    entscheidet spaeter darueber, ob ein Score-Bestandteil zaehlt.
    """

    quelle: str
    keyword: str
    volumen: float | None = None        # absolute Groesse, Skala je Quelle
    wachstum: float | None = None       # Velocity: Veraenderung je Zeit
    saettigung: float | None = None     # 0..1, wie umkaempft das Thema ist
    sentiment: float | None = None      # -1..1
    sprache: str | None = None
    rohdaten: dict[str, Any] = field(default_factory=dict)
    erfasst_am: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        self.keyword = (self.keyword or "").strip()


class TrendQuelle(ABC):
    """Basis fuer jede Quelle.

    Ablauf ist immer derselbe:
        bereit, grund = quelle.bereit()
        if not bereit: protokollieren und weiter
        zeilen = quelle.hole()
    """

    #: Kurzname, landet in mkt_trends.quelle
    name: str = "unbekannt"

    #: Name des Anbieters fuer die Ratenbegrenzung (rate_limits in der Konfig)
    anbieter: str = ""

    @abstractmethod
    def bereit(self) -> tuple[bool, str | None]:
        """(True, None) wenn abrufbar — sonst (False, Grund im Klartext).

        Der Grund wird dem Menschen angezeigt. "REDDIT_CLIENT_ID fehlt" ist
        brauchbar, "nicht verfuegbar" nicht.
        """

    @abstractmethod
    def hole(self) -> list[TrendZeile]:
        """Trends abrufen.

        Darf werfen — der Aufrufer faengt und protokolliert. Was NICHT
        erlaubt ist: bei einem Fehler stillschweigend Beispieldaten
        zurueckgeben.
        """

    def abrufen_sicher(self) -> tuple[list[TrendZeile], str | None]:
        """Bequemer Weg: prueft bereit(), faengt Fehler, gibt (Zeilen, Grund).

        Zeilen ist bei jedem Problem eine LEERE Liste — nie ein Ersatz.
        """
        bereit, grund = self.bereit()
        if not bereit:
            return [], grund
        try:
            zeilen = self.hole()
        except Exception as fehler:
            return [], f"Abruf fehlgeschlagen: {fehler}"
        echte = [z for z in zeilen if z.keyword]
        if not echte:
            return [], "Quelle antwortete, lieferte aber keine verwertbare Zeile"
        return echte, None
