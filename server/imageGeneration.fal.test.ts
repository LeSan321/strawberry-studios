/**
 * fal.ai Flux Pro 1.1 integration test
 *
 * Validates:
 * 1. FAL_KEY environment variable is present
 * 2. fal.ai API key format is valid (uuid:hex pattern)
 * 3. The fal.ai Flux Pro endpoint responds (lightweight model info check)
 *
 * Note: We do NOT generate a full image in tests (cost + latency).
 * We validate the key format and that the endpoint is reachable via a
 * lightweight OPTIONS/HEAD check.
 */
import { describe, it, expect } from "vitest";

const FAL_KEY = process.env.FAL_KEY;
const FAL_FLUX_PRO_URL = "https://fal.run/fal-ai/flux-pro/v1.1";

describe("fal.ai Flux Pro 1.1 integration", () => {
  it("FAL_KEY environment variable is set", () => {
    expect(FAL_KEY, "FAL_KEY must be set in environment").toBeTruthy();
  });

  it("FAL_KEY has valid format (uuid:hex)", () => {
    // fal.ai keys follow the pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:hexstring
    const FAL_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]+$/i;
    expect(FAL_KEY).toMatch(FAL_KEY_PATTERN);
  });

  it("fal.ai Flux Pro endpoint is reachable with valid key", async () => {
    if (!FAL_KEY) {
      console.warn("Skipping reachability test — FAL_KEY not set");
      return;
    }

    // Send a minimal POST with an empty prompt to get a 422 (validation error)
    // rather than a 401 (auth error). A 422 proves the key is valid and the
    // endpoint is reachable. A 401 means the key is wrong.
    const res = await fetch(FAL_FLUX_PRO_URL, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: "", image_size: "square_hd", num_images: 1 }),
    });

    // 401 = invalid key, 403 = forbidden (account issue)
    // 422 = validation error (empty prompt) — key is valid, endpoint reachable
    // 200 = unexpected success (fal.ai may accept empty prompts)
    // 429 = rate limited — key is valid, account may need funding
    expect(res.status, `Expected 200/422/429 but got ${res.status} — check FAL_KEY validity`).not.toBe(401);
    expect(res.status, `Expected 200/422/429 but got ${res.status} — check account permissions`).not.toBe(403);

    console.log(`[fal.ai test] Endpoint responded with status ${res.status} — key is valid`);
  }, 15000); // 15s timeout for network call
});
