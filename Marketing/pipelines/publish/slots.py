"""Posting-Zeiten: feste Startwerte, spaeter gelernt.

WARUM DAS EINE EIGENE DATEI IST

Die Uhrzeit ist eine der wenigen Stellschrauben, die nichts kostet und viel
bringt. Dasselbe Video um 07:30 oder um 20:30 erreicht voellig
unterschiedlich viele Menschen. Deshalb ist der Slot eine gelernte Groesse
wie Hook-Typ oder Laenge — und keine Einstellung, die einmal jemand geraten
hat.

BIS DAS LERNEN LAEUFT
Die Startverteilung steht in marketing.config.json. Sobald genug Daten da
sind, verschiebt das Lernmodul sie (Etappe 10). Bis dahin wird gleichmaessig
gestreut, damit ueberhaupt Vergleichsdaten entstehen: Wer nur um 20:30
postet, erfaehrt nie, ob 12:30 besser gewesen waere.

ZWEI HARTE GRENZEN
  * Mindestabstand zwischen zwei Beitraegen derselben Plattform (Vorgabe 3 h)
  * Hoechstzahl je Tag und Plattform (Vorgabe 3)

Beide sind keine Feinheit: Zwei Videos kurz hintereinander konkurrieren um
dieselbe Zielgruppe, und die Plattformen drosseln Konten, die stossweise
posten.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .. import db
from ..orchestrator import guardrails


def _zeitzone() -> timezone:
    """Zeitzone aus der Konfiguration.

    Bewusst als fester Versatz statt ueber eine Zeitzonen-Bibliothek: Es geht
    um Postingzeiten am selben Tag, nicht um historische Zeitrechnung. Der
    Sommerzeit-Versatz wird ueber die Konfiguration gepflegt.
    """
    stunden = int(guardrails.wert("veroeffentlichung.zeitversatz_stunden", 2))
    return timezone(timedelta(hours=stunden))


def slot_liste() -> list[str]:
    """Erlaubte Uhrzeiten, z.B. ['07:30', '12:30', '17:30', '20:30']."""
    roh = guardrails.wert("veroeffentlichung.slots", []) or []
    gueltig = []
    for eintrag in roh:
        try:
            stunde, minute = str(eintrag).split(":")
            if 0 <= int(stunde) < 24 and 0 <= int(minute) < 60:
                gueltig.append(f"{int(stunde):02d}:{int(minute):02d}")
        except (ValueError, AttributeError):
            print(f"[slots] unbrauchbare Uhrzeit uebersprungen: {eintrag!r}")
    return gueltig or ["12:30"]


def _als_zeitpunkt(tag: datetime, slot: str) -> datetime:
    stunde, minute = (int(t) for t in slot.split(":"))
    return tag.replace(hour=stunde, minute=minute, second=0, microsecond=0)


def belegte_slots(plattform: str, *, tage: int = 3) -> list[datetime]:
    """Schon geplante oder gepostete Zeitpunkte — inklusive Trockenlauf.

    Der Trockenlauf zaehlt bewusst mit: Sonst waeren nach dem Umschalten auf
    echtes Posten auf einen Schlag zwanzig Beitraege faellig.
    """
    if not db.verfuegbar():
        return []
    zeilen = db.abfragen(
        """SELECT geplant_fuer FROM mkt_posts
            WHERE plattform = %s
              AND status <> 'fehler'
              AND geplant_fuer > now() - make_interval(days => %s)
            ORDER BY geplant_fuer""",
        (plattform, tage),
    )
    return [z["geplant_fuer"] for z in zeilen]


def naechster_slot(plattform: str, *, ab: datetime | None = None) -> datetime | None:
    """Der naechste freie Sendeplatz — oder None, wenn keiner passt.

    None ist ein gueltiges Ergebnis: Sind die Tagesgrenzen erreicht, wird
    nichts eingeplant. Ein Video wartet dann bis morgen, statt die Grenze zu
    reissen.
    """
    zone = _zeitzone()
    jetzt = (ab or datetime.now(zone)).astimezone(zone)
    max_pro_tag = int(guardrails.wert("veroeffentlichung.max_posts_pro_tag", 3))
    min_abstand = timedelta(hours=float(guardrails.wert("veroeffentlichung.min_abstand_stunden", 3)))

    belegt = [z.astimezone(zone) for z in belegte_slots(plattform)]

    for tag_versatz in range(0, 4):
        tag = jetzt + timedelta(days=tag_versatz)
        am_tag = [z for z in belegt if z.date() == tag.date()]
        if len(am_tag) >= max_pro_tag:
            continue
        for slot in slot_liste():
            kandidat = _als_zeitpunkt(tag, slot)
            if kandidat <= jetzt:
                continue
            if any(abs((kandidat - z).total_seconds()) < min_abstand.total_seconds()
                   for z in belegt):
                continue
            return kandidat
    return None


def slot_name(zeitpunkt: datetime) -> str:
    """Bezeichnung fuer das Lernen: Wochentag x Uhrzeit.

    Nicht der reine Zeitpunkt — der kommt nie wieder vor und waere zum Lernen
    wertlos. "Di 12:30" dagegen wiederholt sich jede Woche.
    """
    zone = _zeitzone()
    lokal = zeitpunkt.astimezone(zone)
    tage = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    return f"{tage[lokal.weekday()]} {lokal.strftime('%H:%M')}"


def plan_uebersicht(plattform: str) -> list[dict[str, Any]]:
    """Was ist wann geplant — fuer das Dashboard."""
    if not db.verfuegbar():
        return []
    return db.abfragen(
        """SELECT p.id, p.geplant_fuer, p.slot, p.status, v.pfad, v.stil
             FROM mkt_posts p
             JOIN mkt_videos v ON v.id = p.video_id
            WHERE p.plattform = %s AND p.status IN ('geplant', 'dry_run')
            ORDER BY p.geplant_fuer
            LIMIT 20""",
        (plattform,),
    )
