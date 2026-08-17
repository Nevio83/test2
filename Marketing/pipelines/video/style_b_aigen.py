"""Stil B: KI-generierte Einstellungen — mit erzwungener Produkttreue.

DIE EINE REGEL, DIE HIER IM PROGRAMM STEHT UND NICHT NUR IM KOMMENTAR

Eine Einstellung, die das Produkt zeigt, MUSS aus einem echten Produktfoto
entstehen (Bild-zu-Video). Reines Text-zu-Video erfindet das Produkt: Es
entsteht etwas, das aussieht wie eine Lampe, aber nicht wie DEINE Lampe. Wer
danach bestellt, bekommt etwas anderes als beworben.

Deshalb wird das erzwungen: Kann ein Anbieter kein Bild-zu-Video, wird eine
Produkt-Einstellung mit ihm gar nicht erst versucht — es gibt einen Fehler,
keinen Rueckfall auf Text-zu-Video. Genau das prueft
test_produkttreue_wird_erzwungen.

Text-zu-Video ist ausschliesslich fuer Stimmungsbilder OHNE Produkt erlaubt
(leerer Schreibtisch, Fensterlicht, Hand greift ins Leere).

WAS AUS DEM ALTEN STAND UEBERNOMMEN UND WAS REPARIERT WURDE

Uebernommen: der Gedanke, Runway ueber HTTP anzusprechen.
Repariert:
  * Der alte Aufruf nutzte "mode": "text" — also genau das Text-zu-Video,
    das das Produkt erfindet.
  * Die Warteschleife hatte KEIN Zeitlimit. Bleibt ein Auftrag beim Anbieter
    haengen, laeuft die Schleife endlos und blockiert den Job dauerhaft.
  * Der Zufallswert wurde je Einstellung neu gewuerfelt — dadurch sah jede
    Einstellung anders aus. Jetzt gibt es einen festen Wert je Kampagne.

Der Pika-Weg ist ersatzlos entfernt: Er legte eine LEERE Datei an und meldete
Erfolg. Entweder eine echte Anbindung oder gar keine.
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import tempfile
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .. import db, products
from ..env_loader import MARKETING_DIR
from ..orchestrator import guardrails
from ..products import Produkt
from . import assets, common, quality_gate
from .tts import base as tts

MARKENSTIMME = MARKETING_DIR / "config" / "brand_voice.md"


class ProdukttreueVerletzt(RuntimeError):
    """Eine Produkt-Einstellung sollte ohne echtes Produktfoto entstehen."""


@dataclass(frozen=True)
class Einstellung:
    """Eine geplante Einstellung der Shot-Liste."""

    nummer: int
    dauer: float
    prompt: str
    kamera: str
    stimmung: str
    mit_produkt: bool


# ── Bildstil aus der Markenstimme ────────────────────────────────────

def bildstil() -> str:
    """Stilbeschreibung aus brand_voice.md — damit alle Videos gleich aussehen.

    Bewusst aus der Datei gelesen und nicht im Programm festgeschrieben:
    Wenn du dort die Farben aenderst, aendern sich die Videos. Sonst waere
    die Datei Deko.
    """
    try:
        text = MARKENSTIMME.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "weiches seitliches Tageslicht, gedeckte warme Farben, ruhige Kamera"

    # Der Abschnitt "Bild und Farbe" bis zur naechsten Ueberschrift.
    treffer = re.search(r"##\s*Bild und Farbe.*?\n(.*?)(?=\n##\s|\Z)", text, re.S)
    if not treffer:
        return "weiches seitliches Tageslicht, gedeckte warme Farben, ruhige Kamera"

    zeilen = [
        re.sub(r"[*_`]", "", z).strip(" -•\t")
        for z in treffer.group(1).splitlines()
        if z.strip().startswith("-")
    ]
    return "; ".join(z for z in zeilen if z)[:600]


def kampagnen_seed(brief_id: int, produkt_id: int) -> int:
    """Fester Zufallswert je Kampagne — sonst sieht jede Einstellung anders aus.

    Aus Brief und Produkt abgeleitet statt gewuerfelt: Ein zweiter Versuch
    derselben Kampagne sieht dann genauso aus wie der erste.
    """
    roh = f"maios-{produkt_id}-{brief_id}".encode()
    return int(hashlib.sha256(roh).hexdigest()[:8], 16) % 2_147_483_647


# ── Anbieter-Adapter ─────────────────────────────────────────────────

class VideoAnbieter(ABC):
    name: str = "unbekannt"
    #: Kann der Anbieter aus einem Startbild ein Video machen?
    #: Ohne das darf er KEINE Produkt-Einstellung erzeugen.
    kann_bild_zu_video: bool = False

    @abstractmethod
    def bereit(self) -> tuple[bool, str | None]:
        """(True, None) wenn nutzbar — sonst der Grund im Klartext."""

    @abstractmethod
    def erzeuge(self, prompt: str, ziel: Path, *, dauer: float,
                startbild: Path | None, seed: int) -> Path:
        """Eine Einstellung erzeugen. Wirft bei jedem Problem."""


class RunwayAnbieter(VideoAnbieter):
    """Runway Gen-4, Bild-zu-Video.

    ACHTUNG — EHRLICHER HINWEIS: Dieser Adapter ist gegen die
    veroeffentlichte Schnittstellenform gebaut, aber mangels Zugangsschluessel
    NICHT gegen den echten Dienst erprobt. Er ist so gebaut, dass er im
    Zweifel LAUT scheitert (Zeitlimit, Statuspruefung, Groessenpruefung) —
    niemals still eine leere Datei hinterlaesst, wie es der alte Pika-Weg tat.
    """

    name = "runway"
    kann_bild_zu_video = True

    BASIS = "https://api.dev.runwayml.com/v1"
    VERSION = "2024-11-06"
    ZEITLIMIT_SEK = 600

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if not os.environ.get("RUNWAY_API_KEY"):
            return False, "RUNWAY_API_KEY fehlt"
        darf, grund = guardrails.darf_kosten_verursachen()
        if not darf:
            return False, grund
        return True, None

    def erzeuge(self, prompt: str, ziel: Path, *, dauer: float,
                startbild: Path | None, seed: int) -> Path:
        import base64

        import requests

        if startbild is None:
            # Fuer Stimmungsbilder ohne Produkt waere Text-zu-Video erlaubt —
            # dieser Adapter bietet es aber bewusst nicht an, damit gar keine
            # Gelegenheit entsteht, es fuer ein Produkt zu benutzen.
            raise ProdukttreueVerletzt(
                "Runway wird hier nur mit Startbild benutzt (Bild-zu-Video)"
            )
        if not guardrails.ratenbegrenzer.warte_bis_erlaubt("runway", max_sek=30):
            raise RuntimeError("Runway: Kontingent erschoepft")

        kopf = {
            "Authorization": f"Bearer {os.environ['RUNWAY_API_KEY']}",
            "X-Runway-Version": self.VERSION,
            "Content-Type": "application/json",
        }
        bild_daten = base64.b64encode(startbild.read_bytes()).decode()
        endung = startbild.suffix.lstrip(".").lower() or "jpg"

        antwort = requests.post(
            f"{self.BASIS}/image_to_video",
            headers=kopf,
            json={
                "model": os.environ.get("RUNWAY_MODEL_ID", "gen4_turbo"),
                "promptImage": f"data:image/{endung};base64,{bild_daten}",
                "promptText": prompt[:900],
                "ratio": "720:1280",
                "duration": max(5, min(int(round(dauer)), 10)),
                "seed": seed,
            },
            timeout=60,
        )
        antwort.raise_for_status()
        auftrag_id = antwort.json().get("id")
        if not auftrag_id:
            raise RuntimeError(f"Runway lieferte keine Auftragsnummer: {antwort.text[:200]}")

        # Warteschleife MIT Zeitlimit. Der alte Stand hatte keins — ein
        # haengender Auftrag blockierte den Job dauerhaft.
        frist = time.monotonic() + self.ZEITLIMIT_SEK
        url = None
        while time.monotonic() < frist:
            time.sleep(6)
            stand = requests.get(f"{self.BASIS}/tasks/{auftrag_id}", headers=kopf, timeout=30)
            stand.raise_for_status()
            daten = stand.json()
            zustand = (daten.get("status") or "").upper()
            if zustand == "SUCCEEDED":
                ausgaben = daten.get("output") or []
                url = ausgaben[0] if ausgaben else None
                break
            if zustand in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"Runway meldet {zustand}: {daten.get('failure', '')[:200]}")
        else:
            raise TimeoutError(
                f"Runway antwortete {self.ZEITLIMIT_SEK}s nicht abschliessend — abgebrochen"
            )

        if not url:
            raise RuntimeError("Runway meldete Erfolg, lieferte aber keine Datei")

        ziel.parent.mkdir(parents=True, exist_ok=True)
        video = requests.get(url, timeout=180)
        video.raise_for_status()
        ziel.write_bytes(video.content)
        if ziel.stat().st_size < 10_000:
            raise RuntimeError(f"Runway-Datei ist nur {ziel.stat().st_size} Byte gross")

        guardrails.buche_kosten(
            "runway", int(float(guardrails.wert("llm.preise.runway.cent_pro_sekunde", 15)) * dauer),
            endpunkt="image_to_video", einheiten=dauer, job="render_style_b",
        )
        return ziel


class LokalerAnbieter(VideoAnbieter):
    """Lokales Rendern ueber diffusers (Stable Video Diffusion).

    Greift nur bei MARKETING_RENDER_BACKEND=local. Braucht torch + diffusers
    und praktisch eine Grafikkarte; fehlt etwas, wird sauber uebersprungen.
    """

    name = "lokal"
    kann_bild_zu_video = True

    def bereit(self) -> tuple[bool, str | None]:
        if (os.environ.get("MARKETING_RENDER_BACKEND") or "").strip().lower() != "local":
            return False, "MARKETING_RENDER_BACKEND ist nicht 'local'"
        try:
            import torch  # noqa: F401
        except ImportError:
            return False, "torch ist nicht installiert"
        try:
            import diffusers  # noqa: F401
        except ImportError:
            return False, "diffusers ist nicht installiert"
        return True, None

    def erzeuge(self, prompt: str, ziel: Path, *, dauer: float,
                startbild: Path | None, seed: int) -> Path:
        import torch
        from diffusers import StableVideoDiffusionPipeline
        from diffusers.utils import export_to_video, load_image

        if startbild is None:
            raise ProdukttreueVerletzt("lokaler Weg arbeitet nur mit Startbild")

        modell = os.environ.get("LOCAL_VIDEO_MODEL_ID",
                                "stabilityai/stable-video-diffusion-img2vid-xt")
        geraet = "cuda" if torch.cuda.is_available() else "cpu"
        pipe = StableVideoDiffusionPipeline.from_pretrained(
            modell, torch_dtype=torch.float16 if geraet == "cuda" else torch.float32
        ).to(geraet)

        bild = load_image(str(startbild)).resize((576, 1024))
        generator = torch.manual_seed(seed)
        bilder = pipe(bild, decode_chunk_size=8, generator=generator,
                      num_frames=max(14, min(int(dauer * 7), 25))).frames[0]

        roh = ziel.with_name(ziel.stem + "_roh.mp4")
        export_to_video(bilder, str(roh), fps=7)
        common.lauf(["-i", str(roh), "-vf", common.einpassen(), "-r", "30",
                     "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel)])
        roh.unlink(missing_ok=True)
        return ziel


def alle_anbieter() -> list[VideoAnbieter]:
    return [LokalerAnbieter(), RunwayAnbieter()]


def bester_anbieter() -> tuple[VideoAnbieter | None, str]:
    gruende = []
    for anbieter in alle_anbieter():
        ok, grund = anbieter.bereit()
        if ok:
            return anbieter, anbieter.name
        gruende.append(f"{anbieter.name}: {grund}")
    return None, " | ".join(gruende)


def stil_b_moeglich() -> tuple[bool, str]:
    """Kann Stil B ueberhaupt produziert werden?

    Wird vom Briefing-Generator gefragt: Ohne Anbieter werden gar keine
    Stil-B-Briefings mehr erzeugt. Sonst wuerde sich eine Warteschlange
    fuellen, die nie abgearbeitet wird — und niemand merkte es.
    """
    anbieter, info = bester_anbieter()
    return (anbieter is not None), info


# ── Shot-Liste ───────────────────────────────────────────────────────

def plane_einstellungen(brief: dict[str, Any], produkt: Produkt,
                        gesamtdauer: float) -> list[Einstellung]:
    """3-5 Einstellungen a 3-5 Sekunden aus dem Briefing ableiten.

    Die ERSTE Einstellung zeigt immer das Produkt: Der Aufhaenger entscheidet
    in den ersten anderthalb Sekunden, und dort etwas Erfundenes zu zeigen
    waere der schlechteste denkbare Einstieg.
    """
    stil = bildstil()
    kategorie = produkt.kategorie.split("/")[0]
    anzahl = max(3, min(int(gesamtdauer // 4), 5))
    je_dauer = round(min(max(gesamtdauer / anzahl, 3.0), 5.0), 2)

    kamerafahrten = ["langsame Fahrt nach vorn", "sanfter Schwenk nach rechts",
                     "leichte Kranfahrt nach unten", "ruhiger Stand mit Fokuswechsel",
                     "langsame Fahrt zur Seite"]
    stimmungen = ["ruhiger Morgen am Schreibtisch", "warmes Abendlicht im Wohnraum",
                  "aufgeraeumte Arbeitsflaeche", "gemuetliche Leseecke",
                  "heller Raum mit Fensterlicht"]

    einstellungen: list[Einstellung] = []
    for i in range(anzahl):
        # Erste und letzte Einstellung mit Produkt, dazwischen abwechselnd.
        mit_produkt = (i == 0) or (i == anzahl - 1) or (i % 2 == 0)
        if mit_produkt:
            prompt = (
                f"{produkt.name}, {kategorie}, in einer echten Wohnsituation. "
                f"{kamerafahrten[i % len(kamerafahrten)]}. {stil}"
            )
        else:
            prompt = (
                f"{stimmungen[i % len(stimmungen)]}, kein Produkt im Bild. "
                f"{kamerafahrten[i % len(kamerafahrten)]}. {stil}"
            )
        einstellungen.append(Einstellung(
            nummer=i + 1, dauer=je_dauer, prompt=prompt,
            kamera=kamerafahrten[i % len(kamerafahrten)],
            stimmung=stimmungen[i % len(stimmungen)],
            mit_produkt=mit_produkt,
        ))
    return einstellungen


def erzeuge_einstellung(anbieter: VideoAnbieter, einstellung: Einstellung,
                        produktfoto: Path | None, ziel: Path, seed: int) -> Path:
    """Eine Einstellung erzeugen — mit erzwungener Produkttreue.

    HIER steht die Regel im Programm: Eine Einstellung mit Produkt braucht
    ein echtes Produktfoto UND einen Anbieter, der Bild-zu-Video kann. Fehlt
    eines davon, gibt es einen Fehler — keinen Rueckfall auf Text-zu-Video.
    """
    if einstellung.mit_produkt:
        if not anbieter.kann_bild_zu_video:
            raise ProdukttreueVerletzt(
                f"Anbieter '{anbieter.name}' kann kein Bild-zu-Video — eine Einstellung "
                f"mit Produkt darf so nicht entstehen (das Produkt wuerde erfunden)"
            )
        if produktfoto is None or not produktfoto.exists():
            raise ProdukttreueVerletzt(
                "kein echtes Produktfoto vorhanden — Produkt-Einstellung wird nicht erzeugt"
            )
    startbild = produktfoto if einstellung.mit_produkt else None
    return anbieter.erzeuge(
        einstellung.prompt, ziel, dauer=einstellung.dauer, startbild=startbild, seed=seed
    )


# ── Rendern ──────────────────────────────────────────────────────────

def rendere(brief: dict[str, Any], produkt: Produkt, ziel: Path, *,
            brief_id: int = 0, arbeitsordner: Path | None = None) -> tuple[Path, dict[str, Any]]:
    ok, grund = common.verfuegbar()
    if not ok:
        raise RuntimeError(grund)
    anbieter, info = bester_anbieter()
    if anbieter is None:
        raise RuntimeError(f"kein KI-Video-Anbieter verfuegbar — {info}")

    ordner = Path(arbeitsordner or tempfile.mkdtemp(prefix="maios_stil_b_"))
    ordner.mkdir(parents=True, exist_ok=True)
    bericht: dict[str, Any] = {"stil": "B", "anbieter": anbieter.name}

    # 1. Stimme — identisch zu Stil A.
    merkmale = brief.get("merkmale", {})
    stimme, stimm_info = tts.beste_stimme(merkmale.get("stimme"))
    if stimme is None:
        raise RuntimeError(f"keine Stimme verfuegbar — {stimm_info}")
    text = (brief.get("skript") or "").strip()
    if not text:
        raise RuntimeError("Briefing hat kein Skript")
    tonspur = ordner / "stimme.wav"
    sprachausgabe = stimme.sprich(text, tonspur)
    bericht["stimme"] = sprachausgabe.quelle
    bericht["kosten_cent"] = sprachausgabe.kosten_cent

    sprechdauer = sprachausgabe.dauer
    endkarte_dauer = 2.5

    # 2. Echtes Produktfoto — Grundlage jeder Produkt-Einstellung UND der Endkarte.
    material = [a for a in assets.bildquellen_fuer(produkt, mindestens=2)
                if a.typ == "bild" and a.nutzbar and assets.hat_lizenz(a.pfad)]
    produktfoto = material[0].pfad if material else None
    if produktfoto is None:
        raise ProdukttreueVerletzt(f"kein echtes Produktfoto fuer '{produkt.name}'")

    # 3. Einstellungen erzeugen.
    seed = kampagnen_seed(brief_id, produkt.id)
    bericht["seed"] = seed
    einstellungen = plane_einstellungen(brief, produkt, sprechdauer)
    bericht["einstellungen"] = len(einstellungen)
    bericht["mit_produkt"] = sum(1 for e in einstellungen if e.mit_produkt)

    teile: list[Path] = []
    for einstellung in einstellungen:
        teil = erzeuge_einstellung(
            anbieter, einstellung, produktfoto,
            ordner / f"shot_{einstellung.nummer:02d}.mp4", seed,
        )
        vereinheitlicht = ordner / f"norm_{einstellung.nummer:02d}.mp4"
        common.lauf([
            "-i", str(teil), "-t", f"{einstellung.dauer:.2f}",
            "-vf", f"{common.einpassen()},fps=30", "-an",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(vereinheitlicht),
        ])
        teile.append(vereinheitlicht)

    # 4. Endkarte — IMMER aus dem echten Produktfoto, nie KI-generiert.
    teile.append(common.baue_endkarte(
        produktfoto, ordner / "endkarte.mp4",
        name=produkt.name, preis=produkt.preis,
        url=produkt.shop_url.replace("https://", ""), dauer=endkarte_dauer,
    ))

    # 5. Zusammensetzen, Untertitel, Ton — wie Stil A.
    liste = ordner / "teile.txt"
    liste.write_text("\n".join(f"file '{p.resolve().as_posix()}'" for p in teile),
                     encoding="utf-8")
    stumm = ordner / "stumm.mp4"
    common.lauf(["-f", "concat", "-safe", "0", "-i", str(liste),
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", str(stumm)])

    segmente = brief.get("skript_teile") or [{"von": 0.0, "bis": sprechdauer, "text": text}]
    geplant = max((float(s.get("bis", 0)) for s in segmente), default=sprechdauer) or sprechdauer
    faktor = sprechdauer / geplant if geplant > 0 else 1.0
    ass = common.schreibe_untertitel(
        [{"von": float(s.get("von", 0)) * faktor, "bis": float(s.get("bis", 0)) * faktor,
          "text": s.get("text", "")} for s in segmente],
        ordner / "untertitel.ass",
    )

    ziel.parent.mkdir(parents=True, exist_ok=True)
    common.lauf([
        "-i", str(stumm), "-i", str(tonspur),
        "-vf", f"subtitles='{common._ass_pfad(ass)}'",
        # apad + festes "-t": sonst schneidet -shortest die Endkarte ab
        # (derselbe Fehler wie in Stil A, siehe dort).
        "-af", f"{common.loudnorm_filter()},apad",
        "-t", f"{sprechdauer + endkarte_dauer:.2f}",
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
        "-movflags", "+faststart", str(ziel),
    ])
    bericht["dauer_soll"] = round(sprechdauer + endkarte_dauer, 2)
    return ziel, bericht


# ── Job-Einstieg ─────────────────────────────────────────────────────

def job_render_stil_b() -> dict[str, Any]:
    """Freigegebene Stil-B-Briefings rendern."""
    from .style_a_realvoice import offene_briefings

    ok, grund = common.verfuegbar()
    if not ok:
        print(f"[stil_b] uebersprungen — {grund}")
        return {"gerendert": 0, "grund": grund}

    anbieter, info = bester_anbieter()
    if anbieter is None:
        print(f"[stil_b] uebersprungen — kein KI-Anbieter: {info}")
        return {"gerendert": 0, "grund": f"kein KI-Anbieter: {info}"}

    briefings = offene_briefings("B", limit=1)
    if not briefings:
        return {"gerendert": 0, "grund": "keine freigegebenen Stil-B-Briefings"}

    gerendert = verworfen = 0
    for eintrag in briefings:
        produkt = products.nach_id(int(eintrag["produkt_id"]))
        if produkt is None:
            continue
        overlays = eintrag["overlays"] or {}
        brief = {
            "skript": eintrag["skript"],
            "skript_teile": (overlays or {}).get("skript_teile", []),
            "merkmale": eintrag["merkmale"] or {},
        }
        ziel = common.RENDERS / f"brief_{eintrag['id']}_stil_b.mp4"

        video_id = None
        if db.verfuegbar():
            zeile = db.eine_zeile(
                "INSERT INTO mkt_videos (brief_id, stil, pfad) VALUES (%s, 'B', %s) RETURNING id",
                (int(eintrag["id"]), str(ziel)),
            )
            video_id = int(zeile["id"]) if zeile else None

        begonnen = time.monotonic()
        try:
            _, bericht = rendere(brief, produkt, ziel, brief_id=int(eintrag["id"]))
            ergebnis = quality_gate.pruefe(ziel, erwartete_dauer=bericht.get("dauer_soll"))
            if video_id:
                quality_gate.haltefest(video_id, ergebnis)
                db.ausfuehren(
                    "UPDATE mkt_videos SET renderdauer_sek = %s, kosten_cent = %s WHERE id = %s",
                    (round(time.monotonic() - begonnen, 2),
                     int(bericht.get("kosten_cent", 0)), video_id),
                )
            if ergebnis.bestanden:
                gerendert += 1
                print(f"[stil_b] ✅ {produkt.name}: {ergebnis.info.dauer:.1f}s, "
                      f"{bericht['einstellungen']} Einstellungen "
                      f"({bericht['mit_produkt']} mit echtem Produktfoto), "
                      f"Anbieter '{bericht['anbieter']}'")
            else:
                verworfen += 1
                print(f"[stil_b] ⛔ verworfen: {ergebnis.als_text()}")
        except ProdukttreueVerletzt as fehler:
            verworfen += 1
            print(f"[stil_b] ⛔ Produkttreue: {fehler}")
            db.audit("produkttreue_verletzt", job="render_style_b", begruendung=str(fehler)[:400])
            if video_id:
                quality_gate.haltefest(video_id, quality_gate.Pruefergebnis(False, [str(fehler)[:300]]))
        except Exception as fehler:
            verworfen += 1
            print(f"[stil_b] ❌ {produkt.name}: {fehler}")
            if video_id:
                quality_gate.haltefest(video_id, quality_gate.Pruefergebnis(False, [str(fehler)[:300]]))

    return {"gerendert": gerendert, "verworfen": verworfen, "anbieter": anbieter.name}
