"""Stil C: ein Video aus einer Schnittliste — die Naht zur Handarbeit.

WARUM ES DIESEN STIL GIBT

Stil A und B bauen ein Video aus einem Briefing: Stimme, Material aus dem
Katalog, Zoomfahrt, Endkarte. Der erste veroeffentlichungsreife Clip dieses
Projekts ist aber ANDERS entstanden — von Hand, aus 23 Rohclips zum
Wasserspender, in einem ffmpeg-Aufruf daneben. Fuenf Schnittfassungen, die
letzte 19,5 Sekunden.

Dieser Clip hat NICHTS von dem gesehen, was den Automaten ausmacht:
keine Lizenzpruefung des Materials, keine Ausgangspruefung, keinen Eintrag in
mkt_videos, kein Lernen, keine Umsatzzuordnung. Er ist gut und er ist blind
entstanden. Genau das ist die Luecke: zwei Welten, die nichts voneinander
wissen.

Stil C schliesst sie. Die Handarbeit bleibt Handarbeit — ein Mensch entscheidet,
welcher Ausschnitt welches Rohclips wann kommt. Aber diese Entscheidung steht
ab jetzt in einer DATEI statt in einem Befehl, und aus der Datei rendert
derselbe Ablauf wie fuer A und B.

WAS DAS AENDERT

  * Die Fassung ist lesbar. Fuenf Fassungen vergleichen heisst fuenf Dateien
    nebeneinanderlegen, nicht fuenf Videos ansehen.
  * Die Fassung ist versionierbar. Eine 4-KB-Schnittliste gehoert ins
    Repository, ein 40-MB-Video nicht.
  * Die Fassung ist wiederholbar. Dieselbe Liste ergibt dasselbe Video.
  * Und das Wichtigste: Jeder Quellclip muss die LIZENZPRUEFUNG bestehen
    (assets.hat_lizenz) — das gilt fuer die Quellclips UND fuer das
    Musikbett —, und das Ergebnis geht durch quality_gate.pruefe().
    Ein handgeschnittenes Video kann damit nicht mehr an den Kontrollen
    vorbei in die Warteschlange.

WAS ES BEWUSST NICHT TUT
  * Es sucht sich kein Material. Was in der Liste steht, wird benutzt —
    sonst nichts. Eine automatische Auswahl waere Stil A.
  * Es erfindet keine Schnittpunkte. Wer nichts angibt, bekommt den ganzen
    Clip; geraten wird nirgends.
  * Es laedt nichts herunter und ruft keine Plattform auf.

DIE SCHNITTLISTE
Eine JSON-Datei, Format siehe SCHNITTLISTE.md. Kurzfassung:

    {
      "produkt_id": 10,
      "musik": "bett-ruhig-90bpm.mp3",
      "segmente": [
        {"quelle": "10_7300000000001.mp4", "von": 1.2, "bis": 3.4},
        {"quelle": "10_7300000000002.mp4", "von": 0.0, "bis": 2.1,
         "text": "Nie wieder schleppen"}
      ]
    }
"""

from __future__ import annotations

import copy
import dataclasses
import hashlib
import json
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .. import db, products
from ..env_loader import REPO_ROOT
from ..orchestrator import guardrails
from ..products import Produkt
from . import assets, common, quality_gate, takt

# Wo Schnittlisten liegen. Versioniert — das ist der ganze Zweck: Die Liste
# gehoert ins Repo, das Video nicht.
SCHNITTLISTEN = REPO_ROOT / "Marketing" / "schnittlisten"

# Wo das Rohmaterial gesucht wird, wenn eine Quelle nur als Dateiname dasteht.
#
# REIHENFOLGE IST ABSICHT: Bei gleichem Dateinamen gewinnt der Ort, an dem
# ausschliesslich SELBST AUFGENOMMENES liegt. Das ist der rechtlich
# unbedenkliche Fall, und er soll bei einer Namenskollision nicht verlieren.
#
# Hier stand vorher geschnitten/ an erster Stelle, mit derselben Begruendung
# ("eigenes Material"). Das stimmte nicht: Dort liegen SCHNITTE, und ein
# Schnitt erbt die Rechte seiner Quellen — die sieben fertigen
# Wasserspender-Clips sind aus 23 fremden TikTok-Videos entstanden. Der
# Ordner bleibt durchsuchbar, aber er ist nicht mehr der "sichere" Treffer.
SUCHORTE = (
    REPO_ROOT / "Marketing" / "videos" / "rohmaterial" / "eigenes",
    REPO_ROOT / "Marketing" / "videos" / "geschnitten",
    REPO_ROOT / "Marketing" / "videos" / "rohmaterial",
    REPO_ROOT / "Marketing" / "data" / "tiktok-quellen",
)


class SchnittlisteFehler(RuntimeError):
    """Die Liste ist unbrauchbar — mit Angabe, welche Zeile schuld ist."""


@dataclass
class Segment:
    quelle: Path
    von: float = 0.0
    bis: float | None = None          # None = bis zum Ende des Quellclips
    text: str | None = None           # Einblendung waehrend dieses Segments
    zuschnitt: str | None = None      # roher ffmpeg-crop, z.B. "crop=1080:1350:0:200"
    # Laenge der Quelldatei, EINMAL gemessen. Ohne dieses Feld rief die
    # Eigenschaft unten bei jedem Zugriff ffprobe auf — und gesamtdauer
    # summiert alle Segmente und wird beim Einlesen zweimal und beim Rendern
    # noch einmal gelesen. Bei zwanzig Segmenten ohne "bis" waren das ueber
    # sechzig Prozessstarts fuer eine Zahl, die sich nicht aendert.
    quelldauer: float | None = None
    # Punkt 36: Welche Produktvariante dieser Clip zeigt (Farbe, Modell,
    # Groesse). Freitext mit Absicht — "weiss", "schwarz", "2L" sind die
    # Worte, die in der Handarbeit-Notiz stehen, und eine feste Liste muesste
    # je Produkt anders aussehen.
    variante: str | None = None
    # Punkt 33: "schnitt" (Vorgabe) oder "blitz". Zwei und mehr nicht —
    # Wiedererkennbarkeit entsteht durch Wiederholung, nicht durch Auswahl.
    uebergang: str | None = None
    # Punkt 44: "eigen" = Originalton behalten. NUR bei eigenem Material —
    # das prueft lies(), nicht der Renderer.
    ton: str | None = None

    @property
    def dauer(self) -> float:
        if self.bis is not None:
            return max(self.bis - self.von, 0.0)
        laenge = self.quelldauer
        if laenge is None:
            info = common.medien_info(self.quelle)
            laenge = info.dauer if info else 0.0
            # Merken: dieselbe Datei wird waehrend eines Laufs nicht laenger.
            self.quelldauer = laenge
        return max(laenge - self.von, 0.0)


@dataclass
class Schnittliste:
    produkt_id: int
    segmente: list[Segment]
    musik: str | None = None
    # Der TEXT zum Video. Bei Stil A und B kommt er aus dem Briefing; eine
    # Schnittliste hat keins, und deshalb ging ein handgeschnittener Beitrag
    # bisher mit "Link im Profil. Werbung." und NULL Hashtags raus — der
    # schwaechste Text der Kette ausgerechnet unter dem sorgfaeltigsten Video.
    hook: str | None = None          # erste Zeile; das, was ueber Weiterschauen entscheidet
    cta: str | None = None           # Aufruf samt Werbekennzeichnung
    hashtags: list[str] = field(default_factory=list)
    # Schlussbild mit Name, Preis und Adresse — wie bei Stil A und B. Vorgabe
    # an: Ein Werbeclip ohne Preis und ohne Adresse ist ein huebsches Video.
    endkarte: bool = True
    quelle_datei: Path | None = None
    warnungen: list[str] = field(default_factory=list)
    # Punkt 36: Ausdrueckliche Freigabe zum Mischen. Manchmal IST die
    # Farbauswahl der Punkt des Clips — dann soll der Hinweis schweigen.
    varianten_mischen: bool = False
    # Punkt 59: Aus welcher Vorlage (Punkt 28) die Liste entstand. Steht im
    # Kopf `_vorlage.name`, den der Entwurf beim Umbenennen behaelt. Ohne
    # diesen Namen kann das Lernen nie sagen, welche Form funktioniert.
    vorlage: str | None = None
    # Punkt 58: Mehrere Hooktexte -> mehrere Fassungen, die sich nur am
    # Anfang unterscheiden. Leer = eine Fassung wie bisher.
    hook_varianten: list[str] = field(default_factory=list)
    varianten_rotieren: bool = False
    # Punkt 44: "aus_ton" = Untertitel aus dem eigenen Ton erkennen.
    untertitel: str | None = None
    sprache: str = "de"
    # Punkt 39: Schnitte auf den Takt ziehen. None = Vorgabe aus der
    # Konfiguration (video.takt_schnitt), False schaltet es fuer diese Liste ab.
    takt: bool | None = None

    @property
    def gesamtdauer(self) -> float:
        return round(sum(s.dauer for s in self.segmente), 2)


# ── Uebergaenge (Punkt 33) ───────────────────────────────────────────
#
# Harte Schnitte sind auf TikTok die Regel und wirken schneller. Ein weicher
# Uebergang an der falschen Stelle wirkt wie eine Diashow. Andersherum braucht
# der Sprung von fremdem Material auf eigenes Produktbild manchmal eine Kante,
# damit der Bruch nicht als Fehler gelesen wird.
#
# ZWEI UEBERGAENGE UND MEHR NICHT. Die Beschraenkung ist der Punkt: Wiedererkennbarkeit
# entsteht durch Wiederholung, und die geht nur ueber eine Festlegung. Eine
# Liste mit zwanzig Moeglichkeiten waere dieselbe Beliebigkeit wie gar keine.

UEBERGAENGE = {
    "schnitt": "harter Schnitt — die Vorgabe",
    "blitz": "kurzer Weissblitz (3 Bilder) fuer den Sprung Fremd -> Eigen",
}

# Drei Bilder bei 30 fps = 0,1 Sekunden. Laenger wirkt es wie ein Fehler im
# Material, kuerzer sieht man es nicht.
BLITZ_BILDER = 3


def uebergang_filter(bilder: int = BLITZ_BILDER, *, fps: int = 30) -> str:
    """Ein Weissblitz am ANFANG eines Segments, als ffmpeg-Filter.

    Aufgebaut als Ueberblendung nach Weiss und zurueck: Die ersten Bilder
    werden aufgehellt, danach laeuft das Segment normal. Bewusst am Anfang und
    nicht zwischen zwei Segmenten — so bleibt jedes Segment eine eigene Datei,
    und die Verkettung per concat funktioniert weiter. Ein echter
    xfade-Uebergang muesste zwei Segmente gleichzeitig kennen und wuerde die
    gemessene Gesamtlaenge verschieben.
    """
    dauer = max(1, int(bilder)) / max(1, int(fps))
    return f"fade=t=in:st=0:d={dauer:.3f}:color=white"


def uebergaenge_pruefen(liste: "Schnittliste") -> list[str]:
    """Unbekannte Uebergangsnamen melden, statt sie still zu ignorieren."""
    schlecht = []
    for nummer, segment in enumerate(liste.segmente, start=1):
        wert = str(getattr(segment, "uebergang", "") or "schnitt").strip()
        if wert not in UEBERGAENGE:
            schlecht.append(
                f"Segment {nummer}: unbekannter Uebergang \"{wert}\" "
                f"(erlaubt: {', '.join(UEBERGAENGE)})"
            )
    return schlecht


# ── Begleitdatei je Fassung (Punkt 53) ───────────────────────────────
#
# Es gibt fuenf Fassungen des Wasserspender-Clips. Welche warum entstand, was
# von Fassung 3 zu 4 geaendert wurde und warum 5 gewann — das weiss heute nur,
# wer dabei war. In vier Wochen weiss es niemand mehr.
#
# WAS DIE DATEI BEANTWORTET, wenn jemand in einem halben Jahr fragt:
#   * Von wem war das Material?         -> quellen mit Pruefsumme
#   * Welche Musik lag drunter?         -> musik + lizenz
#   * Wie lang war die Fassung?         -> dauer_gemessen
#   * Was war anders als vorher?        -> aenderung (ein Feld fuer den Menschen)
#
# AUTOMATISCH GEFUELLT BIS AUF EIN FELD. Alles, was das Programm weiss, traegt
# es selbst ein. "aenderung" bleibt leer — was von Fassung 3 zu 4 anders ist,
# weiss nur der Mensch, und ein erfundener Satz waere schlimmer als ein leeres
# Feld.

