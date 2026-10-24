import { describe, expect, it } from "vitest";
import { kitchenChefStrings } from "./kitchenChef.strings";
import { CHEF_TRIGGERS, type KitchenChefLocaleStrings } from "./kitchenChef.types";
import {
  canChefRespondToTap,
  findUnseenMysteryUnlocks,
  parseSeenUnlockIds,
  pickChefLine,
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
