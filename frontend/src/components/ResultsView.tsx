import ReactMarkdown from "react-markdown";
import { JobResult } from "@/lib/api";
import ConfidenceTimeline from "@/components/ConfidenceTimeline";

export default function ResultsView({ result }: { result: JobResult }) {
  return (
    <div className="space-y-8">
      {result.sentences && result.sentences.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-6">
          <ConfidenceTimeline sentences={result.sentences} />
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-6 sm:p-8">
        <div className="prose-report">
          <ReactMarkdown>{result.report_markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
