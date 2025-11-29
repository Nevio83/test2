"""Convenience script to run the full marketing pipeline in sequence."""
from __future__ import annotations

import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]


def run(step: str, *cmd: str) -> None:
    print(f"\n=== {step} ===")
    subprocess.run(cmd, cwd=BASE_DIR, check=True)


def main() -> None:
    run("Fetch trends", "py", "pipelines/fetch_trends.py")
    run("Match & brief", "py", "pipelines/creative_generator.py")
    run("Render videos", "py", "pipelines/video_builder.py")
    run("Upload", "py", "pipelines/tiktok_uploader.py")


if __name__ == "__main__":
    main()
