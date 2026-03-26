import { describe, expect, it } from "vitest";
import { wordsStrings } from "../words.strings";
import type { ShopRecipe } from "../shop/shop.types";
import {
  SHOP_ADMIN_INGREDIENT_SAVE_ERROR_CODES,
  areShopAdminIngredientDraftsEqual,
  areShopRecipeAdminDraftsEqual,
  buildShopAdminIngredientDrafts,
  buildShopRecipeAdminDraft,
  createEmptyShopAdminIngredientDraft,
  isShopAdminIngredientSaveErrorCode,
  listShopAdminVariantIngredientOptions,
  mergeReadonlyShopLocalizedIngredientRows,
  mergeReadonlyVariantIconRules,
  mergeShopLocalizedSpecialIngredientRows,
  normalizeShopRecipeAdminDraft,
  removeDeletedIngredientKeysFromLocalizedIngredientRows,
  removeDeletedIngredientKeysFromRecipe,
  removeDeletedIngredientKeysFromRecipeAdminDraft,
  removeDeletedIngredientKeysFromVariantIconRules,
  serializeShopAdminIngredientDrafts,
  validateShopAdminIngredientDrafts,
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

  it("canonicalizes variant match keys in draft normalization", () => {
    const normalized = normalizeShopRecipeAdminDraft({
      ...buildShopRecipeAdminDraft(recipeFixture),
      variantIconRules: [
        { match: ["brown_sugar", "jasmine"], iconPath: "/rewards/bubble-tea_combo.png" },
      ],
    });

    expect(normalized.variantIconRules[0]).toEqual({
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

  it("removes deleted ingredient keys from aligned bilingual ingredient rows", () => {
    expect(
      removeDeletedIngredientKeysFromLocalizedIngredientRows(
        {
          en: [
            { ingredientKey: "milk", name: "Milk", quantity: 1 },
            { ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 2 },
            { name: "Custom", quantity: 3 },
          ],
          zh: [
            { ingredientKey: "milk", name: "\u725b\u5976", quantity: 1 },
            { ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 2 },
            { name: "\u81ea\u5b9a\u4e49", quantity: 3 },
          ],
        },
        ["brown_sugar"]
      )
    ).toEqual({
      en: [
        { ingredientKey: "milk", name: "Milk", quantity: 1 },
        { name: "Custom", quantity: 3 },
      ],
      zh: [
        { ingredientKey: "milk", name: "\u725b\u5976", quantity: 1 },
        { name: "\u81ea\u5b9a\u4e49", quantity: 3 },
      ],
    });
  });

  it("deduplicates variant rules after deleted ingredient keys are stripped", () => {
    expect(
      removeDeletedIngredientKeysFromVariantIconRules(
        [
          { match: [], iconPath: "/rewards/bubble-tea_plain.png" },
          { match: ["jasmine"], iconPath: "/rewards/bubble-tea_jasmine.png" },
          { match: ["brown-sugar", "jasmine"], iconPath: "/rewards/bubble-tea_combo.png" },
        ],
        ["brown-sugar", "jasmine"]
      )
    ).toEqual([{ match: [], iconPath: "/rewards/bubble-tea_plain.png" }]);
  });

  it("removes deleted ingredient keys from recipes and admin drafts", () => {
    const cleanedRecipe = removeDeletedIngredientKeysFromRecipe(recipeFixture, [
      "brown-sugar",
    ]);
    const cleanedDraft = removeDeletedIngredientKeysFromRecipeAdminDraft(
      buildShopRecipeAdminDraft(recipeFixture),
      ["brown-sugar"]
    );

    expect(cleanedRecipe.specialIngredientsI18n.en).toEqual([
      { ingredientKey: "jasmine", name: " Jasmine ", quantity: 1 },
    ]);
    expect(cleanedRecipe.variantIconRules).toEqual([
      { match: [], iconPath: "/rewards/bubble-tea_plain.png" },
      { match: ["jasmine"], iconPath: "/rewards/bubble-tea_combo.png" },
    ]);
    expect(cleanedDraft.specialIngredients.en).toEqual([
      { ingredientKey: "jasmine", name: " Jasmine ", quantity: 1 },
    ]);
    expect(cleanedDraft.variantIconRules).toEqual([
      { match: [], iconPath: "/rewards/bubble-tea_plain.png" },
      { match: ["jasmine"], iconPath: "/rewards/bubble-tea_combo.png" },
    ]);
  });

  it("normalizes and compares ingredient catalog drafts", () => {
    const left = buildShopAdminIngredientDrafts([
      {
        key: "brown-sugar",
        label: { en: "Brown Sugar", zh: "\u9ed1\u7cd6" },
        defaultCostCoins: 0,
        iconPath: "/ingredients/brown-sugar.png",
        costCoins: 5,
        usage: { usedInBase: false, usedInSpecial: true },
      },
    ]);
    const right = [
      {
        ...createEmptyShopAdminIngredientDraft("new-1"),
        draftId: "something-else",
        isPersisted: true,
        key: " brown_sugar ",
        label: { en: " Brown Sugar ", zh: " \u9ed1\u7cd6 " },
        iconPath: " /ingredients/brown-sugar.png ",
        costCoins: 5,
        usage: { usedInBase: false, usedInSpecial: true },
      },
    ];

    expect(areShopAdminIngredientDraftsEqual(left, right)).toBe(true);
    expect(serializeShopAdminIngredientDrafts(right)).toEqual([
      {
        key: "brown-sugar",
        label: { en: "Brown Sugar", zh: "\u9ed1\u7cd6" },
        defaultCostCoins: 0,
        iconPath: "/ingredients/brown-sugar.png",
        costCoins: 5,
        usage: { usedInBase: false, usedInSpecial: true },
      },
    ]);
  });

  it("validates ingredient catalog draft fields", () => {
    expect(
      validateShopAdminIngredientDrafts([
        {
          ...createEmptyShopAdminIngredientDraft("draft-1"),
          key: "",
          label: { en: "", zh: "" },
          iconPath: "ingredients/missing-slash.png",
          costCoins: -1,
        },
        {
          ...createEmptyShopAdminIngredientDraft("draft-2"),
          key: "brown_sugar",
          label: { en: "Brown Sugar", zh: "\u9ed1\u7cd6" },
          costCoins: 3,
        },
        {
          ...createEmptyShopAdminIngredientDraft("draft-3"),
          key: "brown-sugar",
          label: { en: "Again", zh: "\u518d\u6b21" },
          costCoins: 3,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "Ingredient 1: key is required.",
        "Ingredient 1: English name is required.",
        "Ingredient 1: Chinese name is required.",
        "Ingredient 1: price must be a whole number from 0 and up.",
        'Ingredient 3: duplicate ingredient key "brown-sugar".',
        'Ingredient 1: icon path must start with "/".',
      ])
    );
  });
});

describe("shop admin strings parity", () => {
  it("keeps collapsible controls in sync across locales", () => {
    expect(Object.keys(wordsStrings.en.shopAdmin.collapsible).sort()).toEqual(
      Object.keys(wordsStrings.zh.shopAdmin.collapsible).sort()
    );
  });

  it("keeps ingredient pricing keys in sync across locales", () => {
    expect(Object.keys(wordsStrings.en.shopAdmin.ingredientPricing).sort()).toEqual(
      Object.keys(wordsStrings.zh.shopAdmin.ingredientPricing).sort()
    );
  });
});

describe("shop admin ingredient save errors", () => {
  it("recognizes supported save error codes", () => {
    expect(
      isShopAdminIngredientSaveErrorCode(
        SHOP_ADMIN_INGREDIENT_SAVE_ERROR_CODES.missingIconPathColumn
      )
    ).toBe(true);
  });

  it("rejects unknown save error codes", () => {
    expect(isShopAdminIngredientSaveErrorCode("something-else")).toBe(false);
    expect(isShopAdminIngredientSaveErrorCode(null)).toBe(false);
  });
});
