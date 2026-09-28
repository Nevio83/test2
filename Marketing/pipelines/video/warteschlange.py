"""Rendern neben der Arbeit (Punkt 50).

WARUM
Rendern blockiert. Wer fuenf Fassungen baut, wartet fuenfmal — am selben
Rechner, an dem er weiterarbeiten will. Das begrenzt die Zahl der Varianten
aus Ungeduld, nicht aus inhaltlichen Gruenden. Und der Takt-Lauf des
Automaten braucht die Datenbank: Ohne sie wird lokal gar nichts gerendert.

WAS DIESE WARTESCHLANGE TUT
Sie schaut alle paar Sekunden in Marketing/schnittlisten/, nimmt jede Liste,
zu der es noch kein Video gibt, und rendert sie im Hintergrund — mehrere
parallel. Je Liste entsteht ein Protokoll neben dem Ergebnis
(<liste>_stil_c.log), und fertige Videos melden sich als Windows-
Benachrichtigung.

WAS SIE BEWUSST NICHT TUT
  * Sie fragt die Datenbank NICHT im Takt. "Offen" entscheidet die Zieldatei
    (offene_listen(nur_dateien=True)). Ein Poller mit Datenbankzugriff alle
    paar Sekunden haelt Neon dauerhaft wach — genau so lief am 22.09. das
    Monatskontingent leer. Die Datenbank wird nur beim Rendern selbst
    beruehrt, einmal je Video, wie im Takt-Lauf.
  * Sie versucht eine gescheiterte Liste nicht endlos neu. Erst wenn die
    Datei geaendert wurde, kommt sie wieder dran — sonst stuende eine
    kaputte Liste in einer Schleife, die den Rechner beschaeftigt und das
    Protokoll mit demselben Fehler fuellt.
  * Sie nimmt keine Liste, die gerade gespeichert wird (juenger als zwei
    Sekunden) — ein halb geschriebenes JSON ist kein Fehler der Liste.

Aufruf:
    npm run marketing:rendern                   laufen lassen (Strg+C beendet)
    npm run marketing:rendern -- --einmal       abarbeiten, was da ist, dann Ende
    npm run marketing:rendern -- --parallel 3   mehr gleichzeitig
"""

from __future__ import annotations

import argparse
import contextlib
import io
import os
import subprocess
import sys
import time
from concurrent.futures import Future, ProcessPoolExecutor
from pathlib import Path
from typing import Any

from .. import db
from . import common
from . import style_c_schnittliste as sc

TAKT_SEK = 5.0
RUHE_SEK = 2.0      # so lange muss eine Datei unveraendert sein


