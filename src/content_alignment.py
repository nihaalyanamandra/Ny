"""Pairs each of the candidate's answers with the interviewer's immediately
preceding question, then asks Claude to assess whether the answer actually
addressed it.

Requires diarization output (src/diarize.py, run separately from the
.venv-diarize environment -- see that module's docstring) since Whisper's
transcript alone has no speaker labels; both speakers' words are already
in the transcript (transcribe.py doesn't filter by speaker), they're just
not attributed to anyone.

Usage:
    python -m src.content_alignment --transcript transcript.json
        --diarization diarization.json [--candidate-speaker SPEAKER_00]
        [--output out.json]

If --candidate-speaker is omitted, guesses the speaker with the most total
speaking time (see src/diarize.py's guess_candidate_speaker) -- verify this
guess before trusting the output; it's a heuristic, not a certainty.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv

DEFAULT_MODEL = "claude-sonnet-5"

# Turns shorter than this, from EITHER speaker, are treated as backchannel
# ("okay", "I see", "right", "yeah") rather than a real question or a real
# answer -- based on this pipeline's own diarization output on a real
# interview recording, interviewer turn durations cluster heavily under
# ~1s (backchannels) with a separate cluster of substantive questions
# starting around 2-3s+. Applied symmetrically: a bare "yeah" from the
# CANDIDATE isn't a distinct answer worth running through alignment
# assessment either, it's just a spoken acknowledgment. Without this
# filter, one long candidate answer gets fragmented into dozens of
# spurious "question/answer" pairs at every "okay" either person says
# while the other is talking.
#
# KNOWN LIMITATION this does NOT fix: diarization has a "cold start"
# problem at the very beginning of a recording -- the model needs some
# audio before it reliably separates speakers, so the first few seconds
# occasionally get attributed to the wrong speaker even when they're not
# short enough to be caught by this filter. Observed in testing: the first
# ~5 seconds of a real recording (clearly the candidate's own words,
# verified by content) got tagged as the interviewer. This surfaces as a
# nonsensical first pair; if you see one, that's why -- not a bug in the
# pairing logic below.
BACKCHANNEL_MAX_S = 2.0


def assign_speakers_to_words(words: list[dict[str, Any]], turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Adds a "speaker" key to each word, from whichever diarization turn
    contains the word's midpoint. Falls back to the nearest turn (by
    distance from the word's midpoint to the turn's [start, end]) for
    words that land in a small gap between turns -- diarization and
    Whisper's VAD-derived word boundaries don't perfectly agree on
    silence/speech edges any more than webrtcvad and Whisper's timestamps
    do (see pause_detection.py)."""
    out = []
    for w in words:
        mid = (w["start"] + w["end"]) / 2
        speaker = None
        best_dist = None
        for t in turns:
            if t["start"] <= mid <= t["end"]:
                speaker = t["speaker"]
                break
            dist = t["start"] - mid if mid < t["start"] else mid - t["end"]
            if best_dist is None or dist < best_dist:
                best_dist = dist
                speaker = t["speaker"]
        out.append({**w, "speaker": speaker})
    return out


