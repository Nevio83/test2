"""Punkt 50: Rendern im Hintergrund.

Die wichtigste Pruefung steht zuerst: Die Warteschlange sieht alle paar
Sekunden nach — und darf dabei die Datenbank NICHT fragen. Ein Poller mit
Datenbankzugriff haelt Neon dauerhaft wach; so lief am 22.09. das
Monatskontingent leer.

Das Rendern selbst ist hier ersetzt (es wird in test_stil_c.py mit echtem
ffmpeg geprueft). Die Hintergrundprozesse sind durch Threads ersetzt, weil ein
Ersatz in einem neu gestarteten Prozess nicht ankaeme — der Ablauf drumherum
ist derselbe.
"""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from pipelines.video import style_c_schnittliste as sc
from pipelines.video import warteschlange as ws


@pytest.fixture
def ordner(tmp_path, monkeypatch):
    listen = tmp_path / "schnittlisten"
    renders = tmp_path / "renders"
    listen.mkdir()
    renders.mkdir()
    monkeypatch.setattr(sc, "SCHNITTLISTEN", listen)
    monkeypatch.setattr(sc.common, "RENDERS", renders)
    return listen, renders


def _liste(listen: Path, name: str, alter_sek: float = 60.0) -> Path:
    pfad = listen / name
    pfad.write_text(json.dumps({"produkt_id": 10, "segmente": []}), encoding="utf-8")
    zeit = pfad.stat().st_mtime - alter_sek
    os.utime(pfad, (zeit, zeit))
    return pfad


def _db_verboten(*_a, **_k):
    raise AssertionError("die Datenbank wurde im Takt gefragt")


# ── Kein Datenbank-Takt ──────────────────────────────────────────────

def test_der_blick_in_den_ordner_fragt_die_datenbank_nicht(ordner, monkeypatch):
    listen, _ = ordner
    pfad = _liste(listen, "fassung.json")
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: True)
    monkeypatch.setattr(sc.db, "abfragen", _db_verboten)
    assert sc.offene_listen(nur_dateien=True) == [pfad]

    # GEGENPROBE: Ohne den Schalter geht derselbe Aufruf an die Datenbank —
    # genau das wuerde ein Poller alle fuenf Sekunden tun.
    with pytest.raises(AssertionError, match="im Takt"):
        sc.offene_listen()


# ── Wer wann drankommt ───────────────────────────────────────────────

def test_eine_gerade_gespeicherte_liste_wartet(ordner):
    listen, _ = ordner
    frisch = _liste(listen, "frisch.json", alter_sek=0.0)
    alt = _liste(listen, "alt.json")
    schlange = ws.Warteschlange()
    assert schlange.neue_auftraege([alt, frisch]) == [alt]
    # Mit --einmal gibt es keine Ruhezeit.
    assert ws.Warteschlange(ruhe=0.0).neue_auftraege([frisch]) == [frisch]


def test_gescheitert_kommt_erst_nach_einer_aenderung_wieder(ordner):
    listen, _ = ordner
    pfad = _liste(listen, "kaputt.json")
    schlange = ws.Warteschlange()
    schlange.in_arbeit[pfad] = object()
    assert schlange.neue_auftraege([pfad]) == [], "laeuft schon — nicht doppelt"

    schlange.abgeschlossen(pfad, {"gerendert": 0, "verworfen": 1})
    assert schlange.neue_auftraege([pfad]) == [], "unveraendert — nicht endlos neu"

    # GEGENPROBE: Nach einer Aenderung der Liste kommt sie wieder dran.
    zeit = pfad.stat().st_mtime + 5
    os.utime(pfad, (zeit, zeit))
    schlange._jetzt = lambda: zeit + 60
    assert schlange.neue_auftraege([pfad]) == [pfad]


# ── Protokoll und Durchlauf ──────────────────────────────────────────

def test_jede_liste_hinterlaesst_ein_protokoll(ordner, monkeypatch):
    listen, renders = ordner
    pfad = _liste(listen, "fassung.json")

    def rendere_liste(p):
        print(f"[stil_c] ⛔ {p.name}: Segment 1: 'quelle' fehlt")
        return {"gerendert": 0, "verworfen": 1, "fehler": "quelle fehlt"}

    monkeypatch.setattr(sc, "rendere_liste", rendere_liste)
    ergebnis = ws._arbeite(str(pfad))
    protokoll = renders / "fassung_stil_c.log"
    assert protokoll.exists()
    assert "'quelle' fehlt" in protokoll.read_text(encoding="utf-8")
    assert ergebnis["meldungen"] and "quelle" in ergebnis["meldungen"][0]


