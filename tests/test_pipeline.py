"""Unit tests for the learning-assistant pipeline (report Sec. 6.1, TC-01 to TC-04)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

import pytest

from document_parser import clean_text, extract_text, split_segments, MAX_SEGMENT_WORDS
from nlp_analyzer import analyze
from ssml_generator import build_prosody


def test_tc01_clean_text_removes_page_numbers_and_joins_hyphens():
    raw = "Intro to the sys-\ntem here.\n\n12\n\nNext paragraph.\r\n\r\n\r\n\r\nEnd."
    cleaned = clean_text(raw)
    assert "system" in cleaned
    assert "\n12\n" not in cleaned
    assert "\n\n\n" not in cleaned


def test_tc01_unsupported_extension_is_rejected():
    with pytest.raises(ValueError):
        extract_text("notes.exe", b"binary")


def test_segments_respect_word_budget():
    long_para = " ".join(["This is a sentence about learning."] * 40)
    segments = split_segments(long_para)
    assert len(segments) > 1
    assert all(len(s.split()) <= MAX_SEGMENT_WORDS + 10 for s in segments)


@pytest.mark.parametrize("text, expected", [
    ("Entropy is a measure of uncertainty in a random variable.", "definition"),
    ("Let $E = mc^2$ hold for all particles.", "formula"),
    ("def add(a, b): return a + b", "code"),
    ("For example, a fair coin has two outcomes.", "example"),
    ("In summary, the method converges quickly.", "summary"),
    ("We walked to the market on Sunday morning.", "narrative"),
])
def test_tc02_context_classification(text, expected):
    assert analyze(text)["content_type"] == expected


def test_tc03_definition_is_slowed_with_long_pause():
    info = analyze("Entropy is a measure of uncertainty in a random variable.")
    prosody = build_prosody("Entropy is a measure of uncertainty.", info["content_type"],
                            info["complexity_score"])
    assert prosody["rate"] <= 0.85
    assert '<break time="600ms"/>' in prosody["ssml"]
    assert '<emphasis level="strong">Entropy</emphasis>' in prosody["ssml"]


def test_tc04_feedback_offset_slows_later_segments():
    neutral = build_prosody("Some dense formula text.", "formula", 0.5, 1.0, 0.0)
    slowed = build_prosody("Some dense formula text.", "formula", 0.5, 1.0, -0.10)
    assert slowed["rate"] < neutral["rate"]


def test_rate_stays_within_bounds():
    prosody = build_prosody("text", "narrative", 0.0, 1.5, 0.2)
    assert 0.5 <= prosody["rate"] <= 1.5
