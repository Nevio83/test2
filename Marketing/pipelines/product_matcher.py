from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set

import sqlite3

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "trends.db"
PRODUCTS_JSON = BASE_DIR / "products.json"
PERFORMANCE_PATH = DATA_DIR / "performance_memory.json"


@dataclass
class PerformanceStats:
    attempts: int = 0
    successes: int = 0

    def to_dict(self) -> dict:
        return {"attempts": self.attempts, "successes": self.successes}

    @classmethod
    def from_dict(cls, data: dict) -> "PerformanceStats":
        return cls(attempts=data.get("attempts", 0), successes=data.get("successes", 0))

    def record(self, success: bool) -> None:
        self.attempts += 1
        if success:
            self.successes += 1

    @property
    def success_rate(self) -> float:
        if self.attempts == 0:
            return 0.0
        return self.successes / self.attempts


class PerformanceMemory:
    """Persists aggregated performance for products and trend-product pairs."""

    def __init__(self, product_stats: Dict[str, PerformanceStats], pair_stats: Dict[str, PerformanceStats]):
        self.product_stats = product_stats
        self.pair_stats = pair_stats

    @classmethod
    def load(cls, path: Path = PERFORMANCE_PATH) -> "PerformanceMemory":
        if not path.exists():
            return cls(product_stats={}, pair_stats={})
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            product_stats={k: PerformanceStats.from_dict(v) for k, v in data.get("product_stats", {}).items()},
            pair_stats={k: PerformanceStats.from_dict(v) for k, v in data.get("pair_stats", {}).items()},
        )

    def save(self, path: Path = PERFORMANCE_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "product_stats": {k: v.to_dict() for k, v in self.product_stats.items()},
            "pair_stats": {k: v.to_dict() for k, v in self.pair_stats.items()},
        }
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _get_pair_key(self, product_id: int, trend_keyword: str) -> str:
        return f"{product_id}__{trend_keyword.lower()}"

    def record(self, product_id: int, trend_keyword: str, success: bool) -> None:
        pid = str(product_id)
        stats = self.product_stats.setdefault(pid, PerformanceStats())
        stats.record(success)

        pair_key = self._get_pair_key(product_id, trend_keyword)
        pair_stats = self.pair_stats.setdefault(pair_key, PerformanceStats())
        pair_stats.record(success)

    def get_boost(self, product_id: int, trend_keyword: str) -> float:
        """Return a multiplier between 0 and ~1 derived from historical success."""

        def rate(stats: PerformanceStats | None) -> float:
            return stats.success_rate if stats else 0.0

        pid = str(product_id)
        product_rate = rate(self.product_stats.get(pid))
        pair_rate = rate(self.pair_stats.get(self._get_pair_key(product_id, trend_keyword)))
        # Weight pair history slightly higher than global product success.
        return 0.4 * product_rate + 0.6 * pair_rate

"""Product matching + lightweight learning from performance feedback.

Core flow:
1. Load recent trend rows from data/trends.db (output of fetch_trends).
2. Rank products by keyword overlap.
3. Apply performance boosts learned from previous campaign results that are
   logged via ``--feedback-*`` CLI options.

This is **not** a complex ML model, but an interpretable scoring layer that can
absorb real-world performance metrics without re-training the whole system.
"""


@dataclass
class Product:
    id: int
    name: str
    keywords: Set[str]
    emotion: Optional[str]
    hooks: List[str]

    @classmethod
    def from_dict(cls, data: dict) -> "Product":
        story = data.get("story", {})
        tags = data.get("tags", [])
        keywords: Set[str] = set(k.lower() for k in tags)
        if story:
            keywords.update(tokenize_many(story.get("angles", [])))
            keywords.update(tokenize_many(story.get("hooks", [])))
        keywords.update(tokenize(data.get("name", "")))
        keywords.update(tokenize(data.get("description", "")))
        for color in data.get("colors", []):
            keywords.update(tokenize(color.get("name", "")))
        return cls(
            id=data["id"],
            name=data["name"],
            keywords={kw for kw in keywords if kw},
            emotion=story.get("emotion") if story else None,
            hooks=story.get("hooks", []) if story else [],
        )


TOKEN_RE = re.compile(r"[\wäöüÄÖÜß+#-]+", re.UNICODE)


def tokenize(text: str) -> Set[str]:
    return {match.group(0).lower() for match in TOKEN_RE.finditer(text)}


def tokenize_many(seq) -> Set[str]:
    tokens: Set[str] = set()
    for item in seq:
        tokens.update(tokenize(item))
    return tokens


def load_products() -> List[Product]:
    with PRODUCTS_JSON.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return [Product.from_dict(prod) for prod in data]


def fetch_recent_trends(limit: int = 25):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM trends ORDER BY captured_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return rows


def score_product(trend_keyword: str, product: Product, performance: PerformanceMemory) -> float:
    tokens = tokenize(trend_keyword)
    if not tokens:
        return 0.0
    overlap = tokens & product.keywords
    base = float(len(overlap))
    if base == 0.0:
        return 0.0
    boost = performance.get_boost(product.id, trend_keyword)
    return base * (1.0 + boost)


def match_trend_to_product(trend_keyword: str, products: List[Product], performance: PerformanceMemory) -> Optional[Product]:
    scored = [
        (score_product(trend_keyword, product, performance), product)
        for product in products
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    top_score, top_product = scored[0]
    return top_product if top_score > 0 else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Product matcher with feedback loop")
    parser.add_argument("--feedback-trend", help="trend keyword to record feedback for")
    parser.add_argument("--feedback-product", type=int, help="product id used for the trend")
    parser.add_argument(
        "--feedback-success",
        action="store_true",
        help="mark the recorded feedback as success (default: failure)",
    )
    parser.add_argument(
        "--limit", type=int, default=10, help="number of trends to display when ranking"
    )
    args = parser.parse_args()

    performance = PerformanceMemory.load()

    if args.feedback_trend and args.feedback_product is not None:
        performance.record(
            product_id=args.feedback_product,
            trend_keyword=args.feedback_trend,
            success=args.feedback_success,
        )
        performance.save()
        outcome = "success" if args.feedback_success else "failure"
        print(
            f"Recorded {outcome} for trend '{args.feedback_trend}' and product #{args.feedback_product}."
        )
        return

    products = load_products()
    trends = fetch_recent_trends(limit=args.limit)
    for row in trends:
        product = match_trend_to_product(row["keyword"], products, performance)
        if product:
            boost = performance.get_boost(product.id, row["keyword"])
            print(
                f"{row['keyword']} -> {product.name} (score {boost:+.2f} boost, product #{product.id})"
            )
        else:
            print(f"{row['keyword']} -> no match (expand story metadata)")


if __name__ == "__main__":
    main()
