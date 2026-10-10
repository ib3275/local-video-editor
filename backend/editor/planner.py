"""DeepSeek-R1 editorial decisions."""

import json
import re
import ollama

from core.config import OLLAMA_HOST, DEEPSEEK_MODEL

SYSTEM_PROMPT = """You are a precise video-editing assistant.
You receive a TIMELINE containing up to three kinds of signals:
- "loud_segments": audio ranges above silence threshold (from FFmpeg silencedetect)
- "scenes": shot changes (from PySceneDetect)
- "transcript": speech segments with text (from Whisper)

You also receive a USER INSTRUCTION.

Your job: return a JSON object {"keep": [{"start": s, "end": s}, ...]} listing
the time ranges to KEEP in the final video. Everything outside these ranges is
cut.

Rules:
- If there is NO transcript, work from loud_segments and scenes alone.
- Never invent timestamps not present in any signal.
- Merge adjacent kept segments if the gap is < 0.3 seconds.
- Never return a segment shorter than 0.5 seconds unless the instruction demands it.
- Return ONLY the JSON object. No explanation.
"""


def build_timeline(loud: list, scenes: list, transcript: list) -> dict:
    has_speech = len(transcript) > 0
    return {
        "summary": {"has_speech": has_speech,
                    "loud_segment_count": len(loud),
                    "scene_count": len(scenes)},
        "loud_segments": loud,
        "scenes": scenes,
        "transcript": transcript if has_speech else [],
    }


def ask_deepseek(timeline: dict, user_prompt: str) -> str:
    client = ollama.Client(host=OLLAMA_HOST)
    response = client.chat(
        model=DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(
                {"timeline": timeline, "instruction": user_prompt},
                ensure_ascii=False)},
        ],
        options={"temperature": 0.0},
        stream=False,
    )
    return response["message"]["content"]


def parse_cut_list(raw: str) -> list:
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
        segments = data.get("keep", [])
        return [{"start": float(s["start"]), "end": float(s["end"])}
                for s in segments
                if "start" in s and "end" in s and float(s["end"]) > float(s["start"])]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return []
