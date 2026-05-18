/**
 * Campaign Workflow Tests
 *
 * Tests for the multi-genre campaign prompt builder and PDF generator.
 * These are unit tests that do not require a database connection.
 */

import { describe, it, expect } from "vitest";
import {
  buildCampaignSystemPrompt,
  buildShotPrompt,
  GENRE_GRAMMAR as GENRE_CONFIGS,
  DURATION_SHOT_COUNT as DURATION_SHOT_COUNTS,
  type CampaignGenre,
  type DurationMode,
  type CampaignGoal,
} from "./campaignPromptBuilder";
import { generateCampaignPdf } from "./campaignPdfGenerator";

// Helper to call buildCampaignSystemPrompt with a brief-style object
function buildPromptFromBrief(brief: { genre: string; durationMode: string; campaignGoal?: string }): string {
  return buildCampaignSystemPrompt(
    brief.genre as CampaignGenre,
    brief.durationMode as DurationMode,
    (brief.campaignGoal ?? "awareness") as CampaignGoal
  );
}

// ── Genre Config Tests ────────────────────────────────────────────────────────

describe("Campaign Genre Configs", () => {
  it("should have configs for all 9 genres", () => {
    const expectedGenres = [
      "psychedelic_vaporwave",
      "noir_jazz",
      "indie_folk",
      "hip_hop",
      "electronic",
      "punk_rock",
      "soul_rnb",
      "country",
      "experimental",
    ];
    expectedGenres.forEach((genre) => {
      expect(GENRE_CONFIGS).toHaveProperty(genre);
    });
  });

  it("should have all required fields in each genre config", () => {
    Object.entries(GENRE_CONFIGS).forEach(([genre, config]) => {
      expect(config, `Genre ${genre} missing name`).toHaveProperty("name");
      expect(config, `Genre ${genre} missing colorPalette`).toHaveProperty("colorPalette");
      expect(config, `Genre ${genre} missing cameraGrammar`).toHaveProperty("cameraGrammar");
      expect(config, `Genre ${genre} missing atmosphere`).toHaveProperty("atmosphere");
      expect(config, `Genre ${genre} missing shotVocabulary`).toHaveProperty("shotVocabulary");
      expect(config, `Genre ${genre} missing psychologicalBrief`).toHaveProperty("psychologicalBrief");
      expect(config, `Genre ${genre} missing promptVocabulary`).toHaveProperty("promptVocabulary");
      expect(config, `Genre ${genre} missing forbiddenElements`).toHaveProperty("forbiddenElements");
    });
  });

  it("should have valid color palette fields in each genre config", () => {
    Object.entries(GENRE_CONFIGS).forEach(([genre, config]) => {
      expect(config.colorPalette, `Genre ${genre} missing primary color`).toHaveProperty("primary");
      expect(config.colorPalette, `Genre ${genre} missing secondary color`).toHaveProperty("secondary");
      expect(config.colorPalette, `Genre ${genre} missing accent color`).toHaveProperty("accent");
      expect(config.colorPalette, `Genre ${genre} missing kelvinRange`).toHaveProperty("kelvinRange");
      expect(config.colorPalette, `Genre ${genre} missing grade`).toHaveProperty("grade");
    });
  });
});

// ── Duration Shot Count Tests ─────────────────────────────────────────────────

describe("Duration Shot Counts", () => {
  it("should have shot counts for all duration modes", () => {
    expect(DURATION_SHOT_COUNTS).toHaveProperty("15s");
    expect(DURATION_SHOT_COUNTS).toHaveProperty("30s");
    expect(DURATION_SHOT_COUNTS).toHaveProperty("60s");
    expect(DURATION_SHOT_COUNTS).toHaveProperty("full_song");
  });

  it("should have increasing shot counts for longer durations", () => {
    expect(DURATION_SHOT_COUNTS["15s"].shotCount).toBeLessThan(DURATION_SHOT_COUNTS["30s"].shotCount);
    expect(DURATION_SHOT_COUNTS["30s"].shotCount).toBeLessThan(DURATION_SHOT_COUNTS["60s"].shotCount);
    expect(DURATION_SHOT_COUNTS["60s"].shotCount).toBeLessThan(DURATION_SHOT_COUNTS["full_song"].shotCount);
  });

  it("should have reasonable shot counts (3-15 shots)", () => {
    Object.values(DURATION_SHOT_COUNTS).forEach((entry) => {
      expect(entry.shotCount).toBeGreaterThanOrEqual(3);
      expect(entry.shotCount).toBeLessThanOrEqual(15);
    });
  });
});

// ── Prompt Builder Tests ──────────────────────────────────────────────────────

