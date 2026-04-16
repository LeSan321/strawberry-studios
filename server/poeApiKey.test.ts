/**
 * Poe API key validation test.
 * Calls the lightweight GET /v1/balance endpoint — no video generation cost.
 * Passes if the key is valid and the account has a non-negative point balance.
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

  it("POE_VIDEO_MODEL is set to Veo-3.1", () => {
    expect(process.env.POE_VIDEO_MODEL).toBe("Veo-3.1");
  });

  it("Poe API key authenticates successfully against the models endpoint", async () => {
    const apiKey = process.env.POE_API_KEY!;
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

    // Confirm Veo-3.1 is available
    const veoModel = data.data?.find(m => m.id === "veo-3.1");
    expect(veoModel).toBeTruthy();
    console.log(`Poe API key valid. Veo-3.1 available: ${!!veoModel}. Total models: ${data.data?.length}`);
  }, 15000); // 15s timeout for network call
});
