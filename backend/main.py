"""
Local Video Editor — Companion Backend
Entry point. Thin — all logic lives in the packages under this folder.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import (
    RUNTIME, DEEPSEEK_MODEL, WHISPER_MODEL,
    SILENCE_NOISE_DB, SILENCE_MIN_DURATION, VERSION,
)
from routes import health, utils, projects, process

app = FastAPI(title="Local Video Editor Backend", version=VERSION)

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

app.include_router(health.router)
app.include_router(utils.router)
app.include_router(projects.router)
app.include_router(process.router)


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print(f"  🎬  Local Video Editor Backend v{VERSION}")
    print(f"  📁  Video folder: {RUNTIME['video_dir']}")
    print(f"  🤖  LLM:   {DEEPSEEK_MODEL}")
    print(f"  🎙️   ASR:   faster-whisper ({WHISPER_MODEL})")
    print(f"  🔇  Silence: < {SILENCE_NOISE_DB}dB for {SILENCE_MIN_DURATION}s")
    print(f"  🌐  API:   http://localhost:8000")
    print("=" * 60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")