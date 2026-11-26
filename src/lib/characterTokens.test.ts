import { describe, expect, it } from "vitest";
import {
  buildCharacterTokenStamps,
  computeCharacterTokenBalance,
  countShelfDishesByRecipe,
  filterWishlistForChild,
  findMissingTokens,
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
import type { CharacterTokenAward, WishlistRedemption, WishlistReward } from "./characterTokens.types";

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

describe("café orders", () => {
  it("counts only shelf dishes, never countertop or sold", () => {
    const counts = countShelfDishesByRecipe([
      { recipeId: "r1", location: "shelf" },
      { recipeId: "r1", location: "sold" },
      { recipeId: "r1", location: "countertop" },
      { recipeId: "r2", location: "shelf" },
    ]);
    expect(counts.get("r1")).toBe(1);
    expect(counts.get("r2")).toBe(1);
  });

  it("is ready only when every item is fully on the shelf", () => {
    const items = [{ recipeId: "r1", quantity: 2 }, { recipeId: "r2", quantity: 1 }];
    expect(resolveOrderReadiness(items, new Map([["r1", 2], ["r2", 1]])).isReady).toBe(true);
    const partial = resolveOrderReadiness(items, new Map([["r1", 1], ["r2", 1]]));
    expect(partial.isReady).toBe(false);
    expect(partial.items[0]).toMatchObject({ onShelf: 1, isReady: false });
    expect(resolveOrderReadiness([], new Map()).isReady).toBe(false);
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
