"""Materialkatalog mit Lizenzpflicht.

DIE REGEL, DIE HIER DURCHGESETZT WIRD

Ein Asset ohne Lizenzeintrag kommt nicht ins Video. Punkt.

Das klingt streng, ist aber die einzige Fassung, die traegt: Ein Video, das
ohne Aufsicht auf TikTok landet, kann man nicht nachtraeglich "kurz
zurueckholen". Fremdes Bildmaterial darin ist eine Abmahnung mit Ansage.

REIHENFOLGE DER QUELLEN

  1. eigene Produktvideos   (produkt videos/)      — beste Quelle, echt, eigen
  2. eigene Produktbilder   (produkt bilder/)      — mit Zoomfahrt statt Standbild
  3. CJ-Produktmedien       (ueber die Shop-API)   — vom Lieferanten bereitgestellt
  4. lizenzfreier Stock     (Pexels/Pixabay)       — NUR mit Lizenzeintrag

source.unsplash.com ist ersatzlos raus: Der Endpunkt ist tot, und die
Lizenzlage war ohnehin unklar. Ein toter Endpunkt, der stillschweigend nichts
liefert, ist genau die Sorte Fehler, die dieses Projekt schon zu oft hatte.
"""

from __future__ import annotations

import hashlib
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .. import db, products
from ..env_loader import REPO_ROOT
from ..orchestrator import guardrails
from ..products import Produkt

PRODUKTBILDER = REPO_ROOT / "produkt bilder"
PRODUKTVIDEOS = REPO_ROOT / "produkt videos"

# Bildvarianten, die der Shop zur Laufzeit erzeugt (-160/-320/…). Die sind
# fuer Vorschaubilder gedacht und viel zu klein fuer 1080x1920.
VARIANTEN = ("-160", "-320", "-480", "-640")


@dataclass(frozen=True)
class Asset:
    pfad: Path
    typ: str            # 'bild' | 'video' | 'musik'
    quelle: str         # 'eigen' | 'cj' | 'pexels' | …
    lizenz: str
    lizenz_url: str | None = None
    produkt_id: int | None = None

    @property
    def nutzbar(self) -> bool:
        return bool(self.lizenz) and self.pfad.exists()


def _hash(pfad: Path) -> str:
    h = hashlib.sha256()
    with open(pfad, "rb") as datei:
        for block in iter(lambda: datei.read(65536), b""):
            h.update(block)
    return h.hexdigest()[:32]


def registriere(asset: Asset) -> bool:
    """Asset samt Lizenz eintragen. False, wenn die Lizenz fehlt.

    Das ist die Stelle, an der die Lizenzpflicht wirklich haengt: Ohne
    Eintrag findet es der Renderer spaeter nicht.
    """
    if not asset.lizenz:
        print(f"[assets] ABGELEHNT (keine Lizenz): {asset.pfad.name}")
        db.audit("asset_ohne_lizenz", job="render_style_a",
                 begruendung=f"{asset.pfad.name} aus Quelle '{asset.quelle}'")
        return False
    if not db.verfuegbar():
        return True
    db.ausfuehren(
        """INSERT INTO mkt_assets (pfad, typ, quelle, lizenz, lizenz_nachweis_url, produkt_id, hash)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (pfad) DO UPDATE
             SET lizenz = EXCLUDED.lizenz,
                 lizenz_nachweis_url = EXCLUDED.lizenz_nachweis_url""",
        (str(asset.pfad), asset.typ, asset.quelle, asset.lizenz,
         asset.lizenz_url, asset.produkt_id,
         _hash(asset.pfad) if asset.pfad.exists() else None),
    )
    return True


def hat_lizenz(pfad: Path) -> bool:
    """Liegt fuer diese Datei ein Lizenzeintrag vor?"""
    if not db.verfuegbar():
        # Ohne Datenbank kann die Lizenz nicht belegt werden. Dann gilt nur
        # eigenes Material als sicher — alles andere bleibt draussen.
        return _ist_eigenes(pfad)
    zeile = db.eine_zeile(
        "SELECT lizenz FROM mkt_assets WHERE pfad = %s", (str(pfad),)
    )
    return bool(zeile and zeile["lizenz"])


