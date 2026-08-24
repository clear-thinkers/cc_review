import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "./shop.types";
import { buildShopRecipeAdminDraft, normalizeShopRecipeAdminDraft } from "./shopAdmin.types";

function makeRecipe(overrides: Partial<ShopRecipe>): ShopRecipe {
  return {
    id: "recipe-1",
    slug: "bubble_tea",
    title: "Bubble Tea",
    titleI18n: { en: "Bubble Tea", zh: "珍珠奶茶" },
    displayOrder: 1,
    isActive: true,
    intro: "A fun drink.",
    introI18n: { en: "A fun drink.", zh: "一杯好玩的饮料。" },
    unlockCostCoins: 50,
    baseIngredients: [],
    baseIngredientsI18n: { en: [], zh: [] },
    specialIngredients: [],
    specialIngredientsI18n: { en: [], zh: [] },
    variantIconRules: [],
    cookMethod: null,
    ...overrides,
  };
}

describe("ShopRecipeAdminDraft cookMethod (feature spec 2026-08-23-kitchen-page.md)", () => {
  it("buildShopRecipeAdminDraft carries the recipe's cookMethod through unchanged", () => {
    expect(buildShopRecipeAdminDraft(makeRecipe({ cookMethod: "stove" })).cookMethod).toBe("stove");
    expect(buildShopRecipeAdminDraft(makeRecipe({ cookMethod: null })).cookMethod).toBeNull();
  });

  it("normalizeShopRecipeAdminDraft accepts stove/oven and rejects anything else to null", () => {
    expect(normalizeShopRecipeAdminDraft({ cookMethod: "stove" }).cookMethod).toBe("stove");
    expect(normalizeShopRecipeAdminDraft({ cookMethod: "oven" }).cookMethod).toBe("oven");
    expect(normalizeShopRecipeAdminDraft({ cookMethod: "microwave" }).cookMethod).toBeNull();
    expect(normalizeShopRecipeAdminDraft({}).cookMethod).toBeNull();
  });
});
