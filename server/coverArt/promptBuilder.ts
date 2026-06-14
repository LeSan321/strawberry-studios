/**
 * Cover Art Prompt Builder
 *
 * Includes the Life Signal Randomizer (Emotional Physics Framework)
 * for controlled micro-irregularity injection.
 *
 * Assembles image generation prompts from three input layers:
 *   1. Creator vocabulary (personal frequency or platform default)
 *   2. Arc position (gathering / arriving / open)
 *   3. Lyrics distillation (2–3 load-bearing phrases extracted from lyrics)
 *
 * Genre and mood tags are optional production context — lowest weight.
 *
 * Assembly order (per build spec Part 2.3):
 *   1. Arc position framing sentence
 *   2. Environment terms
 *   3. Emotional register terms
 *   4. Arc terms
 *   5. Color and light terms
 *   6. Lyrics distillation (if available)
 *   7. Forbidden terms (as negative instructions)
 *   8. Quality tail
 *
 * Target: under 900 characters (headroom below 1000-char Runway limit).
 *
 * Weighting hierarchy (build spec Part 5.2):
 *   Priority 1 — Lyrics (creator's actual words)
 *   Priority 2 — Frequency vocabulary (creator's visual philosophy)
 *   Priority 3 — Platform default vocabulary (platform philosophy)
 *   Priority 4 — Genre/mood tags (production context only)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArcPosition = "gathering" | "arriving" | "open";

export type VocabularyTerm = {
  term: string;
  instruction: string;
};

export type VocabularyJson = {
  environment: VocabularyTerm[];
  emotionalRegister: VocabularyTerm[];
  arcTerms: VocabularyTerm[];
  forbiddenTerms: VocabularyTerm[];
  colorLight: VocabularyTerm[];
  relationshipGeometry: VocabularyTerm[];
};

// ─── Imports ─────────────────────────────────────────────────────────────────
import { selectLifeSignals } from "./lifeSignalRandomizer";
import { buildArcModulationDirectives } from "./arcModulationMatrix";
import type { ArcModulationDirectives } from "./arcModulationMatrix";

export type CoverArtPromptInput = {
  /** Creator's personal vocabulary, or the platform default vocabulary */
  vocabulary: VocabularyJson;
  /** Arc position for this song/campaign */
  arcPosition: ArcPosition;
  /**
   * 2–3 load-bearing phrases already extracted from lyrics by the LLM
   * pre-processing step (see extractLyricPhrases). Pass null/undefined
   * if no lyrics are available.
   */
  lyricPhrases?: string[] | null;
  /**
   * Optional creator-supplied art direction note (repurposed from the
   * Description field in the Riff upload form). When present, this is
   * prepended as the HIGHEST-PRIORITY directive — before lyrics and
   * vocabulary. A few words from the creator override everything else.
   * Example: "golden hour, empty road" or "rainy city, neon reflections"
   */
  steeringNote?: string | null;
  /** Optional genre tag for production context (lowest weight) */
  genre?: string | null;
  /** Optional mood tags for production context (lowest weight) */
  moodTags?: string[] | null;
  /**
   * Optional synthesis fingerprint from the creator's Frequency record.
   * Used as the environment anchor when no lyrics and no steering note are
   * present — it is the most complete single-sentence description of the
   * creator's visual world and is written in photographable language.
   * Only the first ~200 chars are used to stay within the character budget.
   */
  synthesisFingerprint?: string | null;
  /**
   * IDs of life signals used in the immediately preceding generation.
   * Passed to the Life Signal Randomizer to prevent consecutive repetition.
   * Omit or pass empty array for the first generation.
   */
  lastUsedLifeSignalIds?: string[] | null;
};

