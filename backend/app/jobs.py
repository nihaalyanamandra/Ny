"""In-memory job store + background execution of the pipeline.

A single audio recording takes minutes to process (Whisper transcription
alone is minutes on CPU), so the API can't do this synchronously within an
HTTP request/response cycle. Jobs run in a plain background thread and the
client polls for status -- simplest thing that works at personal-tool
scale. No persistence across process restarts and no multi-worker sharing
(a job started on worker A isn't visible to worker B) -- both fine for a
single-instance personal deployment; would need a real queue (e.g. Redis +
RQ/Celery) to scale beyond that, which is out of scope for what this is.
"""
from __future__ import annotations

import sys
import threading
import time
import traceback
import uuid
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.pipeline import run_pipeline  # noqa: E402
from src.synthesize import DEFAULT_MODEL  # noqa: E402

UPLOADS_DIR = REPO_ROOT / "backend_uploads"
OUTPUT_DIR = REPO_ROOT / "backend_output"

_jobs: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def _set(job_id: str, **fields: Any) -> None:
    with _lock:
        _jobs[job_id]["updated_at"] = time.time()
        _jobs[job_id].update(fields)


def create_job(audio_path: str, whisper_model: str = "base", claude_model: str = DEFAULT_MODEL) -> str:
    job_id = uuid.uuid4().hex
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "stage": None,
            "created_at": time.time(),
            "updated_at": time.time(),
            "result": None,
            "error": None,
        }

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, audio_path),
        kwargs={"whisper_model": whisper_model, "claude_model": claude_model},
        daemon=True,
    )
    thread.start()
    return job_id


def _run_job(job_id: str, audio_path: str, whisper_model: str, claude_model: str) -> None:
    _set(job_id, status="processing")
    try:
        job_output_dir = OUTPUT_DIR / job_id

        def on_progress(stage: str) -> None:
            _set(job_id, stage=stage)

        report_path = run_pipeline(
            audio_path,
            whisper_model=whisper_model,
            claude_model=claude_model,
            output_dir=str(job_output_dir),
            on_progress=on_progress,
        )

        import json

        report_markdown = Path(report_path).read_text()
        stem = Path(audio_path).stem
        sentences_path = job_output_dir / f"{stem}_sentences.json"
        sentences = json.loads(sentences_path.read_text()) if sentences_path.exists() else None

        _set(
            job_id,
            status="done",
            stage="done",
            result={"report_markdown": report_markdown, "sentences": sentences},
        )
    except Exception as e:
        _set(job_id, status="error", error=f"{type(e).__name__}: {e}", traceback=traceback.format_exc())


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None
