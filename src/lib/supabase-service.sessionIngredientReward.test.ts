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

import {
  listShopIngredientPrices,
  listShopRecipes,
  rewardSessionIngredients,
} from "./supabase-service";

function mockSession(userId = "user-1", familyId = "family-1") {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        access_token: makeFakeAccessToken({ app_metadata: { family_id: familyId, user_id: userId } }),
        user: { id: "auth-user-1", app_metadata: { family_id: familyId, user_id: userId } },
      },
    },
  });
}

describe("rewardSessionIngredients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls reward_session_ingredients with only the quiz session id", async () => {
    rpcMock.mockResolvedValue({ data: { isWin: false, ingredients: [], unlockedRecipeIds: [] }, error: null });

    await rewardSessionIngredients("session-123");

    expect(rpcMock).toHaveBeenCalledWith("reward_session_ingredients", {
      p_quiz_session_id: "session-123",
    });
  });

  it("maps a win result: quantities, mystery flags, and unlocked recipe ids", async () => {
    rpcMock.mockResolvedValue({
      data: {
        isWin: true,
        ingredients: [
          {
            ingredientKey: "wild-tiger-prawn",
            labelI18n: { en: "Wild Tiger Prawn", zh: "野生虎头虾" },
            iconPath: "/ingredients/wild-tiger-prawn.png",
            quantity: 2,
            isMystery: true,
          },
          { ingredientKey: "gilded-sesame-oil", labelI18n: null, iconPath: null, quantity: 1, isMystery: true },
        ],
        unlockedRecipeIds: ["recipe-1"],
      },
      error: null,
    });

    const result = await rewardSessionIngredients("session-123");

    expect(result.isWin).toBe(true);
    expect(result.unlockedRecipeIds).toEqual(["recipe-1"]);
    expect(result.ingredients).toEqual([
      {
        ingredientKey: "wild-tiger-prawn",
        labelI18n: { en: "Wild Tiger Prawn", zh: "野生虎头虾" },
        iconPath: "/ingredients/wild-tiger-prawn.png",
        quantity: 2,
        isMystery: true,
      },
      { ingredientKey: "gilded-sesame-oil", quantity: 1, isMystery: true },
    ]);
  });

  it("maps a non-win random reward as quantity 1, not mystery", async () => {
    rpcMock.mockResolvedValue({
      data: {
        isWin: false,
        ingredients: [
          {
            ingredientKey: "milk",
            labelI18n: { en: "Milk", zh: "牛奶" },
            iconPath: "/ingredients/milk_base.png",
            quantity: 1,
            isMystery: false,
          },
        ],
        unlockedRecipeIds: [],
      },
      error: null,
    });

    const result = await rewardSessionIngredients("session-9");

    expect(result.isWin).toBe(false);
    expect(result.ingredients[0]).toMatchObject({ ingredientKey: "milk", quantity: 1, isMystery: false });
    expect(result.unlockedRecipeIds).toEqual([]);
  });

  it("treats a malformed or empty payload as an empty reward, never an error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await rewardSessionIngredients("s")).toEqual({ isWin: false, ingredients: [], unlockedRecipeIds: [] });

    rpcMock.mockResolvedValue({ data: { ingredients: "nope", unlockedRecipeIds: [1, "ok"] }, error: null });
    expect(await rewardSessionIngredients("s")).toEqual({ isWin: false, ingredients: [], unlockedRecipeIds: ["ok"] });
  });

  it("drops rows with no usable key and defaults a bad quantity to 1", async () => {
    rpcMock.mockResolvedValue({
      data: {
        isWin: true,
        ingredients: [
          { ingredientKey: "", quantity: 2 },
          { ingredientKey: "a", quantity: -3, isMystery: true },
          { ingredientKey: "b", quantity: 2.9, isMystery: true },
        ],
        unlockedRecipeIds: [],
      },
      error: null,
    });

    const result = await rewardSessionIngredients("s");

    expect(result.ingredients.map((row) => [row.ingredientKey, row.quantity])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("throws on an RPC error so callers can log it and still finish the session", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(rewardSessionIngredients("session-1")).rejects.toThrow("rewardSessionIngredients: boom");
  });
});

describe("shop catalog reads carry the mystery fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("listShopRecipes maps is_mystery and teaser_i18n (defaults: false / null)", async () => {
    const builder = { select: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          id: "r1",
          slug: "crystal-dumpling",
          title: "Crystal Dumplings",
          display_order: 14,
          is_active: true,
          variant_icon_rules: [{ match: [], iconPath: "/rewards/crystal-dumpling_plain.png" }],
          intro: "x",
          unlock_cost_coins: 0,
          base_ingredients: [],
          special_ingredient_slots: [],
          cook_method: "stove",
          food_type: "hotmeal",
          is_mystery: true,
          teaser_i18n: { en: "A secret.", zh: "秘密。" },
        },
        {
          id: "r2",
          slug: "bun",
          title: "Bun",
          display_order: 2,
          is_active: true,
          variant_icon_rules: [],
          intro: "y",
          unlock_cost_coins: 25,
          base_ingredients: [],
          special_ingredient_slots: [],
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [mystery, normal] = await listShopRecipes();

    expect(mystery.isMystery).toBe(true);
    expect(mystery.teaserI18n).toEqual({ en: "A secret.", zh: "秘密。" });
    expect(normal.isMystery).toBe(false);
    expect(normal.teaserI18n).toBeNull();
  });

  it("listShopIngredientPrices maps is_mystery (default false)", async () => {
    const builder = { select: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        { ingredient_key: "wild-tiger-prawn", cost_coins: 0, updated_at: "2026-10-24T00:00:00Z", is_mystery: true },
        { ingredient_key: "milk", cost_coins: 5, updated_at: "2026-10-24T00:00:00Z" },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [prawn, milk] = await listShopIngredientPrices();

    expect(prawn.isMystery).toBe(true);
    expect(milk.isMystery).toBe(false);
  });
});