export type CoverArtPromptOutput = {
  /** The assembled prompt string, ready to pass to generateImage() */
  prompt: string;
  /** Character count of the assembled prompt */
  charCount: number;
  /** Whether the prompt was truncated to stay under the character limit */
  wasTruncated: boolean;
  /** Debug breakdown of which layers contributed */
  layers: {
    steeringNote: string | null;
    arcFraming: string;
    environmentTerms: string[];
    emotionalTerms: string[];
    arcTerms: string[];
    colorLightTerms: string[];
    lyricPhrases: string[];
    forbiddenTerms: string[];
    productionContext: string | null;
    cinematiqueRendering: string;
    /** Arc Modulation Matrix — 8-dimension physics directive (Emotional Physics v1.0) */
    arcModulation: string;
    /** Structured breakdown of each modulation dimension for debugging */
    arcModulationDimensions: ArcModulationDirectives["dimensions"];
    genreFallbackPresence: string | null;
    synthesisAnchor: string | null;
    lifeSignalBlock: string | null;
    lifeSignalIds: string[];
  };
};

// ─── Arc Position Framing Sentences ──────────────────────────────────────────
// These are SHORT scale/mood modifiers — NOT the dominant visual instruction.
// They should feel like a camera direction, not a scene description.
// Keep them brief so the image model doesn't latch onto them as the primary subject.

const ARC_FRAMING: Record<ArcPosition, string> = {
  gathering:
    "intimate close-up scale, quiet and compressed,",
  arriving:
    "mid-distance scale, threshold moment, world opening,",
  open:
    "wide landscape scale, figure small against vast environment,",
};

// ─── Arc Position Vocabulary Weighting ───────────────────────────────────────
// Each arc position foregrounds different vocabulary categories.
// The weights determine how many terms from each category are included.
// Higher weight = more terms included from that category.

type CategoryWeights = {
  environment: number;
  emotionalRegister: number;
  arcTerms: number;
  colorLight: number;
  relationshipGeometry: number;
};

const ARC_WEIGHTS: Record<ArcPosition, CategoryWeights> = {
  gathering: {
    // Intimate: emotional register and color/light lead; environment is compressed
    environment: 2,
    emotionalRegister: 3,
    arcTerms: 2,
    colorLight: 3,
    relationshipGeometry: 1,
  },
  arriving: {
    // Threshold: balanced — all categories contribute equally
    environment: 3,
    emotionalRegister: 2,
    arcTerms: 3,
    colorLight: 2,
    relationshipGeometry: 2,
  },
  open: {
    // Vast: environment and arc terms lead; emotional register is secondary
    environment: 4,
    emotionalRegister: 2,
    arcTerms: 3,
    colorLight: 2,
    relationshipGeometry: 2,
  },
};

// ─── Cinématique Rendering Layer ─────────────────────────────────────────────
// Derived from the Cinématique Physics Bible and Psychology Bible.
// These are HOW-TO-RENDER directives — not scene content.
// They add lighting grammar, atmospheric texture, and compositional tension
// that push outputs from "stock photography" toward "album cover art".
//
// Each arc position maps to a distinct cinematic rendering grammar:
//   gathering  → intimate chiaroscuro, close shadow ratio, warm tungsten
//   arriving   → threshold lighting, motivated source, atmospheric depth
//   open       → wide dynamic range, natural light, vast negative space

const CINEMATIQUE_RENDERING: Record<ArcPosition, string> = {
  gathering:
    "chiaroscuro lighting, deep shadow 70% frame, warm tungsten 2700K key, asymmetric composition, shallow depth of field, foreground texture for depth",
  arriving:
    "motivated single source, threshold light, stratified atmosphere, asymmetric framing, figure facing forward or in profile, background partially obscured",
  open:
    "wide dynamic range, natural available light, vast negative space, figure small against environment, atmospheric depth, no artificial fill",
};

// ─── Mood Energy Mapping ─────────────────────────────────────────────────────
// Translates mood tags into concrete visual energy directives.
// These go near the TOP of the prompt (after lyrics) so they influence
// the model's core scene interpretation, not just the tail.
//
// Two outputs per mood cluster:
//   energyDirective — the visual energy level and scene population
//   humanPresence   — explicit instruction about people in the frame

type MoodEnergyMap = {
  energyDirective: string;
  humanPresence: string;
};

