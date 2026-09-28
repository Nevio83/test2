"""Schnitte auf den Takt (Punkt 39).

WARUM
Laufen Schnitt und Musik nebeneinanderher, wirkt ein Clip zusammengesetzt.
Liegen die Schnitte auf den Schlaegen, wirkt derselbe Schnitt professionell —
ohne dass jemand sagen koennte, woran es liegt.

WIE — OHNE NEUE ABHAENGIGKEIT
Vorgeschlagen war librosa oder aubio. Beides waere ein neues Paket fuer eine
Rechnung, die mit dem geht, was schon da ist: ffmpeg liefert die Samples,
numpy (kommt mit faster-whisper) rechnet.

  1. Einsatzkurve: kurze Spektren, und je Schritt die Summe dessen, was
     LAUTER geworden ist (spektraler Fluss). Schlaege sind die Spitzen.
  2. Tempo: die Selbstaehnlichkeit dieser Kurve ueber die Zeit — der Abstand,
     in dem sie sich am staerksten wiederholt, ist ein Schlag.
  3. Raster: Periode und Phase gemeinsam fein eingepasst, sodass moeglichst
     viel Einsatz auf den Rasterpunkten liegt.

Steht das Tempo im Dateinamen ("..._124bpm.mp3", so erzeugt der Musikordner
seine Stuecke), wird es genommen und nur die Phase gesucht.

WAS BEWUSST NICHT PASSIERT
Verschoben wird nur, was nah dran ist (Vorgabe 150 ms). Einen Schnitt eine
halbe Sekunde zu verlegen, veraendert die Aussage des Segments — das ist eine
Entscheidung des Schnitts, nicht des Takts. Und ohne erkennbaren Takt (ein
Dauerton, eine Flaeche) wird gar nichts verschoben, statt an ein erfundenes
Raster zu ziehen.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any

from . import common

RATE = 11025
FENSTER = 1024
SCHRITT = 128                      # 11,6 ms je Schritt
SCHRITT_SEK = SCHRITT / RATE
MIN_BPM, MAX_BPM = 70.0, 180.0
# WO EIN EINSATZ LIEGT. Ein Spektrum sieht einen Einsatz schon, wenn er ins
# hintere Viertel seines Fensters rutscht — dort steigt die Fensterkurve am
# steilsten. Dem Schritt die ANFANGSzeit des Fensters zuzuordnen, legte das
# ganze Raster zu frueh: gemessen 78 ms an einem Klicktakt mit bekannter Lage,
# und bei den Musikbetten sass die Bassenergie deutlich NACH dem Raster.
VERSATZ_SEK = 0.75 * FENSTER / RATE

# Klarheit = bestes Raster geteilt durch den Median ueber alle Phasen derselben
# Periode. Gemessen (27.09.): ein Dauerton und die beiden Flaechen-Betten ohne
# Schlagzeug 3,5-3,7; das Bett mit Puls 11; die fuenf Betten mit Tempo im Namen
# 66 bis ueber 10.000. Die erste Fassung teilte durch den Mittelwert der Kurve —
# damit bekam der Dauerton 3,5 und galt als getaktet.
MIN_KLARHEIT = 6.0

_zwischenspeicher: dict[tuple[str, float, float | None], dict[str, Any]] = {}


def bpm_aus_name(name: str) -> float | None:
    """Tempo aus dem Dateinamen ("upbeat_house_124bpm.mp3" -> 124)."""
    treffer = re.search(r"(\d{2,3})\s*bpm", str(name), re.IGNORECASE)
    if not treffer:
        return None
    wert = float(treffer.group(1))
    return wert if MIN_BPM / 2 <= wert <= MAX_BPM * 2 else None


def samples(datei: Path, *, sekunden: float | None = None):
    """Mono-Samples ueber ffmpeg — ohne Umweg ueber eine Zwischendatei."""
    import numpy as np

    pfad = common.ffmpeg_pfad()
    if pfad is None:
        raise common.KeinFfmpeg(common.verfuegbar()[1])
    befehl = [pfad, "-hide_banner", "-nostdin", "-i", str(datei)]
    if sekunden:
        befehl += ["-t", f"{sekunden:.2f}"]
    befehl += ["-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"]
    ergebnis = subprocess.run(befehl, capture_output=True, timeout=300)
    if ergebnis.returncode != 0:
        raise RuntimeError(f"Ton nicht lesbar: {Path(datei).name}")
    return np.frombuffer(ergebnis.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def einsatzkurve(x, *, bis_hz: float | None = None):
    """Spektraler Fluss: je Schritt, wie viel lauter geworden ist.

    @param bis_hz  nur die tiefen Frequenzen — dort liegt der Bass, und der
        markiert die Eins (siehe schlaege()).
    """
    import numpy as np

    if len(x) < FENSTER * 2:
        return np.zeros(0, dtype=np.float32)
    anzahl = 1 + (len(x) - FENSTER) // SCHRITT
    index = np.arange(FENSTER)[None, :] + SCHRITT * np.arange(anzahl)[:, None]
    rahmen = x[index] * np.hanning(FENSTER)[None, :]
    spektrum = np.log1p(100.0 * np.abs(np.fft.rfft(rahmen, axis=1)))
    if bis_hz:
        spektrum = spektrum[:, : max(2, int(bis_hz / (RATE / FENSTER)) + 1)]
    fluss = np.maximum(np.diff(spektrum, axis=0), 0.0).sum(axis=1)
    fluss = np.concatenate([[0.0], fluss])
    # Langsame Lautstaerkeaenderungen abziehen, nur die Einsaetze behalten.
    breite = max(1, int(0.5 / SCHRITT_SEK))
    glatt = np.convolve(fluss, np.ones(breite) / breite, mode="same")
    kurve = np.maximum(fluss - glatt, 0.0)
    spitze = kurve.max()
    return (kurve / spitze).astype(np.float32) if spitze > 0 else kurve.astype(np.float32)


def _raster_wert(kurve, periode: float, phase: float) -> float:
    import numpy as np

    punkte = np.arange(phase, len(kurve) - 1, periode)
    if len(punkte) < 2:
        return 0.0
    unten = np.floor(punkte).astype(int)
    anteil = punkte - unten
    return float(np.mean(kurve[unten] * (1 - anteil) + kurve[unten + 1] * anteil))


def tempo_schaetzen(kurve) -> float | None:
    """Tempo aus der Selbstaehnlichkeit der Einsatzkurve. None = kein Takt erkennbar."""
    import numpy as np

    if len(kurve) < int(8 / SCHRITT_SEK):
        return None
    k = kurve - kurve.mean()
    voll = np.fft.irfft(np.abs(np.fft.rfft(k, n=2 * len(k))) ** 2)[: len(k)]
    if voll[0] <= 0:
        return None
    kurz = int(60.0 / MAX_BPM / SCHRITT_SEK)
    lang = int(60.0 / MIN_BPM / SCHRITT_SEK) + 1
    abstaende = np.arange(kurz, lang)
    werte = voll[kurz:lang] / voll[0]
    # Leichte Vorliebe fuer die Mitte (um 120 BPM): Bei Doppel- und
    # Halbtempo liegen zwei Spitzen fast gleich hoch, und dann soll die
    # musikalisch uebliche gewinnen, nicht die zufaellig hoehere.
    bpm = 60.0 / (abstaende * SCHRITT_SEK)
    gewicht = np.exp(-0.5 * (np.log2(bpm / 120.0) / 1.0) ** 2)
    beste = int(np.argmax(werte * gewicht))
    if werte[beste] <= 0:
        return None
    # Parabel durch die Nachbarn: Aufloesung unter einem Schritt.
    lag = float(abstaende[beste])
    if 0 < beste < len(werte) - 1:
        a, b, c = werte[beste - 1], werte[beste], werte[beste + 1]
        nenner = a - 2 * b + c
        if nenner < 0:
            lag += 0.5 * (a - c) / nenner
    return 60.0 / (lag * SCHRITT_SEK)


def raster_einpassen(kurve, bpm: float, *, periode_frei: bool = True) -> tuple[float, float, float]:
    """(Periode in Schritten, Phase in Schritten, Klarheit) — gemeinsam eingepasst."""
    import numpy as np

    grund = 60.0 / bpm / SCHRITT_SEK
    perioden = grund * (np.linspace(0.99, 1.01, 81) if periode_frei else np.array([1.0]))
    bestes = (grund, 0.0, 0.0)
    for periode in perioden:
        for phase in np.arange(0.0, periode, 0.25):
            wert = _raster_wert(kurve, float(periode), float(phase))
            if wert > bestes[2]:
                bestes = (float(periode), float(phase), wert)
    periode = bestes[0]
    alle = [_raster_wert(kurve, periode, float(p)) for p in np.arange(0.0, periode, 0.25)]
    median = float(np.median(alle)) if alle else 0.0
    klarheit = bestes[2] / median if median > 0 else (float("inf") if bestes[2] > 0 else 0.0)
    return bestes[0], bestes[1], klarheit


def schlaege(datei: Path, *, bpm: float | None = None, sekunden: float | None = 90.0) -> dict[str, Any]:
    """Das Taktraster eines Musikstuecks.

    {"bpm", "quelle": "name"|"gemessen", "klarheit", "schlaege": [s, ...],
     "erkannt": bool, "grund"}
    """
    datei = Path(datei)
    try:
        schluessel = (str(datei.resolve()), datei.stat().st_mtime, bpm)
    except OSError:
        schluessel = (str(datei), 0.0, bpm)
    if schluessel in _zwischenspeicher:
        return _zwischenspeicher[schluessel]

    x = samples(datei, sekunden=sekunden)
    kurve = einsatzkurve(x)
    vorgabe = bpm or bpm_aus_name(datei.name)
    quelle = "name" if vorgabe else "gemessen"
    tempo = vorgabe or tempo_schaetzen(kurve)
    if not tempo or len(kurve) == 0:
        ergebnis = {"bpm": None, "quelle": quelle, "klarheit": 0.0, "schlaege": [],
                    "erkannt": False, "grund": "kein Takt erkennbar"}
    else:
        periode, phase, klarheit = raster_einpassen(kurve, tempo, periode_frei=not vorgabe)
        # DIE EINS LIEGT AUF DEM BASS. Hat ein Stueck die Hi-Hat auf jedem
        # Achtel-Offbeat und die Kick nur auf 1 und 3 (so "clean_minimal"),
        # rastet das Raster auf die Offbeats ein: Dort gibt es mehr Einsaetze.
        # Gemessen an der Vorlage des Erzeugers lag es genau eine halbe
        # Zaehlzeit daneben. Also: tiefe Frequenzen auf dem Raster gegen eine
        # halbe Zaehlzeit versetzt — das Staerkere gewinnt.
        tief = einsatzkurve(x, bis_hz=150.0)
        if len(tief) == len(kurve):
            auf = _raster_wert(tief, periode, phase)
            versetzt = _raster_wert(tief, periode, (phase + periode / 2) % periode)
            if versetzt > 1.2 * auf:
                phase = (phase + periode / 2) % periode
        dauer = len(x) / RATE
        schritte = []
        t = phase
        while t * SCHRITT_SEK + VERSATZ_SEK <= dauer:
            schritte.append(round(t * SCHRITT_SEK + VERSATZ_SEK, 4))
            t += periode
        erkannt = klarheit >= MIN_KLARHEIT
        ergebnis = {
            "bpm": round(60.0 / (periode * SCHRITT_SEK), 2),
            "quelle": quelle,
            "klarheit": round(min(klarheit, 1e6), 2),
            "schlaege": schritte if erkannt else [],
            "erkannt": erkannt,
            "grund": None if erkannt else f"Takt zu undeutlich (Klarheit {klarheit:.2f})",
        }
    _zwischenspeicher[schluessel] = ergebnis
    return ergebnis


def auf_takt_ziehen(dauern: list[float], schlaege_sek: list[float], *,
                    toleranz: float = 0.15, min_dauer: float = 0.5,
                    hoechstens: list[float | None] | None = None) -> tuple[list[float], list[dict[str, Any]]]:
    """Segmentlaengen so anpassen, dass die Schnitte auf Schlaege fallen.

    Jeder Schnitt wird fuer sich betrachtet, in Reihenfolge: Verschiebt sich
    Schnitt 1, verschieben sich alle danach — deshalb zaehlt immer die schon
    angepasste Position. Nur innerhalb der Toleranz, nie unter min_dauer und
    nie ueber das hinaus, was die Quelldatei hergibt (hoechstens).
    """
    import bisect

    neu: list[float] = []
    protokoll: list[dict[str, Any]] = []
    zeit = 0.0
    raster = sorted(schlaege_sek)
    for i, dauer in enumerate(dauern):
        ende = zeit + dauer
        naechster = None
        if raster:
            stelle = bisect.bisect_left(raster, ende)
            kandidaten = [raster[j] for j in (stelle - 1, stelle) if 0 <= j < len(raster)]
            naechster = min(kandidaten, key=lambda b: abs(b - ende)) if kandidaten else None
        verschiebung = (naechster - ende) if naechster is not None else None
        grenze = (hoechstens or [None] * len(dauern))[i]
        neue_dauer = dauer
        grund = None
        if verschiebung is None:
            grund = "kein Schlag"
        elif abs(verschiebung) > toleranz:
            grund = "zu weit"
        elif dauer + verschiebung < min_dauer:
            grund = "Segment wuerde zu kurz"
        elif grenze is not None and dauer + verschiebung > grenze + 1e-6:
            grund = "Quelle zu kurz"
        else:
            neue_dauer = dauer + verschiebung
        protokoll.append({
            "schnitt": i + 1,
            "verschoben_ms": round((neue_dauer - dauer) * 1000),
            **({"nicht": grund, "abstand_ms": round(verschiebung * 1000)} if grund and verschiebung is not None
               else ({"nicht": grund} if grund else {})),
        })
        neu.append(round(neue_dauer, 3))
        zeit += neue_dauer
    return neu, protokoll
