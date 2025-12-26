"""Video builder stub.

Responsible for stitching together media assets (Runway/Pika renders,
product images, text overlays and audio) into a publishable MP4.
Currently this only outlines the API touchpoints and expected inputs.
"""
from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
import random
from pathlib import Path
from typing import Iterable, List, Sequence
import textwrap
import time

import numpy as np
import requests

try:
    from env_loader import load_env
except ImportError:  # pragma: no cover - optional dependency
    load_env = None

if load_env:
    load_env()

try:
    import imageio.v2 as imageio
except ImportError:  # pragma: no cover - optional dependency
    imageio = None

try:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
except ImportError:  # pragma: no cover - optional dependency
    Image = ImageDraw = ImageFont = ImageEnhance = ImageFilter = None

try:  # optional local renderer deps
    import torch
    from diffusers import DiffusionPipeline
except ImportError:  # pragma: no cover - optional dependency
    torch = None
    DiffusionPipeline = None

RUNWAY_API_BASE = "https://api.runwayml.com/v1"
DEFAULT_LOCAL_MODEL = "stabilityai/sdxl-turbo"
BASE_DIR = Path(__file__).resolve().parents[1]
RENDERS_DIR = BASE_DIR / "data" / "renders"
RENDERS_DIR.mkdir(parents=True, exist_ok=True)
BACKGROUND_CACHE = RENDERS_DIR / "backgrounds"
BACKGROUND_CACHE.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR = BASE_DIR / "data" / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
BRIEFS_PATH = BASE_DIR / "data" / "creative_briefs.jsonl"
FRAME_SIZE = (720, 1280)  # width, height
FPS = 24
BACKGROUND_COLORS = [
    (32, 60, 245),
    (19, 151, 213),
    (245, 90, 66),
    (120, 75, 255),
    (35, 175, 120),
    (255, 153, 0),
]
_LOCAL_PIPELINES: dict[str, "DiffusionPipeline"] = {}


@dataclass
class SceneSpec:
    prompt: str
    duration: float
    overlay_text: str
    subtext: str | None = None
    hashtags: List[str] | None = None
    accent_color: tuple[int, int, int] | None = None


@dataclass
class ApiConfig:
    runway_token: str | None
    runway_model_id: str | None
    pika_token: str | None
    pika_workflow_id: str | None
    elevenlabs_key: str | None
    elevenlabs_voice: str | None
    render_backend: str
    local_model_id: str | None
    local_device: str | None
    local_guidance: float
    local_steps: int
    local_frame_count: int


def load_api_config() -> ApiConfig:
    return ApiConfig(
        runway_token=os.environ.get("RUNWAY_API_KEY"),
        runway_model_id=os.environ.get("RUNWAY_MODEL_ID"),
        pika_token=os.environ.get("PIKA_API_KEY"),
        pika_workflow_id=os.environ.get("PIKA_WORKFLOW_ID"),
        elevenlabs_key=os.environ.get("ELEVENLABS_API_KEY"),
        elevenlabs_voice=os.environ.get("ELEVENLABS_VOICE_ID"),
        render_backend=os.environ.get("VIDEO_RENDER_BACKEND", "auto").lower(),
        local_model_id=os.environ.get("LOCAL_VIDEO_MODEL_ID", DEFAULT_LOCAL_MODEL),
        local_device=os.environ.get("LOCAL_VIDEO_DEVICE"),
        local_guidance=float(os.environ.get("LOCAL_VIDEO_GUIDANCE", "7.5")),
        local_steps=int(os.environ.get("LOCAL_VIDEO_STEPS", "30")),
        local_frame_count=int(os.environ.get("LOCAL_VIDEO_FRAMES", f"{FPS * 4}")),
    )


def request_ai_render(scene: SceneSpec, config: ApiConfig) -> Path:
    """Route render generation to Runway or Pika if configured, else fallback."""
    backend = config.render_backend
    prefers_local = backend == "local" or (
        backend == "auto" and (config.local_model_id or DiffusionPipeline is not None)
    )
    if prefers_local:
        try:
            return _request_local_diffusers_render(scene, config)
        except Exception as exc:
            if backend == "local":
                raise
            print(f"[warn] Local renderer failed, falling back to remote: {exc}")

    if config.runway_token and config.runway_model_id and backend in {"auto", "runway"}:
        return _request_runway_render(scene, config)
    if config.pika_token and config.pika_workflow_id:
        return _request_pika_render(scene, config)
    return _create_placeholder_render(scene)


