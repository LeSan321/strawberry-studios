import { and, count, desc, eq, sql } from "drizzle-orm";
import { drizzle as drizzleMysql2 } from "drizzle-orm/mysql2";
import {
  InsertAudioTrack,
  InsertCinématiquePreset,
  InsertConcert,
  InsertConcertCharacter,
  audioTracks,
  campaignMoodBoardImages,
  campaignShots,
  campaigns,
  cinematiquePresets,
  concertCharacters,
  concerts,
  creatorFrequencies,
  platformDefaultVocabulary,
  coverArtGenerationLogs,
  coverArtAdaptiveWeights,
  users,
  type Campaign,
  type CampaignMoodBoardImage,
  type CampaignShot,
  type CreatorFrequency,
  type InsertCampaign,
  type InsertCampaignMoodBoardImage,
  type InsertCampaignShot,
  type InsertCreatorFrequency,
  type InsertUser,
  type PlatformDefaultVocabulary,
  type InsertCoverArtGenerationLog,
  type CoverArtGenerationLog,
  type CoverArtAdaptiveWeight,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzleMysql2> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzleMysql2(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Concerts ─────────────────────────────────────────────────────────────────

export async function createConcert(data: InsertConcert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(concerts).values(data);
  return result;
}

export async function getConcertsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(concerts).where(eq(concerts.userId, userId)).orderBy(desc(concerts.createdAt));
}

export async function getConcertById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(concerts).where(eq(concerts.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getConcertBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(concerts).where(eq(concerts.ticketSlug, slug)).limit(1);
  return result[0] ?? null;
}

export async function updateConcert(id: number, data: Partial<InsertConcert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(concerts).set(data).where(eq(concerts.id, id));
}

// ─── Concert Characters ────────────────────────────────────────────────────────

export async function addConcertCharacter(data: InsertConcertCharacter) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(concertCharacters).values(data);
}

export async function getConcertCharacters(concertId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(concertCharacters).where(eq(concertCharacters.concertId, concertId));
}

// ─── Audio Tracks ─────────────────────────────────────────────────────────────

export async function createAudioTrack(data: InsertAudioTrack) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(audioTracks).values(data);
  return result;
}

export async function getAudioTracksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(audioTracks).where(eq(audioTracks.userId, userId)).orderBy(desc(audioTracks.createdAt));
}

export async function getAudioTrackById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(audioTracks).where(eq(audioTracks.id, id)).limit(1);
  return result[0] ?? null;
}

// ─── Cinématique Presets ──────────────────────────────────────────────────────

export async function getAllPresets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cinematiquePresets).where(eq(cinematiquePresets.isActive, true)).orderBy(cinematiquePresets.sortOrder);
}

export async function getPresetBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cinematiquePresets).where(eq(cinematiquePresets.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function upsertPreset(data: InsertCinématiquePreset) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cinematiquePresets).values(data).onDuplicateKeyUpdate({
    set: {
      description: data.description,
      fabricPhysics: data.fabricPhysics,
      lightingKelvin: data.lightingKelvin,
      cameraPsychology: data.cameraPsychology,
      promptTemplate: data.promptTemplate,
      thumbnailUrl: data.thumbnailUrl,
    }
  });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function createCampaign(data: InsertCampaign): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaigns).values(data);
  // Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] — insertId is at index 0
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

export async function getCampaignsByUser(userId: number): Promise<Campaign[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function countCampaignsByUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ value: count() }).from(campaigns).where(eq(campaigns.userId, userId));
  return result[0]?.value ?? 0;
}

export async function getCampaignById(id: number): Promise<Campaign | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(campaigns).where(eq(campaigns.shareSlug, slug)).limit(1);
  return result[0] ?? null;
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignShots).where(eq(campaignShots.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ─── Campaign Shots ───────────────────────────────────────────────────────────

export async function createCampaignShot(data: InsertCampaignShot): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaignShots).values(data);
  // Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] — insertId is at index 0
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

export async function getCampaignShots(campaignId: number): Promise<CampaignShot[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaignShots)
    .where(eq(campaignShots.campaignId, campaignId))
    .orderBy(campaignShots.shotNumber);
}

