import type { ShopFoodType } from "@/lib/shop.types";

/**
 * Kitchen Chef ("Chef Shrewy" / 鼩仔) -- roadmap item O.
 * Spec: docs/feature-specs/2026-10-24-kitchen-chef-dialogue.md
 *
 * The chef reacts to four moments on /words/shop/kitchen, plus shelf-aware tap
 * lines (2026-10-26). Presentational only: it never touches cooking, ingredients,
 * coins, or any persisted state.
 */

/** One sprite per pose: public/kitchen/chef_<pose>.png (identical canvas, hat column and feet line). */
export type ChefPose = "idle" | "amazed" | "careful" | "celebrate" | "hungry";

/**
 * - unlock:    a mystery food just auto-unlocked (shown on the next kitchen visit)
 * - start:     the child picked a recipe to cook
 * - success:   a dish was cooked
 * - tapServed: the child tapped the chef while at least one dish is served
 * - tapEmpty:  the child tapped the chef with nothing cooked yet
 */
export type ChefTrigger = "unlock" | "start" | "success" | "tapServed" | "tapEmpty";

export const CHEF_POSES: readonly ChefPose[] = ["idle", "amazed", "careful", "celebrate", "hungry"];
export const CHEF_TRIGGERS: readonly ChefTrigger[] = ["unlock", "start", "success", "tapServed", "tapEmpty"];

export const CHEF_POSE_FOR_TRIGGER: Readonly<Record<ChefTrigger, ChefPose>> = {
  unlock: "amazed",
  start: "careful",
  success: "celebrate",
  tapServed: "hungry",
  tapEmpty: "idle",
};

/** How long a line stays up before the chef returns to idle. */
export const CHEF_LINE_DURATION_MS = 5000;
/** Minimum gap between tap-triggered lines, so rapid taps never stack. */
export const CHEF_TAP_COOLDOWN_MS = 1200;

/**
 * Where the chef stands in the default kitchen art (kitchen_empty / half_stocked /
 * stocked.png share one layout). Percentages of the scene box, like SceneHotspot;
 * each spot avoids the fridge/book/stove/oven/shelf hotspots. `bubble` is where the
 * speech bubble goes -- below him where there's no room above, right-aligned where
 * a left-aligned bubble would run off the scene's right edge.
 */
export type ChefSpot = "ladder" | "shelfTop" | "island" | "stool";

export type ChefSpotLayout = {
  left: string;
  top: string;
  bubble: "above" | "below";
  bubbleAlign: "left" | "right";
};

export const CHEF_SPOTS: Readonly<Record<ChefSpot, ChefSpotLayout>> = {
  ladder: { left: "22.5%", top: "31%", bubble: "above", bubbleAlign: "left" },
  shelfTop: { left: "81.3%", top: "9.8%", bubble: "below", bubbleAlign: "right" },
  island: { left: "55%", top: "44.1%", bubble: "above", bubbleAlign: "right" },
  stool: { left: "58.6%", top: "56.4%", bubble: "above", bubbleAlign: "right" },
};

/** One thing the chef does: a line, the pose he strikes, and where he stands to say it. */
export type ChefReaction = { line: string; pose: ChefPose; spot: ChefSpot };

/** A food type counts as "lots of" once the shelf holds this many dishes of it. */
export const CHEF_SHELF_PLENTY_COUNT = 3;

/** A recipe counts as the child's favorite once it has been cooked this many times. */
export const CHEF_FAVORITE_DISH_COUNT = 3;

/**
 * Shelf-aware lines, one id per numbered line in
 * docs/feature-specs/2026-10-27-kitchen-chef-shelf-reactions.md. Each id has one
 * localized template in `shelf.lines` and its staging (pose + spot) below.
 */
export type ChefShelfLineId = "foodTypeImbalance" | "favoriteAgain" | "favoriteSpecialty";

export const CHEF_SHELF_LINE_STAGING: Readonly<Record<ChefShelfLineId, { pose: ChefPose; spot: ChefSpot }>> = {
  foodTypeImbalance: { pose: "hungry", spot: "shelfTop" }, // #1
  favoriteAgain: { pose: "hungry", spot: "stool" }, // #3
  favoriteSpecialty: { pose: "celebrate", spot: "island" }, // #4
};

export type ChefLineSet = Record<ChefTrigger, string[]>;

export type KitchenChefLocaleStrings = {
  chefName: string;
  tapAria: string;
  hideLabel: string;
  showLabel: string;
  /** Used for any trigger a recipe has no lines of its own for. */
  generic: ChefLineSet;
  /** Recipe-specific overrides keyed by recipe slug; any trigger may be omitted. */
  recipes: Record<string, Partial<ChefLineSet>>;
  /** Shelf-aware lines (2026-10-26); these may name food types and dishes. */
  shelf: {
    /** Food-type names as they read mid-sentence ({have} / {missing}). */
    foodTypes: Record<ShopFoodType, string>;
    /** One template per line id. Tokens: {have}, {missing}, {dish}. */
    lines: Record<ChefShelfLineId, string>;
  };
};
