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
- Open with a short "Voice Summary" section (3-5 sentences): characterize \
how the interviewee actually SOUNDED across the whole recording -- their \
overall energy, tone, pacing character, and confidence -- as if you're \
describing their vocal presence to someone who hasn't listened to it. \
Base this on the aggregate patterns in the data (average pacing vs. its \
spread, how much hesitation there was, how often trailing-off or \
instability showed up, where their steadiest moments were), not a restatement \
of the detailed findings that follow -- this is the overall impression, \
they're the specifics.
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

Write the report in markdown with clear sections, Voice Summary first."""


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
    # Compact (no indent) rather than pretty-printed: on a ~25min recording
    # this payload is already ~100+ sentences plus the full pause list, and
    # indent=2 roughly doubles its size in tokens for a human-readable
    # layout Claude doesn't need.
    return (
        "Here is the transcript and acoustic metrics for a practice "
        "recording. Analyze it and write the delivery feedback report.\n\n"
        "```json\n" + json.dumps(metrics_summary, separators=(",", ":")) + "\n```"
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
        # This model uses extended thinking by default, and thinking
        # tokens count against max_tokens -- root-caused via testing: a
        # call came back with stop_reason "max_tokens" and 8191 of an
        # 8192-token budget spent on thinking, leaving none for the actual
        # report text (empty response, but no exception). Report-writing
        # from already-computed metrics doesn't need extended reasoning,
        # so disable it outright rather than just raising max_tokens and
        # hoping thinking doesn't eat the larger budget too.
        thinking={"type": "disabled"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(metrics_summary)}],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    # Belt-and-suspenders: even with thinking disabled, a response could
    # theoretically still come back empty for some other reason. Silently
    # writing that to disk as "the report" is worse than failing loudly,
    # since it looks like success. Surface it as an error instead so the
    # caller knows to retry rather than getting an empty file.
    if not text.strip():
        raise RuntimeError(f"Claude returned an empty response (stop_reason={message.stop_reason!r}, usage={message.usage!r})")
    return text


def save_report(report: str, output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(report)


def _default_output_path(transcript_path: str) -> str:
    stem = Path(transcript_path).stem.replace("_transcript", "")
    return str(Path("output") / f"{stem}_report.md")


# --- Per-answer report (used when content_alignment.py has been run;
# requires diarization, so it's not available for single-speaker
# recordings -- see synthesize_full_report's fallback to the metric-based
# report above when content_alignment is None) ---

# A "content miss" (partial/missed alignment) and a "confidence dip"
# co-occurring in the same answer is the single most useful signal this
# pipeline can surface -- it's the difference between "drifted off-topic
# but sounded fine" and "visibly lost confidence exactly where they lost
# the thread." 5.0 sits meaningfully below confidence_score's own
# "typical for you" anchor of 7 (see segment.py's _worse_above_mean_subscore)
# without being so low it only fires on extreme outliers.
CONTENT_CONFIDENCE_OVERLAP_THRESHOLD = 5.0

STRUCTURED_REPORT_SYSTEM_PROMPT = f"""\
You are a speech delivery coach writing a practice-interview feedback \
report, organized per question/answer. You are given, for each answer: \
the interviewer's question, what it was really asking for, whether the \
candidate's answer addressed it (already assessed), and the acoustic \
delivery data for that answer (already computed -- confidence score, \
trailing-off, nervous energy, pauses). Your job is to write the narrative \
around these pre-computed facts, not to re-derive them.

{METRIC_GLOSSARY}
- Confidence score (1-10, per sentence): a composite of pre-sentence \
hesitation, trailing-off magnitude, mid-sentence pitch instability, and \
pacing deviation, each measured against the speaker's OWN session average \
(not a universal target). 7 is "typical for this speaker"; below ~5 is a \
real dip relative to their own norm, not just noise.
- Nervous energy score (1-10, per sentence): vocal tremor (jitter/shimmer), \
pitch micro-instability, pacing acceleration, and a breathing-pattern \
proxy, each vs. the speaker's own session baseline. This is DISTINCT from \
confidence -- a sentence can have high nervous energy (physiological \
stress markers) while still scoring high on confidence (didn't sound \
hesitant). That combination means the nerves aren't leaking into \
perceived delivery, which is worth noting as a positive. When nervous \
energy is high AND confidence is also low in the same place, that's \
audible nerves, not just internal ones.
- content_confidence_overlap (boolean, already computed): true means this \
answer both had a content alignment problem (partial/missed) AND \
contained a real confidence dip -- call this out explicitly and \
specifically when true, since it's the strongest signal in the data.

