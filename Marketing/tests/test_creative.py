"""Tests fuer Zuordnung, Briefing und rechtliche Pruefung.

Der Pflichttest dieser Datei ist test_compliance_blockt: Ein Briefing mit
Heilversprechen darf nicht gerendert werden. Dazu kommen die Faelle, die im
Projekt schon einmal Geld gekostet haben oder gekostet haetten — allen voran
der falsche Preis aus einer zweiten Produktliste.
"""

from __future__ import annotations

import pytest

from conftest import braucht_db
from pipelines import matcher, products
from pipelines.creative import brief_generator, compliance
from pipelines.orchestrator import guardrails


def _brief(**felder):
    """Minimales, sauberes Briefing — Grundlage fuer die Einzelfaelle.

    Bewusst OHNE Preis: Ein Preis ohne zugeordnetes Produkt ist nicht
    pruefbar, und compliance blockiert ihn zu Recht. Die Preisfaelle stehen in
    eigenen Tests, dort mit echtem Produkt.
    """
    basis = {
        "skript": "Steht bei mir am Schreibtisch und macht genau eine Sache.",
        "cta": "Link im Profil. Werbung.",
        "hook_varianten": [{"typ": "frage", "text": "Kennst du das?"}],
        "overlays": [],
        "hashtags": ["#fyp"],
        "caption": "Werbung",
    }
    basis.update(felder)
    return basis


# ══════════════════════════════════════════════════════════════════════
# 1. Compliance sperrt
# ══════════════════════════════════════════════════════════════════════

def test_compliance_blockt():
    """Ein Heilversprechen darf NICHT gerendert werden."""
    brief = _brief(skript="Das Gerät lindert Verspannungen und stärkt das Immunsystem. Werbung.")
    befund = compliance.pruefe(brief, produkt=None, stil="A")
    assert befund.blockiert, "Heilversprechen muss blockieren"
    assert any("Heilversprechen" in g for g in befund.gruende), befund.gruende


def test_compliance_blockt_gegenprobe():
    """GEGENPROBE: ein sauberes Briefing kommt durch.

    Ohne das koennte die Pruefung auch alles blockieren — dann entstuende nie
    ein Video, und der Grund waere schwer zu finden.
    """
    befund = compliance.pruefe(_brief(), produkt=None, stil="A")
    assert not befund.blockiert, f"sauberes Briefing wurde blockiert: {befund.gruende}"


def test_falscher_preis_wird_blockiert():
    """Ein Preis, den es im Shop nicht gibt, sperrt das Briefing.

    Das ist der teuerste Fehler dieser Runde in Papierform: Die alte
    Marketing-Produktliste hatte fuer die COBLED Arbeitsleuchte 12,99 EUR
    statt 29,99 EUR. Ein Video daraus haette einen Preis beworben, den es nie
    gab — 17 Euro zu niedrig.
    """
    produkt = products.nach_id(24)
    assert produkt is not None and abs(produkt.preis - 29.99) < 0.01, \
        "Testgrundlage stimmt nicht mehr — Preis von Produkt 24 hat sich geaendert"

    brief = _brief(skript="Kostet nur 12,99 EUR, Versand ist kostenlos. Werbung.")
    befund = compliance.pruefe(brief, produkt=produkt, stil="A")
    assert befund.blockiert, "falscher Preis muss blockieren"
    assert any("12.99" in g or "12,99" in g for g in befund.gruende), befund.gruende


def test_richtiger_preis_kommt_durch():
    """GEGENPROBE: der ECHTE Preis desselben Produkts wird nicht beanstandet."""
    produkt = products.nach_id(24)
    brief = _brief(skript=f"Kostet {produkt.preis:.2f} EUR, Versand ist kostenlos. Werbung.")
    befund = compliance.pruefe(brief, produkt=produkt, stil="A")
    assert not befund.blockiert, f"richtiger Preis wurde beanstandet: {befund.gruende}"


