/**
 * Cover Art Prompt Builder
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
  /** Optional genre tag for production context (lowest weight) */
  genre?: string | null;
  /** Optional mood tags for production context (lowest weight) */
  moodTags?: string[] | null;
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
    arcFraming: string;
    environmentTerms: string[];
    emotionalTerms: string[];
    arcTerms: string[];
    colorLightTerms: string[];
    lyricPhrases: string[];
    forbiddenTerms: string[];
    productionContext: string | null;
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

// ─── Quality Tail ─────────────────────────────────────────────────────────────
// Standard image quality and composition instructions appended to every prompt.
// Kept short to preserve character budget for vocabulary and lyrics.

const QUALITY_TAIL =
  "Square 1:1 composition. Cinematic photography. No text, no logos, no watermarks, no borders, no radial effects, no lens flares.";

// ─── Prompt Assembly ──────────────────────────────────────────────────────────

const MAX_CHARS = 900;

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
  const { vocabulary, arcPosition, lyricPhrases, genre, moodTags } = input;
  const weights = ARC_WEIGHTS[arcPosition];

  // ── Layer 1: Lyrics (FIRST — most song-specific, highest priority) ──────────────
  const resolvedLyricPhrases = lyricPhrases?.filter((p) => p.trim().length > 0) ?? [];

  // ── Layer 2: Environment terms (concrete visual nouns) ───────────────────────────
  // Use instruction field when available — it's more concrete than the term
  const environmentTerms = pickTermsWithFallback(vocabulary.environment, weights.environment);

  // ── Layer 3: Color and light (specific palette) ─────────────────────────────────
  const colorLightTerms = pickTerms(vocabulary.colorLight, weights.colorLight);

  // ── Layer 4: Emotional register (use term — kept as mood descriptors) ────────────
  const emotionalTerms = pickTerms(vocabulary.emotionalRegister, weights.emotionalRegister);

  // ── Layer 5: Arc terms (motion/energy descriptors) ─────────────────────────────
  const arcTerms = pickTerms(vocabulary.arcTerms, weights.arcTerms);

  // ── Layer 6: Arc framing (brief scale modifier — comes AFTER vocabulary) ─────────
  const arcFraming = ARC_FRAMING[arcPosition];

  // ── Layer 7: Forbidden terms (as "no X" — direct negatives work better) ─────────
  const forbiddenTerms = pickForbiddenTerms(vocabulary.forbiddenTerms, 3);

  // ── Layer 8: Production context (genre/mood — lowest weight, brief) ────────────
  let productionContext: string | null = null;
  if (genre || (moodTags && moodTags.length > 0)) {
    const parts: string[] = [];
    if (genre) parts.push(genre);
    if (moodTags && moodTags.length > 0) parts.push(moodTags.slice(0, 2).join(", "));
    productionContext = parts.join(", ");
  }

  // ── Assemble: lyrics first, then visual vocabulary, then modifiers ────────────────
  const segments: string[] = [];

  // Lyric anchors lead — most song-specific material
  if (resolvedLyricPhrases.length > 0) {
    segments.push(resolvedLyricPhrases.join(", "));
  }

  // Environment and color — concrete visual scene
  if (environmentTerms.length > 0) segments.push(environmentTerms.join(", "));
  if (colorLightTerms.length > 0) segments.push(colorLightTerms.join(", "));

  // Emotional and arc — mood and energy
  if (emotionalTerms.length > 0) segments.push(emotionalTerms.join(", "));
  if (arcTerms.length > 0) segments.push(arcTerms.join(", "));

  // Arc framing — brief scale modifier
  segments.push(arcFraming);

  // Forbidden terms
  if (forbiddenTerms.length > 0) segments.push(forbiddenTerms.join(", "));

  // Genre context (lowest weight)
  if (productionContext) segments.push(productionContext);

  segments.push(QUALITY_TAIL);

  let prompt = segments.filter(Boolean).join(". ");

  // ── Truncation guard ──────────────────────────────────────────────────────────────────────
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
      arcFraming,
      environmentTerms,
      emotionalTerms,
      arcTerms,
      colorLightTerms,
      lyricPhrases: resolvedLyricPhrases,
      forbiddenTerms,
      productionContext,
    },
  };
}

// ─── Lyrics Pre-Processing ────────────────────────────────────────────────────

/**
 * Extract 2–3 load-bearing phrases from raw lyrics using the LLM.
 *
 * The extraction follows the Listening Bible Chapter 1 principle:
 * read for vocabulary, not content. The goal is to find the specific
 * words and images the creator actually used — not a summary or paraphrase.
 *
 * Returns an array of 2–3 short phrases (typically 3–8 words each).
 * Returns an empty array if lyrics are empty or the LLM call fails.
 *
 * This function is async and calls the LLM — it should be called once
 * per generation, not per prompt assembly. Cache the result on the song record.
 */
export async function extractLyricPhrases(lyrics: string): Promise<string[]> {
  if (!lyrics || lyrics.trim().length < 10) return [];

  try {
    const { invokeLLM } = await import("../_core/llm");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a visual vocabulary extractor. Your job is to read song lyrics and identify 2–3 load-bearing phrases — the specific words and images the creator actually used that carry the most visual weight.

Rules:
- Extract phrases verbatim from the lyrics — do not paraphrase, summarize, or interpret
- Choose phrases that are concrete and visual (not abstract concepts)
- Each phrase should be 3–8 words maximum
- Return ONLY a JSON array of strings, nothing else
- Example output: ["the window left open all night", "rain on the fire escape", "your coat still on the chair"]
- If the lyrics contain no visually concrete phrases, return an empty array: []`,
        },
        {
          role: "user",
          content: `Extract 2–3 load-bearing visual phrases from these lyrics:\n\n${lyrics.slice(0, 2000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lyric_phrases",
          strict: true,
          schema: {
            type: "object",
            properties: {
              phrases: {
                type: "array",
                items: { type: "string" },
                description: "2–3 verbatim visual phrases from the lyrics",
              },
            },
            required: ["phrases"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) return [];
    // content can be string or array of content parts; we only need the text
    const content = typeof rawContent === "string" ? rawContent : "";
    if (!content) return [];

    const parsed = JSON.parse(content) as { phrases: string[] };
    return (parsed.phrases ?? []).slice(0, 3).filter((p) => p.trim().length > 0);
  } catch (err) {
    console.warn("[coverArtPromptBuilder] Lyric extraction failed:", err);
    return [];
  }
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
