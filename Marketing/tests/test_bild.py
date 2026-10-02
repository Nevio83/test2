"""Punkte 19, 23, 30 und 35: Ins Bild schauen.

ZWEI ARTEN VON PRUEFUNG, bewusst getrennt:

  * Die REGELN — was als ortsfeste Einblendung zaehlt, wann ein Gesicht
    "sicher" ist, wie die ersten drei Sekunden abgelaufen werden — laufen
    ohne Modell. Dort sitzen die Fehler, die beim Bauen wirklich passiert
    sind, und dort steht zu jedem die Gegenprobe.
  * Die MODELLE selbst laufen nur, wenn sie auf der Platte liegen
    (`npm run tiktok:bild` laedt sie einmal). Fehlen sie, wird uebersprungen —
    eine Pruefung, die nebenbei 92 MB aus dem Netz holt, waere keine.

WAS HIER FEHLT, UND WARUM: Es gibt keine Pruefung mit einem ECHTEN Gesicht.
Im Repo liegt kein Bild eines Menschen, und eines dafuer einzuchecken waere
genau das, wovor Punkt 23 warnt. Die Schwellen sind an fremdem Rohmaterial
gemessen, das nicht ins Repo gehoert; geprueft wird hier nur, dass ein Bild
ohne Gesicht keins meldet.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pytest

from pipelines.video import bild, common, style_c_schnittliste as sc

hat_ffmpeg = pytest.mark.skipif(not common.verfuegbar()[0], reason="kein ffmpeg")


def _modelle_da() -> bool:
    """Liegen alle drei Modelle auf der Platte? (conftest schaltet die Erkennung sonst ab.)"""
    alt = os.environ.get("MARKETING_BILD")
    os.environ["MARKETING_BILD"] = "an"
    try:
        return bild.verfuegbar(("clip", "gesicht", "text"))[0]
    finally:
        if alt is None:
            os.environ.pop("MARKETING_BILD", None)
        else:
            os.environ["MARKETING_BILD"] = alt


braucht_modelle = pytest.mark.skipif(
    not _modelle_da(), reason="Bildmodelle nicht geladen — einmal `npm run tiktok:bild`")


def _farbvideo(ziel: Path, *, sekunden: float = 3.0, zusatz: str = "", groesse: str = "540x960") -> Path:
    filter_kette = ["-vf", zusatz] if zusatz else []
    common.lauf(["-f", "lavfi", "-i", f"color=c=0x336699:size={groesse}:rate=30:duration={sekunden}",
                 *filter_kette, "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel)])
    return ziel


# ── Standbilder ──────────────────────────────────────────────────────

def test_zeitpunkte_lassen_das_erste_zehntel_aus():
    punkte = bild.zeitpunkte(20.0, 8)
    assert len(punkte) == 8
    assert punkte[0] > 2.0, "bei 0 % steht fast immer ein Titeleinblender"
    assert punkte[-1] < 19.0
    assert punkte == sorted(punkte)


def test_zeitpunkte_mit_abschnitt_gelten_genau_dort():
    # Gegenprobe zum Test darueber: Mit von/bis gibt es KEINEN Abzug — fuer
    # "die ersten drei Sekunden" (Punkt 35) waere er genau falsch.
    punkte = bild.zeitpunkte(20.0, 6, von=0.0, bis=3.0)
    assert punkte[0] == 0.25 and punkte[-1] == 2.75
    assert all(0 <= p <= 3.0 for p in punkte)


def test_verkleinern_mittelt_statt_wegzulassen():
    # Schachbrett aus einzelnen Bildpunkten: gemittelt ist das Grau.
    feld = np.zeros((64, 64, 3), dtype=np.uint8)
    feld[::2, ::2] = 255
    feld[1::2, 1::2] = 255
    klein = bild.skaliere(feld, 16, 16)
    assert klein.shape == (16, 16, 3) and klein.dtype == np.float32
    assert abs(float(klein.mean()) - 127.5) < 1 and float(klein.std()) < 1

    # GEGENPROBE: Jeden vierten Bildpunkt einfach zu nehmen (so war die erste
    # Fassung) ergibt reines Weiss — feine Schrift wird dabei zu Rauschen.
    assert float(feld[::4, ::4].mean()) == 255.0


# ── Fremder Text (Punkt 30) ──────────────────────────────────────────

def test_textbereiche_als_kaesten_in_anteilen():
    maske = np.zeros((100, 50), dtype=bool)
    maske[10:14, 5:25] = True          # eine Zeile oben
    maske[60:70, 20:30] = True         # ein Block in der Mitte
    maske[90, 40] = True               # ein einzelner Punkt: kein Text
    bereiche = sorted(bild.textbereiche(maske), key=lambda b: b["y"])
    assert len(bereiche) == 2
    assert bereiche[0] == {"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.04}
    assert bereiche[1] == {"x": 0.4, "y": 0.6, "w": 0.2, "h": 0.1}

    # Gegenprobe: Ohne Mindestgroesse zaehlt der einzelne Punkt mit.
    assert len(bild.textbereiche(maske, min_zellen=1)) == 3


def test_rand_heisst_ganz_im_randband():
    assert bild._am_rand({"x": 0.1, "y": 0.02, "w": 0.8, "h": 0.1})          # oben
    assert bild._am_rand({"x": 0.1, "y": 0.86, "w": 0.8, "h": 0.1})          # unten
    assert not bild._am_rand({"x": 0.1, "y": 0.45, "w": 0.8, "h": 0.1})      # mitten im Bild
    # Ragt der Kasten aus dem Band heraus, laesst er sich nicht wegschneiden.
    assert not bild._am_rand({"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.2})


def _karten(orte: list[tuple[int, int] | None]) -> np.ndarray:
    """Je Bild eine Textkarte 864x480 mit einem Textfleck an `ort` (oben, links) — oder ohne."""
    karten = np.zeros((len(orte), 864, 480), dtype=np.float32)
    for i, ort in enumerate(orte):
        if ort is not None:
            karten[i, ort[0]:ort[0] + 40, ort[1]:ort[1] + 200] = 0.9
    return karten


def _mit_karten(monkeypatch, orte):
    monkeypatch.setattr(bild, "textkarte", lambda bilder: _karten(orte))
    return bild.fremdtext(Path("egal.mp4"), bilder=np.zeros((len(orte), 960, 540, 3), dtype=np.uint8))


def test_einblendung_ist_text_der_an_derselben_stelle_bleibt(monkeypatch):
    befund = _mit_karten(monkeypatch, [(400, 140)] * 8)
    assert befund["ortsfest"] and befund["einblendung"]
    assert befund["lage"] == "mitte"

    oben = _mit_karten(monkeypatch, [(30, 140)] * 8)
    assert oben["ortsfest"] and oben["lage"] == "rand", "am Rand laesst sie sich wegschneiden"


def test_aufdruck_am_geraet_ist_keine_einblendung(monkeypatch):
    # GEGENPROBE zur ersten Fassung, die JEDEN Text zaehlte: "100 ML" am
    # Wasserspender wandert mit dem Geraet durchs Bild — in fuenf von acht
    # Bildern Text, aber nie an derselben Stelle. Die erste Fassung meldete
    # genau so einen Clip als "dauerhaft, Mitte".
    wandernd = [(100, 20), (220, 200), None, (340, 60), (460, 240), None, (580, 100), None]
    befund = _mit_karten(monkeypatch, wandernd)
    assert befund["mit_text"] == 5
    assert not befund["ortsfest"] and not befund["haeufig"]
    assert not befund["einblendung"]


def test_wechselnde_untertitel_fallen_ueber_die_haeufigkeit_auf(monkeypatch):
    # Untertitel springen mit jedem Satz — ortsfest sind sie nicht, stehen aber
    # in fast jedem Bild. Gemessen: Aufdruck 5 von 8, Untertitel 7 von 8.
    springend = [(100, 20), (220, 200), (340, 60), (460, 240), (580, 100), (700, 20), (760, 200), None]
    befund = _mit_karten(monkeypatch, springend)
    assert befund["mit_text"] == 7
    assert not befund["ortsfest"]
    assert befund["haeufig"] and befund["einblendung"]


# ── Gesichter (Punkt 23) ─────────────────────────────────────────────

def _mit_gesichtern(monkeypatch, werte_je_bild: list[list[float]]):
    reihe = iter(werte_je_bild)

    def falsch(feld, *, schwelle):
        # Wie YuNet: nur Funde ueber der gereichten Schwelle kommen zurueck.
        return [{"x": 200.0, "y": 200.0, "w": 90.0, "h": 128.0, "wert": w} for w in next(reihe) if w >= schwelle]

    monkeypatch.setattr(bild, "gesichter_im_bild", falsch)
    return bild.gesichter(Path("egal.mp4"), bilder=np.zeros((len(werte_je_bild), 960, 540, 3), dtype=np.uint8))


def test_ein_klares_gesicht_ist_eine_person_im_bild(monkeypatch):
    befund = _mit_gesichtern(monkeypatch, [[0.9], [], [0.82], []])
    assert befund["personen_im_bild"] and befund["mit_gesicht"] == 2
    # 128 von 640 Bildpunkten Hoehe — das Hochformatbild fuellt das Quadrat ganz.
    assert befund["groesstes_anteil"] == 0.2


def test_ein_unsicherer_fund_ist_nur_moeglich(monkeypatch):
    # Der runde Aufsatz einer Massagepistole bekam 0,66 — unscharfe, aber echte
    # Gesichter 0,52 bis 0,65. Eine einzige Grenze muesste eins von beiden
    # falsch machen; deshalb "moeglich, bitte ansehen" statt "Person im Bild".
    befund = _mit_gesichtern(monkeypatch, [[0.66], [], [0.55], []])
    assert not befund["personen_im_bild"]
    assert befund["personen_moeglich"] and befund["unsicher"] == 2

    # Gegenprobe: Unter der unteren Grenze ist es nichts — sonst stuende an
    # jedem zweiten Clip "Person moeglich" und niemand laese es mehr.
    nichts = _mit_gesichtern(monkeypatch, [[0.45], [0.3], [], []])
    assert not nichts["personen_im_bild"] and not nichts["personen_moeglich"]


# ── Keine Bildspur ───────────────────────────────────────────────────

@hat_ffmpeg
def test_eine_tondatei_im_mp4_kleid_wird_als_solche_gemeldet(tmp_path, monkeypatch):
    # So lagen zwei TikTok-Fotobeitraege im Vorrat: Endung .mp4, Inhalt nur Musik.
    nur_ton = tmp_path / "fotobeitrag.mp4"
    common.lauf(["-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "aac", str(nur_ton)])
    befund = bild.pruefe(nur_ton, 10)
    assert befund["ok"] is False and befund["keine_bildspur"] is True

    # Gegenprobe: Ein echtes Video bekommt den Befund NICHT (die Modelle sind
    # hier ersetzt — es geht um die Weiche, nicht um die Erkennung).
    monkeypatch.setattr(bild, "gesichter", lambda video, bilder=None: {"ok": True})
    monkeypatch.setattr(bild, "fremdtext", lambda video, bilder=None: {"ok": True})
    monkeypatch.setattr(bild, "produkt_aehnlichkeit", lambda video, pid, bilder=None: {"ok": True})
    echt = bild.pruefe(_farbvideo(tmp_path / "video.mp4"), 10)
    assert echt["ok"] is True and "keine_bildspur" not in echt


# ── Punkt 35: die ersten Sekunden ────────────────────────────────────

def test_abgeschaltet_heisst_nicht_verfuegbar(monkeypatch):
    monkeypatch.setenv("MARKETING_BILD", "aus")
    ok, grund = bild.verfuegbar()
    assert not ok and "MARKETING_BILD" in grund


def test_ohne_modell_wird_nichts_geladen(monkeypatch):
    # Der Kern von verfuegbar(): Fehlt die Modelldatei, heisst es NEIN — und
    # nicht "dann holen wir sie eben". Ein Rendern darf nie nebenbei 89 MB laden.
    import huggingface_hub

    monkeypatch.setenv("MARKETING_BILD", "an")
    monkeypatch.setattr(huggingface_hub, "try_to_load_from_cache", lambda repo, datei: None)
    geladen = []
    monkeypatch.setattr(huggingface_hub, "hf_hub_download", lambda *a, **k: geladen.append(a))
    ok, grund = bild.verfuegbar()
    assert not ok and "nicht geladen" in grund
    assert geladen == []


@hat_ffmpeg
def test_gemessen_werden_genau_die_ersten_drei_sekunden(tmp_path, monkeypatch):
    teile = [_farbvideo(tmp_path / f"segment_{i}.mp4", sekunden=2.0) for i in range(3)]
    monkeypatch.setattr(bild, "foto_richtungen", lambda pid: np.ones((1, 512), dtype=np.float32))
    gesehen = []

    def falsch(bilder, richtungen):
        gesehen.append(len(bilder))
        return [0.60] * len(bilder) if len(gesehen) == 1 else [0.70] * len(bilder)

    monkeypatch.setattr(bild, "aehnlichkeit_je_bild", falsch)
    befund = bild.fruehe_sichtbarkeit(teile, 10, sekunden=3.0, schwelle=0.655)
    # 2 s aus dem ersten Segment (vier Bilder), 1 s aus dem zweiten (zwei) —
    # das dritte beginnt bei Sekunde vier und wird nicht angefasst.
    assert gesehen == [4, 2]
    assert befund["sekunden"] == 3.0 and befund["bilder"] == 6
    assert befund["max"] == 0.70 and befund["sichtbar"] is True

    # GEGENPROBE: Taucht das Produkt erst im DRITTEN Segment auf, hilft das
    # dem Anfang nichts.
    gesehen.clear()
    monkeypatch.setattr(bild, "aehnlichkeit_je_bild", lambda bilder, richtungen: [0.60] * len(bilder))
    spaet = bild.fruehe_sichtbarkeit(teile, 10, sekunden=3.0, schwelle=0.655)
    assert spaet["sichtbar"] is False and spaet["max"] == 0.60


def _liste(tmp_path: Path, video: Path) -> Path:
    pfad = tmp_path / "fassung.json"
    pfad.write_text(json.dumps({
        "produkt_id": 10, "endkarte": False, "takt": False,
        "segmente": [{"quelle": str(video), "von": 0, "bis": 2}, {"quelle": str(video), "von": 2, "bis": 4}],
    }), encoding="utf-8")
    return pfad


def _freigeben(monkeypatch, tmp_path):
    """Rechte und Musik beiseite — hier geht es nur um den Hinweis."""
    musik = tmp_path / "bett.m4a"
    common.lauf(["-f", "lavfi", "-i", "sine=frequency=220:duration=10", "-c:a", "aac", str(musik)])
    monkeypatch.setattr(sc, "ungeklaerte_rechte", lambda liste: [])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: musik)


@hat_ffmpeg
@pytest.mark.parametrize("wert, erwartet", [(0.58, True), (0.72, False)],
                         ids=["produkt-fehlt", "gegenprobe-produkt-da"])
def test_der_bauversuch_sagt_wenn_das_produkt_am_anfang_fehlt(tmp_path, monkeypatch, wert, erwartet):
    _freigeben(monkeypatch, tmp_path)
    monkeypatch.setattr(bild, "verfuegbar", lambda modelle=("clip",): (True, ""))
    monkeypatch.setattr(bild, "foto_richtungen", lambda pid: np.ones((1, 512), dtype=np.float32))
    monkeypatch.setattr(bild, "aehnlichkeit_je_bild", lambda bilder, richtungen: [wert] * len(bilder))
    bericht = sc.trockenpruefung(_liste(tmp_path, _farbvideo(tmp_path / "clip.mp4", sekunden=5)), bauversuch=True)
    assert bericht["ok"], bericht["fehler"]
    frueh = bericht["bauversuch"]["produkt_frueh"]
    assert frueh["geprueft"] is True and frueh["sichtbar"] is (not erwartet)
    hinweise = [h for h in bericht["hinweise"] if "kaum zu sehen" in h]
    assert bool(hinweise) is erwartet
    # EIN HINWEIS, KEINE SPERRE: Die Pruefung uebersieht nachweislich die
    # Haelfte und darf deshalb nie ein Rendern verhindern.
    assert bericht["ok"] is True


@hat_ffmpeg
def test_ohne_modell_steht_nicht_geprueft_im_bericht(tmp_path, monkeypatch):
    # "Kein Hinweis" und "nicht nachgesehen" duerfen nicht gleich aussehen.
    _freigeben(monkeypatch, tmp_path)
    monkeypatch.setenv("MARKETING_BILD", "aus")
    pfad = _liste(tmp_path, _farbvideo(tmp_path / "clip.mp4", sekunden=5))
    bericht = sc.trockenpruefung(pfad, bauversuch=True)
    frueh = bericht["bauversuch"]["produkt_frueh"]
    assert frueh["geprueft"] is False and "MARKETING_BILD" in frueh["grund"]
    assert not [h for h in bericht["hinweise"] if "kaum zu sehen" in h]

    from pipelines.products import Produkt
    produkt = Produkt(id=10, name="Wasserspender", slug="w", preis=24.99, kategorie="Haushalt",
                      beschreibung="", sku=None, auf_lager=True, lieferzeit=None, bild=None)
    _, render = sc.rendere(sc.lies(pfad), produkt, tmp_path / "fertig.mp4", arbeitsordner=tmp_path / "arbeit")
    assert render["produkt_frueh"]["geprueft"] is False


def test_die_pruefung_laesst_sich_in_der_konfiguration_abschalten(monkeypatch):
    echt = sc.guardrails.wert
    monkeypatch.setattr(sc.guardrails, "wert",
                        lambda pfad, standard=None: False if pfad == "video.produkt_sichtbar_pruefen" else echt(pfad, standard))
    befund = sc._produkt_frueh([], 10)
    assert befund == {"geprueft": False, "grund": "abgeschaltet (video.produkt_sichtbar_pruefen)"}


# ── Mit den echten Modellen ──────────────────────────────────────────

@pytest.fixture
def modelle_an(monkeypatch):
    monkeypatch.setenv("MARKETING_BILD", "an")


@hat_ffmpeg
@braucht_modelle
def test_das_eigene_produktfoto_liegt_weit_ueber_einem_leeren_bild(tmp_path, modelle_an):
    fotos = bild.produktfotos(10)
    if not fotos:
        pytest.skip("keine Produktfotos zu Produkt 10")
    aus_foto = tmp_path / "aus_foto.mp4"
    common.lauf(["-loop", "1", "-i", str(fotos[0]), "-t", "3", "-r", "30",
                 "-vf", "scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2:white",
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", str(aus_foto)])
    da = bild.produkt_aehnlichkeit(aus_foto, 10, anzahl=4)
    assert da["ok"] and da["mittel"] >= 0.9, da

    # GEGENPROBE: Ein Bild ohne jedes Geraet muss deutlich darunter liegen —
    # sonst misst der Wert nichts.
    leer = bild.produkt_aehnlichkeit(_farbvideo(tmp_path / "leer.mp4"), 10, anzahl=4)
    assert leer["ok"] and da["mittel"] - leer["mittel"] > 0.2, (da, leer)

    # WAS DIESE PRUEFUNG BEWUSST NICHT BEHAUPTET: dass das leere Bild unter
    # der Schwelle 0,63 liegt. Es liegt DARUEBER (gemessen 0,67; weiss 0,72,
    # Rauschen 0,70). Genau so stand die Zusicherung hier zuerst, und sie fiel
    # durch. Der Wert trennt echte Aufnahmen voneinander — eine Grafik, ein
    # Schwarzbild oder eine leere Flaeche erkennt er nicht. Deshalb sortiert
    # nichts im Bot nach diesem Wert von selbst aus.


@hat_ffmpeg
@braucht_modelle
def test_eine_stehende_zeile_wird_gefunden_ein_leeres_bild_nicht(tmp_path, modelle_an):
    schrift = Path("C:/Windows/Fonts/arialbd.ttf")
    if not schrift.exists():
        pytest.skip("keine Schriftdatei fuer die Testzeile")
    zeile = ("drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='JETZT IM ANGEBOT':"
             "fontcolor=white:fontsize=44:x=(w-text_w)/2:y={y}")
    mitte = bild.fremdtext(_farbvideo(tmp_path / "mitte.mp4", zusatz=zeile.format(y=460)))
    assert mitte["ortsfest"] and mitte["einblendung"] and mitte["lage"] == "mitte", mitte

    oben = bild.fremdtext(_farbvideo(tmp_path / "oben.mp4", zusatz=zeile.format(y=40)))
    assert oben["ortsfest"] and oben["lage"] == "rand", oben

    # Gegenprobe: dasselbe Bild ohne Zeile.
    leer = bild.fremdtext(_farbvideo(tmp_path / "leer.mp4"))
    assert leer["mit_text"] == 0 and not leer["einblendung"], leer


@hat_ffmpeg
@braucht_modelle
def test_ein_bild_ohne_gesicht_meldet_keins(tmp_path, modelle_an):
    # Nur die eine Richtung — siehe Kopf der Datei, warum ein echtes Gesicht fehlt.
    befund = bild.gesichter(_farbvideo(tmp_path / "leer.mp4"), anzahl=4)
    assert befund["ok"] and not befund["personen_im_bild"] and not befund["personen_moeglich"], befund
