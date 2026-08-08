"""Stage 5: combine Whisper's word-level timestamps into sentence-level
segments, then compute per-sentence speaking rate and a "trailing-off"
score (energy + pitch decay in the final third of a sentence vs. the
first two-thirds).

Usage:
    python -m src.segment audio.wav --transcript transcript.json
        [--pauses pauses.json] [--output out.json]
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import parselmouth

from src.acoustic_features import extract_segment_features

SENTENCE_END_RE = re.compile(r"[.!?]+$")

# A sentence needs enough duration for "first two-thirds" and "final third"
# to each contain multiple pitch/intensity frames; below this, a third of
# the sentence is only a few tens of ms and the acoustic estimate is noise,
# not signal. ~1.2s total (0.4s final third) is a reasonable floor given
# Praat's default analysis window sizes for these measures.
MIN_DURATION_FOR_TRAILING_OFF_S = 1.2

# Trailing-off thresholds. Natural declarative English already has a mild
# pitch declination and loudness taper toward the end of a sentence, so the
# thresholds need to sit above that baseline rather than fire on any dip.
#   - Energy: human hearing perceives roughly 3 dB as the smallest clearly
#     noticeable loudness change (~a halving of perceived loudness happens
#     around 10 dB, but 3 dB is already a "did that get quieter?" level).
#     A drop bigger than that within one sentence, on top of normal
#     sentence-final tapering, is worth flagging.
#   - Pitch: normal declarative declination is commonly cited around 5-10%
#     F0 drop end-to-end. We use 15% as "beyond normal" -- enough headroom
#     to not flag every sentence, but well below the 30-40%+ drops that
#     show up when someone's energy/confidence visibly fades.
# Both are configurable since "normal" varies by speaker; these are
# starting points to tune against your own recordings.
DEFAULT_ENERGY_DROP_THRESHOLD_DB = 3.0
DEFAULT_PITCH_DROP_THRESHOLD_PCT = 15.0


def words_to_sentences(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flattens Whisper segments' words and regroups them into sentences on
    terminal punctuation (. ! ?). Falls back to Whisper's own segment
    boundary if a segment ends without terminal punctuation (Whisper
    sometimes omits it, e.g. on a trailing filler word)."""
    all_words = []
    for seg in segments:
        for w in seg.get("words", []):
            all_words.append(w)

    sentences = []
    current: list[dict[str, Any]] = []
    for i, w in enumerate(all_words):
        current.append(w)
        is_last_word = i == len(all_words) - 1
        if SENTENCE_END_RE.search(w["word"]) or is_last_word:
            sentences.append(current)
            current = []

    result = []
    for i, words in enumerate(sentences):
        text = " ".join(w["word"] for w in words)
        result.append(
            {
                "id": i,
                "start": words[0]["start"],
                "end": words[-1]["end"],
                "text": text,
                "words": words,
            }
        )
    return result


def _speaking_rate(sentence: dict[str, Any]) -> dict[str, Any]:
    word_count = len(sentence["words"])
    duration_sec = sentence["end"] - sentence["start"]
    wpm = (word_count / duration_sec) * 60.0 if duration_sec > 0 else None
    return {
        "word_count": word_count,
        "duration_sec": round(duration_sec, 3),
        "wpm": round(wpm, 1) if wpm is not None else None,
    }


def _trailing_off_score(
    sound: parselmouth.Sound,
    sentence: dict[str, Any],
    energy_threshold_db: float,
    pitch_threshold_pct: float,
) -> dict[str, Any]:
    start, end = sentence["start"], sentence["end"]
    duration = end - start

    if duration < MIN_DURATION_FOR_TRAILING_OFF_S:
        return {
            "computed": False,
            "reason": f"sentence too short ({duration:.2f}s < {MIN_DURATION_FOR_TRAILING_OFF_S}s minimum)",
        }

    split_point = start + (duration * 2 / 3)
    first_part = extract_segment_features(sound, start, split_point)
    final_part = extract_segment_features(sound, split_point, end)

    result: dict[str, Any] = {
        "computed": True,
        "split_time": round(split_point, 3),
        "first_two_thirds": {
            "pitch_mean_hz": first_part["pitch_mean_hz"],
            "intensity_mean_db": first_part["intensity_mean_db"],
        },
        "final_third": {
            "pitch_mean_hz": final_part["pitch_mean_hz"],
            "intensity_mean_db": final_part["intensity_mean_db"],
        },
        "energy_drop_db": None,
        "pitch_drop_pct": None,
        "trailing_off": False,
    }

    if first_part["intensity_mean_db"] is not None and final_part["intensity_mean_db"] is not None:
        result["energy_drop_db"] = round(first_part["intensity_mean_db"] - final_part["intensity_mean_db"], 2)

    if first_part["pitch_mean_hz"] and final_part["pitch_mean_hz"]:
        drop_pct = (first_part["pitch_mean_hz"] - final_part["pitch_mean_hz"]) / first_part["pitch_mean_hz"] * 100
        result["pitch_drop_pct"] = round(drop_pct, 1)

    energy_drop = result["energy_drop_db"]
    pitch_drop = result["pitch_drop_pct"]
    if energy_drop is not None and pitch_drop is not None:
        result["trailing_off"] = energy_drop > energy_threshold_db and pitch_drop > pitch_threshold_pct

    return result


