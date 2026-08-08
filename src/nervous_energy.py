"""Nervous energy detection: physiological stress markers, distinct from
the confidence score in segment.py.

Confidence measures hesitation/trailing-off/pacing relative to your own
baseline as signals of PERCEIVED uncertainty. Nervous energy targets
signals that can show up even in fluent, non-hesitant speech: vocal
micro-tremor (jitter/shimmer), short-timescale pitch instability, speeding
up as you go, and rushed/shallow breathing. A sentence can score high on
confidence and high on nervous energy at the same time -- that combination
(stressed but not sounding uncertain) is itself useful signal, surfaced in
synthesize.py rather than here.

Usage:
    python -m src.nervous_energy audio.wav --transcript transcript.json
        --sentences sentences.json --pauses pauses.json [--output out.json]

`sentences.json` comes from src.segment (its pitch_instability_semitones
is reused here rather than recomputed). `pauses.json` comes from
src.pause_detection.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import parselmouth

from src.acoustic_features import extract_segment_features
from src.audio_io import ensure_wav

# --- Weighting + rationale (starting points, tune for your own voice) ---
#
#   - vocal_tremor (0.35): jitter + shimmer combined for the sentence, each
#     z-scored against your own session baseline and averaged. The most
#     literal physiological marker of the four -- cycle-to-cycle pitch and
#     amplitude perturbation tend to rise under vocal-fold tension
#     independent of whether the speech itself sounds hesitant.
#   - pitch_instability (0.25): short-timescale F0 jumpiness (reused from
#     segment.py's compute_pitch_instability), distinct from the
#     directional trailing-off drop -- can show up during otherwise
#     fluent, non-hesitant delivery.
#   - pacing_acceleration (0.25): speeding up over the course of a
#     sentence (final third's WPM vs. first third's), the "getting away
#     from yourself" pattern -- distinct from just being fast overall,
#     which pacing deviation in the confidence score already covers.
#   - breathing (0.15): weighted lowest. This is a PROXY built from
#     already-detected mid-sentence breath pauses (frequency + shortness
#     vs. your own norm) -- NOT genuine acoustic breath-sound detection,
#     which would need a dedicated model and is out of scope here. Treated
#     as the least reliable of the four signals accordingly.
NERVOUS_ENERGY_WEIGHTS = {
    "vocal_tremor": 0.35,
    "pitch_instability": 0.25,
    "pacing_acceleration": 0.25,
    "breathing": 0.15,
}

# Same duration floor rationale as segment.py's MIN_DURATION_FOR_TRAILING_OFF_S:
# a "third" of a too-short sentence is only a few tens of ms, too little for
# a stable local-WPM or jitter/shimmer estimate.
MIN_DURATION_S = 1.2


def _mean_std(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 0.0
    return float(np.mean(values)), float(np.std(values))


def _zscore(value: float, mean: float, std: float) -> float:
    if std < 1e-9:
        return 0.0
    return (value - mean) / std


def _nervous_subscore(z: float) -> float:
    """z=0 (typical for you) maps to 3/10 -- baseline nervous-energy
    reading is assumed low unless a signal actually stands out above your
    own norm. Each standard deviation above your average adds 3 points;
    below average pulls it down toward 1 (calmer than your own norm)."""
    return float(np.clip(3 + 3 * z, 1, 10))


def _words_in_range(all_words: list[dict[str, Any]], start: float, end: float) -> list[dict[str, Any]]:
    return [w for w in all_words if start <= w["start"] < end]


def compute_pacing_acceleration(words: list[dict[str, Any]], start: float, end: float) -> float | None:
    """WPM in the final third minus WPM in the first third of the
    sentence, by time (same first-two-thirds/final-third convention as
    trailing-off, for consistency). Positive = sped up over the course of
    the sentence. Only the first and final thirds are used (not the
    middle) so this measures the endpoints of a trend, same reasoning as
    trailing-off's two-part comparison."""
    duration = end - start
    if duration < MIN_DURATION_S:
        return None

    first_end = start + duration / 3
    final_start = start + duration * 2 / 3

    first_words = _words_in_range(words, start, first_end)
    final_words = _words_in_range(words, final_start, end)
    first_span = first_end - start
    final_span = end - final_start
    if len(first_words) < 2 or len(final_words) < 2 or first_span <= 0 or final_span <= 0:
        return None

    first_wpm = len(first_words) / first_span * 60.0
    final_wpm = len(final_words) / final_span * 60.0
    return round(final_wpm - first_wpm, 1)


def compute_breathing_signal(
    sentence_start: float,
    sentence_end: float,
    pauses: list[dict[str, Any]],
) -> dict[str, float | None]:
    """Frequency and average duration of mid_sentence_breath pauses within
    this sentence -- a proxy for breathing pattern, not real breath-sound
    detection (see module docstring)."""
    breath_pauses = [
        p for p in pauses
        if p["type"] == "mid_sentence_breath" and sentence_start <= p["start"] < sentence_end
    ]
    duration = sentence_end - sentence_start
    if not breath_pauses or duration <= 0:
        return {"rate_per_min": None, "avg_duration_ms": None}

    rate_per_min = len(breath_pauses) / duration * 60.0
    avg_duration_ms = float(np.mean([p["duration_ms"] for p in breath_pauses]))
    return {"rate_per_min": round(rate_per_min, 2), "avg_duration_ms": round(avg_duration_ms, 1)}


