# Backend API

FastAPI wrapper around the pipeline (`src/pipeline.py`). Accepts an audio
upload, runs the full pipeline in a background thread, and lets the
frontend poll for progress/results. See `app/jobs.py` for why this is a
plain in-memory job store rather than a real queue (personal-tool scale).

## Run locally

From the repo root, using the CORE pipeline venv (not `.venv-diarize`):

```
source .venv/bin/activate
pip install -r backend/requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
uvicorn backend.app.main:app --reload --port 8000
```

Then `POST /jobs` (multipart, field `file`, optional `whisper_model` /
`claude_model` form fields) and poll `GET /jobs/{job_id}`.

## Deploy

Any host that runs a long-lived Docker container works -- this needs a
real server, not a serverless function (see the root README for why).
Railway, Fly.io, Render, or your own VM are all fine; there's nothing
platform-specific in the Dockerfile.

```
docker build -f backend/Dockerfile -t speech-analytics-backend .
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... speech-analytics-backend
```

Set these environment variables on whatever host you use:
- `ANTHROPIC_API_KEY` (required)
- `FRONTEND_ORIGIN` -- your deployed Vercel URL (e.g.
  `https://your-app.vercel.app`), so CORS only allows your frontend.
  Defaults to `*` (any origin) for local dev; lock this down for a real
  deployment.
- `RATE_LIMIT` -- this is a public, no-login tool, so cost is bounded by a
  per-IP limit on job submission instead of per-account quotas. A slowapi
  limit string (e.g. `3/day`, `10/hour`); defaults to `3/day`.
- `JOB_TTL_DAYS` -- how long a completed job (and its shareable
  `/results/{job_id}` link) stays retrievable before an hourly sweep
  deletes it. Defaults to `30`.

Resource notes:
- Whisper transcription specifically is serialized process-wide behind a
  lock (see `src/transcribe.py`) -- openai-whisper's word-timestamp
  alignment code isn't thread-safe and crashes intermittently if two
  transcriptions run at once in the same process (found and fixed by
  testing concurrent requests, not theoretical). Everything else (Praat
  analysis, VAD, the Claude calls) still runs concurrently across jobs;
  transcription is just a one-at-a-time bottleneck within a single
  instance. Scale to multiple instances if that bottleneck matters at your
  traffic level -- which the in-memory job store doesn't support as-is,
  see `app/jobs.py`.
- The uploaded audio file is deleted as soon as its job finishes (success
  or failure) -- see `app/jobs.py`'s module docstring for why, given this
  is a public tool with no accounts. Per-job output (the report) persists
  for `JOB_TTL_DAYS` and is swept automatically after that.
- Diarization (`src/diarize.py`) is NOT wired into this API yet -- it needs
  its own separate environment (see the root README) and currently only
  runs as a standalone script.