def test_umsatzsteuer_hinweis_blockiert():
    """Kleinunternehmer nach Paragraph 19 UStG weist KEINE Umsatzsteuer aus."""
    produkt = products.nach_id(24)
    brief = _brief(skript=f"Kostet {produkt.preis:.2f} EUR inkl. 19% MwSt. Versand frei. Werbung.")
    befund = compliance.pruefe(brief, produkt=produkt, stil="A")
    assert befund.blockiert
    assert any("Umsatzsteuer" in g or "19" in g for g in befund.gruende), befund.gruende


def test_fremde_marke_blockiert():
    brief = _brief(skript="Besser als der Dyson und günstiger als bei Amazon. Werbung.")
    befund = compliance.pruefe(brief, produkt=None, stil="A")
    assert befund.blockiert
    assert any("Marke" in g for g in befund.gruende), befund.gruende


def test_werbekennzeichnung_ist_pflicht():
    """Der eigene Shop ist Werbung — auch ohne Auftraggeber."""
    brief = _brief(skript="Steht bei mir am Schreibtisch.", cta="Link im Profil.", caption="")
    befund = compliance.pruefe(brief, produkt=None, stil="A")
    assert befund.blockiert
    assert any("Pflichtangabe" in g for g in befund.gruende), befund.gruende


def test_stil_b_braucht_ki_kennzeichnung():
    """Stil B ohne KI-Hinweis wird gesperrt."""
    befund = compliance.pruefe(_brief(), produkt=None, stil="B")
    assert befund.blockiert
    assert any("KI" in g for g in befund.gruende), befund.gruende


def test_stil_b_vorlage_setzt_die_kennzeichnung_selbst():
    """Der echte Fund: Stil B konnte nie ein Video erzeugen.

    Der Vorlagen-Weg hat die KI-Kennzeichnung nicht gesetzt, also blockierte
    compliance JEDES Stil-B-Briefing. Live nachgestellt: von 5 Briefings waren
    2 blockiert — beide Stil B. Seitdem setzt der Generator die Kennzeichnung
    selbst.
    """
    produkt = products.alle()[0]
    treffer = matcher.Treffer(
        trend_id=0, trend_keyword=produkt.name, produkt=produkt, score=1.0,
        begruendung="Test", marge_prozent=None, marge_geprueft=False,
    )
    # Stil erzwingen, statt auf den Zufall zu warten.
    original = brief_generator.waehle_stil
    brief_generator.waehle_stil = lambda: "B"
    try:
        brief = brief_generator.baue_briefing(treffer, trendquelle="test")
    finally:
        brief_generator.waehle_stil = original

    assert brief["stil"] == "B"
    befund = compliance.pruefe(brief, produkt=produkt, stil="B")
    assert not befund.blockiert, \
        f"Stil-B-Briefing aus Vorlagen wurde blockiert: {befund.gruende}"


# ══════════════════════════════════════════════════════════════════════
# 2. Marge und Verfuegbarkeit
# ══════════════════════════════════════════════════════════════════════

def test_marge_unter_grenze_sperrt(monkeypatch):
    """Ein Produkt unter der Mindestmarge wird nicht beworben."""
    produkt = products.alle()[0]
    # EK so hoch ansetzen, dass die Marge sicher unter der Grenze liegt.
    monkeypatch.setattr(
        guardrails, "wert",
        lambda pfad, standard=None: (
            {str(produkt.id): {"ek": produkt.preis, "versand": 0.0}}
            if pfad == "matching.einkaufspreise"
            else (20 if pfad == "matching.mindest_marge_prozent" else standard)
        ),
    )
    darf, marge, geprueft, grund = matcher.marge_ok(produkt)
    assert darf is False, f"haette gesperrt werden muessen, Marge {marge}"
    assert geprueft is True
    assert "Mindestmarge" in grund


