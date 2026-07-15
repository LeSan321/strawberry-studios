/**
 * riffBridge.ts — Studios → Riff API Bridge
 * ==========================================
 * Calls Riff's bridge endpoints on behalf of an authenticated Studios user.
 * Auth: forward the user's Clerk Bearer token so Riff can identify them.
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
}

// ─── Bridge Caller ────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's full track library from Riff.
 * @param clerkToken - The user's Clerk session token (Bearer)
 */
export async function getRiffTracks(clerkToken: string): Promise<RiffTrack[]> {
  const url = `${ENV.riffBaseUrl}/api/bridge/tracks`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${clerkToken}`,
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
  clerkToken: string,
  trackId: number
): Promise<{ audioUrl: string; title: string; genre: string; duration: number } | null> {
  const tracks = await getRiffTracks(clerkToken);
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return null;
  return {
    audioUrl: track.audioUrl,
    title: track.title,
    genre: track.genre,
    duration: track.duration,
  };
}
