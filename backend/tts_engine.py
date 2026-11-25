"""Neural TTS synthesis with per-segment caching (report Sec. 5.2, module 4).

Synthesis uses Microsoft Edge neural voices via edge-tts. Each segment is
synthesized separately with its own rate/pitch and cached on disk; pauses from
the SSML spec are applied by the browser player between segments.
"""
import asyncio
import os

import edge_tts

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "storage", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)
SYNTH_TIMEOUT_S = 10.0


async def synthesize(text: str, voice: str, rate_pct: int, pitch_hz: int, cache_key: str) -> str:
    path = os.path.join(AUDIO_DIR, f"seg_{cache_key}.mp3")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=f"{rate_pct:+d}%",
        pitch=f"{pitch_hz:+d}Hz",
    )
    try:
        await asyncio.wait_for(communicate.save(path), timeout=SYNTH_TIMEOUT_S)
    except Exception:
        if os.path.exists(path):
            os.remove(path)  # never leave a truncated file in the cache
        raise
    return path
