"""Schutzschalter: Notaus, Trockenlauf, Budget, Ratenbegrenzung, Selbstanpassung.

Dieses Modul ist die Bremse des Systems. Alles, was Geld kostet, nach aussen
geht oder die eigene Politik veraendert, muss hier vorbei.

WARUM DIE KONFIGURATION HIER LIEGT
Der Aufgabenzettel verlangt genau die Module aus Paragraph 3.3 — keine
zusaetzlichen "auf Vorrat". Einen eigenen Konfigurations-Lader gibt es dort
nicht, also wohnt er hier: guardrails ist ohnehin das Modul, das die
Konfigurationsdatei durchsetzt. Alle anderen holen sie ueber konfig().

DIE WICHTIGSTE REGEL
Ein Schutzschalter, der bei Ueberlastung ABBRICHT, ist schlechter als keiner:
dann steht das System still und niemand merkt warum. Deshalb schaltet der
Budgetwaechter auf den kostenlosen Weg um (lokales TTS, lokales Rendern,
Vorlagen-Briefings), statt den Lauf zu beenden.
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .. import db
from ..env_loader import MARKETING_DIR

KONFIG_DATEI = MARKETING_DIR / "config" / "marketing.config.json"
STOP_DATEI = MARKETING_DIR / "STOP"


class NotausAktiv(RuntimeError):
    """Das System wurde angehalten — kein Job darf laufen."""


class AenderungVerboten(PermissionError):
    """Das Lernmodul wollte etwas aendern, das ihm nicht gehoert."""


# ── Konfiguration ────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def konfig() -> dict[str, Any]:
    """Liest marketing.config.json. Fehlt sie, wird das laut gemeldet.

    Bewusst KEINE eingebauten Ersatzwerte fuer Budgets oder Gewichte: Wer die
    Datei loescht, soll das merken, statt unbemerkt mit anderen Zahlen zu
    arbeiten als er denkt.
    """
    try:
        return json.loads(KONFIG_DATEI.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise RuntimeError(f"Konfiguration fehlt: {KONFIG_DATEI}") from None
    except json.JSONDecodeError as fehler:
        raise RuntimeError(f"Konfiguration ist kein gueltiges JSON: {fehler}") from None


_overrides: dict[str, Any] | None = None


def lade_overrides(*, neu: bool = False) -> dict[str, Any]:
    """Gelernte Abweichungen aus mkt_config_overrides.

    Wird einmal je Prozess geholt. Ohne Datenbank gibt es keine — dann gelten
    schlicht die Startwerte aus der Datei.
    """
    global _overrides
    if _overrides is not None and not neu:
        return _overrides
    _overrides = {}
    if db.verfuegbar():
        try:
            for zeile in db.abfragen("SELECT pfad, wert FROM mkt_config_overrides"):
                _overrides[zeile["pfad"]] = zeile["wert"]
        except Exception as fehler:  # pragma: no cover
            print(f"[guardrails] Gelernte Werte nicht lesbar: {fehler}")
    return _overrides


def wert(pfad: str, standard: Any = None) -> Any:
    """Konfigurationswert ueber einen Punkt-Pfad, z.B. 'budget.tag_euro'.

    Reihenfolge: gelernter Wert aus der Datenbank schlaegt Startwert aus der
    Datei. Nur Pfade auf der Positivliste koennen ueberhaupt gelernte Werte
    haben — alles andere kommt garantiert aus der Datei.
    """
    gelernt = lade_overrides()
    if pfad in gelernt and darf_aendern(pfad):
        return gelernt[pfad]
    knoten: Any = konfig()
    for teil in pfad.split("."):
        if not isinstance(knoten, dict) or teil not in knoten:
            return standard
        knoten = knoten[teil]
    return knoten


def _flag(name: str, standard: bool) -> bool:
    """ENV-Schalter lesen. Nur 'true'/'false' (Gross-/Kleinschreibung egal)."""
    roh = (os.environ.get(name) or "").strip().lower()
    if roh in ("true", "1", "ja", "yes"):
        return True
    if roh in ("false", "0", "nein", "no"):
        return False
    return standard


# ── Notaus (drei unabhaengige Wege) ──────────────────────────────────

def notaus_grund(job: str | None = None) -> str | None:
    """Gibt den Grund zurueck, warum gerade nichts laufen darf — sonst None.

    Drei Wege, und es reicht EINER:
      1. ENV  MARKETING_ENABLED=false
      2. Datei Marketing/STOP existiert
      3. mkt_jobs.enabled = false (nur fuer den genannten Job)

    Der dritte Weg ist der Schalter im Admin-Dashboard. Er startet keine
    Prozesse und beendet keine — er setzt nur das Flag, und der naechste Takt
    sieht es.
    """
    if not _flag("MARKETING_ENABLED", True):
        return "MARKETING_ENABLED=false"
    if STOP_DATEI.exists():
        return f"Notaus-Datei vorhanden: {STOP_DATEI}"
    if job and db.verfuegbar():
        try:
            zeile = db.eine_zeile("SELECT enabled FROM mkt_jobs WHERE job = %s", (job,))
            if zeile is not None and not zeile["enabled"]:
                return f"mkt_jobs.enabled = false fuer '{job}'"
        except Exception as fehler:  # pragma: no cover
            print(f"[guardrails] Notaus-Flag nicht lesbar: {fehler}")
    return None


def notaus_aktiv(job: str | None = None) -> bool:
    return notaus_grund(job) is not None


# ── Trockenlauf ──────────────────────────────────────────────────────

def trockenlauf() -> bool:
    """Standard ist TRUE — es wird geplant, aber nichts veroeffentlicht.

    Auf false stellt nur ein Mensch ueber die ENV. Der Code selbst darf das
    nie tun; es gibt hier bewusst keine Setter-Funktion.
    """
    return _flag("MARKETING_DRY_RUN", bool(wert("trockenlauf.standard", True)))


def runner_art() -> str:
    """'actions' | 'local' | 'worker' — entscheidet, welche Jobs laufen duerfen."""
    art = (os.environ.get("MARKETING_RUNNER") or "actions").strip().lower()
    return art if art in ("actions", "local", "worker") else "actions"


def kann_lokale_jobs() -> bool:
    """Nur 'local' und 'worker' haben Browser bzw. GPU."""
    return runner_art() in ("local", "worker")


# ── Budget ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Budgetstand:
    tag_cent: int
    monat_cent: int
    tag_grenze_cent: int
    monat_grenze_cent: int

    @property
    def erschoepft(self) -> bool:
        return (
            self.tag_cent >= self.tag_grenze_cent
            or self.monat_cent >= self.monat_grenze_cent
        )

    @property
    def grund(self) -> str | None:
        if self.tag_cent >= self.tag_grenze_cent:
            return f"Tagesbudget erreicht ({self.tag_cent/100:.2f} von {self.tag_grenze_cent/100:.2f} EUR)"
        if self.monat_cent >= self.monat_grenze_cent:
            return f"Monatsbudget erreicht ({self.monat_cent/100:.2f} von {self.monat_grenze_cent/100:.2f} EUR)"
        return None


def budgetstand() -> Budgetstand:
    """Summiert mkt_cost_ledger. Ohne Datenbank gilt das Budget als unverbraucht.

    Das ist Absicht: ohne DB gibt es auch keine kostenpflichtigen Aufrufe, die
    gebucht werden koennten — der Trockenlauf soll nicht am Waechter haengen.
    """
    tag_grenze = int(round(float(wert("budget.tag_euro", 0)) * 100))
    monat_grenze = int(round(float(wert("budget.monat_euro", 0)) * 100))
    if not db.verfuegbar():
        return Budgetstand(0, 0, tag_grenze, monat_grenze)
    try:
        zeile = db.eine_zeile(
            """SELECT
                 COALESCE(SUM(kosten_cent) FILTER (WHERE zeitpunkt >= date_trunc('day', now())), 0)   AS tag,
                 COALESCE(SUM(kosten_cent) FILTER (WHERE zeitpunkt >= date_trunc('month', now())), 0) AS monat
               FROM mkt_cost_ledger"""
        )
        return Budgetstand(int(zeile["tag"]), int(zeile["monat"]), tag_grenze, monat_grenze)
    except Exception as fehler:  # pragma: no cover
        print(f"[guardrails] Budget nicht lesbar: {fehler}")
        return Budgetstand(0, 0, tag_grenze, monat_grenze)


def darf_kosten_verursachen(cent: int = 0) -> tuple[bool, str | None]:
    """Vor JEDEM kostenpflichtigen Aufruf fragen.

    Rueckgabe (darf, grund). Bei False schaltet der Aufrufer auf den
    kostenlosen Weg um — er bricht nicht ab.
    """
    stand = budgetstand()
    if stand.erschoepft:
        return False, stand.grund
    if cent and (stand.tag_cent + cent) > stand.tag_grenze_cent:
        return False, (
            f"Aufruf ueber {cent/100:.2f} EUR wuerde das Tagesbudget reissen "
            f"({stand.tag_cent/100:.2f} von {stand.tag_grenze_cent/100:.2f} EUR verbraucht)"
        )
    return True, None


def buche_kosten(
    anbieter: str,
    kosten_cent: int,
    *,
    endpunkt: str | None = None,
    einheiten: float = 0,
    job: str | None = None,
) -> None:
    """Kostenzeile schreiben. Ohne diese Zeile ist der Budgetwaechter blind."""
    if not db.verfuegbar():
        return
    try:
        db.ausfuehren(
            """INSERT INTO mkt_cost_ledger (anbieter, endpunkt, einheiten, kosten_cent, job)
               VALUES (%s, %s, %s, %s, %s)""",
            (anbieter, endpunkt, einheiten, int(kosten_cent), job),
        )
    except Exception as fehler:  # pragma: no cover
        print(f"[guardrails] Kostenzeile nicht geschrieben: {fehler}")


# ── Ratenbegrenzung (Token-Bucket je Anbieter) ───────────────────────

class Ratenbegrenzer:
    """Einfacher Token-Bucket: n Anfragen pro Minute je Anbieter.

    Prozesslokal — das genuegt, weil je Anbieter ohnehin nur ein Runner
    gleichzeitig arbeitet (dafuer sorgt der atomare Claim in state.py).
    """

    def __init__(self) -> None:
        self._eimer: dict[str, list[float]] = {}
        self._sperre = threading.Lock()

    def erlaubt(self, anbieter: str) -> bool:
        grenze = int(wert(f"rate_limits.{anbieter}", 0) or 0)
        if grenze <= 0:
            return True
        jetzt = time.monotonic()
        with self._sperre:
            zeiten = [t for t in self._eimer.get(anbieter, []) if jetzt - t < 60.0]
            if len(zeiten) >= grenze:
                self._eimer[anbieter] = zeiten
                return False
            zeiten.append(jetzt)
            self._eimer[anbieter] = zeiten
            return True

    def warte_bis_erlaubt(self, anbieter: str, max_sek: float = 65.0) -> bool:
        """Blockiert hoechstens max_sek. False = Kontingent bleibt erschoepft."""
        ende = time.monotonic() + max_sek
        while time.monotonic() < ende:
            if self.erlaubt(anbieter):
                return True
            time.sleep(1.0)
        return False


ratenbegrenzer = Ratenbegrenzer()


# ── Grenzen der Selbstanpassung ──────────────────────────────────────

def darf_aendern(pfad: str) -> bool:
    """Darf das Lernmodul diesen Konfigurationswert anfassen?

    Erlaubt ist nur, was in 'lernen.darf_aendern' steht — eine Positivliste.
    Alles andere ist verboten, auch wenn es harmlos aussieht. Ein System, das
    sein eigenes Budget erhoehen oder Compliance-Regeln lockern kann, ist kein
    kontrolliertes System mehr.
    """
    erlaubt = wert("lernen.darf_aendern", []) or []
    return pfad in erlaubt


def pruefe_aenderung(pfad: str) -> None:
    """Wie darf_aendern, wirft aber — fuer Stellen, die nicht weiterlaufen duerfen."""
    if not darf_aendern(pfad):
        raise AenderungVerboten(
            f"Das Lernmodul darf '{pfad}' nicht aendern. "
            f"Erlaubt sind ausschliesslich: {wert('lernen.darf_aendern', [])}"
        )


def uebernehme_gelernte_werte(aenderungen: dict[str, Any], *, job: str | None = None) -> dict[str, Any]:
    """Schreibt gelernte Werte nach mkt_config_overrides — nur erlaubte.

    NICHT in die Konfigurationsdatei: Der Hauptbetrieb laeuft in GitHub
    Actions mit fluechtigem Checkout, eine dort geschriebene Datei ist beim
    naechsten Lauf weg. Gelerntes waere damit nach 30 Minuten verloren, ohne
    dass es jemand merkt — genau die Klasse Fehler, gegen die diese Runde
    gebaut ist.

    Jede Aenderung landet mit Vorher-/Nachher-Wert im Nachweis-Protokoll.
    Verbotene Pfade werden abgewiesen und ebenfalls protokolliert, damit ein
    Versuch nicht spurlos bleibt.
    """
    uebernommen: dict[str, Any] = {}
    for pfad, neuer_wert in aenderungen.items():
        if not darf_aendern(pfad):
            db.audit(
                "aenderung_abgelehnt",
                job=job,
                begruendung=f"'{pfad}' steht nicht auf der Positivliste",
                nachher={pfad: neuer_wert},
            )
            print(f"[guardrails] ABGELEHNT: '{pfad}' darf nicht geaendert werden.")
            continue
        alt = wert(pfad)
        if not db.verfuegbar():
            print(f"[guardrails] '{pfad}' nicht gespeichert — keine Datenbank.")
            continue
        db.ausfuehren(
            """INSERT INTO mkt_config_overrides (pfad, wert, gesetzt_von)
               VALUES (%s, %s, %s)
               ON CONFLICT (pfad) DO UPDATE
                 SET wert = EXCLUDED.wert,
                     gesetzt_von = EXCLUDED.gesetzt_von,
                     gesetzt_am = now()""",
            (pfad, json.dumps(neuer_wert, ensure_ascii=False), job or "lernmodul"),
        )
        uebernommen[pfad] = neuer_wert
        db.audit(
            "gewicht_angepasst",
            job=job,
            begruendung="Lernmodul hat einen erlaubten Wert angepasst",
            vorher={pfad: alt},
            nachher={pfad: neuer_wert},
        )
    if uebernommen:
        lade_overrides(neu=True)
    return uebernommen


def setze_override_zurueck(pfad: str) -> bool:
    """Gelernten Wert verwerfen — der Startwert aus der Datei gilt wieder.

    Gebraucht im Dashboard, wenn das Lernmodul sich verrannt hat.
    """
    if not db.verfuegbar():
        return False
    betroffen = db.ausfuehren("DELETE FROM mkt_config_overrides WHERE pfad = %s", (pfad,))
    lade_overrides(neu=True)
    db.audit("gewicht_zurueckgesetzt", begruendung=f"'{pfad}' auf Startwert zurueck")
    return betroffen > 0
