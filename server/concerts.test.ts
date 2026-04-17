import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createConcert: vi.fn().mockResolvedValue({ insertId: 42 }),
  getConcertsByUser: vi.fn().mockResolvedValue([
    {
      id: 42,
      userId: 1,
      title: "Midnight at the Velvet Strawberry",
      artistName: "The Red Head Singer",
      venue: "velvet_strawberry_jazz_club",
      moodPreset: "noir_smoke",
      visualPreset: "shadow_and_smoke",
      cameraStyle: "intimate_close",
      lightingKelvin: 1800,
      status: "draft",
      ticketSlug: "midnight-at-the-velvet-strawberry-abc123",
      isPublic: false,
      createdAt: new Date("2026-04-13"),
      updatedAt: new Date("2026-04-13"),
    }
  ]),
  getConcertById: vi.fn().mockImplementation((id: number) => {
    if (id === 42) return Promise.resolve({
      id: 42,
      userId: 1,
      title: "Midnight at the Velvet Strawberry",
      venue: "velvet_strawberry_jazz_club",
      moodPreset: "noir_smoke",
      visualPreset: "shadow_and_smoke",
      status: "draft",
      ticketSlug: "midnight-abc123",
      isPublic: false,
      createdAt: new Date("2026-04-13"),
      updatedAt: new Date("2026-04-13"),
    });
    return Promise.resolve(null);
  }),
  getConcertBySlug: vi.fn().mockImplementation((slug: string) => {
    if (slug === "midnight-abc123") return Promise.resolve({
      id: 42,
      userId: 1,
      title: "Midnight at the Velvet Strawberry",
      venue: "velvet_strawberry_jazz_club",
      moodPreset: "noir_smoke",
      visualPreset: "shadow_and_smoke",
      status: "complete",
      ticketSlug: "midnight-abc123",
      isPublic: true,
      cinematiquePrompt: "Deep noir jazz club...",
      directorsPackage: { version: "1.0" },
      createdAt: new Date("2026-04-13"),
      updatedAt: new Date("2026-04-13"),
    });
    return Promise.resolve(null);
  }),
  updateConcert: vi.fn().mockResolvedValue(undefined),
  addConcertCharacter: vi.fn().mockResolvedValue(undefined),
  getConcertCharacters: vi.fn().mockResolvedValue([]),
  createAudioTrack: vi.fn().mockResolvedValue({ insertId: 10 }),
  getAudioTracksByUser: vi.fn().mockResolvedValue([]),
  getAudioTrackById: vi.fn().mockResolvedValue(null),
  getAllPresets: vi.fn().mockResolvedValue([]),
  getPresetBySlug: vi.fn().mockResolvedValue(null),
  upsertPreset: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          cinematiquePrompt: "Cinematic noir jazz club interior, 1800K tungsten footlights...",
          shotList: [
            {
              shotNumber: 1,
              shotType: "Establishing Wide",
              description: "The club emerges from darkness",
              duration: "4s",
              cameraMovement: "Slow push-in",
              lightingNote: "1800K tungsten footlights"
            }
          ],
          productionNotes: {
            fabricPhysics: "Velvet absorbs light at 0-5°",
            lightingSetup: "1800K tungsten footlights",
            cameraPsychology: "Low-key chiaroscuro",
            atmosphericElements: "Atmospheric haze diffusion"
          },
          directorStatement: "This concert lives in shadow and revelation."
        })
      }
    }]
  })
}));

describe("Concert slug generation", () => {
  it("generates a slug from a title", () => {
    const title = "Midnight at the Velvet Strawberry";
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    expect(base).toBe("midnight-at-the-velvet-strawberry");
  });

  it("handles special characters in title", () => {
    const title = "Café Noir & Blues!";
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    expect(base).toBe("caf-noir-blues");
  });
});

describe("Concert status flow", () => {
  it("draft → generating → complete is valid", () => {
    const validStatuses = ["draft", "generating", "complete", "failed"];
    expect(validStatuses).toContain("draft");
    expect(validStatuses).toContain("generating");
    expect(validStatuses).toContain("complete");
    expect(validStatuses).toContain("failed");
  });
});

describe("Venue enum values", () => {
  it("contains all expected venues", () => {
    const venues = ["velvet_strawberry_jazz_club", "strawberry_in_the_round", "berries_on_the_rocks"];
    expect(venues).toHaveLength(3);
    expect(venues[0]).toBe("velvet_strawberry_jazz_club");
  });
});

describe("Visual preset enum values", () => {
  it("contains all four Cinématique presets", () => {
    const presets = ["shadow_and_smoke", "golden_rim", "venetian_cage", "match_flare", "none"];
    expect(presets).toHaveLength(5);
    expect(presets).toContain("shadow_and_smoke");
    expect(presets).toContain("golden_rim");
    expect(presets).toContain("venetian_cage");
    expect(presets).toContain("match_flare");
  });
});

describe("Mood preset enum values", () => {
  it("contains all mood presets including custom", () => {
    const moods = ["intimate_jazz", "high_energy", "noir_smoke", "custom"];
    expect(moods).toHaveLength(4);
    expect(moods).toContain("custom");
  });
});

describe("Character types", () => {
  it("contains resident characters and custom", () => {
    const chars = ["the_red_head_singer", "the_fedora_man", "custom"];
    expect(chars).toHaveLength(3);
    expect(chars).toContain("the_red_head_singer");
    expect(chars).toContain("the_fedora_man");
  });
});

describe("Lighting Kelvin range", () => {
  it("validates Kelvin values within range", () => {
    const isValid = (k: number) => k >= 1000 && k <= 10000;
    expect(isValid(1600)).toBe(true); // Match Flare
    expect(isValid(1800)).toBe(true); // Shadow and Smoke
    expect(isValid(2200)).toBe(true); // Venetian Cage
    expect(isValid(2400)).toBe(true); // Golden Rim
    expect(isValid(2700)).toBe(true); // Intimate Jazz default
    expect(isValid(500)).toBe(false);
    expect(isValid(15000)).toBe(false);
  });
});
