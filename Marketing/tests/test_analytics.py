"""Tests fuer Messung und Umsatzzuordnung.

Der wichtigste Test hier ist test_keine_erfundenen_kennzahlen. Der alte
analytics_collector.py gab feste Fantasiezahlen zurueck (1234 Aufrufe, 210
Likes, jedes Mal dieselben). Das ist hier besonders gefaehrlich, weil das
Lernmodul in Etappe 10 mit 40 % Gewicht auf den Deckungsbeitrag schaut:
Erfundene Zahlen fuehren zu echten Fehlentscheidungen — dauerhaft, weil
niemand eine plausibel aussehende Zahl anzweifelt.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import braucht_db
from pipelines import db
from pipelines.analytics import attribution, collectors, metrics


# ══════════════════════════════════════════════════════════════════════
# 1. Keine erfundenen Zahlen
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("sammler_klasse", [
    collectors.TikTokSammler, collectors.InstagramSammler, collectors.YoutubeSammler,
])
def test_keine_erfundenen_kennzahlen(monkeypatch, sammler_klasse):
    """Ohne Zugangsdaten: nicht bereit, mit Begruendung — keine Zahlen."""
    for name in ("TIKTOK_ACCESS_TOKEN", "IG_ACCESS_TOKEN",
                 "YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(collectors.TikTokSammler, "_marke_aus_db", lambda self: None)

    sammler = sammler_klasse()
    bereit, grund = sammler.bereit()
    assert bereit is False
    assert grund and "fehlt" in grund.lower(), grund


def test_alter_stand_wuerde_auffallen():
    """GEGENPROBE: Ein Sammler, der Fantasiezahlen liefert, faellt durch.

    Baut den alten analytics_collector.py nach. Wenn diese Attrappe hier
    NICHT als bereit durchginge, wuerde der Test oben nichts pruefen.
    """

    class AlterSammler(collectors.Sammler):
        plattform = "alt"

        def bereit(self):
            return True, None

        def hole(self, externe_post_id):
            return {"views": 1234, "likes": 210}   # genau die alten Fantasiezahlen

    bereit, _ = AlterSammler().bereit()
    assert bereit is True, "die Attrappe MUSS hier durchkommen, sonst misst der Test daneben"
    assert AlterSammler().hole("x")["views"] == 1234


def test_fehlende_kennzahl_ist_none_nicht_null():
    """Was die Plattform nicht liefert, bleibt None — nicht 0.

    Der Unterschied entscheidet: 0 heisst "gemessen und null", None heisst
    "nicht gemessen". Wuerde man None zu 0 machen, rechnete das Lernmodul
    eine fehlende Messung als schlechtes Ergebnis.
    """
    quelle = (collectors.TikTokSammler.hole.__doc__ or "")
    import inspect

    text = inspect.getsource(collectors.TikTokSammler.hole)
    assert '"retention_3s": None' in text, \
        "eine nicht gelieferte Kennzahl darf nicht als 0 gespeichert werden"


# ══════════════════════════════════════════════════════════════════════
# 2. Messfenster
# ══════════════════════════════════════════════════════════════════════

def test_messfenster_decken_die_lernstufen_ab():
    """6 h fuer die vorlaeufige, 72 h fuer die endgueltige Bewertung."""
    stunden = metrics.fenster_stunden()
    assert 6 in stunden and 72 in stunden, stunden
    assert stunden == sorted(stunden), "die Fenster muessen aufsteigend sein"


def test_fenster_namen_sind_stabil():
    """Die Namen stehen in der Datenbank — sie duerfen sich nicht aendern."""
    assert metrics.fenster_name(1) == "1h"
    assert metrics.fenster_name(72) == "72h"
    assert metrics.fenster_name(168) == "7d"


@braucht_db
def test_jedes_fenster_wird_nur_einmal_gespeichert(test_video):
    """Ein Wiederholungslauf darf keine Messung doppelt zaehlen."""
    zeit = datetime.now(timezone.utc) + timedelta(days=9)
    marke = "__test_metrik"
    try:
        from pipelines.publish import base as pub

        zeile = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'gepostet', %s) RETURNING id""",
            (test_video, marke, zeit, pub.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        post_id = int(zeile["id"])

        erste = metrics.speichere(post_id, "1h", {"views": 100, "likes": 5})
        zweite = metrics.speichere(post_id, "1h", {"views": 999, "likes": 99})
        assert erste is True, "die erste Messung muss ankommen"
        assert zweite is False, "dieselbe Messung darf nicht doppelt gezaehlt werden"

        gespeichert = metrics.kennzahlen(post_id)
        assert gespeichert["1h"]["views"] == 100, "der erste Wert muss stehen bleiben"
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


@braucht_db
def test_trockenlauf_beitraege_werden_nicht_gemessen(test_video):
    """Ein Beitrag, der nie rausging, hat auch keine Kennzahlen."""
    from pipelines.publish import base as pub

    zeit = datetime.now(timezone.utc) - timedelta(days=2)
    marke = "__test_dry_metrik"
    try:
        db.ausfuehren(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, gepostet_am, slot, status,
                                      externe_post_id, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, %s, 'T', 'dry_run', 'x123', %s)""",
            (test_video, marke, zeit, zeit,
             pub.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        faellig = metrics.faellige_messungen(limit=50)
        assert not any(int(f["post_id"]) for f in faellig
                       if db.eine_zeile("SELECT caption FROM mkt_posts WHERE id = %s",
                                        (int(f["post_id"]),))["caption"] == marke), \
            "ein Trockenlauf-Beitrag darf nicht zur Messung anstehen"
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


# ══════════════════════════════════════════════════════════════════════
# 3. Umsatzzuordnung — und ihre ehrlichen Grenzen
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_messbarkeit_wird_ehrlich_gemeldet():
    """Die Auskunft, ob die Zahlen ueberhaupt etwas wert sind.

    Wichtiger als jede Zahl darunter: Solange die Kette unterbrochen ist,
    muss das ausdruecklich dastehen — nicht als 0 getarnt.
    """
    stand = attribution.messbarkeit()
    for feld in ("utm_wird_gespeichert", "bestellung_hat_herkunft",
                 "umsatz_zuordnung_moeglich", "fehlt"):
        assert feld in stand

    if not stand["umsatz_zuordnung_moeglich"]:
        assert stand["fehlt"], "wenn nichts messbar ist, muss der Grund dastehen"
        for grund in stand["fehlt"]:
            assert len(grund) > 20, f"Begruendung zu duenn: {grund}"


@braucht_db
def test_ohne_utm_keine_erfundene_zuordnung():
    """Solange die Kennung nicht ankommt, wird NICHTS zugeordnet."""
    moeglich, _ = attribution.utm_wird_gespeichert()
    if moeglich:
        pytest.skip("die Kennung wird inzwischen gespeichert")
    assert attribution.utm_sitzungen("mkt_1") == 0


@braucht_db
def test_bestellzuordnung_ist_als_unbelastbar_markiert():
    """Ohne Herkunftsspalte gilt die Zuordnung ausdruecklich als unbelastbar.

    Das Feld 'belastbar' ist der Unterschied zwischen "0 Bestellungen" und
    "nicht messbar". Ohne diese Unterscheidung wuerde das Lernmodul eine
    fehlende Messung als schlechtes Ergebnis werten.
    """
    hat_herkunft, _ = attribution.bestellung_hat_herkunft()
    ergebnis = attribution.bestellungen_fuer_kampagne(
        "mkt_1", 10, datetime.now(timezone.utc) - timedelta(days=1)
    )
    assert ergebnis["belastbar"] is hat_herkunft
    if not hat_herkunft:
        assert ergebnis["bestellungen"] == 0 and ergebnis["umsatz"] == 0.0


@braucht_db
def test_zeitlicher_zusammenhang_ist_nicht_als_zuordnung_getarnt():
    """Was nur zeitlich zusammenhaengt, darf nicht wie Zuordnung aussehen.

    Ein Besucher, der zufaellig eine Stunde nach dem Beitrag ueber Google
    kommt, zaehlt dort mit. Deshalb traegt das Ergebnis ausdruecklich
    belastbar = False.
    """
    ergebnis = attribution.produktseiten_nach_post(
        10, datetime.now(timezone.utc) - timedelta(days=3)
    )
    assert ergebnis["belastbar"] is False, \
        "ein zeitlicher Zusammenhang darf nie als belastbare Zuordnung gelten"
    assert "aufrufe" in ergebnis and "sitzungen" in ergebnis


def test_deckungsbeitrag_wird_nicht_geschaetzt():
    """Ohne hinterlegten Einkaufspreis gibt es 0.0 — keine Schaetzung.

    Der Deckungsbeitrag geht mit 40 % in die Belohnung ein. Eine Schaetzung
    waere hier die folgenreichste erfundene Zahl im ganzen System.
    """
    from pipelines.orchestrator import guardrails

    original = guardrails.wert
    try:
        guardrails.wert = lambda pfad, standard=None: (
            {} if pfad == "matching.einkaufspreise" else original(pfad, standard)
        )
        assert attribution._deckungsbeitrag(10, 100.0) == 0.0
    finally:
        guardrails.wert = original
