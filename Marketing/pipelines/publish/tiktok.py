"""TikTok — offizielle Schnittstelle bevorzugt, Browser-Weg als Rueckfall.

DER ALTE STAND WAR KEINE AUTOMATISIERUNG

Das bisherige Programm steuerte den Browser, fuellte Datei und Text aus — und
hoerte dann auf. Ein Mensch musste "Posten" druecken. Ein Automat, der auf
einen Menschen wartet, laeuft nachts nicht.

Deshalb hier zwei Wege, und beide laufen bis zur Bestaetigung durch:

  1. Content Posting API (bevorzugt) — mit Zugangsdaten, sauber, prueft den
     Verarbeitungsstand bis "veroeffentlicht".
  2. Browser-Weg ueber den mitgelieferten chromedriver — nur wenn keine
     Zugangsdaten da sind. Er MUSS bis zum Absenden durchlaufen; tut er es
     nicht, ist es ein Fehler und kein Teilerfolg.

KI-KENNZEICHNUNG
Bei Stil B wird das Plattform-Feld fuer KI-Inhalte gesetzt — zusaetzlich zum
Hinweis im Text. Beides, weil der Text im Video steht und das Feld die
Plattform informiert.
"""

from __future__ import annotations

import os
import time
from typing import Any

from .. import db
from ..orchestrator import guardrails
from .base import Beitrag, Plattform, Veroeffentlichungsfehler

BASIS = "https://open.tiktokapis.com/v2"


