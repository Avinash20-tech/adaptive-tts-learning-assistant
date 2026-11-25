"""Context & complexity analysis (report Sec. 5.2, module 2).

Uses the rule-based patterns from the report (LaTeX/math, code blocks,
definitions, examples, summaries) plus a Flesch-Kincaid readability score.
The report's fine-tuned DistilBERT classifier is not included: no trained
checkpoint or labelled dataset ships with the project.
"""
import re

CONTENT_TYPES = ("definition", "formula", "code", "example", "summary", "narrative")

_CODE = re.compile(
    r"(^|\s)(def |class |import |return |function |const |let |var |#include|print\()"
    r"|[{};]|=>|::|</?\w+>"
)
_FORMULA = re.compile(
    r"\\(frac|sum|int|sqrt|alpha|beta|theta|lambda|pi|partial|cdot|times|le|ge|approx)"
    r"|\$[^$]+\$|\b[a-zA-Z]\s*=\s*\S|\^|\d\s*[=*/+]\s*\d|[∑∫√≤≥≈±×÷]"
)
_DEFINITION = re.compile(
    r"^\s*(definition\s*[:.-]"
    r"|[\w][\w\s\-()]{1,60}?\s+(is defined as|is called|refers to|means|is a|is an|is the|are the|are called)\s"
    r"|we define\b|let\s+\w+\s+(denote|be)\b)",
    re.IGNORECASE,
)
_EXAMPLE = re.compile(
    r"^\s*(for example|for instance|e\.g\.|example\s*[:.\d]|consider\b|suppose\b|as an illustration)",
    re.IGNORECASE,
)
_SUMMARY = re.compile(
    r"^\s*(in summary|in conclusion|to summari[sz]e|summary|key (takeaway|point)s?|overall\b|therefore\b|thus,|hence\b)",
    re.IGNORECASE,
)
_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_SENTENCE_END = re.compile(r"[.!?]+(\s|$)")
_CONTENT_BONUS = {"formula": 0.25, "code": 0.20, "definition": 0.15}


def classify(text: str) -> str:
    stripped = text.strip()
    if "```" in stripped or len(_CODE.findall(stripped)) >= 2:
        return "code"
    formula_hits = len(_FORMULA.findall(stripped))
    if formula_hits >= 2 or (formula_hits >= 1 and len(stripped.split()) <= 20):
        return "formula"
    if _DEFINITION.search(stripped):
        return "definition"
    if _EXAMPLE.search(stripped):
        return "example"
    if _SUMMARY.search(stripped):
        return "summary"
    return "narrative"


def _syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    count = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and count > 1 and not w.endswith(("le", "ee")):
        count -= 1
    return max(1, count)


def flesch_kincaid_grade(text: str) -> float:
    words = _WORD.findall(text)
    if not words:
        return 0.0
    sentences = max(1, len(_SENTENCE_END.findall(text)))
    syllables = sum(_syllables(w) for w in words)
    return 0.39 * (len(words) / sentences) + 11.8 * (syllables / len(words)) - 15.59


def analyze(text: str) -> dict:
    content_type = classify(text)
    grade = flesch_kincaid_grade(text)
    base = min(1.0, max(0.0, grade / 16.0))
    score = min(1.0, base + _CONTENT_BONUS.get(content_type, 0.0))
    return {
        "content_type": content_type,
        "complexity_score": round(score, 3),
        "fk_grade": round(grade, 2),
        "word_count": len(text.split()),
    }
