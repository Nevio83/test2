"""Wochenbericht — was lief, was hat das System gelernt, was kostet es.

WOZU DER BERICHT DA IST
Das System arbeitet ohne Aufsicht. Genau deshalb muss einmal pro Woche
jemand sehen koennen, was es getan hat — und zwar ohne sich einloggen zu
muessen. Der Bericht ist die Bringschuld des Automaten.

WAS DRINSTEHT
Beste und schlechteste Beitraege, was gelernt wurde, Kosten, Umsatzzuordnung,
Ausfaelle — und ausdruecklich, was das System als Naechstes ausprobieren
will. Der letzte Punkt ist der wichtigste: Er macht die Absicht sichtbar,
bevor sie umgesetzt wird.

IM TROCKENLAUF WIRD NICHT VERSCHICKT
Der Bericht wird erzeugt und protokolliert, aber nicht gemailt. Sonst
kaeme bei jedem Test eine Mail.
"""

from __future__ import annotations

import html
import os
from datetime import datetime
from typing import Any

from .. import db
from ..analytics import attribution
from ..orchestrator import guardrails
from . import bandit, features


def _sammle() -> dict[str, Any]:
    """Alle Zahlen fuer den Bericht einsammeln."""
    daten: dict[str, Any] = {"erstellt": datetime.now().strftime("%d.%m.%Y %H:%M")}
    if not db.verfuegbar():
        daten["grund"] = db.grund_fuer_fehlende_db()
        return daten

    daten["beitraege"] = db.abfragen(
        """SELECT p.plattform, p.status, count(*)::int AS n
             FROM mkt_posts p
            WHERE p.erstellt_am > now() - interval '7 days'
            GROUP BY 1, 2 ORDER BY 1, 2"""
    )
    daten["beste"] = db.abfragen(
        """SELECT p.id, p.slot, p.plattform, r.reward_final, r.reward_vorlaeufig,
                  v.stil, m.produkt_id
             FROM mkt_rewards r
             JOIN mkt_posts p ON p.id = r.post_id
             JOIN mkt_videos v ON v.id = p.video_id
             JOIN mkt_briefs b ON b.id = v.brief_id
             JOIN mkt_matches m ON m.id = b.match_id
            WHERE r.berechnet_am > now() - interval '7 days'
            ORDER BY COALESCE(r.reward_final, r.reward_vorlaeufig) DESC NULLS LAST
            LIMIT 3"""
    )
    daten["schlechteste"] = db.abfragen(
        """SELECT p.id, p.slot, p.plattform, r.reward_final, r.reward_vorlaeufig, v.stil
             FROM mkt_rewards r
             JOIN mkt_posts p ON p.id = r.post_id
             JOIN mkt_videos v ON v.id = p.video_id
            WHERE r.berechnet_am > now() - interval '7 days'
            ORDER BY COALESCE(r.reward_final, r.reward_vorlaeufig) ASC NULLS LAST
            LIMIT 3"""
    )
    daten["umsatz"] = db.eine_zeile(
        """SELECT COALESCE(SUM(bestellungen), 0)::int AS bestellungen,
                  COALESCE(SUM(umsatz), 0)::float AS umsatz,
                  COALESCE(SUM(deckungsbeitrag), 0)::float AS deckungsbeitrag,
                  COALESCE(SUM(shop_sessions), 0)::int AS sitzungen
             FROM mkt_attribution WHERE berechnet_am > now() - interval '7 days'"""
    )
    daten["kosten"] = db.abfragen(
        """SELECT anbieter, SUM(kosten_cent)::int AS cent, count(*)::int AS aufrufe
             FROM mkt_cost_ledger WHERE zeitpunkt > now() - interval '7 days'
            GROUP BY 1 ORDER BY 2 DESC"""
    )
    daten["ausfaelle"] = db.abfragen(
        """SELECT job, count(*)::int AS n, MAX(fehlertext) AS beispiel
             FROM mkt_job_events
            WHERE ergebnis = 'fehler' AND gestartet_at > now() - interval '7 days'
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5"""
    )
    daten["messbarkeit"] = attribution.messbarkeit()

    # Lernstand je Dimension: was fuehrt, was ist gesperrt.
    lernstand = []
    for dimension in features.STEUERBAR:
        erlaubt = features.DIMENSIONEN.get(dimension) or ()
        if len(erlaubt) < 2:
            continue
        zeilen = db.abfragen(
            """SELECT auspraegung, alpha, beta, versuche, gesperrt_bis
                 FROM mkt_arms WHERE dimension = %s AND kontext = '*'
                ORDER BY alpha / NULLIF(alpha + beta, 0) DESC""",
            (dimension,),
        )
        if not zeilen:
            continue
        lernstand.append({
            "dimension": dimension,
            "arme": [{
                "auspraegung": z["auspraegung"],
                "wert": round(float(z["alpha"]) / (float(z["alpha"]) + float(z["beta"])), 3),
                "versuche": int(z["versuche"]),
                "gesperrt": bool(z["gesperrt_bis"]),
            } for z in zeilen],
        })
    daten["lernstand"] = lernstand

    daten["naechste_versuche"] = _naechste_versuche(lernstand)
    return daten


