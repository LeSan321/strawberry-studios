/**
 * Life Signal Randomizer
 *
 * Injects controlled micro-irregularities into cover art prompts to prevent
 * sterile AI polish and trigger biological recognition of aliveness.
 *
 * Based on the Emotional Physics Framework (Emotional Physics conversation,
 * Life Signal Registry v1.0 + Arc Modulation Matrix).
 *
 * Core principle: humans detect life through micro-asymmetry, non-uniform timing,
 * texture variance, and slight entropy. This module injects that entropy without
 * breaking the world's physics coherence.
 *
 * Rules:
 *   - Inject 1–2 signals per generation (arc-dependent)
 *   - Never stack incompatible signals
 *   - Rotate: never repeat the same signal in consecutive generations
 *   - Only 1 moderate-intensity signal per image
 *   - Total contribution must stay under ~120 characters (prompt budget)
 */

import type { ArcPosition } from "./promptBuilder";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LifeSignalDomain =
  | "light"
  | "material"
  | "atmosphere"
  | "composition"
  | "temporal";

export type LifeSignalIntensity = "subtle" | "moderate";

export interface LifeSignal {
  id: string;
  domain: LifeSignalDomain;
  /**
   * The actual text fragment injected into the prompt.
   * Must be concrete and photographable — not abstract.
   */
  promptFragment: string;
  /**
   * Selection weight (0–1). Higher = more likely to be chosen.
   * subtle defaults tend to be higher weight.
   */
  weight: number;
  intensity: LifeSignalIntensity;
  /**
   * IDs of signals that must not appear in the same generation.
   */
  incompatibleWith: string[];
  /**
   * Arc positions where this signal is eligible. Empty = all arcs.
   */
  eligibleArcs: ArcPosition[];
  /**
   * Internal dev note — never sent to the image model.
   */
  notes: string;
}

// ─── Life Signal Registry v1.0 ────────────────────────────────────────────────
// 20 entries across 5 domains.
// Safe defaults (high-frequency, low-detection-risk) are marked with weight ≥ 0.7.

