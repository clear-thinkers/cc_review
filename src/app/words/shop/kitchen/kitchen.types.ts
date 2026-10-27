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

/** How many dishes are currently organized onto the shelf (`location === "shelf"`). */
export function countShelfDishes(dishes: ShopCookedDish[]): number {
  return dishes.filter((dish) => dish.location === "shelf").length;
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

/**
 * Which kitchen-scene illustration to show, based on how many dishes are
 * currently organized onto the shelf (2026-08-25) -- `kitchen_empty.png`
 * (the original `full-kitchen.png`, renamed once it was no longer the only
 * scene) for an empty shelf, `kitchen_half_stocked.png` for 1-5 shelved
 * dishes, `kitchen_stocked.png` for more than 5. All three share the same
 * artwork layout, so the existing SceneHotspot percentage boxes apply
 * unchanged regardless of which one renders.
 */
export const KITCHEN_SCENE_IMAGE_PATHS = {
  empty: "/kitchen/kitchen_empty.png",
  halfStocked: "/kitchen/kitchen_half_stocked.png",
  stocked: "/kitchen/kitchen_stocked.png",
} as const;

export function resolveKitchenSceneImagePath(shelfDishCount: number): string {
  if (shelfDishCount > 5) return KITCHEN_SCENE_IMAGE_PATHS.stocked;
  if (shelfDishCount >= 1) return KITCHEN_SCENE_IMAGE_PATHS.halfStocked;
  return KITCHEN_SCENE_IMAGE_PATHS.empty;
}

/** A clickable region over a kitchen scene, as percentages of the image's own box. */
export type KitchenSceneHotspot = { left: string; top: string; width: string; height: string };

export type KitchenSceneHotspotName = "fridge" | "book" | "stovetop" | "oven" | "shelf";

/**
 * Everything tied to one scene artwork's layout: the image, its aspect ratio,
 * where each hotspot sits, and whether Chef Shrewy's sprite is overlaid (his
 * position is pinned to the default art's ladder, so a scene that already
 * draws him hides the sprite).
 */
export type KitchenSceneLayout = {
  imagePath: string;
  aspectRatio: string;
  showChef: boolean;
  hotspots: Readonly<Record<KitchenSceneHotspotName, KitchenSceneHotspot>>;
};

const DEFAULT_KITCHEN_SCENE_HOTSPOTS: KitchenSceneLayout["hotspots"] = {
  fridge: { left: "4%", top: "38%", width: "21%", height: "40%" },
  book: { left: "46%", top: "27%", width: "14%", height: "13%" },
  stovetop: { left: "31%", top: "39%", width: "19%", height: "11%" },
  oven: { left: "31%", top: "50%", width: "19%", height: "11%" },
  shelf: { left: "76%", top: "20%", width: "17%", height: "48%" },
};

/**
 * Per-recipe special scenes (2026-10-26), keyed by recipe slug: shown in place
 * of the shelf-stock scene while that recipe is the selected one, and gone
 * again once cooking succeeds (which clears the selection). Each artwork has
 * its own layout, so each entry carries its own hotspot boxes.
 */
export const RECIPE_KITCHEN_SCENES: Readonly<Record<string, KitchenSceneLayout>> = {
  "rainbow-macarons": {
    imagePath: "/kitchen/kitchen_rainbow-macarons.png",
    aspectRatio: "1529 / 1321",
    showChef: false,
    hotspots: {
      fridge: { left: "1.5%", top: "20%", width: "21%", height: "45%" },
      book: { left: "22%", top: "29%", width: "13%", height: "12%" },
      stovetop: { left: "61%", top: "33%", width: "20%", height: "9.5%" },
      oven: { left: "61%", top: "42.5%", width: "14.5%", height: "17%" },
      shelf: { left: "81.5%", top: "14%", width: "18%", height: "41%" },
    },
  },
};

export function resolveKitchenScene(shelfDishCount: number, selectedRecipeSlug: string | null): KitchenSceneLayout {
  const recipeScene = selectedRecipeSlug ? RECIPE_KITCHEN_SCENES[selectedRecipeSlug] : undefined;
  if (recipeScene) return recipeScene;
  return {
    imagePath: resolveKitchenSceneImagePath(shelfDishCount),
    aspectRatio: "1337 / 1176",
    showChef: true,
    hotspots: DEFAULT_KITCHEN_SCENE_HOTSPOTS,
  };
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
