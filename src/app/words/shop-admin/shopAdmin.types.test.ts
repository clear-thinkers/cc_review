import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "../shop/shop.types";
import {
  areShopRecipeAdminDraftsEqual,
  buildShopRecipeAdminDraft,
  listShopAdminVariantIngredientOptions,
  mergeReadonlyShopLocalizedIngredientRows,
  mergeReadonlyVariantIconRules,
  mergeShopLocalizedSpecialIngredientRows,
  normalizeShopRecipeAdminDraft,
  validateShopRecipeAdminDraft,
} from "./shopAdmin.types";

const recipeFixture: ShopRecipe = {
  id: "recipe-1",
  slug: "bubble_tea",
  title: "Bubble Tea",
  titleI18n: {
    en: "Bubble Tea",
    zh: "\u73cd\u73e0\u5976\u8336",
  },
  displayOrder: 0,
  isActive: true,
  intro: "A sweet milk tea with chewy pearls.",
  introI18n: {
    en: "A sweet milk tea with chewy pearls.",
    zh: "\u4e00\u676f\u6709\u56bc\u52c1\u73cd\u73e0\u7684\u9999\u751c\u5976\u8336\u3002",
  },
  unlockCostCoins: 25,
  baseIngredients: [
    { ingredientKey: "milk", name: "Milk", quantity: 1 },
    { name: "Tea", quantity: 2 },
  ],
  baseIngredientsI18n: {
    en: [
      { ingredientKey: "milk", name: " Milk ", quantity: 1 },
      { name: "Tea", quantity: 2 },
    ],
    zh: [
      { ingredientKey: "milk", name: " \u725b\u5976 ", quantity: 1 },
      { name: "\u7ea2\u8336", quantity: 2 },
    ],
  },
  specialIngredients: [
    { ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 },
    { ingredientKey: "jasmine", name: "Jasmine", quantity: 1 },
  ],
  specialIngredientsI18n: {
    en: [
      { ingredientKey: "brown-sugar", name: " Brown Sugar ", quantity: 1 },
      { ingredientKey: "jasmine", name: " Jasmine ", quantity: 1 },
    ],
    zh: [
      { ingredientKey: "brown-sugar", name: " \u9ed1\u7cd6 ", quantity: 1 },
      { ingredientKey: "jasmine", name: " \u8336\u8309\u8389 ", quantity: 1 },
    ],
  },
  variantIconRules: [
    { match: [], iconPath: "/rewards/bubble-tea_plain.png" },
    { match: ["brown-sugar", "jasmine"], iconPath: "/rewards/bubble-tea_combo.png" },
  ],
};

