import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "./shop.types";
import { buildShopAdminIngredientCatalogItems } from "./shopIngredients";

describe("buildShopAdminIngredientCatalogItems", () => {
  it("merges shared, seeded, and recipe-linked ingredients into one catalog", () => {
    const recipes: Pick<ShopRecipe, "baseIngredientsI18n" | "specialIngredientsI18n">[] = [
      {
        baseIngredientsI18n: {
          en: [{ ingredientKey: "milk", name: "Milk", quantity: 1 }],
          zh: [{ ingredientKey: "milk", name: "\u725b\u5976", quantity: 1 }],
        },
        specialIngredientsI18n: {
          en: [
            { ingredientKey: "brown-sugar", name: "Brown Sugar", quantity: 1 },
            { ingredientKey: "jasmine", name: "Jasmine", quantity: 1 },
          ],
          zh: [
            { ingredientKey: "brown-sugar", name: "\u9ed1\u7cd6", quantity: 1 },
            { ingredientKey: "jasmine", name: "\u8336\u8309\u8389", quantity: 1 },
          ],
        },
      },
    ];

    const items = buildShopAdminIngredientCatalogItems(
      [
        {
          ingredientKey: "milk",
          costCoins: 9,
          updatedAt: 0,
          labelI18n: { en: "Fresh Milk", zh: "\u9c9c\u5976" },
          iconPath: "/ingredients/fresh-milk.png",
        },
        { ingredientKey: "brown-sugar", costCoins: 5, updatedAt: 0 },
      ],
      recipes
    );

    expect(items.find((item) => item.key === "milk")).toMatchObject({
      key: "milk",
      costCoins: 9,
      iconPath: "/ingredients/fresh-milk.png",
      label: { en: "Fresh Milk", zh: "\u9c9c\u5976" },
      usage: { usedInBase: true, usedInSpecial: false },
    });
    expect(items.find((item) => item.key === "brown-sugar")).toMatchObject({
      key: "brown-sugar",
      costCoins: 5,
      iconPath: null,
      label: { en: "Brown Sugar", zh: "\u9ed1\u7cd6" },
      usage: { usedInBase: false, usedInSpecial: true },
    });
  });

  it("does not surface seeded-only ingredients that are unused and not persisted", () => {
    const items = buildShopAdminIngredientCatalogItems([], []);

    expect(items).toEqual([]);
  });
});
