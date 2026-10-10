"""
Local Video Editor — Companion Backend
Single-file FastAPI worker that runs on the user's PC.
"""

import os
import sys
import uuid
import json
import shutil
import asyncio
import tempfile
import subprocess
from pathlib import Path
from typing import Optional, Generator

import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import ollama

# ──────────────────────────────────────────────────────────────
#  CONFIGURATION
# ──────────────────────────────────────────────────────────────

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEEPSEEK_MODEL = "deepseek-r1:8b-qwen-distill-q4_K_M"
WHISPER_MODEL = "base"          # change to "small" or "medium" for better accuracy
DEFAULT_VIDEO_DIR = Path.home() / "LocalVideoEditor" / "videos"
DEFAULT_VIDEO_DIR.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────
#  APP
# ──────────────────────────────────────────────────────────────

app = FastAPI(title="Local Video Editor Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://*.pages.dev",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.pages\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Runtime configuration (mutated by the frontend)
RUNTIME = {
    "video_dir": str(DEFAULT_VIDEO_DIR),
    "ollama_models_dir": None,
}

# ──────────────────────────────────────────────────────────────
#  HEALTH
# ──────────────────────────────────────────────────────────────

@app.get("/status")
async def status():
    return {
        "status": "ok",
        "model": DEEPSEEK_MODEL,
        "video_dir": RUNTIME["video_dir"],
    }

# ──────────────────────────────────────────────────────────────
#  NATIVE FOLDER PICKER  (tkinter in a safe thread)
# ──────────────────────────────────────────────────────────────

def _ask_directory(title: str) -> str:
    """
    Runs tkinter's folder picker in a *fresh process* to avoid
    thread-safety issues entirely. Returns the chosen path.
    """
    script = f"""
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
path = filedialog.askdirectory(title={json.dumps(title)})
root.destroy()
print(path)
"""
    with tempfile.NamedTemporaryFile(
        "w", suffix=".py", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(script)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/utils/browse-folder")
async def browse_folder(request: Request):
    body = await request.json()
    title = body.get("title", "Select a folder")

    loop = asyncio.get_event_loop()
    path = await loop.run_in_executor(None, _ask_directory, title)

    if not path:
        return JSONResponse({"path": "", "cancelled": True})

    return JSONResponse({"path": path, "cancelled": False})


# ──────────────────────────────────────────────────────────────
#  ENVIRONMENT UPDATE  (called silently by the frontend)
# ──────────────────────────────────────────────────────────────

@app.post("/utils/set-paths")
async def set_paths(request: Request):
    body = await request.json()

    if body.get("video_path"):
        p = Path(body["video_path"])
        p.mkdir(parents=True, exist_ok=True)
        RUNTIME["video_dir"] = str(p)

    if body.get("ollama_path"):
        p = Path(body["ollama_path"])
        p.mkdir(parents=True, exist_ok=True)
        RUNTIME["ollama_models_dir"] = str(p)
        os.environ["OLLAMA_MODELS"] = str(p)

    return {"ok": True, "runtime": RUNTIME}


# ──────────────────────────────────────────────────────────────
#  UPLOAD
# ──────────────────────────────────────────────────────────────

@app.post("/projects/upload")
async def upload_video(
    file: UploadFile = File(...),
    video_path: str = Form(""),
):
    dest_dir = Path(video_path) if video_path else Path(RUNTIME["video_dir"])
    dest_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest = dest_dir / safe_name

    with dest.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    return {"filename": safe_name, "path": str(dest)}


# ──────────────────────────────────────────────────────────────
#  FFmpeg HELPERS
# ──────────────────────────────────────────────────────────────

def ffmpeg_available() -> bool:
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            check=True,
            timeout=10,
        )
        return True
    except Exception:
        return False


def extract_audio(video_path: str, audio_path: str) -> None:
    """Pull a 16‑kHz mono WAV track for Whisper."""
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vn", "-acodec", "pcm_s16le",
            "-ar", "16000", "-ac", "1",
            audio_path,
        ],
        capture_output=True,
        check=True,
    )


def cut_and_concat(
    video_path: str,
    segments: list[dict],
    output_path: str,
) -> None:
    """
    segments: [{"start": 0.0, "end": 3.5}, ...]
    Uses FFmpeg's select filter to keep only the requested ranges.
    """
    if not segments:
        shutil.copy(video_path, output_path)
        return

    parts = []
    for seg in segments:
        parts.append(f"between(t,{seg['start']},{seg['end']})")
    expr = "+".join(parts)

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB",
        "-af", f"aselect='{expr}',asetpts=N/SR/TB",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)


# ──────────────────────────────────────────────────────────────
#  WHISPER TRANSCRIPTION
# ──────────────────────────────────────────────────────────────

def transcribe_audio(audio_path: str) -> list[dict]:
    """
    Returns [{"start": 0.0, "end": 3.2, "text": "Hello world"}, ...]
    Uses openai-whisper locally (no API key needed).
    """
    import whisper

    model = whisper.load_model(WHISPER_MODEL)
    result = model.transcribe(audio_path, beam_size=5)
    return [
        {
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"].strip(),
        }
        for seg in result["segments"]
    ]


# ──────────────────────────────────────────────────────────────
#  DEEPSEEK‑R1 TIMESTAMP PARSER
# ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a precise video‑editing assistant.
You will receive a JSON array of transcript segments with start/end times.
You will also receive a user instruction describing what to cut.

Return ONLY a JSON object with a single key "keep" whose value is an array of
objects: {"start": <seconds>, "end": <seconds>}. These are the segments to KEEP.

