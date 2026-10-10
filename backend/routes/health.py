import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from core.config import OLLAMA_HOST, DEEPSEEK_MODEL, WHISPER_MODEL, RUNTIME, VERSION

router = APIRouter()


@router.get("/status")
async def status():
    return {"status": "ok", "model": DEEPSEEK_MODEL, "whisper": WHISPER_MODEL,
            "video_dir": RUNTIME["video_dir"], "version": VERSION}


@router.get("/ollama/tags")
async def ollama_tags():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OLLAMA_HOST}/api/tags")
            return JSONResponse(content=r.json(), status_code=r.status_code)
    except Exception as e:
        raise HTTPException(503, f"Ollama unreachable: {e}")
