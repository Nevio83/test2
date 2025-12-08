"""Utility to load the local .env file for pipeline scripts."""
from __future__ import annotations

from pathlib import Path

try:  # optional dependency
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - python-dotenv optional
    load_dotenv = None  # type: ignore

MARKETING_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = MARKETING_DIR.parent

def _load_env(path: Path) -> bool:
    if load_dotenv is None:
        return False
    if not path.exists():
        return False
    load_dotenv(path, override=False)
    return True


mark_env = MARKETING_DIR / ".env"
root_env = REPO_ROOT / ".env"

loaded_marketing = _load_env(mark_env)
loaded_root = _load_env(root_env)

if not (loaded_marketing or loaded_root):  # pragma: no cover - diagnostics
    if load_dotenv is None:
        print(
            "[env] python-dotenv not installed. Run `py -m pip install python-dotenv` to load .env automatically."
        )
    else:
        print(f"[env] No .env files found at {mark_env} or {root_env}. Using system environment only.")
