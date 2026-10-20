"""Punkt 61: Antwortbausteine fuer Kommentare — nur aus echten Quellen.

Die Fehlerklasse, gegen die das hier steht, hat das Projekt schon mehrfach
getroffen: eine zweite Liste, die vom Shop abweicht (Marketing-Produktliste mit
11 falschen Preisen), und Angaben, die echt aussehen, aber erfunden sind
(Bewertungen auf 40 Produktseiten). Eine Antwort unter einem Video ist dieselbe
Werbeaussage wie das Video selbst.
"""

from __future__ import annotations

import json
import re
from dataclasses import replace

import pytest

from pipelines import products
from pipelines.creative import antworten as an
from pipelines.env_loader import REPO_ROOT


@pytest.fixture(scope="module")
def angaben():
    return an.shop_angaben()


def _ergebnis(produkt_id, angaben, **extra):
    produkt = products.nach_id(produkt_id)
    return produkt, an.bausteine(produkt, angaben=angaben, arten=an.zahlarten(),
                                 varianten=an.ausfuehrungen(produkt_id), **extra)


def _text(liste):
    return "\n".join(b["antwort"] for b in liste)


# ── Quellen ─────────────────────────────────────────────────────────

def test_versand_und_rueckgabe_kommen_aus_den_dateien_des_shops(angaben):
    assert "DE" in angaben["laender"] and "US" in angaben["laender"]
    assert angaben["kosten"]["DE"] == 0 and angaben["kosten"]["US"] == 12
    assert angaben["rueckgabe"] == 30
    # Nur Lieferlaender: Kanada steht in der Kostentabelle, beliefert wird es nicht.
    assert "CA" not in angaben["kosten"]


def test_zahlarten_nur_bei_eindeutigem_muster():
    assert an.zahlarten() == ["Karte", "Klarna"]
    # GEGENPROBE: Aendert sich die Kasse, steht hier nichts statt einer alten Liste.
    echt = (REPO_ROOT / "server.js").read_text(encoding="utf-8")
    assert an.zahlarten(echt.replace("const paymentMethods = ['card'];", "const zahlarten = holeZahlarten();")) is None
    ohne_klarna = echt.replace("paymentMethods.push('klarna')", "/* klarna aus */")
    assert an.zahlarten(ohne_klarna) == ["Karte"]


# ── Jede Zahl hat eine Quelle ───────────────────────────────────────

def test_jede_zahl_in_den_antworten_steht_in_einer_quelle(angaben):
    for produkt_id in (10, 11, 12, 28):
        produkt, liste = _ergebnis(produkt_id, angaben)
        roh = next(p for p in json.loads(products.PRODUKTE_DATEI.read_text(encoding="utf-8"))
                   if int(p["id"]) == produkt_id)
        erlaubt = {f"{produkt.preis:.2f}".replace(".", ","), str(angaben["rueckgabe"])}
        erlaubt |= {f"{float(k):.2f}".replace(".", ",") for k in angaben["kosten"].values()}
        erlaubt |= set(re.findall(r"\d+", str(roh.get("shippingTime") or "")))
        erlaubt.add(str(len(an.ausfuehrungen(produkt_id)[0])))
        zahlen = set(re.findall(r"\d+(?:,\d{2})?", _text(liste)))
        assert zahlen <= erlaubt, f"Produkt {produkt_id}: ohne Quelle {sorted(zahlen - erlaubt)}"


def test_streichpreis_und_buendelpreise_kommen_nie_vor(angaben):
    roh = {int(p["id"]): p for p in json.loads(products.PRODUKTE_DATEI.read_text(encoding="utf-8"))}
    for produkt_id in (10, 11):
        _, liste = _ergebnis(produkt_id, angaben)
        text = _text(liste)
        verboten = [roh[produkt_id]["originalPrice"]] + [b.get("bundlePrice") for b in roh[produkt_id].get("bundles") or []]
        for betrag in verboten:
            if betrag is not None:
                assert f"{float(betrag):.2f}".replace(".", ",") not in text, f"{betrag} steht in der Antwort"