def _ist_eigenes(pfad: Path) -> bool:
    try:
        pfad.resolve().relative_to(PRODUKTBILDER.resolve())
        return True
    except (ValueError, OSError):
        pass
    try:
        pfad.resolve().relative_to(PRODUKTVIDEOS.resolve())
        return True
    except (ValueError, OSError):
        return False


# ── Eigenes Material finden ──────────────────────────────────────────

def eigene_videos(produkt: Produkt) -> list[Asset]:
    """Produktvideos, falls vorhanden. Beste Quelle ueberhaupt."""
    if not PRODUKTVIDEOS.exists():
        return []
    treffer = []
    stamm = produkt.name.lower()[:18]
    for datei in PRODUKTVIDEOS.rglob("*"):
        if datei.suffix.lower() not in (".mp4", ".mov", ".webm"):
            continue
        if stamm in datei.stem.lower() or produkt.slug in datei.stem.lower():
            treffer.append(Asset(datei, "video", "eigen", "eigenes Material",
                                 produkt_id=produkt.id))
    return treffer


def eigene_bilder(produkt: Produkt) -> list[Asset]:
    """Alle Produktbilder in voller Groesse.

    Die vom Shop erzeugten Varianten (-160/-320/…) werden ausgelassen: Sie
    sind fuer Vorschaubilder gedacht und wuerden in 1080x1920 sichtbar
    matschig. Genau dieselbe Ueberlegung steht in CLAUDE.md zur Bildroute.
    """
    treffer: list[Asset] = []

    # 1) Das Hauptbild aus products.json.
    if produkt.bild:
        haupt = REPO_ROOT / produkt.bild
        if haupt.exists():
            treffer.append(Asset(haupt, "bild", "eigen", "eigenes Material",
                                 produkt_id=produkt.id))

    # 2) Der Bildordner des Produkts (Farbvarianten, Detailaufnahmen).
    if PRODUKTBILDER.exists():
        stamm = produkt.name.lower()[:18]
        for datei in PRODUKTBILDER.rglob("*"):
            if datei.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
                continue
            if any(v in datei.stem for v in VARIANTEN):
                continue
            if stamm in datei.stem.lower() and datei not in [a.pfad for a in treffer]:
                treffer.append(Asset(datei, "bild", "eigen", "eigenes Material",
                                     produkt_id=produkt.id))
    return treffer


def _asset_ordner():
    """Wohin geladenes Stockmaterial gehoert.

    Vorher stand hier ein fester Pfad in den Projektordner. Das war an zwei
    Stellen falsch:

      * Es umging MARKETING_DATA_DIR — also genau die Variable, die es gibt,
        damit Renderings NICHT im Projektordner landen. In Umgebungen, in
        denen ein Unterprozess dort nicht schreiben darf, scheiterte der
        Download mit "No such file or directory", und die Quelle lieferte
        stillschweigend null Clips.
      * In GitHub Actions waere fremdes Stockmaterial in den Checkout
        geschrieben worden statt in den Temp-Ordner des Laufs.

    common.DATEN beruecksichtigt die Variable und faellt sonst auf
    Marketing/data zurueck — dasselbe Verhalten wie bisher, nur richtig.
    """
    from . import common

    ordner = common.DATEN / "assets"
    ordner.mkdir(parents=True, exist_ok=True)
    return ordner


