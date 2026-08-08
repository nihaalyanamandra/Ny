"""Stage 7: end-to-end orchestration. Takes a single audio file and produces
a markdown delivery-feedback report in output/.

Usage:
    python -m src.pipeline path/to/audio.wav [options]

Requires ANTHROPIC_API_KEY in the environment (or a .env file) for the
final synthesis step; everything before that runs fully offline.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv

from src.acoustic_features import extract_acoustic_features, save_features
from src.pause_detection import detect_and_classify_pauses, save_pauses
from src.segment import (
    DEFAULT_ENERGY_DROP_THRESHOLD_DB,
    DEFAULT_PITCH_DROP_THRESHOLD_PCT,
    build_sentences,
    save_sentences,
)
from src.synthesize import DEFAULT_MODEL, build_metrics_summary, save_report, synthesize_report
from src.transcribe import save_transcript, transcribe_audio


def run_pipeline(
    audio_path: str,
    whisper_model: str = "base",
    language: str | None = None,
    min_pause_ms: int = 300,
    vad_aggressiveness: int = 2,
    energy_threshold_db: float = DEFAULT_ENERGY_DROP_THRESHOLD_DB,
    pitch_threshold_pct: float = DEFAULT_PITCH_DROP_THRESHOLD_PCT,
    claude_model: str = DEFAULT_MODEL,
    keep_intermediate: bool = True,
    output_dir: str = "output",
) -> str:
    """Runs all stages and returns the path to the final markdown report."""
    stem = Path(audio_path).stem
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    print(f"[1/5] Transcribing ({whisper_model})...")
    transcript = transcribe_audio(audio_path, model_size=whisper_model, language=language)
    if keep_intermediate:
        save_transcript(transcript, str(out / f"{stem}_transcript.json"))

    print("[2/5] Extracting per-segment acoustic features...")
    acoustic_segments = extract_acoustic_features(
        audio_path,
        [{"id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"]} for s in transcript["segments"]],
    )
    if keep_intermediate:
        save_features(acoustic_segments, str(out / f"{stem}_acoustic_features.json"))

    print("[3/5] Detecting and classifying pauses...")
    pauses = detect_and_classify_pauses(
        audio_path,
        transcript=transcript,
        min_pause_ms=min_pause_ms,
        aggressiveness=vad_aggressiveness,
    )
    if keep_intermediate:
        save_pauses(pauses, str(out / f"{stem}_pauses.json"))

    print("[4/5] Segmenting into sentences and scoring trailing-off...")
    sentences = build_sentences(
        audio_path,
        transcript,
        pauses=pauses,
        energy_threshold_db=energy_threshold_db,
        pitch_threshold_pct=pitch_threshold_pct,
    )
    if keep_intermediate:
        save_sentences(sentences, str(out / f"{stem}_sentences.json"))

    print(f"[5/5] Synthesizing feedback report ({claude_model})...")
    metrics_summary = build_metrics_summary(transcript, sentences, pauses, acoustic_segments)
    report = synthesize_report(metrics_summary, model=claude_model)
    report_path = str(out / f"{stem}_report.md")
    save_report(report, report_path)

    print(f"Done. Report: {report_path}")
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
    parser.add_argument("--claude-model", default=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL))
    parser.add_argument("--no-intermediate", action="store_true", help="Don't write intermediate stage JSON files to output/")
    parser.add_argument("--output-dir", default="output")
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
        claude_model=args.claude_model,
        keep_intermediate=not args.no_intermediate,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()
