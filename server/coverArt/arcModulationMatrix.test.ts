/**
 * Arc Modulation Matrix — Vitest Test Suite
 *
 * Tests the Emotional Physics Modulation Matrix translation layer:
 *   - Profile integrity (all 8 dimensions present for all 3 arcs)
 *   - Correct physics values per arc (shadow ratio, scale, depth, motion, etc.)
 *   - Translation correctness (prompt directive contains expected language)
 *   - Arc isolation (Gathering cannot look Open, Open cannot feel compressed)
 *   - Integration with promptBuilder (arcModulation layer appears in output)
 */

import { describe, it, expect } from "vitest";
import {
  ARC_MODULATION_PROFILES,
  buildArcModulationDirectives,
  getArcModulationProfile,
} from "./arcModulationMatrix";
import { buildCoverArtPrompt } from "./promptBuilder";
import type { ArcPosition } from "./promptBuilder";

// ─── Minimal vocabulary fixture ───────────────────────────────────────────────
const minimalVocabulary = {
  environment: [{ term: "open field", instruction: "wide open field" }],
  emotionalRegister: [{ term: "resilient", instruction: "resilient energy" }],
  arcTerms: [{ term: "forward", instruction: "moving forward" }],
  forbiddenTerms: [{ term: "glowing orbs", instruction: "no glowing orbs" }],
  colorLight: [{ term: "golden hour", instruction: "golden hour light" }],
  relationshipGeometry: [{ term: "solitary", instruction: "solitary figure" }],
};

// ─── Profile Integrity ────────────────────────────────────────────────────────

describe("ARC_MODULATION_PROFILES — profile integrity", () => {
  const arcs: ArcPosition[] = ["gathering", "arriving", "open"];

  it("defines profiles for all three arc positions", () => {
    for (const arc of arcs) {
      expect(ARC_MODULATION_PROFILES[arc]).toBeDefined();
    }
  });

  it("each profile has all 7 required fields", () => {
    for (const arc of arcs) {
      const p = ARC_MODULATION_PROFILES[arc];
      expect(p.shadowRatio).toHaveLength(2);
      expect(p.scaleRange).toHaveLength(2);
      expect(p.depthMode).toBeDefined();
      expect(p.irregularityLevel).toBeDefined();
      expect(p.withholdingLevel).toBeDefined();
      expect(p.lightDiffusion).toBeDefined();
      expect(p.motionLevel).toBeDefined();
    }
  });

  it("shadow ratios are valid fractions [0, 1]", () => {
    for (const arc of arcs) {
      const [min, max] = ARC_MODULATION_PROFILES[arc].shadowRatio;
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(1);
      expect(min).toBeLessThan(max);
    }
  });

  it("scale ranges are valid fractions [0, 1]", () => {
    for (const arc of arcs) {
      const [min, max] = ARC_MODULATION_PROFILES[arc].scaleRange;
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(1);
      expect(min).toBeLessThan(max);
    }
  });
});

// ─── Arc Physics Values ───────────────────────────────────────────────────────

describe("ARC_MODULATION_PROFILES — physics values per arc", () => {
  it("gathering: high shadow (60–80%), shallow depth, high withholding, minimal motion", () => {
    const p = ARC_MODULATION_PROFILES.gathering;
    expect(p.shadowRatio[0]).toBe(0.6);
    expect(p.shadowRatio[1]).toBe(0.8);
    expect(p.depthMode).toBe("shallow");
    expect(p.withholdingLevel).toBe("high");
    expect(p.motionLevel).toBe("minimal");
    expect(p.lightDiffusion).toBe("steep");
    expect(p.irregularityLevel).toBe("subtle");
    expect(p.scaleRange[0]).toBe(0.2);
    expect(p.scaleRange[1]).toBe(0.4);
  });

  it("arriving: medium shadow (50–65%), layered depth, medium withholding, noticeable motion", () => {
    const p = ARC_MODULATION_PROFILES.arriving;
    expect(p.shadowRatio[0]).toBe(0.5);
    expect(p.shadowRatio[1]).toBe(0.65);
    expect(p.depthMode).toBe("layered");
    expect(p.withholdingLevel).toBe("medium");
    expect(p.motionLevel).toBe("noticeable");
    expect(p.lightDiffusion).toBe("controlled");
    expect(p.irregularityLevel).toBe("mixed");
    expect(p.scaleRange[0]).toBe(0.4);
    expect(p.scaleRange[1]).toBe(0.6);
  });

  it("open: low shadow (30–50%), deep depth, low withholding, ambient motion", () => {
    const p = ARC_MODULATION_PROFILES.open;
    expect(p.shadowRatio[0]).toBe(0.3);
    expect(p.shadowRatio[1]).toBe(0.5);
    expect(p.depthMode).toBe("deep");
    expect(p.withholdingLevel).toBe("low");
    expect(p.motionLevel).toBe("ambient");
    expect(p.lightDiffusion).toBe("gradual");
    expect(p.irregularityLevel).toBe("subtle");
    expect(p.scaleRange[0]).toBe(0.6);
    expect(p.scaleRange[1]).toBe(0.8);
  });

  it("shadow ratio decreases from gathering → arriving → open (compression to release)", () => {
    const g = ARC_MODULATION_PROFILES.gathering.shadowRatio[0];
    const a = ARC_MODULATION_PROFILES.arriving.shadowRatio[0];
    const o = ARC_MODULATION_PROFILES.open.shadowRatio[0];
    expect(g).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(o);
  });

  it("scale range increases from gathering → arriving → open (compression to expansion)", () => {
    const g = ARC_MODULATION_PROFILES.gathering.scaleRange[0];
    const a = ARC_MODULATION_PROFILES.arriving.scaleRange[0];
    const o = ARC_MODULATION_PROFILES.open.scaleRange[0];
    expect(g).toBeLessThan(a);
    expect(a).toBeLessThan(o);
  });
});