def test_marge_ueber_grenze_erlaubt(monkeypatch):
    """GEGENPROBE: mit gesunder Marge wird beworben."""
    produkt = products.alle()[0]
    monkeypatch.setattr(
        guardrails, "wert",
        lambda pfad, standard=None: (
            {str(produkt.id): {"ek": produkt.preis / 2.0, "versand": 0.0}}
            if pfad == "matching.einkaufspreise"
            else (20 if pfad == "matching.mindest_marge_prozent" else standard)
        ),
    )
    darf, marge, geprueft, grund = matcher.marge_ok(produkt)
    assert darf is True, grund
    assert geprueft is True and marge is not None and marge > 20


def test_unbekannte_marge_wird_als_ungeprueft_markiert(monkeypatch):
    """Ohne Einkaufspreis darf beworben werden — aber nicht als 'geprueft'.

    Das ist die ehrliche Zwischenloesung: Die Einkaufspreise stehen im Projekt
    nur namensbasiert in einer CSV. Wer sie eintraegt, bekommt echte
    Rechnung; bis dahin steht im Nachweis-Protokoll ausdruecklich
    "ungeprueft".
    """
    produkt = products.alle()[0]
    monkeypatch.setattr(
        guardrails, "wert",
        lambda pfad, standard=None: (
            {} if pfad == "matching.einkaufspreise"
            else ("erlauben_mit_hinweis" if pfad == "matching.unbekannte_marge" else standard)
        ),
    )
    darf, marge, geprueft, grund = matcher.marge_ok(produkt)
    assert darf is True
    assert geprueft is False, "eine ungepruefte Marge darf nicht als geprueft gelten"
    assert marge is None
    assert "UNGEPRUEFT" in grund.upper()


def test_haltung_sperren_wirkt(monkeypatch):
    """Auf 'sperren' gestellt wird ohne Einkaufspreis NICHT beworben."""
    produkt = products.alle()[0]
    monkeypatch.setattr(
        guardrails, "wert",
        lambda pfad, standard=None: (
            {} if pfad == "matching.einkaufspreise"
            else ("sperren" if pfad == "matching.unbekannte_marge" else standard)
        ),
    )
    darf, _, geprueft, grund = matcher.marge_ok(produkt)
    assert darf is False and geprueft is False
    assert "sperren" in grund


def test_ausverkauftes_produkt_wird_nicht_beworben():
    """Der teuerste Fall: Kunde kommt, will kaufen, kann nicht."""
    produkt = products.alle()[0]
    lieferbar, grund = matcher.verfuegbar(produkt, {produkt.id: False})
    assert lieferbar is False
    assert "ausverkauft" in grund


def test_leerer_bestand_heisst_keine_aussage():
    """GEGENPROBE: ein leerer Bestand darf NICHT alles sperren.

    Faellt die Bestandstabelle aus, wuerde ein 'leer = ausverkauft' das
    gesamte Sortiment stilllegen — und niemand wuesste warum.
    """
    produkt = products.alle()[0]
    lieferbar, _ = matcher.verfuegbar(produkt, {})
    assert lieferbar is True, "leerer Bestand bedeutet 'keine Aussage', nicht 'ausverkauft'"


# ══════════════════════════════════════════════════════════════════════
# 3. Briefing-Struktur
# ══════════════════════════════════════════════════════════════════════

def test_briefing_hat_vollstaendigen_merkmalsvektor():
    """Ohne Merkmale gibt es nichts zu lernen."""
    produkt = products.alle()[0]
    treffer = matcher.Treffer(
        trend_id=0, trend_keyword=produkt.name, produkt=produkt, score=1.0,
        begruendung="Test", marge_prozent=None, marge_geprueft=False,
    )
    brief = brief_generator.baue_briefing(treffer, trendquelle="shop")

    for feld in ("videostil", "hook_typ", "videolaenge", "stimme", "sprechtempo",
                 "musik", "untertitel_stil", "cta_typ", "miniaturbild",
                 "produktkategorie", "trendquelle", "hashtag_set"):
        assert feld in brief["merkmale"], f"Merkmal '{feld}' fehlt"

    assert brief["merkmale"]["trendquelle"] == "shop"
    assert brief["merkmale"]["produktkategorie"] == produkt.kategorie
    assert brief["merkmale"]["videolaenge"] in brief_generator.LAENGEN


