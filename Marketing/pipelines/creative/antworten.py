"""Antwortbausteine fuer Kommentare unter eigenen Beitraegen (Punkt 61).

WARUM ES DAS GIBT
Unter einem laufenden Beitrag stehen Kaufabsichten als Fragen: "Preis?",
"Link?", "gibt's das in weiss?", "wie lange dauert der Versand?". Bleiben sie
unbeantwortet, ist das verlorener Umsatz. Beantwortet werden sie von Hand —
das ist der eine Punkt im Papier, den man bewusst NICHT automatisiert. Was
sich vorbereiten laesst, sind die Antworten auf die immer gleichen Fragen.

JEDE ANGABE KOMMT AUS DER QUELLE, DIE AUCH DER SHOP BENUTZT
  Preis, Ausfuehrungen, Lieferzeit   products.json (ueber pipelines/products.py)
  Lieferlaender, Versandkosten       shipping-calculator.js — dieselbe Liste,
                                     die die Kasse und die Strukturdaten speist
  Rueckgabefrist                     seo-strukturdaten.js RUECKGABE_TAGE, per
                                     Pruefung gegen infos/retouren.html abgeglichen
  Zahlarten                          server.js, nur wenn das Muster eindeutig ist
Die JS-Werte werden mit EINEM node-Aufruf gelesen, nicht in Python
abgeschrieben: Eine zweite Liste ist genau der Fehler, den products.py
beschreibt (17 statt 40 Produkte, 11 falsche Preise).

WAS BEWUSST FEHLT
Gefunden am 15.10. beim Lesen: Die Versandseite nennt "4,99 EUR ausserhalb
Europas" (die Kasse nimmt 12 EUR fuer die USA), die AGB nennen PayPal und
Vorkasse (die Kasse kennt Karte und Klarna). Solche Texte sind KEINE Quelle.
Ebenso wenig: Streichpreise, Bundle-Preise (werden nirgends angezeigt),
Stueckzahlen, Bewertungen, Mengenrabatt. Und was keine Quelle hat — Lieferumfang,
Lautstaerke, Material — bekommt keinen Baustein, sondern den Vermerk
"selbst nachsehen". Fehlt eine Quelle ganz, faellt der Baustein weg, statt
etwas Ungefaehres zu sagen.

Aufruf:  npm run marketing:antworten -- --produkt 10
         npm run marketing:antworten -- --produkt 10 --beitrag 42   (Link mit Kampagnen-Kennung)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from typing import Any

from .. import products
from ..env_loader import REPO_ROOT
from ..orchestrator import guardrails
from . import compliance

SERVER_JS = REPO_ROOT / "server.js"

# Nur die Anzeige. WELCHE Laender beliefert werden, kommt allein aus
# LIEFERLAENDER; ein Code ohne Namen erscheint als Code, nicht gar nicht.
#
# Ohne Artikel und ohne Praeposition je Land: "nach die USA" oder "nach … die
# Schweiz" waeren falsch, und die Saetze stehen deshalb als Aufzaehlung da.
LAENDERNAMEN = {
    "DE": "Deutschland", "AT": "Österreich", "CH": "Schweiz", "FR": "Frankreich",
    "IT": "Italien", "ES": "Spanien", "NL": "Niederlande", "BE": "Belgien",
    "PL": "Polen", "US": "USA", "GB": "Großbritannien",
}

NICHT_SAGEN = (
    "keine Stückzahlen und keine Knappheit („nur noch 3“) — es gibt nur „lieferbar“ oder „gerade nicht lieferbar“",
    "keine Bewertungen, Sterne, Kundenzahlen oder „x-mal bestellt“",
    "keinen Streichpreis („statt …“) und keine Bundle-Preise",
    "nichts zu Umsatzsteuer — der Shop ist Kleinunternehmer nach § 19 UStG",
    "kein PayPal, keine Vorkasse, keinen Mengenrabatt — das bietet die Kasse nicht an",
    "keine Lieferzeiten aus AGB oder Versandseite, nur die vom Produkt",
    "keine Angaben ohne Quelle (Lieferumfang, Lautstärke, Material, Akku) — erst nachsehen",
    "keine fremden Marken, keine Heilversprechen, keine Superlative",
)

# Muster, die in keiner Antwort stehen duerfen — zusaetzlich zu den Listen in
# config/compliance_rules.json. Klein geschrieben geprueft.
EIGENE_SPERREN = (
    (r"nur noch", "Knappheit"),
    (r"\b\d+\s*(?:stück|stueck|stk\.?|exemplare)\b", "Stückzahl"),
    (r"bewertung|sterne|\bkunden\b", "Bewertung/Kundenzahl"),
    (r"\bstatt\b", "Streichpreis"),
    (r"mwst|umsatzsteuer", "Umsatzsteuer"),
    (r"paypal|vorkasse", "Zahlart, die die Kasse nicht kennt"),
    (r"rabatt|sparen|spare\b", "Rabattversprechen"),
)


# ── Quellen ─────────────────────────────────────────────────────────

def shop_angaben() -> dict[str, Any]:
    """Lieferlaender, Versandkosten je Lieferland und Rueckgabefrist — aus den JS-Dateien des Shops."""
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("node fehlt — ohne node keine Versand- und Rueckgabeangaben")
    code = (
        "const v=require('./shipping-calculator');const s=require('./seo-strukturdaten');"
        "process.stdout.write(JSON.stringify({laender:v.LIEFERLAENDER,"
        "kosten:Object.fromEntries(v.LIEFERLAENDER.map(l=>[l,v.FLAT_SHIPPING_COSTS[l]])),"
        "rueckgabe:s.RUECKGABE_TAGE}))"
    )
    lauf = subprocess.run([node, "-e", code], cwd=REPO_ROOT, capture_output=True, text=True,
                          encoding="utf-8", timeout=60)
    if lauf.returncode != 0:
        raise RuntimeError(f"Shop-Angaben nicht lesbar: {lauf.stderr.strip()[:200]}")
    return json.loads(lauf.stdout)


def zahlarten(server_text: str | None = None) -> list[str] | None:
    """Die Zahlarten der Kasse — oder None, wenn das Muster nicht eindeutig ist.

    FAIL CLOSED: Aendert sich die Kasse, soll hier lieber gar nichts stehen als
    eine alte Liste. Der Abschnitt in server.js setzt 'card' fest und haengt
    'klarna' fuer unterstuetzte Waehrungen an (EUR gehoert dazu).
    """
    text = server_text if server_text is not None else SERVER_JS.read_text(encoding="utf-8")
    if not re.search(r"const paymentMethods = \['card'\];", text):
        return None
    arten = ["Karte"]
    if re.search(r"paymentMethods\.push\('klarna'\)", text) and re.search(r"KLARNA_CURRENCIES = new Set\(\[[^\]]*'EUR'", text):
        arten.append("Klarna")
    return arten


def ausfuehrungen(produkt_id: int) -> tuple[list[str], bool]:
    """Namen der Ausfuehrungen und ob alle denselben Preis haben wie das Produkt."""
    roh = json.loads(products.PRODUKTE_DATEI.read_text(encoding="utf-8"))
    eintrag = next((p for p in roh if int(p.get("id", -1)) == int(produkt_id)), None) or {}
    namen: list[str] = []
    gleicher_preis = True
    for farbe in eintrag.get("colors") or []:
        name = str(farbe.get("name") or "").strip()
        if name and name not in namen:
            namen.append(name)
        if farbe.get("price") is not None and round(float(farbe["price"]), 2) != round(float(eintrag.get("price", 0)), 2):
            gleicher_preis = False
    return namen, gleicher_preis


def kampagne_von_beitrag(beitrag_id: int) -> str | None:
    """Die Kennung eines Beitrags (mkt_<video_id>) — genau so, wie die Bildunterschrift sie traegt."""
    from .. import db

    if not db.verfuegbar():
        return None
    zeile = db.eine_zeile("SELECT video_id FROM mkt_posts WHERE id = %s", (int(beitrag_id),))
    return f"mkt_{int(zeile['video_id'])}" if zeile else None


# ── Text ────────────────────────────────────────────────────────────

def euro(betrag: float) -> str:
    return f"{float(betrag):.2f} €".replace(".", ",")


def aufzaehlung(teile: list[str]) -> str:
    if len(teile) <= 1:
        return "".join(teile)
    return ", ".join(teile[:-1]) + " und " + teile[-1]


def pruefe_text(text: str, produkt: products.Produkt | None, erlaubte_betraege: tuple[float, ...] = ()) -> list[str]:
    """Darf das so in einen Kommentar? Leere Liste heisst ja.

    Betraege werden gegen ALLE echten Quellen geprueft — Produktpreis UND
    Versandkosten. compliance._preisangaben kennt nur den Produktpreis und
    haette die 12,00 EUR Versand in die USA als "falschen Preis" gesperrt.
    Dessen Umsatzsteuer-Pruefung wird uebernommen (dieselbe Liste aus
    compliance_rules.json).
    """
    klein = text.lower()
    gruende = compliance._heilversprechen(klein) + compliance._irrefuehrend(klein) + compliance._fremde_marken(klein)
    zusaetze = compliance.regeln().get("preisangaben", {}).get("verbotene_zusaetze", [])
    gruende += [f"Umsatzsteuer-Hinweis trotz § 19 UStG: '{z}'" for z in zusaetze if z.lower() in klein]
    erlaubt = {round(float(b), 2) for b in erlaubte_betraege}
    if produkt is not None:
        erlaubt.add(round(float(produkt.preis), 2))
    for ganz, cent in re.findall(r"(\d{1,4})[,.](\d{2})\s*(?:€|eur|euro)", klein):
        wert = round(float(f"{ganz}.{cent}"), 2)
        if wert not in erlaubt:
            gruende.append(f"Betrag {euro(wert)} steht in keiner Quelle")
    gruende += [f"{name}: '{m.group(0)}'" for muster, name in EIGENE_SPERREN
                for m in [re.search(muster, klein)] if m]
    return gruende


def bausteine(produkt: products.Produkt, *, angaben: dict[str, Any] | None, arten: list[str] | None,
              varianten: tuple[list[str], bool], lieferbar: bool | None = None,
              kampagne: str | None = None) -> list[dict[str, str]]:
    """Die Antworten fuer ein Produkt. Jede mit ihrer Quelle, damit man sie gegenpruefen kann."""
    liste: list[dict[str, str]] = []
    kosten = (angaben or {}).get("kosten") or {}
    laender = (angaben or {}).get("laender") or []

    # Ohne Artikel: "Der kostet" passt zum Wasserspender, nicht zur Massagepistole.
    preis = f"Kostet {euro(produkt.preis)}."
    if "DE" in laender and kosten.get("DE") == 0:
        preis += " Versand nach Deutschland ist kostenlos."
    liste.append({"frage": "Preis?", "antwort": preis,
                  "quelle": "products.json price · shipping-calculator.js"})

    link = "Den Link findest du in meinem Profil."
    eintrag = {"frage": "Link?", "antwort": link, "quelle": "Endkarte/Bildunterschrift: Link im Profil"}
    if kampagne:
        eintrag["zum_kopieren"] = produkt.url_mit_utm(
            kampagne, "tiktok", str(guardrails.wert("veroeffentlichung.utm_medium", "organic")))
        eintrag["quelle"] += f" · Kennung {kampagne} (dieselbe wie im Beitrag)"
    liste.append(eintrag)

    namen, gleicher_preis = varianten
    if len(namen) > 1:
        satz = f"Im Shop gibt es {len(namen)} Ausführungen: {aufzaehlung(namen)}"
        satz += f" — alle zum selben Preis ({euro(produkt.preis)})." if gleicher_preis else "."
        liste.append({"frage": "Gibt's das auch in …?", "antwort": satz, "quelle": "products.json colors"})
    else:
        liste.append({"frage": "Gibt's das auch in …?",
                      "antwort": "Im Shop gibt es davon eine Ausführung.", "quelle": "products.json colors"})

    if laender:
        frei = [LAENDERNAMEN.get(l, l) for l in laender if kosten.get(l) == 0]
        bezahlt = [f"{LAENDERNAMEN.get(l, l)}: {euro(kosten[l])}" for l in laender
                   if isinstance(kosten.get(l), (int, float)) and kosten[l] > 0]
        satz = f"Kostenloser Versand: {', '.join(frei)}." if frei else ""
        if bezahlt:
            satz += f" {', '.join(bezahlt)}."
        satz += " In andere Länder liefern wir noch nicht."
        liste.append({"frage": "Versand?", "antwort": satz.strip(), "quelle": "shipping-calculator.js LIEFERLAENDER"})

    if produkt.lieferzeit:
        dauer = re.sub(r"Werktage\b", "Werktagen", produkt.lieferzeit)
        liste.append({"frage": "Wie lange dauert's?", "antwort": f"Rechne mit {dauer}.",
                      "quelle": "products.json shippingTime"})

    if angaben and angaben.get("rueckgabe"):
        liste.append({"frage": "Kann ich's zurückschicken?",
                      "antwort": f"Ja, du hast {int(angaben['rueckgabe'])} Tage ab Erhalt Rückgaberecht.",
                      "quelle": "seo-strukturdaten.js RUECKGABE_TAGE ↔ infos/retouren.html"})

    if arten:
        liste.append({"frage": "Wie kann ich zahlen?", "antwort": f"Mit {' oder '.join(arten)}.",
                      "quelle": "server.js payment_method_types"})

    if lieferbar is False:
        liste.append({"frage": "Lieferbar?",
                      "antwort": "Gerade nicht lieferbar — auf der Produktseite kannst du dich benachrichtigen lassen.",
                      "quelle": "Lieferantenbestand (cj_stock_watch)"})
    elif lieferbar is True:
        liste.append({"frage": "Lieferbar?", "antwort": "Ja, gerade lieferbar.",
                      "quelle": "Lieferantenbestand (cj_stock_watch)"})
    return liste


def antworten(produkt_id: int, *, beitrag: int | None = None, bestand: bool = True) -> dict[str, Any]:
    """Alles fuer ein Produkt: Bausteine, Selbstpruefung, was man nicht sagen sollte."""
    produkt = products.nach_id(int(produkt_id))
    if produkt is None:
        return {"ok": False, "grund": f"Produkt {produkt_id} steht nicht in products.json"}
    fehlend: list[str] = []
    try:
        angaben = shop_angaben()
    except Exception as fehler:  # noqa: BLE001 — dann eben ohne Versand/Rueckgabe, aber gesagt
        angaben = None
        fehlend.append(str(fehler))
    arten = zahlarten()
    if arten is None:
        fehlend.append("Zahlarten in server.js nicht eindeutig gefunden — kein Zahlungs-Baustein")
    lieferbar = None
    if bestand:
        stand = products.bestand_aus_db()
        lieferbar = stand.get(produkt.id) if stand else None
    kampagne = kampagne_von_beitrag(beitrag) if beitrag is not None else None
    if beitrag is not None and kampagne is None:
        fehlend.append(f"Beitrag {beitrag} nicht gefunden (oder keine Datenbank) — Link ohne Kennung")

    liste = bausteine(produkt, angaben=angaben, arten=arten, varianten=ausfuehrungen(produkt.id),
                      lieferbar=lieferbar, kampagne=kampagne)
    versand = tuple(float(k) for k in ((angaben or {}).get("kosten") or {}).values() if isinstance(k, (int, float)))
    probleme = {b["frage"]: pruefe_text(b["antwort"], produkt, versand) for b in liste}
    return {"ok": True, "produkt": produkt.name, "bausteine": liste,
            "probleme": {k: v for k, v in probleme.items() if v}, "fehlend": fehlend}


def als_text(ergebnis: dict[str, Any]) -> str:
    if not ergebnis.get("ok"):
        return f"Keine Antworten: {ergebnis.get('grund')}"
    zeilen = [f"── Antworten für Kommentare: {ergebnis['produkt']} ──", ""]
    for b in ergebnis["bausteine"]:
        zeilen.append(f"{b['frage']:<26} {b['antwort']}")
        if b.get("zum_kopieren"):
            zeilen.append(f"{'':<26} zum Kopieren: {b['zum_kopieren']}")
        zeilen.append(f"{'':<26} [{b['quelle']}]")
    if ergebnis["probleme"]:
        zeilen += ["", "⛔ Diese Antworten haben die eigene Prüfung nicht bestanden — so nicht verwenden:"]
        zeilen += [f"   {frage}: {'; '.join(gruende)}" for frage, gruende in ergebnis["probleme"].items()]
    if ergebnis["fehlend"]:
        zeilen += ["", "Fehlt:"] + [f"   {f}" for f in ergebnis["fehlend"]]
    zeilen += ["", "Was du NICHT sagen solltest:"] + [f"   – {s}" for s in NICHT_SAGEN]
    zeilen += ["", "Fragen ohne Quelle (Lieferumfang, Maße, Lautstärke, Akku …): erst in der",
               "Produktbeschreibung im Shop nachsehen — nichts aus dem Kopf beantworten."]
    return "\n".join(zeilen)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Antwortbausteine für Kommentare (Punkt 61).")
    parser.add_argument("--produkt", type=int, required=True)
    parser.add_argument("--beitrag", type=int, help="mkt_posts.id — für den Link mit Kampagnen-Kennung")
    parser.add_argument("--ohne-bestand", action="store_true", help="keine Datenbankabfrage für den Bestand")
    args = parser.parse_args(argv)
    ergebnis = antworten(args.produkt, beitrag=args.beitrag, bestand=not args.ohne_bestand)
    print(als_text(ergebnis))
    return 0 if ergebnis.get("ok") and not ergebnis.get("probleme") else 1


if __name__ == "__main__":
    sys.exit(main())
