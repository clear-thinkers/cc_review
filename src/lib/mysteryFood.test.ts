import { describe, expect, it } from "vitest";
import {
  getMysteryFoodProgress,
  isWinSession,
  MYSTERY_REWARD_QUOTA,
  planMysteryReward,
} from "./mysteryFood";
import type { MysteryFoodDefinition, WinSessionInput } from "./mysteryFood.types";

type Grade = "again" | "hard" | "good" | "easy";

function session(grades: Grade[], paragraph = false): WinSessionInput {
  return {
    gradeData: grades.map((grade) => ({ grade, ...(paragraph ? { isParagraphBlank: true } : {}) })),
    failedCount: grades.filter((grade) => grade === "again").length,
    totalGrades: grades.length,
  };
}

function food(
  recipeId: string,
  ingredients: Array<[string, number]>,
  overrides: Partial<MysteryFoodDefinition> = {}
): MysteryFoodDefinition {
  return {
    recipeId,
    displayOrder: 1,
    isActive: true,
    ingredients: ingredients.map(([ingredientKey, quantity]) => ({ ingredientKey, quantity })),
    ...overrides,
  };
}

const none = new Map<string, number>();

describe("isWinSession", () => {
  it("is a win when a character session has no failed entries", () => {
    expect(isWinSession(session(["easy", "good", "hard"]))).toBe(true);
  });

  it("is not a win when any entry failed", () => {
    expect(isWinSession(session(["easy", "again", "easy"]))).toBe(false);
  });

  it("treats a wrong phrase (again) as a failure", () => {
    expect(isWinSession(session(["easy", "again"]))).toBe(false);
  });

  it("is not a win with zero graded entries", () => {
    expect(isWinSession(session([]))).toBe(false);
    expect(isWinSession({ gradeData: [], failedCount: 0, totalGrades: 0 })).toBe(false);
  });

  it("is a win for a paragraph quiz only when every blank was first-try easy", () => {
    expect(isWinSession(session(["easy", "easy", "easy"], true))).toBe(true);
  });

  it("is not a win for a paragraph quiz with any bounce, even though failedCount is 0", () => {
    const withBounce = session(["easy", "good", "easy"], true);
    expect(withBounce.failedCount).toBe(0);
    expect(isWinSession(withBounce)).toBe(false);
    expect(isWinSession(session(["easy", "hard"], true))).toBe(false);
  });
});

describe("getMysteryFoodProgress", () => {
  const dumpling = food("dumpling", [
    ["starch", 2],
    ["prawn", 2],
    ["bamboo", 1],
    ["oil", 1],
  ]);

  it("counts a type only when held in full per-food quantity", () => {
    const holdings = new Map([
      ["starch", 2],
      ["prawn", 1], // partial -> not satisfied
      ["bamboo", 1],
    ]);
    expect(getMysteryFoodProgress(dumpling, holdings)).toEqual({
      satisfiedTypes: 2,
      totalTypes: 4,
      isComplete: false,
    });
  });

  it("is complete when every type is held in full", () => {
    const holdings = new Map([
      ["starch", 2],
      ["prawn", 3],
      ["bamboo", 1],
      ["oil", 1],
    ]);
    expect(getMysteryFoodProgress(dumpling, holdings).isComplete).toBe(true);
  });

  it("ignores invalid requirement rows and is never complete with none", () => {
    expect(getMysteryFoodProgress(food("empty", []), none)).toEqual({
      satisfiedTypes: 0,
      totalTypes: 0,
      isComplete: false,
    });
    const bad = food("bad", [
      ["", 1],
      ["x", 0],
      ["y", 1.5],
      ["z", 1],
    ]);
    expect(getMysteryFoodProgress(bad, new Map([["z", 1]]))).toEqual({
      satisfiedTypes: 1,
      totalTypes: 1,
      isComplete: true,
    });
  });

  it("treats negative holdings as zero", () => {
    expect(getMysteryFoodProgress(food("f", [["a", 1]]), new Map([["a", -2]])).satisfiedTypes).toBe(0);
  });
});

