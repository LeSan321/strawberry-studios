/**
 * shotOrchestrator.ts — Music Video Pipeline Stage 5
 * ====================================================
 * Orchestrates the generation of all pending shots for a music video project.
 *
 * For each pending shot:
 *   1. Submit a video generation job via generateVideo()
 *   2. Store the jobId on the shot record
 *   3. Poll until complete or failed (with exponential backoff)
 *   4. Store the resulting video URL on the shot record
 *   5. Update the shot status
 *
 * When all shots are done, advance the music video status to "awaiting_assembly".
 *
 * This function is designed to be called fire-and-forget from the tRPC router.
 * It handles its own error recovery and status updates.
 */

import {
  getMusicVideoShots,
  getMusicVideoById,
  updateMusicVideo,
  updateMusicVideoShot,
} from "../db";
import {
  generateVideo,
  pollVideoStatus,
  getActiveProvider,
  type VideoGenerationRequest,
} from "../videoGeneration";
import type { MusicVideoCharacter } from "../../drizzle/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum time to wait for a single shot to complete (in ms) */
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes
/** Initial polling interval (ms) — doubles on each attempt up to MAX_POLL_INTERVAL_MS */
const INITIAL_POLL_INTERVAL_MS = 5_000;
const MAX_POLL_INTERVAL_MS = 30_000;
/** Delay between submitting individual shots to avoid rate-limiting */
const SUBMISSION_DELAY_MS = 2_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll a job until it completes, fails, or times out */
async function pollUntilDone(
  provider: string,
  jobId: string,
  shotId: number
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  let interval = INITIAL_POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    await sleep(interval);
    interval = Math.min(interval * 1.5, MAX_POLL_INTERVAL_MS);

    try {
      const result = await pollVideoStatus(provider, jobId);

      if (result.status === "complete") {
        return { success: true, videoUrl: result.videoUrl };
      }
      if (result.status === "failed") {
        return { success: false, error: result.error };
      }
      // Still generating — log progress if available
      if ("progress" in result && result.progress !== undefined) {
        console.log(
          `[ShotOrchestrator] Shot ${shotId} progress: ${(result.progress * 100).toFixed(1)}%`
        );
      }
    } catch (err) {
      console.warn(
        `[ShotOrchestrator] Poll error for shot ${shotId}:`,
        err instanceof Error ? err.message : err
      );
      // Continue polling — transient errors are common
    }
  }

  return { success: false, error: "Timed out waiting for video generation" };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Generate all pending shots for a music video project.
 *
 * Called fire-and-forget from the tRPC router after the storyboard is approved.
 * Updates shot statuses in the DB as generation progresses.
 * Advances the music video status to "awaiting_assembly" when all shots are done.
 */
export async function generateMusicVideoShots(
  musicVideoId: number,
  characters: MusicVideoCharacter[]
): Promise<void> {
  const provider = getActiveProvider();
  console.log(
    `[ShotOrchestrator] Starting shot generation for music video ${musicVideoId} (provider: ${provider})`
  );

  const shots = await getMusicVideoShots(musicVideoId);
  const pendingShots = shots.filter((s) => s.videoStatus === "pending");

  if (pendingShots.length === 0) {
    console.log(`[ShotOrchestrator] No pending shots for music video ${musicVideoId}`);
    await updateMusicVideo(musicVideoId, { status: "assembling" });
    return;
  }

  console.log(
    `[ShotOrchestrator] Processing ${pendingShots.length} pending shots for music video ${musicVideoId}`
  );

  // Build a character lookup for reference images
  const characterMap = new Map(characters.map((c) => [c.id, c]));

  let completedCount = 0;
  let failedCount = 0;

  for (const shot of pendingShots) {
    // Add a small delay between submissions to avoid rate limits
    if (completedCount + failedCount > 0) {
      await sleep(SUBMISSION_DELAY_MS);
    }

    // Mark as generating
    await updateMusicVideoShot(shot.id, { videoStatus: "generating" });

    // Determine reference image: use the first character's reference image if present
    const characterIds = (shot.characterIds as number[]) ?? [];
    let referenceImageUrl: string | undefined;
    for (const charId of characterIds) {
      const char = characterMap.get(charId);
      if (char?.referenceImageUrl) {
        referenceImageUrl = char.referenceImageUrl;
        break;
      }
    }

    const request: VideoGenerationRequest = {
      prompt: shot.videoPrompt ?? "",
      durationSeconds: shot.targetDurationSeconds ?? 5,
      aspectRatio: "16:9",
      referenceImageUrl,
    };

    try {
      // Submit the generation job
      const submitResult = await generateVideo(request);

      if (submitResult.status === "failed") {
        console.error(
          `[ShotOrchestrator] Shot ${shot.id} submission failed: ${submitResult.error}`
        );
        await updateMusicVideoShot(shot.id, {
          videoStatus: "failed",
          videoError: submitResult.error,
        });
        failedCount++;
        continue;
      }

      if (submitResult.status === "complete") {
        // Mock provider returns immediately
        await updateMusicVideoShot(shot.id, {
          videoStatus: "complete",
          videoUrl: submitResult.videoUrl,
          videoJobId: submitResult.jobId,
        });
        completedCount++;
        console.log(`[ShotOrchestrator] Shot ${shot.id} complete (immediate)`);
        continue;
      }

      // status === "queued" — poll for completion
      const jobId = submitResult.jobId;
      await updateMusicVideoShot(shot.id, { videoJobId: jobId });

      console.log(`[ShotOrchestrator] Shot ${shot.id} queued as job ${jobId}`);

      const pollResult = await pollUntilDone(provider, jobId, shot.id);

      if (pollResult.success && pollResult.videoUrl) {
        await updateMusicVideoShot(shot.id, {
          videoStatus: "complete",
          videoUrl: pollResult.videoUrl,
        });
        completedCount++;
        console.log(`[ShotOrchestrator] Shot ${shot.id} complete`);
      } else {
        await updateMusicVideoShot(shot.id, {
          videoStatus: "failed",
          videoError: pollResult.error ?? "Unknown error",
        });
        failedCount++;
        console.error(
          `[ShotOrchestrator] Shot ${shot.id} failed: ${pollResult.error}`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ShotOrchestrator] Unexpected error for shot ${shot.id}:`, msg);
      await updateMusicVideoShot(shot.id, {
        videoStatus: "failed",
        videoError: msg,
      });
      failedCount++;
    }
  }

  console.log(
    `[ShotOrchestrator] Music video ${musicVideoId}: ${completedCount} completed, ${failedCount} failed`
  );

  // Advance status based on results
  if (completedCount > 0) {
    await updateMusicVideo(musicVideoId, { status: "assembling" });
  } else {
    await updateMusicVideo(musicVideoId, {
      status: "failed",
      errorMessage: `All ${failedCount} shots failed to generate`,
    });
  }
}
