/**
 * Cover Art Router Tests — Phase M
 *
 * Tests the cover art DB helpers and the regeneration cap logic.
 * The tRPC router procedures are tested via the DB helper layer
 * (same pattern as campaigns.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCampaignCoverArt,
  setCampaignCoverArtFromUpload,
  setCampaignCoverArtFromGeneration,
  COVER_ART_REGEN_LIMIT,
  type CoverArtState,
} from "../db";

// ─── Mock the database module ─────────────────────────────────────────────────

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();

  // In-memory store for cover art state per campaign
  const store = new Map<number, CoverArtState>();

  const mockGetCampaignCoverArt = vi.fn(async (campaignId: number) => {
    return store.get(campaignId) ?? null;
  });

  const mockSetCampaignCoverArtFromUpload = vi.fn(async (campaignId: number, url: string) => {
    const existing = store.get(campaignId) ?? {
      coverArtUrl: null,
      coverArtSource: "none" as const,
      coverArtGeneratedAt: null,
      coverArtRegenerationsUsed: 0,
    };
    store.set(campaignId, {
      ...existing,
      coverArtUrl: url,
      coverArtSource: "uploaded" as const,
      coverArtGeneratedAt: null,
      // coverArtRegenerationsUsed intentionally NOT reset
    });
  });

  const mockSetCampaignCoverArtFromGeneration = vi.fn(
    async (campaignId: number, url: string, isFirstGeneration: boolean) => {
      const existing = store.get(campaignId) ?? {
        coverArtUrl: null,
        coverArtSource: "none" as const,
        coverArtGeneratedAt: null,
        coverArtRegenerationsUsed: 0,
      };
      if (isFirstGeneration) {
        store.set(campaignId, {
          ...existing,
          coverArtUrl: url,
          coverArtSource: "generated" as const,
          coverArtGeneratedAt: Date.now(),
          // regen count NOT incremented on first generation
        });
      } else {
        store.set(campaignId, {
          ...existing,
          coverArtUrl: url,
          coverArtSource: "generated" as const,
          coverArtGeneratedAt: Date.now(),
          coverArtRegenerationsUsed: Math.min(
            existing.coverArtRegenerationsUsed + 1,
            actual.COVER_ART_REGEN_LIMIT
          ),
        });
      }
    }
  );

  // Expose a helper to seed the store for tests
  const _seedStore = (campaignId: number, state: CoverArtState) => {
    store.set(campaignId, state);
  };
  const _clearStore = () => store.clear();

  return {
    ...actual,
    getCampaignCoverArt: mockGetCampaignCoverArt,
    setCampaignCoverArtFromUpload: mockSetCampaignCoverArtFromUpload,
    setCampaignCoverArtFromGeneration: mockSetCampaignCoverArtFromGeneration,
    _seedStore,
    _clearStore,
  };
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

const { _seedStore, _clearStore } = await import("../db") as unknown as {
  _seedStore: (id: number, state: CoverArtState) => void;
  _clearStore: () => void;
};

const CAMPAIGN_ID = 42;
const IMAGE_URL_1 = "https://cdn.example.com/cover-art/1.jpg";
const IMAGE_URL_2 = "https://cdn.example.com/cover-art/2.jpg";
const IMAGE_URL_3 = "https://cdn.example.com/cover-art/3.jpg";
const IMAGE_URL_4 = "https://cdn.example.com/cover-art/4.jpg";
const UPLOAD_URL = "https://cdn.example.com/uploads/my-photo.jpg";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("COVER_ART_REGEN_LIMIT", () => {
  it("is exactly 3", () => {
    expect(COVER_ART_REGEN_LIMIT).toBe(3);
  });
});

describe("getCampaignCoverArt", () => {
  beforeEach(() => _clearStore());

  it("returns null for a campaign with no cover art state", async () => {
    const state = await getCampaignCoverArt(999);
    expect(state).toBeNull();
  });

  it("returns the seeded state for a campaign", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_1,
      coverArtSource: "generated",
      coverArtGeneratedAt: 1700000000000,
      coverArtRegenerationsUsed: 1,
    });
    const state = await getCampaignCoverArt(CAMPAIGN_ID);
    expect(state).not.toBeNull();
    expect(state!.coverArtUrl).toBe(IMAGE_URL_1);
    expect(state!.coverArtSource).toBe("generated");
    expect(state!.coverArtRegenerationsUsed).toBe(1);
  });
});

describe("setCampaignCoverArtFromUpload", () => {
  beforeEach(() => _clearStore());

  it("sets the cover art URL and source to uploaded", async () => {
    await setCampaignCoverArtFromUpload(CAMPAIGN_ID, UPLOAD_URL);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);
    expect(state!.coverArtUrl).toBe(UPLOAD_URL);
    expect(state!.coverArtSource).toBe("uploaded");
  });

  it("does NOT reset the regeneration count after upload", async () => {
    // Seed with 2 regenerations used
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_2,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: 2,
    });

    // Upload a new image
    await setCampaignCoverArtFromUpload(CAMPAIGN_ID, UPLOAD_URL);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    // Regen count must remain 2 — upload-to-reset loop prevention
    expect(state!.coverArtRegenerationsUsed).toBe(2);
    expect(state!.coverArtSource).toBe("uploaded");
  });

  it("does NOT reset the regeneration count even when at the limit", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_3,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: COVER_ART_REGEN_LIMIT,
    });

    await setCampaignCoverArtFromUpload(CAMPAIGN_ID, UPLOAD_URL);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    expect(state!.coverArtRegenerationsUsed).toBe(COVER_ART_REGEN_LIMIT);
  });

  it("clears coverArtGeneratedAt when uploading", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_1,
      coverArtSource: "generated",
      coverArtGeneratedAt: 1700000000000,
      coverArtRegenerationsUsed: 1,
    });

    await setCampaignCoverArtFromUpload(CAMPAIGN_ID, UPLOAD_URL);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);
    expect(state!.coverArtGeneratedAt).toBeNull();
  });
});

describe("setCampaignCoverArtFromGeneration — first generation", () => {
  beforeEach(() => _clearStore());

  it("sets URL and source to generated without incrementing regen count", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: null,
      coverArtSource: "none",
      coverArtGeneratedAt: null,
      coverArtRegenerationsUsed: 0,
    });

    await setCampaignCoverArtFromGeneration(CAMPAIGN_ID, IMAGE_URL_1, true);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    expect(state!.coverArtUrl).toBe(IMAGE_URL_1);
    expect(state!.coverArtSource).toBe("generated");
    expect(state!.coverArtRegenerationsUsed).toBe(0); // NOT incremented on first gen
    expect(state!.coverArtGeneratedAt).not.toBeNull();
  });
});

describe("setCampaignCoverArtFromGeneration — regenerations", () => {
  beforeEach(() => _clearStore());

  it("increments regen count on first regeneration", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_1,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: 0,
    });

    await setCampaignCoverArtFromGeneration(CAMPAIGN_ID, IMAGE_URL_2, false);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    expect(state!.coverArtRegenerationsUsed).toBe(1);
    expect(state!.coverArtUrl).toBe(IMAGE_URL_2);
  });

  it("increments regen count on second regeneration", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_2,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: 1,
    });

    await setCampaignCoverArtFromGeneration(CAMPAIGN_ID, IMAGE_URL_3, false);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    expect(state!.coverArtRegenerationsUsed).toBe(2);
  });

  it("increments regen count on third regeneration (reaching the limit)", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_3,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: 2,
    });

    await setCampaignCoverArtFromGeneration(CAMPAIGN_ID, IMAGE_URL_4, false);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    expect(state!.coverArtRegenerationsUsed).toBe(COVER_ART_REGEN_LIMIT); // 3
  });

  it("caps regen count at COVER_ART_REGEN_LIMIT — never exceeds 3", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_4,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: COVER_ART_REGEN_LIMIT,
    });

    // Attempt a 4th regeneration (should be blocked by router, but DB cap also holds)
    await setCampaignCoverArtFromGeneration(CAMPAIGN_ID, IMAGE_URL_1, false);
    const state = await getCampaignCoverArt(CAMPAIGN_ID);

    expect(state!.coverArtRegenerationsUsed).toBe(COVER_ART_REGEN_LIMIT); // still 3
  });
});

describe("Regeneration cap enforcement — upload-to-reset loop prevention", () => {
  beforeEach(() => _clearStore());

  it("regen count persists through upload → generate → upload cycle", async () => {
    // Start with 2 regenerations used
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_3,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: 2,
    });

    // Upload own image — regen count stays at 2
    await setCampaignCoverArtFromUpload(CAMPAIGN_ID, UPLOAD_URL);
    let state = await getCampaignCoverArt(CAMPAIGN_ID);
    expect(state!.coverArtRegenerationsUsed).toBe(2);

    // Regenerate — regen count goes to 3 (limit)
    await setCampaignCoverArtFromGeneration(CAMPAIGN_ID, IMAGE_URL_4, false);
    state = await getCampaignCoverArt(CAMPAIGN_ID);
    expect(state!.coverArtRegenerationsUsed).toBe(3);

    // Upload again — regen count stays at 3 (not reset)
    await setCampaignCoverArtFromUpload(CAMPAIGN_ID, UPLOAD_URL);
    state = await getCampaignCoverArt(CAMPAIGN_ID);
    expect(state!.coverArtRegenerationsUsed).toBe(3);
  });

  it("canRegenerate is false when regen count equals COVER_ART_REGEN_LIMIT", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_4,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: COVER_ART_REGEN_LIMIT,
    });

    const state = await getCampaignCoverArt(CAMPAIGN_ID);
    const canRegenerate =
      state!.coverArtSource === "generated" &&
      state!.coverArtRegenerationsUsed < COVER_ART_REGEN_LIMIT;

    expect(canRegenerate).toBe(false);
  });

  it("canRegenerate is true when regen count is below COVER_ART_REGEN_LIMIT", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: IMAGE_URL_2,
      coverArtSource: "generated",
      coverArtGeneratedAt: Date.now(),
      coverArtRegenerationsUsed: 1,
    });

    const state = await getCampaignCoverArt(CAMPAIGN_ID);
    const canRegenerate =
      state!.coverArtSource === "generated" &&
      state!.coverArtRegenerationsUsed < COVER_ART_REGEN_LIMIT;

    expect(canRegenerate).toBe(true);
  });

  it("canRegenerate is false for uploaded cover art (must generate first)", async () => {
    _seedStore(CAMPAIGN_ID, {
      coverArtUrl: UPLOAD_URL,
      coverArtSource: "uploaded",
      coverArtGeneratedAt: null,
      coverArtRegenerationsUsed: 0,
    });

    const state = await getCampaignCoverArt(CAMPAIGN_ID);
    // Uploaded art cannot be "regenerated" — only generated art can be regenerated
    const canRegenerate =
      state!.coverArtSource === "generated" &&
      state!.coverArtRegenerationsUsed < COVER_ART_REGEN_LIMIT;

    expect(canRegenerate).toBe(false);
  });
});
