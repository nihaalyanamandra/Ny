"""Stage 7: end-to-end orchestration. Takes a single audio file and produces
a markdown (+ optionally structured JSON) delivery-feedback report in
output/.

Usage:
    python -m src.pipeline path/to/audio.wav [options]
    python -m src.pipeline path/to/audio.wav --diarize --hf-token hf_...

Requires ANTHROPIC_API_KEY in the environment (or a .env file) for the
synthesis/content-alignment steps; everything before that runs fully
offline.

Diarization (--diarize) is optional and off by default, matching the
original design: skip it for single-speaker practice recordings, turn it
on for a real interview recording where you want per-answer content
alignment. It needs a Hugging Face token and a SEPARATE venv (see
requirements-diarization.txt / src/diarize.py) -- pyannote's dependencies
conflict with this pipeline's numpy<2 pin, so it can't be imported
directly here and is invoked as a subprocess against that other venv's
python interpreter instead. It's also slow on CPU (many minutes even on a
short recording) -- budget accordingly.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv

from src.acoustic_features import extract_acoustic_features, save_features
from src.content_alignment import build_content_alignment, save_alignment
from src.nervous_energy import build_nervous_energy, save_nervous_energy
from src.pause_detection import detect_and_classify_pauses, save_pauses
from src.segment import (
    DEFAULT_ENERGY_DROP_THRESHOLD_DB,
    DEFAULT_PITCH_DROP_THRESHOLD_PCT,
    MAX_SENTENCE_DURATION_S,
    SENTENCE_PAUSE_BOUNDARY_S,
    build_sentences,
    save_sentences,
)
from src.synthesize import DEFAULT_MODEL, save_report, synthesize_full_report
from src.transcribe import save_transcript, transcribe_audio

REPO_ROOT = Path(__file__).resolve().parent.parent
DIARIZE_VENV_PYTHON = REPO_ROOT / ".venv-diarize" / "bin" / "python"


def run_diarization(audio_path: str, hf_token: str, output_path: str) -> list[dict[str, Any]]:
    """Runs src/diarize.py as a subprocess in the separate .venv-diarize
    environment (see that module's docstring for why it can't be imported
    directly here) and returns the resulting speaker turns."""
    if not DIARIZE_VENV_PYTHON.exists():
        raise RuntimeError(
            f"Diarization venv not found at {DIARIZE_VENV_PYTHON}. "
            "Set it up per requirements-diarization.txt before using --diarize."
        )

    subprocess.run(
        [str(DIARIZE_VENV_PYTHON), "-m", "src.diarize", audio_path, "--hf-token", hf_token, "--output", output_path],
        cwd=str(REPO_ROOT),
        check=True,
    )
    with open(output_path) as f:
        return json.load(f)


def run_pipeline(
    audio_path: str,
    whisper_model: str = "base",
    language: str | None = None,
    min_pause_ms: int = 300,
    vad_aggressiveness: int = 2,
    energy_threshold_db: float = DEFAULT_ENERGY_DROP_THRESHOLD_DB,
    pitch_threshold_pct: float = DEFAULT_PITCH_DROP_THRESHOLD_PCT,
    sentence_pause_boundary_s: float = SENTENCE_PAUSE_BOUNDARY_S,
    max_sentence_duration_s: float = MAX_SENTENCE_DURATION_S,
    claude_model: str = DEFAULT_MODEL,
    keep_intermediate: bool = True,
    output_dir: str = "output",
    diarize: bool = False,
    hf_token: str | None = None,
    candidate_speaker: str | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> str:
    """Runs all stages and returns the path to the final markdown report.

    `on_progress`, if given, is called with a short stage-name string at
    the start of each stage -- used by the backend API to report progress
    to the frontend while a job runs. The CLI just prints instead.
    """
    def report(stage: str) -> None:
        print(stage)
        if on_progress:
            on_progress(stage)

    stem = Path(audio_path).stem
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    n_stages = 7 if diarize else 5

    report(f"[1/{n_stages}] Transcribing ({whisper_model})...")
    transcript = transcribe_audio(audio_path, model_size=whisper_model, language=language)
    if keep_intermediate:
        save_transcript(transcript, str(out / f"{stem}_transcript.json"))

    report(f"[2/{n_stages}] Extracting per-segment acoustic features...")
    acoustic_segments = extract_acoustic_features(
        audio_path,
        [{"id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"]} for s in transcript["segments"]],
    )
    if keep_intermediate:
        save_features(acoustic_segments, str(out / f"{stem}_acoustic_features.json"))

    report(f"[3/{n_stages}] Detecting and classifying pauses...")
    pauses = detect_and_classify_pauses(
        audio_path,
        transcript=transcript,
        min_pause_ms=min_pause_ms,
        aggressiveness=vad_aggressiveness,
    )
    if keep_intermediate:
        save_pauses(pauses, str(out / f"{stem}_pauses.json"))

    report(f"[4/{n_stages}] Segmenting into sentences and scoring trailing-off/confidence...")
    sentences = build_sentences(
        audio_path,
        transcript,
        pauses=pauses,
        energy_threshold_db=energy_threshold_db,
        pitch_threshold_pct=pitch_threshold_pct,
        sentence_pause_boundary_s=sentence_pause_boundary_s,
        max_sentence_duration_s=max_sentence_duration_s,
    )
    if keep_intermediate:
        save_sentences(sentences, str(out / f"{stem}_sentences.json"))

    report(f"[5/{n_stages}] Scoring nervous energy...")
    nervous_energy = build_nervous_energy(audio_path, transcript, sentences, pauses)
    if keep_intermediate:
        save_nervous_energy(nervous_energy, str(out / f"{stem}_nervous_energy.json"))

    content_alignment = None
    if diarize:
        if not hf_token:
            raise ValueError("--diarize requires a Hugging Face token (--hf-token or HF_TOKEN env var)")

        report(f"[6/{n_stages}] Diarizing speakers (separate venv, can take a while on CPU)...")
        diarization_turns = run_diarization(audio_path, hf_token, str(out / f"{stem}_diarization.json"))

        report(f"[7/{n_stages}] Assessing content alignment ({claude_model})...")
        content_alignment = build_content_alignment(
            transcript,
            diarization_turns,
            candidate_speaker=candidate_speaker,
            model=claude_model,
        )
        if keep_intermediate:
            save_alignment(content_alignment, str(out / f"{stem}_content_alignment.json"))

    report(f"Synthesizing feedback report ({claude_model})...")
    result = synthesize_full_report(
        transcript,
        sentences,
        pauses,
        acoustic_segments=acoustic_segments,
        content_alignment=content_alignment,
        nervous_energy=nervous_energy,
        model=claude_model,
    )
    report_path = str(out / f"{stem}_report.md")
    save_report(result["markdown"], report_path)
    if result["structured"] is not None:
        with open(out / f"{stem}_report.json", "w") as f:
            json.dump(result["structured"], f, indent=2)

    report(f"Done. Report: {report_path}")
    return report_path


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Run the full speech delivery analytics pipeline on one audio file.")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--whisper-model", default="base", help="Whisper model size. Default: base")
    parser.add_argument("--language", default=None, help="Force a language code (e.g. 'en'). Default: auto-detect")
    parser.add_argument("--min-pause-ms", type=int, default=300, help="Minimum silence duration to count as a pause. Default: 300ms")
    parser.add_argument("--vad-aggressiveness", type=int, default=2, choices=[0, 1, 2, 3])
    parser.add_argument("--energy-threshold-db", type=float, default=DEFAULT_ENERGY_DROP_THRESHOLD_DB)
    parser.add_argument("--pitch-threshold-pct", type=float, default=DEFAULT_PITCH_DROP_THRESHOLD_PCT)
    parser.add_argument("--sentence-pause-boundary-s", type=float, default=SENTENCE_PAUSE_BOUNDARY_S)
    parser.add_argument("--max-sentence-duration-s", type=float, default=MAX_SENTENCE_DURATION_S)
    parser.add_argument("--claude-model", default=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL))
    parser.add_argument("--no-intermediate", action="store_true", help="Don't write intermediate stage JSON files to output/")
    parser.add_argument("--output-dir", default="output")
    parser.add_argument("--diarize", action="store_true", help="Run speaker diarization + content alignment (multi-speaker recordings only; needs a separate venv, see requirements-diarization.txt)")
    parser.add_argument("--hf-token", default=os.environ.get("HF_TOKEN"), help="Hugging Face token for diarization. Default: HF_TOKEN env var")
    parser.add_argument("--candidate-speaker", default=None, help="Override the auto-guessed candidate speaker label for diarization (e.g. SPEAKER_00)")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY is not set (env var or .env file)")

    run_pipeline(
        args.audio_path,
        whisper_model=args.whisper_model,
        language=args.language,
        min_pause_ms=args.min_pause_ms,
        vad_aggressiveness=args.vad_aggressiveness,
        energy_threshold_db=args.energy_threshold_db,
        pitch_threshold_pct=args.pitch_threshold_pct,
        sentence_pause_boundary_s=args.sentence_pause_boundary_s,
        max_sentence_duration_s=args.max_sentence_duration_s,
        claude_model=args.claude_model,
        keep_intermediate=not args.no_intermediate,
        output_dir=args.output_dir,
        diarize=args.diarize,
        hf_token=args.hf_token,
        candidate_speaker=args.candidate_speaker,
    )


if __name__ == "__main__":
    main()