const MOOD_ENERGY_MAP: Record<string, MoodEnergyMap> = {
  // High energy / upbeat
  hypnotic: { energyDirective: "layered visual depth, dreamlike motion, vibrant color saturation", humanPresence: "multiple figures in motion, crowd energy implied" },
  lush: { energyDirective: "rich saturated color, dense layered texture, abundant visual detail", humanPresence: "figures present, warm and connected" },
  energetic: { energyDirective: "dynamic motion blur, high contrast, kinetic energy", humanPresence: "multiple figures, movement and energy" },
  upbeat: { energyDirective: "bright warm light, open space, forward movement", humanPresence: "figures present, expressive and in motion" },
  euphoric: { energyDirective: "overexposed highlights, warm golden light, expansive scale", humanPresence: "crowd or group energy, faces visible and expressive" },
  playful: { energyDirective: "bright light, unexpected angles, vivid color", humanPresence: "figures present, candid and spontaneous" },
  // Mid energy / emotional
  romantic: { energyDirective: "soft warm light, intimate scale, bokeh background", humanPresence: "two figures or intimate single figure, close and present" },
  tender: { energyDirective: "soft diffused light, gentle texture, quiet warmth", humanPresence: "figure present, gentle and close" },
  raw: { energyDirective: "high grain, harsh available light, unpolished texture", humanPresence: "figure present, unguarded and authentic" },
  passionate: { energyDirective: "deep warm tones, high contrast, intense focus", humanPresence: "figure present, intense and expressive" },
  // Low energy / introspective
  meditative: { energyDirective: "still air, long shadows, minimal movement", humanPresence: "solitary figure or no figure, stillness" },
  melancholic: { energyDirective: "cool desaturated tones, diffused light, quiet emptiness", humanPresence: "solitary figure, facing camera or in profile, present and still" },
  // Night / atmosphere
  "late night": { energyDirective: "neon-lit interior, warm practical lights, night atmosphere", humanPresence: "figures present, bar or venue crowd energy" },
  dark: { energyDirective: "deep shadow, minimal light sources, high contrast", humanPresence: "solitary figure or silhouette" },
  // Country / folk / roots
  nostalgic: { energyDirective: "golden hour light, worn textures, analog warmth", humanPresence: "figure present, weathered and authentic" },
  soulful: { energyDirective: "warm tungsten light, rich shadow, emotional depth", humanPresence: "figure present, expressive and present" },
};

/**
 * Translate mood tags into visual energy and human presence directives.
 * Returns null if no mood tags match the map.
 */
function resolveMoodEnergy(moodTags: string[]): MoodEnergyMap | null {
  const normalized = moodTags.map((t) => t.toLowerCase().trim());
  // Find the first matching mood tag (priority: first match wins)
  for (const tag of normalized) {
    if (MOOD_ENERGY_MAP[tag]) return MOOD_ENERGY_MAP[tag];
    // Partial match — check if any key is contained in the tag
    for (const key of Object.keys(MOOD_ENERGY_MAP)) {
      if (tag.includes(key) || key.includes(tag)) return MOOD_ENERGY_MAP[key];
    }
  }
  return null;
}

// ─── Quality Tail ─────────────────────────────────────────────────────────────
// Standard image quality and composition instructions appended to every prompt.
// Kept short to preserve character budget for vocabulary and lyrics.

const QUALITY_TAIL =
  "Square 1:1 composition. Cinematic photography. Album cover aesthetic. No text, no logos, no watermarks, no borders, no radial effects, no lens flares, no symmetrical centered composition. No backs-to-camera. Figures face forward or in profile.";

// ─── Prompt Assembly ──────────────────────────────────────────────────────────

// Hard ceiling: Runway's promptText limit is 1000 characters.
// We set MAX_CHARS to 980 to give a 20-char safety margin.
// The Arc Modulation Matrix was compressed from ~470 chars to ~120 chars
// (see arcModulationMatrix.ts COMPACT_DIRECTIVES) to fit all layers within budget.
// In worst-case scenarios (long lyrics + mood energy + full vocabulary), the
// truncation guard below will cut the lowest-priority tail (genre, quality tail).
const MAX_CHARS = 980;

