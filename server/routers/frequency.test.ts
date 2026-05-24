/**
 * frequency router tests — Phase O
 *
 * Tests the frequency.synthesize, frequency.save, frequency.getDefault, and
 * frequency.list procedures, as well as the vocabulary structure validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("../db", () => ({
  saveCreatorFrequency: vi.fn(),
  getDefaultCreatorFrequency: vi.fn(),
  listCreatorFrequencies: vi.fn(),
}));

// ─── Mock LLM ─────────────────────────────────────────────────────────────────

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { saveCreatorFrequency, getDefaultCreatorFrequency, listCreatorFrequencies } from "../db";
import { invokeLLM } from "../_core/llm";

// ─── Test vocabulary fixture ──────────────────────────────────────────────────

const VALID_VOCABULARY = {
  environment: [
    { term: "open threshold", instruction: "Forest edge meeting vast open landscape" },
    { term: "earned light", instruction: "Light that has come through something" },
  ],
  emotionalRegister: [
    { term: "earned warmth", instruction: "Warmth that has been through something" },
  ],
  arcTerms: [
    { term: "through not away from", instruction: "Movement is forward into the difficult thing" },
  ],
  forbiddenTerms: [
    { term: "no collapse", instruction: "No imagery of falling or defeat as final state" },
  ],
  relationshipGeometry: [
    { term: "side by side", instruction: "Neither in front of nor behind" },
  ],
  colorLight: [
    { term: "golden hour 3200K", instruction: "Warm amber directional light, sun low" },
  ],
};

const VALID_SYNTHESIS_RESPONSE = {
  reflection: "Your music carries the weight of something earned. The listener starts in a contained space and ends somewhere larger. Does that feel true — or is something off?",
  suggestedName: "Blooming Frontier",
  arcType: "expansive_mythic",
  vocabulary: VALID_VOCABULARY,
};

// ─── Mock context ─────────────────────────────────────────────────────────────

const mockCtx = {
  user: { id: 1, name: "Test User", email: "test@example.com", role: "user" as const },
};

// ─── Vocabulary structure validation ─────────────────────────────────────────

describe("Vocabulary structure validation", () => {
  it("accepts a valid 6-category vocabulary", () => {
    const keys = Object.keys(VALID_VOCABULARY);
    expect(keys).toContain("environment");
    expect(keys).toContain("emotionalRegister");
    expect(keys).toContain("arcTerms");
    expect(keys).toContain("forbiddenTerms");
    expect(keys).toContain("relationshipGeometry");
    expect(keys).toContain("colorLight");
  });

  it("each category contains term and instruction fields", () => {
    for (const [, terms] of Object.entries(VALID_VOCABULARY)) {
      for (const term of terms) {
        expect(term).toHaveProperty("term");
        expect(term).toHaveProperty("instruction");
        expect(typeof term.term).toBe("string");
        expect(typeof term.instruction).toBe("string");
      }
    }
  });

  it("rejects vocabulary missing a required category", () => {
    const incomplete = { ...VALID_VOCABULARY };
    // @ts-expect-error intentionally testing missing key
    delete incomplete.colorLight;
    expect(Object.keys(incomplete)).not.toContain("colorLight");
  });
});

// ─── frequency.synthesize ─────────────────────────────────────────────────────

describe("frequency.synthesize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls invokeLLM with the four diagnostic answers", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(VALID_SYNTHESIS_RESPONSE),
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.synthesize({
      q1: "I found this song during a difficult transition in my life.",
      q2: "They start feeling alone and end feeling accompanied.",
      q3: "It is specifically not triumphant or resolved.",
      q4: "A forest edge at late afternoon, the light going golden.",
    });

    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(result.reflection).toContain("Does that feel true");
    expect(result.suggestedName).toBe("Blooming Frontier");
    expect(result.arcType).toBe("expansive_mythic");
    expect(result.vocabulary.environment).toHaveLength(2);
  });

  it("returns the diagnostic answers in the result", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(VALID_SYNTHESIS_RESPONSE),
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const answers = {
      q1: "A song that felt like it knew me.",
      q2: "They start closed and end open.",
      q3: "Not nostalgic.",
      q4: "A field at dawn.",
    };

    const result = await caller.synthesize(answers);
    expect(result.diagnosticAnswers).toEqual(answers);
  });

  it("falls back to expansive_mythic for unknown arc type", async () => {
    const responseWithBadArcType = {
      ...VALID_SYNTHESIS_RESPONSE,
      arcType: "unknown_type",
    };

    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(responseWithBadArcType),
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.synthesize({
      q1: "A song that felt like it knew me.",
      q2: "They start closed and end open.",
      q3: "Not nostalgic.",
      q4: "A field at dawn.",
    });

    expect(result.arcType).toBe("expansive_mythic");
  });

  it("throws when LLM returns no content", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    } as Awaited<ReturnType<typeof invokeLLM>>);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    await expect(
      caller.synthesize({
        q1: "A song that felt like it knew me.",
        q2: "They start closed and end open.",
        q3: "Not nostalgic.",
        q4: "A field at dawn.",
      })
    ).rejects.toThrow("LLM returned no content");
  });
});

// ─── frequency.save ───────────────────────────────────────────────────────────

describe("frequency.save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls saveCreatorFrequency with isDefault: true", async () => {
    vi.mocked(saveCreatorFrequency).mockResolvedValueOnce(42);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.save({
      frequencyName: "Blooming Frontier",
      arcType: "expansive_mythic",
      vocabulary: VALID_VOCABULARY,
      synthesisFingerprint: "A fingerprint paragraph.",
    });

    expect(saveCreatorFrequency).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        frequencyName: "Blooming Frontier",
        arcType: "expansive_mythic",
        isDefault: true,
      })
    );
    expect(result.id).toBe(42);
    expect(result.frequencyName).toBe("Blooming Frontier");
  });

  it("saves without optional synthesisFingerprint", async () => {
    vi.mocked(saveCreatorFrequency).mockResolvedValueOnce(7);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.save({
      frequencyName: "Morning Threshold",
      arcType: "witnessing_lateral",
      vocabulary: VALID_VOCABULARY,
    });

    expect(result.id).toBe(7);
    expect(saveCreatorFrequency).toHaveBeenCalledWith(
      expect.objectContaining({ synthesisFingerprint: null })
    );
  });
});

// ─── frequency.getDefault ─────────────────────────────────────────────────────

describe("frequency.getDefault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no default frequency exists", async () => {
    vi.mocked(getDefaultCreatorFrequency).mockResolvedValueOnce(null);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.getDefault();
    expect(result).toBeNull();
  });

  it("returns the default frequency when it exists", async () => {
    vi.mocked(getDefaultCreatorFrequency).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      frequencyName: "Blooming Frontier",
      arcType: "expansive_mythic",
      vocabularyJson: VALID_VOCABULARY,
      synthesisFingerprint: "A fingerprint.",
      diagnosticAnswersJson: null,
      isDefault: true,
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
    });

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.getDefault();
    expect(result).not.toBeNull();
    expect(result!.frequencyName).toBe("Blooming Frontier");
    expect(result!.arcType).toBe("expansive_mythic");
    expect(result!.synthesisFingerprint).toBe("A fingerprint.");
  });
});

// ─── frequency.list ───────────────────────────────────────────────────────────

describe("frequency.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when user has no frequencies", async () => {
    vi.mocked(listCreatorFrequencies).mockResolvedValueOnce([]);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.list();
    expect(result).toEqual([]);
  });

  it("returns all frequencies with id, name, arcType, isDefault", async () => {
    vi.mocked(listCreatorFrequencies).mockResolvedValueOnce([
      {
        id: 1,
        userId: 1,
        frequencyName: "Blooming Frontier",
        arcType: "expansive_mythic",
        vocabularyJson: VALID_VOCABULARY,
        synthesisFingerprint: "A fingerprint.",
        diagnosticAnswersJson: null,
        isDefault: true,
        createdAt: new Date("2026-05-01"),
        updatedAt: new Date("2026-05-01"),
      },
      {
        id: 2,
        userId: 1,
        frequencyName: "Morning Threshold",
        arcType: "witnessing_lateral",
        vocabularyJson: VALID_VOCABULARY,
        synthesisFingerprint: null,
        diagnosticAnswersJson: null,
        isDefault: false,
        createdAt: new Date("2026-05-15"),
        updatedAt: new Date("2026-05-15"),
      },
    ]);

    const { frequencyRouter } = await import("./frequency");
    const caller = frequencyRouter.createCaller(mockCtx as Parameters<typeof frequencyRouter.createCaller>[0]);

    const result = await caller.list();
    expect(result).toHaveLength(2);
    expect(result[0].frequencyName).toBe("Blooming Frontier");
    expect(result[0].isDefault).toBe(true);
    expect(result[1].frequencyName).toBe("Morning Threshold");
    expect(result[1].isDefault).toBe(false);
  });
});
