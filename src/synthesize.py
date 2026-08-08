"""Stage 6: turn the raw transcript + acoustic metrics into a readable,
specific feedback report via the Claude API.

Usage:
    python -m src.synthesize --transcript transcript.json --sentences sentences.json
        --pauses pauses.json [--acoustic acoustic.json] [--model claude-sonnet-5]
        [--output report.md]

Requires ANTHROPIC_API_KEY in the environment (or a .env file, loaded via
python-dotenv).
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv

# NOTE: the model ID below is a placeholder default -- verify it against
# Anthropic's current model list before relying on it (model IDs are
# retired/renamed over time). Override with --model or ANTHROPIC_MODEL.
DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_MAX_TOKENS = 4096

METRIC_GLOSSARY = """\
What each metric means (for your reference while writing feedback):

- Pitch (F0) mean/range, in Hz: the fundamental frequency of the voice.
  A low range across a whole response can read as monotone; a sudden drop
  toward the end of a sentence is one signal of "trailing off."
- Intensity/energy, in dB: loudness. Like pitch, a drop toward the end of
  a sentence (beyond normal sentence-final tapering) signals fading
  energy or confidence.
- Jitter (local) / Shimmer (local): cycle-to-cycle perturbation in pitch
  period / amplitude. Higher values indicate a less stable, shakier, or
  breathier voice -- often more noticeable under nervousness or vocal
  fatigue. Typical relaxed speech: jitter ~<0.01, shimmer ~<0.05-0.10;
  meaningfully higher than that is worth mentioning if it clusters in
  particular answers.
- WPM (words per minute): speaking rate for a sentence/segment. Very fast
  can read as rushed/nervous; very slow can read as hesitant or
  under-rehearsed. There's no universal ideal -- what matters is whether
  it changes noticeably between confident and less-confident answers.
- Trailing-off: for each sentence, we split it into its first two-thirds
  and final third by time, and compare average pitch and energy between
  the two parts. "trailing_off": true means BOTH energy and pitch dropped
  past a threshold in the final third -- a real signal the speaker's
  energy visibly faded before finishing the thought, not just normal
  English sentence-final intonation.
- Pauses: silence gaps at or above the configured minimum duration,
  classified as:
    - leading_hesitation: dead air before the speaker starts responding
      at all
    - pre_sentence_hesitation: a pause before starting a new
      sentence/thought (mid-answer hesitation)
    - mid_sentence_breath: a pause inside a sentence (usually natural
      breathing/articulation, not hesitation)
    - trailing_silence: silence after the recording's last utterance
"""

SYSTEM_PROMPT = f"""\
You are a speech delivery coach analyzing a practice recording (interview \
practice, mock interview, or similar). You are given a transcript with \
acoustic metrics extracted from the audio. Your job is to give specific, \
actionable feedback on DELIVERY -- pacing, hesitation, energy, and vocal \
confidence -- not on the content of the answers.

{METRIC_GLOSSARY}

Guidelines for your feedback:
- Be specific. Reference exact sentences (quote them) and their timestamps.
  Say things like "your energy dropped noticeably in the final third of \
your answer about the Ellipsis Health project (9.7s-15.6s), where \
intensity fell from 73dB to 63dB" -- not "try to sound more confident."
- Identify PATTERNS across the recording, not just isolated data points. \
If trailing-off, fast speech, or hesitation pauses cluster around specific \
topics or recur across multiple answers, say so explicitly and name which \
answers.
- Distinguish natural variation from real signal. Not every dip is \
meaningful -- focus on the sentences already flagged (trailing_off: true) \
and pauses classified as hesitation, plus genuinely large outliers.
- Be constructive but honest. If delivery was actually solid in places, \
say so specifically (which answer, why) rather than manufacturing \
criticism.
- Keep it practical: 3-5 concrete, prioritized things to work on, each \
tied to specific evidence from this recording.

Write the report in markdown with clear sections."""


def _load_json(path: str) -> Any:
    with open(path) as f:
        return json.load(f)


def build_metrics_summary(
    transcript: dict[str, Any],
    sentences: list[dict[str, Any]],
    pauses: list[dict[str, Any]],
    acoustic_segments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Condenses the raw pipeline artifacts into the payload sent to Claude.
    Kept as plain data (not pre-formatted text) so the prompt-building step
    controls presentation.
    """
    hesitation_pauses = [p for p in pauses if p["type"] in ("leading_hesitation", "pre_sentence_hesitation")]
    trailing_off_sentences = [s for s in sentences if s["trailing_off"].get("trailing_off")]
    wpm_values = [s["wpm"] for s in sentences if s["wpm"]]

    summary = {
        "duration_sec": transcript.get("duration_sec"),
        "full_text": transcript.get("text"),
        "sentence_count": len(sentences),
        "avg_wpm": round(sum(wpm_values) / len(wpm_values), 1) if wpm_values else None,
        "min_wpm": min(wpm_values) if wpm_values else None,
        "max_wpm": max(wpm_values) if wpm_values else None,
        "hesitation_pause_count": len(hesitation_pauses),
        "hesitation_pause_total_ms": round(sum(p["duration_ms"] for p in hesitation_pauses), 1),
        "trailing_off_count": len(trailing_off_sentences),
        "sentences": sentences,
        "pauses": pauses,
    }
    if acoustic_segments:
        summary["voice_quality_by_segment"] = [
            {
                "start": s["start"],
                "end": s["end"],
                "text": s.get("text"),
                "jitter_local": s.get("jitter_local"),
                "shimmer_local": s.get("shimmer_local"),
            }
            for s in acoustic_segments
        ]
    return summary


def build_user_message(metrics_summary: dict[str, Any]) -> str:
    return (
        "Here is the transcript and acoustic metrics for a practice "
        "recording. Analyze it and write the delivery feedback report.\n\n"
        "```json\n" + json.dumps(metrics_summary, indent=2) + "\n```"
    )


def synthesize_report(
    metrics_summary: dict[str, Any],
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    api_key: str | None = None,
) -> str:
    client = Anthropic(api_key=api_key) if api_key else Anthropic()
    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(metrics_summary)}],
    )
    return "".join(block.text for block in message.content if block.type == "text")


def save_report(report: str, output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(report)


def _default_output_path(transcript_path: str) -> str:
    stem = Path(transcript_path).stem.replace("_transcript", "")
    return str(Path("output") / f"{stem}_report.md")


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Synthesize a delivery feedback report via the Claude API.")
    parser.add_argument("--transcript", required=True, help="Path to Whisper transcript JSON")
    parser.add_argument("--sentences", required=True, help="Path to sentences JSON (from src.segment)")
    parser.add_argument("--pauses", required=True, help="Path to pauses JSON (from src.pause_detection)")
    parser.add_argument("--acoustic", default=None, help="Optional path to per-segment acoustic features JSON (from src.acoustic_features)")
    parser.add_argument("--model", default=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL))
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS)
    parser.add_argument("--output", default=None, help="Output markdown path. Default: output/<stem>_report.md")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY is not set (env var or .env file)")

    transcript = _load_json(args.transcript)
    sentences = _load_json(args.sentences)
    pauses = _load_json(args.pauses)
    acoustic_segments = _load_json(args.acoustic) if args.acoustic else None

    output_path = args.output or _default_output_path(args.transcript)

    metrics_summary = build_metrics_summary(transcript, sentences, pauses, acoustic_segments)
    report = synthesize_report(metrics_summary, model=args.model, max_tokens=args.max_tokens)
    save_report(report, output_path)

    print(f"Wrote report to {output_path} ({len(report)} chars, model={args.model})")


if __name__ == "__main__":
    main()
