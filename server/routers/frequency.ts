/**
 * frequency router — Phase O
 *
 * Procedures:
 *   frequency.synthesize   — LLM: takes 4 diagnostic answers, returns reflection + vocabulary + suggested name
 *   frequency.save         — Persist a CreatorFrequency record, set as default
 *   frequency.getDefault   — Return the current default frequency for the authenticated user
 *   frequency.list         — Return all frequencies for the authenticated user
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  saveCreatorFrequency,
  getDefaultCreatorFrequency,
  listCreatorFrequencies,
} from "../db";
import { generateImage } from "../_core/imageGeneration";
import { buildCoverArtPrompt, extractLyricPhrases } from "../coverArt/promptBuilder";
import type { CreatorFrequency } from "../../drizzle/schema";

// ─── Vocabulary term schema ───────────────────────────────────────────────────

const VocabTermSchema = z.object({
  term: z.string(),
  instruction: z.string(),
});

const VocabularyJsonSchema = z.object({
  environment: z.array(VocabTermSchema),
  emotionalRegister: z.array(VocabTermSchema),
  arcTerms: z.array(VocabTermSchema),
  forbiddenTerms: z.array(VocabTermSchema),
  relationshipGeometry: z.array(VocabTermSchema),
  colorLight: z.array(VocabTermSchema),
});

// ─── Arc type enum ────────────────────────────────────────────────────────────

const ARC_TYPES = [
  "expansive_mythic",
  "witnessing_lateral",
  "intimate_relational",
  "sustained_ambient",
  "erosive_revelatory",
  "cyclical_return",
] as const;

// ─── LLM synthesis prompt ─────────────────────────────────────────────────────

function buildSynthesisPrompt(answers: {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}): string {
  return `You are a visual identity synthesizer for a music platform. A creator has answered four diagnostic questions about their music. Your task is to:

1. Write a 3–5 sentence reflection using the creator's own load-bearing words verbatim. No evaluative language ("beautiful", "powerful", "amazing"). Close with: "Does that feel true — or is something off?"

2. Generate a structured visual vocabulary with exactly these six categories. Each category should have 3–5 terms. Each term has a "term" (short phrase) and an "instruction" (one sentence of visual direction).

3. Suggest a frequency name (2–3 words, evocative, not generic — derived from the vocabulary itself, not a genre label).

4. Identify the arc type that best matches the creator's world from these options:
   - expansive_mythic: vast scale, mythic time, the world as larger than the individual
   - witnessing_lateral: observational, present-tense, the world at eye level
   - intimate_relational: close, personal, the space between two people
   - sustained_ambient: continuous, atmospheric, world as texture not event
   - erosive_revelatory: something being worn away to reveal what's underneath
   - cyclical_return: return, repetition, the familiar made strange or earned

The four diagnostic answers:

Q1 — A piece of music that felt like it already knew something about you:
${answers.q1}

Q2 — Where a listener starts and where they are when your music ends (what changes inside them):
${answers.q2}

Q3 — A feeling your music is specifically NOT — something you're making space against:
${answers.q3}

Q4 — If your music were a single place and time of day:
${answers.q4}

Respond with valid JSON only, no markdown, no explanation. Use this exact structure:
{
  "reflection": "string",
  "suggestedName": "string",
  "arcType": "one of the six arc types",
  "vocabulary": {
    "environment": [{"term": "string", "instruction": "string"}],
    "emotionalRegister": [{"term": "string", "instruction": "string"}],
    "arcTerms": [{"term": "string", "instruction": "string"}],
    "forbiddenTerms": [{"term": "string", "instruction": "string"}],
    "relationshipGeometry": [{"term": "string", "instruction": "string"}],
    "colorLight": [{"term": "string", "instruction": "string"}]
  }
}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const frequencyRouter = router({
  /**
   * synthesize — Takes the 4 diagnostic answers, calls the LLM, returns:
   *   - reflection (3–5 sentences, creator's own words, ends with "Does that feel true?")
   *   - vocabulary (6-category structured object)
   *   - suggestedName (2–3 word evocative name)
   *   - arcType (one of the 6 arc types)
   *
   * This procedure does NOT save anything — it returns the synthesis for the
   * creator to review on the vocabulary preview screen before saving.
   */
  synthesize: protectedProcedure
    .input(
      z.object({
        q1: z.string().min(10).max(5000),
        q2: z.string().min(10).max(5000),
        q3: z.string().min(10).max(5000),
        q4: z.string().min(10).max(5000),
      })
    )
    .mutation(async ({ input }) => {
      const prompt = buildSynthesisPrompt(input);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a visual identity synthesizer. You listen carefully to how creators talk about their music and translate that into precise visual vocabulary. You never use evaluative language. You always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "frequency_synthesis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reflection: { type: "string" },
                suggestedName: { type: "string" },
                arcType: {
                  type: "string",
                  enum: [
                    "expansive_mythic",
                    "witnessing_lateral",
                    "intimate_relational",
                    "sustained_ambient",
                    "erosive_revelatory",
                    "cyclical_return",
                  ],
                },
                vocabulary: {
                  type: "object",
                  properties: {
                    environment: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string" },
                          instruction: { type: "string" },
                        },
                        required: ["term", "instruction"],
                        additionalProperties: false,
                      },
                    },
                    emotionalRegister: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string" },
                          instruction: { type: "string" },
                        },
                        required: ["term", "instruction"],
                        additionalProperties: false,
                      },
                    },
                    arcTerms: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string" },
                          instruction: { type: "string" },
                        },
                        required: ["term", "instruction"],
                        additionalProperties: false,
                      },
                    },
                    forbiddenTerms: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string" },
                          instruction: { type: "string" },
                        },
                        required: ["term", "instruction"],
                        additionalProperties: false,
                      },
                    },
                    relationshipGeometry: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string" },
                          instruction: { type: "string" },
                        },
                        required: ["term", "instruction"],
                        additionalProperties: false,
                      },
                    },
                    colorLight: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string" },
                          instruction: { type: "string" },
                        },
                        required: ["term", "instruction"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: [
                    "environment",
                    "emotionalRegister",
                    "arcTerms",
                    "forbiddenTerms",
                    "relationshipGeometry",
                    "colorLight",
                  ],
                  additionalProperties: false,
                },
              },
              required: ["reflection", "suggestedName", "arcType", "vocabulary"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("LLM returned no content");
      }

      // Strip markdown code fences in case Claude wraps the response despite instructions
      const cleanContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleanContent) as {
        reflection: string;
        suggestedName: string;
        arcType: string;
        vocabulary: unknown;
      };

      // Validate vocabulary structure
      const vocabResult = VocabularyJsonSchema.safeParse(parsed.vocabulary);
      if (!vocabResult.success) {
        throw new Error("LLM returned invalid vocabulary structure");
      }

      // Validate arc type
      const arcType = ARC_TYPES.includes(parsed.arcType as (typeof ARC_TYPES)[number])
        ? (parsed.arcType as (typeof ARC_TYPES)[number])
        : "expansive_mythic";

      return {
        reflection: parsed.reflection,
        suggestedName: parsed.suggestedName,
        arcType,
        vocabulary: vocabResult.data,
        diagnosticAnswers: {
          q1: input.q1,
          q2: input.q2,
          q3: input.q3,
          q4: input.q4,
        },
      };
    }),

  /**
   * save — Persists the synthesized frequency as the creator's default.
   * Clears any existing default for this user first.
   */
  save: protectedProcedure
    .input(
      z.object({
        frequencyName: z.string().min(1).max(100),
        arcType: z.enum(ARC_TYPES),
        vocabulary: VocabularyJsonSchema,
        synthesisFingerprint: z.string().optional(),
        diagnosticAnswers: z
          .object({
            q1: z.string(),
            q2: z.string(),
            q3: z.string(),
            q4: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await saveCreatorFrequency({
        userId: ctx.user.id,
        frequencyName: input.frequencyName,
        arcType: input.arcType,
        vocabularyJson: input.vocabulary,
        synthesisFingerprint: input.synthesisFingerprint ?? null,
        diagnosticAnswersJson: input.diagnosticAnswers ?? null,
        isDefault: true,
      });

      return { id, frequencyName: input.frequencyName };
    }),

  /**
   * getDefault — Returns the current default frequency for the authenticated user.
   * Returns null if no frequency has been saved.
   */
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const frequency = await getDefaultCreatorFrequency(ctx.user.id);
    if (!frequency) return null;

    return {
      id: frequency.id,
      frequencyName: frequency.frequencyName,
      arcType: frequency.arcType,
      vocabulary: frequency.vocabularyJson as ReturnType<typeof VocabularyJsonSchema.parse>,
      synthesisFingerprint: frequency.synthesisFingerprint,
      createdAt: frequency.createdAt,
    };
  }),

  /**
   * list — Returns all frequencies for the authenticated user, ordered by creation date.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const frequencies = await listCreatorFrequencies(ctx.user.id);
    return frequencies.map((f: CreatorFrequency) => ({
      id: f.id,
      frequencyName: f.frequencyName,
      arcType: f.arcType,
      isDefault: f.isDefault,
      synthesisFingerprint: f.synthesisFingerprint,
      createdAt: f.createdAt,
    }));
  }),

  /**
   * generateCoverArt — Generate cover art for a track using the creator's frequency.
   * Called by Riff via tRPC with Clerk Bearer token.
   * Returns { imageUrl }
   */
  generateCoverArt: protectedProcedure
    .input(z.object({
      lyrics: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const { lyrics } = input;

      console.log(`[generateCoverArt] Starting for user ${ctx.user.id}, lyrics length: ${lyrics.length}`);

      const frequency = await getDefaultCreatorFrequency(ctx.user.id);
      if (!frequency) {
        throw new Error("User has no frequency configured");
      }

      const vocab = typeof frequency.vocabularyJson === "string"
        ? JSON.parse(frequency.vocabularyJson)
        : frequency.vocabularyJson;

      if (!vocab) {
        throw new Error("Invalid vocabulary configuration");
      }

      // Normalize vocabulary
      const normalizedVocab = {
        environment: vocab.environment || [],
        emotionalRegister: vocab.emotionalRegister || [],
        arcTerms: vocab.arcTerms || [],
        forbiddenTerms: vocab.forbiddenTerms || [],
        relationshipGeometry: vocab.relationshipGeometry || [],
        colorLight: vocab.colorLight || [],
      };

      const lyricPhrases = await extractLyricPhrases(lyrics);
      console.log(`[generateCoverArt] Extracted ${lyricPhrases.length} lyric phrases`);

      const arcTypeToPosition: Record<string, string> = {
        expansive_mythic: "gathering",
        witnessing_lateral: "arriving",
        intimate_relational: "open",
        sustained_ambient: "gathering",
        erosive_revelatory: "arriving",
        cyclical_return: "open",
      };
      const arcPosition = arcTypeToPosition[frequency.arcType] ?? "open";

      const promptOutput = buildCoverArtPrompt({
        vocabulary: normalizedVocab,
        arcPosition: arcPosition as any,
        lyricPhrases,
        synthesisFingerprint: frequency.synthesisFingerprint || "",
      });

      const prompt = promptOutput.prompt;
      console.log(`[generateCoverArt] Built prompt, length: ${prompt.length}`);

      const { url: imageUrl } = await generateImage({ prompt });
      console.log(`[generateCoverArt] Image generated: ${imageUrl}`);

      return { imageUrl };
    }),
});
