/**
 * Strawberry Studios — Riff Bridge API
 *
 * Authenticated REST endpoints that Strawberry Riff calls on behalf of its users.
 * Authentication: Clerk Bearer token in Authorization header.
 *
 * Endpoints:
 *   POST /api/bridge/cover-art/generate — generate cover art for a track
 *
 * User identity: Riff sends a Clerk Bearer token. Studios verifies the token and
 * uses the Clerk userId (clerkUserId) as the user identifier. If the user doesn't
 * exist in Studios yet, a new user is created on first call.
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import {
  getDefaultCreatorFrequency,
  getPlatformDefaultVocabulary,
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

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GenerateCoverArtSchema = z.object({
  lyrics: z.string(),
});

// ─── Bridge Routes ────────────────────────────────────────────────────────────

export function registerBridgeRoutes(app: Express): void {
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
      const { lyrics } = parsed.data;

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
