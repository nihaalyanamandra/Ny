"""Stage 4: VAD-based pause/silence detection, with hesitation vs.
natural-breathing classification.

Usage:
    python -m src.pause_detection audio.wav [--transcript transcript.json]
        [--min-pause-ms 300] [--output out.json]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import webrtcvad

from src.audio_io import ensure_wav

VAD_SAMPLE_RATE = 16000  # webrtcvad only accepts 8000/16000/32000/48000 Hz
VAD_FRAME_MS = 30  # webrtcvad only accepts 10/20/30 ms frames

# Pause classification deliberately does NOT match a pause's end time
# against a sentence's start time with a tight tolerance: in practice
# Whisper's word-level timestamps (derived from cross-attention, not a
# forced aligner) can be off by several hundred ms from what VAD detects as
# the true acoustic onset of speech -- e.g. in local testing Whisper placed
# a segment's first word ~450ms before the audio was actually not-silent
# per VAD. A tight-tolerance boundary match would misclassify that as "not
# a leading pause" even though it clearly is.
#
# Instead we classify by containment, which only relies on each timestamp
# source being internally consistent with itself:
#   - "leading_hesitation": pause starts at/near the very beginning of the
#     recording (dead air before the speaker starts responding at all)
#   - "mid_sentence_breath": pause falls strictly between two consecutive
#     words of the same Whisper segment (a natural breath/articulation gap)
#   - "trailing_silence": pause starts at/after the last transcribed word
#     (silence after the recording's final utterance)
#   - "pre_sentence_hesitation": everything else -- a gap between utterances,
#     i.e. the speaker paused before continuing to their next thought
RECORDING_EDGE_TOLERANCE_S = 0.1


def _frame_generator(pcm: bytes, sample_rate: int, frame_ms: int):
    frame_bytes = int(sample_rate * (frame_ms / 1000.0) * 2)  # 2 bytes/sample (int16)
    offset = 0
    timestamp = 0.0
    duration = frame_ms / 1000.0
    while offset + frame_bytes <= len(pcm):
        yield pcm[offset : offset + frame_bytes], timestamp
        timestamp += duration
        offset += frame_bytes


def _load_pcm16(audio_path: str, sample_rate: int = VAD_SAMPLE_RATE) -> bytes:
    y, _ = librosa.load(ensure_wav(audio_path), sr=sample_rate, mono=True)
    y = np.clip(y, -1.0, 1.0)
    pcm16 = (y * 32767).astype(np.int16)
    return pcm16.tobytes()


def detect_pauses(
    audio_path: str,
    min_pause_ms: int = 300,
    aggressiveness: int = 2,
) -> list[dict[str, Any]]:
    """Detect silence gaps >= min_pause_ms. Returns a list of
    {"start": float, "end": float, "duration_ms": float} sorted by start time.

    `aggressiveness` is webrtcvad's 0-3 filter aggressiveness (higher = more
    speech gets classified as non-speech). 2 is a reasonable middle ground
    for clean single-speaker recordings.
    """
    vad = webrtcvad.Vad(aggressiveness)
    pcm = _load_pcm16(audio_path)

    frame_flags = []  # (timestamp, is_speech)
    for frame, ts in _frame_generator(pcm, VAD_SAMPLE_RATE, VAD_FRAME_MS):
        is_speech = vad.is_speech(frame, VAD_SAMPLE_RATE)
        frame_flags.append((ts, is_speech))

    pauses = []
    gap_start = None
    frame_dur = VAD_FRAME_MS / 1000.0
    for ts, is_speech in frame_flags:
        if not is_speech:
            if gap_start is None:
                gap_start = ts
        else:
            if gap_start is not None:
                gap_end = ts
                duration_ms = (gap_end - gap_start) * 1000.0
                if duration_ms >= min_pause_ms:
                    pauses.append({"start": round(gap_start, 3), "end": round(gap_end, 3), "duration_ms": round(duration_ms, 1)})
                gap_start = None
    # trailing gap at end of file
    if gap_start is not None:
        gap_end = frame_flags[-1][0] + frame_dur if frame_flags else gap_start
        duration_ms = (gap_end - gap_start) * 1000.0
        if duration_ms >= min_pause_ms:
            pauses.append({"start": round(gap_start, 3), "end": round(gap_end, 3), "duration_ms": round(duration_ms, 1)})

    return pauses


def _recording_word_bounds(transcript: dict[str, Any]) -> tuple[float | None, float | None]:
    """Returns (first word start, last word end) across the whole transcript."""
    segments = transcript.get("segments", [])
    first_word_start = segments[0]["start"] if segments else None
    last_word_end = segments[-1]["end"] if segments else None
    return first_word_start, last_word_end


def classify_pauses(pauses: list[dict[str, Any]], transcript: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Adds a "type" field to each pause. See the containment-based
    classification rationale in the module-level comment above
    RECORDING_EDGE_TOLERANCE_S. Types: "leading_hesitation",
    "mid_sentence_breath", "trailing_silence", "pre_sentence_hesitation",
    or "unclassified" if no transcript was provided.
    """
    if transcript is None:
        for p in pauses:
            p["type"] = "unclassified"
        return pauses

    first_word_start, last_word_end = _recording_word_bounds(transcript)

    # Build a flat list of (word_start, word_end) across all segments to
    # detect "inside a sentence" gaps.
    word_spans = []
    for seg in transcript.get("segments", []):
        words = seg.get("words") or []
        for w in words:
            word_spans.append((w["start"], w["end"]))

    for p in pauses:
        p_start, p_end = p["start"], p["end"]

        if p_start <= RECORDING_EDGE_TOLERANCE_S:
            p["type"] = "leading_hesitation"
            continue

        is_mid_sentence = any(ws < p_start and p_end < we for ws, we in _consecutive_gaps(word_spans))
        if is_mid_sentence:
            p["type"] = "mid_sentence_breath"
            continue

        if last_word_end is not None and p_start >= last_word_end - RECORDING_EDGE_TOLERANCE_S:
            p["type"] = "trailing_silence"
            continue

        p["type"] = "pre_sentence_hesitation"

    return pauses


