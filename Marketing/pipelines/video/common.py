"""ffmpeg-Grundlage: Auffinden, Aufrufen, Messen, Untertitel, Endkarte.

WARUM FFMPEG HIER GESUCHT UND NICHT VORAUSGESETZT WIRD

Am 14.08. installiert (FFmpeg 9.0 ueber winget) — und trotzdem war "ffmpeg"
in der laufenden Shell nicht aufrufbar: winget traegt den Pfad in die
Registry ein, aber schon laufende Prozesse erben ihn nicht. In GitHub Actions
liegt ffmpeg dagegen im PATH, auf einem Linux-Server wieder woanders.

Ein hart verdrahtetes "ffmpeg" haette also je nach Ort funktioniert oder
nicht. Deshalb wird es der Reihe nach gesucht: ENV, PATH, bekannte
Installationsorte. Findet sich keins, ist das ein sauberer Zustand mit
Begruendung — kein Absturz.

WAS HIER SONST NOCH WICHTIG IST

Alle Masse stehen in marketing.config.json, nicht im Code: Aufloesung,
Laufzeitgrenzen, Lautheit, Schnittabstaende. Ein Video, das die Vorgaben
verfehlt, wird spaeter vom quality_gate abgewiesen — die beiden Stellen
muessen sich also auf dieselbe Quelle beziehen.
"""

from __future__ import annotations

import glob
import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from ..env_loader import MARKETING_DIR
from ..orchestrator import guardrails

def _datenordner() -> Path:
    """Wohin Renderings und Tonspuren geschrieben werden.

    Normalfall ist Marketing/data. Ueberschreibbar mit MARKETING_DATA_DIR —
    gebraucht wird das an zwei Stellen:

      * GitHub Actions: dort ist der Checkout fluechtig, ein Lauf kann also
        genauso gut in den Temp-Ordner des Runners schreiben.
      * abgeschottete Umgebungen, in denen ein Unterprozess nicht in den
        Projektordner schreiben darf.

    Beides sind Faelle, in denen ein fest verdrahteter Pfad den ganzen
    Rendervorgang scheitern laesst — und zwar erst ganz am Ende, nach der
    gesamten Rechenarbeit.
    """
    aus_env = (os.environ.get("MARKETING_DATA_DIR") or "").strip()
    return Path(aus_env) if aus_env else (MARKETING_DIR / "data")


DATEN = _datenordner()
RENDERS = DATEN / "renders"
AUDIO = DATEN / "audio"

# Die Ordner beim Import anlegen — NICHT erst beim Schreiben.
#
# Niemand sonst legt sie an. Sie sind gitignored, und Git kennt keine leeren
# Verzeichnisse — auf einem FRISCHEN Checkout sind sie also garantiert weg.
# Genau so laeuft jeder GitHub-Actions-Durchgang: neuer Checkout, kein
# data/-Ordner. Der erste Renderversuch waere dort mit
#
#     Error opening output …/data/renders/brief_99_stil_a.mp4:
#     No such file or directory
#
# gescheitert — und der Lauf waere trotzdem GRUEN geblieben, denn der Job
# meldet brav 'gerendert: 0, verworfen: 2' und wirft nicht. Waehrend der
# Entwicklung faellt es nicht auf, weil MARKETING_DATA_DIR dort auf einen
# bereits vorhandenen Ordner zeigt.
#
# Belegt ist das durch test_ausgabeordner_entstehen_von_selbst: ohne diese
# zwei Zeilen entstehen die Ordner nachweislich nicht.
#
# ZUR EINORDNUNG: In einer abgeschotteten Umgebung, in der ein Unterprozess
# gar nicht in den Projektordner schreiben darf, meldet ffmpeg denselben
# Fehler, obwohl der Ordner da ist. Dagegen hilft nur MARKETING_DATA_DIR —
# das ist ein anderer Fall als dieser hier.
#
# exist_ok=True heisst: Der Aufruf ist harmlos, wenn der Ordner schon da ist.
try:
    RENDERS.mkdir(parents=True, exist_ok=True)
    AUDIO.mkdir(parents=True, exist_ok=True)