def build_nervous_energy(
    audio_path: str,
    transcript: dict[str, Any],
    sentences: list[dict[str, Any]],
    pauses: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    sound = parselmouth.Sound(ensure_wav(audio_path))
    all_words = [w for seg in transcript["segments"] for w in seg.get("words", [])]

    # Pass 1: raw per-sentence metrics.
    rows = []
    for s in sentences:
        start, end = s["start"], s["end"]
        duration = end - start

        jitter = shimmer = None
        if duration >= MIN_DURATION_S:
            features = extract_segment_features(sound, start, end)
            jitter = features["jitter_local"]
            shimmer = features["shimmer_local"]

        acceleration = compute_pacing_acceleration(all_words, start, end)
        breathing = compute_breathing_signal(start, end, pauses)

        rows.append(
            {
                "id": s["id"],
                "start": start,
                "end": end,
                "text": s["text"],
                "jitter_local": jitter,
                "shimmer_local": shimmer,
                "pitch_instability_semitones": s.get("pitch_instability_semitones"),
                "pacing_acceleration_wpm": acceleration,
                "breathing": breathing,
            }
        )

    # Session baselines (this speaker's own mean/spread for each signal).
    jitter_mean, jitter_std = _mean_std([r["jitter_local"] for r in rows if r["jitter_local"] is not None])
    shimmer_mean, shimmer_std = _mean_std([r["shimmer_local"] for r in rows if r["shimmer_local"] is not None])
    instability_mean, instability_std = _mean_std([r["pitch_instability_semitones"] for r in rows if r["pitch_instability_semitones"] is not None])
    accel_mean, accel_std = _mean_std([r["pacing_acceleration_wpm"] for r in rows if r["pacing_acceleration_wpm"] is not None])
    breath_rate_mean, breath_rate_std = _mean_std([r["breathing"]["rate_per_min"] for r in rows if r["breathing"]["rate_per_min"] is not None])
    breath_dur_mean, breath_dur_std = _mean_std([r["breathing"]["avg_duration_ms"] for r in rows if r["breathing"]["avg_duration_ms"] is not None])

    # Pass 2: score against those baselines.
    output = []
    for r in rows:
        subscores: dict[str, float] = {}

        if r["jitter_local"] is not None and r["shimmer_local"] is not None:
            jz = _zscore(r["jitter_local"], jitter_mean, jitter_std)
            sz = _zscore(r["shimmer_local"], shimmer_mean, shimmer_std)
            subscores["vocal_tremor"] = _nervous_subscore((jz + sz) / 2)

        if r["pitch_instability_semitones"] is not None:
            z = _zscore(r["pitch_instability_semitones"], instability_mean, instability_std)
            subscores["pitch_instability"] = _nervous_subscore(z)

        if r["pacing_acceleration_wpm"] is not None:
            z = _zscore(r["pacing_acceleration_wpm"], accel_mean, accel_std)
            # Only speeding up (positive) reads as nervous energy;
            # slowing down isn't penalized the way it is in the
            # confidence score's symmetric pacing-deviation check.
            subscores["pacing_acceleration"] = _nervous_subscore(max(z, 0.0))

        rate = r["breathing"]["rate_per_min"]
        avg_dur = r["breathing"]["avg_duration_ms"]
        if rate is not None and avg_dur is not None:
            rate_z = _zscore(rate, breath_rate_mean, breath_rate_std)
            # Shorter-than-usual breath pauses read as more rushed/shallow,
            # so a negative duration z-score should PUSH the score up --
            # negate it before combining with the (higher-is-worse) rate z.
            duration_z = -_zscore(avg_dur, breath_dur_mean, breath_dur_std)
            subscores["breathing"] = _nervous_subscore((rate_z + duration_z) / 2)

        if subscores:
            total_weight = sum(NERVOUS_ENERGY_WEIGHTS[k] for k in subscores)
            composite = sum(subscores[k] * NERVOUS_ENERGY_WEIGHTS[k] for k in subscores) / total_weight
            nervous_energy_score = round(composite, 1)
        else:
            nervous_energy_score = None

        output.append(
            {
                "id": r["id"],
                "start": r["start"],
                "end": r["end"],
                "text": r["text"],
                "jitter_local": r["jitter_local"],
                "shimmer_local": r["shimmer_local"],
                "pitch_instability_semitones": r["pitch_instability_semitones"],
                "pacing_acceleration_wpm": r["pacing_acceleration_wpm"],
                "breathing": r["breathing"],
                "nervous_energy_score": nervous_energy_score,
                "nervous_energy_components": {k: round(v, 1) for k, v in subscores.items()},
            }
        )
    return output


def save_nervous_energy(rows: list[dict[str, Any]], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(rows, f, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect nervous-energy signals per sentence (vocal tremor, pitch instability, pacing acceleration, breathing).")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--transcript", required=True, help="Path to Whisper transcript JSON")
    parser.add_argument("--sentences", required=True, help="Path to sentences JSON (from src.segment)")
    parser.add_argument("--pauses", required=True, help="Path to pauses JSON (from src.pause_detection)")
    parser.add_argument("--output", default="output/nervous_energy.json")
    args = parser.parse_args()

    with open(args.transcript) as f:
        transcript = json.load(f)
    with open(args.sentences) as f:
        sentences = json.load(f)
    with open(args.pauses) as f:
        pauses = json.load(f)

    rows = build_nervous_energy(args.audio_path, transcript, sentences, pauses)
    save_nervous_energy(rows, args.output)

    print(f"Scored nervous energy for {len(rows)} sentences")
    for r in rows:
        score = r["nervous_energy_score"]
        print(f"  [{r['start']:.2f}-{r['end']:.2f}] nervous_energy={score}  {r['text'][:60]}")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
