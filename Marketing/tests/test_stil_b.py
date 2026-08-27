"""Tests fuer Stil B (KI-Video) — vor allem fuer die erzwungene Produkttreue.

DER PFLICHTTEST IST test_produkttreue_wird_erzwungen.

Warum das der wichtigste Test dieser Etappe ist: Reines Text-zu-Video
erfindet das Produkt. Es entsteht etwas, das aussieht wie eine Lampe, aber
nicht wie DIESE Lampe. Wer danach bestellt, bekommt etwas anderes als
beworben — das ist irrefuehrende Werbung und obendrein eine Retoure mit
Ansage.

Der alte Stand hat genau das getan: Der Runway-Aufruf stand auf
"mode": "text". Deshalb wird die Regel jetzt im Programm erzwungen und hier
geprueft — mit einem Anbieter-Nachbau, der KEIN Bild-zu-Video kann.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from pipelines import products
from pipelines.video import common, style_b_aigen as sb

hat_ffmpeg = pytest.mark.skipif(
    not common.verfuegbar()[0], reason=f"kein ffmpeg — {common.verfuegbar()[1]}"
)


class NurText(sb.VideoAnbieter):
    """Anbieter, der NUR Text-zu-Video kann — so wie der alte Stand."""

    name = "nur_text"
    kann_bild_zu_video = False

    def bereit(self):
        return True, None

    def erzeuge(self, prompt, ziel, *, dauer, startbild, seed):
        # Wuerde hier ein Video erfinden. Darf fuer Produkte nie erreicht werden.
        Path(ziel).write_bytes(b"erfundenes Produkt")
        return Path(ziel)


class MitBild(sb.VideoAnbieter):
    """Anbieter, der Bild-zu-Video kann — erzeugt ein echtes Testvideo."""

    name = "mit_bild"
    kann_bild_zu_video = True

    def __init__(self):
        self.startbilder = []

    def bereit(self):
        return True, None

    def erzeuge(self, prompt, ziel, *, dauer, startbild, seed):
        self.startbilder.append(startbild)
        common.lauf([
            "-f", "lavfi", "-i", f"testsrc=size=720x1280:rate=30:duration={dauer}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", f"{dauer}", str(ziel),
        ])
        return Path(ziel)


@pytest.fixture
def produktfoto(tmp_path):
    """Ein echtes Bild — Grundlage jeder Produkt-Einstellung."""
    ziel = tmp_path / "produkt.png"
    common.lauf(["-f", "lavfi", "-i", "color=c=darkgreen:s=1200x1600",
                 "-frames:v", "1", str(ziel)])
    return ziel


# ══════════════════════════════════════════════════════════════════════
# 1. Produkttreue
# ══════════════════════════════════════════════════════════════════════

@hat_ffmpeg
def test_produkttreue_wird_erzwungen(tmp_path, produktfoto):
    """Ein Anbieter ohne Bild-zu-Video darf KEINE Produkt-Einstellung bauen."""
    einstellung = sb.Einstellung(
        nummer=1, dauer=4.0, prompt="Produkt auf dem Schreibtisch",
        kamera="Fahrt nach vorn", stimmung="Morgen", mit_produkt=True,
    )
    with pytest.raises(sb.ProdukttreueVerletzt) as fehler:
        sb.erzeuge_einstellung(NurText(), einstellung, produktfoto,
                               tmp_path / "shot.mp4", seed=1)
    assert "Bild-zu-Video" in str(fehler.value)
    assert not (tmp_path / "shot.mp4").exists(), \
        "es darf nicht einmal eine Datei entstanden sein"


@hat_ffmpeg
def test_produkttreue_gegenprobe(tmp_path, produktfoto):
    """GEGENPROBE: MIT Bild-zu-Video entsteht die Einstellung — aus dem echten Foto.

    Ohne das koennte der Test oben auch gruen sein, wenn generell nichts
    erzeugt wuerde.
    """
    anbieter = MitBild()
    einstellung = sb.Einstellung(
        nummer=1, dauer=4.0, prompt="Produkt auf dem Schreibtisch",
        kamera="Fahrt nach vorn", stimmung="Morgen", mit_produkt=True,
    )
    ergebnis = sb.erzeuge_einstellung(anbieter, einstellung, produktfoto,
                                      tmp_path / "shot.mp4", seed=1)
    assert ergebnis.exists() and ergebnis.stat().st_size > 5000
    assert anbieter.startbilder == [produktfoto], \
        "das echte Produktfoto muss als Startbild uebergeben werden"


@hat_ffmpeg
def test_produkt_einstellung_ohne_foto_wird_abgelehnt(tmp_path):
    """Kein echtes Foto -> keine Produkt-Einstellung. Auch nicht 'irgendwie'."""
    einstellung = sb.Einstellung(
        nummer=1, dauer=4.0, prompt="Produkt", kamera="Fahrt",
        stimmung="Morgen", mit_produkt=True,
    )
    with pytest.raises(sb.ProdukttreueVerletzt):
        sb.erzeuge_einstellung(MitBild(), einstellung, None, tmp_path / "s.mp4", seed=1)


@hat_ffmpeg
def test_stimmungsbild_darf_ohne_startbild(tmp_path):
    """Eine Einstellung OHNE Produkt darf frei erzeugt werden.

    Sonst waere die Regel unbrauchbar streng: Ein leerer Schreibtisch im
    Fensterlicht zeigt kein Produkt und kann deshalb auch keines erfinden.
    """
    anbieter = MitBild()
    einstellung = sb.Einstellung(
        nummer=2, dauer=4.0, prompt="leerer Schreibtisch im Fensterlicht",
        kamera="Schwenk", stimmung="Morgen", mit_produkt=False,
    )
    ergebnis = sb.erzeuge_einstellung(anbieter, einstellung, None,
                                      tmp_path / "mood.mp4", seed=1)
    assert ergebnis.exists()
    assert anbieter.startbilder == [None], "Stimmungsbild braucht kein Startbild"


# ══════════════════════════════════════════════════════════════════════
# 2. Shot-Liste
# ══════════════════════════════════════════════════════════════════════

def test_erste_einstellung_zeigt_immer_das_produkt():
    """Der Aufhaenger entscheidet in den ersten Sekunden.

    Dort etwas Erfundenes zu zeigen waere der schlechteste denkbare Einstieg.
    """
    produkt = products.alle()[0]
    for gesamtdauer in (12.0, 20.0, 30.0):
        einstellungen = sb.plane_einstellungen({}, produkt, gesamtdauer)
        assert einstellungen[0].mit_produkt is True
        assert einstellungen[-1].mit_produkt is True, "auch die letzte zeigt das Produkt"


def test_shot_liste_haelt_die_vorgaben_ein():
    """3-5 Einstellungen a 3-5 Sekunden."""
    produkt = products.alle()[0]
    for gesamtdauer in (12.0, 18.0, 25.0, 40.0):
        einstellungen = sb.plane_einstellungen({}, produkt, gesamtdauer)
        assert 3 <= len(einstellungen) <= 5, f"{len(einstellungen)} Einstellungen"
        for e in einstellungen:
            assert 3.0 <= e.dauer <= 5.0, f"Einstellung {e.nummer}: {e.dauer}s"
            assert e.prompt and e.kamera


def test_prompts_tragen_den_bildstil_aus_der_markenstimme():
    """brand_voice.md muss wirken, nicht nur dokumentieren.

    Wenn dort die Farben geaendert werden, muessen sich die Prompts aendern —
    sonst ist die Datei Deko.
    """
    produkt = products.alle()[0]
    stil = sb.bildstil()
    assert stil, "kein Bildstil aus brand_voice.md gelesen"
    einstellungen = sb.plane_einstellungen({}, produkt, 20.0)
    kern = stil.split(";")[0][:24]
    assert any(kern in e.prompt for e in einstellungen), \
        "der Bildstil taucht in keinem Prompt auf"


def test_seed_ist_je_kampagne_stabil():
    """Fester Wert je Kampagne — sonst sieht jede Einstellung anders aus.

    Der alte Stand wuerfelte je Einstellung neu; das Ergebnis war ein Video
    aus fuenf unterschiedlichen Bildwelten.
    """
    assert sb.kampagnen_seed(7, 21) == sb.kampagnen_seed(7, 21)
    assert sb.kampagnen_seed(7, 21) != sb.kampagnen_seed(8, 21)


# ══════════════════════════════════════════════════════════════════════
# 3. Anbieter
# ══════════════════════════════════════════════════════════════════════

def test_kein_anbieter_ohne_zugangsdaten():
    """Ohne Schluessel gibt es keinen Anbieter — und einen klaren Grund."""
    anbieter, info = sb.bester_anbieter()
    if anbieter is not None:
        pytest.skip("es ist ein Anbieter eingerichtet")
    assert "RUNWAY_API_KEY" in info or "MARKETING_RENDER_BACKEND" in info, info


def test_runway_hat_ein_zeitlimit():
    """Der alte Stand hatte eine Warteschleife OHNE Zeitlimit.

    Ein beim Anbieter haengender Auftrag haette den Job dauerhaft blockiert.
    """
    assert sb.RunwayAnbieter.ZEITLIMIT_SEK > 0
    quelltext = Path(sb.__file__).read_text(encoding="utf-8")
    assert "TimeoutError" in quelltext, "kein Abbruch nach Zeitlimit vorgesehen"


def test_pika_ist_raus():
    """Der Pika-Weg legte eine LEERE Datei an und meldete Erfolg."""
    quelltext = Path(sb.__file__).read_text(encoding="utf-8").lower()
    for verboten in ("pika_api_key", "pika_workflow_id", "_request_pika"):
        assert verboten not in quelltext, f"'{verboten}' ist noch vorhanden"


def _quelltext_ohne_erlaeuterungen() -> str:
    """Programmtext ohne Beschreibungen und Kommentare.

    Noetig, weil die Erlaeuterungen absichtlich beschreiben, WAS frueher
    falsch war — inklusive der falschen Zeichenkette. Ein Test, der schon das
    Vorkommen im Kommentar verbietet, wuerde die Begruendung mitloeschen.
    """
    import ast

    quelle = Path(sb.__file__).read_text(encoding="utf-8")
    baum = ast.parse(quelle)
    beschreibungen = set()
    for knoten in ast.walk(baum):
        if isinstance(knoten, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            text = ast.get_docstring(knoten, clean=False)
            if text:
                beschreibungen.add(text)
    for text in beschreibungen:
        quelle = quelle.replace(text, "")
    # Zeilenkommentare ebenfalls raus.
    return "\n".join(z.split("#")[0] for z in quelle.splitlines())


def test_runway_nutzt_kein_text_zu_video():
    """Der alte Aufruf stand auf mode='text' — genau das erfindet das Produkt."""
    programm = _quelltext_ohne_erlaeuterungen()
    assert '"mode": "text"' not in programm, "Text-zu-Video wird noch angefordert"
    assert '"promptImage"' in programm, "es wird kein Startbild uebergeben"
    assert "image_to_video" in programm, "Bild-zu-Video wird nicht verwendet"


# ══════════════════════════════════════════════════════════════════════
# 4. Zusammenspiel mit dem Briefing
# ══════════════════════════════════════════════════════════════════════

def test_ohne_anbieter_entstehen_keine_stil_b_briefings():
    """Sonst fuellt sich eine Warteschlange, die nie abgearbeitet wird.

    Jeder einzelne Lauf meldete dann sauber "keine Stil-B-Briefings
    gerendert" — und niemand merkte, dass ein Drittel der Produktion still
    liegen bleibt.
    """
    from pipelines.creative import brief_generator

    moeglich, _ = sb.stil_b_moeglich()
    if moeglich:
        pytest.skip("es ist ein KI-Anbieter eingerichtet")
    for _ in range(20):
        assert brief_generator.waehle_stil() == "A", \
            "ohne Anbieter darf Stil B nicht gewaehlt werden"


def test_endkarte_kommt_nie_aus_der_ki():
    """Das letzte Bild muss das echte Produkt zeigen.

    Geprueft am Quelltext: Die Endkarte wird ueber common.baue_endkarte aus
    einem Dateipfad gebaut, nicht ueber den Anbieter.
    """
    quelltext = Path(sb.__file__).read_text(encoding="utf-8")
    assert "common.baue_endkarte(" in quelltext
    stelle = quelltext.index("common.baue_endkarte(")
    umgebung = quelltext[stelle - 400:stelle]
    assert "produktfoto" in umgebung or "produktfoto" in quelltext[stelle:stelle + 200], \
        "die Endkarte muss aus dem echten Produktfoto gebaut werden"
