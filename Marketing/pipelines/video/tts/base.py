"""Schnittstelle fuer die Sprachausgabe.

DREI WEGE, IN DIESER REIHENFOLGE

  1. human_takes  — deine eigenen, vorab aufgenommenen Saetze. Kostet nichts
                    je Video und klingt echt, weil es echt ist.
  2. elevenlabs   — Stimmklon deiner Stimme. Kostet Geld je Aufruf, deshalb
                    erst der zweite Weg.
  3. piper_local  — kostenloser lokaler Rueckfall, damit die Kette NIE steht.

WARUM DIE REIHENFOLGE SO IST
Ein Marketing-Automat, der bei leerem Guthaben aufhoert zu arbeiten, faellt
genau dann aus, wenn man ihn am wenigsten beobachtet. Der dritte Weg ist
schlechter als die ersten beiden — aber er laeuft immer.

WAS ES HIER NICHT GIBT
Eine Attrappe. Der alte video_builder.py hat bei gesetztem ElevenLabs-Key
lediglich eine leere Datei angelegt (touch) — das Video hatte dann eine
Tonspur von 0 Byte und war stumm, sah aber fertig aus. Jede Stimme hier
liefert entweder echte Audiodaten oder gar nichts.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Sprachausgabe:
    pfad: Path
    dauer: float
    quelle: str
    kosten_cent: int = 0


class Stimme(ABC):
    name: str = "unbekannt"

    @abstractmethod
    def bereit(self) -> tuple[bool, str | None]:
        """(True, None) wenn nutzbar — sonst der Grund im Klartext."""

    @abstractmethod
    def sprich(self, text: str, ziel: Path) -> Sprachausgabe:
        """Text vertonen. Wirft bei Fehlern — der Aufrufer nimmt den naechsten Weg."""


def alle_stimmen() -> list[Stimme]:
    """In Reihenfolge der Bevorzugung."""
    from .elevenlabs import ElevenLabsStimme
    from .human_takes import EigeneAufnahmen
    from .piper_local import LokaleStimme

    return [EigeneAufnahmen(), ElevenLabsStimme(), LokaleStimme()]


def beste_stimme(bevorzugt: str | None = None) -> tuple[Stimme | None, str]:
    """Die erste nutzbare Stimme — oder None mit einer Sammelbegruendung.

    'bevorzugt' kommt aus dem Merkmalsvektor des Briefings (takes/clone/lokal).
    Ist die bevorzugte nicht nutzbar, wird der Reihe nach weitergegangen —
    aber protokolliert, damit das Lernmodul spaeter nicht die falsche
    Auspraegung belohnt.
    """
    stimmen = alle_stimmen()
    zuordnung = {"takes": "eigene_aufnahmen", "clone": "elevenlabs", "lokal": "lokal"}
    wunsch = zuordnung.get(bevorzugt or "", None)
    if wunsch:
        stimmen.sort(key=lambda s: 0 if s.name == wunsch else 1)

    gruende = []
    for stimme in stimmen:
        ok, grund = stimme.bereit()
        if ok:
            return stimme, stimme.name
        gruende.append(f"{stimme.name}: {grund}")
    return None, " | ".join(gruende)
