import { describe, expect, it } from "vitest";
import {
  buildShopIngredientPriceMap,
  canAffordRecipeUnlock,
  getShopRecipeContentForLocale,
  normalizeShopIngredientList,
  normalizeShopLocalizedIngredients,
  normalizeShopLocalizedSpecialIngredients,
  normalizeShopSpecialIngredientList,
  normalizeShopVariantIconRules,
  normalizeUnlockShopRecipeResult,
  resolvePlainShopRecipeIconPath,
  resolveShopIngredientCost,
  resolveShopIngredientIconPath,
  resolveShopRecipeIconPath,
} from "./shop";

describe("canAffordRecipeUnlock", () => {
  it("uses unlockCostCoins from the recipe row", () => {
    expect(canAffordRecipeUnlock(25, { unlockCostCoins: 25 })).toBe(true);
    expect(canAffordRecipeUnlock(24, { unlockCostCoins: 25 })).toBe(false);
  });
});

describe("resolveShopRecipeIconPath", () => {
  it("uses the empty match rule as the default icon", () => {
    expect(
      resolveShopRecipeIconPath(
        [
          { match: [], iconPath: "/rewards/donut_smile_1.png" },
          { match: ["wink_jelly"], iconPath: "/rewards/donut_wink_1.png" },
        ],
        []
      )
    ).toBe("/rewards/donut_smile_1.png");
  });

  it("prefers the most specific subset match", () => {
    expect(
      resolveShopRecipeIconPath(
        [
          { match: [], iconPath: "/rewards/donut_smile_1.png" },
          { match: ["spark_pop"], iconPath: "/rewards/donut_excited_1.png" },
          {
            match: ["spark_pop", "goal_glaze"],
            iconPath: "/rewards/donut_ambitious_1.png",
          },
        ],
        ["spark_pop", "goal_glaze"]
      )
    ).toBe("/rewards/donut_ambitious_1.png");
  });

  it("treats underscore and kebab-case ingredient keys as the same match", () => {
    expect(
      resolveShopRecipeIconPath(
        [
          { match: [], iconPath: "/rewards/bubble-tea_plain.png" },
          { match: ["brown-sugar"], iconPath: "/rewards/bubble-tea_brown-sugar_wink.png" },
        ],
        ["brown_sugar"]
      )
    ).toBe("/rewards/bubble-tea_brown-sugar_wink.png");
  });

  it("ignores invalid variant rows and normalizes messy combo rules", () => {
    expect(
      resolveShopRecipeIconPath(
        normalizeShopVariantIconRules([
          { match: [], iconPath: " /rewards/donut_plain.png " },
          { match: ["strawberry", "sprinkles", "strawberry"], iconPath: " " },
          {
            match: ["strawberry", "sprinkles", "strawberry"],
            iconPath: " /rewards/donut_strawberry-sprinkles.png ",
          },
        ]),
        ["sprinkles", "strawberry"]
      )
    ).toBe("/rewards/donut_strawberry-sprinkles.png");
  });
});

describe("normalizeShopVariantIconRules", () => {
  it("trims icon paths and canonicalizes combo match keys", () => {
    expect(
      normalizeShopVariantIconRules([
        {
          match: ["sprinkles", "strawberry", "strawberry", 12],
          iconPath: " /rewards/donut_combo.png ",
        },
        {
          match: ["ignored"],
          iconPath: " ",
        },
      ])
    ).toEqual([
      {
        match: ["sprinkles", "strawberry"],
        iconPath: "/rewards/donut_combo.png",
      },
    ]);
  });
});

describe("resolvePlainShopRecipeIconPath", () => {
  it("returns the plain icon even when the default rule is not plain", () => {
    expect(
      resolvePlainShopRecipeIconPath([
        { match: [], iconPath: "/rewards/donut_smile_1.png" },
        { match: [], iconPath: "/rewards/donut_plain.png" },
        { match: ["spark_pop"], iconPath: "/rewards/donut_sprinkled_excited.png" },
      ])
    ).toBe("/rewards/donut_plain.png");
  });

  it("returns null when no plain icon exists", () => {
    expect(
      resolvePlainShopRecipeIconPath([
        { match: [], iconPath: "/rewards/cake_smile_1.png" },
        { match: ["sleepy_cream"], iconPath: "/rewards/cake_sleep_1.png" },
      ])
    ).toBeNull();
  });
});

