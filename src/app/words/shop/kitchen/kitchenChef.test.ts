import { describe, expect, it } from "vitest";
import { kitchenChefStrings } from "./kitchenChef.strings";
import {
  CHEF_SHELF_LINE_STAGING,
  CHEF_SPOTS,
  CHEF_TRIGGERS,
  type ChefReaction,
  type ChefShelfLineId,
  type KitchenChefLocaleStrings,
} from "./kitchenChef.types";
import {
  buildShelfChefReactions,
  canChefRespondToTap,
  countShelfDishesByFoodType,
  findFavoriteRecipeId,
  findShelfFoodTypeImbalance,
  findUnseenMysteryUnlocks,
  parseSeenUnlockIds,
  pickChefLine,
  pickChefTapReaction,
  serializeSeenUnlockIds,
} from "./kitchenChef.utils";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return [`${prefix}[${value.length}]`];
  }
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("kitchenChef.strings", () => {
  it("EN and ZH have identical nested keys AND the same number of lines per trigger", () => {
    expect(collectKeyPaths(kitchenChefStrings.zh).sort()).toEqual(collectKeyPaths(kitchenChefStrings.en).sort());
  });

  it("names the chef in both locales", () => {
    expect(kitchenChefStrings.en.chefName).toBe("Chef Shrewy");
    expect(kitchenChefStrings.zh.chefName).toBe("鼩仔");
  });

  it("gives every trigger at least one non-empty generic line in both locales", () => {
    for (const locale of ["en", "zh"] as const) {
      for (const trigger of CHEF_TRIGGERS) {
        const lines = kitchenChefStrings[locale].generic[trigger];
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.every((line) => line.trim() !== "")).toBe(true);
      }
    }
  });

  it("keeps generic lines short enough for one bubble line (EN <= 45, ZH <= 24 chars)", () => {
    for (const trigger of CHEF_TRIGGERS) {
      kitchenChefStrings.en.generic[trigger].forEach((line) => expect(line.length).toBeLessThanOrEqual(45));
      kitchenChefStrings.zh.generic[trigger].forEach((line) => expect(line.length).toBeLessThanOrEqual(24));
    }
  });

  it("never names coins in a generic line", () => {
    const all = [
      ...CHEF_TRIGGERS.flatMap((trigger) => kitchenChefStrings.en.generic[trigger]),
      ...CHEF_TRIGGERS.flatMap((trigger) => kitchenChefStrings.zh.generic[trigger]),
    ];
    expect(all.some((line) => /coin|金币/i.test(line))).toBe(false);
  });

  it("has the four approved Crystal Dumplings lines in both locales", () => {
    for (const locale of ["en", "zh"] as const) {
      const lines = kitchenChefStrings[locale].recipes["crystal-dumpling"];
      expect(Object.keys(lines ?? {}).sort()).toEqual(["start", "success", "tapServed", "unlock"]);
    }
    expect(kitchenChefStrings.zh.recipes["crystal-dumpling"].start?.[0]).toBe(
      "小心烫哦！等蒸汽散开，虾饺就会像水晶一样透亮！"
    );
  });

  it("has all four Crystal Pear Dew lines in both locales", () => {
    for (const locale of ["en", "zh"] as const) {
      const lines = kitchenChefStrings[locale].recipes["crystal-pear-dew"];
      expect(Object.keys(lines ?? {}).sort()).toEqual(["start", "success", "tapServed", "unlock"]);
    }
  });
  it("gives every shelf line id a template in both locales, with the tokens it needs", () => {
    const tokensById: Record<ChefShelfLineId, string[]> = {
      foodTypeImbalance: ["{have}", "{missing}"],
      favoriteAgain: ["{dish}"],
      favoriteSpecialty: ["{dish}"],
    };
    for (const locale of ["en", "zh"] as const) {
      const { shelf } = kitchenChefStrings[locale];
      expect(Object.values(shelf.foodTypes).every((name) => name.trim() !== "")).toBe(true);
      expect(Object.keys(shelf.lines).sort()).toEqual(Object.keys(CHEF_SHELF_LINE_STAGING).sort());
      for (const [id, tokens] of Object.entries(tokensById)) {
        tokens.forEach((token) => expect(shelf.lines[id as ChefShelfLineId]).toContain(token));
      }
    }
  });
});

