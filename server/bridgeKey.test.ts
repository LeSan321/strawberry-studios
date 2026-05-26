import { describe, it, expect } from "vitest";

describe("BRIDGE_API_KEY secret", () => {
  it("should be set in the environment", () => {
    const key = process.env.BRIDGE_API_KEY;
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
    expect((key as string).length).toBeGreaterThanOrEqual(32);
  });

  it("should reject requests with no x-bridge-key header", async () => {
    const response = await fetch(
      "http://localhost:3000/api/bridge/frequency/999",
      { method: "GET" }
    );
    expect(response.status).toBe(401);
  });

  it("should reject requests with wrong x-bridge-key header", async () => {
    const response = await fetch(
      "http://localhost:3000/api/bridge/frequency/999",
      {
        method: "GET",
        headers: { "x-bridge-key": "wrong-key-value" },
      }
    );
    expect(response.status).toBe(401);
  });

  it("should accept requests with correct x-bridge-key header", async () => {
    const key = process.env.BRIDGE_API_KEY!;
    const response = await fetch(
      "http://localhost:3000/api/bridge/frequency/999",
      {
        method: "GET",
        headers: { "x-bridge-key": key },
      }
    );
    // 200 means auth passed and user lookup completed (returns null frequency if not found)
    expect(response.status).toBe(200);
  });
});
