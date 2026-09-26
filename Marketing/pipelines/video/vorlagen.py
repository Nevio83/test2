"""Vorlagen fuer wiederkehrende Clip-Formen (Punkt 28).

WARUM
Der erste veroeffentlichungsreife Clip entstand aus 23 gesichteten Rohclips
und fuenf von Hand geschnittenen Fassungen. Jede neue Fassung fing wieder bei
null an: Wie viele Segmente? Wie lang? Wo steht Text, wo kommt das Produkt?

Eine Vorlage beantwortet das einmal. Der Schnitt fuellt danach nur noch die
Segmente mit passenden Clips — die Form steht schon.

WAS EINE VORLAGE IST
Eine Schnittliste mit Luecken: jedes Segment hat eine `rolle`, eine Sollzeit
(`soll_sek`), einen Suchhinweis (`_suche`) und, wo Text hingehoert, einen
Platzhalter in `[[…]]`. `quelle` ist leer.

Zwei Sperren sorgen dafuer, dass daraus nie ein halbfertiges Video wird:

1. Entwuerfe werden mit fuehrendem Unterstrich angelegt (`_entwurf-…`). Solche
   Dateien rendert Stil C nicht. Fertig ist ein Entwurf erst, wenn ihn jemand
   umbenennt — eine bewusste Handlung, kein Versehen.
2. `style_c_schnittliste.lies()` bricht bei jedem uebrig gebliebenen `[[…]]`
   ab. Stil C brennt Text woertlich ins Bild; ein vergessener Platzhalter
   stuende sonst im veroeffentlichten Video.

WAS BEWUSST NICHT PASSIERT
Es werden keine Clips automatisch zugeordnet und keine Texte erfunden. Die
Auswahl trifft ein Mensch am Kontaktbogen (`npm run tiktok:bogen`), die Texte
schreibt ein Mensch. Die Vorlage nimmt nur die Formentscheidung ab.

Aufruf:
    npm run marketing:vorlage                                  # auflisten
    npm run marketing:vorlage -- problem_loesung --produkt 10  # Entwurf anlegen
    (oder aus Marketing/ heraus: py -m pipelines.video.vorlagen …)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .. import products
from ..env_loader import REPO_ROOT
from . import style_c_schnittliste as sc

# Die Vorlagen selbst liest Stil C ein (sc.VORLAGEN) — EINE Quelle. Hier
# passiert nur, was Stil C nicht braucht: den Entwurf auf die Platte schreiben.
ORDNER = sc.VORLAGEN_ORDNER
TIKTOK_QUELLEN = REPO_ROOT / "bot" / "tiktok-quellen.json"


class VorlageFehler(RuntimeError):
    """Eine Vorlage fehlt oder ist unbrauchbar — mit Klartext."""


def alle() -> list[dict[str, Any]]:
    """Alle Vorlagen mit Name, Zweck und Solllaenge (samt Endkarte)."""
    return [{
        "name": e["schluessel"],
        "wofuer": e["wofuer"],
        "wann_nicht": e["wann_nicht"],
        "segmente": e["segmente"],
        "soll_sek": round(e["dauer"] + sc.ENDKARTE_SEK, 1),
        "pfad": sc.VORLAGEN[e["schluessel"]]["pfad"],
    } for e in sc.vorlagen_uebersicht()]


def hashtag_vorschlag(produkt_id: int, hoechstens: int = 5) -> list[str]:
    """Hashtags aus den Kernwoertern des Bots — ein Vorschlag, kein Ergebnis.

    Genommen werden nur einzelne Woerter (ein Hashtag hat kein Leerzeichen),
    in der Reihenfolge, in der sie gepflegt sind. Erfunden wird nichts: Fehlt
    der Eintrag, bleibt die Liste leer, und Stil C warnt beim Einlesen.
    """
    try:
        konfig = json.loads(TIKTOK_QUELLEN.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    eintrag = (konfig.get("produkte") or {}).get(str(produkt_id)) or {}
    gesehen: list[str] = []
    for wort in eintrag.get("kernwoerter") or []:
        w = str(wort).strip().lower()
        if w and " " not in w and w.isascii() and w not in gesehen:
            gesehen.append(w)
        if len(gesehen) >= hoechstens:
            break
    return gesehen


def aus_vorlage(name: str, produkt_id: int, *, ziel: Path | None = None,
                quellen: list[str] | None = None, hook: str | None = None,
                datei: Path | None = None) -> Path:
    """Legt aus einer Vorlage einen Entwurf an und gibt den Pfad zurueck.

    Der Entwurf traegt einen fuehrenden Unterstrich und wird deshalb NICHT
    gerendert. Eine bestehende Datei wird nie ueberschrieben — es gibt eine
    neue mit laufender Nummer.

    @param datei  fester Zielname (SCHNITT.md: --ziel). Dann gibt es keine
        laufende Nummer: Liegt dort schon etwas, wird abgebrochen, statt
        angefangene Arbeit zu ersetzen.
    @param hook   ersetzt den Hook-Platzhalter gleich beim Anlegen.
    """
    produkt = products.nach_id(int(produkt_id))
    if produkt is None:
        raise VorlageFehler(f"Produkt {produkt_id} steht nicht in products.json")

    name = str(name).replace("-", "_")
    try:
        roh = sc.vorlage(name, int(produkt_id), quellen=quellen)
    except KeyError:
        vorhanden = ", ".join(sc.VORLAGEN) or "(keine)"
        raise VorlageFehler(f"Vorlage '{name}' gibt es nicht. Vorhanden: {vorhanden}") from None
    if not roh.get("hashtags"):
        roh["hashtags"] = hashtag_vorschlag(int(produkt_id))
    if hook and str(hook).strip():
        roh["hook"] = str(hook).strip()
    kopf = dict(roh.get("_vorlage") or {})
    kopf["entwurf_fuer"] = f"{produkt.id} {produkt.name}"
    kopf["fertig_wenn"] = (
        "jedes 'quelle' gefuellt und jedes [[…]] ersetzt ist — dann die Datei ohne "
        "fuehrenden Unterstrich umbenennen. Vorher rendert Stil C sie nicht."
    )
    roh["_vorlage"] = kopf

    if datei is not None:
        pfad = Path(datei)
        if pfad.exists():
            raise VorlageFehler(f"{pfad} gibt es schon — ein Entwurf ueberschreibt nie eine Datei")
        pfad.parent.mkdir(parents=True, exist_ok=True)
    else:
        ordner = ziel or sc.SCHNITTLISTEN
        ordner.mkdir(parents=True, exist_ok=True)
        stamm = f"_entwurf-{int(produkt_id):02d}-{name}"
        pfad = ordner / f"{stamm}.json"
        nummer = 2
        while pfad.exists():
            pfad = ordner / f"{stamm}-{nummer}.json"
            nummer += 1
    pfad.write_text(json.dumps(roh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return pfad


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Schnitt-Vorlagen auflisten oder als Entwurf anlegen.")
    parser.add_argument("name", nargs="?", help="Name der Vorlage (ohne .json)")
    parser.add_argument("--produkt", type=int, help="Produkt-ID aus products.json")
    parser.add_argument("--quellen", help="Clips der Reihe nach, mit Komma getrennt (optional)")
    parser.add_argument("--hook", help="Hooktext gleich einsetzen (optional)")
    parser.add_argument("--ziel", help="fester Dateiname statt _entwurf-… (optional)")
    args = parser.parse_args(argv)

    if not args.name:
        vorlagen = alle()
        if not vorlagen:
            print(f"Keine Vorlagen in {ORDNER}")
            return 1
        print(f"── {len(vorlagen)} Vorlagen ──")
        for v in vorlagen:
            print(f"\n  {v['name']}  ({v['segmente']} Segmente, ~{v['soll_sek']} s mit Endkarte)")
            print(f"    wofuer:     {v['wofuer']}")
            print(f"    wann nicht: {v['wann_nicht']}")
        print("\nAnlegen: npm run marketing:vorlage -- <name> --produkt <id>")
        return 0

    if args.produkt is None:
        print("❌ --produkt fehlt. Beispiel: npm run marketing:vorlage -- problem_loesung --produkt 10")
        return 1
    try:
        quellen = [q.strip() for q in (args.quellen or "").split(",") if q.strip()]
        pfad = aus_vorlage(args.name, args.produkt, quellen=quellen, hook=args.hook,
                           datei=Path(args.ziel) if args.ziel else None)
    except VorlageFehler as fehler:
        print(f"❌ {fehler}")
        return 1
    try:
        anzeige = pfad.resolve().relative_to(REPO_ROOT)
    except ValueError:
        anzeige = pfad
    print(f"✅ Entwurf angelegt: {anzeige}")
    if pfad.name.startswith("_"):
        print("   Wird NICHT gerendert, solange der Name mit '_' beginnt.")
    else:
        print("   ⚠️  Ohne '_' am Anfang greift der Render-Lauf danach — bis alles")
        print("   ausgefuellt ist, meldet er die Liste bei jedem Durchgang als fehlerhaft.")
    print("   Clips aussuchen:  npm run tiktok:bogen")
    print("   Gegenlesen:       npm run marketing:pruefen -- <datei> --bauversuch")
    print("   Fertig, wenn jedes 'quelle' gefuellt und jedes [[…]] ersetzt ist"
          + (" — dann ohne fuehrenden Unterstrich umbenennen." if pfad.name.startswith("_") else "."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
