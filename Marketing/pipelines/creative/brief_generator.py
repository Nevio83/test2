"""Aus einem Trend-Produkt-Paar ein Kreativ-Briefing machen.

ZWEI WEGE, EIN ERGEBNIS

Mit Sprachmodell entstehen die Texte frei; ohne eines (kein Schluessel oder
Budget erschoepft) baut derselbe Code sie aus Vorlagen. Beide Wege liefern
dieselbe Struktur und denselben Merkmalsvektor — das Lernmodul kann also
beides vergleichen und lernt sogar, OB das Sprachmodell ueberhaupt besser ist.

DER MERKMALSVEKTOR IST DER EIGENTLICHE ZWECK
Ein Briefing ist nicht nur Text, sondern eine Kombination aus entscheidbaren
Eigenschaften: Hook-Typ, Laenge, Stimme, Musik, CTA, Slot. Genau diese
Dimensionen lernt der Bandit spaeter. Ohne sie waere jedes Video ein Unikat
und es gaebe nichts zu lernen.

STIL A ODER B KOMMT NICHT AUS DEM ZUFALL
Solange das Lernmodul (Etappe 10) fehlt, entscheidet die Mischung aus der
Konfiguration (video.stil_mix). Sobald policy.waehle() existiert, wird sie
automatisch benutzt — der Code fragt bei jedem Aufruf nach.
"""

from __future__ import annotations

import random
from typing import Any

from .. import db, matcher, products
from ..env_loader import MARKETING_DIR
from ..orchestrator import guardrails
from ..products import Produkt
from . import compliance, llm_client

MARKENSTIMME = MARKETING_DIR / "config" / "brand_voice.md"

# Die lernbaren Dimensionen. Werte bewusst als Text — sie landen so in
# mkt_arms und muessen dort lesbar sein.
HOOK_TYPEN = ("frage", "behauptung", "vorher_nachher", "zahl", "pov", "fehler")
LAENGEN = (15, 22, 30, 45)
STIMMEN = ("takes", "clone", "lokal")
SPRECHTEMPO = ("ruhig", "normal", "schnell")
MUSIK = ("ruhig", "treibend", "verspielt", "keine")
UNTERTITEL = ("wort_fuer_wort", "drei_woerter", "satzweise")
CTA_TYPEN = ("link_in_bio", "direkt", "frage_zurueck", "kein_cta")
MINIATUR = ("produkt_frei", "produkt_in_szene", "text_gross")


def _markenstimme() -> str:
    try:
        return MARKENSTIMME.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def waehle(dimension: str, optionen: tuple, *, kontext: str = "*") -> Any:
    """Eine Auspraegung waehlen — vom Lernmodul, sonst gleichverteilt.

    Sobald pipelines.learning.policy existiert, entscheidet der Bandit. Bis
    dahin wird gleichverteilt gezogen, was fuer die Anfangsphase ohnehin
    richtig ist: Ohne Daten gibt es nichts zu bevorzugen.
    """
    try:
        from ..learning.policy import waehle_auspraegung
    except ImportError:
        return random.choice(list(optionen))
    return waehle_auspraegung(dimension, list(optionen), kontext=kontext)


def waehle_stil() -> str:
    """A oder B, nach der Mischung aus der Konfiguration bzw. dem Lernmodul.

    WICHTIG: Stil B wird nur gewaehlt, wenn er auch produziert werden KANN.
    Ohne KI-Anbieter wuerden sonst 30 % aller Briefings in einer Warteschlange
    landen, die nie abgearbeitet wird — und niemand merkte es, weil jeder
    einzelne Lauf sauber "keine Stil-B-Briefings gerendert" meldet.

    Lieber alles als Stil A produzieren als ein Drittel gar nicht.
    """
    try:
        from ..video.style_b_aigen import stil_b_moeglich
        moeglich, grund = stil_b_moeglich()
    except ImportError:
        moeglich, grund = False, "Stil-B-Modul nicht verfuegbar"

    if not moeglich:
        return "A"

    try:
        from ..learning.policy import waehle_auspraegung
        return waehle_auspraegung("videostil", ["A", "B"], kontext="*")
    except ImportError:
        pass
    mix = guardrails.wert("video.stil_mix", {"A": 0.7, "B": 0.3}) or {}
    anteil_a = float(mix.get("A", 0.7))
    return "A" if random.random() < anteil_a else "B"


