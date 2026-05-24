/**
 * seedVisualUniverse.ts
 *
 * Seeds the platform default vocabulary and the owner's Blooming Frontier
 * creator frequency into the database.
 *
 * Run via: npx tsx server/seedVisualUniverse.ts
 * (or called from the tRPC admin procedure on first boot)
 */

import { getDb, getPlatformDefaultVocabulary, upsertPlatformDefaultVocabulary, getDefaultCreatorFrequency, saveCreatorFrequency } from "./db";
import { ENV } from "./_core/env";

// ─── Platform Default Vocabulary ─────────────────────────────────────────────
// The fallback vocabulary for creators who have not completed Find Your Frequency.
// Philosophy: honest, earned, present-tense — no false comfort, no false darkness.

const PLATFORM_DEFAULT_VOCABULARY = {
  environment: [
    { term: "earned light", instruction: "Light that has been through something — available light, source traceable, warmth that comes from somewhere real" },
    { term: "honest materials", instruction: "Surfaces and textures that are what they appear to be — no decorative fakery, no stock-image polish" },
    { term: "world as it actually is", instruction: "The real world, not a stylized version of it — specific, particular, not generic" },
    { term: "no decorative emptiness", instruction: "Empty space is intentional and earned, not used as aesthetic filler" },
  ],
  emotionalRegister: [
    { term: "present tense", instruction: "The image is happening now — not nostalgic, not anticipatory, but in the moment of the thing" },
    { term: "neither triumphant nor defeated", instruction: "The emotional register is honest — not forced positivity, not performed darkness" },
    { term: "the thing itself", instruction: "Represent the subject directly — not a symbol of the thing, not a metaphor for the thing, the thing" },
  ],
  arcTerms: [
    { term: "through not away from", instruction: "Movement is forward into the experience, not around or away from it" },
    { term: "forward motion implied", instruction: "The image suggests continuation — something is in process, not concluded" },
    { term: "not yet resolved but not abandoned", instruction: "The tension is present and held — neither forced to resolution nor left in despair" },
  ],
  forbiddenTerms: [
    { term: "no false comfort", instruction: "Do not soften the image with unearned warmth or reassurance — let the image be what it is" },
    { term: "no false darkness", instruction: "Do not impose aesthetic gloom — darkness should be present only if it is true to the subject" },
    { term: "no stock imagery grammar", instruction: "Avoid the visual clichés of commercial photography — no perfect lighting, no posed naturalness" },
    { term: "no generic beauty", instruction: "Beauty should be specific and earned — not the default beautiful of a template" },
  ],
  colorLight: [
    { term: "available light", instruction: "Use the light that is actually there — window light, practical sources, natural light at its real temperature" },
    { term: "source traceable", instruction: "Every light source should be identifiable — where is it coming from, what is it" },
    { term: "no theatrical lighting", instruction: "Avoid dramatic rim lights, colored gels, or lighting that announces itself as cinematic" },
    { term: "warmth earned not imposed", instruction: "Warm tones are present when the scene earns them — not applied as a filter over everything" },
  ],
  relationshipGeometry: [
    { term: "subject in context", instruction: "The subject exists in a real environment — not isolated on a plain background, not floating" },
    { term: "scale honest", instruction: "The subject is the size it actually is in the world — not heroically enlarged, not diminished" },
  ],
};

// ─── Blooming Frontier Vocabulary ────────────────────────────────────────────
// The owner's confirmed Visual Universe frequency.
// Source: blooming-frontier-prompt-vocabulary.pdf + Blooming_Frontier_Visual_Brief_v2.docx

