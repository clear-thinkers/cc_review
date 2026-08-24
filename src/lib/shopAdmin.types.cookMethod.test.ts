import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "./shop.types";
import {
  buildShopRecipeAdminDraft,
  normalizeShopRecipeAdminDraft,
  validateShopRecipeAdminDraft,
} from "./shopAdmin.types";

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
    baseIngredients: [{ ingredientKey: "milk", name: "Milk", quantity: 1 }],
    baseIngredientsI18n: {
      en: [{ ingredientKey: "milk", name: "Milk", quantity: 1 }],
      zh: [{ ingredientKey: "milk", name: "牛奶", quantity: 1 }],
    },
    specialIngredients: [],
    specialIngredientsI18n: { en: [], zh: [] },
    variantIconRules: [],
    cookMethod: null,
    foodType: null,
    ...overrides,
  };
}

describe("ShopRecipeAdminDraft cookMethod/foodType (feature spec 2026-08-23-kitchen-page.md)", () => {
  it("buildShopRecipeAdminDraft carries the recipe's cookMethod and foodType through unchanged", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ cookMethod: "stove", foodType: "drinks" }));
    expect(draft.cookMethod).toBe("stove");
    expect(draft.foodType).toBe("drinks");

    const emptyDraft = buildShopRecipeAdminDraft(makeRecipe({ cookMethod: null, foodType: null }));
    expect(emptyDraft.cookMethod).toBeNull();
    expect(emptyDraft.foodType).toBeNull();
  });

  it("normalizeShopRecipeAdminDraft accepts stove/oven and rejects anything else to null", () => {
    expect(normalizeShopRecipeAdminDraft({ cookMethod: "stove" }).cookMethod).toBe("stove");
    expect(normalizeShopRecipeAdminDraft({ cookMethod: "oven" }).cookMethod).toBe("oven");
    expect(normalizeShopRecipeAdminDraft({ cookMethod: "microwave" }).cookMethod).toBeNull();
    expect(normalizeShopRecipeAdminDraft({}).cookMethod).toBeNull();
  });

  it("normalizeShopRecipeAdminDraft accepts drinks/hotmeal/desserts and rejects anything else to null", () => {
    expect(normalizeShopRecipeAdminDraft({ foodType: "drinks" }).foodType).toBe("drinks");
    expect(normalizeShopRecipeAdminDraft({ foodType: "hotmeal" }).foodType).toBe("hotmeal");
    expect(normalizeShopRecipeAdminDraft({ foodType: "desserts" }).foodType).toBe("desserts");
    expect(normalizeShopRecipeAdminDraft({ foodType: "snacks" }).foodType).toBeNull();
    expect(normalizeShopRecipeAdminDraft({}).foodType).toBeNull();
  });

  it("validation requires foodType whenever cookMethod is set -- a cookable recipe must be sortable", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ cookMethod: "stove", foodType: null }));
    const errors = validateShopRecipeAdminDraft(draft);
    expect(errors).toContain("Food Type is required for a cookable recipe (Shop Kitchen).");
  });

  it("validation does not require foodType when cookMethod is null (not cookable)", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ cookMethod: null, foodType: null }));
    const errors = validateShopRecipeAdminDraft(draft);
    expect(errors).not.toContain("Food Type is required for a cookable recipe (Shop Kitchen).");
  });

  it("validation passes when both cookMethod and foodType are set", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ cookMethod: "oven", foodType: "desserts" }));
    const errors = validateShopRecipeAdminDraft(draft);
    expect(errors).not.toContain("Food Type is required for a cookable recipe (Shop Kitchen).");
  });
});
