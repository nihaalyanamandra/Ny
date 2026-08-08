"""Speaker diarization via pyannote.audio.

IMPORTANT: this must be run from the SEPARATE .venv-diarize environment
(see requirements-diarization.txt), not the core pipeline's venv --
pyannote's dependencies aren't installable alongside the core env's
numpy<2 pin. This module has no other dependency on the rest of src/, so
it works standalone from that separate venv.

Usage (from .venv-diarize):
    python -m src.diarize audio.wav --hf-token hf_... [--output out.json]

Or set HF_TOKEN as an environment variable instead of --hf-token.

Output is a list of speaker turns: [{"start", "end", "speaker"}, ...],
with pyannote's raw generic labels (SPEAKER_00, SPEAKER_01, ...) plus a
best-guess "candidate" label based on total speaking time -- in a
practice-interview recording the candidate usually talks more in total
than the interviewer (longer answers vs. shorter questions), but this is
a heuristic, not a guarantee. Check `speaking_time_by_speaker` in the
output and override with --candidate-speaker if it guessed wrong.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any


def diarize(audio_path: str, hf_token: str) -> list[dict[str, Any]]:
    from pyannote.audio import Pipeline

    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=hf_token)
    diarization = pipeline(audio_path)

    turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        turns.append({"start": round(turn.start, 3), "end": round(turn.end, 3), "speaker": speaker})
    return turns


def speaking_time_by_speaker(turns: list[dict[str, Any]]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for t in turns:
        totals[t["speaker"]] += t["end"] - t["start"]
    return {k: round(v, 1) for k, v in totals.items()}


def guess_candidate_speaker(turns: list[dict[str, Any]]) -> str | None:
    totals = speaking_time_by_speaker(turns)
    if not totals:
        return None
    return max(totals, key=totals.get)


def save_turns(turns: list[dict[str, Any]], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(turns, f, indent=2)


def _default_output_path(audio_path: str) -> str:
    stem = Path(audio_path).stem
    return str(Path("output") / f"{stem}_diarization.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Diarize audio into speaker turns via pyannote.audio.")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--hf-token", default=os.environ.get("HF_TOKEN"), help="Hugging Face token with access to pyannote/speaker-diarization-3.1. Default: HF_TOKEN env var")
    parser.add_argument("--output", default=None, help="Output JSON path. Default: output/<audio-stem>_diarization.json")
    args = parser.parse_args()

    if not args.hf_token:
        raise SystemExit("No Hugging Face token: pass --hf-token or set HF_TOKEN")

    turns = diarize(args.audio_path, args.hf_token)
    output_path = args.output or _default_output_path(args.audio_path)
    save_turns(turns, output_path)

    totals = speaking_time_by_speaker(turns)
    guess = guess_candidate_speaker(turns)
    print(f"Found {len(totals)} speakers, {len(turns)} turns")
    for speaker, seconds in sorted(totals.items(), key=lambda kv: -kv[1]):
        marker = " <- guessed candidate (most speaking time)" if speaker == guess else ""
        print(f"  {speaker}: {seconds:.1f}s total{marker}")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