export const LIFE_SIGNAL_REGISTRY: LifeSignal[] = [
  // ── DOMAIN 1: Light Variance ────────────────────────────────────────────────
  {
    id: "subtle_key_variation",
    domain: "light",
    promptFragment: "subtle natural variation in the intensity of the primary light source",
    weight: 0.8,
    intensity: "subtle",
    incompatibleWith: [],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Simulates practical flicker or organic power fluctuation. Safe default.",
  },
  {
    id: "soft_shadow_edge_irregularity",
    domain: "light",
    promptFragment: "slight irregularity along the shadow edge, not perfectly uniform",
    weight: 0.7,
    intensity: "subtle",
    incompatibleWith: ["hard_interrogation_light"],
    eligibleArcs: ["gathering", "arriving", "open"],
    notes: "Prevents sterile digital shadow lines. Safe default.",
  },
  {
    id: "practical_flicker_hint",
    domain: "light",
    promptFragment: "a faint suggestion of flicker from a nearby practical light source",
    weight: 0.4,
    intensity: "moderate",
    incompatibleWith: ["open_daylight_scene"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Use sparingly — strong mood signal. Avoid in open/daylight contexts.",
  },
  {
    id: "highlight_imperfection",
    domain: "light",
    promptFragment: "highlights slightly imperfect and not perfectly symmetrical",
    weight: 0.6,
    intensity: "subtle",
    incompatibleWith: [],
    eligibleArcs: ["gathering", "arriving", "open"],
    notes: "Breaks studio-commercial perfection without being obvious.",
  },

  // ── DOMAIN 2: Material Imperfection ─────────────────────────────────────────
  {
    id: "fabric_mid_settle",
    domain: "material",
    promptFragment: "fabric captured mid-settle, slight asymmetry in drape",
    weight: 0.7,
    intensity: "subtle",
    incompatibleWith: ["rigid_architecture_focus"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Creates time signal through cloth physics. Safe default.",
  },
  {
    id: "velvet_pile_variation",
    domain: "material",
    promptFragment: "visible variation in velvet pile direction catching light unevenly",
    weight: 0.6,
    intensity: "subtle",
    incompatibleWith: [],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Enhances realism of absorptive surfaces.",
  },
  {
    id: "micro_wrinkle_memory",
    domain: "material",
    promptFragment: "fine natural wrinkle memory visible in the garment",
    weight: 0.5,
    intensity: "subtle",
    incompatibleWith: ["minimalist_clean_surface"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Adds lived-in realism.",
  },
  {
    id: "surface_grain_in_shadow",
    domain: "material",
    promptFragment: "natural grain texture visible in shadow regions",
    weight: 0.7,
    intensity: "subtle",
    incompatibleWith: [],
    eligibleArcs: ["gathering", "arriving", "open"],
    notes: "Prevents shadow smoothness. Safe default.",
  },

  // ── DOMAIN 3: Atmospheric Drift ──────────────────────────────────────────────
  {
    id: "subtle_haze_drift",
    domain: "atmosphere",
    promptFragment: "subtle atmospheric drift visible in the light beam",
    weight: 0.8,
    intensity: "subtle",
    incompatibleWith: ["crisp_outdoor_noon"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Strong life signal, use often in dark environments. Safe default.",
  },
  {
    id: "dust_in_light_column",
    domain: "atmosphere",
    promptFragment: "fine dust particles visible in the column of light",
    weight: 0.6,
    intensity: "subtle",
    incompatibleWith: ["heavy_rain_scene"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Creates depth and time signal.",
  },
  {
    id: "faint_smoke_curl",
    domain: "atmosphere",
    promptFragment: "a faint curl of smoke lingering near the subject",
    weight: 0.4,
    intensity: "moderate",
    incompatibleWith: ["bright_sunlit_exterior"],
    eligibleArcs: ["gathering"],
    notes: "Strong noir energy — use carefully. Gathering only.",
  },
  {
    id: "visible_breath",
    domain: "atmosphere",
    promptFragment: "barely visible breath in cool air",
    weight: 0.3,
    intensity: "moderate",
    incompatibleWith: ["warm_interior_scene"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Signals vulnerability and temperature. Use sparingly.",
  },

  // ── DOMAIN 4: Compositional Asymmetry ───────────────────────────────────────
  {
    id: "slight_off_center_balance",
    domain: "composition",
    promptFragment: "subject positioned slightly off-center, natural asymmetry",
    weight: 0.9,
    intensity: "subtle",
    incompatibleWith: ["iconic_symmetry_mode"],
    eligibleArcs: ["gathering", "arriving", "open"],
    notes: "High-frequency life injection. Safe default. Almost always appropriate.",
  },
  {
    id: "partial_foreground_occlusion",
    domain: "composition",
    promptFragment: "a foreground element partially obscuring the lower frame",
    weight: 0.6,
    intensity: "moderate",
    incompatibleWith: ["clean_poster_style"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Adds embodiment and depth.",
  },
  {
    id: "one_eye_shadowed",
    domain: "composition",
    promptFragment: "one eye partially in shadow, the other softly illuminated",
    weight: 0.5,
    intensity: "moderate",
    incompatibleWith: ["fully_even_portrait"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Psychological tension. Strong signal — use once per session.",
  },
  {
    id: "asymmetrical_shadow_split",
    domain: "composition",
    promptFragment: "face divided unevenly by shadow",
    weight: 0.4,
    intensity: "moderate",
    incompatibleWith: ["one_eye_shadowed"],
    eligibleArcs: ["gathering", "arriving"],
    notes: "Narrative ambiguity. Incompatible with one_eye_shadowed — same effect.",
  },

  // ── DOMAIN 5: Temporal Trace ─────────────────────────────────────────────────
  {
    id: "hair_slightly_displaced",
    domain: "temporal",
    promptFragment: "hair slightly displaced as if recently moved",
    weight: 0.7,
    intensity: "subtle",
    incompatibleWith: ["perfectly_static_pose"],
    eligibleArcs: ["gathering", "arriving", "open"],
    notes: "Micro movement cue. Safe default.",
  },
  {
    id: "hand_entering_light",
    domain: "temporal",
    promptFragment: "a hand just entering the beam of light",
    weight: 0.4,
    intensity: "moderate",
    incompatibleWith: [],
    eligibleArcs: ["arriving"],
    notes: "Threshold moment. Arriving arc only.",
  },
  {
    id: "flame_mid_flicker",
    domain: "temporal",
    promptFragment: "a candle flame caught mid-flicker",
    weight: 0.5,
    intensity: "subtle",
    incompatibleWith: ["daylight_scene"],
    eligibleArcs: ["gathering"],
    notes: "Organic light variance. Gathering arc only.",
  },
  {
    id: "soft_edge_motion_blur",
    domain: "temporal",
    promptFragment: "subtle motion blur at the edge of movement",
    weight: 0.3,
    intensity: "moderate",
    incompatibleWith: ["hyper_sharp_architecture"],
    eligibleArcs: ["arriving", "open"],
    notes: "Temporal realism. Use sparingly.",
  },
];

// ─── Safe Defaults ────────────────────────────────────────────────────────────
// These 5 signals appear most often and are least likely to be noticed as a pattern.
// They can be drawn from more frequently without detection risk.

export const SAFE_DEFAULT_SIGNAL_IDS = new Set([
  "slight_off_center_balance",
  "subtle_haze_drift",
  "fabric_mid_settle",
  "surface_grain_in_shadow",
  "hair_slightly_displaced",
]);

// ─── Arc Signal Count ─────────────────────────────────────────────────────────

/**
 * How many life signals to inject per arc position.
 * Arriving = friction peak → 2 signals.
 * Gathering and Open = more restrained → 1 signal.
 */
function determineLifeSignalCount(arcPosition: ArcPosition): number {
  if (arcPosition === "arriving") return 2;
  return 1;
}

// ─── Weighted Random Selection ────────────────────────────────────────────────

/**
 * Pick one signal from the pool using weighted random selection.
 * Safe defaults get a 1.5× weight bonus to increase their frequency.
 */
function weightedPick(pool: LifeSignal[]): LifeSignal {
  const totalWeight = pool.reduce((sum, sig) => {
    const bonus = SAFE_DEFAULT_SIGNAL_IDS.has(sig.id) ? 1.5 : 1.0;
    return sum + sig.weight * bonus;
  }, 0);

  let rand = Math.random() * totalWeight;
  for (const sig of pool) {
    const bonus = SAFE_DEFAULT_SIGNAL_IDS.has(sig.id) ? 1.5 : 1.0;
    rand -= sig.weight * bonus;
    if (rand <= 0) return sig;
  }
  return pool[pool.length - 1];
}

/**
 * Check whether a candidate signal is compatible with already-selected signals.
 * Also enforces the rule: only 1 moderate-intensity signal per image.
 */
function isCompatible(selected: LifeSignal[], candidate: LifeSignal): boolean {
  // Check explicit incompatibility declarations (bidirectional)
  for (const sel of selected) {
    if (sel.incompatibleWith.includes(candidate.id)) return false;
    if (candidate.incompatibleWith.includes(sel.id)) return false;
  }
  // Enforce: at most 1 moderate-intensity signal per image
  const moderateCount = selected.filter((s) => s.intensity === "moderate").length;
  if (candidate.intensity === "moderate" && moderateCount >= 1) return false;
  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LifeSignalResult {
  /** The assembled prompt fragment to inject (comma-separated) */
  promptFragment: string;
  /** IDs of the selected signals (for rotation memory) */
  selectedIds: string[];
}

/**
 * Select and format life signals for a single cover art generation.
 *
 * @param arcPosition - The arc position for this generation
 * @param lastUsedIds - IDs used in the immediately preceding generation (excluded from pool)
 * @returns A LifeSignalResult with the prompt fragment and selected IDs
 */
export function selectLifeSignals(
  arcPosition: ArcPosition,
  lastUsedIds: string[] = []
): LifeSignalResult {
  const count = determineLifeSignalCount(arcPosition);
  const lastUsedSet = new Set(lastUsedIds);

  // Build eligible pool: arc-compatible and not recently used
  let pool = LIFE_SIGNAL_REGISTRY.filter((sig) => {
    // Must be eligible for this arc (empty eligibleArcs = all arcs)
    if (sig.eligibleArcs.length > 0 && !sig.eligibleArcs.includes(arcPosition)) return false;
    // Exclude recently used signals (rotation memory)
    if (lastUsedSet.has(sig.id)) return false;
    return true;
  });

  // If the pool is too small (e.g. very constrained arc), relax the rotation exclusion
  if (pool.length < count) {
    pool = LIFE_SIGNAL_REGISTRY.filter((sig) => {
      if (sig.eligibleArcs.length > 0 && !sig.eligibleArcs.includes(arcPosition)) return false;
      return true;
    });
  }

  const selected: LifeSignal[] = [];

  while (selected.length < count && pool.length > 0) {
    const candidate = weightedPick(pool);
    // Remove from pool regardless (don't re-try the same candidate)
    pool = pool.filter((s) => s.id !== candidate.id);

    if (isCompatible(selected, candidate)) {
      selected.push(candidate);
    }
  }

  const promptFragment = selected.map((s) => s.promptFragment).join(", ");
  const selectedIds = selected.map((s) => s.id);

  return { promptFragment, selectedIds };
}