describe("resolveShopIngredientIconPath", () => {
  it("returns the configured ingredient icon when a catalog-backed key exists", () => {
    expect(
      resolveShopIngredientIconPath({
        ingredientKey: "milk",
        name: "Milk",
        quantity: 1,
      })
    ).toBe("/ingredients/milk_base.png");
  });

  it("returns null for custom ingredient rows", () => {
    expect(
      resolveShopIngredientIconPath({
        name: "Black Tea",
        quantity: 1,
      })
    ).toBeNull();
  });
});

describe("resolveShopIngredientCost", () => {
  it("prefers the shared ingredient price override when present", () => {
    expect(
      resolveShopIngredientCost(
        {
          ingredientKey: "milk",
          name: "Milk",
          quantity: 1,
        },
        buildShopIngredientPriceMap([{ ingredientKey: "milk", costCoins: 9, updatedAt: 0 }])
      )
    ).toBe(9);
  });

  it("falls back to the catalog default cost", () => {
    expect(
      resolveShopIngredientCost({
        ingredientKey: "milk",
        name: "Milk",
        quantity: 1,
      })
    ).toBe(4);
  });

  it("still uses row cost for custom ingredients with no catalog entry", () => {
    expect(
      resolveShopIngredientCost({
        name: "Custom Sauce",
        quantity: 1,
        costCoins: 7,
      })
    ).toBe(7);
  });
});

describe("normalizeShopIngredientList", () => {
  it("parses legacy string quantities and drops old unit fields", () => {
    expect(
      normalizeShopIngredientList(
        [{ ingredientKey: "milk", name: " Milk ", quantity: " 2 ", unit: "cup" }],
        []
      )
    ).toEqual([{ ingredientKey: "milk", name: "Milk", quantity: 2 }]);
  });

  it("falls back to the prior quantity when a new payload is invalid", () => {
    expect(
      normalizeShopIngredientList([{ name: "Milk", quantity: "0" }], [{ name: "Milk", quantity: 3 }])
    ).toEqual([{ name: "Milk", quantity: 3 }]);
  });
});

describe("normalizeShopSpecialIngredientList", () => {
  it("flattens legacy slot payloads into ingredient rows", () => {
    expect(
      normalizeShopSpecialIngredientList(
        [
          {
            slotKey: "specialty_ingredients",
            options: [
              { key: "brown_sugar", label: "Brown Sugar" },
              { key: "jasmine", label: "Jasmine" },
            ],
          },
        ],
        []
      )
    ).toEqual([
      { ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 },
      { ingredientKey: "jasmine", name: "Jasmine", quantity: 1 },
    ]);
  });
});

describe("normalizeShopLocalizedSpecialIngredients", () => {
  it("flattens localized legacy slot payloads while preserving translated labels", () => {
    expect(
      normalizeShopLocalizedSpecialIngredients(
        {
          en: [
            {
              slotKey: "specialty_ingredients",
              options: [{ key: "brown_sugar", label: "Brown Sugar" }],
            },
          ],
          zh: [
            {
              slotKey: "specialty_ingredients",
              options: [{ key: "brown_sugar", label: "\u9ed1\u7cd6" }],
            },
          ],
        },
        []
      )
    ).toEqual({
      en: [{ ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 }],
      zh: [{ ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 1 }],
    });
  });

  it("realigns stale localized rows to preserve keyed ingredients from the canonical payload", () => {
    expect(
      normalizeShopLocalizedSpecialIngredients(
        {
          en: [{ ingredientKey: "shrimp", name: "Shrimp", quantity: 2 }],
          zh: [{ ingredientKey: "shrimp", name: "\u867e\u4ec1", quantity: 2 }],
        },
        [
          { ingredientKey: "shrimp", name: "Shrimp", quantity: 2 },
          { ingredientKey: "pork-filling", name: "Pork Filling", quantity: 1 },
        ]
      )
    ).toEqual({
      en: [
        { ingredientKey: "shrimp", name: "Shrimp", quantity: 2 },
        { ingredientKey: "pork-filling", name: "Pork Filling", quantity: 1 },
      ],
      zh: [
        { ingredientKey: "shrimp", name: "\u867e\u4ec1", quantity: 2 },
        { ingredientKey: "pork-filling", name: "Pork Filling", quantity: 1 },
      ],
    });
  });
});

