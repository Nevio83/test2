"""Echte, vorab aufgenommene Saetze — der beste Weg, wenn er gefuellt ist.

DIE IDEE
Du sprichst einmal eine Handvoll Saetze ein. Danach setzt das System jedes
Skript aus vorhandenen Saetzen zusammen. Kostet nichts je Video, klingt echt,
und niemand muss eine Stimme klonen.

DER HAKEN, EHRLICH BENANNT
Skripte enthalten Produktnamen und Preise — die kann man nicht vorab
aufnehmen. Deshalb funktioniert dieser Weg nur fuer die WIEDERKEHRENDEN
Saetze (Hooks, Ueberleitungen, Handlungsaufforderung). Fehlt ein Satz, wird
er NICHT zusammengestueckelt und auch nicht ersetzt — die Stimme meldet
"kann ich nicht" und der naechste Weg uebernimmt.

DIE AUFNAHMELISTE
Was fehlt, sammelt das System in data/voice/AUFNAHMELISTE.md. Das ist der
eigentliche Nutzen fuer dich: eine konkrete Liste, was du einsprechen
solltest, statt "nimm mal was auf".
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from ...env_loader import MARKETING_DIR
from .base import Sprachausgabe, Stimme

TAKES = MARKETING_DIR / "data" / "voice" / "takes"
VERZEICHNIS = MARKETING_DIR / "data" / "voice" / "takes.json"
AUFNAHMELISTE = MARKETING_DIR / "data" / "voice" / "AUFNAHMELISTE.md"


def _schluessel(text: str) -> str:
    """Text auf eine vergleichbare Form bringen (Satzzeichen/Grossschreibung egal)."""
    return re.sub(r"[^\wäöüß ]", "", (text or "").lower()).strip()


def lade_verzeichnis() -> dict[str, str]:
    """Zuordnung Satz -> Datei.

    Zwei Wege, es zu fuellen:
      * von Hand: data/voice/takes.json mit {"satz": "datei.wav"}
      * automatisch: faster-whisper transkribiert die Aufnahmen (optional)
    """
    if VERZEICHNIS.exists():
        try:
            roh = json.loads(VERZEICHNIS.read_text(encoding="utf-8"))
            return {_schluessel(k): v for k, v in roh.items()}
        except json.JSONDecodeError as fehler:
            print(f"[takes] takes.json unlesbar: {fehler}")
            return {}
    return _verzeichnis_aus_whisper()


def _verzeichnis_aus_whisper() -> dict[str, str]:
    """Aufnahmen einmalig transkribieren, falls faster-whisper da ist."""
    if not TAKES.exists():
        return {}
    dateien = [p for p in TAKES.iterdir() if p.suffix.lower() in (".wav", ".mp3", ".m4a")]
    if not dateien:
        return {}
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("[takes] Aufnahmen vorhanden, aber faster-whisper fehlt und takes.json auch — "
              "Zuordnung nicht moeglich.")
        return {}

    modell = WhisperModel("small", device="cpu", compute_type="int8")
    verzeichnis: dict[str, str] = {}
    for datei in dateien:
        segmente, _ = modell.transcribe(str(datei), language="de", word_timestamps=True)
        text = " ".join(s.text.strip() for s in segmente).strip()
        if text:
            verzeichnis[_schluessel(text)] = datei.name
    try:
        VERZEICHNIS.write_text(
            json.dumps({k: v for k, v in verzeichnis.items()}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError:
        pass
    return verzeichnis


def notiere_fehlende(saetze: list[str]) -> None:
    """Aufnahmeliste fortschreiben — das Ergebnis fuer den Menschen."""
    if not saetze:
        return
    vorhandene: set[str] = set()
    if AUFNAHMELISTE.exists():
        vorhandene = {
            z.strip().lstrip("- [ ]").strip()
            for z in AUFNAHMELISTE.read_text(encoding="utf-8").splitlines()
            if z.strip().startswith("- [")
        }
    neu = [s for s in saetze if s.strip() and s.strip() not in vorhandene]
    if not neu:
        return

    kopf = (
        "# Aufnahmeliste\n\n"
        "Saetze, die das System gebraucht haette, aber nicht als Aufnahme findet.\n"
        "Sprich sie einmal ein (ruhig, normales Tempo) und lege die Dateien unter\n"
        "`data/voice/takes/` ab. Danach `data/voice/takes.json` ergaenzen:\n"
        "`{\"der gesprochene satz\": \"dateiname.wav\"}`\n\n"
        "Wiederkehrende Saetze lohnen sich am meisten — Produktnamen und Preise\n"
        "wechseln ohnehin und werden nie aus Aufnahmen gebaut.\n\n"
    )
    try:
        AUFNAHMELISTE.parent.mkdir(parents=True, exist_ok=True)
        bestand = AUFNAHMELISTE.read_text(encoding="utf-8") if AUFNAHMELISTE.exists() else kopf
        AUFNAHMELISTE.write_text(
            bestand + "\n".join(f"- [ ] {s.strip()}" for s in neu) + "\n", encoding="utf-8"
        )
        print(f"[takes] {len(neu)} Satz/Saetze in die Aufnahmeliste geschrieben")
    except OSError as fehler:
        print(f"[takes] Aufnahmeliste nicht schreibbar: {fehler}")


class EigeneAufnahmen(Stimme):
    name = "eigene_aufnahmen"

    def bereit(self) -> tuple[bool, str | None]:
        if not TAKES.exists() or not any(TAKES.iterdir()):
            return False, f"keine Aufnahmen in {TAKES}"
        if not lade_verzeichnis():
            return False, "Aufnahmen vorhanden, aber keine Zuordnung (takes.json oder faster-whisper)"
        return True, None

    def sprich(self, text: str, ziel: Path) -> Sprachausgabe:
        """Nur exakte Treffer. Kein Zusammenstueckeln, kein Ersetzen.

        Ein halb passender Satz waere schlimmer als gar keiner: Er klingt
        richtig und sagt etwas anderes.
        """
        from .. import common

        verzeichnis = lade_verzeichnis()
        quelle = verzeichnis.get(_schluessel(text))
        if not quelle:
            notiere_fehlende([text])
            raise RuntimeError(f"kein Take fuer: {text[:60]}")

        datei = TAKES / quelle
        if not datei.exists():
            raise RuntimeError(f"Take-Datei fehlt: {datei}")

        ziel.parent.mkdir(parents=True, exist_ok=True)
        common.lauf(["-i", str(datei), "-ar", "48000", "-ac", "1", str(ziel)])
        return Sprachausgabe(ziel, common.tondauer(ziel), self.name, 0)
