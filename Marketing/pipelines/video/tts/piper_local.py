"""Kostenloser lokaler Rueckfall — damit die Kette nie stehen bleibt.

ZWEI WEGE, KEINE INSTALLATION ZWINGEND

  1. piper — freie, ordentlich klingende Sprachsynthese. Braucht das Programm
     plus ein Stimmmodell (.onnx). Wird bevorzugt, wenn vorhanden.
  2. Windows-Sprachausgabe (SAPI) — ist in Windows eingebaut. Klingt
     deutlich blechernder als piper, kostet aber nichts und ist SOFORT da,
     ohne irgendeine Installation.

WARUM DER ZWEITE WEG DRIN IST
Ohne ihn haette dieser Rechner heute gar keine Stimme: piper ist nicht
installiert, ElevenLabs braucht einen Schluessel, und eigene Aufnahmen gibt es
noch keine. Der Rueckfall waere also selbst ausgefallen — und ein Rueckfall,
der ausfaellt, ist keiner.

Es ist ausdruecklich die schlechteste der drei Stimmen. Sie ist dafuer da,
dass etwas entsteht, das man anschauen und beurteilen kann.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from .base import Sprachausgabe, Stimme


# Wohin "npm run marketing:piper" bzw. der Einrichtungsschritt piper legt.
# Bewusst unter data/: Der Ordner ist gitignored, und 130 MB Programm plus
# Stimmmodell gehoeren nicht in ein oeffentliches Repository.
from ...env_loader import MARKETING_DIR

PIPER_ORDNER = MARKETING_DIR / "data" / "piper" / "piper"


def _erste_datei(ordner: Path, muster: str) -> Path | None:
    if not ordner.exists():
        return None
    return next(iter(sorted(ordner.glob(muster))), None)


def _piper() -> tuple[str | None, str | None]:
    """(programm, modell) — beides noetig, sonst (None, None).

    Gesucht wird in drei Stufen, dieselbe Linie wie bei ffmpeg:
      1. PATH — wer piper systemweit installiert hat, braucht nichts weiter
      2. PIPER_BIN / PIPER_VOICE — ausdrueckliche Angabe schlaegt alles
      3. der bekannte Ort Marketing/data/piper/piper/

    Warum Stufe 3 dazugekommen ist: Ohne sie muesste jeder Rechner zwei
    Umgebungsvariablen setzen, damit eine Datei gefunden wird, die genau an
    einer Stelle liegt. Ein vergessener Eintrag faellt dabei nicht auf — es
    klingt einfach weiter blechern, weil still auf die Windows-Sprachausgabe
    zurueckgefallen wird.
    """
    programm = (
        (os.environ.get("PIPER_BIN") or "").strip()
        or shutil.which("piper")
        or None
    )
    if programm and not Path(programm).exists() and not shutil.which(programm):
        programm = None
    if programm is None:
        gefunden = _erste_datei(PIPER_ORDNER, "piper.exe") or _erste_datei(PIPER_ORDNER, "piper")
        programm = str(gefunden) if gefunden else None

    modell = (os.environ.get("PIPER_VOICE") or "").strip() or None
    if modell and not Path(modell).exists():
        modell = None
    if modell is None:
        # Deutsches Modell bevorzugen — der Shop ist deutschsprachig.
        gefunden = _erste_datei(PIPER_ORDNER, "de_*.onnx") or _erste_datei(PIPER_ORDNER, "*.onnx")
        modell = str(gefunden) if gefunden else None

    return (programm, modell) if (programm and modell) else (None, None)


def _sapi_moeglich() -> bool:
    return os.name == "nt"


class LokaleStimme(Stimme):
    name = "lokal"

    def bereit(self) -> tuple[bool, str | None]:
        programm, modell = _piper()
        if programm and modell:
            return True, None
        if _sapi_moeglich():
            return True, None
        return False, (
            "weder piper (PIPER_BIN + PIPER_VOICE) noch Windows-Sprachausgabe verfuegbar"
        )

    def sprich(self, text: str, ziel: Path) -> Sprachausgabe:
        from .. import common

        ziel.parent.mkdir(parents=True, exist_ok=True)
        programm, modell = _piper()
        if programm and modell:
            self._piper_sprechen(programm, modell, text, ziel)
        elif _sapi_moeglich():
            self._sapi_sprechen(text, ziel)
        else:
            raise RuntimeError(self.bereit()[1])

        dauer = common.tondauer(ziel)
        if dauer <= 0.05:
            raise RuntimeError("lokale Stimme erzeugte keinen hoerbaren Ton")
        return Sprachausgabe(ziel, dauer, self.name, 0)

    # ── piper ────────────────────────────────────────────────────────

    def _piper_sprechen(self, programm: str, modell: str, text: str, ziel: Path) -> None:
        from .. import common

        roh = ziel.with_name(ziel.stem + "_roh.wav")
        ergebnis = subprocess.run(
            [programm, "--model", modell, "--output_file", str(roh)],
            input=text, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=300,
        )
        if ergebnis.returncode != 0 or not roh.exists():
            raise RuntimeError(f"piper fehlgeschlagen: {(ergebnis.stderr or '')[-300:]}")
        common.lauf(["-i", str(roh), "-ar", "48000", "-ac", "1", str(ziel)])
        roh.unlink(missing_ok=True)

    # ── Windows-Sprachausgabe ────────────────────────────────────────

    def _sapi_sprechen(self, text: str, ziel: Path) -> None:
        """Ueber System.Speech. Sucht eine deutsche Stimme, sonst die Standardstimme.

        Der Text geht ueber eine Datei an PowerShell, nicht ueber die
        Befehlszeile: Anfuehrungszeichen und Umlaute in einem Skript-Argument
        sind unter Windows PowerShell 5.1 eine verlaessliche Fehlerquelle
        (siehe CLAUDE-CODE.md Paragraph 1).
        """
        from .. import common

        roh = ziel.with_name(ziel.stem + "_sapi.wav")
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                         encoding="utf-8") as datei:
            datei.write(text)
            textdatei = datei.name

        skript = f"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = [System.IO.File]::ReadAllText('{textdatei}', [System.Text.Encoding]::UTF8)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {{ $s.SelectVoiceByHints('NotSet','NotSet',0,[System.Globalization.CultureInfo]::new('de-DE')) }} catch {{ }}
$s.Rate = 0
$s.SetOutputToWaveFile('{roh}')
$s.Speak($text)
$s.Dispose()
"""
        try:
            ergebnis = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", skript],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=300,
            )
            if ergebnis.returncode != 0 or not roh.exists():
                raise RuntimeError(
                    f"Windows-Sprachausgabe fehlgeschlagen: {(ergebnis.stderr or '')[-300:]}"
                )
            common.lauf(["-i", str(roh), "-ar", "48000", "-ac", "1", str(ziel)])
        finally:
            Path(textdatei).unlink(missing_ok=True)
            roh.unlink(missing_ok=True)
