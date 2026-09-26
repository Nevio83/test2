"""Punkt 59: Herkunft als Lernmerkmal — und Stil C ueberhaupt im Lernen.

Beim Bau aufgefallen: Vier Abfragen verbanden Beitrag und Produkt hart ueber
mkt_briefs. Stil C hat kein Briefing (brief_id ist leer) — jeder Stil-C-Beitrag
fiel damit still heraus:

  * policy.merkmale_von_post      -> der Bandit wurde nie gefuettert
  * attribution.berechne_fuer_post -> KEIN Umsatz zugeordnet
  * matcher.zu_oft_beworben       -> zaehlte nicht zur Wochengrenze
  * report (beste Beitraege)      -> tauchte nie auf

Keine Fehlermeldung, nur Nullen. Die Datenbankproben hier legen deshalb einen
echten Stil-C-Beitrag an und pruefen, dass er ankommt — mit Gegenprobe gegen
die alte Abfrage.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from conftest import braucht_db
from pipelines import db, matcher
from pipelines.analytics import attribution
from pipelines.learning import features, policy
from pipelines.video import style_c_schnittliste as sc


BERICHT = {
    "stil": "C",
    "musik": "bett-ruhig-90bpm.mp3",
    "vorlage": "problem-loesung",
    "herkunft": [
        {"datei": "a.mp4", "material": "fremd", "tiktok_id": "7410474104903453984", "creator": "smart_produkt"},
        {"datei": "b.mp4", "material": "fremd", "tiktok_id": "7520000000000000001", "creator": "smart_produkt"},
        {"datei": "c.mp4", "material": "eigen", "tiktok_id": None, "creator": None},
    ],
}


# ── Merkmale aus dem Bericht ─────────────────────────────────────────

def test_herkunftsmerkmale_aus_dem_bericht():
    paare = features.herkunftsmerkmale(BERICHT)
    assert ("vorlage", "problem-loesung") in paare
    assert ("musikstueck", "bett-ruhig-90bpm.mp3") in paare
    assert ("material", "gemischt") in paare
    # Zwei Clips desselben Creators: EIN Arm, nicht zwei Gutschriften.
    assert paare.count(("creator", "smart_produkt")) == 1
    assert ("rohclip", "7410474104903453984") in paare
    assert ("rohclip", "7520000000000000001") in paare
    # Eigenes Material hat weder Creator noch Kennung — und erfindet keinen.
    assert not any(d == "creator" and not w for d, w in paare)


def test_der_hook_ist_ein_merkmal():
    """Bei Hook-Varianten (Punkt 58) ist der Hook das Einzige, was sich unterscheidet."""
    paare = features.herkunftsmerkmale({**BERICHT, "hook": "  Nie wieder schleppen  ", "hook_variante": "b"})
    assert ("hook", "Nie wieder schleppen") in paare
    # GEGENPROBE: ohne Hook kein Arm mit leerem Namen.
    assert not any(d == "hook" for d, _ in features.herkunftsmerkmale({**BERICHT, "hook": "  "}))


def test_alter_bericht_ohne_herkunft_erfindet_nichts():
    paare = features.herkunftsmerkmale({"stil": "C", "musik": "x.mp3", "quellen": ["a.mp4"]})
    assert paare == [("musikstueck", "x.mp3")]
    assert features.herkunftsmerkmale(None) == []
    assert features.herkunftsmerkmale("kaputt") == []


def test_herkunft_wird_nur_beobachtet_nie_gesperrt():
    """Ein Creator darf nicht nach drei Beitraegen automatisch gesperrt werden.

    sperre_verlierer() laeuft nur ueber STEUERBAR. Stuende eine Herkunfts-
    Dimension dort, entschiede der Automat ueber fremdes Material.
    """
    for dimension in features.BEOBACHTET:
        assert dimension not in features.STEUERBAR, dimension
        assert dimension in features.DIMENSIONEN, dimension
    for dimension, wert in features.herkunftsmerkmale(BERICHT):
        assert features.ist_gueltig(dimension, wert), (dimension, wert)


# ── Zuordnung ohne Briefing ──────────────────────────────────────────

def test_stil_c_ohne_briefing_bekommt_eine_zuordnung():
    zuordnung = policy.merkmale_aus_zeile(
        {"merkmale": None, "slot": "Di 18:00", "stil": "C", "produkt_id": 10,
         "bericht": json.dumps(BERICHT)}
    )
    assert zuordnung is not None, "Stil C faellt aus dem Lernen"
    vektor, kontext, herkunft = zuordnung
    # Gesteuert wurde nur der Sendeplatz — Hook-Machart & Co. werden nicht geraten.
    assert vektor == {"posting_slot": "Di 18:00"}
    assert kontext.endswith("|schnittliste")
    assert ("creator", "smart_produkt") in herkunft


def test_gegenprobe_ohne_produkt_und_briefing_gibt_es_nichts_zu_lernen():
    assert policy.merkmale_aus_zeile({"merkmale": None, "slot": "x", "produkt_id": None}) is None


def test_briefing_beitraege_lernen_wie_vorher():
    merkmale = {"videostil": "A", "hook_typ": "frage", "produktkategorie": "Haushalt", "trendquelle": "shop"}
    vektor, kontext, herkunft = policy.merkmale_aus_zeile(
        {"merkmale": merkmale, "slot": "Mo 12:00", "produkt_id": None, "bericht": None}
    )
    assert vektor == {"videostil": "A", "hook_typ": "frage", "posting_slot": "Mo 12:00"}
    assert kontext == "Haushalt|shop"
    assert herkunft == []


# ── Herkunft beim Rendern ────────────────────────────────────────────

def test_herkunft_der_quellen_aus_name_und_index(tmp_path, monkeypatch):
    fremd = tmp_path / "roh" / "01_wasserspender_14s_stil-b_7410474104903453984.mp4"
    ohne = tmp_path / "roh" / "alt-ohne-kennung.mp4"
    eigen_ordner = tmp_path / "eigenes"
    eigen = eigen_ordner / "handy.mp4"
    for datei in (fremd, ohne, eigen):
        datei.parent.mkdir(parents=True, exist_ok=True)
        datei.write_bytes(b"x")
    monkeypatch.setattr(sc.assets, "EIGENES_ROHMATERIAL", eigen_ordner)

    index = tmp_path / "index.json"
    index.write_text(json.dumps({"eintraege": [
        {"video_id": "7410474104903453984", "creator": "smart_produkt", "datei": fremd.name},
    ]}), encoding="utf-8")

    liste = sc.Schnittliste(produkt_id=10, segmente=[
        sc.Segment(quelle=fremd), sc.Segment(quelle=fremd, von=2.0),
        sc.Segment(quelle=ohne), sc.Segment(quelle=eigen),
    ])
    herkunft = {h["datei"]: h for h in sc.herkunft_der_quellen(liste, index_pfad=index)}
    assert len(herkunft) == 3, "derselbe Clip zweimal ist EINE Quelle"
    assert herkunft[fremd.name] == {"datei": fremd.name, "material": "fremd",
                                    "tiktok_id": "7410474104903453984", "creator": "smart_produkt"}
    # Kein Name, kein Index-Eintrag: leer statt geraten.
    assert herkunft[ohne.name]["tiktok_id"] is None and herkunft[ohne.name]["creator"] is None
    assert herkunft[eigen.name]["material"] == "eigen"


def test_ohne_index_bleibt_die_kennung_aus_dem_dateinamen(tmp_path):
    fremd = tmp_path / "01_x_9s_stil-b_7410474104903453984.mp4"
    fremd.write_bytes(b"x")
    liste = sc.Schnittliste(produkt_id=10, segmente=[sc.Segment(quelle=fremd)])
    [h] = sc.herkunft_der_quellen(liste, index_pfad=tmp_path / "gibt-es-nicht.json")
    assert h["tiktok_id"] == "7410474104903453984"
    assert h["creator"] is None


def test_vorlagenname_wird_beim_lesen_uebernommen(tmp_path, monkeypatch):
    monkeypatch.setattr(sc.common, "medien_info", lambda p: None)
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"x")
    pfad = tmp_path / "fassung.json"
    inhalt = {"_vorlage": {"name": "drei-gruende"}, "produkt_id": 10,
              "segmente": [{"quelle": str(clip), "von": 0, "bis": 9}]}
    pfad.write_text(json.dumps(inhalt), encoding="utf-8")
    assert sc.lies(pfad).vorlage == "drei-gruende"

    # GEGENPROBE: ohne Vorlagenkopf kein erfundener Name.
    del inhalt["_vorlage"]
    pfad.write_text(json.dumps(inhalt), encoding="utf-8")
    assert sc.lies(pfad).vorlage is None


# ── Gegen die echte Datenbank ────────────────────────────────────────

ALTE_ABFRAGE = """SELECT b.merkmale, p.slot
                    FROM mkt_posts p
                    JOIN mkt_videos v ON v.id = p.video_id
                    JOIN mkt_briefs b ON b.id = v.brief_id
                   WHERE p.id = %s"""


@pytest.fixture
def stil_c_beitrag():
    """Ein gepostetes Stil-C-Video ohne Briefing, danach restlos entfernt."""
    if not db.verfuegbar():
        yield None
        return
    marke = f"__test_stilc_{uuid.uuid4().hex[:8]}"
    video = db.eine_zeile(
        """INSERT INTO mkt_videos (brief_id, stil, pfad, pruefergebnis, produkt_id, schnittliste, bericht)
           VALUES (NULL, 'C', %s, 'ok', 10, %s, %s) RETURNING id""",
        (f"{marke}.mp4", f"{marke}.json", json.dumps(BERICHT)),
    )
    zeit = datetime.now(timezone.utc) - timedelta(hours=8)
    post = db.eine_zeile(
        """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags, geplant_fuer,
                                  gepostet_am, slot, status, externe_post_id, idempotenz_schluessel)
           VALUES (%s, 'tiktok', %s, '[]', %s, %s, 'Di 18:00', 'gepostet', 'x', %s)
           RETURNING id""",
        (video["id"], marke, zeit, zeit, marke),
    )
    yield int(post["id"])
    try:
        db.ausfuehren("DELETE FROM mkt_attribution WHERE post_id = %s", (post["id"],))
        db.ausfuehren("DELETE FROM mkt_posts WHERE id = %s", (post["id"],))
        db.ausfuehren("DELETE FROM mkt_videos WHERE id = %s", (video["id"],))
    except Exception:
        pass


@braucht_db
def test_stil_c_beitrag_kommt_im_lernen_an(stil_c_beitrag):
    # GEGENPROBE zuerst: Die alte Abfrage sieht den Beitrag nicht.
    assert db.eine_zeile(ALTE_ABFRAGE, (stil_c_beitrag,)) is None, \
        "die alte Abfrage haette ihn gesehen — dann war der Fehler nie da"

    zuordnung = policy.merkmale_von_post(stil_c_beitrag)
    assert zuordnung is not None, "Stil C faellt weiterhin aus dem Lernen"
    _, kontext, herkunft = zuordnung
    assert kontext.endswith("|schnittliste")
    assert ("creator", "smart_produkt") in herkunft
    assert ("vorlage", "problem-loesung") in herkunft


@braucht_db
def test_stil_c_beitrag_bekommt_eine_umsatzzuordnung(stil_c_beitrag):
    ergebnis = attribution.berechne_fuer_post(stil_c_beitrag)
    assert ergebnis is not None, "Stil C bekommt keinen Umsatz zugeordnet"
    zeile = db.eine_zeile("SELECT utm_kampagne FROM mkt_attribution WHERE post_id = %s",
                          (stil_c_beitrag,))
    assert zeile is not None and zeile["utm_kampagne"].startswith("mkt_")


def _anzahl(text: str) -> int:
    return int(re.search(r"(\d+)×", text).group(1))


@braucht_db
def test_stil_c_zaehlt_zur_wochengrenze(stil_c_beitrag):
    jetzt = _anzahl(matcher.zu_oft_beworben(10)[1])
    zeile = db.eine_zeile(
        """SELECT COUNT(*)::int AS n FROM mkt_posts p
             JOIN mkt_videos v ON v.id = p.video_id
             JOIN mkt_briefs b ON b.id = v.brief_id
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE m.produkt_id = 10 AND p.erstellt_am > now() - interval '7 days'
              AND p.status <> 'fehler'""",
    )
    alt = int(zeile["n"])
    # Die alte Zaehlung sieht KEINEN Stil-C-Beitrag, die neue mindestens den
    # angelegten. ">=" statt "==", weil echte Stil-C-Beitraege dazukommen koennen.
    assert jetzt >= alt + 1, f"neu {jetzt}, alt {alt} — der Stil-C-Beitrag zaehlt nicht"