def _consecutive_gaps(word_spans: list[tuple[float, float]]):
    """Yields (prev_word_end, next_word_start) for consecutive word pairs,
    used to test whether a pause falls strictly between two words of
    (implicitly) the same utterance."""
    for i in range(len(word_spans) - 1):
        yield word_spans[i][1], word_spans[i + 1][0]


def detect_and_classify_pauses(
    audio_path: str,
    transcript: dict[str, Any] | None = None,
    min_pause_ms: int = 300,
    aggressiveness: int = 2,
) -> list[dict[str, Any]]:
    pauses = detect_pauses(audio_path, min_pause_ms=min_pause_ms, aggressiveness=aggressiveness)
    return classify_pauses(pauses, transcript)


def save_pauses(pauses: list[dict[str, Any]], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(pauses, f, indent=2)


def _default_output_path(audio_path: str) -> str:
    stem = Path(audio_path).stem
    return str(Path("output") / f"{stem}_pauses.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect and classify pauses/silences in audio.")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--transcript", default=None, help="Path to a Whisper transcript JSON (for hesitation classification)")
    parser.add_argument("--min-pause-ms", type=int, default=300, help="Minimum gap duration to count as a pause. Default: 300ms")
    parser.add_argument("--aggressiveness", type=int, default=2, choices=[0, 1, 2, 3], help="webrtcvad aggressiveness (0-3). Default: 2")
    parser.add_argument("--output", default=None, help="Output JSON path. Default: output/<audio-stem>_pauses.json")
    args = parser.parse_args()

    output_path = args.output or _default_output_path(args.audio_path)

    transcript = None
    if args.transcript:
        with open(args.transcript) as f:
            transcript = json.load(f)

    pauses = detect_and_classify_pauses(
        args.audio_path,
        transcript=transcript,
        min_pause_ms=args.min_pause_ms,
        aggressiveness=args.aggressiveness,
    )
    save_pauses(pauses, output_path)

    print(f"Detected {len(pauses)} pauses >= {args.min_pause_ms}ms")
    for p in pauses:
        print(f"  [{p['start']:.2f}s - {p['end']:.2f}s] {p['duration_ms']:.0f}ms  {p['type']}")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
