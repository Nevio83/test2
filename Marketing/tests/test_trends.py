"""Tests fuer die Trend-Quellen, die Normalisierung und den Score.

Der wichtigste Test dieser Datei ist test_keine_erfundenen_trends. Er sichert
die eine Eigenschaft ab, die den neuen Stand vom alten unterscheidet: Ohne
Zugangsdaten kommen NULL Zeilen zurueck, keine Beispieldaten.

Warum das so wichtig ist: Der alte fetch_trends.py hat bei jedem Fehlschlag
still Zeilen wie "smoothie rezept" mit erfundenem Sentiment zurueckgegeben.
Das Ergebnis sah aus wie Betrieb — die Datenbank fuellte sich, die Protokolle
waren gruen. Ein System, das unsichtbar Falsches tut, ist schlimmer als eines,
das sichtbar nichts tut.
"""

from __future__ import annotations

import pytest

from conftest import braucht_db
from pipelines import db, products
from pipelines.trends import normalize
from pipelines.trends.base import TrendQuelle, TrendZeile
from pipelines.trends.exploding_topics import ExplodingTopics
from pipelines.trends.google_trends import GoogleTrends
from pipelines.trends.reddit import RedditTrends
from pipelines.trends.shop_signals import ShopSignale
from pipelines.trends.youtube_trending import YoutubeTrends


