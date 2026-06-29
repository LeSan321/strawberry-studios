/**
 * Strawberry Studios — Riff Bridge API
 *
 * Authenticated REST endpoints that Strawberry Riff calls on behalf of its users.
 * Authentication: Clerk Bearer token in Authorization header.
 *
 * Endpoints:
 *   GET  /api/bridge/frequency/default                — get user's default frequency
 *   POST /api/bridge/frequency/synthesize             — run LLM synthesis from 4 diagnostic answers
 *   POST /api/bridge/frequency/save                   — save a frequency as user's default
 *   POST /api/bridge/cover-art/generate               — generate cover art for a track (Clerk auth)
 *   POST /api/bridge/cover-art/generate-from-signal   — generate image from Named Signal (IA shared secret)
 *   GET  /api/bridge/ping                             — health check
 *
 * User identity: Riff sends a Clerk Bearer token. Studios verifies the token and
 * uses the Clerk userId (clerkUserId) as the user identifier. If the user doesn't
 * exist in Studios yet, a new user is created on first call.
 *
 * Inverted Algorithm identity: IA sends a shared secret in the x-ia-key header.
 * No user identity is required — IA provides its own vocabulary payload.
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import {
  getDefaultCreatorFrequency,
  saveCreatorFrequency,
} from "./db";
import { buildCoverArtPrompt, extractLyricPhrases, writeCinematicPrompt, resolveVocabulary, type VocabularyJson, type VocabularyTerm, type ArcPosition } from "./coverArt/promptBuilder";
import { generateImage } from "./_core/imageGeneration";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { verifyBearerToken } from "./_core/clerk-auth";
import { ENV } from "./_core/env";

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

/**
 * Verify Inverted Algorithm shared secret from x-ia-key header.
 * Returns true if valid, false otherwise (and sends 401 response).
 *
 * The shared secret is stored in IA_BRIDGE_SECRET env var on both sides.
 * Studios owns and generates the secret; IA stores it as an env var.
 */
function verifyIABridgeAuth(req: Request, res: Response): boolean {
  const secret = process.env.IA_BRIDGE_SECRET ?? ENV.iaBridgeSecret;
  if (!secret) {
    // If the secret is not configured on Studios side, refuse all requests
    console.error("[Bridge] IA_BRIDGE_SECRET is not configured — rejecting generate-from-signal request");
    res.status(503).json({ error: "Endpoint not configured" });
    return false;
  }

  const provided = req.headers["x-ia-key"];
  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Invalid or missing x-ia-key header" });
    return false;
  }

  return true;
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

// ─── Named Signal → Frequency Vocabulary Translation ─────────────────────────

/**
 * Arc type values (6 canonical types from the Cinématique Bible).
 */
export type ArcType =
  | "expansive_mythic"
  | "witnessing_lateral"
  | "intimate_relational"
  | "sustained_ambient"
  | "erosive_revelatory"
  | "cyclical_return";

/**
 * Derive arc type from Named Signal contrast + luminance axes.
 * Mid-range is defined as 0.35–0.65 for both axes.
 *
 * Mapping (from architecture doc):
 *   high contrast + high luminance → erosive_revelatory
 *   high contrast + low luminance  → witnessing_lateral
 *   low contrast  + high luminance → expansive_mythic
 *   low contrast  + low luminance  → sustained_ambient
 *   mid contrast  + warm temp      → intimate_relational
 *   mid contrast  + cool temp      → cyclical_return
 */
export function deriveArcType(
  contrast: number,
  luminance: number,
  temperature: number,
): ArcType {
  const HIGH = 0.65;
  const LOW = 0.35;

  const highContrast = contrast >= HIGH;
  const lowContrast = contrast < LOW;
  const highLum = luminance >= HIGH;
  const lowLum = luminance < LOW;
  const midContrast = !highContrast && !lowContrast;

  if (highContrast && highLum) return "erosive_revelatory";
  if (highContrast && lowLum) return "witnessing_lateral";
  if (lowContrast && highLum) return "expansive_mythic";
  if (lowContrast && lowLum) return "sustained_ambient";
  // Mid contrast — use temperature to distinguish
  if (midContrast && temperature >= 0.5) return "intimate_relational";
  return "cyclical_return";
}

/**
 * Map hue (0–360°) to colorLight vocabulary terms using the Cinématique Bible
 * colour language from the architecture doc.
 */