def test_hook_steht_in_den_ersten_anderthalb_sekunden():
    """Nach 1,5 Sekunden ist die Aufmerksamkeit weg — der Hook muss davor sein."""
    produkt = products.alle()[0]
    treffer = matcher.Treffer(
        trend_id=0, trend_keyword=produkt.name, produkt=produkt, score=1.0,
        begruendung="Test", marge_prozent=None, marge_geprueft=False,
    )
    brief = brief_generator.baue_briefing(treffer, trendquelle="shop")
    erstes = brief["skript_teile"][0]
    assert float(erstes["bis"]) <= 1.6, f"erster Abschnitt endet erst bei {erstes['bis']}s"


def test_briefing_nennt_nur_den_echten_preis():
    """Aus Vorlagen gebaute Briefings duerfen die Compliance nie reissen."""
    for produkt in products.alle()[:8]:
        treffer = matcher.Treffer(
            trend_id=0, trend_keyword=produkt.name, produkt=produkt, score=1.0,
            begruendung="Test", marge_prozent=None, marge_geprueft=False,
        )
        brief = brief_generator.baue_briefing(treffer, trendquelle="shop")
        befund = compliance.pruefe(brief, produkt=produkt, stil=brief["stil"])
        assert not befund.blockiert, \
            f"eigenes Briefing fuer '{produkt.name}' blockiert: {befund.gruende}"


# ══════════════════════════════════════════════════════════════════════
# 3b. Die Aufhaenger aus config/hooks.json
# ══════════════════════════════════════════════════════════════════════

def test_hooks_haben_echte_umlaute():
    """Diese Texte werden ins Bild gebrannt — 'guenstiger' waere sichtbar.

    Beim ersten Entwurf standen in hooks.json ae/oe/ue, weil der Code
    ringsherum das in KOMMENTAREN so macht (Konsolen-Zeichensatz). Der
    Unterschied: Kommentare liest niemand ausser uns, diese Saetze stehen
    zwei Sekunden gross im Video.
    """
    import json

    from pipelines.creative.brief_generator import HOOK_DATEI

    daten = json.loads(HOOK_DATEI.read_text(encoding="utf-8"))
    verdaechtig = ("ae", "oe", "ue", "ss")
    treffer = []

    def pruefe_liste(pfad, texte):
        for t in texte:
            klein = t.lower()
            # Woerter, in denen die Ersatzschreibweise typisch vorkommt.
            for wort in klein.replace(".", " ").replace(",", " ").split():
                if any(v in wort for v in ("aeg", "oeh", "ueb", "aet", "uen", "oes")) \
                        or wort in ("fuer", "ueber", "haelt", "taeglich", "guenstig",
                                    "guenstiger", "aerger", "geraete", "hoechstens",
                                    "waere", "muessen", "koennen", "gross", "grosse"):
                    treffer.append(f"{pfad}: {t}")
                    break

    for kat, typen in (daten.get("kategorien") or {}).items():
        for typ, texte in typen.items():
            pruefe_liste(f"{kat}/{typ}", texte)
    for typ, texte in (daten.get("allgemein") or {}).items():
        pruefe_liste(f"allgemein/{typ}", texte)

    assert treffer == [], \
        "Ersatzschreibweise statt Umlaut — landet so im Video:\n  " + "\n  ".join(treffer)


