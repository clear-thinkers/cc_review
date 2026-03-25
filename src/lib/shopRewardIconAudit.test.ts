import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  auditShopRewardIcons,
  createShopRewardIconRule,
  deleteShopRewardIconRule,
  normalizeShopRewardMatchInput,
  updateShopRewardIconRule,
} from "./shopRewardIconAudit";

describe("auditShopRewardIcons", () => {
  it("reports missing reward icon files from variant rules", async () => {
    const iconExists = vi.fn(async (filePath: string) => {
      return !filePath.endsWith(path.join("rewards", "donut_plain.png"));
    });

    const result = await auditShopRewardIcons(
      [
        {
          id: "recipe-1",
          slug: "donut",
          title: { en: "Donut", zh: "甜甜圈" },
          variantIconRules: [
            { match: [], iconPath: "/rewards/donut_plain.png" },
            { match: ["strawberry"], iconPath: "/rewards/donut_strawberry_ambitious.png" },
          ],
        },
      ],
      iconExists,
      [
        "/rewards/donut_plain.png",
        "/rewards/donut_strawberry_ambitious.png",
        "/rewards/unused.png",
      ]
    );

    expect(result.items).toHaveLength(2);
    expect(result.missingItems).toHaveLength(1);
    expect(result.availableIconPaths).toEqual([
      "/rewards/donut_plain.png",
      "/rewards/donut_strawberry_ambitious.png",
      "/rewards/unused.png",
    ]);
    expect(result.unreferencedItems).toEqual([
      {
        iconPath: "/rewards/unused.png",
        filePath: path.join(process.cwd(), "public", "rewards", "unused.png"),
      },
    ]);
    expect(result.recipeOptions).toEqual([]);
    expect(result.missingItems[0]?.recipeSlug).toBe("donut");
    expect(result.missingItems[0]?.ruleIndex).toBe(0);
    expect(result.missingItems[0]?.iconPath).toBe("/rewards/donut_plain.png");
    expect(result.missingItems[0]?.match).toEqual([]);
    expect(iconExists).toHaveBeenCalled();
  });
});

describe("updateShopRewardIconRule", () => {
  it("updates the targeted reward icon rule path", () => {
    expect(
      updateShopRewardIconRule(
        [
          { match: [], iconPath: "/rewards/old.png" },
          { match: ["strawberry"], iconPath: "/rewards/keep.png" },
        ],
        0,
        " /rewards/new.png "
      )
    ).toEqual([
      { match: [], iconPath: "/rewards/new.png" },
      { match: ["strawberry"], iconPath: "/rewards/keep.png" },
    ]);
  });
});

describe("normalizeShopRewardMatchInput", () => {
  it("normalizes comma-separated match tokens", () => {
    expect(normalizeShopRewardMatchInput(" strawberry, sprinkles, strawberry ")).toEqual([
      "sprinkles",
      "strawberry",
    ]);
  });
});

describe("createShopRewardIconRule", () => {
  it("adds a normalized reward icon rule", () => {
    expect(
      createShopRewardIconRule(
        [{ match: [], iconPath: "/rewards/plain.png" }],
        "/rewards/new.png",
        "strawberry, sprinkles"
      )
    ).toEqual([
      { match: [], iconPath: "/rewards/plain.png" },
      { match: ["sprinkles", "strawberry"], iconPath: "/rewards/new.png" },
    ]);
  });
});

describe("deleteShopRewardIconRule", () => {
  it("removes the targeted reward icon rule", () => {
    expect(
      deleteShopRewardIconRule(
        [
          { match: [], iconPath: "/rewards/delete.png" },
          { match: ["strawberry"], iconPath: "/rewards/keep.png" },
        ],
        0
      )
    ).toEqual([{ match: ["strawberry"], iconPath: "/rewards/keep.png" }]);
  });
});
