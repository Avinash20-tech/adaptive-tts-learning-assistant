"""SQLite schema from report Sec. 4.3: Users, Documents, Segments_SSML, Feedback_Logs."""
import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "learning.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    preferred_voice TEXT NOT NULL DEFAULT 'en-US-JennyNeural',
    base_speed REAL NOT NULL DEFAULT 1.0,
    prosody_offset REAL NOT NULL DEFAULT 0.0,
    high_contrast INTEGER NOT NULL DEFAULT 0,
    large_text INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    segment_count INTEGER NOT NULL DEFAULT 0,
    upload_timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS segments_ssml (
    segment_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    text TEXT NOT NULL,
    content_type TEXT NOT NULL,
    complexity_score REAL NOT NULL,
    word_count INTEGER NOT NULL,
    generated_ssml TEXT NOT NULL,
    cached_audio_path TEXT
);
CREATE TABLE IF NOT EXISTS feedback_logs (
    log_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    segment_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    updated_prosody_offset REAL NOT NULL,
    created_at TEXT NOT NULL
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def get_user(conn: sqlite3.Connection, user_id: str) -> dict:
    conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (user_id,))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    return dict(row)
