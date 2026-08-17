"""Tests fuer das Fundament: Claim, Faelligkeit, Notaus, Budget, Selbstanpassung.

Zu jedem Test gehoert eine GEGENPROBE, die zeigt, dass er das falsche
Verhalten auch wirklich rot melden wuerde. Ein Test, der nur gruen werden
kann, ist wertlos (CLAUDE.md Paragraph 2).
"""

from __future__ import annotations

import json
import threading

import pytest

from conftest import braucht_db, lege_job_an
from pipelines import db
from pipelines.orchestrator import guardrails, state


# ══════════════════════════════════════════════════════════════════════
# 1. Zwei Runner, ein Job
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_claim_race(test_job):
    """Zwei gleichzeitige Runner duerfen denselben Job nicht doppelt starten."""
    lege_job_an(test_job, faellig=True)

    ergebnisse: list[bool] = []
    sperre = threading.Lock()
    start = threading.Barrier(2)

    def versuche(nr: int) -> None:
        start.wait()  # beide moeglichst gleichzeitig losschicken
        ok = state.uebernimm(test_job, lauf_id=f"runner-{nr}", kann_lokal=True)
        with sperre:
            ergebnisse.append(ok)

    faeden = [threading.Thread(target=versuche, args=(i,)) for i in (1, 2)]
    for f in faeden:
        f.start()
    for f in faeden:
        f.join(timeout=20)

    assert len(ergebnisse) == 2, "beide Faeden muessen geantwortet haben"
    assert sum(ergebnisse) == 1, (
        f"genau EIN Runner darf uebernehmen, es waren {sum(ergebnisse)}"
    )


@braucht_db
def test_claim_race_gegenprobe(test_job):
    """GEGENPROBE: 'erst lesen, dann schreiben' laesst beide durch.

    Baut den naheliegenden Fehler nach, den uebernimm() vermeidet. Wenn diese
    Gegenprobe gruen ist, weiss man: der Test oben misst wirklich etwas.
    """
    lege_job_an(test_job, faellig=True)

    ergebnisse: list[bool] = []
    sperre = threading.Lock()
    start = threading.Barrier(2)

    def naiv(nr: int) -> None:
        # Erst pruefen …
        zeile = db.eine_zeile(
            "SELECT naechster_lauf <= now() AS faellig FROM mkt_jobs WHERE job = %s",
            (test_job,),
        )
        faellig = bool(zeile and zeile["faellig"])
        start.wait()  # … und genau hier passt der zweite Runner dazwischen
        if faellig:
            db.ausfuehren(
                "UPDATE mkt_jobs SET naechster_lauf = now() + make_interval(secs => abstand_sek) WHERE job = %s",
                (test_job,),
            )
        with sperre:
            ergebnisse.append(faellig)

    faeden = [threading.Thread(target=naiv, args=(i,)) for i in (1, 2)]
    for f in faeden:
        f.start()
    for f in faeden:
        f.join(timeout=20)

    assert sum(ergebnisse) == 2, (
        "die naive Variante MUSS doppelt starten — sonst prueft test_claim_race nichts"
    )


# ══════════════════════════════════════════════════════════════════════
# 2. Faelligkeit ueberlebt den Neustart
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_faelligkeit(test_job):
    """Ein Neustart setzt den Zeitplan NICHT zurueck.

    Genau der Fehler, der im Projekt am 02.08. nachgemessen wurde: Weckt der
    Zeitplan im Prozess, laeuft ein Tagesjob bei zwei Deploys taeglich fast
    nie. Hier wird der zweite "Prozessstart" dadurch nachgestellt, dass
    einfach erneut uebernommen wird — der Zustand liegt ja in der Datenbank.
    """
    lege_job_an(test_job, abstand_sek=3600, faellig=True)

    assert state.uebernimm(test_job, lauf_id="lauf-1", kann_lokal=True) is True, \
        "der faellige Job muss beim ersten Mal uebernommen werden"
    state.abschliessen(test_job, ereignis_id=None, ergebnis="ok", dauer_ms=1)

    # "Neustart": neuer Runner, gleicher Job, sofort danach.
    assert state.uebernimm(test_job, lauf_id="lauf-2", kann_lokal=True) is False, \
        "nach dem Lauf ist der Job erst in einer Stunde wieder dran"

    zeile = db.eine_zeile(
        "SELECT EXTRACT(EPOCH FROM (naechster_lauf - now()))::int AS rest FROM mkt_jobs WHERE job = %s",
        (test_job,),
    )
    assert 3000 < zeile["rest"] <= 3600, f"naechster Lauf sollte ~1 h entfernt sein, ist {zeile['rest']}s"


