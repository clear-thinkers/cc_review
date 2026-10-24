/**
 * Kitchen Chef ("Chef Shrewy" / 鼩仔) -- roadmap item O.
 * Spec: docs/feature-specs/2026-10-24-kitchen-chef-dialogue.md
 *
 * The chef reacts to four moments on /words/shop/kitchen. Presentational only: it
 * never touches cooking, ingredients, coins, or any persisted state.
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
};
