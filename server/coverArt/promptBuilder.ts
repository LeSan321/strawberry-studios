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
// Each framing sentence sets the scale and temperature for the generation.
// These are the "opening instruction" to the image model — they establish
// what kind of visual space we are working in before any vocabulary is applied.

const ARC_FRAMING: Record<ArcPosition, string> = {
  gathering:
    "Intimate scale, compression present, the opening implied in small precise details — warmth held close, the larger world visible only as implication.",
  arriving:
    "Threshold scale, the break beginning — the opening becoming visible, scale expanding outward, the frontier present at the edge of frame.",
  open:
    "Vast scale, the frontier dominant — figure small against landscape, full expression, the opening arrived and held.",
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
  "Square 1:1 composition. Photographic quality. No text, no watermarks, no borders.";

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
 * Pick the top N forbidden terms. Forbidden terms are prefixed with
 * "avoid:" to make them explicit negative instructions.
 */
function pickForbiddenTerms(terms: VocabularyTerm[], count = 3): string[] {
  return terms.slice(0, count).map((t) => `avoid: ${t.term}`);
}

/**
 * Assemble the cover art generation prompt from the three input layers.
 *
 * Assembly order (per build spec Part 2.3):
 *   1. Arc position framing sentence
 *   2. Environment terms
 *   3. Emotional register terms
 *   4. Arc terms
 *   5. Color and light terms
 *   6. Lyrics distillation
 *   7. Forbidden terms
 *   8. Production context (genre/mood — lowest weight)
 *   9. Quality tail
 */
export function buildCoverArtPrompt(input: CoverArtPromptInput): CoverArtPromptOutput {
  const { vocabulary, arcPosition, lyricPhrases, genre, moodTags } = input;
  const weights = ARC_WEIGHTS[arcPosition];

  // ── Layer 1: Arc framing ──────────────────────────────────────────────────
  const arcFraming = ARC_FRAMING[arcPosition];

  // ── Layer 2–5: Vocabulary terms ───────────────────────────────────────────
  const environmentTerms = pickTerms(vocabulary.environment, weights.environment);
  const emotionalTerms = pickTerms(vocabulary.emotionalRegister, weights.emotionalRegister);
  const arcTerms = pickTerms(vocabulary.arcTerms, weights.arcTerms);
  const colorLightTerms = pickTerms(vocabulary.colorLight, weights.colorLight);

  // ── Layer 6: Lyrics distillation ─────────────────────────────────────────
  const resolvedLyricPhrases = lyricPhrases?.filter((p) => p.trim().length > 0) ?? [];

  // ── Layer 7: Forbidden terms ──────────────────────────────────────────────
  const forbiddenTerms = pickForbiddenTerms(vocabulary.forbiddenTerms, 3);

  // ── Layer 8: Production context (genre/mood) ──────────────────────────────
  let productionContext: string | null = null;
  if (genre || (moodTags && moodTags.length > 0)) {
    const parts: string[] = [];
    if (genre) parts.push(`genre context: ${genre}`);
    if (moodTags && moodTags.length > 0) parts.push(`mood: ${moodTags.slice(0, 2).join(", ")}`);
    productionContext = parts.join("; ");
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  const segments: string[] = [
    arcFraming,
    environmentTerms.join(", "),
    emotionalTerms.join(", "),
    arcTerms.join(", "),
    colorLightTerms.join(", "),
  ];

  if (resolvedLyricPhrases.length > 0) {
    segments.push(`lyric anchors: ${resolvedLyricPhrases.join(" / ")}`);
  }

  segments.push(forbiddenTerms.join(", "));

  if (productionContext) {
    segments.push(productionContext);
  }

  segments.push(QUALITY_TAIL);

  let prompt = segments.filter(Boolean).join(". ");

  // ── Truncation guard ──────────────────────────────────────────────────────
  let wasTruncated = false;
  if (prompt.length > MAX_CHARS) {
    // Trim from the production context section backward — never truncate
    // the arc framing, vocabulary, or quality tail.
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