describe("shopAdmin.types", () => {
  it("builds and normalizes a bilingual draft from a recipe", () => {
    const draft = buildShopRecipeAdminDraft(recipeFixture);
    const normalized = normalizeShopRecipeAdminDraft(draft);

    expect(normalized.title.zh).toBe("\u73cd\u73e0\u5976\u8336");
    expect(normalized.baseIngredients.zh[0]).toEqual({
      ingredientKey: "milk",
      name: "\u725b\u5976",
      quantity: 1,
    });
    expect(normalized.specialIngredients[ "zh" ][0]).toEqual({
      ingredientKey: "brown-sugar",
      name: "\u9ed1\u7cd6",
      quantity: 1,
    });
    expect(normalized.variantIconRules[1]).toEqual({
      match: ["brown-sugar", "jasmine"],
      iconPath: "/rewards/bubble-tea_combo.png",
    });
  });

  it("compares drafts after normalization", () => {
    const left = buildShopRecipeAdminDraft(recipeFixture);
    const right = buildShopRecipeAdminDraft({
      ...recipeFixture,
      titleI18n: { en: " Bubble Tea ", zh: " \u73cd\u73e0\u5976\u8336 " },
      variantIconRules: [
        { match: [], iconPath: "/rewards/bubble-tea_plain.png" },
        {
          match: ["jasmine", "brown-sugar", "jasmine"],
          iconPath: "/rewards/bubble-tea_combo.png",
        },
      ],
    });

    expect(areShopRecipeAdminDraftsEqual(left, right)).toBe(true);
  });

  it("validates required ingredient names and quantities", () => {
    const draft = {
      ...buildShopRecipeAdminDraft(recipeFixture),
      title: { en: " ", zh: "" },
      intro: { en: "", zh: "" },
      baseIngredients: {
        en: [{ name: "", quantity: 0 }],
        zh: [{ name: "", quantity: 0 }],
      },
      specialIngredients: {
        en: [{ name: "", quantity: 0 }],
        zh: [{ name: "", quantity: 0 }],
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
        "EN special ingredient 1: name is required.",
        "ZH special ingredient 1: name is required.",
        "Special ingredient 1: quantity is required.",
      ])
    );
  });

  it("normalizes aligned bilingual ingredient rows", () => {
    const merged = mergeReadonlyShopLocalizedIngredientRows({
      draftIngredients: {
        en: [{ ingredientKey: "milk", name: "Milk", quantity: 1 }],
        zh: [{ ingredientKey: "milk", name: "\u725b\u5976", quantity: 0 }],
      },
    });

    expect(merged.zh[0].quantity).toBe(1);
    expect(merged.en[0].ingredientKey).toBe("milk");
  });

  it("reapplies catalog labels for icon-backed base rows during merge", () => {
    const merged = mergeReadonlyShopLocalizedIngredientRows({
      draftIngredients: {
        en: [{ ingredientKey: "milk", name: "Anything", quantity: 2 }],
        zh: [{ ingredientKey: "milk", name: "Whatever", quantity: 0 }],
      },
    });

    expect(merged.en[0]).toEqual({
      ingredientKey: "milk",
      name: "Milk",
      quantity: 2,
    });
    expect(merged.zh[0]).toEqual({
      ingredientKey: "milk",
      name: "\u725b\u5976",
      quantity: 2,
    });
  });

  it("keeps keyed special ingredients aligned during merge", () => {
    const merged = mergeShopLocalizedSpecialIngredientRows({
      draftIngredients: {
        en: [{ ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 2 }],
        zh: [{ ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 0 }],
      },
    });

    expect(merged.en[0]).toEqual({
      ingredientKey: "brown-sugar",
      name: "Brown Sugar",
      quantity: 2,
    });
    expect(merged.zh[0]).toEqual({
      ingredientKey: "brown-sugar",
      name: "\u9ed1\u7cd6",
      quantity: 2,
    });
  });

  it("lists keyed special ingredients for variant mapping", () => {
    expect(
      listShopAdminVariantIngredientOptions(buildShopRecipeAdminDraft(recipeFixture).specialIngredients)
    ).toEqual([
      {
        key: "brown-sugar",
        label: { en: "Brown Sugar", zh: "\u9ed1\u7cd6" },
      },
      {
        key: "jasmine",
        label: { en: "Jasmine", zh: "\u8336\u8309\u8389" },
      },
    ]);
  });

  it("rejects duplicate special ingredient keys", () => {
    const draft = {
      ...buildShopRecipeAdminDraft(recipeFixture),
      specialIngredients: {
        en: [
          { ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 },
          { ingredientKey: "brown-sugar", name: "Brown Sugar Again", quantity: 1 },
        ],
        zh: [
          { ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 1 },
          { ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6\u4e8c", quantity: 1 },
        ],
      },
    };

    expect(validateShopRecipeAdminDraft(draft)).toEqual(
      expect.arrayContaining([
        'Special ingredient 2: duplicate ingredient key "brown-sugar".',
      ])
    );
  });

  it("rejects duplicate or unknown variant ingredient combinations", () => {
    const draft = {
      ...buildShopRecipeAdminDraft(recipeFixture),
      variantIconRules: [
        { match: ["brown-sugar"], iconPath: "/rewards/bubble-tea_plain.png" },
        { match: ["mystery", "brown-sugar"], iconPath: "/rewards/bubble-tea_other.png" },
        { match: ["brown-sugar"], iconPath: "/rewards/bubble-tea_dup.png" },
      ],
    };

    expect(validateShopRecipeAdminDraft(draft)).toEqual(
      expect.arrayContaining([
        'Variant 2: unknown special ingredient key "mystery".',
        "Variant 3: duplicate ingredient combination.",
      ])
    );
  });

  it("preserves icon paths while applying edited variant matches", () => {
    expect(
      mergeReadonlyVariantIconRules({
        persistedRules: recipeFixture.variantIconRules,
        draftRules: [
          { match: ["brown-sugar"], iconPath: "/rewards/ignored.png" },
          {
            match: ["brown-sugar", "jasmine", "jasmine"],
            iconPath: "/rewards/also-ignored.png",
          },
        ],
      })
    ).toEqual([
      { match: ["brown-sugar"], iconPath: "/rewards/bubble-tea_plain.png" },
      { match: ["brown-sugar", "jasmine"], iconPath: "/rewards/bubble-tea_combo.png" },
    ]);
  });
});