def _naechste_versuche(lernstand: list[dict[str, Any]]) -> list[str]:
    """Was will das System als Naechstes ausprobieren?

    Die Absicht sichtbar machen, BEVOR sie umgesetzt wird — das ist der
    Unterschied zwischen einem Automaten, dem man zusieht, und einem, dem
    man ausgeliefert ist.
    """
    min_stichprobe = int(guardrails.wert("lernen.min_stichprobe", 8))
    vorhaben = []
    for eintrag in lernstand:
        zu_wenig = [a for a in eintrag["arme"]
                    if a["versuche"] < min_stichprobe and not a["gesperrt"]]
        if zu_wenig:
            namen = ", ".join(a["auspraegung"] for a in zu_wenig[:3])
            vorhaben.append(
                f"{eintrag['dimension']}: {namen} haben noch zu wenig Daten "
                f"(unter {min_stichprobe}) und werden bevorzugt ausprobiert"
            )
    if not vorhaben:
        vorhaben.append("Noch keine Auswertung moeglich — es fehlen veroeffentlichte Beitraege.")
    return vorhaben


def _euro(cent: Any) -> str:
    try:
        return f"{float(cent) / 100:.2f} EUR".replace(".", ",")
    except (TypeError, ValueError):
        return "0,00 EUR"