describe("normalizeShopLocalizedIngredients", () => {
  it("realigns stale localized base rows to preserve keyed ingredients from the canonical payload", () => {
    expect(
      normalizeShopLocalizedIngredients(
        {
          en: [{ ingredientKey: "flour", name: "Flour", quantity: 2 }],
          zh: [{ ingredientKey: "flour", name: "\u9762\u7c89", quantity: 2 }],
        },
        [
          { ingredientKey: "flour", name: "Flour", quantity: 2 },
          { ingredientKey: "water", name: "Water", quantity: 1 },
        ]
      )
    ).toEqual({
      en: [
        { ingredientKey: "flour", name: "Flour", quantity: 2 },
        { ingredientKey: "water", name: "Water", quantity: 1 },
      ],
      zh: [
        { ingredientKey: "flour", name: "\u9762\u7c89", quantity: 2 },
        { ingredientKey: "water", name: "Water", quantity: 1 },
      ],
    });
  });
});

describe("normalizeUnlockShopRecipeResult", () => {
  it("normalizes a successful rpc payload", () => {
    expect(
      normalizeUnlockShopRecipeResult({
        success: true,
        code: "unlocked",
        recipeId: "recipe-1",
        remainingCoins: 75,
        coinsSpent: 25,
      })
    ).toEqual({
      success: true,
      code: "unlocked",
      recipeId: "recipe-1",
      remainingCoins: 75,
      coinsSpent: 25,
    });
  });

  it("falls back to unknown for unexpected failure codes", () => {
    expect(
      normalizeUnlockShopRecipeResult({
        success: false,
        code: "mystery_failure",
      })
    ).toEqual({
      success: false,
      code: "unknown",
      recipeId: null,
      remainingCoins: null,
      coinsSpent: 0,
    });
  });

  it("normalizes plain-icon failures", () => {
    expect(
      normalizeUnlockShopRecipeResult({
        success: false,
        code: "plain_icon_missing",
        recipeId: "recipe-1",
      })
    ).toEqual({
      success: false,
      code: "plain_icon_missing",
      recipeId: "recipe-1",
      remainingCoins: null,
      coinsSpent: 0,
    });
  });
});

describe("getShopRecipeContentForLocale", () => {
  it("uses the requested locale when bilingual content exists", () => {
    expect(
      getShopRecipeContentForLocale(
        {
          id: "recipe-1",
          slug: "bubble_tea",
          title: "Bubble Tea",
          titleI18n: { en: "Bubble Tea", zh: "\u73cd\u73e0\u5976\u8336" },
          displayOrder: 1,
          isActive: true,
          intro: "Milk tea",
          introI18n: { en: "Milk tea", zh: "\u5976\u8336" },
          unlockCostCoins: 25,
          baseIngredients: [{ name: "Milk", quantity: 1 }],
          baseIngredientsI18n: {
            en: [{ name: "Milk", quantity: 1 }],
            zh: [{ name: "\u725b\u5976", quantity: 1 }],
          },
          specialIngredients: [
            { ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 },
          ],
          specialIngredientsI18n: {
            en: [{ ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 }],
            zh: [{ ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 1 }],
          },
          variantIconRules: [{ match: [], iconPath: "/rewards/bubble-tea_plain.png" }],
        },
        "zh"
      )
    ).toEqual({
      title: "\u73cd\u73e0\u5976\u8336",
      intro: "\u5976\u8336",
      baseIngredients: [{ name: "\u725b\u5976", quantity: 1 }],
      specialIngredients: [{ ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 1 }],
    });
  });

  it("falls back to english content when the current locale is blank", () => {
    expect(
      getShopRecipeContentForLocale(
        {
          id: "recipe-1",
          slug: "cake",
          title: "Cake",
          titleI18n: { en: "Cake", zh: "" },
          displayOrder: 1,
          isActive: true,
          intro: "Soft cake",
          introI18n: { en: "Soft cake", zh: "" },
          unlockCostCoins: 25,
          baseIngredients: [{ name: "Flour", quantity: 1 }],
          baseIngredientsI18n: {
            en: [{ name: "Flour", quantity: 1 }],
            zh: [],
          },
          specialIngredients: [],
          specialIngredientsI18n: { en: [], zh: [] },
          variantIconRules: [{ match: [], iconPath: "/rewards/cake_plain.png" }],
        },
        "zh"
      )
    ).toEqual({
      title: "Cake",
      intro: "Soft cake",
      baseIngredients: [{ name: "Flour", quantity: 1 }],
      specialIngredients: [],
    });
  });
});
