import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

import {
  deleteAdminTargetRow,
  listHiddenAdminTargets,
  restoreHiddenAdminTargetsForHanzi,
} from "./supabase-service";

function mockSession() {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        user: {
          id: "auth-user-1",
          app_metadata: {
            family_id: "family-1",
            user_id: "user-1",
          },
        },
      },
    },
  });
}

describe("supabase-service admin target helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("lists hidden admin targets and normalizes trimmed keys", async () => {
    const hiddenRows = [
      {
        character: "  还 ",
        pronunciation: " huan ",
        created_at: "2026-03-21T00:00:00.000Z",
      },
    ];

    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({ data: hiddenRows, error: null });

    fromMock.mockReturnValue(builder);

    await expect(listHiddenAdminTargets()).resolves.toEqual([
      {
        character: "还",
        pronunciation: "huan",
        key: "还|huan",
      },
    ]);

    expect(fromMock).toHaveBeenCalledWith("hidden_admin_targets");
    expect(builder.select).toHaveBeenCalledWith("character, pronunciation, created_at");
    expect(builder.eq).toHaveBeenCalledWith("family_id", "family-1");
    expect(builder.order).toHaveBeenNthCalledWith(1, "character");
    expect(builder.order).toHaveBeenNthCalledWith(2, "pronunciation");
  });

  it("deletes an admin row by hiding the target and deleting saved content", async () => {
    const hiddenBuilder = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    const flashcardDeleteChain = {
      eq: vi.fn(),
    };
    flashcardDeleteChain.eq
      .mockReturnValueOnce(flashcardDeleteChain)
      .mockResolvedValueOnce({ error: null });
    const flashcardBuilder = {
      delete: vi.fn().mockReturnValue(flashcardDeleteChain),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === "hidden_admin_targets") {
        return hiddenBuilder;
      }
      if (table === "flashcard_contents") {
        return flashcardBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(deleteAdminTargetRow(" 还 ", " huan ")).resolves.toBeUndefined();

    expect(hiddenBuilder.upsert).toHaveBeenCalledWith(
      {
        family_id: "family-1",
        character: "还",
        pronunciation: "huan",
      },
      {
        onConflict: "family_id,character,pronunciation",
        ignoreDuplicates: true,
      }
    );
    expect(flashcardBuilder.delete).toHaveBeenCalledTimes(1);
    expect(flashcardDeleteChain.eq).toHaveBeenNthCalledWith(1, "id", "还|huan");
    expect(flashcardDeleteChain.eq).toHaveBeenNthCalledWith(2, "family_id", "family-1");
  });

  it("keeps row deletion idempotent across repeated calls", async () => {
    const hiddenBuilder = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    const flashcardDeleteChain = {
      eq: vi.fn(),
    };
    flashcardDeleteChain.eq
      .mockReturnValueOnce(flashcardDeleteChain)
      .mockResolvedValueOnce({ error: null })
      .mockReturnValueOnce(flashcardDeleteChain)
      .mockResolvedValueOnce({ error: null });
    const flashcardBuilder = {
      delete: vi.fn().mockReturnValue(flashcardDeleteChain),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === "hidden_admin_targets") {
        return hiddenBuilder;
      }
      if (table === "flashcard_contents") {
        return flashcardBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(deleteAdminTargetRow("还", "huan")).resolves.toBeUndefined();
    await expect(deleteAdminTargetRow("还", "huan")).resolves.toBeUndefined();

    expect(hiddenBuilder.upsert).toHaveBeenCalledTimes(2);
    expect(flashcardBuilder.delete).toHaveBeenCalledTimes(2);
  });

  it("restores hidden admin targets for submitted hanzi values", async () => {
    const deleteChain = {
      eq: vi.fn(),
      in: vi.fn(),
    };
    deleteChain.eq.mockReturnValue(deleteChain);
    deleteChain.in.mockResolvedValue({ error: null });
    const builder = {
      delete: vi.fn().mockReturnValue(deleteChain),
    };

    fromMock.mockReturnValue(builder);

    await expect(
      restoreHiddenAdminTargetsForHanzi([" 还 ", "好", "还", "   "])
    ).resolves.toBeUndefined();

    expect(fromMock).toHaveBeenCalledWith("hidden_admin_targets");
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(deleteChain.eq).toHaveBeenCalledWith("family_id", "family-1");
    expect(deleteChain.in).toHaveBeenCalledWith("character", ["还", "好"]);
  });

  it("skips restore writes when the hanzi list is empty after normalization", async () => {
    await expect(restoreHiddenAdminTargetsForHanzi([" ", "  "])).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
