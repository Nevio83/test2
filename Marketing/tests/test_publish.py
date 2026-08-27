"""Tests fuer die Veroeffentlichung.

Zwei Pflichttests aus dem Aufgabenzettel:
  * test_idempotenz_publish — derselbe Beitrag geht nie zweimal raus
  * test_dry_run            — im Trockenlauf verlaesst nichts das System

Der erste hat beim ersten Anlauf einen echten Fehler gefunden: Der
Fingerabdruck enthaelt den Sendeplatz, und der verschiebt sich bei jedem
Lauf (der vorige Lauf hat den frueheren Platz belegt). Zwei Durchgaenge
erzeugten dadurch 6 statt 3 Beitraege — jeder mit einem eigenen, formal
gueltigen Fingerabdruck. Erst eine zweite eindeutige Regel in der Datenbank
("ein lebender Beitrag je Video und Plattform") hat es dicht gemacht.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from conftest import braucht_db
from pipelines import db
from pipelines.orchestrator import guardrails
from pipelines.publish import base, slots
from pipelines.publish.instagram import Instagram
from pipelines.publish.tiktok import TikTok
from pipelines.publish.youtube import YouTube


class MitschriftPlattform(base.Plattform):
    """Plattform-Nachbau, der mitschreibt, ob wirklich gepostet wurde."""

    name = "tiktok"   # muss freigeschaltet sein, damit sie benutzt wird

    def __init__(self):
        self.aufrufe = []

    def bereit(self):
        return True, None

    def poste(self, beitrag):
        self.aufrufe.append(beitrag)
        return "test-123"


def _beitrag(post_id: int = 1, video_id: int = 1) -> base.Beitrag:
    return base.Beitrag(
        post_id=post_id, video_id=video_id, video_pfad=Path("x.mp4"),
        plattform="tiktok", caption="Werbung. Link im Profil.",
        hashtags=["#fyp"], geplant_fuer=datetime.now(timezone.utc),
        slot="Mo 12:30", produkt_id=1, stil="A",
    )


# ══════════════════════════════════════════════════════════════════════
# 1. Idempotenz
# ══════════════════════════════════════════════════════════════════════

def test_fingerabdruck_ist_stabil():
    """Gleiche Eingaben, gleicher Fingerabdruck — sonst schuetzt er nichts."""
    zeitpunkt = datetime(2026, 8, 20, 12, 30, tzinfo=timezone.utc)
    a = base.idempotenz_schluessel(7, "tiktok", zeitpunkt)
    b = base.idempotenz_schluessel(7, "tiktok", zeitpunkt)
    assert a == b


def test_fingerabdruck_ignoriert_sekunden():
    """Auf die Minute genau — sonst erzeugen zwei Laeufe zwei Abdruecke.

    Zwei Laeufe berechnen denselben Sendeplatz minimal verschieden. Ohne das
    Abschneiden waere der Schutz wirkungslos.
    """
    basis = datetime(2026, 8, 20, 12, 30, 0, tzinfo=timezone.utc)
    spaeter = basis + timedelta(seconds=41)
    assert base.idempotenz_schluessel(7, "tiktok", basis) == \
           base.idempotenz_schluessel(7, "tiktok", spaeter)


def test_fingerabdruck_unterscheidet_plattformen():
    zeitpunkt = datetime(2026, 8, 20, 12, 30, tzinfo=timezone.utc)
    assert base.idempotenz_schluessel(7, "tiktok", zeitpunkt) != \
           base.idempotenz_schluessel(7, "youtube", zeitpunkt)


@braucht_db
def test_idempotenz_publish(test_video):
    """Der Pflichttest: derselbe Beitrag entsteht nur EINMAL.

    Geprueft wird gegen die echte Datenbank, weil genau sie den Schutz
    durchsetzt — ein Nachbau wuerde nur den Nachbau bestaetigen.
    """
    marke = "__test_idem"
    try:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))
        zeitpunkt = datetime.now(timezone.utc) + timedelta(days=2)
        video_id = test_video

        eingefuegt = 0
        for versatz in (0, 3600, 7200):   # jedes Mal ein ANDERER Sendeplatz
            zeit = zeitpunkt + timedelta(seconds=versatz)
            zeile = db.eine_zeile(
                """INSERT INTO mkt_posts
                     (video_id, plattform, caption, hashtags, geplant_fuer, slot,
                      status, idempotenz_schluessel)
                   VALUES (%s, 'tiktok', %s, '[]', %s, 'Test', 'dry_run', %s)
                   ON CONFLICT DO NOTHING RETURNING id""",
                (video_id, marke, zeit,
                 base.idempotenz_schluessel(video_id, "tiktok", zeit)),
            )
            if zeile:
                eingefuegt += 1

        assert eingefuegt == 1, (
            f"{eingefuegt} Beitraege fuer dasselbe Video angelegt — es darf nur einer sein. "
            f"Genau hier ist der erste Anlauf gescheitert: verschobene Sendeplaetze "
            f"erzeugten je einen eigenen Fingerabdruck."
        )
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


@braucht_db
def test_idempotenz_gegenprobe():
    """GEGENPROBE: OHNE die zweite Regel waeren es drei Beitraege.

    Belegt, dass der Fingerabdruck allein nicht genuegt haette — die drei
    Abdruecke sind naemlich tatsaechlich verschieden.
    """
    zeitpunkt = datetime.now(timezone.utc)
    abdruecke = {
        base.idempotenz_schluessel(1, "tiktok", zeitpunkt + timedelta(hours=h))
        for h in (0, 1, 2)
    }
    assert len(abdruecke) == 3, (
        "die Abdruecke sind gleich — dann haette der Fingerabdruck allein gereicht "
        "und dieser Test prueft nichts"
    )


@braucht_db
def test_fehlgeschlagene_beitraege_duerfen_wiederholt_werden(test_video):
    """Nach einem Fehler muss ein neuer Versuch moeglich sein.

    Sonst waere ein einmal gescheiterter Beitrag fuer immer blockiert.
    """
    marke = "__test_wiederholung"
    try:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))
        zeit = datetime.now(timezone.utc) + timedelta(days=3)
        db.ausfuehren(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'fehler', %s)""",
            (test_video, marke, zeit, base.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        neu = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'geplant', %s)
               ON CONFLICT DO NOTHING RETURNING id""",
            (test_video, marke, zeit + timedelta(hours=1),
             base.idempotenz_schluessel(test_video, "tiktok", zeit + timedelta(hours=1))),
        )
        assert neu is not None, "nach einem Fehler muss ein neuer Versuch moeglich sein"
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


# ══════════════════════════════════════════════════════════════════════
# 2. Trockenlauf
# ══════════════════════════════════════════════════════════════════════

@braucht_db
def test_dry_run(monkeypatch, test_video):
    """Im Trockenlauf verlaesst KEIN Beitrag das System."""
    monkeypatch.setenv("MARKETING_DRY_RUN", "true")
    plattform = MitschriftPlattform()

    marke = "__test_dry"
    try:
        zeit = datetime.now(timezone.utc) + timedelta(days=4)
        zeile = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'geplant', %s) RETURNING id""",
            (test_video, marke, zeit, base.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        beitrag = _beitrag(post_id=int(zeile["id"]), video_id=test_video)
        beitrag = base.Beitrag(**{**beitrag.__dict__, "caption": "Werbung. Link im Profil."})

        gesendet = base.sende(beitrag, plattform)
        assert gesendet is False, "im Trockenlauf darf nichts gesendet werden"
        assert plattform.aufrufe == [], "die Plattform wurde trotz Trockenlauf angesprochen"

        stand = db.eine_zeile("SELECT status FROM mkt_posts WHERE id = %s", (beitrag.post_id,))
        assert stand["status"] == "dry_run"
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


@braucht_db
def test_dry_run_gegenprobe(monkeypatch, test_video):
    """GEGENPROBE: OHNE Trockenlauf wird die Plattform wirklich angesprochen.

    Ohne das koennte der Test oben auch gruen sein, wenn generell nie
    gepostet wuerde.
    """
    monkeypatch.setenv("MARKETING_DRY_RUN", "false")
    plattform = MitschriftPlattform()

    marke = "__test_echt"
    try:
        zeit = datetime.now(timezone.utc) + timedelta(days=5)
        zeile = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'geplant', %s) RETURNING id""",
            (test_video, marke, zeit, base.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        beitrag = _beitrag(post_id=int(zeile["id"]), video_id=test_video)
        gesendet = base.sende(beitrag, plattform)
        assert gesendet is True, "ausserhalb des Trockenlaufs muss gesendet werden"
        assert len(plattform.aufrufe) == 1
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


@braucht_db
def test_compliance_wird_vor_dem_posten_nochmal_geprueft(monkeypatch, test_video):
    """Zwischen Planen und Senden koennen Stunden liegen.

    In der Zeit kann sich der Preis geaendert haben — ein Beitrag mit dem
    Preis von gestern ist eine falsche Preisangabe.
    """
    monkeypatch.setenv("MARKETING_DRY_RUN", "false")
    plattform = MitschriftPlattform()

    marke = "__test_compliance"
    try:
        zeit = datetime.now(timezone.utc) + timedelta(days=6)
        zeile = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                      geplant_fuer, slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'geplant', %s) RETURNING id""",
            (test_video, marke, zeit, base.idempotenz_schluessel(test_video, "tiktok", zeit)),
        )
        # Bildunterschrift mit Heilversprechen — muss abgewiesen werden.
        beitrag = base.Beitrag(
            post_id=int(zeile["id"]), video_id=test_video, video_pfad=Path("x.mp4"),
            plattform="tiktok", caption="Das lindert Verspannungen. Werbung.",
            hashtags=[], geplant_fuer=zeit, slot="T", produkt_id=1, stil="A",
        )
        gesendet = base.sende(beitrag, plattform)
        assert gesendet is False
        assert plattform.aufrufe == [], "ein gesperrter Beitrag darf die Plattform nie erreichen"
        stand = db.eine_zeile("SELECT status FROM mkt_posts WHERE id = %s", (beitrag.post_id,))
        assert stand["status"] == "fehler"
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