def _request_runway_render(scene: SceneSpec, config: ApiConfig) -> Path:
    if not config.runway_token or not config.runway_model_id:
        raise RuntimeError("Runway credentials missing.")
    headers = {
        "Authorization": f"Bearer {config.runway_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config.runway_model_id,
        "mode": "text",
        "prompt": _build_runway_prompt(scene),
        "duration": max(4, int(scene.duration)),
        "aspectRatio": "9:16",
        "seed": random.randint(0, 10_000),
    }
    response = requests.post(f"{RUNWAY_API_BASE}/gen", headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    job = response.json()
    job_id = job.get("id")
    if not job_id:
        raise RuntimeError(f"Runway response missing id: {job}")
    status = job.get("status")
    while status in {"queued", "processing", "starting"}:
        time.sleep(5)
        poll = requests.get(f"{RUNWAY_API_BASE}/gen/{job_id}", headers=headers, timeout=30)
        poll.raise_for_status()
        job = poll.json()
        status = job.get("status")
    if status != "succeeded":
        raise RuntimeError(f"Runway generation failed: {job}")
    outputs = job.get("outputs") or []
    video_info = next((item for item in outputs if item.get("mimeType", "").startswith("video")), None)
    if not video_info:
        raise RuntimeError(f"Runway returned no video outputs: {job}")
    video_url = video_info.get("assetUrl") or video_info.get("url")
    if not video_url:
        raise RuntimeError(f"Runway output missing asset url: {video_info}")
    filename = f"runway_{_slugify(scene.prompt)}.mp4"
    target = RENDERS_DIR / filename
    _download_file(video_url, target, headers=headers)
    return target


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


def _request_local_diffusers_render(scene: SceneSpec, config: ApiConfig) -> Path:
    if DiffusionPipeline is None or torch is None:
        raise RuntimeError(
            "Local renderer requires `pip install torch diffusers transformers accelerate`."
        )
    if imageio is None or Image is None:
        raise RuntimeError("Local renderer requires Pillow + imageio.")

    device = config.local_device or ("cuda" if torch.cuda.is_available() else "cpu")
    model_id = config.local_model_id or DEFAULT_LOCAL_MODEL
    pipeline = _prepare_local_pipeline(model_id, device)

    prompt = _build_local_prompt(scene)
    result = pipeline(
        prompt,
        guidance_scale=config.local_guidance,
        num_inference_steps=config.local_steps,
    )
    image = result.images[0].convert("RGB")

    target = RENDERS_DIR / f"local_{_slugify(scene.prompt)}.mp4"
    total_frames = max(12, config.local_frame_count)

    with imageio.get_writer(target, fps=FPS, codec="libx264", quality=8) as writer:
        for frame in _pan_zoom_frames(image, total_frames):
            writer.append_data(frame)
    return target


def assemble_video(
    scenes: List[SceneSpec],
    audio_track: Path,
    output_path: Path,
    render_paths: Sequence[Path] | None = None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    valid_ai = [
        path for path in (render_paths or []) if path and path.exists() and path.stat().st_size > 0
    ]
    if valid_ai:
        _concat_video_clips(valid_ai, output_path)
        return
    if imageio is None or Image is None:
        print(
            "[warn] Pillow and imageio are required to render videos. "
            "Install via `py -m pip install pillow imageio imageio-ffmpeg`."
        )
        output_path.write_bytes(b"")  # keep placeholder to unblock pipeline
        return

    font = ImageFont.load_default()

    with imageio.get_writer(output_path, fps=FPS, codec="libx264", quality=8) as writer:
        for idx, scene in enumerate(scenes, start=1):
            bg_color = scene.accent_color or BACKGROUND_COLORS[(idx - 1) % len(BACKGROUND_COLORS)]
            bg_path = _fetch_background_image(scene.prompt)
            frame = _render_scene_frame(scene, font, bg_color, idx, len(scenes), bg_path)
            frame_array = np.array(frame)
            frame_count = max(1, int(scene.duration * FPS))
            for _ in range(frame_count):
                writer.append_data(frame_array)


def _render_scene_frame(
    scene: SceneSpec,
    font: "ImageFont.ImageFont",
    bg_color: tuple[int, int, int],
    idx: int,
    total: int,
    bg_path: Path | None = None,
) -> "Image.Image":
    img = _build_background_layer(bg_color, scene.prompt, override_path=bg_path)
    draw = ImageDraw.Draw(img)
    margin = 40

    header = scene.prompt
    draw.text((margin, margin), header, fill="white", font=font)

    wrapped = textwrap.wrap(scene.overlay_text, width=28)
    y = margin + 40
    for line in wrapped[:12]:
        draw.text((margin, y), line, fill="white", font=font)
        y += 24

    if scene.subtext:
        sub_wrap = textwrap.wrap(scene.subtext, width=32)
        y += 10
        for line in sub_wrap[:6]:
            draw.text((margin, y), line, fill="#f6f7fb", font=font)
            y += 22

    if scene.hashtags:
        hash_text = " ".join(scene.hashtags)
        draw.text((margin, FRAME_SIZE[1] - margin - 40), hash_text, fill="#d3d7ff", font=font)

    progress = f"{idx}/{total}"
    draw.text((FRAME_SIZE[0] - margin - 40, FRAME_SIZE[1] - margin - 20), progress, fill="white", font=font)
    return img


def _prepare_local_pipeline(model_id: str, device: str) -> "DiffusionPipeline":
    cache_key = f"{model_id}:{device}"
    pipeline = _LOCAL_PIPELINES.get(cache_key)
    if pipeline:
        return pipeline
    dtype = torch.float16 if device.startswith("cuda") else torch.float32
    pipeline = DiffusionPipeline.from_pretrained(model_id, torch_dtype=dtype)
    pipeline = pipeline.to(device)
    if device.startswith("cuda") and hasattr(pipeline, "enable_xformers_memory_efficient_attention"):
        try:
            pipeline.enable_xformers_memory_efficient_attention()  # type: ignore[attr-defined]
        except Exception:
            pass
    if hasattr(pipeline, "set_progress_bar_config"):
        pipeline.set_progress_bar_config(disable=True)
    if hasattr(pipeline, "eval"):
        pipeline.eval()
    _LOCAL_PIPELINES[cache_key] = pipeline
    return pipeline


def _concat_video_clips(clips: Sequence[Path], output_path: Path) -> None:
    if len(clips) == 1:
        shutil.copyfile(clips[0], output_path)
        return
    if imageio is None:
        shutil.copyfile(clips[0], output_path)
        return
    with imageio.get_writer(output_path, fps=FPS, codec="libx264", quality=8) as writer:
        for clip in clips:
            try:
                reader = imageio.get_reader(clip)
            except Exception:
                continue
            for frame in reader:
                writer.append_data(frame)
            reader.close()


def _build_background_layer(
    fallback_color: tuple[int, int, int],
    prompt: str,
    override_path: Path | None = None,
) -> "Image.Image":
    if override_path:
        bg_path = override_path
    elif BACKGROUND_CACHE.exists():
        bg_path = _fetch_background_image(prompt)
    else:
        bg_path = None
    if bg_path and Image:
        try:
            img = Image.open(bg_path).convert("RGB")
            img = img.resize(FRAME_SIZE)
            img = ImageEnhance.Brightness(img).enhance(0.6)
            img = ImageFilter.GaussianBlur(radius=2).filter(img)  # type: ignore[attr-defined]
        except Exception:
            img = Image.new("RGB", FRAME_SIZE, fallback_color)
    else:
        img = Image.new("RGB", FRAME_SIZE, fallback_color)

    overlay = Image.new("RGBA", FRAME_SIZE, (*fallback_color, 90))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    return img


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
    storyline = brief.get("storyline", [])
    hashtags = brief.get("hashtags", [])[:4]
    scenes: List[SceneSpec] = []
    for idx, overlay in enumerate(overlays):
        prompt = _trim_text(f"{brief['trend_keyword']} hero product shot {idx+1}", 12)
        subtext = storyline[idx] if idx < len(storyline) else brief.get("voiceover", "")
        scenes.append(
            SceneSpec(
                prompt=_trim_text(prompt, 12),
                duration=4.0,
                overlay_text=_trim_text(overlay or "", 12),
                subtext=_trim_text(subtext or "", 18),
                hashtags=hashtags,
                accent_color=random.choice(BACKGROUND_COLORS),
            )
        )
    return scenes or [
        SceneSpec(
            _trim_text(f"{brief['trend_keyword']} hero shot", 10),
            5.0,
            _trim_text(brief.get("hook", ""), 12),
            subtext=_trim_text(brief.get("voiceover", ""), 18),
            hashtags=hashtags[:3],
        )
    ]


def _slugify(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in value)[:40]


def _fetch_background_image(prompt: str) -> Path | None:
    slug = _slugify(prompt)
    target = BACKGROUND_CACHE / f"{slug}.jpg"
    if target.exists():
        return target
    url = f"https://source.unsplash.com/720x1280/?{requests.utils.quote(prompt)}"
    try:
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            target.write_bytes(response.content)
            return target
    except Exception:
        return None


def _trim_text(text: str, max_words: int) -> str:
    words = text.strip().split()
    if len(words) <= max_words:
        return text.strip()
    return " ".join(words[:max_words])


def _build_local_prompt(scene: SceneSpec) -> str:
    prompt_core = _trim_text(scene.prompt, 12)
    overlay = _trim_text(scene.overlay_text, 10)
    subtext = _trim_text(scene.subtext or "", 12)
    hashtags = " ".join((scene.hashtags or [])[:2])
    return (
        f"{prompt_core}, cinematic product showcase, vertical frame, soft depth of field. "
        f"Overlay: {overlay}. Context: {subtext}. Mood: {hashtags}"
    )


def _pan_zoom_frames(image: "Image.Image", total_frames: int) -> Iterable[np.ndarray]:
    oversized = image.resize((FRAME_SIZE[0] * 2, FRAME_SIZE[1] * 2), Image.LANCZOS)
    span_x = oversized.width - FRAME_SIZE[0]
    span_y = oversized.height - FRAME_SIZE[1]
    for idx in range(total_frames):
        t = idx / max(1, total_frames - 1)
        left = int(span_x * t * 0.6)
        top = int(span_y * (1 - t) * 0.6)
        right = left + FRAME_SIZE[0]
        bottom = top + FRAME_SIZE[1]
        crop = oversized.crop((left, top, right, bottom))
        yield np.array(crop)


def _build_runway_prompt(scene: SceneSpec) -> str:
    overlays = scene.overlay_text.replace("\n", " ")
    extra = scene.subtext or ""
    hashtags = " ".join(scene.hashtags or [])
    return (
        f"{scene.prompt}. 4K cinematic vertical product showcase, clean lighting, "
        f"hero shot of the product in use. Overlay text: {overlays}. "
        f"Additional context: {extra}. Include vibes of {hashtags}."
    )


def _download_file(url: str, target: Path, headers: dict[str, str] | None = None) -> None:
    with requests.get(url, headers=headers, timeout=60, stream=True) as response:
        response.raise_for_status()
        with target.open("wb") as fh:
            for chunk in response.iter_content(chunk_size=1024 * 512):
                if chunk:
                    fh.write(chunk)
    return None


def main():
    briefs = load_briefs()
    if not briefs:
        print("No creative briefs found. Run creative_generator first.")
        return
    config = load_api_config()
    for brief in briefs:
        scenes = build_scenes_from_brief(brief)
        render_paths: List[Path] = []
        for scene in scenes:
            try:
                render_paths.append(request_ai_render(scene, config))
            except Exception as exc:
                print(f"[warn] Runway render failed for scene '{scene.prompt}': {exc}")
        audio = synthesize_voiceover(brief, config)
        output = VIDEOS_DIR / f"product_{brief['product_id']}.mp4"
        assemble_video(scenes, audio, output, render_paths=render_paths)
        print(f"Created placeholder video for product {brief['product_id']} at {output}")


if __name__ == "__main__":
    main()
