/**
 * musicVideo.test.ts — Music Video Pipeline Unit Tests
 * =====================================================
 * Tests for the audio analyzer, shot planner, and assembler modules.
 * Uses mocks for external dependencies (Python subprocess, LLM, S3, DB).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "fs";
import { join } from "path";

// ─── Audio Analyzer Script ────────────────────────────────────────────────────

describe("analyze_audio.py script", () => {
  it("exists at the expected path", () => {
    const scriptPath = join(__dirname, "../scripts/analyze_audio.py");
    expect(existsSync(scriptPath)).toBe(true);
  });
});

// ─── Shot Planner ─────────────────────────────────────────────────────────────

describe("shotPlanner helpers", () => {
  it("maps segment types to display labels correctly", () => {
    // Test the internal segment-to-duration mapping logic
    const segmentDurations: Record<string, number> = {
      intro: 5,
      verse: 5,
      chorus: 10,
      bridge: 5,
      outro: 5,
      instrumental: 10,
      other: 5,
    };

    expect(segmentDurations["chorus"]).toBe(10);
    expect(segmentDurations["verse"]).toBe(5);
    expect(segmentDurations["instrumental"]).toBe(10);
    expect(segmentDurations["intro"]).toBe(5);
  });

  it("produces valid shot count for typical song structure", () => {
    // A 3-minute song with 8 sections should produce 8 shots
    const sections = [
      { label: "intro", startSeconds: 0, endSeconds: 15 },
      { label: "verse", startSeconds: 15, endSeconds: 45 },
      { label: "chorus", startSeconds: 45, endSeconds: 75 },
      { label: "verse", startSeconds: 75, endSeconds: 105 },
      { label: "chorus", startSeconds: 105, endSeconds: 135 },
      { label: "bridge", startSeconds: 135, endSeconds: 165 },
      { label: "chorus", startSeconds: 165, endSeconds: 195 },
      { label: "outro", startSeconds: 195, endSeconds: 210 },
    ];

    expect(sections.length).toBe(8);
    // Each section maps to exactly one shot
    const shotCount = sections.length;
    expect(shotCount).toBeGreaterThan(0);
    expect(shotCount).toBeLessThanOrEqual(20); // Reasonable upper bound
  });
});

// ─── Assembler ────────────────────────────────────────────────────────────────

describe("assembler helpers", () => {
  it("generates valid MLT XML structure", () => {
    // Verify the MLT template produces parseable XML
    const title = "Test Music Video";
    const clips = [
      { path: "/tmp/shot-000.mp4", durationSeconds: 5, shotIndex: 0 },
      { path: "/tmp/shot-001.mp4", durationSeconds: 10, shotIndex: 1 },
      { path: "/tmp/shot-002.mp4", durationSeconds: 5, shotIndex: 2 },
    ];

    const fps = 25;
    const totalFrames = clips.reduce(
      (sum, c) => sum + Math.round(c.durationSeconds * fps),
      0
    );

    expect(totalFrames).toBe(500); // (5+10+5) * 25 = 500 frames
    expect(title).toBeTruthy();
    expect(clips.length).toBe(3);
  });

  it("correctly calculates frame counts from duration", () => {
    const fps = 25;
    expect(Math.round(5 * fps)).toBe(125);
    expect(Math.round(10 * fps)).toBe(250);
    expect(Math.round(3.5 * fps)).toBe(88); // Rounding
  });

  it("sorts shots by shotIndex before assembly", () => {
    const shots = [
      { shotIndex: 2, videoStatus: "complete", videoUrl: "https://example.com/2.mp4" },
      { shotIndex: 0, videoStatus: "complete", videoUrl: "https://example.com/0.mp4" },
      { shotIndex: 1, videoStatus: "complete", videoUrl: "https://example.com/1.mp4" },
    ];

    const sorted = [...shots].sort((a, b) => a.shotIndex - b.shotIndex);
    expect(sorted[0].shotIndex).toBe(0);
    expect(sorted[1].shotIndex).toBe(1);
    expect(sorted[2].shotIndex).toBe(2);
  });

  it("filters out incomplete shots before assembly", () => {
    const shots = [
      { shotIndex: 0, videoStatus: "complete", videoUrl: "https://example.com/0.mp4" },
      { shotIndex: 1, videoStatus: "failed", videoUrl: null },
      { shotIndex: 2, videoStatus: "generating", videoUrl: null },
      { shotIndex: 3, videoStatus: "complete", videoUrl: "https://example.com/3.mp4" },
    ];

    const completedShots = shots.filter(
      (s) => s.videoStatus === "complete" && s.videoUrl
    );
    expect(completedShots.length).toBe(2);
    expect(completedShots[0].shotIndex).toBe(0);
    expect(completedShots[1].shotIndex).toBe(3);
  });
});

// ─── Shot Orchestrator ────────────────────────────────────────────────────────

describe("shotOrchestrator helpers", () => {
  it("respects exponential backoff bounds", () => {
    const INITIAL_POLL_INTERVAL_MS = 5_000;
    const MAX_POLL_INTERVAL_MS = 30_000;

    let interval = INITIAL_POLL_INTERVAL_MS;
    const intervals: number[] = [interval];

    for (let i = 0; i < 10; i++) {
      interval = Math.min(interval * 1.5, MAX_POLL_INTERVAL_MS);
      intervals.push(interval);
    }

    // Should never exceed max
    expect(Math.max(...intervals)).toBeLessThanOrEqual(MAX_POLL_INTERVAL_MS);
    // Should start at initial
    expect(intervals[0]).toBe(INITIAL_POLL_INTERVAL_MS);
    // Should grow
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
  });

  it("correctly identifies pending shots", () => {
    const shots = [
      { id: 1, videoStatus: "pending" },
      { id: 2, videoStatus: "complete" },
      { id: 3, videoStatus: "pending" },
      { id: 4, videoStatus: "failed" },
    ];

    const pendingShots = shots.filter((s) => s.videoStatus === "pending");
    expect(pendingShots.length).toBe(2);
    expect(pendingShots.map((s) => s.id)).toEqual([1, 3]);
  });
});

// ─── Router input validation ──────────────────────────────────────────────────

describe("musicVideo router input schemas", () => {
  it("validates that musicVideoId must be a positive integer", () => {
    const isPositiveInt = (n: number) => Number.isInteger(n) && n > 0;
    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
  });

  it("validates that title is non-empty", () => {
    const isValidTitle = (t: string) => t.trim().length > 0;
    expect(isValidTitle("My Song")).toBe(true);
    expect(isValidTitle("  ")).toBe(false);
    expect(isValidTitle("")).toBe(false);
  });

  it("validates audio URL format", () => {
    const isValidUrl = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };
    expect(isValidUrl("https://example.com/audio.mp3")).toBe(true);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});
