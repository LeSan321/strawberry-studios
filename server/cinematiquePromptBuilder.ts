/**
 * Cinématique Prompt Builder — Runway-Optimised Edition
 *
 * Runway gen4.5 enforces a hard 1000-character limit on promptText.
 * This builder distils the 10-layer Cinématique formula (Chapter 6) into a
 * compact, visually dense prompt that stays well under that limit while
 * preserving the core cinematic intent: environment, light, subject, atmosphere,
 * camera, and contrast.
 *
 * Strategy:
 *   1. Build a ~700-char structured core from the 5 most visually decisive layers
 *      (environment + era, light geometry, subject/wardrobe, atmosphere, camera).
 *   2. Append up to ~250 chars from the Expert Council's cinematiquePrompt
 *      (the first sentence or two — the most semantically rich part).
 *   3. Close with a ~50-char quality tail.
 *   4. Hard-clamp to 1000 chars as a safety net.
 */

export type DirectorsPackage = {
  cinematiquePrompt: string;
  shotList: Array<{
    shotNumber: number;
    shotType: string;
    description: string;
    duration: string;
    cameraMovement: string;
    lightingNote: string;
  }>;
  productionNotes: {
    fabricPhysics: string;
    lightingSetup: string;
    cameraPsychology: string;
    atmosphericElements: string;
  };
  directorStatement: string;
  concert?: {
    title?: string;
    artistName?: string;
    venue?: string;
    moodPreset?: string;
    visualPreset?: string;
    cameraStyle?: string;
    lightingKelvin?: number;
    characters?: string;
  };
};

export type PromptBuildOptions = {
  directorsPackage: DirectorsPackage;
  /** Override the primary shot to use for the video prompt (default: shot 1) */
  primaryShotIndex?: number;
  /** Duration in seconds for the video (default: 5) */
  durationSeconds?: number;
};

// ── Visual preset → compact light + atmosphere descriptor ────────────────────
const VISUAL_PRESET: Record<string, { light: string; atmos: string; contrast: string }> = {
  shadow_and_smoke: {
    light: "single tungsten 1800K, hard 45° shadow edge, 70% frame in deep shadow",
    atmos: "oil haze at chest height, light column, haze density 0.5",
    contrast: "extreme chiaroscuro, warm amber, film grain, anamorphic flare",
  },
  golden_rim: {
    light: "2400K amber footlights, golden rim separating performer from dark bg",
    atmos: "warm bokeh bg, subtle waist-height haze, density 0.3",
    contrast: "warm amber grade, rich shadow detail, high contrast",
  },
  venetian_cage: {
    light: "2200K tungsten sidelight, venetian blind shadow bars at 45° across stage",
    atmos: "minimal haze, clean shadow geometry, density 0.2",
    contrast: "film noir, deep contrast, architectural shadow play",
  },
  match_flare: {
    light: "single match flame 1600K, extreme chiaroscuro, intimate close-up",
    atmos: "breath-close proximity, atmospheric wisps from candlelight",
    contrast: "extreme contrast, dangerous beauty, ultra-warm micro-light, film grain",
  },
  none: {
    light: "single tungsten 2500K, motivated source, hard shadow edges",
    atmos: "oil haze at chest height, density 0.4",
    contrast: "high contrast, warm amber, cinematic realism",
  },
};

// ── Mood → subject modifier ───────────────────────────────────────────────────
const MOOD_SUBJECT: Record<string, string> = {
  intimate_jazz: "performer in intimate close-up, gaze toward camera",
  high_energy: "performer in dynamic mid-shot, body in motion, fabric lag visible",
  noir_smoke: "performer half in shadow, one eye lit, face asymmetric",
  custom: "performer center stage, slow push-in implied",
};

// ── Character → compact wardrobe ─────────────────────────────────────────────
const CHARACTER_WARDROBE: Record<string, string> = {
  singer: "deep crimson bias-cut silk charmeuse gown, fabric lag 0.3s, warm Fresnel edge highlight",
  fedora: "charcoal wool gabardine suit, fedora brim shadowing upper face, jaw lit, eyes concealed",
  custom: "period 1940s attire, fabric responding to stage light",
};

