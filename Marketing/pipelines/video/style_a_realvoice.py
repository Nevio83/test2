"""Stil A: geschnittene Clips mit echter Stimme.

DER AUFBAU EINES VIDEOS

  1. Stimme zuerst. Die Laenge der Sprachaufnahme bestimmt, wie lang das
     Video wird — nicht umgekehrt. Ein Skript auf eine feste Laenge zu
     quetschen klingt gehetzt.
  2. Schnitte auf die SPRECHPAUSEN, nicht auf ein starres Raster. Ein
     Schnitt mitten im Wort faellt sofort auf; ein Schnitt in der Atempause
     merkt niemand.
  3. Jeder Clip bekommt eine Zoomfahrt. Standbilder im Hochformat wirken
     sofort wie eine Diaschau.
  4. Harte Schnitte, keine Ueberblendungen — ausser der letzten zur Endkarte.
  5. Untertitel eingebrannt, hoechstens 3 Woerter je Zeile, im sichtbaren
     Bereich.
  6. Endkarte mit echtem Produktfoto und Shop-Adresse.

WAS DAS VIDEO NIE VERLAESST
Jedes Rendering laeuft durch quality_gate.pruefe(). Faellt es durch, wird
EINMAL neu versucht und danach als Fehler protokolliert. Ein durchgefallenes
Rendering kommt nicht in die Warteschlange — genau das ist frueher passiert
(neun 0-Byte-Dateien).
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .. import db, products
from ..orchestrator import guardrails
from ..products import Produkt
from . import assets, common, quality_gate
from .tts import base as tts


def _pausen_finden(tonspur: Path, *, mindestpause: float = 0.28) -> list[float]:
    """Zeitpunkte, an denen gerade nicht gesprochen wird.

    ffmpeg meldet Stille ueber den silencedetect-Filter. Die Mitte jeder
    Stille ist ein guter Schnittpunkt: Dort ist garantiert kein Wort offen.
    """
    werkzeug = common.ffmpeg_pfad()
    if werkzeug is None:
        return []
    ergebnis = subprocess.run(
        [werkzeug, "-hide_banner", "-nostdin", "-i", str(tonspur),
         "-af", f"silencedetect=noise=-32dB:d={mindestpause}", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300,
    )
    pausen: list[float] = []
    start = None
    for zeile in (ergebnis.stderr or "").splitlines():
        if "silence_start:" in zeile:
            try:
                start = float(zeile.split("silence_start:")[1].strip().split()[0])
            except (IndexError, ValueError):
                start = None
        elif "silence_end:" in zeile and start is not None:
            try:
                ende = float(zeile.split("silence_end:")[1].strip().split()[0])
                pausen.append(round((start + ende) / 2.0, 2))
            except (IndexError, ValueError):
                pass
            start = None
    return pausen


def _schnittpunkte(gesamtdauer: float, pausen: list[float]) -> list[float]:
    """Schnittzeitpunkte: an Pausen, aber im vorgegebenen Abstandsfenster.

    Ohne die Fensterpruefung wuerde ein Sprecher mit vielen Pausen ein
    Stroboskop erzeugen und einer ohne Pausen ein Standbild.
    """
    min_ab = float(guardrails.wert("video.schnitt_min_sek", 1.5))
    max_ab = float(guardrails.wert("video.schnitt_max_sek", 3.0))

    punkte = [0.0]
    for pause in sorted(pausen):
        if pause - punkte[-1] >= min_ab and pause < gesamtdauer - 0.5:
            punkte.append(pause)
    # Luecken, die laenger sind als erlaubt, kuenstlich fuellen.
    gefuellt = [0.0]
    for punkt in punkte[1:] + [gesamtdauer]:
        while punkt - gefuellt[-1] > max_ab:
            gefuellt.append(round(gefuellt[-1] + max_ab, 2))
        if punkt > gefuellt[-1]:
            gefuellt.append(round(punkt, 2))
    return [p for p in gefuellt if p < gesamtdauer]


def _startpunkt(asset: assets.Asset, dauer: float, nummer: int) -> float:
    """Ab welcher Sekunde des Quellclips dieser Schnitt genommen wird.

    WARUM NICHT IMMER AB NULL
    Vorher stand hier fest "-ss 0". Bei mehreren Schnitten aus DERSELBEN
    Datei — und das ist der Normalfall, weil es meist ein Produktvideo je
    Produkt gibt — zeigte jeder Schnitt exakt dieselben ersten Sekunden.
    Sechs Schnitte, sechsmal dasselbe Bild: kein Zusammenschnitt, sondern ein
    Stottern. Und es faellt in keiner Pruefung auf, denn Laufzeit,
    Aufloesung und Ton stimmen.

    Jetzt wandert der Startpunkt durch die Datei. Reicht sie nicht fuer alle
    Schnitte, wird von vorn begonnen — aber versetzt, nie deckungsgleich.
    """
    info = common.medien_info(asset.pfad)
    laenge = info.dauer if info else 0.0
    rest = max(laenge - dauer, 0.0)
    if rest <= 0.1:
        return 0.0
    # Goldener Schnitt als Schrittweite: verteilt die Startpunkte gleichmaessig
    # ueber die Datei, ohne dass sich bei wenigen Schnitten ein Muster bildet.
    return round((nummer * 0.618034 * laenge) % rest, 2)


def _clip_bauen(asset: assets.Asset, dauer: float, ziel: Path, *, hinein: bool,
                nummer: int = 0) -> Path:
    """Ein Bild oder Videoausschnitt auf 1080x1920 mit Bewegung."""
    if asset.typ == "video":
        common.lauf([
            "-ss", f"{_startpunkt(asset, dauer, nummer):.2f}",
            "-t", f"{dauer:.2f}", "-i", str(asset.pfad),
            "-vf", f"{common.einpassen()},fps=30", "-an",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel),
        ])
    else:
        common.lauf([
            # -framerate 30 VOR dem Eingang: Standbilder liest ffmpeg sonst
            # mit 25 B/s ein. Da zoompan mit d=1 je Eingangsbild genau ein
            # Ausgangsbild liefert, waere der Clip dann um ein Sechstel zu
            # kurz (gemessen: 2,50s statt 3,00s).
            "-framerate", "30", "-loop", "1", "-t", f"{dauer:.2f}", "-i", str(asset.pfad),
            "-vf", common.ken_burns(dauer, hinein=hinein), "-an",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(ziel),
        ])
    return ziel


def rendere(
    brief: dict[str, Any],
    produkt: Produkt,
    ziel: Path,
    *,
    arbeitsordner: Path | None = None,
) -> tuple[Path, dict[str, Any]]:
    """Ein Video aus einem Briefing bauen. Wirft bei jedem harten Hindernis."""
    ok, grund = common.verfuegbar()
    if not ok:
        raise RuntimeError(grund)

    ordner = Path(arbeitsordner or tempfile.mkdtemp(prefix="maios_stil_a_"))
    ordner.mkdir(parents=True, exist_ok=True)
    bericht: dict[str, Any] = {"stil": "A"}

    # ── 1. Stimme ────────────────────────────────────────────────────
    merkmale = brief.get("merkmale", {})
    stimme, stimm_info = tts.beste_stimme(merkmale.get("stimme"))
    if stimme is None:
        raise RuntimeError(f"keine Stimme verfuegbar — {stimm_info}")

    text = brief.get("skript") or ""
    if not text.strip():
        raise RuntimeError("Briefing hat kein Skript")

    tonspur = ordner / "stimme.wav"
    sprachausgabe = stimme.sprich(text, tonspur)
    bericht["stimme"] = sprachausgabe.quelle
    bericht["kosten_cent"] = sprachausgabe.kosten_cent
    if sprachausgabe.quelle != merkmale.get("stimme"):
        # Fuers Lernen wichtig: sonst wird eine Auspraegung belohnt, die gar
        # nicht benutzt wurde.
        bericht["stimme_abweichung"] = f"gewuenscht {merkmale.get('stimme')}, benutzt {sprachausgabe.quelle}"

    sprechdauer = sprachausgabe.dauer
    endkarte_dauer = 2.5
    gesamt = min(
        sprechdauer + endkarte_dauer,
        float(guardrails.wert("video.max_dauer_sek", 60)),
    )
    bericht["dauer_soll"] = round(gesamt, 2)

    # ── 2. Material ──────────────────────────────────────────────────
    schnitte = _schnittpunkte(sprechdauer, _pausen_finden(tonspur))
    benoetigt = max(len(schnitte), 2)
    material = assets.bildquellen_fuer(produkt, mindestens=benoetigt)
    material = [a for a in material if a.nutzbar and assets.hat_lizenz(a.pfad)]
    if not material:
        raise RuntimeError(f"kein lizenziertes Bildmaterial fuer '{produkt.name}'")
    bericht["clips"] = len(schnitte)
    bericht["material"] = len(material)

    # ── 3. Clips ─────────────────────────────────────────────────────
    teile: list[Path] = []
    for i, start in enumerate(schnitte):
        ende = schnitte[i + 1] if i + 1 < len(schnitte) else sprechdauer
        dauer = max(round(ende - start, 2), 0.6)
        asset = material[i % len(material)]
        teile.append(_clip_bauen(asset, dauer, ordner / f"clip_{i:02d}.mp4",
                                 hinein=(i % 2 == 0), nummer=i))

    # ── 4. Endkarte aus echtem Produktfoto ───────────────────────────
    produktfoto = next((a.pfad for a in material if a.typ == "bild"), None)
    if produktfoto is None:
        raise RuntimeError("kein Produktfoto fuer die Endkarte")
    endkarte = common.baue_endkarte(
        produktfoto, ordner / "endkarte.mp4",
        name=produkt.name, preis=produkt.preis,
        url=produkt.shop_url.replace("https://", ""), dauer=endkarte_dauer,
    )
    teile.append(endkarte)

    # ── 5. Zusammensetzen ────────────────────────────────────────────
    liste = ordner / "teile.txt"
    liste.write_text(
        "\n".join(f"file '{p.resolve().as_posix()}'" for p in teile), encoding="utf-8"
    )
    stumm = ordner / "stumm.mp4"
    common.lauf(["-f", "concat", "-safe", "0", "-i", str(liste),
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", str(stumm)])

    # ── 6. Untertitel ────────────────────────────────────────────────
    segmente = brief.get("skript_teile") or [{"von": 0.0, "bis": sprechdauer, "text": text}]
    # Auf die tatsaechliche Sprechdauer strecken: Das Briefing plant in
    # Sekunden, die Stimme braucht ihre eigene Zeit.
    geplant = max((float(s.get("bis", 0)) for s in segmente), default=sprechdauer) or sprechdauer
    faktor = sprechdauer / geplant if geplant > 0 else 1.0
    gestreckt = [
        {"von": float(s.get("von", 0)) * faktor,
         "bis": float(s.get("bis", 0)) * faktor,
         "text": s.get("text", "")}
        for s in segmente
    ]
    # Hook zusaetzlich gross ins Bild — nur wenn er im Briefing steht.
    hooktext = None
    if guardrails.wert("video.hook_overlay", True):
        varianten = brief.get("hook_varianten") or []
        if varianten:
            erste = varianten[0]
            hooktext = erste.get("text") if isinstance(erste, dict) else str(erste)
    ass = common.schreibe_untertitel(
        gestreckt, ordner / "untertitel.ass",
        hook=hooktext,
        hook_dauer=float(guardrails.wert("video.hook_overlay_sek", 2.5)),
    )

    # ── 7. Ton + Untertitel drauf ────────────────────────────────────
    ziel.parent.mkdir(parents=True, exist_ok=True)
    gesamtlaenge = sprechdauer + endkarte_dauer

    # ── 7a. Musikbett, falls welches bereitliegt ─────────────────────
    # Ohne Musik ist die Tonspur trockene Mono-Sprache. Gemessen an einem
    # fertigen Video: Lautheitsumfang 3,0 LU — praktisch keine Dynamik.
    # Liegt kein Stueck in Marketing/musik, laeuft alles genau wie vorher
    # weiter; es gibt keinen Fehler und keine Stille.
    musik = common.musik_waehlen(int(brief.get("saat", produkt.id)))
    if musik is not None:
        bericht["musik"] = musik.name
        common.lauf([
            "-i", str(stumm), "-i", str(tonspur), "-stream_loop", "-1", "-i", str(musik),
            "-vf", f"subtitles='{common._ass_pfad(ass)}'",
            "-filter_complex", common.ton_mit_musik(1, 2, gesamt=gesamtlaenge),
            "-t", f"{gesamtlaenge:.2f}",
            "-map", "0:v:0", "-map", "[ton]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
            "-movflags", "+faststart", str(ziel),
        ])
        return ziel, bericht

    bericht["musik"] = None
    common.lauf([
        "-i", str(stumm), "-i", str(tonspur),
        "-vf", f"subtitles='{common._ass_pfad(ass)}'",
        # apad haengt Stille an die Sprachaufnahme, "-t" setzt die Gesamtlaenge.
        #
        # WARUM NICHT "-shortest": Die Endkarte hat keinen Ton. Mit -shortest
        # endet das Video mit der Sprachaufnahme — und schneidet damit genau
        # die Endkarte ab. Nachgemessen: Video 21,6s = exakt die Sprechdauer,
        # die letzten 2,5 Sekunden mit Produktname, Preis und Shop-Adresse
        # fehlten. Das Video sah fertig aus und hatte keinen Weg zum Shop.
        "-af", f"{common.loudnorm_filter()},apad",
        "-t", f"{gesamtlaenge:.2f}",
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
        "-movflags", "+faststart", str(ziel),
    ])
    return ziel, bericht


# ── Job-Einstieg ─────────────────────────────────────────────────────

def offene_briefings(stil: str, limit: int = 3) -> list[dict[str, Any]]:
    """Freigegebene Briefings, zu denen es noch kein brauchbares Video gibt."""
    if not db.verfuegbar():
        return []
    return db.abfragen(
        """SELECT b.id, b.skript, b.overlays, b.merkmale, b.stil, b.cta, b.hashtags,
                  b.hook_varianten, m.produkt_id
             FROM mkt_briefs b
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE b.compliance_status = 'ok'
              AND b.stil = %s
              AND NOT EXISTS (SELECT 1 FROM mkt_videos v
                               WHERE v.brief_id = b.id AND v.pruefergebnis = 'ok')
            ORDER BY b.erstellt_am DESC
            LIMIT %s""",
        (stil, limit),
    )


def job_render_stil_a() -> dict[str, Any]:
    """Freigegebene Stil-A-Briefings rendern."""
    ok, grund = common.verfuegbar()
    if not ok:
        print(f"[stil_a] uebersprungen — {grund}")
        return {"gerendert": 0, "grund": grund}

    briefings = offene_briefings("A", limit=2)
    if not briefings:
        return {"gerendert": 0, "grund": "keine freigegebenen Stil-A-Briefings"}

    gerendert = 0
    verworfen = 0
    for eintrag in briefings:
        produkt = products.nach_id(int(eintrag["produkt_id"]))
        if produkt is None:
            continue

        overlays = eintrag["overlays"] or {}
        brief = {
            "skript": eintrag["skript"],
            "skript_teile": (overlays or {}).get("skript_teile", []),
            "merkmale": eintrag["merkmale"] or {},
        }
        ziel = common.RENDERS / f"brief_{eintrag['id']}_stil_a.mp4"

        video_id = None
        if db.verfuegbar():
            zeile = db.eine_zeile(
                "INSERT INTO mkt_videos (brief_id, stil, pfad) VALUES (%s, 'A', %s) RETURNING id",
                (int(eintrag["id"]), str(ziel)),
            )
            video_id = int(zeile["id"]) if zeile else None

        import time as _zeit
        begonnen = _zeit.monotonic()
        try:
            # Ein zweiter Versuch, dann Schluss. Ein dauerhaft kaputtes
            # Briefing soll nicht bei jedem Lauf erneut Rechenzeit kosten.
            for versuch in (1, 2):
                try:
                    _, bericht = rendere(brief, produkt, ziel)
                    break
                except Exception as fehler:
                    if versuch == 2:
                        raise
                    print(f"[stil_a] Versuch {versuch} fehlgeschlagen ({fehler}) — noch einmal")

            ergebnis = quality_gate.pruefe(ziel, erwartete_dauer=bericht.get("dauer_soll"))
            if video_id:
                quality_gate.haltefest(video_id, ergebnis)
                db.ausfuehren(
                    "UPDATE mkt_videos SET renderdauer_sek = %s, kosten_cent = %s WHERE id = %s",
                    (round(_zeit.monotonic() - begonnen, 2),
                     int(bericht.get("kosten_cent", 0)), video_id),
                )
            if ergebnis.bestanden:
                gerendert += 1
                print(f"[stil_a] ✅ {produkt.name}: {ergebnis.info.dauer:.1f}s, "
                      f"{ergebnis.info.groesse_byte // 1024} KB, Stimme '{bericht.get('stimme')}'")
            else:
                verworfen += 1
                print(f"[stil_a] ⛔ verworfen: {ergebnis.als_text()}")
        except Exception as fehler:
            verworfen += 1
            print(f"[stil_a] ❌ {produkt.name}: {fehler}")
            if video_id:
                quality_gate.haltefest(
                    video_id, quality_gate.Pruefergebnis(False, [str(fehler)[:300]])
                )

    return {"gerendert": gerendert, "verworfen": verworfen}
