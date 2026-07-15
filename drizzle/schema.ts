import { bigint, boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  riffUserId: int("riffUserId").unique(), // Riff platform userId for bridge auth
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

/**
 * Campaigns — advertising / music video production sessions.
 * Each campaign is a multi-shot video production with a genre, brief, and duration mode.
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  audioTrackId: int("audioTrackId"),
  title: varchar("title", { length: 255 }).notNull(),
  artistName: varchar("artistName", { length: 255 }),
  /** Genre determines the visual grammar system used */
  genre: mysqlEnum("genre", [
    "psychedelic_vaporwave",
    "noir_jazz",
    "indie_folk",
    "hip_hop",
    "electronic",
    "punk_rock",
    "soul_rnb",
    "country",
    "experimental",
  ]).notNull().default("noir_jazz"),
  /** Duration mode determines shot count and structure */
  durationMode: mysqlEnum("durationMode", [
    "15s",
    "30s",
    "60s",
    "full_song",
  ]).notNull().default("30s"),
  /** Campaign goal for the advertising brief */
  campaignGoal: mysqlEnum("campaignGoal", [
    "awareness",
    "engagement",
    "conversion",
    "artist_brand",
  ]).notNull().default("awareness"),
  /** Free-text campaign brief */
  brief: text("brief"),
  /** Character/artist appearance notes */
  characterNotes: text("characterNotes"),
  /** Overall production status */
  status: mysqlEnum("status", [
    "draft",
    "generating_package",
    "package_ready",
    "generating_shots",
    "complete",
    "failed",
  ]).default("draft").notNull(),
  /** The assembled Director's Package JSON (storyboard, color palette, character design) */
  directorsPackage: json("directorsPackage"),
  /** Generated campaign prompt / logline */
  campaignPrompt: text("campaignPrompt"),
  /** Unique shareable slug */
  shareSlug: varchar("shareSlug", { length: 64 }).unique(),
  /** Whether the campaign is publicly shareable */
  isPublic: boolean("isPublic").default(false),
  /** URL of the primary mood board image used as Runway visual reference */
  moodBoardPrimaryImageUrl: text("moodBoardPrimaryImageUrl"),
  /**
   * Arc position for this campaign — controls the scale and temperature at which
   * the creator's vocabulary is expressed. Defaults to 'arriving' (threshold).
   * gathering = compression/intimate, arriving = threshold/expanding, open = vast/resolved
   */
  arcPosition: mysqlEnum("arcPosition", ["gathering", "arriving", "open"]).default("arriving").notNull(),
  /** Optional link to the creator's active frequency used for this campaign */
  frequencyId: int("frequencyId"),
  /**
   * Cover art URL — S3/CDN URL of the generated or uploaded cover art image.
   * Null means no cover art has been set yet.
   */
  coverArtUrl: text("coverArtUrl"),
  /**
   * Cover art source — how the cover art was set.
   * 'generated' = AI-generated via the prompt builder pipeline
   * 'uploaded' = manually uploaded by the creator
   * 'none' = no cover art set
   */
  coverArtSource: mysqlEnum("coverArtSource", ["generated", "uploaded", "none"]).default("none").notNull(),
  /** UTC ms timestamp of the last successful cover art generation */
  coverArtGeneratedAt: bigint("coverArtGeneratedAt", { mode: "number" }),
  /**
   * Number of times cover art has been regenerated for this campaign.
   * Capped at 3. Never resets — not even if the creator uploads their own image.
   * This prevents the upload-to-reset loop.
   */
  coverArtRegenerationsUsed: int("coverArtRegenerationsUsed").default(0).notNull(),
  /**
   * Life Signal rotation memory — IDs of signals used in the last cover art generation.
   * Stored as a JSON array of strings. Used by the Life Signal Randomizer to prevent
   * consecutive repetition of the same micro-irregularity signals.
   */
  lastUsedLifeSignalIds: json("lastUsedLifeSignalIds").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

/**
 * Campaign mood board images — reference images pinned to a campaign.
 * The primary image is passed to Runway as a visual style anchor.
 */
export const campaignMoodBoardImages = mysqlTable("campaign_mood_board_images", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  /** Public URL of the image (S3 or external) */
  imageUrl: text("imageUrl").notNull(),
  /** S3 key if uploaded (null if added by URL) */
  imageKey: varchar("imageKey", { length: 512 }),
  /** Optional director label for this reference */
  label: varchar("label", { length: 128 }),
  /** Whether this is the active primary reference sent to Runway */
  isPrimary: boolean("isPrimary").default(false).notNull(),
  /** Display order */
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignMoodBoardImage = typeof campaignMoodBoardImages.$inferSelect;
export type InsertCampaignMoodBoardImage = typeof campaignMoodBoardImages.$inferInsert;

/**
 * Campaign shots — individual video shots within a campaign.
 * Each shot is generated separately and assembled into the final video sequence.
 */
export const campaignShots = mysqlTable("campaign_shots", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  shotNumber: int("shotNumber").notNull(),
  /** Shot description from the Director's Package */
  description: text("description"),
  /** Shot type (establishing, close-up, medium, etc.) */
  shotType: varchar("shotType", { length: 64 }),
  /** Camera movement directive */
  cameraMovement: varchar("cameraMovement", { length: 128 }),
  /** Lighting note */
  lightingNote: text("lightingNote"),
  /** Target duration in seconds */
  durationSeconds: int("durationSeconds"),
  /** The exact prompt sent to the video generation API */
  videoPrompt: text("videoPrompt"),
  /** Video generation status */
  videoStatus: mysqlEnum("videoStatus", [
    "none",
    "queued",
    "generating",
    "complete",
    "failed",
  ]).default("none").notNull(),
  /** URL of the generated video (S3) */
  videoUrl: text("videoUrl"),
  /** External job ID from the video generation API */
  videoJobId: varchar("videoJobId", { length: 255 }),
  /** Video generation error message if failed */
  videoError: text("videoError"),
  /** Generation progress percentage (0-100) */
  progress: int("progress").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CampaignShot = typeof campaignShots.$inferSelect;
export type InsertCampaignShot = typeof campaignShots.$inferInsert;

/**
 * Creator frequencies — the Visual Universe for a creator.
 * Each record is a named frequency (e.g. "Blooming Frontier") with a full
 * structured vocabulary used to generate cover art and inform campaigns.
 * Most creators will have one frequency; the isDefault flag marks the active one.
 */
export const creatorFrequencies = mysqlTable("creator_frequencies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Human-readable name for this frequency, e.g. "Blooming Frontier" */
  frequencyName: varchar("frequencyName", { length: 100 }).notNull(),
  /** Arc type from the Listening Bible Chapter 2 taxonomy */
  arcType: mysqlEnum("arcType", [
    "expansive_mythic",
    "witnessing_lateral",
    "intimate_relational",
    "sustained_ambient",
    "erosive_revelatory",
    "cyclical_return",
  ]).notNull().default("expansive_mythic"),
  /** Structured vocabulary JSON: { environment, emotionalRegister, arcTerms, forbiddenTerms, relationshipGeometry, colorLight } */
  vocabularyJson: json("vocabularyJson").notNull(),
  /** One-paragraph human-readable description of the frequency */
  synthesisFingerprint: text("synthesisFingerprint"),
  /** Raw Q1-Q4 answers and Q5 reflection text from the diagnostic */
  diagnosticAnswersJson: json("diagnosticAnswersJson"),
  /** Whether this is the active/default frequency for this creator */
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreatorFrequency = typeof creatorFrequencies.$inferSelect;
export type InsertCreatorFrequency = typeof creatorFrequencies.$inferInsert;

/**
 * Platform default vocabulary — the fallback visual vocabulary used when a
 * creator has not completed Find Your Frequency.
 * A single record is maintained; version is incremented on updates.
 */
export const platformDefaultVocabulary = mysqlTable("platform_default_vocabulary", {
  id: int("id").autoincrement().primaryKey(),
  /** Structured vocabulary JSON: same format as creatorFrequencies.vocabularyJson */
  vocabularyJson: json("vocabularyJson").notNull(),
  /** Version number — increment when vocabulary is updated */
  version: int("version").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformDefaultVocabulary = typeof platformDefaultVocabulary.$inferSelect;
export type InsertPlatformDefaultVocabulary = typeof platformDefaultVocabulary.$inferInsert;

/**
 * Cover art generation logs — one row per generation.
 * Rolling window data source for the Adaptive Weight Tuning System.
 * Scoped to userId (not campaignId) so it works for both the tRPC path
 * and the bridge path (Riff-originated generations).
 */
export const coverArtGenerationLogs = mysqlTable("cover_art_generation_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Arc position used for this generation */
  arc: mysqlEnum("arc", ["gathering", "arriving", "open"]).notNull(),
  /** IDs of life signals injected (JSON array of strings) */
  lifeSignalIds: json("lifeSignalIds").notNull().$type<string[]>(),
  /** Sum of intensity values (subtle=1, moderate=2) */
  lifeSignalIntensityTotal: int("lifeSignalIntensityTotal").notNull().default(0),
  /** QA scores from the Auto-Evaluation Heuristic */
  qaScores: json("qaScores").notNull().$type<{
    coherence: number;
    depth: number;
    tension: number;
    lifeSignal: number;
    arcAlignment: number;
    total: number;
  }>(),
  /** UTC ms timestamp of the generation */
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export type CoverArtGenerationLog = typeof coverArtGenerationLogs.$inferSelect;
export type InsertCoverArtGenerationLog = typeof coverArtGenerationLogs.$inferInsert;

/**
 * Cover art adaptive weights — one row per user.
 * Stores the current weight multipliers for all 20 life signals,
 * domain multipliers, and adaptation cycle metadata.
 * Written by the Adaptive Weight Tuning System after each adaptation cycle.
 */
export const coverArtAdaptiveWeights = mysqlTable("cover_art_adaptive_weights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  /**
   * Per-signal weight multipliers keyed by signal ID.
   * JSON object: { [signalId]: number }
   * Neutral starting value: 1.0 for all signals.
   */
  signalWeights: json("signalWeights").notNull().$type<Record<string, number>>(),
  /**
   * Per-domain probability multipliers.
   * JSON object: { light, material, atmosphere, composition, temporal }
   */
  domainWeights: json("domainWeights").notNull().$type<Record<string, number>>(),
  /** Generations since last adaptation cycle fired */
  generationsSinceLastAdaptation: int("generationsSinceLastAdaptation").notNull().default(0),
  /** Total lifetime generations for this user */
  totalGenerations: int("totalGenerations").notNull().default(0),
  /** UTC ms timestamp of last weight update (null = never adapted) */
  lastAdaptedAt: bigint("lastAdaptedAt", { mode: "number" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoverArtAdaptiveWeight = typeof coverArtAdaptiveWeights.$inferSelect;
export type InsertCoverArtAdaptiveWeight = typeof coverArtAdaptiveWeights.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Music Video Generation Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Music videos — the top-level production record for a full music video.
 * Tracks the entire pipeline from ingest through delivery.
 */
export const musicVideos = mysqlTable("music_videos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  audioTrackId: int("audioTrackId"),
  /** Riff track ID — when the audio source is a Riff track (pulled via bridge) */
  riffTrackId: int("riffTrackId"),
  /** Riff track title — cached for display without a bridge round-trip */
  riffTrackTitle: varchar("riffTrackTitle", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  artistName: varchar("artistName", { length: 255 }),
  /** Full song lyrics (used for shot planning and lip sync selection) */
  lyrics: text("lyrics"),
  /** Free-text genre and visual style description (genre-agnostic) */
  genreDescription: text("genreDescription"),
  /** Total song duration in seconds (from audio analysis or user input) */
  durationSeconds: int("durationSeconds"),
  /**
   * Pipeline status state machine:
   * draft → analyzing_audio → planning → awaiting_review → generating_shots
   *   → lip_syncing → assembling → complete | failed
   */
  status: mysqlEnum("musicVideoStatus", [
    "draft",
    "analyzing_audio",
    "planning",
    "awaiting_review",
    "generating_shots",
    "lip_syncing",
    "assembling",
    "complete",
    "failed",
  ]).default("draft").notNull(),
  /** Shot plan JSON — array of planned shots before generation */
  storyboardJson: json("storyboardJson"),
  /** Error message if pipeline failed */
  errorMessage: text("errorMessage"),
  /** Final rendered video — S3 URL */
  finalVideoUrl: text("finalVideoUrl"),
  /** Final rendered video — S3 key */
  finalVideoKey: varchar("finalVideoKey", { length: 512 }),
  /** Kdenlive-editable .mlt project file — S3 URL */
  projectFileUrl: text("projectFileUrl"),
  /** Kdenlive-editable .mlt project file — S3 key */
  projectFileKey: varchar("projectFileKey", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** UTC timestamp when the final video was delivered */
  finalizedAt: timestamp("finalizedAt"),
});

export type MusicVideo = typeof musicVideos.$inferSelect;
export type InsertMusicVideo = typeof musicVideos.$inferInsert;

/**
 * Music video characters — named characters with a single reference image.
 * The reference image is reused as the Runway image-to-video anchor frame
 * for every shot that includes this character, ensuring visual consistency.
 */
export const musicVideoCharacters = mysqlTable("music_video_characters", {
  id: int("id").autoincrement().primaryKey(),
  musicVideoId: int("musicVideoId").notNull(),
  userId: int("userId").notNull(),
  /** Character name as used in shot descriptions and lip sync selection */
  name: varchar("name", { length: 128 }).notNull(),
  /** Optional free-text description (wardrobe, appearance notes) */
  description: text("description"),
  /** S3 URL of the uploaded reference image */
  referenceImageUrl: text("referenceImageUrl"),
  /** S3 key of the uploaded reference image */
  referenceImageKey: varchar("referenceImageKey", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MusicVideoCharacter = typeof musicVideoCharacters.$inferSelect;
export type InsertMusicVideoCharacter = typeof musicVideoCharacters.$inferInsert;

/**
 * Music video shots — one row per planned/generated shot.
 * Tracks the full lifecycle: planned → queued → generating → complete,
 * plus an optional lip sync pass for flagged shots.
 */
export const musicVideoShots = mysqlTable("music_video_shots", {
  id: int("id").autoincrement().primaryKey(),
  musicVideoId: int("musicVideoId").notNull(),
  /** Zero-based display order */
  shotIndex: int("shotIndex").notNull(),
  /** Song section this shot covers */
  segmentType: mysqlEnum("segmentType", [
    "intro",
    "verse",
    "chorus",
    "bridge",
    "outro",
    "instrumental",
    "other",
  ]).notNull().default("verse"),
  /** Start time in the song (seconds) */
  startTimeSeconds: int("startTimeSeconds").notNull().default(0),
  /** Target clip duration in seconds (5 or 10 for Runway) */
  targetDurationSeconds: int("targetDurationSeconds").notNull().default(5),
  /** Cinematic scene description (written by shot planner) */
  description: text("description"),
  /** Camera movement directive (e.g. "slow push in", "handheld drift") */
  cameraMovement: varchar("cameraMovement", { length: 128 }),
  /** Lighting note (e.g. "golden hour backlight", "neon underlight") */
  lightingNote: text("lightingNote"),
  /** JSON array of character IDs appearing in this shot */
  characterIds: json("characterIds").$type<number[]>(),
  /** Whether this shot requires lip sync processing */
  needsLipSync: boolean("needsLipSync").default(false).notNull(),
  /** Transition from the previous shot */
  transitionIn: mysqlEnum("transitionIn", ["cut", "dissolve", "luma"]).default("cut").notNull(),
  /** Video generation provider (currently always "runway") */
  provider: varchar("provider", { length: 64 }).default("runway"),
  /** Actual provider clip duration (5 or 10) */
  providerDurationSeconds: int("providerDurationSeconds"),
  /** The exact prompt sent to the video generation API */
  videoPrompt: text("videoPrompt"),
  /** Video generation status */
  videoStatus: mysqlEnum("shotVideoStatus", [
    "pending",
    "queued",
    "generating",
    "complete",
    "failed",
  ]).default("pending").notNull(),
  /** S3 URL of the generated clip */
  videoUrl: text("videoUrl"),
  /** External job ID from Runway (for polling) */
  videoJobId: varchar("videoJobId", { length: 255 }),
  /** Video generation error message */
  videoError: text("videoError"),
  /** Generation progress percentage (0–100) */
  progress: int("progress").default(0),
  /** Lip sync status */
  lipSyncStatus: mysqlEnum("lipSyncStatus", [
    "not_needed",
    "pending",
    "complete",
    "failed",
  ]).default("not_needed").notNull(),
  /** S3 URL of the lip-synced clip (replaces videoUrl in assembly) */
  lipSyncedVideoUrl: text("lipSyncedVideoUrl"),
  /** Sync Labs job ID */
  lipSyncJobId: varchar("lipSyncJobId", { length: 255 }),
  /** Lip sync error message */
  lipSyncError: text("lipSyncError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MusicVideoShot = typeof musicVideoShots.$inferSelect;
export type InsertMusicVideoShot = typeof musicVideoShots.$inferInsert;

/**
 * Music video audio structure — results of the librosa audio analysis.
 * One row per music video; upserted when analysis completes.
 */
export const musicVideoAudioStructure = mysqlTable("music_video_audio_structure", {
  id: int("id").autoincrement().primaryKey(),
  musicVideoId: int("musicVideoId").notNull().unique(),
  /** Estimated tempo in BPM */
  tempoBpm: int("tempoBpm"),
  /** Beat grid JSON — array of beat timestamps in seconds */
  beatGridJson: json("beatGridJson").$type<number[]>(),
  /**
   * Sections JSON — array of detected song sections:
   * [{ label: string, startSeconds: number, endSeconds: number }]
   */
  sectionsJson: json("sectionsJson").$type<Array<{
    label: string;
    startSeconds: number;
    endSeconds: number;
  }>>(),
  /**
   * Energy envelope JSON — RMS energy sampled at 1s intervals:
   * [{ timeSeconds: number, rms: number }]
   */
  energyEnvelopeJson: json("energyEnvelopeJson").$type<Array<{
    timeSeconds: number;
    rms: number;
  }>>(),
  /** UTC timestamp when analysis completed */
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
});

export type MusicVideoAudioStructure = typeof musicVideoAudioStructure.$inferSelect;
export type InsertMusicVideoAudioStructure = typeof musicVideoAudioStructure.$inferInsert;
