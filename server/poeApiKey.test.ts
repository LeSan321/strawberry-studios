/**
 * Poe API key validation test.
 * Calls the lightweight GET /v1/models endpoint — no video generation cost.
 * Passes if the key is valid and the configured model is available.
 */

import { describe, it, expect } from "vitest";

describe("Poe API key validation", () => {
  it("POE_API_KEY is set in the environment", () => {
    expect(process.env.POE_API_KEY).toBeTruthy();
    expect(process.env.POE_API_KEY).toMatch(/^sk-poe-/);
  });

  it("VIDEO_PROVIDER is set to poe", () => {
    expect(process.env.VIDEO_PROVIDER).toBe("poe");
  });

  it("POE_VIDEO_MODEL is set to a supported cinematic video model", () => {
    // Valid cinematic video models available via Poe API
    // Switched from Veo-3.1 to kling-v3-pro (no Vertex AI content restrictions)
    const validModels = [
      "Veo-3.1", "Veo-3.1-Fast", "veo-3.1", "veo-3.1-fast",
      "kling-v3-pro", "kling-v3", "kling-2.6-pro",
      "runway-gen-4.5", "runway-gen-4-turbo",
      "sora-2", "sora-2-pro",
    ];
    expect(validModels).toContain(process.env.POE_VIDEO_MODEL);
  });

  it("Poe API key authenticates successfully and configured model is available", async () => {
    const apiKey = process.env.POE_API_KEY!;
    const configuredModel = process.env.POE_VIDEO_MODEL ?? "kling-v3-pro";

    const res = await fetch("https://api.poe.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    // 200 = valid key, 401 = invalid key
    expect(res.status).toBe(200);

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    expect(Array.isArray(data.data)).toBe(true);

    // Confirm the configured model is available
    const modelAvailable = data.data?.find(m => m.id === configuredModel);
    expect(modelAvailable).toBeTruthy();
    console.log(`Poe API key valid. Model '${configuredModel}' available: ${!!modelAvailable}. Total models: ${data.data?.length}`);
  }, 15000); // 15s timeout for network call
});
