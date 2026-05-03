#!/usr/bin/env python3
"""
PharmaInk local server — speech-to-text (faster-whisper) + symptom persistence (SQLite).
Run:  python3 server.py
Serves the app at http://localhost:8766
"""

from __future__ import annotations
import os, sys, json, sqlite3, tempfile, datetime, pathlib
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Whisper quality vs speed (override with env WHISPER_MODEL=tiny|base|small|medium)
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small").strip() or "small"

# ── Paths ────────────────────────────────────────────────────────
ROOT = pathlib.Path(__file__).resolve().parent
STATIC_DIR = ROOT.parent            # pharmaprinter/
DB_PATH = ROOT / "pharmaink.db"

# ── SQLite helpers ───────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS symptom_logs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            symptom   TEXT NOT NULL,
            severity  INTEGER NOT NULL,
            note      TEXT,
            timestamp TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS guided_checkins (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            transcript TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

# ── Whisper model (lazy-loaded) ──────────────────────────────────
_whisper_model = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        device = os.environ.get("WHISPER_DEVICE", "cpu").strip() or "cpu"
        if device == "cuda":
            compute_type = os.environ.get("WHISPER_COMPUTE", "float16").strip() or "float16"
        else:
            compute_type = os.environ.get("WHISPER_COMPUTE", "int8").strip() or "int8"
        model_name = WHISPER_MODEL
        _whisper_model = WhisperModel(model_name, device=device, compute_type=compute_type)
        print(f"[whisper] Model loaded ({model_name} / {device} / {compute_type})")
    return _whisper_model


WHISPER_INITIAL_PROMPT = (
    "Menopause symptoms: hot flashes, night sweats, sleep, insomnia, mood, anxiety, "
    "fatigue, brain fog, joint pain, headache, dryness, palpitations, hormone therapy."
)

# ── Startup ──────────────────────────────────────────────────────
init_db()

app = FastAPI()
# Whisper loads lazily on first /api/transcribe (startup would block HTTP for minutes on CPU).

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── POST /api/transcribe ────────────────────────────────────────
@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    suffix = ".webm"
    ct = audio.content_type or ""
    if "wav" in ct:
        suffix = ".wav"
    elif "ogg" in ct:
        suffix = ".ogg"
    elif "mp4" in ct or "m4a" in ct:
        suffix = ".m4a"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        data = await audio.read()
        tmp.write(data)
        tmp.close()

        model = get_whisper()
        segments, _info = model.transcribe(
            tmp.name,
            language="en",
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400),
            initial_prompt=WHISPER_INITIAL_PROMPT,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        os.unlink(tmp.name)

    return {"text": text}

# ── POST /api/symptoms ──────────────────────────────────────────
class SymptomEntry(BaseModel):
    symptom: str
    severity: int
    note: str = ""
    timestamp: str = ""

class SymptomPayload(BaseModel):
    entries: List[SymptomEntry]
    guided_transcript: Optional[str] = None

@app.post("/api/symptoms")
async def save_symptoms(payload: SymptomPayload):
    conn = get_db()
    now = datetime.datetime.utcnow().isoformat()
    for e in payload.entries:
        ts = e.timestamp or now
        conn.execute(
            "INSERT INTO symptom_logs (symptom, severity, note, timestamp) VALUES (?, ?, ?, ?)",
            (e.symptom, e.severity, e.note, ts),
        )
    if payload.guided_transcript and payload.guided_transcript.strip():
        conn.execute(
            "INSERT INTO guided_checkins (transcript, created_at) VALUES (?, ?)",
            (payload.guided_transcript.strip(), now),
        )
    conn.commit()
    conn.close()
    return {"ok": True, "count": len(payload.entries)}

# ── GET /api/symptoms ───────────────────────────────────────────
@app.get("/api/symptoms")
async def list_symptoms():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, symptom, severity, note, timestamp FROM symptom_logs ORDER BY id DESC LIMIT 30"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Static files (must be last) ─────────────────────────────────
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    print(f"[pharmaink] Serving app from {STATIC_DIR}")
    print(f"[pharmaink] DB at {DB_PATH}")
    print(f"[pharmaink] http://localhost:8766")
    uvicorn.run(app, host="0.0.0.0", port=8766)