def _nearest_preceding_pause(sentence: dict[str, Any], pauses: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """The pause immediately before this sentence.

    Matches by pause *start* < sentence start, not pause *end*: VAD and
    Whisper's word timestamps can disagree by several hundred ms on exactly
    where speech resumes (see the rationale in pause_detection.py), so a
    genuine preceding pause can end slightly after the sentence's nominal
    Whisper start time. Its start time is still reliably before the
    sentence, and pauses/sentences are both chronologically ordered, so the
    closest-preceding-by-start pause is the correct match.
    """
    if not pauses:
        return None
    candidates = [p for p in pauses if p["start"] < sentence["start"]]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p["start"])


def build_sentences(
    audio_path: str,
    transcript: dict[str, Any],
    pauses: list[dict[str, Any]] | None = None,
    energy_threshold_db: float = DEFAULT_ENERGY_DROP_THRESHOLD_DB,
    pitch_threshold_pct: float = DEFAULT_PITCH_DROP_THRESHOLD_PCT,
) -> list[dict[str, Any]]:
    sound = parselmouth.Sound(audio_path)
    sentences = words_to_sentences(transcript["segments"])

    output = []
    for sentence in sentences:
        rate = _speaking_rate(sentence)
        trailing_off = _trailing_off_score(sound, sentence, energy_threshold_db, pitch_threshold_pct)
        pause_before = _nearest_preceding_pause(sentence, pauses)

        output.append(
            {
                "id": sentence["id"],
                "start": sentence["start"],
                "end": sentence["end"],
                "text": sentence["text"],
                **rate,
                "trailing_off": trailing_off,
                "pause_before": (
                    {"duration_ms": pause_before["duration_ms"], "type": pause_before["type"]}
                    if pause_before
                    else None
                ),
            }
        )
    return output


def save_sentences(sentences: list[dict[str, Any]], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(sentences, f, indent=2)


def _default_output_path(audio_path: str) -> str:
    stem = Path(audio_path).stem
    return str(Path("output") / f"{stem}_sentences.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Segment transcript into sentences with speaking rate and trailing-off scores.")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--transcript", required=True, help="Path to Whisper transcript JSON")
    parser.add_argument("--pauses", default=None, help="Path to pauses JSON (from src.pause_detection), to attach pause-before-sentence info")
    parser.add_argument("--energy-threshold-db", type=float, default=DEFAULT_ENERGY_DROP_THRESHOLD_DB)
    parser.add_argument("--pitch-threshold-pct", type=float, default=DEFAULT_PITCH_DROP_THRESHOLD_PCT)
    parser.add_argument("--output", default=None, help="Output JSON path. Default: output/<audio-stem>_sentences.json")
    args = parser.parse_args()

    output_path = args.output or _default_output_path(args.audio_path)

    with open(args.transcript) as f:
        transcript = json.load(f)

    pauses = None
    if args.pauses:
        with open(args.pauses) as f:
            pauses = json.load(f)

    sentences = build_sentences(
        args.audio_path,
        transcript,
        pauses=pauses,
        energy_threshold_db=args.energy_threshold_db,
        pitch_threshold_pct=args.pitch_threshold_pct,
    )
    save_sentences(sentences, output_path)

    print(f"Segmented into {len(sentences)} sentences")
    for s in sentences:
        flag = " [TRAILING OFF]" if s["trailing_off"].get("trailing_off") else ""
        print(f"  [{s['start']:.2f}-{s['end']:.2f}] {s['wpm']} wpm{flag}  {s['text']}")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
