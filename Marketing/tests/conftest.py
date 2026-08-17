"""Gemeinsame Test-Voraussetzungen.

Sorgt dafuer, dass "pipelines" importierbar ist, egal aus welchem Ordner
pytest gestartet wird — und stellt Hilfsmittel bereit, mit denen Tests gegen
die ECHTE Postgres-Datenbank laufen koennen, ohne echte Daten anzufassen.

Warum gegen die echte Datenbank und nicht gegen eine Attrappe: Der Kern
dieser Etappe ist eine einzige SQL-Anweisung, die zwei gleichzeitige Runner
auseinanderhaelt. Eine Attrappe wuerde genau das nachbauen, was geprueft
werden soll — und damit nichts beweisen. Vergleiche
CLAUDE.md Paragraph 2: "ein Test, der nur gruen werden kann, ist wertlos"
und die Notiz "Nachbauten muessen luegenfrei sein".
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest

MARKETING = Path(__file__).resolve().parents[1]
if str(MARKETING) not in sys.path:
    sys.path.insert(0, str(MARKETING))

from pipelines import db  # noqa: E402

# Ohne DATABASE_URL (so laeuft der CI-Prueflauf) werden DB-Tests uebersprungen,
# statt rot zu werden. Dieselbe Linie wie test/db-backup.test.js im Shop.
braucht_db = pytest.mark.skipif(
    not db.verfuegbar(),
    reason=f"keine Datenbank — {db.grund_fuer_fehlende_db()}",
)


@pytest.fixture(scope="session", autouse=True)
def _verbindung_schliessen():
    """Am Ende des Testlaufs die Datenbankverbindung sauber schliessen.

    Ohne das meldet psycopg eine ResourceWarning ("was deleted while still
    open"). Die ist harmlos, aber pytest.ini stellt Warnungen scharf — eine
    Warnung, die man dauerhaft ignoriert, verdeckt irgendwann eine echte.
    """
    yield
    db.schliessen()


@pytest.fixture
def test_job():
    """Ein eigener Job-Eintrag je Test, danach restlos entfernt.

    Eigener Name statt eines echten Jobs: Tests duerfen den laufenden
    Zeitplan des Systems nicht durcheinanderbringen.
    """
    name = f"__test_{uuid.uuid4().hex[:8]}"
    yield name
    if db.verfuegbar():
        try:
            db.ausfuehren("DELETE FROM mkt_job_events WHERE job = %s", (name,))
            db.ausfuehren("DELETE FROM mkt_jobs WHERE job = %s", (name,))
            db.ausfuehren("DELETE FROM mkt_audit_log WHERE job = %s", (name,))
        except Exception:
            pass


def _lege_video_an() -> tuple[int, int, int, int]:
    """Legt eine vollstaendige Kette Trend -> Match -> Brief -> Video an.

    Erfundene IDs gehen hier nicht: mkt_posts.video_id hat einen
    Fremdschluessel auf mkt_videos. Das ist beim ersten Anlauf aufgefallen —
    und es ist gut so, denn ein Test mit erfundenen IDs haette an der echten
    Datenbank vorbeigeprueft.
    """
    marke = f"__test_{uuid.uuid4().hex[:8]}"
    trend = db.eine_zeile(
        """INSERT INTO mkt_trends (quelle, keyword, keyword_norm)
           VALUES ('shop', %s, %s) RETURNING id""", (marke, marke),
    )
    match = db.eine_zeile(
        """INSERT INTO mkt_matches (trend_id, produkt_id, passungs_score, begruendung)
           VALUES (%s, 10, 1.0, %s) RETURNING id""", (trend["id"], marke),
    )
    brief = db.eine_zeile(
        """INSERT INTO mkt_briefs
             (match_id, hook_varianten, skript, cta, hashtags, stil, merkmale,
              compliance_status)
           VALUES (%s, '[]', %s, 'Werbung.', '[]', 'A', '{}', 'ok') RETURNING id""",
        (match["id"], marke),
    )
    video = db.eine_zeile(
        """INSERT INTO mkt_videos (brief_id, stil, pfad, pruefergebnis)
           VALUES (%s, 'A', %s, 'ok') RETURNING id""", (brief["id"], f"{marke}.mp4"),
    )
    return int(video["id"]), int(brief["id"]), int(match["id"]), int(trend["id"])


def _raeume_video_ab(ids: tuple[int, int, int, int]) -> None:
    video_id, brief_id, match_id, trend_id = ids
    try:
        db.ausfuehren("DELETE FROM mkt_posts WHERE video_id = %s", (video_id,))
        db.ausfuehren("DELETE FROM mkt_videos WHERE id = %s", (video_id,))
        db.ausfuehren("DELETE FROM mkt_briefs WHERE id = %s", (brief_id,))
        db.ausfuehren("DELETE FROM mkt_matches WHERE id = %s", (match_id,))
        db.ausfuehren("DELETE FROM mkt_trends WHERE id = %s", (trend_id,))
    except Exception:
        pass


@pytest.fixture
def test_video():
    """Eine echte Video-Zeile samt Vorkette, danach restlos entfernt."""
    if not db.verfuegbar():
        yield None
        return
    ids = _lege_video_an()
    yield ids[0]
    _raeume_video_ab(ids)


@pytest.fixture
def test_videos():
    """Fabrik fuer MEHRERE Videos.

    Gebraucht ueberall dort, wo mehrere Beitraege nebeneinander stehen
    muessen — seit es die Regel "ein lebender Beitrag je Video und
    Plattform" gibt, laesst sich das mit einem einzigen Video nicht mehr
    nachstellen. Genau daran ist der Abstands-Test zuerst gescheitert, und
    das war die Regel, die korrekt zugeschlagen hat.
    """
    angelegt: list[tuple[int, int, int, int]] = []

    def fabrik(anzahl: int = 1) -> list[int]:
        if not db.verfuegbar():
            return []
        for _ in range(anzahl):
            angelegt.append(_lege_video_an())
        return [ids[0] for ids in angelegt[-anzahl:]]

    yield fabrik
    for ids in angelegt:
        _raeume_video_ab(ids)


def lege_job_an(name: str, *, abstand_sek: int = 3600, faellig: bool = True,
                requires_local: bool = False, enabled: bool = True) -> None:
    """Testjob mit definierter Faelligkeit anlegen.

    Der Versatz wird als Zahl uebergeben (negativ = schon faellig), NICHT per
    String-Formatierung in die Anweisung geschrieben: ein "%" im SQL-Text
    kollidiert mit den %s-Platzhaltern von psycopg — genau daran sind die
    Tests beim ersten Lauf gescheitert.
    """
    versatz_sek = -60 if faellig else 60
    db.ausfuehren(
        """INSERT INTO mkt_jobs (job, abstand_sek, requires_local, enabled, naechster_lauf)
           VALUES (%s, %s, %s, %s, now() + make_interval(secs => %s))
           ON CONFLICT (job) DO UPDATE
             SET abstand_sek = EXCLUDED.abstand_sek,
                 requires_local = EXCLUDED.requires_local,
                 enabled = EXCLUDED.enabled,
                 naechster_lauf = EXCLUDED.naechster_lauf,
                 laeuft_seit = NULL, heartbeat_at = NULL,
                 laeufe = 0, fehler_zaehler = 0""",
        (name, abstand_sek, requires_local, enabled, versatz_sek),
    )
