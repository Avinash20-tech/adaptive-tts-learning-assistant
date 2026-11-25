"""Adaptive Text-to-Speech Learning Assistant - FastAPI backend.

Pipeline (report Sec. 4.1): input & preprocessing -> NLP context analyzer ->
prosody/SSML generator -> neural TTS & adaptive feedback engine.
"""
import hashlib
import os
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Literal, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database import get_db, get_user, init_db, now
from document_parser import MAX_SEGMENT_WORDS, clean_text, extract_text, split_segments
from nlp_analyzer import analyze
from ssml_generator import build_prosody
from tts_engine import synthesize

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
OFFSET_STEP = 0.05
OFFSET_MIN, OFFSET_MAX = -0.30, 0.20   # bounds on the learner's prosody offset
SLOWDOWN_ACTIONS = {"slow_down", "too_complex"}
SPEEDUP_ACTIONS = {"speed_up"}
FEEDBACK_MESSAGES = {
    "replay": "Replaying this segment.",
    "slow_down": "Noted. Upcoming complex segments will be read more slowly.",
    "too_complex": "Noted. Upcoming complex segments will be read more slowly.",
    "speed_up": "Noted. Upcoming segments will be read slightly faster.",
    "bookmark": "Bookmarked.",
}
VOICES = [
    {"id": "en-US-JennyNeural", "name": "Jenny", "locale": "en-US", "gender": "Female"},
    {"id": "en-US-GuyNeural", "name": "Guy", "locale": "en-US", "gender": "Male"},
    {"id": "en-US-AriaNeural", "name": "Aria", "locale": "en-US", "gender": "Female"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia", "locale": "en-GB", "gender": "Female"},
    {"id": "en-IN-NeerjaNeural", "name": "Neerja", "locale": "en-IN", "gender": "Female"},
    {"id": "en-IN-PrabhatNeural", "name": "Prabhat", "locale": "en-IN", "gender": "Male"},
]
VOICE_IDS = {v["id"] for v in VOICES}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Adaptive TTS Learning Assistant API",
    description="Context-aware, adaptive text-to-speech for educational material",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextDocumentIn(BaseModel):
    title: str = Field("Pasted text", max_length=200)
    text: str = Field(..., min_length=1, max_length=200_000)
    user_id: str = "guest"


class FeedbackIn(BaseModel):
    user_id: str = "guest"
    segment_id: str
    action_type: Literal["replay", "slow_down", "too_complex", "speed_up", "bookmark"]


class UserSettingsIn(BaseModel):
    preferred_voice: Optional[str] = None
    base_speed: Optional[float] = Field(None, ge=0.5, le=1.5)
    high_contrast: Optional[bool] = None
    large_text: Optional[bool] = None


@app.get("/api/health")
def health():
    return {"status": "online", "service": "Adaptive TTS Learning Assistant", "timestamp": now()}


@app.get("/api/voices")
def list_voices():
    return {"voices": VOICES}


def _ingest(user_id: str, title: str, raw: str) -> dict:
    cleaned = clean_text(raw)
    if not cleaned:
        raise HTTPException(status_code=400, detail="No readable text was found in this document.")
    pieces = split_segments(cleaned)
    if not pieces:
        raise HTTPException(status_code=400, detail="The document could not be segmented.")

    conn = get_db()
    user = get_user(conn, user_id)
    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    rows = []
    for order, text in enumerate(pieces, start=1):
        info = analyze(text)
        prosody = build_prosody(
            text, info["content_type"], info["complexity_score"],
            user["base_speed"], user["prosody_offset"], user["preferred_voice"],
        )
        rows.append((
            f"seg-{uuid.uuid4().hex[:10]}", doc_id, order, text,
            info["content_type"], info["complexity_score"], info["word_count"], prosody["ssml"],
        ))
    conn.execute(
        "INSERT INTO documents (doc_id, user_id, title, raw_text, segment_count, upload_timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (doc_id, user_id, title, cleaned, len(rows), now()),
    )
    conn.executemany(
        "INSERT INTO segments_ssml (segment_id, doc_id, sequence_order, text, content_type, "
        "complexity_score, word_count, generated_ssml) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    conn.close()
    return _load_document(doc_id)


def _load_document(doc_id: str) -> dict:
    conn = get_db()
    doc = conn.execute(
        "SELECT doc_id, user_id, title, segment_count, upload_timestamp FROM documents WHERE doc_id = ?",
        (doc_id,),
    ).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")
    segments = conn.execute(
        "SELECT segment_id, sequence_order, text, content_type, complexity_score, word_count, generated_ssml "
        "FROM segments_ssml WHERE doc_id = ? ORDER BY sequence_order",
        (doc_id,),
    ).fetchall()
    conn.close()
    segs = [dict(s) for s in segments]
    distribution: dict[str, int] = {}
    for s in segs:
        distribution[s["content_type"]] = distribution.get(s["content_type"], 0) + 1
    avg = round(sum(s["complexity_score"] for s in segs) / len(segs), 3) if segs else 0.0
    return {
        "document": dict(doc),
        "segments": segs,
        "stats": {
            "segment_count": len(segs),
            "content_types": distribution,
            "avg_complexity": avg,
            "max_segment_words": MAX_SEGMENT_WORDS,
        },
    }


@app.post("/api/documents")
def create_document(body: TextDocumentIn):
    return _ingest(body.user_id, body.title, body.text)


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), user_id: str = "guest"):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 10 MB.")
    try:
        raw = extract_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    title = os.path.splitext(file.filename or "")[0] or "Untitled document"
    return _ingest(user_id, title, raw)


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str):
    return _load_document(doc_id)


