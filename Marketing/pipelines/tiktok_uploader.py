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

import env_loader  # noqa: F401

try:  # optional dependency for real API calls
    import requests
except ImportError:  # pragma: no cover - requests is optional
    requests = None

try:  # optional dependency for browser automation fallback
    from selenium import webdriver
    from selenium.common.exceptions import TimeoutException
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait
except ImportError:  # pragma: no cover - selenium is optional
    webdriver = None  # type: ignore

BASE_DIR = Path(__file__).resolve().parents[1]
VIDEOS_DIR = BASE_DIR / "data" / "videos"
BRIEFS_PATH = BASE_DIR / "data" / "creative_briefs.jsonl"


@dataclass
class UploaderConfig:
    api_base: str | None
    access_token: str | None
    schedule_cron: str | None
    session_id: Optional[str]
    chrome_driver_path: Optional[str]
    chrome_profile_path: Optional[str]


def load_uploader_config() -> UploaderConfig:
    return UploaderConfig(
        api_base=os.environ.get("TIKTOK_UPLOAD_API"),
        access_token=os.environ.get("TIKTOK_UPLOAD_TOKEN"),
        schedule_cron=os.environ.get("TIKTOK_UPLOAD_CRON"),
        session_id=os.environ.get("TIKTOK_SESSION_ID"),
        chrome_driver_path=os.environ.get("TIKTOK_CHROMEDRIVER"),
        chrome_profile_path=os.environ.get("TIKTOK_CHROME_PROFILE"),
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
        if config.chrome_driver_path:
            upload_via_browser(video_path, caption, config)
            return
        print(f"[stub] Uploading {video_path.name} with caption: {caption[:60]}...")
        print("  -> set TIKTOK_UPLOAD_API/TOKEN or configure TIKTOK_CHROMEDRIVER for browser uploads.")
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


def upload_via_browser(video_path: Path, caption: str, config: UploaderConfig) -> None:
    if webdriver is None:
        print(
            "[warn] selenium not installed. Run `py -m pip install selenium` and provide"
            " TIKTOK_CHROMEDRIVER + TIKTOK_CHROME_PROFILE for browser uploads."
        )
        return
    if not config.chrome_driver_path:
        print("[warn] Set TIKTOK_CHROMEDRIVER to the path of your chromedriver executable.")
        return

    options = webdriver.ChromeOptions()
    if config.chrome_profile_path:
        options.add_argument(f"--user-data-dir={config.chrome_profile_path}")
    options.add_argument("--disable-notifications")
    options.add_argument("--start-maximized")
    options.add_argument("--remote-allow-origins=*")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    # Fenster geöffnet lassen, falls das Script abstürzt.
    options.add_experimental_option("detach", True)

    print("[browser] Launching Chrome for manual TikTok upload ...")
    service = Service(executable_path=config.chrome_driver_path)
    driver = webdriver.Chrome(service=service, options=options)

    upload_url = "https://www.tiktok.com/tiktokstudio/upload?lang=en"
    driver.get(upload_url)
    wait = WebDriverWait(driver, 60)
    try:
        wait.until(EC.url_contains("tiktok.com"))
    except Exception:
        # Falls das Profil eine Custom-Startseite hat, erzwingen wir das Upload-Tab.
        driver.execute_script(f"window.open('{upload_url}', '_self');")
        wait.until(EC.url_contains("tiktok.com"))

    if "login" in driver.current_url.lower():
        print("[browser] TikTok verlangt Login. Bitte melde dich im geöffneten Fenster an.")
        try:
            WebDriverWait(driver, 180).until(lambda d: "studio" in d.current_url or "upload" in d.current_url)
        except TimeoutException:
            print("[error] Login nicht abgeschlossen – Upload abgebrochen.")
            return

    try:
        upload_selectors = [
            "input[data-e2e='upload-media-input']",
            "input[type='file']",
            "input[accept*='video']",
        ]
        upload_input = None
        for selector in upload_selectors:
            try:
                upload_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                break
            except TimeoutException:
                continue
        if upload_input is None:
            raise TimeoutException("Kein Upload-Eingabefeld gefunden.")
        upload_input.send_keys(str(video_path.resolve()))
        caption_selectors = [
            "textarea[data-e2e='caption']",
            "textarea[placeholder*='Caption']",
            "div[contenteditable='true'][data-e2e='caption']",
            "div[contenteditable='true'][role='textbox']",
        ]
        caption_area = None
        for selector in caption_selectors:
            try:
                caption_area = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                break
            except TimeoutException:
                continue
        if caption_area is None:
            raise TimeoutException("Kein Caption-Feld gefunden.")
        caption_area.click()
        caption_area.clear() if hasattr(caption_area, "clear") else None
        caption_area.send_keys(caption)
        print(
            "[browser] Video + Caption eingefügt. Bitte überprüfe das TikTok-Fenster und klicke"
            " auf 'Posten', sobald alles geladen ist. Der Browser bleibt offen, damit du"
            " finale Einstellungen vornehmen kannst."
        )
    except Exception as exc:  # pragma: no cover - browser interaction
        print(f"[error] Selenium upload flow failed: {exc}")
    finally:
        # Nutzer soll Fenster schließen, sobald Upload fertig ist.
        pass


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
