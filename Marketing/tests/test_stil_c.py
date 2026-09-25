"""Tests fuer Stil C (Schnittliste) — vor allem fuer die Lizenzsperre.

DER PFLICHTTEST IST test_ungeklaerte_rechte_sperren_das_rendern.

Warum das der wichtigste Test dieser Etappe ist: Stil C verarbeitet genau das
Material, bei dem die Rechtefrage offen ist — fremde TikTok-Clips, die im
Bot-Index auf `rechte_geprueft: false` stehen. Der erste fertige Clip dieses
Projekts ist an allen Kontrollen vorbei entstanden, weil er in einem
ffmpeg-Aufruf neben dem Automaten gebaut wurde.

Genau das darf Stil C nicht wieder ermoeglichen. Er ist der bequeme Weg zum
fertigen Video — und deshalb muss er der Weg sein, der die Rechte PRUEFT.
Ein Video auf TikTok kann man nicht nachtraeglich kurz zurueckholen.

Die uebrigen Tests sichern die Stellen, an denen eine Schnittliste LAUTLOS
falsch wird: ein Segment hinter dem Dateiende liefert bei ffmpeg ein leeres
Ergebnis ohne Fehlermeldung, und ein stummes Video faellt erst in der
Ausgangspruefung auf — nach dem Rendern.

Projektregel aus CLAUDE.md Paragraph 2: Ein Test, der nur gruen werden kann,
ist wertlos. Zu jeder Pruefung steht darum eine Gegenprobe daneben, die das
alte bzw. falsche Verhalten nachbildet.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipelines.video import common, quality_gate, style_c_schnittliste as sc

hat_ffmpeg = pytest.mark.skipif(
    not common.verfuegbar()[0], reason=f"kein ffmpeg — {common.verfuegbar()[1]}"
)


# ── Hilfen ───────────────────────────────────────────────────────────

def _testvideo(ziel: Path, *, dauer: float = 6.0) -> Path:
    """Ein echtes kleines Video erzeugen — kein Nachbau.

    Nachbauten muessen luegenfrei sein (conftest.py). Ein Dummy mit
    beliebigen Bytes wuerde die Zeitpruefung gegen die echte Dateilaenge
    unwirksam machen, und genau die soll hier geprueft werden.
    """
    ziel.parent.mkdir(parents=True, exist_ok=True)
    common.lauf([
        "-f", "lavfi", "-i", f"testsrc=size=640x480:rate=30:duration={dauer}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel),
    ])
    return ziel


def _liste_schreiben(ordner: Path, segmente: list[dict], **kopf) -> Path:
    inhalt = {"produkt_id": 10, "segmente": segmente}
    inhalt.update(kopf)
    pfad = ordner / "fassung.json"
    pfad.write_text(json.dumps(inhalt, ensure_ascii=False, indent=2), encoding="utf-8")
    return pfad


# ── Die Lizenzsperre ─────────────────────────────────────────────────

@hat_ffmpeg
def test_ungeklaerte_rechte_sperren_das_rendern(tmp_path, monkeypatch):
    """DER PFLICHTTEST: Ohne Lizenznachweis wird nicht gerendert."""
    video = _testvideo(tmp_path / "10_730.mp4")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 5}])

    # Kein Lizenzeintrag — der Normalfall fuer frisches Bot-Material.
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: False)

    liste = sc.lies(pfad)
    assert sc.ungeklaerte_rechte(liste) == [video]

    with pytest.raises(RuntimeError) as fehler:
        sc.rendere(liste, _produkt(), tmp_path / "raus.mp4")
    assert "ohne Lizenznachweis" in str(fehler.value)
    assert not (tmp_path / "raus.mp4").exists(), "es darf keine Datei entstehen"


@hat_ffmpeg
def test_gegenprobe_ohne_sperre_entstuende_ein_video(tmp_path, monkeypatch):
    """Gegenprobe: Mit Lizenz laeuft derselbe Aufruf durch.

    Das belegt, dass die Sperre oben wirklich an der Lizenz haengt und nicht
    daran, dass der Aufruf ohnehin scheitert — sonst waere der Pflichttest
    gruen, ohne irgendetwas zu beweisen.
    """
    video = _testvideo(tmp_path / "10_731.mp4")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 5}])

    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))

    liste = sc.lies(pfad)
    assert sc.ungeklaerte_rechte(liste) == []
    ziel, bericht = sc.rendere(liste, _produkt(), tmp_path / "fertig.mp4")
    assert ziel.exists() and ziel.stat().st_size > 0
    assert bericht["stil"] == "C"


def test_jede_quelle_wird_einzeln_geprueft(tmp_path, monkeypatch):
    """Ein lizenziertes Segment rechtfertigt die anderen nicht."""
    a = tmp_path / "eigen.mp4"
    b = tmp_path / "fremd.mp4"
    for p in (a, b):
        p.write_bytes(b"x")

    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: Path(p).name == "eigen.mp4")
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)

    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(a), "von": 0, "bis": 2},
        {"quelle": str(b), "von": 0, "bis": 2},
    ])
    liste = sc.lies(pfad)
    offen = sc.ungeklaerte_rechte(liste)
    assert [p.name for p in offen] == ["fremd.mp4"]


# ── Die Liste lesen ──────────────────────────────────────────────────

def test_kaputte_liste_nennt_das_segment(tmp_path, monkeypatch):
    """Eine Fehlermeldung ohne Segmentnummer ist bei 20 Segmenten keine Hilfe."""
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    datei = tmp_path / "clip.mp4"
    datei.write_bytes(b"x")

    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(datei), "von": 0, "bis": 2},
        {"quelle": str(datei), "von": 5, "bis": 3},     # bis vor von
    ])
    with pytest.raises(sc.SchnittlisteFehler) as fehler:
        sc.lies(pfad)
    assert "Segment 2" in str(fehler.value)


def test_fehlende_datei_wird_beim_lesen_gemeldet(tmp_path):
    """Nicht erst beim Rendern — da laeuft ffmpeg schon."""
    pfad = _liste_schreiben(tmp_path, [{"quelle": "gibt-es-nicht.mp4"}])
    with pytest.raises(sc.SchnittlisteFehler) as fehler:
        sc.lies(pfad)
    assert "nicht gefunden" in str(fehler.value)


@hat_ffmpeg
def test_segment_hinter_dem_dateiende_wird_abgewiesen(tmp_path):
    """Der lautlose Fall: ffmpeg liefert dann ein LEERES Ergebnis.

    Ohne diese Pruefung waere das Video still kuerzer als geplant — kein
    Fehler, keine Meldung, nur ein Clip, der zu frueh aufhoert.
    """
    video = _testvideo(tmp_path / "kurz.mp4", dauer=4.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 9.0, "bis": 11.0}])
    with pytest.raises(sc.SchnittlisteFehler) as fehler:
        sc.lies(pfad)
    assert "hinter dem Ende" in str(fehler.value)


@hat_ffmpeg
def test_zu_langes_bis_wird_gekuerzt_und_gemeldet(tmp_path):
    """Kuerzen statt abbrechen — aber sichtbar, nicht stillschweigend."""
    video = _testvideo(tmp_path / "kurz.mp4", dauer=4.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 1.0, "bis": 9.0}])
    liste = sc.lies(pfad)
    assert liste.warnungen, "eine Kuerzung muss gemeldet werden"
    assert liste.segmente[0].bis == pytest.approx(4.0, abs=0.2)


@hat_ffmpeg
def test_ohne_bis_laeuft_das_segment_bis_zum_ende(tmp_path):
    """Wer nichts angibt, bekommt den ganzen Clip — geraten wird nichts."""
    video = _testvideo(tmp_path / "ganz.mp4", dauer=5.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 1.0}])
    liste = sc.lies(pfad)
    assert liste.segmente[0].dauer == pytest.approx(4.0, abs=0.3)


def test_gesamtdauer_unter_der_mindestdauer_wird_gewarnt(tmp_path, monkeypatch):
    """Sonst faellt es erst in der Ausgangspruefung auf — nach dem Rendern."""
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    datei = tmp_path / "clip.mp4"
    datei.write_bytes(b"x")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(datei), "von": 0, "bis": 2}])
    liste = sc.lies(pfad)
    assert any("Mindestdauer" in w for w in liste.warnungen)


# ── Der Ton ──────────────────────────────────────────────────────────

@hat_ffmpeg
def test_fremder_originalton_faellt_weg(tmp_path, monkeypatch):
    """Der Originalton fremder Clips ist die sichere Einstellung wert.

    Er bringt zwei Probleme mit: die Stimme eines fremden Creators und
    haeufig lizenzierte Musik, die nur in der TikTok-App erlaubt ist. Wer
    nichts tut, veroeffentlicht beides mit — deshalb gehoert das Weglassen
    in den Standardweg, nicht in eine Option.
    """
    video = _testvideo(tmp_path / "mit-ton.mp4")
    ziel = tmp_path / "segment.mp4"
    sc._segment_bauen(sc.Segment(quelle=video, von=0, bis=2), ziel)
    info = common.medien_info(ziel)
    assert info is not None
    assert not info.hat_ton, "der Originalton darf nicht mitwandern"


@hat_ffmpeg
def test_ohne_musik_wird_abgebrochen_statt_stumm_zu_rendern(tmp_path, monkeypatch):
    """Ein stummes Video ist kein fertiges Video (quality_gate)."""
    video = _testvideo(tmp_path / "10_732.mp4")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 5}])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: None)

    liste = sc.lies(pfad)
    with pytest.raises(RuntimeError) as fehler:
        sc.rendere(liste, _produkt(), tmp_path / "raus.mp4")
    assert "Ausgangspruefung" in str(fehler.value) or "Musik" in str(fehler.value)


# ── Die Musiksperre ──────────────────────────────────────────────────
#
# Bis zum 18.09. gab es hier keine Sperre: Ein Musikstueck ohne Nachweis
# erzeugte nur bericht["musik_ohne_nachweis"] = True, und das Rendern lief
# weiter. Damit galt die haertere Regel fuer das kleinere Risiko — Musik ist
# die haeufigste Ursache einer Urheberrechtsmeldung auf TikTok.

@hat_ffmpeg
def test_musik_ohne_nachweis_sperrt_das_rendern(tmp_path, monkeypatch):
    """Ein Stueck ohne Lizenzeintrag darf kein Video erzeugen."""
    video = _testvideo(tmp_path / "10_733.mp4")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 5}])
    # Die Quellclips sind geklaert — geprueft wird allein die Musik. So
    # herum patchen, wie es der echte Weg tut: hat_lizenz() entscheidet,
    # musik_ohne_nachweis() liefert den Grund.
    monkeypatch.setattr(sc.assets, "hat_lizenz",
                        lambda p: Path(p).suffix.lower() not in (".m4a", ".mp3"))
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    monkeypatch.setattr(sc.assets, "musik_ohne_nachweis",
                        lambda p: "kein Eintrag in lizenzen.json")

    liste = sc.lies(pfad)
    ziel = tmp_path / "raus.mp4"
    with pytest.raises(RuntimeError) as fehler:
        sc.rendere(liste, _produkt(), ziel)

    text = str(fehler.value)
    assert "bett.m4a" in text, "die Meldung muss sagen, WELCHES Stueck"
    assert "lizenzen.json" in text, "die Meldung muss sagen, WO es einzutragen ist"
    assert not ziel.exists(), "es darf keine Datei entstanden sein"


@hat_ffmpeg
def test_gegenprobe_mit_nachweis_entsteht_ein_video(tmp_path, monkeypatch):
    """Gegenprobe: Mit Nachweis laeuft derselbe Aufruf durch.

    Ohne diese Haelfte waere der Test oben wertlos — er wuerde auch gruen,
    wenn das Rendern aus einem ganz anderen Grund scheitert.
    """
    video = _testvideo(tmp_path / "10_733.mp4")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 5}])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))

    liste = sc.lies(pfad)
    ziel = tmp_path / "raus.mp4"
    _, bericht = sc.rendere(liste, _produkt(), ziel)
    assert ziel.exists() and ziel.stat().st_size > 10_000
    assert bericht["musik"] == "bett.m4a"


def test_register_sperrt_ungeklaerte_herkunft(tmp_path, monkeypatch):
    """Ein Eintrag mit lizenz: null ist eine Sperre, kein Freibrief.

    Die drei bett_*.mp3 stehen genau so im Register: Sie liegen im Ordner,
    aber niemand weiss, woher sie kommen. Ein Eintrag ohne Lizenz muss
    deshalb schaerfer wirken als gar kein Eintrag — sonst waere Nachtragen
    ein Weg, eine Sperre zu umgehen.
    """
    from pipelines.video import assets

    register = tmp_path / "lizenzen.json"
    register.write_text(json.dumps({"stuecke": {
        "gut.mp3":     {"quelle": "eigen", "lizenz": "eigen", "gewerblich_erlaubt": True},
        "ungeklaert.mp3": {"quelle": "unbekannt", "lizenz": None,
                           "gewerblich_erlaubt": False, "notiz": "Herkunft nicht dokumentiert"},
        "privat.mp3":  {"quelle": "irgendwo", "lizenz": "nur privat",
                        "gewerblich_erlaubt": False},
    }}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(assets, "MUSIK_REGISTER", register)
    monkeypatch.setattr(assets, "MUSIK", tmp_path)
    monkeypatch.setattr(assets, "_musikregister_zwischenspeicher", None)
    monkeypatch.setattr(assets.db, "verfuegbar", lambda: False)

    assert assets.musik_ohne_nachweis(tmp_path / "gut.mp3") is None
    ungeklaert = assets.musik_ohne_nachweis(tmp_path / "ungeklaert.mp3")
    assert ungeklaert and "ungeklaert" in ungeklaert.lower()
    assert "nicht dokumentiert" in ungeklaert, "der Grund aus dem Register muss mitkommen"
    privat = assets.musik_ohne_nachweis(tmp_path / "privat.mp3")
    assert privat and "gewerblich" in privat
    fehlt = assets.musik_ohne_nachweis(tmp_path / "gar-nicht-drin.mp3")
    assert fehlt and "lizenzen.json" in fehlt


def test_kaputtes_register_sperrt_alles(tmp_path, monkeypatch):
    """Eine unlesbare Registerdatei darf nie "dann eben alles erlaubt" heissen.

    Das ist die Richtung, in die dieser Fehler fallen muss. Andersherum
    waere ein Tippfehler in einer JSON-Datei ein stiller Freibrief fuer
    jedes Stueck im Ordner.
    """
    from pipelines.video import assets

    register = tmp_path / "lizenzen.json"
    register.write_text('{"stuecke": {"gut.mp3": ', encoding="utf-8")   # abgeschnitten
    monkeypatch.setattr(assets, "MUSIK_REGISTER", register)
    monkeypatch.setattr(assets, "MUSIK", tmp_path)
    monkeypatch.setattr(assets, "_musikregister_zwischenspeicher", None)
    monkeypatch.setattr(assets.db, "verfuegbar", lambda: False)

    assert assets.musik_ohne_nachweis(tmp_path / "gut.mp3") is not None


def test_musik_laeuft_ueber_dieselbe_tuer_wie_die_clips(tmp_path, monkeypatch):
    """hat_lizenz() muss fuer Musik das Register befragen, nicht mkt_assets.

    Sonst haengt die Sperre wieder an einer Datenbank, die es beim lokalen
    Lauf nicht gibt — und ein Schutz, der die Kette lokal stilllegt, wird
    abgeschaltet.
    """
    from pipelines.video import assets

    register = tmp_path / "lizenzen.json"
    register.write_text(json.dumps({"stuecke": {
        "gut.mp3": {"quelle": "eigen", "lizenz": "eigen", "gewerblich_erlaubt": True},
    }}), encoding="utf-8")
    monkeypatch.setattr(assets, "MUSIK_REGISTER", register)
    monkeypatch.setattr(assets, "MUSIK", tmp_path)
    monkeypatch.setattr(assets, "_musikregister_zwischenspeicher", None)
    monkeypatch.setattr(assets.db, "verfuegbar", lambda: False)

    assert assets.hat_lizenz(tmp_path / "gut.mp3") is True
    assert assets.hat_lizenz(tmp_path / "fremd.mp3") is False
    # Ein Videoclip im selben Ordner geht weiter den alten Weg und ist
    # ohne Datenbank NICHT freigegeben.
    assert assets.hat_lizenz(tmp_path / "clip.mp4") is False


# ── Eigenes Material ─────────────────────────────────────────────────
#
# Die Lizenzsperre ist fuer FREMDES Material gebaut. Fuer einen Clip, den
# jemand selbst aufgenommen hat, ist die Rechtefrage erledigt, bevor sie
# gestellt wird — nur hatte er bis zum 18.09. keinen Weg durch die Kette:
# _ist_eigenes() kannte nur "produkt bilder/" und "produkt videos/", also
# rendere Stil C ohne Datenbank auch aus rein eigenem Material nichts.

def test_eigenes_material_kommt_ohne_datenbank_durch(tmp_path, monkeypatch):
    """Ohne DATABASE_URL — dem Normalfall beim lokalen Lauf — muss eigenes
    Material trotzdem verwendbar sein. Sonst ist die Sperre keine Sperre,
    sondern ein Stillstand."""
    from pipelines.video import assets

    eigen = tmp_path / "eigenes"
    eigen.mkdir()
    datei = eigen / "wasserspender_detail.mp4"
    datei.write_bytes(b"x")
    monkeypatch.setattr(assets, "EIGENES_ROHMATERIAL", eigen)
    monkeypatch.setattr(assets.db, "verfuegbar", lambda: False)

    assert assets.hat_lizenz(datei) is True


def test_geschnittene_clips_gelten_nicht_als_eigen(tmp_path, monkeypatch):
    """DER WICHTIGE TEST DIESER ETAPPE.

    "Eigener Schnitt" ist nicht "eigenes Material". Die sieben fertigen
    Wasserspender-Clips in videos/geschnitten/ sind aus 23 FREMDEN
    TikTok-Videos entstanden; ein Schnitt erbt die Rechte seiner Quellen.
    Wuerde der Ordner als eigen gelten, waere fremdes Material mit einem
    Ordnerwechsel weissgewaschen — und die ganze Lizenzsperre eine Zeile
    Aufwand zu umgehen.
    """
    from pipelines.video import assets

    eigen = tmp_path / "eigenes"
    eigen.mkdir()
    geschnitten = tmp_path / "geschnitten"
    geschnitten.mkdir()
    fertig = geschnitten / "maios_wasserspender_ad_v4.mp4"
    fertig.write_bytes(b"x")
    monkeypatch.setattr(assets, "EIGENES_ROHMATERIAL", eigen)
    monkeypatch.setattr(assets.db, "verfuegbar", lambda: False)

    assert assets.hat_lizenz(fertig) is False


def test_eigenes_material_gilt_mit_und_ohne_datenbank(tmp_path, monkeypatch):
    """Dieselbe Datei darf nicht zwei Antworten bekommen.

    Vorher haing die Antwort daran, ob gerade eine Datenbank erreichbar war:
    ohne DATABASE_URL galt eigenes Material als frei, MIT Datenbank fiel es
    durch, weil es nicht in mkt_assets stand. Die strengere Antwort kam
    ausgerechnet dort, wo produktiv gerendert wird.
    """
    from pipelines.video import assets

    eigen = tmp_path / "eigenes"
    eigen.mkdir()
    datei = eigen / "mixer_detail.mp4"
    datei.write_bytes(b"x")
    monkeypatch.setattr(assets, "EIGENES_ROHMATERIAL", eigen)
    # Datenbank da, aber die Datei steht (noch) nicht im Katalog.
    monkeypatch.setattr(assets.db, "verfuegbar", lambda: True)
    monkeypatch.setattr(assets.db, "eine_zeile", lambda *a, **k: None)
    nachgetragen = []
    monkeypatch.setattr(assets, "registriere",
                        lambda asset: nachgetragen.append(asset) or True)

    assert assets.hat_lizenz(datei) is True
    assert len(nachgetragen) == 1, "eigenes Material muss in den Katalog nachwandern"
    assert nachgetragen[0].quelle == "eigen"
    assert nachgetragen[0].typ == "video"


def test_eigener_ordner_gewinnt_bei_namensgleichheit(tmp_path, monkeypatch):
    """Zweimal derselbe Dateiname: Der eigene Clip muss gewinnen.

    Sonst entscheidet der Zufall der Suchreihenfolge darueber, ob ein
    Beitrag aus eigenem oder fremdem Material besteht.
    """
    eigen = tmp_path / "eigenes"
    fremd = tmp_path / "rohmaterial" / "10_wasserspender"
    eigen.mkdir(parents=True)
    fremd.mkdir(parents=True)
    (eigen / "clip.mp4").write_bytes(b"eigen")
    (fremd / "clip.mp4").write_bytes(b"fremd")
    monkeypatch.setattr(sc, "SUCHORTE", (eigen, tmp_path / "rohmaterial"))

    treffer = sc._finde_quelle("clip.mp4")
    assert treffer is not None
    assert treffer.read_bytes() == b"eigen"


def test_die_echte_suchreihenfolge_setzt_eigenes_nach_vorn():
    """Der Test darueber patcht SUCHORTE — dieser prueft die ECHTE Liste.

    Ohne ihn waere oben nur bewiesen, dass _finde_quelle eine Reihenfolge
    einhaelt, nicht dass die richtige eingestellt ist. Bis zum 18.09. stand
    geschnitten/ vorn, mit der Begruendung "eigenes Material" — und das
    stimmte nicht.
    """
    namen = [ort.name for ort in sc.SUCHORTE]
    assert "eigenes" in namen, "der Ordner fuer selbst Gefilmtes fehlt in SUCHORTE"
    assert namen.index("eigenes") < namen.index("geschnitten"), \
        "selbst Aufgenommenes muss bei Namensgleichheit gewinnen"


# ── Laenge, Blende, Messaufwand ──────────────────────────────────────

@hat_ffmpeg
def test_die_endlaenge_wird_gemessen_nicht_gerechnet(tmp_path, monkeypatch):
    """Die Datei entscheidet, nicht die Absicht.

    Vorher ging die Summe der SOLL-Zeiten aus der Liste als "-t" an ffmpeg.
    Die zusammengesetzte Datei weicht davon um Frames ab: Jedes Segment wird
    auf 30 fps gebracht, beim Zusammensetzen wird auf ganze Bilder gerundet.
    Zu grosszuegig heisst Standbild am Ende, zu knapp heisst abgeschnittener
    letzter Schnitt — und die Ausgangspruefung schlaegt erst ab drei Sekunden
    Abweichung an.
    """
    video = _testvideo(tmp_path / "10_740.mp4", dauer=8.0)
    # Schnittpunkte bewusst NICHT auf ganzen Frames (30 fps -> 1/30 s).
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0.017, "bis": 3.013},
        {"quelle": str(video), "von": 3.041, "bis": 6.007},
    ])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))

    liste = sc.lies(pfad)
    ziel = tmp_path / "fertig.mp4"
    _, bericht = sc.rendere(liste, _produkt(), ziel)

    assert "dauer_gemessen" in bericht, "die gemessene Laenge fehlt im Bericht"
    fertig = common.medien_info(ziel)
    assert fertig is not None
    assert abs(fertig.dauer - bericht["dauer_gemessen"]) < 0.25, (
        f"das fertige Video ist {fertig.dauer:.2f}s lang, gemessen wurden "
        f"{bericht['dauer_gemessen']:.2f}s"
    )


def _mittlere_lautstaerke(datei: Path, von: float, dauer: float) -> float:
    """mean_volume eines Ausschnitts in dB — aus ffmpegs volumedetect."""
    ausgabe = common.lauf([
        "-ss", f"{von:.2f}", "-t", f"{dauer:.2f}", "-i", str(datei),
        "-af", "volumedetect", "-f", "null", "-",
    ])
    for zeile in ausgabe.splitlines():
        if "mean_volume:" in zeile:
            return float(zeile.split("mean_volume:")[1].strip().split()[0])
    raise AssertionError(f"volumedetect hat nichts gemeldet:\n{ausgabe[-400:]}")


@hat_ffmpeg
def test_die_musik_blendet_aus_statt_abzureissen(tmp_path, monkeypatch):
    """Ein abgerissener Ton ist der letzte Eindruck, den der Zuschauer mitnimmt.

    Stil A und B blenden laengst aus (common.ton_mit_musik). Stil C schnitt
    das Musikbett mit "-t" hart ab — nach ungleicher Lautheit der hoerbarste
    Amateurfehler, und er faellt genau am Ende auf.

    Gemessen wird, nicht behauptet: die letzten 0,4 s gegen die Mitte.
    """
    video = _testvideo(tmp_path / "10_741.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 10}])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))

    liste = sc.lies(pfad)
    ziel = tmp_path / "fertig.mp4"
    sc.rendere(liste, _produkt(), ziel)

    mitte = _mittlere_lautstaerke(ziel, 4.0, 0.4)
    ende = _mittlere_lautstaerke(ziel, 9.6, 0.4)
    assert ende < mitte - 6.0, (
        f"das Ende ({ende:.1f} dB) ist nicht merklich leiser als die Mitte "
        f"({mitte:.1f} dB) — die Ausblendung fehlt"
    )


def test_segmentdauer_wird_nur_einmal_gemessen(tmp_path, monkeypatch):
    """gesamtdauer wird mehrfach gelesen — ffprobe darf nicht mitlaufen.

    Ohne "bis" rief die Eigenschaft bei JEDEM Zugriff medien_info() auf, und
    das ist ein eigener Prozessstart. Bei zwanzig Segmenten ohne "bis" waren
    das ueber sechzig Starts fuer eine Zahl, die sich waehrend eines Laufs
    nicht aendert.
    """
    aufrufe = []

    class Info:
        dauer = 9.0

    monkeypatch.setattr(sc.common, "medien_info",
                        lambda p: aufrufe.append(p) or Info())
    datei = tmp_path / "clip.mp4"
    datei.write_bytes(b"x")
    segment = sc.Segment(quelle=datei, von=1.0, bis=None)

    werte = [segment.dauer for _ in range(5)]

    assert werte == [8.0] * 5
    assert len(aufrufe) == 1, f"ffprobe lief {len(aufrufe)}-mal statt einmal"


# ── Text in der Schnittliste ─────────────────────────────────────────

def test_fehlender_text_wird_beim_lesen_gemeldet(tmp_path, monkeypatch):
    """Ohne Hook und Hashtags geht ein Beitrag mit dem schwaechsten Text raus.

    Abgebrochen wird trotzdem nicht: Ein Video, das gar nicht entsteht, sieht
    niemand — und was niemand sieht, bessert niemand nach. Die Warnung faellt
    hier, der Beitrag faellt in der Freigabeliste auf.
    """
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    datei = tmp_path / "clip.mp4"
    datei.write_bytes(b"x")
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(datei), "von": 0, "bis": 9}])

    liste = sc.lies(pfad)
    zusammen = " ".join(liste.warnungen)
    assert "hook" in zusammen
    assert "hashtags" in zusammen
    assert liste.hook is None and liste.hashtags == []


def test_gegenprobe_mit_text_gibt_es_keine_warnung(tmp_path, monkeypatch):
    """GEGENPROBE: Mit Hook und Hashtags schweigt dieselbe Pruefung."""
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    datei = tmp_path / "clip.mp4"
    datei.write_bytes(b"x")
    pfad = _liste_schreiben(
        tmp_path, [{"quelle": str(datei), "von": 0, "bis": 9}],
        hook="Nie wieder Flaschen schleppen",
        hashtags=["wasserspender", "#kueche"],
    )

    liste = sc.lies(pfad)
    zusammen = " ".join(liste.warnungen)
    assert "hook" not in zusammen and "hashtags" not in zusammen
    assert liste.hook == "Nie wieder Flaschen schleppen"
    # Mit und ohne Raute geschrieben — beides kommt als Hashtag an.
    assert liste.hashtags == ["#wasserspender", "#kueche"]


# ── Hook, Endkarte, Nachweis ─────────────────────────────────────────

def _produktfoto(ordner: Path) -> Path:
    """Ein echtes kleines JPEG — kein Dummy mit beliebigen Bytes."""
    ziel = ordner / "produkt.jpg"
    if not ziel.exists():
        common.lauf(["-f", "lavfi", "-i", "color=c=gray:s=1080x1080:d=1",
                     "-frames:v", "1", str(ziel)])
    return ziel


@hat_ffmpeg
def test_endkarte_haengt_hinten_dran(tmp_path, monkeypatch):
    """Ein Werbeclip ohne Preis und Adresse ist ein huebsches Video.

    common.baue_endkarte() lag fertig daneben und wurde von Stil A und B
    benutzt — Stil C hoerte mit dem letzten Schnitt auf.
    """
    from pipelines.video import assets as assets_modul

    video = _testvideo(tmp_path / "10_750.mp4", dauer=8.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 6}])
    foto = _produktfoto(tmp_path)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    monkeypatch.setattr(sc.assets, "eigene_bilder",
                        lambda produkt: [assets_modul.Asset(foto, "bild", "eigen", "eigen")])

    liste = sc.lies(pfad)
    ziel = tmp_path / "mit-endkarte.mp4"
    _, bericht = sc.rendere(liste, _produkt(), ziel)

    assert bericht.get("endkarte") is True
    fertig = common.medien_info(ziel)
    assert fertig is not None
    # 6 s Segment + 2,5 s Endkarte, mit Rundung auf ganze Bilder.
    assert fertig.dauer > 8.0, f"die Endkarte fehlt: nur {fertig.dauer:.2f}s"

    # DIE ERWARTUNG MUSS DIE ENDKARTE MITZAEHLEN.
    #
    # dauer_soll geht als erwartete_dauer an die Ausgangspruefung, und die
    # schlaegt ab drei Sekunden Abweichung an. Ohne die Endkarte im Sollwert
    # verglich sie 10,5 s gegen 13,0 s — 2,5 s daneben und damit nur knapp
    # unter der Grenze. Gefunden hat das ein echter Lauf, nicht das Nachdenken.
    assert abs(bericht["dauer_soll"] - fertig.dauer) < 1.0, (
        f"Soll {bericht['dauer_soll']}s gegen Bild {fertig.dauer:.2f}s — "
        "die Ausgangspruefung wuerde bei etwas mehr Abweichung ablehnen"
    )
    ergebnis = quality_gate.pruefe(ziel, erwartete_dauer=bericht["dauer_soll"])
    assert not any("Laufzeit" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_fehlendes_produktfoto_bricht_stil_c_nicht_ab(tmp_path, monkeypatch):
    """Stil A bricht hier ab — dort IST das Foto das Video.

    Bei Stil C ist es nur das letzte Bild. Ein fertig geschnittener Clip
    wegen eines fehlenden Produktfotos wegzuwerfen, waere die falsche Haerte.
    """
    video = _testvideo(tmp_path / "10_751.mp4", dauer=8.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 6}])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    monkeypatch.setattr(sc.assets, "eigene_bilder", lambda produkt: [])

    liste = sc.lies(pfad)
    ziel = tmp_path / "ohne-endkarte.mp4"
    _, bericht = sc.rendere(liste, _produkt(), ziel)

    assert ziel.exists() and ziel.stat().st_size > 10_000
    assert "endkarte" not in bericht


@hat_ffmpeg
def test_hook_wird_ins_bild_eingeblendet(tmp_path, monkeypatch):
    """In den ersten zwei Sekunden entscheidet sich, ob weitergeschaut wird.

    Der Hook stand bisher nur in der Bildunterschrift — die liest niemand,
    bevor er weiterwischt.
    """
    video = _testvideo(tmp_path / "10_752.mp4", dauer=8.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 6}],
                            hook="Nie wieder Flaschen schleppen")
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    monkeypatch.setattr(sc.assets, "eigene_bilder", lambda produkt: [])

    liste = sc.lies(pfad)
    _, bericht = sc.rendere(liste, _produkt(), tmp_path / "mit-hook.mp4")
    assert bericht.get("hook_eingeblendet") is True
    assert bericht.get("ton_entfernt") is True, \
        "dass der Originalton wegfaellt, muss im Nachweis stehen"


# ── Wiederholbarkeit ─────────────────────────────────────────────────

def _lege_liste(ordner: Path, name: str, text: str = "a") -> Path:
    pfad = ordner / name
    pfad.write_text(json.dumps({
        "produkt_id": 10, "hook": text,
        "segmente": [{"quelle": "clip.mp4", "von": 0, "bis": 9}],
    }), encoding="utf-8")
    return pfad


def test_ohne_datenbank_wird_nicht_zweimal_gerendert(tmp_path, monkeypatch):
    """Der lokale Lauf hat keine DATABASE_URL — und rendert sonst alles neu.

    Hier stand "return alle": Jeder Durchgang ueber run-local.js rendert
    dieselben Listen noch einmal, minutenlang, und ueberschreibt das
    Ergebnis vom letzten Mal.
    """
    listen = tmp_path / "schnittlisten"
    renders = tmp_path / "renders"
    listen.mkdir()
    renders.mkdir()
    monkeypatch.setattr(sc, "SCHNITTLISTEN", listen)
    monkeypatch.setattr(sc.common, "RENDERS", renders)
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: False)

    liste = _lege_liste(listen, "fassung.json")
    assert sc.offene_listen() == [liste], "eine neue Liste muss offen sein"

    # Jetzt liegt ein Ergebnis daneben, juenger als die Liste.
    fertig = renders / "fassung_stil_c.mp4"
    fertig.write_bytes(b"x")
    import os
    os.utime(fertig, (liste.stat().st_mtime + 10, liste.stat().st_mtime + 10))
    assert sc.offene_listen() == [], "ein fertiges Video muss den Lauf sparen"

    # Und nach einer Aenderung ist sie wieder offen.
    os.utime(liste, (fertig.stat().st_mtime + 10, fertig.stat().st_mtime + 10))
    assert sc.offene_listen() == [liste], "eine geaenderte Liste muss neu gerendert werden"


def test_geaenderte_liste_wird_an_der_pruefsumme_erkannt(tmp_path, monkeypatch):
    """Gleicher Name, anderer Inhalt heisst: neue Fassung.

    Erkannt wurde bisher am Dateinamen. Wer eine Fassung korrigierte, musste
    sie umbenennen — und hatte danach zwei Namen fuer eine Fassung.
    """
    listen = tmp_path / "schnittlisten"
    listen.mkdir()
    monkeypatch.setattr(sc, "SCHNITTLISTEN", listen)
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: True)

    liste = _lege_liste(listen, "fassung.json", text="erste Fassung")
    gerendert = [{"schnittliste": "fassung.json", "schnittliste_hash": sc.pruefsumme(liste)}]
    monkeypatch.setattr(sc.db, "abfragen", lambda *a, **k: gerendert)

    assert sc.offene_listen() == [], "unveraenderte Liste: nichts zu tun"

    _lege_liste(listen, "fassung.json", text="zweite Fassung")
    assert sc.offene_listen() == [liste], "geaenderte Liste muss wieder offen sein"


def test_alte_zeilen_ohne_pruefsumme_bleiben_fertig(tmp_path, monkeypatch):
    """Der Umstellungstag darf nicht alles noch einmal rendern.

    Zeilen aus der Zeit vor der Pruefsumme haben NULL. Wuerden die als
    "nicht gerendert" gelten, liefe beim ersten Lauf nach dem Update die
    gesamte Ablage durch — stundenlang, fuer nichts.
    """
    listen = tmp_path / "schnittlisten"
    listen.mkdir()
    monkeypatch.setattr(sc, "SCHNITTLISTEN", listen)
    monkeypatch.setattr(sc.db, "verfuegbar", lambda: True)
    _lege_liste(listen, "alt.json")
    monkeypatch.setattr(sc.db, "abfragen",
                        lambda *a, **k: [{"schnittliste": "alt.json",
                                          "schnittliste_hash": None}])

    assert sc.offene_listen() == []


# ── Der Nachweis ─────────────────────────────────────────────────────

@hat_ffmpeg
def test_bericht_nennt_die_verwendeten_quellen(tmp_path, monkeypatch):
    """Ohne diese Angabe kann der Bandit nie lernen, welches Material laeuft."""
    a = _testvideo(tmp_path / "10_a.mp4")
    b = _testvideo(tmp_path / "10_b.mp4")
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(a), "von": 0, "bis": 3},
        {"quelle": str(b), "von": 0, "bis": 3},
        {"quelle": str(a), "von": 3, "bis": 5},
    ])
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))

    liste = sc.lies(pfad)
    _, bericht = sc.rendere(liste, _produkt(), tmp_path / "fertig.mp4")
    assert bericht["quellen"] == ["10_a.mp4", "10_b.mp4"]
    assert bericht["segmente"] == 3
    assert bericht["schnittliste"] == "fassung.json"


def test_dieselbe_liste_ergibt_dieselbe_planung(tmp_path, monkeypatch):
    """Wiederholbarkeit: Sonst laesst sich eine Fassung nicht vergleichen."""
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    datei = tmp_path / "clip.mp4"
    datei.write_bytes(b"x")
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(datei), "von": 0, "bis": 4},
        {"quelle": str(datei), "von": 4, "bis": 9},
    ])
    a = sc.lies(pfad)
    b = sc.lies(pfad)
    assert a.gesamtdauer == b.gesamtdauer == 9.0
    assert [s.von for s in a.segmente] == [s.von for s in b.segmente]


# ── Nachbauten ───────────────────────────────────────────────────────

def _produkt():
    from pipelines.products import Produkt
    return Produkt(
        id=10, name="Elektrischer Wasserspender",
        slug="elektrischer-wasserspender", preis=24.99,
        kategorie="Haushalt", beschreibung="Automatischer Wasserspender",
        sku=None, auf_lager=True, lieferzeit=None, bild=None,
    )


def _musik(ordner: Path) -> Path:
    """Ein echtes kurzes Tonstueck — kein leeres Dummy."""
    ziel = ordner / "bett.m4a"
    if not ziel.exists():
        common.lauf([
            "-f", "lavfi", "-i", "sine=frequency=220:duration=30",
            "-c:a", "aac", "-b:a", "96k", str(ziel),
        ])
    return ziel


# ── Tempo (Punkt 34) ─────────────────────────────────────────────────
#
# "Zu langsam" faellt erst beim Ansehen auf, und dann ist die Fassung fertig.
# Dabei ist es eine Zahl.

@hat_ffmpeg
def test_tempo_wird_gerechnet_statt_geschaetzt(tmp_path):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 1.5},
        {"quelle": str(video), "von": 2, "bis": 3.5},
        {"quelle": str(video), "von": 4, "bis": 5.0},
    ])
    t = sc.tempo(sc.lies(pfad))

    assert t["segmente"] == 3
    assert t["mittel"] == pytest.approx(1.33, abs=0.02)
    assert t["laengstes"] == pytest.approx(1.5, abs=0.01)
    assert t["hinweise"] == [], "bei 1,3 s je Einstellung gibt es nichts zu melden"


@hat_ffmpeg
def test_lange_einstellungen_werden_gemeldet_nicht_gesperrt(tmp_path):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=20.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 6},     # deutlich ueber 4 s
        {"quelle": str(video), "von": 7, "bis": 13},
    ])
    liste = sc.lies(pfad)
    t = sc.tempo(liste)

    assert t["mittel"] == pytest.approx(6.0, abs=0.01)
    assert any("Segment 1, 2" in h for h in t["hinweise"])
    assert any("eher ruhig" in h for h in t["hinweise"])

    # GEGENPROBE: Es ist ein HINWEIS, keine Sperre. Ein langsamer Clip kann
    # richtig sein — eine Produktvorfuehrung braucht Zeit. Eine Sperre, die
    # gewollte Faelle abweist, wird nach zwei Tagen abgeschaltet, und dann
    # prueft gar nichts mehr.
    #
    # Geprueft wird das daran, dass das Tempo NICHT in den Warnungen der Liste
    # landet: Dort stehen die Dinge, die das Rendern begleiten oder verhindern.
    assert not any("Tempo" in w or "ruhig" in w for w in liste.warnungen)
    # Und dieselbe Liste mit kurzen Segmenten meldet gar nichts — der Hinweis
    # kommt aus den Zahlen, nicht aus einer festen Vorliebe fuer Meckern.
    assert sc.tempo(sc.Schnittliste(
        produkt_id=10,
        segmente=[sc.Segment(quelle=video, von=0.0, bis=1.0),
                  sc.Segment(quelle=video, von=1.0, bis=2.0)],
    ))["hinweise"] == []


def test_eine_leere_liste_hat_kein_tempo():
    leer = sc.Schnittliste(produkt_id=10, segmente=[])
    t = sc.tempo(leer)
    assert t == {"segmente": 0, "mittel": 0.0, "laengstes": 0.0, "hinweise": []}

    # GEGENPROBE: Ohne den Sonderfall waere hier eine Division durch null —
    # und der Renderlauf braeche an der Stelle ab, an der er nur berichten soll.


# ── Varianten nicht mischen (Punkt 36) ───────────────────────────────
#
# Die Lehre steht in der Handarbeit-Notiz zu Produkt 10: "Clips mit dem
# SCHWARZEN Spender nicht mit den weissen mischen — wirkt wie ein anderes
# Produkt." Als Notiz haelt so etwas genau so lange, wie jemand daran denkt.

@hat_ffmpeg
def test_gemischte_varianten_werden_gemeldet(tmp_path):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2, "variante": "weiss"},
        {"quelle": str(video), "von": 3, "bis": 5, "variante": "schwarz"},
        {"quelle": str(video), "von": 6, "bis": 8, "variante": "weiss"},
    ])
    v = sc.varianten(sc.lies(pfad))

    assert v["gefunden"] == {"schwarz": [2], "weiss": [1, 3]}
    assert len(v["hinweise"]) == 1
    assert "schwarz (Segment 2)" in v["hinweise"][0]
    assert "varianten_mischen" in v["hinweise"][0], "der Ausweg muss dabeistehen"


@hat_ffmpeg
def test_eine_variante_allein_meldet_nichts(tmp_path):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2, "variante": "weiss"},
        {"quelle": str(video), "von": 3, "bis": 5, "variante": "weiss"},
    ])
    assert sc.varianten(sc.lies(pfad))["hinweise"] == []

    # GEGENPROBE: Ohne Angabe wird gar nichts geprueft. Ein leeres Feld ist
    # keine Aussage ueber die Variante — und ein Hinweis auf Verdacht waere
    # bei jedem Altbestand-Clip da, also bei allen 22.
    zweiter = tmp_path / "ohne_angabe"
    zweiter.mkdir()
    ohne = _liste_schreiben(zweiter, [
        {"quelle": str(video), "von": 0, "bis": 2},
        {"quelle": str(video), "von": 3, "bis": 5},
    ])
    ergebnis = sc.varianten(sc.lies(ohne))
    assert ergebnis["gefunden"] == {}
    assert ergebnis["hinweise"] == []


@hat_ffmpeg
def test_bewusstes_mischen_bleibt_moeglich(tmp_path):
    """Manchmal IST die Farbauswahl der Punkt des Clips."""
    video = _testvideo(tmp_path / "10_730.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2, "variante": "weiss"},
        {"quelle": str(video), "von": 3, "bis": 5, "variante": "schwarz"},
    ], varianten_mischen=True)
    liste = sc.lies(pfad)

    assert liste.varianten_mischen is True
    assert sc.varianten(liste)["hinweise"] == []
    # Gefunden werden sie trotzdem — sie stehen im Bericht, nur ohne Hinweis.
    assert sc.varianten(liste)["gefunden"] == {"schwarz": [2], "weiss": [1]}

    # GEGENPROBE: Dieselbe Liste OHNE die Freigabe meldet sehr wohl.
    ohne = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2, "variante": "weiss"},
        {"quelle": str(video), "von": 3, "bis": 5, "variante": "schwarz"},
    ])
    assert len(sc.varianten(sc.lies(ohne))["hinweise"]) == 1


# ── Vorschau in klein (Punkt 51) ─────────────────────────────────────
#
# Beim Bauen einer Fassung geht es um Reihenfolge und Rhythmus, nicht um
# Bildqualitaet. Trotzdem wurde jedes Mal in voller Aufloesung gerendert — die
# Wartezeit fiel dort an, wo sie am wenigsten nuetzt.

@hat_ffmpeg
def test_die_vorschau_ist_klein_und_als_solche_erkennbar(tmp_path, monkeypatch):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2},
        {"quelle": str(video), "von": 3, "bis": 5},
    ], endkarte=False)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    liste = sc.lies(pfad)

    klein, bericht = sc.rendere(liste, _produkt(), tmp_path / "vorschau.mp4",
                                vorschau=True)
    info = common.medien_info(klein)
    assert (info.breite, info.hoehe) == (540, 960)
    assert bericht["vorschau"] is True

    # DIE VORSCHAU FAELLT ABSICHTLICH DURCH DIE AUSGANGSPRUEFUNG.
    # Sie darf nie versehentlich veroeffentlicht werden.
    urteil = quality_gate.pruefe(klein)
    assert urteil.bestanden is False
    assert any("Aufloesung" in g for g in urteil.gruende)


@hat_ffmpeg
def test_vorschau_und_endfassung_zeigen_dasselbe(tmp_path, monkeypatch):
    """Eine Vorschau, die etwas anderes zeigt, ist keine Vorschau."""
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2},
        {"quelle": str(video), "von": 3, "bis": 6},
    ], endkarte=False)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    liste = sc.lies(pfad)

    klein, b_klein = sc.rendere(liste, _produkt(), tmp_path / "v.mp4", vorschau=True)
    gross, b_gross = sc.rendere(liste, _produkt(), tmp_path / "e.mp4")

    i_klein = common.medien_info(klein)
    i_gross = common.medien_info(gross)
    assert i_klein.dauer == pytest.approx(i_gross.dauer, abs=0.1), \
        "gleiche Laenge — sonst stimmt der Rhythmus nicht ueberein"
    assert b_klein["segmente"] == b_gross["segmente"]
    assert b_klein["musik"] == b_gross["musik"]

    # GEGENPROBE: Unterschiedlich sind NUR Aufloesung und Kennzeichnung.
    assert (i_klein.breite, i_klein.hoehe) != (i_gross.breite, i_gross.hoehe)
    assert b_gross["vorschau"] is False


# ── Uebergaenge (Punkt 33) ───────────────────────────────────────────

@hat_ffmpeg
def test_ein_blitz_wird_gezaehlt_und_der_rest_bleibt_hart(tmp_path, monkeypatch):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2},
        {"quelle": str(video), "von": 3, "bis": 5, "uebergang": "blitz"},
        {"quelle": str(video), "von": 6, "bis": 8},
    ], endkarte=False)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    liste = sc.lies(pfad)
    assert [w for w in liste.warnungen if "Uebergang" in w] == []

    _, bericht = sc.rendere(liste, _produkt(), tmp_path / "raus.mp4")
    assert bericht["uebergaenge"] == {"blitz": 1, "schnitt": 2}

    # GEGENPROBE: Ohne Blitz steht das Feld gar nicht im Bericht — ein
    # Eintrag "blitz: 0" waere Rauschen in jeder Zeile.
    ohne = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2},
    ], endkarte=False)
    _, b2 = sc.rendere(sc.lies(ohne), _produkt(), tmp_path / "ohne.mp4")
    assert "uebergaenge" not in b2


@hat_ffmpeg
def test_ein_unbekannter_uebergang_wird_gemeldet(tmp_path):
    """Ein Tippfehler soll auffallen, nicht still zum harten Schnitt werden."""
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2, "uebergang": "ueberblendung"},
    ], endkarte=False)
    liste = sc.lies(pfad)

    # Gezielt auf DIESE Warnung pruefen: Die Liste meldet zu Recht auch
    # anderes (kein Hook, zu kurz fuer die Mindestdauer). Auf die Gesamtzahl
    # zu pruefen hiesse, dass dieser Test bei jeder neuen Warnung anderswo
    # rot wird — und dann wird er irgendwann entschaerft statt gelesen.
    passende = [w for w in liste.warnungen if "Uebergang" in w]
    assert len(passende) == 1
    assert "ueberblendung" in passende[0]
    assert "schnitt, blitz" in passende[0], "die erlaubten Werte muessen dabeistehen"

    # GEGENPROBE: Die erlaubten Werte melden nichts — und ein fehlendes Feld
    # ebenso, denn "schnitt" ist die Vorgabe.
    for wert in ["schnitt", "blitz", None]:
        eintrag = {"quelle": str(video), "von": 0, "bis": 2}
        if wert:
            eintrag["uebergang"] = wert
        sauber = _liste_schreiben(tmp_path, [eintrag], endkarte=False)
        assert [w for w in sc.lies(sauber).warnungen if "Uebergang" in w] == []


def test_der_blitz_ist_kurz_genug_um_kein_fehler_zu_sein():
    # Drei Bilder bei 30 fps = 0,1 s. Laenger wirkt es wie ein Fehler im
    # Material, kuerzer sieht man es nicht.
    assert sc.BLITZ_BILDER == 3
    assert "d=0.100" in sc.uebergang_filter(3, fps=30)
    assert "color=white" in sc.uebergang_filter()

    # GEGENPROBE: Die Dauer haengt an der Bildrate, nicht an einer festen Zahl.
    assert "d=0.050" in sc.uebergang_filter(3, fps=60)


# ── Begleitdatei (Punkt 53) ──────────────────────────────────────────

@hat_ffmpeg
def test_jede_fassung_legt_ihre_geschichte_daneben(tmp_path, monkeypatch):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 2},
        {"quelle": str(video), "von": 3, "bis": 5},
    ], endkarte=False)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))

    ziel, bericht = sc.rendere(sc.lies(pfad), _produkt(), tmp_path / "fassung3.mp4")
    begleit = ziel.with_suffix(ziel.suffix + sc.BEGLEIT_ENDUNG)
    assert begleit.exists()
    assert bericht["begleitdatei"] == begleit.name

    inhalt = json.loads(begleit.read_text(encoding="utf-8"))
    assert inhalt["video"] == "fassung3.mp4"
    assert inhalt["produkt_id"] == 10
    assert inhalt["ton_entfernt"] is True
    assert inhalt["dauer_gemessen"] == bericht["dauer_gemessen"]

    # DIE FRAGE, DIE IN EINEM HALBEN JAHR KOMMT: von wem war das Material?
    assert len(inhalt["quellen"]) == 1
    assert inhalt["quellen"][0]["datei"] == "10_730.mp4"
    assert len(inhalt["quellen"][0]["sha256"]) == 64

    # Das eine Feld, das ein Mensch fuellt, bleibt LEER. Ein erfundener Satz
    # waere schlimmer als ein leeres Feld.
    assert inhalt["aenderung"] == ""


@hat_ffmpeg
def test_die_begleitdatei_entsteht_erst_nach_dem_video(tmp_path, monkeypatch):
    """Eine Begleitdatei ohne Video ist schlimmer als keine."""
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [{"quelle": str(video), "von": 0, "bis": 2}],
                            endkarte=False)
    # Kein Lizenznachweis: Das Rendern bricht ab, BEVOR etwas entsteht.
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: False)
    ziel = tmp_path / "gescheitert.mp4"
    with pytest.raises(RuntimeError):
        sc.rendere(sc.lies(pfad), _produkt(), ziel)

    assert not ziel.exists()
    assert not ziel.with_suffix(ziel.suffix + sc.BEGLEIT_ENDUNG).exists(), \
        "keine Begleitdatei zu einem Video, das es nicht gibt"

    # GEGENPROBE: Mit Nachweis entstehen beide.
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    monkeypatch.setattr(sc.common, "musik_waehlen", lambda saat: _musik(tmp_path))
    fertig, _ = sc.rendere(sc.lies(pfad), _produkt(), tmp_path / "geklappt.mp4")
    assert fertig.exists()
    assert fertig.with_suffix(fertig.suffix + sc.BEGLEIT_ENDUNG).exists()


# ── Trockenpruefung (Punkt 48) ───────────────────────────────────────
#
# 131 Pruefungen decken das Finden und Filtern ab. Fuer das Schneiden gab es
# keine einzige — dabei hat der Schnitt mehr Fallen.

@hat_ffmpeg
def test_die_pruefung_sammelt_alles_statt_beim_ersten_fehler_abzubrechen(tmp_path, monkeypatch):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=10.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 6},
    ], endkarte=False)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: False)

    bericht = sc.trockenpruefung(pfad)
    assert bericht["ok"] is False
    assert any("ohne Lizenznachweis" in f for f in bericht["fehler"])
    # Und die Hinweise stehen trotzdem da — eine Pruefung, die beim ersten
    # Fehler abbricht, zwingt zu so vielen Laeufen wie es Fehler gibt.
    assert any("eher ruhig" in h for h in bericht["hinweise"])
    assert bericht["tempo"]["segmente"] == 1

    # GEGENPROBE: Mit Nachweis ist dieselbe Liste bereit.
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)
    assert sc.trockenpruefung(pfad)["ok"] is True


@hat_ffmpeg
def test_der_bauversuch_schneidet_drei_sekunden_statt_alles(tmp_path, monkeypatch):
    """Die eine Frage, die keine Textpruefung beantwortet: Laesst sich aus
    diesen Quellen ueberhaupt ein Bild schneiden?"""
    video = _testvideo(tmp_path / "10_730.mp4", dauer=20.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 10},
    ], endkarte=False)
    monkeypatch.setattr(sc.assets, "hat_lizenz", lambda p: True)

    bericht = sc.trockenpruefung(pfad, bauversuch=True)
    assert bericht["ok"] is True
    assert bericht["bauversuch"]["dauer"] == pytest.approx(3.0, abs=0.3), \
        "drei Sekunden, nicht die zehn aus der Liste"
    assert (bericht["bauversuch"]["breite"], bericht["bauversuch"]["hoehe"]) == (540, 960)

    # GEGENPROBE: Ohne Schalter wird gar nichts gebaut — das Gegenlesen soll
    # Sekunden kosten, nicht Minuten.
    assert "bauversuch" not in sc.trockenpruefung(pfad)


def test_eine_kaputte_liste_meldet_die_zeile(tmp_path):
    pfad = tmp_path / "kaputt.json"
    pfad.write_text("{kein json", encoding="utf-8")
    bericht = sc.trockenpruefung(pfad)
    assert bericht["ok"] is False
    assert any("JSON" in f for f in bericht["fehler"])
    assert bericht["liste"] is None

    # GEGENPROBE: Eine fehlende Datei ist etwas anderes als eine kaputte —
    # beide melden, aber mit verschiedenem Grund.
    fehlt = sc.trockenpruefung(tmp_path / "gibt-es-nicht.json")
    assert any("nicht gefunden" in f for f in fehlt["fehler"])


# ── Vorlagen (Punkt 28) ──────────────────────────────────────────────

def test_jede_vorlage_ergibt_ein_video_ueber_der_mindestdauer():
    """Eine Vorlage, deren Ergebnis die Ausgangspruefung ablehnt, ist keine."""
    from pipelines.orchestrator import guardrails
    mindest = float(guardrails.wert("video.min_dauer_sek", 8))

    for e in sc.vorlagen_uebersicht():
        gesamt = e["dauer"] + sc.ENDKARTE_SEK
        assert gesamt >= mindest, f"{e['schluessel']}: {gesamt}s unter {mindest}s"

    # GEGENPROBE: Ohne Endkarte waere "drei_gruende" mit 7,5s zu kurz — die
    # Rechnung haengt also wirklich an beidem.
    kurz = [e for e in sc.vorlagen_uebersicht() if e["dauer"] < mindest]
    assert kurz, "mindestens eine Vorlage braucht die Endkarte, um zu reichen"


def test_eine_vorlage_erfindet_keine_dateinamen():
    geruest = sc.vorlage("vorher_nachher", 10, quellen=["a.mp4"])
    assert geruest["segmente"][0]["quelle"] == "a.mp4"
    assert geruest["segmente"][1]["quelle"] == ""
    assert geruest["segmente"][2]["quelle"] == ""

    # GEGENPROBE: Eine Liste mit erfundenen Namen saehe fertig aus und waere
    # es nicht — sie faellt erst beim Rendern auf die Nase.
    assert all(isinstance(s["quelle"], str) for s in geruest["segmente"])
    with pytest.raises(KeyError):
        sc.vorlage("gibt-es-nicht", 10)


def test_die_vorlagen_bleiben_wenige():
    # Nach zwanzig veroeffentlichten Clips soll man sagen koennen, welche Form
    # laeuft. Bei zwanzig Vorlagen hat man dann je eine Messung, also keine.
    assert 3 <= len(sc.VORLAGEN) <= 6
    for schluessel, v in sc.VORLAGEN.items():
        assert v["wofuer"], f"{schluessel} sagt nicht, wofuer es taugt"
        assert 3 <= len(v["segmente"]) <= 5


# ── Hook-Varianten (Punkt 58) ────────────────────────────────────────

@hat_ffmpeg
def test_drei_fassungen_unterscheiden_sich_nur_am_anfang(tmp_path):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 3, "text": "Eins"},
        {"quelle": str(video), "von": 4, "bis": 7, "text": "Zwei"},
        {"quelle": str(video), "von": 8, "bis": 11, "text": "Drei"},
    ], hook="Erster Hook", hashtags=["x"])
    liste = sc.lies(pfad)

    fassungen = sc.hook_varianten(liste, ["Hook A", "Hook B", "Hook C"])
    assert [f.hook for f in fassungen] == ["Hook A", "Hook B", "Hook C"]

    # ALLES ANDERE IST IDENTISCH — sonst misst man nicht den Hook, sondern
    # drei verschiedene Videos.
    for f in fassungen:
        assert f.gesamtdauer == liste.gesamtdauer
        assert [s.text for s in f.segmente] == ["Eins", "Zwei", "Drei"]
        assert f.hashtags == liste.hashtags
        assert f.musik == liste.musik

    # GEGENPROBE: Die Segmente sind KOPIEN. Wer an einer Fassung etwas aendert,
    # darf die anderen nicht mitaendern.
    fassungen[0].segmente[0].text = "Geaendert"
    assert fassungen[1].segmente[0].text == "Eins"
    assert liste.segmente[0].text == "Eins"


@hat_ffmpeg
def test_das_erste_segment_rotiert_statt_zu_mischen(tmp_path):
    video = _testvideo(tmp_path / "10_730.mp4", dauer=12.0)
    pfad = _liste_schreiben(tmp_path, [
        {"quelle": str(video), "von": 0, "bis": 3, "text": "A"},
        {"quelle": str(video), "von": 4, "bis": 7, "text": "B"},
        {"quelle": str(video), "von": 8, "bis": 11, "text": "C"},
    ])
    liste = sc.lies(pfad)
    fassungen = sc.hook_varianten(liste, ["h1", "h2", "h3"],
                                  erstes_segment_tauschen=True)

    assert [s.text for s in fassungen[0].segmente] == ["A", "B", "C"]
    assert [s.text for s in fassungen[1].segmente] == ["B", "C", "A"]
    assert [s.text for s in fassungen[2].segmente] == ["C", "A", "B"]

    # ALLE BEHALTEN DIESELBEN TEILE — rotiert, nicht gemischt. Die Gesamtdauer
    # bleibt damit gleich, und das ist die Voraussetzung fuer den Vergleich.
    for f in fassungen:
        assert sorted(s.text for s in f.segmente) == ["A", "B", "C"]
        assert f.gesamtdauer == liste.gesamtdauer

    # GEGENPROBE: Bei zwei Segmenten wird NICHT rotiert — sonst tauscht man
    # den halben Clip und misst wieder zwei verschiedene Videos.
    kurz = _liste_schreiben(tmp_path / "k", [
        {"quelle": str(video), "von": 0, "bis": 3, "text": "A"},
        {"quelle": str(video), "von": 4, "bis": 7, "text": "B"},
    ]) if (tmp_path / "k").mkdir(exist_ok=True) is None else None
    zwei = sc.hook_varianten(sc.lies(kurz), ["h1", "h2"], erstes_segment_tauschen=True)
    assert [s.text for s in zwei[1].segmente] == ["A", "B"]


def test_die_kennung_steht_vor_der_endung():
    from pathlib import Path as P
    assert sc.variantenname(P("/x/fassung.mp4"), 0).name == "fassung_a.mp4"
    assert sc.variantenname(P("/x/fassung.mp4"), 2).name == "fassung_c.mp4"

    # GEGENPROBE: Dahinter angehaengt hiesse die Datei "fassung.mp4_a" — und
    # keine Anwendung erkennt sie mehr als Video.
    assert sc.variantenname(P("/x/fassung.mp4"), 1).suffix == ".mp4"

    # Ohne Hooktexte gibt es nichts zu vergleichen.
    with pytest.raises(ValueError):
        sc.hook_varianten(sc.Schnittliste(produkt_id=10, segmente=[]), [])