/**
 * Pick the top N terms from a vocabulary category, ordered by position
 * (earlier terms are considered higher priority by the vocabulary author).
 */
function pickTerms(terms: VocabularyTerm[], count: number): string[] {
  return terms.slice(0, count).map((t) => t.term);
}

/**
 * Pick the top N terms, preferring the instruction field when it is more
 * concrete than the term (e.g. environment terms where the instruction
 * describes what to actually render). Falls back to term if instruction
 * is missing or identical to the term.
 */
function pickTermsWithFallback(terms: VocabularyTerm[], count: number): string[] {
  return terms.slice(0, count).map((t) => {
    // Use instruction if it's meaningfully different from the term
    if (t.instruction && t.instruction !== t.term && t.instruction.length > t.term.length) {
      return t.term; // Keep the term — instructions are explanatory, not prompt text
    }
    return t.term;
  });
}

/**
 * Pick the top N forbidden terms as direct "no X" negatives.
 * Direct negatives ("no X") work better with image models than "avoid: X".
 * Strip existing "no " prefix from terms to avoid double-negation.
 */
function pickForbiddenTerms(terms: VocabularyTerm[], count = 3): string[] {
  return terms.slice(0, count).map((t) => {
    const term = t.term.trim();
    // If term already starts with "no " keep it as-is; otherwise add "no "
    if (term.toLowerCase().startsWith("no ")) return term;
    return `no ${term}`;
  });
}

/**
 * Assemble the cover art generation prompt from the three input layers.
 *
 * Revised assembly order (lyric-first, image-model-friendly):
 *   1. Lyric anchors FIRST — the most specific, song-unique visual material
 *   2. Environment terms — concrete visual nouns from vocabulary
 *   3. Color and light terms — specific palette from vocabulary
 *   4. Emotional register — translated to visual language via instruction field
 *   5. Arc framing — brief scale/mood modifier (NOT a dominant scene description)
 *   6. Forbidden terms — as "no X" negatives, not "avoid: X" which models ignore
 *   7. Production context (genre — lowest weight, brief)
 *   8. Quality tail
 *
 * Key principle: lyrics come first so the image model anchors on song-specific
 * imagery before any vocabulary. Abstract vocabulary terms use their `instruction`
 * field (which is concrete) rather than their `term` field (which is often
 * philosophical and meaningless to an image model).
 */