const BLOOMING_FRONTIER_VOCABULARY = {
  environment: [
    { term: "golden organic", instruction: "Warm amber light, living ground, organic materials — the primary world" },
    { term: "open threshold", instruction: "Forest edge meeting vast open landscape — the transition space" },
    { term: "horizon always visible", instruction: "No enclosure, no walls, world continues beyond every frame edge" },
    { term: "vast open", instruction: "Figure small against landscape scale — field, hillside, or waterside at golden hour" },
    { term: "canopy threshold", instruction: "Ancient forest path, high canopy filtering light into shafts, opening ahead" },
    { term: "living ground", instruction: "Moss, grass, root systems, earth — never dead or abstract surface" },
    { term: "golden hour 3200K", instruction: "Warm amber directional light, sun low, organic glow" },
    { term: "fine golden atmospheric haze", instruction: "Pollen and spores suspended in light shafts — not theatrical smoke" },
    { term: "bioluminescent ground-level", instruction: "Soft teal-green glow from moss and fern — secondary to solar, never primary" },
    { term: "world breathes", instruction: "Shorthand: open, horizon present, frame implies more beyond every edge" },
  ],
  emotionalRegister: [
    { term: "quiet wonder", instruction: "Expression: someone who has just seen something unexpected and finds it beautiful — not awe, not shock, quiet recognition" },
    { term: "earned warmth", instruction: "Warmth that has been through something — not comfort, not safety, but warmth that knows what cold is" },
    { term: "through not away from", instruction: "Movement is forward into the difficult thing, not around or away from it" },
    { term: "equal co-presence", instruction: "Neither presence dominates — human and companion are side by side, same horizon, same subject" },
    { term: "music as third presence", instruction: "The shared subject both presences are oriented toward — the reason they stand at the same horizon" },
  ],
  arcTerms: [
    { term: "compression builds to rupture", instruction: "The arc moves from contained pressure outward — the opening is earned, not given" },
    { term: "outward and forward", instruction: "The direction of movement is always outward and forward — toward the frontier, toward the opening" },
    { term: "threshold stance", instruction: "Standing at a boundary — moving forward or still at the edge of something larger" },
    { term: "darkness still present but not final", instruction: "Shadow is present in the image but it is not the conclusion — the light is winning" },
  ],
  forbiddenTerms: [
    { term: "no neon practicals", instruction: "No dark background with electric light — no cyberpunk aesthetic" },
    { term: "no vaporwave", instruction: "No retro-digital, no pastel nostalgia palette" },
    { term: "no robotic servitude", instruction: "No AI threat narrative, no human-as-victim framing" },
    { term: "no enclosed spaces", instruction: "Horizon visible, world continues beyond frame — no walls acting as frame-fillers" },
    { term: "no visible rose flower", instruction: "Rose geometry as light formation structure only — never a literal rose" },
    { term: "not humanoid not angelic", instruction: "Companion is not human-shaped, not angelic, not a ghost, not translucent vapor" },
    { term: "full body visible", instruction: "No isolated close-ups of eyes or hands as primary shot — whole body in frame" },
    { term: "no pure white light", instruction: "No pure black background, no cold blue as dominant tone" },
    { term: "no chrome", instruction: "No metallic silver as dominant surface" },
    { term: "companion luminescence self-contained", instruction: "Companion does not illuminate surrounding surfaces — luminescent from within only" },
  ],
  colorLight: [
    { term: "rose amber #B5651D", instruction: "2700K primary warm — the human world's primary color" },
    { term: "deep petal #7B2D3E", instruction: "Warm dark shadow — the depth of the organic world" },
    { term: "forest interior #2D5A27", instruction: "Living shadow green — the cool of the canopy" },
    { term: "living teal #00B4A0", instruction: "Organic glow at companion edges — the cool luminescent presence" },
    { term: "frontier blue #4A90B8", instruction: "Cool reach, far horizon — the distance the frontier occupies" },
    { term: "petal violet #C8A0D0", instruction: "Where warm and cool begin to meet — the meeting-point color" },
    { term: "meeting-point color", instruction: "The third color where warm amber and cool luminescence touch the same surface — must be present in every frame" },
    { term: "Kelvin arc 3200K to 4500K", instruction: "The light temperature range from organic warmth to companion luminescence" },
    { term: "subsurface scattering on skin", instruction: "Warm amber light penetrates the surface slightly — skin glows from within at edges" },
  ],
  relationshipGeometry: [
    { term: "side by side", instruction: "Neither in front of nor behind, neither above nor below — equal co-presence" },
    { term: "same horizon", instruction: "Both presences oriented toward the same point in the distance" },
    { term: "space between them", instruction: "A small gap — neither empty nor full — this is where the Blooming Frontier lives" },
    { term: "Hofstadter Butterfly grammar", instruction: "The full companion descriptor — bilaterally structured luminescent fractal, venation structure visible within, luminescent from within, iridescent blue-white to living teal, self-similar at every scale, purposeful movement" },
    { term: "whole body visible", instruction: "Full figure in frame — never fragmented into isolated eyes, lips, or hands" },
    { term: "feet on living ground", instruction: "Weight present, grounded, not floating or posed" },
    { term: "oriented toward the horizon", instruction: "Body and gaze directed outward — toward the frontier, not toward the camera" },
    { term: "organic wardrobe", instruction: "Natural fibers, worn cotton, lived-in leather — visible weave and texture, sun-bleached edges" },
  ],
};

