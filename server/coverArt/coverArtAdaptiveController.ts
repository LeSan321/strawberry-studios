/**
 * Cover Art Adaptive Weight Tuning System
 *
 * Controlled Evolution Engine — v1.0
 *
 * Based on the Emotional Physics Framework (Adaptive Weight Tuning spec).
 *
 * This is NOT reinforcement learning. It is controlled entropy calibration
 * with long-horizon stability. The system adjusts Life Signal weights slowly,
 * multiplicatively, and only after sufficient data has accumulated.
 *
 * Core principles:
 *   - Adjust slowly (never more than ±5% per cycle)
 *   - Protect entropy (always reserve probability mass for low-frequency signals)
 *   - Penalize repetition (suppress overused signals)
 *   - Reward structural strength, not aesthetics
 *   - Separate short-term from long-term signals
 *   - Target score RANGES, not maximums (too perfect = danger)
 *
 * Target ranges:
 *   avgTotal:       15–18
 *   avgLifeSignal:  2.5–3.2
 *   avgTension:     2–3
 *
 * Weight updates fire only every ADAPTATION_INTERVAL (20) generations,
 * and only when the rolling window has at least WINDOW_SIZE (50) entries.
 */

import type { ArcPosition } from "./promptBuilder";
import type { LifeSignalDomain } from "./lifeSignalRandomizer";
import { LIFE_SIGNAL_REGISTRY } from "./lifeSignalRandomizer";

// ─── Constants ────────────────────────────────────────────────────────────────

export const WINDOW_SIZE = 50;
export const ADAPTATION_INTERVAL = 20;
export const LDI_WINDOW = 200;
export const LDI_THRESHOLD = 0.6;
export const ENTROPY_RESERVE_FRACTION = 0.2;
export const FORCED_RARE_SIGNAL_INTERVAL = 15;

// Score target ranges (inclusive)
export const TARGET_RANGES = {
  total: { min: 15, max: 18 },
  lifeSignal: { min: 2.5, max: 3.2 },
  tension: { min: 2, max: 3 },
  coherence: { min: 3, max: 4 },
  arcAlignment: { min: 3, max: 4 },
} as const;

// Weight clamp bounds — prevents runaway collapse or inflation
export const WEIGHT_MIN = 0.2;
export const WEIGHT_MAX = 2.0;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerationLog {
  /** Internal DB id — set after persistence */
  id?: number;
  userId: number;
  arc: ArcPosition;
  /** IDs of life signals injected in this generation */
  lifeSignalIds: string[];
  /** Sum of intensity values (subtle=1, moderate=2) */
  lifeSignalIntensityTotal: number;
  qaScores: {
    coherence: number;
    depth: number;
    tension: number;
    lifeSignal: number;
    arcAlignment: number;
    total: number;
  };
  timestamp: number;
}

export interface AdaptiveWeights {
  /** Per-signal weight multipliers keyed by signal ID */
  signalWeights: Record<string, number>;
  /** Per-domain probability multipliers */
  domainWeights: Record<LifeSignalDomain, number>;
  /** Generation count since last adaptation cycle */
  generationsSinceLastAdaptation: number;
  /** Total lifetime generations for this user */
  totalGenerations: number;
  /** UTC ms timestamp of last weight update */
  lastAdaptedAt: number | null;
}

export interface StabilityMetrics {
  avgCoherence: number;
  avgDepth: number;
  avgTension: number;
  avgLifeSignal: number;
  avgArcAlignment: number;
  avgTotal: number;
  /** Frequency map: signalId → fraction of generations it appeared in */
  signalFrequency: Record<string, number>;
  /** Domain distribution: domain → fraction of injections */
  domainDistribution: Record<LifeSignalDomain, number>;
  /** Long-Term Diversity Index: uniqueSignalsUsed / totalAvailable */
  ldi: number;
  windowSize: number;
}

export interface AdaptationReport {
  triggered: boolean;
  reason: string;
  rulesApplied: string[];
  weightDeltas: Record<string, number>;
}

// ─── Default Weights ──────────────────────────────────────────────────────────

export function buildDefaultAdaptiveWeights(): AdaptiveWeights {
  const signalWeights: Record<string, number> = {};
  for (const signal of LIFE_SIGNAL_REGISTRY) {
    signalWeights[signal.id] = 1.0; // neutral multiplier — base weight from registry
  }

  return {
    signalWeights,
    domainWeights: {
      light: 1.0,
      material: 1.0,
      atmosphere: 1.0,
      composition: 1.0,
      temporal: 1.0,
    },
    generationsSinceLastAdaptation: 0,
    totalGenerations: 0,
    lastAdaptedAt: null,
  };
}

