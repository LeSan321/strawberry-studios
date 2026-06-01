/**
 * Cover Art Auto-Evaluation Heuristic
 *
 * Structural Integrity Engine — v1.0
 *
 * Based on the Emotional Physics Framework (Auto-Evaluation Heuristic spec).
 *
 * This is a DETERMINISTIC evaluator, not a neural one.
 * We cannot "see" the image — we evaluate whether the prompt structurally
 * encodes the correct physics, entropy, arc modulation, and tension.
 *
 * Five scoring dimensions (each 0–4):
 *   1. Coherence      — required structural physics tokens present
 *   2. Depth          — depth mode matches arc profile
 *   3. Tension        — withholding / asymmetry language present
 *   4. Life Signal    — entropy injection quality and rule compliance
 *   5. Arc Alignment  — prompt features match ARC_PHYSICS profile targets
 *
 * Total score: 0–20
 *   Target range: 15–18 (too perfect = danger)
 *
 * The adjustment engine produces SuggestedAdjustments that the caller
 * can apply (self-healing mode) or surface for diagnostics.
 */

import type { ArcPosition } from "./promptBuilder";
import type { LifeSignal } from "./lifeSignalRandomizer";
import { LIFE_SIGNAL_REGISTRY } from "./lifeSignalRandomizer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdjustmentType =
  | "inject_life_signal"
  | "inject_tension_token"
  | "inject_physics_block"
  | "rerun_arc_modulation"
  | "reduce_moderate_signals"
  | "reselect_life_signals";

export interface SuggestedAdjustment {
  type: AdjustmentType;
  reason: string;
  recommendedSignalDomain?: string;
  detail?: string;
}

export interface AutoEvaluationResult {
  /** 0–4: Required structural physics tokens present */
  coherenceScore: number;
  /** 0–4: Depth mode matches arc profile */
  depthScore: number;
  /** 0–4: Withholding / asymmetry / tension language present */
  tensionScore: number;
  /** 0–4: Entropy injection quality and rule compliance */
  lifeSignalScore: number;
  /** 0–4: Prompt features match arc physics profile */
  arcAlignmentScore: number;
  /** Sum of all five dimensions (0–20). Target range: 15–18 */
  totalScore: number;
  /** Human-readable warnings about structural problems */
  warnings: string[];
  /** Actionable adjustments the caller can apply */
  adjustments: SuggestedAdjustment[];
  /** Whether the total score is within the healthy target range (15–18) */
  isHealthy: boolean;
}

// ─── Arc Physics Profiles ─────────────────────────────────────────────────────
// These are the structural targets that the evaluator checks against.
// Derived from the Arc Modulation Matrix in the Emotional Physics conversation.

type DepthMode = "shallow" | "layered" | "deep";
type WithholdingLevel = "high" | "medium" | "low";
type MotionLevel = "static" | "implied" | "active";

interface ArcPhysicsProfile {
  /** Target shadow ratio range as a percentage of frame (e.g. [60, 80]) */
  shadowRatioRange: [number, number];
  /** Depth of field / compositional depth mode */
  depthMode: DepthMode;
  /** How much is concealed vs revealed */
  withholdingLevel: WithholdingLevel;
  /** Motion energy level */
  motionLevel: MotionLevel;
  /** Minimum tension score expected for this arc */
  minTensionScore: number;
  /** Maximum tension score before overcompression warning */
  maxTensionScore: number;
  /** Key depth tokens that should appear in the prompt */
  depthTokens: string[];
  /** Key withholding tokens that should appear in the prompt */
  withholdingTokens: string[];
}

export const ARC_PHYSICS: Record<ArcPosition, ArcPhysicsProfile> = {
  gathering: {
    shadowRatioRange: [60, 80],
    depthMode: "shallow",
    withholdingLevel: "high",
    motionLevel: "static",
    minTensionScore: 2,
    maxTensionScore: 4,
    depthTokens: ["shallow depth of field", "close-up", "intimate", "compressed"],
    withholdingTokens: ["shadow", "concealed", "partially obscured", "asymmetry", "chiaroscuro"],
  },
  arriving: {
    shadowRatioRange: [40, 60],
    depthMode: "layered",
    withholdingLevel: "medium",
    motionLevel: "implied",
    minTensionScore: 1,
    maxTensionScore: 4,
    depthTokens: ["foreground", "midground", "background", "layered", "stratified"],
    withholdingTokens: ["threshold", "partially obscured", "asymmetric", "off-center"],
  },
  open: {
    shadowRatioRange: [20, 50],
    depthMode: "deep",
    withholdingLevel: "low",
    motionLevel: "active",
    minTensionScore: 0,
    maxTensionScore: 3,
    depthTokens: ["deep space", "atmospheric perspective", "vast", "wide", "landscape"],
    withholdingTokens: ["negative space", "horizon", "open"],
  },
};

// ─── Token Matching Utilities ─────────────────────────────────────────────────

function containsAny(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase();
  return tokens.some((t) => lower.includes(t.toLowerCase()));
}

function countMatches(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  return tokens.filter((t) => lower.includes(t.toLowerCase())).length;
}

// ─── Step 1: Coherence Heuristic ─────────────────────────────────────────────
// Checks for the 4 required structural physics tokens.
// Score 0–4. Target: ≥ 3.

const COHERENCE_CHECKS = [
  ["primary light source", "motivated light", "motivated single source", "key light", "light source"],
  ["shadow", "deep shadow", "negative space", "chiaroscuro"],
  ["foreground", "background", "layered", "stratified", "depth of field", "depth", "atmospheric"],
  ["natural", "organic", "material", "texture", "grain", "fabric", "physically"],
] as const;

function evaluateCoherence(prompt: string): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  for (const group of COHERENCE_CHECKS) {
    if (containsAny(prompt, [...group])) {
      score++;
    } else {
      missing.push(group[0]);
    }
  }

  return { score, missing };
}

// ─── Step 2: Depth Heuristic ──────────────────────────────────────────────────
// Checks whether the depth mode matches the arc profile.
// Score 0 or 4 (binary match), defaults to 1 if no match.

function evaluateDepth(prompt: string, arc: ArcPosition): { score: number; mismatch: boolean } {
  const profile = ARC_PHYSICS[arc];
  const hasDepthToken = containsAny(prompt, profile.depthTokens);

  if (hasDepthToken) return { score: 4, mismatch: false };
  return { score: 1, mismatch: true };
}

// ─── Step 3: Tension / Withholding Heuristic ─────────────────────────────────
// Counts tension/withholding tokens. Score 0–4.

const TENSION_TOKENS = [
  "conceal",
  "partially obscured",
  "asymmetry",
  "asymmetric",
  "off-center",
  "shadow split",
  "threshold",
  "contrast",
  "negative space",
  "one eye",
  "divided",
  "shadow",
  "chiaroscuro",
  "withhold",
];

function evaluateTension(prompt: string): number {
  const count = countMatches(prompt, TENSION_TOKENS);
  if (count === 0) return 0;
  if (count === 1) return 2;
  if (count === 2) return 3;
  return 4;
}

// ─── Step 4: Life Signal Heuristic ───────────────────────────────────────────
// Evaluates using metadata (injected signal objects), not text scanning.
// Score 0–4.

interface LifeSignalEvalInput {
  injectedSignals: LifeSignal[];
  lastUsedSignalIds: string[];
}

interface LifeSignalEvalResult {
  score: number;
  warnings: string[];
}

function evaluateLifeSignals(input: LifeSignalEvalInput): LifeSignalEvalResult {
  const { injectedSignals, lastUsedSignalIds } = input;
  const warnings: string[] = [];

  if (injectedSignals.length === 0) {
    return { score: 0, warnings: ["No life signals injected — entropy layer absent."] };
  }

  let intensityTotal = 0;
  let moderateCount = 0;

  for (const sig of injectedSignals) {
    intensityTotal += sig.intensity === "moderate" ? 2 : 1;
    if (sig.intensity === "moderate") moderateCount++;
  }

  // Check for reuse of recent signals
  for (const sig of injectedSignals) {
    if (lastUsedSignalIds.includes(sig.id)) {
      warnings.push(`Life signal "${sig.id}" was reused from the previous generation.`);
    }
  }

  // Check for incompatibility violations
  for (const sig of injectedSignals) {
    for (const otherId of sig.incompatibleWith) {
      if (injectedSignals.some((s) => s.id === otherId)) {
        warnings.push(`Incompatible life signals: "${sig.id}" and "${otherId}" should not appear together.`);
      }
    }
  }

  // Chaos penalty: intensity total > 4 means too much moderate energy
  if (intensityTotal > 4) {
    warnings.push("Life signal intensity total exceeds 4 — chaos risk. Reduce moderate signals.");
    return { score: 1, warnings };
  }

  // More than 1 moderate signal
  if (moderateCount > 1) {
    warnings.push("More than 1 moderate-intensity life signal injected — only 1 is recommended per image.");
  }

  const score = Math.min(injectedSignals.length + 1, 4);
  return { score, warnings };
}

// ─── Step 5: Arc Alignment Heuristic ─────────────────────────────────────────
// Compares prompt features against the ARC_PHYSICS profile.
// Score 0–4.

interface ArcAlignmentResult {
  score: number;
  suggestions: SuggestedAdjustment[];
}

function evaluateArcAlignment(prompt: string, arc: ArcPosition): ArcAlignmentResult {
  const profile = ARC_PHYSICS[arc];
  let score = 0;
  const suggestions: SuggestedAdjustment[] = [];

  // Check depth mode alignment
  if (containsAny(prompt, profile.depthTokens)) {
    score++;
  } else {
    suggestions.push({
      type: "rerun_arc_modulation",
      reason: `Depth mode "${profile.depthMode}" not reflected in prompt for arc "${arc}".`,
      detail: `Expected tokens: ${profile.depthTokens.slice(0, 3).join(", ")}`,
    });
  }

  // Check withholding level alignment
  if (containsAny(prompt, profile.withholdingTokens)) {
    score++;
  } else {
    suggestions.push({
      type: "inject_tension_token",
      reason: `Withholding level "${profile.withholdingLevel}" not reflected in prompt for arc "${arc}".`,
      detail: `Expected tokens: ${profile.withholdingTokens.slice(0, 3).join(", ")}`,
    });
  }

  // Check shadow language presence (proxy for shadow ratio)
  if (containsAny(prompt, ["shadow", "chiaroscuro", "dark", "deep", "negative space"])) {
    score++;
  } else if (profile.shadowRatioRange[0] >= 40) {
    suggestions.push({
      type: "inject_physics_block",
      reason: `Shadow language absent — arc "${arc}" targets ${profile.shadowRatioRange[0]}–${profile.shadowRatioRange[1]}% shadow ratio.`,
    });
  } else {
    score++; // open arc doesn't require shadow language
  }

  // Check motion level alignment
  const motionTokens: Record<MotionLevel, string[]> = {
    static: ["still", "quiet", "compressed", "static", "intimate"],
    implied: ["threshold", "entering", "mid-settle", "displaced", "motion"],
    active: ["vast", "wide", "landscape", "atmospheric", "open"],
  };
  if (containsAny(prompt, motionTokens[profile.motionLevel])) {
    score++;
  }

  return { score, suggestions };
}

// ─── Main Evaluator ───────────────────────────────────────────────────────────

export interface EvaluatorInput {
  prompt: string;
  arc: ArcPosition;
  injectedSignals: LifeSignal[];
  lastUsedSignalIds: string[];
}