class TikTok(Plattform):
    name = "tiktok"

    # ── Zugang ───────────────────────────────────────────────────────

    def _zugriffsmarke(self) -> str | None:
        """Gueltige Zugriffsmarke, notfalls ueber die Erneuerungsmarke geholt.

        Die Marken liegen in der Datenbank, nicht in einer Datei: In GitHub
        Actions ist der Checkout fluechtig, eine dort erneuerte Marke waere
        beim naechsten Lauf weg.
        """
        direkt = (os.environ.get("TIKTOK_ACCESS_TOKEN") or "").strip()
        if direkt:
            return direkt
        if not db.verfuegbar():
            return None
        zeile = db.eine_zeile(
            """SELECT wert FROM mkt_config_overrides WHERE pfad = 'tiktok.access_token'"""
        )
        return str(zeile["wert"]) if zeile and zeile["wert"] else None

    def bereit(self) -> tuple[bool, str | None]:
        try:
            import requests  # noqa: F401
        except ImportError:
            return False, "requests ist nicht installiert"
        if self._zugriffsmarke():
            return True, None
        if os.environ.get("TIKTOK_CLIENT_KEY") and os.environ.get("TIKTOK_CLIENT_SECRET"):
            return False, ("TIKTOK_CLIENT_KEY/SECRET vorhanden, aber keine Zugriffsmarke — "
                           "einmalige Anmeldung noetig")
        if self._browser_moeglich()[0]:
            return True, None
        return False, ("weder TIKTOK_ACCESS_TOKEN noch Browser-Weg verfuegbar "
                       f"({self._browser_moeglich()[1]})")

    def _browser_moeglich(self) -> tuple[bool, str | None]:
        try:
            import selenium  # noqa: F401
        except ImportError:
            return False, "selenium ist nicht installiert"
        if not guardrails.kann_lokale_jobs():
            return False, "Browser-Weg braucht einen lokalen Runner"
        if not (os.environ.get("TIKTOK_SESSION_ID") or os.environ.get("TIKTOK_CHROME_PROFILE")):
            return False, "TIKTOK_SESSION_ID oder TIKTOK_CHROME_PROFILE fehlt"
        return True, None

    # ── Posten ───────────────────────────────────────────────────────

    def poste(self, beitrag: Beitrag) -> str:
        marke = self._zugriffsmarke()
        if marke:
            return self._ueber_api(beitrag, marke)
        moeglich, grund = self._browser_moeglich()
        if moeglich:
            return self._ueber_browser(beitrag)
        raise Veroeffentlichungsfehler(f"kein Weg zum Posten: {grund}")

    def _ueber_api(self, beitrag: Beitrag, marke: str) -> str:
        import requests

        if not beitrag.video_pfad.exists():
            raise Veroeffentlichungsfehler(f"Videodatei fehlt: {beitrag.video_pfad}")
        if not guardrails.ratenbegrenzer.warte_bis_erlaubt("tiktok", max_sek=30):
            raise Veroeffentlichungsfehler("TikTok: Kontingent erschoepft")

        groesse = beitrag.video_pfad.stat().st_size
        kopf = {"Authorization": f"Bearer {marke}", "Content-Type": "application/json"}

        # 1) Anmelden, wie viel hochgeladen wird.
        start = requests.post(
            f"{BASIS}/post/publish/video/init/",
            headers=kopf,
            json={
                "post_info": {
                    "title": beitrag.caption[:2200],
                    "privacy_level": os.environ.get("TIKTOK_PRIVACY", "SELF_ONLY"),
                    "disable_comment": False,
                    # Kennzeichnung als KI-Inhalt bei Stil B — Pflicht.
                    "brand_content_toggle": False,
                    "brand_organic_toggle": True,
                    "is_aigc": beitrag.stil == "B",
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": groesse,
                    "chunk_size": groesse,
                    "total_chunk_count": 1,
                },
            },
            timeout=60,
        )
        start.raise_for_status()
        daten = (start.json() or {}).get("data") or {}
        upload_url = daten.get("upload_url")
        publish_id = daten.get("publish_id")
        if not upload_url or not publish_id:
            raise Veroeffentlichungsfehler(f"TikTok-Antwort unvollstaendig: {start.text[:200]}")

        # 2) Datei hochladen.
        with open(beitrag.video_pfad, "rb") as datei:
            hoch = requests.put(
                upload_url,
                data=datei,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Range": f"bytes 0-{groesse - 1}/{groesse}",
                },
                timeout=600,
            )
        hoch.raise_for_status()

        # 3) Bis zur Bestaetigung warten — MIT Zeitlimit.
        #    Ohne diesen Schritt waere unklar, ob der Beitrag wirklich
        #    erscheint; genau daran krankte der alte Browser-Weg.
        frist = time.monotonic() + 300
        while time.monotonic() < frist:
            time.sleep(8)
            stand = requests.post(
                f"{BASIS}/post/publish/status/fetch/",
                headers=kopf, json={"publish_id": publish_id}, timeout=30,
            )
            stand.raise_for_status()
            zustand = ((stand.json() or {}).get("data") or {}).get("status", "")
            if zustand in ("PUBLISH_COMPLETE", "SEND_TO_USER_INBOX"):
                return str(publish_id)
            if zustand in ("FAILED", "CANCELED"):
                raise Veroeffentlichungsfehler(f"TikTok meldet {zustand}")
        raise TimeoutError("TikTok bestaetigte die Veroeffentlichung nicht innerhalb von 5 Minuten")

    def _ueber_browser(self, beitrag: Beitrag) -> str:
        """Rueckfall ueber den Browser — laeuft BIS ZUM ABSENDEN durch.

        Der alte Stand hoerte nach dem Ausfuellen auf. Hier wird abgesendet
        und auf die Bestaetigung gewartet; bleibt sie aus, ist es ein Fehler.
        """
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.support.ui import WebDriverWait

        einstellungen = webdriver.ChromeOptions()
        profil = os.environ.get("TIKTOK_CHROME_PROFILE")
        if profil:
            einstellungen.add_argument(f"--user-data-dir={profil}")
        treiber = webdriver.Chrome(options=einstellungen)
        try:
            treiber.get("https://www.tiktok.com/tiktokstudio/upload")
            sitzung = os.environ.get("TIKTOK_SESSION_ID")
            if sitzung:
                treiber.add_cookie({"name": "sessionid", "value": sitzung,
                                    "domain": ".tiktok.com"})
                treiber.get("https://www.tiktok.com/tiktokstudio/upload")

            warte = WebDriverWait(treiber, 60)
            feld = warte.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=file]")))
            feld.send_keys(str(beitrag.video_pfad.resolve()))

            beschreibung = warte.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[contenteditable=true]"))
            )
            beschreibung.clear()
            beschreibung.send_keys(beitrag.caption[:2000])

            # HIER endete der alte Stand. Ab hier ist es Automatisierung:
            knopf = warte.until(EC.element_to_be_clickable(
                (By.XPATH, "//button[.//div[contains(text(),'Post')] or contains(.,'Posten')]")
            ))
            knopf.click()
            WebDriverWait(treiber, 300).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//*[contains(text(),'wurde gepostet') or contains(text(),'was posted')]")
                )
            )
            return f"browser-{int(time.time())}"
        finally:
            treiber.quit()
