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


# ── Lautheit: "Tonspur vorhanden" ist die schwaechste Pruefung ────────
#
# Eine vollstaendig STILLE Tonspur ist eine Tonspur. Bis zum 18.09. kam ein
# Video, bei dem die Musik nicht durchgereicht wurde, damit anstandslos durch
# die Ausgangspruefung — dieselbe Klasse Fehler wie das 0-Byte-MP4, nur eine
# Etage tiefer. Und mkt_videos.loudness_lufs gab es seit Runde 10, gefuellt
# wurde die Spalte nie.

def _video_mit_stiller_tonspur(ziel: Path, dauer: float = 15.0) -> Path:
    """Video mit einer Tonspur, auf der NICHTS ist."""
    common.lauf([
        "-f", "lavfi", "-i", f"testsrc=size=1080x1920:rate=30:duration={dauer}",
        "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={dauer}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        "-t", f"{dauer}", "-shortest", str(ziel),
    ])
    return ziel


@hat_ffmpeg
def test_quality_gate_weist_leere_tonspur_ab(werkstatt):
    """Die Spur ist da, es ist nur nichts drauf."""
    still = _video_mit_stiller_tonspur(werkstatt / "leise.mp4")

    # Gegenbeweis vorweg: Die alte Pruefung sah hier nichts Verdaechtiges.
    info = common.medien_info(still)
    assert info is not None and info.hat_ton is True, \
        "die Datei muss eine Tonspur HABEN — sonst prueft der Test das Falsche"

    ergebnis = quality_gate.pruefe(still)
    assert ergebnis.bestanden is False
    assert any("still" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_quality_gate_misst_und_vermerkt_die_lautheit(werkstatt):
    """Drei Renderer normieren auf -14 LUFS — nachgesehen hat nie jemand."""
    gut = _testvideo(werkstatt / "mit-ton.mp4", dauer=15.0)
    ergebnis = quality_gate.pruefe(gut)
    assert ergebnis.lufs is not None, "die Lautheit muss gemessen werden"
    assert -70.0 < ergebnis.lufs < 0.0, f"unplausibler Wert: {ergebnis.lufs}"


@hat_ffmpeg
def test_sehr_leise_tonspur_gilt_als_leer(werkstatt):
    """Ein Ton, den niemand hoert, ist praktisch kein Ton."""
    leise = werkstatt / "zu-leise.mp4"
    common.lauf([
        "-f", "lavfi", "-i", "testsrc=size=1080x1920:rate=30:duration=15",
        "-f", "lavfi", "-i", "sine=frequency=300:duration=15",
        "-af", "volume=-40dB",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        "-t", "15", "-shortest", str(leise),
    ])
    ergebnis = quality_gate.pruefe(leise)
    assert ergebnis.bestanden is False
    assert any("still" in g for g in ergebnis.gruende), ergebnis.gruende


@hat_ffmpeg
def test_abweichung_vom_zielwert_ist_kein_ausschlussgrund(werkstatt):
    """GEGENPROBE ZUR STRENGE — und der Grund, warum sie so aussieht.

    Der erste Entwurf dieser Pruefung wies alles ab, was mehr als 6 LU unter
    -14 LUFS lag. Er liess prompt die vorhandene Gegenprobe der Kette
    durchfallen: Das Testvideo liegt bei -21,9 LUFS. Gemessen, nicht vermutet.

    Eine Sperre, die eingefuehrte Faelle abweist, wird nach zwei Tagen
    abgeschaltet — und dann prueft gar nichts mehr. Also wird die Abweichung
    gemessen und vermerkt, und die Grenze erst dann enger gezogen, wenn die
    Zahlen zeigen, dass die Renderer danebenliegen.
    """
    daneben = _testvideo(werkstatt / "daneben.mp4", dauer=15.0)
    ergebnis = quality_gate.pruefe(daneben)
    assert ergebnis.bestanden is True, ergebnis.gruende
    assert ergebnis.lufs is not None
    assert abs(ergebnis.lufs - (-14.0)) > 6.0, (
        "dieser Test setzt voraus, dass das Testvideo deutlich neben dem "
        f"Zielwert liegt — es liegt bei {ergebnis.lufs:.1f} LUFS"
    )


@hat_ffmpeg
def test_lautheit_echter_stille_ist_kein_none(werkstatt):
    """ffmpeg meldet bei echter Stille "-inf".

    Ohne Sonderbehandlung waere daraus None geworden — "nicht messbar" —,
    und "nicht messbar" haette die Pruefung durchgelassen. Der schlechteste
    Fall darf nicht wie ein fehlendes Messgeraet aussehen.
    """
    still = _video_mit_stiller_tonspur(werkstatt / "inf.mp4", dauer=6.0)
    wert = common.lautheit(still)
    assert wert is not None
    assert wert < -60.0, f"echte Stille muss sehr klein sein, war {wert}"


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


# ── Helligkeit und schwarzer Anfang (Punkte 43 und 52) ───────────────
#
# Weisser Text auf hellem Wasser ist unlesbar, und das passiert bei fremdem
# Material staendig, weil niemand den Hintergrund selbst gedreht hat. Auffallen
# tut es erst am Handy in der Sonne — also nach dem Veroeffentlichen.
# Kontrast ist messbar, nicht Geschmack.

def _farbvideo(ziel: Path, farbe: str, *, dauer: float = 2.0,
               groesse: str = "320x568") -> Path:
    ziel.parent.mkdir(parents=True, exist_ok=True)
    common.lauf([
        "-f", "lavfi", "-i", f"color=c={farbe}:s={groesse}:d={dauer},format=yuv420p",
        "-c:v", "libx264", str(ziel),
    ])
    return ziel


@hat_ffmpeg
def test_helligkeit_wird_gemessen_und_schwarz_ist_nicht_null(tmp_path):
    """Die Grenze fuer "schwarz" ist gemessen — der erste Entwurf war falsch.

    Er stand bei 12,0, in der Annahme, Schwarz sei 0. yuv420p bildet Helligkeit
    aber auf die TV-Range 16..235 ab: Reines Schwarz misst 16. Eine Grenze bei
    12 haette NIE ausgeloest — die Pruefung waere eingebaut gewesen und haette
    nichts geprueft.
    """
    schwarz = _farbvideo(tmp_path / "schwarz.mp4", "black")
    weiss = _farbvideo(tmp_path / "weiss.mp4", "white")

    y_schwarz = common.helligkeit(schwarz)
    y_weiss = common.helligkeit(weiss)

    assert y_schwarz == pytest.approx(16.0, abs=1.0), "reines Schwarz misst 16, nicht 0"
    assert y_weiss == pytest.approx(235.0, abs=1.0), "reines Weiss misst 235, nicht 255"

    # GEGENPROBE: Genau deshalb liegt die Grenze ueber 16. Mit dem ersten
    # Entwurf (12,0) waere reines Schwarz durchgegangen.
    assert common.SCHWARZ_GRENZE_YAVG > y_schwarz
    assert 12.0 < y_schwarz, "die alte Grenze lag UNTER dem Messwert von Schwarz"


@hat_ffmpeg
def test_ein_schwarzer_anfang_wird_erkannt(tmp_path):
    schwarz = _farbvideo(tmp_path / "schwarz.mp4", "black")
    weiss = _farbvideo(tmp_path / "weiss.mp4", "white")

    assert common.erstes_bild_schwarz(schwarz) is True
    assert common.erstes_bild_schwarz(weiss) is False

    # GEGENPROBE: Gemessen werden die ersten 0,3 Sekunden, nicht das ganze
    # Video. Ein Clip, der schwarz ANFAENGT und dann hell wird, muss auffallen
    # — genau das ist der Fall beim Verketten mit Fade.
    gemischt = tmp_path / "schwarzstart.mp4"
    common.lauf([
        "-i", str(schwarz), "-i", str(weiss),
        "-filter_complex",
        "[0:v]trim=0:0.4,setpts=PTS-STARTPTS[a];"
        "[1:v]trim=0:1.6,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(gemischt),
    ])
    assert common.erstes_bild_schwarz(gemischt) is True
    assert common.helligkeit(gemischt) > common.SCHWARZ_GRENZE_YAVG, \
        "ueber das ganze Video gemittelt waere er hell — deshalb zaehlt der Anfang"


@hat_ffmpeg
def test_der_untertitelbereich_wird_getrennt_gemessen(tmp_path):
    """Gemessen wird der Bereich UNTER dem Textkasten, nicht das ganze Bild."""
    bereich = common.untertitel_bereich(1080, 1920)
    breite, hoehe, x, y = bereich
    assert x == common.SAFE_SEITE
    assert y + hoehe <= 1920 - common.SAFE_UNTEN + 1, \
        "der Bereich muss oberhalb der TikTok-Bedienelemente liegen"

    weiss = _farbvideo(tmp_path / "weiss.mp4", "white", groesse="1080x1920")
    hell = common.helligkeit(weiss, ausschnitt=bereich)
    assert hell > common.HELL_GRENZE_YAVG

    # GEGENPROBE: Ein dunkles Video mit demselben Ausschnitt liegt darunter —
    # die Messung haengt am Bild, nicht am Ausschnitt.
    dunkel = _farbvideo(tmp_path / "dunkel.mp4", "0x202020", groesse="1080x1920")
    assert common.helligkeit(dunkel, ausschnitt=bereich) < common.HELL_GRENZE_YAVG


@hat_ffmpeg
def test_der_bereich_kommt_aus_denselben_werten_wie_der_ass_stil(tmp_path):
    """Zwei Zahlenreihen fuer dasselbe waeren die Fehlerklasse "zweite Liste"."""
    _, _, x, _ = common.untertitel_bereich(1080, 1920)
    assert x == common.SAFE_SEITE

    # GEGENPROBE: Wird SAFE_SEITE geaendert, wandert der Messbereich mit.
    # Ohne diese Kopplung wuerde die Pruefung nach einer Stilaenderung an der
    # falschen Stelle messen und weiter gruen melden.
    alt = common.SAFE_SEITE
    try:
        common.SAFE_SEITE = 200
        _, _, x2, _ = common.untertitel_bereich(1080, 1920)
        assert x2 == 200
    finally:
        common.SAFE_SEITE = alt


def test_nicht_messbare_dateien_geben_none(tmp_path):
    kaputt = tmp_path / "kaputt.mp4"
    kaputt.write_bytes(b"kein video")
    assert common.helligkeit(kaputt) is None
    assert common.erstes_bild_schwarz(kaputt) is None

    # GEGENPROBE: "nicht messbar" ist NICHT dasselbe wie "schwarz". Ein None,
    # das als True gelesen wird, meldet bei jeder unlesbaren Datei einen
    # schwarzen Anfang — und nach der dritten Fehlmeldung liest niemand mehr.
    assert common.erstes_bild_schwarz(kaputt) is not True


# ── Schriftbild aus einer Quelle (Punkt 42) ──────────────────────────
#
# Fuenf ASS-Zeilen mit rohen Farbwerten an zwei Stellen im Quelltext sind kein
# Design. Und eine Zahl wie &H0000E5FF liest niemand als Farbe.

def test_ass_dreht_die_farbkanaele_um():
    """Genau daran scheitert jeder, der eine Farbe von Hand eintraegt."""
    assert common.hex_zu_ass("#ff8c00") == "&H00008CFF"
    assert common.hex_zu_ass("#ffffff") == "&H00FFFFFF"
    assert common.hex_zu_ass("#000000") == "&H00000000"
    # Kurzform wird aufgefuellt.
    assert common.hex_zu_ass("#fff") == common.hex_zu_ass("#ffffff")
    # Alpha ist die DURCHSICHTIGKEIT, nicht die Deckkraft — auch das
    # andersherum als ueberall sonst.
    assert common.hex_zu_ass("#000000", alpha=128) == "&H80000000"

    # GEGENPROBE: Ohne die Umkehrung waere aus #ff8c00 ein &H00FF8C00 geworden
    # — in ASS gelesen ein Blauton statt Orange.
    assert common.hex_zu_ass("#ff8c00") != "&H00FF8C00"
    with pytest.raises(ValueError):
        common.hex_zu_ass("orange")


def test_die_schriftgroessen_bleiben_wie_sie_waren():
    """Umgestellt auf Anteile — bei 1920 Pixeln muss dasselbe herauskommen."""
    assert common.schriftgroesse("standard") == 64
    assert common.schriftgroesse("hook") == 76
    assert common.schriftgroesse("name") == 58
    assert common.schriftgroesse("preis") == 64
    assert common.schriftgroesse("hinweis") == 44

    # Bei halber Bildhoehe halbe Groesse — das ist der Sinn der Umstellung.
    assert common.schriftgroesse("standard", hoehe=960) == 32

    # GEGENPROBE: Nie kleiner als lesbar. Eine Vorschau in 240p soll nicht
    # 8-Pixel-Schrift bekommen.
    assert common.schriftgroesse("hinweis", hoehe=100) == 20


def test_der_preis_traegt_die_farbe_des_shops(tmp_path):
    """Gemessen: Er trug vorher Gelb, der Shop ist Orange."""
    ass = common._endkarten_text(tmp_path / "e.ass", name="Wasserspender",
                                 preistext="24,99 EUR", hinweis="maios.de")
    text = ass.read_text(encoding="utf-8")
    preis = [z for z in text.splitlines() if z.startswith("Style: Preis")][0]

    assert common.hex_zu_ass(common.markenfarbe()) in preis
    assert common.markenfarbe() == "#ff8c00"

    # GEGENPROBE: Der alte Wert steht nicht mehr drin. &H0000E5FF ist
    # RGB(255, 229, 0) — Gelb, nicht das Orange des Shops.
    assert "&H0000E5FF" not in preis
    # Und die anderen Zeilen bleiben weiss — nur der Preis ist farbig.
    for rolle in ("Name", "Hinweis"):
        zeile = [z for z in text.splitlines() if z.startswith(f"Style: {rolle}")][0]
        assert common.WEISS in zeile


def test_der_untertitelstil_bleibt_bitgleich(tmp_path):
    """Die Umstellung auf eine Quelle darf das Aussehen NICHT aendern."""
    ass = common.schreibe_untertitel(
        [{"von": 0, "bis": 2, "text": "Hallo"}], tmp_path / "u.ass", hook="Hook")
    zeilen = ass.read_text(encoding="utf-8").splitlines()
    standard = [z for z in zeilen if z.startswith("Style: Standard")][0]
    hook = [z for z in zeilen if z.startswith("Style: Hook")][0]

    # Exakt die Werte, die vor der Umstellung fest im Quelltext standen.
    assert standard.endswith(f",1,1,4,2,2,{common.SAFE_SEITE},{common.SAFE_SEITE},"
                             f"{common.SAFE_UNTEN},1")
    assert ",64," in standard and common.WEISS in standard
    assert ",76," in hook and "&H70000000" in hook

    # GEGENPROBE: Aendert man die Markenfarbe, aendert sich der Untertitel
    # NICHT — er ist weiss und bleibt es. Nur der Preis haengt an der Marke.
    assert common.hex_zu_ass("#ff8c00") not in standard


# ── Werbekennzeichnung im Bild (Punkt 67) ────────────────────────────

def test_die_endkarte_traegt_immer_werbung(tmp_path):
    """Ein Beitrag, der eigene Produkte bewirbt, ist Werbung — auch auf dem
    eigenen Kanal."""
    ass = common._endkarten_text(tmp_path / "e.ass", name="Wasserspender",
                                 preistext="24,99 EUR", hinweis="maios.de")
    text = ass.read_text(encoding="utf-8")

    assert "Style: Kennzeichnung" in text
    zeile = [z for z in text.splitlines()
             if z.startswith("Dialogue") and "Kennzeichnung" in z][0]
    assert common.KENNZEICHNUNG in zeile

    # SIE STEHT OBEN (Alignment 8), nicht unten bei Preis und Adresse: Dort
    # liegen die Bedienelemente der Plattform, und eine Kennzeichnung, die
    # hinter dem Kontonamen verschwindet, ist keine.
    stil = [z for z in text.splitlines() if z.startswith("Style: Kennzeichnung")][0]
    assert stil.split(",")[10] == "8", "Alignment 8 = oben"

    # GEGENPROBE: Es gibt KEINEN Weg, sie wegzulassen. _endkarten_text nimmt
    # drei Texte entgegen — keiner davon steuert die Kennzeichnung.
    import inspect
    unterschrift = inspect.signature(common._endkarten_text)
    assert "kennzeichnung" not in str(unterschrift).lower()
    # Auch mit leeren Texten bleibt sie da.
    leer = common._endkarten_text(tmp_path / "l.ass", name="", preistext="", hinweis="")
    assert common.KENNZEICHNUNG in leer.read_text(encoding="utf-8")


# ── Sperrzonen der Plattform (Punkt 31) ──────────────────────────────

def test_die_sperrzonen_kommen_aus_der_konfiguration():
    zone = common.sperrzonen()
    assert zone == {"unten": 320, "rechts": 160, "oben": 120}

    # GEGENPROBE: Es sind SCHAETZUNGEN der Plattform, keine Messungen an
    # unserem Bild. Deshalb stehen sie in der Konfiguration — wer nachmisst,
    # traegt sie dort ein, ohne Code anzufassen.
    from pipelines.orchestrator import guardrails
    assert guardrails.wert("video.sperrzone_rechts", None) == 160


def test_eine_volle_untertitelzeile_laeuft_unter_die_symbolspalte():
    """NACHGEMESSEN, nicht vermutet — sonst waere die Warnung nichts wert."""
    probleme = common.textzonen_verletzung()
    rechts = [p for p in probleme if "Symbolspalte" in p]
    assert len(rechts) == 1
    assert "20 Zeichen" in rechts[0]
    assert "kurze Zeilen bleiben davor" in rechts[0], \
        "die Meldung darf nicht pauschal behaupten, jeder Text rage hinein"

    # Die Zahl stimmt: Seitenrand 80, Symbolspalte 160, also 80 px Ueberlappung.
    assert common.SAFE_SEITE == 80
    assert common.sperrzonen()["rechts"] == 160
    assert "80 px" in rechts[0]

    # GEGENPROBE: Unten und oben ist alles in Ordnung — die Pruefung meldet
    # nicht einfach alles.
    assert not [p for p in probleme if "Untertitel sitzt" in p]
    assert not [p for p in probleme if "Hook sitzt" in p]


@hat_ffmpeg
def test_der_text_erreicht_die_symbolspalte_wirklich(tmp_path):
    """Die Messung, auf der die Warnung beruht — hier nachgestellt.

    Weisser Text auf schwarzem Bild, dann die rechten 160 Pixel abtasten.
    Eine volle Zeile leuchtet dort, eine kurze nicht.
    """
    schwarz = tmp_path / "sw.png"
    common.lauf(["-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=1",
                 "-frames:v", "1", str(schwarz)])

    def hell_rechts(text: str) -> float:
        ass = common.schreibe_untertitel([{"von": 0, "bis": 2, "text": text}],
                                         tmp_path / "m.ass")
        ziel = tmp_path / "m.png"
        common.lauf(["-i", str(schwarz),
                     "-vf", f"subtitles='{common._ass_pfad(ass)}'",
                     "-frames:v", "1", "-y", str(ziel)])
        zone = common.sperrzonen()["rechts"]
        return common.helligkeit(ziel, ausschnitt=(zone, 1920, 1080 - zone, 0)) or 0.0

    voll = hell_rechts("M" * common.MAX_ZEICHEN_JE_ZEILE)
    kurz = hell_rechts("Kurz")

    assert voll > kurz, "die volle Zeile reicht weiter nach rechts"
    assert voll > 16.5, "in der Symbolspalte steht Text (Schwarz waere 16)"
    assert kurz < 17.0, "die kurze Zeile bleibt davor"
