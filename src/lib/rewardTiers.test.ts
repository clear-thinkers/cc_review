import { describe, expect, it } from "vitest";
import {
  REWARD_MIN_TESTED_COUNT,
  REWARD_OFFER_SIZE,
  countTestedItems,
  effectiveRewardPicks,
  isBelowRewardThreshold,
  isValidRewardClaim,
  rewardPicksForTestedCount,
  toggleRewardSelection,
} from "./rewardTiers";

describe("rewardPicksForTestedCount (owner tiers, 2026-10-24)", () => {
  it("gives no reward under 10", () => {
    for (const n of [0, 1, 5, 9]) expect(rewardPicksForTestedCount(n)).toBe(0);
  });

  it("gives 1 pick from 10 to 19", () => {
    for (const n of [10, 11, 19]) expect(rewardPicksForTestedCount(n)).toBe(1);
  });

  it("gives 2 picks from 20 to 29", () => {
    for (const n of [20, 25, 29]) expect(rewardPicksForTestedCount(n)).toBe(2);
  });

  it("gives all 3 picks from 30 up", () => {
    for (const n of [30, 31, 100, 1000]) expect(rewardPicksForTestedCount(n)).toBe(3);
  });

  it("treats NaN / negative as no reward", () => {
    expect(rewardPicksForTestedCount(Number.NaN)).toBe(0);
    expect(rewardPicksForTestedCount(-4)).toBe(0);
  });

  it("exposes the constants the tiers are built on", () => {
    expect(REWARD_MIN_TESTED_COUNT).toBe(10);
    expect(REWARD_OFFER_SIZE).toBe(3);
  });
});

describe("countTestedItems", () => {
  it("counts distinct hanzi, matching the Results table's Tested Count", () => {
    expect(countTestedItems([{ hanzi: "水" }, { hanzi: "火" }, { hanzi: "水" }])).toBe(2);
  });

  it("counts a word used in several paragraph blanks once", () => {
    expect(countTestedItems([{ hanzi: "天空" }, { hanzi: "天空" }, { hanzi: "大海" }])).toBe(2);
  });

  it("is 0 for an empty session", () => {
    expect(countTestedItems([])).toBe(0);
  });
});

describe("effectiveRewardPicks", () => {
  it("never exceeds the number of offers", () => {
    expect(effectiveRewardPicks(3, 2)).toBe(2);
    expect(effectiveRewardPicks(2, 3)).toBe(2);
    expect(effectiveRewardPicks(1, 0)).toBe(0);
    expect(effectiveRewardPicks(0, 3)).toBe(0);
  });
});

describe("isValidRewardClaim", () => {
  const offered = ["a", "b", "c"];

  it("accepts exactly the allowed number of distinct offered keys", () => {
    expect(isValidRewardClaim(offered, 1, ["b"])).toBe(true);
    expect(isValidRewardClaim(offered, 2, ["c", "a"])).toBe(true);
    expect(isValidRewardClaim(offered, 3, ["a", "b", "c"])).toBe(true);
  });

  it("rejects too few or too many picks", () => {
    expect(isValidRewardClaim(offered, 2, ["a"])).toBe(false);
    expect(isValidRewardClaim(offered, 1, ["a", "b"])).toBe(false);
    expect(isValidRewardClaim(offered, 1, [])).toBe(false);
  });

  it("rejects a key that was never offered", () => {
    expect(isValidRewardClaim(offered, 1, ["z"])).toBe(false);
  });

  it("rejects the same key picked twice", () => {
    expect(isValidRewardClaim(offered, 2, ["a", "a"])).toBe(false);
  });
});

describe("toggleRewardSelection", () => {
  it("with one pick, tapping another choice swaps it and tapping the chosen one clears it", () => {
    expect(toggleRewardSelection([], "a", 1)).toEqual(["a"]);
    expect(toggleRewardSelection(["a"], "b", 1)).toEqual(["b"]);
    expect(toggleRewardSelection(["a"], "a", 1)).toEqual([]);
  });

  it("with several picks, toggles choices on and off", () => {
    expect(toggleRewardSelection([], "a", 2)).toEqual(["a"]);
    expect(toggleRewardSelection(["a"], "b", 2)).toEqual(["a", "b"]);
    expect(toggleRewardSelection(["a", "b"], "a", 2)).toEqual(["b"]);
  });

  it("will not exceed the allowance (deselect one first)", () => {
    expect(toggleRewardSelection(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(toggleRewardSelection(["a", "b", "c"], "d", 3)).toEqual(["a", "b", "c"]);
  });

  it("allows nothing when no picks are allowed", () => {
    expect(toggleRewardSelection([], "a", 0)).toEqual([]);
  });
});

describe("isBelowRewardThreshold", () => {
  it("is true only under 10 tested items", () => {
    expect(isBelowRewardThreshold(0)).toBe(true);
    expect(isBelowRewardThreshold(9)).toBe(true);
    expect(isBelowRewardThreshold(10)).toBe(false);
    expect(isBelowRewardThreshold(40)).toBe(false);
  });
});
