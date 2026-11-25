"""Prosody controller & SSML generator (report Sec. 4.1 stage 3, Sec. 5.2 module 3).

Per-context profiles follow the report: definitions slowed to ~85%, pitch +2st,
600ms pauses; formulas slowed with 500-700ms pauses. Learner offsets from the
adaptive feedback loop are added on top of the user's base speed.
"""
import re
from xml.sax.saxutils import escape

PROFILES = {
    "definition": {"rate": 0.85, "pitch_st": 2, "pause_before": 300, "pause_after": 600, "emphasis": True},
    "formula": {"rate": 0.80, "pitch_st": 0, "pause_before": 500, "pause_after": 700, "emphasis": False},
    "code": {"rate": 0.90, "pitch_st": 0, "pause_before": 400, "pause_after": 500, "emphasis": False},
    "example": {"rate": 1.00, "pitch_st": 0, "pause_before": 200, "pause_after": 400, "emphasis": False},
    "summary": {"rate": 0.95, "pitch_st": 1, "pause_before": 300, "pause_after": 500, "emphasis": False},
    "narrative": {"rate": 1.00, "pitch_st": 0, "pause_before": 150, "pause_after": 300, "emphasis": False},
}
CONTEXT_RATE_MIN, CONTEXT_RATE_MAX = 0.80, 1.10   # report's context-driven range
COMPLEXITY_SLOWDOWN = 0.15                         # up to 15% slower on dense text
FINAL_RATE_MIN, FINAL_RATE_MAX = 0.50, 1.50
PITCH_HZ_PER_SEMITONE = 5                          # rough mapping for edge-tts pitch

_DEFINITION_TERM = re.compile(
    r"^(?P<term>[^,.;:]{1,60}?)\s+(?=(is defined as|is called|refers to|means|is|are)\b)",
    re.IGNORECASE,
)


def build_prosody(text: str, content_type: str, complexity: float,
                  base_speed: float = 1.0, offset: float = 0.0,
                  voice: str = "en-US-JennyNeural") -> dict:
    profile = PROFILES.get(content_type, PROFILES["narrative"])
    context_rate = profile["rate"] - COMPLEXITY_SLOWDOWN * complexity
    context_rate = min(CONTEXT_RATE_MAX, max(CONTEXT_RATE_MIN, context_rate))
    final_rate = min(FINAL_RATE_MAX, max(FINAL_RATE_MIN, context_rate * base_speed + offset))
    final_rate = round(final_rate, 3)
    pitch_st = profile["pitch_st"]
    locale = "-".join(voice.split("-")[:2]) or "en-US"
    ssml = _to_ssml(text, profile, round(final_rate * 100), pitch_st, voice, locale)
    return {
        "ssml": ssml,
        "rate": final_rate,
        "rate_pct": round((final_rate - 1.0) * 100),       # relative value for edge-tts
        "pitch_st": pitch_st,
        "pitch_hz": pitch_st * PITCH_HZ_PER_SEMITONE,
        "pause_before_ms": profile["pause_before"],
        "pause_after_ms": profile["pause_after"],
    }


def _to_ssml(text, profile, rate_abs_pct, pitch_st, voice, locale) -> str:
    body = escape(text)
    if profile["emphasis"]:
        match = _DEFINITION_TERM.match(text)
        if match:
            term = match.group("term")
            rest = text[match.end():]
            body = f'<emphasis level="strong">{escape(term)}</emphasis> {escape(rest)}'
    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{locale}">'
        f'<voice name="{escape(voice)}">'
        f'<break time="{profile["pause_before"]}ms"/>'
        f'<prosody rate="{rate_abs_pct}%" pitch="{pitch_st:+d}st">{body}</prosody>'
        f'<break time="{profile["pause_after"]}ms"/>'
        "</voice></speak>"
    )
