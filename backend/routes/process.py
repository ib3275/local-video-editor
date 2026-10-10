import asyncio, json, os, shutil, tempfile
from pathlib import Path
from typing import Generator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.config import RUNTIME
from core.ffmpeg import extract_audio, ffmpeg_available
from signals.silence import detect_loud_segments
from signals.scenes import detect_scenes
from signals.transcript import transcribe_audio
from editor.planner import build_timeline, ask_deepseek, parse_cut_list
from render.slicer import cut_and_concat

router = APIRouter()


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.post("/process-video")
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
        audio_path = None
        try:
            if not ffmpeg_available():
                yield sse_event({"type": "think", "text": "? FFmpeg not found."})
                return
            loop = asyncio.get_event_loop()

            yield sse_event({"type": "think", "text": "?? Scanning audio loudness…"})
            loud = await loop.run_in_executor(None, detect_loud_segments, str(src))
            yield sse_event({"type": "think", "text": f"? Found {len(loud)} loud segments."})

            yield sse_event({"type": "think", "text": "?? Detecting scene changes…"})
            scenes = await loop.run_in_executor(None, detect_scenes, str(src))
            yield sse_event({"type": "think", "text": f"? Found {len(scenes)} scenes."})

            audio_path = tempfile.mktemp(suffix=".wav")
            await loop.run_in_executor(None, extract_audio, str(src), audio_path)
            yield sse_event({"type": "think", "text": "?? Transcribing speech…"})
            transcript = await loop.run_in_executor(None, transcribe_audio, audio_path)
            if transcript:
                yield sse_event({"type": "think", "text": f"? {len(transcript)} speech segments."})
            else:
                yield sse_event({"type": "think", "text": "?? No speech detected — using loudness + scenes only."})

            timeline = build_timeline(loud, scenes, transcript)
            yield sse_event({"type": "think", "text": f"?? Sending timeline to DeepSeek-R1 ({timeline['summary']})…"})
            raw = await loop.run_in_executor(None, ask_deepseek, timeline, prompt)
            yield sse_event({"type": "think", "text": raw})

            cuts = parse_cut_list(raw)
            if not cuts:
                yield sse_event({"type": "think", "text": "?? Could not parse cut list. Falling back to loud segments."})
                cuts = [{"start": s["start"], "end": s["end"]} for s in loud]
                if not cuts:
                    output_name = f"edited_{filename}"
                    shutil.copy(str(src), str(src_dir / output_name))
                    yield sse_event({"type": "done", "output": output_name})
                    return

            yield sse_event({"type": "think", "text": f"?? Cutting {len(cuts)} segments with FFmpeg…"})
            output_name = f"edited_{filename}"
            output_path = src_dir / output_name
            await loop.run_in_executor(None, cut_and_concat, str(src), cuts, str(output_path))
            yield sse_event({"type": "done", "output": output_name, "segments_kept": len(cuts)})
        except Exception as exc:
            yield sse_event({"type": "think", "text": f"? Error: {exc}"})
        finally:
            if audio_path and os.path.exists(audio_path):
                try: os.unlink(audio_path)
                except OSError: pass

    return StreamingResponse(generate(), media_type="text/event-stream")