# ══════════════════════════════════════════════════════════════════════
# 1. Keine erfundenen Trends
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize(
    "quelle_klasse, env_namen",
    [
        (RedditTrends, ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"]),
        (YoutubeTrends, ["YOUTUBE_API_KEY"]),
        (ExplodingTopics, ["EXPLODING_TOPICS_API_KEY"]),
    ],
)
def test_keine_erfundenen_trends(monkeypatch, quelle_klasse, env_namen):
    """Ohne Zugangsdaten: null Zeilen UND ein Grund im Klartext."""
    for name in env_namen:
        monkeypatch.delenv(name, raising=False)

    quelle = quelle_klasse()
    bereit, grund = quelle.bereit()
    assert bereit is False, f"{quelle.name} haelt sich ohne Schluessel faelschlich fuer bereit"
    assert grund, "es muss einen Grund im Klartext geben"
    assert any(n in grund for n in env_namen) or "installiert" in grund, \
        f"der Grund muss die fehlende Variable nennen, war: {grund}"

    zeilen, grund2 = quelle.abrufen_sicher()
    assert zeilen == [], f"{quelle.name} lieferte ohne Zugangsdaten {len(zeilen)} Zeilen"
    assert grund2


def test_keine_erfundenen_trends_bei_ausnahme():
    """Auch wenn die Quelle MITTEN im Abruf abstuerzt: keine Ersatzdaten."""

    class KaputteQuelle(TrendQuelle):
        name = "kaputt"

        def bereit(self):
            return True, None

        def hole(self):
            raise RuntimeError("Netzwerk weg")

    zeilen, grund = KaputteQuelle().abrufen_sicher()
    assert zeilen == [], "bei einem Fehler darf NICHTS zurueckkommen"
    assert "Netzwerk weg" in grund, "der echte Fehler muss durchgereicht werden"


def test_gegenprobe_alter_stand_wuerde_auffallen():
    """GEGENPROBE: eine Quelle nach altem Muster faellt durch.

    Baut das alte Verhalten nach — bei Fehlschlag eine erfundene Zeile. Wenn
    dieser Test die Attrappe NICHT erkennt, prueft der Test oben nichts.
    """

    class AlteQuelle(TrendQuelle):
        name = "alt"

        def bereit(self):
            return True, None

        def hole(self):
            # Genau das stand bis Runde 10 im Projekt.
            return [TrendZeile(quelle="alt", keyword="cozy home office",
                               sentiment=0.57, volumen=0.72)]

    zeilen, grund = AlteQuelle().abrufen_sicher()
    assert len(zeilen) == 1 and grund is None, \
        "die Attrappe MUSS hier durchkommen — sonst misst der Test daneben"
    assert zeilen[0].keyword == "cozy home office"


# ══════════════════════════════════════════════════════════════════════
# 2. Normalisieren und Zusammenfuehren
# ══════════════════════════════════════════════════════════════════════

def test_normalisieren_aendert_den_wortlaut_nicht():
    """normalisiere() raeumt nur auf — es kuerzt KEINE Woerter.

    Diese Trennung ist sicherheitsrelevant: Die Sperrliste prueft gegen diese
    Funktion. Wuerde sie kuerzen, verschwaende "bitcoin" zu "bitcoi" und der
    Sperreintrag griffe nicht mehr.
    """
    assert normalize.normalisiere("#DeskSetup") == "desksetup"
    assert normalize.normalisiere("LED-Lampe!") == "led-lampe"
    assert normalize.normalisiere("  Mehrere   Leerzeichen ") == "mehrere leerzeichen"
    assert normalize.normalisiere("Bitcoin") == "bitcoin", "der Wortlaut muss erhalten bleiben"


def test_stamm_fuehrt_beugungsformen_zusammen():
    """stamm() darf kuerzen — es dient nur dem Zusammenfuehren von Dubletten."""
    assert normalize.stamm("Wasserspender") == normalize.stamm("Wasserspendern")
    assert normalize.stamm("Lampen") == normalize.stamm("Lampe")
    assert normalize.stamm("LED Lampe") == normalize.stamm("led lampen")


def test_dubletten_werden_zu_einem_staerkeren_signal():
    """Zwei Quellen zum selben Thema = ein Trend, nicht zwei."""
    zeilen = [
        TrendZeile(quelle="reddit", keyword="LED Lampe", volumen=100.0),
        TrendZeile(quelle="youtube", keyword="led lampen", volumen=500.0, wachstum=9.0),
    ]
    zusammen = normalize.zusammenfuehren(zeilen)
    assert len(zusammen) == 1, "dasselbe Thema darf nicht doppelt gezaehlt werden"
    assert zusammen[0].volumen == 500.0, "der aussagekraeftigere Wert bleibt"
    assert zusammen[0].wachstum == 9.0
    assert set(zusammen[0].rohdaten["quellen"]) == {"reddit", "youtube"}


def test_gesperrte_themen_fliegen_raus():
    """Politik, Krisen, Heilversprechen — nichts davon neben einem Produkt."""
    for gesperrt in ("Krieg in der Ukraine", "Corona Impfung", "Bitcoin kaufen",
                     "abnehmen ohne Sport", "Coronavirus Variante"):
        assert normalize.ist_gesperrt(gesperrt) is not None, f"'{gesperrt}' muesste gesperrt sein"


def test_gesperrte_themen_ueberleben_die_wortkuerzung():
    """Der echte Fund aus dem ersten Testlauf, als Test festgehalten.

    Damals lief die Sperrlisten-Pruefung gegen die GEKUERZTE Form. "bitcoin"
    wurde intern zu "bitcoi", der Sperreintrag "bitcoin" passte nicht mehr —
    das Thema waere durchgerutscht, ohne dass es auffaellt.

    Dass die Kuerzung das Wort veraendert, ist ausdruecklich erlaubt. Was NICHT
    passieren darf: dass die Sperre daran scheitert.
    """
    gekuerzt = normalize.stamm("Bitcoin kaufen")
    assert gekuerzt != "bitcoin kaufen", "die Kuerzung greift hier tatsaechlich"
    assert normalize.ist_gesperrt("Bitcoin kaufen") is not None, \
        f"gesperrtes Thema nicht erkannt — gekuerzt lautet es '{gekuerzt}'"


def test_gesperrte_themen_gegenprobe():
    """GEGENPROBE: harmlose Themen duerfen NICHT gesperrt werden.

    Ohne das koennte die Sperre auch alles blockieren — dann gaebe es nie
    einen Trend, und niemand wuesste warum.
    """
    for erlaubt in ("led lampe schreibtisch", "wasserspender buero", "aroma diffusor"):
        assert normalize.ist_gesperrt(erlaubt) is None, f"'{erlaubt}' wurde faelschlich gesperrt"


def test_sprache_raten_gibt_none_bei_unklarheit():
    """None ist ein gueltiges Ergebnis — besser als eine falsche Zuordnung."""
    assert normalize.sprache_raten("wie ist das beste licht fuer") == "de"
    assert normalize.sprache_raten("what is the best light for your") == "en"
    assert normalize.sprache_raten("xyz123") is None


# ══════════════════════════════════════════════════════════════════════
# 3. Score
# ══════════════════════════════════════════════════════════════════════

def test_rang_normieren_macht_quellen_vergleichbar():
    """Rohwerte verschiedener Quellen sind nicht vergleichbar, Raenge schon."""
    assert normalize.rang_normieren([1.0, 5.0, 10.0]) == [0.0, 0.5, 1.0]
    # None heisst "nicht gemessen" und darf nicht besser sein als der kleinste
    # gemessene Wert.
    assert normalize.rang_normieren([None, 5.0, 10.0])[0] == 0.0


def test_saisonalitaet_wird_nicht_erfunden():
    """Ohne Vorjahresdaten gibt es KEINEN Saisonwert, sondern None.

    Ein erfundener Saisonwert waere besonders heimtueckisch: er saehe
    jahrelang plausibel aus und liesse sich nicht widerlegen.
    """
    ergebnis = normalize.saisonalitaet("garantiert-noch-nie-dagewesenes-stichwort-xyz")
    assert ergebnis is None


def test_score_bestandteile_werden_mitgeliefert():
    """Der Score muss erklaerbar sein, nicht nur eine Zahl."""
    zeilen = [
        TrendZeile(quelle="shop", keyword="led crystal lampe", volumen=13.0,
                   rohdaten={"art": "null_treffer"}),
        TrendZeile(quelle="reddit", keyword="irgendwas voellig anderes", volumen=1.0),
    ]
    bewertet = normalize.berechne_scores(zeilen)
    assert len(bewertet) == 2
    for _, score, bestandteile in bewertet:
        for feld in ("velocity", "volumen", "passung", "shop_signal",
                     "saisonalitaet", "saettigung", "alter_stunden", "gewichte"):
            assert feld in bestandteile, f"Bestandteil '{feld}' fehlt"
        assert bestandteile["score"] == score

    # Sortierung: bester zuerst.
    assert bewertet[0][1] >= bewertet[1][1]


def test_suche_ohne_treffer_schlaegt_seitenaufruf():
    """Nachfrage ohne Angebot muss staerker zaehlen als ein Seitenaufruf.

    Das ist die inhaltliche Kernentscheidung dieser Etappe: Eine Suche ohne
    Treffer ist eine verpasste Bestellung, ein Seitenaufruf nur Aufmerksamkeit.
    """
    null_treffer = TrendZeile(quelle="shop", keyword="test thema",
                              rohdaten={"art": "null_treffer"})
    aufruf = TrendZeile(quelle="shop", keyword="test thema",
                        rohdaten={"art": "seitenaufruf"})
    staerke_null = normalize.shop_signal_staerke(null_treffer, set())
    staerke_aufruf = normalize.shop_signal_staerke(aufruf, set())
    assert staerke_null > staerke_aufruf, (
        f"null_treffer ({staerke_null}) muss ueber seitenaufruf ({staerke_aufruf}) liegen"
    )


def test_passung_zum_sortiment_erkennt_echte_produkte():
    """Ein Trend zu einem echten Produkt muss besser passen als ein fremder."""
    echt = products.alle()[0]
    passung_echt = normalize.passung_zum_sortiment(normalize.normalisiere(echt.name))
    passung_fremd = normalize.passung_zum_sortiment(normalize.normalisiere("gebrauchtwagen leasing"))
    assert passung_echt > passung_fremd, \
        f"eigenes Produkt ({passung_echt}) muss besser passen als Fremdthema ({passung_fremd})"


# ══════════════════════════════════════════════════════════════════════
# 4. Shop-Signale gegen die echte Datenbank
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_shop_signale_liefern_nur_echte_produkte():
    """Jedes Produkt-Signal muss auf ein Produkt zeigen, das es wirklich gibt."""
    zeilen, grund = ShopSignale().abrufen_sicher()
    if grund:
        pytest.skip(f"keine Shop-Daten im Zeitfenster: {grund}")

    bekannte_ids = {p.id for p in products.alle()}
    for z in zeilen:
        pid = z.rohdaten.get("produkt_id")
        if pid is not None:
            assert int(pid) in bekannte_ids, \
                f"Signal zeigt auf Produkt {pid}, das es in products.json nicht gibt"
        assert z.quelle == "shop"
        assert z.rohdaten.get("art") in {
            "null_treffer", "suche", "verkauf", "warenkorbabbruch", "seitenaufruf"
        }


@braucht_db
def test_trend_und_score_gehoeren_zusammen():
    """Kein Trend ohne Score.

    Genau das ist beim ersten Testlauf schiefgegangen: Der Trend wurde
    geschrieben, das Schreiben des Scores schlug fehl, und die Zeile blieb
    ohne Bewertung liegen — unsichtbar fuer jede Rangliste, aber vorhanden.
    Seitdem stehen beide in einer Klammer.
    """
    verwaist = db.eine_zeile(
        """SELECT count(*) AS n FROM mkt_trends t
            WHERE NOT EXISTS (SELECT 1 FROM mkt_trend_scores s WHERE s.trend_id = t.id)"""
    )
    assert verwaist["n"] == 0, f"{verwaist['n']} Trend(s) ohne Score in der Datenbank"
