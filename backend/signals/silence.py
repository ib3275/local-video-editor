"""FFmpeg silencedetect -> loud-segment ranges."""

import re
import subprocess

from core.config import SILENCE_NOISE_DB, SILENCE_MIN_DURATION
from core.ffmpeg import probe_duration


def detect_silence_ranges(video_path: str) -> list:
    cmd = ["ffmpeg", "-i", video_path,
           "-af", f"silencedetect=noise={SILENCE_NOISE_DB}dB:d={SILENCE_MIN_DURATION}",
           "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    output = result.stderr
    silences = []
    current_start = None
    for line in output.splitlines():
        m_start = re.search(r"silence_start:\s*([\d.]+)", line)
        m_end = re.search(r"silence_end:\s*([\d.]+)", line)
        if m_start:
            current_start = float(m_start.group(1))
        if m_end and current_start is not None:
            silences.append({"start": current_start, "end": float(m_end.group(1))})
            current_start = None
    return silences


def detect_loud_segments(video_path: str) -> list:
    silences = detect_silence_ranges(video_path)
    total = probe_duration(video_path)
    loud = []
    prev_end = 0.0
    for s in silences:
        if s["start"] - prev_end > 0.1:
            loud.append({"start": round(prev_end, 3), "end": round(s["start"], 3), "type": "loud"})
        prev_end = s["end"]
    if total - prev_end > 0.1:
        loud.append({"start": round(prev_end, 3), "end": round(total, 3), "type": "loud"})
    return loud