@braucht_db
def test_faelligkeit_gegenprobe(test_job):
    """GEGENPROBE: Ist der Termin wieder erreicht, wird auch wieder uebernommen.

    Ohne das koennte test_faelligkeit auch dann gruen sein, wenn uebernimm()
    grundsaetzlich False liefert.
    """
    lege_job_an(test_job, abstand_sek=3600, faellig=True)
    assert state.uebernimm(test_job, lauf_id="a", kann_lokal=True) is True
    state.abschliessen(test_job, ereignis_id=None, ergebnis="ok", dauer_ms=1)

    db.ausfuehren(
        "UPDATE mkt_jobs SET naechster_lauf = now() - interval '1 second' WHERE job = %s",
        (test_job,),
    )
    assert state.uebernimm(test_job, lauf_id="b", kann_lokal=True) is True, \
        "wieder faellig -> muss wieder uebernommen werden"


@braucht_db
def test_abgestuerzter_lauf_wird_freigegeben(test_job):
    """Ein Lauf ohne Herzschlag blockiert nicht ewig.

    Stirbt ein Runner mitten im Job, bleibt laeuft_seit stehen. Ohne
    Freigabe waere der Job fuer immer belegt.
    """
    lege_job_an(test_job, faellig=True)
    assert state.uebernimm(test_job, lauf_id="gestorben", kann_lokal=True) is True

    # Job wieder faellig machen, aber als "laeuft noch" markiert lassen.
    db.ausfuehren(
        "UPDATE mkt_jobs SET naechster_lauf = now() - interval '1 second' WHERE job = %s",
        (test_job,),
    )
    assert state.uebernimm(test_job, lauf_id="neu", kann_lokal=True) is False, \
        "solange der Herzschlag frisch ist, darf niemand uebernehmen"

    # Herzschlag altern lassen (aelter als heartbeat_timeout_minuten).
    db.ausfuehren(
        "UPDATE mkt_jobs SET heartbeat_at = now() - interval '90 minutes' WHERE job = %s",
        (test_job,),
    )
    assert state.uebernimm(test_job, lauf_id="neu2", kann_lokal=True) is True, \
        "toter Lauf muss freigegeben werden"


@braucht_db
def test_lokaler_job_nicht_in_actions(test_job):
    """Ein Job mit requires_local darf in GitHub Actions nicht anlaufen."""
    lege_job_an(test_job, faellig=True, requires_local=True)
    assert state.uebernimm(test_job, lauf_id="actions", kann_lokal=False) is False
    assert state.uebernimm(test_job, lauf_id="lokal", kann_lokal=True) is True


# ══════════════════════════════════════════════════════════════════════
# 3. Notaus — drei unabhaengige Wege
# ══════════════════════════════════════════════════════════════════════

def test_notaus_ueber_env(monkeypatch):
    """Weg 1: MARKETING_ENABLED=false haelt alles an."""
    monkeypatch.setenv("MARKETING_ENABLED", "false")
    assert guardrails.notaus_aktiv() is True
    assert "MARKETING_ENABLED" in guardrails.notaus_grund()


def test_notaus_ueber_datei(monkeypatch, tmp_path):
    """Weg 2: die Datei Marketing/STOP haelt alles an."""
    monkeypatch.setenv("MARKETING_ENABLED", "true")
    stopp = tmp_path / "STOP"
    monkeypatch.setattr(guardrails, "STOP_DATEI", stopp)
    assert guardrails.notaus_aktiv() is False, "ohne Datei darf nichts blockieren"
    stopp.write_text("angehalten")
    assert guardrails.notaus_aktiv() is True
    assert "Notaus-Datei" in guardrails.notaus_grund()