except OSError as fehler:  # pragma: no cover — nur bei fehlenden Schreibrechten
    # Kein Abbruch beim Import: Ein Lauf ohne Rendern soll trotzdem starten.
    # Der Renderversuch scheitert dann spaeter mit einer klaren Meldung.
    print(f"[video] Ausgabeordner nicht anlegbar ({fehler}) — Rendern wird scheitern.")

# Sichtbarer Bereich: TikTok blendet oben und unten eigene Bedienelemente ein.
# Untertitel und Text muessen innerhalb dieser Raender bleiben, sonst liegen
# sie unter dem Beschreibungstext oder der Fortschrittsleiste.
SAFE_OBEN = 220
SAFE_UNTEN = 420
SAFE_SEITE = 80


class KeinFfmpeg(RuntimeError):
    """ffmpeg ist nicht auffindbar."""


# ── Auffinden ────────────────────────────────────────────────────────

def _suche(name: str) -> str | None:
    # 1) Ausdrueckliche Angabe gewinnt immer.
    aus_env = (os.environ.get("MARKETING_FFMPEG_DIR") or "").strip()
    if aus_env:
        kandidat = Path(aus_env) / (name + (".exe" if os.name == "nt" else ""))
        if kandidat.exists():
            return str(kandidat)

    # 2) Normalfall: im PATH (so ist es in GitHub Actions).
    gefunden = shutil.which(name)
    if gefunden:
        return gefunden

    # 3) Windows/winget: der Pfad steht in der Registry, aber laufende
    #    Prozesse kennen ihn erst nach einem Neustart der Shell.
    muster = [
        os.path.expandvars(
            r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin"
        ),
        os.path.expandvars(r"%ProgramFiles%\ffmpeg\bin"),
        "/usr/bin", "/usr/local/bin", "/opt/homebrew/bin",
    ]
    for eintrag in muster:
        for ordner in glob.glob(eintrag):
            kandidat = Path(ordner) / (name + (".exe" if os.name == "nt" else ""))
            if kandidat.exists():
                return str(kandidat)
    return None


_pfade: dict[str, str | None] = {}


def ffmpeg_pfad() -> str | None:
    if "ffmpeg" not in _pfade:
        _pfade["ffmpeg"] = _suche("ffmpeg")
    return _pfade["ffmpeg"]


def ffprobe_pfad() -> str | None:
    if "ffprobe" not in _pfade:
        _pfade["ffprobe"] = _suche("ffprobe")
    return _pfade["ffprobe"]


def verfuegbar() -> tuple[bool, str | None]:
    """(True, None) wenn gerendert werden kann — sonst der Grund im Klartext."""
    if ffmpeg_pfad() is None:
        return False, (
            "ffmpeg nicht gefunden — im PATH oder ueber MARKETING_FFMPEG_DIR bereitstellen "
            "(Windows: neue Shell oeffnen, winget setzt den PATH erst fuer neue Prozesse)"
        )
    if ffprobe_pfad() is None:
        return False, "ffprobe nicht gefunden (gehoert zur ffmpeg-Installation)"
    return True, None


# ── Aufrufen ─────────────────────────────────────────────────────────

def lauf(argumente: Sequence[str], *, zeitlimit: int = 900) -> str:
    """ffmpeg aufrufen. Wirft mit der ECHTEN Fehlermeldung von ffmpeg.

    ffmpeg schreibt alles nach stderr, auch im Erfolgsfall. Bei einem Fehler
    stehen dort die entscheidenden Zeilen ganz unten — die werden
    durchgereicht, statt nur "Rueckgabewert 1" zu melden.
    """
    pfad = ffmpeg_pfad()
    if pfad is None:
        raise KeinFfmpeg(verfuegbar()[1])
    ergebnis = subprocess.run(
        [pfad, "-hide_banner", "-nostdin", "-y", *argumente],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=zeitlimit,
    )
    if ergebnis.returncode != 0:
        letzte = "\n".join((ergebnis.stderr or "").strip().splitlines()[-6:])
        raise RuntimeError(f"ffmpeg fehlgeschlagen:\n{letzte}")
    return ergebnis.stderr or ""


