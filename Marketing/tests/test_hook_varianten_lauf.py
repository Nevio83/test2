"""Punkt 58 im Render-Lauf: aus einer Liste mehrere Fassungen, getrennt gehalten.

Die Bausteine (hook_varianten, variantenname) pruefen die Tests in
test_stil_c.py. Hier geht es um das, was erst im Lauf passiert:

  * Eine Liste mit "hook_varianten" wird zu mehreren Dateien, nicht zu einer.
  * Sie gilt erst als fertig, wenn JEDE Fassung da ist — sonst bliebe eine
    gescheiterte Fassung b liegen und der Vergleich faende nie statt.
  * Eine fertige Fassung wird nicht noch einmal gerendert.

Das Rendern selbst ist hier ersetzt: Es wird an anderer Stelle mit echtem
ffmpeg geprueft. Der Ersatz schreibt eine echte Datei an das echte Ziel und
meldet, was er bekommen hat — er behauptet nichts, was der echte Lauf nicht
auch tut.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipelines.video import style_c_schnittliste as sc


def _liste(ordner: Path, name: str = "fassung.json", **kopf) -> Path:
    clip = ordner / "clip.mp4"
    clip.write_bytes(b"x")
    inhalt = {"produkt_id": 10, "hook": "Grundhook", "hashtags": ["x"],
              "segmente": [{"quelle": str(clip), "von": 0, "bis": 3, "text": "A"},
                           {"quelle": str(clip), "von": 3, "bis": 6, "text": "B"},
                           {"quelle": str(clip), "von": 6, "bis": 9, "text": "C"}]}
    inhalt.update(kopf)
    pfad = ordner / name
    pfad.write_text(json.dumps(inhalt, ensure_ascii=False), encoding="utf-8")
    return pfad


@pytest.fixture
def ohne_db(tmp_path, monkeypatch):
    listen = tmp_path / "schnittlisten"
    renders = tmp_path / "renders"
    listen.mkdir()
    renders.mkdir()
    monkeypatch.setattr(sc, "SCHNITTLISTEN", listen)
    monkeypatch.setattr(sc.common, "RENDERS", renders)
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: False)
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    return listen, renders


def test_hook_varianten_werden_gelesen(ohne_db):
    listen, _ = ohne_db
    liste = sc.lies(_liste(listen, hook_varianten=["Hook A", " ", "Hook B"], varianten_rotieren=True))
    assert liste.hook_varianten == ["Hook A", "Hook B"], "leere Eintraege zaehlen nicht"
    assert liste.varianten_rotieren is True

    # GEGENPROBE: ohne Feld bleibt alles wie bisher — eine Fassung.
    assert sc.lies(_liste(listen, name="b.json")).hook_varianten == []


def test_platzhalter_in_einer_variante_bricht_ab(ohne_db):
    listen, _ = ohne_db
    with pytest.raises(sc.SchnittlisteFehler, match="hook_varianten"):
        sc.lies(_liste(listen, hook_varianten=["Echt", "[[zweiter Hook]]"]))


def test_ziele_je_fassung(ohne_db):
    listen, renders = ohne_db
    ohne = _liste(listen)
    assert sc._ziele(ohne) == [(renders / "fassung_stil_c.mp4", None)]

    mit = _liste(listen, name="drei.json", hook_varianten=["a", "b", "c"])
    assert [(z.name, k) for z, k in sc._ziele(mit)] == [
        ("drei_stil_c_a.mp4", "a"), ("drei_stil_c_b.mp4", "b"), ("drei_stil_c_c.mp4", "c")]


def test_erst_fertig_wenn_jede_fassung_da_ist(ohne_db):
    listen, renders = ohne_db
    pfad = _liste(listen, hook_varianten=["eins", "zwei"])
    spaeter = pfad.stat().st_mtime + 10

    a = renders / "fassung_stil_c_a.mp4"
    a.write_bytes(b"x")
    os.utime(a, (spaeter, spaeter))
    assert sc.offene_listen() == [pfad], "Fassung b fehlt — die Liste ist nicht fertig"

    b = renders / "fassung_stil_c_b.mp4"
    b.write_bytes(b"x")
    os.utime(b, (spaeter, spaeter))
    assert sc.offene_listen() == [], "beide Fassungen da — nichts zu tun"

    # GEGENPROBE: Die alte Regel sah nur auf fassung_stil_c.mp4. Die gibt es bei
    # einer Liste mit Varianten nie — sie haette die Liste bei JEDEM Lauf neu
    # gerendert, alle Fassungen, minutenlang.
    assert not (renders / "fassung_stil_c.mp4").exists()


def test_der_lauf_baut_je_fassung_ein_video_und_ueberspringt_fertige(ohne_db, monkeypatch):
    listen, renders = ohne_db
    _liste(listen, hook_varianten=["Hook A", "Hook B", "Hook C"], varianten_rotieren=True)
    monkeypatch.setattr(sc.common, "verfuegbar", lambda: (True, None))

    aufrufe: list[tuple[str, str, list[str]]] = []

    def rendere(liste, produkt, ziel, **_):
        aufrufe.append((ziel.name, liste.hook, [s.text for s in liste.segmente]))
        ziel.write_bytes(b"x")
        return ziel, {"segmente": len(liste.segmente), "musik": "m.mp3",
                      "dauer_soll": liste.gesamtdauer, "hook": liste.hook}

    monkeypatch.setattr(sc, "rendere", rendere)
    monkeypatch.setattr(sc.quality_gate, "pruefe", lambda ziel, **_: SimpleNamespace(
        bestanden=True, info=SimpleNamespace(dauer=9.0), als_text=lambda: "ok"))

    ergebnis = sc.job_render_stil_c()
    assert ergebnis["gerendert"] == 3
    assert aufrufe == [
        ("fassung_stil_c_a.mp4", "Hook A", ["A", "B", "C"]),
        ("fassung_stil_c_b.mp4", "Hook B", ["B", "C", "A"]),
        ("fassung_stil_c_c.mp4", "Hook C", ["C", "A", "B"]),
    ]

    # Zweiter Lauf: alles fertig, nichts wird neu gerendert.
    aufrufe.clear()
    assert sc.job_render_stil_c()["gerendert"] == 0
    assert aufrufe == []

    # Faellt EINE Fassung weg, wird nur sie nachgebaut — nicht alle drei.
    (renders / "fassung_stil_c_b.mp4").unlink()
    sc.job_render_stil_c()
    assert [a[0] for a in aufrufe] == ["fassung_stil_c_b.mp4"]
