import { describe, expect, it } from "vitest";
import {
  canAffordRecipeUnlock,
  normalizeUnlockShopRecipeResult,
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
});