def test_hooks_behaupten_nichts_ueber_das_produkt():
    """Ein Hook darf die Lage des Zuschauers beschreiben, nicht Produktdaten.

    Alles, was das Video ueber das Produkt sagt, muss gegen products.json
    pruefbar sein. Ein Aufhaenger wie 'haelt eine Woche ohne Steckdose' waere
    fuer 40 Produkte pauschal gesetzt — und fuer die meisten schlicht falsch.
    """
    import json
    import re

    from pipelines.creative.brief_generator import HOOK_DATEI

    daten = json.loads(HOOK_DATEI.read_text(encoding="utf-8"))
    # Masseinheiten und Zeitspannen sind das Warnzeichen: Sie behaupten etwas
    # Pruefbares. Der Preisplatzhalter ist ausdruecklich erlaubt.
    muster = re.compile(r"\b\d+\s*(mah|watt|w|stunden|std|tage|monate|liter|ml|cm|kg)\b",
                        re.IGNORECASE)
    treffer = []
    for gruppe in ((daten.get("kategorien") or {}).values()):
        for typ, texte in gruppe.items():
            for t in texte:
                if muster.search(t.replace("{preis}", "")):
                    treffer.append(f"{typ}: {t}")
    assert treffer == [], f"Hook behauptet Pruefbares ueber das Produkt: {treffer}"


def test_jeder_hooktyp_hat_fuer_jede_kategorie_eine_fassung():
    """Sonst faellt still auf 'allgemein' zurueck — und alles klingt gleich."""
    import json

    from pipelines.creative.brief_generator import HOOK_DATEI, HOOK_TYPEN

    daten = json.loads(HOOK_DATEI.read_text(encoding="utf-8"))
    fehlend = []
    for kat, typen in (daten.get("kategorien") or {}).items():
        for typ in HOOK_TYPEN:
            if not (typen.get(typ) or []):
                fehlend.append(f"{kat}/{typ}")
    for typ in HOOK_TYPEN:
        if not ((daten.get("allgemein") or {}).get(typ) or []):
            fehlend.append(f"allgemein/{typ}")
    assert fehlend == [], f"ohne Fassung: {fehlend}"


def test_hooks_streuen_ueber_das_sortiment():
    """GEGENPROBE: Es darf nicht wieder ein Satz fuer alles sein.

    Vorher gab es je Typ genau eine Vorlage — 40 Produkte, 6 Formulierungen,
    jedes Video startete mit demselben Halbsatz.
    """
    alle = products.alle()
    texte = {h["text"]
             for p in alle
             for h in brief_generator._hooks_aus_vorlagen(p, p.name)}
    assert len(texte) >= 40, \
        f"nur {len(texte)} verschiedene Formulierungen fuer {len(alle)} Produkte"


def test_derselbe_fall_ergibt_denselben_hook():
    """Ein Rendern muss wiederholbar bleiben — sonst ist nichts vergleichbar."""
    produkt = products.alle()[0]
    a = brief_generator._hooks_aus_vorlagen(produkt, "testtrend")
    b = brief_generator._hooks_aus_vorlagen(produkt, "testtrend")
    assert [h["text"] for h in a] == [h["text"] for h in b]


def test_alle_hooks_gehen_durch_die_rechtspruefung():
    """Der Pflichttest: Ein Aufhaenger, der blockiert wird, ist wertlos."""
    for produkt in products.alle():
        for hook in brief_generator._hooks_aus_vorlagen(produkt, produkt.name):
            befund = compliance.pruefe(
                _brief(skript=hook["text"], hook_varianten=[hook]),
                produkt=produkt, stil="A")
            assert not befund.blockiert, \
                f"Hook '{hook['text']}' ({produkt.name}) blockiert: {befund.gruende}"


# ══════════════════════════════════════════════════════════════════════
# 4. Ein Thema, ein Briefing — nicht eins je Messung
# ══════════════════════════════════════════════════════════════════════
#
# Der Fund: Jeder Durchlauf legt fuer dasselbe Stichwort eine neue
# mkt_trends-Zeile an (gewollt — saisonalitaet() braucht die Historie). Die
# Auswahl hat das aber nicht zusammengefasst, und die Sperre "hat schon ein
# Briefing" hing an der trend_id, die jedes Mal neu ist. Gemessen in der
# echten Datenbank: 18 Trend-Zeilen fuer 6 Stichwoerter, 10 Briefings fuer
# 7 Themen, davon 3 fuer dieselbe Kombination aus Thema und Produkt.
#
# Folge im Betrieb: dasselbe Thema haette bei JEDEM Lauf erneut ein Briefing
# (Geld beim Sprachmodell), ein Video (Rechenzeit) und denselben Beitrag
# ausgeloest. Die Idempotenz-Sperre auf mkt_posts greift dabei nicht — sie
# haengt an der video_id, und die ist ehrlich jedes Mal eine andere.