BEGLEIT_ENDUNG = ".fassung.json"


def _quellen_mit_pruefsumme(liste: "Schnittliste") -> list[dict[str, Any]]:
    """Die Rohclips einer Fassung, jeder mit sha256 — soweit lesbar."""
    gesehen: dict[str, dict[str, Any]] = {}
    for segment in liste.segmente:
        name = segment.quelle.name
        if name in gesehen:
            continue
        eintrag: dict[str, Any] = {"datei": name, "pfad": str(segment.quelle)}
        try:
            summe = hashlib.sha256(segment.quelle.read_bytes()).hexdigest()
            eintrag["sha256"] = summe
        except OSError:
            # Kein Abbruch: Eine Begleitdatei ohne eine Pruefsumme ist immer
            # noch mehr als keine Begleitdatei.
            eintrag["sha256"] = None
        gesehen[name] = eintrag
    return [gesehen[k] for k in sorted(gesehen)]


def _vorlagenname(kopf: Any) -> str | None:
    if isinstance(kopf, dict) and str(kopf.get("name") or "").strip():
        return str(kopf["name"]).strip()
    return None


# ── Herkunft der Rohclips (Punkt 59) ─────────────────────────────────
#
# WARUM DAS IN DEN BERICHT MUSS
# Gelernt wird in GitHub Actions, gerendert auf dem eigenen PC. Der Index des
# TikTok-Bots liegt nur auf dem PC — beim Lernen ist er nicht erreichbar. Was
# das Lernen ueber die Herkunft wissen soll, muss also beim RENDERN in den
# Bericht, sonst ist es spaeter nicht mehr zu haben.
#
# Die TikTok-Kennung steht seit Punkt 71 im Dateinamen und braucht keinen
# Index. Der Creator steht nur im Index; fehlt der, bleibt das Feld leer —
# geraten wird nichts.
# Punkt 03 (Bot): YouTube-Kennungen stehen als "_yt-<elf Zeichen>" im Namen.
HERKUNFT_MUSTER = re.compile(r"_(\d{10,25}|yt-[A-Za-z0-9_-]{11})\.(mp4|mov|webm|mkv)$", re.IGNORECASE)