function hueToColorLightTerms(hue: number): VocabularyTerm[] {
  // Normalize hue to [0, 360)
  const h = ((hue % 360) + 360) % 360;

  let terms: string[];
  if (h < 30) {
    terms = ["ember warmth", "tungsten practicals", "fire-adjacent light"];
  } else if (h < 60) {
    terms = ["golden hour 3200K", "warm solar light", "amber atmospheric haze"];
  } else if (h < 90) {
    terms = ["pale solar diffusion", "open meadow light", "living ground"];
  } else if (h < 150) {
    terms = ["forest canopy filter", "bioluminescent ground-level", "moss and shadow"];
  } else if (h < 210) {
    terms = ["cool companion luminescence", "iridescent blue-white", "living teal"];
  } else if (h < 270) {
    terms = ["deep water refraction", "indigo atmospheric depth", "night horizon"];
  } else if (h < 330) {
    terms = ["petal violet #C8A0D0", "transition zone light", "subsurface rose"];
  } else {
    terms = ["warm magenta threshold", "rose-amber meeting point", "blood warmth"];
  }

  return terms.map(term => ({ term, instruction: `Use ${term} as the primary light source quality.` }));
}

/**
 * Map temperature (0–1) to emotionalRegister terms.
 * Cool (0) → introspective / observational; warm (1) → expressive / intimate.
 */
function temperatureToEmotionalTerms(temperature: number): VocabularyTerm[] {
  if (temperature < 0.25) {
    return [
      { term: "still observation", instruction: "Hold the camera at a distance — witness without intervening." },
      { term: "interior quiet", instruction: "The emotional register is inward, compressed, not performed." },
      { term: "cool detachment", instruction: "Space between subject and world; not cold, but measured." },
    ];
  } else if (temperature < 0.5) {
    return [
      { term: "present-tense awareness", instruction: "The subject is alert and watching; not yet moved." },
      { term: "restrained feeling", instruction: "Emotion is present but held — surface tension, not release." },
      { term: "lateral witnessing", instruction: "Eye-level, unhurried, the world as it is." },
    ];
  } else if (temperature < 0.75) {
    return [
      { term: "gathering warmth", instruction: "The scene is building toward something; light is softening." },
      { term: "open presence", instruction: "The subject is available to the world — not guarded." },
      { term: "earned intimacy", instruction: "Closeness that has been arrived at, not assumed." },
    ];
  } else {
    return [
      { term: "full presence", instruction: "The subject is entirely in the moment — no distance." },
      { term: "expressive warmth", instruction: "Light and colour are generous, not rationed." },
      { term: "threshold crossing", instruction: "Something is being given or received; the moment of exchange." },
    ];
  }
}

/**
 * Map saturation (0–1) to environment intensity terms.
 * Low saturation → muted, atmospheric; high saturation → vivid, present.
 */
function saturationToEnvironmentTerms(saturation: number): VocabularyTerm[] {
  if (saturation < 0.3) {
    return [
      { term: "desaturated field", instruction: "Colour is present but drained — the world after weather." },
      { term: "atmospheric haze", instruction: "Distance compresses into grey-blue; edges dissolve." },
      { term: "muted ground", instruction: "The environment recedes; the subject carries the colour." },
    ];
  } else if (saturation < 0.6) {
    return [
      { term: "natural saturation", instruction: "Colour as it appears in diffuse daylight — honest, not heightened." },
      { term: "balanced field", instruction: "Environment and subject share the colour weight equally." },
      { term: "present-world texture", instruction: "The scene feels inhabited, not staged." },
    ];
  } else {
    return [
      { term: "vivid ground", instruction: "Colour is fully present — the environment insists on itself." },
      { term: "saturated atmosphere", instruction: "Light carries pigment; the air has colour." },
      { term: "world in full", instruction: "Nothing is held back; the scene is at maximum presence." },
    ];
  }
}

/**
 * Map contrast + luminance to arcTerms (gathering vs arriving vs open).
 */
