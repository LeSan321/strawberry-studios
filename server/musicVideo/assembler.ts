/**
 * assembler.ts — Music Video Pipeline Stage 7
 * ============================================
 * Assembles the final music video from generated shot clips using ffmpeg.
 *
 * Strategy:
 *   1. Download all completed shot clips to temp files
 *   2. Build an ffmpeg concat list
 *   3. Run ffmpeg to concatenate clips into a single MP4
 *   4. Upload the assembled MP4 to S3
 *   5. Generate an MLT project file (for Kdenlive editing)
 *   6. Upload the MLT file to S3
 *   7. Update the music video record with output URLs
 *
 * The MLT file is a bonus deliverable — it allows the creator to open the
 * assembled project in Kdenlive for fine editing. The MP4 is the primary
 * deliverable for immediate playback.
 *
 * Note: This module requires ffmpeg to be installed in the runtime environment.
 * The Dockerfile installs ffmpeg via apt-get.
 */

import { spawn } from "child_process";
import {
  createWriteStream,
  unlinkSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import https from "https";
import http from "http";
import { getMusicVideoShots, updateMusicVideo } from "../db";
import { storagePut } from "../storage";
import type { MusicVideoShot } from "../../drizzle/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Download a URL to a local temp file. Returns the temp file path. */
function downloadToTemp(url: string, ext = "mp4"): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpPath = join(
      tmpdir(),
      `mv-clip-${randomBytes(8).toString("hex")}.${ext}`
    );
    const file = createWriteStream(tmpPath);
    const protocol = url.startsWith("https") ? https : http;

    protocol.get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        file.close();
        unlinkSync(tmpPath);
        downloadToTemp(res.headers.location, ext).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download clip: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(tmpPath)));
      file.on("error", (err) => {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
        reject(err);
      });
    }).on("error", reject);
  });
}

/** Run an ffmpeg command. Returns stdout/stderr. */
function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { timeout: 300_000 }); // 5 min max
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}. stderr: ${stderr.slice(-2000)}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

/** Probe a video file for duration using ffprobe */
async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try {
        const data = JSON.parse(out) as { format?: { duration?: string } };
        resolve(parseFloat(data.format?.duration ?? "0") || 0);
      } catch {
        resolve(0);
      }
    });
    proc.on("error", () => resolve(0));
  });
}

// ─── MLT project file generator ──────────────────────────────────────────────

/**
 * Generate a minimal MLT (Kdenlive) project file from the assembled clips.
 * This is a valid MLT XML file that Kdenlive can open for fine editing.
 */
function generateMltProject(
  clips: Array<{ path: string; durationSeconds: number; shotIndex: number }>,
  outputPath: string,
  title: string
): void {
  const fps = 25;
  let currentFrame = 0;

  const producers = clips
    .map((clip, i) => {
      const durationFrames = Math.round(clip.durationSeconds * fps);
      return `  <producer id="producer${i}" in="0" out="${durationFrames - 1}">
    <property name="resource">${clip.path}</property>
    <property name="mlt_service">avformat</property>
  </producer>`;
    })
    .join("\n");

  const entries = clips
    .map((clip, i) => {
      const durationFrames = Math.round(clip.durationSeconds * fps);
      const entry = `      <entry producer="producer${i}" in="0" out="${durationFrames - 1}" />`;
      currentFrame += durationFrames;
      return entry;
    })
    .join("\n");

  const totalFrames = currentFrame;

  const mlt = `<?xml version="1.0" encoding="utf-8"?>
<mlt version="7.0.0" title="${title.replace(/"/g, "&quot;")}" LC_NUMERIC="C">
  <profile description="HD 1080p 25fps" width="1920" height="1080" progressive="1"
           sample_aspect_num="1" sample_aspect_den="1"
           display_aspect_num="16" display_aspect_den="9"
           frame_rate_num="${fps}" frame_rate_den="1" colorspace="709" />

${producers}

  <playlist id="main_bin">
    <property name="kdenlive:docproperties.version">1.0</property>
${entries}
  </playlist>

  <tractor id="tractor0" in="0" out="${totalFrames - 1}">
    <track producer="main_bin" />
  </tractor>
</mlt>
`;

  writeFileSync(outputPath, mlt, "utf-8");
}