const strings: Pick<KitchenChefLocaleStrings, "generic" | "recipes"> = {
  generic: {
    unlock: ["G-unlock"],
    start: ["G-start-1", "G-start-2", "G-start-3"],
    success: ["G-success-1", "G-success-2"],
    tapServed: ["G-tap-1", "G-tap-2"],
    tapEmpty: ["G-empty-1", "G-empty-2"],
  },
  recipes: {
    soup: { start: ["Soup-start"], tapServed: ["Soup-tap"] },
    blank: { start: ["   "] },
  },
};

describe("pickChefLine", () => {
  it("uses the recipe's own lines when it has them for that trigger", () => {
    expect(pickChefLine({ trigger: "start", strings, recipeSlug: "soup", random: () => 0 })).toBe("Soup-start");
  });

  it("falls back to generic lines when the recipe has none for that trigger", () => {
    expect(pickChefLine({ trigger: "success", strings, recipeSlug: "soup", random: () => 0 })).toBe("G-success-1");
    expect(pickChefLine({ trigger: "start", strings, recipeSlug: "unknown", random: () => 0 })).toBe("G-start-1");
    expect(pickChefLine({ trigger: "start", strings, recipeSlug: null, random: () => 0 })).toBe("G-start-1");
  });

  it("treats a recipe whose lines are all blank as having none", () => {
    expect(pickChefLine({ trigger: "start", strings, recipeSlug: "blank", random: () => 0 })).toBe("G-start-1");
  });

  it("picks across the whole pool using the random source", () => {
    expect(pickChefLine({ trigger: "start", strings, random: () => 0.99 })).toBe("G-start-3");
    expect(pickChefLine({ trigger: "start", strings, random: () => 0.5 })).toBe("G-start-2");
  });

  it("never repeats the last line while another option exists", () => {
    for (const r of [0, 0.4, 0.99]) {
      expect(pickChefLine({ trigger: "start", strings, lastLine: "G-start-1", random: () => r })).not.toBe("G-start-1");
    }
  });

  it("repeats the last line only when it is the sole option", () => {
    expect(pickChefLine({ trigger: "unlock", strings, lastLine: "G-unlock", random: () => 0 })).toBe("G-unlock");
  });

  it("tapServed mixes generic lines with each served recipe's own lines", () => {
    const seen = new Set<string>();
    for (const r of [0, 0.34, 0.67, 0.99]) {
      seen.add(pickChefLine({ trigger: "tapServed", strings, servedRecipeSlugs: ["soup"], random: () => r }) ?? "");
    }
    expect(seen).toEqual(new Set(["G-tap-1", "G-tap-2", "Soup-tap"]));
  });

  it("tapServed ignores recipes that are not served, and dedupes repeated slugs", () => {
    expect(pickChefLine({ trigger: "tapServed", strings, servedRecipeSlugs: [], random: () => 0.99 })).toBe("G-tap-2");
    const lines = new Set(
      [0, 0.5, 0.99].map((r) =>
        pickChefLine({ trigger: "tapServed", strings, servedRecipeSlugs: ["soup", "soup"], random: () => r })
      )
    );
    expect(lines.size).toBe(3);
  });

  it("tapEmpty uses generic lines only", () => {
    expect(pickChefLine({ trigger: "tapEmpty", strings, recipeSlug: "soup", servedRecipeSlugs: ["soup"], random: () => 0 })).toBe(
      "G-empty-1"
    );
  });

  it("returns null when there is nothing to say", () => {
    const empty = {
      generic: { unlock: [], start: [], success: [], tapServed: [], tapEmpty: [] },
      recipes: {},
    };
    for (const trigger of CHEF_TRIGGERS) {
      expect(pickChefLine({ trigger, strings: empty })).toBeNull();
    }
  });

  it("stays in range even if random returns exactly 1", () => {
    expect(pickChefLine({ trigger: "start", strings, random: () => 1 })).toBe("G-start-3");
  });
});

