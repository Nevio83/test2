"""Punkt 39: Schnitte auf den Takt — gemessen, nicht angenommen.

Zwei Arten Wahrheit stehen zur Verfuegung, und beide werden benutzt:
  * ein Klick-Takt mit bekanntem Tempo UND bekannter Verschiebung, erzeugt mit
    ffmpeg — da ist jeder Schlag auf die Millisekunde bekannt;
  * die Musikbetten in Marketing/musik, synthetisch mit exaktem Tempo
    erzeugt, das im Dateinamen steht. Geschaetzt wird OHNE den Namen.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipelines.video import common, style_c_schnittliste as sc, takt

hat_ffmpeg = pytest.mark.skipif(not common.verfuegbar()[0], reason="kein ffmpeg")
MUSIK = sorted(p for p in common.MUSIK.glob("*.mp3") if takt.bpm_aus_name(p.name)) if common.MUSIK.exists() else []


def _klicks(ziel: Path, *, bpm: float, versatz: float, dauer: float = 20.0) -> Path:
    periode = 60.0 / bpm
    ausdruck = f"if(lt(mod(t-{versatz}+{periode}*100,{periode}),0.012),0.8*sin(2*PI*1000*t),0)"
    common.lauf(["-f", "lavfi", "-i", f"aevalsrc='{ausdruck}':s=44100:d={dauer}",
                 "-c:a", "aac", "-b:a", "128k", str(ziel)])
    return ziel


# ── Erkennung ────────────────────────────────────────────────────────

@hat_ffmpeg
def test_klicktakt_wird_auf_die_millisekunde_getroffen(tmp_path):
    datei = _klicks(tmp_path / "klicks.m4a", bpm=120, versatz=0.23)
    raster = takt.schlaege(datei)
    assert raster["erkannt"] and raster["quelle"] == "gemessen"
    assert abs(raster["bpm"] - 120) < 0.3, raster["bpm"]
    wahr = np.arange(0.23, 19.5, 0.5)
    abstand = [min(abs(w - s) for s in raster["schlaege"]) for w in wahr]
    assert max(abstand) < 0.03, f"groesste Abweichung {max(abstand) * 1000:.0f} ms"


@hat_ffmpeg
def test_ein_dauerton_hat_keinen_takt(tmp_path):
    """GEGENPROBE: Ohne Einsaetze darf kein Raster erfunden werden."""
    datei = tmp_path / "ton.m4a"
    common.lauf(["-f", "lavfi", "-i", "sine=frequency=220:duration=20", "-c:a", "aac", str(datei)])
    raster = takt.schlaege(datei)
    assert raster["erkannt"] is False
    assert raster["schlaege"] == []


@hat_ffmpeg
@pytest.mark.skipif(not MUSIK, reason="keine Musikbetten mit Tempo im Namen")
@pytest.mark.parametrize("datei", MUSIK, ids=lambda p: p.name)
def test_das_tempo_der_betten_wird_ohne_dateinamen_getroffen(datei):
    kurve = takt.einsatzkurve(takt.samples(datei, sekunden=90))
    geschaetzt = takt.tempo_schaetzen(kurve)
    periode, _, klarheit = takt.raster_einpassen(kurve, geschaetzt)
    bpm = 60.0 / (periode * takt.SCHRITT_SEK)
    wahr = takt.bpm_aus_name(datei.name)
    assert abs(bpm - wahr) / wahr < 0.005, f"{bpm:.2f} statt {wahr}"
    assert klarheit >= takt.MIN_KLARHEIT


@hat_ffmpeg
@pytest.mark.skipif(not MUSIK, reason="keine Musikbetten mit Tempo im Namen")
@pytest.mark.parametrize("datei", MUSIK, ids=lambda p: p.name)
def test_das_raster_liegt_auf_dem_schlag_nicht_dazwischen(datei):
    """Die Wahrheit steht im Erzeuger: Jeder Schlag liegt auf k * 60/BPM ab 0.

    (scripts/musik.py im Skill tiktok-editor: Takt b beginnt bei b * Taktlaenge,
    die Kick bei Sechzehntel 0.) Ein Raster mit richtigem Tempo, aber falscher
    Phase saesse auf dem Offbeat und zoege jeden Schnitt eine halbe Zaehlzeit
    daneben. Genau das passierte bei "clean_minimal", bis die Eins am Bass
    festgemacht wurde.
    """
    raster = takt.schlaege(datei)
    periode = 60.0 / takt.bpm_aus_name(datei.name)
    abweichung = [((s + periode / 2) % periode) - periode / 2 for s in raster["schlaege"][8:40]]
    schlimmste = max(abs(a) for a in abweichung)
    assert schlimmste < 0.035, f"bis {schlimmste * 1000:.0f} ms neben dem Schlag (halbe Zaehlzeit: {periode * 500:.0f} ms)"


# ── Ziehen ───────────────────────────────────────────────────────────

def test_schnitte_werden_nur_in_der_naehe_gezogen():
    schlaege = [i * 0.5 for i in range(40)]
    neu, protokoll = takt.auf_takt_ziehen([2.1, 1.7, 2.4], schlaege, toleranz=0.15)
    # Schnitt 1: 2.1 -> 2.0 (100 ms). Schnitt 2: 2.0+1.7=3.7 -> 3.5 waere 200 ms: bleibt.
    # Schnitt 3: 3.7+2.4=6.1 -> 6.0 (100 ms).
    assert neu == [2.0, 1.7, 2.3]
    assert [p["verschoben_ms"] for p in protokoll] == [-100, 0, -100]
    assert protokoll[1]["nicht"] == "zu weit"


def test_die_quelle_und_die_mindestlaenge_begrenzen():
    schlaege = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]
    neu, protokoll = takt.auf_takt_ziehen([1.9, 0.52], schlaege, toleranz=0.15,
                                           hoechstens=[1.95, None], min_dauer=0.5)
    assert neu[0] == 1.9, "die Quelle hat nur 1,95 s — 2,0 ginge ueber ihr Ende"
    assert protokoll[0]["nicht"] == "Quelle zu kurz"
    # Schnitt 2 laege bei 2.42 -> 2.5 (80 ms), das Segment waere 0.6 s: erlaubt.
    assert neu[1] == 0.6


# ── Im Rendern ───────────────────────────────────────────────────────

def _produkt():
    from pipelines.products import Produkt
    return Produkt(id=10, name="Wasserspender", slug="w", preis=24.99, kategorie="Haushalt",
                   beschreibung="", sku=None, auf_lager=True, lieferzeit=None, bild=None)


@hat_ffmpeg
@pytest.mark.parametrize("an", [True, False], ids=["takt", "gegenprobe-ohne-takt"])
def test_die_schnitte_landen_im_video_auf_dem_takt(tmp_path, monkeypatch, an):
    video = tmp_path / "clip.mp4"
    common.lauf(["-f", "lavfi", "-i", "testsrc=size=1080x1920:rate=30:duration=12",
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", str(video)])
    musik = _klicks(tmp_path / "klicks.m4a", bpm=120, versatz=0.0, dauer=30)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: musik)
    pfad = tmp_path / "fassung.json"
    pfad.write_text(json.dumps({
        "produkt_id": 10, "endkarte": False, "takt": an,
        "segmente": [{"quelle": str(video), "von": 0, "bis": 2.1},
                     {"quelle": str(video), "von": 3, "bis": 5.08},
                     {"quelle": str(video), "von": 6, "bis": 9.4}],
    }), encoding="utf-8")
    _, bericht = sc.rendere(sc.lies(pfad), _produkt(), tmp_path / "fertig.mp4",
                            arbeitsordner=tmp_path / "arbeit")
    if an:
        assert bericht["takt"]["gezogen"] == 3, bericht["takt"]
        # 2,1 -> 2,0 · 4,08 -> 4,0 · 7,4 -> 7,5 (jeweils bis 15 ms Messversatz)
        soll = [-100, -80, 100]
        ist = bericht["takt"]["verschiebungen_ms"]
        assert all(abs(a - b) <= 15 for a, b in zip(ist, soll)), ist
        assert abs(bericht["dauer_gemessen"] - 7.5) < 0.1, "Schnitte bei 2,0 / 4,0 / 7,5 s"
    else:
        assert "takt" not in bericht
        assert abs(bericht["dauer_gemessen"] - 7.58) < 0.1