def stock_bilder(suchbegriff: str, anzahl: int = 3) -> list[Asset]:
    """Lizenzfreier Stock — nur mit Schluessel UND mit Lizenzeintrag.

    Ohne PEXELS_API_KEY gibt es nichts. Kein Rueckfall auf irgendeine
    Bild-URL, kein source.unsplash.com.
    """
    schluessel = (os.environ.get("PEXELS_API_KEY") or "").strip()
    if not schluessel:
        return []
    try:
        import requests
    except ImportError:
        return []
    if not guardrails.ratenbegrenzer.warte_bis_erlaubt("pexels", max_sek=15):
        return []

    ordner = _asset_ordner()
    treffer: list[Asset] = []
    try:
        antwort = requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": schluessel},
            params={"query": suchbegriff, "per_page": anzahl,
                    "orientation": "portrait", "size": "large"},
            timeout=25,
        )
        antwort.raise_for_status()
        for foto in antwort.json().get("photos", [])[:anzahl]:
            url = (foto.get("src") or {}).get("portrait")
            if not url:
                continue
            ziel = ordner / f"pexels_{foto.get('id')}.jpg"
            if not ziel.exists():
                bild = requests.get(url, timeout=40)
                bild.raise_for_status()
                ziel.write_bytes(bild.content)
            treffer.append(Asset(
                ziel, "bild", "pexels",
                lizenz="Pexels License (frei nutzbar, keine Namensnennung noetig)",
                lizenz_url=foto.get("url"),
            ))
    except Exception as fehler:
        print(f"[assets] Pexels nicht erreichbar: {fehler}")
        return []
    return treffer


def stock_videos(suchbegriff: str, anzahl: int = 2) -> list[Asset]:
    """Lizenzfreie Videoclips von Pexels — Hochformat, kurz genug zum Schneiden.

    WAS SOLCHE CLIPS SIND UND WAS NICHT
    Sie zeigen NIE das Produkt. Sie zeigen Stimmung: Schreibtisch, Haende,
    Licht, Wohnraum. Als Zwischenschnitt zwischen echten Produktbildern
    machen sie viel aus — als Produktzeigung nichts. Deshalb stehen sie in
    der Reihenfolge HINTER dem eigenen Material und werden nur aufgefuellt,
    nie als erste Einstellung genommen.

    Warum trotzdem lohnend: Ohne sie besteht jedes Video aus Kamerafahrten
    ueber dieselben zwei, drei Lieferantenfotos. Bewegtes Material bricht das
    auf, und auf TikTok entscheidet Bildbewegung darueber, ob jemand
    weiterwischt.

    Ohne PEXELS_API_KEY gibt es nichts — kein Rueckfall auf irgendeine
    Video-URL. Jeder Clip wird mit Lizenz und Nachweisadresse registriert.
    """
    schluessel = (os.environ.get("PEXELS_API_KEY") or "").strip()
    if not schluessel:
        return []
    try:
        import requests
    except ImportError:
        return []
    if not guardrails.ratenbegrenzer.warte_bis_erlaubt("pexels", max_sek=15):
        return []

    ordner = _asset_ordner()
    treffer: list[Asset] = []
    try:
        antwort = requests.get(
            "https://api.pexels.com/videos/search",
            headers={"Authorization": schluessel},
            params={"query": suchbegriff, "per_page": max(anzahl * 3, 6),
                    "orientation": "portrait", "size": "medium"},
            timeout=25,
        )
        antwort.raise_for_status()
        for video in antwort.json().get("videos", []):
            if len(treffer) >= anzahl:
                break
            # Zu lange Clips laden unnoetig lange; aus 60 Sekunden schneiden
            # wir ohnehin nur zwei. Zu kurze reichen fuer keinen Schnitt.
            dauer = float(video.get("duration") or 0)
            if not (3 <= dauer <= 45):
                continue
            # Die kleinste Fassung waehlen, die noch 1080 breit ist: groesser
            # bringt nichts, das Ziel ist 1080x1920.
            dateien = sorted(
                (d for d in video.get("video_files", [])
                 if (d.get("height") or 0) >= 1280 and d.get("link")),
                key=lambda d: d.get("height") or 0,
            )
            if not dateien:
                continue
            url = dateien[0]["link"]
            ziel = ordner / f"pexels_video_{video.get('id')}.mp4"
            if not ziel.exists():
                inhalt = requests.get(url, timeout=90)
                inhalt.raise_for_status()
                ziel.write_bytes(inhalt.content)
            treffer.append(Asset(
                ziel, "video", "pexels",
                lizenz="Pexels License (frei nutzbar, keine Namensnennung noetig)",
                lizenz_url=video.get("url"),
            ))
    except Exception as fehler:
        print(f"[assets] Pexels-Videos nicht erreichbar: {fehler}")
        return []
    return treffer


