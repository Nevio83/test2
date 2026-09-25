"""Ausgangspruefung: Kein Rendering kommt ungeprueft in die Warteschlange.

WARUM ES DIESE DATEI GIBT

In Marketing/data/renders/ lagen bis Runde 10 neun MP4-Dateien mit **0 Byte**.
Sie hatten Dateinamen, Zeitstempel und Endung — sie sahen aus wie fertige
Arbeit. Abspielbar war keine davon. Niemandem ist es aufgefallen, weil nichts
geprueft hat, ob am Ende wirklich ein Video herauskam.

Deshalb prueft dieser Baustein die DATEI, nicht den Rueckgabewert des
Renderers. Ein Renderer kann "fertig" melden und trotzdem nichts erzeugt
haben.

WAS GEPRUEFT WIRD (alles gegen marketing.config.json, nicht gegen Konstanten)
  * Datei existiert und hat eine Mindestgroesse
  * Laufzeit innerhalb der Grenzen
  * Aufloesung stimmt (1080x1920)
  * es gibt ueberhaupt eine Tonspur — ein stummes Video ist kein Video
  * und sie ist nicht LEER: gemessen wird die Lautheit, nicht nur, dass eine
    Spur da ist. Eine vollstaendig stille Tonspur ist eine Tonspur. Die
    gemessene Lautheit landet in mkt_videos.loudness_lufs — die Spalte gibt
    es seit Runde 10 und war bis dahin immer leer.
  * Video- und Tonformat sind die, die die Plattformen erwarten
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .. import db
from ..orchestrator import guardrails
from . import common


@dataclass
class Pruefergebnis:
    bestanden: bool
    gruende: list[str] = field(default_factory=list)
    info: common.MedienInfo | None = None
    lufs: float | None = None
    # Punkt 52: zwei Messungen, die HINWEISEN statt zu sperren. Sie stehen im
    # Ergebnis, damit sie im Bericht landen — wer nur "bestanden" liest,
    # bekommt sie nicht zu sehen, und genau dafuer sind sie da.
    schwarzer_anfang: bool | None = None
    untertitel_hell: float | None = None
    # Punkt 31: Welche Textbereiche in eine Sperrzone der Plattform ragen.
    sperrzonen: list[str] = field(default_factory=list)

    def als_text(self) -> str:
        return " | ".join(self.gruende) if self.gruende else "ok"


def pruefe(pfad: str | Path, *, erwartete_dauer: float | None = None) -> Pruefergebnis:
    """Ein fertiges Rendering pruefen."""
    p = Path(pfad)
    gruende: list[str] = []

    if not p.exists():
        return Pruefergebnis(False, [f"Datei existiert nicht: {p}"])

    min_bytes = int(guardrails.wert("video.min_dateigroesse_byte", 20480))
    groesse = p.stat().st_size
    if groesse < min_bytes:
        # Der historische Fall: 0 Byte.
        return Pruefergebnis(
            False,
            [f"Datei ist {groesse} Byte gross (Mindestgroesse {min_bytes}) — "
             f"das ist kein abspielbares Video"],
        )

    info = common.medien_info(p)
    if info is None:
        return Pruefergebnis(False, ["Datei ist fuer ffprobe nicht lesbar"], None)

    min_dauer = float(guardrails.wert("video.min_dauer_sek", 8))
    max_dauer = float(guardrails.wert("video.max_dauer_sek", 60))
    breite = int(guardrails.wert("video.breite", 1080))
    hoehe = int(guardrails.wert("video.hoehe", 1920))

    if info.dauer < min_dauer:
        gruende.append(f"zu kurz: {info.dauer:.1f}s (mindestens {min_dauer:.0f}s)")
    if info.dauer > max_dauer:
        gruende.append(f"zu lang: {info.dauer:.1f}s (hoechstens {max_dauer:.0f}s)")
    if (info.breite, info.hoehe) != (breite, hoehe):
        gruende.append(f"falsche Aufloesung: {info.breite}x{info.hoehe} statt {breite}x{hoehe}")
    if not info.hat_ton:
        gruende.append("keine Tonspur — ein stummes Video ist kein fertiges Video")
    if info.video_codec != "h264":
        gruende.append(f"Videoformat {info.video_codec} statt h264")
    if info.hat_ton and info.audio_codec not in ("aac", "mp3"):
        gruende.append(f"Tonformat {info.audio_codec} wird von den Plattformen nicht erwartet")

    if erwartete_dauer and abs(info.dauer - erwartete_dauer) > 3.0:
        gruende.append(
            f"Laufzeit weicht stark vom Briefing ab: {info.dauer:.1f}s statt "
            f"{erwartete_dauer:.1f}s"
        )

    # ── Lautheit ─────────────────────────────────────────────────────
    #
    # EINE SPERRE, EIN HINWEIS — und die Grenze dazwischen war eine Messung,
    # keine Schaetzung.
    #
    # ABGEWIESEN wird nur, was praktisch STILL ist. Das ist derselbe Fehler
    # wie das 0-Byte-MP4, eine Etage tiefer: Die Datei sieht fertig aus, die
    # Tonspur ist da, und es ist nichts drauf. "Tonspur vorhanden" ist die
    # schwaechste Pruefung, die man ueber Ton anstellen kann.
    #
    # DIE ABWEICHUNG vom Zielwert wird nur vermerkt, nicht bestraft. Der
    # erste Entwurf dieser Pruefung wies alles ab, was mehr als 6 LU unter
    # -14 LUFS lag — und liess prompt die vorhandene Gegenprobe durchfallen:
    # Das Testvideo der Kette liegt bei -21,9 LUFS. Gemessen, nicht vermutet.
    # Eine Sperre, die eingefuehrte Faelle abweist, wird nach zwei Tagen
    # abgeschaltet; dann prueft gar nichts mehr. Erst wird gemessen, und wenn
    # die Zahlen zeigen, dass die Renderer danebenliegen, wird die Grenze
    # bewusst enger gezogen — mit den Daten in der Hand.
    lufs = None
    if info.hat_ton:
        lufs = common.lautheit(p)
        if lufs is not None:
            still = float(guardrails.wert("video.stille_grenze_lufs", -45.0))
            ziel = float(guardrails.wert("video.ziel_lufs", -14.0))
            spielraum = float(guardrails.wert("video.lufs_hinweis_ab", 6.0))
            if lufs <= still:
                gruende.append(
                    f"Tonspur ist praktisch still ({lufs:.1f} LUFS) — eine leere "
                    f"Tonspur ist keine Tonspur"
                )
            elif abs(lufs - ziel) > spielraum:
                print(f"[quality_gate] {p.name}: {lufs:.1f} LUFS statt {ziel:.0f} — "
                      f"vermerkt, nicht abgewiesen.")

    # ── Erstes Bild (Punkt 52) ───────────────────────────────────────
    #
    # Der haeufigste stille Fehler beim Verketten: Der erste Clip beginnt mit
    # einem Fade, und die ersten Frames sind leer. Auf TikTok heisst das, dass
    # die entscheidende erste halbe Sekunde schwarz ist — und genau in dieser
    # Zeit entscheidet sich, ob weitergeschaut wird (Punkt 29).
    #
    # HINWEIS, KEINE SPERRE. Ein dunkler Anfang kann gewollt sein, und eine
    # Sperre, die eingefuehrte Faelle abweist, wird nach zwei Tagen
    # abgeschaltet — dieselbe Ueberlegung wie bei der Lautheit oben.
    schwarz = common.erstes_bild_schwarz(p)
    if schwarz:
        print(f"[quality_gate] {p.name}: die ersten 0,3 s sind schwarz — "
              f"auf TikTok ist das die halbe Entscheidung. Vermerkt, nicht abgewiesen.")

    # ── Lesbarkeit des Untertitels (Punkt 43) ────────────────────────
    #
    # Weisser Text auf hellem Wasser ist unlesbar, und das passiert bei
    # fremdem Material staendig, weil niemand den Hintergrund selbst gedreht
    # hat. Auffallen tut es erst am Handy in der Sonne — also nach dem
    # Veroeffentlichen. Kontrast ist messbar, nicht Geschmack.
    #
    # GEMESSEN WIRD DER BEREICH UNTER DEM TEXTKASTEN, nicht das ganze Bild:
    # Ein dunkles Video mit hellem Untertitelbereich waere sonst "dunkel
    # genug", und der Text bliebe trotzdem unlesbar. Der Bereich leitet sich
    # aus denselben SAFE_*-Werten ab, mit denen der ASS-Stil gesetzt wird —
    # zwei Zahlenreihen fuer dasselbe waeren wieder die Fehlerklasse "zweite
    # Liste, die niemand pflegt".
    #
    # Auch hier: Hinweis. Ob im Clip an dieser Stelle ueberhaupt Text steht,
    # weiss die Ausgangspruefung nicht — sie sieht nur die fertige Datei. Eine
    # Sperre wuerde also Clips ohne Untertitel mit abweisen.
    untertitel_hell = None
    if info.breite and info.hoehe:
        bereich = common.untertitel_bereich(info.breite, info.hoehe)
        untertitel_hell = common.helligkeit(p, ausschnitt=bereich)
        if untertitel_hell is not None and untertitel_hell > common.HELL_GRENZE_YAVG:
            print(f"[quality_gate] {p.name}: Untertitelbereich sehr hell "
                  f"({untertitel_hell:.0f}/255) — weisser Text koennte untergehen. "
                  f"Vermerkt, nicht abgewiesen.")

    # ── Sperrzonen der Plattform (Punkt 31) ──────────────────────────
    #
    # Es zaehlt die AUSSPIELUNG, nicht die Quelle. Ob ein Textkasten unter
    # TikToks Bedienelementen verschwindet, sah man bisher erst in der App.
    #
    # Geprueft werden die RAENDER, mit denen die ASS-Stile arbeiten, nicht das
    # fertige Bild: Der Fehler entsteht beim Setzen, und dort laesst er sich
    # benennen statt nur zeigen. Deshalb haengt das Ergebnis auch nicht an
    # dieser einen Datei — es gilt fuer jeden Clip mit demselben Stil.
    #
    # HINWEIS, KEINE SPERRE: Die Zonen sind Schaetzungen der Plattform, keine
    # Messungen. Eine Sperre auf einer Schaetzung wuerde Clips abweisen, die
    # in der App gut aussehen.
    zonen = common.textzonen_verletzung(breite=info.breite or 1080,
                                        hoehe=info.hoehe or 1920)
    for hinweis in zonen:
        print(f"[quality_gate] {p.name}: {hinweis}")

    return Pruefergebnis(not gruende, gruende, info, lufs,
                         schwarzer_anfang=schwarz, untertitel_hell=untertitel_hell,
                         sperrzonen=zonen)


def haltefest(video_id: int, ergebnis: Pruefergebnis) -> None:
    """Ergebnis am Video vermerken — daran haengt die Veroeffentlichung."""
    if not db.verfuegbar():
        return
    db.ausfuehren(
        """UPDATE mkt_videos
              SET pruefergebnis = %s, pruefgrund = %s,
                  dauer_sek = %s, breite = %s, hoehe = %s,
                  loudness_lufs = %s
            WHERE id = %s""",
        (
            "ok" if ergebnis.bestanden else "verworfen",
            ergebnis.als_text()[:1000],
            ergebnis.info.dauer if ergebnis.info else None,
            ergebnis.info.breite if ergebnis.info else None,
            ergebnis.info.hoehe if ergebnis.info else None,
            # Die Spalte gibt es seit Runde 10 und war bis heute immer leer.
            ergebnis.lufs,
            video_id,
        ),
    )
    if not ergebnis.bestanden:
        db.audit("video_verworfen", job="render",
                 begruendung=ergebnis.als_text()[:400])
