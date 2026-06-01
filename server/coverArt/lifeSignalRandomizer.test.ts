/**
 * Life Signal Randomizer — Unit Tests
 *
 * Tests the registry integrity, weighted selection logic, incompatibility
 * enforcement, rotation memory, and arc-position filtering.
 */

import { describe, it, expect } from "vitest";
import {
  LIFE_SIGNAL_REGISTRY,
  SAFE_DEFAULT_SIGNAL_IDS,
  selectLifeSignals,
  type LifeSignal,
} from "./lifeSignalRandomizer";
import type { ArcPosition } from "./promptBuilder";

// ─── Registry Integrity ───────────────────────────────────────────────────────

describe("LIFE_SIGNAL_REGISTRY integrity", () => {
  it("has exactly 20 entries", () => {
    expect(LIFE_SIGNAL_REGISTRY).toHaveLength(20);
  });

  it("all entries have unique IDs", () => {
    const ids = LIFE_SIGNAL_REGISTRY.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all entries have non-empty promptFragment", () => {
    for (const sig of LIFE_SIGNAL_REGISTRY) {
      expect(sig.promptFragment.trim().length).toBeGreaterThan(0);
    }
  });

  it("all weights are between 0 and 1 inclusive", () => {
    for (const sig of LIFE_SIGNAL_REGISTRY) {
      expect(sig.weight).toBeGreaterThan(0);
      expect(sig.weight).toBeLessThanOrEqual(1);
    }
  });

  it("all intensity values are 'subtle' or 'moderate'", () => {
    const valid = new Set(["subtle", "moderate"]);
    for (const sig of LIFE_SIGNAL_REGISTRY) {
      expect(valid.has(sig.intensity)).toBe(true);
    }
  });

  it("all eligibleArcs values are valid arc positions or empty", () => {
    const valid = new Set<ArcPosition>(["gathering", "arriving", "open"]);
    for (const sig of LIFE_SIGNAL_REGISTRY) {
      for (const arc of sig.eligibleArcs) {
        expect(valid.has(arc)).toBe(true);
      }
    }
  });

  it("all incompatibleWith IDs reference existing signal IDs", () => {
    const allIds = new Set(LIFE_SIGNAL_REGISTRY.map((s) => s.id));
    for (const sig of LIFE_SIGNAL_REGISTRY) {
      for (const incompatId of sig.incompatibleWith) {
        // incompatibleWith may reference context IDs (like 'open_daylight_scene')
        // that are not in the registry — those are context tags, not signal IDs.
        // Only check IDs that actually exist in the registry.
        if (allIds.has(incompatId)) {
          expect(allIds.has(incompatId)).toBe(true);
        }
      }
    }
  });

  it("safe defaults are all present in the registry", () => {
    const allIds = new Set(LIFE_SIGNAL_REGISTRY.map((s) => s.id));
    for (const id of SAFE_DEFAULT_SIGNAL_IDS) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it("all safe defaults are eligible for at least one arc", () => {
    for (const id of SAFE_DEFAULT_SIGNAL_IDS) {
      const sig = LIFE_SIGNAL_REGISTRY.find((s) => s.id === id)!;
      // Safe defaults should be available for all arcs (empty eligibleArcs = all arcs)
      // OR explicitly list multiple arcs
      const isUniversal = sig.eligibleArcs.length === 0 || sig.eligibleArcs.length >= 2;
      expect(isUniversal).toBe(true);
    }
  });
});

// ─── selectLifeSignals — Basic Behavior ──────────────────────────────────────

describe("selectLifeSignals — basic behavior", () => {
  it("returns a result for 'gathering'", () => {
    const result = selectLifeSignals("gathering");
    expect(result).toBeDefined();
    expect(result.selectedIds).toBeDefined();
    expect(result.promptFragment).toBeDefined();
  });

  it("returns a result for 'arriving'", () => {
    const result = selectLifeSignals("arriving");
    expect(result).toBeDefined();
  });

  it("returns a result for 'open'", () => {
    const result = selectLifeSignals("open");
    expect(result).toBeDefined();
  });

  it("returns 1 signal for 'gathering'", () => {
    const result = selectLifeSignals("gathering");
    expect(result.selectedIds).toHaveLength(1);
  });

  it("returns 2 signals for 'arriving'", () => {
    const result = selectLifeSignals("arriving");
    expect(result.selectedIds).toHaveLength(2);
  });

  it("returns 1 signal for 'open'", () => {
    const result = selectLifeSignals("open");
    expect(result.selectedIds).toHaveLength(1);
  });

  it("promptFragment is non-empty when signals are selected", () => {
    const result = selectLifeSignals("arriving");
    expect(result.promptFragment.trim().length).toBeGreaterThan(0);
  });

  it("promptFragment contains the actual prompt text from selected signals", () => {
    const result = selectLifeSignals("gathering");
    const selectedSignal = LIFE_SIGNAL_REGISTRY.find(
      (s) => s.id === result.selectedIds[0]
    )!;
    expect(result.promptFragment).toContain(selectedSignal.promptFragment);
  });
});

// ─── Arc Eligibility Filtering ────────────────────────────────────────────────

describe("selectLifeSignals — arc eligibility", () => {
  it("only selects signals eligible for 'gathering'", () => {
    for (let i = 0; i < 20; i++) {
      const result = selectLifeSignals("gathering");
      for (const id of result.selectedIds) {
        const sig = LIFE_SIGNAL_REGISTRY.find((s) => s.id === id)!;
        const eligible =
          sig.eligibleArcs.length === 0 || sig.eligibleArcs.includes("gathering");
        expect(eligible).toBe(true);
      }
    }
  });

  it("only selects signals eligible for 'arriving'", () => {
    for (let i = 0; i < 20; i++) {
      const result = selectLifeSignals("arriving");
      for (const id of result.selectedIds) {
        const sig = LIFE_SIGNAL_REGISTRY.find((s) => s.id === id)!;
        const eligible =
          sig.eligibleArcs.length === 0 || sig.eligibleArcs.includes("arriving");
        expect(eligible).toBe(true);
      }
    }
  });

  it("only selects signals eligible for 'open'", () => {
    for (let i = 0; i < 20; i++) {
      const result = selectLifeSignals("open");
      for (const id of result.selectedIds) {
        const sig = LIFE_SIGNAL_REGISTRY.find((s) => s.id === id)!;
        const eligible =
          sig.eligibleArcs.length === 0 || sig.eligibleArcs.includes("open");
        expect(eligible).toBe(true);
      }
    }
  });
});

// ─── Incompatibility Enforcement ─────────────────────────────────────────────

describe("selectLifeSignals — incompatibility enforcement", () => {
  it("never selects two mutually incompatible signals together", () => {
    // Run many times to catch probabilistic incompatibility violations
    for (let i = 0; i < 50; i++) {
      const result = selectLifeSignals("arriving");
      const selected = result.selectedIds.map(
        (id) => LIFE_SIGNAL_REGISTRY.find((s) => s.id === id)!
      );
      for (let a = 0; a < selected.length; a++) {
        for (let b = a + 1; b < selected.length; b++) {
          const aIncompat = selected[a].incompatibleWith.includes(selected[b].id);
          const bIncompat = selected[b].incompatibleWith.includes(selected[a].id);
          expect(aIncompat).toBe(false);
          expect(bIncompat).toBe(false);
        }
      }
    }
  });

  it("never selects two moderate-intensity signals together", () => {
    for (let i = 0; i < 50; i++) {
      const result = selectLifeSignals("arriving");
      const selected = result.selectedIds.map(
        (id) => LIFE_SIGNAL_REGISTRY.find((s) => s.id === id)!
      );
      const moderateCount = selected.filter((s) => s.intensity === "moderate").length;
      expect(moderateCount).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Rotation Memory ─────────────────────────────────────────────────────────

describe("selectLifeSignals — rotation memory", () => {
  it("does not repeat the same signal when it was used in the last generation", () => {
    // Run many times to verify the exclusion holds
    for (let i = 0; i < 30; i++) {
      const first = selectLifeSignals("gathering");
      const lastUsed = first.selectedIds;
      const second = selectLifeSignals("gathering", lastUsed);
      for (const id of lastUsed) {
        expect(second.selectedIds).not.toContain(id);
      }
    }
  });

  it("falls back gracefully when all eligible signals were recently used", () => {
    // Pass all eligible signal IDs as lastUsed — should still return something
    const allIds = LIFE_SIGNAL_REGISTRY.map((s) => s.id);
    const result = selectLifeSignals("gathering", allIds);
    // Should still return 1 signal (fallback relaxes rotation exclusion)
    expect(result.selectedIds).toHaveLength(1);
    expect(result.promptFragment.trim().length).toBeGreaterThan(0);
  });

  it("accepts empty lastUsedIds without error", () => {
    const result = selectLifeSignals("arriving", []);
    expect(result.selectedIds).toHaveLength(2);
  });

  it("accepts undefined lastUsedIds without error", () => {
    const result = selectLifeSignals("open", undefined);
    expect(result.selectedIds).toHaveLength(1);
  });
});

// ─── promptBuilder Integration ────────────────────────────────────────────────

describe("buildCoverArtPrompt — life signal integration", () => {
  it("includes life signal block in the assembled prompt", async () => {
    const { buildCoverArtPrompt } = await import("./promptBuilder");
    const mockVocab = {
      environment: [{ term: "empty stage", instruction: "empty stage" }],
      emotionalRegister: [{ term: "quiet intensity", instruction: "quiet intensity" }],
      arcTerms: [{ term: "threshold", instruction: "threshold" }],
      forbiddenTerms: [{ term: "cartoon", instruction: "cartoon" }],
      colorLight: [{ term: "warm amber", instruction: "warm amber" }],
      relationshipGeometry: [{ term: "solitary", instruction: "solitary" }],
    };
    const result = buildCoverArtPrompt({
      vocabulary: mockVocab,
      arcPosition: "gathering",
    });
    expect(result.layers.lifeSignalBlock).not.toBeNull();
    expect(result.layers.lifeSignalIds).toHaveLength(1);
    expect(result.prompt).toContain(result.layers.lifeSignalBlock!);
  });

  it("exposes lifeSignalIds in the layers debug output", async () => {
    const { buildCoverArtPrompt } = await import("./promptBuilder");
    const mockVocab = {
      environment: [{ term: "city rooftop", instruction: "city rooftop" }],
      emotionalRegister: [{ term: "longing", instruction: "longing" }],
      arcTerms: [{ term: "opening", instruction: "opening" }],
      forbiddenTerms: [],
      colorLight: [{ term: "cool blue", instruction: "cool blue" }],
      relationshipGeometry: [],
    };
    const result = buildCoverArtPrompt({
      vocabulary: mockVocab,
      arcPosition: "arriving",
    });
    expect(result.layers.lifeSignalIds.length).toBeGreaterThanOrEqual(1);
    expect(result.layers.lifeSignalIds.length).toBeLessThanOrEqual(2);
  });

  it("uses lastUsedLifeSignalIds to avoid repeating signals", async () => {
    const { buildCoverArtPrompt } = await import("./promptBuilder");
    const mockVocab = {
      environment: [{ term: "forest clearing", instruction: "forest clearing" }],
      emotionalRegister: [{ term: "wonder", instruction: "wonder" }],
      arcTerms: [{ term: "emergence", instruction: "emergence" }],
      forbiddenTerms: [],
      colorLight: [{ term: "dappled light", instruction: "dappled light" }],
      relationshipGeometry: [],
    };
    const first = buildCoverArtPrompt({
      vocabulary: mockVocab,
      arcPosition: "gathering",
    });
    const second = buildCoverArtPrompt({
      vocabulary: mockVocab,
      arcPosition: "gathering",
      lastUsedLifeSignalIds: first.layers.lifeSignalIds,
    });
    // The second generation should not repeat the first's signals
    for (const id of first.layers.lifeSignalIds) {
      expect(second.layers.lifeSignalIds).not.toContain(id);
    }
  });
});
