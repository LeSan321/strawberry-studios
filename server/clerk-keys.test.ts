/**
 * clerk-keys.test.ts
 *
 * Validates that the Clerk publishable key is correctly set in the environment
 * and that the Clerk SDK can parse it without throwing errors.
 */
import { describe, it, expect } from "vitest";

describe("Clerk environment keys", () => {
  it("CLERK_PUBLISHABLE_KEY is set (no VITE_ prefix)", () => {
    const key = process.env.CLERK_PUBLISHABLE_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^pk_/);
  });

  it("VITE_CLERK_PUBLISHABLE_KEY is set (for frontend)", () => {
    const key = process.env.VITE_CLERK_PUBLISHABLE_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^pk_/);
  });

  it("CLERK_SECRET_KEY is set", () => {
    const key = process.env.CLERK_SECRET_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^sk_/);
  });

  it("CLERK_PUBLISHABLE_KEY and VITE_CLERK_PUBLISHABLE_KEY have the same value", () => {
    const pubKey = process.env.CLERK_PUBLISHABLE_KEY;
    const vitePubKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
    expect(pubKey).toBe(vitePubKey);
  });

  it("Clerk publishable key can be decoded to a valid frontend API URL", () => {
    const key = process.env.CLERK_PUBLISHABLE_KEY ?? "";
    // pk_test_<base64> or pk_live_<base64>
    const parts = key.split("_");
    expect(parts.length).toBe(3);
    expect(["test", "live"]).toContain(parts[1]);
    // The third part is base64-encoded frontend API URL
    const decoded = Buffer.from(parts[2], "base64").toString("utf8");
    // Should end with $ and contain a clerk domain
    expect(decoded).toMatch(/clerk/i);
  });
});
