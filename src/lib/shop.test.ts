import { describe, expect, it } from "vitest";
import {
  canAffordRecipeUnlock,
  getShopRecipeContentForLocale,
  normalizeUnlockShopRecipeResult,
  resolvePlainShopRecipeIconPath,
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

  it("keeps the plain icon missing failure code", () => {
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
          titleI18n: { en: "Bubble Tea", zh: "珍珠奶茶" },
          displayOrder: 1,
          isActive: true,
          intro: "Milk tea",
          introI18n: { en: "Milk tea", zh: "奶茶" },
          unlockCostCoins: 25,
          baseIngredients: [{ name: "Milk", quantity: "1", unit: "cup" }],
          baseIngredientsI18n: {
            en: [{ name: "Milk", quantity: "1", unit: "cup" }],
            zh: [{ name: "牛奶", quantity: "1", unit: "杯" }],
          },
          specialIngredientSlots: [
            {
              slotKey: "specialty",
              label: "Special Ingredient",
              maxSelections: 1,
              options: [{ key: "brown-sugar", label: "Brown Sugar", effect: "Wink" }],
            },
          ],
          specialIngredientSlotsI18n: {
            en: [
              {
                slotKey: "specialty",
                label: "Special Ingredient",
                maxSelections: 1,
                options: [{ key: "brown-sugar", label: "Brown Sugar", effect: "Wink" }],
              },
            ],
            zh: [
              {
                slotKey: "specialty",
                label: "特殊材料",
                maxSelections: 1,
                options: [{ key: "brown-sugar", label: "黑糖", effect: "眨眼" }],
              },
            ],
          },
          variantIconRules: [{ match: [], iconPath: "/rewards/bubble-tea_plain.png" }],
        },
        "zh"
      )
    ).toEqual({
      title: "珍珠奶茶",
      intro: "奶茶",
      baseIngredients: [{ name: "牛奶", quantity: "1", unit: "杯" }],
      specialIngredientSlots: [
        {
          slotKey: "specialty",
          label: "特殊材料",
          maxSelections: 1,
          options: [{ key: "brown-sugar", label: "黑糖", effect: "眨眼" }],
        },
      ],
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
          baseIngredients: [{ name: "Flour", quantity: "1", unit: "cup" }],
          baseIngredientsI18n: {
            en: [{ name: "Flour", quantity: "1", unit: "cup" }],
            zh: [],
          },
          specialIngredientSlots: [],
          specialIngredientSlotsI18n: { en: [], zh: [] },
          variantIconRules: [{ match: [], iconPath: "/rewards/cake_plain.png" }],
        },
        "zh"
      )
    ).toEqual({
      title: "Cake",
      intro: "Soft cake",
      baseIngredients: [{ name: "Flour", quantity: "1", unit: "cup" }],
      specialIngredientSlots: [],
    });
  });
});
