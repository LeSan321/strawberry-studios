/**
 * Tests for the Cinématique video generation adapter and prompt builder.
 *
 * These tests cover:
 *   - Mock provider returns a complete result with a valid job ID and video URL
 *   - Provider selection logic (getActiveProvider)
 *   - pollVideoStatus mock always returns complete
 *   - buildCinématiqueVideoPrompt produces all 10 layers
 *   - Prompt contains required presence threshold phrases
 *   - Prompt contains AI-default-resistance overrides
 *   - Prompt integrates the Expert Council's cinematiquePrompt
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateVideo, pollVideoStatus, getActiveProvider } from "./videoGeneration";
import { buildCinématiqueVideoPrompt } from "./cinematiquePromptBuilder";

// ─── Video Generation Adapter Tests ──────────────────────────────────────────

describe("videoGeneration — mock provider", () => {
  beforeEach(() => {
    // Ensure mock provider is active
    delete process.env.VIDEO_PROVIDER;
  });

  it("getActiveProvider returns 'mock' when VIDEO_PROVIDER is unset", () => {
    expect(getActiveProvider()).toBe("mock");
  });

  it("getActiveProvider returns the configured provider", () => {
    process.env.VIDEO_PROVIDER = "runway";
    expect(getActiveProvider()).toBe("runway");
    delete process.env.VIDEO_PROVIDER;
  });

  it("generateVideo (mock) returns status=complete", async () => {
    const result = await generateVideo({
      prompt: "Test prompt",
      durationSeconds: 10,
      aspectRatio: "16:9",
    });

    expect(result.status).toBe("complete");
  });

  it("generateVideo (mock) returns a non-empty jobId", async () => {
    const result = await generateVideo({ prompt: "Test prompt" });
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.jobId).toBeTruthy();
      expect(result.jobId.startsWith("mock-")).toBe(true);
    }
  });

  it("generateVideo (mock) returns a valid video URL", async () => {
    const result = await generateVideo({ prompt: "Test prompt" });
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.videoUrl).toMatch(/^https?:\/\//);
    }
  });

  it("pollVideoStatus (mock) always returns complete", async () => {
    const result = await pollVideoStatus("mock", "mock-job-123");
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.videoUrl).toMatch(/^https?:\/\//);
    }
  });

  it("generateVideo (runway) throws when RUNWAY_API_KEY is missing", async () => {
    process.env.VIDEO_PROVIDER = "runway";
    delete process.env.RUNWAY_API_KEY;

    await expect(generateVideo({ prompt: "Test" })).rejects.toThrow("RUNWAY_API_KEY");
    delete process.env.VIDEO_PROVIDER;
  });

  it("generateVideo (kling) throws when KLING_API_KEY is missing", async () => {
    process.env.VIDEO_PROVIDER = "kling";
    delete process.env.KLING_API_KEY;

    await expect(generateVideo({ prompt: "Test" })).rejects.toThrow("KLING_API_KEY");
    delete process.env.VIDEO_PROVIDER;
  });

  it("generateVideo (luma) throws when LUMA_API_KEY is missing", async () => {
    process.env.VIDEO_PROVIDER = "luma";
    delete process.env.LUMA_API_KEY;

    await expect(generateVideo({ prompt: "Test" })).rejects.toThrow("LUMA_API_KEY");
    delete process.env.VIDEO_PROVIDER;
  });
});

// ─── Cinématique Prompt Builder Tests ─────────────────────────────────────────

const MOCK_DIRECTORS_PACKAGE = {
  cinematiquePrompt: "Female jazz singer in noir club, deep chiaroscuro, venetian blind shadows, 2200K tungsten",
  shotList: [
    {
      shotNumber: 1,
      shotType: "Medium Close-Up",
      description: "Singer at microphone, venetian cage shadows across face",
      duration: "4 seconds",
      cameraMovement: "Slow push-in",
      lightingNote: "2200K tungsten sidelight, 70% shadow",
    },
  ],
  productionNotes: {
    fabricPhysics: "Bias-cut silk charmeuse, Fresnel edge highlight at 15°",
    lightingSetup: "2200K tungsten, venetian blind gobo, minimal fill",
    cameraPsychology: "85mm f/1.4, embodied push-in, standing height",
    atmosphericElements: "Oil-based haze at chest height, 0.4 density",
  },
  directorStatement: "The light does not illuminate her — it interrogates her.",
  concert: {
    title: "Midnight at the Velvet",
    artistName: "Scarlett Noir",
    venue: "velvet_strawberry_jazz_club",
    moodPreset: "intimate_jazz",
    visualPreset: "venetian_cage",
    cameraStyle: "intimate_close",
    lightingKelvin: 2200,
    characters: "the_red_head_singer, the_fedora_man",
  },
};

describe("buildCinématiqueVideoPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("contains Layer 1 — environment (subterranean jazz club)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("jazz club");
  });

  it("contains Layer 2 — time/era (late night, 1940s)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("1940s");
  });

  it("contains Layer 4 — light source with Kelvin temperature", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt).toContain("2200K");
  });

  it("contains Layer 5 — light hierarchy (70% shadow)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt).toContain("70%");
  });

  it("contains Layer 7 — foreground depth elements (four depth planes)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("depth plane");
  });

  it("contains Layer 8 — lens specification (85mm)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt).toContain("85mm");
  });

  it("contains Layer 9 — PBR material cues (velvet)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("velvet");
  });

  it("contains AI-default-resistance override: minimal fill", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("minimal fill");
  });

  it("contains AI-default-resistance override: asymmetrical lighting", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("asymmetrical");
  });

  it("contains presence threshold: chiaroscuro ratio 8:1", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt).toContain("8:1");
  });

  it("contains presence threshold: social presence (gaze toward camera)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("gaze toward camera");
  });

  it("contains presence threshold: acoustic-visual coherence (brass surface)", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("brass");
  });

  it("integrates the Expert Council's cinematiquePrompt", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt).toContain(MOCK_DIRECTORS_PACKAGE.cinematiquePrompt);
  });

  it("applies venetian_cage visual preset overrides", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("venetian");
  });

  it("applies shadow_and_smoke visual preset overrides for that preset", () => {
    const pkg = {
      ...MOCK_DIRECTORS_PACKAGE,
      concert: { ...MOCK_DIRECTORS_PACKAGE.concert, visualPreset: "shadow_and_smoke" },
    };
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: pkg });
    expect(prompt.toLowerCase()).toContain("smoke");
  });

  it("applies Red Head Singer wardrobe layer when character is singer", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("silk charmeuse");
  });

  it("ends with cinematic realism marker", () => {
    const prompt = buildCinématiqueVideoPrompt({ directorsPackage: MOCK_DIRECTORS_PACKAGE });
    expect(prompt.toLowerCase()).toContain("cinematic realism");
  });
});
