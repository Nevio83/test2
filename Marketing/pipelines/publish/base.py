"""Veroeffentlichung — mit Doppelpost-Schutz.

DIE WICHTIGSTE EIGENSCHAFT: EIN BEITRAG GEHT NIE ZWEIMAL RAUS

Der Automat laeuft alle 15 Minuten, an drei Orten, und jeder Lauf kann
abbrechen. Ohne Schutz waere die Frage nicht OB, sondern WANN derselbe
Beitrag zweimal erscheint — und doppelte Beitraege sind auf jeder Plattform
ein Grund fuer Reichweitendrosselung.

Der Schutz ist ein Fingerabdruck aus (Video, Plattform, geplanter Zeitpunkt)
mit einem eindeutigen Index in der Datenbank. Zwei Versuche, denselben
Beitrag anzulegen, koennen also gar nicht beide gelingen — das entscheidet
die Datenbank, nicht das Programm.

WARUM NICHT "ERST PRUEFEN, DANN EINFUEGEN"
Zwischen Pruefen und Einfuegen passt ein zweiter Lauf. Genau dieselbe
Ueberlegung wie beim Uebernehmen der Auftraege (state.py): Die Entscheidung
muss in EINER Anweisung fallen.

TROCKENLAUF
Standardmaessig verlaesst NICHTS das System. Der Beitrag wird vollstaendig
geplant und mit Status 'dry_run' abgelegt — man kann also genau sehen, was
rausgegangen waere. Auf echtes Posten stellt nur ein Mensch.
"""

from __future__ import annotations

import hashlib
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from .. import db, products
from ..creative import compliance
from ..orchestrator import guardrails
from . import slots


class Veroeffentlichungsfehler(RuntimeError):
    pass


@dataclass(frozen=True)
class Beitrag:
    """Ein fertig geplanter Beitrag."""

    post_id: int
    video_id: int
    video_pfad: Path
    plattform: str
    caption: str
    hashtags: list[str]
    geplant_fuer: datetime
    slot: str
    produkt_id: int
    stil: str


def idempotenz_schluessel(video_id: int, plattform: str, geplant_fuer: datetime) -> str:
    """Fingerabdruck aus Video, Plattform und Sendeplatz.

    Auf die Minute genau, nicht auf die Sekunde: Zwei Laeufe berechnen
    denselben Sendeplatz sonst minimal verschieden und erzeugten zwei
    verschiedene Fingerabdruecke — der Schutz waere wirkungslos.
    """
    roh = f"{video_id}|{plattform}|{geplant_fuer.strftime('%Y-%m-%dT%H:%M')}"
    return hashlib.sha256(roh.encode()).hexdigest()[:40]


# ── Plattform-Schnittstelle ──────────────────────────────────────────

class Plattform(ABC):
    name: str = "unbekannt"

    @abstractmethod
    def bereit(self) -> tuple[bool, str | None]:
        """(True, None) wenn gepostet werden kann — sonst der Grund."""

    @abstractmethod
    def poste(self, beitrag: Beitrag) -> str:
        """Beitrag absetzen, gibt die externe Beitragsnummer zurueck.

        Muss BIS ZUR BESTAETIGUNG durchlaufen. Ein Weg, der auf einen
        Menschen wartet, ist keine Veroeffentlichung — genau daran ist der
        alte Stand gescheitert.
        """


def alle_plattformen() -> list[Plattform]:
    from .instagram import Instagram
    from .tiktok import TikTok
    from .youtube import YouTube

    return [TikTok(), Instagram(), YouTube()]


def aktive_plattformen() -> list[Plattform]:
    """Nur die in der Konfiguration freigeschalteten."""
    erlaubt = {str(p).lower() for p in
               (guardrails.wert("veroeffentlichung.plattformen", ["tiktok"]) or [])}
    return [p for p in alle_plattformen() if p.name in erlaubt]


# ── Planen ───────────────────────────────────────────────────────────

def fertige_videos(limit: int = 5) -> list[dict[str, Any]]:
    """Geprüfte Videos, fuer die es auf einer Plattform noch keinen Beitrag gibt."""
    if not db.verfuegbar():
        return []
    return db.abfragen(
        """SELECT v.id AS video_id, v.pfad, v.stil, v.brief_id,
                  b.hashtags, b.hook_varianten, b.cta,
                  b.compliance_status, m.produkt_id
             FROM mkt_videos v
             JOIN mkt_briefs b ON b.id = v.brief_id
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE v.pruefergebnis = 'ok'
              AND b.compliance_status = 'ok'
            ORDER BY v.erstellt_am DESC
            LIMIT %s""",
        (limit,),
    )


