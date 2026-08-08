"""FastAPI backend wrapping the speech delivery analytics pipeline.

Run locally (from the repo root, with the CORE pipeline venv active):
    uvicorn backend.app.main:app --reload --port 8000

Requires ANTHROPIC_API_KEY set in the environment (same as the CLI
pipeline). CORS origin for the deployed frontend is set via
FRONTEND_ORIGIN (comma-separated list allowed); defaults to "*" for local
development -- lock this down before a real deployment.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .jobs import DEFAULT_MODEL, UPLOADS_DIR, create_job, get_job

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac", ".webm"}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500MB -- generous for a long practice recording

app = FastAPI(title="Speech Delivery Analytics API")

_frontend_origins = os.environ.get("FRONTEND_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _frontend_origins == "*" else _frontend_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/jobs")
async def submit_job(
    file: UploadFile = File(...),
    whisper_model: str = Form("base"),
    claude_model: str = Form(DEFAULT_MODEL),
) -> dict:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="Server is missing ANTHROPIC_API_KEY")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}")

    upload_id = uuid.uuid4().hex
    upload_dir = UPLOADS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest_path = upload_dir / f"recording{ext}"

    size = 0
    with open(dest_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                dest_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large (max 500MB)")
            f.write(chunk)

    job_id = create_job(str(dest_path), whisper_model=whisper_model, claude_model=claude_model)
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    # Don't leak the internal traceback to clients; it's still logged server-side.
    job.pop("traceback", None)
    return job