@app.get("/api/segments/{segment_id}/audio")
async def segment_audio(segment_id: str, user_id: str = "guest"):
    conn = get_db()
    seg = conn.execute("SELECT * FROM segments_ssml WHERE segment_id = ?", (segment_id,)).fetchone()
    if not seg:
        conn.close()
        raise HTTPException(status_code=404, detail="Segment not found")
    user = get_user(conn, user_id)
    prosody = build_prosody(
        seg["text"], seg["content_type"], seg["complexity_score"],
        user["base_speed"], user["prosody_offset"], user["preferred_voice"],
    )
    key_src = f"{segment_id}|{user['preferred_voice']}|{prosody['rate_pct']}|{prosody['pitch_hz']}"
    cache_key = hashlib.sha1(key_src.encode()).hexdigest()[:16]
    try:
        path = await synthesize(seg["text"], user["preferred_voice"],
                                prosody["rate_pct"], prosody["pitch_hz"], cache_key)
    except Exception as exc:
        conn.close()
        raise HTTPException(status_code=503, detail=f"Speech engine unavailable: {exc}")
    conn.execute(
        "UPDATE segments_ssml SET cached_audio_path = ?, generated_ssml = ? WHERE segment_id = ?",
        (path, prosody["ssml"], segment_id),
    )
    conn.commit()
    conn.close()
    return FileResponse(path, media_type="audio/mpeg", filename=f"{segment_id}.mp3")


@app.post("/api/feedback")
def submit_feedback(body: FeedbackIn):
    conn = get_db()
    seg = conn.execute("SELECT segment_id FROM segments_ssml WHERE segment_id = ?", (body.segment_id,)).fetchone()
    if not seg:
        conn.close()
        raise HTTPException(status_code=404, detail="Segment not found")
    user = get_user(conn, body.user_id)
    offset = user["prosody_offset"]
    if body.action_type in SLOWDOWN_ACTIONS:
        offset = max(OFFSET_MIN, offset - OFFSET_STEP)
    elif body.action_type in SPEEDUP_ACTIONS:
        offset = min(OFFSET_MAX, offset + OFFSET_STEP)
    offset = round(offset, 3)
    conn.execute("UPDATE users SET prosody_offset = ? WHERE user_id = ?", (offset, body.user_id))
    log_id = f"log-{uuid.uuid4().hex[:8]}"
    conn.execute(
        "INSERT INTO feedback_logs (log_id, user_id, segment_id, action_type, updated_prosody_offset, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (log_id, body.user_id, body.segment_id, body.action_type, offset, now()),
    )
    conn.commit()
    conn.close()
    return {
        "success": True,
        "log_id": log_id,
        "action_type": body.action_type,
        "prosody_offset": offset,
        "message": FEEDBACK_MESSAGES[body.action_type],
    }


@app.get("/api/bookmarks")
def list_bookmarks(user_id: str = "guest"):
    conn = get_db()
    rows = conn.execute(
        """
        SELECT DISTINCT s.segment_id, s.doc_id, d.title, s.sequence_order, s.text, s.content_type
        FROM feedback_logs f
        JOIN segments_ssml s ON s.segment_id = f.segment_id
        JOIN documents d ON d.doc_id = s.doc_id
        WHERE f.user_id = ? AND f.action_type = 'bookmark'
        ORDER BY d.upload_timestamp DESC, s.sequence_order
        """,
        (user_id,),
    ).fetchall()
    conn.close()
    return {"bookmarks": [dict(r) for r in rows]}


@app.get("/api/users/{user_id}")
def get_profile(user_id: str):
    conn = get_db()
    user = get_user(conn, user_id)
    conn.close()
    return {"user": user}


@app.put("/api/users/{user_id}")
def update_profile(user_id: str, body: UserSettingsIn):
    data = body.model_dump(exclude_none=True)
    if "preferred_voice" in data and data["preferred_voice"] not in VOICE_IDS:
        raise HTTPException(status_code=400, detail="Unknown voice")
    for flag in ("high_contrast", "large_text"):
        if flag in data:
            data[flag] = int(data[flag])
    conn = get_db()
    get_user(conn, user_id)
    if data:
        assignments = ", ".join(f"{k} = ?" for k in data)
        conn.execute(f"UPDATE users SET {assignments} WHERE user_id = ?", (*data.values(), user_id))
        conn.commit()
    user = get_user(conn, user_id)
    conn.close()
    return {"user": user}


@app.get("/api/analytics/{user_id}")
def analytics(user_id: str):
    conn = get_db()
    counts = {
        r["action_type"]: r["n"]
        for r in conn.execute(
            "SELECT action_type, COUNT(*) AS n FROM feedback_logs WHERE user_id = ? GROUP BY action_type",
            (user_id,),
        )
    }
    user = get_user(conn, user_id)
    conn.close()
    return {
        "actions": counts,
        "prosody_offset": user["prosody_offset"],
        "base_speed": user["base_speed"],
    }
