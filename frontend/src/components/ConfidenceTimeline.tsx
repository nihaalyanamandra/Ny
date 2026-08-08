"use client";

import { Sentence } from "@/lib/api";

function scoreColor(score: number): string {
  // 1 -> red, 5.5 -> amber, 10 -> green. Simple 3-stop lerp in RGB.
  const stops = [
    { at: 1, rgb: [239, 68, 68] },
    { at: 5.5, rgb: [245, 158, 11] },
    { at: 10, rgb: [34, 197, 94] },
  ];
  const clamped = Math.max(1, Math.min(10, score));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].at && clamped <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = hi.at === lo.at ? 0 : (clamped - lo.at) / (hi.at - lo.at);
  const rgb = lo.rgb.map((c, i) => Math.round(c + (hi.rgb[i] - c) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ConfidenceTimeline({ sentences }: { sentences: Sentence[] }) {
  const scored = sentences.filter((s) => s.confidence_score !== null);
  if (scored.length === 0) return null;

  const totalDuration = sentences[sentences.length - 1].end - sentences[0].start;

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-300 mb-2">
        Confidence over time
      </h3>
      <div className="flex h-10 w-full overflow-hidden rounded-md border border-neutral-800">
        {sentences.map((s) => {
          const widthPct = ((s.end - s.start) / totalDuration) * 100;
          const score = s.confidence_score;
          const tooltip = `${formatTime(s.start)}–${formatTime(s.end)}  |  confidence: ${
            score ?? "n/a"
          }${s.trailing_off.trailing_off ? "  |  TRAILING OFF" : ""}\n${s.text.slice(0, 120)}`;
          return (
            <div
              key={s.id}
              title={tooltip}
              className="h-full border-r border-black/20 last:border-r-0"
              style={{
                width: `${widthPct}%`,
                minWidth: "2px",
                backgroundColor: score !== null ? scoreColor(score) : "#3f3f46",
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-neutral-500 mt-1">
        <span>{formatTime(sentences[0].start)}</span>
        <span>{formatTime(sentences[sentences.length - 1].end)}</span>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scoreColor(2) }} />
          Low confidence
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scoreColor(5.5) }} />
          Mixed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scoreColor(9) }} />
          Confident
        </span>
      </div>
    </div>
  );
}
