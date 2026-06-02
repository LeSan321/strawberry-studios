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

// ─── Compact Directive Table ─────────────────────────────────────────────────
// Each arc position maps to a single compact directive string that encodes all
// 8 physics dimensions (light, shadow, scale, depth, motion, irregularity,
// withholding, biological anchors) in ~115–130 chars.
//
// Compressed from the full 8-clause format (~470 chars) to stay within
// Runway's 1000-character promptText hard limit while preserving all
// semantic physics values.
//
// Dimension encoding key:
//   light falloff | shadow % | subject scale | depth mode | motion level |
//   withholding level | biological anchor

const COMPACT_DIRECTIVES: Record<ArcPosition, string> = {
  gathering: "steep falloff, 60–80% shadow, subject 20–40% frame, shallow DOF, near-stillness, high withholding, warm skin texture",
  arriving:  "controlled falloff, 50–65% shadow, subject 40–60% frame, layered depth, threshold motion, one element withheld, direct gaze",
  open:      "gradual falloff, 30–50% shadow, subject 60–80% frame or figure small, deep space, ambient drift, open disclosure, sky and horizon",
};

// ─── Legacy dimension tables (kept for structured debug output) ───────────────
// These are NOT used in the prompt directive — only in the `dimensions` debug
// breakdown returned by buildArcModulationDirectives().

const LIGHT_STRUCTURE: Record<ArcPosition, string> = {
  gathering: "steep falloff, light partially occluded",
  arriving:  "controlled falloff, strong directional source",
  open:      "gradual falloff, broad diffused light",
};

const SHADOW_RATIO: Record<ArcPosition, string> = {
  gathering: "60–80% frame in shadow",
  arriving:  "50–65% shadow",
  open:      "30–50% shadow",
};

const SCALE: Record<ArcPosition, string> = {
  gathering: "subject 20–40% frame, compressed intimate scale",
  arriving:  "subject 40–60% frame, threshold scale",
  open:      "subject 60–80% frame or figure small in vast environment",
};

const DEPTH_STRUCTURE: Record<DepthMode, string> = {
  shallow: "shallow DOF, subject isolated",
  layered: "layered depth, foreground and background both present",
  deep:    "deep space, environment fully integrated",
};

const MOTION_TIME: Record<MotionLevel, string> = {
  minimal:    "near-stillness",
  noticeable: "threshold motion, crossing implied",
  ambient:    "ambient drift",
};

const IRREGULARITY: Record<IrregularityLevel, string> = {
  subtle: "subtle irregularity only",
  mixed:  "one moderate element allowed, friction present",
};

const WITHHOLDING: Record<WithholdingLevel, string> = {
  high:   "high withholding, partial occlusion",
  medium: "one element withheld, balanced disclosure",
  low:    "open disclosure, frame breathes",
};

const BIOLOGICAL_ANCHORS: Record<ArcPosition, string> = {
  gathering: "warm skin texture",
  arriving:  "direct gaze",
  open:      "sky and horizon",
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

  // Compact directive: use the pre-built compact string for the arc position.
  // This encodes all 8 dimensions in ~115–130 chars (vs ~470 chars for the
  // full 8-clause format), keeping the total prompt under Runway's 1000-char limit.
  const promptDirective = COMPACT_DIRECTIVES[arcPosition];

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
