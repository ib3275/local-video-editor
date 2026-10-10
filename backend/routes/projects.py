import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from core.config import RUNTIME

router = APIRouter(prefix="/projects")


@router.post("/upload")
async def upload_video(file: UploadFile = File(...), video_path: str = Form("")):
    dest_dir = Path(video_path) if video_path else Path(RUNTIME["video_dir"])
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest = dest_dir / safe_name
    with dest.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
    return {"filename": safe_name, "path": str(dest)}


def _range_stream(path: Path, start: int, end: int, chunk: int = 1024 * 1024):
    with path.open("rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data: break
            remaining -= len(data)
            yield data


@router.get("/stream/{filename}")
async def stream_video(filename: str, request: Request):
    base = Path(RUNTIME["video_dir"])
    file_path = base / filename
    if not file_path.exists():
        raise HTTPException(404, "Video not found")
    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")
    if range_header:
        try:
            _, rng = range_header.split("=")
            start_s, end_s = rng.split("-")
            start = int(start_s)
            end = int(end_s) if end_s else file_size - 1
        except Exception:
            start, end = 0, file_size - 1
        end = min(end, file_size - 1)
        content_length = end - start + 1
        headers = {"Content-Range": f"bytes {start}-{end}/{file_size}",
                   "Accept-Ranges": "bytes",
                   "Content-Length": str(content_length),
                   "Content-Type": "video/mp4"}
        return StreamingResponse(_range_stream(file_path, start, end), status_code=206, headers=headers)
    return FileResponse(file_path, media_type="video/mp4", headers={"Accept-Ranges": "bytes"})
