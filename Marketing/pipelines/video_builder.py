"""Video builder stub.

Responsible for stitching together media assets (Runway/Pika renders,
product images, text overlays and audio) into a publishable MP4.
Currently this only outlines the API touchpoints and expected inputs.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parents[1]
RENDERS_DIR = BASE_DIR / "data" / "renders"
RENDERS_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR = BASE_DIR / "data" / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
BRIEFS_PATH = BASE_DIR / "data" / "creative_briefs.jsonl"


@dataclass
class SceneSpec:
    prompt: str
    duration: float
    overlay_text: str


@dataclass
class ApiConfig:
    runway_token: str | None
    runway_model_id: str | None
    pika_token: str | None
    pika_workflow_id: str | None
    elevenlabs_key: str | None
    elevenlabs_voice: str | None


def load_api_config() -> ApiConfig:
    return ApiConfig(
        runway_token=os.environ.get("RUNWAY_API_KEY"),
        runway_model_id=os.environ.get("RUNWAY_MODEL_ID"),
        pika_token=os.environ.get("PIKA_API_KEY"),
        pika_workflow_id=os.environ.get("PIKA_WORKFLOW_ID"),
        elevenlabs_key=os.environ.get("ELEVENLABS_API_KEY"),
        elevenlabs_voice=os.environ.get("ELEVENLABS_VOICE_ID"),
    )


def request_ai_render(scene: SceneSpec, config: ApiConfig) -> Path:
    """Route render generation to Runway or Pika if configured, else fallback."""
    if config.runway_token and config.runway_model_id:
        return _request_runway_render(scene, config)
    if config.pika_token and config.pika_workflow_id:
        return _request_pika_render(scene, config)
    return _create_placeholder_render(scene)


def _request_runway_render(scene: SceneSpec, config: ApiConfig) -> Path:
    """Placeholder for Runway API call (documented curl equivalent)."""
    # In production you'd POST to https://api.runwayml.com/v1/gen with headers:
    #   Authorization: Bearer <RUNWAY_API_KEY>
    # and body containing modelId + prompt. Store resulting video.
    filename = f"runway_{scene.prompt[:20].replace(' ', '_')}.mp4"
    path = RENDERS_DIR / filename
    path.touch()
    return path


def _request_pika_render(scene: SceneSpec, config: ApiConfig) -> Path:
    """Placeholder for Pika Labs workflow invocation."""
    filename = f"pika_{scene.prompt[:20].replace(' ', '_')}.mp4"
    path = RENDERS_DIR / filename
    path.touch()
    return path


def _create_placeholder_render(scene: SceneSpec) -> Path:
    filename = f"placeholder_{scene.prompt[:20].replace(' ', '_')}.mp4"
    path = RENDERS_DIR / filename
    path.touch()
    return path


def assemble_video(scenes: List[SceneSpec], audio_track: Path, output_path: Path) -> None:
    # TODO: use ffmpeg or CapCut Automate to merge video/audio/overlays.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.touch()


def synthesize_voiceover(brief: dict, config: ApiConfig) -> Path:
    audio_dir = BASE_DIR / "data" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / f"product_{brief['product_id']}.mp3"
    if config.elevenlabs_key and config.elevenlabs_voice:
        # Real implementation would POST to https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
        # with headers including xi-api-key and stream the MP3 response.
        audio_path.touch()
    else:
        # Placeholder text file describing the voiceover.
        audio_path.write_text(brief.get("voiceover", ""), encoding="utf-8")
    return audio_path


def load_briefs(limit: int = 5) -> List[dict]:
    if not BRIEFS_PATH.exists():
        return []
    briefs: List[dict] = []
    with BRIEFS_PATH.open("r", encoding="utf-8") as fh:
        for line in fh.readlines()[-limit:]:
            briefs.append(json.loads(line))
    return briefs


def build_scenes_from_brief(brief: dict) -> List[SceneSpec]:
    overlays = brief.get("overlays", []) or [brief.get("hook", "")]
    scenes: List[SceneSpec] = []
    for idx, overlay in enumerate(overlays, start=1):
        prompt = f"{brief['trend_keyword']} scene {idx}"
        scenes.append(SceneSpec(prompt, 5.0, overlay))
    return scenes or [SceneSpec(brief["trend_keyword"], 5.0, brief.get("hook", ""))]


def main():
    briefs = load_briefs()
    if not briefs:
        print("No creative briefs found. Run creative_generator first.")
        return
    config = load_api_config()
    for brief in briefs:
        scenes = build_scenes_from_brief(brief)
        for scene in scenes:
            request_ai_render(scene, config)
        audio = synthesize_voiceover(brief, config)
        output = VIDEOS_DIR / f"product_{brief['product_id']}.mp4"
        assemble_video(scenes, audio, output)
        print(f"Created placeholder video for product {brief['product_id']} at {output}")


if __name__ == "__main__":
    main()
