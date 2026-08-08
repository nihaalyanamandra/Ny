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

import numpy as np
import parselmouth

from src.acoustic_features import compute_pitch_instability, extract_segment_features
from src.audio_io import ensure_wav

SENTENCE_END_RE = re.compile(r"[.!?]+$")

# Splitting purely on terminal punctuation turned out to badly undercount
# sentence boundaries on real conversational/interview audio: in local
# testing on a 24-minute two-person interview recording, Whisper emitted
# terminal punctuation on only 2 of 3926 words, producing "sentences" up to
# ~20 minutes long -- useless for per-utterance trailing-off/WPM stats. So
# a sentence boundary is any of: terminal punctuation, OR a gap between
# consecutive words at least this long (a real pause, not just an
# articulation gap), OR hitting the max duration below (a hard cap so a
# long stretch of continuous fast talking without any real pause still
# gets chunked into something a trailing-off score can say something
# meaningful about).
SENTENCE_PAUSE_BOUNDARY_S = 0.6
MAX_SENTENCE_DURATION_S = 15.0

# Whisper's word-level timestamps come from a DTW alignment, not a forced
# aligner, and it occasionally produces a wildly wrong "end" for a single
# word -- e.g. in local testing on real conversational audio, one instance
# of "let's" got a 22-SECOND duration (spanning into an unrelated later
# utterance) where every neighboring word was ~0.2-0.5s. Left uncapped,
# that one bad timestamp corrupts the sentence's end boundary, WPM, and
# trailing-off window. No real spoken word takes this long even said
# slowly and deliberately, so any word "ending" further than this past its
# start is treated as a timestamp artifact and clipped.
MAX_SINGLE_WORD_DURATION_S = 3.0

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

# --- Composite confidence score ---
#
# A 1-10 per-sentence score combining four signals, each measured against
# THIS SPEAKER'S OWN session mean/spread, not a universal target -- your
# normal pace or vocal texture isn't a defect just because it differs from
# someone else's. Each sub-signal is converted to a z-score against the
# session's own distribution for that metric, then squashed to a 0-10
# subscore (see _worse_above_mean_subscore / _deviation_subscore below),
# and the composite is a weighted average of whichever sub-signals are
# actually available for that sentence (e.g. short sentences skip
# trailing-off, the very first sentence has no pause_before).
#
# Weights (starting points -- tune these for your own speaking style):
#   - Trailing-off magnitude: 0.30 -- the most direct within-sentence
#     signal that energy/confidence visibly faded before finishing.
#   - Pre-sentence hesitation: 0.30 -- an unusually long pause before
#     starting is a directly observable uncertainty marker, on par with
#     trailing-off as a signal.
#   - Mid-sentence pitch instability: 0.20 -- real but subtler than the
#     two above: erratic F0 swings during otherwise fluent delivery are
#     easily confounded with ordinary expressive prosody, so weighted
#     lower.
#   - Pacing deviation: 0.20 -- deviation from personal average pace in
#     EITHER direction (rushed or dragging). Weighted lowest of the four
#     since pace is affected by content difficulty as much as confidence
#     (a genuinely hard question can slow anyone down for reasons that
#     have nothing to do with nerves).
CONFIDENCE_WEIGHTS = {
    "trailing_off": 0.30,
    "hesitation": 0.30,
    "pitch_instability": 0.20,
    "pacing": 0.20,
}


