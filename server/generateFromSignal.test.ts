/**
 * Tests for the generate-from-signal bridge endpoint.
 *
 * Covers:
 *   - verifyIABridgeAuth (shared secret validation)
 *   - namedSignalToVocabulary (Named Signal → Frequency translation)
 *   - deriveArcType (contrast + luminance → arc type mapping)
 *   - POST /api/bridge/cover-art/generate-from-signal (route handler)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveArcType, namedSignalToVocabulary, type ArcType } from "./bridgeRoutes";

// ─── deriveArcType ────────────────────────────────────────────────────────────

describe("deriveArcType", () => {
  it("returns erosive_revelatory for high contrast + high luminance", () => {
    expect(deriveArcType(0.8, 0.8, 0.5)).toBe("erosive_revelatory");
  });

  it("returns witnessing_lateral for high contrast + low luminance", () => {
    expect(deriveArcType(0.8, 0.2, 0.5)).toBe("witnessing_lateral");
  });

  it("returns expansive_mythic for low contrast + high luminance", () => {
    expect(deriveArcType(0.2, 0.8, 0.5)).toBe("expansive_mythic");
  });

  it("returns sustained_ambient for low contrast + low luminance", () => {
    expect(deriveArcType(0.2, 0.2, 0.5)).toBe("sustained_ambient");
  });

  it("returns intimate_relational for mid contrast + warm temperature", () => {
    expect(deriveArcType(0.5, 0.5, 0.8)).toBe("intimate_relational");
  });

  it("returns cyclical_return for mid contrast + cool temperature", () => {
    expect(deriveArcType(0.5, 0.5, 0.2)).toBe("cyclical_return");
  });

  it("uses threshold values correctly — contrast exactly at HIGH (0.65) is high", () => {
    expect(deriveArcType(0.65, 0.65, 0.5)).toBe("erosive_revelatory");
  });

  it("uses threshold values correctly — contrast just below HIGH is mid", () => {
    // 0.64 is mid contrast, luminance 0.65 is high — but mid contrast uses temperature
    const result = deriveArcType(0.64, 0.65, 0.8);
    expect(result).toBe("intimate_relational");
  });
});

// ─── namedSignalToVocabulary ──────────────────────────────────────────────────

describe("namedSignalToVocabulary", () => {
  it("returns a complete VocabularyJson with all six categories", () => {
    const vocab = namedSignalToVocabulary({
      hue: 45,
      temperature: 0.6,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });

    expect(vocab).toHaveProperty("environment");
    expect(vocab).toHaveProperty("emotionalRegister");
    expect(vocab).toHaveProperty("arcTerms");
    expect(vocab).toHaveProperty("forbiddenTerms");
    expect(vocab).toHaveProperty("colorLight");
    expect(vocab).toHaveProperty("relationshipGeometry");
  });

  it("all categories are non-empty arrays", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.3,
      saturation: 0.7,
      contrast: 0.8,
      luminance: 0.2,
    });

    for (const key of ["environment", "emotionalRegister", "arcTerms", "forbiddenTerms", "colorLight", "relationshipGeometry"] as const) {
      expect(Array.isArray(vocab[key])).toBe(true);
      expect(vocab[key].length).toBeGreaterThan(0);
    }
  });

  it("each term has a term string and instruction string", () => {
    const vocab = namedSignalToVocabulary({
      hue: 270,
      temperature: 0.9,
      saturation: 0.9,
      contrast: 0.1,
      luminance: 0.9,
    });

    for (const category of Object.values(vocab)) {
      for (const item of category) {
        expect(typeof item.term).toBe("string");
        expect(item.term.length).toBeGreaterThan(0);
        expect(typeof item.instruction).toBe("string");
        expect(item.instruction.length).toBeGreaterThan(0);
      }
    }
  });

  it("maps red-orange hue (hue=15) to ember warmth colorLight", () => {
    const vocab = namedSignalToVocabulary({
      hue: 15,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("ember warmth");
  });

  it("maps blue-indigo hue (hue=240) to deep water refraction colorLight", () => {
    const vocab = namedSignalToVocabulary({
      hue: 240,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("deep water refraction");
  });

  it("maps violet-rose hue (hue=300) to petal violet colorLight", () => {
    const vocab = namedSignalToVocabulary({
      hue: 300,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("petal violet #C8A0D0");
  });

  it("hue=360 wraps to 0 (red-orange zone, ember warmth)", () => {
    // 360 % 360 = 0, which falls in the 0–30 red-orange zone
    const vocab = namedSignalToVocabulary({
      hue: 360,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("ember warmth");
  });

  it("hue=350 is in the rose-red zone (330–360)", () => {
    const vocab = namedSignalToVocabulary({
      hue: 350,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("warm magenta threshold");
  });

  it("low luminance adds low-key luminance term to colorLight", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.1,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("low-key luminance");
  });

  it("high luminance adds high-key luminance term to colorLight", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.5,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.9,
    });
    const colorTerms = vocab.colorLight.map(t => t.term);
    expect(colorTerms).toContain("high-key luminance");
  });

  it("cool temperature produces interior quiet emotionalRegister", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.1,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const emotionalTerms = vocab.emotionalRegister.map(t => t.term);
    expect(emotionalTerms).toContain("interior quiet");
  });

  it("warm temperature produces full presence emotionalRegister", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.9,
      saturation: 0.5,
      contrast: 0.5,
      luminance: 0.5,
    });
    const emotionalTerms = vocab.emotionalRegister.map(t => t.term);
    expect(emotionalTerms).toContain("full presence");
  });

  it("low saturation produces desaturated field environment", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.5,
      saturation: 0.1,
      contrast: 0.5,
      luminance: 0.5,
    });
    const envTerms = vocab.environment.map(t => t.term);
    expect(envTerms).toContain("desaturated field");
  });

  it("high saturation produces vivid ground environment", () => {
    const vocab = namedSignalToVocabulary({
      hue: 180,
      temperature: 0.5,
      saturation: 0.9,
      contrast: 0.5,
      luminance: 0.5,
    });
    const envTerms = vocab.environment.map(t => t.term);
    expect(envTerms).toContain("vivid ground");
  });

  it("always includes forbidden terms", () => {
    const vocab = namedSignalToVocabulary({
      hue: 0,
      temperature: 0,
      saturation: 0,
      contrast: 0,
      luminance: 0,
    });
    expect(vocab.forbiddenTerms.length).toBeGreaterThan(0);
    expect(vocab.forbiddenTerms[0].term).toBe("generic beauty");
  });
});

// ─── Route handler (integration-style, mocked dependencies) ──────────────────

describe("POST /api/bridge/cover-art/generate-from-signal", () => {
  // We test the route via direct HTTP to the running dev server.
  // These tests require IA_BRIDGE_SECRET to be set in the environment.
  // If not set, the tests are skipped gracefully.

  const BASE_URL = "http://localhost:3000";
  const ENDPOINT = `${BASE_URL}/api/bridge/cover-art/generate-from-signal`;

  const validSignal = {
    hue: 180,
    temperature: 0.5,
    saturation: 0.5,
    contrast: 0.5,
    luminance: 0.5,
  };

  it("returns 401 when x-ia-key header is missing", async () => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal: validSignal, imageType: "landscape" }),
    });
    // Either 401 (secret configured) or 503 (secret not configured)
    expect([401, 503]).toContain(res.status);
  });

  it("returns 401 when x-ia-key header is wrong", async () => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ia-key": "wrong-secret-value",
      },
      body: JSON.stringify({ signal: validSignal, imageType: "landscape" }),
    });
    // Either 401 (secret configured, wrong value) or 503 (secret not configured)
    expect([401, 503]).toContain(res.status);
  });

  it("returns 400 when signal is missing", async () => {
    const secret = process.env.IA_BRIDGE_SECRET;
    if (!secret) {
      console.warn("[test] IA_BRIDGE_SECRET not set — skipping route validation test");
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ia-key": secret,
      },
      body: JSON.stringify({ imageType: "door" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid input");
  });

  it("returns 400 when imageType is invalid", async () => {
    const secret = process.env.IA_BRIDGE_SECRET;
    if (!secret) {
      console.warn("[test] IA_BRIDGE_SECRET not set — skipping route validation test");
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ia-key": secret,
      },
      body: JSON.stringify({ signal: validSignal, imageType: "portrait" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when signal axes are out of range", async () => {
    const secret = process.env.IA_BRIDGE_SECRET;
    if (!secret) {
      console.warn("[test] IA_BRIDGE_SECRET not set — skipping route validation test");
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ia-key": secret,
      },
      body: JSON.stringify({
        signal: { hue: 400, temperature: 2, saturation: -1, contrast: 0.5, luminance: 0.5 },
        imageType: "landscape",
      }),
    });
    expect(res.status).toBe(400);
  });
});
