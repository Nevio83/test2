"""Ausgangspruefung: Kein Rendering kommt ungeprueft in die Warteschlange.

WARUM ES DIESE DATEI GIBT

In Marketing/data/renders/ lagen bis Runde 10 neun MP4-Dateien mit **0 Byte**.
Sie hatten Dateinamen, Zeitstempel und Endung — sie sahen aus wie fertige
Arbeit. Abspielbar war keine davon. Niemandem ist es aufgefallen, weil nichts
geprueft hat, ob am Ende wirklich ein Video herauskam.

Deshalb prueft dieser Baustein die DATEI, nicht den Rueckgabewert des
Renderers. Ein Renderer kann "fertig" melden und trotzdem nichts erzeugt
haben.

WAS GEPRUEFT WIRD (alles gegen marketing.config.json, nicht gegen Konstanten)
  * Datei existiert und hat eine Mindestgroesse
  * Laufzeit innerhalb der Grenzen
  * Aufloesung stimmt (1080x1920)
  * es gibt ueberhaupt eine Tonspur — ein stummes Video ist kein Video
  * Video- und Tonformat sind die, die die Plattformen erwarten
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .. import db
from ..orchestrator import guardrails
from . import common


@dataclass
class Pruefergebnis:
    bestanden: bool
    gruende: list[str] = field(default_factory=list)
    info: common.MedienInfo | None = None

    def als_text(self) -> str:
        return " | ".join(self.gruende) if self.gruende else "ok"


def pruefe(pfad: str | Path, *, erwartete_dauer: float | None = None) -> Pruefergebnis:
    """Ein fertiges Rendering pruefen."""
    p = Path(pfad)
    gruende: list[str] = []

    if not p.exists():
        return Pruefergebnis(False, [f"Datei existiert nicht: {p}"])

    min_bytes = int(guardrails.wert("video.min_dateigroesse_byte", 20480))
    groesse = p.stat().st_size
    if groesse < min_bytes:
        # Der historische Fall: 0 Byte.
        return Pruefergebnis(
            False,
            [f"Datei ist {groesse} Byte gross (Mindestgroesse {min_bytes}) — "
             f"das ist kein abspielbares Video"],
        )

    info = common.medien_info(p)
    if info is None:
        return Pruefergebnis(False, ["Datei ist fuer ffprobe nicht lesbar"], None)

    min_dauer = float(guardrails.wert("video.min_dauer_sek", 8))
    max_dauer = float(guardrails.wert("video.max_dauer_sek", 60))
    breite = int(guardrails.wert("video.breite", 1080))
    hoehe = int(guardrails.wert("video.hoehe", 1920))

    if info.dauer < min_dauer:
        gruende.append(f"zu kurz: {info.dauer:.1f}s (mindestens {min_dauer:.0f}s)")
    if info.dauer > max_dauer:
        gruende.append(f"zu lang: {info.dauer:.1f}s (hoechstens {max_dauer:.0f}s)")
    if (info.breite, info.hoehe) != (breite, hoehe):
        gruende.append(f"falsche Aufloesung: {info.breite}x{info.hoehe} statt {breite}x{hoehe}")
    if not info.hat_ton:
        gruende.append("keine Tonspur — ein stummes Video ist kein fertiges Video")
    if info.video_codec != "h264":
        gruende.append(f"Videoformat {info.video_codec} statt h264")
    if info.hat_ton and info.audio_codec not in ("aac", "mp3"):
        gruende.append(f"Tonformat {info.audio_codec} wird von den Plattformen nicht erwartet")

    if erwartete_dauer and abs(info.dauer - erwartete_dauer) > 3.0:
        gruende.append(
            f"Laufzeit weicht stark vom Briefing ab: {info.dauer:.1f}s statt "
            f"{erwartete_dauer:.1f}s"
        )

    return Pruefergebnis(not gruende, gruende, info)


def haltefest(video_id: int, ergebnis: Pruefergebnis) -> None:
    """Ergebnis am Video vermerken — daran haengt die Veroeffentlichung."""
    if not db.verfuegbar():
        return
    db.ausfuehren(
        """UPDATE mkt_videos
              SET pruefergebnis = %s, pruefgrund = %s,
                  dauer_sek = %s, breite = %s, hoehe = %s
            WHERE id = %s""",
        (
            "ok" if ergebnis.bestanden else "verworfen",
            ergebnis.als_text()[:1000],
            ergebnis.info.dauer if ergebnis.info else None,
            ergebnis.info.breite if ergebnis.info else None,
            ergebnis.info.hoehe if ergebnis.info else None,
            video_id,
        ),
    )
    if not ergebnis.bestanden:
        db.audit("video_verworfen", job="render",
                 begruendung=ergebnis.als_text()[:400])
