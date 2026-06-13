/**
 * Strawberry Studios — Riff Bridge API
 *
 * Authenticated REST endpoints that Strawberry Riff calls on behalf of its users.
 * Authentication: Clerk Bearer token in Authorization header.
 *
 * Endpoints:
 *   GET  /api/bridge/frequency/default      — get user's default frequency
 *   POST /api/bridge/frequency/synthesize   — run LLM synthesis from 4 diagnostic answers
 *   POST /api/bridge/frequency/save         — save a frequency as user's default
 *   POST /api/bridge/cover-art/generate     — generate cover art for a track
 *   GET  /api/bridge/ping                   — health check
 *
 * User identity: Riff sends a Clerk Bearer token. Studios verifies the token and
 * uses the Clerk userId (clerkUserId) as the user identifier. If the user doesn't
 * exist in Studios yet, a new user is created on first call.
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import {
  getDefaultCreatorFrequency,
  saveCreatorFrequency,
} from "./db";
import { buildCoverArtPrompt, extractLyricPhrases, type VocabularyJson, type VocabularyTerm, type ArcPosition } from "./coverArt/promptBuilder";
import { generateImage } from "./_core/imageGeneration";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { verifyBearerToken } from "./_core/clerk-auth";

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/**
 * Verify Clerk Bearer token from Authorization header.
 * Returns the Clerk userId if valid, null otherwise.
 */
async function verifyBridgeAuth(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return null;
  }

  const clerkUserId = await verifyBearerToken(authHeader);
  if (!clerkUserId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }

  return clerkUserId;
}

// ─── User Resolution ──────────────────────────────────────────────────────────

/**
 * Given a Clerk userId, find or create a Studios user.
 * With Clerk auth, we no longer need shadow users — Clerk userId IS the openId.
 * Returns the Studios user ID.
 */
async function resolveStudiosUserId(clerkUserId: string): Promise<number> {
  console.log(`[Bridge] resolveStudiosUserId: looking up clerkUserId=${clerkUserId}`);
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Try to find existing user
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, clerkUserId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Bridge] resolveStudiosUserId: found existing user, studiosUserId=${existing[0].id}`);
    return existing[0].id;
  }

  // Create user if doesn't exist
  console.log(`[Bridge] resolveStudiosUserId: creating user for clerkUserId=${clerkUserId}`);
  try {
    const result = await db.insert(users).values({
      openId: clerkUserId,
      name: clerkUserId,
      loginMethod: "clerk",
      role: "user",
    });
    // Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] — insertId is at index 0
    const insertedId = (result as any)[0].insertId as number;
    console.log(`[Bridge] resolveStudiosUserId: user created, studiosUserId=${insertedId}`);
    return insertedId;
  } catch (err) {
    console.error(`[Bridge] resolveStudiosUserId: failed to create user:`, err);
    throw err;
  }
}

// ─── Vocabulary Normalizer ───────────────────────────────────────────────────

/** Parse a vocabulary value that may be double-encoded (string inside a JSON column). */
function parseVocabJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function normalizeVocabulary(raw: Record<string, unknown>): VocabularyJson {
  const result: VocabularyJson = {
    environment: [],
    emotionalRegister: [],
    arcTerms: [],
    forbiddenTerms: [],
    colorLight: [],
    relationshipGeometry: [],
  };

  for (const [key, val] of Object.entries(raw)) {
    const normalizedKey = key.replace(/([A-Z])/g, (m) => "_" + m.toLowerCase()).replace(/^_/, "");
    const targetKey = normalizedKey
      .replace(/color_and_light/, "colorLight")
      .replace(/relationship_geometry/, "relationshipGeometry")
      .replace(/emotional_tone/, "emotionalRegister")
      .replace(/temporal_pace/, "arcTerms")
      .replace(/visual_reference/, "environment");

    if (targetKey in result) {
      if (typeof val === "string") {
        (result as any)[targetKey] = [{ term: val, instruction: "" }];
      } else if (Array.isArray(val)) {
        (result as any)[targetKey] = val.map(v =>
          typeof v === "string"
            ? { term: v, instruction: "" }
            : (v as VocabularyTerm)
        );
      }
    }
  }

  return result;
}

// ─── LLM Synthesis Prompt ─────────────────────────────────────────────────────

function buildFrequencySynthesisPrompt(answers: {
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
Respond with valid JSON only, no markdown, no explanation.`;
}

