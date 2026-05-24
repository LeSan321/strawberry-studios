/**
 * Cover Art Router — Phase M
 *
 * tRPC procedures for cover art generation and management.
 *
 * Procedures:
 *   coverArt.getState       — Get current cover art state for a campaign
 *   coverArt.generate       — Generate cover art for a campaign (protected)
 *   coverArt.setFromUpload  — Record an upload-based cover art URL (protected)
 *
 * Regeneration cap: 3 per campaign, never resets. The first generation is
 * not counted as a "regeneration" — it is the initial generation.
 * Regenerations 1, 2, and 3 increment the counter. After 3, generation
 * is permanently disabled for that campaign.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { generateImage } from "../_core/imageGeneration";
import {
  getCampaignById,
  getCampaignCoverArt,
  setCampaignCoverArtFromGeneration,
  setCampaignCoverArtFromUpload,
  COVER_ART_REGEN_LIMIT,
} from "../db";
import {
  buildCoverArtPrompt,
  extractLyricPhrases,
  resolveVocabulary,
  type ArcPosition,
} from "../coverArt/promptBuilder";

export const coverArtRouter = router({
  /**
   * Get the current cover art state for a campaign.
   * Public procedure — cover art state is visible to anyone who can see the campaign.
   */
  getState: publicProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const state = await getCampaignCoverArt(input.campaignId);
      if (!state) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }
      return {
        coverArtUrl: state.coverArtUrl,
        coverArtSource: state.coverArtSource,
        coverArtGeneratedAt: state.coverArtGeneratedAt,
        coverArtRegenerationsUsed: state.coverArtRegenerationsUsed,
        regenLimit: COVER_ART_REGEN_LIMIT,
        regenRemaining: Math.max(0, COVER_ART_REGEN_LIMIT - state.coverArtRegenerationsUsed),
        canRegenerate:
          state.coverArtSource === "generated" &&
          state.coverArtRegenerationsUsed < COVER_ART_REGEN_LIMIT,
      };
    }),

  /**
   * Generate cover art for a campaign.
   *
   * Input:
   *   campaignId  — The campaign to generate cover art for
   *   arcPosition — The arc position (gathering / arriving / open)
   *   lyrics      — Optional song lyrics for the lyric extraction step
   *   isRegeneration — True if this is a regeneration (not the first generation)
   *
   * The procedure:
   *   1. Verifies the campaign belongs to the authenticated user
   *   2. Checks the regeneration cap (throws if limit reached)
   *   3. Resolves the vocabulary (personal frequency or platform default)
   *   4. Extracts lyric phrases via LLM (if lyrics provided)
   *   5. Assembles the prompt via buildCoverArtPrompt()
   *   6. Calls generateImage() to produce the image
   *   7. Stores the result and updates the regeneration count
   */
  generate: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        arcPosition: z.enum(["gathering", "arriving", "open"]).default("arriving"),
        lyrics: z.string().max(10000).optional(),
        genre: z.string().max(64).optional(),
        moodTags: z.array(z.string().max(32)).max(5).optional(),
        isRegeneration: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { campaignId, arcPosition, lyrics, genre, moodTags, isRegeneration } = input;
      const userId = ctx.user.id;

      // ── 1. Verify campaign ownership ────────────────────────────────────────
      const campaign = await getCampaignById(campaignId);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      if (campaign.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this campaign",
        });
      }

      // ── 2. Check regeneration cap ────────────────────────────────────────────
      const currentState = await getCampaignCoverArt(campaignId);
      if (!currentState) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign cover art state not found" });
      }

      if (isRegeneration) {
        if (currentState.coverArtRegenerationsUsed >= COVER_ART_REGEN_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Regeneration limit reached — upload your own image to change cover art.`,
          });
        }
      }

      // ── 3. Resolve vocabulary ────────────────────────────────────────────────
      const { vocabulary, source: vocabSource, frequencyName } = await resolveVocabulary(userId);

      // ── 4. Extract lyric phrases ─────────────────────────────────────────────
      let lyricPhrases: string[] = [];
      if (lyrics && lyrics.trim().length > 0) {
        lyricPhrases = await extractLyricPhrases(lyrics);
      }

      // ── 5. Assemble prompt ───────────────────────────────────────────────────
      const { prompt, charCount, wasTruncated, layers } = buildCoverArtPrompt({
        vocabulary,
        arcPosition: arcPosition as ArcPosition,
        lyricPhrases,
        genre,
        moodTags,
      });

      // ── 6. Generate image ────────────────────────────────────────────────────
      let imageUrl: string;
      try {
        const result = await generateImage({ prompt });
        if (!result.url) {
          throw new Error("Image generation returned no URL");
        }
        imageUrl = result.url;
      } catch (err) {
        console.error("[coverArt.generate] Image generation failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Cover art generation failed. Please try again.",
        });
      }

      // ── 7. Store result ──────────────────────────────────────────────────────
      const isFirstGeneration = !isRegeneration && currentState.coverArtSource === "none";
      await setCampaignCoverArtFromGeneration(campaignId, imageUrl, isFirstGeneration);

      // Return the result with debug info for development
      return {
        coverArtUrl: imageUrl,
        coverArtSource: "generated" as const,
        isFirstGeneration,
        prompt: {
          text: prompt,
          charCount,
          wasTruncated,
          layers,
        },
        vocabulary: {
          source: vocabSource,
          frequencyName: frequencyName ?? null,
        },
        lyricPhrasesExtracted: lyricPhrases,
        arcPosition,
      };
    }),

  /**
   * Record a cover art upload. The client uploads the file to S3 directly
   * and passes the resulting URL here to update the campaign record.
   *
   * Does NOT increment the regeneration count — by design.
   */
  setFromUpload: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        coverArtUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { campaignId, coverArtUrl } = input;
      const userId = ctx.user.id;

      const campaign = await getCampaignById(campaignId);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      if (campaign.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this campaign" });
      }

      await setCampaignCoverArtFromUpload(campaignId, coverArtUrl);

      return {
        coverArtUrl,
        coverArtSource: "uploaded" as const,
      };
    }),
});

export type CoverArtRouter = typeof coverArtRouter;
