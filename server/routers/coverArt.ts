/**
 * Cover Art Router — Phase M (with Evaluator + Adaptive Controller)
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
 *
 * Evaluation pipeline (runs after every generation):
 *   1. evaluateCoverArtPrompt() — 5-dimension structural QA check
 *   2. appendCoverArtGenerationLog() — persist log entry for adaptive system
 *   3. shouldAdapt() + runAdaptationCycle() — update weights every 20 gens
 *      (only when rolling window ≥ 50 entries)
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
  appendCoverArtGenerationLog,
  getRecentCoverArtGenerationLogs,
  getCoverArtGenerationLogCount,
  getCoverArtAdaptiveWeights,
  upsertCoverArtAdaptiveWeights,
} from "../db";
import {
  buildCoverArtPrompt,
  extractLyricPhrases,
  resolveVocabulary,
  type ArcPosition,
} from "../coverArt/promptBuilder";
import {
  evaluateCoverArtPrompt,
  resolveLifeSignals,
} from "../coverArt/coverArtEvaluator";
import {
  buildDefaultAdaptiveWeights,
  computeStabilityMetrics,
  shouldAdapt,
  runAdaptationCycle,
  WINDOW_SIZE,
} from "../coverArt/coverArtAdaptiveController";

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
   *   campaignId     — The campaign to generate cover art for
   *   arcPosition    — The arc position (gathering / arriving / open)
   *   lyrics         — Optional song lyrics for the lyric extraction step
   *   isRegeneration — True if this is a regeneration (not the first generation)
   *
   * The procedure:
   *   1. Verifies the campaign belongs to the authenticated user
   *   2. Checks the regeneration cap (throws if limit reached)
   *   3. Resolves the vocabulary (personal frequency or platform default)
   *   4. Extracts lyric phrases via LLM (if lyrics provided)
   *   5. Assembles the prompt via buildCoverArtPrompt()
   *   6. Runs the Auto-Evaluation Heuristic (structural QA)
   *   7. Calls generateImage() to produce the image
   *   8. Stores the result and updates the regeneration count
   *   9. Persists the generation log entry
   *  10. Runs the adaptive weight cycle if conditions are met
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
        lastUsedLifeSignalIds: currentState.lastUsedLifeSignalIds ?? [],
      });

      // ── 6. Auto-Evaluation Heuristic ─────────────────────────────────────────
      const injectedSignals = resolveLifeSignals(layers.lifeSignalIds);
      const evaluation = evaluateCoverArtPrompt({
        prompt,
        arc: arcPosition as ArcPosition,
        injectedSignals,
        lastUsedSignalIds: currentState.lastUsedLifeSignalIds ?? [],
      });

      console.log(
        "[coverArt.generate] QA evaluation:",
        `total=${evaluation.totalScore}/20`,
        `healthy=${evaluation.isHealthy}`,
        evaluation.warnings.length > 0 ? `warnings=${evaluation.warnings.join("; ")}` : ""
      );

      // ── 7. Generate image ────────────────────────────────────────────────────
      console.log("[coverArt.generate] vocabSource:", vocabSource, "lyricPhrases:", lyricPhrases);
      console.log("[coverArt.generate] prompt:", prompt);

      let imageUrl: string;
      try {
        const result = await generateImage({ prompt });
        if (!result.url) {
          throw new Error("Image generation returned no URL");
        }
        imageUrl = result.url;
        console.log("[coverArt.generate] success, url:", imageUrl);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[coverArt.generate] Image generation failed:", errMsg);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Cover art generation failed: ${errMsg}`,
        });
      }

      // ── 8. Store result ──────────────────────────────────────────────────────
      const isFirstGeneration = !isRegeneration && currentState.coverArtSource === "none";
      await setCampaignCoverArtFromGeneration(
        campaignId,
        imageUrl,
        isFirstGeneration,
        layers.lifeSignalIds
      );

      // ── 9. Persist generation log (fire-and-forget) ──────────────────────────
      const intensityTotal = injectedSignals.reduce(
        (sum, s) => sum + (s.intensity === "moderate" ? 2 : 1),
        0
      );

      appendCoverArtGenerationLog({
        userId,
        arc: arcPosition as ArcPosition,
        lifeSignalIds: layers.lifeSignalIds,
        lifeSignalIntensityTotal: intensityTotal,
        qaScores: {
          coherence: evaluation.coherenceScore,
          depth: evaluation.depthScore,
          tension: evaluation.tensionScore,
          lifeSignal: evaluation.lifeSignalScore,
          arcAlignment: evaluation.arcAlignmentScore,
          total: evaluation.totalScore,
        },
        timestamp: Date.now(),
      }).catch((err) => {
        console.warn("[coverArt.generate] Failed to persist generation log:", err);
      });

      // ── 10. Adaptive weight cycle (fire-and-forget) ──────────────────────────
      runAdaptiveWeightCycleIfNeeded(userId).catch((err) => {
        console.warn("[coverArt.generate] Adaptive weight cycle error:", err);
      });

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
        evaluation: {
          totalScore: evaluation.totalScore,
          isHealthy: evaluation.isHealthy,
          warnings: evaluation.warnings,
          scores: {
            coherence: evaluation.coherenceScore,
            depth: evaluation.depthScore,
            tension: evaluation.tensionScore,
            lifeSignal: evaluation.lifeSignalScore,
            arcAlignment: evaluation.arcAlignmentScore,
          },
        },
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

// ─── Adaptive Weight Cycle Helper ────────────────────────────────────────────

/**
 * Runs the adaptive weight cycle for a user if the conditions are met.
 * Fires asynchronously after each generation — never blocks the response.
 *
 * Conditions:
 *   - generationsSinceLastAdaptation >= ADAPTATION_INTERVAL (20)
 *   - rolling window size >= WINDOW_SIZE (50)
 */
async function runAdaptiveWeightCycleIfNeeded(userId: number): Promise<void> {
  // Load or initialize adaptive weights
  const existing = await getCoverArtAdaptiveWeights(userId);
  const weights = existing
    ? {
        signalWeights: existing.signalWeights as Record<string, number>,
        domainWeights: existing.domainWeights as Record<string, number>,
        generationsSinceLastAdaptation: existing.generationsSinceLastAdaptation,
        totalGenerations: existing.totalGenerations,
        lastAdaptedAt: existing.lastAdaptedAt ?? null,
      }
    : buildDefaultAdaptiveWeights();

  // Increment counters
  weights.generationsSinceLastAdaptation++;
  weights.totalGenerations++;

  // Check if adaptation should fire
  const windowSize = await getCoverArtGenerationLogCount(userId);

  if (!shouldAdapt(weights, windowSize)) {
    // Just update the counters
    await upsertCoverArtAdaptiveWeights(userId, weights);
    return;
  }

  // Load the rolling window for metrics computation
  const recentLogs = await getRecentCoverArtGenerationLogs(userId, WINDOW_SIZE);
  const metrics = computeStabilityMetrics(recentLogs);

  // Run the adaptation cycle
  const { updatedWeights, report } = runAdaptationCycle(weights, metrics);

  console.log(
    "[coverArt.adaptive] Adaptation cycle fired:",
    `rules=${report.rulesApplied.length}`,
    `ldi=${(metrics.ldi * 100).toFixed(0)}%`,
    `avgTotal=${metrics.avgTotal.toFixed(1)}`
  );

  await upsertCoverArtAdaptiveWeights(userId, updatedWeights);
}