def baue_caption(zeile: dict[str, Any], produkt, kampagne: str) -> tuple[str, list[str]]:
    """Bildunterschrift samt Shop-Link mit Kennung.

    Der Link mit Kennung ist die Bruecke von Reichweite zu Umsatz — ohne ihn
    laesst sich spaeter nicht sagen, welcher Beitrag welche Bestellung
    gebracht hat.
    """
    hooks = zeile.get("hook_varianten") or []
    erster = ""
    if isinstance(hooks, list) and hooks:
        erster = str(hooks[0].get("text", "")) if isinstance(hooks[0], dict) else str(hooks[0])
    cta = str(zeile.get("cta") or "Link im Profil. Werbung.")
    hashtags = zeile.get("hashtags") or []
    if isinstance(hashtags, str):
        try:
            hashtags = json.loads(hashtags)
        except json.JSONDecodeError:
            hashtags = [hashtags]

    quelle = "tiktok"
    link = produkt.url_mit_utm(kampagne, quelle,
                               str(guardrails.wert("veroeffentlichung.utm_medium", "organic")))
    text = f"{erster}\n\n{cta}\n{link}\n\n{' '.join(str(h) for h in hashtags[:5])}"
    return text.strip(), [str(h) for h in hashtags[:5]]


def plane_beitrag(zeile: dict[str, Any], plattform: Plattform) -> Beitrag | None:
    """Einen Beitrag einplanen — idempotent.

    Gibt None zurueck, wenn es ihn schon gibt oder kein Sendeplatz frei ist.
    Beides sind normale Zustaende, keine Fehler.
    """
    if not db.verfuegbar():
        return None
    produkt = products.nach_id(int(zeile["produkt_id"]))
    if produkt is None:
        return None

    zeitpunkt = slots.naechster_slot(plattform.name)
    if zeitpunkt is None:
        print(f"[publish] {plattform.name}: kein freier Sendeplatz in den naechsten Tagen")
        return None

    video_id = int(zeile["video_id"])
    schluessel = idempotenz_schluessel(video_id, plattform.name, zeitpunkt)
    kampagne = f"mkt_{video_id}"
    caption, hashtags = baue_caption(zeile, produkt, kampagne)

    trocken = guardrails.trockenlauf()
    status = "dry_run" if trocken else "geplant"

    # EINE Anweisung: einfuegen, und bei JEDER Kollision nichts tun. Die
    # Datenbank entscheidet, nicht eine vorherige Abfrage — zwischen Pruefen
    # und Einfuegen passt ein zweiter Lauf.
    #
    # "ON CONFLICT DO NOTHING" ohne Zielangabe ist hier Absicht: Es greifen
    # ZWEI eindeutige Regeln, und beide sollen schuetzen.
    #   1. der Fingerabdruck (Video, Plattform, Sendeplatz)
    #   2. "ein lebender Beitrag je Video und Plattform"
    #
    # Die zweite ist die entscheidende. Der Fingerabdruck allein reicht
    # nicht: Er enthaelt den Sendeplatz, und der verschiebt sich bei jedem
    # Lauf, weil der vorige Lauf den frueheren Platz belegt hat. Gemessen:
    # nach zwei Durchgaengen standen 6 statt 3 Beitraege in der Tabelle,
    # jeder mit einem eigenen, gueltigen Fingerabdruck.
    neu = db.eine_zeile(
        """INSERT INTO mkt_posts
             (video_id, plattform, caption, hashtags, geplant_fuer, slot,
              status, idempotenz_schluessel)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT DO NOTHING
           RETURNING id""",
        (video_id, plattform.name, caption, json.dumps(hashtags, ensure_ascii=False),
         zeitpunkt, slots.slot_name(zeitpunkt), status, schluessel),
    )
    if neu is None:
        return None   # gab es schon — genau das soll der Schutz leisten

    return Beitrag(
        post_id=int(neu["id"]), video_id=video_id, video_pfad=Path(str(zeile["pfad"])),
        plattform=plattform.name, caption=caption, hashtags=hashtags,
        geplant_fuer=zeitpunkt, slot=slots.slot_name(zeitpunkt),
        produkt_id=int(zeile["produkt_id"]), stil=str(zeile["stil"]),
    )


# ── Absenden ─────────────────────────────────────────────────────────

def faellige_beitraege(plattform: str, limit: int = 3) -> list[dict[str, Any]]:
    if not db.verfuegbar():
        return []
    return db.abfragen(
        """SELECT p.id, p.video_id, p.caption, p.hashtags, p.geplant_fuer, p.slot,
                  v.pfad, v.stil, m.produkt_id
             FROM mkt_posts p
             JOIN mkt_videos v ON v.id = p.video_id
             JOIN mkt_briefs b ON b.id = v.brief_id
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE p.plattform = %s
              AND p.status = 'geplant'
              AND p.geplant_fuer <= now()
            ORDER BY p.geplant_fuer
            LIMIT %s""",
        (plattform, limit),
    )


