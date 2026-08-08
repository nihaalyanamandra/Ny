# Ny — Speech Delivery Analytics

A personal pipeline for analyzing DELIVERY quality in practice audio
recordings (interview practice, mock interviews) — pacing, hesitation,
pitch variability, and energy/pitch "trailing off" toward the end of
sentences. Not a transcript-content analyzer; content is only used as
context for the feedback report.

## Pipeline stages

1. `src/transcribe.py` — local Whisper transcript with word-level timestamps
2. `src/acoustic_features.py` — per-segment pitch/intensity/jitter/shimmer via parselmouth
3. `src/pause_detection.py` — VAD-based silence/pause + hesitation detection
4. `src/segment.py` — sentence segmentation + trailing-off scoring
5. `src/synthesize.py` — Claude API turns raw metrics into readable feedback
6. `src/pipeline.py` — orchestrates all stages end-to-end

(Being built incrementally — see status below.)

## Setup

System dependency: **ffmpeg** must be on PATH (Whisper shells out to it).

```
brew install ffmpeg        # macOS
sudo apt-get install ffmpeg  # Ubuntu/Debian
```

Python environment:

```
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install "setuptools<81" wheel
pip install --no-build-isolation -r requirements.txt
```

(`setuptools<81` + `--no-build-isolation` works around openai-whisper's
setup.py still importing `pkg_resources`, which setuptools>=81 removed.
See comments in `requirements.txt` for details.)

Copy `.env.example` to `.env` and fill in your key:

```
cp .env.example .env
# edit .env: ANTHROPIC_API_KEY=sk-ant-...
```

### Diarization (optional, multi-speaker audio only)

Single-speaker practice recordings don't need this — skip it. If you have
multi-speaker audio, see `requirements-diarization.txt` for a **separate
venv** setup (pyannote.audio's dependencies conflict with the core env's
numpy pin).

## Status

- [x] Stage 1: venv + requirements.txt (verified installable together on Python 3.11)
- [ ] Stage 2: transcribe.py
- [ ] Stage 3: acoustic_features.py
- [ ] Stage 4: pause_detection.py
- [ ] Stage 5: segment.py
- [ ] Stage 6: synthesize.py
- [ ] Stage 7: pipeline.py