# ── Vorlagen-Weg (ohne Sprachmodell) ─────────────────────────────────

def _hooks_aus_vorlagen(produkt: Produkt, trend: str) -> list[dict[str, str]]:
    """Je Hook-Typ eine Variante. Bewusst nuechtern, siehe brand_voice.md.

    Diese Texte sind der Rueckfall, nicht das Ziel — aber sie muessen
    veroeffentlichungsfaehig sein. Ein Rueckfall, den man nicht senden kann,
    ist keiner.
    """
    name = produkt.name
    kategorie = produkt.kategorie.split("/")[0]
    return [
        {"typ": "frage",
         "text": f"Kennst du das Problem, das {name.lower()} löst?"},
        {"typ": "behauptung",
         "text": f"{name} macht genau eine Sache — die aber gut."},
        {"typ": "vorher_nachher",
         "text": f"Vorher: umständlich. Nachher: {name.lower()}."},
        {"typ": "zahl",
         "text": f"{produkt.preis:.2f} € für etwas, das du täglich benutzt."},
        {"typ": "pov",
         "text": f"POV: Du hast dein {kategorie}-Problem endlich gelöst."},
        {"typ": "fehler",
         "text": f"Die meisten kaufen bei {kategorie} das Falsche."},
    ]


def _skript_aus_vorlagen(produkt: Produkt, hook: str, laenge: int) -> list[dict[str, Any]]:
    """Sekundengenaues Skript. Nutzen vor Merkmal, ein Gedanke.

    Der Hook muss in den ersten 1,5 Sekunden stehen — danach ist die
    Aufmerksamkeit weg. Deshalb ist das erste Segment immer kurz.
    """
    hook_bis = float(guardrails.wert("video.hook_bis_sek", 1.5))
    beschreibung = (produkt.beschreibung or "").strip()
    satz = beschreibung.split(".")[0].strip() if beschreibung else produkt.name
    rest = max(laenge - hook_bis - 4.0, 4.0)

    return [
        {"von": 0.0, "bis": hook_bis, "text": hook},
        {"von": hook_bis, "bis": hook_bis + rest * 0.45,
         "text": f"{satz}."},
        {"von": hook_bis + rest * 0.45, "bis": hook_bis + rest * 0.8,
         "text": f"Kostet {produkt.preis:.2f} € — Versand ist kostenlos."},
        {"von": hook_bis + rest * 0.8, "bis": float(laenge),
         "text": "Link ist im Profil. Werbung."},
    ]


def _hashtags(produkt: Produkt) -> list[str]:
    """Mischung: 1 breit, 2 mittel, 2 nischig.

    Nur breite Hashtags heisst untergehen, nur nischige heisst nicht gefunden
    werden.
    """
    kategorie = produkt.kategorie.lower()
    breit = "#fyp"
    mittel = ["#gadgets", "#haushalt"] if "haushalt" in kategorie else ["#gadgets", "#technik"]
    nischig = [
        "#" + produkt.name.split()[0].lower().replace("-", ""),
        "#" + (kategorie.split("/")[0].replace(" ", "").replace("und", "")),
    ]
    return [breit] + mittel + nischig


# ── Sprachmodell-Weg ─────────────────────────────────────────────────

