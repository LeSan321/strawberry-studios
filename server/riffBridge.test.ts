/**
 * riffBridge.test.ts
 * ==================
 * Tests for the Riff → Studios bridge helper.
 * Uses vi.mock to avoid real HTTP calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Mock ENV ─────────────────────────────────────────────────────────────────

vi.mock("./_core/env", () => ({
  ENV: {
    riffBaseUrl: "https://strawberryriff.com",
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { getRiffTracks, resolveRiffTrackAudio } from "./riffBridge";

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_TRACKS = [
  {
    id: 1,
    title: "Slow Burn",
    artist: "Zara",
    genre: "ambient",
    audioUrl: "https://s3.example.com/tracks/slow-burn.mp3",
    duration: 187,
    coverArtUrl: "https://s3.example.com/covers/slow-burn.jpg",
    visibility: "public",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: 2,
    title: "Midnight Signal",
    artist: "Zara",
    genre: "electronic",
    audioUrl: "https://s3.example.com/tracks/midnight-signal.mp3",
    duration: 214,
    coverArtUrl: null,
    visibility: "private",
    createdAt: "2026-07-10T00:00:00.000Z",
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getRiffTracks", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns tracks array on 200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: MOCK_TRACKS }),
    });

    const tracks = await getRiffTracks("test-clerk-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://strawberryriff.com/api/bridge/tracks",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-clerk-token",
        }),
      })
    );
    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe("Slow Burn");
    expect(tracks[1].genre).toBe("electronic");
  });

  it("returns empty array when tracks key is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const tracks = await getRiffTracks("test-clerk-token");
    expect(tracks).toEqual([]);
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(getRiffTracks("bad-token")).rejects.toThrow("401");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    await expect(getRiffTracks("test-token")).rejects.toThrow("Network failure");
  });
});

describe("resolveRiffTrackAudio", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("resolves audioUrl for a known track ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: MOCK_TRACKS }),
    });

    const result = await resolveRiffTrackAudio("test-token", 1);
    expect(result).not.toBeNull();
    expect(result!.audioUrl).toBe("https://s3.example.com/tracks/slow-burn.mp3");
    expect(result!.title).toBe("Slow Burn");
    expect(result!.genre).toBe("ambient");
    expect(result!.duration).toBe(187);
  });

  it("returns null for an unknown track ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: MOCK_TRACKS }),
    });

    const result = await resolveRiffTrackAudio("test-token", 999);
    expect(result).toBeNull();
  });

  it("returns null when track list is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: [] }),
    });

    const result = await resolveRiffTrackAudio("test-token", 1);
    expect(result).toBeNull();
  });
});