def parallel_standard() -> int:
    """Wie viele gleichzeitig? ffmpeg nutzt selbst mehrere Kerne — mehr als zwei
    parallel macht einen Arbeitsrechner zaeh, ohne dass es insgesamt schneller wird."""
    try:
        aus_env = int(os.environ.get("MARKETING_RENDER_PARALLEL") or 0)
    except ValueError:
        aus_env = 0
    if aus_env > 0:
        return aus_env
    return max(1, min(2, (os.cpu_count() or 2) // 4))


def protokoll_pfad(liste: Path) -> Path:
    return common.RENDERS / f"{liste.stem}_stil_c.log"


def _arbeite(pfad_text: str) -> dict[str, Any]:
    """Im Hintergrundprozess: eine Liste rendern, Ausgabe ins Protokoll."""
    pfad = Path(pfad_text)
    common.RENDERS.mkdir(parents=True, exist_ok=True)
    protokoll = protokoll_pfad(pfad)
    puffer = io.StringIO()
    begonnen = time.monotonic()
    with contextlib.redirect_stdout(puffer), contextlib.redirect_stderr(puffer):
        try:
            ergebnis = sc.rendere_liste(pfad)
        except Exception as fehler:  # noqa: BLE001 — ein Absturz ist hier ein Befund
            print(f"[warteschlange] ❌ {fehler}")
            ergebnis = {"gerendert": 0, "verworfen": 1, "fehler": str(fehler)}
    dauer = round(time.monotonic() - begonnen, 1)
    text = puffer.getvalue()
    # utf-8-sig: Mit Byte-Order-Mark zeigen auch Notepad-Altversionen und
    # PowerShell 5.1 (Get-Content) die Umlaute richtig — ohne las PowerShell
    # beim Ausprobieren "â€”" statt "—".
    protokoll.write_text(
        f"{pfad.name} — {time.strftime('%Y-%m-%d %H:%M:%S')} — {dauer} s\n\n{text}",
        encoding="utf-8-sig",
    )
    zeilen = [z for z in text.splitlines() if "⛔" in z or "❌" in z]
    return {**ergebnis, "liste": pfad.name, "dauer": dauer,
            "protokoll": str(protokoll), "meldungen": zeilen[:5]}


def benachrichtige(titel: str, text: str) -> None:
    """Windows-Benachrichtigung, ohne zusaetzliches Paket. Scheitert still.

    Still, weil eine fehlende Benachrichtigung kein Grund ist, ein fertiges
    Video als gescheitert zu melden — die Zeile in der Konsole steht ohnehin da.
    """
    if sys.platform != "win32":
        return
    sicher = lambda s: str(s).replace("'", "’")[:200]  # noqa: E731
    befehl = (
        "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; "
        "$n = New-Object System.Windows.Forms.NotifyIcon; "
        "$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; "
        f"$n.ShowBalloonTip(8000, '{sicher(titel)}', '{sicher(text)}', 'Info'); "
        "Start-Sleep -Seconds 9; $n.Dispose()"
    )
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", befehl],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except OSError:
        pass


def datenbank_pruefen() -> str | None:
    """EINE Probe beim Start. None = erreichbar oder gar nicht eingerichtet.

    Ist sie eingerichtet, aber gesperrt (Neon-Kontingent), wuerde jedes
    Video beim Eintragen scheitern. Dann wird ohne Datenbank gerendert —
    die Videos entstehen, und der Takt-Lauf traegt sie spaeter nicht nach;
    das steht deshalb deutlich in der Meldung.
    """
    if not db.verfuegbar():
        return None
    try:
        db.eine_zeile("SELECT 1 AS da")
        return None
    except Exception as fehler:  # noqa: BLE001
        with contextlib.suppress(Exception):
            db.schliessen()
        return str(fehler).splitlines()[0][:160]


class Warteschlange:
    """Der Zustand zwischen zwei Blicken in den Ordner."""

    def __init__(self, *, jetzt=time.time, ruhe: float = RUHE_SEK) -> None:
        self.in_arbeit: dict[Path, Future] = {}
        self.gescheitert: dict[Path, float] = {}   # Liste -> mtime beim Scheitern
        self._jetzt = jetzt
        self._ruhe = ruhe

    def neue_auftraege(self, offene: list[Path]) -> list[Path]:
        """Welche offenen Listen jetzt starten duerfen."""
        neu = []
        for pfad in offene:
            if pfad in self.in_arbeit:
                continue
            try:
                mtime = pfad.stat().st_mtime
            except OSError:
                continue
            if self._jetzt() - mtime < self._ruhe:
                continue            # wird gerade gespeichert
            if self.gescheitert.get(pfad) == mtime:
                continue            # unveraendert seit dem Scheitern
            neu.append(pfad)
        return neu

    def abgeschlossen(self, pfad: Path, ergebnis: dict[str, Any]) -> None:
        self.in_arbeit.pop(pfad, None)
        if ergebnis.get("gerendert", 0) == 0:
            with contextlib.suppress(OSError):
                self.gescheitert[pfad] = pfad.stat().st_mtime
        else:
            self.gescheitert.pop(pfad, None)


def lauf(*, parallel: int, einmal: bool = False, leise: bool = False,
         takt: float = TAKT_SEK, pool_fabrik=ProcessPoolExecutor) -> dict[str, int]:
    ok, grund = common.verfuegbar()
    if not ok:
        print(f"❌ {grund}")
        return {"gerendert": 0, "verworfen": 0}

    gesperrt = datenbank_pruefen()
    if gesperrt:
        # Setzen VOR dem Start der Hintergrundprozesse — sie erben die Umgebung.
        os.environ["DATABASE_URL"] = " "
        print("⚠️  Datenbank nicht erreichbar — es wird OHNE Eintrag in mkt_videos gerendert.")
        print(f"   ({gesperrt})")
        print("   Die Videos entstehen, stehen aber nicht in der Warteschlange des Dashboards.")

    print(f"── Warteschlange: {sc.SCHNITTLISTEN} — {parallel} parallel, "
          f"Protokolle unter {common.RENDERS} ──")
    # Bei --einmal wird nicht auf "fertig gespeichert" gewartet — sonst endete
    # der Lauf, bevor eine eben abgelegte Liste an der Reihe war.
    schlange = Warteschlange(ruhe=0.0 if einmal else RUHE_SEK)
    summe = {"gerendert": 0, "verworfen": 0}
    with pool_fabrik(max_workers=parallel) as pool:
        try:
            while True:
                for pfad in schlange.neue_auftraege(sc.offene_listen(nur_dateien=True)):
                    print(f"▶ {pfad.name}")
                    schlange.in_arbeit[pfad] = pool.submit(_arbeite, str(pfad))

                for pfad, zukunft in list(schlange.in_arbeit.items()):
                    if not zukunft.done():
                        continue
                    try:
                        ergebnis = zukunft.result()
                    except Exception as fehler:  # noqa: BLE001
                        ergebnis = {"gerendert": 0, "verworfen": 1, "liste": pfad.name,
                                    "dauer": 0, "protokoll": "", "meldungen": [str(fehler)]}
                    schlange.abgeschlossen(pfad, ergebnis)
                    summe["gerendert"] += ergebnis.get("gerendert", 0)
                    summe["verworfen"] += ergebnis.get("verworfen", 0)
                    if ergebnis.get("gerendert"):
                        print(f"✅ {pfad.name}: {ergebnis['gerendert']} Video(s) in {ergebnis['dauer']} s")
                        if not leise:
                            benachrichtige("Maios: Video fertig",
                                           f"{pfad.stem} — {ergebnis['gerendert']} Fassung(en)")
                    else:
                        print(f"⛔ {pfad.name}: nichts entstanden — {ergebnis.get('protokoll')}")
                        for zeile in ergebnis.get("meldungen") or []:
                            print(f"   {zeile}")
                        if not leise:
                            benachrichtige("Maios: Rendern gescheitert", pfad.stem)

                if einmal and not schlange.in_arbeit:
                    break
                time.sleep(takt)
        except KeyboardInterrupt:
            print("\nBeendet. Laufende Videos werden noch fertig gebaut …")
    print(f"── {summe['gerendert']} gerendert, {summe['verworfen']} ohne Ergebnis ──")
    return summe


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Schnittlisten im Hintergrund rendern.")
    parser.add_argument("--parallel", type=int, default=0, help="gleichzeitige Videos")
    parser.add_argument("--einmal", action="store_true", help="abarbeiten, was da ist, dann Ende")
    parser.add_argument("--leise", action="store_true", help="keine Windows-Benachrichtigung")
    args = parser.parse_args(argv)
    summe = lauf(parallel=args.parallel if args.parallel > 0 else parallel_standard(),
                 einmal=args.einmal, leise=args.leise)
    return 0 if summe["verworfen"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
