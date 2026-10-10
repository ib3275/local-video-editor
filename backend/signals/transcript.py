"""faster-whisper transcription."""

from core.state import get_whisper


def transcribe_audio(audio_path: str) -> list:
    model = get_whisper()
    segments, info = model.transcribe(
        audio_path, beam_size=5, vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )
    return [{"start": round(float(seg.start), 3),
             "end": round(float(seg.end), 3),
             "text": seg.text.strip(),
             "type": "speech"} for seg in segments]