def _brief_vom_sprachmodell(produkt: Produkt, trend: str, laenge: int) -> dict[str, Any] | None:
    system = (
        "Du schreibst kurze Videoskripte fuer einen deutschen Onlineshop.\n"
        "Halte dich strikt an diese Markenstimme:\n\n" + _markenstimme()
    )
    aufgabe = f"""Schreibe ein Briefing fuer ein {laenge}-Sekunden-Video.

Produkt: {produkt.name}
Kategorie: {produkt.kategorie}
Preis: {produkt.preis:.2f} EUR (exakt so nennen, niemals anders)
Beschreibung: {produkt.beschreibung[:400]}
Anlass/Trend: {trend}

Antworte NUR mit einem JSON-Objekt in genau dieser Form:
{{
  "hooks": [{{"typ": "frage|behauptung|vorher_nachher|zahl|pov|fehler", "text": "..."}}],
  "skript": [{{"von": 0.0, "bis": 1.5, "text": "..."}}],
  "overlays": [{{"bei": 2.0, "text": "..."}}],
  "cta": "...",
  "hashtags": ["#...", "..."]
}}

Regeln, die NICHT gebrochen werden duerfen:
- 3 bis 5 Hooks, jeder ein anderer Typ
- Der erste Skript-Abschnitt endet spaetestens bei 1.5 Sekunden
- Das Skript endet bei genau {laenge}.0 Sekunden
- Der Preis wird exakt als {produkt.preis:.2f} EUR genannt oder gar nicht
- Keine Umsatzsteuer erwaehnen (Kleinunternehmer nach Paragraph 19 UStG)
- Das Wort "Werbung" muss vorkommen
- Keine Heilversprechen, keine fremden Marken, keine Superlative
"""
    return llm_client.frage_json(system, aufgabe, job="match_and_brief", max_token=1800)


# ── Briefing bauen ───────────────────────────────────────────────────

def baue_briefing(treffer: matcher.Treffer, *, trendquelle: str = "unbekannt") -> dict[str, Any]:
    """Ein vollstaendiges Briefing samt Merkmalsvektor."""
    produkt = treffer.produkt
    kontext = f"{produkt.kategorie}|{trendquelle}"

    stil = waehle_stil()
    laenge = int(waehle("videolaenge", LAENGEN, kontext=kontext))
    hook_typ = str(waehle("hook_typ", HOOK_TYPEN, kontext=kontext))

    vom_modell = _brief_vom_sprachmodell(produkt, treffer.trend_keyword, laenge)
    aus_vorlagen = vom_modell is None

    if vom_modell:
        hooks = vom_modell.get("hooks") or []
        skript_teile = vom_modell.get("skript") or []
        overlays = vom_modell.get("overlays") or []
        cta = str(vom_modell.get("cta") or "Link im Profil. Werbung.")
        hashtags = vom_modell.get("hashtags") or _hashtags(produkt)
    else:
        hooks = _hooks_aus_vorlagen(produkt, treffer.trend_keyword)
        gewaehlt = next((h for h in hooks if h["typ"] == hook_typ), hooks[0])
        # Den gewuenschten Hook nach vorn: baue_briefing() liest spaeter
        # hooks[0] als den tatsaechlich verwendeten.
        hooks = [gewaehlt] + [h for h in hooks if h is not gewaehlt]
        skript_teile = _skript_aus_vorlagen(produkt, gewaehlt["text"], laenge)
        overlays = [{"bei": 2.0, "text": produkt.name},
                    {"bei": float(laenge) - 3.0, "text": f"{produkt.preis:.2f} € · Versand frei"}]
        cta = "Link im Profil. Werbung."
        hashtags = _hashtags(produkt)

    # KI-Kennzeichnung bei Stil B ist Pflicht — und muss im TEXT stehen, nicht
    # nur im Plattform-Feld. Ohne diesen Block blockiert compliance.pruefe()
    # jedes Stil-B-Briefing, und Stil B koennte nie ein Video erzeugen.
    if stil == "B":
        kennzeichnung = str(
            compliance.regeln().get("pflichtangaben", {}).get(
                "ki_kennzeichnung", "Dieses Video enthält KI-generierte Inhalte."
            )
        )
        if kennzeichnung.lower() not in cta.lower():
            cta = f"{cta} {kennzeichnung}"
        if not any(kennzeichnung.lower() in str(o.get("text", "")).lower() for o in overlays):
            overlays = list(overlays) + [{"bei": float(laenge) - 2.0, "text": kennzeichnung}]

    # Der Hook-Typ des tatsaechlich ausgewaehlten Hooks zaehlt fuer das Lernen,
    # nicht der urspruenglich gewuerfelte.
    erster_hook = hooks[0] if hooks else {"typ": hook_typ, "text": produkt.name}
    hook_typ_echt = str(erster_hook.get("typ", hook_typ))

    skript_text = " ".join(str(t.get("text", "")) for t in skript_teile)

    merkmale = {
        "videostil": stil,
        "hook_typ": hook_typ_echt,
        "videolaenge": laenge,
        "stimme": str(waehle("stimme", STIMMEN, kontext=kontext)),
        "sprechtempo": str(waehle("sprechtempo", SPRECHTEMPO, kontext=kontext)),
        "musik": str(waehle("musik", MUSIK, kontext=kontext)),
        "untertitel_stil": str(waehle("untertitel_stil", UNTERTITEL, kontext=kontext)),
        "cta_typ": str(waehle("cta_typ", CTA_TYPEN, kontext=kontext)),
        "miniaturbild": str(waehle("miniaturbild", MINIATUR, kontext=kontext)),
        "produktkategorie": produkt.kategorie,
        "trendquelle": trendquelle,
        "hashtag_set": ",".join(hashtags[:5]),
        "aus_vorlagen": aus_vorlagen,
    }

    return {
        "hook_varianten": hooks,
        "skript": skript_text,
        "skript_teile": skript_teile,
        "overlays": overlays,
        "cta": cta,
        "hashtags": hashtags,
        "stil": stil,
        "merkmale": merkmale,
        "caption": f"{erster_hook.get('text', '')} {cta} {' '.join(hashtags[:5])}",
    }


