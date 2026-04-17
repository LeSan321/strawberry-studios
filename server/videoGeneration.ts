/**
 * Cinématique Video Generation Adapter
 *
 * Pluggable video generation backend. The active provider is selected via
 * the VIDEO_PROVIDER environment variable (default: "mock").
 *
 * Supported providers:
 *   - "mock"   — returns a placeholder immediately (no API key required)
 *   - "runway" — Runway ML Gen-4.5 direct API (api.dev.runwayml.com) — ACTIVE
 *   - "poe"    — Poe API (legacy, kept for reference)
 *   - "kling"  — Kling AI video generation API
 *   - "luma"   — Luma Dream Machine API
 *
 * Runway ML setup:
 *   - Set VIDEO_PROVIDER=runway and RUNWAY_API_KEY to your Runway API key
 *   - Uses model gen4.5, duration 5s, ratio 1280:720 (landscape HD)
 *   - Submit: POST /v1/text_to_video → returns { id: "task-uuid" }
 *   - Poll:   GET  /v1/tasks/{id}    → { status: "RUNNING"|"SUCCEEDED"|"FAILED", progress, output? }
 *   - On SUCCEEDED: video URL is in output[0] — no S3 download needed
 *
 * Architecture: all providers share the same VideoGenerationRequest /
 * VideoGenerationResult contract so the tRPC procedure never needs to
 * know which provider is active.
 */

import { storagePut } from "./storage";

export type VideoGenerationRequest = {
  /** The fully-assembled 10-layer Cinématique prompt */
  prompt: string;
  /** Duration in seconds (gen4.5 supports 5 or 10; default: 5) */
  durationSeconds?: number;
  /** Aspect ratio (default: "16:9") */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Optional reference image URL (for image-to-video providers) */
  referenceImageUrl?: string;
};

export type VideoGenerationResult =
  | { status: "complete"; videoUrl: string; jobId: string }
  | { status: "queued"; jobId: string }
  | { status: "failed"; error: string };

// ─── Provider: Mock ───────────────────────────────────────────────────────────

async function generateMock(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  // Simulate a short async delay, then return a placeholder video URL
  await new Promise(r => setTimeout(r, 500));
  const jobId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    status: "complete",
    jobId,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  };
}

// ─── Provider: Runway ML (Direct API) ────────────────────────────────────────

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION_HEADER = "2024-11-06";

/**
 * Map our aspect ratio enum to Runway's ratio format (WIDTHxHEIGHT).
 * gen4.5 supports: "1280:720" (landscape) and "720:1280" (portrait).
 */
function runwayRatio(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "9:16":
      return "720:1280";
    case "1:1":
      return "1280:720"; // gen4.5 doesn't support square; fall back to landscape
    case "16:9":
    default:
      return "1280:720";
  }
}

/**
 * gen4.5 only accepts duration values of 5 or 10.
 * We default to 5 to keep costs low; caller can pass 10 for longer clips.
 */
function runwayDuration(durationSeconds?: number): number {
  if (durationSeconds && durationSeconds >= 8) return 10;
  return 5;
}