// ─── Main assembler ───────────────────────────────────────────────────────────

/**
 * Assemble the final music video from completed shot clips.
 *
 * Downloads all completed shots, concatenates them with ffmpeg,
 * uploads the result to S3, and updates the music video record.
 */
export async function assembleMusicVideo(
  musicVideoId: number,
  shots: MusicVideoShot[]
): Promise<void> {
  const workDir = join(tmpdir(), `mv-assembly-${musicVideoId}-${randomBytes(6).toString("hex")}`);
  mkdirSync(workDir, { recursive: true });

  const tempFiles: string[] = [];

  try {
    // Filter to completed shots with video URLs, sorted by shot index
    const completedShots = shots
      .filter((s) => s.videoStatus === "complete" && s.videoUrl)
      .sort((a, b) => a.shotIndex - b.shotIndex);

    if (completedShots.length === 0) {
      throw new Error("No completed shots with video URLs to assemble");
    }

    console.log(
      `[Assembler] Downloading ${completedShots.length} clips for music video ${musicVideoId}`
    );

    // Download all clips
    const clipPaths: Array<{ path: string; shot: MusicVideoShot; duration: number }> = [];

    for (const shot of completedShots) {
      const clipPath = join(workDir, `shot-${shot.shotIndex.toString().padStart(3, "0")}.mp4`);
      await downloadToTemp(shot.videoUrl!).then((tmpPath) => {
        // Move to workDir with a predictable name
        require("fs").renameSync(tmpPath, clipPath);
      });
      tempFiles.push(clipPath);

      const duration = await probeDuration(clipPath);
      clipPaths.push({ path: clipPath, shot, duration });

      console.log(
        `[Assembler] Downloaded shot ${shot.shotIndex}: ${duration.toFixed(1)}s`
      );
    }

    // Build ffmpeg concat list
    const concatListPath = join(workDir, "concat.txt");
    const concatContent = clipPaths
      .map((c) => `file '${c.path}'`)
      .join("\n");
    writeFileSync(concatListPath, concatContent, "utf-8");
    tempFiles.push(concatListPath);

    // Run ffmpeg concat
    const outputPath = join(workDir, "assembled.mp4");
    tempFiles.push(outputPath);

    console.log(`[Assembler] Running ffmpeg concat for music video ${musicVideoId}`);

    await runFfmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ]);

    console.log(`[Assembler] ffmpeg concat complete for music video ${musicVideoId}`);

    // Upload assembled MP4 to S3
    const { readFileSync } = await import("fs");
    const mp4Buffer = readFileSync(outputPath);
    const mp4Key = `music-videos/${musicVideoId}/assembled-${Date.now()}.mp4`;
    const { url: assembledVideoUrl } = await storagePut(mp4Key, mp4Buffer, "video/mp4");

    console.log(`[Assembler] Uploaded assembled video: ${assembledVideoUrl.slice(0, 60)}...`);

    // Generate MLT project file
    const mltPath = join(workDir, "project.mlt");
    tempFiles.push(mltPath);

    generateMltProject(
      clipPaths.map((c) => ({
        path: c.path,
        durationSeconds: c.duration,
        shotIndex: c.shot.shotIndex,
      })),
      mltPath,
      `Music Video ${musicVideoId}`
    );

    // Upload MLT file to S3
    const mltBuffer = readFileSync(mltPath);
    const mltKey = `music-videos/${musicVideoId}/project-${Date.now()}.mlt`;
    const { url: mltFileUrl } = await storagePut(mltKey, mltBuffer, "application/xml");

    console.log(`[Assembler] Uploaded MLT project: ${mltFileUrl.slice(0, 60)}...`);

    // Update music video record
    await updateMusicVideo(musicVideoId, {
      status: "complete",
      finalVideoUrl: assembledVideoUrl,
      projectFileUrl: mltFileUrl,
      finalizedAt: new Date(),
    });

    console.log(`[Assembler] Music video ${musicVideoId} assembly complete`);
  } finally {
    // Clean up temp files
    for (const f of tempFiles) {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch { /* ignore */ }
    }
    // Remove work directory
    try {
      require("fs").rmdirSync(workDir, { recursive: true });
    } catch { /* ignore */ }
  }
}