export function buildCoverArtPrompt(input: CoverArtPromptInput): CoverArtPromptOutput {
  const { vocabulary, arcPosition, lyricPhrases, steeringNote, genre, moodTags, synthesisFingerprint } = input;
  const weights = ARC_WEIGHTS[arcPosition];

  // ── Layer 1: Lyrics (FIRST — most song-specific, highest priority) ──────────────
  const resolvedLyricPhrases = lyricPhrases?.filter((p) => p.trim().length > 0) ?? [];

  // ── Synthesis anchor (environment fallback when no lyrics and no steering note) ──
  // When the creator has a Frequency, their synthesis fingerprint is the most
  // complete photographable description of their visual world. Use the first
  // ~200 chars as the environment anchor ONLY when there is nothing more specific
  // (no lyrics, no steering note). This prevents the model from falling back to
  // its training-distribution default (mossy rocks, solitary silhouettes).
  const resolvedSynthesisAnchor: string | null =
    !steeringNote?.trim() && resolvedLyricPhrases.length === 0 && synthesisFingerprint
      ? synthesisFingerprint.slice(0, 200).trim()
      : null;

  // ── Layer 1b: Mood energy + human presence (SECOND — sets energy and population) ──
  // Mood tags are translated into concrete visual energy and human presence directives.
  // These go NEAR THE TOP so the model commits to the right energy level before
  // reading vocabulary. Without this, the model defaults to solitary-somber.
  const moodEnergy = moodTags && moodTags.length > 0 ? resolveMoodEnergy(moodTags) : null;

  // ── Layer 2: Environment terms (concrete visual nouns) ───────────────────────
  const environmentTerms = pickTermsWithFallback(vocabulary.environment, weights.environment);

  // ── Layer 3: Color and light (specific palette) ───────────────────────────
  const colorLightTerms = pickTerms(vocabulary.colorLight, weights.colorLight);

  // ── Layer 4: Emotional register (use term — kept as mood descriptors) ──────────
  const emotionalTerms = pickTerms(vocabulary.emotionalRegister, weights.emotionalRegister);

  // ── Layer 5: Arc terms (motion/energy descriptors) ───────────────────────
  const arcTerms = pickTerms(vocabulary.arcTerms, weights.arcTerms);

  // ── Layer 6: Arc framing (brief scale modifier — comes AFTER vocabulary) ─────────
  const arcFraming = ARC_FRAMING[arcPosition];

  // ── Layer 6b: Cinématique rendering directive ───────────────────────────────
  const cinematiqueRendering = CINEMATIQUE_RENDERING[arcPosition];

  // ── Layer 6c: Arc Modulation Matrix ──────────────────────────────────────────
  // Translates the arc position into concrete physics directives across all 8
  // dimensions: light structure, shadow ratio, scale, depth, motion, irregularity,
  // withholding, and biological anchors. This ensures a Gathering image can never
  // accidentally look Open, and an Open image can never feel compressed.
  const arcModulation = buildArcModulationDirectives(arcPosition);

  // ── Layer 6d: Life Signal Randomizer ─────────────────────────────────────────
  // Injects 1–2 controlled micro-irregularities to prevent sterile AI polish.
  // Based on the Emotional Physics Framework Life Signal Registry v1.0.
  const lifeSignalResult = selectLifeSignals(
    arcPosition,
    input.lastUsedLifeSignalIds ?? []
  );

  // ── Layer 7: Forbidden terms (as "no X" — direct negatives work better) ─────────
  const forbiddenTerms = pickForbiddenTerms(vocabulary.forbiddenTerms, 3);

  // ── Layer 1c: Genre-aware human presence fallback ─────────────────────────────
  // When no mood tags are present, derive a basic energy/presence hint from the genre string.
  // This prevents the model from defaulting to solitary-somber when genre implies energy.
  let genreFallbackPresence: string | null = null;
  if (!moodEnergy && genre) {
    const g = genre.toLowerCase();
    if (/upbeat|reggae|psychedelic|vaporwave|rock|punk|hip.?hop|dance|pop|funk|soul|r.?b/.test(g)) {
      genreFallbackPresence = "figures present and engaged, facing forward, energy and life in the scene";
    } else if (/country|folk|bluegrass|americana|roots/.test(g)) {
      genreFallbackPresence = "figure present, grounded and authentic, facing forward or in profile";
    } else if (/jazz|blues|gospel/.test(g)) {
      genreFallbackPresence = "figure present, expressive and present, warm and close";
    }
  }

  // ── Layer 8: Production context (genre only — mood is now handled by moodEnergy) ──
  const productionContext: string | null = genre ?? null;

  // ── Assemble: steering note first, then lyrics, then visual vocabulary ─────────────
  const segments: string[] = [];

  // Layer 0: Creator art direction — HIGHEST PRIORITY, overrides everything
  // A few words from the creator (e.g. "golden hour, empty road") go first so
  // the image model anchors on their intent before reading any generated content.
  const resolvedSteeringNote = steeringNote?.trim() || null;
  if (resolvedSteeringNote) {
    segments.push(resolvedSteeringNote);
  }

  // Layer 1: Lyric anchors — most song-specific material
  if (resolvedLyricPhrases.length > 0) {
    segments.push(resolvedLyricPhrases.join(", "));
  }

  // Layer 1c: Synthesis anchor — environment fallback when no lyrics/steering note
  // This is the creator's visual world in their own words, used as the scene
  // foundation when the song has no lyrics to anchor on.
  if (resolvedSynthesisAnchor) {
    segments.push(resolvedSynthesisAnchor);
  }

  // Layer 1b: Mood energy directive — sets energy level and scene population EARLY
  // This is the fix for the solitary-somber default: the model must commit to
  // the right energy and human presence before reading vocabulary.
  if (moodEnergy) {
    segments.push(moodEnergy.energyDirective);
    segments.push(moodEnergy.humanPresence);
  } else if (genreFallbackPresence) {
    // Genre-aware fallback: when no mood tags, use genre to set basic human presence
    segments.push(genreFallbackPresence);
  }

  // Layer 2-3: Environment and color — concrete visual scene
  if (environmentTerms.length > 0) segments.push(environmentTerms.join(", "));
  if (colorLightTerms.length > 0) segments.push(colorLightTerms.join(", "));

  // Layer 4-5: Emotional and arc — mood and energy
  if (emotionalTerms.length > 0) segments.push(emotionalTerms.join(", "));
  if (arcTerms.length > 0) segments.push(arcTerms.join(", "));

  // Layer 6: Arc framing — brief scale modifier
  segments.push(arcFraming);

  // Layer 6b: Cinématique rendering — how to render (lighting, atmosphere, composition)
  segments.push(cinematiqueRendering);

  // Layer 6c: Arc Modulation Matrix — 8-dimension physics enforcement
  // Injected AFTER Cinématique rendering and BEFORE Life Signals.
  // This is the physics layer that locks the arc into its physical state.
  segments.push(arcModulation.promptDirective);

  // Layer 6d: Life Signal — micro-irregularity injection (Emotional Physics)
  if (lifeSignalResult.promptFragment) {
    segments.push(lifeSignalResult.promptFragment);
  }

  // Layer 7: Forbidden terms
  if (forbiddenTerms.length > 0) segments.push(forbiddenTerms.join(", "));

  // Layer 8: Genre context (lowest weight)
  if (productionContext) segments.push(productionContext);

  segments.push(QUALITY_TAIL);

  let prompt = segments.filter(Boolean).join(". ");

  // Truncation guard
  let wasTruncated = false;
  if (prompt.length > MAX_CHARS) {
    prompt = prompt.slice(0, MAX_CHARS - 3) + "...";
    wasTruncated = true;
  }

  return {
    prompt,
    charCount: prompt.length,
    wasTruncated,
    layers: {
      steeringNote: resolvedSteeringNote,
      arcFraming,
      environmentTerms,
      emotionalTerms,
      arcTerms,
      colorLightTerms,
      lyricPhrases: resolvedLyricPhrases,
      forbiddenTerms,
      productionContext,
      cinematiqueRendering,
      arcModulation: arcModulation.promptDirective,
      arcModulationDimensions: arcModulation.dimensions,
      genreFallbackPresence,
      synthesisAnchor: resolvedSynthesisAnchor,
      lifeSignalBlock: lifeSignalResult.promptFragment || null,
      lifeSignalIds: lifeSignalResult.selectedIds,
    },
  };
}

