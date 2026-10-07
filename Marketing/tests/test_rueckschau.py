"""Punkt 62: Die monatliche Rueckschau — beste und schwaechste Beitraege nebeneinander.

Geprueft wird die Regel aus dem Papier ("was zweimal zu den Besten gehoert,
wird Vorgabe; was zweimal unten steht, fliegt raus") und das, was sie NICHT
tun darf: aus zu wenigen Beitraegen Vorschlaege machen, vorlaeufige Zahlen
mitzaehlen oder Stil C uebersehen.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from conftest import braucht_db
from pipelines import db
from pipelines.learning import rueckschau as rs


def _stil_c(vorlage: str, *, musik: str = "bett-ruhig-90bpm.mp3", dauer: float = 14.0,
            creator: str = "smart_produkt", plattform: str = "tiktok") -> dict:
    """Eine Datenbankzeile, wie bewertete_beitraege() sie liefert."""
    return {"stil": "C", "dauer_sek": dauer, "produkt_id": 10, "slot": "Di 18:00", "merkmale": None,
            "bericht": {"stil": "C", "vorlage": vorlage, "musik": musik, "hook": "Nie wieder schleppen",
                        "herkunft": [{"material": "fremd", "creator": creator, "plattform": plattform,
                                      "video_id": "7410474104903453984"},
                                     {"material": "fremd", "creator": creator, "plattform": plattform,
                                      "video_id": "7520000000000000001"}]}}


# ── Merkmale ─────────────────────────────────────────────────────────

def test_laengenklassen_am_fertigen_video():
    assert rs.laenge_klasse(9.5) == "unter 12 s"
    assert rs.laenge_klasse(12.0) == "12–18 s"
    assert rs.laenge_klasse(24.9) == "18–25 s"
    assert rs.laenge_klasse(31) == "über 25 s"
    # Gegenprobe: Fehlt die Dauer, gibt es keine Klasse — nicht "unter 12 s".
    assert rs.laenge_klasse(None) is None and rs.laenge_klasse(0) is None


def test_stil_c_bringt_vorlage_bett_laenge_und_quelle_mit():
    paare = rs.merkmale_des_beitrags(_stil_c("problem-loesung"))
    assert ("vorlage", "problem-loesung") in paare
    assert ("musikstueck", "bett-ruhig-90bpm.mp3") in paare
    assert ("laenge", "12–18 s") in paare
    assert ("plattform", "tiktok") in paare and ("creator", "smart_produkt") in paare
    # Keine Frage der Vorlage: die Kennung des Rohclips und der Sendeplatz.
    assert not any(d in ("rohclip", "posting_slot") for d, _ in paare)
    # Zwei Clips desselben Creators: ein Merkmal, nicht zwei.
    assert paare.count(("creator", "smart_produkt")) == 1


def test_stil_a_bringt_die_gesteuerten_merkmale_mit():
    zeile = {"stil": "A", "dauer_sek": 22.0, "slot": "Mo 12:00", "bericht": None, "produkt_id": 10,
             "merkmale": {"videostil": "A", "hook_typ": "frage", "musik": "treibend",
                          "videolaenge": "22", "produktkategorie": "Haushalt"}}
    paare = rs.merkmale_des_beitrags(zeile)
    assert ("hook_typ", "frage") in paare and ("videostil", "A") in paare and ("musik", "treibend") in paare
    assert ("laenge", "18–25 s") in paare


# ── Die Regel ────────────────────────────────────────────────────────

def test_zweimal_oben_und_nie_unten_ist_ein_kandidat_fuer_die_vorlage():
    oben = [[("vorlage", "vorher_nachher")], [("vorlage", "vorher_nachher")], [("vorlage", "drei_gruende")]]
    unten = [[("vorlage", "auspacken_kurz")], [("vorlage", "auspacken_kurz")], [("vorlage", "drei_gruende")]]
    ergebnis = rs.vergleiche(oben, unten)
    assert [(e["wert"], e["oben"]) for e in ergebnis["uebernehmen"]] == [("vorher_nachher", 2)]
    assert [(e["wert"], e["unten"]) for e in ergebnis["streichen"]] == [("auspacken_kurz", 2)]
    # Was oben UND unten steht, unterscheidet nichts — und wird so benannt.
    assert [e["wert"] for e in ergebnis["beides"]] == ["drei_gruende"]


def test_einmal_oben_ist_noch_kein_muster():
    oben = [[("vorlage", "alltag_szene")], [("vorlage", "vorher_nachher")]]
    ergebnis = rs.vergleiche(oben, [[("vorlage", "x")]])
    assert ergebnis["uebernehmen"] == []
    # Gegenprobe: Mit der Schwelle 1 waere es einer — die Zwei ist die Regel.
    assert len(rs.vergleiche(oben, [[("vorlage", "x")]], wiederholung=1)["uebernehmen"]) == 2


def test_zweimal_oben_aber_auch_einmal_unten_ist_kein_kandidat():
    oben = [[("musikstueck", "a.mp3")], [("musikstueck", "a.mp3")]]
    unten = [[("musikstueck", "a.mp3")]]
    ergebnis = rs.vergleiche(oben, unten)
    assert ergebnis["uebernehmen"] == [] and len(ergebnis["beides"]) == 1


def test_gezaehlt_werden_beitraege_nicht_nennungen():
    # Ein Beitrag mit demselben Merkmal zweimal (zwei Clips eines Creators)
    # darf allein nicht "zweimal oben" ergeben.
    oben = [[("creator", "a"), ("creator", "a")]]
    assert rs.vergleiche(oben, [])["uebernehmen"] == []


# ── Zu wenige Beitraege ──────────────────────────────────────────────

def _bewertet(anzahl: int) -> list[dict]:
    vorlagen = ["vorher_nachher", "vorher_nachher", "drei_gruende", "alltag_szene", "problem_loesung"]
    zeilen = []
    for i in range(anzahl):
        zeile = _stil_c(vorlagen[i % len(vorlagen)] if i < 5 else "auspacken_kurz")
        zeile.update({"id": 100 + i, "wert": round(1.0 - i * 0.05, 3)})
        zeilen.append(zeile)
    return zeilen


def test_unter_zehn_beitraegen_gibt_es_keine_vorschlaege():
    ergebnis = rs.rueckschau(_bewertet(9))
    assert ergebnis["ok"] is False and ergebnis["anzahl_bewertet"] == 9
    assert "mindestens 10" in ergebnis["grund"]
    # Warum: Bei neun waere Beitrag 104 zugleich unter den besten und den
    # schwaechsten fuenf.
    ids = [z["id"] for z in _bewertet(9)]
    assert set(ids[:5]) & set(ids[-5:]) == {104}


def test_ab_zehn_beitraegen_stehen_beste_und_schwaechste_nebeneinander():
    ergebnis = rs.rueckschau(list(reversed(_bewertet(10))))       # Reihenfolge der Eingabe egal
    assert ergebnis["ok"] is True
    assert [b["id"] for b in ergebnis["beste"]] == [100, 101, 102, 103, 104]
    assert [b["id"] for b in ergebnis["schwaechste"]] == [105, 106, 107, 108, 109]
    assert ("vorher_nachher", 2) in [(e["wert"], e["oben"]) for e in ergebnis["uebernehmen"]]
    assert ("auspacken_kurz", 5) in [(e["wert"], e["unten"]) for e in ergebnis["streichen"]]
    text = rs.als_text(ergebnis)
    assert "Kandidat für die Vorlage" in text and "Geändert wurde nichts" in text


def test_ohne_bewertungen_sagt_der_text_warum():
    assert rs.als_text(rs.rueckschau([])).startswith("Rückschau nicht möglich: nur 0 Beiträge")


# ── Im Wochenbericht ─────────────────────────────────────────────────

def test_der_erste_wochenbericht_des_monats_traegt_die_rueckschau():
    from datetime import datetime as dt

    from pipelines.learning import report

    assert report.rueckschau_faellig(dt(2026, 11, 2)) and report.rueckschau_faellig(dt(2026, 11, 7))
    # Gegenprobe: in der zweiten Woche nicht — sonst kaeme sie viermal im Monat.
    assert not report.rueckschau_faellig(dt(2026, 11, 8))

    mit = report.baue_html({"rueckschau": rs.rueckschau(_bewertet(10)), "naechste_versuche": []})
    assert "Monatliche Rueckschau" in mit and "vorher_nachher" in mit and "auspacken_kurz" in mit
    zu_wenig = report.baue_html({"rueckschau": rs.rueckschau(_bewertet(3)), "naechste_versuche": []})
    assert "mindestens 10" in zu_wenig, "auch 'zu wenig' gehoert in den Bericht"
    ohne = report.baue_html({"naechste_versuche": []})
    assert "Monatliche Rueckschau" not in ohne


# ── Gegen die echte Datenbank ────────────────────────────────────────

@pytest.fixture
def bewertete_testbeitraege():
    """Drei Stil-C-Beitraege ohne Briefing: endgueltig, vorlaeufig, nur geplant."""
    if not db.verfuegbar():
        yield None
        return
    marke = f"__test_rueckschau_{uuid.uuid4().hex[:8]}"
    zeit = datetime.now(timezone.utc) - timedelta(days=2)
    angelegt: list[tuple[int, int]] = []
    for nr, (status, final, vorlaeufig) in enumerate(
            [("gepostet", 0.9, 0.9), ("gepostet", None, 0.95), ("geplant", 0.99, 0.99)]):
        video = db.eine_zeile(
            """INSERT INTO mkt_videos (brief_id, stil, pfad, pruefergebnis, produkt_id, dauer_sek, bericht)
               VALUES (NULL, 'C', %s, 'ok', 10, 14.0, %s) RETURNING id""",
            (f"{marke}_{nr}.mp4", json.dumps(_stil_c("vorher_nachher")["bericht"])),
        )
        post = db.eine_zeile(
            """INSERT INTO mkt_posts (video_id, plattform, caption, hashtags, geplant_fuer, gepostet_am,
                                      slot, status, idempotenz_schluessel)
               VALUES (%s, 'tiktok', %s, '[]', %s, %s, 'Di 18:00', %s, %s) RETURNING id""",
            (video["id"], marke, zeit, zeit if status == "gepostet" else None, status, f"{marke}_{nr}"),
        )
        db.ausfuehren("INSERT INTO mkt_rewards (post_id, reward_vorlaeufig, reward_final) VALUES (%s, %s, %s)",
                      (post["id"], vorlaeufig, final))
        angelegt.append((int(post["id"]), int(video["id"])))
    yield [p for p, _ in angelegt]
    for post_id, video_id in angelegt:
        try:
            db.ausfuehren("DELETE FROM mkt_rewards WHERE post_id = %s", (post_id,))
            db.ausfuehren("DELETE FROM mkt_posts WHERE id = %s", (post_id,))
            db.ausfuehren("DELETE FROM mkt_videos WHERE id = %s", (video_id,))
        except Exception:
            pass


@braucht_db
def test_nur_veroeffentlichte_mit_endgueltiger_bewertung_zaehlen(bewertete_testbeitraege):
    endgueltig, vorlaeufig, geplant = bewertete_testbeitraege
    gefunden = {int(z["id"]) for z in rs.bewertete_beitraege(tage=30)}
    # Stil C ohne Briefing ist dabei — mit einem INNER JOIN auf mkt_briefs fehlte er.
    assert endgueltig in gefunden
    # Gegenprobe: die vorlaeufige Zahl (0,95) und der nie veroeffentlichte
    # Beitrag (0,99) waeren beide "besser" — und bleiben trotzdem draussen.
    assert vorlaeufig not in gefunden and geplant not in gefunden
    zeile = next(z for z in rs.bewertete_beitraege(tage=30) if int(z["id"]) == endgueltig)
    assert ("vorlage", "vorher_nachher") in rs.merkmale_des_beitrags(zeile)