@dataclass(frozen=True)
class MedienInfo:
    dauer: float
    breite: int
    hoehe: int
    hat_ton: bool
    video_codec: str | None
    audio_codec: str | None
    groesse_byte: int


def medien_info(pfad: str | Path) -> MedienInfo | None:
    """Was steckt wirklich in der Datei? None, wenn sie unlesbar ist.

    Absichtlich ueber ffprobe und nicht ueber die Dateiendung: Eine Datei
    kann .mp4 heissen und 0 Byte gross sein — genau so lagen bis Runde 10
    neun angebliche Videos im Projekt.
    """
    p = Path(pfad)
    if not p.exists():
        return None
    groesse = p.stat().st_size
    if groesse == 0:
        return MedienInfo(0.0, 0, 0, False, None, None, 0)

    werkzeug = ffprobe_pfad()
    if werkzeug is None:
        return None
    ergebnis = subprocess.run(
        [werkzeug, "-v", "error", "-print_format", "json",
         "-show_format", "-show_streams", str(p)],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120,
    )
    if ergebnis.returncode != 0:
        return MedienInfo(0.0, 0, 0, False, None, None, groesse)
    try:
        daten = json.loads(ergebnis.stdout)
    except json.JSONDecodeError:
        return MedienInfo(0.0, 0, 0, False, None, None, groesse)

    video = next((s for s in daten.get("streams", []) if s.get("codec_type") == "video"), None)
    ton = next((s for s in daten.get("streams", []) if s.get("codec_type") == "audio"), None)
    try:
        dauer = float(daten.get("format", {}).get("duration", 0.0))
    except (TypeError, ValueError):
        dauer = 0.0

    return MedienInfo(
        dauer=dauer,
        breite=int(video.get("width", 0)) if video else 0,
        hoehe=int(video.get("height", 0)) if video else 0,
        hat_ton=ton is not None,
        video_codec=video.get("codec_name") if video else None,
        audio_codec=ton.get("codec_name") if ton else None,
        groesse_byte=groesse,
    )


def tondauer(pfad: str | Path) -> float:
    info = medien_info(pfad)
    return info.dauer if info else 0.0


# ── Schriftart ───────────────────────────────────────────────────────

