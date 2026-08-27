"""Zustand der Marketing-Ablaeufe: Faelligkeit, Claim, Lease, Herzschlag.

DAS PROBLEM, DAS HIER GELOEST WIRD

Der Shop laeuft auf Render-Free: der Dienst schlaeft ein und startet staendig
neu. Ein Ablauf, der an einem Wecker im laufenden Prozess haengt (setInterval,
time.sleep), beginnt bei jedem Neustart von vorn — bei rund zwei Deploys
taeglich kommt ein Tageslauf damit selten durch und ein Wochenlauf praktisch
nie. Genau das ist im Projekt am 02.08. nachgemessen worden; siehe den
Kommentarkopf in job-scheduler.js.

DIE LOESUNG IST DIESELBE WIE DORT
Nicht "alle 30 Minuten ab jetzt", sondern "faellig, wenn naechster_lauf
erreicht ist". Der Zeitpunkt steht in der Datenbank und uebersteht jeden
Neustart. Ein Neustart kostet damit hoechstens einen Takt.

ZWEI RUNNER, EIN JOB
Der Automat laeuft an drei Orten gleichzeitig (GitHub Actions, eigener PC,
optional ein Worker). Ob ein Job faellig ist UND das Belegen passieren deshalb
in EINER SQL-Anweisung — siehe uebernimm(). Wer die Zeile bekommt, laeuft;
alle anderen bekommen nichts zurueck und tun nichts. "Erst lesen, dann
schreiben" waere hier ein Fehler: zwischen Lesen und Schreiben passt ein
zweiter Runner.

ABGESTUERZTE LAEUFE
Ein Job, der mitten im Lauf stirbt, laesst laeuft_seit stehen und wuerde ewig
blockieren. Deshalb schreibt jeder laufende Job einen Herzschlag; bleibt der
laenger als heartbeat_timeout_minuten aus, gilt der Lauf als tot und wird von
derselben SQL-Anweisung wieder freigegeben.
"""

from __future__ import annotations

import json
import os
import socket
import uuid
from typing import Any

from .. import db
from . import guardrails


def runner_id() -> str:
    """Wer bin ich? Zur Nachvollziehbarkeit in mkt_job_events."""
    art = guardrails.runner_art()
    kennung = os.environ.get("GITHUB_RUN_ID") or socket.gethostname()
    return f"{art}:{kennung}:{uuid.uuid4().hex[:6]}"


def registriere_katalog(katalog: dict[str, dict[str, Any]]) -> int:
    """Traegt die Jobs aus der Konfiguration in mkt_jobs ein.

    Neue Jobs bekommen naechster_lauf = JETZT + Abstand, nicht JETZT: sonst
    rennen beim allerersten Start alle gleichzeitig los. Dieselbe Entscheidung
    steckt in claimJobRun (database.js), aus demselben Grund.

    Der Abstand und requires_local werden bei jedem Start nachgezogen — die
    Konfigurationsdatei ist die Wahrheit, nicht die Tabelle. enabled wird
    NICHT ueberschrieben: das ist der Schalter des Menschen im Dashboard.
    """
    if not db.verfuegbar():
        return 0
    anzahl = 0
    for name, einstellungen in katalog.items():
        abstand = int(einstellungen.get("abstand_sek", 3600))
        lokal = bool(einstellungen.get("requires_local", False))
        db.ausfuehren(
            """INSERT INTO mkt_jobs (job, abstand_sek, requires_local, naechster_lauf)
               VALUES (%s, %s, %s, now() + make_interval(secs => %s))
               ON CONFLICT (job) DO UPDATE
                 SET abstand_sek = EXCLUDED.abstand_sek,
                     requires_local = EXCLUDED.requires_local""",
            (name, abstand, lokal, abstand),
        )
        anzahl += 1
    return anzahl


def uebernimm(job: str, *, lauf_id: str, kann_lokal: bool) -> bool:
    """Faelligkeit pruefen UND belegen — in einer einzigen SQL-Anweisung.

    Genau hier haengt die Mehrlaeufer-Sicherheit. Die Bedingungen:
      * enabled            -> Notaus-Schalter aus dem Dashboard
      * naechster_lauf <= now()  -> faellig
      * NOT requires_local OR kann_lokal -> richtiger Ort
      * laeuft_seit IS NULL ODER Herzschlag zu alt -> nicht schon belegt

    Und im selben Schritt wird bereits der naechste Termin gesetzt. Faellt der
    Prozess danach aus, verschiebt sich der Job also hoechstens um einen Takt,
    statt sofort wieder zu starten.
    """
    if not db.verfuegbar():
        return False
    timeout = int(guardrails.wert("wiederholung.heartbeat_timeout_minuten", 30))
    zeilen = db.abfragen(
        """UPDATE mkt_jobs
              SET laeuft_seit    = now(),
                  heartbeat_at   = now(),
                  runner_id      = %s,
                  letzter_lauf   = now(),
                  naechster_lauf = now() + make_interval(secs => abstand_sek),
                  laeufe         = laeufe + 1
            WHERE job = %s
              AND enabled
              AND naechster_lauf <= now()
              AND (NOT requires_local OR %s)
              AND (laeuft_seit IS NULL
                   OR heartbeat_at IS NULL
                   OR heartbeat_at < now() - make_interval(mins => %s))
          RETURNING job, laeufe""",
        (lauf_id, job, kann_lokal, timeout),
    )
    return bool(zeilen)


def heartbeat(job: str, *, lauf_id: str) -> None:
    """Lebenszeichen eines laufenden Jobs. Nur der Belegende darf das."""
    if not db.verfuegbar():
        return
    try:
        db.ausfuehren(
            "UPDATE mkt_jobs SET heartbeat_at = now() WHERE job = %s AND runner_id = %s",
            (job, lauf_id),
        )
    except Exception as fehler:  # pragma: no cover
        print(f"[state] Herzschlag fuer '{job}' nicht gesetzt: {fehler}")