@braucht_db
def test_notaus_ueber_db_flag(monkeypatch, test_job):
    """Weg 3: mkt_jobs.enabled = false — der Schalter im Dashboard."""
    monkeypatch.setenv("MARKETING_ENABLED", "true")
    monkeypatch.setattr(guardrails, "STOP_DATEI", guardrails.MARKETING_DIR / "__gibt_es_nicht__")

    lege_job_an(test_job, faellig=True, enabled=True)
    assert guardrails.notaus_grund(test_job) is None

    state.setze_enabled(test_job, False)
    assert guardrails.notaus_grund(test_job) is not None
    assert state.uebernimm(test_job, lauf_id="x", kann_lokal=True) is False, \
        "ein abgeschalteter Job darf nicht uebernommen werden"


def test_notaus_gegenprobe(monkeypatch, tmp_path):
    """GEGENPROBE: ohne jeden Ausloeser meldet notaus_grund() None.

    Sonst koennten die drei Tests oben auch dann gruen sein, wenn das System
    grundsaetzlich blockiert.
    """
    monkeypatch.setenv("MARKETING_ENABLED", "true")
    monkeypatch.setenv("MARKETING_DRY_RUN", "true")
    monkeypatch.setattr(guardrails, "STOP_DATEI", tmp_path / "gibt_es_nicht")
    assert guardrails.notaus_grund() is None


# ══════════════════════════════════════════════════════════════════════
# 4. Trockenlauf
# ══════════════════════════════════════════════════════════════════════

def test_trockenlauf_ist_standard(monkeypatch):
    """Ohne ausdrueckliche Freigabe wird nichts veroeffentlicht."""
    monkeypatch.delenv("MARKETING_DRY_RUN", raising=False)
    guardrails.konfig.cache_clear()
    assert guardrails.trockenlauf() is True, \
        "Standard MUSS Trockenlauf sein — sonst postet ein Versehen live"


def test_trockenlauf_nur_per_env_abschaltbar(monkeypatch):
    """Auf false stellt nur ein Mensch, und nur ueber die ENV."""
    monkeypatch.setenv("MARKETING_DRY_RUN", "false")
    assert guardrails.trockenlauf() is False
    # Es darf keine Funktion geben, die das aus dem Code heraus umschaltet.
    assert not any(
        name.startswith("setze_trockenlauf") or name.startswith("set_dry")
        for name in dir(guardrails)
    ), "der Code darf den Trockenlauf nicht selbst abschalten koennen"


# ══════════════════════════════════════════════════════════════════════
# 5. Budgetwaechter — umschalten statt abbrechen
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_budget_guard():
    """Bei erschoepftem Budget wird umgeschaltet, NICHT abgebrochen."""
    grenze_cent = int(round(float(guardrails.wert("budget.tag_euro", 3.0)) * 100))
    marke = "__test_budget"
    try:
        db.ausfuehren(
            "INSERT INTO mkt_cost_ledger (anbieter, endpunkt, einheiten, kosten_cent, job) "
            "VALUES (%s, 'test', 1, %s, %s)",
            (marke, grenze_cent + 100, marke),
        )
        darf, grund = guardrails.darf_kosten_verursachen(10)
        assert darf is False, "ueber der Tagesgrenze darf nichts Kostenpflichtiges mehr laufen"
        assert grund and "budget" in grund.lower(), f"der Grund muss das Budget nennen, war: {grund}"
        # Entscheidend: es fliegt KEINE Ausnahme — der Aufrufer kann umschalten.
    finally:
        db.ausfuehren("DELETE FROM mkt_cost_ledger WHERE anbieter = %s", (marke,))


@braucht_db
def test_budget_guard_gegenprobe():
    """GEGENPROBE: ohne verbrauchtes Budget ist derselbe Aufruf erlaubt."""
    darf, grund = guardrails.darf_kosten_verursachen(1)
    assert darf is True, f"bei leerem Konto muss es erlaubt sein, war gesperrt mit: {grund}"