def bildquellen_fuer(produkt: Produkt, *, mindestens: int = 4) -> list[Asset]:
    """Material fuer ein Video, in der vorgesehenen Reihenfolge.

    Jedes zurueckgegebene Asset ist registriert und hat damit eine Lizenz —
    der Renderer muss nicht noch einmal pruefen, tut es aber trotzdem.
    """
    eigenes_video = eigene_videos(produkt)
    gesammelt: list[Asset] = []
    for asset in eigenes_video + eigene_bilder(produkt):
        if registriere(asset):
            gesammelt.append(asset)
        if len(gesammelt) >= mindestens:
            break

    begriff = produkt.kategorie.split("/")[0] or produkt.name

    # ── Bewegung dazu, auch wenn die Mindestzahl schon erreicht ist ──
    #
    # Die erste Fassung fuellte Stockmaterial nur auf, wenn zu WENIG eigenes
    # da war. Damit bekam ausgerechnet ein Produkt mit sechs Fotos nie einen
    # bewegten Schnitt — und blieb eine Diaschau aus immer denselben
    # Lieferantenbildern. Genau das sollte der Zusatz aber aufbrechen.
    #
    # Deshalb jetzt: Gibt es kein EIGENES Produktvideo, kommen bis zu zwei
    # lizenzierte Clips als Zwischenschnitt dazu — unabhaengig davon, wie
    # viele Standbilder vorliegen. Gibt es ein eigenes, braucht es sie nicht.
    #
    # Die Obergrenze zwei ist bewusst niedrig: Diese Clips zeigen nie das
    # Produkt. Es soll ein Produktvideo bleiben, kein Stimmungsfilm mit
    # Produkt am Ende. Ueber 'video.stock_clips_max' abschaltbar (0).
    hoechstens = int(guardrails.wert("video.stock_clips_max", 2))
    if hoechstens > 0 and not eigenes_video:
        for asset in stock_videos(begriff, anzahl=hoechstens):
            if registriere(asset):
                gesammelt.append(asset)

    if len(gesammelt) < mindestens:
        for asset in stock_bilder(begriff, anzahl=mindestens - len(gesammelt)):
            if registriere(asset):
                gesammelt.append(asset)
    return gesammelt


# ── Aufraeumen ───────────────────────────────────────────────────────

def job_aufraeumen() -> dict[str, Any]:
    """Alte Renderings und Zwischenstaende loeschen.

    Nur was wirklich alt ist und zu keinem veroeffentlichten Video gehoert.
    Ein geloeschtes Video, das noch in der Warteschlange steht, waere ein
    stiller Ausfall.
    """
    from . import common

    tage_renders = int(guardrails.wert("aufraeumen.renders_tage", 7))
    grenze = time.time() - tage_renders * 86400
    geloescht = 0
    bytes_frei = 0

    behalten: set[str] = set()
    if db.verfuegbar():
        for zeile in db.abfragen(
            """SELECT v.pfad FROM mkt_videos v
                WHERE v.pfad IS NOT NULL
                  AND (v.erstellt_am > now() - make_interval(days => %s)
                       OR EXISTS (SELECT 1 FROM mkt_posts p
                                   WHERE p.video_id = v.id
                                     AND p.status IN ('geplant', 'gepostet')))""",
            (tage_renders,),
        ):
            behalten.add(str(zeile["pfad"]))

    for ordner in (common.RENDERS, common.AUDIO):
        if not ordner.exists():
            continue
        for datei in ordner.iterdir():
            if not datei.is_file() or str(datei) in behalten:
                continue
            if datei.stat().st_mtime > grenze:
                continue
            groesse = datei.stat().st_size
            try:
                datei.unlink()
                geloescht += 1
                bytes_frei += groesse
            except OSError:
                continue

    return {"geloescht": geloescht, "mb_frei": round(bytes_frei / 1_048_576, 2)}