# ══════════════════════════════════════════════════════════════════════
# 3. Sendeplaetze
# ══════════════════════════════════════════════════════════════════════

def test_slots_kommen_aus_der_konfiguration():
    liste = slots.slot_liste()
    assert liste, "keine Sendeplaetze konfiguriert"
    for eintrag in liste:
        stunde, minute = eintrag.split(":")
        assert 0 <= int(stunde) < 24 and 0 <= int(minute) < 60


def test_slot_name_ist_lernbar():
    """Fuer das Lernen zaehlt Wochentag x Uhrzeit, nicht der Zeitpunkt.

    Ein konkreter Zeitpunkt kommt nie wieder vor und waere wertlos.
    """
    name = slots.slot_name(datetime(2026, 8, 17, 12, 30, tzinfo=timezone.utc))
    assert any(tag in name for tag in ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"))
    assert ":" in name


@braucht_db
def test_mindestabstand_wird_eingehalten(test_videos):
    """Zwei Beitraege derselben Plattform duerfen nicht aufeinander liegen.

    Es braucht DREI verschiedene Videos: Seit der Regel "ein lebender Beitrag
    je Video und Plattform" laesst sich das mit einem einzigen Video gar
    nicht mehr nachstellen — der erste Anlauf dieses Tests ist genau daran
    gescheitert, und das war die Regel, die korrekt zugeschlagen hat.
    """
    min_stunden = float(guardrails.wert("veroeffentlichung.min_abstand_stunden", 3))
    videos = test_videos(3)
    marke = "__test_abstand"
    zeiten = []
    try:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))
        for video_id in videos:
            zeit = slots.naechster_slot("tiktok")
            if zeit is None:
                break
            zeiten.append(zeit)
            db.ausfuehren(
                """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags,
                                          geplant_fuer, slot, status, idempotenz_schluessel)
                   VALUES (%s, 'tiktok', %s, '[]', %s, 'T', 'dry_run', %s)""",
                (video_id, marke, zeit,
                 base.idempotenz_schluessel(video_id, "tiktok", zeit)),
            )
        assert len(zeiten) >= 2, "es liessen sich nicht genug Sendeplaetze vergeben"
        for a, b in zip(zeiten, zeiten[1:]):
            abstand = abs((b - a).total_seconds()) / 3600.0
            assert abstand >= min_stunden - 0.01, \
                f"nur {abstand:.1f} h Abstand, gefordert sind {min_stunden} h"
    finally:
        db.ausfuehren("DELETE FROM mkt_posts WHERE caption = %s", (marke,))


