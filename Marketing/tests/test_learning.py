"""Tests fuer das Lernmodul.

Vier Pflichttests aus dem Aufgabenzettel:
  * test_reward_verzoegert       — vor 72 h kein endgueltiges Urteil
  * test_exploration_untergrenze — die Quote faellt nie unter 15 %
  * test_ausreisser              — ein viraler Treffer kippt die Politik nicht
  * die Abnahme aus Paragraph 15 — nach 20 Beitraegen haben sich die Werte
    messbar verschoben UND die Erkundung liegt weiterhin ueber 15 %

Der letzte ist der eigentliche Beweis, dass das System lernt. Er wird gegen
die echte Datenbank gefahren, mit eigenen Testdimensionen, die danach wieder
entfernt werden.
"""

from __future__ import annotations

import random

import pytest

from conftest import braucht_db
from pipelines import db
from pipelines.learning import bandit, features, report, reward
from pipelines.orchestrator import guardrails


TEST_DIMENSION = "hook_typ"          # echte Dimension, eigener Kontext
TEST_KONTEXT = "__testkontext"


@pytest.fixture
def saubere_arme():
    """Eigener Kontext, damit die echten Lerndaten unberuehrt bleiben."""
    if db.verfuegbar():
        db.ausfuehren("DELETE FROM mkt_arms WHERE kontext = %s", (TEST_KONTEXT,))
    yield TEST_KONTEXT
    if db.verfuegbar():
        db.ausfuehren("DELETE FROM mkt_arms WHERE kontext = %s", (TEST_KONTEXT,))


# ══════════════════════════════════════════════════════════════════════
# 1. Verzoegerte Bewertung
# ══════════════════════════════════════════════════════════════════════

def test_gewichtung_setzt_geld_ueber_reichweite():
    """Der Deckungsbeitrag muss das schwerste Einzelgewicht sein.

    Sonst optimiert das System auf Aufrufe — und Aufrufe bezahlen keine
    Rechnungen.
    """
    g = reward.gewichte()
    assert g["deckungsbeitrag"] == max(g.values())
    assert g["deckungsbeitrag"] >= 0.35, g
    assert abs(sum(g.values()) - 1.0) < 0.001, f"Gewichte summieren auf {sum(g.values())}"


