"""Rechtliche Pruefung. Sperrt — sie warnt nicht nur.

ZWEIMAL, NICHT EINMAL
Geprueft wird VOR dem Rendern und noch einmal VOR dem Posten. Der zweite Lauf
ist kein Ueberfluss: Zwischen beiden liegen Minuten bis Stunden, in denen sich
der Preis geaendert haben oder ein Produkt ausverkauft sein kann. Ein Video
mit dem Preis von gestern ist eine falsche Preisangabe.

WARUM SPERREN UND NICHT WARNEN
Eine Warnung in einem Protokoll, das niemand liest, ist keine Kontrolle. Das
System laeuft ohne Aufsicht — was hier durchkommt, geht raus. Deshalb ist das
Ergebnis binaer: 'ok' oder 'blocked'. Bei 'blocked' wird weder gerendert noch
gepostet.

LIEBER ZU STRENG
Ein faelschlich blockiertes Video kostet Rechenzeit. Ein durchgerutschtes
kostet eine Abmahnung. Deshalb faellt jede Unsicherheit zu Ungunsten der
Veroeffentlichung aus.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from .. import db, products
from ..env_loader import MARKETING_DIR
from ..products import Produkt

REGELN_DATEI = MARKETING_DIR / "config" / "compliance_rules.json"


@dataclass
class Befund:
    """Ergebnis einer Pruefung."""

    status: str                       # 'ok' | 'blocked'
    gruende: list[str] = field(default_factory=list)
    hinweise: list[str] = field(default_factory=list)

    @property
    def blockiert(self) -> bool:
        return self.status == "blocked"

    def als_text(self) -> str:
        return " | ".join(self.gruende) if self.gruende else "ohne Befund"


@lru_cache(maxsize=1)
def regeln() -> dict[str, Any]:
    try:
        return json.loads(REGELN_DATEI.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as fehler:
        # Ohne Regeln wird NICHTS freigegeben. Eine kaputte Regeldatei darf
        # nicht dazu fuehren, dass alles durchgeht.
        raise RuntimeError(f"compliance_rules.json nicht lesbar: {fehler}") from None


def _text_von(brief: dict[str, Any]) -> str:
    """Alle Textbestandteile eines Briefings in einer Zeichenkette."""
    teile: list[str] = []
    for feld in ("skript", "cta", "caption"):
        wert = brief.get(feld)
        if isinstance(wert, str):
            teile.append(wert)
    for feld in ("hook_varianten", "overlays", "hashtags"):
        wert = brief.get(feld)
        if isinstance(wert, list):
            teile.extend(str(w) for w in wert)
    return "\n".join(teile).lower()


# ── Einzelpruefungen ─────────────────────────────────────────────────

def _heilversprechen(text: str) -> list[str]:
    r = regeln().get("verbotene_aussagen", {})
    return [f"Heilversprechen: '{w}'" for w in r.get("heilversprechen", []) if w.lower() in text]


def _irrefuehrend(text: str) -> list[str]:
    r = regeln().get("verbotene_aussagen", {})
    return [f"irrefuehrende Aussage: '{w}'" for w in r.get("irrefuehrend", []) if w.lower() in text]


def _fremde_marken(text: str) -> list[str]:
    r = regeln().get("fremde_rechte", {})
    gefunden = []
    for marke in r.get("marken", []):
        # Wortgrenze, damit "ikea" nicht in "likeable" anschlaegt.
        if re.search(rf"\b{re.escape(marke.lower())}\b", text):
            gefunden.append(f"fremde Marke: '{marke}'")
    return gefunden


def _gesperrtes_thema(text: str) -> list[str]:
    begriffe = regeln().get("gesperrte_themen", {}).get("begriffe", [])
    return [f"gesperrtes Thema: '{b}'" for b in begriffe if b.lower() in text]


def _preisangaben(text: str, produkt: Produkt | None) -> tuple[list[str], list[str]]:
    """Preise duerfen genannt werden — aber nur korrekt.

    Zwei Fallen:
      1. Ein Preis, den es nicht gibt. Genau das waere mit der alten
         Marketing-Produktliste passiert (11 von 17 Preisen falsch, einer um
         17 Euro zu niedrig).
      2. Ein Umsatzsteuer-Hinweis. Dieser Shop ist Kleinunternehmer nach
         Paragraph 19 UStG und weist KEINE Umsatzsteuer aus — "inkl. 19 %"
         waere schlicht falsch.
    """
    r = regeln().get("preisangaben", {})
    gruende: list[str] = []
    hinweise: list[str] = []

    for zusatz in r.get("verbotene_zusaetze", []):
        if zusatz.lower() in text:
            gruende.append(f"Umsatzsteuer-Hinweis trotz Paragraph 19 UStG: '{zusatz}'")

    genannte = re.findall(r"(\d{1,4})[,.](\d{2})\s*(?:€|eur|euro)", text)
    if not genannte:
        return gruende, hinweise

    if produkt is None:
        gruende.append("Preis genannt, aber kein Produkt zugeordnet — nicht pruefbar")
        return gruende, hinweise

    erlaubt = {round(float(produkt.preis), 2)}
    for betrag in genannte:
        wert = round(float(f"{betrag[0]}.{betrag[1]}"), 2)
        if wert not in erlaubt:
            gruende.append(
                f"Preis {wert:.2f} EUR stimmt nicht mit products.json ueberein "
                f"({produkt.preis:.2f} EUR fuer '{produkt.name}')"
            )

    if not gruende and "versand" not in text:
        hinweise.append("Preis genannt, aber kein Versandhinweis im Text")
    return gruende, hinweise


def _pflichtangaben(text: str, plattform: str | None) -> list[str]:
    r = regeln().get("pflichtangaben", {})
    noetig = list(r.get("alle", []))
    if plattform:
        noetig += list(r.get(plattform, []))
    return [f"Pflichtangabe fehlt: '{p}'" for p in set(noetig) if p.lower() not in text]


def _ki_kennzeichnung(text: str, stil: str) -> list[str]:
    if stil != "B":
        return []
    kennung = str(regeln().get("pflichtangaben", {}).get("ki_kennzeichnung", "")).lower()
    stichwort = "ki-generiert" if not kennung else kennung.split()[0]
    if "ki-generiert" in text or "ki generiert" in text or (kennung and kennung in text):
        return []
    return [f"Stil B ohne KI-Kennzeichnung (erwartet: '{stichwort}')"]


def _verfuegbarkeit(produkt: Produkt | None) -> list[str]:
    """Ein ausverkauftes Produkt darf nicht beworben werden."""
    if produkt is None:
        return []
    bestand = products.bestand_aus_db()
    if bestand.get(produkt.id) is False:
        return [f"'{produkt.name}' ist laut Lieferantenbestand ausverkauft"]
    if bestand.get(produkt.id) is None and not produkt.auf_lager:
        return [f"'{produkt.name}' ist laut Produktliste nicht auf Lager"]
    return []


# ── Gesamtpruefung ───────────────────────────────────────────────────

def pruefe(
    brief: dict[str, Any],
    *,
    produkt: Produkt | None = None,
    stil: str = "A",
    plattform: str | None = None,
    phase: str = "vor_render",
) -> Befund:
    """Vollstaendige Pruefung eines Briefings.

    phase ist nur fuer das Protokoll — geprueft wird beide Male dasselbe,
    weil sich die Welt zwischen den Phasen aendern kann (Preis, Bestand).
    """
    text = _text_von(brief)
    gruende: list[str] = []
    hinweise: list[str] = []

    gruende += _heilversprechen(text)
    gruende += _irrefuehrend(text)
    gruende += _fremde_marken(text)
    gruende += _gesperrtes_thema(text)
    gruende += _pflichtangaben(text, plattform)
    gruende += _ki_kennzeichnung(text, stil)
    gruende += _verfuegbarkeit(produkt)

    preis_gruende, preis_hinweise = _preisangaben(text, produkt)
    gruende += preis_gruende
    hinweise += preis_hinweise

    befund = Befund(status="blocked" if gruende else "ok", gruende=gruende, hinweise=hinweise)

    if befund.blockiert:
        db.audit(
            "briefing_blockiert",
            job="match_and_brief",
            begruendung=f"[{phase}] " + befund.als_text()[:400],
            alternativen={"produkt": produkt.name if produkt else None, "stil": stil},
        )
    return befund


def setze_status(brief_id: int, befund: Befund) -> None:
    """Ergebnis am Briefing festhalten — daran haengt das Rendern."""
    if not db.verfuegbar():
        return
    db.ausfuehren(
        "UPDATE mkt_briefs SET compliance_status = %s, compliance_grund = %s WHERE id = %s",
        (befund.status, befund.als_text()[:1000], brief_id),
    )