// ─── LLM Response Schema ──────────────────────────────────────────────────────

const FREQUENCY_SYNTHESIS_SCHEMA = {
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
        environment: { type: "array", items: { type: "object", properties: { term: { type: "string" }, instruction: { type: "string" } }, required: ["term", "instruction"], additionalProperties: false } },
        emotionalRegister: { type: "array", items: { type: "object", properties: { term: { type: "string" }, instruction: { type: "string" } }, required: ["term", "instruction"], additionalProperties: false } },
        arcTerms: { type: "array", items: { type: "object", properties: { term: { type: "string" }, instruction: { type: "string" } }, required: ["term", "instruction"], additionalProperties: false } },
        forbiddenTerms: { type: "array", items: { type: "object", properties: { term: { type: "string" }, instruction: { type: "string" } }, required: ["term", "instruction"], additionalProperties: false } },
        relationshipGeometry: { type: "array", items: { type: "object", properties: { term: { type: "string" }, instruction: { type: "string" } }, required: ["term", "instruction"], additionalProperties: false } },
        colorLight: { type: "array", items: { type: "object", properties: { term: { type: "string" }, instruction: { type: "string" } }, required: ["term", "instruction"], additionalProperties: false } },
      },
      required: ["environment", "emotionalRegister", "arcTerms", "forbiddenTerms", "relationshipGeometry", "colorLight"],
      additionalProperties: false,
    },
  },
  required: ["reflection", "suggestedName", "arcType", "vocabulary"],
  additionalProperties: false,
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GenerateCoverArtSchema = z.object({
  lyrics: z.string(),
  steeringNote: z.string().optional(),
});

// ─── Bridge Routes ────────────────────────────────────────────────────────────

