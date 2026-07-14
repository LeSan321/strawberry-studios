/**
 * audioAnalyzer.ts — Music Video Pipeline Stage 2
 * ================================================
 * Calls the Python librosa script as a subprocess to analyze an audio file.
 * Downloads the audio from S3/URL to a temp file, runs the script, parses the
 * JSON output, and stores the results in the music_video_audio_structure table.
 *
 * The Python script (scripts/analyze_audio.py) must be present in the working
 * directory at runtime. In production this is /app/scripts/analyze_audio.py.
 */

import { spawn } from "child_process";
import { createWriteStream, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import https from "https";
import http from "http";
import { getDb } from "../db";
import { musicVideoAudioStructure, musicVideos } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioSection {
  label: string;
  startSeconds: number;
  endSeconds: number;
}

export interface EnergyPoint {
  timeSeconds: number;
  rms: number;
}

export interface AudioAnalysisResult {
  tempoBpm: number;
  beatGrid: number[];
  sections: AudioSection[];
  energyEnvelope: EnergyPoint[];
  durationSeconds: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the path to the Python analysis script.
 *  In production (Docker): /app/scripts/analyze_audio.py
 *  In development (sandbox): relative to project root
 */
function getScriptPath(): string {
  // __dirname is server/musicVideo/ — go up two levels to project root
  const projectRoot = join(__dirname, "..", "..");
  const scriptPath = join(projectRoot, "scripts", "analyze_audio.py");
  if (existsSync(scriptPath)) return scriptPath;
  // Fallback for production dist layout (dist/index.js is at /app/dist/)
  const prodPath = join(__dirname, "..", "..", "..", "scripts", "analyze_audio.py");
  if (existsSync(prodPath)) return prodPath;
  throw new Error(`analyze_audio.py not found. Checked: ${scriptPath}, ${prodPath}`);
}

/** Download a URL to a temp file. Returns the temp file path. */
function downloadToTemp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = url.split("?")[0].split(".").pop() || "mp3";
    const tmpPath = join(tmpdir(), `mv-audio-${randomBytes(8).toString("hex")}.${ext}`);
    const file = createWriteStream(tmpPath);
    const protocol = url.startsWith("https") ? https : http;

    protocol.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        file.close();
        unlinkSync(tmpPath);
        downloadToTemp(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download audio: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(tmpPath)));
      file.on("error", (err) => {
        unlinkSync(tmpPath);
        reject(err);
      });
    }).on("error", reject);
  });
}

/** Run the Python analysis script on a local file path. */
function runPythonAnalyzer(audioPath: string): Promise<AudioAnalysisResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = getScriptPath();
    const proc = spawn("python3", [scriptPath, audioPath], {
      timeout: 120_000, // 2 minutes max
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Audio analyzer exited with code ${code}. stderr: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as AudioAnalysisResult;
        if (result && typeof result === "object" && "error" in result) {
          reject(new Error((result as { error: string }).error));
          return;
        }
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse analyzer output: ${stdout.slice(0, 500)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn python3: ${err.message}`));
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze the audio for a music video project.
 *
 * Downloads the audio file from the provided URL, runs the librosa analysis
 * script, stores the results in music_video_audio_structure, and updates
 * the music video's durationSeconds if not already set.
 *
 * @param musicVideoId  The music video project ID
 * @param audioUrl      Public S3/CDN URL of the audio file
 * @returns             The analysis result
 */
export async function analyzeMusicVideoAudio(
  musicVideoId: number,
  audioUrl: string
): Promise<AudioAnalysisResult> {
  let tmpPath: string | null = null;

  try {
    // Download audio to temp file
    tmpPath = await downloadToTemp(audioUrl);

    // Run Python analyzer
    const result = await runPythonAnalyzer(tmpPath);

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Upsert into music_video_audio_structure
    await db
      .insert(musicVideoAudioStructure)
      .values({
        musicVideoId,
        tempoBpm: Math.round(result.tempoBpm),
        beatGridJson: result.beatGrid,
        sectionsJson: result.sections,
        energyEnvelopeJson: result.energyEnvelope,
      })
      .onDuplicateKeyUpdate({
        set: {
          tempoBpm: Math.round(result.tempoBpm),
          beatGridJson: result.beatGrid,
          sectionsJson: result.sections,
          energyEnvelopeJson: result.energyEnvelope,
          analyzedAt: new Date(),
        },
      });

    // Update durationSeconds on the music video if not already set
    if (result.durationSeconds > 0) {
      await db
        .update(musicVideos)
        .set({ durationSeconds: Math.round(result.durationSeconds) })
        .where(eq(musicVideos.id, musicVideoId));
    }

    return result;
  } finally {
    // Always clean up the temp file
    if (tmpPath && existsSync(tmpPath)) {
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}

/**
 * Retrieve the stored audio structure for a music video.
 * Returns null if analysis has not been run yet.
 */
export async function getMusicVideoAudioStructure(
  musicVideoId: number
): Promise<{
  tempoBpm: number | null;
  beatGrid: number[];
  sections: AudioSection[];
  energyEnvelope: EnergyPoint[];
} | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(musicVideoAudioStructure)
    .where(eq(musicVideoAudioStructure.musicVideoId, musicVideoId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    tempoBpm: row.tempoBpm,
    beatGrid: (row.beatGridJson as number[]) ?? [],
    sections: (row.sectionsJson as AudioSection[]) ?? [],
    energyEnvelope: (row.energyEnvelopeJson as EnergyPoint[]) ?? [],
  };
}