// ─── Translation Correctness ──────────────────────────────────────────────────

describe("buildArcModulationDirectives — translation correctness", () => {
  it("returns promptDirective and all 8 dimension strings", () => {
    for (const arc of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildArcModulationDirectives(arc);
      expect(typeof result.promptDirective).toBe("string");
      expect(result.promptDirective.length).toBeGreaterThan(50);
      expect(result.dimensions.lightStructure).toBeTruthy();
      expect(result.dimensions.shadowRatio).toBeTruthy();
      expect(result.dimensions.scale).toBeTruthy();
      expect(result.dimensions.depthStructure).toBeTruthy();
      expect(result.dimensions.motionTime).toBeTruthy();
      expect(result.dimensions.irregularity).toBeTruthy();
      expect(result.dimensions.withholding).toBeTruthy();
      expect(result.dimensions.biologicalAnchors).toBeTruthy();
    }
  });

  it("gathering directive contains shadow compression and steep falloff language", () => {
    const { promptDirective } = buildArcModulationDirectives("gathering");
    expect(promptDirective).toMatch(/60.80%/);
    expect(promptDirective).toMatch(/steep falloff/i);
    expect(promptDirective).toMatch(/shallow DOF/i);
    expect(promptDirective).toMatch(/high withholding/i);
    expect(promptDirective).toMatch(/warm skin/i);
  });

  it("arriving directive contains threshold and layered depth language", () => {
    const { promptDirective } = buildArcModulationDirectives("arriving");
    expect(promptDirective).toMatch(/50.65%/);
    expect(promptDirective).toMatch(/controlled falloff/i);
    expect(promptDirective).toMatch(/layered/i);
    expect(promptDirective).toMatch(/threshold/i);
    expect(promptDirective).toMatch(/gaze/i);
  });

  it("open directive contains release and vast environment language", () => {
    const { promptDirective } = buildArcModulationDirectives("open");
    expect(promptDirective).toMatch(/30.50%/);
    expect(promptDirective).toMatch(/gradual falloff/i);
    expect(promptDirective).toMatch(/deep space/i);
    expect(promptDirective).toMatch(/open disclosure/i);
    expect(promptDirective).toMatch(/horizon/i);
  });
});

// ─── Arc Isolation (The Core Guarantee) ──────────────────────────────────────

describe("Arc isolation — a Gathering image cannot look Open", () => {
  it("gathering and open directives share no withholding language", () => {
    const g = buildArcModulationDirectives("gathering");
    const o = buildArcModulationDirectives("open");
    // Gathering has 'high withholding'; Open has 'frame breathes'
    expect(g.dimensions.withholding).toContain("high withholding");
    expect(o.dimensions.withholding).toContain("frame breathes");
    expect(g.dimensions.withholding).not.toContain("frame breathes");
    expect(o.dimensions.withholding).not.toContain("high withholding");
  });

  it("gathering and open have distinct shadow ratio language", () => {
    const g = buildArcModulationDirectives("gathering");
    const o = buildArcModulationDirectives("open");
    expect(g.dimensions.shadowRatio).not.toBe(o.dimensions.shadowRatio);
    expect(g.dimensions.shadowRatio).toContain("60–80%");
    expect(o.dimensions.shadowRatio).toContain("30–50%");
  });

  it("gathering and open have distinct depth language", () => {
    const g = buildArcModulationDirectives("gathering");
    const o = buildArcModulationDirectives("open");
    expect(g.dimensions.depthStructure).toContain("shallow DOF");
    expect(o.dimensions.depthStructure).toContain("deep space");
  });

  it("gathering and open have distinct biological anchors", () => {
    const g = buildArcModulationDirectives("gathering");
    const o = buildArcModulationDirectives("open");
    // Gathering activates warmth/skin; Open activates sky/horizon
    expect(g.dimensions.biologicalAnchors).toMatch(/warm skin/i);
    expect(o.dimensions.biologicalAnchors).toMatch(/horizon/i);
    expect(g.dimensions.biologicalAnchors).not.toMatch(/horizon/i);
    expect(o.dimensions.biologicalAnchors).not.toMatch(/warm skin/i);
  });

  it("arriving is distinct from both gathering and open", () => {
    const g = buildArcModulationDirectives("gathering");
    const a = buildArcModulationDirectives("arriving");
    const o = buildArcModulationDirectives("open");
    expect(a.promptDirective).not.toBe(g.promptDirective);
    expect(a.promptDirective).not.toBe(o.promptDirective);
    expect(a.dimensions.irregularity).toContain("moderate element allowed");
  });
});

