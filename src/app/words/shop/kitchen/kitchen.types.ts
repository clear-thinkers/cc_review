import type { ShopCookedDish, ShopCookMethod, ShopFoodType, ShopLocale, ShopRecipe } from "@/lib/shop.types";
import { SHOP_FOOD_TYPES, SHOP_KITCHEN_COUNTERTOP_CAPACITY } from "@/lib/shop.types";
import {
  resolvePlainShopRecipeIconPath,
  resolveShopRecipeIconPath,
  resolveShopRecipeVariantTitle,
  resolveShopLocalizedString,
} from "@/lib/shop";

export { SHOP_FOOD_TYPES, SHOP_KITCHEN_COUNTERTOP_CAPACITY };

export type KitchenLoadState = "idle" | "loading" | "ready" | "error";

/** One tile: a count of cooked dishes sharing the same recipe AND the same resolved variant icon, in first-cooked order. */
export type KitchenDishTile = {
  recipeId: string;
  iconPath: string | null;
  /** The variant's own name (e.g. "黑糖奶茶") when its matched rule has one, else the recipe's own localized title. */
  title: string;
  count: number;
};

/**
 * The icon a specific cooked dish actually displays -- its recipe's variant
 * icon for the special ingredients that dish was cooked with
 * (resolveShopRecipeIconPath's existing subset-match-prefer-most-specific
 * algorithm, the same one ShopSection.tsx already uses for the recipe-wall
 * variant display), falling back to the plain icon if the recipe has no
 * matching rule at all (e.g. no rules defined) rather than no icon.
 */
function resolveDishIconPath(dish: ShopCookedDish, recipe: ShopRecipe | undefined): string | null {
  if (!recipe) return null;
  return (
    resolveShopRecipeIconPath(recipe.variantIconRules, dish.specialIngredientKeys) ??
    resolvePlainShopRecipeIconPath(recipe.variantIconRules)
  );
}

/**
 * A dish's display name -- the variant's own admin-configured name (e.g.
 * "黑糖奶茶") when its matched rule (the same one resolveDishIconPath reads)
 * has one, else the recipe's own localized title. Never stored on the dish;
 * resolved fresh from the recipe's variantIconRules every time, same as the
 * icon.
 */
function resolveDishTitle(
  dish: ShopCookedDish,
  recipe: ShopRecipe | undefined,
  locale: ShopLocale
): string {
  if (!recipe) return dish.recipeId;
  const fallbackTitle = resolveShopLocalizedString(recipe.titleI18n, locale, recipe.title);
  return resolveShopRecipeVariantTitle(
    recipe.variantIconRules,
    dish.specialIngredientKeys,
    locale,
    fallbackTitle
  );
}

function pushDishIntoTiles(
  tiles: KitchenDishTile[],
  dish: ShopCookedDish,
  recipesById: ReadonlyMap<string, ShopRecipe>,
  locale: ShopLocale
): void {
  const recipe = recipesById.get(dish.recipeId);
  const iconPath = resolveDishIconPath(dish, recipe);
  const title = resolveDishTitle(dish, recipe, locale);
  const existingTile = tiles.find((tile) => tile.recipeId === dish.recipeId && tile.iconPath === iconPath);
  if (existingTile) {
    existingTile.count += 1;
  } else {
    tiles.push({ recipeId: dish.recipeId, iconPath, title, count: 1 });
  }
}

/**
 * Countertop tiles, aggregated by recipe *and* resolved variant icon -- two
 * dishes of the same recipe cooked with a different special-ingredient
 * combination (and therefore a different picture) stack into separate
 * tiles, not one; two dishes that happen to resolve to the same icon (e.g.
 * two different "didn't match any variant" combinations, both falling back
 * to plain) stack together. Only dishes with `location === "countertop"`
 * are included. Tile order follows first-cooked order (stable across
 * re-renders).
 */