export async function updateCampaignShot(id: number, data: Partial<InsertCampaignShot>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaignShots).set(data).where(eq(campaignShots.id, id));
}

// ─── Concert Deletion ─────────────────────────────────────────────────────────

export async function deleteConcert(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Hard delete — also removes associated characters via FK cascade (if configured)
  // or we delete characters first then the concert
  await db.delete(concertCharacters).where(eq(concertCharacters.concertId, id));
  await db.delete(concerts).where(eq(concerts.id, id));
}

// ─── Mood Board Images ────────────────────────────────────────────────────────

export async function getMoodBoardImages(campaignId: number): Promise<CampaignMoodBoardImage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaignMoodBoardImages)
    .where(eq(campaignMoodBoardImages.campaignId, campaignId))
    .orderBy(campaignMoodBoardImages.sortOrder, campaignMoodBoardImages.createdAt);
}

export async function addMoodBoardImage(data: InsertCampaignMoodBoardImage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaignMoodBoardImages).values(data);
  // Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] — insertId is at index 0
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

export async function removeMoodBoardImage(id: number, campaignId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignMoodBoardImages)
    .where(eq(campaignMoodBoardImages.id, id));
  // If this was the primary, clear the campaign's cached primary URL
  const remaining = await getMoodBoardImages(campaignId);
  const stillHasPrimary = remaining.some(i => i.isPrimary);
  if (!stillHasPrimary) {
    await db.update(campaigns).set({ moodBoardPrimaryImageUrl: null }).where(eq(campaigns.id, campaignId));
  }
}

export async function setPrimaryMoodBoardImage(id: number, campaignId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Clear all primaries for this campaign
  await db.update(campaignMoodBoardImages)
    .set({ isPrimary: false })
    .where(eq(campaignMoodBoardImages.campaignId, campaignId));
  // Set the new primary
  await db.update(campaignMoodBoardImages)
    .set({ isPrimary: true })
    .where(eq(campaignMoodBoardImages.id, id));
  // Cache the URL on the campaign row for fast access during generation
  const image = await db.select().from(campaignMoodBoardImages)
    .where(eq(campaignMoodBoardImages.id, id))
    .limit(1);
  if (image[0]) {
    await db.update(campaigns)
      .set({ moodBoardPrimaryImageUrl: image[0].imageUrl })
      .where(eq(campaigns.id, campaignId));
  }
}

export async function clearPrimaryMoodBoardImage(campaignId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaignMoodBoardImages)
    .set({ isPrimary: false })
    .where(eq(campaignMoodBoardImages.campaignId, campaignId));
  await db.update(campaigns)
    .set({ moodBoardPrimaryImageUrl: null })
    .where(eq(campaigns.id, campaignId));
}

// ─── Visual Universe — Creator Frequencies ────────────────────────────────────

/**
 * Get the active (default) frequency for a user.
 * Returns null if the user has not completed Find Your Frequency.
 */
