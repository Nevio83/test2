"""TikTok uploader stub.

Wraps TikTok API interactions (or third-party scheduler) to publish finished
videos along with dynamic captions and hashtags generated from creative briefs.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import json

try:  # optional dependency for real API calls
    import requests
except ImportError:  # pragma: no cover - requests is optional
    requests = None

BASE_DIR = Path(__file__).resolve().parents[1]
VIDEOS_DIR = BASE_DIR / "data" / "videos"
BRIEFS_PATH = BASE_DIR / "data" / "creative_briefs.jsonl"


@dataclass
class UploaderConfig:
    api_base: str | None
    access_token: str | None
    schedule_cron: str | None
    session_id: Optional[str]


def load_uploader_config() -> UploaderConfig:
    return UploaderConfig(
        api_base=os.environ.get("TIKTOK_UPLOAD_API"),
        access_token=os.environ.get("TIKTOK_UPLOAD_TOKEN"),
        schedule_cron=os.environ.get("TIKTOK_UPLOAD_CRON"),
        session_id=os.environ.get("TIKTOK_SESSION_ID"),
    )


def load_latest_briefs(limit: int = 5):
    if not BRIEFS_PATH.exists():
        return []
    briefs: List[dict] = []
    with BRIEFS_PATH.open("r", encoding="utf-8") as fh:
        for line in fh.readlines()[-limit:]:
            briefs.append(json.loads(line))
    return briefs


def generate_caption(brief: dict) -> str:
    base = brief.get("hook", "")
    hashtags = brief.get("hashtags", [])
    hashtag_line = " ".join(hashtags)
    return f"{base}\n{hashtag_line}".strip()


def upload_video(video_path: Path, caption: str, config: UploaderConfig) -> None:
    if not config.api_base or not config.access_token:
        print(f"[stub] Uploading {video_path.name} with caption: {caption[:60]}...")
        print("  -> set TIKTOK_UPLOAD_API and TIKTOK_UPLOAD_TOKEN for real uploads.")
        return
    if requests is None:
        print(
            "[warn] requests library missing – install via `pip install requests` to enable"
            " TikTok API uploads."
        )
        return
    url = config.api_base.rstrip("/")
    headers = {
        "Authorization": f"Bearer {config.access_token}",
    }
    if config.session_id:
        headers["X-Tiktok-Session-Id"] = config.session_id
    data = {"caption": caption}
    files = {"video": (video_path.name, video_path.open("rb"), "video/mp4")}
    try:
        response = requests.post(url, headers=headers, data=data, files=files, timeout=90)
        response.raise_for_status()
    except Exception as exc:  # pragma: no cover - network interaction
        print(f"[error] TikTok upload failed for {video_path.name}: {exc}")
        return
    print(f"[api] Uploaded {video_path.name} -> {response.status_code} {response.reason}")


def main() -> None:
    briefs = load_latest_briefs()
    if not briefs:
        print("No creative briefs found. Run creative_generator first.")
        return
    config = load_uploader_config()
    for brief in briefs:
        video_file = VIDEOS_DIR / f"product_{brief['product_id']}.mp4"
        if not video_file.exists():
            print(f"Skip {brief['product_id']}: video missing at {video_file}")
            continue
        caption = generate_caption(brief)
        upload_video(video_file, caption, config)
    if config.schedule_cron:
        print(
            "Scheduler hint: configure your cron/CI to run this script with rule "
            f"'{config.schedule_cron}'."
        )


if __name__ == "__main__":
    main()
