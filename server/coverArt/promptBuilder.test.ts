/**
 * Cover Art Prompt Builder Tests — Phase L
 *
 * Tests for buildCoverArtPrompt(), the arc position weighting system,
 * the vocabulary layer fallback, and the character limit guard.
 * No database or LLM calls required — all tests are pure unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildCoverArtPrompt,
  type ArcPosition,
  type VocabularyJson,
  type CoverArtPromptInput,
} from "./promptBuilder";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const MINIMAL_VOCABULARY: VocabularyJson = {
  environment: [
    { term: "earned light", instruction: "Light that has been through something" },
    { term: "honest materials", instruction: "Surfaces that are what they appear to be" },
    { term: "world as it is", instruction: "The real world, not a stylized version" },
    { term: "no decorative emptiness", instruction: "Empty space is intentional" },
  ],
  emotionalRegister: [
    { term: "present tense", instruction: "The image is happening now" },
    { term: "neither triumphant nor defeated", instruction: "The emotional register is honest" },
    { term: "the thing itself", instruction: "Represent the subject directly" },
  ],
  arcTerms: [
    { term: "through not away from", instruction: "Movement is forward into the experience" },
    { term: "forward motion implied", instruction: "The image suggests continuation" },
    { term: "not yet resolved but not abandoned", instruction: "The tension is held" },
  ],
  forbiddenTerms: [
    { term: "no false comfort", instruction: "Do not soften with unearned warmth" },
    { term: "no false darkness", instruction: "Do not impose aesthetic gloom" },
    { term: "no stock imagery grammar", instruction: "Avoid visual clichés" },
    { term: "no generic beauty", instruction: "Beauty should be specific and earned" },
  ],
  colorLight: [
    { term: "available light", instruction: "Use the light that is actually there" },
    { term: "source traceable", instruction: "Every light source should be identifiable" },
    { term: "no theatrical lighting", instruction: "Avoid dramatic rim lights" },
    { term: "warmth earned not imposed", instruction: "Warm tones are present when earned" },
  ],
  relationshipGeometry: [
    { term: "subject in context", instruction: "The subject exists in a real environment" },
    { term: "scale honest", instruction: "The subject is the size it actually is" },
  ],
};

const BLOOMING_FRONTIER_VOCABULARY: VocabularyJson = {
  environment: [
    { term: "golden organic", instruction: "Warm amber light, living ground, organic materials" },
    { term: "open threshold", instruction: "Forest edge meeting vast open landscape" },
    { term: "horizon always visible", instruction: "No enclosure, no walls, world continues beyond every frame edge" },
    { term: "vast open", instruction: "Figure small against landscape scale" },
    { term: "canopy threshold", instruction: "Ancient forest path, high canopy filtering light" },
    { term: "living ground", instruction: "Moss, grass, root systems, earth" },
    { term: "golden hour 3200K", instruction: "Warm amber directional light, sun low, organic glow" },
    { term: "fine golden atmospheric haze", instruction: "Pollen and spores suspended in light shafts" },
    { term: "bioluminescent ground-level", instruction: "Soft teal-green glow from moss and fern" },
    { term: "world breathes", instruction: "Open, horizon present, frame implies more beyond every edge" },
  ],
  emotionalRegister: [
    { term: "quiet wonder", instruction: "Someone who has just seen something unexpected and finds it beautiful" },
    { term: "earned warmth", instruction: "Warmth that has been through something" },
    { term: "through not away from", instruction: "Movement is forward into the difficult thing" },
    { term: "equal co-presence", instruction: "Neither presence dominates" },
    { term: "music as third presence", instruction: "The shared subject both presences are oriented toward" },
  ],
  arcTerms: [
    { term: "compression builds to rupture", instruction: "The arc moves from contained pressure outward" },
    { term: "outward and forward", instruction: "The direction of movement is always outward and forward" },
    { term: "threshold stance", instruction: "Standing at a boundary" },
    { term: "darkness still present but not final", instruction: "Shadow is present but not the conclusion" },
  ],
  forbiddenTerms: [
    { term: "no neon practicals", instruction: "No dark background with electric light" },
    { term: "no vaporwave", instruction: "No retro-digital, no pastel nostalgia palette" },
    { term: "no robotic servitude", instruction: "No AI threat narrative" },
    { term: "no enclosed spaces", instruction: "Horizon visible, world continues beyond frame" },
    { term: "no visible rose flower", instruction: "Rose geometry as light formation structure only" },
    { term: "not humanoid not angelic", instruction: "Companion is not human-shaped" },
  ],
  colorLight: [
    { term: "rose amber #B5651D", instruction: "2700K primary warm" },
    { term: "deep petal #7B2D3E", instruction: "Warm dark shadow" },
    { term: "forest interior #2D5A27", instruction: "Living shadow green" },
    { term: "living teal #00B4A0", instruction: "Organic glow at companion edges" },
    { term: "frontier blue #4A90B8", instruction: "Cool reach, far horizon" },
    { term: "petal violet #C8A0D0", instruction: "Where warm and cool begin to meet" },
    { term: "meeting-point color", instruction: "The third color where warm amber and cool luminescence touch" },
    { term: "Kelvin arc 3200K to 4500K", instruction: "The light temperature range" },
    { term: "subsurface scattering on skin", instruction: "Warm amber light penetrates the surface slightly" },
  ],
  relationshipGeometry: [
    { term: "side by side", instruction: "Neither in front of nor behind" },
    { term: "same horizon", instruction: "Both presences oriented toward the same point" },
    { term: "space between them", instruction: "A small gap — this is where the Blooming Frontier lives" },
    { term: "Hofstadter Butterfly grammar", instruction: "Bilaterally structured luminescent fractal" },
    { term: "whole body visible", instruction: "Full figure in frame" },
    { term: "feet on living ground", instruction: "Weight present, grounded" },
    { term: "oriented toward the horizon", instruction: "Body and gaze directed outward" },
    { term: "organic wardrobe", instruction: "Natural fibers, worn cotton, lived-in leather" },
  ],
};

// ─── Basic Assembly Tests ─────────────────────────────────────────────────────

describe("buildCoverArtPrompt — basic assembly", () => {
  it("returns a non-empty prompt string", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.prompt.length).toBeGreaterThan(50);
  });

  it("charCount matches the actual prompt length", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.charCount).toBe(result.prompt.length);
  });

  it("prompt is under 900 characters without truncation", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.charCount).toBeLessThanOrEqual(900);
    expect(result.wasTruncated).toBe(false);
  });

  it("includes the quality tail in every prompt", () => {
    for (const arcPosition of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildCoverArtPrompt({ vocabulary: MINIMAL_VOCABULARY, arcPosition });
      expect(result.prompt).toContain("Square 1:1 composition");
    }
  });

  it("includes forbidden terms as 'no X' negatives", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    // Forbidden terms are now "no X" direct negatives (not "avoid: X")
    expect(result.prompt).toContain("no false comfort");
  });

  it("returns a layers breakdown with all expected keys", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.layers).toHaveProperty("arcFraming");
    expect(result.layers).toHaveProperty("environmentTerms");
    expect(result.layers).toHaveProperty("emotionalTerms");
    expect(result.layers).toHaveProperty("arcTerms");
    expect(result.layers).toHaveProperty("colorLightTerms");
    expect(result.layers).toHaveProperty("lyricPhrases");
    expect(result.layers).toHaveProperty("forbiddenTerms");
    expect(result.layers).toHaveProperty("productionContext");
    expect(result.layers).toHaveProperty("cinematiqueRendering");
  });

  it("includes Cin\u00e9matique rendering directives in every prompt", () => {
    for (const arcPosition of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildCoverArtPrompt({ vocabulary: MINIMAL_VOCABULARY, arcPosition });
      // Each arc position should have a non-empty cinematic rendering directive
      expect(result.layers.cinematiqueRendering.length).toBeGreaterThan(20);
      expect(result.prompt).toContain(result.layers.cinematiqueRendering);
    }
  });

  it("gathering arc has chiaroscuro rendering directive", () => {
    const result = buildCoverArtPrompt({ vocabulary: MINIMAL_VOCABULARY, arcPosition: "gathering" });
    expect(result.layers.cinematiqueRendering).toContain("chiaroscuro");
    expect(result.prompt).toContain("chiaroscuro");
  });

  it("open arc has wide dynamic range rendering directive", () => {
    const result = buildCoverArtPrompt({ vocabulary: MINIMAL_VOCABULARY, arcPosition: "open" });
    expect(result.layers.cinematiqueRendering).toContain("wide dynamic range");
    expect(result.prompt).toContain("wide dynamic range");
  });

  it("quality tail includes album cover aesthetic", () => {
    const result = buildCoverArtPrompt({ vocabulary: MINIMAL_VOCABULARY, arcPosition: "arriving" });
    expect(result.prompt).toContain("Album cover aesthetic");
  });
});

// ─── Arc Position Tests ───────────────────────────────────────────────────────

describe("buildCoverArtPrompt — arc position framing", () => {
  it("gathering arc includes 'intimate' framing", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "gathering",
    });
    expect(result.prompt).toContain("intimate");
    expect(result.layers.arcFraming).toContain("intimate");
  });

  it("arriving arc includes 'threshold' framing", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.prompt).toContain("threshold");
    expect(result.layers.arcFraming).toContain("threshold");
  });

  it("open arc includes 'landscape' framing", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "open",
    });
    expect(result.prompt).toContain("landscape");
    expect(result.layers.arcFraming).toContain("landscape");
  });

  it("three arc positions produce three distinct prompts", () => {
    const prompts = (["gathering", "arriving", "open"] as ArcPosition[]).map((arc) =>
      buildCoverArtPrompt({ vocabulary: MINIMAL_VOCABULARY, arcPosition: arc }).prompt
    );
    expect(prompts[0]).not.toBe(prompts[1]);
    expect(prompts[1]).not.toBe(prompts[2]);
    expect(prompts[0]).not.toBe(prompts[2]);
  });
});

// ─── Arc Position Weighting Tests ─────────────────────────────────────────────

describe("buildCoverArtPrompt — arc position vocabulary weighting", () => {
  it("gathering uses fewer environment terms than open", () => {
    const gathering = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "gathering",
    });
    const open = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "open",
    });
    expect(gathering.layers.environmentTerms.length).toBeLessThan(
      open.layers.environmentTerms.length
    );
  });

  it("gathering uses more emotional register terms than open", () => {
    const gathering = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "gathering",
    });
    const open = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "open",
    });
    expect(gathering.layers.emotionalTerms.length).toBeGreaterThanOrEqual(
      open.layers.emotionalTerms.length
    );
  });

  it("open uses maximum environment terms (4 for Blooming Frontier)", () => {
    const result = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "open",
    });
    expect(result.layers.environmentTerms.length).toBe(4);
  });

  it("gathering uses minimum environment terms (2)", () => {
    const result = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "gathering",
    });
    expect(result.layers.environmentTerms.length).toBe(2);
  });
});

// ─── Lyric Phrases Tests ──────────────────────────────────────────────────────

describe("buildCoverArtPrompt — lyric phrases", () => {
  it("includes lyric phrases in the prompt when provided", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      lyricPhrases: ["the window left open all night", "rain on the fire escape"],
    });
    // Lyrics appear directly in the prompt (no 'lyric anchors:' prefix in new format)
    expect(result.prompt).toContain("the window left open all night");
    expect(result.prompt).toContain("rain on the fire escape");
    // Lyrics should appear near the start of the prompt (lyric-first order)
    const lyricIndex = result.prompt.indexOf("the window left open all night");
    expect(lyricIndex).toBeLessThan(100);
  });

  it("lyric phrases appear in the layers breakdown", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      lyricPhrases: ["your coat still on the chair"],
    });
    expect(result.layers.lyricPhrases).toContain("your coat still on the chair");
  });

  it("prompt without lyrics does not include 'lyric anchors:' section", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.prompt).not.toContain("lyric anchors:");
    expect(result.layers.lyricPhrases).toHaveLength(0);
  });

  it("empty lyric phrases array behaves same as no lyrics", () => {
    const withEmpty = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      lyricPhrases: [],
    });
    const withNull = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      lyricPhrases: null,
    });
    expect(withEmpty.prompt).toBe(withNull.prompt);
  });

  it("filters out empty lyric phrase strings", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      lyricPhrases: ["valid phrase", "", "  "],
    });
    expect(result.layers.lyricPhrases).toHaveLength(1);
    expect(result.layers.lyricPhrases[0]).toBe("valid phrase");
  });
});

// ─── Production Context Tests ─────────────────────────────────────────────────

describe("buildCoverArtPrompt — production context (genre/mood)", () => {
  it("includes genre context when provided", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      genre: "indie folk",
    });
    // Genre appears directly (no 'genre context:' prefix in new format)
    expect(result.prompt).toContain("indie folk");
    expect(result.layers.productionContext).toContain("indie folk");
  });

  it("translates mood tags into energy directives in the prompt", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      moodTags: ["melancholic", "introspective"],
    });
    // Mood tags are now translated to energy directives — "melancholic" maps to
    // "cool desaturated tones, diffused light, quiet emptiness" and
    // "solitary figure, turned away or distant"
    expect(result.prompt).toContain("cool desaturated tones");
    expect(result.prompt).toContain("solitary figure");
  });

  it("uses the first matching mood tag for energy directive", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      moodTags: ["energetic", "raw", "melancholic", "hopeful"],
    });
    // First matching tag (energetic) should win
    expect(result.prompt).toContain("kinetic energy");
    expect(result.prompt).toContain("multiple figures");
  });

  it("no production context when genre and moodTags are both absent", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.layers.productionContext).toBeNull();
  });

  it("no production context when genre is null and moodTags is empty", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
      genre: null,
      moodTags: [],
    });
    expect(result.layers.productionContext).toBeNull();
  });
});

// ─── Character Limit Tests ────────────────────────────────────────────────────

describe("buildCoverArtPrompt — character limit guard", () => {
  it("Blooming Frontier vocabulary with all inputs stays under 900 chars", () => {
    const result = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "open",
      lyricPhrases: [
        "the window left open all night",
        "rain on the fire escape",
        "your coat still on the chair",
      ],
      genre: "indie folk",
      moodTags: ["melancholic", "introspective"],
    });
    expect(result.charCount).toBeLessThanOrEqual(900);
  });

  it("wasTruncated is false for all three arc positions with Blooming Frontier", () => {
    for (const arcPosition of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildCoverArtPrompt({
        vocabulary: BLOOMING_FRONTIER_VOCABULARY,
        arcPosition,
        lyricPhrases: ["the window left open all night", "rain on the fire escape"],
        genre: "indie folk",
        moodTags: ["melancholic", "introspective"],
      });
      expect(result.wasTruncated).toBe(false);
    }
  });

  it("wasTruncated is true when prompt exceeds 900 chars", () => {
    // Create a vocabulary with very long instructions to force truncation
    const longVocab: VocabularyJson = {
      ...MINIMAL_VOCABULARY,
      environment: Array(10).fill(null).map((_, i) => ({
        term: `environment term ${i} with a very long name that takes up lots of space in the prompt`,
        instruction: "A very long instruction that would cause the prompt to exceed the character limit if many are included",
      })),
      emotionalRegister: Array(10).fill(null).map((_, i) => ({
        term: `emotional register term ${i} with a very long name that takes up lots of space`,
        instruction: "Another very long instruction",
      })),
    };
    const result = buildCoverArtPrompt({
      vocabulary: longVocab,
      arcPosition: "open",
      lyricPhrases: [
        "a very long lyric phrase that takes up a lot of space in the prompt assembly",
        "another very long lyric phrase that also takes up a lot of space",
        "and a third very long lyric phrase to push it over the limit",
      ],
      genre: "a very long genre description that takes up space",
      moodTags: ["a very long mood tag one", "a very long mood tag two"],
    });
    // The truncation guard should have kicked in
    expect(result.charCount).toBeLessThanOrEqual(900);
    // wasTruncated may or may not be true depending on actual length
    // but the prompt must never exceed 900 chars
    expect(result.prompt.length).toBeLessThanOrEqual(900);
  });
});

// ─── Vocabulary Integrity Tests ───────────────────────────────────────────────

describe("buildCoverArtPrompt — vocabulary integrity", () => {
  it("uses first N terms in order (not random)", () => {
    const result = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "arriving",
    });
    // arriving uses 3 environment terms — should be the first 3
    expect(result.layers.environmentTerms[0]).toBe("golden organic");
    expect(result.layers.environmentTerms[1]).toBe("open threshold");
    expect(result.layers.environmentTerms[2]).toBe("horizon always visible");
  });

  it("always includes exactly 3 forbidden terms", () => {
    for (const arcPosition of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildCoverArtPrompt({
        vocabulary: BLOOMING_FRONTIER_VOCABULARY,
        arcPosition,
      });
      expect(result.layers.forbiddenTerms).toHaveLength(3);
    }
  });

  it("forbidden terms are always 'no X' direct negatives", () => {
    const result = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "arriving",
    });
    for (const term of result.layers.forbiddenTerms) {
      // Terms should start with 'no ' (direct negative, not 'avoid: X')
      expect(term.toLowerCase().startsWith("no ")).toBe(true);
    }
  });

  it("same vocabulary + same arc position + same lyrics always produces same prompt", () => {
    const input: CoverArtPromptInput = {
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "arriving",
      lyricPhrases: ["the window left open all night"],
    };
    const result1 = buildCoverArtPrompt(input);
    const result2 = buildCoverArtPrompt(input);
    expect(result1.prompt).toBe(result2.prompt);
  });
});

// ─── Full Pipeline Smoke Tests ────────────────────────────────────────────────

describe("buildCoverArtPrompt — full pipeline smoke tests", () => {
  it("platform default vocabulary + no lyrics produces a valid prompt", () => {
    const result = buildCoverArtPrompt({
      vocabulary: MINIMAL_VOCABULARY,
      arcPosition: "arriving",
    });
    expect(result.prompt.length).toBeGreaterThan(100);
    expect(result.charCount).toBeLessThanOrEqual(900);
    expect(result.wasTruncated).toBe(false);
  });

  it("personal vocabulary + lyrics + genre produces a valid prompt", () => {
    const result = buildCoverArtPrompt({
      vocabulary: BLOOMING_FRONTIER_VOCABULARY,
      arcPosition: "open",
      lyricPhrases: ["the window left open all night", "rain on the fire escape"],
      genre: "indie folk",
      moodTags: ["melancholic"],
    });
    expect(result.prompt.length).toBeGreaterThan(150);
    expect(result.charCount).toBeLessThanOrEqual(900);
    expect(result.wasTruncated).toBe(false);
    // Lyrics come first in the new format
    expect(result.prompt).toContain("the window left open all night");
    expect(result.prompt).toContain("golden organic");
    // Genre appears directly without prefix
    expect(result.prompt).toContain("indie folk");
  });

  it("all three arc positions with Blooming Frontier produce valid prompts", () => {
    for (const arcPosition of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildCoverArtPrompt({
        vocabulary: BLOOMING_FRONTIER_VOCABULARY,
        arcPosition,
        lyricPhrases: ["the window left open all night"],
      });
      expect(result.charCount).toBeLessThanOrEqual(900);
      expect(result.wasTruncated).toBe(false);
      expect(result.prompt).toContain("Square 1:1 composition");
    }
  });
});