describe("planMysteryReward", () => {
  const dumpling = food("dumpling", [
    ["starch", 2],
    ["prawn", 2],
    ["bamboo", 1],
    ["oil", 1],
  ]);

  it("returns null when there are no active mystery foods (caller falls back to random)", () => {
    expect(planMysteryReward([], none, none)).toBeNull();
    expect(planMysteryReward([food("f", [["a", 1]], { isActive: false })], none, none)).toBeNull();
    expect(planMysteryReward([food("f", [])], none, none)).toBeNull();
  });

  it("uses a quota of three ingredient types", () => {
    expect(MYSTERY_REWARD_QUOTA).toBe(3);
  });

  it("rewards up to 3 types at full per-food quantity, then the rest on the next win", () => {
    const first = planMysteryReward([dumpling], none, none);
    expect(first).toEqual([
      { ingredientKey: "starch", quantity: 2 },
      { ingredientKey: "prawn", quantity: 2 },
      { ingredientKey: "bamboo", quantity: 1 },
    ]);

    const holdings = new Map([
      ["starch", 2],
      ["prawn", 2],
      ["bamboo", 1],
    ]);
    const second = planMysteryReward([dumpling], holdings, none);
    // oil completes the set; the 2 leftover slots stockpile another set (see below)
    expect(second?.[0]).toEqual({ ingredientKey: "oil", quantity: 1 });
  });

  it("tops partial holdings up to a full set instead of adding a full set", () => {
    const plan = planMysteryReward([dumpling], new Map([["prawn", 1]]), none);
    expect(plan).toContainEqual({ ingredientKey: "prawn", quantity: 1 });
    expect(plan).not.toContainEqual({ ingredientKey: "prawn", quantity: 2 });
  });

  it("fully rewards a food with 3 or fewer types in one win", () => {
    const small = food("small", [
      ["a", 1],
      ["b", 2],
      ["c", 1],
    ]);
    expect(planMysteryReward([small], none, none)).toEqual([
      { ingredientKey: "a", quantity: 1 },
      { ingredientKey: "b", quantity: 2 },
      { ingredientKey: "c", quantity: 1 },
    ]);
  });

  it("prioritizes the food closest to complete, even over a never-made food", () => {
    const nearlyDone = food("near", [
      ["n1", 1],
      ["n2", 1],
      ["n3", 1],
    ], { displayOrder: 2 });
    const farAway = food("far", [
      ["f1", 1],
      ["f2", 1],
      ["f3", 1],
      ["f4", 1],
    ], { displayOrder: 1 });
    // near was made before; far never made -- near is still closer to complete.
    const holdings = new Map([
      ["n1", 1],
      ["n2", 1],
    ]);
    const plan = planMysteryReward([farAway, nearlyDone], holdings, new Map([["near", 3]]));
    expect(plan?.[0]).toEqual({ ingredientKey: "n3", quantity: 1 });
  });

  it("starts the next food with leftover quota (no wasted reward)", () => {
    const a = food("a", [["a1", 1]], { displayOrder: 1 });
    const b = food("b", [
      ["b1", 1],
      ["b2", 1],
    ], { displayOrder: 2 });
    const plan = planMysteryReward([a, b], none, none);
    expect(plan).toEqual([
      { ingredientKey: "a1", quantity: 1 },
      { ingredientKey: "b1", quantity: 1 },
      { ingredientKey: "b2", quantity: 1 },
    ]);
  });

  it("breaks closeness ties by least-made, then display order", () => {
    const x = food("x", [["x1", 1]], { displayOrder: 1 });
    const y = food("y", [["y1", 1]], { displayOrder: 2 });
    const z = food("z", [["z1", 1]], { displayOrder: 3 });

    // y never made, x made twice -> y first among equals.
    expect(
      planMysteryReward([x, y], none, new Map([["x", 2]]))?.[0].ingredientKey
    ).toBe("y1");
    // all equal -> display order
    expect(planMysteryReward([z, y, x], none, none)?.map((r) => r.ingredientKey)).toEqual([
      "x1",
      "y1",
      "z1",
    ]);
  });

  it("never grants the same ingredient type twice in one win", () => {
    const f1 = food("f1", [
      ["shared", 1],
      ["p", 1],
    ], { displayOrder: 1 });
    const f2 = food("f2", [
      ["shared", 1],
      ["q", 1],
    ], { displayOrder: 2 });
    const plan = planMysteryReward([f1, f2], none, none) ?? [];
    const keys = plan.map((row) => row.ingredientKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["shared", "p", "q"]);
  });

  it("rewards the larger needed quantity once when two foods share an ingredient", () => {
    const f1 = food("f1", [["shared", 1]], { displayOrder: 1 });
    const f2 = food("f2", [
      ["shared", 3],
      ["q", 1],
    ], { displayOrder: 2 });
    const plan = planMysteryReward([f1, f2], none, none) ?? [];
    expect(plan.find((row) => row.ingredientKey === "shared")).toEqual({
      ingredientKey: "shared",
      quantity: 3,
    });
  });

  it("stockpiles another full set when every food is already fully stocked", () => {
    const small = food("small", [
      ["a", 1],
      ["b", 2],
    ]);
    const stocked = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    expect(planMysteryReward([small], stocked, new Map([["small", 1]]))).toEqual([
      { ingredientKey: "a", quantity: 1 },
      { ingredientKey: "b", quantity: 2 },
    ]);
  });

  it("continues a partially stockpiled second set on the following win", () => {
    const big = food("big", [
      ["a", 1],
      ["b", 1],
      ["c", 1],
      ["d", 1],
    ]);
    const stocked = new Map([
      ["a", 1],
      ["b", 1],
      ["c", 1],
      ["d", 1],
    ]);
    const first = planMysteryReward([big], stocked, none) ?? [];
    expect(first.map((row) => row.ingredientKey)).toEqual(["a", "b", "c"]);

    // child now holds 2a 2b 2c 1d -> only d is short of the second set
    const afterFirst = new Map([
      ["a", 2],
      ["b", 2],
      ["c", 2],
      ["d", 1],
    ]);
    const second = planMysteryReward([big], afterFirst, none) ?? [];
    expect(second[0]).toEqual({ ingredientKey: "d", quantity: 1 });
  });

  it("stockpiles the food with the fewest ingredient types first when every food is satisfied", () => {
    const small = food("small", [["s1", 1]], { displayOrder: 2 });
    const large = food("large", [
      ["l1", 1],
      ["l2", 1],
    ], { displayOrder: 1 });
    const holdings = new Map([
      ["s1", 1],
      ["l1", 1],
      ["l2", 1],
    ]);
    // 'large' has the lower display order and is less-made, but 'small' has fewer types.
    const plan = planMysteryReward([large, small], holdings, new Map([["small", 9]]), 3, () => 0.5);
    expect(plan?.[0]).toEqual({ ingredientKey: "s1", quantity: 1 });
  });

  it("picks randomly among satisfied foods tied on ingredient count", () => {
    const a = food("a", [["a1", 1]], { displayOrder: 1 });
    const b = food("b", [["b1", 1]], { displayOrder: 2 });
    const holdings = new Map([
      ["a1", 1],
      ["b1", 1],
    ]);
    const lowFirst = [0.1, 0.9];
    const highFirst = [0.9, 0.1];
    let i = 0;
    const pickA = planMysteryReward([a, b], holdings, none, 1, () => lowFirst[i++ % 2]);
    i = 0;
    const pickB = planMysteryReward([a, b], holdings, none, 1, () => highFirst[i++ % 2]);
    expect(pickA).toEqual([{ ingredientKey: "a1", quantity: 1 }]);
    expect(pickB).toEqual([{ ingredientKey: "b1", quantity: 1 }]);
  });

  it("fills leftover quota by stockpiling once every food is satisfied", () => {
    const small = food("small", [["a", 1]]);
    // needs only 'a'; slots 2 and 3 have nothing else to give except more of 'a',
    // which is excluded (no repeat per win) -> single entry.
    expect(planMysteryReward([small], none, none)).toEqual([{ ingredientKey: "a", quantity: 1 }]);
  });

  it("never returns more than the quota", () => {
    const wide = food("wide", [
      ["a", 1],
      ["b", 1],
      ["c", 1],
      ["d", 1],
      ["e", 1],
    ]);
    expect(planMysteryReward([wide], none, none)).toHaveLength(3);
  });

  it("skips inactive foods and foods with no valid ingredients", () => {
    const inactive = food("inactive", [["i1", 1]], { isActive: false, displayOrder: 1 });
    const live = food("live", [["l1", 1]], { displayOrder: 2 });
    expect(planMysteryReward([inactive, live], none, none)).toEqual([
      { ingredientKey: "l1", quantity: 1 },
    ]);
  });
});
