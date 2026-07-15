/**
 * riffBridge.ts — Studios → Riff API Bridge
 * ==========================================
 * Calls Riff's bridge endpoints on behalf of an authenticated Studios user.
 *
 * Auth: x-bridge-key (shared secret) + ?openId=<clerk_sub>
 * Riff and Studios run on separate Clerk application instances, so the Studios
 * Clerk Bearer token cannot be verified by Riff's CLERK_SECRET_KEY.
 * The shared bridge key + openId path is the correct cross-instance pattern.
 *
 * Env vars required:
 *   RIFF_BASE_URL        — https://strawberryriff.com (or staging URL)
 *   STUDIOS_BRIDGE_KEY   — shared secret, already injected by Manus platform
 */

import { ENV } from "./_core/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiffTrack {
  id: number;
  title: string;
  artist: string;
  genre: string;
  audioUrl: string;
  duration: number; // seconds
  coverArtUrl: string | null;
  visibility: "public" | "inner_circle" | "private";
  createdAt: string;
}

export interface RiffTracksResponse {
  tracks: RiffTrack[];
  error?: string;
}

// ─── Bridge Caller ────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's full track library from Riff.
 *
 * @param openId - The user's Clerk sub (user ID) from the Studios session.
 *                 Riff uses this to identify which user's tracks to return.
 */
export async function getRiffTracks(openId: string): Promise<RiffTrack[]> {
  const bridgeKey = ENV.studiosBridgeKey;
  if (!bridgeKey) {
    throw new Error("STUDIOS_BRIDGE_KEY is not configured");
  }

  const url = `${ENV.riffBaseUrl}/api/bridge/tracks?openId=${encodeURIComponent(openId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-bridge-key": bridgeKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Riff bridge /tracks returned ${res.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as RiffTracksResponse;
  return data.tracks ?? [];
}

/**
 * Resolve a single Riff track's audioUrl by ID.
 * Used when the music video form is pre-filled via ?trackId= deep-link.
 */
export async function resolveRiffTrackAudio(
  openId: string,
  trackId: number
): Promise<{ audioUrl: string; title: string; genre: string; duration: number } | null> {
  const tracks = await getRiffTracks(openId);
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return null;
  return {
    audioUrl: track.audioUrl,
    title: track.title,
    genre: track.genre,
    duration: track.duration,
  };
}