# Die Abfrage, wie sie VOR dem Fund aussah. Steht hier, damit die Gegenprobe
# an echten Daten zeigen kann, dass sie das Problem durchgelassen haette —
# statt es nur zu behaupten.
ALTE_ABFRAGE = """
    SELECT t.id, t.keyword, s.score
      FROM mkt_trends t
      JOIN mkt_trend_scores s ON s.trend_id = t.id
     WHERE (s.gueltig_bis IS NULL OR s.gueltig_bis > now())
       AND NOT EXISTS (
             SELECT 1 FROM mkt_matches m
              JOIN mkt_briefs b ON b.match_id = m.id
             WHERE m.trend_id = t.id)
       AND t.keyword_norm = %s
"""


@pytest.fixture
def thema_mit_messungen():
    """Ein Thema, dreimal gemessen — wie nach drei Durchlaeufen.

    Alle drei Zeilen bekommen einen gueltigen Score, damit sie in der
    Auswahl auch wirklich auftauchen. Danach wird restlos aufgeraeumt.
    """
    import uuid

    from pipelines import db

    if not db.verfuegbar():
        pytest.skip("keine Datenbank")

    norm = f"__test_thema_{uuid.uuid4().hex[:8]}"
    trend_ids: list[int] = []
    for lauf in range(3):
        trend = db.eine_zeile(
            """INSERT INTO mkt_trends (quelle, keyword, keyword_norm)
               VALUES ('shop', %s, %s) RETURNING id""",
            (f"{norm} lauf{lauf}", norm),
        )
        db.ausfuehren(
            """INSERT INTO mkt_trend_scores (trend_id, score, bestandteile, gueltig_bis)
               VALUES (%s, %s, '{}', now() + interval '1 day')""",
            (trend["id"], 0.9 - lauf * 0.1),
        )
        trend_ids.append(int(trend["id"]))

    yield norm, trend_ids

    for tid in trend_ids:
        try:
            db.ausfuehren(
                """DELETE FROM mkt_briefs WHERE match_id IN
                     (SELECT id FROM mkt_matches WHERE trend_id = %s)""", (tid,))
            db.ausfuehren("DELETE FROM mkt_matches WHERE trend_id = %s", (tid,))
            db.ausfuehren("DELETE FROM mkt_trends WHERE id = %s", (tid,))
        except Exception:
            pass


def _briefing_zu(trend_id: int, *, alter_tage: float = 0.0) -> None:
    """Legt ein Briefing an diesem Trend an — wahlweise rueckdatiert."""
    from pipelines import db

    match = db.eine_zeile(
        """INSERT INTO mkt_matches (trend_id, produkt_id, passungs_score, begruendung)
           VALUES (%s, 10, 1.0, 'Test') RETURNING id""", (trend_id,))
    db.ausfuehren(
        """INSERT INTO mkt_briefs
             (match_id, hook_varianten, skript, cta, hashtags, stil, merkmale,
              compliance_status, erstellt_am)
           VALUES (%s, '[]', 'Test', 'Werbung.', '[]', 'A', '{}', 'ok',
                   now() - make_interval(secs => %s))""",
        (match["id"], alter_tage * 86400.0),
    )


@braucht_db
def test_ein_thema_erscheint_nur_einmal(thema_mit_messungen):
    """Drei Messungen desselben Stichworts sind EIN Kandidat, nicht drei."""
    norm, _ = thema_mit_messungen
    treffer = [z for z in matcher.offene_trends(limit=500) if z["keyword_norm"] == norm]
    assert len(treffer) == 1, \
        f"dasselbe Thema steht {len(treffer)}× in der Auswahl statt einmal"


