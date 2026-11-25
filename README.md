# Adaptive Text-to-Speech Learning Assistant with Context-Aware Synthesis

A web app that turns study material (PDF, DOCX, TXT or pasted text) into expressive audio.
It classifies each part of the text (definition, formula, code, example, summary, narrative),
scores its reading complexity, generates SSML prosody settings for it, and adapts pacing to
the learner's feedback. It implements the design in the project report (MITS, July-Dec 2026).

## Report-to-code map

| Report section | Where it lives |
|---|---|
| 4.1 Input & preprocessing | `backend/document_parser.py` (`extract_text`, `clean_text`, `split_segments`) |
| 4.1 NLP context & difficulty analyzer | `backend/nlp_analyzer.py` (`classify`, `flesch_kincaid_grade`, `analyze`) |
| 4.1 Prosody controller & SSML generator | `backend/ssml_generator.py` (`build_prosody`) |
| 4.1 Neural TTS & adaptive feedback | `backend/tts_engine.py`, `backend/main.py` (`/api/feedback`) |
| 4.3 Users / Documents / Segments_SSML / Feedback_Logs | `backend/database.py` |
| 3.1 Functional requirements (upload, controls, feedback, bookmarks, download) | `frontend/src/components/*` and the `/api` routes |
| 6.1 Test cases TC-01 to TC-04 | `tests/test_pipeline.py` |

## Run it

Backend (Python 3.10+):

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Frontend (Node 18+):

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173, paste notes or upload a file, then press Analyze. Vite proxies `/api` to the backend.

Tests:

```bash
pytest tests/
```

## Using the player

- **Play / pause / previous / next / replay**: segment-by-segment playback. Space toggles play, arrow keys move between segments.
- **Too complex — slow down**: lowers the learner's prosody offset by 0.05, so later dense segments are read more slowly.
- **Too slow — speed up**: raises the offset by 0.05. Offsets are clamped to [-0.30, +0.20].
- **Bookmark**: saves the current segment; bookmarks appear in the right-hand panel.
- **Base speed and voice** are stored per learner and apply from the next segment played.

## Known differences from the report

- **Classifier**: the report's fine-tuned DistilBERT model is not included. The classifier is rule-based (LaTeX/math patterns, code patterns, definition/example/summary cues) plus a Flesch-Kincaid complexity score. A transformer can replace `classify()` later.
- **SSML**: each segment's SSML (with `rate`, `pitch`, `emphasis` and `break`) is generated and stored, and the browser reads its pause lengths from it. edge-tts does not accept raw SSML, so the synthesis call receives the same rate and pitch as numbers, and pauses are applied between segments by the player.
- **Offline fallback**: the report's pyttsx3 fallback is not included. Synthesis requires internet access to Microsoft Edge neural voices.
- **Evaluation numbers**: the accuracy, latency, MOS and recall figures in the report come from experiments that are not part of this repository. No benchmark script is included, so these numbers cannot be reproduced from the code alone.

## Project layout

```
backend/
  main.py              FastAPI routes
  document_parser.py   ingestion, cleaning, segmentation
  nlp_analyzer.py      content-type classification, complexity score
  ssml_generator.py    prosody profiles and SSML generation
  tts_engine.py        edge-tts synthesis with per-segment cache
  database.py          SQLite schema (Users, Documents, Segments_SSML, Feedback_Logs)
frontend/src/
  App.tsx              layout and state
  components/          UploadPanel, SegmentList, Player, InsightsPanel
  services/api.ts      typed API client
tests/test_pipeline.py
```
