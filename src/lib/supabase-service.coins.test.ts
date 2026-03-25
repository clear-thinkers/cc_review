import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, fromMock, rpcMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
    rpc: rpcMock,
  },
}));

import {
  getAllQuizSessions,
  getOrCreateWallet,
  listShopTransactions,
  recordQuizSession,
} from "./supabase-service";
import type { QuizSession } from "@/app/words/results/results.types";

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

describe("supabase-service coin helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("reads quiz sessions for the requested child user", async () => {
    const row = {
      id: "session-1",
      created_at: "2026-03-25T00:00:00.000Z",
      session_type: "fill-test",
      grade_data: [],
      fully_correct_count: 2,
      failed_count: 0,
      partially_correct_count: 1,
      total_grades: 3,
      duration_seconds: 45,
      coins_earned: 13,
    };

    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({ data: [row], error: null });
    fromMock.mockReturnValue(builder);

    await expect(getAllQuizSessions("child-1")).resolves.toEqual([
      {
        id: "session-1",
        createdAt: new Date("2026-03-25T00:00:00.000Z").getTime(),
        sessionType: "fill-test",
        gradeData: [],
        fullyCorrectCount: 2,
        failedCount: 0,
        partiallyCorrectCount: 1,
        totalGrades: 3,
        durationSeconds: 45,
        coinsEarned: 13,
      },
    ]);

    expect(fromMock).toHaveBeenCalledWith("quiz_sessions");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "family_id", "family-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "child-1");
  });

  it("returns a synthetic zero wallet when reading another family member with no row yet", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      upsert: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    const wallet = await getOrCreateWallet("child-1");

    expect(wallet).toEqual(
      expect.objectContaining({
        userId: "child-1",
        totalCoins: 0,
        version: 1,
      })
    );
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it("reads shop transactions for the requested child user", async () => {
    const row = {
      id: "tx-1",
      user_id: "child-1",
      recipe_id: "recipe-1",
      action_type: "unlock_recipe" as const,
      coins_spent: 25,
      beginning_balance: 60,
      ending_balance: 35,
      created_at: "2026-03-25T00:00:00.000Z",
    };

    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({ data: [row], error: null });
    fromMock.mockReturnValue(builder);

    await expect(listShopTransactions("child-1")).resolves.toEqual([
      {
        id: "tx-1",
        userId: "child-1",
        recipeId: "recipe-1",
        actionType: "unlock_recipe",
        coinsSpent: 25,
        beginningBalance: 60,
        endingBalance: 35,
        createdAt: new Date("2026-03-25T00:00:00.000Z").getTime(),
      },
    ]);

    expect(fromMock).toHaveBeenCalledWith("shop_coin_transactions");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "family_id", "family-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "child-1");
  });

  it("records a quiz session through the atomic rpc and returns the updated wallet", async () => {
    const session: QuizSession = {
      id: "session-1",
      createdAt: new Date("2026-03-25T00:00:00.000Z").getTime(),
      sessionType: "fill-test",
      gradeData: [{ wordId: "w1", hanzi: "你", grade: "easy" }],
      fullyCorrectCount: 1,
      failedCount: 0,
      partiallyCorrectCount: 0,
      totalGrades: 1,
      durationSeconds: 12,
      coinsEarned: 5,
    };

    rpcMock.mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          family_id: "family-1",
          total_coins: 42,
          last_updated_at: "2026-03-25T00:00:01.000Z",
          version: 2,
        },
      ],
      error: null,
    });

    await expect(recordQuizSession(session)).resolves.toEqual({
      userId: "user-1",
      totalCoins: 42,
      lastUpdatedAt: new Date("2026-03-25T00:00:01.000Z").getTime(),
      version: 2,
    });

    expect(rpcMock).toHaveBeenCalledWith("record_quiz_session", {
      p_id: "session-1",
      p_created_at: "2026-03-25T00:00:00.000Z",
      p_session_type: "fill-test",
      p_grade_data: [{ wordId: "w1", hanzi: "你", grade: "easy" }],
      p_fully_correct_count: 1,
      p_failed_count: 0,
      p_partially_correct_count: 0,
      p_total_grades: 1,
      p_duration_seconds: 12,
      p_coins_earned: 5,
    });
  });
});
