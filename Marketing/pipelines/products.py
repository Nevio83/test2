"""Produktdaten — AUSSCHLIESSLICH aus der Wurzel-products.json.

WARUM DAS WICHTIG IST

Bis Runde 10 gab es eine zweite Produktliste unter Marketing/products.json.
Nachgemessen am 14.08.2026 stand darin:

  * 17 statt 40 Produkte (23 fehlten dem Marketing komplett)
  * 11 der 17 mit einem ABWEICHENDEN Preis, z.B. Produkt 24 mit 12,99 EUR
    statt 29,99 EUR — 17 Euro Unterschied

Ein Video aus dieser Kopie haette also einen Preis beworben, den es im Shop nie
gab. Genau diese Fehlerklasse (zweite, abweichende Liste) hat das Projekt schon
einmal getroffen: siehe test/voucher-validator.test.js in CLAUDE.md Paragraph 2.

Deshalb: Dieses Modul liest EINE Datei, und zwar die des Shops. Wer hier einen
zweiten Pfad einbaut, bricht test_products_single_source.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from .env_loader import REPO_ROOT

# Die eine Quelle. Bewusst als Konstante, damit der Test sie pruefen kann.
PRODUKTE_DATEI = REPO_ROOT / "products.json"

SHOP_BASIS = "https://maiosshop.com"

# Woerter, die beim Zuordnen nichts unterscheiden. Ohne diese Liste bekommt
# jedes Produkt Treffer auf "mit", "fuer", "und".
STOPPWOERTER = {
    "der", "die", "das", "und", "oder", "mit", "fuer", "für", "von", "im", "in",
    "auf", "aus", "zum", "zur", "den", "dem", "des", "ein", "eine", "einen",
    "ist", "sind", "auch", "bei", "als", "wie", "the", "and", "for", "with",
}


@dataclass(frozen=True)
class Produkt:
    """Ein Produkt, so wie der Shop es kennt."""

    id: int
    name: str
    slug: str
    preis: float
    kategorie: str
    beschreibung: str
    sku: str | None
    auf_lager: bool
    lieferzeit: str | None
    bild: str | None
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def shop_url(self) -> str:
        """Produktseite im Shop. Slug, nie die alte ID-Adresse."""
        return f"{SHOP_BASIS}/produkte/{self.slug}.html"

    def url_mit_utm(self, kampagne: str, quelle: str, medium: str = "organic") -> str:
        """Shop-Adresse mit UTM-Parametern — die Bruecke zur Bestellung.

        Ohne diese Parameter laesst sich spaeter nicht sagen, welcher Post
        welche Bestellung gebracht hat; genau das ist der Unterschied zwischen
        Reichweite und Umsatz.
        """
        return (
            f"{self.shop_url}?utm_source={quelle}"
            f"&utm_medium={medium}&utm_campaign={kampagne}"
        )

    def tokens(self) -> set[str]:
        """Wortmenge fuer die Trend-Zuordnung (Name + Kategorie + Tags)."""
        text = " ".join([self.name, self.kategorie, " ".join(self.tags)])
        return zerlege(text)


def zerlege(text: str) -> set[str]:
    """Text -> normalisierte Wortmenge, ohne Stoppwoerter und kurze Fragmente."""
    roh = re.findall(r"[\wäöüßÄÖÜ]+", (text or "").lower())
    return {w for w in roh if len(w) > 2 and w not in STOPPWOERTER}


def _zahl(wert: Any, standard: float = 0.0) -> float:
    try:
        return float(wert)
    except (TypeError, ValueError):
        return standard


@lru_cache(maxsize=1)
def alle() -> tuple[Produkt, ...]:
    """Alle Produkte des Shops. Ergebnis wird zwischengespeichert.

    Faellt die Datei weg oder ist sie kaputt, wird das laut gemeldet und eine
    leere Liste zurueckgegeben — nicht etwa ein Beispielprodukt erfunden.
    """
    try:
        roh = json.loads(PRODUKTE_DATEI.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"[products] {PRODUKTE_DATEI} nicht gefunden — keine Produkte.")
        return ()
    except json.JSONDecodeError as fehler:
        print(f"[products] {PRODUKTE_DATEI} ist kein gueltiges JSON: {fehler}")
        return ()

    produkte: list[Produkt] = []
    for p in roh:
        slug = (p.get("slug") or "").strip()
        if not slug:
            # Ohne Slug gibt es keine funktionierende Shop-Adresse. Lieber
            # auslassen als eine Adresse raten, die ins Leere fuehrt.
            print(f"[products] Produkt {p.get('id')} hat keinen slug — ausgelassen.")
            continue
        tags = p.get("tags") or []
        produkte.append(
            Produkt(
                id=int(p.get("id")),
                name=(p.get("name") or "").strip(),
                slug=slug,
                preis=_zahl(p.get("price")),
                kategorie=(p.get("category") or "").strip(),
                beschreibung=(p.get("description") or "").strip(),
                sku=(p.get("sku") or None),
                # inStock fehlt bei manchen Produkten. Fehlend heisst hier
                # "verfuegbar" — dieselbe Annahme trifft der Shop
                # (product-availability.js sperrt nur bei inStock === false).
                auf_lager=p.get("inStock") is not False,
                lieferzeit=(p.get("shippingTime") or None),
                bild=(p.get("image") or None),
                tags=tuple(str(t) for t in tags),
            )
        )
    return tuple(produkte)


def nach_id(produkt_id: int) -> Produkt | None:
    """Ein Produkt heraussuchen. IDs werden numerisch verglichen (Projektregel)."""
    for p in alle():
        if int(p.id) == int(produkt_id):
            return p
    return None


def verfuegbare() -> tuple[Produkt, ...]:
    """Nur Produkte, die gerade lieferbar sind.

    Der Bestand kommt zur Laufzeit aus der Datenbank (cj_stock_watch) und wird
    vom Shop beim Ausliefern in products.json gemischt — die Datei auf der
    Platte kennt ihn nicht. Wer den echten Bestand braucht, nimmt zusaetzlich
    bestand_aus_db().
    """
    return tuple(p for p in alle() if p.auf_lager)


_bestand_zwischenspeicher: dict[int, bool] | None = None


def bestand_aus_db(*, neu: bool = False) -> dict[int, bool]:
    """Aktueller Lieferantenbestand aus cj_stock_watch, falls verfuegbar.

    Leeres dict bedeutet "keine Aussage moeglich" — NICHT "alles ausverkauft".
    Der Aufrufer muss den Unterschied beachten, sonst sperrt ein Datenbank-
    Aussetzer versehentlich das ganze Sortiment.

    Die Spalte heisst "available" (boolean), zusaetzlich gibt es "stock"
    (Stueckzahl). Beides wird geprueft: available=false ODER stock<=0 heisst
    nicht lieferbar. Der erste Entwurf hat hier auf eine Spalte "in_stock"
    gezeigt, die es nicht gibt — die Abfrage schlug jedes Mal fehl und die
    Verfuegbarkeitspruefung lief faktisch ins Leere.

    Ergebnis wird je Prozess zwischengespeichert: Der Matcher fragt sonst je
    Produkt neu an.
    """
    global _bestand_zwischenspeicher
    if _bestand_zwischenspeicher is not None and not neu:
        return _bestand_zwischenspeicher

    from . import db

    if not db.verfuegbar():
        return {}
    try:
        zeilen = db.abfragen("SELECT product_id, stock, available FROM cj_stock_watch")
    except Exception as fehler:
        print(f"[products] Bestand nicht abrufbar: {fehler}")
        return {}

    _bestand_zwischenspeicher = {
        int(z["product_id"]): bool(z["available"]) and int(z["stock"] or 0) > 0
        for z in zeilen
    }
    return _bestand_zwischenspeicher


def kategorien() -> tuple[str, ...]:
    """Alle vorkommenden Kategorien — Kontext fuer den Lernalgorithmus."""
    return tuple(sorted({p.kategorie for p in alle() if p.kategorie}))
