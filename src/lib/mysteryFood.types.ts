/**
 * Mystery Foods (roadmap items L/M/N) -- pure-domain input/output shapes.
 * Spec: docs/feature-specs/2026-10-24-mystery-foods.md
 *
 * These are deliberately independent of the database row shapes in
 * shop.types.ts: mysteryFood.ts is a TypeScript reference implementation of
 * the rules the `reward_session_ingredients` RPC enforces server-side, so it
 * takes plain data and has no UI/service imports.
 */

/** One mystery ingredient a food needs, with its per-food quantity. */
export type MysteryIngredientRequirement = {
  ingredientKey: string;
  quantity: number;
};

export type MysteryFoodDefinition = {
  recipeId: string;
  displayOrder: number;
  isActive: boolean;
  ingredients: MysteryIngredientRequirement[];
};

/** Spendable count of each ingredient key (rewards + purchases - consumptions). */
export type MysteryHoldings = ReadonlyMap<string, number>;

/** How many times the child has cooked each mystery recipe (by recipeId). */
export type MysteryMadeCounts = ReadonlyMap<string, number>;

export type MysteryFoodProgress = {
  satisfiedTypes: number;
  totalTypes: number;
  isComplete: boolean;
};

export type MysteryRewardEntry = {
  ingredientKey: string;
  /** Units to grant now (already net of anything the child holds). */
  quantity: number;
};

/** The slice of a persisted quiz session the win rule reads. */
export type WinSessionInput = {
  gradeData: ReadonlyArray<{ grade: "again" | "hard" | "good" | "easy"; isParagraphBlank?: boolean }>;
  failedCount: number;
  totalGrades: number;
};
