import type { MysteryIngredientRequirement } from "./mysteryFood.types";
import { getShopRecipeContentForLocale } from "./shop";
import type { RewardedIngredient, ShopIngredient, ShopLocale, ShopRecipe } from "./shop.types";
import { canonicalizeShopIngredientKey } from "./shopIngredients";

/**
 * A recipe's base ingredients as mystery-food requirements (keyed rows only, with
 * canonical keys so they line up with the ingredient availability map). Rows with
 * no ingredientKey can never be rewarded or counted, so they are dropped.
 */
export function requirementsFromShopIngredients(
  ingredients: ShopIngredient[]
): MysteryIngredientRequirement[] {
  return ingredients.flatMap((ingredient) => {
    const ingredientKey = canonicalizeShopIngredientKey(ingredient.ingredientKey);
    return ingredientKey ? [{ ingredientKey, quantity: ingredient.quantity }] : [];
  });
}

/** True when a reward is a mystery-ingredient (win) reward rather than the regular random one. */
export function isMysteryReward(ingredients: ReadonlyArray<Pick<RewardedIngredient, "isMystery">>): boolean {
  return ingredients.some((ingredient) => ingredient.isMystery === true);
}

/**
 * Display titles for the recipes a reward just unlocked, in the order the server
 * reported them. Ids that don't resolve (e.g. recipe deleted since) are skipped.
 */
export function buildUnlockedRecipeTitles(
  recipes: ReadonlyArray<ShopRecipe>,
  unlockedRecipeIds: ReadonlyArray<string>,
  locale: ShopLocale
): string[] {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  return unlockedRecipeIds.flatMap((id) => {
    const recipe = byId.get(id);
    return recipe ? [getShopRecipeContentForLocale(recipe, locale).title] : [];
  });
}
