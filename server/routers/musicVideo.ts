/**
 * musicVideo.ts — tRPC router for the Music Video Generation Pipeline
 * ====================================================================
 * Procedures:
 *   musicVideo.create           — create a new music video project
 *   musicVideo.list             — list all music video projects for the user
 *   musicVideo.get              — get a single project with shots and characters
 *   musicVideo.delete           — delete a project and all its data
 *   musicVideo.addCharacter     — add a character with reference image
 *   musicVideo.removeCharacter  — remove a character
 *   musicVideo.analyze          — Stage 2: run audio analysis
 *   musicVideo.plan             — Stage 3: run shot planner (→ awaiting_review)
 *   musicVideo.updateShot       — edit a shot in the storyboard
 *   musicVideo.approve          — Stage 4: approve storyboard (→ generating_shots)
 *   musicVideo.generateShots    — Stage 5: generate all pending shots
 *   musicVideo.pollShot         — poll a single shot's generation status
 *   musicVideo.assemble         — Stage 7: assemble final video
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createMusicVideo,
  getMusicVideoById,
  getMusicVideosByUser,
  updateMusicVideo,
  deleteMusicVideo,
  createMusicVideoCharacter,
  getMusicVideoCharacters,
  deleteMusicVideoCharacter,
  getMusicVideoShots,
  getMusicVideoShotById,
  createMusicVideoShot,
  updateMusicVideoShot,
  deleteAllMusicVideoShots,
} from "../db";
import { analyzeMusicVideoAudio, getMusicVideoAudioStructure } from "../musicVideo/audioAnalyzer";
import { planMusicVideoShots } from "../musicVideo/shotPlanner";
import { generateMusicVideoShots } from "../musicVideo/shotOrchestrator";
import { assembleMusicVideo } from "../musicVideo/assembler";
import { getDefaultCreatorFrequency, getPlatformDefaultVocabulary } from "../db";

// ─── Input schemas ────────────────────────────────────────────────────────────

const createMusicVideoSchema = z.object({
  title: z.string().min(1).max(255),
  artistName: z.string().max(255).optional(),
  // Audio source — exactly one of these should be provided:
  audioTrackId: z.number().int().positive().optional(), // Studios-local audio track
  audioUrl: z.string().url().optional(),               // direct URL (fallback)
  riffTrackId: z.number().int().positive().optional(), // Riff track (via bridge)
  riffTrackTitle: z.string().max(255).optional(),      // cached Riff track title
  // Whether to pull the user's Frequency vocabulary from Riff for shot planning
  useMyFrequency: z.boolean().optional(),
  lyrics: z.string().max(10000).optional(),
  genreDescription: z.string().max(1000).optional(),
  durationSeconds: z.number().int().positive().optional(),
});

const updateShotSchema = z.object({
  shotId: z.number().int().positive(),
  description: z.string().max(1000).optional(),
  cameraMovement: z.string().max(128).optional(),
  lightingNote: z.string().max(500).optional(),
  videoPrompt: z.string().max(980).optional(),
  needsLipSync: z.boolean().optional(),
  transitionIn: z.enum(["cut", "dissolve", "luma"]).optional(),
  targetDurationSeconds: z.number().int().min(5).max(10).optional(),
  startTimeSeconds: z.number().int().min(0).optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const musicVideoRouter = router({
  // ── Create ──────────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(createMusicVideoSchema)
    .mutation(async ({ ctx, input }) => {
      // If a Riff track is specified, resolve its audioUrl via the bridge
      let resolvedAudioUrl = input.audioUrl ?? null;
      if (input.riffTrackId && ctx.user.openId) {
        try {
          const { resolveRiffTrackAudio } = await import("../riffBridge");
          const resolved = await resolveRiffTrackAudio(ctx.user.openId, input.riffTrackId);
          if (resolved) {
            resolvedAudioUrl = resolved.audioUrl;
            // Auto-fill duration and genre if not provided
            if (!input.durationSeconds && resolved.duration) {
              (input as any).durationSeconds = resolved.duration;
            }
            if (!input.genreDescription && resolved.genre) {
              (input as any).genreDescription = resolved.genre;
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[musicVideo.create] Riff bridge track resolution failed:", msg);
          // Non-fatal — continue without the resolved URL; analyze step will fail gracefully
        }
      }

      const id = await createMusicVideo({
        userId: ctx.user.id,
        title: input.title,
        artistName: input.artistName ?? null,
        audioTrackId: input.audioTrackId ?? null,
        riffTrackId: input.riffTrackId ?? null,
        riffTrackTitle: input.riffTrackTitle ?? null,
        lyrics: input.lyrics ?? null,
        genreDescription: input.genreDescription ?? null,
        durationSeconds: input.durationSeconds ?? null,
        status: "draft",
      });

      // resolvedAudioUrl is returned to the client so it can pass it directly
      // to the musicVideo.analyze call. audioUrl is not stored in the DB —
      // it is a transient input to the analysis step only.
      return { id, resolvedAudioUrl };
    }),

  // ── List ────────────────────────────────────────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMusicVideosByUser(ctx.user.id);
  }),

  // ── Get Riff tracks (for track selector in new video form) ──────────────────
  getRiffTracks: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.openId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User openId not available" });
    }
    try {
      const { getRiffTracks } = await import("../riffBridge");
      const tracks = await getRiffTracks(ctx.user.openId);
      return { tracks };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[musicVideo.getRiffTracks] Bridge call failed:", msg);
      // Return empty list rather than crashing the form — user can still use direct URL
      return { tracks: [], error: msg };
    }
  }),

  // ── Get (with shots, characters, audio structure) ───────────────────────────
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.id);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const [shots, characters, audioStructure] = await Promise.all([
        getMusicVideoShots(input.id),
        getMusicVideoCharacters(input.id),
        getMusicVideoAudioStructure(input.id),
      ]);

      return { ...mv, shots, characters, audioStructure };
    }),

  // ── Delete ──────────────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.id);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteMusicVideo(input.id);
      return { success: true };
    }),

  // ── Add character ────────────────────────────────────────────────────────────
  addCharacter: protectedProcedure
    .input(
      z.object({
        musicVideoId: z.number().int().positive(),
        name: z.string().min(1).max(128),
        description: z.string().max(500).optional(),
        referenceImageUrl: z.string().url().optional(),
        referenceImageKey: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.musicVideoId);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const id = await createMusicVideoCharacter({
        musicVideoId: input.musicVideoId,
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        referenceImageUrl: input.referenceImageUrl ?? null,
        referenceImageKey: input.referenceImageKey ?? null,
      });
      return { id };
    }),

  // ── Remove character ─────────────────────────────────────────────────────────
  removeCharacter: protectedProcedure
    .input(z.object({ characterId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via the character's musicVideoId
      const { getMusicVideoCharacters: _unused, ..._ } = await import("../db");
      // Fetch the character via a direct query
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { musicVideoCharacters } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(musicVideoCharacters)
        .where(eq(musicVideoCharacters.id, input.characterId))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      if (rows[0].userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteMusicVideoCharacter(input.characterId);
      return { success: true };
    }),

  // ── Stage 2: Analyze audio ───────────────────────────────────────────────────
  analyze: protectedProcedure
    .input(
      z.object({
        musicVideoId: z.number().int().positive(),
        audioUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.musicVideoId);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await updateMusicVideo(input.musicVideoId, { status: "analyzing_audio" });

      try {
        const result = await analyzeMusicVideoAudio(input.musicVideoId, input.audioUrl);
        await updateMusicVideo(input.musicVideoId, { status: "planning" });
        return { success: true, result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateMusicVideo(input.musicVideoId, {
          status: "failed",
          errorMessage: `Audio analysis failed: ${msg}`,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Audio analysis failed: ${msg}`,
        });
      }
    }),

  // ── Stage 3: Plan shots ──────────────────────────────────────────────────────
  plan: protectedProcedure
    .input(z.object({ musicVideoId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.musicVideoId);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const audioStructure = await getMusicVideoAudioStructure(input.musicVideoId);
      if (!audioStructure) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Audio must be analyzed before planning shots",
        });
      }

      const characters = await getMusicVideoCharacters(input.musicVideoId);

      // Resolve vocabulary: personal frequency → platform default → none
      let vocabulary = null;
      let synthesisFingerprint = null;
      let vocabSource: "personal" | "platform_default" | "none" = "none";

      const personalFreq = await getDefaultCreatorFrequency(ctx.user.id);
      if (personalFreq) {
        vocabulary = personalFreq.vocabularyJson as any;
        synthesisFingerprint = personalFreq.synthesisFingerprint;
        vocabSource = "personal";
      } else {
        const platformDefault = await getPlatformDefaultVocabulary();
        if (platformDefault) {
          vocabulary = platformDefault.vocabularyJson as any;
          vocabSource = "platform_default";
        }
      }

      await updateMusicVideo(input.musicVideoId, { status: "planning" });

      try {
        const shots = await planMusicVideoShots({
          musicVideoId: input.musicVideoId,
          title: mv.title,
          artistName: mv.artistName,
          lyrics: mv.lyrics,
          genreDescription: mv.genreDescription,
          sections: audioStructure.sections,
          energyEnvelope: audioStructure.energyEnvelope,
          tempoBpm: audioStructure.tempoBpm,
          characters: characters.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            referenceImageUrl: c.referenceImageUrl,
          })),
          vocabulary,
          synthesisFingerprint,
          vocabSource,
        });

        // Delete any existing shots and insert the new plan
        await deleteAllMusicVideoShots(input.musicVideoId);
        for (const shot of shots) {
          await createMusicVideoShot({
            musicVideoId: input.musicVideoId,
            shotIndex: shot.shotIndex,
            segmentType: shot.segmentType,
            startTimeSeconds: shot.startTimeSeconds,
            targetDurationSeconds: shot.targetDurationSeconds,
            description: shot.description,
            cameraMovement: shot.cameraMovement,
            lightingNote: shot.lightingNote,
            characterIds: shot.characterIds,
            needsLipSync: shot.needsLipSync,
            transitionIn: shot.transitionIn,
            videoPrompt: shot.videoPrompt,
            videoStatus: "pending",
            lipSyncStatus: shot.needsLipSync ? "pending" : "not_needed",
          });
        }

        await updateMusicVideo(input.musicVideoId, { status: "awaiting_review" });
        return { success: true, shotCount: shots.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateMusicVideo(input.musicVideoId, {
          status: "failed",
          errorMessage: `Shot planning failed: ${msg}`,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Shot planning failed: ${msg}`,
        });
      }
    }),

  // ── Update a single shot (storyboard editing) ────────────────────────────────
  updateShot: protectedProcedure
    .input(updateShotSchema)
    .mutation(async ({ ctx, input }) => {
      const shot = await getMusicVideoShotById(input.shotId);
      if (!shot) throw new TRPCError({ code: "NOT_FOUND" });

      const mv = await getMusicVideoById(shot.musicVideoId);
      if (!mv || mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const updates: Record<string, unknown> = {};
      if (input.description !== undefined) updates.description = input.description;
      if (input.cameraMovement !== undefined) updates.cameraMovement = input.cameraMovement;
      if (input.lightingNote !== undefined) updates.lightingNote = input.lightingNote;
      if (input.videoPrompt !== undefined) updates.videoPrompt = input.videoPrompt;
      if (input.needsLipSync !== undefined) {
        updates.needsLipSync = input.needsLipSync;
        updates.lipSyncStatus = input.needsLipSync ? "pending" : "not_needed";
      }
      if (input.transitionIn !== undefined) updates.transitionIn = input.transitionIn;
      if (input.targetDurationSeconds !== undefined) updates.targetDurationSeconds = input.targetDurationSeconds;
      if (input.startTimeSeconds !== undefined) updates.startTimeSeconds = input.startTimeSeconds;

      await updateMusicVideoShot(input.shotId, updates as any);
      return { success: true };
    }),

  // ── Stage 4: Approve storyboard ──────────────────────────────────────────────
  approve: protectedProcedure
    .input(z.object({ musicVideoId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.musicVideoId);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (mv.status !== "awaiting_review") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot approve: status is "${mv.status}", expected "awaiting_review"`,
        });
      }

      await updateMusicVideo(input.musicVideoId, { status: "generating_shots" });
      return { success: true };
    }),

  // ── Stage 5: Generate shots (orchestration loop) ─────────────────────────────
  generateShots: protectedProcedure
    .input(z.object({ musicVideoId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.musicVideoId);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (mv.status !== "generating_shots") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot generate shots: status is "${mv.status}", expected "generating_shots"`,
        });
      }

      const characters = await getMusicVideoCharacters(input.musicVideoId);

      // Fire-and-forget orchestration — returns immediately, generation runs async
      generateMusicVideoShots(input.musicVideoId, characters).catch((err: unknown) => {
        console.error(`[MusicVideo] Shot generation failed for ${input.musicVideoId}:`, err);
        updateMusicVideo(input.musicVideoId, {
          status: "failed",
          errorMessage: `Shot generation failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });

      return { success: true, message: "Shot generation started" };
    }),

  // ── Poll a single shot's status ───────────────────────────────────────────────
  pollShot: protectedProcedure
    .input(z.object({ shotId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const shot = await getMusicVideoShotById(input.shotId);
      if (!shot) throw new TRPCError({ code: "NOT_FOUND" });
      const mv = await getMusicVideoById(shot.musicVideoId);
      if (!mv || mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return shot;
    }),

  // ── Stage 7: Assemble final video ────────────────────────────────────────────
  assemble: protectedProcedure
    .input(z.object({ musicVideoId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const mv = await getMusicVideoById(input.musicVideoId);
      if (!mv) throw new TRPCError({ code: "NOT_FOUND" });
      if (mv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const shots = await getMusicVideoShots(input.musicVideoId);
      const completedShots = shots.filter((s) => s.videoStatus === "complete");
      if (completedShots.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No completed shots to assemble",
        });
      }

      await updateMusicVideo(input.musicVideoId, { status: "assembling" });

      // Fire-and-forget assembly
      assembleMusicVideo(input.musicVideoId, shots).catch((err: unknown) => {
        console.error(`[MusicVideo] Assembly failed for ${input.musicVideoId}:`, err);
        updateMusicVideo(input.musicVideoId, {
          status: "failed",
          errorMessage: `Assembly failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });

      return { success: true, message: "Assembly started" };
    }),
});