export async function getDefaultCreatorFrequency(userId: number): Promise<CreatorFrequency | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select()
    .from(creatorFrequencies)
    .where(and(eq(creatorFrequencies.userId, userId), eq(creatorFrequencies.isDefault, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get a specific frequency by ID.
 */
export async function getCreatorFrequency(id: number): Promise<CreatorFrequency | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select()
    .from(creatorFrequencies)
    .where(eq(creatorFrequencies.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get all frequencies for a user (most recently created first).
 */
export async function listCreatorFrequencies(userId: number): Promise<CreatorFrequency[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select()
    .from(creatorFrequencies)
    .where(eq(creatorFrequencies.userId, userId))
    .orderBy(desc(creatorFrequencies.createdAt));
}

/**
 * Save a new creator frequency.
 * If isDefault is true, clears the isDefault flag on all other frequencies for this user first.
 * Returns the inserted row ID.
 */
export async function saveCreatorFrequency(data: InsertCreatorFrequency): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // If this is being set as default, clear existing defaults for this user
  if (data.isDefault && data.userId) {
    await db.update(creatorFrequencies)
      .set({ isDefault: false })
      .where(eq(creatorFrequencies.userId, data.userId));
  }
  const result = await db.insert(creatorFrequencies).values(data);
  const insertResult = result as unknown as [{ insertId: number }];
  return insertResult[0].insertId;
}

/**
 * Set a frequency as the active default for a user.
 * Clears isDefault on all other frequencies for this user.
 */
export async function setDefaultCreatorFrequency(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(creatorFrequencies)
    .set({ isDefault: false })
    .where(eq(creatorFrequencies.userId, userId));
  await db.update(creatorFrequencies)
    .set({ isDefault: true })
    .where(and(eq(creatorFrequencies.id, id), eq(creatorFrequencies.userId, userId)));
}

// ─── Visual Universe — Platform Default Vocabulary ───────────────────────────

/**
 * Get the current platform default vocabulary.
 * Returns the single record (always version 1+). Returns null if not seeded yet.
 */
export async function getPlatformDefaultVocabulary(): Promise<PlatformDefaultVocabulary | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select()
    .from(platformDefaultVocabulary)
    .orderBy(desc(platformDefaultVocabulary.version))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert the platform default vocabulary.
 * If a record exists, updates it and increments the version.
 * If no record exists, inserts the first record at version 1.
 */
export async function upsertPlatformDefaultVocabulary(
  vocabularyJson: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getPlatformDefaultVocabulary();
  if (existing) {
    await db.update(platformDefaultVocabulary)
      .set({ vocabularyJson, version: existing.version + 1 })
      .where(eq(platformDefaultVocabulary.id, existing.id));
  } else {
    await db.insert(platformDefaultVocabulary).values({ vocabularyJson, version: 1 });
  }
}

// ─── Cover Art ────────────────────────────────────────────────────────────────

export type CoverArtState = {
  coverArtUrl: string | null;
  coverArtSource: "generated" | "uploaded" | "none";
  coverArtGeneratedAt: number | null;
  coverArtRegenerationsUsed: number;
  /** Life Signal rotation memory — IDs used in the last generation */
  lastUsedLifeSignalIds: string[] | null;
};

/** Maximum number of cover art regenerations allowed per campaign. Never resets. */
export const COVER_ART_REGEN_LIMIT = 3;

/**
 * Get the current cover art state for a campaign.
 * Returns null if the campaign does not exist.
 */
export async function getCampaignCoverArt(
  campaignId: number
): Promise<CoverArtState | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      coverArtUrl: campaigns.coverArtUrl,
      coverArtSource: campaigns.coverArtSource,
      coverArtGeneratedAt: campaigns.coverArtGeneratedAt,
      coverArtRegenerationsUsed: campaigns.coverArtRegenerationsUsed,
      lastUsedLifeSignalIds: campaigns.lastUsedLifeSignalIds,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!rows[0]) return null;
  return rows[0] as CoverArtState;
}

/**
 * Set cover art from an upload. Does NOT increment the regeneration count.
 * The upload-to-reset loop is explicitly prevented by design — the regen
 * count is per campaign and never resets under any circumstance.
 */
export async function setCampaignCoverArtFromUpload(
  campaignId: number,
  coverArtUrl: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaigns).set({
    coverArtUrl,
    coverArtSource: "uploaded",
    coverArtGeneratedAt: null,
    // coverArtRegenerationsUsed is intentionally NOT reset
  }).where(eq(campaigns.id, campaignId));
}

/**
 * Set cover art from a generation.
 *
 * - First generation (coverArtSource was 'none'): sets URL and source, does NOT
 *   increment the regen count (the first generation is not a "regeneration").
 * - Subsequent generations: increments regen count atomically, capped at COVER_ART_REGEN_LIMIT.
 *
 * Throws a REGENERATION_LIMIT_REACHED error if the limit has already been reached.
 */
export async function setCampaignCoverArtFromGeneration(
  campaignId: number,
  coverArtUrl: string,
  isFirstGeneration: boolean,
  lastUsedLifeSignalIds?: string[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const lifeSignalJson = lastUsedLifeSignalIds && lastUsedLifeSignalIds.length > 0
    ? lastUsedLifeSignalIds
    : null;

  if (isFirstGeneration) {
    await db.update(campaigns).set({
      coverArtUrl,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      lastUsedLifeSignalIds: lifeSignalJson,
    }).where(eq(campaigns.id, campaignId));
  } else {
    // Atomic increment with cap — uses drizzle sql template for type safety
    const now = Date.now();
    const lifeSignalStr = lifeSignalJson ? JSON.stringify(lifeSignalJson) : null;
    await db.execute(
      sql`UPDATE campaigns
          SET coverArtUrl = ${coverArtUrl},
              coverArtSource = 'generated',
              coverArtGeneratedAt = ${now},
              coverArtRegenerationsUsed = LEAST(coverArtRegenerationsUsed + 1, ${COVER_ART_REGEN_LIMIT}),
              lastUsedLifeSignalIds = ${lifeSignalStr}
          WHERE id = ${campaignId}`
    );
  }
}

// ─── Cover Art Generation Logs ────────────────────────────────────────────────

/**
 * Appends a generation log entry for a user.
 * Used by the Adaptive Weight Tuning System as its rolling window data source.
 */
export async function appendCoverArtGenerationLog(
  entry: Omit<InsertCoverArtGenerationLog, "id">
): Promise<void> {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot append generation log: database not available"); return; }

  await db.insert(coverArtGenerationLogs).values(entry);
}

/**
 * Returns the most recent `limit` generation logs for a user, ordered newest first.
 * Used to compute stability metrics and detect repetition patterns.
 */
export async function getRecentCoverArtGenerationLogs(
  userId: number,
  limit: number
): Promise<CoverArtGenerationLog[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(coverArtGenerationLogs)
    .where(eq(coverArtGenerationLogs.userId, userId))
    .orderBy(desc(coverArtGenerationLogs.timestamp))
    .limit(limit);

  return rows;
}

/**
 * Returns the total count of generation logs for a user.
 * Used to determine whether the rolling window is large enough for adaptation.
 */
export async function getCoverArtGenerationLogCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coverArtGenerationLogs)
    .where(eq(coverArtGenerationLogs.userId, userId));

  return rows[0]?.count ?? 0;
}