def speichere_briefing(match_id: int, brief: dict[str, Any], befund: compliance.Befund) -> int | None:
    if not db.verfuegbar():
        return None
    import json

    zeile = db.eine_zeile(
        """INSERT INTO mkt_briefs
             (match_id, hook_varianten, skript, overlays, cta, hashtags, stil,
              merkmale, compliance_status, compliance_grund)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (
            match_id,
            json.dumps(brief["hook_varianten"], ensure_ascii=False),
            brief["skript"],
            json.dumps({"overlays": brief["overlays"], "skript_teile": brief["skript_teile"]},
                       ensure_ascii=False),
            brief["cta"],
            json.dumps(brief["hashtags"], ensure_ascii=False),
            brief["stil"],
            json.dumps(brief["merkmale"], ensure_ascii=False),
            befund.status,
            befund.als_text()[:1000],
        ),
    )
    return int(zeile["id"]) if zeile else None


# ── Job-Einstieg ─────────────────────────────────────────────────────

def job_match_und_brief() -> dict[str, Any]:
    """Offene Trends zuordnen und Briefings schreiben."""
    if not db.verfuegbar():
        return {"grund": db.grund_fuer_fehlende_db(), "briefings": 0}

    trends = matcher.offene_trends(limit=int(guardrails.wert("matching.max_trends_pro_lauf", 5)))
    if not trends:
        print("[brief] keine offenen Trends")
        return {"trends": 0, "briefings": 0}

    bestand = products.bestand_aus_db()
    gebaut = 0
    blockiert = 0
    ohne_treffer = 0

    for trend in trends:
        treffer_liste = matcher.finde_treffer(
            int(trend["id"]), str(trend["keyword"]), bestand=bestand
        )
        if not treffer_liste:
            ohne_treffer += 1
            db.audit("kein_produkt_zum_trend", job="match_and_brief",
                     begruendung=f"'{str(trend['keyword'])[:80]}' passt zu keinem lieferbaren Produkt")
            continue

        bester = treffer_liste[0]
        match_id = matcher.speichere_treffer(bester)
        if match_id is None:
            continue

        quelle = db.eine_zeile("SELECT quelle FROM mkt_trends WHERE id = %s", (int(trend["id"]),))
        brief = baue_briefing(bester, trendquelle=str(quelle["quelle"]) if quelle else "unbekannt")

        befund = compliance.pruefe(
            brief, produkt=bester.produkt, stil=brief["stil"], phase="vor_render"
        )
        brief_id = speichere_briefing(match_id, brief, befund)
        if befund.blockiert:
            blockiert += 1
            print(f"[brief] ⛔ blockiert: {bester.produkt.name} — {befund.als_text()[:110]}")
        else:
            gebaut += 1
            print(f"[brief] ✅ {bester.produkt.name} (Stil {brief['stil']}, "
                  f"{brief['merkmale']['videolaenge']}s, Hook '{brief['merkmale']['hook_typ']}')"
                  + (" [aus Vorlagen]" if brief["merkmale"]["aus_vorlagen"] else " [Sprachmodell]"))

    return {"trends": len(trends), "briefings": gebaut,
            "blockiert": blockiert, "ohne_produkt": ohne_treffer}
