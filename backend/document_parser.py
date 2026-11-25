"""Document ingestion, cleaning and segmentation (report Sec. 4.2, module 1)."""
import io
import re

MAX_SEGMENT_WORDS = 90  # keeps each synthesis request small (TC-05 latency target)
SUPPORTED_EXTENSIONS = (".pdf", ".docx", ".txt", ".md")

_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
_PAGE_NUMBER = re.compile(r"^\s*(page\s*)?\d+\s*(/|of)?\s*(\d+)?\s*$", re.IGNORECASE)
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def extract_text(filename: str, content: bytes) -> str:
    """Return raw text from a PDF, DOCX or TXT upload."""
    lower = (filename or "").lower()
    if lower.endswith(".pdf"):
        return _pdf_text(content)
    if lower.endswith(".docx"):
        return _docx_text(content)
    if lower.endswith((".txt", ".md")):
        return _decode(content)
    raise ValueError("Unsupported file type. Please upload a PDF, DOCX or TXT file.")


def _decode(content: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("latin-1", errors="replace")


def _pdf_text(content: bytes) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is required for PDF support: pip install PyMuPDF") from exc
    try:
        with fitz.open(stream=content, filetype="pdf") as document:
            pages = [page.get_text("text") for page in document]
    except Exception as exc:  # malformed files must not crash the server (NFR-5)
        raise ValueError(f"Could not read this PDF: {exc}") from exc
    return "\n\n".join(pages)


def _docx_text(content: bytes) -> str:
    try:
        import docx  # python-docx
    except ImportError as exc:
        raise RuntimeError("python-docx is required for DOCX support: pip install python-docx") from exc
    try:
        document = docx.Document(io.BytesIO(content))
    except Exception as exc:
        raise ValueError(f"Could not read this DOCX: {exc}") from exc
    return "\n\n".join(paragraph.text for paragraph in document.paragraphs)


def clean_text(raw: str) -> str:
    """Remove page numbers, control characters and line-break hyphenation noise."""
    text = _CONTROL_CHARS.sub(" ", raw or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    text = "\n".join(line for line in text.split("\n") if not _PAGE_NUMBER.match(line))
    text = (text.replace("\u201c", '"').replace("\u201d", '"')
                .replace("\u2018", "'").replace("\u2019", "'"))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_segments(text: str) -> list[str]:
    """Split cleaned text into paragraph-aware segments of at most MAX_SEGMENT_WORDS words."""
    segments: list[str] = []
    for paragraph in re.split(r"\n\s*\n", text):
        flat = " ".join(line.strip() for line in paragraph.split("\n") if line.strip())
        if not flat:
            continue
        bucket: list[str] = []
        words = 0
        for sentence in _SENTENCE_BOUNDARY.split(flat):
            count = len(sentence.split())
            if bucket and words + count > MAX_SEGMENT_WORDS:
                segments.append(" ".join(bucket))
                bucket, words = [], 0
            bucket.append(sentence)
            words += count
        if bucket:
            segments.append(" ".join(bucket))
    return segments
