import { describe, expect, it } from "vitest";
import {
  buildDebugIngredientQuantityItems,
  findMysteryRecipesUsingIngredient,
  findRecipeIdUsingIngredient,
  normalizeDebugIngredientLabel,
  normalizeDebugBulkAddAmount,
  normalizeDebugIngredientTargetQuantity,
  planDebugBulkIngredientAdd,
  planDebugIngredientQuantityChange,
  type DebugQuantityRecipe,
} from "./debugIngredientQuantities";
import { SHOP_INGREDIENT_QUANTITY_MAX } from "./shop";

describe("normalizeDebugIngredientTargetQuantity", () => {
  it("accepts whole numbers from 0 to the max, as numbers or strings", () => {
    expect(normalizeDebugIngredientTargetQuantity(0)).toBe(0);
    expect(normalizeDebugIngredientTargetQuantity("7")).toBe(7);
    expect(normalizeDebugIngredientTargetQuantity(SHOP_INGREDIENT_QUANTITY_MAX)).toBe(SHOP_INGREDIENT_QUANTITY_MAX);
  });

  it("rejects negatives, fractions, blanks, out-of-range and non-numbers", () => {
    for (const raw of [-1, 1.5, "", " ", "abc", SHOP_INGREDIENT_QUANTITY_MAX + 1, null, undefined]) {
      expect(normalizeDebugIngredientTargetQuantity(raw)).toBeNull();
    }
  });
});

describe("planDebugIngredientQuantityChange", () => {
  it("adds rows to raise, removes to lower, and does nothing when equal", () => {
    expect(planDebugIngredientQuantityChange(1, 4)).toEqual({ add: 3, remove: 0 });
    expect(planDebugIngredientQuantityChange(5, 2)).toEqual({ add: 0, remove: 3 });
    expect(planDebugIngredientQuantityChange(3, 3)).toEqual({ add: 0, remove: 0 });
  });
});

describe("bulk add to every shown ingredient", () => {
  const items = [
    { key: "egg", quantity: 0 },
    { key: "milk", quantity: 95 },
    { key: "sugar", quantity: SHOP_INGREDIENT_QUANTITY_MAX },
    { key: "flour", quantity: 2 },
  ];

  it("accepts 1 to the max, never 0 or junk", () => {
    expect(normalizeDebugBulkAddAmount("10")).toBe(10);
    expect(normalizeDebugBulkAddAmount(SHOP_INGREDIENT_QUANTITY_MAX)).toBe(SHOP_INGREDIENT_QUANTITY_MAX);
    expect(normalizeDebugBulkAddAmount(0)).toBeNull();
    expect(normalizeDebugBulkAddAmount("-3")).toBeNull();
    expect(normalizeDebugBulkAddAmount("2.5")).toBeNull();
    expect(normalizeDebugBulkAddAmount(SHOP_INGREDIENT_QUANTITY_MAX + 1)).toBeNull();
  });

  it("adds the amount to each requested ingredient, capped at the max, skipping full ones", () => {
    expect(planDebugBulkIngredientAdd(items, ["egg", "milk", "sugar"], 10)).toEqual([
      { key: "egg", add: 10 },
      { key: "milk", add: SHOP_INGREDIENT_QUANTITY_MAX - 95 },
    ]);
  });

  it("only touches the requested keys and ignores unknown ones", () => {
    expect(planDebugBulkIngredientAdd(items, ["flour", "no-such-thing"], 3)).toEqual([{ key: "flour", add: 3 }]);
  });
});

const recipe = (overrides: Partial<DebugQuantityRecipe>): DebugQuantityRecipe => ({
  id: "r",
  slug: "r",
  isActive: true,
  isMystery: false,
  baseIngredients: [],
  specialIngredients: [],
  ...overrides,
});

describe("recipe lookups by ingredient", () => {
  const recipes = [
    recipe({ id: "old", isActive: false, baseIngredients: [{ ingredientKey: "pear", name: "Pear", quantity: 1 }] }),
    recipe({ id: "tea", baseIngredients: [{ ingredientKey: "pear", name: "Pear", quantity: 2 }] }),
    recipe({ id: "cake", specialIngredients: [{ ingredientKey: "berry", name: "Berry", quantity: 1 }] }),
    recipe({
      id: "dew",
      slug: "dew",
      isMystery: true,
      baseIngredients: [{ ingredientKey: "pear", name: "Pear", quantity: 2 }],
    }),
  ];

  it("prefers an active recipe, and also finds special-ingredient use", () => {
    expect(findRecipeIdUsingIngredient(recipes, "pear")).toBe("tea");
    expect(findRecipeIdUsingIngredient(recipes, "berry")).toBe("cake");
    expect(findRecipeIdUsingIngredient(recipes, "nothing")).toBeNull();
  });

  it("finds only active mystery foods using the ingredient", () => {
    expect(findMysteryRecipesUsingIngredient(recipes, "pear").map((r) => r.id)).toEqual(["dew"]);
    expect(findMysteryRecipesUsingIngredient(recipes, "berry")).toEqual([]);
  });
});

describe("buildDebugIngredientQuantityItems", () => {
  it("counts rewards + purchases - consumptions, mystery first then by key", () => {
    const items = buildDebugIngredientQuantityItems(
      [
        { ingredientKey: "milk", label: { en: "Milk", zh: "牛奶" }, iconPath: null, isMystery: false },
        { ingredientKey: "pear", label: { en: "Pear", zh: "梨" }, iconPath: "/p.png", isMystery: true },
        { ingredientKey: "egg", label: { en: "Egg", zh: "蛋" }, iconPath: null, isMystery: false },
      ],
      { rewardKeys: ["pear", "milk"], purchaseKeys: ["pear", "pear"], consumptionKeys: ["pear"] }
    );
    expect(items.map((item) => [item.key, item.quantity])).toEqual([
      ["pear", 2],
      ["egg", 0],
      ["milk", 1],
    ]);
  });
});

describe("normalizeDebugIngredientLabel", () => {
  it("falls back to the key for a missing or blank locale", () => {
    expect(normalizeDebugIngredientLabel({ en: "Pear", zh: " " }, "pear")).toEqual({ en: "Pear", zh: "pear" });
    expect(normalizeDebugIngredientLabel(null, "pear")).toEqual({ en: "pear", zh: "pear" });
  });
});
