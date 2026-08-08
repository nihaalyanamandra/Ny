"""Stage 3: per-segment acoustic features (pitch, intensity, jitter, shimmer)
via praat-parselmouth, with librosa RMS energy as a supplementary metric.

Usage:
    python -m src.acoustic_features audio.wav --segments segments.json --output out.json

`segments.json` is either:
  - a list of [start, end] pairs, or
  - a Whisper transcript JSON (as produced by src/transcribe.py) — its
    top-level "segments" are used.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import parselmouth
from parselmouth.praat import call

# Praat pitch floor/ceiling for typical adult speech. Widening this too much
# (esp. the floor) causes octave errors on breathy/quiet segment tails.
PITCH_FLOOR_HZ = 75
PITCH_CEILING_HZ = 500

# Praat's Intensity contour represents digital/near-zero silence as a floor
# around -300 dB rather than leaving it undefined (dB of amplitude 0 is
# -infinity, so Praat clamps it). Left in, that sentinel wrecks mean/min
# stats for any segment with true silence at its edges. No real speech
# frame is anywhere close to this, so we drop frames at or below it before
# computing stats.
INTENSITY_SILENCE_FLOOR_DB = -100.0


def _safe_call(*args, **kwargs) -> float | None:
    try:
        val = call(*args, **kwargs)
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        return float(val)
    except Exception:
        return None


def extract_segment_features(sound: parselmouth.Sound, start: float, end: float) -> dict[str, Any]:
    """Extract pitch/intensity/jitter/shimmer for the [start, end] window of `sound`.

    Any metric that can't be computed (e.g. no voiced frames in a very short
    or silent window) is returned as None rather than raising.
    """
    end = min(end, sound.duration)
    start = max(0.0, start)
    if end - start < 0.02:
        return _empty_features()

    part = sound.extract_part(from_time=start, to_time=end, preserve_times=False)

    features: dict[str, Any] = _empty_features()

    # --- Pitch (F0) ---
    try:
        pitch = part.to_pitch(pitch_floor=PITCH_FLOOR_HZ, pitch_ceiling=PITCH_CEILING_HZ)
        f0_values = pitch.selected_array["frequency"]
        voiced = f0_values[f0_values > 0]
        if len(voiced) > 0:
            features["pitch_mean_hz"] = round(float(np.mean(voiced)), 2)
            features["pitch_min_hz"] = round(float(np.min(voiced)), 2)
            features["pitch_max_hz"] = round(float(np.max(voiced)), 2)
            features["pitch_range_hz"] = round(features["pitch_max_hz"] - features["pitch_min_hz"], 2)
            features["pitch_stdev_hz"] = round(float(np.std(voiced)), 2)
        features["voiced_fraction"] = round(len(voiced) / len(f0_values), 3) if len(f0_values) else 0.0
    except Exception:
        pass

    # --- Intensity ---
    try:
        intensity = part.to_intensity()
        db_values = intensity.values[0]
        db_values = db_values[~np.isnan(db_values)]
        db_values = db_values[db_values > INTENSITY_SILENCE_FLOOR_DB]
        if len(db_values) > 0:
            # dB is a log scale, so a plain arithmetic mean of dB values
            # is *not* the average loudness -- it systematically
            # underweights the louder frames relative to quiet ones. Use
            # Praat's energy-based mean (averages the underlying power,
            # then converts back to dB), which is the standard way to
            # get a perceptually meaningful average level. Min/max are
            # fine as plain extrema since they're not an averaging op.
            energy_mean = _safe_call(intensity, "Get mean", 0, 0, "energy")
            features["intensity_mean_db"] = round(energy_mean, 2) if energy_mean is not None else None
            features["intensity_min_db"] = round(float(np.min(db_values)), 2)
            features["intensity_max_db"] = round(float(np.max(db_values)), 2)
    except Exception:
        pass

    # --- Jitter / shimmer (need a periodic point process; require some voicing) ---
    try:
        point_process = call(part, "To PointProcess (periodic, cc)", PITCH_FLOOR_HZ, PITCH_CEILING_HZ)
        n_points = call(point_process, "Get number of points")
        if n_points >= 2:
            features["jitter_local"] = _safe_call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
            features["shimmer_local"] = _safe_call(
                [part, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
            )
    except Exception:
        pass

    # --- Supplementary RMS energy via librosa ---
    try:
        y = part.values.mean(axis=0) if part.values.ndim > 1 else part.values
        y = y.astype(np.float32)
        rms = librosa.feature.rms(y=y)[0]
        if len(rms) > 0:
            features["rms_mean"] = round(float(np.mean(rms)), 5)
    except Exception:
        pass

    return features


def _empty_features() -> dict[str, Any]:
    return {
        "pitch_mean_hz": None,
        "pitch_min_hz": None,
        "pitch_max_hz": None,
        "pitch_range_hz": None,
        "pitch_stdev_hz": None,
        "voiced_fraction": None,
        "intensity_mean_db": None,
        "intensity_min_db": None,
        "intensity_max_db": None,
        "jitter_local": None,
        "shimmer_local": None,
        "rms_mean": None,
    }


def extract_acoustic_features(audio_path: str, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """`segments` is a list of dicts with at least "start" and "end" (extra
    keys like "id"/"text" are passed through in the output).
    """
    sound = parselmouth.Sound(audio_path)
    results = []
    for seg in segments:
        start, end = seg["start"], seg["end"]
        features = extract_segment_features(sound, start, end)
        results.append({**seg, **features})
    return results


def _load_segments(segments_path: str) -> list[dict[str, Any]]:
    with open(segments_path) as f:
        data = json.load(f)

    if isinstance(data, dict) and "segments" in data:
        return [{"id": s["id"], "start": s["start"], "end": s["end"], "text": s.get("text", "")} for s in data["segments"]]

    if isinstance(data, list):
        out = []
        for i, item in enumerate(data):
            if isinstance(item, dict):
                out.append({"id": item.get("id", i), "start": item["start"], "end": item["end"], "text": item.get("text", "")})
            else:
                out.append({"id": i, "start": item[0], "end": item[1], "text": ""})
        return out

    raise ValueError(f"Unrecognized segments format in {segments_path}")


def save_features(features: list[dict[str, Any]], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(features, f, indent=2)


def _default_output_path(audio_path: str) -> str:
    stem = Path(audio_path).stem
    return str(Path("output") / f"{stem}_acoustic_features.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract per-segment acoustic features (pitch, intensity, jitter, shimmer).")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--segments", required=True, help="Path to a segments JSON (Whisper transcript or list of [start,end])")
    parser.add_argument("--output", default=None, help="Output JSON path. Default: output/<audio-stem>_acoustic_features.json")
    args = parser.parse_args()

    output_path = args.output or _default_output_path(args.audio_path)

    segments = _load_segments(args.segments)
    features = extract_acoustic_features(args.audio_path, segments)
    save_features(features, output_path)

    print(f"Extracted acoustic features for {len(features)} segments")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
