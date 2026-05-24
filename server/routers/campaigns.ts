/**
 * Campaigns Router — Advertising Video & Music Video Production
 *
 * Handles the full lifecycle of campaign creation:
 * 1. Create campaign with genre, brief, duration mode
 * 2. Generate Director's Package via multi-genre Expert Council
 * 3. Generate individual shots via Runway
 * 4. Poll shot status and save to S3
 * 5. Assemble final campaign
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  buildCampaignSystemPrompt,
  buildShotPrompt,
  DURATION_SHOT_COUNT,
  GENRE_GRAMMAR,
  type CampaignGenre,
  type DurationMode,
  type CampaignGoal,
} from "../campaignPromptBuilder";
import {
  addMoodBoardImage,
  clearPrimaryMoodBoardImage,
  countCampaignsByUser,
  createCampaign,
  createCampaignShot,
  deleteCampaign,
  getCampaignById,
  getCampaignBySlug,
  getCampaignCoverArt,
  getCampaignShots,
  getCampaignsByUser,
  getMoodBoardImages,
  removeMoodBoardImage,
  setCampaignCoverArtFromGeneration,
  setPrimaryMoodBoardImage,
  updateCampaign,
  updateCampaignShot,
} from "../db";
import { invokeLLM } from "../_core/llm";
import { generateVideo, getActiveProvider, pollVideoStatus } from "../videoGeneration";
import { storagePut } from "../storage";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const GenreEnum = z.enum([
  "psychedelic_vaporwave",
  "noir_jazz",
  "indie_folk",
  "hip_hop",
  "electronic",
  "punk_rock",
  "soul_rnb",
  "country",
  "experimental",
]);

const DurationModeEnum = z.enum(["15s", "30s", "60s", "full_song"]);

const CampaignGoalEnum = z.enum([
  "awareness",
  "engagement",
  "conversion",
  "artist_brand",
]);

// ── Director's Package Schema ─────────────────────────────────────────────────

interface ShotListItem {
  shotNumber: number;
  shotType: string;
  description: string;
  durationSeconds: number;
  cameraMovement: string;
  lightingNote: string;
  atmosphericNote: string;
  editNote: string;
  emotionalFunction: string;
}

interface DirectorsPackage {
  logline: string;
  visualIdentityStatement: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    kelvin: string;
    grade: string;
    emotionalNote: string;
  };
  characterDesign: {
    appearance: string;
    wardrobe: string;
    materialNotes: string;
    lightingInteraction: string;
  };
  setDesign: Array<{
    name: string;
    description: string;
    lightingSetup: string;
    atmosphericNote: string;
  }>;
  shotList: ShotListItem[];
  productionNotes: {
    cameraPackage: string;
    lightingSetup: string;
    atmosphericSetup: string;
    postGrade: string;
  };
  artDepartmentNotes: {
    tone: string;
    timePeriod: string;
    palette: string;
    texture: string;
    theme: string;
  };
  directorStatement: string;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const campaignsRouter = router({
  /**
   * List all campaigns for the current user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getCampaignsByUser(ctx.user.id);
  }),

  /**
   * Get a single campaign with its shots.
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.id);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const shots = await getCampaignShots(input.id);

      // Inline-poll Runway for any shots currently generating
      const generatingShots = shots.filter(
        (s) => s.videoStatus === "generating" && s.videoJobId
      );
      if (generatingShots.length > 0) {
        const provider = getActiveProvider();
        await Promise.allSettled(
          generatingShots.map(async (shot) => {
            try {
              const result = await pollVideoStatus(provider, shot.videoJobId!);
              if (result.status === "complete" && result.videoUrl) {
                const videoResponse = await fetch(result.videoUrl);
                if (videoResponse.ok) {
                  const buffer = Buffer.from(await videoResponse.arrayBuffer());
                  const fileKey = `campaign-shots/${input.id}-shot${shot.shotNumber}-${Date.now()}.mp4`;
                  const { url: s3Url } = await storagePut(fileKey, buffer, "video/mp4");
                  await updateCampaignShot(shot.id, {
                    videoStatus: "complete",
                    videoUrl: s3Url,
                    progress: 100,
                  });
                }
              } else if (result.status === "failed") {
                await updateCampaignShot(shot.id, {
                  videoStatus: "failed",
                  videoError: "error" in result ? result.error : "Generation failed",
                });
              } else {
                const progress = ("progress" in result ? result.progress : undefined) ?? shot.progress ?? 10;
                await updateCampaignShot(shot.id, { progress });
              }
            } catch (err) {
              console.error(`[campaigns.get] Error polling shot ${shot.id}:`, err);
            }
          })
        );
        // Re-fetch shots after updates
        const updatedShots = await getCampaignShots(input.id);
        return { campaign, shots: updatedShots };
      }

      return { campaign, shots };
    }),

  /**
   * Get a public campaign by share slug (no auth required).
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const campaign = await getCampaignBySlug(input.slug);
      if (!campaign || !campaign.isPublic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found or not public" });
      }
      const shots = await getCampaignShots(campaign.id);
      return { campaign, shots };
    }),

  /**
   * Create a new campaign (draft).
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        artistName: z.string().optional(),
        genre: GenreEnum,
        durationMode: DurationModeEnum,
        campaignGoal: CampaignGoalEnum,
        brief: z.string().optional(),
        characterNotes: z.string().optional(),
        audioTrackId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createCampaign({
        userId: ctx.user.id,
        title: input.title,
        artistName: input.artistName ?? null,
        genre: input.genre,
        durationMode: input.durationMode,
        campaignGoal: input.campaignGoal,
        brief: input.brief ?? null,
        characterNotes: input.characterNotes ?? null,
        audioTrackId: input.audioTrackId ?? null,
        status: "draft",
      });
      return { id };
    }),

  /**
   * Generate the Director's Package for a campaign via the Expert Council.
   * This is the LLM call that produces the full storyboard, color palette,
   * character design, and shot list.
   */
  generatePackage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.id);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await updateCampaign(input.id, { status: "generating_package" });

      try {
        const systemPrompt = buildCampaignSystemPrompt(
          campaign.genre as CampaignGenre,
          campaign.durationMode as DurationMode,
          campaign.campaignGoal as CampaignGoal
        );

        const userPrompt = `
Campaign Title: ${campaign.title}
Artist Name: ${campaign.artistName ?? "The Artist"}
Campaign Brief: ${campaign.brief ?? "Create a compelling music video that captures the essence of the artist and their sound."}
Character Notes: ${campaign.characterNotes ?? "No specific character notes provided."}
Duration Mode: ${campaign.durationMode}
Genre: ${GENRE_GRAMMAR[campaign.genre as CampaignGenre].name}

Generate the complete Director's Package as a JSON object. Every field is required. Be specific, physical, and grounded in the genre visual grammar. No generic cinematic language.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "directors_package",
              strict: false,
              schema: {
                type: "object",
                properties: {
                  logline: { type: "string" },
                  visualIdentityStatement: { type: "string" },
                  colorPalette: { type: "object" },
                  characterDesign: { type: "object" },
                  setDesign: { type: "array" },
                  shotList: { type: "array" },
                  productionNotes: { type: "object" },
                  artDepartmentNotes: { type: "object" },
                  directorStatement: { type: "string" },
                },
                required: ["logline", "shotList", "colorPalette", "characterDesign", "setDesign"],
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        if (!content) throw new Error("No response from Expert Council");

        const pkg = JSON.parse(content) as DirectorsPackage;

        // Save the package and create shot records
        await updateCampaign(input.id, {
          status: "package_ready",
          directorsPackage: pkg as unknown as Record<string, unknown>,
          campaignPrompt: pkg.logline,
        });

        // Create individual shot records from the storyboard
        const shotStructure = DURATION_SHOT_COUNT[campaign.durationMode as DurationMode];
        for (const shot of pkg.shotList) {
          const videoPrompt = buildShotPrompt({
            genre: campaign.genre as CampaignGenre,
            shotDescription: shot.description,
            shotType: shot.shotType,
            cameraMovement: shot.cameraMovement,
            lightingNote: shot.lightingNote,
            atmosphericNote: shot.atmosphericNote,
            colorPalette: {
              primary: pkg.colorPalette?.primary ?? "",
              secondary: pkg.colorPalette?.secondary ?? "",
              grade: pkg.colorPalette?.grade ?? "",
            },
            characterDescription: pkg.characterDesign?.appearance ?? "",
            durationSeconds: shot.durationSeconds ?? Math.floor(shotStructure.totalSeconds / pkg.shotList.length),
          });

          await createCampaignShot({
            campaignId: input.id,
            shotNumber: shot.shotNumber,
            description: shot.description,
            shotType: shot.shotType,
            cameraMovement: shot.cameraMovement,
            lightingNote: shot.lightingNote,
            durationSeconds: shot.durationSeconds ?? 5,
            videoPrompt,
            videoStatus: "none",
            progress: 0,
          });
        }

        return { success: true, package: pkg };
      } catch (err) {
        await updateCampaign(input.id, { status: "failed" });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate Director's Package: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Generate video for a single shot.
   */
  generateShot: protectedProcedure
    .input(z.object({ campaignId: z.number(), shotId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const shots = await getCampaignShots(input.campaignId);
      const shot = shots.find((s) => s.id === input.shotId);
      if (!shot) throw new TRPCError({ code: "NOT_FOUND", message: "Shot not found" });
      if (!shot.videoPrompt) throw new TRPCError({ code: "BAD_REQUEST", message: "Shot has no video prompt" });

      await updateCampaignShot(input.shotId, { videoStatus: "queued" });

      try {
        const result = await generateVideo({
          prompt: shot.videoPrompt,
          durationSeconds: shot.durationSeconds ?? 5,
          referenceImageUrl: campaign.moodBoardPrimaryImageUrl ?? undefined,
        });
        if (result.status === "failed") {
          throw new Error(result.error ?? "Video generation failed");
        }
        const jobId = result.jobId ?? "";
        await updateCampaignShot(input.shotId, {
          videoStatus: "generating",
          videoJobId: jobId,
          progress: 5,
        });
        return { jobId };
      } catch (err) {
        await updateCampaignShot(input.shotId, {
          videoStatus: "failed",
          videoError: err instanceof Error ? err.message : String(err),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to start shot generation: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Poll the status of a shot generation job.
   */
  pollShot: protectedProcedure
    .input(z.object({ campaignId: z.number(), shotId: z.number() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const shots = await getCampaignShots(input.campaignId);
      const shot = shots.find((s) => s.id === input.shotId);
      if (!shot) throw new TRPCError({ code: "NOT_FOUND" });

      // If already complete or failed, return current state
      if (shot.videoStatus === "complete" || shot.videoStatus === "failed") {
        return shot;
      }

      // If generating, poll the Runway API
      if (shot.videoStatus === "generating" && shot.videoJobId) {
        try {
          const provider = getActiveProvider();
          const result = await pollVideoStatus(provider, shot.videoJobId);

          if (result.status === "complete" && result.videoUrl) {
            // Download from Runway and save to our S3
            const videoResponse = await fetch(result.videoUrl);
            if (videoResponse.ok) {
              const buffer = Buffer.from(await videoResponse.arrayBuffer());
              const fileKey = `campaign-shots/${input.campaignId}-shot${shot.shotNumber}-${Date.now()}.mp4`;
              const { url: s3Url } = await storagePut(fileKey, buffer, "video/mp4");
              await updateCampaignShot(input.shotId, {
                videoStatus: "complete",
                videoUrl: s3Url,
                progress: 100,
              });
              return { ...shot, videoStatus: "complete" as const, videoUrl: s3Url, progress: 100 };
            }
          } else if (result.status === "failed") {
            await updateCampaignShot(input.shotId, {
              videoStatus: "failed",
              videoError: "error" in result ? result.error : "Generation failed",
            });
          } else {
            // Still generating — update progress
            const progress = ("progress" in result ? result.progress : undefined) ?? shot.progress ?? 10;
            await updateCampaignShot(input.shotId, { progress });
          }
        } catch (err) {
          console.error(`[pollShot] Error polling shot ${input.shotId}:`, err);
        }
      }

      // Return fresh shot state
      const updatedShots = await getCampaignShots(input.campaignId);
      return updatedShots.find((s) => s.id === input.shotId) ?? shot;
    }),

  /**
   * Update campaign details.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        brief: z.string().optional(),
        characterNotes: z.string().optional(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.id);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await updateCampaign(id, data);
      return { success: true };
    }),

  /**
   * Delete a campaign and all its shots.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.id);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteCampaign(input.id);
      return { success: true };
    }),

  /**
   * Retry a single failed or stuck shot.
   */
  retryShot: protectedProcedure
    .input(z.object({ campaignId: z.number(), shotId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const shots = await getCampaignShots(input.campaignId);
      const shot = shots.find((s) => s.id === input.shotId);
      if (!shot) throw new TRPCError({ code: "NOT_FOUND", message: "Shot not found" });
      if (!shot.videoPrompt) throw new TRPCError({ code: "BAD_REQUEST", message: "Shot has no video prompt" });
      await updateCampaignShot(input.shotId, {
        videoStatus: "queued",
        videoError: null,
        videoJobId: null,
        progress: 0,
      });
      try {
        const result = await generateVideo({
          prompt: shot.videoPrompt,
          durationSeconds: shot.durationSeconds ?? 5,
          referenceImageUrl: campaign.moodBoardPrimaryImageUrl ?? undefined,
        });
        if (result.status === "failed") throw new Error(result.error ?? "Video generation failed");
        const jobId = result.jobId ?? "";
        await updateCampaignShot(input.shotId, { videoStatus: "generating", videoJobId: jobId, progress: 5 });
        return { jobId };
      } catch (err) {
        await updateCampaignShot(input.shotId, {
          videoStatus: "failed",
          videoError: err instanceof Error ? err.message : String(err),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to retry shot: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Retry all failed or stuck shots in a campaign at once.
   */
  retryAllFailed: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const shots = await getCampaignShots(input.campaignId);
      const failedShots = shots.filter(
        (s) => s.videoStatus === "failed" || (s.videoStatus === "generating" && !s.videoJobId)
      );
      if (failedShots.length === 0) return { retried: 0, errors: [] };
      let retried = 0;
      const errors: string[] = [];
      for (const shot of failedShots) {
        if (!shot.videoPrompt) continue;
        await updateCampaignShot(shot.id, { videoStatus: "queued", videoError: null, videoJobId: null, progress: 0 });
        try {
          const result = await generateVideo({
            prompt: shot.videoPrompt,
            durationSeconds: shot.durationSeconds ?? 5,
            referenceImageUrl: campaign.moodBoardPrimaryImageUrl ?? undefined,
          });
          if (result.status === "failed") throw new Error(result.error ?? "Generation failed");
          const jobId = result.jobId ?? "";
          await updateCampaignShot(shot.id, { videoStatus: "generating", videoJobId: jobId, progress: 5 });
          retried++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Shot ${shot.shotNumber}: ${msg}`);
          await updateCampaignShot(shot.id, { videoStatus: "failed", videoError: msg });
        }
      }
      if (retried > 0) await updateCampaign(input.campaignId, { status: "generating_shots" });
      return { retried, errors };
    }),

  /**
   * Edit the prompt for a shot and optionally regenerate immediately.
   * If regenerate=true, the shot is submitted to Runway with the new prompt.
   * If regenerate=false, the prompt is saved and the shot status is reset to 'none'
   * so the user can generate it manually when ready.
   */
  editShotPrompt: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        shotId: z.number(),
        prompt: z.string().min(1).max(1000),
        regenerate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const shots = await getCampaignShots(input.campaignId);
      const shot = shots.find((s) => s.id === input.shotId);
      if (!shot) throw new TRPCError({ code: "NOT_FOUND", message: "Shot not found" });

      if (!input.regenerate) {
        // Save prompt only — reset to 'none' so user can generate when ready
        await updateCampaignShot(input.shotId, {
          videoPrompt: input.prompt,
          videoStatus: "none",
          videoUrl: null,
          videoJobId: null,
          videoError: null,
          progress: 0,
        });
        return { saved: true, jobId: null };
      }

      // Save prompt and immediately submit to Runway
      await updateCampaignShot(input.shotId, {
        videoPrompt: input.prompt,
        videoStatus: "queued",
        videoUrl: null,
        videoJobId: null,
        videoError: null,
        progress: 0,
      });
      try {
        const result = await generateVideo({
          prompt: input.prompt,
          durationSeconds: shot.durationSeconds ?? 5,
          referenceImageUrl: campaign.moodBoardPrimaryImageUrl ?? undefined,
        });
        if (result.status === "failed") throw new Error(result.error ?? "Video generation failed");
        const jobId = result.jobId ?? "";
        await updateCampaignShot(input.shotId, { videoStatus: "generating", videoJobId: jobId, progress: 5 });
        return { saved: true, jobId };
      } catch (err) {
        await updateCampaignShot(input.shotId, {
          videoStatus: "failed",
          videoError: err instanceof Error ? err.message : String(err),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to regenerate shot: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * Get all available genres with their visual grammar summaries.
   */
  getGenres: publicProcedure.query(() => {
    return Object.entries(GENRE_GRAMMAR).map(([key, grammar]) => ({
      id: key as CampaignGenre,
      name: grammar.name,
      colorPrimary: grammar.colorPalette.primary,
      colorAccent: grammar.colorPalette.accent,
      cameraStyle: grammar.cameraGrammar.movement,
      editRate: grammar.cameraGrammar.editRate,
      psychologicalBrief: grammar.psychologicalBrief,
    }));
  }),

  // ── Mood Board ─────────────────────────────────────────────────────────────────────────────

  /**
   * List all mood board images for a campaign.
   */
  moodBoardList: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getMoodBoardImages(input.campaignId);
    }),

  /**
   * Add a mood board image by URL.
   */
  moodBoardAddByUrl: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        imageUrl: z.string().url(),
        label: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await getMoodBoardImages(input.campaignId);
      if (existing.length >= 6) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 6 mood board images per campaign" });
      }
      const id = await addMoodBoardImage({
        campaignId: input.campaignId,
        imageUrl: input.imageUrl,
        label: input.label ?? null,
        isPrimary: existing.length === 0, // first image auto-becomes primary
        sortOrder: existing.length,
      });
      // If this is the first image, also cache as primary on the campaign
      if (existing.length === 0) {
        await setPrimaryMoodBoardImage(id, input.campaignId);
      }
      return { id };
    }),

  /**
   * Add a mood board image that was already uploaded to S3.
   * The frontend POSTs to /api/mood-board/upload first, then calls this to save metadata.
   */
  moodBoardSaveUpload: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        imageUrl: z.string().url(),
        imageKey: z.string(),
        label: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await getMoodBoardImages(input.campaignId);
      if (existing.length >= 6) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 6 mood board images per campaign" });
      }
      const id = await addMoodBoardImage({
        campaignId: input.campaignId,
        imageUrl: input.imageUrl,
        imageKey: input.imageKey,
        label: input.label ?? null,
        isPrimary: existing.length === 0,
        sortOrder: existing.length,
      });
      if (existing.length === 0) {
        await setPrimaryMoodBoardImage(id, input.campaignId);
      }
      return { id };
    }),

  /**
   * Remove a mood board image.
   */
  moodBoardRemove: protectedProcedure
    .input(z.object({ campaignId: z.number(), imageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await removeMoodBoardImage(input.imageId, input.campaignId);
      return { removed: true };
    }),

  /**
   * Set the primary mood board image (the one passed to Runway as a style reference).
   */
  moodBoardSetPrimary: protectedProcedure
    .input(z.object({ campaignId: z.number(), imageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await setPrimaryMoodBoardImage(input.imageId, input.campaignId);
      return { primary: true };
    }),

  /**
   * Clear the primary mood board image (no reference image will be used).
   */
  moodBoardClearPrimary: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await clearPrimaryMoodBoardImage(input.campaignId);
      return { cleared: true };
    }),

  /**
   * Publish a campaign (set isPublic: true).
   *
   * Free-tier users (role === 'user'):
   * - Enforces the 8-published-song limit with a soft-landing message.
   * - Silently auto-generates cover art if none exists yet (one-time, platform
   *   default vocabulary + lyrics, 'arriving' arc position). Fire-and-forget —
   *   never blocks the publish response.
   *
   * Premium users (role === 'admin'):
   * - No song limit.
   * - No auto-generate (they control art via CoverArtCard).
   */
  publish: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        /** Optional lyrics passed to the auto-generate pipeline for free-tier users. */
        lyrics: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { campaignId, lyrics } = input;
      const userId = ctx.user.id;
      const isPremium = ctx.user.role === "admin";

      // 1. Verify ownership ────────────────────────────────────────────────────
      const campaign = await getCampaignById(campaignId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });

      // 2. Free-tier: enforce 8-published-song limit ───────────────────────────
      const FREE_TIER_SONG_LIMIT = 8;
      if (!isPremium) {
        const allCampaigns = await getCampaignsByUser(userId);
        const publishedCount = allCampaigns.filter((c) => c.isPublic && c.id !== campaignId).length;
        if (publishedCount >= FREE_TIER_SONG_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              `You've built something real here \u2014 ${publishedCount} songs and counting. ` +
              `Upgrade to keep going and unlock your full Visual Universe.`,
          });
        }
      }

      // 3. Mark as public ──────────────────────────────────────────────────────
      await updateCampaign(campaignId, { isPublic: true });

      // 4. Free-tier: silent one-time auto-generate (fire and forget) ──────────
      if (!isPremium) {
        const coverArtState = await getCampaignCoverArt(campaignId);
        const hasNoCoverArt = !coverArtState?.coverArtUrl;
        const hasNotGeneratedBefore = (coverArtState?.coverArtRegenerationsUsed ?? 0) === 0;

        if (hasNoCoverArt && hasNotGeneratedBefore) {
          void (async () => {
            try {
              const { resolveVocabulary, extractLyricPhrases, buildCoverArtPrompt } =
                await import("../coverArt/promptBuilder");
              const { generateImage } = await import("../_core/imageGeneration");

              const { vocabulary } = await resolveVocabulary(userId);
              let lyricPhrases: string[] = [];
              if (lyrics && lyrics.trim().length > 0) {
                lyricPhrases = await extractLyricPhrases(lyrics);
              }
              const { prompt } = buildCoverArtPrompt({
                vocabulary,
                arcPosition: "arriving",
                lyricPhrases,
                genre: campaign.genre ?? undefined,
              });
              const result = await generateImage({ prompt });
              if (result.url) {
                await setCampaignCoverArtFromGeneration(campaignId, result.url, false);
                console.log(`[publish] Auto-generated cover art for campaign ${campaignId} (free tier)`);
              }
            } catch (err) {
              // Silent failure — never block the publish response
              console.warn(`[publish] Auto-generate cover art failed for campaign ${campaignId}:`, err);
            }
          })();
        }
      }

      return { published: true, campaignId };
    }),
});