# ══════════════════════════════════════════════════════════════════════
# 4. Plattformen
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("plattform_klasse", [TikTok, Instagram, YouTube])
def test_plattform_ohne_zugangsdaten_nennt_den_grund(plattform_klasse, monkeypatch):
    """Ohne Zugang: sauber uebersprungen, mit Begruendung im Klartext."""
    for name in ("TIKTOK_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY", "TIKTOK_SESSION_ID",
                 "TIKTOK_CHROME_PROFILE", "IG_ACCESS_TOKEN", "IG_USER_ID",
                 "MARKETING_PUBLIC_VIDEO_BASE", "YT_CLIENT_ID", "YT_CLIENT_SECRET",
                 "YT_REFRESH_TOKEN"):
        monkeypatch.delenv(name, raising=False)

    plattform = plattform_klasse()
    bereit, grund = plattform.bereit()
    assert bereit is False
    assert grund and len(grund) > 10, f"Begruendung zu duenn: {grund}"


def test_nur_freigeschaltete_plattformen():
    """Was nicht in der Konfiguration steht, wird nicht bespielt."""
    erlaubt = {str(p).lower() for p in
               (guardrails.wert("veroeffentlichung.plattformen", []) or [])}
    for plattform in base.aktive_plattformen():
        assert plattform.name in erlaubt


