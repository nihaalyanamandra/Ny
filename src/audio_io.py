"""Shared audio-loading helper.

praat-parselmouth can only read WAV/AIFF/FLAC-family files (not compressed
containers like m4a/mp3), and librosa's fallback path for those formats
(audioread) is both fragile and deprecated. ffmpeg is already a hard
dependency (Whisper needs it), so every stage that needs a real WAV file
goes through `ensure_wav` here rather than each handling format conversion
(or failing to) on its own.
"""
from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

_CACHE_DIR = Path(tempfile.gettempdir()) / "speech_analytics_wav_cache"


def ensure_wav(audio_path: str) -> str:
    """Returns a path to a mono WAV version of `audio_path`, transcoding via
    ffmpeg if it isn't already a .wav file. The source's native sample rate
    is preserved (Praat handles any reasonable rate fine; downstream VAD
    code resamples to what it needs on its own).

    Conversions are cached by content (path + size + mtime), so repeated
    calls across pipeline stages -- or repeated runs on the same file --
    don't re-transcode.
    """
    path = Path(audio_path)
    if path.suffix.lower() == ".wav":
        return audio_path

    stat = path.stat()
    key = hashlib.sha1(f"{path.resolve()}:{stat.st_size}:{stat.st_mtime}".encode()).hexdigest()[:16]
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _CACHE_DIR / f"{path.stem}_{key}.wav"

    if not out_path.exists():
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(path), "-ac", "1", str(out_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    return str(out_path)