describe("Campaign Prompt Builder", () => {
  it("should build a non-empty system prompt for psychedelic_vaporwave", () => {
    const prompt = buildPromptFromBrief({ genre: "psychedelic_vaporwave", durationMode: "30s", campaignGoal: "awareness" });
    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("should include genre name in system prompt", () => {
    const prompt = buildPromptFromBrief({ genre: "psychedelic_vaporwave", durationMode: "30s", campaignGoal: "awareness" });
    expect(prompt.toLowerCase()).toContain("psychedelic");
  });

  it("should include duration mode in system prompt", () => {
    const prompt = buildPromptFromBrief({ genre: "noir_jazz", durationMode: "30s", campaignGoal: "awareness" });
    expect(prompt).toContain("30s");
  });

  it("should build a non-empty shot prompt", () => {
    const prompt = buildShotPrompt({
      genre: "psychedelic_vaporwave",
      shotDescription: "Extreme close-up of a single eye, pupil dilating",
      shotType: "ECU",
      cameraMovement: "Static",
      lightingNote: "UV backlight, iris catches neon",
      atmosphericNote: "Haze, chromatic aberration",
      colorPalette: { primary: "Electric Magenta", secondary: "Deep Violet", grade: "Oversaturated" },
      characterDescription: "Androgynous figure in iridescent vinyl",
      durationSeconds: 5,
    });
    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("should work for all 9 genres without throwing", () => {
    const genres = Object.keys(GENRE_CONFIGS) as CampaignGenre[];
    genres.forEach((genre) => {
      expect(() => buildPromptFromBrief({ genre, durationMode: "30s", campaignGoal: "awareness" })).not.toThrow();
    });
  });

  it("should work for all 4 duration modes without throwing", () => {
    const modes: DurationMode[] = ["15s", "30s", "60s", "full_song"];
    modes.forEach((durationMode) => {
      expect(() => buildPromptFromBrief({ genre: "noir_jazz", durationMode, campaignGoal: "awareness" })).not.toThrow();
    });
  });
});

// ── PDF Generator Tests ───────────────────────────────────────────────────────

describe("Campaign PDF Generator", () => {
  it("should generate a PDF buffer for a minimal campaign", async () => {
    const buffer = await generateCampaignPdf({
      title: "Test Campaign",
      artistName: "Test Artist",
      genre: "noir_jazz",
      durationMode: "30s",
      campaignGoal: "awareness",
      brief: "A test campaign",
      directorsPackage: {
        logline: "A test logline",
        visualIdentityStatement: "A test visual identity",
      },
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // Should be at least 1KB
  });

  it("should generate a PDF buffer for a full directors package", async () => {
    const buffer = await generateCampaignPdf({
      title: "Sonic Insurrection Launch",
      artistName: "LeSan",
      genre: "psychedelic_vaporwave",
      durationMode: "30s",
      campaignGoal: "awareness",
      brief: "Launch campaign for Sonic Insurrection",
      directorsPackage: {
        logline: "A sonic journey through fractured realities",
        visualIdentityStatement: "Psychedelic expressionism meets digital decay",
        colorPalette: {
          primary: "Electric Magenta",
          secondary: "Deep Violet",
          accent: "Neon Cyan",
          kelvin: "3200K tungsten + UV",
          grade: "Oversaturated, chromatic aberration",
          emotionalNote: "Disorienting, euphoric, electric",
        },
        characterDesign: {
          appearance: "Androgynous, otherworldly",
          wardrobe: "Iridescent vinyl, holographic textures",
          materialNotes: "High-sheen synthetics, light-reactive",
          lightingInteraction: "Prismatic reflections, UV reactive",
        },
        setDesign: [
          {
            name: "The Void",
            description: "Infinite black space with floating geometric fragments",
            lightingSetup: "Single UV source, practical neon accents",
          },
          {
            name: "The Grid",
            description: "Retro-futuristic grid landscape",
            lightingSetup: "Cyan/magenta grid lighting",
          },
        ],
        shotList: [
          {
            shotNumber: 1,
            shotType: "ECU — Eye",
            description: "Extreme close-up of a single eye, pupil dilating",
            durationSeconds: 5,
            cameraMovement: "Static",
            lightingNote: "UV backlight, iris catches neon",
            emotionalFunction: "Hook — disorientation",
          },
          {
            shotNumber: 2,
            shotType: "WS — The Void",
            description: "Artist standing in infinite black space, geometric fragments orbiting",
            durationSeconds: 8,
            cameraMovement: "Slow push",
            lightingNote: "Single UV source, practical neons",
            emotionalFunction: "Establish — isolation and power",
          },
        ],
        artDepartmentNotes: {
          tone: "Psychedelic, disorienting, euphoric",
          timePeriod: "Timeless / retro-futuristic",
          palette: "Magenta, violet, cyan, black",
          texture: "Smooth synthetics, holographic, glitch",
          theme: "Sonic liberation, fractured reality",
        },
        directorStatement: "This campaign is a visual insurrection — a refusal of the mundane.",
      },
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(5000); // Full package should be larger
  });

  it("should generate PDFs for all 9 genres without throwing", async () => {
    const genres = Object.keys(GENRE_CONFIGS);
    for (const genre of genres) {
      const buffer = await generateCampaignPdf({
        title: `Test ${genre}`,
        genre,
        durationMode: "30s",
        campaignGoal: "awareness",
        directorsPackage: { logline: `Test logline for ${genre}` },
      });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    }
  });
});
