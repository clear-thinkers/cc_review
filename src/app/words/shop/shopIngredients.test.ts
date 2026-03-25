import { describe, expect, it } from "vitest";
import type { ShopRecipe } from "./shop.types";
import { buildShopAdminIngredientCatalogItems } from "./shopIngredients";

describe("buildShopAdminIngredientCatalogItems", () => {
  it("includes keyed special ingredients alongside basic catalog ingredients", () => {
    const recipes: Pick<ShopRecipe, "specialIngredientsI18n">[] = [
      {
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
        },
        { ingredientKey: "brown-sugar", costCoins: 5, updatedAt: 0 },
      ],
      recipes
    );

    expect(items.find((item) => item.key === "milk")).toMatchObject({
      key: "milk",
      kind: "basic",
      costCoins: 9,
      label: { en: "Fresh Milk", zh: "\u9c9c\u5976" },
    });
    expect(items.find((item) => item.key === "brown-sugar")).toMatchObject({
      key: "brown-sugar",
      kind: "special",
      costCoins: 5,
      iconPath: null,
      label: { en: "Brown Sugar", zh: "\u9ed1\u7cd6" },
    });
  });
});
