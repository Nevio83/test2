"""Product matching logic linking trend rows to enriched products.

This module consumes rows from the trends database and selects the best
matching product based on keyword overlap, audience fit, and optional LLM
scoring. For now we keep things deterministic to validate the data model.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Set

import sqlite3

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "trends.db"
PRODUCTS_JSON = BASE_DIR / "products.json"


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


def score_product(trend_keyword: str, product: Product) -> float:
    tokens = tokenize(trend_keyword)
    if not tokens:
        return 0.0
    overlap = tokens & product.keywords
    return float(len(overlap))


def match_trend_to_product(trend_keyword: str, products: List[Product]) -> Optional[Product]:
    scored = [
        (score_product(trend_keyword, product), product)
        for product in products
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    top_score, top_product = scored[0]
    return top_product if top_score > 0 else None


def main() -> None:
    products = load_products()
    trends = fetch_recent_trends()
    for row in trends:
        product = match_trend_to_product(row["keyword"], products)
        if product:
            print(f"{row['keyword']} -> {product.name} (score placeholder)")
        else:
            print(f"{row['keyword']} -> no match (expand story metadata)")


if __name__ == "__main__":
    main()
