/**
 * Cinématique Video Generation Adapter
 *
 * Pluggable video generation backend. The active provider is selected via
 * the VIDEO_PROVIDER environment variable (default: "mock").
 *
 * Supported providers:
 *   - "mock"   — returns a placeholder immediately (no API key required)
 *   - "runway" — Runway ML Gen-3 Alpha API
 *   - "kling"  — Kling AI video generation API
 *   - "luma"   — Luma Dream Machine API
 *
 * Architecture: all providers share the same VideoGenerationRequest /
 * VideoGenerationResult contract so the tRPC procedure never needs to
 * know which provider is active.
 */

export type VideoGenerationRequest = {
  /** The fully-assembled 10-layer Cinématique prompt */
  prompt: string;
  /** Duration in seconds (default: 10) */
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
  // Return a publicly accessible placeholder video so the UI has something to render
  return {
    status: "complete",
    jobId,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  };
}

// ─── Provider: Runway ML ──────────────────────────────────────────────────────

async function generateRunway(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY is not configured");

  const body: Record<string, unknown> = {
    promptText: req.prompt,
    model: "gen3a_turbo",
    duration: req.durationSeconds ?? 10,
    ratio: req.aspectRatio ?? "1280:768",
  };
  if (req.referenceImageUrl) {
    body.promptImage = req.referenceImageUrl;
  }

  const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Runway API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: string };
  // Runway returns a job ID — caller must poll for completion
  return { status: "queued", jobId: data.id };
}

// ─── Provider: Kling AI ───────────────────────────────────────────────────────

async function generateKling(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) throw new Error("KLING_API_KEY is not configured");

  const res = await fetch("https://api.klingai.com/v1/videos/text2video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "kling-v1",
      prompt: req.prompt,
      duration: req.durationSeconds ?? 10,
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

// ─── Provider: Luma Dream Machine ────────────────────────────────────────────

async function generateLuma(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not configured");

  const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: req.prompt,
      aspect_ratio: req.aspectRatio ?? "16:9",
      loop: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Luma API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: string };
  return { status: "queued", jobId: data.id };
}

// ─── Status Polling ───────────────────────────────────────────────────────────

export type VideoStatusResult =
  | { status: "complete"; videoUrl: string }
  | { status: "generating" | "queued" }
  | { status: "failed"; error: string };

export async function pollVideoStatus(
  provider: string,
  jobId: string
): Promise<VideoStatusResult> {
  switch (provider) {
    case "runway":
      return pollRunwayStatus(jobId);
    case "kling":
      return pollKlingStatus(jobId);
    case "luma":
      return pollLumaStatus(jobId);
    case "mock":
    default:
      // Mock is always immediately complete
      return {
        status: "complete",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      };
  }
}

async function pollRunwayStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY is not configured");

  const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": "2024-11-06",
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Runway poll error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    status: string;
    output?: string[];
    failure?: string;
  };

  if (data.status === "SUCCEEDED" && data.output?.[0]) {
    return { status: "complete", videoUrl: data.output[0] };
  }
  if (data.status === "FAILED") {
    return { status: "failed", error: data.failure ?? "Runway generation failed" };
  }
  return { status: "generating" };
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

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function getActiveProvider(): string {
  return process.env.VIDEO_PROVIDER ?? "mock";
}

export async function generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  const provider = getActiveProvider();

  switch (provider) {
    case "runway":
      return generateRunway(req);
    case "kling":
      return generateKling(req);
    case "luma":
      return generateLuma(req);
    case "mock":
    default:
      return generateMock(req);
  }
}