def schriftart() -> str | None:
    """Eine Schriftdatei fuer Untertitel und Endkarte.

    Ohne Schrift kein Text im Bild. Gesucht wird an den ueblichen Orten je
    Betriebssystem; die Angabe laesst sich mit MARKETING_FONT ueberschreiben.
    """
    aus_env = (os.environ.get("MARKETING_FONT") or "").strip()
    if aus_env and Path(aus_env).exists():
        return aus_env
    kandidaten = [
        r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for k in kandidaten:
        if Path(k).exists():
            return k
    return None


def _ass_pfad(pfad: Path) -> str:
    """Pfad so schreiben, dass der subtitles-Filter ihn frisst.

    Unter Windows muessen Doppelpunkt und Backslash im Filtergraphen
    maskiert werden — sonst liest ffmpeg "C" als Dateinamen und den Rest als
    Filteroption. Ein klassischer Stolperstein, der nur auf Windows auftritt.
    """
    text = str(pfad.resolve()).replace("\\", "/")
    return text.replace(":", "\\:")


# ── Untertitel ───────────────────────────────────────────────────────

def _ass_zeit(sekunden: float) -> str:
    sekunden = max(sekunden, 0.0)
    stunden = int(sekunden // 3600)
    minuten = int((sekunden % 3600) // 60)
    rest = sekunden % 60
    return f"{stunden}:{minuten:02d}:{rest:05.2f}"


# Wie viele Zeichen eine Untertitelzeile hoechstens haben darf.
# Gemessen an Segoe UI Bold in Groesse 64 auf 1080 px Breite abzueglich der
# Seitenraender: rund 20 Zeichen passen sicher in eine Zeile.
MAX_ZEICHEN_JE_ZEILE = 20


def _bloecke_bilden(woerter: list[str], max_woerter: int) -> list[list[str]]:
    """Woerter zu Anzeigebloecken buendeln — nach Anzahl UND Laenge.

    Die reine Dreier-Regel reicht nicht: "Automatischer Wasserspender fuer"
    sind drei Woerter und trotzdem 32 Zeichen. Ein einzelnes ueberlanges Wort
    bekommt eine eigene Zeile, statt den ganzen Block zu sprengen.
    """
    bloecke: list[list[str]] = []
    aktuell: list[str] = []
    laenge = 0
    for wort in woerter:
        neu = laenge + len(wort) + (1 if aktuell else 0)
        if aktuell and (len(aktuell) >= max_woerter or neu > MAX_ZEICHEN_JE_ZEILE):
            bloecke.append(aktuell)
            aktuell, laenge = [wort], len(wort)
        else:
            aktuell.append(wort)
            laenge = neu
    if aktuell:
        bloecke.append(aktuell)
    return bloecke or [woerter]


def schreibe_untertitel(
    segmente: Sequence[dict[str, Any]],
    ziel: Path,
    *,
    woerter_pro_zeile: int = 3,
    hook: str | None = None,
    hook_dauer: float = 2.5,
) -> Path:
    """Untertitel als ASS-Datei — wortsynchron, kurze Zeilen.

    Warum ASS und nicht SRT: Nur damit laesst sich der Abstand zum unteren
    Rand festlegen. TikTok blendet unten eigene Bedienelemente ein; ein
    Untertitel ohne Rand liegt darunter und ist unlesbar.

    WRAPSTYLE 0 STATT 2 — EIN FEHLER, DER IM FERTIGEN BILD STAND
    WrapStyle 2 heisst "gar nicht umbrechen". Drei Woerter passen zwar fast
    immer, drei LANGE aber nicht: "Automatischer Wasserspender fuer" lief im
    gerenderten Video rechts aus dem Bild heraus. Aufgefallen ist das erst
    beim Anschauen eines Einzelbildes — die Ausgangspruefung sieht nur
    Aufloesung, Laufzeit und Ton, nicht ob Text im Bild steht.

    WrapStyle 0 bricht innerhalb der Seitenraender um. Zusaetzlich begrenzt
    die Blockbildung unten nicht mehr nur die ANZAHL der Woerter, sondern
    auch die Zeichenlaenge — sonst haengt bei langen Woertern die eine Haelfte
    des Blocks in Zeile zwei und die Anzeigedauer passt nicht mehr zum Ton.
    """
    schrift = schriftart()
    schriftname = Path(schrift).stem if schrift else "Arial"

    kopf = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Standard,{schriftname},64,&H00FFFFFF,&H00000000,&H80000000,1,1,4,2,2,{SAFE_SEITE},{SAFE_SEITE},{SAFE_UNTEN},1
Style: Hook,{schriftname},76,&H00FFFFFF,&H00000000,&H70000000,1,1,6,3,8,60,60,{SAFE_OBEN},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    zeilen: list[str] = []

    # Der Hook GROSS im oberen Drittel, ab Bild eins.
    #
    # WARUM ZUSAETZLICH ZUM GESPROCHENEN HOOK
    # Ein grosser Teil der TikTok-Nutzung laeuft ohne Ton — wer den Hook nur
    # spricht, hat bei diesen Zuschauern gar keinen. Der mitlaufende
    # Untertitel reicht dafuer nicht: Er steht unten, ist kleiner und zeigt in
    # den entscheidenden ersten anderthalb Sekunden nur einen Wortfetzen.
    # Oben, weil unten Untertitel und Bedienelemente der Plattform liegen.
    if hook:
        sicher_hook = str(hook).replace("{", "(").replace("}", ")").replace("\n", " ").strip()
        if sicher_hook:
            zeilen.append(
                f"Dialogue: 0,{_ass_zeit(0.0)},{_ass_zeit(max(hook_dauer, 0.5))},"
                f"Hook,,0,0,0,,{sicher_hook}"
            )
    for segment in segmente:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        von = float(segment.get("von", 0.0))
        bis = float(segment.get("bis", von + 1.0))
        woerter = text.split()
        if not woerter:
            continue
        bloecke = _bloecke_bilden(woerter, woerter_pro_zeile)
        spanne = max(bis - von, 0.4)
        je_block = spanne / len(bloecke)
        for i, block in enumerate(bloecke):
            start = von + i * je_block
            ende = min(start + je_block, bis)
            sicher = " ".join(block).replace("{", "(").replace("}", ")").replace("\n", " ")
            zeilen.append(
                f"Dialogue: 0,{_ass_zeit(start)},{_ass_zeit(ende)},Standard,,0,0,0,,{sicher}"
            )

    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(kopf + "\n".join(zeilen) + "\n", encoding="utf-8")
    return ziel


# ── Bildbewegung ─────────────────────────────────────────────────────

def ken_burns(dauer: float, *, bilder_pro_sek: int = 30, hinein: bool = True) -> str:
    """Langsame Zoomfahrt auf einem Standbild.

    Ohne Bewegung wirkt ein Standbild im Hochformat sofort wie eine
    Diaschau — und Diaschauen werden weggewischt. Der Zoom ist bewusst
    klein (8 %): Mehr sieht nach Effekt aus, weniger sieht nach Fehler aus.

    ACHTUNG, HIER STECKT EINE FALLE — einmal voll hineingetappt:
    zoompan gibt "d" Bilder je EINGANGSBILD aus. Mit "-loop 1 -t 3" kommen
    90 Eingangsbilder an; bei d=90 waeren das 8.100 Ausgangsbilder, also
    270 Sekunden Video statt 3. Gemessen: Ein 3-Sekunden-Clip stand nach
    einer Minute Rechenzeit bei 1.094 Bildern und lief weiter.

    Richtig ist d=1: je Eingangsbild genau ein Ausgangsbild. Der Zoom laeuft
    dann ueber "on" (die laufende Bildnummer) statt ueber die Wiederholung.
    Die Laufzeit bestimmt damit wieder "-t" am Eingang — so wie man es
    erwartet.
    """
    schritte = max(int(dauer * bilder_pro_sek), 1)
    if hinein:
        zoom = f"1.0+0.08*on/{schritte}"
    else:
        zoom = f"1.08-0.08*on/{schritte}"
    return (
        # Nur maessig hochskalieren: Fuer 8 % Zoom reicht das reichlich, und
        # ein 2160er Zwischenbild kostet ein Vielfaches an Rechenzeit.
        f"scale=1296:2304:force_original_aspect_ratio=increase,crop=1296:2304,"
        f"zoompan=z='{zoom}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":s=1080x1920:fps={bilder_pro_sek},"
        f"setsar=1"
    )


def einpassen() -> str:
    """Beliebiges Material auf 1080x1920 bringen, ohne es zu verzerren.

    Zuschneiden statt quetschen: Ein verzerrtes Produkt sieht billig aus und
    zeigt ausserdem nicht mehr, was der Kunde bekommt.
    """
    return (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,setsar=1"
    )


# ── Endkarte ─────────────────────────────────────────────────────────

def _endkarten_text(ziel: Path, *, name: str, preistext: str, hinweis: str) -> Path:
    """Beschriftung der Endkarte als ASS-Datei.

    WARUM NICHT MEHR MIT drawtext
    drawtext kann Text weder umbrechen noch an die Breite anpassen. Mit
    x=(w-text_w)/2 wird ein zu breiter Text mittig gesetzt und ragt DAUERHAFT
    auf BEIDEN Seiten aus dem Bild. Genau so sah die Endkarte aus:

        "ktrischer Wasserspender fuer Schreibti"
        "p.com/produkte/elektrischer-wasserspender-fuer-schreibt"

    Nur der Preis passte. Ausgerechnet auf der Endkarte — dem einzigen Bild,
    das den Weg in den Shop zeigt — war der Weg unlesbar. Und es faellt
    nirgends auf: Die Ausgangspruefung misst Aufloesung, Laufzeit und Ton,
    aber nicht, ob Text im Bild steht.

    libass bricht dagegen innerhalb der Raender um, kennt Zeilenabstaende und
    setzt denselben Textsatz wie die Untertitel. Ein Textwerkzeug statt zwei.
    """
    schrift = schriftart()
    schriftname = Path(schrift).stem if schrift else "Arial"

    def sicher(text: str) -> str:
        return str(text).replace("{", "(").replace("}", ")").replace("\n", " ").strip()

    # BorderStyle 3 = deckender Kasten hinter dem Text, wie vorher box=1.
    kopf = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Name,{schriftname},58,&H00FFFFFF,&H00000000,&HA0000000,1,3,10,0,2,{SAFE_SEITE},{SAFE_SEITE},{SAFE_UNTEN + 210},1
Style: Preis,{schriftname},64,&H0000E5FF,&H00000000,&HA0000000,1,3,10,0,2,{SAFE_SEITE},{SAFE_SEITE},{SAFE_UNTEN + 110},1
Style: Hinweis,{schriftname},44,&H00FFFFFF,&H00000000,&HA0000000,1,3,8,0,2,{SAFE_SEITE},{SAFE_SEITE},{SAFE_UNTEN + 30},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:59.00,Name,,0,0,0,,{sicher(name)}
Dialogue: 0,0:00:00.00,0:00:59.00,Preis,,0,0,0,,{sicher(preistext)}
Dialogue: 0,0:00:00.00,0:00:59.00,Hinweis,,0,0,0,,{sicher(hinweis)}
"""
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(kopf, encoding="utf-8")
    return ziel


MUSIK = MARKETING_DIR / "musik"

# Wie laut die Musik unter der Stimme liegt (in dB, negativ = leiser).
# -20 dB ist der Wert, bei dem Musik traegt, ohne die Stimme zu verdecken.
MUSIK_PEGEL_DB = -20.0


def musikstuecke() -> list[Path]:
    """Alle nutzbaren Musikdateien in Marketing/musik.

    Bewusst ein eigener Ordner und keine Netzquelle: Musik ist die haeufigste
    Ursache fuer eine Urheberrechtsmeldung auf TikTok. Was hier liegt, hat
    jemand bewusst hingelegt — und ist damit belegbar.
    """
    if not MUSIK.exists():
        return []
    return sorted(
        p for p in MUSIK.rglob("*")
        if p.suffix.lower() in (".mp3", ".m4a", ".wav", ".ogg", ".opus")
        and p.stat().st_size > 10_000
    )


def musik_waehlen(saat: int) -> Path | None:
    """Ein Stueck aussuchen — bei gleicher Saat immer dasselbe.

    Warum nicht zufaellig: Zwei Laeufe fuer dasselbe Briefing sollen dasselbe
    Video ergeben. Sonst laesst sich ein Rendern nicht wiederholen, und beim
    Lernen waere unklar, ob die Musik oder etwas anderes den Unterschied
    gemacht hat.
    """
    stuecke = musikstuecke()
    return stuecke[saat % len(stuecke)] if stuecke else None


def ton_mit_musik(sprache_index: int, musik_index: int, *, gesamt: float,
                  einblendung: float = 0.8) -> str:
    """Filtergraph: Stimme oben, Musik leise darunter, am Ende ausblenden.

    KEINE echte Sidechain-Absenkung, sondern ein fester Pegelabstand.
    Begruendung: sidechaincompress braucht eine sauber gepegelte Stimme, sonst
    pumpt die Musik hoerbar. Bei einem festen Abstand von 20 dB traegt die
    Musik, ohne je in den Vordergrund zu geraten — das ist der robustere Weg,
    solange die Stimme aus verschiedenen Quellen kommen kann (eigene Aufnahme,
    Sprachsynthese, Klon).
    """
    return (
        f"[{sprache_index}:a]{loudnorm_filter()},apad,atrim=0:{gesamt:.2f}[stimme];"
        f"[{musik_index}:a]volume={MUSIK_PEGEL_DB}dB,"
        f"afade=t=in:st=0:d={einblendung:.2f},"
        f"afade=t=out:st={max(gesamt - 1.5, 0):.2f}:d=1.5,"
        f"aloop=loop=-1:size=2e9,atrim=0:{gesamt:.2f}[bett];"
        f"[stimme][bett]amix=inputs=2:duration=first:dropout_transition=0,"
        f"alimiter=limit=0.95[ton]"
    )


def kurz_url(url: str) -> str:
    """Nur die Domain — der lange Pfad ist im Video ohnehin nutzlos.

    Eine Adresse im Video ist nicht anklickbar. Wer sie abtippen soll,
    schafft 'maiosshop.com', aber nicht
    'maiosshop.com/produkte/elektrischer-wasserspender-fuer-schreibtisch.html'.
    Der Weg in den Shop laeuft ueber den Link im Profil; die Domain ist nur
    das Vertrauenssignal, dass es den Laden wirklich gibt.
    """
    ohne = str(url).replace("https://", "").replace("http://", "").strip()
    return ohne.split("/")[0] or ohne


def baue_endkarte(produktbild: Path, ziel: Path, *, name: str, preis: float,
                  url: str, dauer: float = 2.5) -> Path:
    """Endkarte aus einem ECHTEN Produktfoto — nie generiert.

    Auch bei Stil B: Das letzte Bild, das jemand sieht, muss das Produkt
    zeigen, das er tatsaechlich bekommt.
    """
    preistext = f"{preis:.2f} EUR · Versand frei".replace(".", ",")
    hinweis = f"{kurz_url(url)} · Link im Profil"
    ass = _endkarten_text(ziel.with_suffix(".ass"), name=name,
                          preistext=preistext, hinweis=hinweis)
    ass_ff = str(ass.resolve()).replace("\\", "/").replace(":", "\\:")

    filter_kette = f"{einpassen()},eq=brightness=-0.12,subtitles='{ass_ff}'"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    lauf([
        "-framerate", "30", "-loop", "1", "-t", f"{dauer:.2f}", "-i", str(produktbild),
        "-vf", filter_kette, "-r", "30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel),
    ])
    return ziel


def _escape(text: str) -> str:
    """Text fuer drawtext entschaerfen.

    Doppelpunkt, Hochkomma und Backslash haben im Filtergraphen Bedeutung.
    Unmaskiert brechen sie den gesamten Aufruf — bei einem Produktnamen wie
    "4-in-1: Haartrockner" faellt das sofort auf, bei einem Apostroph erst
    beim naechsten Produkt.
    """
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "")
        .replace("%", "")
        .replace("\n", " ")
    )


# ── Lautheit ─────────────────────────────────────────────────────────

def loudnorm_filter() -> str:
    """Auf die Zielllautheit bringen (Vorgabe -14 LUFS).

    Ohne das ist ein Video mal zu leise, mal zu laut — und zu leise heisst
    weggewischt, bevor der erste Satz zu Ende ist.
    """
    ziel = float(guardrails.wert("video.ziel_lufs", -14.0))
    return f"loudnorm=I={ziel}:TP=-1.5:LRA=11"


def musik_unter_stimme() -> str:
    """Musik automatisch leiser machen, sobald gesprochen wird.

    sidechaincompress steuert die Musik mit der Stimme aus. Ohne das muss man
    die Musik pauschal so leise machen, dass sie nichts mehr beitraegt.
    """
    return "sidechaincompress=threshold=0.05:ratio=8:attack=5:release=250"
