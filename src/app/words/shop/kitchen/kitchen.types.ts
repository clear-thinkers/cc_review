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
  return resolveRecipeDishIconPath(recipe, dish.specialIngredientKeys);
}

/** Same icon rule as resolveDishIconPath, for a dish about to be (or just) cooked with these special ingredients. */
export function resolveRecipeDishIconPath(recipe: ShopRecipe, specialIngredientKeys: string[]): string | null {
  return (
    resolveShopRecipeIconPath(recipe.variantIconRules, specialIngredientKeys) ??
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
  /** Optional animation anchors for this artwork (KitchenSceneEffects.tsx). */
  effects?: KitchenSceneEffectsLayout;
};

/** A point on a scene artwork, as percentages of the image's own box. */
export type KitchenScenePoint = { left: string; top: string };

/**
 * Where a recipe scene's animations sit on its artwork (2026-10-27): steam and a
 * warm glow over the pot, twinkling sparkles, the prep step (the child drags each
 * needed ingredient from its spot into the pot, one unit at a time, before the
 * stove will cook), the ~3 s bubbling cook, and the PAINTED chef's speech bubble
 * and tap area -- these scenes draw Chef Shrewy themselves, so his sprite is
 * hidden there. The finished dish is then shown full-size in KitchenDishReveal.
 */
export type KitchenSceneEffectsLayout = {
  pot: KitchenSceneHotspot;
  /** What the painted `pot` actually is, so the prep prompts name the right thing. */
  vessel: "pot" | "bowl";
  sparkles: readonly KitchenScenePoint[];
  /** Where each prep token sits, in requirement order; cycled if a recipe needs more kinds. */
  ingredientOrigins: readonly KitchenScenePoint[];
  /**
   * The painted chef's tap box. His bubble sits above him, opening from the
   * `bubbleAlign` edge; with `bubbleBesideOnWide`, md+ screens (where there's room)
   * move it beside him instead, so it doesn't hide the prep tokens.
   */
  chef: KitchenSceneHotspot & { bubbleAlign: "left" | "right"; bubbleBesideOnWide?: "left" | "right" };
};

/** How long the pot bubbles on the stove before the dish is revealed (owner asked for ~3 s, 2026-10-27). */
export const KITCHEN_SCENE_COOK_MS = 3000;

/** The "Shrewy washes his hands" reward video (roadmap item T, spec section C). */
export const HAND_WASH_VIDEO_SRC = "/video/shrewy_hand_wash.mp4";

/** If the hand-wash video hasn't started by then, retry muted once, then carry on without it. */
export const HAND_WASH_VIDEO_START_TIMEOUT_MS = 2000;

/**
 * When Chef Shrewy's challenge may be offered (spec decisions 1, 1a): only on an
 * interactive recipe scene, only in the prep phase -- a recipe is chosen and the stove
 * hasn't been tapped yet (including after every ingredient is in the pot), with no cook
 * running and no dish reveal up.
 */
export function isChefChallengePrepPhase(params: {
  sceneIsInteractive: boolean;
  selectedRecipeId: string | null;
  cookingRecipeId: string | null;
  isCookCommitting: boolean;
  hasDishReveal: boolean;
}): boolean {
  return (
    params.sceneIsInteractive &&
    params.selectedRecipeId !== null &&
    params.cookingRecipeId === null &&
    !params.isCookCommitting &&
    !params.hasDishReveal
  );
}

/** The hand-wash video plays after every new recipe choice once unlocked; deselecting never plays it. */
export function shouldPlayHandWashVideo(params: { isUnlocked: boolean; isDeselecting: boolean }): boolean {
  return params.isUnlocked && !params.isDeselecting;
}

/** How long the Finish celebration (confetti + chime) plays before the dish reveal closes. */
export const KITCHEN_DISH_REVEAL_FINISH_MS = 1800;

/** How long one ingredient takes to sink into the pot once dropped or tapped (matches .fly). */
export const KITCHEN_SCENE_FLY_MS = 1400;

/** One kind of ingredient the prep step asks for, and how many units of it. */
export type KitchenScenePrepRequirement = { key: string; label: string; iconPath: string; quantity: number };

/** A draggable ingredient still waiting to go into the pot. */
export type KitchenScenePrepToken = KitchenScenePrepRequirement & { from: KitchenScenePoint; remaining: number };

/**
 * What the prep step asks for: the base units one cook consumes (variant waivers
 * already applied by the caller) plus each chosen special ingredient's slot
 * quantity. Ingredients with no icon can't be dragged, so they're left out --
 * the prep step never blocks a cook on something the child can't see.
 */
export function buildKitchenScenePrepRequirements(params: {
  baseRequirements: ReadonlyMap<string, number>;
  specialIngredients: readonly { key: string; quantity: number }[];
  resolveIngredient: (key: string) => { label: string; iconPath: string | null };
}): KitchenScenePrepRequirement[] {
  const quantities = new Map(params.baseRequirements);
  for (const special of params.specialIngredients) {
    quantities.set(special.key, (quantities.get(special.key) ?? 0) + special.quantity);
  }
  return Array.from(quantities, ([key, quantity]) => ({ key, quantity, ...params.resolveIngredient(key) })).filter(
    (requirement): requirement is KitchenScenePrepRequirement => Boolean(requirement.iconPath) && requirement.quantity > 0
  );
}

/** Tokens for whatever still has units left; each keeps its own origin as others finish. */
export function buildKitchenScenePrepTokens(
  requirements: readonly KitchenScenePrepRequirement[],
  origins: readonly KitchenScenePoint[],
  addedByKey: Readonly<Record<string, number>>
): KitchenScenePrepToken[] {
  if (origins.length === 0) return [];
  return requirements
    .map((requirement, index) => ({
      ...requirement,
      from: origins[index % origins.length],
      remaining: Math.max(requirement.quantity - (addedByKey[requirement.key] ?? 0), 0),
    }))
    .filter((token) => token.remaining > 0);
}

export function isKitchenScenePrepComplete(
  requirements: readonly KitchenScenePrepRequirement[],
  addedByKey: Readonly<Record<string, number>>
): boolean {
  return requirements.every((requirement) => (addedByKey[requirement.key] ?? 0) >= requirement.quantity);
}

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
  "crystal-pear-dew": {
    imagePath: "/kitchen/kitchen_crystal-pear-dew.png",
    aspectRatio: "1600 / 1391",
    showChef: false,
    hotspots: {
      fridge: { left: "5%", top: "38%", width: "20%", height: "40%" },
      book: { left: "48%", top: "30%", width: "9%", height: "10%" },
      stovetop: { left: "33.5%", top: "34%", width: "16%", height: "15.5%" },
      oven: { left: "37%", top: "51%", width: "12.5%", height: "13.5%" },
      shelf: { left: "80%", top: "22%", width: "15%", height: "42%" },
    },
    effects: {
      pot: { left: "38.5%", top: "35%", width: "9%", height: "8.5%" },
      vessel: "pot",
      sparkles: [
        { left: "37%", top: "33%" },
        { left: "47.5%", top: "31.5%" },
        { left: "44%", top: "29%" },
        { left: "64%", top: "47%" },
        { left: "74.5%", top: "45.5%" },
      ],
      // Pear dew's order: pear, amber crystals, chrysanthemum, goji.
      ingredientOrigins: [
        { left: "55%", top: "56.5%" }, // pear on the cutting board
        { left: "66.5%", top: "51%" }, // gold jar
        { left: "58.5%", top: "64%" }, // the little plate
        { left: "72.2%", top: "48.2%" }, // goji jar
      ],
      chef: {
        left: "62%",
        top: "59%",
        width: "11%",
        height: "26%",
        bubbleAlign: "right",
        bubbleBesideOnWide: "right",
      },
    },
  },
  "golden-mooncake": {
    imagePath: "/kitchen/kitchen_golden_mooncakes.jpg",
    aspectRatio: "1024 / 1024",
    showChef: false,
    hotspots: {
      fridge: { left: "5%", top: "37%", width: "19.5%", height: "37%" },
      book: { left: "47.5%", top: "29%", width: "9%", height: "8%" },
      stovetop: { left: "33%", top: "36%", width: "15.5%", height: "10%" },
      oven: { left: "37.5%", top: "47%", width: "11.5%", height: "14.5%" },
      shelf: { left: "80%", top: "24%", width: "16%", height: "40%" },
    },
    effects: {
      // An oven bake, so the "pot" is the mixing bowl on the island.
      pot: { left: "55%", top: "53.5%", width: "10.5%", height: "8.5%" },
      vessel: "bowl",
      sparkles: [
        { left: "41%", top: "50%" },
        { left: "47.5%", top: "48%" },
        { left: "48%", top: "37%" },
        { left: "58%", top: "36%" },
        { left: "67%", top: "48%" },
      ],
      // Mooncake's order: lotus paste, salted yolk, pastry flour, osmanthus honey.
      ingredientOrigins: [
        { left: "50.5%", top: "58.5%" }, // mooncake mold on the cutting board (no lotus prop in the art)
        { left: "59%", top: "38%" }, // yolk in its nest
        { left: "72%", top: "54%" }, // flour on the star dish
        { left: "74%", top: "45%" }, // honey jar
      ],
      chef: {
        left: "62%",
        top: "56%",
        width: "12%",
        height: "22%",
        bubbleAlign: "right",
        bubbleBesideOnWide: "right",
      },
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
