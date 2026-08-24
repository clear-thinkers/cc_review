import { beforeEach, describe, expect, it, vi } from "vitest";
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
  cookShopRecipe,
  listShopCookedDishes,
  listShopIngredientConsumptions,
  listShopIngredientRewards,
  organizeShopKitchenCountertop,
} from "./supabase-service";

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

describe("listShopIngredientRewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("reads shop_ingredient_rewards for the current user by default", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ ingredient_key: "milk" }, { ingredient_key: "milk" }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listShopIngredientRewards();

    expect(fromMock).toHaveBeenCalledWith("shop_ingredient_rewards");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "family_id", "family-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
    expect(result).toEqual([{ ingredientKey: "milk" }, { ingredientKey: "milk" }]);
  });

  it("reads a target user's rewards when given", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listShopIngredientRewards("child-2");

    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "child-2");
  });

  it("throws when the read errors", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    fromMock.mockReturnValue(builder);

    await expect(listShopIngredientRewards()).rejects.toThrow("listShopIngredientRewards: boom");
  });
});

describe("listShopIngredientConsumptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("reads shop_ingredient_consumptions for the current user", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ ingredient_key: "egg" }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listShopIngredientConsumptions();

    expect(fromMock).toHaveBeenCalledWith("shop_ingredient_consumptions");
    expect(result).toEqual([{ ingredientKey: "egg" }]);
  });
});

describe("listShopCookedDishes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("reads shop_cooked_dishes ordered by cooked_at ascending, mapping snake_case to camelCase", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          id: "dish-1",
          user_id: "user-1",
          recipe_id: "recipe-1",
          location: "shelf",
          special_ingredient_keys: ["strawberry"],
          cooked_at: "2026-08-23T00:00:00.000Z",
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listShopCookedDishes();

    expect(fromMock).toHaveBeenCalledWith("shop_cooked_dishes");
    expect(builder.order).toHaveBeenCalledWith("cooked_at", { ascending: true });
    expect(result).toEqual([
      {
        id: "dish-1",
        userId: "user-1",
        recipeId: "recipe-1",
        location: "shelf",
        specialIngredientKeys: ["strawberry"],
        cookedAt: new Date("2026-08-23T00:00:00.000Z").getTime(),
      },
    ]);
  });

  it("falls back to 'countertop' for an unrecognized location value", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          id: "dish-1",
          user_id: "user-1",
          recipe_id: "recipe-1",
          location: "garbage",
          cooked_at: "2026-08-23T00:00:00.000Z",
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listShopCookedDishes();
    expect(result[0].location).toBe("countertop");
  });
});

describe("cookShopRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls cook_shop_recipe with the given recipe id and no special ingredient keys by default", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        code: "cooked",
        dishId: "dish-1",
        recipeId: "recipe-1",
        location: "countertop",
        specialIngredientKeys: [],
      },
      error: null,
    });

    const result = await cookShopRecipe("recipe-1");

    expect(rpcMock).toHaveBeenCalledWith("cook_shop_recipe", {
      p_recipe_id: "recipe-1",
      p_special_ingredient_keys: [],
    });
    expect(result).toEqual({
      success: true,
      code: "cooked",
      dishId: "dish-1",
      recipeId: "recipe-1",
      location: "countertop",
      specialIngredientKeys: [],
    });
  });

  it("passes selected special ingredient keys through to the RPC and the mapped result", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        code: "cooked",
        dishId: "dish-1",
        recipeId: "recipe-1",
        location: "countertop",
        specialIngredientKeys: ["strawberry"],
      },
      error: null,
    });

    const result = await cookShopRecipe("recipe-1", ["strawberry"]);

    expect(rpcMock).toHaveBeenCalledWith("cook_shop_recipe", {
      p_recipe_id: "recipe-1",
      p_special_ingredient_keys: ["strawberry"],
    });
    expect(result).toEqual({
      success: true,
      code: "cooked",
      dishId: "dish-1",
      recipeId: "recipe-1",
      location: "countertop",
      specialIngredientKeys: ["strawberry"],
    });
  });

  it("maps an insufficient_ingredients failure with the missing keys", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: false,
        code: "insufficient_ingredients",
        missingIngredientKeys: ["milk"],
      },
      error: null,
    });

    const result = await cookShopRecipe("recipe-1");

    expect(result).toEqual({
      success: false,
      code: "insufficient_ingredients",
      missingIngredientKeys: ["milk"],
    });
  });

  it("throws when the RPC errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(cookShopRecipe("recipe-1")).rejects.toThrow("cookShopRecipe: boom");
  });
});

describe("organizeShopKitchenCountertop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls organize_shop_kitchen_countertop with no arguments and maps a success result", async () => {
    rpcMock.mockResolvedValue({
      data: { success: true, code: "organized", movedCount: 3 },
      error: null,
    });

    const result = await organizeShopKitchenCountertop();

    expect(rpcMock).toHaveBeenCalledWith("organize_shop_kitchen_countertop", {});
    expect(result).toEqual({ success: true, code: "organized", movedCount: 3 });
  });

  it("throws when the RPC errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(organizeShopKitchenCountertop()).rejects.toThrow(
      "organizeShopKitchenCountertop: boom"
    );
  });
});
