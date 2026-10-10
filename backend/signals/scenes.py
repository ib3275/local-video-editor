"""PySceneDetect -> shot boundaries."""


def detect_scenes(video_path: str) -> list:
    try:
        from scenedetect import detect, ContentDetector
    except ImportError:
        return []
    try:
        scene_list = detect(video_path, ContentDetector(threshold=27.0))
        return [{"start": round(s[0].get_seconds(), 3),
                 "end": round(s[1].get_seconds(), 3),
                 "type": "scene"} for s in scene_list]
    except Exception:
        return []
