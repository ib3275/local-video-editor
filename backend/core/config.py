"""Global configuration. Mutating RUNTIME affects all modules."""

import os
from pathlib import Path

VERSION = "2.0.0"

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEEPSEEK_MODEL = "deepseek-r1:8b"

WHISPER_MODEL = "base"

SILENCE_NOISE_DB = -35
SILENCE_MIN_DURATION = 0.6

DEFAULT_VIDEO_DIR = Path.home() / "LocalVideoEditor" / "videos"
DEFAULT_VIDEO_DIR.mkdir(parents=True, exist_ok=True)

RUNTIME = {
    "video_dir": str(DEFAULT_VIDEO_DIR),
    "ollama_models_dir": None,
}