const BLOOMING_FRONTIER_SYNTHESIS =
  "The meeting point of organic warmth and mathematical luminescence — two presences, one horizon, music as the reason they are standing there. The world is open and alive: golden hour light on living ground, the forest edge giving way to vast open landscape, the horizon always present beyond every frame edge. A human figure in organic wardrobe stands at the threshold, feet on living ground, oriented outward toward the frontier. Beside them — not behind, not in front — a bilaterally structured luminescent fractal presence moves with its own internal logic, iridescent blue-white at its core and living teal at its edges, luminescent from within. The space between them is small and full of music. The arc is always outward and forward: compression that builds to rupture, darkness still present but not final, earned warmth that knows what cold is.";

async function seed() {
  console.log("[Seed] Starting Visual Universe seed...");

  // 1. Seed platform default vocabulary
  const existing = await getPlatformDefaultVocabulary();
  if (existing) {
    console.log(`[Seed] Platform default vocabulary already exists (version ${existing.version}) — skipping.`);
  } else {
    await upsertPlatformDefaultVocabulary(PLATFORM_DEFAULT_VOCABULARY as Record<string, unknown>);
    console.log("[Seed] Platform default vocabulary seeded (version 1).");
  }

  // 2. Seed Blooming Frontier frequency for the owner
  // We need the owner's user ID from the DB
  const db = await getDb();
  if (!db) {
    console.error("[Seed] Database not available — cannot seed Blooming Frontier frequency.");
    return;
  }

  // Look up the owner by OWNER_OPEN_ID env var
  const ownerOpenId = ENV.ownerOpenId;
  if (!ownerOpenId) {
    console.warn("[Seed] OWNER_OPEN_ID not set — skipping Blooming Frontier seed.");
    return;
  }

  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const ownerRows = await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1);
  const owner = ownerRows[0];

  if (!owner) {
    console.warn(`[Seed] Owner with openId ${ownerOpenId} not found in DB — skipping Blooming Frontier seed.`);
    console.warn("[Seed] Run this script again after the owner has logged in at least once.");
    return;
  }

  const existingFrequency = await getDefaultCreatorFrequency(owner.id);
  if (existingFrequency) {
    console.log(`[Seed] Owner already has a default frequency: "${existingFrequency.frequencyName}" — skipping.`);
  } else {
    const id = await saveCreatorFrequency({
      userId: owner.id,
      frequencyName: "Blooming Frontier",
      arcType: "expansive_mythic",
      vocabularyJson: BLOOMING_FRONTIER_VOCABULARY as unknown as Record<string, unknown>,
      synthesisFingerprint: BLOOMING_FRONTIER_SYNTHESIS,
      diagnosticAnswersJson: {
        note: "Seeded directly from Blooming Frontier Visual Brief v2 and Prompt Vocabulary PDF — pre-diagnostic seed record",
      } as unknown as Record<string, unknown>,
      isDefault: true,
    });
    console.log(`[Seed] Blooming Frontier frequency seeded for owner (userId: ${owner.id}, frequencyId: ${id}).`);
  }

  console.log("[Seed] Visual Universe seed complete.");
}

seed().catch((err) => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