function contrastLuminanceToArcTerms(contrast: number, luminance: number): VocabularyTerm[] {
  const HIGH = 0.65;
  const LOW = 0.35;

  if (contrast >= HIGH && luminance >= HIGH) {
    return [
      { term: "revealed threshold", instruction: "Something hidden is being uncovered — the moment of exposure." },
      { term: "arriving light", instruction: "Light enters from outside the frame; the world is opening." },
      { term: "erosive clarity", instruction: "The surface is worn away to show what was always underneath." },
    ];
  } else if (contrast >= HIGH && luminance < LOW) {
    return [
      { term: "shadow gathering", instruction: "Darkness is active — it is collecting, not merely absent." },
      { term: "lateral witness", instruction: "Observe from the side; do not intervene in what is happening." },
      { term: "compressed present", instruction: "The moment is dense; time is not moving forward yet." },
    ];
  } else if (contrast < LOW && luminance >= HIGH) {
    return [
      { term: "open horizon", instruction: "The world extends beyond the frame in all directions." },
      { term: "mythic scale", instruction: "The subject is small against a vast, indifferent environment." },
      { term: "diffuse arrival", instruction: "Light is everywhere and from nowhere; no single source." },
    ];
  } else if (contrast < LOW && luminance < LOW) {
    return [
      { term: "ambient continuity", instruction: "The scene has no beginning or end — it simply is." },
      { term: "texture as event", instruction: "Nothing happens; the texture of the world is the subject." },
      { term: "sustained presence", instruction: "Hold the frame; let the atmosphere accumulate." },
    ];
  } else {
    // Mid contrast — balanced arc terms
    return [
      { term: "gathering moment", instruction: "The scene is collecting itself before something changes." },
      { term: "held breath", instruction: "The world is paused between one state and the next." },
      { term: "familiar threshold", instruction: "A place or moment that has been here before — earned, not new." },
    ];
  }
}

/**
 * Translate a Named Signal (5-axis emotional state) into a Frequency VocabularyJson.
 * Used when the IA does not pre-translate the signal.
 *
 * Named Signal axes:
 *   hue         (0–360°) → colorLight terms (Cinématique Bible hue zones)
 *   temperature (0–1)    → emotionalRegister + colorLight temperature modifier
 *   saturation  (0–1)    → environment intensity + emotionalRegister
 *   contrast    (0–1)    → arcTerms + arc type selection
 *   luminance   (0–1)    → colorLight + environment
 */
export function namedSignalToVocabulary(signal: {
  hue: number;
  temperature: number;
  saturation: number;
  contrast: number;
  luminance: number;
}): VocabularyJson {
  const { hue, temperature, saturation, contrast, luminance } = signal;

  const colorLightFromHue = hueToColorLightTerms(hue);
  const emotionalTerms = temperatureToEmotionalTerms(temperature);
  const environmentTerms = saturationToEnvironmentTerms(saturation);
  const arcTerms = contrastLuminanceToArcTerms(contrast, luminance);

  // Luminance modifier for colorLight — append a luminance-driven term
  const luminanceTerm: VocabularyTerm = luminance >= 0.65
    ? { term: "high-key luminance", instruction: "The scene is bright; shadows are soft and minimal." }
    : luminance < 0.35
    ? { term: "low-key luminance", instruction: "The scene is dark; light is a presence, not a fill." }
    : { term: "mid-key balance", instruction: "Light and shadow share the frame equally." };

  return {
    environment: environmentTerms,
    emotionalRegister: emotionalTerms,
    arcTerms,
    forbiddenTerms: [
      { term: "generic beauty", instruction: "Avoid postcard prettiness — the scene must feel inhabited." },
      { term: "stock photography", instruction: "No posed subjects, no artificial smiles, no studio lighting." },
    ],
    colorLight: [...colorLightFromHue, luminanceTerm],
    relationshipGeometry: [
      { term: "subject-world proportion", instruction: "The relationship between figure and environment carries the emotional weight." },
    ],
  };
}

/**
 * Map arc type to arc position for the cinematic prompt writer.
 */
function arcTypeToArcPosition(arcType: ArcType): ArcPosition {
  const mapping: Record<ArcType, ArcPosition> = {
    expansive_mythic: "open",
    witnessing_lateral: "arriving",
    intimate_relational: "gathering",
    sustained_ambient: "arriving",
    erosive_revelatory: "arriving",
    cyclical_return: "open",
  };
  return mapping[arcType];
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
  songTitle: z.string().optional(),
  steeringNote: z.string().optional(),
  genre: z.string().optional(),
  moodTags: z.array(z.string()).optional(),
});

