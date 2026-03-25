import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  auditShopIngredientIcons,
  resolveShopIngredientIconFilePath,
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
