"""Einstiegspunkt des Marketing-Automaten.

    py -m pipelines.orchestrator.run_loop --once
    py -m pipelines.orchestrator.run_loop --once --max-minutes 25
    py -m pipelines.orchestrator.run_loop --status
    py -m pipelines.orchestrator.run_loop --job trends_ingest

EINE IMPLEMENTIERUNG, DREI ORTE
Dieselbe Datei laeuft in GitHub Actions (alle 30 Minuten), auf dem eigenen PC
(Dauerlaeufer ueber run-local.js) und optional in einem Render-Worker. Was ein
Ort darf, entscheidet MARKETING_RUNNER: nur 'local' und 'worker' bekommen die
Jobs mit requires_local (Browser, GPU).

WAS DIESER LAUF NIEMALS TUT
  * ohne Datenbank so tun, als waere etwas passiert
  * einen fehlenden API-Schluessel durch Beispieldaten ersetzen
  * bei einem kaputten Teilschritt den ganzen Lauf abbrechen

Stattdessen wird JEDER uebersprungene Job mit Grund protokolliert. Ein stiller
Fehlschlag sieht aus wie Betrieb — und ist damit schlimmer als ein lauter.
"""

from __future__ import annotations

import argparse
import sys
import threading
import time
from typing import Any

from .. import db
from . import guardrails, jobs as job_katalog, state


def _dauer(seit: float) -> int:
    return int((time.monotonic() - seit) * 1000)


class Herzschlag:
    """Setzt waehrend eines laufenden Jobs regelmaessig ein Lebenszeichen.

    Ohne das gilt ein Job, der laenger als heartbeat_timeout_minuten braucht,
    faelschlich als abgestuerzt und koennte parallel ein zweites Mal
    uebernommen werden.
    """

    def __init__(self, job: str, lauf_id: str, takt_sek: float = 60.0) -> None:
        self._job, self._lauf_id, self._takt = job, lauf_id, takt_sek
        self._stopp = threading.Event()
        self._faden: threading.Thread | None = None

    def __enter__(self) -> "Herzschlag":
        def schlagen() -> None:
            while not self._stopp.wait(self._takt):
                state.heartbeat(self._job, lauf_id=self._lauf_id)

        self._faden = threading.Thread(target=schlagen, daemon=True)
        self._faden.start()
        return self

    def __exit__(self, *_: Any) -> None:
        self._stopp.set()
        if self._faden:
            self._faden.join(timeout=2.0)


def einmal_durchlaufen(*, max_minuten: float = 25.0, nur_job: str | None = None) -> dict[str, Any]:
    """Ein Durchgang durch den Katalog. Gibt eine Zusammenfassung zurueck."""
    start = time.monotonic()
    frist = start + max_minuten * 60.0

    bericht: dict[str, Any] = {
        "gelaufen": [], "uebersprungen": [], "fehlgeschlagen": [],
        "trockenlauf": guardrails.trockenlauf(),
        "runner": guardrails.runner_art(),
    }

    # 1) Globaler Notaus — vor allem anderen.
    grund = guardrails.notaus_grund()
    if grund:
        print(f"⛔ Notaus aktiv: {grund}. Es laeuft nichts.")
        bericht["notaus"] = grund
        return bericht

    kann_lokal = guardrails.kann_lokale_jobs()
    print(
        f"▶ Lauf startet — Runner '{bericht['runner']}'"
        f"{' (darf lokale Jobs)' if kann_lokal else ''}, "
        f"Trockenlauf {'AN' if bericht['trockenlauf'] else 'AUS'}, "
        f"Frist {max_minuten:.0f} Min"
    )

    # 2) Ohne Datenbank kann nichts belegt werden. Das ist kein Fehler —
    #    aber es muss je Job sichtbar sein, statt einfach nichts zu tun.
    if not db.verfuegbar():
        warum = db.grund_fuer_fehlende_db()
        print(f"⚠️ Keine Datenbank: {warum}")
        for job in job_katalog.KATALOG:
            if nur_job and job.name != nur_job:
                continue
            print(f"   ⏭️  {job.name}: uebersprungen — {warum}")
            bericht["uebersprungen"].append({"job": job.name, "grund": warum})
        return bericht

    # 3) Katalog in die Tabelle spiegeln (Abstaende koennen sich geaendert haben).
    state.registriere_katalog(job_katalog.katalog_mit_einstellungen())
    lauf_id = state.runner_id()

    for job in job_katalog.KATALOG:
        if nur_job and job.name != nur_job:
            continue

        if time.monotonic() > frist:
            print(f"   ⏱️  {job.name}: uebersprungen — Zeitfrist erreicht")
            bericht["uebersprungen"].append({"job": job.name, "grund": "Zeitfrist erreicht"})
            continue

        job_grund = guardrails.notaus_grund(job.name)
        if job_grund:
            print(f"   ⛔ {job.name}: uebersprungen — {job_grund}")
            bericht["uebersprungen"].append({"job": job.name, "grund": job_grund})
            continue

        if not state.uebernimm(job.name, lauf_id=lauf_id, kann_lokal=kann_lokal):
            print(f"   ⏭️  {job.name}: nicht faellig oder bereits belegt")
            bericht["uebersprungen"].append({"job": job.name, "grund": "nicht faellig / belegt"})
            continue

        ablauf, fehlgrund = job_katalog.lade_ablauf(job)
        if ablauf is None:
            # Der Job war faellig und ist jetzt belegt — er muss sauber
            # abgeschlossen werden, sonst blockiert der Lease bis zum Timeout.
            print(f"   ⚠️  {job.name}: {fehlgrund}")
            state.abschliessen(
                job.name, ereignis_id=None, ergebnis="uebersprungen", dauer_ms=0,
                details={"grund": fehlgrund},
            )
            bericht["uebersprungen"].append({"job": job.name, "grund": fehlgrund})
            continue

        ereignis_id = state.beginne_protokoll(job.name, lauf_id=lauf_id)
        job_start = time.monotonic()
        print(f"   ▶ {job.name} laeuft …")
        try:
            with Herzschlag(job.name, lauf_id):
                ergebnis = ablauf()
            dauer = _dauer(job_start)
            state.abschliessen(
                job.name, ereignis_id=ereignis_id, ergebnis="ok",
                dauer_ms=dauer, details=ergebnis if isinstance(ergebnis, dict) else None,
            )
            print(f"   ✅ {job.name} fertig ({dauer} ms) {ergebnis if ergebnis else ''}")
            bericht["gelaufen"].append({"job": job.name, "dauer_ms": dauer, "ergebnis": ergebnis})
        except Exception as fehler:  # bewusst breit: ein Job darf den Lauf nicht killen
            dauer = _dauer(job_start)
            state.melde_fehler(job.name, str(fehler), ereignis_id=ereignis_id, dauer_ms=dauer)
            print(f"   ❌ {job.name} fehlgeschlagen: {fehler}")
            bericht["fehlgeschlagen"].append({"job": job.name, "fehler": str(fehler)})

    print(
        f"◀ Lauf fertig nach {(time.monotonic()-start):.1f}s — "
        f"{len(bericht['gelaufen'])} gelaufen, "
        f"{len(bericht['uebersprungen'])} uebersprungen, "
        f"{len(bericht['fehlgeschlagen'])} fehlgeschlagen"
    )
    return bericht


