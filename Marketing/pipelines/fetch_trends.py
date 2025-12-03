"""Trend ingestion pipeline for marketing automation.

This module pulls trend data from multiple sources (TikTok, Google Trends,
Reddit, ExplodingTopics) and normalizes it into a unified structure before
writing the rows into the local SQLite database located in data/trends.db.

Actual API calls are stubbed so we can focus on the end-to-end architecture
first. Fill in the TODO sections with live integrations once credentials
are available.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import os
from pathlib import Path
from typing import Iterable, List

import sqlite3

try:  # optional dependency
    from pytrends.request import TrendReq
except ImportError:  # pragma: no cover - pytrends is optional
    TrendReq = None

# --- Configuration -----------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "trends.db"


@dataclass
class TrendRow:
    source: str
    keyword: str
    sentiment: float
    engagement_score: float
    sample_hook: str
    captured_at: datetime

    def as_tuple(self) -> tuple:
        return (
            self.source,
            self.keyword,
            self.sentiment,
            self.engagement_score,
            self.sample_hook,
            self.captured_at.isoformat(),
        )


# --- SQLite bootstrap ---------------------------------------------------------------

def ensure_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                keyword TEXT NOT NULL,
                sentiment REAL NOT NULL,
                engagement_score REAL NOT NULL,
                sample_hook TEXT,
                captured_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_trends(rows: Iterable[TrendRow]) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.executemany(
            """
            INSERT INTO trends (
                source, keyword, sentiment, engagement_score, sample_hook, captured_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            [row.as_tuple() for row in rows],
        )
        conn.commit()


# --- Source fetchers (stubs) -------------------------------------------------------

def fetch_tiktok_trends() -> List[TrendRow]:
    # TODO: Integrate TikTokApi and compute engagement/sentiment per hashtag.
    now = datetime.now(UTC)
    return [
        TrendRow(
            source="tiktok",
            keyword="#desksetup",
            sentiment=0.62,
            engagement_score=0.81,
            sample_hook="POV: Dein Arbeitsplatz macht dich produktiver",
            captured_at=now,
        )
    ]


def fetch_google_trends() -> List[TrendRow]:
    """Fetch trending searches via pytrends (falls verfügbar)."""

    now = datetime.now(UTC)
    if TrendReq is None:
        return [
            TrendRow(
                source="google_trends",
                keyword="smoothie rezept",
                sentiment=0.55,
                engagement_score=0.74,
                sample_hook="Mealprep Sonntag in 5 Minuten",
                captured_at=now,
            )
        ]

    username = os.environ.get("GOOGLE_TRENDS_USERNAME") or None
    password = os.environ.get("GOOGLE_TRENDS_PASSWORD") or None
    region = os.environ.get("GOOGLE_TRENDS_REGION", "germany")
    keywords: List[TrendRow] = []
    try:
        trend = TrendReq(username=username, password=password, tz=0, retries=2, 
                         backoff_factor=0.1)
        df = trend.trending_searches(pn=region)
        top_rows = df[0].tolist()[:5]
    except Exception:
        top_rows = []

    for term in top_rows:
        keywords.append(
            TrendRow(
                source="google_trends",
                keyword=term.lower(),
                sentiment=0.6,
                engagement_score=0.7,
                sample_hook=f"Warum alle plötzlich nach '{term}' suchen",
                captured_at=now,
            )
        )

    if not keywords:
        keywords.append(
            TrendRow(
                source="google_trends",
                keyword="cozy home office",
                sentiment=0.57,
                engagement_score=0.72,
                sample_hook="So gestaltest du dein Büro hygge",
                captured_at=now,
            )
        )
    return keywords


def fetch_exploding_topics() -> List[TrendRow]:
    # TODO: Pull from ExplodingTopics API and normalize.
    now = datetime.now(UTC)
    return [
        TrendRow(
            source="exploding_topics",
            keyword="cozy lighting",
            sentiment=0.71,
            engagement_score=0.77,
            sample_hook="Wie ich mein Wohnzimmer in ein Spa verwandle",
            captured_at=now,
        )
    ]


# --- Entry point -------------------------------------------------------------------

def run_ingestion() -> None:
    ensure_database()
    rows: List[TrendRow] = []
    rows.extend(fetch_tiktok_trends())
    rows.extend(fetch_google_trends())
    rows.extend(fetch_exploding_topics())
    save_trends(rows)
    print(f"Stored {len(rows)} trend rows in {DB_PATH.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    run_ingestion()