# ══════════════════════════════════════════════════════════════════════
# 6. Grenzen der Selbstanpassung
# ══════════════════════════════════════════════════════════════════════

def test_guardrail_selbstanpassung():
    """Das System darf sein eigenes Budget NICHT erhoehen."""
    vorher = float(guardrails.wert("budget.tag_euro"))
    uebernommen = guardrails.uebernehme_gelernte_werte(
        {"budget.tag_euro": vorher + 1000}, job="__test"
    )
    assert uebernommen == {}, "die Aenderung haette abgelehnt werden muessen"

    guardrails.lade_overrides(neu=True)
    nachher = float(guardrails.wert("budget.tag_euro"))
    assert nachher == vorher, f"Budget wurde veraendert: {vorher} -> {nachher}"

    if db.verfuegbar():
        zeile = db.eine_zeile(
            "SELECT count(*) AS n FROM mkt_config_overrides WHERE pfad = 'budget.tag_euro'"
        )
        assert zeile["n"] == 0, "ein verbotener Pfad darf nicht einmal gespeichert werden"


@braucht_db
def test_guardrail_selbstanpassung_gegenprobe():
    """GEGENPROBE: ein ERLAUBTER Wert wird sehr wohl uebernommen.

    Ohne das koennte der Test oben auch gruen sein, wenn schlicht jede
    Aenderung abgelehnt wird — dann koennte das System nie lernen.
    """
    pfad = "trend_score.w1_velocity"
    try:
        vorher = float(guardrails.wert(pfad))
        neu = round(vorher + 0.05, 4)
        uebernommen = guardrails.uebernehme_gelernte_werte({pfad: neu}, job="__test")
        assert uebernommen == {pfad: neu}, "erlaubte Aenderung wurde abgelehnt"

        # Entscheidend: der Wert kommt jetzt aus der Datenbank, nicht aus der
        # Datei — er ueberlebt damit einen fluechtigen Actions-Checkout.
        guardrails.lade_overrides(neu=True)
        assert float(guardrails.wert(pfad)) == neu

        aus_db = db.eine_zeile("SELECT wert FROM mkt_config_overrides WHERE pfad = %s", (pfad,))
        assert aus_db is not None and float(aus_db["wert"]) == neu
    finally:
        guardrails.setze_override_zurueck(pfad)


@braucht_db
def test_gelernte_werte_ueberleben_prozessende():
    """Der eigentliche Zweck: ein Neustart darf Gelerntes nicht verlieren.

    Nachgestellt wird der Neustart, indem der Zwischenspeicher im Prozess
    geleert und der Wert erneut aus der Datenbank geholt wird. Stuende er in
    der Konfigurationsdatei, waere er in GitHub Actions beim naechsten Lauf
    weg — der Automat wuerde ewig mit den Startwerten arbeiten.
    """
    pfad = "video.stil_mix"
    try:
        guardrails.uebernehme_gelernte_werte({pfad: {"A": 0.4, "B": 0.6}}, job="__test")
        guardrails.lade_overrides(neu=True)       # "neuer Prozess"
        guardrails.konfig.cache_clear()           # Datei-Zwischenspeicher auch
        assert guardrails.wert(pfad) == {"A": 0.4, "B": 0.6}
    finally:
        guardrails.setze_override_zurueck(pfad)
        guardrails.lade_overrides(neu=True)


def test_verbotene_pfade_einzeln():
    """Die vier ausdruecklich verbotenen Bereiche aus Paragraph 7.3."""
    for pfad in (
        "budget.tag_euro",
        "budget.monat_euro",
        "matching.mindest_marge_prozent",
        "veroeffentlichung.plattformen",
        "trockenlauf.standard",
    ):
        assert guardrails.darf_aendern(pfad) is False, f"'{pfad}' darf NICHT aenderbar sein"
    with pytest.raises(guardrails.AenderungVerboten):
        guardrails.pruefe_aenderung("budget.tag_euro")
