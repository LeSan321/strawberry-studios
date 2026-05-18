import { and, desc, eq } from "drizzle-orm";
import { drizzle as drizzleMysql2 } from "drizzle-orm/mysql2";
import {
  InsertAudioTrack,
  InsertCinématiquePreset,
  InsertConcert,
  InsertConcertCharacter,
  audioTracks,
  campaignShots,
  campaigns,
  cinematiquePresets,
  concertCharacters,
  concerts,
  users,
  type Campaign,
  type CampaignShot,
  type InsertCampaign,
  type InsertCampaignShot,
  type InsertUser,
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
  return (result as unknown as { insertId: number }).insertId;
}

export async function getCampaignsByUser(userId: number): Promise<Campaign[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
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
  return (result as unknown as { insertId: number }).insertId;
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
