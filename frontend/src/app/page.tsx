"use client";

import { useCallback, useRef, useState } from "react";
import { Job, getJob, submitJob } from "@/lib/api";
import ResultsView from "@/components/ResultsView";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

const WHISPER_MODELS = ["tiny", "base", "small", "medium"] as const;

const STAGE_LABELS: Record<string, string> = {
  "[1/5]": "Transcribing audio",
  "[2/5]": "Extracting acoustic features (pitch, energy, jitter, shimmer)",
  "[3/5]": "Detecting pauses and hesitation",
  "[4/5]": "Segmenting into sentences and scoring delivery",
  "[5/5]": "Writing your feedback report",
};

function friendlyStage(stage: string | null): string {
  if (!stage) return "Starting…";
  for (const [prefix, label] of Object.entries(STAGE_LABELS)) {
    if (stage.startsWith(prefix)) return label;
  }
  if (stage.startsWith("Done")) return "Finalizing…";
  return stage;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [whisperModel, setWhisperModel] = useState<string>("base");
  const [job, setJob] = useState<Job | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyShareLink = async () => {
    if (!job) return;
    const shareUrl = `${window.location.origin}/results/${job.job_id}`;
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const poll = useCallback((jobId: string) => {
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
      } catch {
        pollTimer.current = setTimeout(tick, 4000);
      }
    };
    tick();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setErrorMessage(null);
    setJob(null);
    setPhase("uploading");
    try {
      const { job_id } = await submitJob(file, whisperModel);
      setPhase("processing");
      poll(job_id);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const reset = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setPhase("idle");
    setFile(null);
    setJob(null);
    setErrorMessage(null);
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Speech Delivery Analytics
          </h1>
          <p className="mt-2 text-neutral-400 text-sm sm:text-base">
            Upload a practice recording. Get specific, timestamped feedback on
            pacing, hesitation, and confidence &mdash; not what you said, how it sounded.
          </p>
        </header>

        {(phase === "idle" || phase === "uploading") && (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-6 sm:p-8 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Audio recording
              </label>
              <input
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.aac,.webm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-neutral-800 file:text-neutral-100 hover:file:bg-neutral-700 file:cursor-pointer cursor-pointer"
              />
              {file && (
                <p className="mt-2 text-xs text-neutral-500">
                  {file.name} &middot; {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Transcription model
              </label>
              <select
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
              >
                {WHISPER_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === "base" ? "(recommended)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-neutral-500">
                Larger models are more accurate but slower to process.
              </p>
            </div>

            <button
              type="submit"
              disabled={!file || phase === "uploading"}
              className="w-full rounded-lg bg-white text-black font-medium py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-200 transition-colors"
            >
              {phase === "uploading" ? "Uploading…" : "Analyze recording"}
            </button>

            {errorMessage && (
              <p className="text-sm text-red-400">{errorMessage}</p>
            )}
          </form>
        )}

        {phase === "processing" && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-8 text-center space-y-4">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-neutral-700 border-t-white animate-spin" />
            <p className="text-sm text-neutral-300">{friendlyStage(job?.stage ?? null)}</p>
            <p className="text-xs text-neutral-500">
              This can take a few minutes depending on recording length and model size.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-8 text-center space-y-4">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              onClick={reset}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              Try again
            </button>
          </div>
        )}

        {phase === "done" && job?.result && (
          <div className="space-y-8">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                Share this report (e.g. with an interviewer) via a link &mdash;
                no account needed to view it.
              </p>
              <button
                onClick={copyShareLink}
                className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
              >
                {linkCopied ? "Copied!" : "Copy link"}
              </button>
            </div>

            <ResultsView result={job.result} />

            <div className="text-center">
              <button
                onClick={reset}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                Analyze another recording
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
