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
  createCampaign,
  createCampaignShot,
  deleteCampaign,
  getCampaignById,
  getCampaignBySlug,
  getCampaignShots,
  getCampaignsByUser,
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
          const result = await generateVideo({ prompt: shot.videoPrompt, durationSeconds: shot.durationSeconds ?? 5 });
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
});
