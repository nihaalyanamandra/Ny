"""In-memory job store + background execution of the pipeline.

A single audio recording takes minutes to process (Whisper transcription
alone is minutes on CPU), so the API can't do this synchronously within an
HTTP request/response cycle. Jobs run in a plain background thread and the
client polls for status -- simplest thing that works at personal-tool
scale. No persistence across process restarts and no multi-worker sharing
(a job started on worker A isn't visible to worker B) -- both fine for a
single-instance personal deployment; would need a real queue (e.g. Redis +
RQ/Celery) to scale beyond that, which is out of scope for what this is.

This is a public, no-login tool, which shapes two things done here:
  - The uploaded audio file is deleted as soon as its job finishes
    (success or failure) -- it's someone's personal recording and there's
    no account it's "theirs" to keep attached to.
  - Since there's no account to scope retention to, jobs (and their output
    directories) are purged automatically after JOB_TTL_DAYS so a report
    stays reachable via its shareable link for a while, then goes away
    rather than accumulating forever on disk.
"""
from __future__ import annotations

import json
import os
import shutil
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

JOB_TTL_SECONDS = float(os.environ.get("JOB_TTL_DAYS", "30")) * 86400
CLEANUP_INTERVAL_SECONDS = 3600  # sweep hourly

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
    finally:
        _delete_upload(audio_path)


def _delete_upload(audio_path: str) -> None:
    # Uploads live at UPLOADS_DIR/<upload_id>/recording.<ext> -- remove the
    # whole per-upload directory, not just the file.
    try:
        upload_dir = Path(audio_path).parent
        if upload_dir.is_relative_to(UPLOADS_DIR):
            shutil.rmtree(upload_dir, ignore_errors=True)
    except Exception:
        pass  # best-effort; a leftover temp file isn't worth failing the job over


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _cleanup_expired_jobs() -> None:
    cutoff = time.time() - JOB_TTL_SECONDS
    with _lock:
        expired = [jid for jid, job in _jobs.items() if job["created_at"] < cutoff]
        for jid in expired:
            del _jobs[jid]
    for jid in expired:
        shutil.rmtree(OUTPUT_DIR / jid, ignore_errors=True)


def _cleanup_loop() -> None:
    while True:
        time.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            _cleanup_expired_jobs()
        except Exception:
            pass  # a failed sweep shouldn't kill the loop; it'll retry next interval


_cleanup_thread_started = False


def start_cleanup_thread() -> None:
    global _cleanup_thread_started
    if _cleanup_thread_started:
        return
    _cleanup_thread_started = True
    threading.Thread(target=_cleanup_loop, daemon=True).start()
