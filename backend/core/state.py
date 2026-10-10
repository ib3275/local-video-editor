"""Model lifecycle. Keeps whisper cached across requests."""

from typing import Optional
from faster_whisper import WhisperModel

from .config import WHISPER_MODEL

_whisper_cache: Optional[WhisperModel] = None


def get_whisper() -> WhisperModel:
    global _whisper_cache
    if _whisper_cache is not None:
        return _whisper_cache
    try:
        _whisper_cache = WhisperModel(WHISPER_MODEL, device="auto", compute_type="auto")
    except Exception as e:
        print(f"[whisper] GPU load failed ({e}); falling back to CPU.")
        _whisper_cache = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _whisper_cache
