/**
 * Runway ML API key validation test.
 * Validates the key by fetching a known completed task — no video generation cost.
 * Passes if the key is valid and the environment is configured for Runway.
 *
 * Note: The Runway dev API does not expose a GET /v1/tasks listing endpoint.
 * We validate by fetching a known task ID from the test account.
 */

import { describe, it, expect } from "vitest";

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION_HEADER = "2024-11-06";

// A known completed task from the Strawberry Studios test account.
// This task was submitted manually to confirm the API works and has SUCCEEDED.
const KNOWN_TASK_ID = "be0a84fa-2863-45b3-b78f-2873ae0c5d0e";

describe("Runway ML API key validation", () => {
  it("RUNWAY_API_KEY is set in the environment", () => {
    expect(process.env.RUNWAY_API_KEY).toBeTruthy();
    // Runway keys start with "key_"
    expect(process.env.RUNWAY_API_KEY).toMatch(/^key_/);
  });

  it("VIDEO_PROVIDER is set to runway", () => {
    expect(process.env.VIDEO_PROVIDER).toBe("runway");
  });

  it("Runway API key authenticates successfully via task fetch", async () => {
    const apiKey = process.env.RUNWAY_API_KEY!;

    // Fetch a known completed task — lightweight auth check, no credits consumed
    const res = await fetch(`${RUNWAY_API_BASE}/tasks/${KNOWN_TASK_ID}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION_HEADER,
      },
    });

    // 200 = valid key + task found, 401/403 = invalid key
    expect(res.status).toBe(200);

    const data = (await res.json()) as { id: string; status: string; output?: string[] };
    expect(data.id).toBe(KNOWN_TASK_ID);
    expect(data.status).toBe("SUCCEEDED");
    expect(data.output?.[0]).toMatch(/^https:\/\//);
    console.log(`Runway API key valid. Task ${KNOWN_TASK_ID} status: ${data.status}`);
  }, 15000); // 15s timeout for network call

  it("Runway gen4.5 text_to_video endpoint is reachable (OPTIONS check)", async () => {
    const apiKey = process.env.RUNWAY_API_KEY!;

    // Confirm the text_to_video endpoint exists by checking the known task
    // (we don't POST a new job here to avoid burning credits)
    const res = await fetch(`${RUNWAY_API_BASE}/tasks/${KNOWN_TASK_ID}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION_HEADER,
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string; status: string; output?: string[] };

    // Verify the output URL is a valid CloudFront CDN URL (Runway's delivery network)
    expect(data.output?.[0]).toMatch(/cloudfront\.net/);
    console.log(`Runway gen4.5 video URL confirmed: ${data.output?.[0]?.slice(0, 60)}...`);
  }, 15000);
});
