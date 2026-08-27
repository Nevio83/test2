"""Trends vereinheitlichen, zusammenfuehren und bewerten.

WAS HIER PASSIERT UND WARUM

Die Quellen liefern voellig unterschiedliche Masse: Reddit zaehlt Punkte je
Stunde, YouTube Aufrufe je Stunde, der Shop einzelne Suchanfragen. Diese
Zahlen sind NICHT vergleichbar — 300 Reddit-Punkte und 300 Shop-Suchen haben
nichts miteinander zu tun.

Deshalb wird je Quelle auf einen Rang zwischen 0 und 1 umgerechnet. Was
zaehlt, ist die Position innerhalb der eigenen Quelle ("das ist der drittbeste
Trend bei Reddit gerade"), nicht die rohe Zahl.

WAS BEWUSST NICHT BERECHNET WIRD

Saisonalitaet. Dafuer braeuchte es dieselbe Zeit im Vorjahr, und diese
Datenbank ist ein paar Wochen alt. Statt eine plausibel aussehende Zahl zu
erfinden, bleibt der Bestandteil None und geht mit 0 in den Score ein — im
gespeicherten Score-Bestandteil steht dann ausdruecklich "keine Daten".
Sobald ein Jahr Historie da ist, rechnet dieselbe Funktion echte Werte.
"""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from typing import Any, Iterable

from .. import db, products
from ..env_loader import MARKETING_DIR
from ..orchestrator import guardrails
from .base import TrendZeile

REGELN_DATEI = MARKETING_DIR / "config" / "compliance_rules.json"

# Wie stark ein Shop-Signal zaehlt. Eine Suche ohne Treffer ist Nachfrage
# ohne Angebot — das kommt einer verpassten Bestellung am naechsten.
SHOP_GEWICHTE = {
    "null_treffer": 1.00,
    "verkauf": 0.80,
    "warenkorbabbruch": 0.60,
    "suche": 0.50,
    "seitenaufruf": 0.30,
}

# Sehr haeufige deutsche Woerter — reichen, um Deutsch von Englisch zu
# unterscheiden. Bewusst eine Heuristik und kein Sprachmodell: es geht nur
# darum, deutsche Trends zu bevorzugen, nicht um eine exakte Einordnung.
DEUTSCHE_MARKER = {
    "der", "die", "das", "und", "ist", "nicht", "mit", "für", "fuer", "auf",
    "ich", "du", "wie", "was", "warum", "beste", "besten", "günstig",
    "guenstig", "kaufen", "test", "selber", "machen", "ohne",
}
ENGLISCHE_MARKER = {
    "the", "and", "is", "not", "with", "for", "you", "how", "what", "why",
    "best", "cheap", "buy", "review", "diy", "make", "without", "your",
}


