/**
 * Strawberry Studios — Riff Bridge API
 *
 * Authenticated REST endpoints that Strawberry Riff calls on behalf of its users.
 * Authentication: shared secret via `x-bridge-key` header.
 *
 * Endpoints:
 *   GET  /api/bridge/frequency/:riffUserId        — fetch user's default frequency
 *   POST /api/bridge/frequency/synthesize         — run LLM synthesis from diagnostic answers
 *   POST /api/bridge/frequency/save               — save a frequency record
 *   POST /api/bridge/cover-art/generate           — generate cover art for a track
 *   GET  /api/bridge/cover-art/:riffTrackId       — get cover art state for a track
 *
 * User identity: Riff passes its own integer userId. Studios maps this to a Studios user
 * via the `riffUserId` field on the Studios users table (added in this phase).
 * If no mapping exists, Studios creates a shadow user record on first call.
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import {
  getDefaultCreatorFrequency,
  saveCreatorFrequency,
  getPlatformDefaultVocabulary,
  getCampaignCoverArt,
} from "./db";
import { buildCoverArtPrompt, extractLyricPhrases, type VocabularyJson } from "./coverArt/promptBuilder";
import { generateImage } from "./_core/imageGeneration";
import { setCampaignCoverArtFromGeneration } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function requireBridgeKey(req: Request, res: Response): boolean {
  const key = req.headers["x-bridge-key"];
  const expected = process.env.BRIDGE_API_KEY;
  if (!expected) {
    res.status(503).json({ error: "Bridge not configured" });
    return false;
  }
  if (!key || key !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─── Shadow User Resolution ───────────────────────────────────────────────────

/**
 * Given a Riff userId, find or create a Studios shadow user.
 * Shadow users have role='user' and a riffUserId column for the mapping.
 * Returns the Studios userId.
 */
async function resolveStudiosUserId(riffUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Try to find existing mapping
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.riffUserId, riffUserId))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Create shadow user
  const result = await db.insert(users).values({
    openId: `riff:${riffUserId}`,
    name: `Riff User ${riffUserId}`,
    role: "user",
    riffUserId,
  });
  return (result as any).insertId as number;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const DiagnosticAnswersSchema = z.object({
  q1_sound_space: z.string().min(1),
  q2_light_color: z.string().min(1),
  q3_world_texture: z.string().min(1),
  q4_arc_time: z.string().min(1),
});

const SynthesizeSchema = z.object({
  riffUserId: z.number().int().positive(),
  answers: DiagnosticAnswersSchema,
});

const SaveFrequencySchema = z.object({
  riffUserId: z.number().int().positive(),
  frequencyName: z.string().min(1).max(100),
  arcType: z.enum([
    "expansive_mythic",
    "witnessing_lateral",
    "intimate_relational",
    "sustained_ambient",
    "erosive_revelatory",
    "cyclical_return",
  ]),
  vocabularyJson: z.string(),
  synthesisFingerprint: z.string(),
  diagnosticAnswersJson: z.string(),
});