def test_der_preis_folgt_der_quelle(angaben, monkeypatch):
    # GEGENPROBE gegen eine eingetippte Zahl: Aendert sich der Preis in der
    # Quelle, aendert sich die Antwort.
    produkt = replace(products.nach_id(10), preis=12.34)
    liste = an.bausteine(produkt, angaben=angaben, arten=None, varianten=([], True))
    assert "12,34 €" in _text(liste)
    assert "38,99" not in _text(liste)


def test_ohne_ausfuehrungen_keine_farbbehauptung(angaben):
    _, liste = _ergebnis(12, angaben)          # Produkt 12 hat keine colors
    satz = next(b["antwort"] for b in liste if b["frage"].startswith("Gibt's"))
    assert satz == "Im Shop gibt es davon eine Ausführung."
    _, mit = _ergebnis(10, angaben)
    assert "Schwarz und Weiß" in _text(mit)


def test_fehlt_eine_quelle_faellt_der_baustein_weg():
    produkt = replace(products.nach_id(10), lieferzeit=None)
    liste = an.bausteine(produkt, angaben=None, arten=None, varianten=([], True))
    fragen = [b["frage"] for b in liste]
    assert not any(f.startswith(("Wie lange", "Versand", "Kann ich", "Wie kann")) for f in fragen)
    # Und der Preissatz behauptet dann auch keinen kostenlosen Versand.
    assert "kostenlos" not in _text(liste)


# ── Die Selbstpruefung ──────────────────────────────────────────────

def test_die_echten_antworten_bestehen_die_eigene_pruefung(angaben):
    for produkt_id in (10, 11, 12, 28):
        produkt, liste = _ergebnis(produkt_id, angaben)
        versand = tuple(angaben["kosten"].values())
        for b in liste:
            assert an.pruefe_text(b["antwort"], produkt, versand) == [], b


@pytest.mark.parametrize("satz, grund", [
    ("Nur noch 3 Stück da!", "Knappheit"),
    ("Kostet 38,99 € inkl. 19 % MwSt.", "Umsatzsteuer"),
    ("Statt 51,99 € jetzt 38,99 €", "Streichpreis"),
    ("Über 2000 Kunden und 5 Sterne!", "Bewertung"),
    ("Auch mit PayPal", "Zahlart"),
    ("Kostet 29,00 €", "keiner Quelle"),
])
def test_untergeschobene_aussagen_werden_gemeldet(satz, grund):
    gruende = an.pruefe_text(satz, products.nach_id(10), (0.0, 12.0))
    assert any(grund.lower() in g.lower() for g in gruende), gruende


def test_versandkosten_sind_kein_falscher_preis():
    # Die vorhandene Preispruefung kennt nur den Produktpreis und haette die
    # 12,00 EUR in die USA gesperrt. GEGENPROBE: ohne die Versandkosten als
    # erlaubte Betraege wird derselbe Satz gemeldet.
    satz = "USA: 12,00 €."
    assert an.pruefe_text(satz, products.nach_id(10), (0.0, 12.0)) == []
    assert an.pruefe_text(satz, products.nach_id(10), ()) != []


# ── Link mit Kennung ────────────────────────────────────────────────

def test_der_link_traegt_dieselbe_kennung_wie_der_beitrag(angaben):
    _, liste = _ergebnis(10, angaben, kampagne="mkt_42")
    link = next(b for b in liste if b["frage"] == "Link?")
    assert link["antwort"] == "Den Link findest du in meinem Profil."
    assert "utm_campaign=mkt_42" in link["zum_kopieren"] and "utm_source=tiktok" in link["zum_kopieren"]
    assert link["zum_kopieren"].startswith("https://maiosshop.com/produkte/elektrischer-wasserspender-fuer-schreibtisch.html?")
    # Ohne Beitrag kein Link zum Kopieren — eine Adresse ohne Kennung waere keiner Bestellung zuzuordnen.
    _, ohne = _ergebnis(10, angaben)
    assert "zum_kopieren" not in next(b for b in ohne if b["frage"] == "Link?")


def test_der_text_sagt_was_man_nicht_sagen_sollte():
    text = an.als_text(an.antworten(10, bestand=False))
    assert "Was du NICHT sagen solltest" in text
    assert "Kostet 38,99 €" in text