export function registerBridgeRoutes(app: Express): void {

  // ─── Frequency — Get Default ───────────────────────────────────────────────
  /**
   * GET /api/bridge/frequency/default
   * Returns the user's default frequency or { hasFrequency: false } if none.
   */
  app.get("/api/bridge/frequency/default", async (req, res) => {
    const clerkUserId = await verifyBridgeAuth(req, res);
    if (!clerkUserId) return;
    try {
      const studiosUserId = await resolveStudiosUserId(clerkUserId);
      const frequency = await getDefaultCreatorFrequency(studiosUserId);
      if (!frequency) {
        res.json({ hasFrequency: false, frequency: null });
        return;
      }
      const vocab = parseVocabJson(frequency.vocabularyJson);
      res.json({
        hasFrequency: true,
        frequency: {
          id: frequency.id,
          frequencyName: frequency.frequencyName,
          arcType: frequency.arcType,
          vocabulary: vocab,
          synthesisFingerprint: frequency.synthesisFingerprint,
          createdAt: frequency.createdAt,
        },
      });
    } catch (err) {
      console.error("[Bridge] frequency/default error:", err);
      res.status(500).json({ error: "Failed to fetch frequency" });
    }
  });

  // ─── Frequency — Synthesize ────────────────────────────────────────────────
  /**
   * POST /api/bridge/frequency/synthesize
   * Body: { q1, q2, q3, q4 } — four diagnostic answers
   * Returns: { reflection, suggestedName, arcType, vocabulary, diagnosticAnswers }
   */
  app.post("/api/bridge/frequency/synthesize", async (req, res) => {
    const clerkUserId = await verifyBridgeAuth(req, res);
    if (!clerkUserId) return;
    try {
      const parsed = z.object({
        q1: z.string().min(1).max(5000),
        q2: z.string().min(1).max(5000),
        q3: z.string().min(1).max(5000),
        q4: z.string().min(1).max(5000),
      }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { q1, q2, q3, q4 } = parsed.data;
      const synthesisPrompt = buildFrequencySynthesisPrompt({ q1, q2, q3, q4 });
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a visual identity synthesizer. You listen carefully to how creators talk about their music and translate that into precise visual vocabulary. You never use evaluative language. You always respond with valid JSON only.",
          },
          { role: "user", content: synthesisPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "frequency_synthesis",
            strict: true,
            schema: FREQUENCY_SYNTHESIS_SCHEMA,
          },
        },
      });
      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("LLM returned no content");
      }
      const result = JSON.parse(content) as {
        reflection: string;
        suggestedName: string;
        arcType: string;
        vocabulary: VocabularyJson;
      };
      res.json({
        reflection: result.reflection,
        suggestedName: result.suggestedName,
        arcType: result.arcType,
        vocabulary: result.vocabulary,
        diagnosticAnswers: { q1, q2, q3, q4 },
      });
    } catch (err) {
      console.error("[Bridge] frequency/synthesize error:", err);
      res.status(500).json({ error: "Synthesis failed" });
    }
  });

  // ─── Frequency — Save ─────────────────────────────────────────────────────
  /**
   * POST /api/bridge/frequency/save
   * Body: { frequencyName, arcType, vocabulary, synthesisFingerprint?, diagnosticAnswers? }
   * Returns: { ok: true, frequencyId }
   */
  app.post("/api/bridge/frequency/save", async (req, res) => {
    const clerkUserId = await verifyBridgeAuth(req, res);
    if (!clerkUserId) return;
    try {
      const parsed = z.object({
        frequencyName: z.string().min(1).max(100),
        arcType: z.enum([
          "expansive_mythic",
          "witnessing_lateral",
          "intimate_relational",
          "sustained_ambient",
          "erosive_revelatory",
          "cyclical_return",
        ]),
        vocabulary: z.record(z.string(), z.unknown()),
        synthesisFingerprint: z.string().optional(),
        diagnosticAnswers: z.object({
          q1: z.string(),
          q2: z.string(),
          q3: z.string(),
          q4: z.string(),
        }).optional(),
      }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const studiosUserId = await resolveStudiosUserId(clerkUserId);
      const frequencyId = await saveCreatorFrequency({
        userId: studiosUserId,
        frequencyName: parsed.data.frequencyName,
        arcType: parsed.data.arcType,
        vocabularyJson: parsed.data.vocabulary,
        synthesisFingerprint: parsed.data.synthesisFingerprint ?? null,
        diagnosticAnswersJson: parsed.data.diagnosticAnswers ?? null,
        isDefault: true,
      });
      res.json({ ok: true, frequencyId });
    } catch (err) {
      console.error("[Bridge] frequency/save error:", err);
      res.status(500).json({ error: "Failed to save frequency" });
    }
  });

  // ─── Health Check ──────────────────────────────────────────────────────────
  app.get("/api/bridge/ping", async (req, res) => {
    const clerkUserId = await verifyBridgeAuth(req, res);
    if (!clerkUserId) return;
    res.json({ ok: true, service: "strawberry-studios-bridge", ts: Date.now() });
  });

  // ── POST /api/bridge/cover-art/generate ───────────────────────────────────
  app.post("/api/bridge/cover-art/generate", async (req, res) => {
    const clerkUserId = await verifyBridgeAuth(req, res);
    if (!clerkUserId) return;

    try {
      const parsed = GenerateCoverArtSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { lyrics, steeringNote } = parsed.data;

      console.log(`[generateCoverArt] Starting bridge call with lyrics length: ${lyrics.length}`);

      const studiosUserId = await resolveStudiosUserId(clerkUserId);
      const frequency = await getDefaultCreatorFrequency(studiosUserId);

      if (!frequency) {
        res.status(400).json({ error: "User has no frequency configured" });
        return;
      }

      const vocab = parseVocabJson(frequency.vocabularyJson);
      if (!vocab) {
        res.status(400).json({ error: "Invalid vocabulary configuration" });
        return;
      }

      const normalizedVocab = normalizeVocabulary(vocab);

      const lyricPhrases = await extractLyricPhrases(lyrics);
      console.log(`[generateCoverArt] Extracted ${lyricPhrases.length} lyric phrases`);

      // Map arcType to arcPosition for the prompt builder
      const arcTypeToPosition: Record<string, ArcPosition> = {
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
        arcPosition,
        lyricPhrases,
        synthesisFingerprint: frequency.synthesisFingerprint,
        steeringNote: steeringNote ?? undefined,
      });

      const prompt = promptOutput.prompt;
      console.log(`[generateCoverArt] Built prompt, length: ${prompt.length}`);

      const { url: imageUrl } = await generateImage({ prompt });

      console.log(`[generateCoverArt] Image generated: ${imageUrl}`);

      // Riff handles storage of the cover art URL on their side
      // Studios just returns the generated image URL
      res.json({ imageUrl });
    } catch (err) {
      console.error("[generateCoverArt] Exception:", err);
      res.status(500).json({ error: "Cover art generation failed" });
    }
  });
}
