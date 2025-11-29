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
from pathlib import Path
from typing import Iterable, List

import sqlite3

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
    # TODO: Use pytrends to fetch rising queries for relevant verticals.
    now = datetime.now(UTC)
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


def fetch_reddit_trends() -> List[TrendRow]:
    # TODO: Query Reddit API (e.g., r/dropship, r/tiktokmarketing) for hot posts.
    now = datetime.now(UTC)
    return [
        TrendRow(
            source="reddit",
            keyword="home office hydration",
            sentiment=0.48,
            engagement_score=0.68,
            sample_hook="Das Gadget, das meine Nachtschicht rettet",
            captured_at=now,
        )
    ]


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
    rows.extend(fetch_reddit_trends())
    rows.extend(fetch_exploding_topics())
    save_trends(rows)
    print(f"Stored {len(rows)} trend rows in {DB_PATH.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    run_ingestion()
