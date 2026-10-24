import { describe, expect, it } from "vitest";
import {
  buildUnlockedRecipeTitles,
  isMysteryReward,
  requirementsFromShopIngredients,
} from "./mysteryFoodUi";
import type { ShopRecipe } from "./shop.types";

function recipe(id: string, en: string, zh: string): ShopRecipe {
  return {
    id,
    slug: id,
    title: en,
    titleI18n: { en, zh },
    displayOrder: 1,
    isActive: true,
    intro: "",
    introI18n: { en: "", zh: "" },
    unlockCostCoins: 0,
    baseIngredients: [],
    baseIngredientsI18n: { en: [], zh: [] },
    specialIngredients: [],
    specialIngredientsI18n: { en: [], zh: [] },
    variantIconRules: [],
    cookMethod: "stove",
    foodType: "hotmeal",
    isMystery: true,
    teaserI18n: null,
  };
}

describe("requirementsFromShopIngredients", () => {
  it("keeps keyed rows with canonical keys and drops unkeyed ones", () => {
    expect(
      requirementsFromShopIngredients([
        { ingredientKey: "Wild Tiger Prawn", name: "Prawn", quantity: 2 },
        { name: "No key", quantity: 1 },
        { ingredientKey: "  ", name: "Blank key", quantity: 1 },
        { ingredientKey: "gilded-sesame-oil", name: "Oil", quantity: 1 },
      ])
    ).toEqual([
      { ingredientKey: "wild-tiger-prawn", quantity: 2 },
      { ingredientKey: "gilded-sesame-oil", quantity: 1 },
    ]);
  });

  it("returns an empty list for no ingredients", () => {
    expect(requirementsFromShopIngredients([])).toEqual([]);
  });
});

describe("isMysteryReward", () => {
  it("is true when any rewarded ingredient is mystery", () => {
    expect(isMysteryReward([{ isMystery: false }, { isMystery: true }])).toBe(true);
  });

  it("is false for the regular random reward (flag false or absent) and for an empty reward", () => {
    expect(isMysteryReward([{ isMystery: false }, {}])).toBe(false);
    expect(isMysteryReward([])).toBe(false);
  });
});

describe("buildUnlockedRecipeTitles", () => {
  const recipes = [recipe("a", "Crystal Dumplings", "水晶虾饺"), recipe("b", "Other", "其他")];

  it("resolves titles in the order the server reported them, per locale", () => {
    expect(buildUnlockedRecipeTitles(recipes, ["b", "a"], "en")).toEqual(["Other", "Crystal Dumplings"]);
    expect(buildUnlockedRecipeTitles(recipes, ["a"], "zh")).toEqual(["水晶虾饺"]);
  });

  it("skips ids that no longer resolve and handles none", () => {
    expect(buildUnlockedRecipeTitles(recipes, ["missing", "a"], "en")).toEqual(["Crystal Dumplings"]);
    expect(buildUnlockedRecipeTitles(recipes, [], "en")).toEqual([]);
  });
});
