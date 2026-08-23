import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { makeFakeAccessToken } from "./testHelpers/fakeJwt";

const { getSessionMock, fromMock, rpcMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: { getSession: getSessionMock },
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { rewardRandomIngredients } from "./supabase-service";

function mockSession(userId = "user-1", familyId = "family-1") {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        access_token: makeFakeAccessToken({ app_metadata: { family_id: familyId, user_id: userId } }),
        user: {
          id: "auth-user-1",
          app_metadata: { family_id: familyId, user_id: userId },
        },
      },
    },
  });
}

describe("rewardRandomIngredients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls reward_random_ingredients with the given quiz session id", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await rewardRandomIngredients("session-123");

    expect(rpcMock).toHaveBeenCalledWith("reward_random_ingredients", {
      p_quiz_session_id: "session-123",
    });
  });

  it("maps snake_case RPC rows to camelCase RewardedIngredient objects", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          ingredient_key: "strawberry",
          label_i18n: { en: "Strawberry", zh: "草莓" },
          icon_path: "/ingredients/strawberry_base.png",
        },
        {
          ingredient_key: "milk",
          label_i18n: null,
          icon_path: null,
        },
      ],
      error: null,
    });

    const result = await rewardRandomIngredients("session-123");

    expect(result).toEqual([
      {
        ingredientKey: "strawberry",
        labelI18n: { en: "Strawberry", zh: "草莓" },
        iconPath: "/ingredients/strawberry_base.png",
      },
      {
        ingredientKey: "milk",
      },
    ]);
  });

  it("returns an empty array when the RPC rewards nothing (no unlocked recipes / empty pool / already rewarded)", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await rewardRandomIngredients("session-123");

    expect(result).toEqual([]);
  });

  it("returns an empty array when the RPC returns null data", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await rewardRandomIngredients("session-123");

    expect(result).toEqual([]);
  });

  it("throws when the RPC errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(rewardRandomIngredients("session-123")).rejects.toThrow(
      "rewardRandomIngredients: boom"
    );
  });
});
