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

import hashlib
import json
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .. import db, products
from ..env_loader import REPO_ROOT
from ..orchestrator import guardrails
from ..products import Produkt
from . import assets, common, quality_gate

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


def lies(pfad: Path) -> Schnittliste:
    """Eine Schnittliste einlesen und auf Unmoeglichkeiten pruefen.

    Geprueft wird hier, nicht beim Rendern: Ein Tippfehler in einer Zeitangabe
    soll auffallen, bevor ffmpeg zehn Minuten laeuft. Und die Meldung nennt die
    Segmentnummer — "bis liegt vor von" ohne Zeilenangabe ist bei
    zwanzig Segmenten keine Hilfe.
    """
    try:
        roh = json.loads(Path(pfad).read_text(encoding="utf-8"))
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

    ziel.parent.mkdir(parents=True, exist_ok=True)

    argumente = ["-i", str(stumm), "-stream_loop", "-1", "-i", str(musik)]
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
        "-af", (f"{common.loudnorm_filter()},"
                f"afade=t=in:st=0:d={einblendung:.2f},"
                f"afade=t=out:st={max(gesamt - ausblendung, 0):.2f}:d={ausblendung:.2f}"),
        "-t", f"{gesamt:.2f}",
        "-map", "0:v:0", "-map", "1:a:0",
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
        return hashlib.sha256(pfad.read_bytes()).hexdigest()[:16]
    except OSError:
        return ""


def offene_listen() -> list[Path]:
    """Schnittlisten, zu denen es noch kein bestandenes Video gibt.

    Erkannt an Name UND Pruefsumme: Gleicher Name, anderer Inhalt heisst neu
    rendern. Gleicher Inhalt heisst ueberspringen, egal wie die Datei heisst.
    """
    if not SCHNITTLISTEN.exists():
        return []
    # Dateien, die mit "_" beginnen, sind Vorlagen und Beispiele — sie werden
    # nicht gerendert. Ein Beispiel mit erfundenen Dateinamen wuerde sonst bei
    # jedem Lauf scheitern und die Protokolle mit Fehlern fuellen, die keine sind.
    alle = sorted(p for p in SCHNITTLISTEN.glob("*.json") if not p.name.startswith("_"))
    if not db.verfuegbar():
        # OHNE DATENBANK ENTSCHEIDET DIE ZIELDATEI.
        #
        # Hier stand "return alle" — beim lokalen Lauf ueber run-local.js,
        # wo es keine DATABASE_URL gibt, wurde damit bei JEDEM Durchgang
        # alles neu gerendert, minutenlang, und das Ergebnis vom letzten Mal
        # ueberschrieben. Dieselbe Pruefung, die make seit fuenfzig Jahren
        # macht: Ist das Ziel juenger als die Quelle, ist nichts zu tun.
        offen = []
        for p in alle:
            ziel = common.RENDERS / f"{p.stem}_stil_c.mp4"
            if ziel.exists() and ziel.stat().st_mtime >= p.stat().st_mtime:
                continue
            offen.append(p)
        return offen

    zeilen = db.abfragen(
        "SELECT schnittliste, schnittliste_hash FROM mkt_videos "
        "WHERE stil = 'C' AND pruefergebnis = 'ok' AND schnittliste IS NOT NULL",
        (),
    )
    fertig = {(z["schnittliste"], z.get("schnittliste_hash")) for z in zeilen}
    # Zeilen aus der Zeit vor der Pruefsumme haben keine. Sie gelten weiter
    # als fertig — sonst wuerde der Umstellungstag alles noch einmal rendern.
    alt_ohne_summe = {z["schnittliste"] for z in zeilen if not z.get("schnittliste_hash")}

    offen = []
    for p in alle:
        if (p.name, pruefsumme(p)) in fertig or p.name in alt_ohne_summe:
            continue
        offen.append(p)
    return offen


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
        try:
            liste = lies(pfad)
        except SchnittlisteFehler as fehler:
            verworfen += 1
            print(f"[stil_c] ⛔ {pfad.name}: {fehler}")
            continue

        for warnung in liste.warnungen:
            print(f"[stil_c] ⚠️  {pfad.name}: {warnung}")

        produkt = products.nach_id(liste.produkt_id)
        if produkt is None:
            verworfen += 1
            print(f"[stil_c] ⛔ {pfad.name}: Produkt {liste.produkt_id} gibt es nicht")
            continue

        ziel = common.RENDERS / f"{pfad.stem}_stil_c.mp4"
        video_id = None
        if db.verfuegbar():
            zeile = db.eine_zeile(
                "INSERT INTO mkt_videos "
                "(stil, pfad, schnittliste, schnittliste_hash, produkt_id) "
                "VALUES ('C', %s, %s, %s, %s) RETURNING id",
                (str(ziel), pfad.name, pruefsumme(pfad), liste.produkt_id),
            )
            video_id = int(zeile["id"]) if zeile else None

        import time as _zeit
        begonnen = _zeit.monotonic()
        try:
            _, bericht = rendere(liste, produkt, ziel)
            ergebnis = quality_gate.pruefe(ziel, erwartete_dauer=bericht.get("dauer_soll"))
            if video_id:
                quality_gate.haltefest(video_id, ergebnis)
                # Der Bericht wandert MIT in die Datenbank. Er stand bisher
                # nur im Protokoll eines Laufs — dabei ist genau das die
                # Angabe, die das Lernmodul braucht ("welche Rohclips, welche
                # Musik, welcher Hook steckten drin"), und features.py kann
                # sie bis heute nicht lesen, weil sie nirgends steht.
                db.ausfuehren(
                    "UPDATE mkt_videos SET renderdauer_sek = %s, bericht = %s "
                    "WHERE id = %s",
                    (round(_zeit.monotonic() - begonnen, 2),
                     json.dumps(bericht, ensure_ascii=False, default=str),
                     video_id),
                )
            if ergebnis.bestanden:
                gerendert += 1
                print(f"[stil_c] ✅ {produkt.name}: {ergebnis.info.dauer:.1f}s aus "
                      f"{bericht['segmente']} Segment(en), Musik '{bericht.get('musik')}'")
            else:
                verworfen += 1
                print(f"[stil_c] ⛔ verworfen: {ergebnis.als_text()}")
        except Exception as fehler:
            verworfen += 1
            print(f"[stil_c] ❌ {pfad.name}: {fehler}")
            if video_id:
                quality_gate.haltefest(
                    video_id, quality_gate.Pruefergebnis(False, [str(fehler)[:300]])
                )

    if wartend:
        print(f"[stil_c] {gerendert + verworfen} von {len(listen)} Listen bearbeitet, "
              f"{wartend} warten auf den naechsten Lauf.")
    return {"gerendert": gerendert, "verworfen": verworfen, "wartend": wartend}
