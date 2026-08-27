"""Trend -> Produkt.

Vier Filter, die ein Produkt bestehen muss, bevor es beworben wird. Jeder
davon existiert, weil sein Fehlen konkret Geld kostet:

  1. PASSUNG      — ein Video zu einem Thema, zu dem es nichts gibt, bringt
                    Aufrufe und null Bestellungen.
  2. MARGE        — ein Produkt unter der Mindestmarge zu bewerben heisst,
                    fuer Reichweite zu bezahlen, die Verlust einbringt.
  3. VERFUEGBAR   — ein ausverkauftes Produkt zu bewerben ist der teuerste
                    Fall: Der Kunde kommt, will kaufen, kann nicht, und kommt
                    nicht wieder.
  4. ERSCHOEPFUNG — dasselbe Produkt jede Woche dreimal zu zeigen verbrennt
                    genau die Zielgruppe, die es kaufen wuerde.

Dazu kommt der gelernte Aufschlag aus mkt_arms: Produktkategorien, die bisher
funktioniert haben, werden bevorzugt — aber nie so stark, dass die anderen
gar nicht mehr drankommen (siehe Explorationsuntergrenze in policy.py).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import db, products
from .orchestrator import guardrails
from .products import Produkt
from .trends.normalize import stamm


@dataclass(frozen=True)
class Treffer:
    """Ein bewerteter Trend-Produkt-Paarung."""

    trend_id: int
    trend_keyword: str
    produkt: Produkt
    score: float
    begruendung: str
    marge_prozent: float | None
    marge_geprueft: bool


# ── Marge ────────────────────────────────────────────────────────────

def marge_prozent(produkt: Produkt) -> tuple[float | None, str]:
    """Marge in Prozent nach der Formel aus CLAUDE-CODE.md Paragraph 2.

        VK >= (EK + Versand) * 1,20

    Rueckgabe (marge_oder_None, begruendung). None heisst ausdruecklich
    "unbekannt", nicht "null" — der Unterschied entscheidet, ob das Produkt
    beworben werden darf.

    Die Einkaufspreise stehen im Projekt nur namensbasiert in einer CSV, nicht
    je Produkt-ID. Wer sie gepflegt haben will, traegt sie unter
    matching.einkaufspreise ein — dann wird echt gerechnet statt geschaetzt.
    """
    tabelle = guardrails.wert("matching.einkaufspreise", {}) or {}
    eintrag = tabelle.get(str(produkt.id)) or tabelle.get(produkt.id)
    if not eintrag:
        return None, "kein Einkaufspreis hinterlegt"
    try:
        ek = float(eintrag.get("ek"))
        versand = float(eintrag.get("versand", 0.0))
    except (TypeError, ValueError, AttributeError):
        return None, "Einkaufspreis-Eintrag unbrauchbar"
    kosten = ek + versand
    if kosten <= 0:
        return None, "Einkaufspreis ist 0 — unbrauchbar"
    marge = (produkt.preis - kosten) / kosten * 100.0
    return round(marge, 1), f"VK {produkt.preis:.2f} gegen EK+Versand {kosten:.2f}"


def marge_ok(produkt: Produkt) -> tuple[bool, float | None, bool, str]:
    """Darf dieses Produkt beworben werden?

    Rueckgabe (darf, marge, geprueft, grund). "geprueft" sagt, ob die Marge
    wirklich gerechnet wurde — eine ungeprueft durchgelassene Marge wird im
    Nachweis-Protokoll vermerkt, damit sie nicht als geprueft durchgeht.
    """
    mindest = float(guardrails.wert("matching.mindest_marge_prozent", 20))
    marge, grund = marge_prozent(produkt)

    if marge is None:
        haltung = str(guardrails.wert("matching.unbekannte_marge", "erlauben_mit_hinweis"))
        if haltung == "sperren":
            return False, None, False, f"Marge unbekannt ({grund}) und Haltung ist 'sperren'"
        return True, None, False, f"Marge UNGEPRUEFT ({grund})"

    if marge < mindest:
        return False, marge, True, f"Marge {marge:.1f} % unter Mindestmarge {mindest:.0f} %"
    return True, marge, True, f"Marge {marge:.1f} % ({grund})"


# ── Verfuegbarkeit ───────────────────────────────────────────────────

def verfuegbar(produkt: Produkt, bestand: dict[int, bool]) -> tuple[bool, str]:
    """Ist das Produkt lieferbar?

    Zwei Quellen: das Feld in products.json und der Lieferantenbestand aus
    cj_stock_watch. Der Lieferantenbestand ist aktueller und schlaegt die
    Datei. Fehlt er, gilt die Datei — ein leerer Bestand heisst "keine
    Aussage", nicht "alles ausverkauft".
    """
    aus_db = bestand.get(produkt.id)
    if aus_db is False:
        return False, "laut Lieferantenbestand ausverkauft"
    if aus_db is None and not produkt.auf_lager:
        return False, "laut Produktliste nicht auf Lager"
    return True, "lieferbar"


# ── Erschoepfung ─────────────────────────────────────────────────────

def zu_oft_beworben(produkt_id: int) -> tuple[bool, str]:
    """Wurde das Produkt diese Woche schon oft genug gezeigt?"""
    grenze = int(guardrails.wert("matching.max_posts_pro_produkt_pro_woche", 2))
    if not db.verfuegbar():
        return False, "keine Datenbank — Haeufigkeit nicht pruefbar"
    zeile = db.eine_zeile(
        """SELECT COUNT(*)::int AS n
             FROM mkt_posts p
             JOIN mkt_videos v ON v.id = p.video_id
             JOIN mkt_briefs b ON b.id = v.brief_id
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE m.produkt_id = %s
              AND p.erstellt_am > now() - interval '7 days'
              AND p.status <> 'fehler'""",
        (produkt_id,),
    )
    anzahl = int(zeile["n"]) if zeile else 0
    if anzahl >= grenze:
        return True, f"diese Woche schon {anzahl}× beworben (Grenze {grenze})"
    return False, f"diese Woche {anzahl}× beworben"


# ── Gelernter Aufschlag ──────────────────────────────────────────────

def gelernter_aufschlag(kategorie: str) -> float:
    """Wie gut lief diese Produktkategorie bisher? 0.0 wenn unbekannt.

    Bewusst gedeckelt: Der Aufschlag darf die Auswahl faerben, aber nicht
    bestimmen. Sonst bekaeme eine Kategorie, die einmal Glueck hatte, alle
    weiteren Videos — und das System lernte nie etwas ueber die anderen.
    """
    if not db.verfuegbar():
        return 0.0
    try:
        zeile = db.eine_zeile(
            """SELECT alpha, beta, versuche FROM mkt_arms
                WHERE dimension = 'produktkategorie' AND auspraegung = %s AND kontext = '*'""",
            (kategorie,),
        )
    except Exception:
        return 0.0
    if not zeile or int(zeile["versuche"]) < int(guardrails.wert("lernen.min_stichprobe", 8)):
        return 0.0
    alpha, beta = float(zeile["alpha"]), float(zeile["beta"])
    erwartung = alpha / (alpha + beta) if (alpha + beta) > 0 else 0.5
    return round(min(max(erwartung - 0.5, -0.15), 0.15), 4)


# ── Zuordnung ────────────────────────────────────────────────────────

def passung(trend_keyword: str, produkt: Produkt) -> float:
    """0..1 — Wortueberschneidung zwischen Trend und Produkt.

    Basis wie bisher (Token-Ueberschneidung), aber zusaetzlich mit Kategorie
    und Tags, und beide Seiten gekuerzt verglichen.
    """
    trend_tokens = {stamm(w) for w in trend_keyword.split() if len(w) > 2}
    trend_tokens.discard("")
    if not trend_tokens:
        return 0.0
    produkt_tokens = {stamm(t) for t in produkt.tokens()}
    treffer = trend_tokens & produkt_tokens
    if not treffer:
        return 0.0
    # Anteil an den Trend-Woertern, leicht belohnt fuer mehrere Treffer.
    return min(len(treffer) / len(trend_tokens), 1.0)


def finde_treffer(trend_id: int, trend_keyword: str, *, bestand: dict[int, bool] | None = None) -> list[Treffer]:
    """Passende Produkte zu einem Trend — bereits gefiltert und bewertet."""
    if bestand is None:
        bestand = products.bestand_aus_db()
    mindest_passung = float(guardrails.wert("matching.min_passungs_score", 0.15))

    treffer: list[Treffer] = []
    for produkt in products.alle():
        p = passung(trend_keyword, produkt)
        if p < mindest_passung:
            continue

        lieferbar, liefergrund = verfuegbar(produkt, bestand)
        if not lieferbar:
            db.audit("produkt_uebersprungen", job="match_and_brief",
                     begruendung=f"{produkt.name}: {liefergrund}")
            continue

        darf, marge, geprueft, margengrund = marge_ok(produkt)
        if not darf:
            db.audit("produkt_uebersprungen", job="match_and_brief",
                     begruendung=f"{produkt.name}: {margengrund}")
            continue

        erschoepft, haeufigkeit = zu_oft_beworben(produkt.id)
        if erschoepft:
            db.audit("produkt_uebersprungen", job="match_and_brief",
                     begruendung=f"{produkt.name}: {haeufigkeit}")
            continue

        aufschlag = gelernter_aufschlag(produkt.kategorie)
        score = round(min(max(p + aufschlag, 0.0), 1.0), 4)
        treffer.append(
            Treffer(
                trend_id=trend_id,
                trend_keyword=trend_keyword,
                produkt=produkt,
                score=score,
                begruendung=(
                    f"Passung {p:.2f}"
                    + (f", gelernter Aufschlag {aufschlag:+.2f}" if aufschlag else "")
                    + f"; {margengrund}; {liefergrund}; {haeufigkeit}"
                ),
                marge_prozent=marge,
                marge_geprueft=geprueft,
            )
        )

    treffer.sort(key=lambda t: -t.score)
    return treffer


def speichere_treffer(treffer: Treffer) -> int | None:
    """Legt den Treffer als mkt_matches-Zeile ab und gibt die ID zurueck."""
    if not db.verfuegbar():
        return None
    zeile = db.eine_zeile(
        """INSERT INTO mkt_matches
             (trend_id, produkt_id, passungs_score, begruendung, marge_zum_zeitpunkt)
           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
        (treffer.trend_id, treffer.produkt.id, treffer.score,
         treffer.begruendung[:1000], treffer.marge_prozent),
    )
    if zeile and not treffer.marge_geprueft:
        # Ausdruecklich festhalten: hier wurde OHNE geprüfte Marge beworben.
        db.audit(
            "marge_ungeprueft",
            job="match_and_brief",
            begruendung=f"{treffer.produkt.name} ohne hinterlegten Einkaufspreis beworben",
            alternativen={"produkt_id": treffer.produkt.id, "vk": treffer.produkt.preis},
        )
    return int(zeile["id"]) if zeile else None


