import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "../shop/shop.types";
import {
  areShopRecipeAdminDraftsEqual,
  buildShopRecipeAdminDraft,
  mergeReadonlyShopLocalizedIngredientRows,
  mergeReadonlySpecialIngredientLogic,
  normalizeShopRecipeAdminDraft,
  validateShopRecipeAdminDraft,
} from "./shopAdmin.types";

const recipeFixture: ShopRecipe = {
  id: "recipe-1",
  slug: "bubble_tea",
  title: "Bubble Tea",
  titleI18n: {
    en: "Bubble Tea",
    zh: "珍珠奶茶",
  },
  displayOrder: 0,
  isActive: true,
  intro: "A sweet milk tea with chewy pearls.",
  introI18n: {
    en: "A sweet milk tea with chewy pearls.",
    zh: "一杯有嚼劲珍珠的香甜奶茶。",
  },
  unlockCostCoins: 25,
  baseIngredients: [
    { name: "Milk", quantity: "1", unit: "cup" },
    { name: "Tea", quantity: "2", unit: "bags" },
  ],
  baseIngredientsI18n: {
    en: [
      { name: " Milk ", quantity: " 1 ", unit: " cup " },
      { name: "Tea", quantity: "2", unit: "bags" },
    ],
    zh: [
      { name: " 牛奶 ", quantity: " 1 ", unit: " 杯 " },
      { name: "红茶", quantity: "2", unit: "包" },
    ],
  },
  specialIngredientSlots: [
    {
      slotKey: "specialty",
      label: "Special Ingredient",
      maxSelections: 1,
      options: [{ key: "brown-sugar", label: "Brown Sugar", effect: "Wink face" }],
    },
  ],
  specialIngredientSlotsI18n: {
    en: [
      {
        slotKey: "specialty",
        label: " Special Ingredient ",
        maxSelections: 1,
        options: [
          { key: "brown-sugar", label: " Brown Sugar ", effect: " Wink face " },
        ],
      },
    ],
    zh: [
      {
        slotKey: "specialty",
        label: " 特殊材料 ",
        maxSelections: 1,
        options: [{ key: "brown-sugar", label: " 黑糖 ", effect: " 眨眼表情 " }],
      },
    ],
  },
  variantIconRules: [{ match: [], iconPath: "/rewards/bubble-tea_plain.png" }],
};

describe("shopAdmin.types", () => {
  it("builds and normalizes a bilingual draft from a recipe", () => {
    const draft = buildShopRecipeAdminDraft(recipeFixture);
    const normalized = normalizeShopRecipeAdminDraft(draft);

    expect(normalized.title.zh).toBe("珍珠奶茶");
    expect(normalized.baseIngredients.en[0]).toEqual({
      name: "Milk",
      quantity: "1",
      unit: "cup",
    });
    expect(normalized.baseIngredients.zh[0]).toEqual({
      name: "牛奶",
      quantity: "1",
      unit: "杯",
    });
    expect(normalized.specialIngredientSlots.zh[0].options[0].effect).toBe("眨眼表情");
  });

  it("compares drafts after normalization", () => {
    const left = buildShopRecipeAdminDraft(recipeFixture);
    const right = buildShopRecipeAdminDraft({
      ...recipeFixture,
      titleI18n: { en: " Bubble Tea ", zh: " 珍珠奶茶 " },
    });

    expect(areShopRecipeAdminDraftsEqual(left, right)).toBe(true);
  });

  it("validates both locales for required fields", () => {
    const draft = {
      ...buildShopRecipeAdminDraft(recipeFixture),
      title: { en: " ", zh: "" },
      intro: { en: "", zh: "" },
      baseIngredients: {
        en: [{ name: "", quantity: "", unit: "" }],
        zh: [{ name: "", quantity: "", unit: "" }],
      },
      specialIngredientSlots: {
        en: [
          {
            slotKey: "specialty",
            label: "",
            maxSelections: 1,
            options: [{ key: "brown-sugar", label: "", effect: "" }],
          },
        ],
        zh: [
          {
            slotKey: "specialty",
            label: "",
            maxSelections: 1,
            options: [{ key: "brown-sugar", label: "", effect: "" }],
          },
        ],
      },
    };

    expect(validateShopRecipeAdminDraft(draft)).toEqual(
      expect.arrayContaining([
        "EN title is required.",
        "ZH title is required.",
        "EN intro is required.",
        "ZH intro is required.",
        "EN ingredient 1: name is required.",
        "ZH ingredient 1: name is required.",
        "Ingredient 1: quantity is required.",
      ])
    );
  });

  it("preserves readonly slot logic for both locales", () => {
    const merged = mergeReadonlySpecialIngredientLogic({
      persistedSlots: recipeFixture.specialIngredientSlots,
      draftSlots: {
        en: [
          {
            slotKey: "specialty",
            label: "Flavor",
            maxSelections: 99,
            options: [
              {
                key: "brown-sugar",
                label: "Brown Sugar Syrup",
                effect: "Adds the wink mood.",
              },
            ],
          },
        ],
        zh: [
          {
            slotKey: "specialty",
            label: "风味",
            maxSelections: 99,
            options: [
              {
                key: "brown-sugar",
                label: "黑糖糖浆",
                effect: "会带来眨眼表情。",
              },
            ],
          },
        ],
      },
    });

    expect(merged.en[0].maxSelections).toBe(1);
    expect(merged.zh[0].options[0].label).toBe("黑糖糖浆");
  });

  it("normalizes aligned bilingual ingredient rows", () => {
    const merged = mergeReadonlyShopLocalizedIngredientRows({
      draftIngredients: {
        en: [{ name: "Milk", quantity: "1", unit: "cup" }],
        zh: [{ name: "牛奶", quantity: "", unit: "杯" }],
      },
    });

    expect(merged.zh[0].quantity).toBe("1");
  });
});