export function buildCountertopTiles(
  dishes: ShopCookedDish[],
  recipesById: ReadonlyMap<string, ShopRecipe>,
  locale: ShopLocale
): KitchenDishTile[] {
  const tiles: KitchenDishTile[] = [];
  for (const dish of dishes) {
    if (dish.location !== "countertop") continue;
    pushDishIntoTiles(tiles, dish, recipesById, locale);
  }
  return tiles;
}

/** How many dishes currently sit on the countertop (not yet organized to the shelf). */
export function countCountertopDishes(dishes: ShopCookedDish[]): number {
  return dishes.filter((dish) => dish.location === "countertop").length;
}

export type KitchenShelfTilesByFoodType = Record<ShopFoodType, KitchenDishTile[]>;

/**
 * Shelved dishes (`location === "shelf"`), grouped into the shelf popup's
 * three tabs by their *recipe's* admin-configured foodType -- never a
 * per-dish choice. A dish whose recipe can't be resolved, or whose recipe
 * has no foodType (shouldn't happen for a cookable recipe -- Shop Admin
 * requires foodType whenever cookMethod is set -- but handled defensively
 * in case a recipe's foodType is cleared after dishes of it already exist),
 * is skipped rather than guessed into a tab. Within a tab, tiles are
 * aggregated by recipe and resolved variant icon, same as the countertop.
 */
export function buildShelfTilesByFoodType(
  dishes: ShopCookedDish[],
  recipesById: ReadonlyMap<string, ShopRecipe>,
  locale: ShopLocale
): KitchenShelfTilesByFoodType {
  const shelves: KitchenShelfTilesByFoodType = {
    drinks: [],
    hotmeal: [],
    desserts: [],
  };

  for (const dish of dishes) {
    if (dish.location !== "shelf") continue;
    const foodType = recipesById.get(dish.recipeId)?.foodType;
    if (!foodType) continue;
    pushDishIntoTiles(shelves[foodType], dish, recipesById, locale);
  }

  return shelves;
}

/** Total dishes ever cooked, across the countertop and shelf combined -- for the "N dishes made" summary line. */
export function countTotalCookedDishes(dishes: ShopCookedDish[]): number {
  return dishes.length;
}

/** The localized appliance label for a recipe's own `cookMethod` -- e.g. for the "X needs the {appliance}" wrong-appliance notice, the appliance named must be the recipe's actual required one, never whichever appliance the child clicked. */
export function resolveApplianceLabel(
  cookMethod: ShopCookMethod,
  labels: { stovetopLabel: string; ovenLabel: string }
): string {
  return cookMethod === "stove" ? labels.stovetopLabel : labels.ovenLabel;
}

/** One special ingredient the child can choose to add, already filtered to ones this recipe actually offers and the child currently has enough of. */
export type KitchenSpecialIngredientOption = {
  ingredientKey: string;
  name: string;
  quantity: number;
  available: number;
};

/**
 * A recipe's special-ingredient slots (already localized), filtered to the
 * ones the child has enough of to actually add (`available >= quantity`)
 * and that have a resolvable ingredientKey at all. Slots the child can't
 * currently afford are left out entirely rather than shown disabled --
 * matches this codebase's general "hide rather than disable a zero-state
 * option" preference (see the fridge grid's own empty-ingredient handling).
 */
export function resolveAvailableSpecialIngredients(
  specialIngredients: { ingredientKey?: string; name: string; quantity: number }[],
  availabilityByKey: ReadonlyMap<string, number>
): KitchenSpecialIngredientOption[] {
  const options: KitchenSpecialIngredientOption[] = [];
  for (const ingredient of specialIngredients) {
    const key = ingredient.ingredientKey;
    if (!key) continue;
    const available = availabilityByKey.get(key) ?? 0;
    if (available < ingredient.quantity) continue;
    options.push({ ingredientKey: key, name: ingredient.name, quantity: ingredient.quantity, available });
  }
  return options;
}