// ─── Stability Metrics Computation ───────────────────────────────────────────

export function computeStabilityMetrics(
  window: GenerationLog[]
): StabilityMetrics {
  if (window.length === 0) {
    return {
      avgCoherence: 0,
      avgDepth: 0,
      avgTension: 0,
      avgLifeSignal: 0,
      avgArcAlignment: 0,
      avgTotal: 0,
      signalFrequency: {},
      domainDistribution: {
        light: 0,
        material: 0,
        atmosphere: 0,
        composition: 0,
        temporal: 0,
      },
      ldi: 0,
      windowSize: 0,
    };
  }

  const n = window.length;

  // Average scores
  const avgCoherence = window.reduce((s, g) => s + g.qaScores.coherence, 0) / n;
  const avgDepth = window.reduce((s, g) => s + g.qaScores.depth, 0) / n;
  const avgTension = window.reduce((s, g) => s + g.qaScores.tension, 0) / n;
  const avgLifeSignal = window.reduce((s, g) => s + g.qaScores.lifeSignal, 0) / n;
  const avgArcAlignment = window.reduce((s, g) => s + g.qaScores.arcAlignment, 0) / n;
  const avgTotal = window.reduce((s, g) => s + g.qaScores.total, 0) / n;

  // Signal frequency map
  const signalCount: Record<string, number> = {};
  let totalInjections = 0;

  for (const gen of window) {
    for (const id of gen.lifeSignalIds) {
      signalCount[id] = (signalCount[id] ?? 0) + 1;
      totalInjections++;
    }
  }

  const signalFrequency: Record<string, number> = {};
  for (const [id, count] of Object.entries(signalCount)) {
    signalFrequency[id] = count / n; // fraction of generations it appeared in
  }

  // Domain distribution
  const domainCount: Record<LifeSignalDomain, number> = {
    light: 0,
    material: 0,
    atmosphere: 0,
    composition: 0,
    temporal: 0,
  };

  for (const gen of window) {
    for (const id of gen.lifeSignalIds) {
      const signal = LIFE_SIGNAL_REGISTRY.find((s) => s.id === id);
      if (signal) {
        domainCount[signal.domain]++;
      }
    }
  }

  const domainDistribution: Record<LifeSignalDomain, number> = {
    light: totalInjections > 0 ? domainCount.light / totalInjections : 0,
    material: totalInjections > 0 ? domainCount.material / totalInjections : 0,
    atmosphere: totalInjections > 0 ? domainCount.atmosphere / totalInjections : 0,
    composition: totalInjections > 0 ? domainCount.composition / totalInjections : 0,
    temporal: totalInjections > 0 ? domainCount.temporal / totalInjections : 0,
  };

  // Long-Term Diversity Index
  const uniqueSignalsUsed = Object.keys(signalCount).length;
  const totalAvailable = LIFE_SIGNAL_REGISTRY.length;
  const ldi = uniqueSignalsUsed / totalAvailable;

  return {
    avgCoherence,
    avgDepth,
    avgTension,
    avgLifeSignal,
    avgArcAlignment,
    avgTotal,
    signalFrequency,
    domainDistribution,
    ldi,
    windowSize: n,
  };
}

// ─── Weight Adjustment Utility ────────────────────────────────────────────────

function adjustWeight(
  current: number,
  multiplier: number,
  min = WEIGHT_MIN,
  max = WEIGHT_MAX
): number {
  const updated = current * multiplier;
  return Math.min(max, Math.max(min, updated));
}

// ─── Soft Exploration Noise ───────────────────────────────────────────────────
// Tiny noise prevents equilibrium lock.

function softExplorationNoise(): number {
  return 0.98 + Math.random() * 0.04; // randomBetween(0.98, 1.02)
}

// ─── Adaptive Adjustment Rules ────────────────────────────────────────────────