Guidelines:
- Be specific: reference exact timestamps and quote the transcript, not \
generic advice.
- Every answer needs exactly one specific, actionable note grounded in \
its own evidence -- not a template phrase reused across answers.
- Don't manufacture criticism. If an answer was direct and confidently \
delivered, say so plainly and briefly rather than padding it.
- The overall summary and top 3 priority actions should synthesize \
patterns ACROSS answers (recurring topics, recurring failure modes), not \
just restate the strongest single answer.
- voice_summary is distinct from session_summary: it's a 3-5 sentence \
characterization of how the interviewee actually SOUNDED overall -- \
energy, tone, pacing character, confidence -- as if describing their \
vocal presence to someone who hasn't heard it. session_summary covers \
patterns across answers (content + delivery); voice_summary is the \
aggregate vocal impression, not a repeat of the per-answer detail.

Respond with ONLY a JSON object, no other text, matching this shape:
{{
  "voice_summary": "<3-5 sentences, overall vocal impression across the session>",
  "session_summary": "<2-4 sentences, patterns across the whole session>",
  "top_priority_actions": ["<action 1>", "<action 2>", "<action 3>"],
  "answers": [
    {{
      "question": "<verbatim or null>",
      "implicit_ask": "<what was really being asked, or null>",
      "answer_start": <float>,
      "answer_end": <float>,
      "alignment": "direct" | "partial" | "missed",
      "alignment_reason": "<specific, grounded in the provided gap_description/strong_answer_would_have>",
      "confidence_summary": "<narrative citing the actual timestamps/scores provided>",
      "content_confidence_overlap_note": "<specific description of the overlap, or null if content_confidence_overlap was false>",
      "nervous_energy_note": "<only if genuinely notable, else null>",
      "actionable_note": "<one specific, actionable note for this answer>"
    }}
  ]
}}
Output one object per answer in the input, in the same order."""


def build_answer_bundles(
    content_alignment: list[dict[str, Any]],
    sentences: list[dict[str, Any]],
    nervous_energy: list[dict[str, Any]] | None = None,
    overlap_threshold: float = CONTENT_CONFIDENCE_OVERLAP_THRESHOLD,
) -> list[dict[str, Any]]:
    """Merges content_alignment.py's per-answer verdicts with segment.py's
    per-sentence confidence data (and optionally nervous_energy.py's
    scores) for the same time range, computing the content/confidence
    overlap flag deterministically in Python rather than asking Claude to
    do timestamp cross-referencing arithmetic -- Claude's job below is to
    write the narrative around these already-computed facts, not derive
    them.
    """
    bundles = []
    for a in content_alignment:
        a_start = a["timestamp_range"]["answer_start"]
        a_end = a["timestamp_range"]["answer_end"]

        # A content_alignment "answer" turn can span multiple segment.py
        # sentences (turns aren't duration-capped the way sentences are).
        # Overlap test rather than strict containment since the two stages'
        # boundaries come from different groupings of the same words.
        matching_sentences = [s for s in sentences if s["start"] < a_end and s["end"] > a_start]

        confidences = [s for s in matching_sentences if s["confidence_score"] is not None]
        lowest_confidence = min(confidences, key=lambda s: s["confidence_score"]) if confidences else None
        avg_confidence = round(sum(s["confidence_score"] for s in confidences) / len(confidences), 1) if confidences else None

        trailing_off_hits = [
            {"start": s["start"], "end": s["end"], "energy_drop_db": s["trailing_off"].get("energy_drop_db"), "pitch_drop_pct": s["trailing_off"].get("pitch_drop_pct")}
            for s in matching_sentences
            if s["trailing_off"].get("trailing_off")
        ]

        content_is_gap = a["alignment"] in ("partial", "missed")
        confidence_dips = lowest_confidence is not None and lowest_confidence["confidence_score"] < overlap_threshold
        overlap = content_is_gap and confidence_dips

        highest_nervous = None
        if nervous_energy:
            matching_nervous = [n for n in nervous_energy if n["start"] < a_end and n["end"] > a_start and n["nervous_energy_score"] is not None]
            if matching_nervous:
                highest_nervous = max(matching_nervous, key=lambda n: n["nervous_energy_score"])

        bundles.append(
            {
                "question": a["question"],
                "implicit_ask": a.get("implicit_ask"),
                "alignment": a["alignment"],
                "gap_description": a.get("gap_description"),
                "strong_answer_would_have": a.get("strong_answer_would_have"),
                "answer_start": a_start,
                "answer_end": a_end,
                "answer_preview": a["answer_preview"],
                "avg_confidence": avg_confidence,
                "lowest_confidence": (
                    {
                        "score": lowest_confidence["confidence_score"],
                        "start": lowest_confidence["start"],
                        "end": lowest_confidence["end"],
                        "text": lowest_confidence["text"][:150],
                    }
                    if lowest_confidence
                    else None
                ),
                "trailing_off_sentences": trailing_off_hits,
                "content_confidence_overlap": overlap,
                "highest_nervous_energy": (
                    {"score": highest_nervous["nervous_energy_score"], "start": highest_nervous["start"], "end": highest_nervous["end"]}
                    if highest_nervous
                    else None
                ),
            }
        )
    return bundles


def build_structured_report(
    answer_bundles: list[dict[str, Any]],
    model: str = DEFAULT_MODEL,
    max_tokens: int = 8192,
    api_key: str | None = None,
) -> dict[str, Any]:
    client = Anthropic(api_key=api_key) if api_key else Anthropic()
    user_message = (
        "Here are the question/answer bundles for a practice interview "
        "recording, each with content alignment and acoustic delivery data "
        "already computed. Write the per-answer report.\n\n"
        "```json\n" + json.dumps(answer_bundles, separators=(",", ":")) + "\n```"
    )
    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        thinking={"type": "disabled"},  # see synthesize_report's comment on why
        system=STRUCTURED_REPORT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    raw_text = "".join(block.text for block in message.content if block.type == "text")
    return json.loads(raw_text)


def _fmt_time(seconds: float | None) -> str:
    if seconds is None:
        return "?"
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def render_report_markdown(structured_report: dict[str, Any]) -> str:
    """Deterministic rendering of the structured JSON to markdown, so the
    two output formats can't drift from each other -- Claude produces one
    source of truth (the JSON), this just formats it."""
    lines = ["# Delivery Feedback Report", ""]
    lines.append("## Voice Summary")
    lines.append("")
    lines.append(structured_report.get("voice_summary", ""))
    lines.append("")

    lines.append("## Session Summary")
    lines.append("")
    lines.append(structured_report.get("session_summary", ""))
    lines.append("")

    lines.append("## Top Priority Actions")
    lines.append("")
    for i, action in enumerate(structured_report.get("top_priority_actions", []), 1):
        lines.append(f"{i}. {action}")
    lines.append("")
    lines.append("---")
    lines.append("")

    for i, ans in enumerate(structured_report.get("answers", []), 1):
        t_range = f"{_fmt_time(ans.get('answer_start'))}–{_fmt_time(ans.get('answer_end'))}"
        lines.append(f"## Answer {i} [{t_range}]")
        lines.append("")
        if ans.get("question"):
            lines.append(f"**Question:** {ans['question']}")
            lines.append("")
        if ans.get("implicit_ask"):
            lines.append(f"**What was really being asked:** {ans['implicit_ask']}")
            lines.append("")
        lines.append(f"**Content alignment:** {ans.get('alignment', 'unknown').upper()}")
        if ans.get("alignment_reason"):
            lines.append(f"  \n{ans['alignment_reason']}")
        lines.append("")
        if ans.get("confidence_summary"):
            lines.append(f"**Delivery confidence:** {ans['confidence_summary']}")
            lines.append("")
        if ans.get("content_confidence_overlap_note"):
            lines.append(f"**⚠️ Content + confidence overlap:** {ans['content_confidence_overlap_note']}")
            lines.append("")
        if ans.get("nervous_energy_note"):
            lines.append(f"**Nervous energy:** {ans['nervous_energy_note']}")
            lines.append("")
        if ans.get("actionable_note"):
            lines.append(f"**Try this:** {ans['actionable_note']}")
            lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def synthesize_full_report(
    transcript: dict[str, Any],
    sentences: list[dict[str, Any]],
    pauses: list[dict[str, Any]],
    acoustic_segments: list[dict[str, Any]] | None = None,
    content_alignment: list[dict[str, Any]] | None = None,
    nervous_energy: list[dict[str, Any]] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 8192,
) -> dict[str, Any]:
    """Top-level entry point. Returns {"markdown": str, "structured": dict | None}.

    Uses the richer per-answer report when content_alignment is available
    (requires diarization -- see src/diarize.py and src/content_alignment.py).
    Falls back to the metric-based report (no per-answer structure, no
    content alignment) for single-speaker recordings where there's no
    "question" to pair answers against.
    """
    if content_alignment:
        bundles = build_answer_bundles(content_alignment, sentences, nervous_energy)
        structured = build_structured_report(bundles, model=model, max_tokens=max_tokens)
        return {"markdown": render_report_markdown(structured), "structured": structured}

    metrics_summary = build_metrics_summary(transcript, sentences, pauses, acoustic_segments)
    markdown = synthesize_report(metrics_summary, model=model, max_tokens=max_tokens)
    return {"markdown": markdown, "structured": None}


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Synthesize a delivery feedback report via the Claude API.")
    parser.add_argument("--transcript", required=True, help="Path to Whisper transcript JSON")
    parser.add_argument("--sentences", required=True, help="Path to sentences JSON (from src.segment)")
    parser.add_argument("--pauses", required=True, help="Path to pauses JSON (from src.pause_detection)")
    parser.add_argument("--acoustic", default=None, help="Optional path to per-segment acoustic features JSON (from src.acoustic_features)")
    parser.add_argument("--content-alignment", default=None, help="Optional path to content alignment JSON (from src.content_alignment) -- enables the per-answer report")
    parser.add_argument("--nervous-energy", default=None, help="Optional path to nervous energy JSON (from src.nervous_energy)")
    parser.add_argument("--model", default=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL))
    parser.add_argument("--max-tokens", type=int, default=8192)
    parser.add_argument("--output", default=None, help="Output markdown path. Default: output/<stem>_report.md")
    parser.add_argument("--output-json", default=None, help="Optional output path for the structured JSON report (only produced in per-answer mode)")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY is not set (env var or .env file)")

    transcript = _load_json(args.transcript)
    sentences = _load_json(args.sentences)
    pauses = _load_json(args.pauses)
    acoustic_segments = _load_json(args.acoustic) if args.acoustic else None
    content_alignment = _load_json(args.content_alignment) if args.content_alignment else None
    nervous_energy = _load_json(args.nervous_energy) if args.nervous_energy else None

    output_path = args.output or _default_output_path(args.transcript)

    result = synthesize_full_report(
        transcript,
        sentences,
        pauses,
        acoustic_segments=acoustic_segments,
        content_alignment=content_alignment,
        nervous_energy=nervous_energy,
        model=args.model,
        max_tokens=args.max_tokens,
    )
    save_report(result["markdown"], output_path)
    print(f"Wrote report to {output_path} ({len(result['markdown'])} chars, model={args.model})")

    if result["structured"] is not None:
        json_output_path = args.output_json or output_path.replace(".md", ".json")
        Path(json_output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(json_output_path, "w") as f:
            json.dump(result["structured"], f, indent=2)
        print(f"Wrote structured report to {json_output_path}")


if __name__ == "__main__":
    main()