Rules:
- Never invent timestamps that are not in the transcript.
- Merge adjacent kept segments if the gap is under 0.3 seconds.
- Do NOT include any explanation outside the JSON.
"""


def ask_deepseek(transcript: list[dict], user_prompt: str) -> str:
    """Send transcript + prompt to DeepSeek‑R1 via Ollama. Returns raw text."""
    client = ollama.Client(host=OLLAMA_HOST)

    response = client.chat(
        model=DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"transcript": transcript, "instruction": user_prompt},
                    ensure_ascii=False,
                ),
            },
        ],
        options={"temperature": 0.0},
        stream=False,
    )

    return response["message"]["content"]


def parse_cut_list(raw: str) -> list[dict]:
    """Extract the JSON object from DeepSeek's reply (it may include <think> tags)."""
    # Strip reasoning block
    import re
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()

    # Find first { ... } block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return []

    try:
        data = json.loads(match.group(0))
        segments = data.get("keep", [])
        return [
            {"start": float(s["start"]), "end": float(s["end"])}
            for s in segments
            if "start" in s and "end" in s
        ]
    except (json.JSONDecodeError, KeyError, TypeError):
        return []


# ──────────────────────────────────────────────────────────────
#  PROCESS VIDEO  (SSE streaming response)
# ──────────────────────────────────────────────────────────────

def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/process-video")
async def process_video(request: Request):
    body = await request.json()
    filename = body.get("filename")
    prompt = body.get("prompt", "")
    video_path = body.get("video_path", "")

    if not filename:
        raise HTTPException(400, "filename is required")

    src_dir = Path(video_path) if video_path else Path(RUNTIME["video_dir"])
    src = src_dir / filename

    if not src.exists():
        raise HTTPException(404, f"File not found: {src}")

    async def generate() -> Generator[str, None, None]:
        try:
            # 1. FFmpeg check
            if not ffmpeg_available():
                yield sse_event({
                    "type": "think",
                    "text": "❌ FFmpeg is not installed. Please install it and restart the backend.",
                })
                return

            yield sse_event({"type": "think", "text": "🔊 Extracting audio track…"})

            audio_path = tempfile.mktemp(suffix=".wav")
            extract_audio(str(src), audio_path)

            # 2. Whisper transcription
            yield sse_event({"type": "think", "text": "📝 Transcribing speech with Whisper…"})

            loop = asyncio.get_event_loop()
            transcript = await loop.run_in_executor(None, transcribe_audio, audio_path)

            if not transcript:
                yield sse_event({"type": "think", "text": "⚠️ No speech detected in the video."})
                os.unlink(audio_path)
                return

            yield sse_event({
                "type": "think",
                "text": f"✅ Transcribed {len(transcript)} segments. Sending to DeepSeek‑R1…",
            })

            # 3. DeepSeek reasoning
            raw = await loop.run_in_executor(
                None, ask_deepseek, transcript, prompt
            )

            # Stream the raw thinking + answer back
            yield sse_event({"type": "think", "text": raw})

            # 4. Parse cut list
            cuts = parse_cut_list(raw)

            if not cuts:
                yield sse_event({
                    "type": "think",
                    "text": "⚠️ Could not parse cut list. Using original video.",
                })
                output_name = f"edited_{filename}"
                shutil.copy(str(src), str(src_dir / output_name))
                yield sse_event({"type": "done", "output": output_name})
                os.unlink(audio_path)
                return

            yield sse_event({
                "type": "think",
                "text": f"✂️ Cutting {len(cuts)} segments with FFmpeg…",
            })

            # 5. FFmpeg slice
            output_name = f"edited_{filename}"
            output_path = src_dir / output_name
            await loop.run_in_executor(
                None, cut_and_concat, str(src), cuts, str(output_path)
            )

            os.unlink(audio_path)

            yield sse_event({
                "type": "done",
                "output": output_name,
                "segments_kept": len(cuts),
            })

        except Exception as exc:
            yield sse_event({
                "type": "think",
                "text": f"❌ Error: {exc}",
            })

    return StreamingResponse(generate(), media_type="text/event-stream")


# ──────────────────────────────────────────────────────────────
#  STREAM VIDEO  (Range‑request aware)
# ──────────────────────────────────────────────────────────────

def _range_stream(path: Path, start: int, end: int, chunk: int = 1024 * 1024):
    with path.open("rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@app.get("/projects/stream/{filename}")
async def stream_video(filename: str, request: Request):
    base = Path(RUNTIME["video_dir"])
    file_path = base / filename

    if not file_path.exists():
        raise HTTPException(404, "Video not found")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        # e.g. "bytes=0-1023"
        try:
            _, rng = range_header.split("=")
            start_s, end_s = rng.split("-")
            start = int(start_s)
            end = int(end_s) if end_s else file_size - 1
        except Exception:
            start, end = 0, file_size - 1

        end = min(end, file_size - 1)
        content_length = end - start + 1

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(
            _range_stream(file_path, start, end),
            status_code=206,
            headers=headers,
        )

    # Full file
    return FileResponse(
        file_path,
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},
    )


# ──────────────────────────────────────────────────────────────
#  MAIN
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  🎬  Local Video Editor Backend")
    print(f"  📁  Video folder: {RUNTIME['video_dir']}")
    print(f"  🤖  Model: {DEEPSEEK_MODEL}")
    print(f"  🌐  API: http://localhost:8000")
    print(f"  📖  Docs: http://localhost:8000/docs")
    print("=" * 60 + "\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )