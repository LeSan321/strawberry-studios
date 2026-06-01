/**
 * Arc Modulation Matrix
 *
 * Emotional Physics Framework — Arc-Position Engine v1.0
 *
 * Translates the typed ArcPhysicsProfile into concrete, image-model-ready
 * prompt directives across all 8 physical dimensions:
 *
 *   1. Light Structure    — primary light character, source visibility, falloff
 *   2. Shadow Ratio       — percentage of frame in shadow (narrative compression)
 *   3. Scale              — subject-to-frame ratio
 *   4. Depth Structure    — depth of field / compositional depth mode
 *   5. Motion / Time      — motion energy level
 *   6. Irregularity       — tolerance for moderate-intensity irregularity
 *   7. Withholding        — occlusion, cropping, hidden elements
 *   8. Biological Anchors — which sensory anchors activate per arc
 *
 * Pipeline position (Section VI of the spec):
 *   Find Your Frequency
 *       ↓
 *   Arc Position
 *       ↓
 *   Emotional Physics Modulation Matrix  ← THIS MODULE
 *       ↓
 *   Life Signal Randomizer
 *       ↓
 *   Prompt Builder
 *
 * The matrix output is a single compact directive string injected into the
 * prompt AFTER the Cinématique rendering layer and BEFORE the Life Signal block.
 * It ensures that:
 *   - A Gathering image can never accidentally look Open.
 *   - An Open image can never feel compressed.
 *   - Arriving will always feel transitional.
 */

import type { ArcPosition } from "./promptBuilder";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LightDiffusion = "steep" | "controlled" | "gradual";
export type DepthMode = "shallow" | "layered" | "deep";
export type MotionLevel = "minimal" | "noticeable" | "ambient";
export type WithholdingLevel = "high" | "medium" | "low";
export type IrregularityLevel = "subtle" | "mixed";

export interface ArcModulationProfile {
  /** Shadow ratio range as [min, max] percentage of frame */
  shadowRatio: [number, number];
  /** Subject-to-frame scale range as [min, max] fraction */
  scaleRange: [number, number];
  /** Depth of field / compositional depth mode */
  depthMode: DepthMode;
  /** Tolerance for moderate-intensity irregularity */
  irregularityLevel: IrregularityLevel;
  /** How much is concealed vs revealed */
  withholdingLevel: WithholdingLevel;
  /** Light falloff character */
  lightDiffusion: LightDiffusion;
  /** Motion energy level */
  motionLevel: MotionLevel;
}

export interface ArcModulationDirectives {
  /** Compact prompt string for injection into the prompt pipeline */
  promptDirective: string;
  /** Structured breakdown of each dimension for debug/logging */
  dimensions: {
    lightStructure: string;
    shadowRatio: string;
    scale: string;
    depthStructure: string;
    motionTime: string;
    irregularity: string;
    withholding: string;
    biologicalAnchors: string;
  };
}

// ─── Arc Modulation Profiles ──────────────────────────────────────────────────
// Exact values from the Emotional Physics Modulation Matrix spec (v1.0).

export const ARC_MODULATION_PROFILES: Record<ArcPosition, ArcModulationProfile> = {
  gathering: {
    shadowRatio: [0.6, 0.8],
    scaleRange: [0.2, 0.4],
    depthMode: "shallow",
    irregularityLevel: "subtle",
    withholdingLevel: "high",
    lightDiffusion: "steep",
    motionLevel: "minimal",
  },
  arriving: {
    shadowRatio: [0.5, 0.65],
    scaleRange: [0.4, 0.6],
    depthMode: "layered",
    irregularityLevel: "mixed",
    withholdingLevel: "medium",
    lightDiffusion: "controlled",
    motionLevel: "noticeable",
  },
  open: {
    shadowRatio: [0.3, 0.5],
    scaleRange: [0.6, 0.8],
    depthMode: "deep",
    irregularityLevel: "subtle",
    withholdingLevel: "low",
    lightDiffusion: "gradual",
    motionLevel: "ambient",
  },
};

// ─── Dimension Translation Tables ────────────────────────────────────────────
// Each dimension maps its enum value to a concrete prompt directive.
// Language is chosen to be photographable and image-model-friendly.

const LIGHT_STRUCTURE: Record<ArcPosition, string> = {
  gathering: "directional light partially occluded, steep falloff, light feels discovered not given",
  arriving:  "strong directional source, controlled falloff, light feels confrontational and present",
  open:      "broad diffused light, gradual falloff, light feels inhabitable and ambient",
};

const SHADOW_RATIO: Record<ArcPosition, string> = {
  gathering: "60–80% frame in shadow, shadow is narrative compression",
  arriving:  "50–65% shadow, shadow negotiates with light",
  open:      "30–50% shadow, shadow recedes, frame opens",
};

const SCALE: Record<ArcPosition, string> = {
  gathering: "subject occupies 20–40% of frame, compressed intimate scale",
  arriving:  "subject occupies 40–60% of frame, threshold scale",
  open:      "subject occupies 60–80% of frame OR vast environmental scale with figure small",
};

const DEPTH_STRUCTURE: Record<DepthMode, string> = {
  shallow: "shallow depth of field, subject isolated from environment",
  layered: "layered mid-depth, foreground and background both present",
  deep:    "deep layered space, environment fully integrated with subject",
};

const MOTION_TIME: Record<MotionLevel, string> = {
  minimal:    "breath-level motion only, near-stillness",
  noticeable: "threshold-level motion, crossing implied",
  ambient:    "environmental drift, stable ambient movement",
};

const IRREGULARITY: Record<IrregularityLevel, string> = {
  subtle: "subtle irregularity only, no chaos",
  mixed:  "subtle irregularity plus one moderate element allowed, friction present",
};

const WITHHOLDING: Record<WithholdingLevel, string> = {
  high:   "partial occlusion, hidden light source, cropped frame, high withholding",
  medium: "one element revealed, one element withheld, balanced disclosure",
  low:    "minimal obstruction, frame breathes, open disclosure",
};

const BIOLOGICAL_ANCHORS: Record<ArcPosition, string> = {
  gathering: "warm light on skin, breath visible, tactile texture detail",
  arriving:  "direct gaze, contrast edges, threshold presence",
  open:      "scale, sky, horizon, air, environmental vastness",
};

// ─── Translation Function ─────────────────────────────────────────────────────

/**
 * Translate an arc position into concrete physics-directive prompt language
 * across all 8 dimensions of the Emotional Physics Modulation Matrix.
 *
 * Returns both a compact `promptDirective` string for injection into the
 * prompt pipeline and a structured `dimensions` breakdown for debugging.
 */
export function buildArcModulationDirectives(
  arcPosition: ArcPosition
): ArcModulationDirectives {
  const profile = ARC_MODULATION_PROFILES[arcPosition];

  const lightStructure    = LIGHT_STRUCTURE[arcPosition];
  const shadowRatio       = SHADOW_RATIO[arcPosition];
  const scale             = SCALE[arcPosition];
  const depthStructure    = DEPTH_STRUCTURE[profile.depthMode];
  const motionTime        = MOTION_TIME[profile.motionLevel];
  const irregularity      = IRREGULARITY[profile.irregularityLevel];
  const withholding       = WITHHOLDING[profile.withholdingLevel];
  const biologicalAnchors = BIOLOGICAL_ANCHORS[arcPosition];

  // Compact directive: all 8 dimensions joined as a single prompt string.
  // Order mirrors the spec's priority: light → shadow → scale → depth →
  // motion → irregularity → withholding → biological anchors.
  const promptDirective = [
    lightStructure,
    shadowRatio,
    scale,
    depthStructure,
    motionTime,
    irregularity,
    withholding,
    biologicalAnchors,
  ].join(", ");

  return {
    promptDirective,
    dimensions: {
      lightStructure,
      shadowRatio,
      scale,
      depthStructure,
      motionTime,
      irregularity,
      withholding,
      biologicalAnchors,
    },
  };
}

/**
 * Returns the ArcModulationProfile for a given arc position.
 * Useful for the evaluator and adaptive controller to read profile data
 * without re-importing the full translation tables.
 */
export function getArcModulationProfile(
  arcPosition: ArcPosition
): ArcModulationProfile {
  return ARC_MODULATION_PROFILES[arcPosition];
}
