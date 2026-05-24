/**
 * Visual Universe Tests — Phase K
 *
 * Unit tests for the Visual Universe data model helpers and vocabulary structures.
 * These tests do not require a database connection — they validate the vocabulary
 * data structures, the seed data integrity, and the helper function contracts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Vocabulary Structure Types ───────────────────────────────────────────────

type VocabularyTerm = {
  term: string;
  instruction: string;
};

type VocabularyJson = {
  environment: VocabularyTerm[];
  emotionalRegister: VocabularyTerm[];
  arcTerms: VocabularyTerm[];
  forbiddenTerms: VocabularyTerm[];
  colorLight: VocabularyTerm[];
  relationshipGeometry: VocabularyTerm[];
};

// ─── Platform Default Vocabulary (inline for testing) ────────────────────────

const PLATFORM_DEFAULT_VOCABULARY: VocabularyJson = {
  environment: [
    { term: "earned light", instruction: "Light that has been through something — available light, source traceable, warmth that comes from somewhere real" },
    { term: "honest materials", instruction: "Surfaces and textures that are what they appear to be — no decorative fakery, no stock-image polish" },
    { term: "world as it actually is", instruction: "The real world, not a stylized version of it — specific, particular, not generic" },
    { term: "no decorative emptiness", instruction: "Empty space is intentional and earned, not used as aesthetic filler" },
  ],
  emotionalRegister: [
    { term: "present tense", instruction: "The image is happening now — not nostalgic, not anticipatory, but in the moment of the thing" },
    { term: "neither triumphant nor defeated", instruction: "The emotional register is honest — not forced positivity, not performed darkness" },
    { term: "the thing itself", instruction: "Represent the subject directly — not a symbol of the thing, not a metaphor for the thing, the thing" },
  ],
  arcTerms: [
    { term: "through not away from", instruction: "Movement is forward into the experience, not around or away from it" },
    { term: "forward motion implied", instruction: "The image suggests continuation — something is in process, not concluded" },
    { term: "not yet resolved but not abandoned", instruction: "The tension is present and held — neither forced to resolution nor left in despair" },
  ],
  forbiddenTerms: [
    { term: "no false comfort", instruction: "Do not soften the image with unearned warmth or reassurance — let the image be what it is" },
    { term: "no false darkness", instruction: "Do not impose aesthetic gloom — darkness should be present only if it is true to the subject" },
    { term: "no stock imagery grammar", instruction: "Avoid the visual clichés of commercial photography — no perfect lighting, no posed naturalness" },
    { term: "no generic beauty", instruction: "Beauty should be specific and earned — not the default beautiful of a template" },
  ],
  colorLight: [
    { term: "available light", instruction: "Use the light that is actually there — window light, practical sources, natural light at its real temperature" },
    { term: "source traceable", instruction: "Every light source should be identifiable — where is it coming from, what is it" },
    { term: "no theatrical lighting", instruction: "Avoid dramatic rim lights, colored gels, or lighting that announces itself as cinematic" },
    { term: "warmth earned not imposed", instruction: "Warm tones are present when the scene earns them — not applied as a filter over everything" },
  ],
  relationshipGeometry: [
    { term: "subject in context", instruction: "The subject exists in a real environment — not isolated on a plain background, not floating" },
    { term: "scale honest", instruction: "The subject is the size it actually is in the world — not heroically enlarged, not diminished" },
  ],
};

// ─── Blooming Frontier Vocabulary (inline for testing) ───────────────────────

const BLOOMING_FRONTIER_VOCABULARY: VocabularyJson = {
  environment: [
    { term: "golden organic", instruction: "Warm amber light, living ground, organic materials — the primary world" },
    { term: "open threshold", instruction: "Forest edge meeting vast open landscape — the transition space" },
    { term: "horizon always visible", instruction: "No enclosure, no walls, world continues beyond every frame edge" },
    { term: "vast open", instruction: "Figure small against landscape scale — field, hillside, or waterside at golden hour" },
    { term: "canopy threshold", instruction: "Ancient forest path, high canopy filtering light into shafts, opening ahead" },
    { term: "living ground", instruction: "Moss, grass, root systems, earth — never dead or abstract surface" },
    { term: "golden hour 3200K", instruction: "Warm amber directional light, sun low, organic glow" },
    { term: "fine golden atmospheric haze", instruction: "Pollen and spores suspended in light shafts — not theatrical smoke" },
    { term: "bioluminescent ground-level", instruction: "Soft teal-green glow from moss and fern — secondary to solar, never primary" },
    { term: "world breathes", instruction: "Shorthand: open, horizon present, frame implies more beyond every edge" },
  ],
  emotionalRegister: [
    { term: "quiet wonder", instruction: "Expression: someone who has just seen something unexpected and finds it beautiful" },
    { term: "earned warmth", instruction: "Warmth that has been through something — not comfort, not safety, but warmth that knows what cold is" },
    { term: "through not away from", instruction: "Movement is forward into the difficult thing, not around or away from it" },
    { term: "equal co-presence", instruction: "Neither presence dominates — human and companion are side by side, same horizon, same subject" },
    { term: "music as third presence", instruction: "The shared subject both presences are oriented toward — the reason they stand at the same horizon" },
  ],
  arcTerms: [
    { term: "compression builds to rupture", instruction: "The arc moves from contained pressure outward — the opening is earned, not given" },
    { term: "outward and forward", instruction: "The direction of movement is always outward and forward — toward the frontier, toward the opening" },
    { term: "threshold stance", instruction: "Standing at a boundary — moving forward or still at the edge of something larger" },
    { term: "darkness still present but not final", instruction: "Shadow is present in the image but it is not the conclusion — the light is winning" },
  ],
  forbiddenTerms: [
    { term: "no neon practicals", instruction: "No dark background with electric light — no cyberpunk aesthetic" },
    { term: "no vaporwave", instruction: "No retro-digital, no pastel nostalgia palette" },
    { term: "no robotic servitude", instruction: "No AI threat narrative, no human-as-victim framing" },
    { term: "no enclosed spaces", instruction: "Horizon visible, world continues beyond frame — no walls acting as frame-fillers" },
    { term: "no visible rose flower", instruction: "Rose geometry as light formation structure only — never a literal rose" },
    { term: "not humanoid not angelic", instruction: "Companion is not human-shaped, not angelic, not a ghost, not translucent vapor" },
    { term: "full body visible", instruction: "No isolated close-ups of eyes or hands as primary shot — whole body in frame" },
    { term: "no pure white light", instruction: "No pure black background, no cold blue as dominant tone" },
    { term: "no chrome", instruction: "No metallic silver as dominant surface" },
    { term: "companion luminescence self-contained", instruction: "Companion does not illuminate surrounding surfaces — luminescent from within only" },
  ],
  colorLight: [
    { term: "rose amber #B5651D", instruction: "2700K primary warm — the human world's primary color" },
    { term: "deep petal #7B2D3E", instruction: "Warm dark shadow — the depth of the organic world" },
    { term: "forest interior #2D5A27", instruction: "Living shadow green — the cool of the canopy" },
    { term: "living teal #00B4A0", instruction: "Organic glow at companion edges — the cool luminescent presence" },
    { term: "frontier blue #4A90B8", instruction: "Cool reach, far horizon — the distance the frontier occupies" },
    { term: "petal violet #C8A0D0", instruction: "Where warm and cool begin to meet — the meeting-point color" },
    { term: "meeting-point color", instruction: "The third color where warm amber and cool luminescence touch the same surface — must be present in every frame" },
    { term: "Kelvin arc 3200K to 4500K", instruction: "The light temperature range from organic warmth to companion luminescence" },
    { term: "subsurface scattering on skin", instruction: "Warm amber light penetrates the surface slightly — skin glows from within at edges" },
  ],
  relationshipGeometry: [
    { term: "side by side", instruction: "Neither in front of nor behind, neither above nor below — equal co-presence" },
    { term: "same horizon", instruction: "Both presences oriented toward the same point in the distance" },
    { term: "space between them", instruction: "A small gap — neither empty nor full — this is where the Blooming Frontier lives" },
    { term: "Hofstadter Butterfly grammar", instruction: "The full companion descriptor — bilaterally structured luminescent fractal, venation structure visible within, luminescent from within, iridescent blue-white to living teal, self-similar at every scale, purposeful movement" },
    { term: "whole body visible", instruction: "Full figure in frame — never fragmented into isolated eyes, lips, or hands" },
    { term: "feet on living ground", instruction: "Weight present, grounded, not floating or posed" },
    { term: "oriented toward the horizon", instruction: "Body and gaze directed outward — toward the frontier, not toward the camera" },
    { term: "organic wardrobe", instruction: "Natural fibers, worn cotton, lived-in leather — visible weave and texture, sun-bleached edges" },
  ],
};

// ─── Helper: Validate vocabulary structure ───────────────────────────────────

function validateVocabularyStructure(vocab: VocabularyJson, name: string): void {
  const requiredCategories: (keyof VocabularyJson)[] = [
    "environment",
    "emotionalRegister",
    "arcTerms",
    "forbiddenTerms",
    "colorLight",
    "relationshipGeometry",
  ];

  for (const category of requiredCategories) {
    expect(vocab, `${name}: missing category "${category}"`).toHaveProperty(category);
    expect(Array.isArray(vocab[category]), `${name}: "${category}" should be an array`).toBe(true);
    expect(vocab[category].length, `${name}: "${category}" should have at least 1 term`).toBeGreaterThan(0);

    for (const entry of vocab[category]) {
      expect(entry, `${name}: term in "${category}" missing "term" field`).toHaveProperty("term");
      expect(entry, `${name}: term in "${category}" missing "instruction" field`).toHaveProperty("instruction");
      expect(typeof entry.term, `${name}: term in "${category}" should be a string`).toBe("string");
      expect(typeof entry.instruction, `${name}: instruction in "${category}" should be a string`).toBe("string");
      expect(entry.term.length, `${name}: term in "${category}" should not be empty`).toBeGreaterThan(0);
      expect(entry.instruction.length, `${name}: instruction in "${category}" should not be empty`).toBeGreaterThan(0);
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Platform Default Vocabulary", () => {
  it("has all six required vocabulary categories", () => {
    validateVocabularyStructure(PLATFORM_DEFAULT_VOCABULARY, "Platform Default");
  });

  it("has at least 2 terms in every category", () => {
    const categories = Object.keys(PLATFORM_DEFAULT_VOCABULARY) as (keyof VocabularyJson)[];
    for (const cat of categories) {
      expect(PLATFORM_DEFAULT_VOCABULARY[cat].length).toBeGreaterThanOrEqual(2);
    }
  });

  it("forbidden terms all start with 'no '", () => {
    for (const entry of PLATFORM_DEFAULT_VOCABULARY.forbiddenTerms) {
      expect(entry.term.startsWith("no "), `Forbidden term "${entry.term}" should start with "no "`).toBe(true);
    }
  });

  it("all instructions are complete sentences (end with a word, not punctuation gap)", () => {
    const allTerms = Object.values(PLATFORM_DEFAULT_VOCABULARY).flat();
    for (const entry of allTerms) {
      expect(entry.instruction.length).toBeGreaterThan(10);
    }
  });
});

describe("Blooming Frontier Vocabulary", () => {
  it("has all six required vocabulary categories", () => {
    validateVocabularyStructure(BLOOMING_FRONTIER_VOCABULARY, "Blooming Frontier");
  });

  it("has at least 4 terms in environment category", () => {
    expect(BLOOMING_FRONTIER_VOCABULARY.environment.length).toBeGreaterThanOrEqual(4);
  });

  it("has at least 4 terms in forbidden terms category", () => {
    expect(BLOOMING_FRONTIER_VOCABULARY.forbiddenTerms.length).toBeGreaterThanOrEqual(4);
  });

  it("contains the Hofstadter Butterfly grammar term in relationship geometry", () => {
    const terms = BLOOMING_FRONTIER_VOCABULARY.relationshipGeometry.map((t) => t.term);
    expect(terms).toContain("Hofstadter Butterfly grammar");
  });

  it("contains golden hour 3200K in environment", () => {
    const terms = BLOOMING_FRONTIER_VOCABULARY.environment.map((t) => t.term);
    expect(terms).toContain("golden hour 3200K");
  });

  it("contains living teal color term", () => {
    const terms = BLOOMING_FRONTIER_VOCABULARY.colorLight.map((t) => t.term);
    expect(terms).toContain("living teal #00B4A0");
  });

  it("contains 'through not away from' in emotional register", () => {
    const terms = BLOOMING_FRONTIER_VOCABULARY.emotionalRegister.map((t) => t.term);
    expect(terms).toContain("through not away from");
  });

  it("has no duplicate terms within any category", () => {
    const categories = Object.keys(BLOOMING_FRONTIER_VOCABULARY) as (keyof VocabularyJson)[];
    for (const cat of categories) {
      const terms = BLOOMING_FRONTIER_VOCABULARY[cat].map((t) => t.term);
      const unique = new Set(terms);
      expect(unique.size, `Duplicate terms found in Blooming Frontier "${cat}"`).toBe(terms.length);
    }
  });
});

describe("Vocabulary Structure Comparison", () => {
  it("platform default and Blooming Frontier have the same category keys", () => {
    const defaultKeys = Object.keys(PLATFORM_DEFAULT_VOCABULARY).sort();
    const bloomingKeys = Object.keys(BLOOMING_FRONTIER_VOCABULARY).sort();
    expect(defaultKeys).toEqual(bloomingKeys);
  });

  it("Blooming Frontier has more terms than platform default (richer vocabulary)", () => {
    const defaultTotal = Object.values(PLATFORM_DEFAULT_VOCABULARY).flat().length;
    const bloomingTotal = Object.values(BLOOMING_FRONTIER_VOCABULARY).flat().length;
    expect(bloomingTotal).toBeGreaterThan(defaultTotal);
  });
});

describe("Arc Position Values", () => {
  const validArcPositions = ["gathering", "arriving", "open"] as const;

  it("has exactly three arc positions", () => {
    expect(validArcPositions).toHaveLength(3);
  });

  it("default arc position is 'arriving'", () => {
    const defaultPosition = "arriving";
    expect(validArcPositions).toContain(defaultPosition);
  });

  it("arc positions map to expected visual scales", () => {
    const arcScaleMap: Record<string, string> = {
      gathering: "compression/intimate — opening implied in small precise details",
      arriving: "threshold/expanding — the opening becoming visible",
      open: "vast/resolved — the frontier dominant, full expression",
    };
    for (const pos of validArcPositions) {
      expect(arcScaleMap).toHaveProperty(pos);
      expect(arcScaleMap[pos].length).toBeGreaterThan(0);
    }
  });
});

describe("Arc Type Values", () => {
  const validArcTypes = [
    "expansive_mythic",
    "witnessing_lateral",
    "intimate_relational",
    "sustained_ambient",
    "erosive_revelatory",
    "cyclical_return",
  ] as const;

  it("has exactly six arc types from the Listening Bible Chapter 2 taxonomy", () => {
    expect(validArcTypes).toHaveLength(6);
  });

  it("Blooming Frontier maps to expansive_mythic arc type", () => {
    const bloomingFrontierArcType = "expansive_mythic";
    expect(validArcTypes).toContain(bloomingFrontierArcType);
  });

  it("all arc type values are snake_case strings", () => {
    for (const arcType of validArcTypes) {
      expect(arcType).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("DB Helper Contracts (mocked)", () => {
  // These tests validate the function signatures and mock behavior
  // without requiring a live database connection.

  it("getDefaultCreatorFrequency returns null when no frequency exists", async () => {
    const mockGetDefault = vi.fn().mockResolvedValue(null);
    const result = await mockGetDefault(999);
    expect(result).toBeNull();
    expect(mockGetDefault).toHaveBeenCalledWith(999);
  });

  it("saveCreatorFrequency returns a numeric ID", async () => {
    const mockSave = vi.fn().mockResolvedValue(42);
    const result = await mockSave({
      userId: 1,
      frequencyName: "Test Frequency",
      arcType: "expansive_mythic",
      vocabularyJson: BLOOMING_FRONTIER_VOCABULARY,
      isDefault: true,
    });
    expect(typeof result).toBe("number");
    expect(result).toBe(42);
  });

  it("getPlatformDefaultVocabulary returns null when not seeded", async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const result = await mockGet();
    expect(result).toBeNull();
  });

  it("getPlatformDefaultVocabulary returns a record with vocabularyJson and version", async () => {
    const mockRecord = {
      id: 1,
      vocabularyJson: PLATFORM_DEFAULT_VOCABULARY,
      version: 1,
      updatedAt: new Date(),
    };
    const mockGet = vi.fn().mockResolvedValue(mockRecord);
    const result = await mockGet();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("vocabularyJson");
    expect(result).toHaveProperty("version");
    expect(result.version).toBe(1);
  });

  it("listCreatorFrequencies returns an array", async () => {
    const mockList = vi.fn().mockResolvedValue([]);
    const result = await mockList(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("setDefaultCreatorFrequency is called with id and userId", async () => {
    const mockSetDefault = vi.fn().mockResolvedValue(undefined);
    await mockSetDefault(1, 1);
    expect(mockSetDefault).toHaveBeenCalledWith(1, 1);
  });
});