def test_ein_absturz_wird_protokolliert_statt_die_schlange_zu_beenden(ordner, monkeypatch):
    listen, renders = ordner
    pfad = _liste(listen, "absturz.json")
    monkeypatch.setattr(sc, "rendere_liste", lambda p: 1 / 0)
    ergebnis = ws._arbeite(str(pfad))
    assert ergebnis["gerendert"] == 0
    assert "division by zero" in (renders / "absturz_stil_c.log").read_text(encoding="utf-8")


def test_einmal_arbeitet_alles_ab_und_endet(ordner, monkeypatch):
    listen, renders = ordner
    for name in ("a.json", "b.json", "c.json"):
        _liste(listen, name)
    gesehen = []

    def rendere_liste(p):
        gesehen.append(p.name)
        (renders / f"{p.stem}_stil_c.mp4").write_bytes(b"x")
        return {"gerendert": 1, "verworfen": 0, "fehler": None}

    monkeypatch.setattr(sc, "rendere_liste", rendere_liste)
    monkeypatch.setattr(ws.common, "verfuegbar", lambda: (True, None))
    monkeypatch.setattr(ws.db, "verfuegbar", lambda: False)
    meldungen = []
    monkeypatch.setattr(ws, "benachrichtige", lambda t, x: meldungen.append(t))

    summe = ws.lauf(parallel=2, einmal=True, takt=0.01, pool_fabrik=ThreadPoolExecutor)
    assert summe == {"gerendert": 3, "verworfen": 0}
    assert sorted(gesehen) == ["a.json", "b.json", "c.json"]
    assert len(meldungen) == 3

    # Zweiter Lauf: alles fertig, nichts wird neu gerendert.
    gesehen.clear()
    assert ws.lauf(parallel=2, einmal=True, takt=0.01, pool_fabrik=ThreadPoolExecutor,
                   leise=True) == {"gerendert": 0, "verworfen": 0}
    assert gesehen == []


# ── Gesperrte Datenbank ──────────────────────────────────────────────

def test_gesperrte_datenbank_wird_einmal_erkannt(monkeypatch):
    monkeypatch.setattr(ws.db, "verfuegbar", lambda: True)

    def gesperrt(*_a, **_k):
        raise RuntimeError("Your account or project has exceeded the quota.\nmehr")

    monkeypatch.setattr(ws.db, "eine_zeile", gesperrt)
    monkeypatch.setattr(ws.db, "schliessen", lambda: None)
    assert "exceeded the quota" in ws.datenbank_pruefen()

    # GEGENPROBE: erreichbar -> nichts zu melden; nicht eingerichtet -> auch nicht.
    monkeypatch.setattr(ws.db, "eine_zeile", lambda *_a, **_k: {"da": 1})
    assert ws.datenbank_pruefen() is None
    monkeypatch.setattr(ws.db, "verfuegbar", lambda: False)
    assert ws.datenbank_pruefen() is None


def test_benachrichtigung_maskiert_anfuehrungszeichen(monkeypatch):
    aufrufe = []
    monkeypatch.setattr(ws.sys, "platform", "win32")
    monkeypatch.setattr(ws.subprocess, "Popen", lambda args, **_k: aufrufe.append(args))
    ws.benachrichtige("Maios", "Liste 'x' fertig")
    befehl = aufrufe[0][-1]
    assert "'Liste ’x’ fertig'" in befehl, "ein ' im Namen haette den Befehl zerbrochen"


def test_parallel_standard_bleibt_klein(monkeypatch):
    monkeypatch.delenv("MARKETING_RENDER_PARALLEL", raising=False)
    monkeypatch.setattr(ws.os, "cpu_count", lambda: 32)
    assert ws.parallel_standard() == 2
    monkeypatch.setenv("MARKETING_RENDER_PARALLEL", "4")
    assert ws.parallel_standard() == 4
