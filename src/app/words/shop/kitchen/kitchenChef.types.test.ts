import { describe, expect, it } from "vitest";
import {
  CHEF_CHALLENGE_POSES,
  CHEF_LINE_DURATION_MS,
  CHEF_POSE_FOR_TRIGGER,
  CHEF_POSES,
  CHEF_TAP_COOLDOWN_MS,
  CHEF_TRIGGERS,
  type ChefLineSet,
  type ChefPose,
  type ChefTrigger,
  type KitchenChefLocaleStrings,
} from "./kitchenChef.types";

describe("kitchenChef types", () => {
  it("lists exactly the five poses and five triggers", () => {
    expect([...CHEF_POSES]).toEqual(["idle", "amazed", "careful", "celebrate", "hungry"]);
    expect([...CHEF_TRIGGERS]).toEqual(["unlock", "start", "success", "tapServed", "tapEmpty"]);
  });

  it("maps every trigger to a valid pose, per the spec", () => {
    expect(CHEF_POSE_FOR_TRIGGER).toEqual({
      unlock: "amazed",
      start: "careful",
      success: "celebrate",
      tapServed: "hungry",
      tapEmpty: "idle",
    });
    for (const trigger of CHEF_TRIGGERS) {
      expect(CHEF_POSES).toContain(CHEF_POSE_FOR_TRIGGER[trigger]);
    }
  });

  it("keeps the timing constants sane (line outlasts the tap cooldown)", () => {
    expect(CHEF_LINE_DURATION_MS).toBeGreaterThan(CHEF_TAP_COOLDOWN_MS);
    expect(CHEF_TAP_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it("constructs a locale strings object with partial recipe overrides", () => {
    const pose: ChefPose = "idle";
    const trigger: ChefTrigger = "start";
    const generic: ChefLineSet = { unlock: ["a"], start: ["b"], success: ["c"], tapServed: ["d"], tapEmpty: ["e"] };
    const strings: KitchenChefLocaleStrings = {
      chefName: "Chef",
      tapAria: "Chat",
      hideLabel: "Hide",
      showLabel: "Show",
      generic,
      recipes: { soup: { start: ["Soup time!"] } },
      shelf: {
        foodTypes: { drinks: "drinks", hotmeal: "hot meals", desserts: "desserts" },
        lines: { foodTypeImbalance: "So many {have}!", favoriteAgain: "{dish}!", favoriteSpecialty: "{dish}!!" },
      },
      challenge: { offer: ["Quiz!"], correct: ["Yes!"], wrong: ["Next time!"], dismiss: ["Later!"] },
    };
    expect(pose).toBe("idle");
    expect(strings.generic[trigger]).toEqual(["b"]);
    expect(strings.recipes.soup.start).toEqual(["Soup time!"]);
    expect(strings.recipes.soup.success).toBeUndefined();
  });

  it("gives each challenge moment a pose, and never a sad one for a wrong answer", () => {
    expect(CHEF_CHALLENGE_POSES).toEqual({ offer: "careful", correct: "celebrate", wrong: "idle" });
  });
});
