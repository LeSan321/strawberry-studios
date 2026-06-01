/**
 * Tests for the Cover Art Auto-Evaluation Heuristic
 * and the Adaptive Weight Tuning System.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateCoverArtPrompt,
  resolveLifeSignals,
  ARC_PHYSICS,
  SELF_HEALING_THRESHOLD,
} from "./coverArtEvaluator";
import {
  buildDefaultAdaptiveWeights,
  computeStabilityMetrics,
  shouldAdapt,
  runAdaptationCycle,
  getEffectiveSignalWeight,
  WINDOW_SIZE,
  ADAPTATION_INTERVAL,
  TARGET_RANGES,
  WEIGHT_MIN,
  WEIGHT_MAX,
  type GenerationLog,
} from "./coverArtAdaptiveController";
import { LIFE_SIGNAL_REGISTRY } from "./lifeSignalRandomizer";
import type { ArcPosition } from "./promptBuilder";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STRONG_GATHERING_PROMPT = [
  "intimate close-up scale, quiet and compressed,",
  "chiaroscuro lighting, deep shadow 70% frame, warm tungsten 2700K key,",
  "asymmetric composition, shallow depth of field, foreground texture for depth,",
  "velvet curtain, low light, muted palette, threshold,",
  "natural grain texture visible in shadow regions,",
  "subject positioned slightly off-center, natural asymmetry",
].join(" ");

const WEAK_PROMPT = "a person standing in a room";

const STRONG_OPEN_PROMPT = [
  "wide landscape scale, figure small against vast environment,",
  "wide dynamic range, natural available light, vast negative space,",
  "atmospheric depth, no artificial fill,",
  "deep space, atmospheric perspective, open horizon,",
  "hair slightly displaced as if recently moved",
].join(" ");

function makeLog(
  userId: number,
  arc: ArcPosition,
  lifeSignalIds: string[],
  scores: Partial<GenerationLog["qaScores"]> = {}
): GenerationLog {
  return {
    userId,
    arc,
    lifeSignalIds,
    lifeSignalIntensityTotal: lifeSignalIds.length,
    qaScores: {
      coherence: scores.coherence ?? 3,
      depth: scores.depth ?? 3,
      tension: scores.tension ?? 3,
      lifeSignal: scores.lifeSignal ?? 3,
      arcAlignment: scores.arcAlignment ?? 3,
      total: scores.total ?? 15,
    },
    timestamp: Date.now(),
  };
}

// ─── evaluateCoverArtPrompt ───────────────────────────────────────────────────

describe("evaluateCoverArtPrompt", () => {
  it("returns a healthy score for a well-formed gathering prompt", () => {
    const signals = resolveLifeSignals(["slight_off_center_balance", "surface_grain_in_shadow"]);
    const result = evaluateCoverArtPrompt({
      prompt: STRONG_GATHERING_PROMPT,
      arc: "gathering",
      injectedSignals: signals,
      lastUsedSignalIds: [],
    });

    expect(result.totalScore).toBeGreaterThanOrEqual(15);
    expect(result.totalScore).toBeLessThanOrEqual(20);
    expect(result.isHealthy).toBe(true);
    expect(result.coherenceScore).toBeGreaterThanOrEqual(3);
    expect(result.lifeSignalScore).toBeGreaterThanOrEqual(2);
  });

  it("returns a low score and warnings for a weak prompt", () => {
    const result = evaluateCoverArtPrompt({
      prompt: WEAK_PROMPT,
      arc: "gathering",
      injectedSignals: [],
      lastUsedSignalIds: [],
    });

    expect(result.totalScore).toBeLessThan(15);
    expect(result.isHealthy).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.lifeSignalScore).toBe(0);
  });

  it("returns a healthy score for a well-formed open prompt", () => {
    const signals = resolveLifeSignals(["hair_slightly_displaced"]);
    const result = evaluateCoverArtPrompt({
      prompt: STRONG_OPEN_PROMPT,
      arc: "open",
      injectedSignals: signals,
      lastUsedSignalIds: [],
    });

    expect(result.totalScore).toBeGreaterThanOrEqual(14);
    expect(result.depthScore).toBe(4); // "vast" and "deep space" match open depth tokens
    expect(result.arcAlignmentScore).toBeGreaterThanOrEqual(2);
  });

  it("warns when a life signal is reused from the previous generation", () => {
    const signals = resolveLifeSignals(["slight_off_center_balance"]);
    const result = evaluateCoverArtPrompt({
      prompt: STRONG_GATHERING_PROMPT,
      arc: "gathering",
      injectedSignals: signals,
      lastUsedSignalIds: ["slight_off_center_balance"],
    });

    expect(result.warnings.some((w) => w.includes("reused"))).toBe(true);
  });

  it("warns when incompatible signals are both injected", () => {
    // one_eye_shadowed and asymmetrical_shadow_split are incompatible
    const signals = resolveLifeSignals(["one_eye_shadowed", "asymmetrical_shadow_split"]);
    const result = evaluateCoverArtPrompt({
      prompt: STRONG_GATHERING_PROMPT,
      arc: "gathering",
      injectedSignals: signals,
      lastUsedSignalIds: [],
    });

    expect(result.warnings.some((w) => w.includes("Incompatible"))).toBe(true);
  });

  it("warns when tension score exceeds arc maximum for open arc", () => {
    // Open arc has maxTensionScore = 3
    const highTensionPrompt = [
      STRONG_OPEN_PROMPT,
      "concealed, partially obscured, asymmetry, chiaroscuro, shadow split, threshold, contrast, negative space",
    ].join(" ");

    const result = evaluateCoverArtPrompt({
      prompt: highTensionPrompt,
      arc: "open",
      injectedSignals: [],
      lastUsedSignalIds: [],
    });

    // Should warn about overcompression
    const hasOvercompressionWarning = result.warnings.some(
      (w) => w.includes("exceeds maximum") || w.includes("overcompression")
    );
    expect(hasOvercompressionWarning).toBe(true);
  });

  it("produces adjustment suggestions when coherence is low", () => {
    const result = evaluateCoverArtPrompt({
      prompt: WEAK_PROMPT,
      arc: "arriving",
      injectedSignals: [],
      lastUsedSignalIds: [],
    });

    const hasPhysicsAdjustment = result.adjustments.some(
      (a) => a.type === "inject_physics_block" || a.type === "inject_life_signal"
    );
    expect(hasPhysicsAdjustment).toBe(true);
  });

  it("applies chaos penalty when intensity total exceeds 4", () => {
    // 3 moderate signals = intensity total 6 > 4
    const signals = resolveLifeSignals([
      "practical_flicker_hint",
      "faint_smoke_curl",
      "one_eye_shadowed",
    ]);
    const result = evaluateCoverArtPrompt({
      prompt: STRONG_GATHERING_PROMPT,
      arc: "gathering",
      injectedSignals: signals,
      lastUsedSignalIds: [],
    });

    expect(result.lifeSignalScore).toBe(1);
    expect(result.warnings.some((w) => w.includes("chaos"))).toBe(true);
  });

  it("returns all five score fields", () => {
    const result = evaluateCoverArtPrompt({
      prompt: STRONG_GATHERING_PROMPT,
      arc: "gathering",
      injectedSignals: [],
      lastUsedSignalIds: [],
    });

    expect(typeof result.coherenceScore).toBe("number");
    expect(typeof result.depthScore).toBe("number");
    expect(typeof result.tensionScore).toBe("number");
    expect(typeof result.lifeSignalScore).toBe("number");
    expect(typeof result.arcAlignmentScore).toBe("number");
    expect(result.totalScore).toBe(
      result.coherenceScore +
        result.depthScore +
        result.tensionScore +
        result.lifeSignalScore +
        result.arcAlignmentScore
    );
  });
});

// ─── ARC_PHYSICS profiles ─────────────────────────────────────────────────────

describe("ARC_PHYSICS profiles", () => {
  it("has profiles for all three arc positions", () => {
    expect(ARC_PHYSICS.gathering).toBeDefined();
    expect(ARC_PHYSICS.arriving).toBeDefined();
    expect(ARC_PHYSICS.open).toBeDefined();
  });

  it("gathering has higher shadow ratio than open", () => {
    expect(ARC_PHYSICS.gathering.shadowRatioRange[0]).toBeGreaterThan(
      ARC_PHYSICS.open.shadowRatioRange[0]
    );
  });

  it("gathering has higher withholding level than open", () => {
    expect(ARC_PHYSICS.gathering.withholdingLevel).toBe("high");
    expect(ARC_PHYSICS.open.withholdingLevel).toBe("low");
  });
});

// ─── resolveLifeSignals ───────────────────────────────────────────────────────

describe("resolveLifeSignals", () => {
  it("resolves known signal IDs to LifeSignal objects", () => {
    const signals = resolveLifeSignals(["slight_off_center_balance", "subtle_haze_drift"]);
    expect(signals).toHaveLength(2);
    expect(signals[0].id).toBe("slight_off_center_balance");
    expect(signals[1].id).toBe("subtle_haze_drift");
  });

  it("silently drops unknown signal IDs", () => {
    const signals = resolveLifeSignals(["unknown_signal_xyz", "slight_off_center_balance"]);
    expect(signals).toHaveLength(1);
    expect(signals[0].id).toBe("slight_off_center_balance");
  });

  it("returns empty array for empty input", () => {
    expect(resolveLifeSignals([])).toHaveLength(0);
  });
});

// ─── SELF_HEALING_THRESHOLD ───────────────────────────────────────────────────

describe("SELF_HEALING_THRESHOLD", () => {
  it("is set to 14", () => {
    expect(SELF_HEALING_THRESHOLD).toBe(14);
  });
});

// ─── buildDefaultAdaptiveWeights ─────────────────────────────────────────────

describe("buildDefaultAdaptiveWeights", () => {
  it("initializes all signal weights to 1.0", () => {
    const weights = buildDefaultAdaptiveWeights();
    for (const signal of LIFE_SIGNAL_REGISTRY) {
      expect(weights.signalWeights[signal.id]).toBe(1.0);
    }
  });

  it("initializes all domain weights to 1.0", () => {
    const weights = buildDefaultAdaptiveWeights();
    const domains = ["light", "material", "atmosphere", "composition", "temporal"] as const;
    for (const domain of domains) {
      expect(weights.domainWeights[domain]).toBe(1.0);
    }
  });

  it("starts with zero generations", () => {
    const weights = buildDefaultAdaptiveWeights();
    expect(weights.generationsSinceLastAdaptation).toBe(0);
    expect(weights.totalGenerations).toBe(0);
    expect(weights.lastAdaptedAt).toBeNull();
  });
});

// ─── computeStabilityMetrics ──────────────────────────────────────────────────

describe("computeStabilityMetrics", () => {
  it("returns zero metrics for empty window", () => {
    const metrics = computeStabilityMetrics([]);
    expect(metrics.avgTotal).toBe(0);
    expect(metrics.ldi).toBe(0);
    expect(metrics.windowSize).toBe(0);
  });

  it("computes correct average scores", () => {
    const logs = [
      makeLog(1, "gathering", ["slight_off_center_balance"], { total: 16 }),
      makeLog(1, "arriving", ["subtle_haze_drift"], { total: 17 }),
      makeLog(1, "open", ["hair_slightly_displaced"], { total: 15 }),
    ];
    const metrics = computeStabilityMetrics(logs);
    expect(metrics.avgTotal).toBeCloseTo(16, 1);
    expect(metrics.windowSize).toBe(3);
  });

  it("computes correct signal frequency", () => {
    const logs = [
      makeLog(1, "gathering", ["slight_off_center_balance"]),
      makeLog(1, "gathering", ["slight_off_center_balance"]),
      makeLog(1, "gathering", ["subtle_haze_drift"]),
    ];
    const metrics = computeStabilityMetrics(logs);
    // slight_off_center_balance appeared in 2/3 = 0.667 of generations
    expect(metrics.signalFrequency["slight_off_center_balance"]).toBeCloseTo(2 / 3, 2);
    expect(metrics.signalFrequency["subtle_haze_drift"]).toBeCloseTo(1 / 3, 2);
  });

  it("computes LDI as unique signals / total available", () => {
    const uniqueSignals = ["slight_off_center_balance", "subtle_haze_drift", "hair_slightly_displaced"];
    const logs = uniqueSignals.map((id) => makeLog(1, "gathering", [id]));
    const metrics = computeStabilityMetrics(logs);
    expect(metrics.ldi).toBeCloseTo(3 / LIFE_SIGNAL_REGISTRY.length, 3);
  });

  it("computes domain distribution summing to 1 when all signals are from one domain", () => {
    // slight_off_center_balance is in composition domain
    const logs = [
      makeLog(1, "gathering", ["slight_off_center_balance"]),
      makeLog(1, "gathering", ["partial_foreground_occlusion"]),
    ];
    const metrics = computeStabilityMetrics(logs);
    expect(metrics.domainDistribution.composition).toBe(1.0);
    expect(metrics.domainDistribution.light).toBe(0);
  });
});

// ─── shouldAdapt ─────────────────────────────────────────────────────────────

describe("shouldAdapt", () => {
  it("returns false when generationsSinceLastAdaptation < ADAPTATION_INTERVAL", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL - 1;
    expect(shouldAdapt(weights, WINDOW_SIZE)).toBe(false);
  });

  it("returns false when window size < WINDOW_SIZE", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;
    expect(shouldAdapt(weights, WINDOW_SIZE - 1)).toBe(false);
  });

  it("returns true when both conditions are met", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;
    expect(shouldAdapt(weights, WINDOW_SIZE)).toBe(true);
  });
});

// ─── runAdaptationCycle ───────────────────────────────────────────────────────

describe("runAdaptationCycle", () => {
  it("returns a report with triggered=true", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;

    const logs = Array.from({ length: WINDOW_SIZE }, (_, i) =>
      makeLog(1, "gathering", ["slight_off_center_balance"], { total: 16 })
    );
    const metrics = computeStabilityMetrics(logs);
    const { report } = runAdaptationCycle(weights, metrics);

    expect(report.triggered).toBe(true);
    expect(report.rulesApplied.length).toBeGreaterThan(0);
  });

  it("resets generationsSinceLastAdaptation to 0 after cycle", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;

    const logs = Array.from({ length: WINDOW_SIZE }, () =>
      makeLog(1, "gathering", ["slight_off_center_balance"], { total: 16 })
    );
    const metrics = computeStabilityMetrics(logs);
    const { updatedWeights } = runAdaptationCycle(weights, metrics);

    expect(updatedWeights.generationsSinceLastAdaptation).toBe(0);
  });

  it("applies Rule B (repetition suppression) when a signal frequency exceeds 30%", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;

    // slight_off_center_balance appears in 100% of generations (far above 30%)
    const logs = Array.from({ length: WINDOW_SIZE }, () =>
      makeLog(1, "gathering", ["slight_off_center_balance"], { total: 16 })
    );
    const metrics = computeStabilityMetrics(logs);
    const { updatedWeights, report } = runAdaptationCycle(weights, metrics);

    // Weight should be reduced
    expect(updatedWeights.signalWeights["slight_off_center_balance"]).toBeLessThan(1.0);
    expect(report.rulesApplied.some((r) => r.includes("Rule B"))).toBe(true);
  });

  it("applies Rule A1 (underpowered boost) when avgLifeSignal is below target", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;

    const logs = Array.from({ length: WINDOW_SIZE }, () =>
      makeLog(1, "gathering", ["slight_off_center_balance"], {
        lifeSignal: 1, // below TARGET_RANGES.lifeSignal.min (2.5)
        total: 13,
      })
    );
    const metrics = computeStabilityMetrics(logs);
    const { report } = runAdaptationCycle(weights, metrics);

    expect(report.rulesApplied.some((r) => r.includes("Rule A1"))).toBe(true);
  });

  it("keeps all weights within [WEIGHT_MIN, WEIGHT_MAX] bounds", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;

    // Extreme scenario: all signals at max weight, one signal at 100% frequency
    for (const signal of LIFE_SIGNAL_REGISTRY) {
      weights.signalWeights[signal.id] = WEIGHT_MAX;
    }

    const logs = Array.from({ length: WINDOW_SIZE }, () =>
      makeLog(1, "gathering", ["slight_off_center_balance"], { total: 16 })
    );
    const metrics = computeStabilityMetrics(logs);
    const { updatedWeights } = runAdaptationCycle(weights, metrics);

    for (const signal of LIFE_SIGNAL_REGISTRY) {
      expect(updatedWeights.signalWeights[signal.id]).toBeGreaterThanOrEqual(WEIGHT_MIN);
      expect(updatedWeights.signalWeights[signal.id]).toBeLessThanOrEqual(WEIGHT_MAX);
    }
  });

  it("sets lastAdaptedAt to a recent timestamp after cycle", () => {
    const before = Date.now();
    const weights = buildDefaultAdaptiveWeights();
    weights.generationsSinceLastAdaptation = ADAPTATION_INTERVAL;

    const logs = Array.from({ length: WINDOW_SIZE }, () =>
      makeLog(1, "gathering", ["slight_off_center_balance"], { total: 16 })
    );
    const metrics = computeStabilityMetrics(logs);
    const { updatedWeights } = runAdaptationCycle(weights, metrics);
    const after = Date.now();

    expect(updatedWeights.lastAdaptedAt).not.toBeNull();
    expect(updatedWeights.lastAdaptedAt!).toBeGreaterThanOrEqual(before);
    expect(updatedWeights.lastAdaptedAt!).toBeLessThanOrEqual(after);
  });
});

// ─── getEffectiveSignalWeight ─────────────────────────────────────────────────

describe("getEffectiveSignalWeight", () => {
  it("returns registry base weight × 1.0 × 1.0 for default weights", () => {
    const weights = buildDefaultAdaptiveWeights();
    const signal = LIFE_SIGNAL_REGISTRY.find((s) => s.id === "slight_off_center_balance")!;
    const effective = getEffectiveSignalWeight("slight_off_center_balance", weights);
    expect(effective).toBeCloseTo(signal.weight, 5);
  });

  it("returns 0 for an unknown signal ID", () => {
    const weights = buildDefaultAdaptiveWeights();
    expect(getEffectiveSignalWeight("nonexistent_signal", weights)).toBe(0);
  });

  it("multiplies registry weight by signal and domain multipliers", () => {
    const weights = buildDefaultAdaptiveWeights();
    weights.signalWeights["slight_off_center_balance"] = 1.5;
    weights.domainWeights["composition"] = 1.2;

    const signal = LIFE_SIGNAL_REGISTRY.find((s) => s.id === "slight_off_center_balance")!;
    const effective = getEffectiveSignalWeight("slight_off_center_balance", weights);
    expect(effective).toBeCloseTo(signal.weight * 1.5 * 1.2, 5);
  });
});

// ─── TARGET_RANGES ────────────────────────────────────────────────────────────

describe("TARGET_RANGES", () => {
  it("total target range is 15–18", () => {
    expect(TARGET_RANGES.total.min).toBe(15);
    expect(TARGET_RANGES.total.max).toBe(18);
  });

  it("life signal target range is 2.5–3.2", () => {
    expect(TARGET_RANGES.lifeSignal.min).toBe(2.5);
    expect(TARGET_RANGES.lifeSignal.max).toBe(3.2);
  });
});