export function evaluateCoverArtPrompt(input: EvaluatorInput): AutoEvaluationResult {
  const { prompt, arc, injectedSignals, lastUsedSignalIds } = input;

  const warnings: string[] = [];
  const adjustments: SuggestedAdjustment[] = [];

  // ── Step 1: Coherence ───────────────────────────────────────────────────────
  const coherenceResult = evaluateCoherence(prompt);
  const coherenceScore = coherenceResult.score;

  if (coherenceScore < 3) {
    warnings.push(
      `Coherence score ${coherenceScore}/4 — missing structural physics tokens: ${coherenceResult.missing.join(", ")}.`
    );
    adjustments.push({
      type: "inject_physics_block",
      reason: "Coherence below threshold — required physics tokens absent.",
      detail: `Missing: ${coherenceResult.missing.join(", ")}`,
    });
  }

  // ── Step 2: Depth ───────────────────────────────────────────────────────────
  const depthResult = evaluateDepth(prompt, arc);
  const depthScore = depthResult.score;

  if (depthResult.mismatch) {
    warnings.push(
      `Depth mode inconsistent with arc position "${arc}". Expected: ${ARC_PHYSICS[arc].depthMode}.`
    );
  }

  // ── Step 3: Tension ─────────────────────────────────────────────────────────
  const tensionScore = evaluateTension(prompt);
  const profile = ARC_PHYSICS[arc];

  if (tensionScore < profile.minTensionScore) {
    warnings.push(
      `Tension score ${tensionScore} below minimum ${profile.minTensionScore} for arc "${arc}".`
    );
    adjustments.push({
      type: "inject_tension_token",
      reason: `Insufficient withholding language for arc "${arc}".`,
      detail: `Suggested tokens: ${profile.withholdingTokens.slice(0, 3).join(", ")}`,
    });
  }

  if (tensionScore > profile.maxTensionScore) {
    warnings.push(
      `Tension score ${tensionScore} exceeds maximum ${profile.maxTensionScore} for arc "${arc}" — possible overcompression.`
    );
  }

  // ── Step 4: Life Signal ─────────────────────────────────────────────────────
  const lifeSignalResult = evaluateLifeSignals({ injectedSignals, lastUsedSignalIds });
  const lifeSignalScore = lifeSignalResult.score;
  warnings.push(...lifeSignalResult.warnings);

  if (lifeSignalScore === 0) {
    adjustments.push({
      type: "inject_life_signal",
      reason: "No entropy cues detected — life signal layer absent.",
      recommendedSignalDomain: "composition",
    });
  }

  if (lifeSignalScore === 1 && injectedSignals.length > 0) {
    // Chaos penalty was applied
    adjustments.push({
      type: "reduce_moderate_signals",
      reason: "Life signal intensity total too high — chaos penalty applied.",
    });
  }

  // ── Step 5: Arc Alignment ───────────────────────────────────────────────────
  const arcAlignmentResult = evaluateArcAlignment(prompt, arc);
  const arcAlignmentScore = arcAlignmentResult.score;
  adjustments.push(...arcAlignmentResult.suggestions);

  if (arcAlignmentScore < 3) {
    warnings.push(
      `Arc alignment score ${arcAlignmentScore}/4 for arc "${arc}" — prompt features don't fully match arc physics profile.`
    );
  }

  // ── Total Score ─────────────────────────────────────────────────────────────
  const totalScore = coherenceScore + depthScore + tensionScore + lifeSignalScore + arcAlignmentScore;

  // Target range: 15–18. Too low = structural problems. Too high = suspiciously perfect.
  const isHealthy = totalScore >= 15 && totalScore <= 18;

  if (totalScore < 15) {
    warnings.push(
      `Total score ${totalScore}/20 is below healthy range (15–18). Structural problems detected.`
    );
  }

  if (totalScore > 18) {
    warnings.push(
      `Total score ${totalScore}/20 exceeds healthy ceiling (18). Risk of aesthetic convergence — consider adding entropy.`
    );
  }

  return {
    coherenceScore,
    depthScore,
    tensionScore,
    lifeSignalScore,
    arcAlignmentScore,
    totalScore,
    warnings,
    adjustments,
    isHealthy,
  };
}

// ─── Self-Healing Mode ────────────────────────────────────────────────────────
// If totalScore < 14, the system can attempt to auto-correct by re-running
// the life signal selection and injecting missing tokens.
// Limited to 2 iterations to prevent infinite loops.

export const SELF_HEALING_THRESHOLD = 14;
export const SELF_HEALING_MAX_ITERATIONS = 2;

/**
 * Resolves the injected LifeSignal objects from their IDs.
 * Used to reconstruct signal metadata for evaluation.
 */
export function resolveLifeSignals(signalIds: string[]): LifeSignal[] {
  return signalIds
    .map((id) => LIFE_SIGNAL_REGISTRY.find((s) => s.id === id))
    .filter((s): s is LifeSignal => s !== undefined);
}
