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

Resource notes:
- CPU-only Whisper `base` transcription runs a few times faster than
  real-time; budget accordingly for concurrent jobs (this is single-process
  in-memory, so jobs run sequentially per instance, not in parallel, unless
  you scale to multiple instances -- which the in-memory job store doesn't
  support, see `app/jobs.py`).
- Uploaded audio and per-job output accumulate in `backend_uploads/` and
  `backend_output/` on the container's disk with no automatic cleanup yet
  -- fine for occasional personal use, but add a cleanup job or persistent
  volume policy before leaving this running unattended for a long time.
- Diarization (`src/diarize.py`) is NOT wired into this API yet -- it needs
  its own separate environment (see the root README) and currently only
  runs as a standalone script.