// ─── Lyrics Pre-Processing ────────────────────────────────────────────────────

/**
 * Extract 2–3 concrete photographic scene descriptors from raw lyrics using the LLM.
 *
 * The goal is NOT to extract verbatim lyric phrases — many lyrics are emotional
 * metaphors ("fire in my veins", "wild heart beats") that image models take
 * literally and render as fantasy imagery. Instead, this function translates
 * the emotional/metaphorical content of the lyrics into concrete, photographable
 * visual scenes that capture the same feeling without triggering fantasy clichés.
 *
 * Returns an array of 2–3 short descriptors (typically 4–8 words each).
 * Returns an empty array if lyrics are empty or the LLM call fails.
 *
 * This function is async and calls the LLM — it should be called once
 * per generation, not per prompt assembly. Cache the result on the song record.
 */
export async function extractLyricPhrases(lyrics: string): Promise<string[]> {
  if (!lyrics || lyrics.trim().length < 10) return [];

  // ── Claude path (primary) ────────────────────────────────────────────────
  // Uses Claude Sonnet 4 via invokeLLM. Falls back to empty array if the
  // API call fails for any reason (avoids Runway content filter issues).
  const { invokeLLM } = await import("../_core/llm");

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = `You are a music-to-visual translator for album cover photography. Your job is to read song lyrics and produce 2–3 short, concrete, photographable scene descriptors that capture the emotional world of the song.

Critical rules:
- DO NOT extract metaphors verbatim. "Fire in my veins" is NOT a visual descriptor — it will generate a fantasy figure with literal fire.
- DO NOT use abstract emotional language. "Wild heart beats" is NOT photographable.
- TRANSLATE the emotion and imagery into real-world, physical scenes a photographer could actually shoot.
- Each descriptor should be 4–8 words: a subject + physical context (e.g. "dusty boots on a dirt road", "leather jacket on a bar stool", "hands gripping a steering wheel at night")
- Think: what physical objects, places, textures, and light conditions embody this song?
- Avoid: glowing orbs, radial bursts, fantasy landscapes, literal fire/lightning, sci-fi elements, circular motifs
- Genre matters: a rock song should feel like a photograph from that world (bar, stage, highway, desert), not a fantasy painting

Examples of GOOD translations:
- Lyrics "fire in my veins / racing through the night" → ["headlights on empty highway at 2am", "hands on steering wheel, dashboard glow", "leather jacket, wind-blown hair"]
- Lyrics "beyond the canyon wall / the river runs free" → ["red rock canyon at golden hour", "river stones and rushing water", "lone figure on canyon rim"]
- Lyrics "a good old horse / steady on the trail" → ["horse and rider on dusty trail", "worn saddle leather in afternoon sun", "hoofprints in dry earth"]

Return ONLY a JSON object with a "phrases" array. No explanation.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Translate these lyrics into 2–3 concrete photographic scene descriptors for an album cover:\n\n${lyrics.slice(0, 2000)}`,
          },
        ],
        maxTokens: 300,
        responseFormat: { type: "json_object" },
      });

      const content = typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : "";
      const parsed = JSON.parse(content) as { phrases: string[] };
      const phrases = (parsed.phrases ?? []).slice(0, 3).filter((p) => p.trim().length > 0);
      console.log(`[coverArtPromptBuilder] Claude lyric extraction succeeded, count=${phrases.length}`);
      return phrases;
    } catch (err) {
      console.warn("[coverArtPromptBuilder] Claude lyric extraction failed, falling back to empty phrases:", err);
    }
  }

  // ── Raw lyrics fallback ───────────────────────────────────────────────────
  // When the LLM is unavailable, return an empty array rather than passing raw
  // lyric text to the image model. Raw lyrics frequently contain words like
  // "fire", "burning", "smoke", "blood", "death" that are perfectly normal in
  // song writing but trigger Runway's content filter and cause immediate FAILED
  // tasks. The vocabulary/frequency data is already safe photographable language
  // and will carry the prompt on its own when lyrics cannot be translated.
  console.log("[coverArtPromptBuilder] Using raw lyrics fallback (no OpenAI key or LLM unavailable) — returning empty phrases to avoid content filter");
  return [];
}