// ─── getArcModulationProfile ──────────────────────────────────────────────────

describe("getArcModulationProfile", () => {
  it("returns the correct profile for each arc", () => {
    expect(getArcModulationProfile("gathering")).toBe(ARC_MODULATION_PROFILES.gathering);
    expect(getArcModulationProfile("arriving")).toBe(ARC_MODULATION_PROFILES.arriving);
    expect(getArcModulationProfile("open")).toBe(ARC_MODULATION_PROFILES.open);
  });
});

// ─── Integration with promptBuilder ──────────────────────────────────────────

describe("promptBuilder integration — arcModulation layer", () => {
  it("output includes arcModulation string in layers", () => {
    const result = buildCoverArtPrompt({
      vocabulary: minimalVocabulary,
      arcPosition: "gathering",
    });
    expect(typeof result.layers.arcModulation).toBe("string");
    expect(result.layers.arcModulation.length).toBeGreaterThan(50);
  });

  it("output includes arcModulationDimensions with all 8 fields", () => {
    const result = buildCoverArtPrompt({
      vocabulary: minimalVocabulary,
      arcPosition: "arriving",
    });
    const dims = result.layers.arcModulationDimensions;
    expect(dims.lightStructure).toBeTruthy();
    expect(dims.shadowRatio).toBeTruthy();
    expect(dims.scale).toBeTruthy();
    expect(dims.depthStructure).toBeTruthy();
    expect(dims.motionTime).toBeTruthy();
    expect(dims.irregularity).toBeTruthy();
    expect(dims.withholding).toBeTruthy();
    expect(dims.biologicalAnchors).toBeTruthy();
  });

  it("arcModulation directive appears in the assembled prompt string", () => {
    const result = buildCoverArtPrompt({
      vocabulary: minimalVocabulary,
      arcPosition: "open",
    });
    // The open directive contains 'open disclosure' and 'horizon' — verify it's in the prompt
    expect(result.prompt).toContain("open disclosure");
    expect(result.prompt).toContain("horizon");
  });

  it("gathering prompt contains shadow compression language from the matrix", () => {
    const result = buildCoverArtPrompt({
      vocabulary: minimalVocabulary,
      arcPosition: "gathering",
    });
    expect(result.prompt).toMatch(/60.80%/);
    expect(result.prompt).toMatch(/steep falloff/i);
  });

  it("arriving prompt contains threshold language from the matrix", () => {
    const result = buildCoverArtPrompt({
      vocabulary: minimalVocabulary,
      arcPosition: "arriving",
    });
    expect(result.prompt).toMatch(/threshold/i);
    expect(result.prompt).toMatch(/layered/i);
  });

  it("arcModulation layer is distinct for each arc in the same prompt build", () => {
    const g = buildCoverArtPrompt({ vocabulary: minimalVocabulary, arcPosition: "gathering" });
    const a = buildCoverArtPrompt({ vocabulary: minimalVocabulary, arcPosition: "arriving" });
    const o = buildCoverArtPrompt({ vocabulary: minimalVocabulary, arcPosition: "open" });
    expect(g.layers.arcModulation).not.toBe(a.layers.arcModulation);
    expect(a.layers.arcModulation).not.toBe(o.layers.arcModulation);
    expect(g.layers.arcModulation).not.toBe(o.layers.arcModulation);
  });

  it("prompt stays under 980 characters with the compressed matrix layer", () => {
    for (const arc of ["gathering", "arriving", "open"] as ArcPosition[]) {
      const result = buildCoverArtPrompt({
        vocabulary: minimalVocabulary,
        arcPosition: arc,
        lyricPhrases: ["empty highway at 2am", "headlights on wet asphalt"],
        genre: "indie rock",
      });
      expect(result.charCount).toBeLessThanOrEqual(980);
    }
  });
});