def baue_html(daten: dict[str, Any]) -> str:
    """Der Bericht als HTML — dieselbe Fassung fuer Mail und Dashboard."""
    e = html.escape

    def liste(zeilen, formatierer):
        if not zeilen:
            return "<p style='color:#888'>Keine Daten in diesem Zeitraum.</p>"
        return "<ul>" + "".join(f"<li>{formatierer(z)}</li>" for z in zeilen) + "</ul>"

    umsatz = daten.get("umsatz") or {}
    messbar = daten.get("messbarkeit") or {}
    hinweis = ""
    if not messbar.get("umsatz_zuordnung_moeglich", False):
        gruende = "; ".join(messbar.get("fehlt") or [])
        hinweis = (
            "<div style='background:#3a2a12;border-left:4px solid #d98324;padding:12px;"
            "margin:16px 0;border-radius:6px'><strong>Umsatzzuordnung noch nicht moeglich:</strong> "
            f"{e(gruende)}</div>"
        )

    lernstand_html = ""
    for eintrag in daten.get("lernstand", []):
        arme = "".join(
            f"<li>{e(a['auspraegung'])}: <strong>{a['wert']:.2f}</strong> "
            f"({a['versuche']} Versuche){' — gesperrt' if a['gesperrt'] else ''}</li>"
            for a in eintrag["arme"]
        )
        lernstand_html += f"<p><strong>{e(eintrag['dimension'])}</strong></p><ul>{arme}</ul>"
    if not lernstand_html:
        lernstand_html = "<p style='color:#888'>Noch nichts gelernt — es fehlen bewertete Beitraege.</p>"

    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Marketing-Wochenbericht</title></head>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#14161a;
             color:#e6e8eb;margin:0;padding:24px">
  <div style="max-width:720px;margin:0 auto">
    <h1 style="margin:0 0 4px">Marketing-Wochenbericht</h1>
    <p style="color:#9aa3ad;margin:0 0 20px">Stand {e(str(daten.get('erstellt', '')))}</p>
    {hinweis}

    <h2>Umsatz</h2>
    <p>{int(umsatz.get('sitzungen') or 0)} Sitzungen aus Kampagnen ·
       <strong>{int(umsatz.get('bestellungen') or 0)} Bestellungen</strong> ·
       {float(umsatz.get('umsatz') or 0):.2f} EUR Umsatz ·
       {float(umsatz.get('deckungsbeitrag') or 0):.2f} EUR Deckungsbeitrag</p>

    <h2>Beitraege</h2>
    {liste(daten.get('beitraege'), lambda z: f"{e(str(z['plattform']))} / {e(str(z['status']))}: {z['n']}")}

    <h2>Beste Beitraege</h2>
    {liste(daten.get('beste'), lambda z: f"#{z['id']} ({e(str(z['slot'] or '?'))}, Stil {e(str(z['stil']))}): "
                                          f"{(z['reward_final'] or z['reward_vorlaeufig'] or 0):.3f}")}

    <h2>Schwaechste Beitraege</h2>
    {liste(daten.get('schlechteste'), lambda z: f"#{z['id']} ({e(str(z['slot'] or '?'))}, Stil {e(str(z['stil']))}): "
                                                 f"{(z['reward_final'] or z['reward_vorlaeufig'] or 0):.3f}")}

    <h2>Was das System gelernt hat</h2>
    {lernstand_html}

    <h2>Was es als Naechstes ausprobieren will</h2>
    <ul>{''.join(f'<li>{e(v)}</li>' for v in daten.get('naechste_versuche', []))}</ul>

    <h2>Kosten</h2>
    {liste(daten.get('kosten'), lambda z: f"{e(str(z['anbieter']))}: {_euro(z['cent'])} ({z['aufrufe']} Aufrufe)")}

    <h2>Ausfaelle</h2>
    {liste(daten.get('ausfaelle'), lambda z: f"{e(str(z['job']))}: {z['n']}× — {e(str(z['beispiel'] or '')[:120])}")}

    <p style="color:#6b7280;font-size:12px;margin-top:28px">
      Erzeugt vom Marketing-Automaten. Notaus: Datei <code>Marketing/STOP</code> anlegen
      oder den Schalter im Admin-Bereich umlegen.</p>
  </div>
</body></html>"""


def job_wochenbericht() -> dict[str, Any]:
    """Bericht erzeugen und verschicken (im Trockenlauf nur protokollieren)."""
    daten = _sammle()
    bericht = baue_html(daten)

    ziel = (os.environ.get("ADMIN_EMAIL") or os.environ.get("RECEIPT_ARCHIVE_EMAIL") or "").strip()
    trocken = guardrails.trockenlauf()

    if db.verfuegbar():
        db.audit("wochenbericht", job="weekly_report",
                 begruendung=f"{len(bericht)} Zeichen erzeugt",
                 nachher={"bestellungen": (daten.get("umsatz") or {}).get("bestellungen"),
                          "verschickt": bool(ziel) and not trocken})

    if trocken:
        print(f"[bericht] Trockenlauf — nicht verschickt ({len(bericht)} Zeichen erzeugt)")
        return {"erzeugt": True, "verschickt": False, "grund": "Trockenlauf"}
    if not ziel:
        print("[bericht] keine Empfaengeradresse (ADMIN_EMAIL) — nicht verschickt")
        return {"erzeugt": True, "verschickt": False, "grund": "ADMIN_EMAIL fehlt"}

    try:
        import requests

        schluessel = (os.environ.get("RESEND_API_KEY") or "").strip()
        if not schluessel:
            return {"erzeugt": True, "verschickt": False, "grund": "RESEND_API_KEY fehlt"}
        antwort = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {schluessel}", "Content-Type": "application/json"},
            json={
                "from": os.environ.get("RESEND_FROM_EMAIL", "noreply@maiosshop.com"),
                "to": [ziel],
                "subject": "Marketing-Wochenbericht",
                "html": bericht,
            },
            timeout=45,
        )
        antwort.raise_for_status()
        print(f"[bericht] verschickt an {ziel}")
        return {"erzeugt": True, "verschickt": True}
    except Exception as fehler:
        print(f"[bericht] Versand fehlgeschlagen: {fehler}")
        return {"erzeugt": True, "verschickt": False, "grund": str(fehler)[:200]}