def build_raw_turns(words_with_speaker: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merges consecutive same-speaker words into turns -- purely by
    speaker identity, no punctuation/pause/duration splitting (unlike
    segment.py's sentences, a "turn" here should span everything one
    person said before the other one started, however long)."""
    turns: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_speaker = None
    for w in words_with_speaker:
        if w["speaker"] != current_speaker and current:
            turns.append(_finalize_turn(current, current_speaker))
            current = []
        current_speaker = w["speaker"]
        current.append(w)
    if current:
        turns.append(_finalize_turn(current, current_speaker))
    return turns


def _finalize_turn(words: list[dict[str, Any]], speaker: str | None) -> dict[str, Any]:
    return {
        "speaker": speaker,
        "start": words[0]["start"],
        "end": words[-1]["end"],
        "text": " ".join(w["word"] for w in words),
    }


def filter_backchannels(
    turns: list[dict[str, Any]],
    backchannel_max_s: float = BACKCHANNEL_MAX_S,
) -> list[dict[str, Any]]:
    """Drops short turns from EITHER speaker (backchannels), then re-merges
    any same-speaker turns that become adjacent as a result -- a "yeah" or
    "I see" mid-answer shouldn't split one continuous turn into two."""
    kept = [t for t in turns if (t["end"] - t["start"]) >= backchannel_max_s]

    merged: list[dict[str, Any]] = []
    for t in kept:
        if merged and merged[-1]["speaker"] == t["speaker"]:
            merged[-1] = {
                "speaker": t["speaker"],
                "start": merged[-1]["start"],
                "end": t["end"],
                "text": merged[-1]["text"] + " " + t["text"],
            }
        else:
            merged.append(dict(t))
    return merged


def pair_answers_with_questions(turns: list[dict[str, Any]], candidate_speaker: str) -> list[dict[str, Any]]:
    """For each candidate turn (after backchannel filtering), the "question"
    is the immediately preceding non-candidate turn's text, if any."""
    pairs = []
    preceding_question: dict[str, Any] | None = None
    for t in turns:
        if t["speaker"] == candidate_speaker:
            pairs.append(
                {
                    "question_text": preceding_question["text"] if preceding_question else None,
                    "question_start": preceding_question["start"] if preceding_question else None,
                    "question_end": preceding_question["end"] if preceding_question else None,
                    "answer_text": t["text"],
                    "answer_start": t["start"],
                    "answer_end": t["end"],
                }
            )
            preceding_question = None
        else:
            preceding_question = t
    return pairs


ALIGNMENT_SYSTEM_PROMPT = """\
You assess whether an interview candidate's answer actually addressed the \
question they were asked, in a mock/practice interview transcript. You are \
given one interviewer question/prompt and the candidate's answer that \
followed it (auto-transcribed, so expect disfluencies, filler words, and \
occasional transcription errors -- read through those, don't flag them).

For the given pair, assess:
1. What the interviewer was actually asking for -- the explicit ask, plus \
any implicit expectation based on how the question was framed (e.g. a \
question framed around a specific trade-off implies they want that \
trade-off addressed, not just a general answer to the topic).
2. Whether the answer addressed it: "direct" (fully addressed what was \
asked), "partial" (addressed some of it but drifted, skipped part of the \
ask, or got lost in unnecessary detail before/instead of reaching the \
point), or "missed" (didn't actually answer what was asked, even if it \
was a reasonable-sounding response to something).
3. If partial or missed: exactly where and how it drifted, what was \
skipped, or where the candidate got stuck in unnecessary detail instead \
of reaching the actual point.
4. What a strong answer would have specifically hit, given what THIS \
interviewer seemed to be probing for with THIS question -- not a generic \
ideal answer to the general topic.

Respond with ONLY a JSON object, no other text, matching this shape:
{
  "implicit_ask": "<one sentence: what was really being asked>",
  "alignment": "direct" | "partial" | "missed",
  "gap_description": "<specific, or null if alignment is direct>",
  "strong_answer_would_have": "<specific to this question, or null if alignment is direct>"
}"""


def assess_alignment(pair: dict[str, Any], client: Anthropic, model: str) -> dict[str, Any]:
    question = pair["question_text"] or "(no preceding interviewer question captured -- likely the recording's opening or a continuation)"
    user_message = f"INTERVIEWER: {question}\n\nCANDIDATE'S ANSWER: {pair['answer_text']}"

    message = client.messages.create(
        model=model,
        max_tokens=1024,
        # See synthesize.py's synthesize_report for why this matters here
        # especially: max_tokens=1024 is small, so if thinking were left
        # enabled it could plausibly consume the whole budget and leave
        # nothing for the JSON response -- which the except clause below
        # would silently turn into a fake "unknown" alignment verdict for
        # every single pair, not a loud failure. That's a worse outcome
        # than synthesize_report's empty-string case, since it looks like
        # a real (if unhelpful) result instead of an obvious error.
        thinking={"type": "disabled"},
        system=ALIGNMENT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    raw_text = "".join(block.text for block in message.content if block.type == "text")
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        parsed = {"implicit_ask": None, "alignment": "unknown", "gap_description": raw_text, "strong_answer_would_have": None}

    return {
        "question": pair["question_text"],
        "timestamp_range": {
            "question_start": pair["question_start"],
            "question_end": pair["question_end"],
            "answer_start": pair["answer_start"],
            "answer_end": pair["answer_end"],
        },
        "answer_preview": pair["answer_text"][:200],
        **parsed,
    }


def build_content_alignment(
    transcript: dict[str, Any],
    diarization_turns: list[dict[str, Any]],
    candidate_speaker: str | None = None,
    model: str = DEFAULT_MODEL,
    backchannel_max_s: float = BACKCHANNEL_MAX_S,
) -> list[dict[str, Any]]:
    from src.diarize import guess_candidate_speaker

    if candidate_speaker is None:
        candidate_speaker = guess_candidate_speaker(diarization_turns)
        if candidate_speaker is None:
            raise ValueError("Could not determine candidate speaker (no diarization turns)")

    words = [w for seg in transcript["segments"] for w in seg.get("words", [])]
    words_with_speaker = assign_speakers_to_words(words, diarization_turns)
    raw_turns = build_raw_turns(words_with_speaker)
    filtered_turns = filter_backchannels(raw_turns, backchannel_max_s)
    pairs = pair_answers_with_questions(filtered_turns, candidate_speaker)

    client = Anthropic()
    return [assess_alignment(pair, client, model) for pair in pairs]


def save_alignment(alignment: list[dict[str, Any]], output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(alignment, f, indent=2)


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Assess content alignment between interviewer questions and candidate answers.")
    parser.add_argument("--transcript", required=True, help="Path to Whisper transcript JSON")
    parser.add_argument("--diarization", required=True, help="Path to diarization JSON (from src.diarize)")
    parser.add_argument("--candidate-speaker", default=None, help="Override the auto-guessed candidate speaker label (e.g. SPEAKER_00)")
    parser.add_argument("--model", default=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL))
    parser.add_argument("--backchannel-max-s", type=float, default=BACKCHANNEL_MAX_S)
    parser.add_argument("--output", default="output/content_alignment.json")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY is not set (env var or .env file)")

    with open(args.transcript) as f:
        transcript = json.load(f)
    with open(args.diarization) as f:
        diarization_turns = json.load(f)

    alignment = build_content_alignment(
        transcript,
        diarization_turns,
        candidate_speaker=args.candidate_speaker,
        model=args.model,
        backchannel_max_s=args.backchannel_max_s,
    )
    save_alignment(alignment, args.output)

    print(f"Assessed {len(alignment)} question/answer pairs")
    counts: dict[str, int] = {}
    for a in alignment:
        counts[a["alignment"]] = counts.get(a["alignment"], 0) + 1
    print(f"  {counts}")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
