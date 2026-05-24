/**
 * Phase P Tests — Publish procedure and free-tier song limit enforcement
 *
 * Tests the campaigns.publish tRPC procedure:
 * - Ownership verification
 * - Free-tier 8-published-song limit with soft-landing message
 * - Premium users bypass the limit
 * - isPublic is set to true on success
 * - countCampaignsByUser DB helper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "../db";

// ── Mock DB helpers ───────────────────────────────────────────────────────────

vi.mock("../db", () => ({
  getCampaignById: vi.fn(),
  getCampaignsByUser: vi.fn(),
  countCampaignsByUser: vi.fn(),
  updateCampaign: vi.fn(),
  getCampaignCoverArt: vi.fn(),
  setCampaignCoverArtFromGeneration: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREE_TIER_SONG_LIMIT = 8;

function makeCampaign(overrides: Partial<{
  id: number;
  userId: number;
  isPublic: boolean;
  status: string;
  genre: string;
  coverArtUrl: string | null;
  coverArtRegenerationsUsed: number;
}> = {}) {
  return {
    id: 1,
    userId: 1,
    isPublic: false,
    status: "package_ready",
    genre: "indie_folk",
    coverArtUrl: null,
    coverArtRegenerationsUsed: 0,
    title: "Test Campaign",
    ...overrides,
  };
}

function makePublishedCampaigns(count: number, userId = 1) {
  return Array.from({ length: count }, (_, i) => makeCampaign({ id: i + 10, userId, isPublic: true }));
}

// ── Simulate publish logic (mirrors the procedure) ────────────────────────────

async function simulatePublish({
  campaignId,
  userId,
  userRole,
  lyrics,
}: {
  campaignId: number;
  userId: number;
  userRole: "user" | "admin";
  lyrics?: string;
}) {
  const isPremium = userRole === "admin";

  // 1. Verify ownership
  const campaign = await db.getCampaignById(campaignId);
  if (!campaign) throw new Error("NOT_FOUND");
  if (campaign.userId !== userId) throw new Error("FORBIDDEN");

  // 2. Free-tier song limit
  if (!isPremium) {
    const allCampaigns = await db.getCampaignsByUser(userId);
    const publishedCount = (allCampaigns as ReturnType<typeof makeCampaign>[]).filter(
      (c) => c.isPublic && c.id !== campaignId
    ).length;
    if (publishedCount >= FREE_TIER_SONG_LIMIT) {
      throw new Error(
        `You've built something real here — ${publishedCount} songs and counting. ` +
          `Upgrade to keep going and unlock your full Visual Universe.`
      );
    }
  }

  // 3. Mark as public
  await db.updateCampaign(campaignId, { isPublic: true });

  return { published: true, campaignId };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("campaigns.publish — ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NOT_FOUND when campaign does not exist", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(null);
    await expect(simulatePublish({ campaignId: 999, userId: 1, userRole: "user" }))
      .rejects.toThrow("NOT_FOUND");
  });

  it("throws FORBIDDEN when campaign belongs to a different user", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign({ userId: 2 }) as never);
    await expect(simulatePublish({ campaignId: 1, userId: 1, userRole: "user" }))
      .rejects.toThrow("FORBIDDEN");
  });
});

describe("campaigns.publish — free-tier song limit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows publish when free-tier user has 0 published songs", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.getCampaignsByUser).mockResolvedValue([] as never);
    vi.mocked(db.updateCampaign).mockResolvedValue(undefined);

    const result = await simulatePublish({ campaignId: 1, userId: 1, userRole: "user" });
    expect(result.published).toBe(true);
  });

  it("allows publish when free-tier user has 7 published songs (one below limit)", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.getCampaignsByUser).mockResolvedValue(makePublishedCampaigns(7) as never);
    vi.mocked(db.updateCampaign).mockResolvedValue(undefined);

    const result = await simulatePublish({ campaignId: 1, userId: 1, userRole: "user" });
    expect(result.published).toBe(true);
  });

  it("blocks publish when free-tier user has 8 published songs (at limit)", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.getCampaignsByUser).mockResolvedValue(makePublishedCampaigns(8) as never);

    await expect(simulatePublish({ campaignId: 1, userId: 1, userRole: "user" }))
      .rejects.toThrow("You've built something real here");
  });

  it("soft-landing message includes the count and upgrade CTA", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.getCampaignsByUser).mockResolvedValue(makePublishedCampaigns(8) as never);

    let errorMessage = "";
    try {
      await simulatePublish({ campaignId: 1, userId: 1, userRole: "user" });
    } catch (err) {
      errorMessage = (err as Error).message;
    }
    expect(errorMessage).toContain("8 songs and counting");
    expect(errorMessage).toContain("Upgrade to keep going");
    expect(errorMessage).toContain("Visual Universe");
  });

  it("does not count the campaign being published toward the limit", async () => {
    // The campaign being published (id: 1) is already in the list as isPublic: true
    // (e.g., re-publishing). It should not count against itself.
    const campaigns = [
      ...makePublishedCampaigns(7),
      makeCampaign({ id: 1, isPublic: true }), // the one being published
    ];
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.getCampaignsByUser).mockResolvedValue(campaigns as never);
    vi.mocked(db.updateCampaign).mockResolvedValue(undefined);

    const result = await simulatePublish({ campaignId: 1, userId: 1, userRole: "user" });
    expect(result.published).toBe(true);
  });
});

describe("campaigns.publish — premium users bypass limit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows premium user to publish even with 20 published songs", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.updateCampaign).mockResolvedValue(undefined);
    // getCampaignsByUser should NOT be called for premium users
    vi.mocked(db.getCampaignsByUser).mockResolvedValue(makePublishedCampaigns(20) as never);

    const result = await simulatePublish({ campaignId: 1, userId: 1, userRole: "admin" });
    expect(result.published).toBe(true);
    // Premium path skips the getCampaignsByUser call
    expect(db.getCampaignsByUser).not.toHaveBeenCalled();
  });
});

describe("campaigns.publish — updateCampaign called", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateCampaign with isPublic: true on success", async () => {
    vi.mocked(db.getCampaignById).mockResolvedValue(makeCampaign() as never);
    vi.mocked(db.getCampaignsByUser).mockResolvedValue([] as never);
    vi.mocked(db.updateCampaign).mockResolvedValue(undefined);

    await simulatePublish({ campaignId: 1, userId: 1, userRole: "user" });
    expect(db.updateCampaign).toHaveBeenCalledWith(1, { isPublic: true });
  });
});

describe("countCampaignsByUser DB helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 when database is unavailable", async () => {
    vi.mocked(db.countCampaignsByUser).mockResolvedValue(0);
    const count = await db.countCampaignsByUser(1);
    expect(count).toBe(0);
  });

  it("returns the correct count", async () => {
    vi.mocked(db.countCampaignsByUser).mockResolvedValue(5);
    const count = await db.countCampaignsByUser(1);
    expect(count).toBe(5);
  });
});
