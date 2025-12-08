"""Creative generation stub.

Consumes matched trend+product pairs and produces structured briefs
containing hook, narrative beats, VO text and overlay ideas.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Dict, List

import env_loader  # noqa: F401

from product_matcher import (
    PerformanceMemory,
    fetch_recent_trends,
    load_products as load_matcher_products,
    match_trend_to_product,
)

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BRIEFS_PATH = OUTPUT_DIR / "creative_briefs.jsonl"
PRODUCTS_JSON = BASE_DIR / "products.json"


@dataclass
class CreativeBrief:
    trend_keyword: str
    product_id: int
    hook: str
    storyline: List[str]
    voiceover: str
    overlays: List[str]
    hashtags: List[str]

    def to_json(self) -> Dict:
        return {
            "trend_keyword": self.trend_keyword,
            "product_id": self.product_id,
            "hook": self.hook,
            "storyline": self.storyline,
            "voiceover": self.voiceover,
            "overlays": self.overlays,
            "hashtags": self.hashtags,
        }


def build_brief(trend_keyword: str, product: dict) -> CreativeBrief:
    story = product.get("story", {})
    hook = story.get("hooks", [f"POV: {trend_keyword}"])[0]
    storyline = [
        "Problem: " + story.get("problem", ""),
        "Solution: " + product.get("name", "Produkt"),
        "Payoff: " + story.get("benefit", ""),
    ]
    voiceover = f"{hook} {story.get('benefit', '')}"
    overlays = story.get("angles", [])[:3]
    hashtags = story.get("hashtags", []) or product.get("tags", [])
    hashtags = [tag if tag.startswith("#") else f"#{tag}" for tag in hashtags[:5]]
    return CreativeBrief(trend_keyword, product["id"], hook, storyline, voiceover, overlays, hashtags)


def save_briefs(briefs: List[CreativeBrief]) -> None:
    with BRIEFS_PATH.open("w", encoding="utf-8") as fh:
        for brief in briefs:
            fh.write(json.dumps(brief.to_json(), ensure_ascii=False) + "\n")


def load_products_by_id() -> Dict[int, dict]:
    with PRODUCTS_JSON.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return {item["id"]: item for item in data}


def main() -> None:
    products_index = load_products_by_id()
    matcher_products = load_matcher_products()
    performance = PerformanceMemory.load()
    trends = fetch_recent_trends()
    briefs: List[CreativeBrief] = []
    for row in trends:
        matched = match_trend_to_product(row["keyword"], matcher_products, performance)
        if not matched:
            continue
        product_data = products_index.get(matched.id)
        if not product_data:
            continue
        briefs.append(build_brief(row["keyword"], product_data))
    if not briefs:
        print("No briefs generated (no matching products).")
        return
    save_briefs(briefs)
    print(f"Generated {len(briefs)} briefs -> {BRIEFS_PATH.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    main()
