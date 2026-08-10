"""Stage 2: local Whisper transcription with word-level timestamps.

Usage:
    python -m src.transcribe path/to/audio.wav [--model base] [--language en] [--output out.json]
"""
from __future__ import annotations

import argparse
import json
import threading
from pathlib import Path
from typing import Any

import whisper

# openai-whisper's word_timestamps=True path (whisper/timing.py) registers
# PyTorch forward hooks that collect cross-attention outputs into a
# function-local list during DTW alignment. That mechanism is NOT
# thread-safe: two transcriptions running concurrently in the same process
# (e.g. two backend API jobs processed by different threads at once) race
# on that hook state and one of them crashes with a `TypeError: 'NoneType'
# object is not subscriptable` deep in whisper/timing.py -- reproduced
# directly with two threads calling transcribe_audio() on the same file at
# the same time, no API layer involved. Serializing transcription with this
# lock is the targeted fix: it's specifically Whisper's own alignment hooks
# that are unsafe, not the rest of the pipeline (Praat analysis, VAD, the
# Claude calls), so only this call needs to be process-wide single-flight.
_TRANSCRIBE_LOCK = threading.Lock()


def transcribe_audio(
    audio_path: str,
    model_size: str = "base",
    language: str | None = None,
) -> dict[str, Any]:
    """Run local Whisper on `audio_path` and return a transcript dict with
    word-level timestamps.

    Structure:
        {
          "audio_path": str,
          "model": str,
          "language": str,
          "duration_sec": float,
          "text": str,               # full transcript
          "segments": [
            {
              "id": int,
              "start": float,
              "end": float,
              "text": str,
              "words": [
                {"word": str, "start": float, "end": float, "probability": float},
                ...
              ],
            },
            ...
          ],
        }
    """
    model = whisper.load_model(model_size)
    with _TRANSCRIBE_LOCK:
        result = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
            verbose=False,
        )

    segments = []
    for seg in result["segments"]:
        words = [
            {
                "word": w["word"].strip(),
                "start": round(w["start"], 3),
                "end": round(w["end"], 3),
                "probability": round(w.get("probability", 0.0), 4),
            }
            for w in seg.get("words", [])
        ]
        segments.append(
            {
                "id": seg["id"],
                "start": round(seg["start"], 3),
                "end": round(seg["end"], 3),
                "text": seg["text"].strip(),
                "words": words,
            }
        )

    duration = segments[-1]["end"] if segments else 0.0

    return {
        "audio_path": str(audio_path),
        "model": model_size,
        "language": result.get("language"),
        "duration_sec": duration,
        "text": result["text"].strip(),
        "segments": segments,
    }


def save_transcript(transcript: dict[str, Any], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(transcript, f, indent=2)


def _default_output_path(audio_path: str) -> str:
    stem = Path(audio_path).stem
    return str(Path("output") / f"{stem}_transcript.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe audio with word-level timestamps using local Whisper.")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--model", default="base", help="Whisper model size (tiny/base/small/medium/large). Default: base")
    parser.add_argument("--language", default=None, help="Force a language code (e.g. 'en'). Default: auto-detect")
    parser.add_argument("--output", default=None, help="Output JSON path. Default: output/<audio-stem>_transcript.json")
    args = parser.parse_args()

    output_path = args.output or _default_output_path(args.audio_path)

    transcript = transcribe_audio(args.audio_path, model_size=args.model, language=args.language)
    save_transcript(transcript, output_path)

    print(f"Transcribed {len(transcript['segments'])} segments, {transcript['duration_sec']:.1f}s")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