async function generateRunway(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY is not configured");

  const duration = runwayDuration(req.durationSeconds);
  const ratio = runwayRatio(req.aspectRatio);

  const body: Record<string, unknown> = {
    model: "gen4.5",
    promptText: req.prompt,
    duration,
    ratio,
  };

  console.log(
    `[Runway Video] Submitting: model=gen4.5 duration=${duration}s ratio=${ratio} promptLength=${req.prompt.length}`
  );

  const res = await fetch(`${RUNWAY_API_BASE}/text_to_video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_VERSION_HEADER,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Runway API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: string };
  console.log(`[Runway Video] Task submitted: id=${data.id}`);
  return { status: "queued", jobId: data.id };
}

async function pollRunwayStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY is not configured");

  const res = await fetch(`${RUNWAY_API_BASE}/tasks/${jobId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_VERSION_HEADER,
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Runway poll error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: "RUNNING" | "SUCCEEDED" | "FAILED" | "PENDING" | "THROTTLED" | "CANCELLED";
    progress?: number;
    output?: string[];
    failure?: string;
    failureCode?: string;
  };

  console.log(
    `[Runway Poll] id=${data.id} status=${data.status} progress=${((data.progress ?? 0) * 100).toFixed(1)}%`
  );

  if (data.status === "SUCCEEDED" && data.output?.[0]) {
    // Video URL is returned directly in output[0] — no S3 download needed
    return { status: "complete", videoUrl: data.output[0] };
  }
  if (data.status === "FAILED" || data.status === "CANCELLED") {
    const reason = data.failure ?? data.failureCode ?? "Runway generation failed";
    return { status: "failed", error: reason };
  }
  // RUNNING, PENDING, THROTTLED → still in progress
  return { status: "generating", progress: data.progress };
}

// ─── Provider: Poe API (legacy) ───────────────────────────────────────────────

const POE_API_BASE = "https://api.poe.com/v1";

async function generatePoe(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.POE_API_KEY;
  if (!apiKey) throw new Error("POE_API_KEY is not configured");

  const model = process.env.POE_VIDEO_MODEL ?? "runway-gen-4.5";

  const sizeMap: Record<string, string> = {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "720x720",
  };
  const size = sizeMap[req.aspectRatio ?? "16:9"] ?? "1280x720";
  const seconds = req.durationSeconds ?? 5;

  const body: Record<string, unknown> = { model, prompt: req.prompt, seconds, size };

  console.log(`[Poe Video] Sending request: model=${model} seconds=${seconds} size=${size}`);

  const res = await fetch(`${POE_API_BASE}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Poe API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: string; status: string };
  return { status: "queued", jobId: data.id };
}

async function pollPoeStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.POE_API_KEY;
  if (!apiKey) throw new Error("POE_API_KEY is not configured");

  const res = await fetch(`${POE_API_BASE}/videos/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Poe poll error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: "queued" | "in_progress" | "completed" | "failed";
    error?: { code?: number; message?: string };
  };

  if (data.status === "completed") {
    const videoUrl = await downloadPoeVideoToS3(jobId, apiKey);
    return { status: "complete", videoUrl };
  }
  if (data.status === "failed") {
    return { status: "failed", error: data.error?.message ?? "Poe video generation failed" };
  }
  return { status: "generating" };
}

async function downloadPoeVideoToS3(jobId: string, apiKey: string): Promise<string> {
  const res = await fetch(`${POE_API_BASE}/videos/${jobId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "video/mp4" },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Poe content download error (${res.status}): ${detail}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const key = `cinematique-videos/${jobId}-${Date.now()}.mp4`;
  const { url } = await storagePut(key, buffer, "video/mp4");
  return url;
}

// ─── Provider: Kling AI ───────────────────────────────────────────────────────

async function generateKling(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) throw new Error("KLING_API_KEY is not configured");

  const res = await fetch("https://api.klingai.com/v1/videos/text2video", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "kling-v1",
      prompt: req.prompt,
      duration: req.durationSeconds ?? 5,
      aspect_ratio: req.aspectRatio ?? "16:9",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Kling API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { data: { task_id: string } };
  return { status: "queued", jobId: data.data.task_id };
}

async function pollKlingStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) throw new Error("KLING_API_KEY is not configured");

  const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Kling poll error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    data: { task_status: string; task_result?: { videos?: Array<{ url: string }> } };
  };

  const task = data.data;
  if (task.task_status === "succeed" && task.task_result?.videos?.[0]) {
    return { status: "complete", videoUrl: task.task_result.videos[0].url };
  }
  if (task.task_status === "failed") {
    return { status: "failed", error: "Kling generation failed" };
  }
  return { status: "generating" };
}

// ─── Provider: Luma Dream Machine ────────────────────────────────────────────

async function generateLuma(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not configured");

  const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "16:9", loop: false }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Luma API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: string };
  return { status: "queued", jobId: data.id };
}

async function pollLumaStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not configured");

  const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Luma poll error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    state: string;
    assets?: { video?: string };
    failure_reason?: string;
  };

  if (data.state === "completed" && data.assets?.video) {
    return { status: "complete", videoUrl: data.assets.video };
  }
  if (data.state === "failed") {
    return { status: "failed", error: data.failure_reason ?? "Luma generation failed" };
  }
  return { status: "generating" };
}

// ─── Status Polling ───────────────────────────────────────────────────────────

export type VideoStatusResult =
  | { status: "complete"; videoUrl: string }
  | { status: "generating" | "queued"; progress?: number }
  | { status: "failed"; error: string };

export async function pollVideoStatus(
  provider: string,
  jobId: string
): Promise<VideoStatusResult> {
  switch (provider) {
    case "runway":
      return pollRunwayStatus(jobId);
    case "poe":
      return pollPoeStatus(jobId);
    case "kling":
      return pollKlingStatus(jobId);
    case "luma":
      return pollLumaStatus(jobId);
    case "mock":
    default:
      return {
        status: "complete",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      };
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function getActiveProvider(): string {
  return process.env.VIDEO_PROVIDER ?? "mock";
}

export async function generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const provider = getActiveProvider();

  switch (provider) {
    case "runway":
      return generateRunway(req);
    case "poe":
      return generatePoe(req);
    case "kling":
      return generateKling(req);
    case "luma":
      return generateLuma(req);
    case "mock":
    default:
      return generateMock(req);
  }
}
