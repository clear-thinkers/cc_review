import { describe, expect, it } from "vitest";
import { wordsStrings } from "../words.strings";
import type {
  DebugShopIngredientIconAuditItem,
  DebugShopIngredientIconAuditResponse,
} from "./debug.types";

describe("debug ingredient icon strings parity", () => {
  it("keeps ingredient icon table keys in sync across locales", () => {
    expect(Object.keys(wordsStrings.en.debug.ingredientIconsTable).sort()).toEqual(
      Object.keys(wordsStrings.zh.debug.ingredientIconsTable).sort()
    );
  });

  it("keeps ingredient icon action labels in sync across locales", () => {
    expect(Object.keys(wordsStrings.en.debug.ingredientIconsActions).sort()).toEqual(
      Object.keys(wordsStrings.zh.debug.ingredientIconsActions).sort()
    );
    expect(Object.keys(wordsStrings.en.debug.ingredientIconsTooltips).sort()).toEqual(
      Object.keys(wordsStrings.zh.debug.ingredientIconsTooltips).sort()
    );
  });
});

describe("debug ingredient icon audit types", () => {
  it("supports ingredient key and persisted-row flags", () => {
    const item: DebugShopIngredientIconAuditItem = {
      key: "bamboo-leaves",
      label: { en: "Bamboo Leaves", zh: "粽叶" },
      iconPath: "/ingredients/bamboo-leaves_base.png",
      exists: true,
      hasPriceRow: true,
    };

    expect(item.key).toBe("bamboo-leaves");
    expect(item.hasPriceRow).toBe(true);
  });

  it("supports available ingredient icon path suggestions", () => {
    const response: DebugShopIngredientIconAuditResponse = {
      checkedAt: Date.now(),
      availableIconPaths: ["/ingredients/bamboo-leaves_base.png"],
      items: [],
      missingItems: [],
    };

    expect(response.availableIconPaths).toContain("/ingredients/bamboo-leaves_base.png");
  });
});
