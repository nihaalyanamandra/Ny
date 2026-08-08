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

Run the whole thing on one file:

```
python -m src.pipeline path/to/recording.wav
```

Outputs land in `output/`: the final `<stem>_report.md`, plus intermediate
`_transcript.json` / `_acoustic_features.json` / `_pauses.json` /
`_sentences.json` (drop `--no-intermediate` to skip those). Each stage is
also runnable standalone (`python -m src.transcribe ...`, etc.) — see each
file's `--help` for options.

### Design notes worth knowing before you tune thresholds

- **Trailing-off scoring** (`src/segment.py`) splits each sentence into its
  first two-thirds and final third by time, and flags `trailing_off: true`
  only when *both* energy (>3dB) and pitch (>15%) drop past threshold in
  the final third — normal English sentence-final intonation already tapers
  a bit, so both thresholds sit above that baseline. Sentences shorter than
  1.2s aren't scored (too little audio per third for a stable estimate).
  Both thresholds are CLI flags (`--energy-threshold-db`, `--pitch-threshold-pct`).
- **Intensity mean** is computed via Praat's energy-based averaging, not a
  plain mean of dB values — dB is a log scale, so naive averaging
  systematically underweights the loud frames. This mattered in testing:
  it flipped which "half" of a sentence looked louder.
- **Pause classification** (`src/pause_detection.py`) matches pauses to
  sentence boundaries by containment/ordering rather than tight timestamp
  alignment, because Whisper's word timestamps and webrtcvad's detected
  speech boundaries can disagree by several hundred ms on the same audio.
- Diarization (pyannote) is intentionally left out of the default pipeline
  — see the Setup section below.

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
- [x] Stage 2: transcribe.py
- [x] Stage 3: acoustic_features.py
- [x] Stage 4: pause_detection.py
- [x] Stage 5: segment.py
- [x] Stage 6: synthesize.py — **model ID in `DEFAULT_MODEL` is a guess, verify it against Anthropic's current model list** (override with `--model`/`--claude-model` or `ANTHROPIC_MODEL`)
- [x] Stage 7: pipeline.py

All stages were smoke-tested end-to-end on a synthetic recording (espeak-ng
TTS + engineered pauses/fades) in the dev sandbox — transcription, pitch/
intensity/jitter/shimmer extraction, pause classification, and trailing-off
scoring all ran and produced sane numbers; a couple of real bugs (a Praat
silence-floor artifact corrupting intensity stats, a naive dB-averaging
bug, and a pause-to-sentence attribution bug) were caught and fixed this
way. **Not yet tested**: the Stage 6/7 Claude API call itself (no
`ANTHROPIC_API_KEY` available in the sandbox) or any real human recording.
Please test both on your end before trusting the output.
