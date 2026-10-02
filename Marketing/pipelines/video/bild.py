"""Ins Bild schauen (Punkte 19, 23, 30, 35).

WARUM
Der Filter des Bots hat noch nie ein Bild gesehen. Ob das beworbene Geraet im
Clip ueberhaupt vorkommt, ob ein Gesicht zu erkennen ist, ob fremder Text im
Bild steht — alles unbekannt, bis jemand von Hand hinsieht.

OHNE NEUES PAKET
onnxruntime kommt mit faster-whisper, numpy ebenso, die Standbilder liefert
ffmpeg. Dazu drei Modelldateien, zusammen rund 92 MB, einmal geladen (wie das
Whisper-Modell) und danach offline:

  CLIP ViT-B/32, Bildteil, int8      89 MB   Aehnlichkeit zu den Produktfotos
      Xenova/clip-vit-base-patch32 — eine Formatumwandlung von
      openai/clip-vit-base-patch32. Die Karte der Umwandlung nennt keine
      Lizenz; das Original hat OpenAI unter MIT veroeffentlicht.
  YuNet                              0,2 MB  Gesichter erkennen (MIT)
  PP-OCRv3, nur Textsuche            2,4 MB  wo Text im Bild steht (Apache-2.0)

WAS DIE AEHNLICHKEIT KANN — UND WAS NICHT (gemessen am 02.10. an 34 Clips)
Die naheliegende Frage "zu welchem der 40 Produkte passt der Clip am besten?"
beantwortet sie NICHT: Das eigene Produkt lag nur bei 7 von 34 Clips vorn,
weil alle Produktfotos einander als "Studiofoto eines Geraets" aehneln.
Der ABSOLUTE Wert gegen die eigenen Fotos traegt dagegen: Die fuenf Clips mit
einem Mittel unter 0,63 zeigten ein fremdes Modell (Ninja-Mixer statt des
eigenen, Gymtastic-Massagepistole, eine Handpumpe), gar kein Geraet (eine
Frau, die in die Kamera spricht) oder das eigene Geraet in einer Farbe, die
der Shop nicht fuehrt (schwarzer Mixer mit fremdem Aufdruck). Darauf steht
die Schwelle fuer den GANZEN Clip. Der Abstand ist duenn: der hoechste
falsche Clip 0,622, der niedrigste richtige 0,636.

DER WERT TRENNT ECHTE AUFNAHMEN, KEINE GRAFIKEN. Eine leere blaue Flaeche
bekommt gegen die Wasserspender-Fotos 0,67, eine weisse 0,72, Rauschen 0,70 —
alles UEBER der Schwelle. Zwei beliebige Bilder liegen bei diesem Modell nie
weit auseinander; ein Schwarzbild mit Schrift oder eine Texttafel faellt
deshalb nicht auf. Probiert und verworfen: den gemeinsamen Anteil aller 40
Produktfotos vorher abzuziehen. Danach rutschte ein Clip mit gut sichtbarem
Wasserspender ans untere Ende, und die Werte waren zwischen den Produkten
nicht mehr vergleichbar (Mixer 0,16-0,39, Wasserspender -0,08-0,19).

AM EINZELNEN BILD TRENNT DER WERT SCHLECHT (Punkt 35, nachgesehen an 15 Clips)
Fuer "ist das Produkt in den ersten drei Sekunden zu sehen?" gibt es nur
sechs Standbilder statt acht ueber den ganzen Clip, und kein Mitteln gleicht
Ausreisser aus. Ein Weidenkorb bekam 0,68, ein Schreibtisch 0,70, eine
Verpackung mit Produktfoto 0,73 — der gut sichtbare Wasserspender im selben
Material nur 0,59 bis 0,67. Mit der Grenze 0,655 auf den BESTEN Wert fallen
vier von acht Clips ohne fruehes Produkt auf und keiner der sieben mit; der
Abstand ist duenn (0,648 gegen 0,664). Die Pruefung findet also die klaren
Faelle und uebersieht die Haelfte — sie ist ein Hinweis, nie eine Sperre.

WAS BEWUSST NICHT PASSIERT
  * Gesichter werden ERKANNT, nie identifiziert. Kein Modell hier kann sagen,
    WER zu sehen ist — nur ob ein Gesicht da ist und wie gross.
  * Text wird GEFUNDEN, nicht gelesen. Fuer die Entscheidung reicht, wo er
    steht und ob er an derselben Stelle bleibt.
  * Nichts hier sortiert von selbst aus. Die Werte sind Hinweise fuer den
    Menschen am Kontaktbogen: Die Schwelle ist an 34 Clips von drei Produkten
    gemessen, ein schwarzes Bild mit Schrift bekam einmal 0,68.

Aufruf (aus Marketing/ heraus, der Bot tut das selbst):
    py -m pipelines.video.bild <video> [--produkt 10]
Ausgabe: eine Zeile JSON.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from .. import products
from ..env_loader import REPO_ROOT
from . import common

MODELLE = {
    "clip": ("Xenova/clip-vit-base-patch32", "onnx/vision_model_quantized.onnx"),
    "gesicht": ("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx"),
    "text": ("SWHL/RapidOCR", "PP-OCRv3/ch_PP-OCRv3_det_infer.onnx"),
}
PRODUKTBILDER = REPO_ROOT / "produkt bilder"
BILD_ENDUNGEN = (".jpg", ".jpeg", ".png", ".webp")
KURZE_SEITE = 540

_sitzungen: dict[str, Any] = {}
_fotos: dict[int, Any] = {}


def _sitzung(name: str):
    """Das Modell laden — beim ersten Mal von Hugging Face, danach aus dem Zwischenspeicher."""
    if name not in _sitzungen:
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download

        repo, datei = MODELLE[name]
        optionen = ort.SessionOptions()
        optionen.log_severity_level = 3
        _sitzungen[name] = ort.InferenceSession(
            hf_hub_download(repo, datei), optionen, providers=["CPUExecutionProvider"])
    return _sitzungen[name]


def verfuegbar(modelle: tuple[str, ...] = ("clip",)) -> tuple[bool, str]:
    """Kann die Bilderkennung laufen, OHNE etwas aus dem Netz zu holen?

    Fuer Stellen, die nebenbei ins Bild schauen (Punkt 35 beim Rendern): Dort
    darf nie stillschweigend ein 89-MB-Modell geladen werden. Geladen wird nur
    auf ausdruecklichen Wunsch — `npm run tiktok:bild`.

    MARKETING_BILD=aus schaltet ab. Die Pruefungen der Marketing-Kette setzen
    das: Sonst liefe das Modell auf diesem Rechner in jedem Rendertest mit, im
    Prueflauf (ohne Modell) aber nie — derselbe Test, zwei Ergebnisse.
    """
    if os.environ.get("MARKETING_BILD", "").strip().lower() in ("aus", "0", "false", "nein"):
        return False, "abgeschaltet (MARKETING_BILD)"
    try:
        import numpy  # noqa: F401
        import onnxruntime  # noqa: F401
        from huggingface_hub import try_to_load_from_cache
    except ImportError as fehler:
        return False, f"{fehler.name} fehlt"
    for name in modelle:
        repo, datei = MODELLE[name]
        if not isinstance(try_to_load_from_cache(repo, datei), str):
            return False, f"Bildmodell \"{name}\" nicht geladen — einmal `npm run tiktok:bild`"
    ok, grund = common.verfuegbar()
    return (True, "") if ok else (False, grund)


# ── Standbilder ──────────────────────────────────────────────────────

def _roh(argumente: list[str], breite: int, hoehe: int):
    """ffmpeg -> EIN Bild als Zahlenfeld (hoehe, breite, 3). None, wenn keins kam."""
    import numpy as np

    pfad = common.ffmpeg_pfad()
    if pfad is None:
        raise common.KeinFfmpeg(common.verfuegbar()[1])
    ergebnis = subprocess.run([pfad, "-hide_banner", "-nostdin", "-v", "error", *argumente,
                               "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
                              capture_output=True, timeout=120)
    if len(ergebnis.stdout) < breite * hoehe * 3:
        return None
    return np.frombuffer(ergebnis.stdout[: breite * hoehe * 3], dtype=np.uint8).reshape(hoehe, breite, 3)


def zeitpunkte(dauer: float, anzahl: int, *, von: float | None = None, bis: float | None = None) -> list[float]:
    """Gleichmaessig verteilte Zeitpunkte — das erste Zehntel bleibt aus.

    Am Anfang steht fast immer ein Titeleinblender; ein Standbild bei 0 %
    zeigt dann Schrift statt Produkt (derselbe Grund wie beim Kontaktbogen).
    Mit von/bis gilt genau dieser Abschnitt, ohne Abzug.
    """
    start = dauer * 0.1 if von is None else max(von, 0.0)
    ende = dauer * 0.95 if bis is None else min(bis, dauer)
    spanne = max(ende - start, 0.0)
    return [round(start + spanne * (i + 0.5) / anzahl, 3) for i in range(anzahl)]


def standbilder(video: Path, *, anzahl: int = 8, von: float | None = None, bis: float | None = None):
    """Standbilder als (n, hoehe, breite, 3), kurze Seite 540.

    JEDES BILD EINZELN PER SPRUNG. Die erste Fassung liess ffmpeg das ganze
    Video mit einem fps-Filter durchlaufen — bei einem 107-Sekunden-Clip waren
    das 36 Sekunden, und es kamen drei statt sechs Bilder heraus.
    """
    import numpy as np

    info = common.medien_info(video)
    if info is None or info.dauer <= 0:
        raise RuntimeError(f"nicht lesbar: {Path(video).name}")
    if not info.breite or not info.hoehe:
        raise RuntimeError(f"keine Bildspur: {Path(video).name}")
    if info.hoehe >= info.breite:
        breite = KURZE_SEITE
        hoehe = min(1200, int(round(KURZE_SEITE * info.hoehe / info.breite / 2)) * 2)
    else:
        hoehe = KURZE_SEITE
        breite = min(1200, int(round(KURZE_SEITE * info.breite / info.hoehe / 2)) * 2)
    bilder = []
    for t in zeitpunkte(info.dauer, anzahl, von=von, bis=bis):
        bild = _roh(["-ss", f"{t:.3f}", "-i", str(video), "-vf", f"scale={breite}:{hoehe}"], breite, hoehe)
        if bild is not None:
            bilder.append(bild)
    if not bilder:
        raise RuntimeError(f"keine Standbilder: {Path(video).name}")
    return np.stack(bilder)


def skaliere(bild, breite: int, hoehe: int):
    """Bild auf eine neue Groesse bringen (bilinear, vorher grob gemittelt). Gibt float32 zurueck."""
    import numpy as np

    b = bild.astype(np.float32)
    # Bei starkem Verkleinern erst ganzzahlig mitteln — sonst faellt jeder
    # zweite Bildpunkt einfach weg, und feine Schrift wird zu Rauschen.
    faktor = min(b.shape[0] // hoehe, b.shape[1] // breite)
    if faktor >= 2:
        h, w = (b.shape[0] // faktor) * faktor, (b.shape[1] // faktor) * faktor
        b = b[:h, :w].reshape(h // faktor, faktor, w // faktor, faktor, 3).mean(axis=(1, 3))
    h, w = b.shape[:2]
    ys = np.clip((np.arange(hoehe) + 0.5) * h / hoehe - 0.5, 0, h - 1)
    xs = np.clip((np.arange(breite) + 0.5) * w / breite - 0.5, 0, w - 1)
    y0, x0 = np.floor(ys).astype(int), np.floor(xs).astype(int)
    y1, x1 = np.minimum(y0 + 1, h - 1), np.minimum(x0 + 1, w - 1)
    # Die Gewichte ausdruecklich als float32: Mit float64-Gewichten kam still
    # ein float64-Bild heraus — doppelter Speicher bei jedem Standbild.
    wy = (ys - y0).astype(np.float32)[:, None, None]
    wx = (xs - x0).astype(np.float32)[None, :, None]
    oben = b[y0][:, x0] * (1 - wx) + b[y0][:, x1] * wx
    unten = b[y1][:, x0] * (1 - wx) + b[y1][:, x1] * wx
    return oben * (1 - wy) + unten * wy


# ── Aehnlichkeit zum Produkt (Punkte 19 und 35) ──────────────────────

_CLIP_MITTEL = (0.48145466, 0.4578275, 0.40821073)
_CLIP_STREUUNG = (0.26862954, 0.26130258, 0.27577711)


def einbetten(bilder):
    """Bilder (n, 224, 224, 3) -> Richtungen der Laenge 1 (n, 512)."""
    import numpy as np

    x = np.asarray(bilder, dtype=np.float32) / 255.0
    x = (x - np.array(_CLIP_MITTEL, dtype=np.float32)) / np.array(_CLIP_STREUUNG, dtype=np.float32)
    x = np.ascontiguousarray(np.transpose(x, (0, 3, 1, 2)))
    aus = np.concatenate([
        _sitzung("clip").run(["image_embeds"], {"pixel_values": x[i:i + 8]})[0]
        for i in range(0, len(x), 8)
    ])
    return aus / np.linalg.norm(aus, axis=1, keepdims=True)


def _ausschnitte(bild):
    """Drei Quadrate entlang der langen Seite, je 224x224 — das Produkt sitzt selten genau mittig."""
    hoehe, breite = bild.shape[:2]
    kante = min(hoehe, breite)
    if hoehe >= breite:
        teile = [bild[o:o + kante, :kante] for o in (0, (hoehe - kante) // 2, hoehe - kante)]
    else:
        teile = [bild[:kante, o:o + kante] for o in (0, (breite - kante) // 2, breite - kante)]
    return [skaliere(t, 224, 224) for t in teile]


def produktfotos(produkt_id: int) -> list[Path]:
    """Die eigenen Fotos eines Produkts — der Ordner heisst wie das Produkt."""
    produkt = products.nach_id(int(produkt_id))
    if produkt is None or not PRODUKTBILDER.exists():
        return []
    gesucht = produkt.name.strip().lower()
    fotos: list[Path] = []
    for ordner in PRODUKTBILDER.iterdir():
        if ordner.is_dir() and ordner.name.lower().removesuffix(" bilder").strip() == gesucht:
            fotos = sorted(p for p in ordner.iterdir() if p.suffix.lower() in BILD_ENDUNGEN
                           and not p.stem.endswith(("-160", "-320", "-480", "-640")))
    if not fotos and produkt.bild:
        einzeln = REPO_ROOT / produkt.bild.lstrip("/")
        if einzeln.exists():
            fotos = [einzeln]
    return fotos


def foto_richtungen(produkt_id: int):
    """Die eingebetteten Fotos eines Produkts (einmal je Lauf gerechnet). None, wenn es keine gibt."""
    import numpy as np

    if produkt_id not in _fotos:
        form = "scale=224:224:force_original_aspect_ratio=decrease,pad=224:224:(ow-iw)/2:(oh-ih)/2:white"
        bilder = [b for b in (_roh(["-i", str(p), "-vf", form], 224, 224) for p in produktfotos(produkt_id)[:12])
                  if b is not None]
        _fotos[produkt_id] = einbetten(np.stack(bilder)) if bilder else None
    return _fotos[produkt_id]


def aehnlichkeit_je_bild(bilder, richtungen) -> list[float]:
    """Je Standbild der beste Wert ueber drei Ausschnitte und alle Produktfotos."""
    import numpy as np

    werte = []
    for bild in bilder:
        teile = einbetten(np.stack(_ausschnitte(bild)))
        werte.append(round(float((teile @ richtungen.T).max()), 3))
    return werte


def produkt_aehnlichkeit(video: Path, produkt_id: int, *, anzahl: int = 8, bilder=None,
                         von: float | None = None, bis: float | None = None) -> dict[str, Any]:
    """Wie aehnlich sehen die Standbilder den eigenen Produktfotos?"""
    import numpy as np

    richtungen = foto_richtungen(int(produkt_id))
    if richtungen is None:
        return {"ok": False, "grund": f"keine Produktfotos zu Produkt {produkt_id}"}
    if bilder is None:
        bilder = standbilder(video, anzahl=anzahl, von=von, bis=bis)
    je_bild = aehnlichkeit_je_bild(bilder, richtungen)
    return {"ok": True, "max": max(je_bild), "mittel": round(float(np.mean(je_bild)), 3),
            "je_bild": je_bild, "fotos": int(len(richtungen))}


# Grenze fuer das EINZELNE Bild (Punkt 35). Nicht dieselbe wie fuer den ganzen
# Clip — siehe Kopf der Datei, dort steht auch, wie wenig sie trennt.
SICHTBAR_AB = 0.655


def fruehe_sichtbarkeit(teile: list[Path], produkt_id: int, *, sekunden: float = 3.0,
                        schwelle: float = SICHTBAR_AB, je_sekunde: int = 2) -> dict[str, Any]:
    """Ist das Produkt in den ersten Sekunden des GESCHNITTENEN Clips zu sehen?

    `teile` sind die fertig zugeschnittenen Segmentdateien in Reihenfolge.
    Gemessen wird also, was der Zuschauer sieht — nach dem Zuschnitt auf 9:16,
    der ein Produkt am Bildrand wegschneiden kann — und nicht der Rohclip.
    """
    import numpy as np

    richtungen = foto_richtungen(int(produkt_id))
    if richtungen is None:
        return {"ok": False, "grund": f"keine Produktfotos zu Produkt {produkt_id}"}
    je_bild: list[float] = []
    rest = float(sekunden)
    for teil in teile:
        if rest <= 0.05:
            break
        info = common.medien_info(teil)
        if info is None or info.dauer <= 0:
            continue
        stueck = min(info.dauer, rest)
        bilder = standbilder(teil, anzahl=max(1, int(round(stueck * je_sekunde))), von=0.0, bis=stueck)
        je_bild.extend(aehnlichkeit_je_bild(bilder, richtungen))
        rest -= stueck
    if not je_bild:
        return {"ok": False, "grund": "keine Standbilder aus den ersten Sekunden"}
    bester = max(je_bild)
    return {"ok": True, "sekunden": round(float(sekunden) - max(rest, 0.0), 2), "bilder": len(je_bild),
            "max": bester, "mittel": round(float(np.mean(je_bild)), 3), "je_bild": je_bild,
            "schwelle": float(schwelle), "sichtbar": bool(bester >= float(schwelle))}


# ── Gesichter (Punkt 23) ─────────────────────────────────────────────
#
# ZWEI STUFEN, gemessen am 02.10.: Klare Gesichter kamen mit 0,78-0,94. Der
# runde Aufsatz einer Massagepistole mit rotem Punkt bekam 0,66 — und
# unscharfe, aber echte Gesichter 0,52-0,65. Eine einzige Grenze muesste
# entweder den Fehlalarm melden oder echte Gesichter uebersehen. Ein
# uebersehenes Gesicht wiegt schwerer (Recht am eigenen Bild) — deshalb gibt
# es "sicher" und darunter "moeglich, bitte ansehen".
GESICHT_SICHER = 0.7
GESICHT_MOEGLICH = 0.5

def gesichter_im_bild(bild_bgr, *, schwelle: float = 0.6) -> list[dict[str, float]]:
    """YuNet auf einem 640x640-Bild (BGR, 0..255). Rueckgabe: Kaesten mit Wert, groesste zuerst."""
    import numpy as np

    x = np.ascontiguousarray(np.transpose(np.asarray(bild_bgr, dtype=np.float32), (2, 0, 1))[None])
    sitzung = _sitzung("gesicht")
    aus = dict(zip([a.name for a in sitzung.get_outputs()], sitzung.run(None, {"input": x})))
    funde = []
    for schritt in (8, 16, 32):
        spalten = 640 // schritt
        wert = np.sqrt(np.clip(aus[f"cls_{schritt}"][0, :, 0], 0, 1) * np.clip(aus[f"obj_{schritt}"][0, :, 0], 0, 1))
        for i in np.nonzero(wert >= schwelle)[0]:
            kasten = aus[f"bbox_{schritt}"][0, i]
            zeile, spalte = divmod(int(i), spalten)
            mx, my = (spalte + kasten[0]) * schritt, (zeile + kasten[1]) * schritt
            w, h = float(np.exp(kasten[2]) * schritt), float(np.exp(kasten[3]) * schritt)
            funde.append({"x": float(mx - w / 2), "y": float(my - h / 2), "w": w, "h": h, "wert": float(wert[i])})
    # Ueberlappende Funde desselben Gesichts zusammenfassen: der staerkste bleibt.
    funde.sort(key=lambda f: -f["wert"])
    behalten: list[dict[str, float]] = []
    for f in funde:
        if all(_ueberlappung(f, b) < 0.3 for b in behalten):
            behalten.append(f)
    return sorted(behalten, key=lambda f: -(f["w"] * f["h"]))


def _ueberlappung(a: dict[str, float], b: dict[str, float]) -> float:
    x1, y1 = max(a["x"], b["x"]), max(a["y"], b["y"])
    x2, y2 = min(a["x"] + a["w"], b["x"] + b["w"]), min(a["y"] + a["h"], b["y"] + b["h"])
    schnitt = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    gesamt = a["w"] * a["h"] + b["w"] * b["h"] - schnitt
    return schnitt / gesamt if gesamt > 0 else 0.0


def _ins_quadrat(bild, kante: int = 640):
    """Bild mit schwarzem Rand ins Quadrat setzen. Rueckgabe: (Quadrat als BGR, sichtbare Hoehe)."""
    import numpy as np

    hoehe, breite = bild.shape[:2]
    faktor = kante / max(hoehe, breite)
    h, w = max(2, int(round(hoehe * faktor))), max(2, int(round(breite * faktor)))
    klein = skaliere(bild, w, h)
    feld = np.zeros((kante, kante, 3), dtype=np.float32)
    oben, links = (kante - h) // 2, (kante - w) // 2
    feld[oben:oben + h, links:links + w] = klein[:, :, ::-1]          # RGB -> BGR
    return feld, float(h)


def gesichter(video: Path, *, anzahl: int = 8, bilder=None) -> dict[str, Any]:
    """In wie vielen Standbildern ist ein Gesicht — und wie gross ist das groesste?

    Hoehe des Gesichts als Anteil der Bildhoehe: Ein Gesicht mit 3 % ist ein
    Passant im Hintergrund, eines mit 20 % ist die Person, um die es geht.
    """
    if bilder is None:
        bilder = standbilder(video, anzahl=anzahl)
    je_bild, groesstes, unsicher = [], 0.0, 0
    for bild in bilder:
        feld, sichtbar = _ins_quadrat(bild)
        funde = gesichter_im_bild(feld, schwelle=GESICHT_MOEGLICH)
        sicher = [f for f in funde if f["wert"] >= GESICHT_SICHER]
        je_bild.append(len(sicher))
        if sicher:
            groesstes = max(groesstes, max(f["h"] for f in sicher) / sichtbar)
        elif funde:
            unsicher += 1
    mit = sum(1 for n in je_bild if n)
    return {"ok": True, "bilder": len(bilder), "mit_gesicht": mit, "unsicher": unsicher,
            "je_bild": je_bild, "groesstes_anteil": round(groesstes, 3),
            "personen_im_bild": mit > 0, "personen_moeglich": mit > 0 or unsicher > 0}


# ── Fremder Text (Punkt 30) ──────────────────────────────────────────

_TEXT_MITTEL = (0.485, 0.456, 0.406)
_TEXT_STREUUNG = (0.229, 0.224, 0.225)
RAND_ANTEIL = 0.18          # oberes/unteres/seitliches Band, das noch als "Rand" gilt
TEXT_SCHWELLE = 0.3


def textkarte(bilder_rgb):
    """Je Bild eine Karte 0..1: Wie sicher steht an dieser Stelle Text?"""
    import numpy as np

    x = np.asarray(bilder_rgb, dtype=np.float32) / 255.0
    x = (x - np.array(_TEXT_MITTEL, dtype=np.float32)) / np.array(_TEXT_STREUUNG, dtype=np.float32)
    x = np.ascontiguousarray(np.transpose(x, (0, 3, 1, 2)))
    return np.concatenate([_sitzung("text").run(None, {"x": x[i:i + 1]})[0][:, 0] for i in range(len(x))])


def textbereiche(maske, *, min_zellen: int = 4) -> list[dict[str, float]]:
    """Zusammenhaengende Flecken einer Ja/Nein-Karte als Kaesten in Anteilen des Bildes (0..1).

    Ohne OpenCV: per Flutfuellung abgelaufen. Fuer acht kleine Karten ist das
    schnell genug, und es spart ein Paket fuer eine Aufgabe von zwanzig Zeilen.
    """
    import numpy as np

    hoehe, breite = maske.shape
    gesehen = np.zeros_like(maske, dtype=bool)
    bereiche = []
    for start_y, start_x in zip(*np.nonzero(maske)):
        if gesehen[start_y, start_x]:
            continue
        stapel = [(int(start_y), int(start_x))]
        gesehen[start_y, start_x] = True
        ys, xs = [], []
        while stapel:
            y, x = stapel.pop()
            ys.append(y)
            xs.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < hoehe and 0 <= nx < breite and maske[ny, nx] and not gesehen[ny, nx]:
                    gesehen[ny, nx] = True
                    stapel.append((ny, nx))
        if len(ys) < min_zellen:
            continue
        bereiche.append({
            "x": min(xs) / breite, "y": min(ys) / hoehe,
            "w": (max(xs) - min(xs) + 1) / breite, "h": (max(ys) - min(ys) + 1) / hoehe,
        })
    return bereiche


def _am_rand(b: dict[str, float]) -> bool:
    """Liegt der Kasten ganz in einem Randband? Dann laesst er sich wegschneiden."""
    return (b["y"] + b["h"] <= RAND_ANTEIL or b["y"] >= 1 - RAND_ANTEIL
            or b["x"] + b["w"] <= RAND_ANTEIL or b["x"] >= 1 - RAND_ANTEIL)


def fremdtext(video: Path, *, anzahl: int = 8, bilder=None) -> dict[str, Any]:
    """Steht eine Einblendung im Bild — und laesst sie sich wegschneiden?

    ORTSFEST IST DAS MERKMAL. Text gibt es auch auf dem Geraet selbst
    ("100 ML" am Wasserspender): Der wandert mit dem Geraet durchs Bild. Eine
    Einblendung — Untertitel, Titel, der Name eines anderen Shops — steht ueber
    mehrere Standbilder an DERSELBEN Stelle. Gezaehlt wird deshalb die Flaeche,
    auf der in mindestens der Haelfte der Bilder Text steht. Die erste Fassung
    zaehlte jeden Text und meldete einen Clip ohne jede Einblendung als
    "dauerhaft, Mitte".
    """
    import numpy as np

    if bilder is None:
        bilder = standbilder(video, anzahl=anzahl)
    hoch = bilder.shape[1] >= bilder.shape[2]
    breite, hoehe = (480, 864) if hoch else (864, 480)
    karten = textkarte(np.stack([skaliere(b, breite, hoehe) for b in bilder]))
    masken = karten[:, ::4, ::4] >= TEXT_SCHWELLE
    je_bild = [len(textbereiche(m)) for m in masken]
    mit = sum(1 for n in je_bild if n)

    fest = masken.mean(axis=0) >= 0.5 if len(masken) >= 3 else np.zeros_like(masken[0])
    feste_bereiche = textbereiche(fest)
    flaeche = round(float(fest.mean()), 4)
    lage = None
    if feste_bereiche:
        lage = "rand" if all(_am_rand(b) for b in feste_bereiche) else "mitte"
    # Zweites Merkmal: Untertitel, die mit jedem Satz die Stelle wechseln, sind
    # nicht ortsfest — stehen aber in fast jedem Bild. Der Aufdruck am Geraet
    # kam im selben Material auf 5 von 8 Bildern, wechselnde Untertitel auf 7.
    haeufig = len(bilder) >= 4 and mit >= 0.75 * len(bilder)
    return {"ok": True, "bilder": len(bilder), "mit_text": mit, "je_bild": je_bild,
            "ortsfest": bool(feste_bereiche), "ortsfest_flaeche": flaeche, "lage": lage,
            "haeufig": haeufig, "einblendung": bool(feste_bereiche) or haeufig,
            "bereiche": [{k: round(v, 3) for k, v in b.items()} for b in feste_bereiche[:6]]}


# ── Alles zusammen ───────────────────────────────────────────────────

def pruefe(video: Path, produkt_id: int | None = None, *, anzahl: int = 8) -> dict[str, Any]:
    """Alle drei Blicke auf einen Clip — auf DENSELBEN Standbildern.

    Ein Teil, der scheitert, nimmt die anderen nicht mit. Hat die Datei gar
    keine Bildspur, steht das als eigener Befund da: Im Vorrat lagen zwei
    "Videos", die nur den Ton eines TikTok-Fotobeitrags enthielten.
    """
    ergebnis: dict[str, Any] = {"ok": True, "datei": Path(video).name}
    info = common.medien_info(video)
    if info is None:
        return {"ok": False, "datei": Path(video).name, "grund": "nicht lesbar"}
    if not info.breite or not info.hoehe:
        return {"ok": False, "datei": Path(video).name, "keine_bildspur": True,
                "grund": "keine Bildspur — die Datei enthaelt nur Ton"}
    try:
        bilder = standbilder(video, anzahl=anzahl)
    except Exception as fehler:  # noqa: BLE001
        return {"ok": False, "datei": Path(video).name, "grund": f"{type(fehler).__name__}: {str(fehler)[:160]}"}
    teile = {"gesichter": lambda: gesichter(video, bilder=bilder),
             "text": lambda: fremdtext(video, bilder=bilder)}
    if produkt_id is not None:
        teile["produkt"] = lambda: produkt_aehnlichkeit(video, int(produkt_id), bilder=bilder)
    for name, aufruf in teile.items():
        try:
            ergebnis[name] = aufruf()
        except Exception as fehler:  # noqa: BLE001 — der Aufrufer soll den Grund sehen
            ergebnis[name] = {"ok": False, "grund": f"{type(fehler).__name__}: {str(fehler)[:160]}"}
    return ergebnis


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Einen Clip ansehen: Produkt, Gesichter, fremder Text.")
    parser.add_argument("video", nargs="?")
    parser.add_argument("--produkt", type=int)
    parser.add_argument("--liste", help="JSON-Datei mit [{datei, produkt_id}] — je Clip eine Zeile JSON")
    args = parser.parse_args(argv)

    # Stapelmodus fuer den Bot: Die Modelle laden EINMAL, nicht je Clip — bei
    # 36 Clips der Unterschied zwischen zwei und zehn Minuten.
    if args.liste:
        eintraege = json.loads(Path(args.liste).read_text(encoding="utf-8-sig"))
        for eintrag in eintraege:
            try:
                ergebnis = pruefe(Path(eintrag["datei"]), eintrag.get("produkt_id"))
            except Exception as fehler:  # noqa: BLE001
                ergebnis = {"ok": False, "datei": Path(str(eintrag.get("datei"))).name,
                            "grund": f"{type(fehler).__name__}: {fehler}"}
            ergebnis["pfad"] = str(eintrag.get("datei"))
            print(json.dumps(ergebnis, ensure_ascii=False), flush=True)
        return 0
    if not args.video:
        parser.error("video oder --liste angeben")
    try:
        ergebnis = pruefe(Path(args.video), args.produkt)
    except Exception as fehler:  # noqa: BLE001
        ergebnis = {"ok": False, "grund": f"{type(fehler).__name__}: {fehler}"}
    print(json.dumps(ergebnis, ensure_ascii=False))
    return 0 if ergebnis.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