def _bot_index(pfad: Path | None = None) -> dict[str, dict[str, Any]]:
    """Index-Eintraege des Bots nach Videokennung UND Dateiname. Leer, wenn keiner da ist."""
    ziel = pfad or (common.DATEN / "tiktok-quellen" / "index.json")
    try:
        roh = json.loads(Path(ziel).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    nachschlag: dict[str, dict[str, Any]] = {}
    for eintrag in (roh.get("eintraege") or []) + (roh.get("frueher_geladen") or []):
        if not isinstance(eintrag, dict):
            continue
        if eintrag.get("video_id"):
            nachschlag.setdefault(str(eintrag["video_id"]), eintrag)
        if eintrag.get("datei"):
            nachschlag.setdefault(str(eintrag["datei"]), eintrag)
    return nachschlag


def herkunft_der_quellen(liste: "Schnittliste", *, index_pfad: Path | None = None) -> list[dict[str, Any]]:
    """Je Rohclip: eigen oder fremd, TikTok-Kennung und Creator — soweit bekannt."""
    index = _bot_index(index_pfad)
    eigen_ordner = assets.EIGENES_ROHMATERIAL.resolve()
    gesehen: dict[str, dict[str, Any]] = {}
    for segment in liste.segmente:
        name = segment.quelle.name
        if name in gesehen:
            continue
        try:
            segment.quelle.resolve().relative_to(eigen_ordner)
            eigen = True
        except (ValueError, OSError):
            eigen = False
        treffer = HERKUNFT_MUSTER.search(name)
        kennung = treffer.group(1) if treffer else None
        youtube = bool(kennung and kennung.startswith("yt-"))
        video_id = kennung[3:] if youtube else kennung
        eintrag = index.get(video_id or "") or index.get(name) or {}
        video_id = video_id or eintrag.get("video_id") or None
        plattform = ("youtube" if youtube else "tiktok") if kennung else (eintrag.get("plattform") or ("tiktok" if eintrag else None))
        gesehen[name] = {
            "datei": name,
            "material": "eigen" if eigen else "fremd",
            "plattform": None if eigen else plattform,
            "video_id": None if eigen else video_id,
            # Bleibt fuer aeltere Leser: nur bei TikTok gesetzt.
            "tiktok_id": None if eigen or plattform != "tiktok" else video_id,
            "creator": None if eigen else (str(eintrag.get("creator") or "").strip() or None),
        }
    return [gesehen[k] for k in sorted(gesehen)]


def schreibe_begleitdatei(video: Path, liste: "Schnittliste", bericht: dict[str, Any],
                          *, jetzt: str | None = None) -> Path | None:
    """Die Fassungsgeschichte neben die Datei legen. None, wenn nicht schreibbar."""
    inhalt = {
        "video": video.name,
        "gebaut_am": jetzt or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "produkt_id": liste.produkt_id,
        "schnittliste": bericht.get("schnittliste"),
        "schnittliste_hash": pruefsumme(liste.quelle_datei) if liste.quelle_datei else None,
        "dauer_gemessen": bericht.get("dauer_gemessen"),
        "segmente": bericht.get("segmente"),
        "tempo": bericht.get("tempo"),
        "varianten": bericht.get("varianten"),
        "musik": bericht.get("musik"),
        "musik_lizenz": bericht.get("musik_lizenz"),
        "ton_entfernt": bericht.get("ton_entfernt"),
        "vorschau": bericht.get("vorschau", False),
        "quellen": _quellen_mit_pruefsumme(liste),
        # Das eine Feld, das ein Mensch fuellt. Leer gelassen statt geraten.
        "aenderung": "",
    }
    ziel = video.with_suffix(video.suffix + BEGLEIT_ENDUNG)
    try:
        ziel.write_text(json.dumps(inhalt, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    except OSError as fehler:
        print(f"[stil_c] Begleitdatei nicht geschrieben ({fehler})")
        return None
    return ziel


# ── Tempo (Punkt 34) ─────────────────────────────────────────────────
#
# "Zu langsam" faellt erst beim Ansehen auf, und dann ist die Fassung fertig.
# Dabei ist es eine ZAHL: die mittlere Segmentlaenge. Bei 19,5 Sekunden und
# sechs Segmenten sind das gut drei Sekunden je Einstellung — fuer einen
# Werbeclip eher ruhig.
#
# KEINE SPERRE, NUR EIN HINWEIS. Ein langsamer Clip kann richtig sein (eine
# Produktvorfuehrung braucht Zeit), und eine Sperre, die gewollte Faelle
# abweist, wird nach zwei Tagen abgeschaltet — dieselbe Ueberlegung wie bei
# der Lautheit in der Ausgangspruefung.
#
# Die Grenzen stehen in der Konfiguration, nicht hier: Sie sind Geschmack mit
# Begruendung, und Geschmack gehoert dorthin, wo man ihn aendern kann, ohne
# Code anzufassen.

def tempo(liste: "Schnittliste") -> dict[str, Any]:
    """Anzahl Segmente, mittlere und laengste Laenge — plus Hinweise."""
    dauern = [s.dauer for s in liste.segmente]
    if not dauern:
        return {"segmente": 0, "mittel": 0.0, "laengstes": 0.0, "hinweise": []}

    mittel = sum(dauern) / len(dauern)
    laengstes = max(dauern)
    grenze_mittel = float(guardrails.wert("video.tempo_mittel_warnung_sek", 2.5))
    grenze_einzeln = float(guardrails.wert("video.tempo_segment_warnung_sek", 4.0))

    hinweise: list[str] = []
    if mittel > grenze_mittel:
        hinweise.append(
            f"mittlere Einstellung {mittel:.1f}s (Hinweis ab {grenze_mittel:.1f}s) — "
            f"fuer einen Werbeclip eher ruhig"
        )
    lang = [i + 1 for i, d in enumerate(dauern) if d > grenze_einzeln]
    if lang:
        hinweise.append(
            f"Segment {', '.join(str(i) for i in lang)} laenger als "
            f"{grenze_einzeln:.0f}s (laengstes {laengstes:.1f}s)"
        )
    return {
        "segmente": len(dauern),
        "mittel": round(mittel, 2),
        "laengstes": round(laengstes, 2),
        "hinweise": hinweise,
    }


# ── Varianten nicht mischen (Punkt 36) ───────────────────────────────
#
# Die Lehre steht schon in der Handarbeit-Notiz zu Produkt 10: "Clips mit dem
# SCHWARZEN Spender nicht mit den weissen mischen — wirkt wie ein anderes
# Produkt." Als Notiz haelt so etwas genau so lange, wie jemand daran denkt,
# und beim zwanzigsten Clip denkt niemand daran.
#
# BEWUSSTES MISCHEN BLEIBT MOEGLICH. Wer in der Liste "varianten_mischen": true
# setzt, bekommt keinen Hinweis — manchmal IST die Farbauswahl der Punkt des
# Clips. Was nicht bleibt, ist das versehentliche Mischen.

def varianten(liste: "Schnittliste") -> dict[str, Any]:
    """Welche Produktvarianten stecken in dieser Fassung?"""
    gefunden: dict[str, list[int]] = {}
    for nummer, segment in enumerate(liste.segmente, start=1):
        wert = str(getattr(segment, "variante", "") or "").strip()
        if not wert:
            continue
        gefunden.setdefault(wert, []).append(nummer)

    hinweise: list[str] = []
    if len(gefunden) > 1 and not getattr(liste, "varianten_mischen", False):
        teile = [f"{name} (Segment {', '.join(str(n) for n in nummern)})"
                 for name, nummern in sorted(gefunden.items())]
        hinweise.append(
            "verschiedene Produktvarianten in einer Fassung: " + " · ".join(teile)
            + ' — wenn das gewollt ist, "varianten_mischen": true in die Liste'
        )
    return {"gefunden": {k: v for k, v in sorted(gefunden.items())}, "hinweise": hinweise}


# ── Lesen und pruefen ────────────────────────────────────────────────

def _finde_quelle(angabe: str) -> Path | None:
    """Wo liegt die Datei, die in der Liste steht?

    Ein absoluter oder relativer Pfad wird genommen, wie er dasteht. Ein
    blosser Dateiname wird in SUCHORTE gesucht, inklusive Unterordner — das
    Rohmaterial liegt in Produktordnern (rohmaterial/<NN>_<slug>/), und
    niemand soll den in die Liste tippen muessen.
    """
    roh = Path(angabe)
    if roh.is_absolute() and roh.exists():
        return roh
    vom_repo = REPO_ROOT / roh
    if vom_repo.exists():
        return vom_repo
    for ort in SUCHORTE:
        if not ort.exists():
            continue
        direkt = ort / roh.name
        if direkt.exists():
            return direkt
        treffer = sorted(ort.rglob(roh.name))
        if treffer:
            return treffer[0]
    return None


def _ton_pruefen(wert: Any, quelle: Path, nr: int) -> str | None:
    """Punkt 44: Originalton nur bei eigenem Material — sonst Abbruch."""
    if wert in (None, "", "weg"):
        return None
    ton = str(wert).strip().lower()
    if ton not in TON_WERTE:
        raise SchnittlisteFehler(f"Segment {nr}: 'ton' kennt nur {', '.join(TON_WERTE)} — nicht \"{wert}\"")
    if ton == "eigen" and not assets._ist_eigenes(quelle):
        raise SchnittlisteFehler(
            f"Segment {nr}: Originalton nur bei eigenem Material — {quelle.name} liegt nicht in "
            "rohmaterial/eigenes/ (oder bei den eigenen Produktvideos). Fremder Ton bleibt draussen: "
            "fremde Stimmen und Musik, die nur in der App erlaubt ist."
        )
    return ton


def lies(pfad: Path) -> Schnittliste:
    """Eine Schnittliste einlesen und auf Unmoeglichkeiten pruefen.

    Geprueft wird hier, nicht beim Rendern: Ein Tippfehler in einer Zeitangabe
    soll auffallen, bevor ffmpeg zehn Minuten laeuft. Und die Meldung nennt die
    Segmentnummer — "bis liegt vor von" ohne Zeilenangabe ist bei
    zwanzig Segmenten keine Hilfe.
    """
    try:
        # "utf-8-sig": Unter Windows speichern PowerShell 5.1 und aeltere
        # Editoren UTF-8 MIT Byte-Order-Mark. Mit "utf-8" hiess es dann "kein
        # gueltiges JSON" — fuer eine Datei, die voellig in Ordnung ist.
        roh = json.loads(Path(pfad).read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        raise SchnittlisteFehler(f"Schnittliste nicht gefunden: {pfad}") from None
    except json.JSONDecodeError as fehler:
        raise SchnittlisteFehler(f"{Path(pfad).name} ist kein gueltiges JSON: {fehler}") from None

    if not isinstance(roh, dict):
        raise SchnittlisteFehler(f"{Path(pfad).name}: erwartet wird ein Objekt")

    produkt_id = roh.get("produkt_id")
    if produkt_id is None:
        raise SchnittlisteFehler(f"{Path(pfad).name}: 'produkt_id' fehlt")

    roh_segmente = roh.get("segmente")
    if not isinstance(roh_segmente, list) or not roh_segmente:
        raise SchnittlisteFehler(f"{Path(pfad).name}: 'segmente' fehlt oder ist leer")

    segmente: list[Segment] = []
    warnungen: list[str] = []

    for nr, eintrag in enumerate(roh_segmente, start=1):
        if not isinstance(eintrag, dict):
            raise SchnittlisteFehler(f"Segment {nr}: erwartet wird ein Objekt")
        angabe = str(eintrag.get("quelle") or "").strip()
        if not angabe:
            raise SchnittlisteFehler(f"Segment {nr}: 'quelle' fehlt")

        quelle = _finde_quelle(angabe)
        if quelle is None:
            raise SchnittlisteFehler(
                f"Segment {nr}: Datei '{angabe}' nicht gefunden. Gesucht in: "
                + ", ".join(o.name for o in SUCHORTE)
            )

        von = float(eintrag.get("von", 0.0) or 0.0)
        bis_roh = eintrag.get("bis")
        bis = float(bis_roh) if bis_roh is not None else None

        if von < 0:
            raise SchnittlisteFehler(f"Segment {nr}: 'von' ist negativ ({von})")
        if bis is not None and bis <= von:
            raise SchnittlisteFehler(
                f"Segment {nr}: 'bis' ({bis}) liegt nicht nach 'von' ({von})"
            )

        # Gegen die echte Datei pruefen. Ein Segment, das hinter dem Dateiende
        # anfaengt, liefert bei ffmpeg ein LEERES Ergebnis ohne Fehlermeldung —
        # das Video waere dann still kuerzer als geplant.
        info = common.medien_info(quelle)
        if info is not None and info.dauer > 0:
            if von >= info.dauer:
                raise SchnittlisteFehler(
                    f"Segment {nr}: 'von' ({von}s) liegt hinter dem Ende von "
                    f"{quelle.name} ({info.dauer:.1f}s)"
                )
            if bis is not None and bis > info.dauer + 0.05:
                warnungen.append(
                    f"Segment {nr}: 'bis' ({bis}s) liegt hinter dem Ende von "
                    f"{quelle.name} ({info.dauer:.1f}s) — wird gekuerzt"
                )
                bis = info.dauer

        segmente.append(Segment(
            quelle=quelle, von=von, bis=bis,
            text=(eintrag.get("text") or None),
            zuschnitt=(eintrag.get("zuschnitt") or None),
            variante=(str(eintrag["variante"]).strip() if eintrag.get("variante") else None),
            uebergang=(str(eintrag["uebergang"]).strip() if eintrag.get("uebergang") else None),
            ton=_ton_pruefen(eintrag.get("ton"), quelle, nr),
            # Hier wurde die Datei ohnehin schon gemessen (Zeitpruefung oben).
            # Das Ergebnis wegzuwerfen und spaeter erneut zu messen, war reine
            # Verschwendung.
            quelldauer=(info.dauer if info is not None and info.dauer > 0 else None),
        ))

    liste = Schnittliste(
        produkt_id=int(produkt_id),
        segmente=segmente,
        musik=(roh.get("musik") or None),
        hook=(str(roh["hook"]).strip() if roh.get("hook") else None),
        cta=(str(roh["cta"]).strip() if roh.get("cta") else None),
        hashtags=_hashtags(roh.get("hashtags")),
        endkarte=(bool(roh["endkarte"]) if "endkarte" in roh else True),
        quelle_datei=Path(pfad),
        warnungen=warnungen,
        varianten_mischen=bool(roh.get("varianten_mischen", False)),
        vorlage=_vorlagenname(roh.get("_vorlage")),
        hook_varianten=[str(h).strip() for h in (roh.get("hook_varianten") or [])
                        if str(h or "").strip()],
        varianten_rotieren=bool(roh.get("varianten_rotieren", False)),
        untertitel=(str(roh["untertitel"]).strip() if roh.get("untertitel") else None),
        sprache=str(roh.get("sprache") or "de").strip(),
        takt=(bool(roh["takt"]) if "takt" in roh else None),
    )
    if liste.untertitel not in (None, "aus_ton"):
        raise SchnittlisteFehler(
            f"{Path(pfad).name}: 'untertitel' kennt nur \"aus_ton\" — nicht \"{liste.untertitel}\""
        )
    mit_ton = [nr for nr, s in enumerate(liste.segmente, start=1) if s.ton == "eigen"]
    if liste.untertitel == "aus_ton" and not mit_ton:
        warnungen.append("'untertitel': \"aus_ton\", aber kein Segment mit \"ton\": \"eigen\" — "
                         "es gibt nichts abzuhoeren")
    if liste.untertitel == "aus_ton":
        doppelt = [nr for nr in mit_ton if liste.segmente[nr - 1].text]
        if doppelt:
            warnungen.append(f"Segment {', '.join(map(str, doppelt))}: 'text' und Untertitel aus dem "
                             "Ton liegen beide unten im Bild — einer davon ist zu viel")

    # PLATZHALTER AUS EINER VORLAGE (Punkt 28) — hier wird ABGEBROCHEN, nicht
    # gewarnt. Die Vorlagen in schnittlisten/vorlagen/ tragen ihre Texte als
    # "[[…]]". Stil C brennt `text` woertlich ins Bild und setzt `hook`, `cta`
    # und die Hashtags woertlich in den Beitrag. Ein vergessener Platzhalter
    # stuende also als "[[Der wichtigste Vorteil]]" im veroeffentlichten Video —
    # und ein Beitrag auf TikTok laesst sich nicht zurueckholen. Anders als ein
    # fehlender Hook ist das kein schwaches Video, sondern ein kaputtes.
    platzhalter = []
    for feld in ("hook", "cta"):
        if "[[" in str(getattr(liste, feld) or ""):
            platzhalter.append(f"'{feld}'")
    for nr, segment in enumerate(liste.segmente, start=1):
        if "[[" in str(segment.text or ""):
            platzhalter.append(f"Segment {nr} 'text'")
    if any("[[" in str(h) for h in liste.hashtags):
        platzhalter.append("'hashtags'")
    if any("[[" in h for h in liste.hook_varianten):
        platzhalter.append("'hook_varianten'")
    if platzhalter:
        raise SchnittlisteFehler(
            f"{Path(pfad).name}: noch nicht ausgefuellte Platzhalter aus der Vorlage in "
            + ", ".join(platzhalter)
            + ". Jedes [[…]] durch echten Text ersetzen oder das Feld weglassen."
        )

    # Punkt 33: Ein Tippfehler im Uebergang soll auffallen, nicht still zum
    # harten Schnitt werden. Warnung, kein Abbruch — die Fassung ist renderbar.
    liste.warnungen.extend(uebergaenge_pruefen(liste))

    # Kein Abbruch: Ein Video ohne Text ist renderbar, es sollte nur nicht so
    # veroeffentlicht werden. Die Warnung faellt beim Rendern, der Beitrag
    # faellt in der Freigabeliste auf — dort, wo ein Mensch hinsieht.
    if not liste.hook:
        warnungen.append(
            "kein 'hook' — die Bildunterschrift beginnt dann mit dem Aufruf "
            "statt mit dem Satz, der ueber Weiterschauen entscheidet"
        )
    if not liste.hashtags:
        warnungen.append(
            "keine 'hashtags' — auf TikTok heisst das kaum Reichweite"
        )

    min_dauer = float(guardrails.wert("video.min_dauer_sek", 8))
    max_dauer = float(guardrails.wert("video.max_dauer_sek", 60))
    if liste.gesamtdauer < min_dauer:
        warnungen.append(
            f"Gesamtdauer {liste.gesamtdauer}s liegt unter der Mindestdauer "
            f"({min_dauer}s) — die Ausgangspruefung wird das Video ablehnen"
        )
    if liste.gesamtdauer > max_dauer:
        warnungen.append(
            f"Gesamtdauer {liste.gesamtdauer}s liegt ueber der Hoechstdauer ({max_dauer}s)"
        )
    return liste


def _hashtags(wert: Any) -> list[str]:
    """Hashtags aus der Liste holen — mit oder ohne Raute geschrieben."""
    if not isinstance(wert, list):
        return []
    fertig = []
    for eintrag in wert:
        text = str(eintrag).strip()
        if not text:
            continue
        fertig.append(text if text.startswith("#") else f"#{text}")
    return fertig


def texte(name: str) -> dict[str, Any]:
    """Nur die Textfelder einer Schnittliste — ohne Dateien zu pruefen.

    Fuer die Veroeffentlichung gedacht: Dort wird die Bildunterschrift
    gebaut, oft Stunden nach dem Rendern, und dann muessen die Rohclips gar
    nicht mehr dasein. lies() wuerde an dieser Stelle abbrechen, weil es die
    Segmente gegen die echten Dateien prueft — richtig beim Rendern, falsch
    beim Posten.

    Ein fehlender oder kaputter Eintrag ist kein Fehler, sondern ein leeres
    Ergebnis: Der Beitrag bekommt dann denselben Text wie vorher und faellt
    in der Freigabeliste auf.
    """
    if not name:
        return {}
    pfad = SCHNITTLISTEN / name
    if not pfad.exists():
        return {}
    try:
        roh = json.loads(pfad.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(roh, dict):
        return {}
    return {
        "hook": (str(roh["hook"]).strip() if roh.get("hook") else None),
        "cta": (str(roh["cta"]).strip() if roh.get("cta") else None),
        "hashtags": _hashtags(roh.get("hashtags")),
    }


ENDKARTE_SEK = 2.5


def _endkarte_bauen(produkt: Produkt, ordner: Path) -> Path | None:
    """Schlussbild aus einem echten Produktfoto — oder None.

    Kein Abbruch, wenn kein Foto da ist: Stil C lebt von fremdem Bewegtbild,
    und ein fehlendes Produktfoto ist ein Grund fuer eine Meldung, nicht
    dafuer, ein fertig geschnittenes Video wegzuwerfen. Stil A bricht an
    dieser Stelle ab — dort ist das Foto aber auch die Quelle des ganzen
    Videos, hier nur das letzte Bild.
    """
    foto = next((a.pfad for a in assets.eigene_bilder(produkt)), None)
    if foto is None:
        print(f"[stil_c] kein Produktfoto fuer die Endkarte von {produkt.name} — "
              f"der Clip endet ohne Preis und Adresse")
        return None
    return common.baue_endkarte(
        foto, ordner / "endkarte.mp4",
        name=produkt.name, preis=produkt.preis,
        url=produkt.shop_url.replace("https://", ""), dauer=ENDKARTE_SEK,
    )


def ungeklaerte_rechte(liste: Schnittliste) -> list[Path]:
    """Welche Quellclips haben KEINEN Lizenznachweis?

    Dieselbe Pruefung, die Stil A auf sein Bildmaterial anwendet — hier auf
    das, was ein Mensch ausgesucht hat. Der Materialkatalog sagt: "Ein Asset
    ohne Lizenzeintrag kommt nicht ins Video. Punkt." Fuer fremdes
    TikTok-Material gilt das erst recht: Es startet im Bot-Index auf
    rechte_geprueft: false, und ein Video, das auf TikTok landet, kann man
    nicht nachtraeglich kurz zurueckholen.
    """
    offen: list[Path] = []
    for segment in liste.segmente:
        if not assets.hat_lizenz(segment.quelle):
            if segment.quelle not in offen:
                offen.append(segment.quelle)
    return offen


# ── Rendern ──────────────────────────────────────────────────────────

# ── Eigener Ton und Untertitel aus dem Ton (Punkt 44) ────────────────
#
# Der Originalton faellt grundsaetzlich weg (siehe _segment_bauen) — bei
# FREMDEM Material ist das die einzige sichere Einstellung. Bei eigenem
# Material ist es ein Verlust: Wer selbst etwas vorfuehrt und dabei erklaert,
# hat genau den Ton, den ein Werbeclip braucht.
#
# DESHALB EINE TUER, NICHT ZWEI. "ton": "eigen" ist nur fuer Material erlaubt,
# das assets._ist_eigenes() als eigen erkennt (Produktbilder, Produktvideos,
# rohmaterial/eigenes/). Dieselbe Pruefung, die auch ueber die Lizenz
# entscheidet — ein zweiter, laxerer Begriff von "eigen" waere die Luecke, durch
# die fremde Stimmen doch ins Video kaemen.
#
# UNTERTITEL AUS DEM TON. Die meisten schauen ohne Ton. Der Spracherkenner
# (faster-whisper) war schon im Projekt — der Bot nutzt ihn, um zu hoeren, OB
# geredet wird, und wirft den Text bewusst weg (fremde Stimmen gehoeren in
# keine Datei). Hier geht es nur um eigenen Ton; der Text landet ausschliesslich
# im Video.

TON_WERTE = ("eigen", "weg")


def woerter_zu_bloecken(woerter: list[tuple[float, float, str]], *,
                        hoechstens: int = 3, zeichen: int = 22) -> list[dict[str, Any]]:
    """Woerter mit Zeitmarken zu kurzen Untertitelbloecken.

    Derselbe Rhythmus wie schreibe_untertitel() (drei Woerter, begrenzte
    Zeichenzahl), aber mit den ECHTEN Zeiten aus dem Ton — ein Block steht
    genau so lange, wie seine Woerter gesprochen werden.
    """
    bloecke: list[dict[str, Any]] = []
    aktuell: list[tuple[float, float, str]] = []

    def abschliessen() -> None:
        if aktuell:
            bloecke.append({"von": round(aktuell[0][0], 2), "bis": round(aktuell[-1][1], 2),
                            "text": " ".join(w for _, _, w in aktuell)})
            aktuell.clear()

    for von, bis, wort in woerter:
        wort = str(wort).strip()
        if not wort:
            continue
        laenge = len(" ".join(w for _, _, w in aktuell) + " " + wort) if aktuell else len(wort)
        if aktuell and (len(aktuell) >= hoechstens or laenge > zeichen):
            abschliessen()
        aktuell.append((float(von), float(bis), wort))
    abschliessen()
    return bloecke


def woerter_zusammenfuegen(roh: list[tuple[float, float, str]]) -> list[tuple[float, float, str]]:
    """Whisper-Stuecke zu ganzen Woertern.

    Whisper liefert Woerter MIT fuehrendem Leerzeichen; ein Stueck ohne ist die
    Fortsetzung des vorigen ("USB" + "-Ladung"). Alles mit Leerzeichen
    aneinanderzuhaengen ergab "USB -Ladung" — und ein Block koennte mitten im
    Wort trennen.
    """
    woerter: list[tuple[float, float, str]] = []
    for von, bis, stueck in roh:
        stueck = str(stueck)
        if not stueck.strip():
            continue
        if woerter and not stueck[:1].isspace():
            a, _, wort = woerter[-1]
            woerter[-1] = (a, float(bis), wort + stueck.strip())
        else:
            woerter.append((float(von), float(bis), stueck.strip()))
    return woerter


def untertitel_aus_ton(wav: Path, *, sprache: str | None = "de",
                       modell: str | None = None) -> list[dict[str, Any]]:
    """Den eigenen Ton abhoeren und als Untertitelbloecke zurueckgeben.

    Das Modell kommt aus der Konfiguration (video.untertitel_modell, Vorgabe
    "small"). Gemessen am 28.09. an zwei gesprochenen Saetzen: "tiny" hoerte
    "Wasserspende fuehlt", "zwei Liedtern" und "Lardung" — "small" beide
    Saetze richtig, bei 6-7 s statt 1-3 s je Satz. Fehlt das Modell, laedt
    faster-whisper es beim ersten Aufruf (einmal rund 460 MB).
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError as fehler:
        fehlt = getattr(fehler, "name", None) or "faster-whisper"
        raise RuntimeError(f"Untertitel aus dem Ton brauchen '{fehlt}' "
                           f"(py -m pip install {fehlt})") from None

    name = modell or str(guardrails.wert("video.untertitel_modell", "small"))
    erkenner = WhisperModel(name, device="cpu", compute_type="int8")
    segmente, _ = erkenner.transcribe(str(wav), beam_size=1, vad_filter=True,
                                      word_timestamps=True, language=sprache or None)
    woerter: list[tuple[float, float, str]] = []
    for s in segmente:
        # Was das Modell selbst fuer Nicht-Sprache haelt, wird kein Untertitel —
        # sonst stuende bei Musik oder Rauschen erfundener Text im Bild.
        if getattr(s, "no_speech_prob", 0.0) > 0.6:
            continue
        for w in (s.words or []):
            woerter.append((float(w.start), float(w.end), str(w.word)))
    return woerter_zu_bloecken(woerter_zusammenfuegen(woerter))


def untertitel_datei(liste_pfad: Path | None) -> Path | None:
    """Wo die erkannten Untertitel zum Korrigieren liegen: neben der Liste.

    Mit fuehrendem Unterstrich, damit offene_listen() sie nicht fuer eine
    Schnittliste haelt (sie endet ebenfalls auf .json).
    """
    if liste_pfad is None:
        return None
    return Path(liste_pfad).with_name(f"_{Path(liste_pfad).stem}.untertitel.json")


def _untertitel_holen(liste: "Schnittliste", spur: Path) -> tuple[list[dict[str, Any]], str]:
    """Untertitel fuer DIESE Tonspur: aus der Korrekturdatei, sonst erkennen und dort ablegen.

    WARUM EINE DATEI ZUM KORRIGIEREN
    Stil C brennt Text woertlich ins Bild. Das kleine Modell hoerte beim
    ersten Versuch "Der Wasserspende fuehlt dein Glas" — zwei Fehler in einem
    Satz, und im veroeffentlichten Video waeren sie nicht mehr zu aendern.
    Also: einmal erkennen, in die Datei schreiben, dort verbessern lassen.
    Jeder weitere Lauf nimmt den verbesserten Text.

    Schluessel ist der Fingerabdruck der Tonspur — aendert sich der Schnitt,
    passt der alte Text nicht mehr und wird neu erkannt, ohne den alten zu
    ueberschreiben.
    """
    kennung = hashlib.sha256(spur.read_bytes()).hexdigest()[:16]
    datei = untertitel_datei(liste.quelle_datei)
    daten: dict[str, Any] = {}
    if datei is not None and datei.exists():
        try:
            daten = json.loads(datei.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as fehler:
            raise RuntimeError(f"{datei.name} ist nicht lesbar: {fehler}") from None
    spuren = daten.get("spuren") if isinstance(daten.get("spuren"), dict) else {}
    if kennung in spuren and isinstance(spuren[kennung].get("bloecke"), list):
        return [b for b in spuren[kennung]["bloecke"] if str(b.get("text") or "").strip()], "datei"

    bloecke = untertitel_aus_ton(spur, sprache=liste.sprache)
    if datei is not None:
        spuren[kennung] = {
            "erkannt_am": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "modell": str(guardrails.wert("video.untertitel_modell", "small")),
            "bloecke": bloecke,
        }
        daten["_hinweis"] = ("Automatisch erkannt — Text hier verbessern, dann wird neu gerendert. "
                             "Zeiten nur aendern, wenn noetig; ein leerer Text blendet den Block aus.")
        daten["spuren"] = spuren
        datei.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return bloecke, "erkannt"


def _tonspur_bauen(liste: "Schnittliste", ordner: Path, *, nachlauf_sek: float = 0.0) -> Path:
    """Eine Spur so lang wie das Video: eigener Ton, wo erlaubt, sonst Stille."""
    teile: list[Path] = []
    for i, segment in enumerate(liste.segmente):
        ziel = ordner / f"ton_{i:02d}.wav"
        dauer = max(segment.dauer, 0.04)
        info = common.medien_info(segment.quelle) if segment.ton == "eigen" else None
        if info is not None and info.hat_ton:
            common.lauf(["-ss", f"{segment.von:.3f}", "-t", f"{dauer:.3f}", "-i", str(segment.quelle),
                         "-vn", "-ac", "1", "-ar", "48000",
                         "-af", f"apad=whole_dur={dauer:.3f}", "-t", f"{dauer:.3f}",
                         "-c:a", "pcm_s16le", str(ziel)])
        else:
            common.lauf(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{dauer:.3f}",
                         "-c:a", "pcm_s16le", str(ziel)])
        teile.append(ziel)
    if nachlauf_sek > 0:
        ziel = ordner / "ton_endkarte.wav"
        common.lauf(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{nachlauf_sek:.3f}",
                     "-c:a", "pcm_s16le", str(ziel)])
        teile.append(ziel)
    verzeichnis = ordner / "ton_teile.txt"
    verzeichnis.write_text("\n".join(f"file '{p.resolve().as_posix()}'" for p in teile),
                           encoding="utf-8")
    spur = ordner / "eigener_ton.wav"
    common.lauf(["-f", "concat", "-safe", "0", "-i", str(verzeichnis), "-c", "copy", str(spur)])
    return spur


def _musik_bestimmen(liste: "Schnittliste", bericht: dict[str, Any]) -> Path:
    """Das Musikbett waehlen und seinen Nachweis pruefen. Wirft bei jedem Hindernis."""
    # Ohne Musik bliebe das Video vollstaendig stumm — der Originalton ist
    # bewusst weg (siehe _segment_bauen). Und ein stummes Video faellt in der
    # Ausgangspruefung durch: "ein stummes Video ist kein fertiges Video".
    musik = None
    if liste.musik:
        vorgabe = common.MUSIK / liste.musik
        if not vorgabe.exists():
            raise RuntimeError(f"Musikstueck nicht gefunden: {liste.musik}")
        musik = vorgabe
    else:
        musik = common.musik_waehlen(int(liste.produkt_id))
    if musik is None:
        raise RuntimeError(
            "kein Musikstueck in Marketing/musik — ohne Ton faellt das Video "
            "in der Ausgangspruefung durch"
        )
    bericht["musik"] = musik.name

    # DIESELBE SPERRE WIE FUER DIE QUELLCLIPS.
    #
    # Hier stand vorher nur ein Vermerk im Bericht — das Rendern lief weiter.
    # Damit galt die haertere Regel fuer das kleinere Risiko: ein fremder
    # Videoclip ohne Nachweis brach ab, ein fremdes Musikstueck nicht, obwohl
    # Musik die haeufigste Ursache einer Urheberrechtsmeldung auf TikTok ist.
    # Ein Vermerk in einem Bericht, den niemand liest, ist keine Sperre.
    #
    # Die Pruefung laeuft ueber musik/lizenzen.json (siehe assets.py) und
    # funktioniert deshalb auch ohne Datenbank.
    # Die Pruefung laeuft ueber DIESELBE Tuer wie bei den Quellclips
    # (assets.hat_lizenz); den ausfuehrlichen Grund holt erst der Fehlerfall.
    # So gibt es eine Stelle, an der ueber Rechte entschieden wird, und nicht
    # zwei, die auseinanderlaufen koennen.
    if not assets.hat_lizenz(musik):
        grund = assets.musik_ohne_nachweis(musik) or "kein Lizenzeintrag"
        raise RuntimeError(
            f"Musikstueck ohne Lizenznachweis: {musik.name} — {grund}. "
            f"Erst die Rechte klaeren und in {assets.MUSIK_REGISTER.name} eintragen, "
            f"dann rendern."
        )
    bericht["musik_lizenz"] = (assets.musikregister().get(musik.name) or {}).get("lizenz")
    return musik


def _auf_takt(liste: "Schnittliste", musik: Path, bericht: dict[str, Any]) -> "Schnittliste":
    """Punkt 39: Segmentgrenzen auf die Schlaege des Musikbetts ziehen — wo es nah genug ist."""
    an = liste.takt if liste.takt is not None else bool(guardrails.wert("video.takt_schnitt", True))
    if not an or not liste.segmente:
        return liste
    try:
        raster = takt.schlaege(musik)
    except Exception as fehler:  # noqa: BLE001 — ohne Takt ist das Video trotzdem eins
        bericht["takt"] = {"erkannt": False, "grund": f"nicht lesbar: {str(fehler)[:120]}"}
        return liste
    if not raster["erkannt"]:
        bericht["takt"] = {"erkannt": False, "grund": raster.get("grund")}
        return liste

    hoechstens: list[float | None] = []
    for s in liste.segmente:
        laenge = s.quelldauer
        if laenge is None:
            info = common.medien_info(s.quelle)
            laenge = info.dauer if info is not None and info.dauer > 0 else None
        hoechstens.append(max(laenge - s.von, 0.0) if laenge is not None else None)

    toleranz = float(guardrails.wert("video.takt_toleranz_ms", 150)) / 1000.0
    neu, protokoll = takt.auf_takt_ziehen(
        [s.dauer for s in liste.segmente], raster["schlaege"],
        toleranz=toleranz, hoechstens=hoechstens)
    gezogen = [p for p in protokoll if p["verschoben_ms"]]
    bericht["takt"] = {
        "erkannt": True, "bpm": raster["bpm"], "quelle": raster["quelle"],
        "gezogen": len(gezogen),
        "nicht_gezogen": sum(1 for p in protokoll if p.get("nicht") and p.get("nicht") != "kein Schlag"),
        "verschiebungen_ms": [p["verschoben_ms"] for p in protokoll],
    }
    return dataclasses.replace(liste, segmente=[
        dataclasses.replace(s, bis=round(s.von + d, 3)) for s, d in zip(liste.segmente, neu)
    ])


def _segment_bauen(segment: Segment, ziel: Path, *, vorschau: bool = False) -> Path:
    """Ein Segment auf 1080x1920 bringen — Ton bewusst weg.

    WARUM DER TON WEGFAELLT
    Der Originalton fremder Clips bringt zwei Probleme mit: die Stimme eines
    fremden Creators und haeufig lizenzierte Musik, die nur innerhalb der
    TikTok-App erlaubt ist. Beides wandert stillschweigend mit, wenn man einen
    Clip einfach schneidet. Die sichere Einstellung gehoert deshalb in den
    Standardweg, nicht in eine Option, an die jemand denken muss.
    """
    # Erst zuschneiden, dann einpassen: Sonst wird der Zuschnitt auf das
    # bereits gefuellte Bild angewandt und trifft die falsche Stelle.
    #
    # PUNKT 33: Der Weissblitz liegt am ANFANG dieses Segments — nicht
    # zwischen zweien. So bleibt jedes Segment eine eigene Datei, die
    # Verkettung per concat funktioniert weiter, und die gemessene
    # Gesamtlaenge verschiebt sich nicht. Ein echter xfade muesste zwei
    # Segmente gleichzeitig kennen und wuerde beides brechen.

    # PUNKT 51: In der Vorschau wird schon HIER verkleinert, nicht erst am
    # Ende.
    #
    # GEMESSEN, weil der erste Entwurf nur den letzten Schritt verkleinerte
    # und kaum etwas brachte (13,3 s gegen 16,8 s). Die Zeit steckt in den
    # Segmenten, nicht in der Verkettung:
    #
    #     ein Segment in 1080x1920          1,81 s
    #     dasselbe in 540x960, ultrafast    0,26 s   -> 7x schneller
    #
    # Die Schriftgroessen der Untertitel sind in ASS absolut gesetzt und
    # wuerden in einem 540x960-Bild doppelt so gross wirken. Deshalb bleibt
    # die Untertitelspur in der Vorschau aus — sie ist eine Vorschau auf
    # Reihenfolge und Rhythmus, und genau dafuer ist sie gedacht.
    einpassen = ("scale=540:960:force_original_aspect_ratio=increase,"
                 "crop=540:960,setsar=1") if vorschau else common.einpassen()
    if segment.zuschnitt:
        filter_kette = f"{segment.zuschnitt},{einpassen}"
    else:
        filter_kette = einpassen
    if str(getattr(segment, "uebergang", "") or "") == "blitz":
        filter_kette = f"{filter_kette},{uebergang_filter()}"

    kodierung = (["-preset", "ultrafast", "-crf", "30"] if vorschau else [])
    common.lauf([
        "-ss", f"{segment.von:.2f}",
        "-t", f"{segment.dauer:.2f}",
        "-i", str(segment.quelle),
        "-vf", f"{filter_kette},fps=30",
        "-an",
        "-c:v", "libx264", *kodierung, "-pix_fmt", "yuv420p", str(ziel),
    ])
    return ziel


def rendere(
    liste: Schnittliste,
    produkt: Produkt,
    ziel: Path,
    *,
    arbeitsordner: Path | None = None,
    vorschau: bool = False,
) -> tuple[Path, dict[str, Any]]:
    """Ein Video aus einer Schnittliste bauen. Wirft bei jedem harten Hindernis.

    @param vorschau  PUNKT 51: halbe Kantenlaenge, schnellste Einstellung.
        Beim Bauen einer Fassung geht es um Reihenfolge und Rhythmus, nicht um
        Bildqualitaet — trotzdem wurde jedes Mal in voller Aufloesung
        gerendert. Die Wartezeit fiel dort an, wo sie am wenigsten nuetzt.

        DIESELBE SCHNITTLISTE, nur ein anderer Schalter. Wichtig ist, was
        NICHT anders ist: Segmentgrenzen, Texte, Musik, Reihenfolge, Endkarte.
        Eine Vorschau, die etwas anderes zeigt als die Endfassung, ist keine
        Vorschau — sie ist ein zweites Video.

        Die Datei bekommt ausserdem ein anderes Format (540x960) und faellt
        damit durch die Ausgangspruefung. Das ist gewollt: Eine Vorschau darf
        nie versehentlich veroeffentlicht werden.
    """
    ok, grund = common.verfuegbar()
    if not ok:
        raise RuntimeError(grund)

    # DIE SPERRE. Sie steht vor allem anderen: Rechenzeit fuer ein Video, das
    # ohnehin nicht veroeffentlicht werden darf, ist verschwendet — und ein
    # fertiges Video im Ordner sieht aus wie ein freigegebenes.
    offen = ungeklaerte_rechte(liste)
    if offen:
        namen = ", ".join(p.name for p in offen[:4])
        mehr = f" (+{len(offen) - 4} weitere)" if len(offen) > 4 else ""
        raise RuntimeError(
            f"{len(offen)} Quellclip(s) ohne Lizenznachweis: {namen}{mehr}. "
            "Erst die Rechte klaeren und das Material eintragen "
            "(assets.registriere), dann rendern."
        )

    ordner = Path(arbeitsordner or tempfile.mkdtemp(prefix="maios_stil_c_"))
    ordner.mkdir(parents=True, exist_ok=True)
    bericht: dict[str, Any] = {
        "stil": "C",
        "segmente": len(liste.segmente),
        "dauer_soll": liste.gesamtdauer,
        "schnittliste": liste.quelle_datei.name if liste.quelle_datei else None,
        # Fuers Lernen: Welche Rohclips steckten drin? Ohne diese Spalte kann
        # der Bandit nie lernen, dass Material eines bestimmten Creators laeuft.
        "quellen": sorted({s.quelle.name for s in liste.segmente}),
        # Punkt 59: dieselben Clips mit Herkunft (Creator, TikTok-Kennung,
        # eigen/fremd) und die Vorlage — die Merkmale, aus denen das Lernen
        # "Clips von diesem Creator laufen" ableiten kann.
        "herkunft": herkunft_der_quellen(liste),
        "vorlage": liste.vorlage,
        # Fuer die Bildunterschrift beim Posten — und damit im Bericht steht,
        # ob ueberhaupt Text da war.
        "hook": liste.hook,
        "hashtags": liste.hashtags,
        # Der Originalton fremder Clips faellt grundsaetzlich weg (siehe
        # _segment_bauen). Das stand bisher nur im Quelltext. Wer in einem
        # halben Jahr fragt, ob die Stimme eines Creators je in einem Beitrag
        # war, soll die Antwort in den Daten finden, nicht im Code.
        "ton_entfernt": True,
        # Punkt 51: Steht im Bericht, damit eine Vorschau in der Datenbank
        # nicht wie eine Endfassung aussieht.
        "vorschau": bool(vorschau),
    }

    # ── 0. Musik und Takt (Punkt 39) ─────────────────────────────────
    # Vor dem Schneiden: Das Raster aus dem Musikbett bestimmt, wo die
    # Schnitte liegen. Nebenbei faellt eine fehlende Musik oder ein fehlender
    # Nachweis jetzt auf, BEVOR Rechenzeit ins Schneiden geflossen ist.
    musik = _musik_bestimmen(liste, bericht)
    liste = _auf_takt(liste, musik, bericht)
    bericht["dauer_soll"] = liste.gesamtdauer

    # ── 1. Segmente ──────────────────────────────────────────────────
    teile = [
        _segment_bauen(segment, ordner / f"segment_{i:02d}.mp4", vorschau=vorschau)
        for i, segment in enumerate(liste.segmente)
    ]

    # ── 2a. Endkarte ─────────────────────────────────────────────────
    # Bis hierher endete ein Stil-C-Clip mit dem letzten Schnitt: kein Preis,
    # keine Adresse, kein Aufruf. Stil A und B haben die Endkarte seit jeher,
    # und common.baue_endkarte() lag fertig daneben — Stil C hat sie nur nie
    # benutzt. Ein Kanal, auf dem jedes dritte Video anders aufhoert, sieht
    # zusammengestueckelt aus.
    if liste.endkarte:
        schluss = _endkarte_bauen(produkt, ordner)
        if schluss is not None:
            teile.append(schluss)
            bericht["endkarte"] = True
            # DIE ERWARTUNG MUSS DIE ENDKARTE MITZAEHLEN.
            #
            # dauer_soll geht als erwartete_dauer an die Ausgangspruefung, und
            # die schlaegt ab drei Sekunden Abweichung an. Ohne diese Zeile
            # verglich sie 10,5 s Soll gegen 13,0 s Bild — 2,5 s daneben, und
            # damit nur knapp unter der Grenze. Gemessen an einem echten Lauf:
            # "Bild ist 13.00s lang, die Liste sagt 10.50s". Eine etwas
            # laengere Endkarte, und ein einwandfreies Video waere mit
            # "Laufzeit weicht stark vom Briefing ab" durchgefallen.
            bericht["dauer_soll"] = round(liste.gesamtdauer + ENDKARTE_SEK, 2)

    # ── 2b. Zusammensetzen ───────────────────────────────────────────
    teile_liste = ordner / "teile.txt"
    teile_liste.write_text(
        "\n".join(f"file '{p.resolve().as_posix()}'" for p in teile), encoding="utf-8"
    )
    stumm = ordner / "stumm.mp4"
    common.lauf(["-f", "concat", "-safe", "0", "-i", str(teile_liste),
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", str(stumm)])

    # DIE LAENGE WIRD GEMESSEN, NICHT GERECHNET.
    #
    # Hier ging vorher liste.gesamtdauer weiter — die Summe der SOLL-Zeiten
    # aus der Liste. Die zusammengesetzte Datei weicht davon um Frames ab:
    # Jedes Segment wird auf 30 fps gebracht, und beim Zusammensetzen rundet
    # ffmpeg auf ganze Bilder. Zu grosszuegig gesetzt heisst Standbild am
    # Ende, zu knapp heisst abgeschnittener letzter Schnitt — und die
    # Ausgangspruefung merkt das erst ab drei Sekunden Abweichung.
    #
    # Dieselbe Regel wie dort: die Datei messen, nicht den Rueckgabewert
    # glauben.
    gemessen = common.medien_info(stumm)
    gesamt = gemessen.dauer if gemessen is not None and gemessen.dauer > 0 else liste.gesamtdauer
    bericht["dauer_gemessen"] = round(gesamt, 2)
    if abs(gesamt - liste.gesamtdauer) > 0.5:
        print(f"[stil_c] Bild ist {gesamt:.2f}s lang, die Liste sagt "
              f"{liste.gesamtdauer:.2f}s — es gilt die gemessene Laenge.")

    # ── Tempo und Varianten (Punkte 34 und 36) ───────────────────────
    #
    # Beides sind HINWEISE, keine Sperren, und beide stehen im Bericht — wer
    # nur "hat gerendert" liest, bekommt sie nicht zu sehen, und genau dafuer
    # sind sie da. Gerechnet wird aus der LISTE, nicht aus der fertigen Datei:
    # Die Segmentgrenzen stehen nur dort, und aus dem fertigen Video liessen
    # sie sich nur erraten.
    tempo_bericht = tempo(liste)
    bericht["tempo"] = tempo_bericht
    for hinweis in tempo_bericht["hinweise"]:
        print(f"[stil_c] Tempo: {hinweis}")

    varianten_bericht = varianten(liste)
    if varianten_bericht["gefunden"]:
        bericht["varianten"] = varianten_bericht["gefunden"]
    for hinweis in varianten_bericht["hinweise"]:
        print(f"[stil_c] {hinweis}")

    blitze = sum(1 for seg in liste.segmente
                 if str(getattr(seg, "uebergang", "") or "") == "blitz")
    if blitze:
        bericht["uebergaenge"] = {"blitz": blitze,
                                  "schnitt": len(liste.segmente) - blitze}

    # ── 2c. Eigener Ton (Punkt 44) ───────────────────────────────────
    eigener_ton = None
    mit_ton = [nr for nr, s in enumerate(liste.segmente, start=1) if s.ton == "eigen"]
    if mit_ton:
        eigener_ton = _tonspur_bauen(
            liste, ordner, nachlauf_sek=max(gesamt - liste.gesamtdauer, 0.0))
        bericht["eigener_ton"] = mit_ton

    # ── 3. Einblendungen ─────────────────────────────────────────────
    # Aus den Segmenttexten wird dieselbe ASS-Datei wie bei Stil A gebaut —
    # gleiche Schrift, gleiche Raender, gleiches Aussehen. Ein Clip, der
    # anders beschriftet ist als die anderen, faellt sofort auf.
    segmente_text: list[dict[str, Any]] = []
    laufzeit = 0.0
    for segment in liste.segmente:
        if segment.text:
            segmente_text.append({
                "von": laufzeit, "bis": laufzeit + segment.dauer, "text": segment.text,
            })
        laufzeit += segment.dauer

    # Punkt 44: Untertitel aus dem eigenen Ton — nicht in der Vorschau, dort
    # wird ohnehin nichts eingebrannt, und das Abhoeren kostet Sekunden.
    if liste.untertitel == "aus_ton" and eigener_ton is not None and not vorschau:
        try:
            bloecke, herkunft = _untertitel_holen(liste, eigener_ton)
            segmente_text.extend(bloecke)
            segmente_text.sort(key=lambda s: s["von"])
            bericht["untertitel_aus_ton"] = len(bloecke)
            bericht["untertitel_quelle"] = herkunft
        except Exception as fehler:  # noqa: BLE001 — ohne Untertitel ist das Video trotzdem eins
            bericht["untertitel_aus_ton"] = 0
            print(f"[stil_c] ⚠️  Untertitel aus dem Ton nicht erkannt: {fehler}")

    # DER HOOK IST EIN EIGENER PLATZ, KEIN ERSTES SEGMENT.
    #
    # Auf TikTok entscheidet sich in den ersten ein bis zwei Sekunden, ob
    # weitergeschaut wird; alles danach ist fuer die Mehrheit nie passiert.
    # schreibe_untertitel() kann das seit Stil A (hook= / hook_dauer=) — Stil
    # C hat den Text bisher nur in die Bildunterschrift geschrieben, wo ihn
    # niemand liest, bevor er weiterwischt.
    hooktext = liste.hook if guardrails.wert("video.hook_overlay", True) else None
    ass = None
    if segmente_text or hooktext:
        ass = common.schreibe_untertitel(
            segmente_text, ordner / "untertitel.ass",
            hook=hooktext,
            hook_dauer=float(guardrails.wert("video.hook_overlay_sek", 2.5)),
        )
        bericht["hook_eingeblendet"] = bool(hooktext)

    # ── 4. Musik ─────────────────────────────────────────────────────
    # Ausgewaehlt und geprueft wird sie seit Punkt 39 VOR dem Schneiden
    # (_musik_bestimmen, ganz oben): Das Taktraster kommt aus ihr.

    ziel.parent.mkdir(parents=True, exist_ok=True)

    argumente = ["-i", str(stumm), "-stream_loop", "-1", "-i", str(musik)]
    if eigener_ton is not None:
        argumente += ["-i", str(eigener_ton)]
    if ass is not None and not vorschau:
        argumente += ["-vf", f"subtitles='{common._ass_pfad(ass)}'"]
    elif ass is not None and vorschau:
        # PUNKT 51: In der Vorschau bleibt die Untertitelspur aus.
        #
        # Die Schriftgroessen im ASS-Stil sind ABSOLUT gesetzt (64 px, Hook
        # 76 px) — in einem 540x960-Bild wirkten sie doppelt so gross, und
        # die Vorschau zeigte etwas, das die Endfassung nicht zeigt. Eine
        # Vorschau, die etwas anderes zeigt, ist keine.
        #
        # Die Spur wird trotzdem GEBAUT (oben), damit ein Fehler darin auch
        # in der Vorschau auffaellt — nur eingebrannt wird sie nicht.
        bericht["untertitel_in_vorschau"] = False
    # EIN- UND AUSBLENDUNG.
    #
    # Hier stand nur loudnorm, und "-t" schnitt das Stueck hart ab: Der Clip
    # endete mit abgerissenem Ton. Stil A und B blenden laengst aus
    # (common.ton_mit_musik: afade in 0,8 s, out 1,5 s) — ein Kanal, auf dem
    # jedes zweite Video anders endet, wirkt zusammengestueckelt.
    #
    # REIHENFOLGE: erst loudnorm, dann die Blenden. Andersherum wuerde die
    # dynamische Normalisierung die Ausblendung wieder anheben — sie tut
    # genau das, wogegen eine Blende arbeitet.
    einblendung = min(0.8, gesamt / 4)
    ausblendung = min(1.5, gesamt / 3)
    argumente += [
        # Lautheit auf denselben Zielwert wie bei A und B. Unterschiedlich
        # laute Clips im selben Kanal sind der hoerbarste Amateurfehler.
        "-t", f"{gesamt:.2f}",
    ]
    blenden = (f"{common.loudnorm_filter()},"
               f"afade=t=in:st=0:d={einblendung:.2f},"
               f"afade=t=out:st={max(gesamt - ausblendung, 0):.2f}:d={ausblendung:.2f}")
    if eigener_ton is None:
        argumente += ["-af", blenden, "-map", "0:v:0", "-map", "1:a:0"]
    else:
        # PUNKT 44: Die Musik WEICHT der Stimme (sidechaincompress), statt
        # dauerhaft leise zu laufen: Wo niemand spricht, traegt sie den Clip,
        # wo gesprochen wird, geht sie runter. Danach dieselbe Lautheit und
        # dieselben Blenden wie immer.
        argumente += [
            "-filter_complex",
            ("[2:a]aformat=channel_layouts=stereo,asplit=2[steuer][stimme];"
             "[1:a]aformat=channel_layouts=stereo[musik];"
             "[musik][steuer]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=400[geduckt];"
             f"[geduckt][stimme]amix=inputs=2:duration=first:normalize=0,{blenden}[ton]"),
            "-map", "0:v:0", "-map", "[ton]",
        ]
    if vorschau:
        # Verkleinert wurde schon beim Segmentbau — hier nur noch schnell
        # kodieren. Ein zweites scale waere Rechenzeit fuer nichts.
        argumente += [
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-ar", "48000",
            str(ziel),
        ]
    else:
        argumente += [
            "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
            "-movflags", "+faststart", str(ziel),
        ]
    common.lauf(argumente)

    # PUNKT 53: Die Fassungsgeschichte neben die Datei legen.
    #
    # ERST JETZT, nach dem letzten ffmpeg-Aufruf: Vorher stuende sie neben
    # einer Datei, die es noch nicht gibt — und bliebe liegen, wenn das
    # Rendern scheitert. Eine Begleitdatei ohne Video ist schlimmer als keine.
    begleit = schreibe_begleitdatei(ziel, liste, bericht)
    if begleit is not None:
        bericht["begleitdatei"] = begleit.name

    return ziel, bericht


# ── Job-Einstieg ─────────────────────────────────────────────────────

# ── Vorlagen (Punkt 28) ──────────────────────────────────────────────
#
# Die Form eines Clips — wie viele Segmente, wie lang, wo Text steht — fing bei
# jeder Fassung wieder bei null an. Die Vorlagen liegen als JSON in
# schnittlisten/vorlagen/ (lesbar, ohne Python aenderbar); hier werden sie
# EINMAL eingelesen, damit es eine Quelle gibt und nicht eine Liste im Code
# und eine zweite auf der Platte, die auseinanderlaufen.
#
# Den Entwurf auf die Platte schreibt pipelines/video/vorlagen.py
# (npm run marketing:vorlage).

VORLAGEN_ORDNER = SCHNITTLISTEN / "vorlagen"


def _lade_vorlagen(ordner: Path = VORLAGEN_ORDNER) -> dict[str, dict[str, Any]]:
    """Alle Vorlagen nach Schluessel. Eine kaputte Datei wird gemeldet, nicht geworfen.

    Geworfen wuerde hier beim IMPORT — und damit stuende das Rendern jeder
    anderen Schnittliste still, nur weil eine Vorlage einen Tippfehler hat.
    """
    vorlagen: dict[str, dict[str, Any]] = {}
    if not ordner.exists():
        return vorlagen
    for pfad in sorted(ordner.glob("*.json")):
        try:
            roh = json.loads(pfad.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as fehler:
            print(f"[stil_c] ⚠️  Vorlage {pfad.name} unlesbar: {fehler}")
            continue
        kopf = roh.get("_vorlage") or {}
        schluessel = str(kopf.get("name") or pfad.stem)
        vorlagen[schluessel] = {
            "wofuer": kopf.get("wofuer", ""),
            "wann_nicht": kopf.get("wann_nicht", ""),
            "segmente": roh.get("segmente") or [],
            "pfad": pfad,
            "roh": roh,
        }
    return vorlagen


VORLAGEN = _lade_vorlagen()


def vorlagen_uebersicht() -> list[dict[str, Any]]:
    """Schluessel, Zweck und Laenge je Vorlage — OHNE Endkarte (die kommt beim Rendern dazu)."""
    return [{
        "schluessel": schluessel,
        "wofuer": v["wofuer"],
        "wann_nicht": v["wann_nicht"],
        "segmente": len(v["segmente"]),
        "dauer": round(sum(float(s.get("soll_sek") or 0) for s in v["segmente"]), 2),
    } for schluessel, v in VORLAGEN.items()]


def vorlage(schluessel: str, produkt_id: int, *, quellen: list[str] | None = None) -> dict[str, Any]:
    """Ein Geruest aus einer Vorlage. KeyError bei unbekanntem Schluessel.

    Quellen werden der Reihe nach eingesetzt; wo keine angegeben ist, bleibt
    "quelle" LEER — kein erfundener Dateiname. Eine Liste mit erfundenen
    Namen saehe fertig aus und fiele erst beim Rendern auf die Nase; eine
    leere "quelle" bricht schon beim Einlesen ab, mit Segmentnummer.
    """
    eintrag = VORLAGEN[str(schluessel).replace("-", "_")]
    geruest = copy.deepcopy(eintrag["roh"])
    geruest["produkt_id"] = int(produkt_id)
    angegeben = [str(q) for q in (quellen or [])]
    for i, segment in enumerate(geruest.get("segmente") or []):
        segment["quelle"] = angegeben[i] if i < len(angegeben) else ""
    return geruest


# ── Trockenpruefung (Punkt 48) ───────────────────────────────────────
#
# lies() bricht beim ERSTEN Fehler ab — richtig fuers Rendern, lastig beim
# Bauen einer Liste: Wer drei Fehler hat, braucht drei Laeufe, um sie zu
# sehen. Die Trockenpruefung sammelt alles, was sich ohne Video sagen laesst,
# und trennt Fehler (das Rendern wuerde abbrechen) von Hinweisen (es wuerde
# laufen, aber schwaecher).

BAUVERSUCH_SEK = 3.0


def trockenpruefung(pfad: Path, *, bauversuch: bool = False) -> dict[str, Any]:
    """Eine Schnittliste gegenlesen, ohne ein Video zu bauen.

    @param bauversuch  Zusaetzlich die ersten drei Sekunden in Vorschaugroesse
        schneiden. Die eine Frage, die keine Textpruefung beantwortet: Laesst
        sich aus diesen Quellen ueberhaupt ein Bild schneiden? Bewusst nur
        drei Sekunden — das Gegenlesen soll Sekunden kosten, nicht Minuten.
    """
    bericht: dict[str, Any] = {"ok": False, "fehler": [], "hinweise": [],
                               "tempo": None, "liste": None}
    try:
        liste = lies(Path(pfad))
    except SchnittlisteFehler as fehler:
        bericht["fehler"].append(str(fehler))
        return bericht

    bericht["liste"] = liste
    bericht["hinweise"].extend(liste.warnungen)
    bericht["tempo"] = tempo(liste)
    bericht["hinweise"].extend(bericht["tempo"]["hinweise"])
    bericht["hinweise"].extend(varianten(liste)["hinweise"])

    # Punkt 44: Erkannter Text landet woertlich im Bild — das gehoert vor dem
    # Rendern gesagt, nicht erst beim Anschauen des fertigen Videos.
    if liste.untertitel == "aus_ton":
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            bericht["hinweise"].append(
                "Untertitel aus dem Ton: faster-whisper fehlt — das Video entsteht ohne sie")
        korrektur = untertitel_datei(Path(pfad))
        if korrektur is not None and not korrektur.exists():
            bericht["hinweise"].append(
                f"Untertitel aus dem Ton werden beim ersten Rendern erkannt und in {korrektur.name} "
                "abgelegt — dort gegenlesen, Stil C brennt sie woertlich ein")

    # Dieselben Sperren wie in rendere() — mit denselben Worten, damit eine
    # Meldung hier eine Meldung dort vorwegnimmt.
    offen = ungeklaerte_rechte(liste)
    if offen:
        namen = ", ".join(p.name for p in offen[:4])
        mehr = f" (+{len(offen) - 4} weitere)" if len(offen) > 4 else ""
        bericht["fehler"].append(f"{len(offen)} Quellclip(s) ohne Lizenznachweis: {namen}{mehr}")

    if products.nach_id(liste.produkt_id) is None:
        bericht["fehler"].append(f"Produkt {liste.produkt_id} steht nicht in products.json")

    # Ohne Musikbett bricht rendere() ab (der Originalton ist bewusst weg).
    # Genau das soll hier vorher auffallen, nicht nach dem Schneiden.
    if liste.musik:
        musik = common.MUSIK / liste.musik
        if not musik.exists():
            bericht["fehler"].append(f"Musikstueck nicht gefunden: {liste.musik}")
            musik = None
    else:
        musik = common.musik_waehlen(int(liste.produkt_id))
        if musik is None:
            bericht["fehler"].append(
                "kein Musikstueck in Marketing/musik — das Rendern bricht ohne Ton ab"
            )
    if musik is not None and not assets.hat_lizenz(musik):
        bericht["fehler"].append(f"Musikstueck ohne Lizenznachweis: {musik.name}")

    if bauversuch and not bericht["fehler"]:
        try:
            bericht["bauversuch"] = _bauversuch(liste)
        except Exception as fehler:  # noqa: BLE001 — jeder Fehler ist hier ein Befund
            bericht["fehler"].append(f"Bauversuch gescheitert: {str(fehler)[:300]}")

    bericht["ok"] = not bericht["fehler"]
    return bericht


def _bauversuch(liste: Schnittliste, sekunden: float = BAUVERSUCH_SEK) -> dict[str, Any]:
    """Die ersten Sekunden der Liste wirklich schneiden — in Vorschaugroesse, ohne Ton."""
    ordner = Path(tempfile.mkdtemp(prefix="maios_bauversuch_"))
    try:
        teile: list[Path] = []
        rest = float(sekunden)
        for i, segment in enumerate(liste.segmente):
            if rest <= 0.05:
                break
            stueck = dataclasses.replace(segment, bis=segment.von + min(segment.dauer, rest))
            teile.append(_segment_bauen(stueck, ordner / f"probe_{i:02d}.mp4", vorschau=True))
            rest -= stueck.dauer
        verzeichnis = ordner / "teile.txt"
        verzeichnis.write_text(
            "\n".join(f"file '{p.resolve().as_posix()}'" for p in teile), encoding="utf-8"
        )
        probe = ordner / "probe.mp4"
        common.lauf(["-f", "concat", "-safe", "0", "-i", str(verzeichnis),
                     "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                     "-r", "30", str(probe)])
        info = common.medien_info(probe)
        if info is None or info.dauer <= 0:
            raise RuntimeError("der Bauversuch ergab eine leere Datei")
        return {"dauer": round(info.dauer, 2), "breite": info.breite,
                "hoehe": info.hoehe, "segmente": len(teile)}
    finally:
        shutil.rmtree(ordner, ignore_errors=True)


# ── Hook-Varianten (Punkt 58) ────────────────────────────────────────
#
# Welcher Anfang funktioniert, weiss man vorher nicht. Bei einer Fassung je
# Clip ist jede Veroeffentlichung eine Einzelmessung ohne Vergleich. Deshalb
# mehrere Fassungen aus DERSELBEN Liste, die sich nur am Anfang unterscheiden.
#
# ALLES ANDERE BLEIBT GLEICH — Laenge, Texte, Musik, Hashtags. Sonst misst man
# nicht den Hook, sondern verschiedene Videos.

def hook_varianten(liste: Schnittliste, hooks: list[str], *,
                   erstes_segment_tauschen: bool = False) -> list[Schnittliste]:
    """Eine Fassung je Hooktext, als unabhaengige Kopien.

    @param erstes_segment_tauschen  Zusaetzlich die erste Einstellung wechseln:
        Die Segmente werden ROTIERT (B C A, C A B), nicht gemischt — so
        behaelt jede Fassung dieselben Teile und dieselbe Laenge. Erst ab drei
        Segmenten; bei zweien waere jede Rotation der halbe Clip vertauscht.
    """
    texte = [str(h).strip() for h in (hooks or []) if str(h or "").strip()]
    if not texte:
        raise ValueError("keine Hooktexte — ohne mindestens einen gibt es nichts zu vergleichen")

    fassungen: list[Schnittliste] = []
    for i, text in enumerate(texte):
        kopie = copy.deepcopy(liste)
        kopie.hook = text
        if erstes_segment_tauschen and len(kopie.segmente) >= 3:
            n = i % len(kopie.segmente)
            kopie.segmente = kopie.segmente[n:] + kopie.segmente[:n]
            erstes = kopie.segmente[0]
            if n and erstes.text:
                kopie.warnungen.append(
                    f"Fassung {chr(97 + i)}: das neue erste Segment traegt Text "
                    f"('{erstes.text[:30]}') — er liegt unter dem Hook"
                )
        fassungen.append(kopie)
    return fassungen


def variantenname(pfad: Path, index: int) -> Path:
    """fassung.mp4 -> fassung_a.mp4. Die Kennung VOR der Endung, sonst erkennt nichts die Datei als Video."""
    if not 0 <= int(index) < 26:
        raise ValueError(f"Variante {index} — hoechstens 26 Fassungen (a bis z)")
    return pfad.with_name(f"{pfad.stem}_{chr(97 + int(index))}{pfad.suffix}")


def pruefsumme(pfad: Path) -> str:
    """Fingerabdruck des LISTENINHALTS, nicht der Datei.

    Warum nicht der Dateiname: Erkannt wurde bisher am Namen. Wer eine
    Fassung korrigierte — zwei Segmente getauscht, ein Text geaendert —
    musste die Datei umbenennen, sonst passierte nichts. Danach hiessen zwei
    Dateien unterschiedlich, die dieselbe Fassung meinen.

    Warum der Inhalt und nicht die Dateizeit: Ein "git checkout" setzt
    Zeitstempel neu, ohne dass sich etwas geaendert hat.
    """
    try:
        inhalt = pfad.read_bytes()
    except OSError:
        return ""
    # Punkt 44: Eine korrigierte Untertiteldatei ist eine geaenderte Fassung —
    # sonst bliebe der verbesserte Text liegen und das Video mit dem falschen.
    korrektur = untertitel_datei(pfad)
    if korrektur is not None and korrektur.exists():
        try:
            inhalt += b"\0" + korrektur.read_bytes()
        except OSError:
            pass
    return hashlib.sha256(inhalt).hexdigest()[:16]


def offene_listen(*, nur_dateien: bool = False) -> list[Path]:
    """Schnittlisten, zu denen es noch kein bestandenes Video gibt.

    Erkannt an Name UND Pruefsumme: Gleicher Name, anderer Inhalt heisst neu
    rendern. Gleicher Inhalt heisst ueberspringen, egal wie die Datei heisst.

    @param nur_dateien  PUNKT 50: nur an den Zieldateien entscheiden, die
        Datenbank nicht fragen. Die Warteschlange sieht alle paar Sekunden
        nach — mit Datenbank hiesse das: Neon kommt nie zur Ruhe, und genau
        so lief am 22.09. das Monatskontingent leer.
    """
    if not SCHNITTLISTEN.exists():
        return []
    # Dateien, die mit "_" beginnen, sind Vorlagen und Beispiele — sie werden
    # nicht gerendert. Ein Beispiel mit erfundenen Dateinamen wuerde sonst bei
    # jedem Lauf scheitern und die Protokolle mit Fehlern fuellen, die keine sind.
    alle = sorted(p for p in SCHNITTLISTEN.glob("*.json") if not p.name.startswith("_"))
    if nur_dateien or not db.verfuegbar():
        # OHNE DATENBANK ENTSCHEIDET DIE ZIELDATEI.
        #
        # Hier stand "return alle" — beim lokalen Lauf ueber run-local.js,
        # wo es keine DATABASE_URL gibt, wurde damit bei JEDEM Durchgang
        # alles neu gerendert, minutenlang, und das Ergebnis vom letzten Mal
        # ueberschrieben. Dieselbe Pruefung, die make seit fuenfzig Jahren
        # macht: Ist das Ziel juenger als die Quelle, ist nichts zu tun.
        offen = []
        for p in alle:
            if all(_ziel_aktuell(p, ziel) for ziel, _ in _ziele(p)):
                continue
            offen.append(p)
        return offen

    zeilen = db.abfragen(
        "SELECT schnittliste, schnittliste_hash, bericht->>'hook_variante' AS variante "
        "FROM mkt_videos "
        "WHERE stil = 'C' AND pruefergebnis = 'ok' AND schnittliste IS NOT NULL",
        (),
    )
    fertig = {(z["schnittliste"], z.get("schnittliste_hash"), z.get("variante")) for z in zeilen}
    # Zeilen aus der Zeit vor der Pruefsumme haben keine. Sie gelten weiter
    # als fertig — sonst wuerde der Umstellungstag alles noch einmal rendern.
    alt_ohne_summe = {z["schnittliste"] for z in zeilen if not z.get("schnittliste_hash")}

    offen = []
    for p in alle:
        if p.name in alt_ohne_summe:
            continue
        summe = pruefsumme(p)
        # Punkt 58: Mit Hook-Varianten ist eine Liste erst fertig, wenn JEDE
        # Fassung bestanden hat. Sonst bliebe eine gescheiterte Fassung b
        # liegen, sobald a durch ist — und der Vergleich faende nie statt.
        if all((p.name, summe, kennung) in fertig for _, kennung in _ziele(p)):
            continue
        offen.append(p)
    return offen


def _ziele(pfad: Path) -> list[tuple[Path, str | None]]:
    """Zieldateien einer Liste mit Variantenkennung — ohne Varianten genau eine, Kennung None.

    Liest nur das JSON, nicht die Clips: offene_listen() laeuft bei jedem
    Takt, und eine unlesbare Liste soll hier nicht scheitern, sondern beim
    Rendern mit Segmentnummer gemeldet werden.
    """
    basis = common.RENDERS / f"{pfad.stem}_stil_c.mp4"
    try:
        roh = json.loads(pfad.read_text(encoding="utf-8-sig"))
        anzahl = len([h for h in (roh.get("hook_varianten") or []) if str(h or "").strip()])
    except (OSError, json.JSONDecodeError, AttributeError):
        anzahl = 0
    if anzahl <= 0:
        return [(basis, None)]
    return [(variantenname(basis, i), chr(97 + i)) for i in range(min(anzahl, 26))]


def _ziel_aktuell(liste_pfad: Path, ziel: Path) -> bool:
    if not ziel.exists():
        return False
    stand = liste_pfad.stat().st_mtime
    korrektur = untertitel_datei(liste_pfad)
    if korrektur is not None and korrektur.exists():
        stand = max(stand, korrektur.stat().st_mtime)
    return ziel.stat().st_mtime >= stand


def job_render_stil_c() -> dict[str, Any]:
    """Offene Schnittlisten rendern — dieselben Kontrollen wie A und B."""
    ok, grund = common.verfuegbar()
    if not ok:
        print(f"[stil_c] uebersprungen — {grund}")
        return {"gerendert": 0, "grund": grund}

    listen = offene_listen()
    if not listen:
        return {"gerendert": 0, "grund": "keine offenen Schnittlisten"}

    gerendert = 0
    verworfen = 0

    # Hoechstens zwei je Lauf: Rendern dauert, und ein Lauf soll nicht eine
    # Stunde blockieren. Das war schon so — es stand nur nirgends. Wer fuenf
    # Listen hinlegt, sah zwei Videos und keinen Hinweis auf die drei
    # anderen: genau die Stille, an der im Shop monatelang niemand gemerkt
    # hat, dass die Wochenlaeufe nicht liefen.
    JE_LAUF = 2
    wartend = max(len(listen) - JE_LAUF, 0)

    for pfad in listen[:JE_LAUF]:
        ergebnis = rendere_liste(pfad)
        gerendert += ergebnis["gerendert"]
        verworfen += ergebnis["verworfen"]

    if wartend:
        print(f"[stil_c] {min(len(listen), JE_LAUF)} von {len(listen)} Listen bearbeitet, "
              f"{wartend} warten auf den naechsten Lauf.")
    return {"gerendert": gerendert, "verworfen": verworfen, "wartend": wartend}


def rendere_liste(pfad: Path) -> dict[str, Any]:
    """Eine Schnittliste rendern — alle ihre Fassungen. Wirft nicht.

    Gemeinsamer Weg fuer den Takt-Lauf (job_render_stil_c) und die
    Warteschlange (Punkt 50): Was hier geprueft wird, gilt in beiden.
    """
    gerendert = 0
    verworfen = 0
    try:
        liste = lies(pfad)
    except SchnittlisteFehler as fehler:
        print(f"[stil_c] ⛔ {pfad.name}: {fehler}")
        return {"gerendert": 0, "verworfen": 1, "fehler": str(fehler)}

    for warnung in liste.warnungen:
        print(f"[stil_c] ⚠️  {pfad.name}: {warnung}")

    produkt = products.nach_id(liste.produkt_id)
    if produkt is None:
        print(f"[stil_c] ⛔ {pfad.name}: Produkt {liste.produkt_id} gibt es nicht")
        return {"gerendert": 0, "verworfen": 1, "fehler": f"Produkt {liste.produkt_id} gibt es nicht"}

    # PUNKT 58: Mit Hook-Varianten entsteht je Hooktext eine eigene Datei
    # (fassung_stil_c_a.mp4, _b, _c) mit eigener Zeile in mkt_videos — und
    # damit eigener Kampagnenkennung (mkt_<video_id>). Nur so lassen sich
    # die Fassungen nach dem Veroeffentlichen auseinanderhalten.
    summe = pruefsumme(pfad)
    if liste.hook_varianten:
        fassungen = hook_varianten(liste, liste.hook_varianten,
                                   erstes_segment_tauschen=liste.varianten_rotieren)
    else:
        fassungen = [liste]
    for fassung, (ziel, kennung) in zip(fassungen, _ziele(pfad)):
        if kennung and _fassung_fertig(pfad, summe, kennung, ziel):
            continue
        for warnung in fassung.warnungen[len(liste.warnungen):]:
            print(f"[stil_c] ⚠️  {pfad.name}: {warnung}")
        if _rendere_fassung(fassung, produkt, pfad, summe, ziel, kennung):
            gerendert += 1
        else:
            verworfen += 1
    return {"gerendert": gerendert, "verworfen": verworfen, "fehler": None}


def _fassung_fertig(pfad: Path, summe: str, kennung: str, ziel: Path) -> bool:
    """Ist DIESE Fassung schon bestanden? Dann wird sie nicht noch einmal gerendert."""
    if not db.verfuegbar():
        return _ziel_aktuell(pfad, ziel)
    zeile = db.eine_zeile(
        "SELECT 1 AS da FROM mkt_videos WHERE stil = 'C' AND pruefergebnis = 'ok' "
        "AND schnittliste = %s AND schnittliste_hash = %s AND bericht->>'hook_variante' = %s",
        (pfad.name, summe, kennung),
    )
    return zeile is not None


def _rendere_fassung(liste: Schnittliste, produkt: Produkt, pfad: Path, summe: str,
                     ziel: Path, kennung: str | None) -> bool:
    """Eine Fassung rendern, pruefen und festhalten. True, wenn sie bestanden hat."""
    video_id = None
    if db.verfuegbar():
        zeile = db.eine_zeile(
            "INSERT INTO mkt_videos "
            "(stil, pfad, schnittliste, schnittliste_hash, produkt_id) "
            "VALUES ('C', %s, %s, %s, %s) RETURNING id",
            (str(ziel), pfad.name, summe, liste.produkt_id),
        )
        video_id = int(zeile["id"]) if zeile else None

    import time as _zeit
    begonnen = _zeit.monotonic()
    try:
        _, bericht = rendere(liste, produkt, ziel)
        if kennung:
            # Welche Fassung das ist — daran erkennt offene_listen(), ob die
            # Liste fertig ist, und das Lernen, welcher Hook lief.
            bericht["hook_variante"] = kennung
        ergebnis = quality_gate.pruefe(ziel, erwartete_dauer=bericht.get("dauer_soll"))
        if video_id:
            quality_gate.haltefest(video_id, ergebnis)
            # Der Bericht wandert MIT in die Datenbank. Er stand bisher
            # nur im Protokoll eines Laufs — dabei ist genau das die
            # Angabe, die das Lernmodul braucht ("welche Rohclips, welche
            # Musik, welcher Hook steckten drin").
            # Der Fingerabdruck wird NACH dem Rendern neu genommen: Hat dieser
            # Lauf die Untertitel-Korrekturdatei eben erst angelegt, zaehlt sie
            # schon dazu — sonst galt die Liste sofort wieder als geaendert.
            db.ausfuehren(
                "UPDATE mkt_videos SET renderdauer_sek = %s, bericht = %s, "
                "schnittliste_hash = %s WHERE id = %s",
                (round(_zeit.monotonic() - begonnen, 2),
                 json.dumps(bericht, ensure_ascii=False, default=str),
                 pruefsumme(pfad) or summe,
                 video_id),
            )
        name = f"{produkt.name}" + (f" (Fassung {kennung})" if kennung else "")
        if ergebnis.bestanden:
            print(f"[stil_c] ✅ {name}: {ergebnis.info.dauer:.1f}s aus "
                  f"{bericht['segmente']} Segment(en), Musik '{bericht.get('musik')}'")
            return True
        print(f"[stil_c] ⛔ verworfen ({name}): {ergebnis.als_text()}")
        return False
    except Exception as fehler:
        print(f"[stil_c] ❌ {pfad.name}" + (f" Fassung {kennung}" if kennung else "") + f": {fehler}")
        if video_id:
            quality_gate.haltefest(
                video_id, quality_gate.Pruefergebnis(False, [str(fehler)[:300]])
            )
        return False


def _befehl(argv: list[str] | None = None) -> int:
    """Die Unterbefehle aus SCHNITT.md: `vorlage` und `pruefen`.

        py -m pipelines.video.style_c_schnittliste vorlage [name --produkt N …]
        py -m pipelines.video.style_c_schnittliste pruefen <liste> [--bauversuch]

    `vorlage` reicht an vorlagen.py weiter — EIN Weg, auch fuer
    npm run marketing:vorlage. Ohne Unterbefehl wird geprueft.
    """
    import sys
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "vorlage":
        from . import vorlagen
        return vorlagen.main(argv[1:])
    if argv and argv[0] == "pruefen":
        argv = argv[1:]
    return _pruefen_befehl(argv)


def _pruefen_befehl(argv: list[str] | None = None) -> int:
    """Punkt 48 von der Kommandozeile: npm run marketing:pruefen -- <liste> [--bauversuch]."""
    import argparse
    parser = argparse.ArgumentParser(description="Schnittliste gegenlesen, ohne ein Video zu bauen.")
    parser.add_argument("liste", help="Pfad oder Dateiname in Marketing/schnittlisten/")
    parser.add_argument("--bauversuch", action="store_true",
                        help="zusaetzlich die ersten drei Sekunden in Vorschaugroesse schneiden")
    args = parser.parse_args(argv)

    pfad = Path(args.liste)
    if not pfad.exists() and (SCHNITTLISTEN / args.liste).exists():
        pfad = SCHNITTLISTEN / args.liste
    bericht = trockenpruefung(pfad, bauversuch=args.bauversuch)

    print(f"── {pfad.name} ──")
    for fehler in bericht["fehler"]:
        print(f"  ❌ {fehler}")
    for hinweis in bericht["hinweise"]:
        print(f"  ⚠️  {hinweis}")
    liste = bericht["liste"]
    if liste is not None:
        endkarte = ENDKARTE_SEK if liste.endkarte else 0.0
        print(f"  {len(liste.segmente)} Segment(e), {liste.gesamtdauer:.1f} s"
              + (f" + {endkarte:.1f} s Endkarte" if endkarte else "")
              + (f", {len(liste.hook_varianten)} Hook-Varianten" if liste.hook_varianten else ""))
    if "bauversuch" in bericht:
        b = bericht["bauversuch"]
        print(f"  Bauversuch: {b['dauer']:.1f} s in {b['breite']}x{b['hoehe']} geschnitten")
    print("  ✅ bereit zum Rendern" if bericht["ok"] else
          f"  ⛔ {len(bericht['fehler'])} Fehler — so wuerde das Rendern abbrechen")
    return 0 if bericht["ok"] else 1


if __name__ == "__main__":
    import sys
    sys.exit(_befehl())
