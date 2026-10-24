import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "./shop.types";
import {
  buildShopAdminIngredientDrafts,
  buildShopRecipeAdminDraft,
  createEmptyShopAdminIngredientDraft,
  normalizeShopRecipeAdminDraft,
  serializeShopAdminIngredientDrafts,
  validateShopAdminIngredientDrafts,
  validateShopRecipeAdminDraft,
} from "./shopAdmin.types";

function makeRecipe(overrides: Partial<ShopRecipe> = {}): ShopRecipe {
  return {
    id: "recipe-1",
    slug: "crystal-dumpling",
    title: "Crystal Dumplings",
    titleI18n: { en: "Crystal Dumplings", zh: "水晶虾饺" },
    displayOrder: 14,
    isActive: true,
    intro: "Glowing dumplings.",
    introI18n: { en: "Glowing dumplings.", zh: "发光的饺子。" },
    unlockCostCoins: 0,
    baseIngredients: [{ ingredientKey: "wild-tiger-prawn", name: "Wild Tiger Prawn", quantity: 2 }],
    baseIngredientsI18n: {
      en: [{ ingredientKey: "wild-tiger-prawn", name: "Wild Tiger Prawn", quantity: 2 }],
      zh: [{ ingredientKey: "wild-tiger-prawn", name: "野生虎头虾", quantity: 2 }],
    },
    specialIngredients: [],
    specialIngredientsI18n: { en: [], zh: [] },
    variantIconRules: [{ match: [], iconPath: "/rewards/crystal-dumpling_plain.png" }],
    cookMethod: "stove",
    foodType: "hotmeal",
    isMystery: true,
    teaserI18n: { en: "A secret.", zh: "秘密。" },
    ...overrides,
  };
}

const mysteryKeys = new Set(["wild-tiger-prawn"]);

describe("recipe admin draft carries the mystery fields", () => {
  it("buildShopRecipeAdminDraft copies isMystery and the teaser (blank when absent)", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe());
    expect(draft.isMystery).toBe(true);
    expect(draft.teaserI18n).toEqual({ en: "A secret.", zh: "秘密。" });

    const plain = buildShopRecipeAdminDraft(makeRecipe({ isMystery: false, teaserI18n: null }));
    expect(plain.isMystery).toBe(false);
    expect(plain.teaserI18n).toEqual({ en: "", zh: "" });
  });

  it("normalizeShopRecipeAdminDraft only accepts a literal true for isMystery", () => {
    expect(normalizeShopRecipeAdminDraft({ isMystery: true }).isMystery).toBe(true);
    expect(normalizeShopRecipeAdminDraft({ isMystery: "true" }).isMystery).toBe(false);
    expect(normalizeShopRecipeAdminDraft({}).isMystery).toBe(false);
    expect(normalizeShopRecipeAdminDraft({ teaserI18n: { en: " hi ", zh: 3 } }).teaserI18n).toEqual({
      en: "hi",
      zh: "",
    });
  });
});

describe("validateShopRecipeAdminDraft: mystery rules", () => {
  it("accepts a well-formed mystery food", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe());
    expect(validateShopRecipeAdminDraft(draft, mysteryKeys)).toEqual([]);
  });

  it("requires a cook method for a mystery food", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ cookMethod: null, foodType: null }));
    expect(validateShopRecipeAdminDraft(draft, mysteryKeys)).toContain(
      "A mystery food must be cookable: set a Cook Method."
    );
  });

  it("rejects a normal ingredient inside a mystery food", () => {
    const draft = buildShopRecipeAdminDraft(
      makeRecipe({
        baseIngredientsI18n: {
          en: [{ ingredientKey: "milk", name: "Milk", quantity: 1 }],
          zh: [{ ingredientKey: "milk", name: "牛奶", quantity: 1 }],
        },
      })
    );
    const errors = validateShopRecipeAdminDraft(draft, mysteryKeys);
    expect(errors.some((error) => error.includes("can only use mystery ingredients"))).toBe(true);
  });

  it("rejects a mystery ingredient inside a normal recipe", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ isMystery: false }));
    const errors = validateShopRecipeAdminDraft(draft, mysteryKeys);
    expect(errors.some((error) => error.includes("Only a mystery food can use a mystery ingredient"))).toBe(true);
  });

  it("skips the ingredient-kind cross-check when no mystery key set is supplied", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ isMystery: false }));
    expect(validateShopRecipeAdminDraft(draft)).toEqual([]);
  });

  it("caps teaser length at 140 characters per locale", () => {
    const draft = buildShopRecipeAdminDraft(makeRecipe({ teaserI18n: { en: "x".repeat(141), zh: "短" } }));
    const errors = validateShopRecipeAdminDraft(draft, mysteryKeys);
    expect(errors).toContain("EN teaser must be 140 characters or fewer.");
    expect(errors.some((error) => error.startsWith("ZH teaser"))).toBe(false);
  });

  it("does not apply the teaser cap to a non-mystery recipe", () => {
    const draft = buildShopRecipeAdminDraft(
      makeRecipe({ isMystery: false, baseIngredientsI18n: {
        en: [{ ingredientKey: "milk", name: "Milk", quantity: 1 }],
        zh: [{ ingredientKey: "milk", name: "牛奶", quantity: 1 }],
      }, teaserI18n: { en: "x".repeat(500), zh: "" } })
    );
    expect(validateShopRecipeAdminDraft(draft, mysteryKeys)).toEqual([]);
  });
});

describe("ingredient catalog drafts carry isMystery", () => {
  const item = {
    key: "gilded-sesame-oil",
    label: { en: "Gilded Sesame Oil", zh: "金箔香油" },
    defaultCostCoins: 0,
    iconPath: "/ingredients/gilded-sesame-oil.png",
    costCoins: 0,
    usage: { usedInBase: true, usedInSpecial: false },
    isMystery: true,
  };

  it("builds, serializes, and defaults the flag", () => {
    const [draft] = buildShopAdminIngredientDrafts([item]);
    expect(draft.isMystery).toBe(true);
    expect(serializeShopAdminIngredientDrafts([draft])[0].isMystery).toBe(true);
    expect(createEmptyShopAdminIngredientDraft("new-1").isMystery).toBe(false);
  });

  it("accepts a mystery ingredient priced at 0", () => {
    const [draft] = buildShopAdminIngredientDrafts([item]);
    expect(validateShopAdminIngredientDrafts([draft])).toEqual([]);
  });

  it("rejects a mystery ingredient with a price", () => {
    const [draft] = buildShopAdminIngredientDrafts([{ ...item, costCoins: 5 }]);
    const errors = validateShopAdminIngredientDrafts([draft]);
    expect(errors.some((error) => error.includes("mystery ingredient can't have a price"))).toBe(true);
  });

  it("still allows a priced normal ingredient", () => {
    const [draft] = buildShopAdminIngredientDrafts([{ ...item, isMystery: false, costCoins: 5 }]);
    expect(validateShopAdminIngredientDrafts([draft])).toEqual([]);
  });
});