def sende(beitrag: Beitrag, plattform: Plattform) -> bool:
    """Einen Beitrag wirklich absetzen. Prueft vorher NOCH EINMAL.

    Die zweite Pruefung ist kein Ueberfluss: Zwischen Planen und Senden
    liegen Stunden, in denen sich der Preis geaendert haben oder das Produkt
    ausverkauft sein kann. Ein Beitrag mit dem Preis von gestern ist eine
    falsche Preisangabe.
    """
    produkt = products.nach_id(beitrag.produkt_id)
    befund = compliance.pruefe(
        {"skript": beitrag.caption, "caption": beitrag.caption,
         "hashtags": beitrag.hashtags, "cta": ""},
        produkt=produkt, stil=beitrag.stil, plattform=plattform.name, phase="vor_post",
    )
    if befund.blockiert:
        db.ausfuehren(
            "UPDATE mkt_posts SET status = 'fehler', fehlertext = %s WHERE id = %s",
            (f"Compliance vor dem Posten: {befund.als_text()[:400]}", beitrag.post_id),
        )
        print(f"[publish] ⛔ {plattform.name}: {befund.als_text()[:120]}")
        return False

    if guardrails.trockenlauf():
        db.ausfuehren("UPDATE mkt_posts SET status = 'dry_run' WHERE id = %s", (beitrag.post_id,))
        print(f"[publish] 🧪 Trockenlauf — NICHT gepostet: {plattform.name}, {beitrag.slot}")
        return False

    externe_id = plattform.poste(beitrag)
    db.ausfuehren(
        """UPDATE mkt_posts
              SET status = 'gepostet', gepostet_am = now(), externe_post_id = %s
            WHERE id = %s""",
        (externe_id, beitrag.post_id),
    )
    db.audit("beitrag_veroeffentlicht", job="publish_due",
             begruendung=f"{plattform.name} · {beitrag.slot} · {externe_id}")
    return True


# ── Job-Einstieg ─────────────────────────────────────────────────────

def job_faellige_veroeffentlichen() -> dict[str, Any]:
    """Fertige Videos einplanen und faellige Beitraege absetzen."""
    if not db.verfuegbar():
        return {"grund": db.grund_fuer_fehlende_db()}

    plattformen = aktive_plattformen()
    if not plattformen:
        return {"grund": "keine Plattform in der Konfiguration freigeschaltet"}

    bericht: dict[str, Any] = {
        "trockenlauf": guardrails.trockenlauf(),
        "geplant": 0, "gepostet": 0, "uebersprungen": {},
    }

    for plattform in plattformen:
        bereit, grund = plattform.bereit()

        # Einplanen geht IMMER — auch ohne Zugangsdaten. So ist im Dashboard
        # sichtbar, was rausgehen wuerde, sobald die Zugaenge da sind.
        for zeile in fertige_videos(limit=3):
            if plane_beitrag(zeile, plattform):
                bericht["geplant"] += 1

        if not bereit:
            bericht["uebersprungen"][plattform.name] = grund
            print(f"[publish] {plattform.name}: nicht gepostet — {grund}")
            continue

        for zeile in faellige_beitraege(plattform.name):
            produkt_id = int(zeile["produkt_id"])
            hashtags = zeile["hashtags"] or []
            beitrag = Beitrag(
                post_id=int(zeile["id"]), video_id=int(zeile["video_id"]),
                video_pfad=Path(str(zeile["pfad"])), plattform=plattform.name,
                caption=str(zeile["caption"] or ""),
                hashtags=[str(h) for h in hashtags] if isinstance(hashtags, list) else [],
                geplant_fuer=zeile["geplant_fuer"], slot=str(zeile["slot"] or ""),
                produkt_id=produkt_id, stil=str(zeile["stil"]),
            )
            try:
                if sende(beitrag, plattform):
                    bericht["gepostet"] += 1
            except Exception as fehler:
                db.ausfuehren(
                    "UPDATE mkt_posts SET status = 'fehler', fehlertext = %s WHERE id = %s",
                    (str(fehler)[:500], beitrag.post_id),
                )
                print(f"[publish] ❌ {plattform.name}: {fehler}")

    print(f"[publish] {bericht['geplant']} eingeplant, {bericht['gepostet']} gepostet"
          + (" (Trockenlauf)" if bericht["trockenlauf"] else ""))
    return bericht
