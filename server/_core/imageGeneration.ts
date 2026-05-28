/**
 * Image generation helper
 *
 * Primary provider: Runway ML Gen-4 Image (text_to_image)
 *   - POST /v1/text_to_image → { id }
 *   - Poll GET /v1/tasks/{id} → { status, output: [url] }
 *   - Uses ratio 1024:1024 (square, ideal for album cover art)
 *   - Requires RUNWAY_API_KEY env var
 *
 * Fallback provider: Manus built-in Forge ImageService
 *   - Used if RUNWAY_API_KEY is not set or Runway fails
 *   - Returns base64 image, uploaded to S3
 *
 * Example usage:
 *   const { url } = await generateImage({ prompt: "A serene landscape" });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

// ─── Runway ML Gen-4 Image ────────────────────────────────────────────────────

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION_HEADER = "2024-11-06";
const RUNWAY_POLL_INTERVAL_MS = 3000;
const RUNWAY_MAX_POLLS = 40; // 40 × 3s = 2 min max

async function generateImageViaRunway(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY is not configured");
  }

  // Submit the generation task
  const submitRes = await fetch(`${RUNWAY_API_BASE}/text_to_image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_VERSION_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gen4_image",
      promptText: options.prompt,
      ratio: "1024:1024", // Square — ideal for album cover art
    }),
  });

  if (!submitRes.ok) {
    const detail = await submitRes.text().catch(() => "");
    throw new Error(`Runway image submit failed (${submitRes.status} ${submitRes.statusText})${detail ? `: ${detail}` : ""}`);
  }

  const { id: taskId } = (await submitRes.json()) as { id: string };
  console.log(`[imageGeneration] Runway task submitted: ${taskId}`);

  // Poll until SUCCEEDED or FAILED
  for (let i = 0; i < RUNWAY_MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, RUNWAY_POLL_INTERVAL_MS));

    const pollRes = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION_HEADER,
      },
    });

    if (!pollRes.ok) {
      const detail = await pollRes.text().catch(() => "");
      throw new Error(`Runway task poll failed (${pollRes.status})${detail ? `: ${detail}` : ""}`);
    }

    const task = (await pollRes.json()) as {
      id: string;
      status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
      progress?: number;
      output?: string[];
      failure?: string;
    };

    console.log(`[imageGeneration] Runway task ${taskId} status: ${task.status} progress: ${(task.progress ?? 0).toFixed(2)}`);

    if (task.status === "SUCCEEDED") {
      const imageUrl = task.output?.[0];
      if (!imageUrl) {
        throw new Error("Runway task succeeded but output array is empty");
      }
      console.log(`[imageGeneration] Runway task ${taskId} succeeded: ${imageUrl}`);
      return { url: imageUrl };
    }

    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error(`Runway task ${task.status.toLowerCase()}: ${task.failure ?? "unknown reason"}`);
    }
  }

  throw new Error(`Runway image generation timed out after ${RUNWAY_MAX_POLLS * RUNWAY_POLL_INTERVAL_MS / 1000}s`);
}

// ─── Forge (Manus built-in) fallback ─────────────────────────────────────────

async function generateImageViaForge(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: { b64Json: string; mimeType: string };
  };
  const buffer = Buffer.from(result.image.b64Json, "base64");
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
  return { url };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const hasRunway = !!process.env.RUNWAY_API_KEY;

  if (hasRunway) {
    console.log("[imageGeneration] Using Runway ML gen4_image");
    return generateImageViaRunway(options);
  }

  // Fallback to Forge
  console.log("[imageGeneration] RUNWAY_API_KEY not set — falling back to Forge");
  return generateImageViaForge(options);
}