@braucht_db
def test_gegenprobe_alte_abfrage_zeigt_dasselbe_thema_dreimal(thema_mit_messungen):
    """GEGENPROBE: Die Abfrage von vorher haette drei Kandidaten geliefert.

    Ohne diesen Test koennte der obige gruen sein, weil die Testdaten gar
    nicht mehrfach vorkommen — er wuerde dann nichts beweisen.
    """
    from pipelines import db

    norm, _ = thema_mit_messungen
    alt = db.abfragen(ALTE_ABFRAGE, (norm,))
    assert len(alt) == 3, \
        f"Testaufbau erzeugt keine Dubletten ({len(alt)} statt 3) — der Test prueft nichts"


@braucht_db
def test_thema_mit_frischem_briefing_kommt_nicht_nochmal(thema_mit_messungen):
    """Ein Briefing an EINER Messung sperrt das ganze Thema."""
    norm, trend_ids = thema_mit_messungen
    _briefing_zu(trend_ids[0])

    treffer = [z for z in matcher.offene_trends(limit=500) if z["keyword_norm"] == norm]
    assert treffer == [], \
        "Thema kommt trotz frischem Briefing erneut — jeder Lauf baut ein neues Video"


@braucht_db
def test_gegenprobe_alte_sperre_griff_nie(thema_mit_messungen):
    """GEGENPROBE: Die alte Sperre haette das Thema durchgelassen.

    Sie fragte "hat DIESE trend_id schon ein Briefing" — und die anderen
    beiden Messungen desselben Stichworts haben ihr eigenes, briefingfreies
    id. Genau daran ist im Echtbetrieb dreimal dasselbe Briefing entstanden.
    """
    from pipelines import db

    norm, trend_ids = thema_mit_messungen
    _briefing_zu(trend_ids[0])

    alt = db.abfragen(ALTE_ABFRAGE, (norm,))
    assert len(alt) == 2, \
        f"alte Abfrage haette {len(alt)} statt 2 Kandidaten geliefert — Gegenprobe passt nicht"


@braucht_db
def test_thema_wird_nach_der_sperrfrist_wieder_frei(thema_mit_messungen, monkeypatch):
    """Nach Ablauf der Frist darf dasselbe Thema erneut drankommen.

    Die Gegenrichtung zur Sperre: Ein Thema fuer immer auszuschliessen waere
    die andere Uebertreibung — was im Juni lief, kann im Dezember wieder
    laufen. Ohne diesen Test koennte die Sperre versehentlich endlos sein
    und niemandem faellt es auf, weil "nichts passiert" wie Ruhe aussieht.
    """
    norm, trend_ids = thema_mit_messungen
    monkeypatch.setattr(
        guardrails, "wert",
        lambda pfad, standard=None: 7 if pfad == "matching.thema_cooldown_tage" else standard,
    )
    _briefing_zu(trend_ids[0], alter_tage=8)

    treffer = [z for z in matcher.offene_trends(limit=500) if z["keyword_norm"] == norm]
    assert len(treffer) == 1, \
        "Thema bleibt nach Ablauf der Sperrfrist gesperrt — das System verhungert"


@braucht_db
def test_bestand_wird_aus_der_richtigen_spalte_gelesen():
    """Der echte Fund: die Abfrage zeigte auf eine Spalte, die es nicht gibt.

    'in_stock' existiert in cj_stock_watch nicht — die Spalten heissen
    'available' und 'stock'. Die Abfrage schlug jedes Mal fehl, wurde
    abgefangen und lieferte ein leeres dict. Ergebnis: Die
    Verfuegbarkeitspruefung lief ins Leere, ohne dass es auffiel.
    """
    bestand = products.bestand_aus_db(neu=True)
    assert isinstance(bestand, dict)
    assert bestand, "cj_stock_watch lieferte nichts — Abfrage oder Tabelle pruefen"
    for pid, lieferbar in bestand.items():
        assert isinstance(pid, int)
        assert isinstance(lieferbar, bool)