def _mean_std(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 0.0
    mean = float(np.mean(values))
    std = float(np.std(values))
    return mean, std


def _zscore(value: float, mean: float, std: float) -> float:
    if std < 1e-9:
        return 0.0
    return (value - mean) / std


def _worse_above_mean_subscore(z: float) -> float:
    """For metrics where higher-than-your-own-average is worse (hesitation
    duration, trailing-off magnitude, pitch instability): z=0 (typical for
    you) maps to 7/10, each standard deviation worse subtracts 3 points,
    and being BELOW your own average is rewarded up toward 10 -- shorter
    hesitation, less trailing-off, or steadier pitch than your norm is a
    genuine positive, not just "different." Floored at 1 so one outlier
    sentence doesn't zero out."""
    return float(np.clip(7 - 3 * z, 1, 10))


def _deviation_subscore(abs_z: float) -> float:
    """For metrics where any deviation from your own average is worse in
    either direction (pacing): z=0 maps to 10/10, deviating either faster
    or slower than your norm subtracts 3 points per standard deviation."""
    return float(np.clip(10 - 3 * abs_z, 1, 10))


def words_to_sentences(
    segments: list[dict[str, Any]],
    pause_boundary_s: float = SENTENCE_PAUSE_BOUNDARY_S,
    max_duration_s: float = MAX_SENTENCE_DURATION_S,
) -> list[dict[str, Any]]:
    """Flattens Whisper segments' words and regroups them into sentence-like
    chunks. A chunk ends when the CURRENT word has terminal punctuation, OR
    the NEXT word starts after a gap >= pause_boundary_s, OR the chunk has
    already run for >= max_duration_s (see the rationale above
    SENTENCE_PAUSE_BOUNDARY_S)."""
    all_words = []
    for seg in segments:
        for w in seg.get("words", []):
            if w["end"] - w["start"] > MAX_SINGLE_WORD_DURATION_S:
                w = {**w, "end": w["start"] + MAX_SINGLE_WORD_DURATION_S}
            all_words.append(w)

    sentences = []
    current: list[dict[str, Any]] = []
    for i, w in enumerate(all_words):
        current.append(w)
        is_last_word = i == len(all_words) - 1

        ends_on_punctuation = bool(SENTENCE_END_RE.search(w["word"]))
        next_word_gap = (all_words[i + 1]["start"] - w["end"]) if not is_last_word else None
        ends_on_pause = next_word_gap is not None and next_word_gap >= pause_boundary_s
        ends_on_max_duration = (w["end"] - current[0]["start"]) >= max_duration_s

        if ends_on_punctuation or ends_on_pause or ends_on_max_duration or is_last_word:
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


def _trailing_off_magnitude(
    trailing_off: dict[str, Any],
    energy_threshold_db: float,
    pitch_threshold_pct: float,
) -> float | None:
    """Combines energy_drop_db and pitch_drop_pct into one continuous scalar
    for confidence scoring, in "threshold units" -- 1.0 means the drop is
    exactly at the configured flagging threshold, 2.0 means twice that, a
    negative value means intensity/pitch actually rose in the final third.
    Normalizing by each metric's own threshold first is what makes it valid
    to average dB and a percentage together into one number.
    """
    energy_drop = trailing_off.get("energy_drop_db")
    pitch_drop = trailing_off.get("pitch_drop_pct")
    if energy_drop is None or pitch_drop is None:
        return None
    return (energy_drop / energy_threshold_db + pitch_drop / pitch_threshold_pct) / 2


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
    sentence_pause_boundary_s: float = SENTENCE_PAUSE_BOUNDARY_S,
    max_sentence_duration_s: float = MAX_SENTENCE_DURATION_S,
) -> list[dict[str, Any]]:
    sound = parselmouth.Sound(ensure_wav(audio_path))
    sentences = words_to_sentences(
        transcript["segments"],
        pause_boundary_s=sentence_pause_boundary_s,
        max_duration_s=max_sentence_duration_s,
    )

    # Pass 1: compute each sentence's raw metrics.
    rows = []
    for sentence in sentences:
        rate = _speaking_rate(sentence)
        trailing_off = _trailing_off_score(sound, sentence, energy_threshold_db, pitch_threshold_pct)
        pause_before = _nearest_preceding_pause(sentence, pauses)
        pitch_instability = compute_pitch_instability(sound, sentence["start"], sentence["end"])
        trailing_off_magnitude = _trailing_off_magnitude(trailing_off, energy_threshold_db, pitch_threshold_pct)

        rows.append(
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
                "pitch_instability_semitones": pitch_instability,
                "_trailing_off_magnitude": trailing_off_magnitude,
            }
        )

    # Session baselines: this speaker's own mean/spread for each signal,
    # over whichever sentences actually have that signal computed.
    hesitation_mean, hesitation_std = _mean_std([r["pause_before"]["duration_ms"] for r in rows if r["pause_before"]])
    trailing_off_mean, trailing_off_std = _mean_std([r["_trailing_off_magnitude"] for r in rows if r["_trailing_off_magnitude"] is not None])
    instability_mean, instability_std = _mean_std([r["pitch_instability_semitones"] for r in rows if r["pitch_instability_semitones"] is not None])
    wpm_mean, wpm_std = _mean_std([r["wpm"] for r in rows if r["wpm"] is not None])

    # Pass 2: score each sentence against those session baselines.
    output = []
    for r in rows:
        subscores: dict[str, float] = {}

        if r["pause_before"] is not None:
            z = _zscore(r["pause_before"]["duration_ms"], hesitation_mean, hesitation_std)
            subscores["hesitation"] = _worse_above_mean_subscore(z)

        if r["_trailing_off_magnitude"] is not None:
            z = _zscore(r["_trailing_off_magnitude"], trailing_off_mean, trailing_off_std)
            subscores["trailing_off"] = _worse_above_mean_subscore(z)

        if r["pitch_instability_semitones"] is not None:
            z = _zscore(r["pitch_instability_semitones"], instability_mean, instability_std)
            subscores["pitch_instability"] = _worse_above_mean_subscore(z)

        if r["wpm"] is not None:
            z = _zscore(r["wpm"], wpm_mean, wpm_std)
            subscores["pacing"] = _deviation_subscore(abs(z))

        if subscores:
            total_weight = sum(CONFIDENCE_WEIGHTS[k] for k in subscores)
            composite = sum(subscores[k] * CONFIDENCE_WEIGHTS[k] for k in subscores) / total_weight
            confidence_score = round(composite, 1)
        else:
            confidence_score = None

        output.append(
            {
                "id": r["id"],
                "start": r["start"],
                "end": r["end"],
                "text": r["text"],
                "word_count": r["word_count"],
                "duration_sec": r["duration_sec"],
                "wpm": r["wpm"],
                "trailing_off": r["trailing_off"],
                "pause_before": r["pause_before"],
                "pitch_instability_semitones": r["pitch_instability_semitones"],
                "confidence_score": confidence_score,
                "confidence_components": {k: round(v, 1) for k, v in subscores.items()},
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
    parser.add_argument("--sentence-pause-boundary-s", type=float, default=SENTENCE_PAUSE_BOUNDARY_S, help="Gap between words treated as a sentence boundary. Default: 0.6s")
    parser.add_argument("--max-sentence-duration-s", type=float, default=MAX_SENTENCE_DURATION_S, help="Hard cap on sentence duration even without punctuation/pause. Default: 15s")
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
        sentence_pause_boundary_s=args.sentence_pause_boundary_s,
        max_sentence_duration_s=args.max_sentence_duration_s,
    )
    save_sentences(sentences, output_path)

    print(f"Segmented into {len(sentences)} sentences")
    for s in sentences:
        flag = " [TRAILING OFF]" if s["trailing_off"].get("trailing_off") else ""
        conf = f"conf={s['confidence_score']}" if s["confidence_score"] is not None else "conf=n/a"
        print(f"  [{s['start']:.2f}-{s['end']:.2f}] {s['wpm']} wpm  {conf}{flag}  {s['text']}")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
