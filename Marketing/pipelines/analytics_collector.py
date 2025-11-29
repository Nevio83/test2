"""Analytics collector stub.

Fetches performance metrics for uploaded videos and logs them into a
structured CSV/SQLite table so future runs can learn what works best.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Iterable

import csv

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "data" / "performance_log.csv"


FIELDNAMES = [
    "video_id",
    "product_id",
    "trend_keyword",
    "views",
    "likes",
    "watch_time",
    "ctr",
    "collected_at",
]


def ensure_log():
    if not LOG_PATH.exists():
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, FIELDNAMES)
            writer.writeheader()


def append_rows(rows: Iterable[dict]):
    ensure_log()
    with LOG_PATH.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, FIELDNAMES)
        for row in rows:
            writer.writerow(row)


def fetch_metrics_stub(video_ids):
    # TODO: call TikTok Insights once API credentials are available.
    now = datetime.utcnow().isoformat()
    for vid in video_ids:
        yield {
            "video_id": vid,
            "product_id": vid.split("_")[-1],
            "trend_keyword": "placeholder",
            "views": 1234,
            "likes": 210,
            "watch_time": 37.5,
            "ctr": 0.08,
            "collected_at": now,
        }


def main():
    sample_video_ids = ["video_product_10"]
    append_rows(fetch_metrics_stub(sample_video_ids))
    print(f"Logged metrics for {len(sample_video_ids)} videos -> {LOG_PATH.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    main()
