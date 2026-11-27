import { describe, expect, it } from "vitest";
import {
  buildCharacterTokenStamps,
  buildVisitorBoard,
  computeCharacterTokenBalance,
  dishMatchesOrderItem,
  filterWishlistForChild,
  findMissingTokens,
  groupShelfDishes,
  listOrderVariantChoices,
  normalizeCafeOrderItems,
  normalizeGetCafeVisitResult,
  normalizePriceSnapshot,
  normalizeRedeemWishlistRewardResult,
  normalizeSaveCharacterOrderResult,
  normalizeSaveWishlistRewardResult,
  normalizeServeCafeVisitResult,
  pickCharacterLine,
  scaleToFit,
  validateCafeVisitFrequency,
  splitPoemLines,
  resolveOrderReadiness,
  resolveWishlistCardState,
  validateCharacterOrderDraft,
  validateWishlistDraft,
} from "./characterTokens";
import type {
  CharacterTokenAward,
  ShopCharacter,
  ShopCharacterOrder,
  WishlistRedemption,
  WishlistReward,
} from "./characterTokens.types";

function award(id: string, giver: string, earnedAt: number): CharacterTokenAward {
  return { id, userId: "u1", giver, source: "cafe_sale", recipeId: null, cafeItems: [], contentId: null, earnedAt };
}

function redemption(rewardId: string, priceSnapshot: Record<string, number>): WishlistRedemption {
  return {
    id: `r-${rewardId}`,
    userId: "u1",
    rewardId,
    title: "Backpack",
    priceSnapshot,
    childSignature: "Kid",
    parentSignature: "Parent",
    redeemedAt: 1,
  };
}

const reward: WishlistReward = {
  id: "w1",
  childUserId: null,
  title: "Backpack",
  isRepeatable: false,
  isActive: true,
  imagePath: null,
  prices: [
    { characterKey: "li-bai", tokenCount: 2 },
    { characterKey: "shrewy", tokenCount: 1 },
  ],
};

describe("character token balances", () => {
  const awards = [award("a", "li-bai", 1), award("b", "li-bai", 2), award("c", "li-bai", 3), award("d", "shrewy", 4)];

  it("subtracts catalog and wishlist spends for that character only", () => {
    const balance = computeCharacterTokenBalance(awards, [{ giver: "shrewy", cost: 1 }], [redemption("w1", { "li-bai": 2 })], "li-bai");
    expect(balance).toEqual({ collected: 3, available: 1 });
    expect(computeCharacterTokenBalance(awards, [{ giver: "shrewy", cost: 1 }], [], "shrewy")).toEqual({ collected: 1, available: 0 });
  });

  it("never goes below zero", () => {
    expect(computeCharacterTokenBalance([], [{ giver: "li-bai", cost: 3 }], [], "li-bai").available).toBe(0);
  });

  it("marks the oldest tokens as used and keeps every token", () => {
    const stamps = buildCharacterTokenStamps(awards, [], [redemption("w1", { "li-bai": 2 })], "li-bai");
    expect(stamps.map((stamp) => [stamp.award.id, stamp.isUsed])).toEqual([
      ["a", true],
      ["b", true],
      ["c", false],
    ]);
  });
});

describe("wishlist", () => {
  it("reports what is missing per character", () => {
    expect(findMissingTokens(reward.prices, new Map([["li-bai", 1]]))).toEqual([
      { characterKey: "li-bai", missing: 1 },
      { characterKey: "shrewy", missing: 1 },
    ]);
  });

  it("resolves card states", () => {
    const enough = new Map([["li-bai", 2], ["shrewy", 1]]);
    expect(resolveWishlistCardState(reward, [], enough)).toBe("redeemable");
    expect(resolveWishlistCardState(reward, [], new Map())).toBe("needMore");
    expect(resolveWishlistCardState(reward, [redemption("w1", {})], enough)).toBe("redeemed");
    expect(resolveWishlistCardState({ ...reward, isRepeatable: true }, [redemption("w1", {})], enough)).toBe("redeemable");
  });

  it("shows a child only active rewards meant for them", () => {
    const rewards = [
      reward,
      { ...reward, id: "mine", childUserId: "u1" },
      { ...reward, id: "sibling", childUserId: "u2" },
      { ...reward, id: "hidden", isActive: false },
    ];
    expect(filterWishlistForChild(rewards, "u1").map((entry) => entry.id)).toEqual(["w1", "mine"]);
  });

  it("validates a parent's draft", () => {
    const draft = { title: "Backpack", childUserId: null, isRepeatable: false, prices: reward.prices };
    expect(validateWishlistDraft(draft)).toBeNull();
    expect(validateWishlistDraft({ ...draft, title: "  " })).toBe("missing_title");
    expect(validateWishlistDraft({ ...draft, title: "x".repeat(61) })).toBe("title_too_long");
    expect(validateWishlistDraft({ ...draft, prices: [] })).toBe("missing_price");
    expect(validateWishlistDraft({ ...draft, prices: [{ characterKey: "a", tokenCount: 1.5 }] })).toBe("invalid_price");
    expect(validateWishlistDraft({ ...draft, prices: [{ characterKey: "a", tokenCount: 1 }, { characterKey: "a", tokenCount: 2 }] })).toBe("duplicate_price");
  });
});

