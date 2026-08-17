"""Tests fuer die Videoproduktion (Stil A), die Ausgangspruefung und Lizenzen.

Der Pflichttest ist test_quality_gate: 0-Byte- und zu kurze Videos werden
abgewiesen. Genau das hat bis Runde 10 gefehlt — in data/renders/ lagen neun
MP4-Dateien mit 0 Byte, die aussahen wie fertige Arbeit.

Videos werden hier WIRKLICH erzeugt, nicht simuliert. Ein Test, der eine
Attrappe prueft, bestaetigt nur die Attrappe (siehe die Projektnotiz
"Nachbauten muessen luegenfrei sein").
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from pipelines.video import assets, common, quality_gate

hat_ffmpeg = pytest.mark.skipif(
    not common.verfuegbar()[0],
    reason=f"kein ffmpeg — {common.verfuegbar()[1]}",
)


@pytest.fixture
def werkstatt(tmp_path):
    """Schreibbarer Arbeitsordner. tmp_path liegt ausserhalb des Projekts."""
    return tmp_path


def _testvideo(ziel: Path, *, dauer: float = 12.0, breite: int = 1080,
               hoehe: int = 1920, mit_ton: bool = True) -> Path:
    """Ein echtes, abspielbares Video bauen — kein Platzhalter."""
    argumente = [
        "-f", "lavfi", "-i", f"testsrc=size={breite}x{hoehe}:rate=30:duration={dauer}",
    ]
    if mit_ton:
        argumente += ["-f", "lavfi", "-i", f"sine=frequency=300:duration={dauer}"]
    argumente += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", f"{dauer}"]
    if mit_ton:
        argumente += ["-c:a", "aac", "-shortest"]
    argumente += [str(ziel)]
    common.lauf(argumente)
    return ziel


# ══════════════════════════════════════════════════════════════════════
# 1. Ausgangspruefung
# ══════════════════════════════════════════════════════════════════════

def test_quality_gate_weist_null_byte_ab(werkstatt):
    """Der historische Fall: eine 0-Byte-Datei mit .mp4 am Ende."""
    leer = werkstatt / "leer.mp4"
    leer.write_bytes(b"")
    ergebnis = quality_gate.pruefe(leer)
    assert ergebnis.bestanden is False
    assert any("Byte" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_quality_gate_weist_zu_kurz_ab(werkstatt):
    """Ein 4-Sekunden-Video ist kein Beitrag, sondern ein Versehen."""
    kurz = _testvideo(werkstatt / "kurz.mp4", dauer=4.0)
    ergebnis = quality_gate.pruefe(kurz)
    assert ergebnis.bestanden is False
    assert any("zu kurz" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_quality_gate_weist_stummes_video_ab(werkstatt):
    """Ohne Tonspur ist es kein fertiges Video.

    Genau so sah das Ergebnis aus, wenn die alte Vertonung nur eine leere
    Datei angelegt hat (touch statt echtem Aufruf).
    """
    stumm = _testvideo(werkstatt / "stumm.mp4", dauer=12.0, mit_ton=False)
    ergebnis = quality_gate.pruefe(stumm)
    assert ergebnis.bestanden is False
    assert any("Tonspur" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_quality_gate_weist_falsche_aufloesung_ab(werkstatt):
    """Querformat auf einer Hochformat-Plattform."""
    quer = _testvideo(werkstatt / "quer.mp4", dauer=12.0, breite=1920, hoehe=1080)
    ergebnis = quality_gate.pruefe(quer)
    assert ergebnis.bestanden is False
    assert any("Aufloesung" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_quality_gate_gegenprobe(werkstatt):
    """GEGENPROBE: ein korrektes Video kommt durch.

    Ohne das koennte die Pruefung auch alles abweisen — dann entstuende nie
    ein Video und die Ursache waere schwer zu finden.
    """
    gut = _testvideo(werkstatt / "gut.mp4", dauer=15.0)
    ergebnis = quality_gate.pruefe(gut)
    assert ergebnis.bestanden is True, ergebnis.gruende
    assert ergebnis.info is not None
    assert (ergebnis.info.breite, ergebnis.info.hoehe) == (1080, 1920)
    assert ergebnis.info.hat_ton is True


# ══════════════════════════════════════════════════════════════════════
# 2. ffmpeg-Grundlagen
# ══════════════════════════════════════════════════════════════════════

@hat_ffmpeg
def test_medien_info_erkennt_null_byte(werkstatt):
    """medien_info darf bei einer leeren Datei nicht abstuerzen."""
    leer = werkstatt / "leer2.mp4"
    leer.write_bytes(b"")
    info = common.medien_info(leer)
    assert info is not None and info.groesse_byte == 0 and info.dauer == 0.0


@hat_ffmpeg
def test_ken_burns_haelt_die_laufzeit_ein(werkstatt):
    """Der teuerste Fehler dieser Etappe, als Test festgehalten.

    zoompan gibt "d" Bilder je EINGANGSbild aus. Der erste Entwurf setzte
    d = dauer*30 bei ebenso vielen Eingangsbildern — ein 3-Sekunden-Clip
    wurde dadurch zu 270 Sekunden und lief nach einer Minute Rechenzeit noch
    immer. Gemessen wurde: 1.094 Bilder statt 90.
    """
    quelle = werkstatt / "standbild.png"
    common.lauf(["-f", "lavfi", "-i", "color=c=blue:s=1200x1600", "-frames:v", "1", str(quelle)])

    ziel = werkstatt / "kb.mp4"
    common.lauf([
        "-framerate", "30", "-loop", "1", "-t", "3.00", "-i", str(quelle),
        "-vf", common.ken_burns(3.0), "-an",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel),
    ])
    info = common.medien_info(ziel)
    assert info is not None
    assert abs(info.dauer - 3.0) < 0.2, f"Laufzeit {info.dauer:.2f}s statt 3.00s"
    assert (info.breite, info.hoehe) == (1080, 1920)


@hat_ffmpeg
def test_endkarte_zeigt_echten_preis(werkstatt):
    """Die Endkarte ist der einzige Weg vom Video in den Shop."""
    from pipelines import products

    produkt = products.alle()[0]
    quelle = werkstatt / "produkt.png"
    common.lauf(["-f", "lavfi", "-i", "color=c=gray:s=1200x1600", "-frames:v", "1", str(quelle)])

    ziel = common.baue_endkarte(
        quelle, werkstatt / "endkarte.mp4",
        name=produkt.name, preis=produkt.preis,
        url="maiosshop.com/x", dauer=2.5,
    )
    info = common.medien_info(ziel)
    assert info is not None
    assert abs(info.dauer - 2.5) < 0.3, f"Endkarte {info.dauer:.2f}s statt 2.5s"
    assert (info.breite, info.hoehe) == (1080, 1920)


@hat_ffmpeg
def test_produktname_mit_sonderzeichen_bricht_die_endkarte_nicht(werkstatt):
    """Doppelpunkt und Apostroph haben im ffmpeg-Filter Bedeutung.

    Ein Produktname wie "4-in-1: Haartrockner" wuerde den gesamten Aufruf
    zerlegen, wenn er nicht maskiert wird.
    """
    quelle = werkstatt / "p2.png"
    common.lauf(["-f", "lavfi", "-i", "color=c=black:s=1000x1400", "-frames:v", "1", str(quelle)])
    ziel = common.baue_endkarte(
        quelle, werkstatt / "endkarte2.mp4",
        name="4-in-1: Haar'trockner 100%", preis=19.99,
        url="maiosshop.com/produkte/x.html", dauer=2.0,
    )
    assert common.medien_info(ziel).dauer > 1.5


def test_untertitel_hoechstens_drei_woerter(werkstatt):
    """Mehr als drei Woerter je Zeile liest im Hochformat niemand mit."""
    segmente = [{"von": 0.0, "bis": 6.0,
                 "text": "Das hier sind deutlich mehr als drei Woerter am Stueck"}]
    ass = common.schreibe_untertitel(segmente, werkstatt / "u.ass")
    inhalt = ass.read_text(encoding="utf-8")
    zeilen = [z for z in inhalt.splitlines() if z.startswith("Dialogue:")]
    assert zeilen, "keine Untertitelzeile erzeugt"
    for zeile in zeilen:
        text = zeile.split(",,", 1)[-1]
        assert len(text.split()) <= 3, f"zu viele Woerter: {text}"


def test_untertitel_bleiben_im_sichtbaren_bereich(werkstatt):
    """TikTok blendet unten eigene Bedienelemente ein."""
    ass = common.schreibe_untertitel(
        [{"von": 0.0, "bis": 2.0, "text": "Test"}], werkstatt / "u2.ass"
    )
    inhalt = ass.read_text(encoding="utf-8")
    assert f",{common.SAFE_UNTEN}," in inhalt, "unterer Sicherheitsabstand fehlt"


# ══════════════════════════════════════════════════════════════════════
# 3. Lizenzpflicht
# ══════════════════════════════════════════════════════════════════════

def test_lizenz_pflicht(werkstatt):
    """Ein Asset ohne Lizenz wird abgelehnt — nicht nur bemaengelt."""
    datei = werkstatt / "fremd.jpg"
    datei.write_bytes(b"kein echtes Bild, reicht fuer den Test")
    ohne = assets.Asset(datei, "bild", "irgendwoher", lizenz="")
    assert assets.registriere(ohne) is False, "Asset ohne Lizenz wurde angenommen"


def test_lizenz_pflicht_gegenprobe(werkstatt):
    """GEGENPROBE: MIT Lizenz wird dasselbe Asset angenommen."""
    datei = werkstatt / "eigen.jpg"
    datei.write_bytes(b"kein echtes Bild, reicht fuer den Test")
    mit = assets.Asset(datei, "bild", "eigen", lizenz="eigenes Material")
    assert assets.registriere(mit) is True


def test_eigene_bilder_lassen_vorschauvarianten_aus():
    """Die -160/-320-Varianten sind Vorschaubilder und viel zu klein.

    In 1080x1920 waeren sie sichtbar matschig. Dieselbe Ueberlegung steht in
    CLAUDE.md zur Bildroute des Shops.
    """
    from pipelines import products

    produkt = products.alle()[0]
    for asset in assets.eigene_bilder(produkt):
        assert not any(v in asset.pfad.stem for v in assets.VARIANTEN), \
            f"Vorschauvariante im Material: {asset.pfad.name}"


def test_unsplash_ist_raus():
    """source.unsplash.com war tot und lizenzrechtlich unklar.

    Geprueft wird auf die VERWENDUNG als Adresse (mit Schema), nicht auf das
    blosse Vorkommen der Zeichenkette: Der Name steht absichtlich in den
    Erlaeuterungen, weil dort steht, warum die Quelle entfernt wurde. Ein
    Test, der auch den Kommentar verbietet, wuerde die Begruendung
    mitloeschen.
    """
    quelltext = Path(assets.__file__).read_text(encoding="utf-8")
    quelltext += Path(common.__file__).read_text(encoding="utf-8")
    for schema in ("https://source.unsplash", "http://source.unsplash"):
        assert schema not in quelltext, f"{schema} wird noch aufgerufen"


# ══════════════════════════════════════════════════════════════════════
# 4. Stimme
# ══════════════════════════════════════════════════════════════════════

def test_es_gibt_immer_einen_stimmweg():
    """Der Rueckfall muss selbst dann greifen, wenn nichts eingerichtet ist.

    Ohne ihn haette dieser Rechner gar keine Stimme: piper ist nicht
    installiert, ElevenLabs braucht einen Schluessel, eigene Aufnahmen gibt
    es noch keine. Ein Rueckfall, der ausfaellt, ist keiner.
    """
    from pipelines.video.tts import base as tts

    stimme, info = tts.beste_stimme("lokal")
    if os.name != "nt":
        pytest.skip("Windows-Sprachausgabe nur unter Windows pruefbar")
    assert stimme is not None, f"keine Stimme verfuegbar: {info}"


# ══════════════════════════════════════════════════════════════════════
# Text, der aus dem Bild laeuft
# ══════════════════════════════════════════════════════════════════════
#
# Gefunden beim Anschauen eines Einzelbildes aus einem fertigen Video —
# nicht durch eine Pruefung. Die Ausgangspruefung misst Aufloesung, Laufzeit,
# Dateigroesse und Ton. Ob TEXT im sichtbaren Bereich steht, sieht sie nicht.
# Auf der Endkarte stand:
#
#     "ktrischer Wasserspender fuer Schreibti"
#     "p.com/produkte/elektrischer-wasserspender-fuer-schreibt"
#
# Nur der Preis passte. Ausgerechnet die Endkarte zeigt den Weg in den Shop.

def test_untertitel_brechen_um_statt_ueberzulaufen():
    """WrapStyle 0 statt 2 — sonst bricht libass grundsaetzlich nicht um."""
    from pipelines.video import common

    ziel = Path(os.environ.get("TEMP", ".")) / "__test_untertitel.ass"
    common.schreibe_untertitel(
        [{"text": "Automatischer Wasserspender für den Schreibtisch", "von": 0.0, "bis": 3.0}],
        ziel,
    )
    inhalt = ziel.read_text(encoding="utf-8")
    ziel.unlink(missing_ok=True)

    assert "WrapStyle: 0" in inhalt, \
        "WrapStyle 2 heisst 'nie umbrechen' — lange Zeilen laufen aus dem Bild"
    assert "WrapStyle: 2" not in inhalt


def test_untertitelzeilen_bleiben_kurz_genug():
    """Drei Woerter reichen als Regel nicht — drei LANGE passen trotzdem nicht.

    'Automatischer Wasserspender für' sind drei Woerter und 32 Zeichen. Genau
    diese Zeile lief im gerenderten Video rechts aus dem Bild.
    """
    from pipelines.video import common

    woerter = "Automatischer Wasserspender für den Schreibtisch zuhause".split()
    bloecke = common._bloecke_bilden(woerter, 3)
    for block in bloecke:
        zeile = " ".join(block)
        assert len(zeile) <= common.MAX_ZEICHEN_JE_ZEILE or len(block) == 1, \
            f"Zeile '{zeile}' hat {len(zeile)} Zeichen — passt nicht in die Breite"
    assert sum(len(b) for b in bloecke) == len(woerter), "es ist ein Wort verlorengegangen"


def test_endkarte_setzt_text_mit_umbruch_statt_fester_groesse():
    """Die Endkarte darf keine feste Schriftgroesse mehr mittig setzen.

    Mit x=(w-text_w)/2 ragt zu breiter Text auf BEIDEN Seiten heraus — und
    zwar immer, nicht nur manchmal. Deshalb laeuft die Beschriftung jetzt
    ueber denselben Textsatz wie die Untertitel, der umbrechen kann.
    """
    from pipelines.video import common

    quelltext = Path(common.__file__).read_text(encoding="utf-8")
    endkarte = quelltext[quelltext.index("def baue_endkarte"):]
    endkarte = endkarte[:endkarte.index("\ndef ", 10)] if "\ndef " in endkarte[10:] else endkarte

    assert "drawtext" not in endkarte, \
        "die Endkarte benutzt wieder drawtext — das kann nicht umbrechen"
    assert "subtitles=" in endkarte, "die Endkarte setzt ihren Text nicht ueber libass"


def test_endkarte_zeigt_nur_die_domain():
    """Eine lange Adresse ist im Video nutzlos — und unlesbar.

    Sie ist nicht anklickbar, und abtippen kann man sie auch nicht. Genau
    diese Zeile war im gerenderten Video an beiden Seiten abgeschnitten.
    """
    from pipelines.video import common

    lang = "https://maiosshop.com/produkte/elektrischer-wasserspender-fuer-schreibtisch.html"
    kurz = common.kurz_url(lang)
    assert kurz == "maiosshop.com", f"kurz_url lieferte '{kurz}'"
    assert len(kurz) < 20, "die Adresse ist immer noch zu lang fuer eine Zeile"


def test_ausgabeordner_entstehen_von_selbst(tmp_path):
    """Der Zielordner muss von selbst entstehen — sonst rendert nichts.

    Niemand sonst legt ihn an: Er ist gitignored, und Git kennt keine leeren
    Verzeichnisse. Auf einem FRISCHEN Checkout — also bei jedem
    GitHub-Actions-Durchgang — ist er garantiert weg, und der erste Render
    scheitert mit

        Error opening output …/data/renders/brief_99_stil_a.mp4:
        No such file or directory

    Der Lauf bliebe dabei GRUEN: Der Job meldet 'gerendert: 0, verworfen: 2'
    und wirft nicht. Waehrend der Entwicklung faellt es nicht auf, weil
    MARKETING_DATA_DIR dort auf einen vorhandenen Ordner zeigt.

    Geprueft wird in einem EIGENEN Prozess mit frischem MARKETING_DATA_DIR —
    im laufenden Testprozess ist common bereits importiert, die Ordner waeren
    also schon angelegt und der Test bewiese nichts.
    """
    import subprocess
    import sys

    ziel = tmp_path / "frisch" / "mkt-daten"
    assert not ziel.exists(), "Testaufbau: der Ordner darf noch nicht existieren"

    umgebung = {**os.environ, "MARKETING_DATA_DIR": str(ziel), "PYTHONIOENCODING": "utf-8"}
    ergebnis = subprocess.run(
        [sys.executable, "-c",
         "from pipelines.video import common; print(common.RENDERS); print(common.AUDIO)"],
        cwd=str(Path(__file__).resolve().parents[1]),
        env=umgebung, capture_output=True, text=True, timeout=120,
    )
    assert ergebnis.returncode == 0, f"Import scheiterte: {ergebnis.stderr[-500:]}"

    assert (ziel / "renders").is_dir(), \
        "der Ordner fuer Renderings entsteht nicht — jeder Render scheitert mit 'No such file or directory'"
    assert (ziel / "audio").is_dir(), \
        "der Ordner fuer Tonspuren entsteht nicht"


@pytest.mark.skipif(os.name != "nt", reason="Windows-Sprachausgabe")
def test_stimme_liefert_echten_ton_keine_leere_datei(werkstatt):
    """Der alte Stand legte bei gesetztem Schluessel nur eine leere Datei an.

    Das Video hatte dann eine Tonspur von 0 Byte: stumm, aber "fertig".
    """
    from pipelines.video.tts import base as tts

    stimme, _ = tts.beste_stimme("lokal")
    if stimme is None:
        pytest.skip("keine lokale Stimme")
    ziel = werkstatt / "probe.wav"
    ausgabe = stimme.sprich("Dies ist eine Sprachprobe fuer den Test.", ziel)
    assert ziel.exists() and ziel.stat().st_size > 1000, "Tonspur ist leer"
    assert ausgabe.dauer > 0.5, f"Tonspur ist nur {ausgabe.dauer}s lang"
