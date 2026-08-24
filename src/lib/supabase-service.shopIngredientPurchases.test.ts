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

import { listShopIngredientPurchases, purchaseShopIngredient } from "./supabase-service";

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

describe("purchaseShopIngredient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls purchase_shop_ingredient with the recipe, ingredient key, and quantity", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    await purchaseShopIngredient("recipe-1", "milk", 3);

    expect(rpcMock).toHaveBeenCalledWith("purchase_shop_ingredient", {
      p_recipe_id: "recipe-1",
      p_ingredient_key: "milk",
      p_quantity: 3,
    });
  });

  it("defaults quantity to 1 when not given", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    await purchaseShopIngredient("recipe-1", "milk");

    expect(rpcMock).toHaveBeenCalledWith("purchase_shop_ingredient", {
      p_recipe_id: "recipe-1",
      p_ingredient_key: "milk",
      p_quantity: 1,
    });
  });

  it("normalizes a successful purchase result", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        code: "purchased",
        recipeId: "recipe-1",
        ingredientKey: "milk",
        remainingCoins: 12,
        coinsSpent: 8,
        quantity: 2,
      },
      error: null,
    });

    const result = await purchaseShopIngredient("recipe-1", "milk", 2);

    expect(result).toEqual({
      success: true,
      code: "purchased",
      recipeId: "recipe-1",
      ingredientKey: "milk",
      remainingCoins: 12,
      coinsSpent: 8,
      quantity: 2,
    });
  });

  it("throws when the RPC errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(purchaseShopIngredient("recipe-1", "milk")).rejects.toThrow(
      "purchaseShopIngredient: boom"
    );
  });
});

describe("listShopIngredientPurchases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("returns one ledger entry per unit purchased, for the current user by default", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ ingredient_key: "milk" }, { ingredient_key: "milk" }, { ingredient_key: "egg" }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await listShopIngredientPurchases();

    expect(fromMock).toHaveBeenCalledWith("shop_ingredient_purchases");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "family_id", "family-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
    expect(result).toEqual([
      { ingredientKey: "milk" },
      { ingredientKey: "milk" },
      { ingredientKey: "egg" },
    ]);
  });

  it("reads a target user's purchases when given", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listShopIngredientPurchases("child-2");

    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "child-2");
  });

  it("throws when the query errors", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    fromMock.mockReturnValue(builder);

    await expect(listShopIngredientPurchases()).rejects.toThrow(
      "listShopIngredientPurchases: boom"
    );
  });
});