function dish(recipeId: string, location: string, specialIngredientKeys: string[] = []) {
  return { recipeId, location, specialIngredientKeys };
}

describe("visitor board", () => {
  const character = (key: string, displayOrder: number, extra: Partial<ShopCharacter> = {}): ShopCharacter => ({
    key,
    name: { en: key, zh: key },
    intro: { en: "", zh: "" },
    tokenName: { en: "t", zh: "t" },
    tokenIconPath: null,
    spritePaths: {},
    lines: {},
    visitsCafe: true,
    visitFrequency: "unlimited",
    visitLimit: null,
    isActive: true,
    displayOrder,
    ...extra,
  });
  const order = (id: string, characterKey: string, extra: Partial<ShopCharacterOrder> = {}): ShopCharacterOrder => ({
    id,
    characterKey,
    tokenPrice: 1,
    isActive: true,
    items: [{ recipeId: "r1", quantity: 1 }],
    ...extra,
  });

  it("lists only characters who can visit, in display order, with their active orders", () => {
    const board = buildVisitorBoard(
      [
        character("mama", 3),
        character("shrewy", 0, { visitsCafe: false }),
        character("li-bai", 1),
        character("hidden", 2, { isActive: false }),
        character("no-orders", 4),
        character("tang-seng", 2),
      ],
      [
        order("o1", "mama"),
        order("o2", "li-bai"),
        order("o3", "li-bai", { isActive: false }),
        order("o4", "shrewy"),
        order("o5", "hidden"),
        order("o6", "tang-seng", { items: [] }),
        order("o7", "tang-seng"),
      ]
    );
    expect(board.map((entry) => [entry.character.key, entry.orders.map((o) => o.id)])).toEqual([
      ["li-bai", ["o2"]],
      ["tang-seng", ["o7"]],
      ["mama", ["o1"]],
    ]);
  });
});

