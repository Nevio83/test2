"""Punkt 44: eigener Ton im Video — und Untertitel aus diesem Ton.

Die Hauptpruefung arbeitet mit ECHTER Sprache: Die Windows-Sprachausgabe
spricht einen deutschen Satz, daraus wird ein eigener Clip, Stil C rendert
ihn, und faster-whisper muss den Satz im fertigen Untertitel wiederfinden.
Ein Nachbau des Spracherkenners wuerde genau das nicht pruefen, worum es geht
(siehe "Nachbauten muessen luegenfrei sein").
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from pipelines.video import common, style_c_schnittliste as sc

hat_ffmpeg = pytest.mark.skipif(not common.verfuegbar()[0], reason="kein ffmpeg")


def _hat_whisper() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


braucht_sprache = pytest.mark.skipif(
    sys.platform != "win32" or not _hat_whisper(),
    reason="braucht die Windows-Sprachausgabe und faster-whisper",
)

SATZ = "Der Wasserspender füllt dein Glas auf Knopfdruck."


def _sprich(ziel: Path, text: str) -> Path:
    befehl = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "try { $s.SelectVoice('Microsoft Hedda Desktop') } catch {}; "
        f"$s.SetOutputToWaveFile('{ziel}'); $s.Speak('{text}'); $s.Dispose()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", befehl], check=True,
                   capture_output=True, timeout=120)
    return ziel


def _eigener_clip(ordner: Path, *, mit_sprache: bool = True) -> Path:
    """6 s Bild; mit Sprache in den ersten Sekunden, sonst ein Ton ohne Worte."""
    ordner.mkdir(parents=True, exist_ok=True)
    ziel = ordner / "handy.mp4"
    if mit_sprache:
        ton = _sprich(ordner / "satz.wav", SATZ)
        ton_eingabe = ["-i", str(ton)]
    else:
        ton_eingabe = ["-f", "lavfi", "-i", "sine=frequency=440:duration=6"]
    common.lauf([
        "-f", "lavfi", "-i", "testsrc=size=1080x1920:rate=30:duration=6", *ton_eingabe,
        "-filter_complex", "[1:a]apad=whole_dur=6[a]", "-map", "0:v", "-map", "[a]",
        "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(ziel),
    ])
    return ziel


def _stille(ordner: Path) -> Path:
    ziel = ordner / "stille.m4a"
    common.lauf(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "30",
                 "-c:a", "aac", str(ziel)])
    return ziel


def _lautstaerke(datei: Path, von: float, dauer: float) -> float:
    ausgabe = common.lauf(["-ss", f"{von:.2f}", "-t", f"{dauer:.2f}", "-i", str(datei),
                           "-af", "volumedetect", "-f", "null", "-"])
    for zeile in ausgabe.splitlines():
        if "mean_volume:" in zeile:
            return float(zeile.split("mean_volume:")[1].strip().split()[0])
    raise AssertionError("volumedetect hat nichts gemeldet")


def _produkt():
    from pipelines.products import Produkt
    return Produkt(id=10, name="Elektrischer Wasserspender", slug="wasserspender", preis=24.99,
                   kategorie="Haushalt", beschreibung="", sku=None, auf_lager=True,
                   lieferzeit=None, bild=None)


def _liste(ordner: Path, clip: Path, *, ton: bool, untertitel: bool = True) -> Path:
    inhalt = {
        "produkt_id": 10, "endkarte": False, "hashtags": ["x"], "hook": "Probe",
        "segmente": [
            {"quelle": str(clip), "von": 0, "bis": 5, **({"ton": "eigen"} if ton else {})},
            {"quelle": str(clip), "von": 0, "bis": 4},
        ],
        **({"untertitel": "aus_ton"} if untertitel else {}),
    }
    pfad = ordner / "fassung.json"
    pfad.write_text(json.dumps(inhalt, ensure_ascii=False), encoding="utf-8")
    return pfad


@pytest.fixture
def eigen(tmp_path, monkeypatch):
    eigenes = tmp_path / "eigenes"
    monkeypatch.setattr(sc.assets, "EIGENES_ROHMATERIAL", eigenes)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _stille(tmp_path))
    return eigenes


# ── Die Tuer: nur eigenes Material ───────────────────────────────────

@hat_ffmpeg
def test_fremder_ton_wird_beim_einlesen_abgewiesen(tmp_path, eigen):
    fremd = _eigener_clip(tmp_path / "rohmaterial", mit_sprache=False)
    with pytest.raises(sc.SchnittlisteFehler, match="nur bei eigenem Material"):
        sc.lies(_liste(tmp_path, fremd, ton=True))

    # GEGENPROBE: Dieselbe Datei im Ordner fuer eigenes Material geht durch.
    eigener = _eigener_clip(eigen, mit_sprache=False)
    assert sc.lies(_liste(tmp_path, eigener, ton=True)).segmente[0].ton == "eigen"


def test_unbekannte_werte_werden_abgewiesen(tmp_path, monkeypatch):
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"x")
    pfad = tmp_path / "l.json"
    pfad.write_text(json.dumps({"produkt_id": 10, "untertitel": "automatisch",
                                "segmente": [{"quelle": str(clip), "von": 0, "bis": 9}]}),
                    encoding="utf-8")
    with pytest.raises(sc.SchnittlisteFehler, match="aus_ton"):
        sc.lies(pfad)
    pfad.write_text(json.dumps({"produkt_id": 10, "untertitel": "aus_ton",
                                "segmente": [{"quelle": str(clip), "von": 0, "bis": 9}]}),
                    encoding="utf-8")
    assert any("nichts abzuhoeren" in w for w in sc.lies(pfad).warnungen)


def test_woerter_werden_zu_kurzen_bloecken_mit_echten_zeiten():
    bloecke = sc.woerter_zu_bloecken([
        (0.0, 0.3, "Der"), (0.3, 0.9, "Wasserspender"), (0.9, 1.2, "fuellt"),
        (1.2, 1.5, "dein"), (1.5, 1.9, "Glas"),
    ])
    assert bloecke == [
        {"von": 0.0, "bis": 0.9, "text": "Der Wasserspender"},
        {"von": 0.9, "bis": 1.9, "text": "fuellt dein Glas"},
    ], "hoechstens 22 Zeichen, hoechstens drei Woerter"
    assert sc.woerter_zu_bloecken([]) == []


# ── Der ganze Weg mit echter Sprache ─────────────────────────────────

@hat_ffmpeg
@braucht_sprache
def test_eigene_stimme_ist_zu_hoeren_und_steht_als_untertitel_im_bild(tmp_path, eigen):
    clip = _eigener_clip(eigen)
    liste = sc.lies(_liste(tmp_path, clip, ton=True))
    arbeit = tmp_path / "arbeit"
    ziel = tmp_path / "fertig.mp4"
    _, bericht = sc.rendere(liste, _produkt(), ziel, arbeitsordner=arbeit)

    assert bericht["eigener_ton"] == [1]
    assert bericht.get("untertitel_aus_ton", 0) >= 1, "nichts erkannt"
    ass = (arbeit / "untertitel.ass").read_text(encoding="utf-8").lower()
    assert "wasser" in ass, f"der gesprochene Satz fehlt im Untertitel:\n{ass[-400:]}"

    # Hoerbar genau dort, wo das Segment mit eigenem Ton liegt — nicht danach.
    sprache = _lautstaerke(ziel, 0.5, 2.0)
    danach = _lautstaerke(ziel, 6.0, 2.0)
    assert sprache > danach + 20, f"Sprache {sprache} dB, Segment ohne Ton {danach} dB"


@hat_ffmpeg
@braucht_sprache
def test_erkannter_text_laesst_sich_korrigieren(tmp_path, eigen):
    """Das kleine Modell hoerte "Wasserspende fuehlt" — Stil C brennt Text woertlich ein.

    Also: einmal erkennen, in die Korrekturdatei schreiben, dort verbessern.
    Der naechste Lauf nimmt den verbesserten Text, und die Aenderung zaehlt
    als neue Fassung.
    """
    clip = _eigener_clip(eigen)
    pfad = _liste(tmp_path, clip, ton=True)
    vorher = sc.pruefsumme(pfad)
    _, bericht = sc.rendere(sc.lies(pfad), _produkt(), tmp_path / "a.mp4", arbeitsordner=tmp_path / "a")
    assert bericht["untertitel_quelle"] == "erkannt"

    korrektur = sc.untertitel_datei(pfad)
    assert korrektur.name == "_fassung.untertitel.json", "mit _ — sonst hielte der Lauf sie fuer eine Liste"
    daten = json.loads(korrektur.read_text(encoding="utf-8"))
    [spur] = daten["spuren"].values()
    spur["bloecke"][0]["text"] = "KORRIGIERT"
    korrektur.write_text(json.dumps(daten, ensure_ascii=False), encoding="utf-8")
    assert sc.pruefsumme(pfad) != vorher, "eine Korrektur muss neu rendern lassen"

    _, bericht = sc.rendere(sc.lies(pfad), _produkt(), tmp_path / "b.mp4", arbeitsordner=tmp_path / "b")
    assert bericht["untertitel_quelle"] == "datei", \
        "dieselbe Liste muss dieselbe Tonspur ergeben — sonst wird jede Korrektur ignoriert"
    assert "KORRIGIERT" in (tmp_path / "b" / "untertitel.ass").read_text(encoding="utf-8")


def test_trockenpruefung_erinnert_ans_gegenlesen(tmp_path, eigen, monkeypatch):
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    eigen.mkdir(parents=True)
    clip = eigen / "handy.mp4"
    clip.write_bytes(b"x")
    pfad = _liste(tmp_path, clip, ton=True)
    hinweise = " ".join(sc.trockenpruefung(pfad)["hinweise"])
    assert "_fassung.untertitel.json" in hinweise and "gegenlesen" in hinweise

    # GEGENPROBE: Liegt die Korrektur schon da, ist nichts mehr zu sagen.
    sc.untertitel_datei(pfad).write_text('{"spuren": {}}', encoding="utf-8")
    assert "gegenlesen" not in " ".join(sc.trockenpruefung(pfad)["hinweise"])


def test_korrekturdatei_zaehlt_zur_fassung(tmp_path):
    pfad = tmp_path / "fassung.json"
    pfad.write_text('{"produkt_id": 10}', encoding="utf-8")
    ohne = sc.pruefsumme(pfad)
    assert sc.pruefsumme(pfad) == ohne, "GEGENPROBE: ohne Aenderung bleibt der Fingerabdruck"
    sc.untertitel_datei(pfad).write_text('{"spuren": {}}', encoding="utf-8")
    assert sc.pruefsumme(pfad) != ohne

    # Ohne Datenbank entscheidet die Dateizeit — auch die der Korrektur.
    video = tmp_path / "fassung_stil_c.mp4"
    video.write_bytes(b"x")
    import os
    spaeter = pfad.stat().st_mtime + 10
    os.utime(video, (spaeter, spaeter))
    assert sc._ziel_aktuell(pfad, video)
    os.utime(sc.untertitel_datei(pfad), (spaeter + 10, spaeter + 10))
    assert not sc._ziel_aktuell(pfad, video), "eine spaetere Korrektur heisst: neu rendern"


@hat_ffmpeg
@braucht_sprache
def test_gegenprobe_ohne_freigabe_bleibt_der_ton_draussen(tmp_path, eigen):
    """Derselbe Clip ohne "ton": "eigen" — die Stimme darf nirgends zu hoeren sein."""
    clip = _eigener_clip(eigen)
    liste = sc.lies(_liste(tmp_path, clip, ton=False, untertitel=False))
    ziel = tmp_path / "fertig.mp4"
    _, bericht = sc.rendere(liste, _produkt(), ziel, arbeitsordner=tmp_path / "arbeit")
    assert "eigener_ton" not in bericht
    assert _lautstaerke(ziel, 0.5, 2.0) < -60, "der Originalton ist durchgerutscht"
