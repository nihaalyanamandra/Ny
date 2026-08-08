const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TrailingOff = {
  computed: boolean;
  energy_drop_db: number | null;
  pitch_drop_pct: number | null;
  trailing_off: boolean;
};

export type PauseBefore = {
  duration_ms: number;
  type: string;
} | null;

export type Sentence = {
  id: number;
  start: number;
  end: number;
  text: string;
  wpm: number | null;
  trailing_off: TrailingOff;
  pause_before: PauseBefore;
  pitch_instability_semitones: number | null;
  confidence_score: number | null;
  confidence_components: Record<string, number>;
};

export type JobResult = {
  report_markdown: string;
  sentences: Sentence[] | null;
};

export type Job = {
  job_id: string;
  status: "queued" | "processing" | "done" | "error";
  stage: string | null;
  result: JobResult | null;
  error: string | null;
};

export async function submitJob(file: File, whisperModel: string): Promise<{ job_id: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("whisper_model", whisperModel);

  const res = await fetch(`${API_URL}/jobs`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch job status (${res.status})`);
  }
  return res.json();
}