const GenerateCoverArtSchema = z.object({
  riffUserId: z.number().int().positive(),
  riffTrackId: z.number().int().positive(),
  lyrics: z.string().optional(),
  genre: z.string().optional(),
  arcPosition: z.enum(["gathering", "arriving", "open"]).optional(),
  isRegeneration: z.boolean().optional(),
});

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerBridgeRoutes(app: Express): void {
  // ── GET /api/bridge/frequency/:riffUserId ──────────────────────────────────
  app.get("/api/bridge/frequency/:riffUserId", async (req, res) => {
    if (!requireBridgeKey(req, res)) return;
    try {
      const riffUserId = parseInt(req.params.riffUserId, 10);
      if (isNaN(riffUserId)) {
        res.status(400).json({ error: "Invalid riffUserId" });
        return;
      }
      const studiosUserId = await resolveStudiosUserId(riffUserId);
      const frequency = await getDefaultCreatorFrequency(studiosUserId);
      if (!frequency) {
        res.json({ frequency: null, hasFrequency: false });
        return;
      }
      res.json({
        hasFrequency: true,
        frequency: {
          id: frequency.id,
          frequencyName: frequency.frequencyName,
          arcType: frequency.arcType,
          synthesisFingerprint: frequency.synthesisFingerprint,
          vocabularyJson: frequency.vocabularyJson,
          createdAt: frequency.createdAt,
        },
      });
    } catch (err) {
      console.error("[Bridge] GET frequency error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/bridge/frequency/synthesize ─────────────────────────────────
  app.post("/api/bridge/frequency/synthesize", async (req, res) => {
    if (!requireBridgeKey(req, res)) return;
    try {
      const parsed = SynthesizeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { answers } = parsed.data;

      const systemPrompt = `You are the Strawberry Studios Visual Universe synthesizer. 
Your role is to translate a creator's four diagnostic answers into a precise visual vocabulary 
that will guide AI image generation for their music cover art.

Return a JSON object with exactly this structure:
{
  "reflection": "A 2-3 sentence paragraph in second person (\"you\") that mirrors the creator's answers back to them as a visual identity statement. Warm, specific, not generic.",
  "frequencyName": "A 2-4 word poetic name for this visual universe (e.g. 'Amber Drift', 'Midnight Bloom', 'Static Cathedral')",
  "arcType": "One of: gathering | arriving | open",
  "vocabulary": {
    "emotionalRegister": ["3-5 precise emotional tone words"],
    "colorAndLight": ["3-5 specific color/light descriptors"],
    "environment": ["3-5 environment/space descriptors"],
    "texture": ["3-5 texture/material descriptors"],
    "arcTerms": ["3-5 movement/time/energy words"],
    "forbiddenTerms": ["2-4 terms that would misrepresent this creator's aesthetic"]
  }
}`;

      const userPrompt = `Creator's diagnostic answers:
1. Sound/Space: "${answers.q1_sound_space}"
2. Light/Color: "${answers.q2_light_color}"
3. World/Texture: "${answers.q3_world_texture}"
4. Arc/Time: "${answers.q4_arc_time}"

Synthesize their Visual Universe.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "visual_universe",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reflection: { type: "string" },
                frequencyName: { type: "string" },
                arcType: { type: "string", enum: ["gathering", "arriving", "open"] },
                vocabulary: {
                  type: "object",
                  properties: {
                    emotionalRegister: { type: "array", items: { type: "string" } },
                    colorAndLight: { type: "array", items: { type: "string" } },
                    environment: { type: "array", items: { type: "string" } },
                    texture: { type: "array", items: { type: "string" } },
                    arcTerms: { type: "array", items: { type: "string" } },
                    forbiddenTerms: { type: "array", items: { type: "string" } },
                  },
                  required: ["emotionalRegister", "colorAndLight", "environment", "texture", "arcTerms", "forbiddenTerms"],
                  additionalProperties: false,
                },
              },
              required: ["reflection", "frequencyName", "arcType", "vocabulary"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : JSON.stringify(content);
      const result = JSON.parse(text);
      res.json({ success: true, synthesis: result });
    } catch (err) {
      console.error("[Bridge] POST synthesize error:", err);
      res.status(500).json({ error: "Synthesis failed" });
    }
  });

  // ── POST /api/bridge/frequency/save ───────────────────────────────────────
  app.post("/api/bridge/frequency/save", async (req, res) => {
    if (!requireBridgeKey(req, res)) return;
    try {
      const parsed = SaveFrequencySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { riffUserId, ...frequencyData } = parsed.data;
      const studiosUserId = await resolveStudiosUserId(riffUserId);

       const insertedId = await saveCreatorFrequency({
        userId: studiosUserId,
        frequencyName: frequencyData.frequencyName,
        arcType: frequencyData.arcType,
        vocabularyJson: frequencyData.vocabularyJson,
        synthesisFingerprint: frequencyData.synthesisFingerprint,
        diagnosticAnswersJson: frequencyData.diagnosticAnswersJson,
        isDefault: true,
      });
      res.json({ success: true, frequencyId: insertedId });
    } catch (err) {
      console.error("[Bridge] POST save frequency error:", err);
      res.status(500).json({ error: "Save failed" });
    }
  });

  // ── POST /api/bridge/cover-art/generate ───────────────────────────────────
  app.post("/api/bridge/cover-art/generate", async (req, res) => {
    if (!requireBridgeKey(req, res)) return;
    try {
      const parsed = GenerateCoverArtSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { riffUserId, riffTrackId, lyrics, genre, arcPosition, isRegeneration } = parsed.data;
      const studiosUserId = await resolveStudiosUserId(riffUserId);

      // Resolve vocabulary
      const frequency = await getDefaultCreatorFrequency(studiosUserId);
      const platformDefault = await getPlatformDefaultVocabulary();
      const vocabulary = frequency
        ? (frequency.vocabularyJson as unknown as VocabularyJson)
        : platformDefault
        ? (platformDefault.vocabularyJson as unknown as VocabularyJson)
        : null;

      if (!vocabulary) {
        res.status(503).json({ error: "No vocabulary available" });
        return;
      }

      // Extract lyric phrases if lyrics provided
      const lyricPhrases = lyrics ? await extractLyricPhrases(lyrics) : [];

      // Build prompt
      const promptOutput = buildCoverArtPrompt({
        vocabulary,
        arcPosition: arcPosition ?? "arriving",
        lyricPhrases,
        genre: genre ?? undefined,
      });

      // Generate image
      const { url: imageUrl } = await generateImage({ prompt: promptOutput.prompt });

      res.json({
        success: true,
        coverArtUrl: imageUrl,
        riffTrackId,
        arcPosition: arcPosition ?? "arriving",
        usedPersonalFrequency: !!frequency,
      });
    } catch (err) {
      console.error("[Bridge] POST generate cover art error:", err);
      res.status(500).json({ error: "Generation failed" });
    }
  });

  // ── GET /api/bridge/cover-art/:riffTrackId ────────────────────────────────
  // Returns cover art state for a Riff track (looked up by riffTrackId mapping)
  app.get("/api/bridge/cover-art/:riffTrackId", async (req, res) => {
    if (!requireBridgeKey(req, res)) return;
    try {
      const riffTrackId = parseInt(req.params.riffTrackId, 10);
      if (isNaN(riffTrackId)) {
        res.status(400).json({ error: "Invalid riffTrackId" });
        return;
      }
      // For now, return a 404 — Riff tracks don't map to Studios campaigns 1:1.
      // This endpoint is reserved for future phase when Riff tracks have a Studios campaign mapping.
      res.status(404).json({ error: "No Studios campaign mapped to this track yet" });
    } catch (err) {
      console.error("[Bridge] GET cover art error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