describe("findUnseenMysteryUnlocks", () => {
  const recipes = [
    { id: "b", isMystery: true, displayOrder: 20 },
    { id: "a", isMystery: true, displayOrder: 14 },
    { id: "normal", isMystery: false, displayOrder: 1 },
    { id: "locked", isMystery: true, displayOrder: 30 },
  ];

  it("returns unlocked, unseen mystery foods in wall order", () => {
    const unlocked = new Set(["a", "b", "normal"]);
    expect(findUnseenMysteryUnlocks(recipes, unlocked, new Set()).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("skips ones already announced, normal recipes, and still-locked foods", () => {
    const unlocked = new Set(["a", "b", "normal"]);
    expect(findUnseenMysteryUnlocks(recipes, unlocked, new Set(["a"])).map((r) => r.id)).toEqual(["b"]);
    expect(findUnseenMysteryUnlocks(recipes, new Set(), new Set())).toEqual([]);
  });
});

describe("seen-unlock persistence helpers", () => {
  it("round-trips a set of ids", () => {
    expect(parseSeenUnlockIds(serializeSeenUnlockIds(new Set(["b", "a"])))).toEqual(new Set(["a", "b"]));
  });

  it("treats missing or malformed storage as nothing seen", () => {
    expect(parseSeenUnlockIds(null)).toEqual(new Set());
    expect(parseSeenUnlockIds("")).toEqual(new Set());
    expect(parseSeenUnlockIds("not json")).toEqual(new Set());
    expect(parseSeenUnlockIds('{"a":1}')).toEqual(new Set());
  });

  it("drops non-string entries", () => {
    expect(parseSeenUnlockIds('["a",3,null,"b"]')).toEqual(new Set(["a", "b"]));
  });
});

describe("canChefRespondToTap", () => {
  it("allows the first tap and taps after the cooldown", () => {
    expect(canChefRespondToTap(1000, null, 1200)).toBe(true);
    expect(canChefRespondToTap(2200, 1000, 1200)).toBe(true);
  });

  it("blocks taps inside the cooldown", () => {
    expect(canChefRespondToTap(2199, 1000, 1200)).toBe(false);
    expect(canChefRespondToTap(1000, 1000, 1200)).toBe(false);
  });
});

describe("pickChefTapReaction", () => {
  const shelfReaction: ChefReaction = { line: "Shelf-line", pose: "hungry", spot: "shelfTop" };

  it("says the trigger's own lines from the ladder in the trigger's pose", () => {
    expect(pickChefTapReaction({ trigger: "tapServed", strings, random: () => 0 })).toEqual({
      line: "G-tap-1",
      pose: "hungry",
      spot: "ladder",
    });
    expect(pickChefTapReaction({ trigger: "tapEmpty", strings, random: () => 0 })?.pose).toBe("idle");
  });

  it("adds situational reactions to the pool, keeping their own pose and spot", () => {
    const picks = [0, 0.4, 0.99].map((r) =>
      pickChefTapReaction({ trigger: "tapServed", strings, extraReactions: [shelfReaction], random: () => r })
    );
    expect(picks.map((pick) => pick?.line)).toEqual(["G-tap-1", "G-tap-2", "Shelf-line"]);
    expect(picks[2]).toEqual(shelfReaction);
  });

  it("never repeats the last line while another option exists", () => {
    for (const r of [0, 0.5, 0.99]) {
      expect(
        pickChefTapReaction({
          trigger: "tapServed",
          strings,
          extraReactions: [shelfReaction],
          lastLine: "Shelf-line",
          random: () => r,
        })?.line
      ).not.toBe("Shelf-line");
    }
  });

  it("returns null when there is nothing to say", () => {
    const empty = { generic: { unlock: [], start: [], success: [], tapServed: [], tapEmpty: [] }, recipes: {} };
    expect(pickChefTapReaction({ trigger: "tapEmpty", strings: empty })).toBeNull();
  });
});

describe("shelf-aware reactions", () => {
  const recipesById = new Map([
    ["tea", { foodType: "drinks" as const }],
    ["cake", { foodType: "desserts" as const }],
    ["soup", { foodType: "hotmeal" as const }],
    ["uncookable", { foodType: null }],
  ]);
  const onShelf = (recipeId: string) => ({ recipeId, location: "shelf" as const });

  it("counts shelf dishes by food type, ignoring the countertop and untyped recipes", () => {
    const dishes = [
      onShelf("cake"),
      onShelf("cake"),
      onShelf("tea"),
      onShelf("uncookable"),
      { recipeId: "soup", location: "countertop" as const },
    ];
    expect(countShelfDishesByFoodType(dishes, recipesById)).toEqual({ drinks: 1, hotmeal: 0, desserts: 2 });
  });

  it("finds plenty of one food type alongside none of another", () => {
    expect(findShelfFoodTypeImbalance({ drinks: 0, hotmeal: 1, desserts: 3 })).toEqual({ have: "desserts", missing: "drinks" });
    expect(findShelfFoodTypeImbalance({ drinks: 4, hotmeal: 0, desserts: 6 })).toEqual({ have: "desserts", missing: "hotmeal" });
  });

  it("finds nothing when no type has plenty or every type is on the shelf", () => {
    expect(findShelfFoodTypeImbalance({ drinks: 0, hotmeal: 2, desserts: 2 })).toBeNull();
    expect(findShelfFoodTypeImbalance({ drinks: 1, hotmeal: 5, desserts: 1 })).toBeNull();
    expect(findShelfFoodTypeImbalance({ drinks: 0, hotmeal: 0, desserts: 0 })).toBeNull();
  });

  const balanced = { drinks: 1, hotmeal: 1, desserts: 1 };

  it("builds the imbalance line (#1) on top of the shelf, in both locales", () => {
    const facts = { shelfCountsByFoodType: { drinks: 0, hotmeal: 1, desserts: 3 }, favoriteDishTitle: null };
    expect(buildShelfChefReactions(facts, kitchenChefStrings.en)).toEqual([
      { line: "So many desserts! How about some drinks next?", pose: "hungry", spot: "shelfTop" },
    ]);
    expect(buildShelfChefReactions(facts, kitchenChefStrings.zh)[0].line).toBe("好多甜点呀！下次做点饮品怎么样？");
  });

  it("builds both favorite-dish lines (#3 on the stool, #4 on the island) naming the dish", () => {
    const facts = { shelfCountsByFoodType: balanced, favoriteDishTitle: "Pancakes" };
    expect(buildShelfChefReactions(facts, kitchenChefStrings.en)).toEqual([
      { line: "Pancakes again? You really love it, huh!", pose: "hungry", spot: "stool" },
      { line: "I think Pancakes is our specialty now!", pose: "celebrate", spot: "island" },
    ]);
    expect(
      buildShelfChefReactions({ ...facts, favoriteDishTitle: "松饼" }, kitchenChefStrings.zh).map((r) => r.line)
    ).toEqual(["又是松饼？你真的超爱它耶！", "松饼已经是我们的招牌菜啦！"]);
  });

  it("combines every line that applies", () => {
    const facts = { shelfCountsByFoodType: { drinks: 0, hotmeal: 0, desserts: 4 }, favoriteDishTitle: "Cake" };
    expect(buildShelfChefReactions(facts, kitchenChefStrings.en).map((r) => r.spot)).toEqual([
      "shelfTop",
      "stool",
      "island",
    ]);
  });

  it("builds nothing when the shelf has no gap and there is no favorite", () => {
    expect(buildShelfChefReactions({ shelfCountsByFoodType: balanced, favoriteDishTitle: null }, kitchenChefStrings.en)).toEqual([]);
  });

  it("stages every line id at a spot that has a layout", () => {
    for (const { spot } of Object.values(CHEF_SHELF_LINE_STAGING)) {
      expect(CHEF_SPOTS[spot]).toBeDefined();
    }
  });
});

describe("findFavoriteRecipeId", () => {
  const recipesById = new Map([
    ["tea", { displayOrder: 1 }],
    ["cake", { displayOrder: 2 }],
    ["soup", { displayOrder: 3 }],
  ]);
  const cooked = (...ids: string[]) => ids.map((recipeId) => ({ recipeId }));

  it("picks the most-cooked recipe once it reaches the threshold", () => {
    expect(findFavoriteRecipeId(cooked("tea", "cake", "cake", "cake", "soup", "soup"), recipesById)).toBe("cake");
  });

  it("returns null when nothing has been cooked enough times", () => {
    expect(findFavoriteRecipeId(cooked("tea", "tea", "cake", "cake"), recipesById)).toBeNull();
    expect(findFavoriteRecipeId([], recipesById)).toBeNull();
  });

  it("breaks ties by wall order and ignores unknown recipes", () => {
    expect(findFavoriteRecipeId(cooked("soup", "soup", "soup", "cake", "cake", "cake"), recipesById)).toBe("cake");
    expect(findFavoriteRecipeId(cooked("gone", "gone", "gone", "gone"), recipesById)).toBeNull();
  });
});

describe("chef challenge lines (roadmap item T)", () => {
  it("has non-empty lines for every challenge moment in both locales", () => {
    for (const locale of ["en", "zh"] as const) {
      for (const moment of ["offer", "nextCorrect", "correct", "wrong", "dismiss"] as const) {
        const lines = kitchenChefStrings[locale].challenge[moment];
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.every((line) => line.trim() !== "")).toBe(true);
      }
    }
  });

  it("names the paw print in every correct-answer line", () => {
    kitchenChefStrings.en.challenge.correct.forEach((line) => expect(line).toMatch(/paw print/i));
    kitchenChefStrings.zh.challenge.correct.forEach((line) => expect(line).toContain("爪印"));
  });
});

