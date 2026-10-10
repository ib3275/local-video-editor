"""Cut + concat using FFmpeg select/aselect filters."""

import shutil
import subprocess


def cut_and_concat(video_path: str, segments: list, output_path: str) -> None:
    if not segments:
        shutil.copy(video_path, output_path)
        return
    parts = [f"between(t,{seg['start']},{seg['end']})" for seg in segments]
    expr = "+".join(parts)
    cmd = ["ffmpeg", "-y", "-i", video_path,
           "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB",
           "-af", f"aselect='{expr}',asetpts=N/SR/TB",
           output_path]
    subprocess.run(cmd, capture_output=True, check=True)