// ── Camera style → compact lens descriptor ───────────────────────────────────
function lensDescriptor(cameraStyle: string): string {
  if (cameraStyle.includes("wide") || cameraStyle.includes("establish")) {
    return "35mm, standing height 1.6m, slow push-in 0.5cm/s";
  }
  if (cameraStyle.includes("extreme") || cameraStyle.includes("close")) {
    return "85mm f/1.4, standing height 1.6m, slow push-in 1cm/s, warm bokeh bg";
  }
  return "85mm f/1.4, standing height 1.6m, slow push-in, romantic compression";
}

/**
 * Build a Runway-safe (≤1000 char) Cinématique video prompt.
 */
export function buildCinématiqueVideoPrompt(options: PromptBuildOptions): string {
  const { directorsPackage: pkg, primaryShotIndex = 0 } = options;
  const concert = pkg.concert ?? {};

  const visualKey = concert.visualPreset ?? "shadow_and_smoke";
  const preset = VISUAL_PRESET[visualKey] ?? VISUAL_PRESET.none;
  const moodKey = concert.moodPreset ?? "intimate_jazz";
  const moodMod = MOOD_SUBJECT[moodKey] ?? MOOD_SUBJECT.custom;
  const kelvin = concert.lightingKelvin ?? 2500;

  // Character wardrobe
  const chars = (concert.characters ?? "").toLowerCase();
  let wardrobe: string;
  if (chars.includes("red head") || chars.includes("singer")) {
    wardrobe = CHARACTER_WARDROBE.singer;
  } else if (chars.includes("fedora")) {
    wardrobe = CHARACTER_WARDROBE.fedora;
  } else {
    wardrobe = CHARACTER_WARDROBE.custom;
  }

  const lens = lensDescriptor(concert.cameraStyle ?? "");

  // ── Core structured prompt (~650 chars) ──────────────────────────────────
  const core = [
    // Environment + era
    "1940s noir jazz club, low ceiling, velvet and brass, dark mahogany bar, late night",
    // Subject
    `${moodMod}, ${wardrobe}`,
    // Light
    `${preset.light}, primary ${kelvin}K`,
    // Light hierarchy
    "70% frame in deep shadow, performer brightest, bg dissolves to black, no fill, no overhead wash",
    // Atmosphere
    preset.atmos,
    // Depth
    "foreground glassware bokeh, four depth planes: glass / haze / performer / darkness",
    // Camera
    lens,
    // Contrast
    preset.contrast,
  ].join(". ");

  // ── Expert Council semantic core (first 1–2 sentences, max 250 chars) ────
  const expertCore = pkg.cinematiquePrompt
    ? (() => {
        // Take up to first 2 sentences
        const sentences = pkg.cinematiquePrompt.match(/[^.!?]+[.!?]+/g) ?? [];
        let excerpt = "";
        for (const s of sentences) {
          if ((excerpt + s).length > 250) break;
          excerpt += s;
        }
        return excerpt.trim() || pkg.cinematiquePrompt.slice(0, 250);
      })()
    : "";

  // ── Quality tail ─────────────────────────────────────────────────────────
  const tail = "minimal fill, asymmetrical lighting, chiaroscuro ratio 8:1, cinematic realism, photorealistic, 4K";

  // ── Assemble and hard-clamp to 1000 chars ────────────────────────────────
  let prompt = core;
  if (expertCore) {
    const candidate = `${prompt}. ${expertCore}`;
    // Only append if it fits with the tail
    if ((candidate + ". " + tail).length <= 1000) {
      prompt = candidate;
    }
  }
  prompt = `${prompt}. ${tail}`;

  // Safety clamp — should never be needed but guarantees the API won't reject
  if (prompt.length > 1000) {
    prompt = prompt.slice(0, 997) + "...";
  }

  return prompt;
}

/**
 * Extract the primary shot description from a Director's Package shot list.
 */
export function getPrimaryShot(
  directorsPackage: DirectorsPackage,
  shotIndex = 0
): DirectorsPackage["shotList"][number] | null {
  return directorsPackage.shotList?.[shotIndex] ?? null;
}