@lru_cache(maxsize=1)
def _regeln() -> dict[str, Any]:
    try:
        return json.loads(REGELN_DATEI.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as fehler:
        # Ohne Regeln lieber gar nichts durchlassen als alles.
        raise RuntimeError(f"compliance_rules.json nicht lesbar: {fehler}") from None


@lru_cache(maxsize=1)
def gesperrte_begriffe() -> frozenset[str]:
    return frozenset(
        b.lower() for b in _regeln().get("gesperrte_themen", {}).get("begriffe", [])
    )


# ── Normalisieren ────────────────────────────────────────────────────

def normalisiere(keyword: str) -> str:
    """Vereinheitlicht ein Stichwort — OHNE Wortkuerzung.

    Kleinschreibung, Satzzeichen raus, Mehrfach-Leerzeichen weg. Sonst nichts.

    WARUM HIER NICHT GEKUERZT WIRD
    Der erste Entwurf hat hier gleich mit gekuerzt, und genau das hat ein
    Sicherheitsloch aufgerissen: "bitcoin" wurde zu "bitcoi" — und damit griff
    der Sperrlisten-Eintrag "bitcoin" nicht mehr. Ein gesperrtes Thema waere
    durchgerutscht, ohne dass es auffaellt.

    Seitdem sind es zwei Funktionen: normalisiere() fuer alles, was auf den
    ECHTEN Wortlaut schaut (Sperrliste, Anzeige), und stamm() nur zum
    Zusammenfuehren von Dubletten.
    """
    text = unicodedata.normalize("NFKC", (keyword or "")).lower().strip()
    text = text.replace("ß", "ss")
    text = re.sub(r"[#@]", "", text)
    text = re.sub(r"[^\wäöü\s-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# Laengste Endung zuerst, damit "ungen" vor "en" greift.
_ENDUNGEN = ("ungen", "erin", "chen", "lein", "nen", "en", "er", "es", "e", "s", "n")
_MIN_STAMM = 4
_RUNDEN = 2


def stamm(keyword: str) -> str:
    """Kuerzt Beugungsformen — NUR zum Zusammenfuehren von Dubletten.

    "wasserspender", "wasserspendern" und "lampe"/"lampen" sollen jeweils als
    ein Thema zaehlen. Dafuer wird bis zu zwei Mal gekuerzt: "wasserspendern"
    verliert erst das "n", dann das "er" — sonst landet es nicht auf demselben
    Stamm wie "wasserspender".

    DASS DAS HIER GRUENDLICH KUERZEN DARF, IST KEIN WIDERSPRUCH
    Der erste Entwurf hat an dieser Stelle ein Sicherheitsloch gehabt, weil
    die Sperrliste gegen genau diese gekuerzte Form geprueft hat — "bitcoin"
    wurde zu "bitcoi" und der Sperreintrag griff nicht mehr. Seit
    ist_gesperrt() den unverkuerzten Wortlaut mitprueft, ist die Kuerzung hier
    ungefaehrlich: Sie dient nur noch dem Zusammenfuehren.

    Auf das Ergebnis darf sich trotzdem NICHTS verlassen, was den genauen
    Wortlaut braucht — dafuer gibt es normalisiere().
    """
    woerter = []
    for wort in normalisiere(keyword).split():
        for _ in range(_RUNDEN):
            for endung in _ENDUNGEN:
                if len(wort) - len(endung) >= _MIN_STAMM and wort.endswith(endung):
                    wort = wort[: -len(endung)]
                    break
            else:
                break   # keine Endung mehr gefunden -> fertig
        woerter.append(wort)
    return " ".join(woerter)


def sprache_raten(text: str) -> str | None:
    """Grobe Sprachschaetzung. None, wenn es nicht entscheidbar ist.

    None ist ein gueltiges Ergebnis: lieber "weiss nicht" als eine falsche
    Zuordnung, die den Sprachbonus verkehrt vergibt.
    """
    woerter = set(re.findall(r"[\wäöüß]+", (text or "").lower()))
    if not woerter:
        return None
    de = len(woerter & DEUTSCHE_MARKER)
    en = len(woerter & ENGLISCHE_MARKER)
    if any(z in (text or "").lower() for z in "äöüß"):
        de += 1
    if de > en:
        return "de"
    if en > de:
        return "en"
    return None


def ist_gesperrt(keyword: str) -> str | None:
    """Gibt den gesperrten Begriff zurueck, wenn einer vorkommt.

    Geprueft wird gegen den NORMALISIERTEN, nicht gegen den gekuerzten Text —
    und zusaetzlich gegen den gekuerzten, falls die Sperrliste selbst eine
    Beugungsform enthaelt. Bei einer Sperrliste ist Uebervorsicht richtig:
    Ein faelschlich blockierter Trend kostet nichts, ein durchgerutschter
    kostet eine Abmahnung.
    """
    formen = {normalisiere(keyword), stamm(keyword)}
    for begriff in gesperrte_begriffe():
        begriff_norm = normalisiere(begriff)
        for form in formen:
            # Teilzeichenkette, damit "corona" auch in "coronavirus" greift.
            if begriff_norm and (begriff_norm in form or begriff_norm in stamm(form)):
                return begriff
    return None


# ── Zusammenfuehren ──────────────────────────────────────────────────

def zusammenfuehren(zeilen: Iterable[TrendZeile]) -> list[TrendZeile]:
    """Dubletten ueber das normalisierte Stichwort verschmelzen.

    Zwei Quellen, die dasselbe Thema melden, sind ein STAERKERES Signal, kein
    doppeltes. Deshalb wird die Quelle zusammengefuehrt und in den Rohdaten
    festgehalten, wie viele Quellen es waren.
    """
    nach_norm: dict[str, TrendZeile] = {}
    for zeile in zeilen:
        norm = stamm(zeile.keyword)   # Dubletten -> gekuerzte Form
        if not norm:
            continue
        vorhanden = nach_norm.get(norm)
        if vorhanden is None:
            zeile.rohdaten = dict(zeile.rohdaten or {})
            zeile.rohdaten["quellen"] = [zeile.quelle]
            nach_norm[norm] = zeile
            continue
        # Verschmelzen: jeweils den aussagekraeftigeren Wert behalten.
        vorhanden.volumen = _groesser(vorhanden.volumen, zeile.volumen)
        vorhanden.wachstum = _groesser(vorhanden.wachstum, zeile.wachstum)
        vorhanden.saettigung = _groesser(vorhanden.saettigung, zeile.saettigung)
        if vorhanden.sentiment is None:
            vorhanden.sentiment = zeile.sentiment
        if vorhanden.sprache is None:
            vorhanden.sprache = zeile.sprache
        quellen = vorhanden.rohdaten.setdefault("quellen", [vorhanden.quelle])
        if zeile.quelle not in quellen:
            quellen.append(zeile.quelle)
        # Shop-Signale duerfen nicht verlorengehen — sie tragen die Art.
        if zeile.quelle == "shop":
            vorhanden.rohdaten["shop_art"] = zeile.rohdaten.get("art")
            vorhanden.rohdaten["shop_volumen"] = zeile.volumen
    return list(nach_norm.values())


def _groesser(a: float | None, b: float | None) -> float | None:
    if a is None:
        return b
    if b is None:
        return a
    return max(a, b)


# ── Score-Bestandteile ───────────────────────────────────────────────

def rang_normieren(werte: list[float | None]) -> list[float]:
    """Werte in ihren Rang zwischen 0 und 1 umrechnen.

    Rang statt Rohwert, weil die Quellen voellig verschiedene Skalen haben.
    None wird zu 0.0 — "nicht gemessen" darf nicht besser sein als "gemessen
    und niedrig".
    """
    vorhanden = sorted({w for w in werte if w is not None})
    if len(vorhanden) <= 1:
        return [0.5 if w is not None else 0.0 for w in werte]
    hoechst = len(vorhanden) - 1
    rang = {w: i / hoechst for i, w in enumerate(vorhanden)}
    return [rang[w] if w is not None else 0.0 for w in werte]


@lru_cache(maxsize=1)
def _sortiment_tokens() -> frozenset[str]:
    alle: set[str] = set()
    for p in products.alle():
        alle |= p.tokens()
    return frozenset(alle)


def passung_zum_sortiment(keyword: str) -> float:
    """0..1 — wie gut passt der Trend zu dem, was der Shop verkauft?

    Ohne diesen Bestandteil wuerde das System auf Trends anspringen, zu denen
    es gar nichts anzubieten hat. Beide Seiten werden gekuerzt verglichen,
    damit "Lampen" und "Lampe" zusammenfinden.
    """
    trend_tokens = {stamm(w) for w in keyword.split() if len(w) > 2}
    trend_tokens.discard("")
    if not trend_tokens:
        return 0.0
    sortiment = {stamm(t) for t in _sortiment_tokens()}
    treffer = trend_tokens & sortiment
    return min(len(treffer) / max(len(trend_tokens), 1), 1.0)


def shop_signal_staerke(zeile: TrendZeile, shop_normen: set[str]) -> float:
    """0..1 — wie stark sagen die eigenen Shop-Daten zu diesem Thema etwas?"""
    if zeile.quelle == "shop" or "shop" in (zeile.rohdaten.get("quellen") or []):
        art = zeile.rohdaten.get("shop_art") or zeile.rohdaten.get("art") or "suche"
        return SHOP_GEWICHTE.get(str(art), 0.4)
    # Ein externer Trend, der ZUSAETZLICH im Shop gesucht wurde, ist deutlich
    # mehr wert als einer, den hier noch nie jemand gesucht hat.
    return 0.7 if stamm(zeile.keyword) in shop_normen else 0.0


def saisonalitaet(keyword_norm: str) -> float | None:
    """Saisonaler Bonus aus der eigenen Historie — oder None.

    None heisst ausdruecklich "dafuer fehlen die Daten" und geht mit 0 in den
    Score ein. Erfundene Saisonwerte waeren hier besonders heimtueckisch: Sie
    saehen jahrelang plausibel aus.
    """
    if not db.verfuegbar():
        return None
    try:
        zeile = db.eine_zeile(
            """SELECT COUNT(*)::int AS n
                 FROM mkt_trends
                WHERE keyword_norm = %s
                  AND erfasst_am BETWEEN now() - interval '1 year' - interval '14 days'
                                     AND now() - interval '1 year' + interval '14 days'""",
            (keyword_norm,),
        )
    except Exception:
        return None
    if not zeile or zeile["n"] == 0:
        return None
    return min(float(zeile["n"]) / 10.0, 1.0)


def alter_stunden(zeile: TrendZeile) -> float:
    from datetime import datetime, timezone

    jetzt = datetime.now(timezone.utc)
    erfasst = zeile.erfasst_am
    if erfasst.tzinfo is None:
        erfasst = erfasst.replace(tzinfo=timezone.utc)
    return max((jetzt - erfasst).total_seconds() / 3600.0, 0.0)


def berechne_scores(zeilen: list[TrendZeile]) -> list[tuple[TrendZeile, float, dict[str, Any]]]:
    """Score je Trend samt seiner Bestandteile.

    Die Bestandteile werden mitgespeichert (mkt_trend_scores.bestandteile),
    damit spaeter nachvollziehbar ist, WARUM ein Trend gewaehlt wurde. Ohne
    das ist die Auswahl eine Blackbox.
    """
    g = {
        "w1": float(guardrails.wert("trend_score.w1_velocity", 0.30)),
        "w2": float(guardrails.wert("trend_score.w2_volumen", 0.15)),
        "w3": float(guardrails.wert("trend_score.w3_passung", 0.20)),
        "w4": float(guardrails.wert("trend_score.w4_shop_signal", 0.25)),
        "w5": float(guardrails.wert("trend_score.w5_saisonalitaet", 0.10)),
        "w6": float(guardrails.wert("trend_score.w6_saettigung", 0.20)),
        "w7": float(guardrails.wert("trend_score.w7_alter", 0.05)),
    }
    max_alter = float(guardrails.wert("trend_score.max_alter_stunden", 72))
    bevorzugt = str(guardrails.wert("trend_score.sprache_bevorzugt", "de"))

    shop_normen = {
        stamm(z.keyword) for z in zeilen
        if z.quelle == "shop" or "shop" in (z.rohdaten.get("quellen") or [])
    }

    # Rang je Quelle, nicht ueber alle — sonst wuerde YouTube (Millionen
    # Aufrufe) jede andere Quelle erdruecken.
    velocity_rang: dict[int, float] = {}
    volumen_rang: dict[int, float] = {}
    for quelle in {z.quelle for z in zeilen}:
        idx = [i for i, z in enumerate(zeilen) if z.quelle == quelle]
        for i, r in zip(idx, rang_normieren([zeilen[i].wachstum for i in idx])):
            velocity_rang[i] = r
        for i, r in zip(idx, rang_normieren([zeilen[i].volumen for i in idx])):
            volumen_rang[i] = r

    ergebnis = []
    for i, zeile in enumerate(zeilen):
        norm = stamm(zeile.keyword)
        alter = alter_stunden(zeile)
        saison = saisonalitaet(norm)
        sprache = zeile.sprache or sprache_raten(zeile.keyword)

        bestandteile = {
            "velocity": round(velocity_rang.get(i, 0.0), 4),
            "volumen": round(volumen_rang.get(i, 0.0), 4),
            "passung": round(passung_zum_sortiment(zeile.keyword), 4),
            "shop_signal": round(shop_signal_staerke(zeile, shop_normen), 4),
            "saisonalitaet": round(saison, 4) if saison is not None else None,
            "saettigung": round(zeile.saettigung, 4) if zeile.saettigung is not None else None,
            "alter_stunden": round(alter, 2),
            "sprache": sprache,
            "sprach_bonus": 0.05 if sprache == bevorzugt else 0.0,
            "gewichte": g,
        }

        score = (
            g["w1"] * bestandteile["velocity"]
            + g["w2"] * bestandteile["volumen"]
            + g["w3"] * bestandteile["passung"]
            + g["w4"] * bestandteile["shop_signal"]
            + g["w5"] * (bestandteile["saisonalitaet"] or 0.0)
            - g["w6"] * (bestandteile["saettigung"] or 0.0)
            - g["w7"] * min(alter / max_alter, 1.0)
            + bestandteile["sprach_bonus"]
        )
        bestandteile["score"] = round(score, 4)
        ergebnis.append((zeile, round(score, 4), bestandteile))

    ergebnis.sort(key=lambda x: -x[1])
    return ergebnis


# ── Schreiben ────────────────────────────────────────────────────────

def schreibe_trends(zeilen: list[TrendZeile]) -> int:
    """Trends samt Score ablegen. Gibt die Anzahl geschriebener Zeilen zurueck.

    Gesperrte Themen und zu alte Trends fliegen hier raus — vor dem
    Schreiben, nicht erst beim Auswerten.
    """
    if not db.verfuegbar() or not zeilen:
        return 0

    max_alter = float(guardrails.wert("trend_score.max_alter_stunden", 72))
    zusammengefuehrt = zusammenfuehren(zeilen)

    behalten: list[TrendZeile] = []
    for zeile in zusammengefuehrt:
        # Sperrlisten-Pruefung bewusst auf dem ECHTEN Wortlaut, nicht auf der
        # gekuerzten Form — sonst rutscht "bitcoin" als "bitcoi" durch.
        gesperrt = ist_gesperrt(zeile.keyword)
        if gesperrt:
            db.audit(
                "trend_gesperrt",
                job="trends_ingest",
                begruendung=f"gesperrtes Thema '{gesperrt}' in '{zeile.keyword[:80]}'",
            )
            continue
        if alter_stunden(zeile) > max_alter:
            continue
        behalten.append(zeile)

    if not behalten:
        return 0

    bewertet = berechne_scores(behalten)
    geschrieben = 0
    for zeile, score, bestandteile in bewertet:
        norm = stamm(zeile.keyword)   # keyword_norm = gekuerzte Form (Dubletten)
        # Trend UND Score gehoeren zusammen in eine Klammer. Ohne sie bleibt
        # bei einem Fehler im zweiten Schritt ein Trend OHNE Score liegen —
        # der taucht dann in keiner Rangliste auf, zaehlt aber trotzdem als
        # Zeile. Genau das ist beim ersten Testlauf passiert.
        with db.transaktion():
            neu = db.eine_zeile(
                """INSERT INTO mkt_trends
                     (quelle, keyword, keyword_norm, sprache, volumen, wachstum,
                      saettigung, sentiment, rohdaten, erfasst_am)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (
                    zeile.quelle, zeile.keyword[:500], norm[:500],
                    bestandteile.get("sprache"), zeile.volumen, zeile.wachstum,
                    zeile.saettigung, zeile.sentiment,
                    json.dumps(zeile.rohdaten, ensure_ascii=False, default=str),
                    zeile.erfasst_am,
                ),
            )
            if not neu:
                continue
            db.ausfuehren(
                # secs statt hours: make_interval nimmt bei hours nur GANZE
                # Zahlen, und max_alter_stunden ist konfigurierbar (darf also
                # 1.5 sein). Nur der secs-Parameter akzeptiert Nachkommastellen.
                """INSERT INTO mkt_trend_scores (trend_id, score, bestandteile, gueltig_bis)
                   VALUES (%s, %s, %s, now() + make_interval(secs => %s))""",
                (neu["id"], score, json.dumps(bestandteile, ensure_ascii=False), max_alter * 3600.0),
            )
        geschrieben += 1
    return geschrieben


# ── Job-Einstieg ─────────────────────────────────────────────────────

def alle_quellen() -> list:
    """Alle externen Quellen. shop_signals laeuft als EIGENER Job."""
    from .exploding_topics import ExplodingTopics
    from .google_trends import GoogleTrends
    from .reddit import RedditTrends
    from .tiktok_creative_center import TiktokCreativeCenter
    from .youtube_trending import YoutubeTrends

    return [
        TiktokCreativeCenter(), GoogleTrends(), RedditTrends(),
        YoutubeTrends(), ExplodingTopics(),
    ]


def job_trends_einlesen() -> dict[str, Any]:
    """Alle externen Quellen abfragen, zusammenfuehren, bewerten, speichern.

    Eine Quelle ohne Zugangsdaten ist KEIN Fehler — sie wird mit Grund
    protokolliert. Der Job scheitert nur, wenn gar nichts funktioniert und
    auch nichts erklaerbar ist.
    """
    ergebnis: dict[str, Any] = {"quellen": {}, "geschrieben": 0}
    alle_zeilen: list[TrendZeile] = []

    for quelle in alle_quellen():
        zeilen, grund = quelle.abrufen_sicher()
        if grund:
            print(f"[trends] {quelle.name}: 0 Zeilen — {grund}")
            ergebnis["quellen"][quelle.name] = {"zeilen": 0, "grund": grund}
            continue
        print(f"[trends] {quelle.name}: {len(zeilen)} Zeilen")
        ergebnis["quellen"][quelle.name] = {"zeilen": len(zeilen)}
        alle_zeilen.extend(zeilen)

    if not alle_zeilen:
        print("[trends] keine einzige Quelle lieferte Daten — es wird NICHTS erfunden.")
        return ergebnis

    ergebnis["geschrieben"] = schreibe_trends(alle_zeilen)
    print(f"[trends] {ergebnis['geschrieben']} Trends gespeichert")
    return ergebnis