describe("café orders", () => {
  it("groups only shelf dishes, never countertop or sold, by recipe and exact special ingredients", () => {
    const groups = groupShelfDishes([
      dish("r1", "shelf"),
      dish("r1", "sold"),
      dish("r1", "countertop"),
      dish("bun", "shelf", ["red-bean"]),
      dish("bun", "shelf", ["pork-filling"]),
      dish("bun", "shelf", ["red-bean"]),
      dish("noodle", "shelf", ["tomato", "egg"]),
      dish("noodle", "shelf", ["egg", "tomato"]),
    ]);
    expect(groups).toEqual([
      { recipeId: "r1", specialIngredientKeys: [], count: 1 },
      { recipeId: "bun", specialIngredientKeys: ["red-bean"], count: 2 },
      { recipeId: "bun", specialIngredientKeys: ["pork-filling"], count: 1 },
      { recipeId: "noodle", specialIngredientKeys: ["egg", "tomato"], count: 2 },
    ]);
  });

  it("is ready only when every item is fully on the shelf", () => {
    const items = [{ recipeId: "r1", quantity: 2 }, { recipeId: "r2", quantity: 1 }];
    expect(resolveOrderReadiness(items, [dish("r1", "shelf"), dish("r1", "shelf"), dish("r2", "shelf")]).isReady).toBe(true);
    const partial = resolveOrderReadiness(items, [dish("r1", "shelf"), dish("r1", "countertop"), dish("r2", "shelf")]);
    expect(partial.isReady).toBe(false);
    expect(partial.items[0]).toMatchObject({ onShelf: 1, isReady: false });
    expect(resolveOrderReadiness([], []).isReady).toBe(false);
  });

  it("lets any variant fill an item that pins none", () => {
    const item = { recipeId: "bun", quantity: 1 };
    expect(dishMatchesOrderItem(dish("bun", "shelf", ["pork-filling"]), item)).toBe(true);
    expect(dishMatchesOrderItem(dish("bun", "shelf"), item)).toBe(true);
    expect(dishMatchesOrderItem(dish("noodle", "shelf"), item)).toBe(false);
  });

  it("fills a pinned item only with exactly that variant (a vegetarian 红豆包 is never a 小笼包)", () => {
    const redBean = { recipeId: "bun", quantity: 1, specialIngredientKeys: ["red-bean"] };
    expect(dishMatchesOrderItem(dish("bun", "shelf", ["red-bean"]), redBean)).toBe(true);
    expect(dishMatchesOrderItem(dish("bun", "shelf", ["pork-filling"]), redBean)).toBe(false);
    expect(dishMatchesOrderItem(dish("bun", "shelf", ["red-bean", "pork-filling"]), redBean)).toBe(false);
    expect(dishMatchesOrderItem(dish("bun", "shelf"), redBean)).toBe(false);

    const plain = { recipeId: "noodle", quantity: 1, specialIngredientKeys: [] };
    expect(dishMatchesOrderItem(dish("noodle", "shelf"), plain)).toBe(true);
    expect(dishMatchesOrderItem(dish("noodle", "shelf", ["pork-liver"]), plain)).toBe(false);

    const tomatoEgg = { recipeId: "noodle", quantity: 1, specialIngredientKeys: ["egg", "tomato"] };
    expect(dishMatchesOrderItem(dish("noodle", "shelf", ["tomato", "egg"]), tomatoEgg)).toBe(true);
  });

  it("counts only matching dishes toward a pinned item", () => {
    const items = [{ recipeId: "bun", quantity: 2, specialIngredientKeys: ["red-bean"] }];
    const shelf = [dish("bun", "shelf", ["red-bean"]), dish("bun", "shelf", ["pork-filling"]), dish("bun", "shelf")];
    const readiness = resolveOrderReadiness(items, shelf);
    expect(readiness.items[0]).toMatchObject({ onShelf: 1, isReady: false });
    expect(resolveOrderReadiness(items, [...shelf, dish("bun", "shelf", ["red-bean"])]).isReady).toBe(true);
  });

  it("offers plain first, then each named variant once", () => {
    const rules = [
      { iconPath: "/a.png", match: [] },
      { iconPath: "/b.png", match: ["red-bean"] },
      { iconPath: "/c.png", match: ["pork-filling"] },
      { iconPath: "/d.png", match: ["red-bean"] },
      { iconPath: "/e.png", match: ["tomato", "egg"] },
    ];
    expect(listOrderVariantChoices(rules)).toEqual([[], ["red-bean"], ["pork-filling"], ["egg", "tomato"]]);
    expect(listOrderVariantChoices([])).toEqual([[]]);
  });

  it("validates an admin's mixed order", () => {
    const items = [{ recipeId: "r1", quantity: 2 }, { recipeId: "r2", quantity: 1 }];
    expect(validateCharacterOrderDraft({ tokenPrice: 3, items })).toBeNull();
    expect(validateCharacterOrderDraft({ tokenPrice: 0, items })).toBe("invalid_price");
    expect(validateCharacterOrderDraft({ tokenPrice: 51, items })).toBe("invalid_price");
    expect(validateCharacterOrderDraft({ tokenPrice: 1, items: [] })).toBe("missing_items");
    expect(validateCharacterOrderDraft({ tokenPrice: 1, items: [{ recipeId: "r1", quantity: 10 }] })).toBe("invalid_quantity");
    expect(validateCharacterOrderDraft({ tokenPrice: 1, items: [items[0], items[0]] })).toBe("duplicate_item");
  });

  it("doesn't repeat the previous line when there is a choice", () => {
    const lines = [{ en: "a", zh: "甲" }, { en: "b", zh: "乙" }];
    expect(pickCharacterLine(lines, lines[0], () => 0)).toBe(lines[1]);
    expect(pickCharacterLine([lines[0]], lines[0], () => 0)).toBe(lines[0]);
    expect(pickCharacterLine(undefined, null)).toBeNull();
  });
});

describe("validateCafeVisitFrequency", () => {
  it("needs no limit when unlimited", () => {
    expect(validateCafeVisitFrequency("unlimited", null)).toBeNull();
  });

  it("needs a whole number from 1 for every limited frequency", () => {
    expect(validateCafeVisitFrequency("daily", 1)).toBeNull();
    expect(validateCafeVisitFrequency("weekly", null)).toBe("missing_limit");
    expect(validateCafeVisitFrequency("monthly", 0)).toBe("missing_limit");
    expect(validateCafeVisitFrequency("daily", 1.5)).toBe("missing_limit");
  });

  it("caps visits at 100 and random days at 31", () => {
    expect(validateCafeVisitFrequency("monthly", 100)).toBeNull();
    expect(validateCafeVisitFrequency("monthly", 101)).toBe("limit_too_large");
    expect(validateCafeVisitFrequency("random_days", 31)).toBeNull();
    expect(validateCafeVisitFrequency("random_days", 32)).toBe("limit_too_large");
  });
});

