import { describe, it, expect } from "vitest";

/**
 * STUDIOS_BRIDGE_KEY secret validation
 */
describe("STUDIOS_BRIDGE_KEY secret", () => {
  it("is set and has expected length (64 hex chars)", () => {
    const key = process.env.STUDIOS_BRIDGE_KEY ?? "";
    expect(key.length).toBe(64);
    expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
  });
});

/**
 * Bridge authentication tests.
 * The bridge now uses Clerk Bearer tokens (not the old x-bridge-key header).
 * These tests verify that the bridge endpoints correctly reject unauthenticated requests.
 */
describe("Bridge authentication (Clerk Bearer)", () => {
  it("should reject /api/bridge/ping with no Authorization header", async () => {
    const response = await fetch(
      "http://localhost:3000/api/bridge/ping",
      { method: "GET" }
    );
    expect(response.status).toBe(401);
  });

  it("should reject /api/bridge/ping with wrong Authorization header", async () => {
    const response = await fetch(
      "http://localhost:3000/api/bridge/ping",
      {
        method: "GET",
        headers: { "Authorization": "Bearer invalid-token-value" },
      }
    );
    expect(response.status).toBe(401);
  });

  it("should reject /api/bridge/cover-art/generate with no Authorization header", async () => {
    const response = await fetch(
      "http://localhost:3000/api/bridge/cover-art/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: "test lyrics" }),
      }
    );
    expect(response.status).toBe(401);
  });

  it("should reject /api/bridge/cover-art/generate with wrong Authorization header", async () => {
    const response = await fetch(
      "http://localhost:3000/api/bridge/cover-art/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid-token-value",
        },
        body: JSON.stringify({ lyrics: "test lyrics" }),
      }
    );
    expect(response.status).toBe(401);
  });
});