// ─── Vocabulary Resolver ──────────────────────────────────────────────────────

/**
 * Resolve the vocabulary to use for a given user.
 * Returns the creator's default frequency vocabulary if it exists,
 * otherwise returns the platform default vocabulary.
 *
 * This is the entry point for the fallback hierarchy defined in
 * build spec Part 2.6.
 */
export async function resolveVocabulary(userId: number): Promise<{
  vocabulary: VocabularyJson;
  source: "personal" | "platform_default";
  frequencyName?: string;
}> {
  const { getDefaultCreatorFrequency, getPlatformDefaultVocabulary } = await import("../db");

  const frequency = await getDefaultCreatorFrequency(userId);
  if (frequency && frequency.vocabularyJson) {
    return {
      vocabulary: frequency.vocabularyJson as unknown as VocabularyJson,
      source: "personal",
      frequencyName: frequency.frequencyName,
    };
  }

  const platformDefault = await getPlatformDefaultVocabulary();
  if (!platformDefault || !platformDefault.vocabularyJson) {
    throw new Error(
      "[coverArtPromptBuilder] Platform default vocabulary not seeded. Run seedVisualUniverse.ts."
    );
  }

  return {
    vocabulary: platformDefault.vocabularyJson as unknown as VocabularyJson,
    source: "platform_default",
  };
}