// ─── Cover Art Adaptive Weights ───────────────────────────────────────────────

/**
 * Returns the adaptive weights record for a user, or null if not yet initialized.
 */
export async function getCoverArtAdaptiveWeights(
  userId: number
): Promise<CoverArtAdaptiveWeight | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(coverArtAdaptiveWeights)
    .where(eq(coverArtAdaptiveWeights.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Upserts the adaptive weights record for a user.
 * Creates a new record on first call; updates on subsequent calls.
 */
export async function upsertCoverArtAdaptiveWeights(
  userId: number,
  weights: {
    signalWeights: Record<string, number>;
    domainWeights: Record<string, number>;
    generationsSinceLastAdaptation: number;
    totalGenerations: number;
    lastAdaptedAt: number | null;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert adaptive weights: database not available"); return; }

  await db.execute(
    sql`INSERT INTO cover_art_adaptive_weights
        (userId, signalWeights, domainWeights, generationsSinceLastAdaptation, totalGenerations, lastAdaptedAt)
        VALUES (
          ${userId},
          ${JSON.stringify(weights.signalWeights)},
          ${JSON.stringify(weights.domainWeights)},
          ${weights.generationsSinceLastAdaptation},
          ${weights.totalGenerations},
          ${weights.lastAdaptedAt ?? null}
        )
        ON DUPLICATE KEY UPDATE
          signalWeights = VALUES(signalWeights),
          domainWeights = VALUES(domainWeights),
          generationsSinceLastAdaptation = VALUES(generationsSinceLastAdaptation),
          totalGenerations = VALUES(totalGenerations),
          lastAdaptedAt = VALUES(lastAdaptedAt)`
  );
}
