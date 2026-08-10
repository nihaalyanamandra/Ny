"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Job, getJob } from "@/lib/api";
import ResultsView from "@/components/ResultsView";

type Phase = "loading" | "processing" | "done" | "error" | "not-found";

export default function ResultsPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [phase, setPhase] = useState<Phase>("loading");
  const [job, setJob] = useState<Job | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(() => {
    const tick = async () => {
      try {
        const latest = await getJob(jobId);
        setJob(latest);
        if (latest.status === "done") {
          setPhase("done");
          return;
        }
        if (latest.status === "error") {
          setPhase("error");
          setErrorMessage(latest.error || "Processing failed.");
          return;
        }
        setPhase("processing");
        pollTimer.current = setTimeout(tick, 2500);
      } catch (err) {
        if (err instanceof Error && err.message.includes("404")) {
          setPhase("not-found");
          return;
        }
        pollTimer.current = setTimeout(tick, 4000);
      }
    };
    tick();
  }, [jobId]);

  useEffect(() => {
    poll();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [poll]);

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center">
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
            &larr; Speech Delivery Analytics
          </Link>
        </header>

        {(phase === "loading" || phase === "processing") && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-8 text-center space-y-4">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-neutral-700 border-t-white animate-spin" />
            <p className="text-sm text-neutral-300">
              {phase === "loading" ? "Loading report…" : "Still processing…"}
            </p>
            <p className="text-xs text-neutral-500">
              This link updates automatically once the analysis finishes.
            </p>
          </div>
        )}

        {phase === "not-found" && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-8 text-center space-y-3">
            <p className="text-sm text-neutral-300">
              This report doesn&apos;t exist, or it has expired.
            </p>
            <p className="text-xs text-neutral-500">
              Reports aren&apos;t kept forever &mdash; if this link is old, the
              recording it was generated from would need to be re-analyzed.
            </p>
            <Link
              href="/"
              className="inline-block mt-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              Analyze a recording
            </Link>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-8 text-center space-y-3">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <Link
              href="/"
              className="inline-block rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              Analyze a recording
            </Link>
          </div>
        )}

        {phase === "done" && job?.result && <ResultsView result={job.result} />}
      </div>
    </div>
  );
}
