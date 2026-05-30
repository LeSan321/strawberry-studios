/**
 * Validates that OPENAI_API_KEY is configured and can reach the OpenAI API.
 * Uses the /v1/models endpoint — a lightweight, read-only call.
 */
import { describe, it, expect } from "vitest";

describe("OpenAI API Key", () => {
  it("should be configured and valid", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey, "OPENAI_API_KEY env var must be set").toBeTruthy();

    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(
      res.status,
      `OpenAI /v1/models returned ${res.status} — check key validity`
    ).toBe(200);
  });
});