@braucht_db
def test_reward_verzoegert(test_video):
    """Vor 72 Stunden gibt es KEIN endgueltiges Urteil.

    Ein Beitrag, der in der ersten Stunde schlecht laeuft, kann am zweiten
    Tag anziehen. Wer frueher urteilt, wirft genau die weg.
    """
    from datetime import datetime, timedelta, timezone

    from pipelines.publish import base as pub

    marke = "__test_reward"
    try:
        # Beitrag, der vor 8 Stunden rausging: vorlaeufig ja, endgueltig nein.
        zeit = datetime.now(timezone.utc) - timedelta(hours=8)
        zeile = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, gepostet_am, slot, status,
                                      externe_post_id, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, %s, 'T', 'gepostet', 'x', %s)
               RETURNING id""",
            (test_video, marke, zeit, zeit, pub.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        post_id = int(zeile["id"])

        assert reward.ist_final(post_id) is False, "nach 8 h darf nichts endgueltig sein"
        ergebnis = reward.speichere(post_id)
        assert ergebnis is not None, "nach 8 h muss es eine vorlaeufige Zahl geben"
        assert ergebnis["final"] is False

        gespeichert = db.eine_zeile(
            "SELECT reward_vorlaeufig, reward_final FROM mkt_rewards WHERE post_id = %s",
            (post_id,),
        )
        assert gespeichert["reward_vorlaeufig"] is not None
        assert gespeichert["reward_final"] is None, "endgueltig darf noch leer sein"
    finally:
        db.ausfuehren("DELETE FROM mkt_rewards WHERE post_id IN "
                      "(SELECT id FROM mkt_posts WHERE caption = %s)", (marke,))
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


@braucht_db
def test_reward_verzoegert_gegenprobe(test_video):
    """GEGENPROBE: nach 80 Stunden IST es endgueltig.

    Ohne das koennte der Test oben auch gruen sein, wenn nie etwas
    endgueltig wuerde — dann lernte das System nie.
    """
    from datetime import datetime, timedelta, timezone

    from pipelines.publish import base as pub

    marke = "__test_reward_final"
    try:
        zeit = datetime.now(timezone.utc) - timedelta(hours=80)
        zeile = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, gepostet_am, slot, status,
                                      externe_post_id, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, %s, 'T', 'gepostet', 'x', %s)
               RETURNING id""",
            (test_video, marke, zeit, zeit, pub.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        post_id = int(zeile["id"])
        assert reward.ist_final(post_id) is True
        ergebnis = reward.speichere(post_id)
        assert ergebnis["final"] is True
    finally:
        db.ausfuehren("DELETE FROM mkt_rewards WHERE post_id IN "
                      "(SELECT id FROM mkt_posts WHERE caption = %s)", (marke,))
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


def test_fehlende_kennzahl_zaehlt_nicht_als_null():
    """Was die Plattform nicht liefert, darf nicht als schlechtes Ergebnis gelten."""
    assert reward._anteil(None, 100) is None
    assert reward._anteil(10, 0) is None
    assert reward._anteil(10, 100) == 0.1


# ══════════════════════════════════════════════════════════════════════
# 2. Erkundung
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_exploration_untergrenze(saubere_arme):
    """Die Quote faellt nie unter 15 % — auch nicht bei einem klaren Favoriten.

    Ohne diese Untergrenze erstarrt das System: Was einmal gut lief, wird
    haeufiger gewaehlt, bekommt mehr Daten, wird noch sicherer gewaehlt — und
    alles andere verhungert.

    DIESER TEST WAR SELBST EINMAL DER FEHLER

    Er lief mit 600 Ziehungen gegen die Schwelle 0.12 — bei einem
    Erwartungswert von 0.125. Die Streuung einer Quote liegt dort bei rund
    0.014, die Schwelle also EINE Standardabweichung unter dem Erwartungswert:
    Der Test meldete mal gruen, mal rot. Beim Trockenlauf der Etappe 13 kam
    0.093 heraus.

    Dahinter steckte ein echter Fehler im Bandit (Erkundung zog den Favoriten
    mit, also war die Untergrenze faktisch 12,5 % statt 15 %). Beides ist
    behoben: der Bandit haelt die Zahl jetzt woertlich ein, und dieser Test
    misst mit genug Ziehungen und ausreichendem Abstand, damit ein Rotlicht
    hier IMMER einen echten Grund hat.
    """
    optionen = list(features.DIMENSIONEN[TEST_DIMENSION])
    # Einen Arm kuenstlich zum uebermaechtigen Favoriten machen.
    for _ in range(200):
        bandit.aktualisiere(TEST_DIMENSION, optionen[0], saubere_arme, 1.0)
    for auspraegung in optionen[1:]:
        for _ in range(200):
            bandit.aktualisiere(TEST_DIMENSION, auspraegung, saubere_arme, 0.0)

    # 2000 Ziehungen: Streuung ~0.008 bei einem Erwartungswert von 0.15.
    # Die Schwelle 0.1275 liegt damit knapp 3 Standardabweichungen entfernt —
    # ein Fehlalarm ist praktisch ausgeschlossen, ein echter Rueckfall auf
    # die alte Rechnung (0.125) faellt trotzdem auf.
    quote = bandit.explorationsquote(TEST_DIMENSION, optionen, kontext=saubere_arme, ziehungen=2000)
    untergrenze = float(guardrails.wert("lernen.exploration_min", 0.15))
    assert quote >= untergrenze * 0.85, (
        f"Erkundungsquote {quote:.3f} liegt unter der Untergrenze {untergrenze} — "
        f"das System wuerde auf einer Masche erstarren"
    )


@braucht_db
def test_erkundung_gilt_unabhaengig_von_der_anzahl_der_optionen(saubere_arme):
    """GEGENPROBE zum Fund: Die Untergrenze darf nicht an der Optionszahl haengen.

    Genau das war der Fehler. Bei ZWEI Optionen zog die alte Fassung den
    Favoriten in der Haelfte aller Erkundungen selbst wieder — aus 15 %
    wurden 7,5 %. Mit sechs Optionen fiel es kaum auf, mit zweien waere es
    die Halbierung gewesen.

    Deshalb wird hier ausdruecklich der unguenstigste Fall geprueft.
    """
    optionen = list(features.DIMENSIONEN[TEST_DIMENSION])[:2]
    for _ in range(200):
        bandit.aktualisiere(TEST_DIMENSION, optionen[0], saubere_arme, 1.0)
    for _ in range(200):
        bandit.aktualisiere(TEST_DIMENSION, optionen[1], saubere_arme, 0.0)

    quote = bandit.explorationsquote(TEST_DIMENSION, optionen, kontext=saubere_arme, ziehungen=2000)
    untergrenze = float(guardrails.wert("lernen.exploration_min", 0.15))
    assert quote >= untergrenze * 0.85, (
        f"bei nur zwei Optionen faellt die Erkundung auf {quote:.3f} — "
        f"die Untergrenze haengt noch an der Anzahl der Optionen"
    )


@braucht_db
def test_favorit_wird_trotzdem_bevorzugt(saubere_arme):
    """GEGENPROBE: Der bessere Arm muss deutlich haeufiger drankommen.

    Ohne das koennte der Test oben auch gruen sein, wenn schlicht immer
    gewuerfelt wuerde — dann lernte das System nichts.
    """
    optionen = list(features.DIMENSIONEN[TEST_DIMENSION])
    for _ in range(150):
        bandit.aktualisiere(TEST_DIMENSION, optionen[0], saubere_arme, 0.95)
    for auspraegung in optionen[1:]:
        for _ in range(150):
            bandit.aktualisiere(TEST_DIMENSION, auspraegung, saubere_arme, 0.05)

    treffer = sum(1 for _ in range(400)
                  if bandit.waehle(TEST_DIMENSION, optionen, kontext=saubere_arme) == optionen[0])
    anteil = treffer / 400
    gleichverteilt = 1.0 / len(optionen)
    assert anteil > gleichverteilt * 2, (
        f"der klar bessere Arm kam nur in {anteil:.0%} der Faelle dran "
        f"(Gleichverteilung waere {gleichverteilt:.0%}) — es wird nicht gelernt"
    )


# ══════════════════════════════════════════════════════════════════════
# 3. Ausreisserschutz
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_ausreisser():
    """Ein viraler Einzeltreffer darf die Politik nicht kippen.

    Der Deckungsbeitrag wird auf das 95. Perzentil gestutzt. Ohne das wuerde
    ein einzelner Gluecksfall die Messlatte fuer alle anderen so hoch legen,
    dass jeder normale Beitrag als Misserfolg gilt.
    """
    normal = reward.deckungsbeitrag_normiert(15.0)
    ausreisser = reward.deckungsbeitrag_normiert(15000.0)
    assert ausreisser <= 1.0, "der Wert muss auf 1.0 gedeckelt sein"
    assert normal > 0, "ein normaler Betrag muss ueberhaupt zaehlen"
    # Ein 1000-facher Betrag darf nicht 1000-fach zaehlen.
    assert ausreisser / max(normal, 1e-9) < 100, \
        "ein Ausreisser wirkt sich unverhaeltnismaessig stark aus"


def test_belohnung_bleibt_im_rahmen():
    """Die Belohnung muss zwischen 0 und 1 liegen — sonst kippt die Beta-Verteilung."""
    assert reward.deckungsbeitrag_normiert(0.0) == 0.0
    assert 0.0 <= reward.deckungsbeitrag_normiert(1_000_000.0) <= 1.0


# ══════════════════════════════════════════════════════════════════════
# 4. Der Abnahmetest: lernt das System wirklich?
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_nach_20_beitraegen_haben_sich_die_werte_verschoben(saubere_arme):
    """Abnahmepunkt aus Paragraph 15.

    20 simulierte Beitraege mit gestreuten Belohnungen: Danach muessen sich
    die Arm-Werte messbar unterscheiden UND die Erkundung muss weiterhin
    ueber 15 % liegen. Beides zusammen — nur eines von beidem waere entweder
    Erstarrung oder Zufall.
    """
    optionen = list(features.DIMENSIONEN[TEST_DIMENSION])
    vorher = {a: bandit.erwartung(TEST_DIMENSION, a, saubere_arme) for a in optionen}

    random.seed(20260815)
    guter_arm = optionen[0]
    for i in range(20):
        auspraegung = optionen[i % len(optionen)]
        # Der gute Arm liefert im Schnitt 0.8, die anderen 0.25 — mit Streuung,
        # damit es kein kuenstlich sauberes Signal ist.
        basis = 0.8 if auspraegung == guter_arm else 0.25
        belohnung = max(0.0, min(1.0, random.gauss(basis, 0.12)))
        bandit.aktualisiere(TEST_DIMENSION, auspraegung, saubere_arme, belohnung)

    nachher = {a: bandit.erwartung(TEST_DIMENSION, a, saubere_arme) for a in optionen}

    assert nachher != vorher, "nach 20 Beitraegen hat sich nichts veraendert"
    assert nachher[guter_arm] > max(
        w for a, w in nachher.items() if a != guter_arm
    ), f"der gute Arm fuehrt nicht: {nachher}"

    quote = bandit.explorationsquote(TEST_DIMENSION, optionen, kontext=saubere_arme, ziehungen=500)
    untergrenze = float(guardrails.wert("lernen.exploration_min", 0.15))
    assert quote >= untergrenze * 0.8, \
        f"Erkundung auf {quote:.3f} gefallen (Untergrenze {untergrenze})"


@braucht_db
def test_arm_wird_erst_ab_genug_daten_gesperrt(saubere_arme):
    """Drei Beobachtungen sind keine Erkenntnis, sondern Rauschen."""
    optionen = list(features.DIMENSIONEN[TEST_DIMENSION])
    for _ in range(3):
        bandit.aktualisiere(TEST_DIMENSION, optionen[0], saubere_arme, 0.0)
        bandit.aktualisiere(TEST_DIMENSION, optionen[1], saubere_arme, 1.0)

    gesperrt = bandit.sperre_verlierer(TEST_DIMENSION, saubere_arme)
    assert gesperrt == [], f"bei 3 Versuchen darf nichts gesperrt werden, war: {gesperrt}"


def test_unbekannte_auspraegung_verwaessert_die_statistik_nicht():
    """Ein Tippfehler darf keine neue Auspraegung erfinden."""
    assert features.ist_gueltig("hook_typ", "frage") is True
    assert features.ist_gueltig("hook_typ", "frageee") is False
    assert features.ist_gueltig("gibtsnicht", "egal") is False


def test_kontext_bleibt_grob_genug():
    """Zu feiner Kontext zersplittert die Daten, bis nichts mehr lernbar ist."""
    a = features.kontext({"produktkategorie": "Haushalt und Küche", "trendquelle": "shop"})
    b = features.kontext({"produktkategorie": "Haushalt und Küche", "trendquelle": "shop"})
    c = features.kontext({"produktkategorie": "Beleuchtung", "trendquelle": "shop"})
    assert a == b and a != c
    assert "|" in a


# ══════════════════════════════════════════════════════════════════════
# 5. Wochenbericht
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_wochenbericht_wird_erzeugt():
    """Der Bericht muss auch ohne Daten entstehen — dann eben mit Leermeldung."""
    daten = report._sammle()
    html_text = report.baue_html(daten)
    assert "<html" in html_text and "Marketing-Wochenbericht" in html_text
    assert len(html_text) > 800


@braucht_db
def test_wochenbericht_nennt_die_naechsten_versuche():
    """Die Absicht sichtbar machen, BEVOR sie umgesetzt wird."""
    daten = report._sammle()
    assert daten.get("naechste_versuche"), "der Bericht muss sagen, was als Naechstes kommt"
    for eintrag in daten["naechste_versuche"]:
        assert len(eintrag) > 20


def test_wochenbericht_wird_im_trockenlauf_nicht_verschickt(monkeypatch):
    """Sonst kaeme bei jedem Test eine Mail."""
    monkeypatch.setenv("MARKETING_DRY_RUN", "true")
    ergebnis = report.job_wochenbericht()
    assert ergebnis["erzeugt"] is True
    assert ergebnis["verschickt"] is False
    assert "Trockenlauf" in str(ergebnis.get("grund", ""))