const ArcTypeEnum = z.enum([
  "expansive_mythic",
  "witnessing_lateral",
  "intimate_relational",
  "sustained_ambient",
  "erosive_revelatory",
  "cyclical_return",
]);

const VocabularyTermSchema = z.object({
  term: z.string(),
  instruction: z.string(),
});

const VocabularyJsonSchema = z.object({
  environment: z.array(VocabularyTermSchema),
  emotionalRegister: z.array(VocabularyTermSchema),
  arcTerms: z.array(VocabularyTermSchema),
  forbiddenTerms: z.array(VocabularyTermSchema),
  colorLight: z.array(VocabularyTermSchema),
  relationshipGeometry: z.array(VocabularyTermSchema),
});

const GenerateFromSignalSchema = z.object({
  signal: z.object({
    hue: z.number().min(0).max(360),
    temperature: z.number().min(0).max(1),
    saturation: z.number().min(0).max(1),
    contrast: z.number().min(0).max(1),
    luminance: z.number().min(0).max(1),
  }),
  vocabulary: VocabularyJsonSchema.optional(),
  steeringNote: z.string().max(500).optional(),
  arcType: ArcTypeEnum.optional(),
  imageType: z.enum(["door", "landscape", "fog_still"]),
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
      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent || typeof rawContent !== "string") {
        throw new Error("LLM returned no content");
      }
      // Strip markdown code fences if the model wraps JSON in ```json ... ```
      const content = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
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
      const { lyrics, songTitle, steeringNote, genre, moodTags } = parsed.data;

      console.log(`[generateCoverArt] Starting bridge call with lyrics length: ${lyrics.length}, genre: ${genre ?? 'none'}, moodTags: ${moodTags?.join(',') ?? 'none'}, songTitle: ${songTitle ?? 'none'}`);

      const studiosUserId = await resolveStudiosUserId(clerkUserId);

      // Resolve vocabulary — use personal frequency if available, fall back to platform default
      const { vocabulary: resolvedVocab, source: vocabSource, frequencyName } = await resolveVocabulary(studiosUserId);
      const normalizedVocab = normalizeVocabulary(resolvedVocab as unknown as Record<string, unknown>);

      // Get frequency for arc type (only needed for arc position mapping)
      const frequency = await getDefaultCreatorFrequency(studiosUserId);

      // Map arcType to arcPosition for the prompt builder
      // When no frequency exists, use 'open' as the default — most neutral and energetic
      const arcTypeToPosition: Record<string, ArcPosition> = {
        expansive_mythic: "open",
        witnessing_lateral: "arriving",
        intimate_relational: "open",
        sustained_ambient: "arriving",
        erosive_revelatory: "arriving",
        cyclical_return: "open",
      };
      const arcPosition = frequency ? (arcTypeToPosition[frequency.arcType] ?? "open") : "open";

      // Use Claude to write a unified cinematic scene description.
      // Falls back to the fragment assembler if Claude is unavailable.
      const { prompt, method: promptMethod } = await writeCinematicPrompt({
        lyrics,
        songTitle: songTitle ?? null,
        genre: genre ?? null,
        moodTags: moodTags ?? null,
        steeringNote: steeringNote ?? null,
        vocabulary: normalizedVocab,
        synthesisFingerprint: frequency?.synthesisFingerprint ?? null,
        arcPosition,
        vocabSource,
      });

      console.log(`[generateCoverArt] Prompt method: ${promptMethod}, length: ${prompt.length}`);
      console.log(`[generateCoverArt] Prompt preview: ${prompt.slice(0, 300)}`);

      const { url: imageUrl } = await generateImage({ prompt });

      console.log(`[generateCoverArt] Image generated: ${imageUrl}`);

      // Return image URL with debug info for diagnosis
      res.json({
        imageUrl,
        _debug: {
          vocabSource,
          frequencyName: frequencyName ?? null,
          arcPosition,
          promptMethod,
          lyricsReceived: lyrics.length > 0 ? lyrics.slice(0, 100) + (lyrics.length > 100 ? '...' : '') : null,
          genreReceived: genre ?? null,
          moodTagsReceived: moodTags ?? null,
          promptUsed: prompt,
          promptLength: prompt.length,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[generateCoverArt] Exception:", message, err);
      res.status(500).json({ error: "Cover art generation failed", detail: message });
    }
  });

  // ── POST /api/bridge/cover-art/generate-from-signal ───────────────────────
  /**
   * Inverted Algorithm endpoint — generate a personalised image from a Named Signal.
   *
   * Authentication: shared secret in x-ia-key header (IA_BRIDGE_SECRET env var).
   * No Clerk token required — IA uses Manus OAuth, not Clerk.
   *
   * The Named Signal is a 5-axis emotional state vector produced by the IA's
   * listening session. Studios translates it into Frequency vocabulary and
   * generates an image using the Cinématique Bible prompt pipeline.
   *
   * If the IA pre-translates the signal into a vocabulary payload, that payload
   * is used directly (skip translation). This allows the IA to apply its own
   * Cinématique Bible knowledge before calling Studios.
   *
   * imageType controls the cinematic framing:
   *   "door"      — intimate threshold, close-up, architectural frame
   *   "landscape" — wide environment, figure small against vast world
   *   "fog_still" — atmospheric texture, no subject, world as sensation
   */
  app.post("/api/bridge/cover-art/generate-from-signal", async (req, res) => {
    if (!verifyIABridgeAuth(req, res)) return;

    try {
      const parsed = GenerateFromSignalSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const { signal, vocabulary: providedVocabulary, steeringNote, arcType: arcTypeOverride, imageType } = parsed.data;

      console.log(`[generateFromSignal] signal=${JSON.stringify(signal)}, imageType=${imageType}, hasVocabulary=${!!providedVocabulary}, arcTypeOverride=${arcTypeOverride ?? 'none'}`);

      // Step 1: Resolve vocabulary
      // If IA provided a pre-translated vocabulary, use it directly.
      // Otherwise, translate the Named Signal axes using the Cinématique Bible mapping.
      const vocabulary: VocabularyJson = providedVocabulary ?? namedSignalToVocabulary(signal);
      const vocabSource: "personal" | "platform_default" = providedVocabulary ? "personal" : "platform_default";

      // Step 2: Derive arc type
      // Use the caller's override if provided; otherwise derive from signal axes.
      const arcType: ArcType = arcTypeOverride ?? deriveArcType(signal.contrast, signal.luminance, signal.temperature);
      const arcPosition: ArcPosition = arcTypeToArcPosition(arcType);

      // Step 3: Build imageType-aware steering note
      // Prepend an imageType framing directive to the steering note so the
      // cinematic prompt writer knows the compositional intent.
      const imageTypeFraming: Record<string, string> = {
        door: "Architectural threshold, intimate close-up scale, a door or portal as the primary compositional element — the space between inside and outside",
        landscape: "Wide landscape scale, the environment is the subject, any figure is small against the vast world",
        fog_still: "No subject, no figure — pure atmospheric texture, fog as sensation, world as feeling not event",
      };

      const combinedSteeringNote = [
        imageTypeFraming[imageType],
        steeringNote?.trim() ?? "",
      ].filter(Boolean).join(". ");

      // Step 4: Write the cinematic prompt via Claude
      // writeCinematicPrompt expects lyrics as the primary creative input.
      // For signal-driven generation there are no lyrics — pass an empty string.
      // The vocabulary and steering note carry the full creative weight.
      const { prompt, method: promptMethod } = await writeCinematicPrompt({
        lyrics: "",
        songTitle: null,
        genre: null,
        moodTags: null,
        steeringNote: combinedSteeringNote,
        vocabulary,
        synthesisFingerprint: null,
        arcPosition,
        vocabSource,
      });

      console.log(`[generateFromSignal] Prompt method: ${promptMethod}, arcType: ${arcType}, arcPosition: ${arcPosition}`);
      console.log(`[generateFromSignal] Prompt preview: ${prompt.slice(0, 300)}`);

      // Step 5: Generate image
      const { url: imageUrl } = await generateImage({ prompt });

      console.log(`[generateFromSignal] Image generated: ${imageUrl}`);

      res.json({
        imageUrl,
        arcType,
        vocabulary,
        _debug: {
          signal,
          imageType,
          arcPosition,
          promptMethod,
          vocabSource,
          promptUsed: prompt,
          promptLength: prompt.length,
          combinedSteeringNote,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[generateFromSignal] Exception:", message, err);
      res.status(500).json({ error: "Signal-driven generation failed", detail: message });
    }
  });
}