def offene_trends(limit: int = 10) -> list[dict[str, Any]]:
    """Bestbewertete THEMEN, zu denen zuletzt kein Briefing entstanden ist.

    JE THEMA EINE ZEILE, NICHT JE MESSUNG

    Jeder Durchlauf von trends_ingest/shop_signals legt fuer dasselbe
    Stichwort eine NEUE mkt_trends-Zeile an. Das ist so gewollt: die Historie
    ist die einzige Quelle fuer saisonalitaet() (sie schaut ein Jahr zurueck).
    Fuer die Auswahl ist dieselbe Messung zum dritten Mal aber kein neues
    Thema, sondern dasselbe.

    Die erste Fassung hat das uebersehen und zweimal falsch gelegen:

      1. Sie hat je Messung eine Zeile geliefert. In der echten Datenbank
         standen nach drei Laeufen 18 Trend-Zeilen fuer 6 Stichwoerter — die
         Rangliste bestand zu zwei Dritteln aus Wiederholungen.
      2. Der Ausschluss "hat schon ein Briefing" hing an der trend_id. Die
         ist bei jeder Messung neu, also hat er NIE gegriffen. Gemessen:
         10 Briefings fuer 7 Themen, davon 3 fuer genau dieselbe Kombination
         aus Thema und Produkt.

    Beides zusammen heisst: derselbe Trend haette bei jedem Lauf erneut ein
    Briefing (kostet Geld beim Sprachmodell), ein Video (kostet Rechenzeit)
    und spaeter denselben Beitrag ausgeloest. Die Idempotenz-Sperre auf
    mkt_posts faengt das NICHT ab — sie haengt an der video_id, und die ist
    jedes Mal ehrlich eine andere.

    Deshalb jetzt: DISTINCT ON (keyword_norm) fuer eine Zeile je Thema, und
    die Briefing-Sperre ueber das Thema statt ueber die Messung — begrenzt
    auf 'matching.thema_cooldown_tage', damit ein Thema nach einer Weile
    wieder drankommen darf. Ein Thema fuer immer zu sperren waere die andere
    Uebertreibung: Was im Juni lief, kann im Dezember wieder laufen.
    """
    if not db.verfuegbar():
        return []
    cooldown_tage = float(guardrails.wert("matching.thema_cooldown_tage", 7))
    return db.abfragen(
        """SELECT * FROM (
             SELECT DISTINCT ON (t.keyword_norm)
                    t.id, t.keyword, t.keyword_norm, s.score
               FROM mkt_trends t
               JOIN mkt_trend_scores s ON s.trend_id = t.id
              WHERE (s.gueltig_bis IS NULL OR s.gueltig_bis > now())
                AND NOT EXISTS (
                      SELECT 1
                        FROM mkt_briefs b
                        JOIN mkt_matches m  ON m.id  = b.match_id
                        JOIN mkt_trends  t2 ON t2.id = m.trend_id
                       WHERE t2.keyword_norm = t.keyword_norm
                         AND b.erstellt_am > now() - make_interval(secs => %s))
              ORDER BY t.keyword_norm, s.score DESC, t.erfasst_am DESC
           ) q
           ORDER BY q.score DESC
           LIMIT %s""",
        (cooldown_tage * 86400.0, limit),
    )
