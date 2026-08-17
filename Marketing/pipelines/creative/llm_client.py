"""Sprachmodell-Adapter mit Kostenzaehler und Budget-Sperre.

DREI EIGENSCHAFTEN, DIE HIER ZAEHLEN

1. EINHEITLICH — Anthropic, OpenAI oder gar keins: der Aufrufer merkt keinen
   Unterschied. Ohne SDK, nur ueber requests; ein Paket weniger.

2. JEDER AUFRUF WIRD GEBUCHT — in mkt_cost_ledger, mit echten Token-Zahlen aus
   der Antwort. Ohne diese Buchung ist der Budgetwaechter blind, und ein
   System, das ohne Aufsicht laeuft, kann dann beliebig teuer werden.

3. LEER LAUFEN STATT STEHEN BLEIBEN — ist das Budget erschoepft oder fehlt der
   Schluessel, liefert der Adapter None. Der Aufrufer baut dann ein Briefing
   aus Vorlagen. Das ist schlechter als ein Sprachmodell, aber unendlich viel
   besser als nichts.

ZU DEN PREISEN
Die Cent-pro-Million-Token stehen in marketing.config.json unter llm.preise.
Sie sind Schaetzwerte und muessen gegen die Preisliste des Anbieters geprueft
werden. Der Adapter rechnet damit ehrlich: Token werden aus der ANTWORT
gelesen, nicht geschaetzt. Stimmt der Preis nicht, stimmt der Eurobetrag —
die Token-Zahl stimmt trotzdem.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from ..orchestrator import guardrails


@dataclass(frozen=True)
class Antwort:
    text: str
    anbieter: str
    modell: str
    token_ein: int
    token_aus: int
    kosten_cent: int


def _anbieter_und_schluessel() -> tuple[str | None, str | None]:
    """Welcher Anbieter ist konfiguriert? Anthropic hat Vorrang."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic", os.environ["ANTHROPIC_API_KEY"]
    if os.environ.get("OPENAI_API_KEY"):
        return "openai", os.environ["OPENAI_API_KEY"]
    return None, None


def verfuegbar() -> tuple[bool, str | None]:
    """(True, None) wenn ein Sprachmodell nutzbar ist — sonst der Grund."""
    try:
        import requests  # noqa: F401
    except ImportError:
        return False, "requests ist nicht installiert"
    anbieter, _ = _anbieter_und_schluessel()
    if anbieter is None:
        return False, "weder ANTHROPIC_API_KEY noch OPENAI_API_KEY gesetzt"
    darf, grund = guardrails.darf_kosten_verursachen()
    if not darf:
        return False, grund
    return True, None


def _kosten_cent(anbieter: str, token_ein: int, token_aus: int) -> int:
    preise = guardrails.wert(f"llm.preise.{anbieter}", {}) or {}
    ein = float(preise.get("cent_pro_mio_ein", 0))
    aus = float(preise.get("cent_pro_mio_aus", 0))
    return int(round(token_ein / 1_000_000 * ein + token_aus / 1_000_000 * aus))


def frage(
    system: str,
    aufgabe: str,
    *,
    job: str | None = None,
    max_token: int = 1500,
) -> Antwort | None:
    """Ein Sprachmodell befragen. None = nicht moeglich, nimm Vorlagen.

    Wirft NICHT bei fehlendem Schluessel oder erschoepftem Budget — das sind
    normale Betriebszustaende, keine Fehler.
    """
    nutzbar, grund = verfuegbar()
    if not nutzbar:
        print(f"[llm] kein Sprachmodell — {grund}")
        return None

    if not guardrails.ratenbegrenzer.warte_bis_erlaubt("llm", max_sek=30):
        print("[llm] Ratenbegrenzung: Kontingent erschoepft")
        return None

    anbieter, schluessel = _anbieter_und_schluessel()
    try:
        if anbieter == "anthropic":
            antwort = _anthropic(schluessel, system, aufgabe, max_token)
        else:
            antwort = _openai(schluessel, system, aufgabe, max_token)
    except Exception as fehler:
        # Ein Ausfall des Anbieters darf den Lauf nicht beenden — es gibt
        # einen kostenlosen Weg.
        print(f"[llm] {anbieter} nicht erreichbar: {fehler}")
        return None

    guardrails.buche_kosten(
        anbieter, antwort.kosten_cent,
        endpunkt=antwort.modell,
        einheiten=antwort.token_ein + antwort.token_aus,
        job=job,
    )
    return antwort


def _anthropic(schluessel: str, system: str, aufgabe: str, max_token: int) -> Antwort:
    import requests

    modell = str(guardrails.wert("llm.modell_anthropic", "claude-sonnet-5"))
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": schluessel,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": modell,
            "max_tokens": max_token,
            "system": system,
            "messages": [{"role": "user", "content": aufgabe}],
        },
        timeout=90,
    )
    r.raise_for_status()
    daten = r.json()
    text = "".join(t.get("text", "") for t in daten.get("content", []) if t.get("type") == "text")
    nutzung = daten.get("usage", {})
    ein = int(nutzung.get("input_tokens", 0))
    aus = int(nutzung.get("output_tokens", 0))
    return Antwort(text, "anthropic", modell, ein, aus, _kosten_cent("anthropic", ein, aus))


def _openai(schluessel: str, system: str, aufgabe: str, max_token: int) -> Antwort:
    import requests

    modell = str(guardrails.wert("llm.modell_openai", "gpt-4o-mini"))
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {schluessel}", "Content-Type": "application/json"},
        json={
            "model": modell,
            "max_tokens": max_token,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": aufgabe},
            ],
        },
        timeout=90,
    )
    r.raise_for_status()
    daten = r.json()
    text = daten["choices"][0]["message"]["content"]
    nutzung = daten.get("usage", {})
    ein = int(nutzung.get("prompt_tokens", 0))
    aus = int(nutzung.get("completion_tokens", 0))
    return Antwort(text, "openai", modell, ein, aus, _kosten_cent("openai", ein, aus))


def frage_json(system: str, aufgabe: str, *, job: str | None = None,
               max_token: int = 1500) -> dict[str, Any] | None:
    """Wie frage(), erwartet aber ein JSON-Objekt zurueck.

    Sprachmodelle verpacken JSON gern in Code-Zaeune oder schreiben einen Satz
    davor. Beides wird hier abgeraeumt. Laesst sich trotzdem nichts lesen,
    gibt es None — der Aufrufer nimmt dann Vorlagen, statt auf gut Glueck
    weiterzumachen.
    """
    antwort = frage(system, aufgabe, job=job, max_token=max_token)
    if antwort is None:
        return None
    roh = antwort.text.strip()
    if "```" in roh:
        teile = roh.split("```")
        for teil in teile:
            teil = teil.removeprefix("json").strip()
            if teil.startswith("{"):
                roh = teil
                break
    anfang, ende = roh.find("{"), roh.rfind("}")
    if anfang == -1 or ende <= anfang:
        print("[llm] Antwort enthielt kein JSON-Objekt")
        return None
    try:
        return json.loads(roh[anfang:ende + 1])
    except json.JSONDecodeError as fehler:
        print(f"[llm] Antwort war kein gueltiges JSON: {fehler}")
        return None
