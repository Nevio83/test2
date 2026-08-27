"""Job-Katalog: welcher Ablauf ruft welche Funktion, in welchem Abstand.

WARUM DIE ZUORDNUNG ALS TEXT STEHT

Jeder Job zeigt ueber "modul:funktion" auf seinen Ablauf, nicht ueber einen
direkten Import. Zwei Gruende:

  1. Der Katalog laesst sich lesen und anzeigen, ohne dass halb Python
     geladen wird — das Dashboard und "--status" brauchen keine ffmpeg-
     Bibliothek.
  2. Ein Ablauf, dessen Modul (noch) fehlt oder dessen Abhaengigkeit nicht
     installiert ist, laesst den GESAMTEN Lauf nicht scheitern. Er wird
     uebersprungen und der Grund protokolliert.

Punkt 2 ist der Kern der Projektkonvention "Degradation statt Absturz": Der
Shop startet auch ohne DATABASE_URL, und der Marketing-Automat laeuft auch
ohne ffmpeg, ohne API-Schluessel und ohne GPU — er tut dann eben weniger und
sagt genau, warum.

Die Abstaende stehen NICHT hier, sondern in config/marketing.config.json.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Any, Callable

from .. import db
from . import guardrails


@dataclass(frozen=True)
class Job:
    name: str
    ziel: str            # "modul:funktion"
    beschreibung: str


# Reihenfolge = Bearbeitungsreihenfolge innerhalb eines Laufs. Sie folgt der
# Kette: erst Rohstoff (Trends, Shop-Signale), dann Verarbeitung (Matching,
# Briefing), dann Produktion (Rendern), dann Veroeffentlichung, dann Messung,
# dann Lernen. Ein Lauf, der oben etwas Neues findet, kann es also im selben
# Durchgang bis zur Warteschlange bringen.
KATALOG: tuple[Job, ...] = (
    Job("trends_ingest",   "pipelines.trends.normalize:job_trends_einlesen",
        "Trends aller Quellen holen, normalisieren, bewerten"),
    Job("shop_signals",    "pipelines.trends.shop_signals:job_shop_signale",
        "Eigene Shop-Daten als Trendquelle (Suchen, Aufrufe, Bestellungen)"),
    Job("match_and_brief", "pipelines.creative.brief_generator:job_match_und_brief",
        "Trend -> Produkt zuordnen und Kreativ-Briefing schreiben"),
    Job("render_style_a",  "pipelines.video.style_a_realvoice:job_render_stil_a",
        "Stil A rendern: geschnittene Clips mit echter Stimme"),
    Job("render_style_b",  "pipelines.video.style_b_aigen:job_render_stil_b",
        "Stil B rendern: KI-generierte Einstellungen (GPU/Anbieter)"),
    Job("publish_due",     "pipelines.publish.base:job_faellige_veroeffentlichen",
        "Faellige Videos veroeffentlichen (im Trockenlauf nur vormerken)"),
    Job("metrics_collect", "pipelines.analytics.collectors:job_metriken_sammeln",
        "Plattform-Kennzahlen je Messfenster einsammeln"),
    Job("learning_update", "pipelines.learning.policy:job_lernen",
        "Belohnungen berechnen, Arme aktualisieren, Gewichte anpassen"),
    Job("weekly_report",   "pipelines.learning.report:job_wochenbericht",
        "Wochenbericht erzeugen und per Mail verschicken"),
    Job("cleanup_assets",  "pipelines.video.assets:job_aufraeumen",
        "Alte Renderings und Zwischenstaende loeschen"),
    Job("budget_rollover", "pipelines.orchestrator.jobs:job_budget_uebersicht",
        "Tagesabschluss der Kosten, Warnung vor der Monatsgrenze"),
)


def katalog_mit_einstellungen() -> dict[str, dict[str, Any]]:
    """Katalog + Abstaende/Ort aus der Konfiguration — fuer mkt_jobs."""
    aus_konfig = guardrails.konfig().get("jobs", {})
    ergebnis: dict[str, dict[str, Any]] = {}
    for job in KATALOG:
        eintrag = aus_konfig.get(job.name, {})
        if not eintrag:
            print(f"[jobs] '{job.name}' fehlt in marketing.config.json — uebersprungen.")
            continue
        ergebnis[job.name] = {
            "abstand_sek": int(eintrag.get("abstand_sek", 3600)),
            "requires_local": bool(eintrag.get("requires_local", False)),
        }
    return ergebnis


def lade_ablauf(job: Job) -> tuple[Callable[..., Any] | None, str | None]:
    """Holt die Funktion hinter einem Job.

    Rueckgabe (funktion, grund_falls_nicht). Ein fehlendes Modul ist KEIN
    Fehler, sondern ein Zustand: "dieser Teil ist hier nicht verfuegbar".
    """
    modulname, _, funktionsname = job.ziel.partition(":")
    try:
        modul = importlib.import_module(modulname)
    except ImportError as fehler:
        return None, f"Modul {modulname} nicht verfuegbar ({fehler})"
    funktion = getattr(modul, funktionsname, None)
    if funktion is None:
        return None, f"{modulname} hat keine Funktion {funktionsname}()"
    return funktion, None


# ── Eingebauter Ablauf: Kostenuebersicht ─────────────────────────────

def job_budget_uebersicht() -> dict[str, Any]:
    """Tagesabschluss der Kosten. Warnt, bevor die Monatsgrenze reisst.

    Kein Zuruecksetzen noetig — die Grenzen werden ohnehin ueber
    date_trunc('day'/'month') aus mkt_cost_ledger gerechnet. Dieser Ablauf
    haelt den Stand fest und meldet sich, wenn es eng wird.
    """
    stand = guardrails.budgetstand()
    anteil_monat = (stand.monat_cent / stand.monat_grenze_cent) if stand.monat_grenze_cent else 0.0

    if db.verfuegbar():
        top = db.abfragen(
            """SELECT anbieter, SUM(kosten_cent)::int AS cent, COUNT(*)::int AS aufrufe
                 FROM mkt_cost_ledger
                WHERE zeitpunkt >= date_trunc('day', now())
                GROUP BY anbieter ORDER BY cent DESC"""
        )
    else:
        top = []

    db.audit(
        "budget_tagesabschluss",
        job="budget_rollover",
        begruendung=f"Monat zu {anteil_monat*100:.0f} % verbraucht",
        nachher={
            "tag_cent": stand.tag_cent,
            "monat_cent": stand.monat_cent,
            "je_anbieter": [dict(t) for t in top],
        },
    )
    if anteil_monat >= 0.8:
        print(
            f"[budget] ⚠️ Monatsbudget zu {anteil_monat*100:.0f} % verbraucht "
            f"({stand.monat_cent/100:.2f} von {stand.monat_grenze_cent/100:.2f} EUR)."
        )
    return {
        "tag_euro": round(stand.tag_cent / 100, 2),
        "monat_euro": round(stand.monat_cent / 100, 2),
        "anteil_monat": round(anteil_monat, 3),
        "anbieter": len(top),
    }