export function runAdaptationCycle(
  weights: AdaptiveWeights,
  metrics: StabilityMetrics
): { updatedWeights: AdaptiveWeights; report: AdaptationReport } {
  const rulesApplied: string[] = [];
  const weightDeltas: Record<string, number> = {};
  const newSignalWeights = { ...weights.signalWeights };
  const newDomainWeights = { ...weights.domainWeights };

  // ── Rule A: Underpowered Category Boost ──────────────────────────────────────
  if (metrics.avgLifeSignal < TARGET_RANGES.lifeSignal.min) {
    // Increase weight of subtle signals across all domains by 3%
    for (const signal of LIFE_SIGNAL_REGISTRY) {
      if (signal.intensity === "subtle") {
        const before = newSignalWeights[signal.id] ?? 1.0;
        newSignalWeights[signal.id] = adjustWeight(before, 1.03);
        weightDeltas[signal.id] = (weightDeltas[signal.id] ?? 0) + (newSignalWeights[signal.id] - before);
      }
    }
    rulesApplied.push("Rule A1: avgLifeSignal below target — boosted subtle signals +3%");
  }

  if (metrics.avgTension < TARGET_RANGES.tension.min) {
    // Increase composition domain weight by 5%
    newDomainWeights.composition = adjustWeight(newDomainWeights.composition, 1.05);
    rulesApplied.push("Rule A2: avgTension below target — boosted composition domain +5%");
  }

  // ── Rule B: Repetition Suppression ───────────────────────────────────────────
  const REPETITION_THRESHOLD = 0.30;
  let lowestFreqSignalId: string | null = null;
  let lowestFreq = Infinity;

  for (const signal of LIFE_SIGNAL_REGISTRY) {
    const freq = metrics.signalFrequency[signal.id] ?? 0;

    if (freq > REPETITION_THRESHOLD) {
      const before = newSignalWeights[signal.id] ?? 1.0;
      newSignalWeights[signal.id] = adjustWeight(before, 0.9);
      weightDeltas[signal.id] = (weightDeltas[signal.id] ?? 0) + (newSignalWeights[signal.id] - before);
      rulesApplied.push(`Rule B: "${signal.id}" frequency ${(freq * 100).toFixed(0)}% > 30% — suppressed -10%`);
    }

    if (freq < lowestFreq) {
      lowestFreq = freq;
      lowestFreqSignalId = signal.id;
    }
  }

  // Boost the lowest-frequency signal
  if (lowestFreqSignalId) {
    const before = newSignalWeights[lowestFreqSignalId] ?? 1.0;
    newSignalWeights[lowestFreqSignalId] = adjustWeight(before, 1.05);
    weightDeltas[lowestFreqSignalId] = (weightDeltas[lowestFreqSignalId] ?? 0) + (newSignalWeights[lowestFreqSignalId] - before);
    rulesApplied.push(`Rule B: Boosted lowest-frequency signal "${lowestFreqSignalId}" +5%`);
  }

  // ── Rule C: Chaos Dampening ───────────────────────────────────────────────────
  if (metrics.avgLifeSignal > TARGET_RANGES.lifeSignal.max) {
    // Reduce moderate-intensity selection probability by 10%
    for (const signal of LIFE_SIGNAL_REGISTRY) {
      if (signal.intensity === "moderate") {
        const before = newSignalWeights[signal.id] ?? 1.0;
        newSignalWeights[signal.id] = adjustWeight(before, 0.9);
        weightDeltas[signal.id] = (weightDeltas[signal.id] ?? 0) + (newSignalWeights[signal.id] - before);
      }
    }
    rulesApplied.push("Rule C: avgLifeSignal above target — dampened moderate signals -10%");
  }

  // ── Rule D: Arc Flattening Detector ──────────────────────────────────────────
  // If avgArcAlignment is low, it means arc differentiation is collapsing.
  // We respond by boosting domain weights that create arc contrast.
  if (metrics.avgArcAlignment < TARGET_RANGES.arcAlignment.min) {
    // Boost light and composition (the domains most tied to arc differentiation)
    newDomainWeights.light = adjustWeight(newDomainWeights.light, 1.05);
    newDomainWeights.composition = adjustWeight(newDomainWeights.composition, 1.03);
    rulesApplied.push("Rule D: Arc flattening detected — boosted light +5%, composition +3%");
  }

  // ── Entropy Protection Layer ──────────────────────────────────────────────────
  // Ensure at least 20% probability mass is reserved for low-frequency signals.
  // Identify bottom quartile by frequency and protect their weights.
  const sortedByFreq = LIFE_SIGNAL_REGISTRY
    .map((s) => ({ id: s.id, freq: metrics.signalFrequency[s.id] ?? 0 }))
    .sort((a, b) => a.freq - b.freq);

  const bottomQuartileCount = Math.ceil(LIFE_SIGNAL_REGISTRY.length * 0.25);
  const bottomQuartile = sortedByFreq.slice(0, bottomQuartileCount);

  for (const { id } of bottomQuartile) {
    // Ensure their weight doesn't fall below 0.5 (floor protection)
    if ((newSignalWeights[id] ?? 1.0) < 0.5) {
      newSignalWeights[id] = 0.5;
      rulesApplied.push(`Entropy protection: floored "${id}" weight at 0.5`);
    }
  }

  // ── Long-Term Diversity Index ─────────────────────────────────────────────────
  if (metrics.ldi < LDI_THRESHOLD) {
    // Force diversity expansion: boost bottom quartile, reduce top quartile
    const topQuartile = sortedByFreq.slice(-bottomQuartileCount);

    for (const { id } of bottomQuartile) {
      const before = newSignalWeights[id] ?? 1.0;
      newSignalWeights[id] = adjustWeight(before, 1.10);
      weightDeltas[id] = (weightDeltas[id] ?? 0) + (newSignalWeights[id] - before);
    }

    for (const { id } of topQuartile) {
      const before = newSignalWeights[id] ?? 1.0;
      newSignalWeights[id] = adjustWeight(before, 0.95);
      weightDeltas[id] = (weightDeltas[id] ?? 0) + (newSignalWeights[id] - before);
    }

    rulesApplied.push(
      `LDI ${(metrics.ldi * 100).toFixed(0)}% < ${LDI_THRESHOLD * 100}% — diversity expansion mode: bottom quartile +10%, top quartile -5%`
    );
  }

  // ── Soft Exploration Injection ────────────────────────────────────────────────
  // Tiny noise prevents equilibrium lock.
  for (const signal of LIFE_SIGNAL_REGISTRY) {
    const before = newSignalWeights[signal.id] ?? 1.0;
    newSignalWeights[signal.id] = adjustWeight(before, softExplorationNoise());
  }

  const updatedWeights: AdaptiveWeights = {
    signalWeights: newSignalWeights,
    domainWeights: newDomainWeights,
    generationsSinceLastAdaptation: 0,
    totalGenerations: weights.totalGenerations,
    lastAdaptedAt: Date.now(),
  };

  return {
    updatedWeights,
    report: {
      triggered: true,
      reason: `Adaptation cycle triggered after ${weights.generationsSinceLastAdaptation} generations`,
      rulesApplied,
      weightDeltas,
    },
  };
}

