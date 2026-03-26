import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  auditShopIngredientCatalogItems,
  auditShopIngredientIcons,
  resolveShopIngredientIconFilePath,
  validateShopIngredientIconPath,
} from "./shopIngredientIconAudit";

describe("resolveShopIngredientIconFilePath", () => {
  it("maps a public icon path into the public directory", () => {
    expect(
      path.normalize(resolveShopIngredientIconFilePath("/ingredients/butter_base.png") ?? "")
    ).toBe(path.join(process.cwd(), "public", "ingredients", "butter_base.png"));
  });

  it("returns null for empty or non-public paths", () => {
    expect(resolveShopIngredientIconFilePath(null)).toBeNull();
    expect(resolveShopIngredientIconFilePath("ingredients/butter_base.png")).toBeNull();
  });
});

describe("validateShopIngredientIconPath", () => {
  it("accepts public ingredient png paths", () => {
    expect(validateShopIngredientIconPath(" /ingredients/bamboo-leaves_base.png ")).toBe(
      "/ingredients/bamboo-leaves_base.png"
    );
  });

  it("rejects invalid ingredient icon paths", () => {
    expect(() => validateShopIngredientIconPath("/rewards/bamboo-leaves_base.png")).toThrow(
      'Ingredient icon path must start with "/ingredients/" and end with ".png".'
    );
  });
});

describe("auditShopIngredientIcons", () => {
  it("reports missing icon-backed files", async () => {
    const iconExists = vi.fn(async (filePath: string) => {
      return !filePath.endsWith(path.join("ingredients", "butter_base.png"));
    });

    const result = await auditShopIngredientIcons(iconExists);
    const butter = result.items.find((item) => item.key === "butter");
    const blackTea = result.items.find((item) => item.key === "black-tea");

    expect(butter?.iconPath).toBe("/ingredients/butter_base.png");
    expect(butter?.exists).toBe(false);
    expect(result.missingItems.map((item) => item.key)).toContain("butter");
    expect(blackTea?.exists).toBeNull();
    expect(iconExists).toHaveBeenCalled();
  });
});

describe("auditShopIngredientCatalogItems", () => {
  it("audits db-backed icon overrides that are not in the seeded catalog", async () => {
    const result = await auditShopIngredientCatalogItems(
      [
        {
          key: "bamboo-leaves",
          label: { en: "Bamboo Leaves", zh: "粽叶" },
          iconPath: "/ingredients/bamboo-leaves_base.png",
        },
      ],
      vi.fn(async (filePath: string) =>
        filePath.endsWith(path.join("ingredients", "bamboo-leaves_base.png"))
      )
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        key: "bamboo-leaves",
        iconPath: "/ingredients/bamboo-leaves_base.png",
        exists: true,
        hasPriceRow: true,
      }),
    ]);
    expect(result.availableIconPaths).toEqual([]);
    expect(result.missingItems).toEqual([]);
  });
});
