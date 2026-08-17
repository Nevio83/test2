"""Postgres-Zugriff fuer das Marketing-System.

WARUM DIESE DATEI SO AUSSIEHT

Der Marketing-Automat laeuft in drei Umgebungen (GitHub Actions, lokaler PC,
Render-Worker). In keiner davon ist garantiert, dass eine Datenbank erreichbar
ist — im CI-Prueflauf ist bewusst KEINE DATABASE_URL gesetzt, weil der Shop
auch ohne starten muss. Diese Datei darf deshalb beim Import niemals werfen.

Sie unterscheidet klar zwei Zustaende:

  1. Es gibt keine Datenbank  -> verfuegbar() ist False, der Aufrufer
     protokolliert den Grund und ueberspringt seinen Job.
  2. Es gibt eine Datenbank    -> alle Abfragen laufen normal.

Was hier bewusst NICHT passiert: Tabellen anlegen. Das Schema gehoert dem Shop
(database.js, SCHEMA-Liste, Praefix mkt_). Zwei Stellen, die dasselbe Schema
verwalten, laufen frueher oder spaeter auseinander — genau die Fehlerklasse,
die dieses Projekt mit der zweiten Produktliste schon einmal getroffen hat.
"""

from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Any, Iterable, Iterator, Sequence

from . import env_loader  # noqa: F401  -- laedt .env als Seiteneffekt

# psycopg ist optional. Fehlt es, laeuft alles weiter, nur eben ohne DB.
try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - haengt an der Installation
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

# psycopg_pool ist ein EIGENES Paket. Ist es da, wird ein echter Pool benutzt;
# fehlt es, reicht eine wiederverwendete Einzelverbindung. Fuer einen Prozess,
# der ohnehin nur ein paar Minuten lebt (Actions-Lauf), ist das kein Nachteil.
try:
    from psycopg_pool import ConnectionPool
except ImportError:  # pragma: no cover
    ConnectionPool = None  # type: ignore[assignment]


class KeineDatenbank(RuntimeError):
    """Wird geworfen, wenn eine Abfrage ohne Datenbank versucht wird."""


_pool: Any = None
_einzelverbindung: Any = None
_sperre = threading.Lock()


def dsn() -> str | None:
    """Verbindungszeichenfolge — dieselbe wie der Shop (Neon)."""
    wert = (os.environ.get("DATABASE_URL") or "").strip()
    return wert or None


def grund_fuer_fehlende_db() -> str | None:
    """Gibt zurueck, WARUM keine Datenbank da ist — oder None, wenn alles passt.

    Der Aufrufer soll den Grund protokollieren koennen, statt nur "geht nicht"
    zu melden. Ein stiller Fehlschlag sieht aus wie Betrieb, obwohl nichts
    laeuft.
    """
    if psycopg is None:
        return "psycopg ist nicht installiert (pip install 'psycopg[binary]')"
    if not dsn():
        return "DATABASE_URL ist nicht gesetzt"
    return None


def verfuegbar() -> bool:
    """True, wenn Abfragen moeglich sind. Prueft NICHT die Erreichbarkeit."""
    return grund_fuer_fehlende_db() is None


def _hole_pool() -> Any:
    global _pool
    if _pool is not None:
        return _pool
    with _sperre:
        if _pool is None and ConnectionPool is not None:
            _pool = ConnectionPool(
                conninfo=dsn(),
                min_size=1,
                max_size=4,
                kwargs={"row_factory": dict_row},
                open=True,
            )
    return _pool


@contextmanager
def verbindung() -> Iterator[Any]:
    """Liefert eine Verbindung. Bevorzugt aus dem Pool, sonst eine einzelne.

    Wirft KeineDatenbank, wenn gar nichts konfiguriert ist — bewusst laut,
    denn an dieser Stelle hat der Aufrufer die Pruefung uebersprungen.
    """
    grund = grund_fuer_fehlende_db()
    if grund:
        raise KeineDatenbank(grund)

    pool = _hole_pool()
    if pool is not None:
        with pool.connection() as conn:
            yield conn
        return

    # Rueckfall ohne psycopg_pool: eine Verbindung, die wiederverwendet wird.
    global _einzelverbindung
    with _sperre:
        if _einzelverbindung is None or _einzelverbindung.closed:
            _einzelverbindung = psycopg.connect(dsn(), row_factory=dict_row)
            _einzelverbindung.autocommit = True
    yield _einzelverbindung


def abfragen(sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    """SELECT -> Liste von Zeilen als dict."""
    with verbindung() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return list(cur.fetchall())


def eine_zeile(sql: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
    """SELECT -> erste Zeile oder None."""
    zeilen = abfragen(sql, params)
    return zeilen[0] if zeilen else None


def ausfuehren(sql: str, params: Sequence[Any] | None = None) -> int:
    """INSERT/UPDATE/DELETE -> Anzahl betroffener Zeilen."""
    with verbindung() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return cur.rowcount


def ausfuehren_viele(sql: str, reihen: Iterable[Sequence[Any]]) -> int:
    """Mehrfach dasselbe Statement — z.B. beim Einlesen vieler Trends."""
    reihen = list(reihen)
    if not reihen:
        return 0
    with verbindung() as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, reihen)
            return cur.rowcount


@contextmanager
def transaktion() -> Iterator[Any]:
    """Alles-oder-nichts. Nutzt psycopg-Transaktionen.

    Gebraucht wird das dort, wo mehrere Tabellen zusammen stimmig bleiben
    muessen — etwa Video + Post + Kostenzeile.
    """
    with verbindung() as conn:
        vorher = conn.autocommit
        try:
            if vorher:
                conn.autocommit = False
            with conn.transaction():
                yield conn
        finally:
            if vorher:
                conn.autocommit = True


def schliessen() -> None:
    """Verbindungen freigeben. Am Ende eines Laufs aufrufen."""
    global _pool, _einzelverbindung
    with _sperre:
        if _pool is not None:
            try:
                _pool.close()
            except Exception:  # pragma: no cover
                pass
            _pool = None
        if _einzelverbindung is not None:
            try:
                _einzelverbindung.close()
            except Exception:  # pragma: no cover
                pass
            _einzelverbindung = None


def audit(
    entscheidung: str,
    *,
    job: str | None = None,
    begruendung: str | None = None,
    alternativen: Any = None,
    score: float | None = None,
    vorher: Any = None,
    nachher: Any = None,
) -> None:
    """Schreibt eine Zeile ins Nachweis-Protokoll (mkt_audit_log).

    Absichtlich fehlertolerant: ein System, das ohne Aufsicht postet, soll am
    fehlenden Protokoll nicht scheitern — aber die Entscheidung selbst soll
    auch nicht lautlos verschwinden. Deshalb Fehler melden, nicht werfen.
    """
    import json

    if not verfuegbar():
        return
    try:
        ausfuehren(
            """INSERT INTO mkt_audit_log
                 (job, entscheidung, begruendung, alternativen, score, vorher, nachher)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (
                job,
                entscheidung,
                begruendung,
                json.dumps(alternativen, ensure_ascii=False) if alternativen is not None else None,
                score,
                json.dumps(vorher, ensure_ascii=False) if vorher is not None else None,
                json.dumps(nachher, ensure_ascii=False) if nachher is not None else None,
            ),
        )
    except Exception as fehler:  # pragma: no cover
        print(f"[db] Audit-Eintrag fehlgeschlagen: {fehler}")
