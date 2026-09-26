"""Vorlagen fuer wiederkehrende Clip-Formen (Punkt 28).

Was hier abgesichert wird, ist nicht die Vorlage selbst, sondern dass aus ihr
nie ein halbfertiges Video wird:

- Ein Entwurf wird nicht gerendert, solange er mit "_" beginnt.
- Ein uebrig gebliebenes [[…]] bricht das Einlesen ab — Stil C brennt Text
  woertlich ins Bild.
- Die Vorlagen selbst sind lesbar und ergeben mit Endkarte eine Laenge, die
  die Ausgangspruefung nicht sofort ablehnt.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipelines.orchestrator import guardrails
from pipelines.video import style_c_schnittliste as sc
from pipelines.video import vorlagen


def _liste(ordner: Path, **kopf) -> Path:
    """Eine sonst einwandfreie Liste mit echter Datei — nur der Text variiert."""
    datei = ordner / "clip.mp4"
    datei.write_bytes(b"x")
    inhalt = {
        "produkt_id": 10,
        "hook": "Nie wieder Flaschen schleppen",
        "cta": "Link im Profil. Werbung.",
        "hashtags": ["wasserspender"],
        "segmente": [
            {"quelle": str(datei), "von": 0, "bis": 4},
            {"quelle": str(datei), "von": 4, "bis": 9, "text": "Per Knopfdruck"},
        ],
    }
    inhalt.update(kopf)
    pfad = ordner / "fassung.json"
    pfad.write_text(json.dumps(inhalt, ensure_ascii=False), encoding="utf-8")
    return pfad


# ── Die Vorlagen selbst ──────────────────────────────────────────────

def test_es_gibt_vorlagen_und_jede_ist_vollstaendig():
    alle = vorlagen.alle()
    assert len(alle) >= 5, "die fuenf Vorlagen aus Punkt 28 fehlen"
    for v in alle:
        roh = json.loads(v["pfad"].read_text(encoding="utf-8"))
        kopf = roh["_vorlage"]
        assert kopf["name"] == v["pfad"].stem, f"{v['pfad'].name}: Name passt nicht zur Datei"
        assert kopf["wofuer"] and kopf["wann_nicht"], f"{v['name']}: Zweck fehlt"
        assert roh["produkt_id"] is None, f"{v['name']}: eine Vorlage gehoert zu keinem Produkt"
        assert roh["cta"].endswith("Werbung."), f"{v['name']}: Werbe-Kennzeichnung fehlt"
        for nr, seg in enumerate(roh["segmente"], start=1):
            assert seg.get("quelle") is None, f"{v['name']} Segment {nr}: Vorlage mit Clip"
            assert seg.get("rolle") and seg.get("_suche"), f"{v['name']} Segment {nr}: ohne Rolle/Suche"
            assert float(seg["soll_sek"]) > 0


def test_das_erste_segment_hat_nie_text():
    """Ueber dem ersten Segment liegt der Hook (2,5 s) — zwei Texte uebereinander."""
    for v in vorlagen.alle():
        roh = json.loads(v["pfad"].read_text(encoding="utf-8"))
        assert "text" not in roh["segmente"][0], f"{v['name']}: Text kollidiert mit dem Hook"


def test_jede_vorlage_liegt_mit_endkarte_im_erlaubten_rahmen():
    """Zu kurz lehnt die Ausgangspruefung ab — dann war die Vorlage die Falle."""
    unten = float(guardrails.wert("video.min_dauer_sek", 8))
    oben = float(guardrails.wert("video.max_dauer_sek", 60))
    for v in vorlagen.alle():
        assert unten <= v["soll_sek"] <= oben, f"{v['name']}: {v['soll_sek']} s"


def test_vorlagen_liegen_ausserhalb_der_renderliste(tmp_path, monkeypatch):
    """Der Unterordner wird nicht durchsucht — sonst scheiterte jede Vorlage bei jedem Lauf."""
    assert vorlagen.ORDNER.parent == sc.SCHNITTLISTEN
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: False)
    offen = [p.resolve() for p in sc.offene_listen()]
    for v in vorlagen.alle():
        assert v["pfad"].resolve() not in offen


# ── Entwurf anlegen ──────────────────────────────────────────────────

def test_entwurf_beginnt_mit_unterstrich_und_wird_nicht_gerendert(tmp_path, monkeypatch):
    pfad = vorlagen.aus_vorlage("problem_loesung", 10, ziel=tmp_path)
    assert pfad.name == "_entwurf-10-problem_loesung.json"
    roh = json.loads(pfad.read_text(encoding="utf-8"))
    assert roh["produkt_id"] == 10
    assert "10 " in roh["_vorlage"]["entwurf_fuer"]

    monkeypatch.setattr(sc, "SCHNITTLISTEN", tmp_path)
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: False)
    assert sc.offene_listen() == [], "ein Entwurf darf nicht gerendert werden"

    # GEGENPROBE: Dieselbe Datei ohne Unterstrich waere sofort in der Renderliste.
    fertig = pfad.rename(tmp_path / "fassung-10.json")
    assert sc.offene_listen() == [fertig]


def test_ein_entwurf_ueberschreibt_nie_einen_anderen(tmp_path):
    erster = vorlagen.aus_vorlage("drei_gruende", 10, ziel=tmp_path)
    erster.write_text(erster.read_text(encoding="utf-8").replace("[[1 · der staerkste Grund]]", "Leise"), encoding="utf-8")
    # Mit Bindestrich geschrieben landet es bei derselben Vorlage.
    zweiter = vorlagen.aus_vorlage("drei-gruende", 10, ziel=tmp_path)
    assert zweiter != erster
    assert zweiter.name == "_entwurf-10-drei_gruende-2.json"
    assert "Leise" in erster.read_text(encoding="utf-8"), "angefangene Arbeit ist weg"


def test_fester_zielname_und_hook_wie_in_schnitt_md(tmp_path):
    """SCHNITT.md verspricht --ziel und --hook — und "ueberschreibt nie eine bestehende Datei"."""
    ziel = tmp_path / "10_a.json"
    pfad = vorlagen.aus_vorlage("vorher_nachher", 10, datei=ziel, hook="Nie wieder schleppen")
    assert pfad == ziel
    assert json.loads(ziel.read_text(encoding="utf-8"))["hook"] == "Nie wieder schleppen"

    # GEGENPROBE: Ein zweiter Aufruf mit demselben Ziel bricht ab, statt die
    # angefangene Liste zu ersetzen — ohne laufende Nummer, der Name ist gewollt.
    ziel.write_text(ziel.read_text(encoding="utf-8").replace("Nie wieder", "Nie mehr"), encoding="utf-8")
    with pytest.raises(vorlagen.VorlageFehler, match="gibt es schon"):
        vorlagen.aus_vorlage("vorher_nachher", 10, datei=ziel)
    assert "Nie mehr" in ziel.read_text(encoding="utf-8")


def test_unterbefehle_aus_schnitt_md(tmp_path, capsys):
    """Die Aufrufe aus SCHNITT.md §2 laufen ueber EINEN Weg."""
    assert sc._befehl(["vorlage"]) == 0
    assert "Vorlagen" in capsys.readouterr().out
    assert sc._befehl(["vorlage", "drei_gruende", "--produkt", "10",
                       "--ziel", str(tmp_path / "x.json")]) == 0
    assert (tmp_path / "x.json").exists()
    # Eine frische Vorlage ist nicht renderbar — die Pruefung sagt das mit Rueckgabe 1.
    assert sc._befehl(["pruefen", str(tmp_path / "x.json")]) == 1
    assert "'quelle' fehlt" in capsys.readouterr().out


def test_unbekanntes_produkt_und_unbekannte_vorlage_werden_abgewiesen(tmp_path):
    with pytest.raises(vorlagen.VorlageFehler, match="products.json"):
        vorlagen.aus_vorlage("problem_loesung", 99999, ziel=tmp_path)
    with pytest.raises(vorlagen.VorlageFehler, match="Vorhanden"):
        vorlagen.aus_vorlage("gibt-es-nicht", 10, ziel=tmp_path)
    assert list(tmp_path.iterdir()) == [], "bei einem Fehler darf keine Datei entstehen"


def test_hashtags_kommen_nur_aus_einzelwoertern_der_bot_liste():
    tags = vorlagen.hashtag_vorschlag(10)
    assert tags, "Produkt 10 hat Kernwoerter — der Vorschlag darf nicht leer sein"
    assert all(" " not in t for t in tags), "ein Hashtag hat kein Leerzeichen"
    assert len(tags) <= 5
    # Nichts erfunden: Ein Produkt ohne Eintrag bekommt keinen Vorschlag.
    assert vorlagen.hashtag_vorschlag(99999) == []


# ── Der Platzhalter-Schutz in Stil C ─────────────────────────────────

def test_frische_vorlage_laesst_sich_nicht_einlesen(tmp_path):
    """Leere 'quelle' bricht zuerst ab — ein Entwurf ist nie versehentlich renderbar."""
    pfad = vorlagen.aus_vorlage("vorher_nachher", 10, ziel=tmp_path)
    with pytest.raises(sc.SchnittlisteFehler):
        sc.lies(pfad)


@pytest.mark.parametrize("feld,wert", [
    ("hook", "[[Das Problem in einem Satz]]"),
    ("cta", "[[Aufruf]] Werbung."),
    ("hashtags", ["wasserspender", "[[noch einer]]"]),
])
def test_uebrig_gebliebener_platzhalter_bricht_ab(tmp_path, monkeypatch, feld, wert):
    """Clips sind eingesetzt, aber ein [[…]] steht noch da — das waere im Video zu lesen."""
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    pfad = _liste(tmp_path, **{feld: wert})
    with pytest.raises(sc.SchnittlisteFehler, match=r"Platzhalter"):
        sc.lies(pfad)


def test_platzhalter_im_segmenttext_bricht_ab(tmp_path, monkeypatch):
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    pfad = _liste(tmp_path)
    roh = json.loads(pfad.read_text(encoding="utf-8"))
    roh["segmente"][1]["text"] = "[[Der wichtigste Vorteil]]"
    pfad.write_text(json.dumps(roh, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(sc.SchnittlisteFehler, match=r"Segment 2"):
        sc.lies(pfad)


def test_gegenprobe_ausgefuellte_liste_wird_gelesen(tmp_path, monkeypatch):
    """GEGENPROBE: Dieselbe Liste ohne [[…]] geht durch — die Sperre trifft nur Platzhalter."""
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    liste = sc.lies(_liste(tmp_path))
    assert liste.hook == "Nie wieder Flaschen schleppen"
    assert not any("Platzhalter" in w for w in liste.warnungen)


def test_liste_mit_byte_order_mark_wird_gelesen(tmp_path, monkeypatch):
    """PowerShell 5.1 schreibt UTF-8 MIT BOM — beim Ausprobieren am 26.09. gefunden.

    Vorher hiess es "kein gueltiges JSON" fuer eine einwandfreie Datei. Wer
    eine Liste unter Windows speichert, sucht dann den Fehler im Inhalt.
    """
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    pfad = _liste(tmp_path)
    pfad.write_bytes(b"\xef\xbb\xbf" + pfad.read_bytes())
    assert sc.lies(pfad).hook == "Nie wieder Flaschen schleppen"

    # GEGENPROBE: Mit "utf-8" statt "utf-8-sig" scheitert genau diese Datei.
    with pytest.raises(json.JSONDecodeError):
        json.loads(pfad.read_text(encoding="utf-8"))
