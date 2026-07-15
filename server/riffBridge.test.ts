/**
 * riffBridge.test.ts
 * ==================
 * Tests for the Riff → Studios bridge helper.
 * Auth: x-bridge-key + ?openId (not Clerk Bearer — separate Clerk instances).
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
    studiosBridgeKey: "test-bridge-key-abc123",
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

const TEST_OPEN_ID = "user_2abc123def456";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getRiffTracks", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("calls bridge with x-bridge-key header and openId query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: MOCK_TRACKS }),
    });

    await getRiffTracks(TEST_OPEN_ID);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://strawberryriff.com/api/bridge/tracks?openId=${TEST_OPEN_ID}`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-bridge-key": "test-bridge-key-abc123",
        }),
      })
    );
    // Must NOT send a Clerk Bearer token (separate Clerk instances)
    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders["Authorization"]).toBeUndefined();
  });

  it("returns tracks array on 200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: MOCK_TRACKS }),
    });

    const tracks = await getRiffTracks(TEST_OPEN_ID);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe("Slow Burn");
    expect(tracks[1].genre).toBe("electronic");
  });

  it("returns empty array when tracks key is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const tracks = await getRiffTracks(TEST_OPEN_ID);
    expect(tracks).toEqual([]);
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(getRiffTracks(TEST_OPEN_ID)).rejects.toThrow("401");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    await expect(getRiffTracks(TEST_OPEN_ID)).rejects.toThrow("Network failure");
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

    const result = await resolveRiffTrackAudio(TEST_OPEN_ID, 1);
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

    const result = await resolveRiffTrackAudio(TEST_OPEN_ID, 999);
    expect(result).toBeNull();
  });

  it("returns null when track list is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: [] }),
    });

    const result = await resolveRiffTrackAudio(TEST_OPEN_ID, 1);
    expect(result).toBeNull();
  });
});
