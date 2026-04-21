import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  strawberryRiffProfile: varchar("strawberryRiffProfile", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audio tracks uploaded by users for concert production.
 */
export const audioTracks = mysqlTable("audio_tracks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  durationSeconds: int("durationSeconds"),
  mimeType: varchar("mimeType", { length: 64 }),
  fileSizeBytes: int("fileSizeBytes"),
  trimStartSeconds: int("trimStartSeconds").default(0),
  trimEndSeconds: int("trimEndSeconds"),
  normalized: boolean("normalized").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AudioTrack = typeof audioTracks.$inferSelect;
export type InsertAudioTrack = typeof audioTracks.$inferInsert;

/**
 * Concerts — the core production unit.
 * Each concert is a user's production session at a specific venue.
 */
export const concerts = mysqlTable("concerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  audioTrackId: int("audioTrackId"),
  title: varchar("title", { length: 255 }).notNull(),
  artistName: varchar("artistName", { length: 255 }),
  /** Venue identifier */
  venue: mysqlEnum("venue", [
    "velvet_strawberry_jazz_club",
    "strawberry_in_the_round",
    "berries_on_the_rocks",
  ]).notNull().default("velvet_strawberry_jazz_club"),
  /** Concert mood preset */
  moodPreset: mysqlEnum("moodPreset", [
    "intimate_jazz",
    "high_energy",
    "noir_smoke",
    "custom",
  ]).default("intimate_jazz"),
  /** Visual preset */
  visualPreset: mysqlEnum("visualPreset", [
    "shadow_and_smoke",
    "golden_rim",
    "venetian_cage",
    "match_flare",
    "none",
  ]).default("shadow_and_smoke"),
  /** Camera style selection */
  cameraStyle: varchar("cameraStyle", { length: 128 }),
  /** Kelvin lighting temperature */
  lightingKelvin: int("lightingKelvin"),
  /** Custom mood description for "Custom" preset */
  customMoodDescription: text("customMoodDescription"),
  /** Production status */
  status: mysqlEnum("status", [
    "draft",
    "generating",
    "complete",
    "failed",
  ]).default("draft").notNull(),
  /** The assembled Director's Package JSON */
  directorsPackage: json("directorsPackage"),
  /** Generated Cinématique prompt */
  cinematiquePrompt: text("cinematiquePrompt"),
  /** Video generation status */
  videoStatus: mysqlEnum("videoStatus", [
    "none",
    "queued",
    "generating",
    "complete",
    "failed",
  ]).default("none").notNull(),
  /** URL of the generated video (S3 or external) */
  videoUrl: text("videoUrl"),
  /** The exact Cinématique prompt sent to the video generation API */
  videoPrompt: text("videoPrompt"),
  /** External job ID from the video generation API (for polling) */
  videoJobId: varchar("videoJobId", { length: 255 }),
  /** Video generation error message if failed */
  videoError: text("videoError"),
  /** Timestamp when video URL JWT token was last refreshed */
  videoUrlRefreshedAt: timestamp("videoUrlRefreshedAt"),
  /** Unique shareable ticket slug */
  ticketSlug: varchar("ticketSlug", { length: 64 }).unique(),
  /** Whether the concert is publicly shareable */
  isPublic: boolean("isPublic").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Concert = typeof concerts.$inferSelect;
export type InsertConcert = typeof concerts.$inferInsert;

/**
 * Characters selected or uploaded for a concert.
 */
export const concertCharacters = mysqlTable("concert_characters", {
  id: int("id").autoincrement().primaryKey(),
  concertId: int("concertId").notNull(),
  /** Resident character or custom */
  characterType: mysqlEnum("characterType", [
    "the_red_head_singer",
    "the_fedora_man",
    "custom",
  ]).notNull(),
  /** For custom characters: uploaded reference image URL */
  referenceImageUrl: text("referenceImageUrl"),
  referenceImageKey: varchar("referenceImageKey", { length: 512 }),
  /** Role in the concert (lead, supporting, background) */
  role: mysqlEnum("role", ["lead", "supporting", "background"]).default("lead"),
  customDescription: text("customDescription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConcertCharacter = typeof concertCharacters.$inferSelect;
export type InsertConcertCharacter = typeof concertCharacters.$inferInsert;

/**
 * Cinématique preset library — browsable visual style presets.
 */
export const cinematiquePresets = mysqlTable("cinematique_presets", {
  id: int("id").autoincrement().primaryKey(),
  /** Exact preset name */
  name: varchar("name", { length: 128 }).notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  description: text("description"),
  /** Fabric physics directives */
  fabricPhysics: text("fabricPhysics"),
  /** Kelvin temperature value */
  lightingKelvin: int("lightingKelvin"),
  /** Camera psychology language */
  cameraPsychology: text("cameraPsychology"),
  /** Full Cinématique prompt template */
  promptTemplate: text("promptTemplate"),
  /** Preview thumbnail CDN URL */
  thumbnailUrl: text("thumbnailUrl"),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CinématiquePreset = typeof cinematiquePresets.$inferSelect;
export type InsertCinématiquePreset = typeof cinematiquePresets.$inferInsert;

/**
 * Expert Council sessions — LLM prompt generation logs.
 */
export const expertCouncilSessions = mysqlTable("expert_council_sessions", {
  id: int("id").autoincrement().primaryKey(),
  concertId: int("concertId").notNull(),
  userId: int("userId").notNull(),
  /** Input parameters sent to the council */
  inputParams: json("inputParams"),
  /** Generated Cinématique prompt output */
  generatedPrompt: text("generatedPrompt"),
  /** Director's Package JSON output */
  directorsPackage: json("directorsPackage"),
  /** LLM model used */
  modelUsed: varchar("modelUsed", { length: 128 }),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExpertCouncilSession = typeof expertCouncilSessions.$inferSelect;
export type InsertExpertCouncilSession = typeof expertCouncilSessions.$inferInsert;