def test_tiktok_laeuft_bis_zum_absenden_durch():
    """Der alte Stand hoerte nach dem Ausfuellen auf — ein Mensch musste posten.

    Geprueft am Programmtext: Es muss einen Klick auf den Absende-Knopf UND
    ein Warten auf die Bestaetigung geben.
    """
    quelltext = Path(TikTok.__module__.replace(".", "/") + ".py")
    from pipelines.publish import tiktok as modul

    text = Path(modul.__file__).read_text(encoding="utf-8")
    assert "knopf.click()" in text, "kein Klick auf den Absende-Knopf"
    assert "wurde gepostet" in text or "was posted" in text, \
        "es wird nicht auf die Bestaetigung gewartet"


def test_ki_kennzeichnung_wird_an_die_plattform_gemeldet():
    """Bei Stil B muss das Plattform-Feld fuer KI-Inhalte gesetzt werden."""
    from pipelines.publish import tiktok as tt
    from pipelines.publish import youtube as yt

    assert '"is_aigc": beitrag.stil == "B"' in Path(tt.__file__).read_text(encoding="utf-8")
    assert '"containsSyntheticMedia": beitrag.stil == "B"' in \
        Path(yt.__file__).read_text(encoding="utf-8")


# ══════════════════════════════════════════════════════════════════════
# 5. Kennung im Link
# ══════════════════════════════════════════════════════════════════════

def test_shop_link_traegt_die_kennung():
    """Ohne Kennung laesst sich keine Bestellung zuordnen.

    Das ist die Bruecke von Reichweite zu Umsatz — ohne sie ist Etappe 9
    (Messung bis zur Bestellung) unmoeglich.
    """
    from pipelines import products

    produkt = products.alle()[0]
    zeile = {"hook_varianten": [{"typ": "frage", "text": "Kennst du das?"}],
             "cta": "Link im Profil. Werbung.", "hashtags": ["#fyp"]}
    caption, hashtags = base.baue_caption(zeile, produkt, "mkt_42")

    assert "utm_campaign=mkt_42" in caption
    assert "utm_source=tiktok" in caption
    assert produkt.slug in caption, "der Link muss auf die Produktseite zeigen"
    assert "Werbung" in caption, "Werbekennzeichnung fehlt"