def zeige_status() -> None:
    """Zustandstabelle — dieselbe Sicht wie das Admin-Dashboard."""
    print(f"Runner:      {guardrails.runner_art()} (lokale Jobs: {guardrails.kann_lokale_jobs()})")
    print(f"Trockenlauf: {'AN — es wird nichts veroeffentlicht' if guardrails.trockenlauf() else 'AUS — es wird echt gepostet'}")
    notaus = guardrails.notaus_grund()
    print(f"Notaus:      {notaus or 'inaktiv'}")
    stand = guardrails.budgetstand()
    print(f"Budget:      Tag {stand.tag_cent/100:.2f}/{stand.tag_grenze_cent/100:.2f} EUR · "
          f"Monat {stand.monat_cent/100:.2f}/{stand.monat_grenze_cent/100:.2f} EUR")

    if not db.verfuegbar():
        print(f"\nKeine Datenbank: {db.grund_fuer_fehlende_db()}")
        print("Katalog (nicht eingetragen):")
        for job in job_katalog.KATALOG:
            _, fehlgrund = job_katalog.lade_ablauf(job)
            print(f"  {job.name:18} {'⚠️ ' + fehlgrund if fehlgrund else '✅ bereit'}")
        return

    zeilen = state.status()
    if not zeilen:
        print("\nNoch keine Jobs eingetragen — ein erster Lauf legt sie an.")
        return
    print(f"\n{'Job':18} {'an':3} {'lokal':6} {'Laeufe':7} {'naechster Lauf in':18} Fehler")
    print("-" * 78)
    for z in zeilen:
        rest = int(z["in_sekunden"] or 0)
        wann = "jetzt faellig" if rest == 0 else f"{rest//3600}h {(rest%3600)//60}m"
        fehler = f"{z['fehler_zaehler']}× {(z['letzter_fehler'] or '')[:28]}" if z["fehler_zaehler"] else ""
        print(
            f"{z['job']:18} {'ja' if z['enabled'] else 'NEIN':3} "
            f"{'ja' if z['requires_local'] else '-':6} {z['laeufe']:<7} {wann:18} {fehler}"
        )


def main(argv: list[str] | None = None) -> int:
    zerleger = argparse.ArgumentParser(
        prog="run_loop",
        description="Marketing-Automat: ein Durchgang oder Statusanzeige.",
    )
    zerleger.add_argument("--once", action="store_true", help="einen Durchgang und beenden")
    zerleger.add_argument("--max-minutes", type=float, default=25.0, help="Zeitfrist des Durchgangs")
    zerleger.add_argument("--job", type=str, default=None, help="nur diesen Job versuchen")
    zerleger.add_argument("--status", action="store_true", help="Zustand anzeigen, nichts ausfuehren")
    zerleger.add_argument("--list", action="store_true", help="Job-Katalog anzeigen")
    args = zerleger.parse_args(argv)

    try:
        if args.list:
            for job in job_katalog.KATALOG:
                _, fehlgrund = job_katalog.lade_ablauf(job)
                print(f"{job.name:18} {job.beschreibung}")
                print(f"{'':18} -> {job.ziel}  {'⚠️ ' + fehlgrund if fehlgrund else '✅'}")
            return 0

        if args.status:
            zeige_status()
            return 0

        if not args.once and not args.job:
            zerleger.print_help()
            return 0

        einmal_durchlaufen(max_minuten=args.max_minutes, nur_job=args.job)
        return 0
    finally:
        db.schliessen()


if __name__ == "__main__":
    sys.exit(main())
