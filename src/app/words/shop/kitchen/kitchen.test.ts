import { describe, expect, it } from "vitest";
import type { ShopCookedDish } from "@/lib/shop.types";
import { buildKitchenShelvesByCategory, countTotalCookedDishes, SHOP_SHELF_CATEGORIES } from "./kitchen.types";
import { kitchenStrings } from "./kitchen.strings";

function dish(overrides: Partial<ShopCookedDish>): ShopCookedDish {
  return {
    id: "dish-1",
    userId: "user-1",
    recipeId: "recipe-1",
    shelfCategory: "default",
    cookedAt: 0,
    ...overrides,
  };
}

describe("buildKitchenShelvesByCategory", () => {
  it("groups dishes onto their own shelf, empty otherwise", () => {
    const shelves = buildKitchenShelvesByCategory([
      dish({ id: "d1", recipeId: "bubble-tea", shelfCategory: "drinks" }),
    ]);
    expect(shelves.drinks).toEqual([{ recipeId: "bubble-tea", count: 1 }]);
    expect(shelves.default).toEqual([]);
    expect(shelves.desserts).toEqual([]);
    expect(shelves.hotmeal).toEqual([]);
  });

  it("stacks repeated cooks of the same recipe on the same shelf into one tile with a count", () => {
    const shelves = buildKitchenShelvesByCategory([
      dish({ id: "d1", recipeId: "bubble-tea", shelfCategory: "drinks" }),
      dish({ id: "d2", recipeId: "bubble-tea", shelfCategory: "drinks" }),
      dish({ id: "d3", recipeId: "bubble-tea", shelfCategory: "drinks" }),
    ]);
    expect(shelves.drinks).toEqual([{ recipeId: "bubble-tea", count: 3 }]);
  });

  it("keeps the same recipe as separate tiles when it's split across different shelves", () => {
    const shelves = buildKitchenShelvesByCategory([
      dish({ id: "d1", recipeId: "bubble-tea", shelfCategory: "drinks" }),
      dish({ id: "d2", recipeId: "bubble-tea", shelfCategory: "default" }),
    ]);
    expect(shelves.drinks).toEqual([{ recipeId: "bubble-tea", count: 1 }]);
    expect(shelves.default).toEqual([{ recipeId: "bubble-tea", count: 1 }]);
  });

  it("preserves first-cooked-to-shelf order rather than reordering on repeat cooks", () => {
    const shelves = buildKitchenShelvesByCategory([
      dish({ id: "d1", recipeId: "onigiri", shelfCategory: "default" }),
      dish({ id: "d2", recipeId: "bubble-tea", shelfCategory: "default" }),
      dish({ id: "d3", recipeId: "onigiri", shelfCategory: "default" }),
    ]);
    expect(shelves.default.map((tile) => tile.recipeId)).toEqual(["onigiri", "bubble-tea"]);
    expect(shelves.default.find((tile) => tile.recipeId === "onigiri")?.count).toBe(2);
  });

  it("returns all four empty shelves for no dishes", () => {
    const shelves = buildKitchenShelvesByCategory([]);
    for (const category of SHOP_SHELF_CATEGORIES) {
      expect(shelves[category]).toEqual([]);
    }
  });
});

describe("countTotalCookedDishes", () => {
  it("counts every cook event, not distinct recipes", () => {
    expect(
      countTotalCookedDishes([
        dish({ id: "d1", recipeId: "bubble-tea" }),
        dish({ id: "d2", recipeId: "bubble-tea" }),
        dish({ id: "d3", recipeId: "onigiri" }),
      ])
    ).toBe(3);
  });

  it("is zero for no dishes", () => {
    expect(countTotalCookedDishes([])).toBe(0);
  });
});

describe("kitchen.strings parity", () => {
  it("EN and ZH top-level keys match", () => {
    const enKeys = Object.keys(kitchenStrings.en).sort();
    const zhKeys = Object.keys(kitchenStrings.zh).sort();
    expect(enKeys).toEqual(zhKeys);
  });
});