def beginne_protokoll(job: str, *, lauf_id: str) -> int | None:
    """Startzeile in mkt_job_events. Gibt die ID fuer den Abschluss zurueck."""
    if not db.verfuegbar():
        return None
    zeile = db.eine_zeile(
        "INSERT INTO mkt_job_events (job, runner_id) VALUES (%s, %s) RETURNING id",
        (job, lauf_id),
    )
    return int(zeile["id"]) if zeile else None


def abschliessen(
    job: str,
    *,
    ereignis_id: int | None,
    ergebnis: str,
    dauer_ms: int,
    details: Any = None,
) -> None:
    """Lauf erfolgreich beenden: Lease freigeben, Fehlerzaehler zuruecksetzen."""
    if not db.verfuegbar():
        return
    db.ausfuehren(
        """UPDATE mkt_jobs
              SET laeuft_seit = NULL, heartbeat_at = NULL, fehler_zaehler = 0
            WHERE job = %s""",
        (job,),
    )
    if ereignis_id is not None:
        db.ausfuehren(
            """UPDATE mkt_job_events
                  SET beendet_at = now(), dauer_ms = %s, ergebnis = %s, details = %s
                WHERE id = %s""",
            (dauer_ms, ergebnis, json.dumps(details, ensure_ascii=False) if details is not None else None, ereignis_id),
        )


def melde_fehler(job: str, fehlertext: str, *, ereignis_id: int | None = None, dauer_ms: int = 0) -> None:
    """Fehlschlag festhalten, zurueckhalten, nach zu vielen Versuchen pausieren.

    Das Zurueckhalten waechst exponentiell (1, 4, 16 Minuten). Nach
    max_fehlversuche wird der Job abgeschaltet — ein dauerhaft kaputter Ablauf
    soll nicht alle paar Minuten neu gegen dieselbe Wand laufen. Wieder
    einschalten muss ein Mensch (Dashboard).
    """
    if not db.verfuegbar():
        return
    backoff = guardrails.wert("wiederholung.backoff_minuten", [1, 4, 16]) or [1, 4, 16]
    max_versuche = int(guardrails.wert("wiederholung.max_fehlversuche", 3))

    zeile = db.eine_zeile("SELECT fehler_zaehler FROM mkt_jobs WHERE job = %s", (job,))
    zaehler = int(zeile["fehler_zaehler"]) if zeile else 0
    neuer_zaehler = zaehler + 1
    minuten = int(backoff[min(zaehler, len(backoff) - 1)])
    pausieren = neuer_zaehler >= max_versuche

    db.ausfuehren(
        """UPDATE mkt_jobs
              SET laeuft_seit = NULL,
                  heartbeat_at = NULL,
                  fehler_zaehler = %s,
                  letzter_fehler = %s,
                  letzter_fehler_at = now(),
                  naechster_lauf = now() + make_interval(mins => %s),
                  enabled = CASE WHEN %s THEN false ELSE enabled END
            WHERE job = %s""",
        (neuer_zaehler, str(fehlertext)[:500], minuten, pausieren, job),
    )
    if ereignis_id is not None:
        db.ausfuehren(
            """UPDATE mkt_job_events
                  SET beendet_at = now(), dauer_ms = %s, ergebnis = 'fehler', fehlertext = %s
                WHERE id = %s""",
            (dauer_ms, str(fehlertext)[:2000], ereignis_id),
        )
    if pausieren:
        db.audit(
            "job_pausiert",
            job=job,
            begruendung=f"{neuer_zaehler} Fehlversuche in Folge — zuletzt: {str(fehlertext)[:200]}",
        )
        print(f"[state] ⛔ Job '{job}' pausiert nach {neuer_zaehler} Fehlversuchen.")


def faellige(*, kann_lokal: bool) -> list[str]:
    """Welche Jobs waeren jetzt dran? Nur zur Anzeige — belegt nichts."""
    if not db.verfuegbar():
        return []
    zeilen = db.abfragen(
        """SELECT job FROM mkt_jobs
            WHERE enabled AND naechster_lauf <= now()
              AND (NOT requires_local OR %s)
            ORDER BY naechster_lauf""",
        (kann_lokal,),
    )
    return [z["job"] for z in zeilen]


def status() -> list[dict[str, Any]]:
    """Vollstaendiger Zustand fuer das Admin-Dashboard."""
    if not db.verfuegbar():
        return []
    return db.abfragen(
        """SELECT job, abstand_sek, letzter_lauf, naechster_lauf, laeufe,
                  fehler_zaehler, letzter_fehler, letzter_fehler_at,
                  requires_local, enabled, laeuft_seit, heartbeat_at, runner_id,
                  GREATEST(0, EXTRACT(EPOCH FROM (naechster_lauf - now()))::int) AS in_sekunden
             FROM mkt_jobs
            ORDER BY job"""
    )


def setze_enabled(job: str, an: bool) -> bool:
    """Notaus-Schalter des Dashboards. Startet nichts, stoppt nichts —
    setzt nur das Flag, das der naechste Takt liest."""
    if not db.verfuegbar():
        return False
    betroffen = db.ausfuehren(
        "UPDATE mkt_jobs SET enabled = %s, fehler_zaehler = 0 WHERE job = %s", (an, job)
    )
    db.audit(
        "job_geschaltet",
        job=job,
        begruendung="Schalter im Admin-Dashboard",
        nachher={"enabled": an},
    )
    return betroffen > 0