describe("scaleToFit", () => {
  it("shrinks the longest side to the limit and keeps the shape", () => {
    expect(scaleToFit(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(scaleToFit(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small photo", () => {
    expect(scaleToFit(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("handles an empty image", () => {
    expect(scaleToFit(0, 600, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("splitPoemLines", () => {
  it("puts each 句 on its own line, keeping its punctuation", () => {
    expect(splitPoemLines("床前明月光，疑是地上霜。举头望明月，低头思故乡。")).toEqual([
      "床前明月光，",
      "疑是地上霜。",
      "举头望明月，",
      "低头思故乡。",
    ]);
  });

  it("keeps line breaks the admin typed and drops blank lines", () => {
    expect(splitPoemLines("小时不识月\n\n呼作白玉盘")).toEqual(["小时不识月", "呼作白玉盘"]);
  });

  it("handles a missing final mark and empty text", () => {
    expect(splitPoemLines("危楼高百尺，手可摘星辰")).toEqual(["危楼高百尺，", "手可摘星辰"]);
    expect(splitPoemLines("")).toEqual([]);
  });
});

describe("normalizers", () => {
  it("drops malformed order items and snapshot counts", () => {
    expect(normalizeCafeOrderItems([{ recipeId: "r1", quantity: 2 }, { recipeId: 4, quantity: 1 }, { recipeId: "r2", quantity: 0 }])).toEqual([
      { recipeId: "r1", quantity: 2 },
    ]);
    expect(normalizeCafeOrderItems("nope")).toEqual([]);
    expect(
      normalizeCafeOrderItems([
        { recipeId: "bun", quantity: 1, specialIngredientKeys: ["red-bean"] },
        { recipeId: "noodle", quantity: 1, specialIngredientKeys: [] },
        { recipeId: "rice", quantity: 1, specialIngredientKeys: null },
      ])
    ).toEqual([
      { recipeId: "bun", quantity: 1, specialIngredientKeys: ["red-bean"] },
      { recipeId: "noodle", quantity: 1, specialIngredientKeys: [] },
      { recipeId: "rice", quantity: 1 },
    ]);
    expect(normalizePriceSnapshot({ a: 2, b: 0, c: "x" })).toEqual({ a: 2 });
  });

  it("normalizes visit results", () => {
    expect(
      normalizeGetCafeVisitResult({ success: true, visitId: "v", characterKey: "li-bai", items: [{ recipeId: "r", quantity: 1 }], tokenPrice: 2 })
    ).toEqual({ success: true, visit: { visitId: "v", characterKey: "li-bai", items: [{ recipeId: "r", quantity: 1 }], tokenPrice: 2 } });
    expect(normalizeGetCafeVisitResult({ success: true, visitId: "v", characterKey: "x", items: [], tokenPrice: 2 })).toEqual({ success: false, code: "unknown" });
    expect(normalizeGetCafeVisitResult({ success: false, code: "no_visitors" })).toEqual({ success: false, code: "no_visitors" });
    expect(normalizeGetCafeVisitResult({ success: false, code: "no_visitors_today" })).toEqual({ success: false, code: "no_visitors_today" });
  });

  it("normalizes write results and unknown codes", () => {
    expect(normalizeServeCafeVisitResult({ success: true, characterKey: "li-bai", tokensEarned: 2, collected: 5, available: 3 })).toEqual({
      success: true,
      characterKey: "li-bai",
      tokensEarned: 2,
      balance: { collected: 5, available: 3 },
    });
    expect(normalizeServeCafeVisitResult({ success: false, code: "not_on_shelf" })).toEqual({ success: false, code: "not_on_shelf" });
    expect(normalizeServeCafeVisitResult({ success: false, code: "weird" })).toEqual({ success: false, code: "unknown" });
    expect(normalizeSaveCharacterOrderResult({ success: true, orderId: "o" })).toEqual({ success: true, orderId: "o" });
    expect(normalizeSaveWishlistRewardResult({ success: false, code: "invalid_child" })).toEqual({ success: false, code: "invalid_child" });
    expect(normalizeSaveWishlistRewardResult({ success: false, code: "invalid_image" })).toEqual({ success: false, code: "invalid_image" });
    expect(normalizeRedeemWishlistRewardResult({ success: false, code: "same_signature" })).toEqual({ success: false, code: "same_signature" });
    expect(normalizeRedeemWishlistRewardResult({ success: true, title: "Backpack" })).toEqual({ success: true, title: "Backpack" });
  });
});