// ─── Adaptation Gate ──────────────────────────────────────────────────────────
// Checks whether the adaptation cycle should fire.

export function shouldAdapt(weights: AdaptiveWeights, windowSize: number): boolean {
  return (
    weights.generationsSinceLastAdaptation >= ADAPTATION_INTERVAL &&
    windowSize >= WINDOW_SIZE
  );
}

// ─── Effective Signal Weight ──────────────────────────────────────────────────
// Returns the effective weight for a signal, combining the registry base weight
// with the adaptive multiplier and the domain multiplier.

export function getEffectiveSignalWeight(
  signalId: string,
  weights: AdaptiveWeights
): number {
  const signal = LIFE_SIGNAL_REGISTRY.find((s) => s.id === signalId);
  if (!signal) return 0;

  const signalMultiplier = weights.signalWeights[signalId] ?? 1.0;
  const domainMultiplier = weights.domainWeights[signal.domain] ?? 1.0;

  return signal.weight * signalMultiplier * domainMultiplier;
}

// ─── Forced Rare Signal Injection ────────────────────────────────────────────
// Every FORCED_RARE_SIGNAL_INTERVAL generations, force a rarely-used signal
// into the eligible pool to prevent convergence.

export function getForcedRareSignalId(
  weights: AdaptiveWeights,
  recentLogs: GenerationLog[],
  arc: ArcPosition
): string | null {
  if (weights.totalGenerations % FORCED_RARE_SIGNAL_INTERVAL !== 0) return null;
  if (weights.totalGenerations === 0) return null;

  // Find the eligible signal with the lowest usage in recent logs
  const recentIds = recentLogs.flatMap((g) => g.lifeSignalIds);
  const usageCount: Record<string, number> = {};

  for (const id of recentIds) {
    usageCount[id] = (usageCount[id] ?? 0) + 1;
  }

  const eligible = LIFE_SIGNAL_REGISTRY.filter(
    (s) => s.eligibleArcs.length === 0 || s.eligibleArcs.includes(arc)
  );

  const rarest = eligible
    .map((s) => ({ id: s.id, count: usageCount[s.id] ?? 0 }))
    .sort((a, b) => a.count - b.count);

  return rarest[0]?.id ?? null;
}
