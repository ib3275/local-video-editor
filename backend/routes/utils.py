import asyncio, json, os, subprocess, sys, tempfile
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from core.config import RUNTIME

router = APIRouter(prefix="/utils")


def _ask_directory(title: str) -> str:
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
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(script); tmp_path = tmp.name
    try:
        result = subprocess.run([sys.executable, tmp_path], capture_output=True, text=True, timeout=120)
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""
    finally:
        try: os.unlink(tmp_path)
        except OSError: pass


@router.post("/browse-folder")
async def browse_folder(request: Request):
    body = await request.json()
    title = body.get("title", "Select a folder")
    loop = asyncio.get_event_loop()
    path = await loop.run_in_executor(None, _ask_directory, title)
    if not path:
        return JSONResponse({"path": "", "cancelled": True})
    return JSONResponse({"path": path, "cancelled": False})


@router.post("/set-paths")
async def set_paths(request: Request):
    body = await request.json()
    if body.get("video_path"):
        p = Path(body["video_path"]); p.mkdir(parents=True, exist_ok=True)
        RUNTIME["video_dir"] = str(p)
    if body.get("ollama_path"):
        p = Path(body["ollama_path"]); p.mkdir(parents=True, exist_ok=True)
        RUNTIME["ollama_models_dir"] = str(p)
        os.environ["OLLAMA_MODELS"] = str(p)
    return {"ok": True, "runtime": RUNTIME}
