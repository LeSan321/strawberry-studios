/**
 * Image generation helper
 *
 * Provider priority:
 *   1. fal.ai Flux Pro 1.1 (primary)  — requires FAL_KEY env var
 *   2. Runway ML Gen-4 Image (fallback) — requires RUNWAY_API_KEY env var
 *   3. Manus built-in Forge ImageService (last resort)
 *
 * Override via IMAGE_PROVIDER env var: "fal" | "runway" | "forge"
 *
 * ALL providers: after generation, the ephemeral provider URL is immediately
 * downloaded and re-uploaded to permanent S3 storage via storagePut().
 * The returned { url } is always a permanent, non-expiring URL.
 * This prevents Runway/fal.ai JWT-signed CloudFront URLs from expiring in the DB.
 *
 * fal.ai Flux Pro 1.1:
 *   - POST https://fal.run/fal-ai/flux-pro/v1.1
 *   - Returns { images: [{ url }] } synchronously (no polling needed)
 *   - image_size: "square_hd" (1024×1024) — ideal for album cover art
 *   - Requires FAL_KEY env var
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

// ─── Permanent URL helper ─────────────────────────────────────────────────────

/**
 * Download an image from an ephemeral provider URL and re-upload to permanent S3.
 * Returns the permanent URL. Falls back to the original URL if upload fails
 * (so generation still succeeds even if storage is temporarily unavailable).
 */
async function makePermanent(ephemeralUrl: string, provider: string): Promise<string> {
  try {
    const res = await fetch(ephemeralUrl);
    if (!res.ok) {
      throw new Error(`Failed to download image from ${provider}: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const key = `cover-art/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { url } = await storagePut(key, buffer, contentType);
    console.log(`[imageGeneration] Permanent S3 upload succeeded: ${url}`);
    return url;
  } catch (err) {
    console.error(`[imageGeneration] WARNING: permanent S3 upload failed, returning ephemeral URL. Error: ${err}`);
    // Graceful degradation — return the original URL so generation still succeeds
    return ephemeralUrl;
  }
}

// ─── fal.ai Flux Pro 1.1 ─────────────────────────────────────────────────────

const FAL_FLUX_PRO_URL = "https://fal.run/fal-ai/flux-pro/v1.1";

async function generateImageViaFal(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error("FAL_KEY is not configured");
  }

  const res = await fetch(FAL_FLUX_PRO_URL, {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: options.prompt,
      image_size: "square_hd",   // 1024×1024 — ideal for album cover art
      num_images: 1,
      safety_tolerance: "2",     // balanced: blocks explicit content, allows creative/artistic
      output_format: "jpeg",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fal.ai Flux submit failed (${res.status} ${res.statusText})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await res.json()) as {
    images?: Array<{ url: string; width: number; height: number; content_type: string }>;
    image?: { url: string };
  };

  // fal.ai returns { images: [{ url }] }
  const imageUrl = result.images?.[0]?.url ?? result.image?.url;
  if (!imageUrl) {
    throw new Error(`fal.ai Flux returned no image URL. Response: ${JSON.stringify(result)}`);
  }

  console.log(`[imageGeneration] fal.ai Flux Pro 1.1 succeeded: ${imageUrl}`);
  const permanentUrl = await makePermanent(imageUrl, "fal.ai");
  return { url: permanentUrl };
}

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
      const permanentUrl = await makePermanent(imageUrl, "Runway");
      return { url: permanentUrl };
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
  // Forge already returns bytes — upload directly to permanent S3
  const { url } = await storagePut(`cover-art/${Date.now()}-${Math.random().toString(36).slice(2)}.png`, buffer, result.image.mimeType);
  return { url };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // Allow explicit override via IMAGE_PROVIDER env var
  const provider = process.env.IMAGE_PROVIDER?.toLowerCase();

  if (provider === "runway") {
    console.log("[imageGeneration] Using Runway ML gen4_image (IMAGE_PROVIDER=runway)");
    return generateImageViaRunway(options);
  }

  if (provider === "forge") {
    console.log("[imageGeneration] Using Forge (IMAGE_PROVIDER=forge)");
    return generateImageViaForge(options);
  }

  // Default: fal.ai Flux Pro 1.1 → Runway → Forge
  if (process.env.FAL_KEY) {
    console.log("[imageGeneration] Using fal.ai Flux Pro 1.1");
    return generateImageViaFal(options);
  }

  if (process.env.RUNWAY_API_KEY) {
    console.log("[imageGeneration] FAL_KEY not set — falling back to Runway ML gen4_image");
    return generateImageViaRunway(options);
  }

  // Last resort: Forge
  console.log("[imageGeneration] No image provider keys set — falling back to Forge");
  return generateImageViaForge(options);
}
