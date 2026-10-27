import type { ShopCookedDish, ShopFoodType, ShopRecipe } from "@/lib/shop.types";
import { SHOP_FOOD_TYPES } from "@/lib/shop.types";
import {
  CHEF_FAVORITE_DISH_COUNT,
  CHEF_POSE_FOR_TRIGGER,
  CHEF_SHELF_LINE_STAGING,
  CHEF_SHELF_PLENTY_COUNT,
  type ChefReaction,
  type ChefShelfLineId,
  type ChefTrigger,
  type KitchenChefLocaleStrings,
} from "./kitchenChef.types";

/**
 * Picks the line the chef says for a trigger, or null when there is nothing to say.
 *
 * - unlock / start / success: the recipe's own lines when it has any for that
 *   trigger, otherwise the generic set.
 * - tapServed: the generic lines PLUS every served recipe's own tapServed lines, so
 *   a child with a mystery dish on the shelf sometimes hears about it but the
 *   generic lines never disappear.
 * - tapEmpty: generic only.
 *
 * The line just shown (`lastLine`) is excluded whenever another option exists, so
 * the chef never says the same thing twice in a row. `random` is injectable for tests.
 */
export function pickChefLine(params: {
  trigger: ChefTrigger;
  strings: Pick<KitchenChefLocaleStrings, "generic" | "recipes">;
  recipeSlug?: string | null;
  servedRecipeSlugs?: readonly string[];
  lastLine?: string | null;
  random?: () => number;
}): string | null {
  const pool = buildChefLinePool(params);
  if (pool.length === 0) {
    return null;
  }

  const withoutLast = pool.length > 1 ? pool.filter((line) => line !== (params.lastLine ?? null)) : pool;
  const random = params.random ?? Math.random;
  const index = Math.min(Math.floor(random() * withoutLast.length), withoutLast.length - 1);
  return withoutLast[Math.max(index, 0)];
}

/** Every distinct non-empty line pickChefLine could choose from for a trigger (rules above). */
export function buildChefLinePool(params: {
  trigger: ChefTrigger;
  strings: Pick<KitchenChefLocaleStrings, "generic" | "recipes">;
  recipeSlug?: string | null;
  servedRecipeSlugs?: readonly string[];
}): string[] {
  const { trigger, strings, recipeSlug, servedRecipeSlugs = [] } = params;

  let pool: string[];
  if (trigger === "tapServed") {
    pool = [
      ...strings.generic.tapServed,
      ...servedRecipeSlugs.flatMap((slug) => strings.recipes[slug]?.tapServed ?? []),
    ];
  } else if (trigger === "tapEmpty") {
    pool = [...strings.generic.tapEmpty];
  } else {
    const own = recipeSlug ? strings.recipes[recipeSlug]?.[trigger] : undefined;
    pool = own && own.some((line) => line.trim() !== "") ? [...own] : [...strings.generic[trigger]];
  }

  return Array.from(new Set(pool.filter((line) => line.trim() !== "")));
}

/**
 * Picks the chef's tap reaction from the trigger's own lines (said from the ladder in
 * the trigger's pose) plus any situational `extraReactions` (shelf-aware lines, each
 * with its own pose and spot). Same no-immediate-repeat rule as pickChefLine.
 */
export function pickChefTapReaction(params: {
  trigger: "tapServed" | "tapEmpty";
  strings: Pick<KitchenChefLocaleStrings, "generic" | "recipes">;
  servedRecipeSlugs?: readonly string[];
  extraReactions?: readonly ChefReaction[];
  lastLine?: string | null;
  random?: () => number;
}): ChefReaction | null {
  const { trigger, extraReactions = [], lastLine = null } = params;
  const random = params.random ?? Math.random;

  const seen = new Set<string>();
  const pool = [
    ...buildChefLinePool(params).map((line): ChefReaction => ({ line, pose: CHEF_POSE_FOR_TRIGGER[trigger], spot: "ladder" })),
    ...extraReactions,
  ].filter((reaction) => {
    if (reaction.line.trim() === "" || seen.has(reaction.line)) return false;
    seen.add(reaction.line);
    return true;
  });
  if (pool.length === 0) {
    return null;
  }

  const withoutLast = pool.length > 1 ? pool.filter((reaction) => reaction.line !== lastLine) : pool;
  const index = Math.min(Math.floor(random() * withoutLast.length), withoutLast.length - 1);
  return withoutLast[Math.max(index, 0)];
}

/** How many dishes of each food type sit on the shelf (countertop dishes don't count). */
export function countShelfDishesByFoodType(
  dishes: readonly Pick<ShopCookedDish, "recipeId" | "location">[],
  recipesById: ReadonlyMap<string, Pick<ShopRecipe, "foodType">>
): Record<ShopFoodType, number> {
  const counts = Object.fromEntries(SHOP_FOOD_TYPES.map((type) => [type, 0])) as Record<ShopFoodType, number>;
  for (const dish of dishes) {
    if (dish.location !== "shelf") continue;
    const foodType = recipesById.get(dish.recipeId)?.foodType;
    if (foodType) counts[foodType] += 1;
  }
  return counts;
}

/**
 * Plenty of one food type on the shelf and none of another: `have` is the most-stocked
 * type with at least CHEF_SHELF_PLENTY_COUNT dishes, `missing` the first empty type
 * (both ties broken by SHOP_FOOD_TYPES order). Null when there's no such gap.
 */
export function findShelfFoodTypeImbalance(
  counts: Readonly<Record<ShopFoodType, number>>
): { have: ShopFoodType; missing: ShopFoodType } | null {
  const missing = SHOP_FOOD_TYPES.find((type) => counts[type] === 0);
  const have = SHOP_FOOD_TYPES.filter((type) => counts[type] >= CHEF_SHELF_PLENTY_COUNT).sort(
    (a, b) => counts[b] - counts[a]
  )[0];
  return have && missing ? { have, missing } : null;
}

/**
 * The child's favorite recipe: the most-cooked one, once cooked at least
 * CHEF_FAVORITE_DISH_COUNT times. Counts every dish ever cooked (countertop and
 * shelf alike -- it's "how often have we made this", not "what's on display");
 * ties go to the earlier recipe on the wall. Null when nothing qualifies.
 */
export function findFavoriteRecipeId(
  dishes: readonly Pick<ShopCookedDish, "recipeId">[],
  recipesById: ReadonlyMap<string, Pick<ShopRecipe, "displayOrder">>
): string | null {
  const counts = new Map<string, number>();
  for (const dish of dishes) {
    if (recipesById.has(dish.recipeId)) counts.set(dish.recipeId, (counts.get(dish.recipeId) ?? 0) + 1);
  }
  const [favorite] = [...counts.entries()]
    .filter(([, count]) => count >= CHEF_FAVORITE_DISH_COUNT)
    .sort(
      ([a, countA], [b, countB]) =>
        countB - countA || (recipesById.get(a)?.displayOrder ?? 0) - (recipesById.get(b)?.displayOrder ?? 0)
    );
  return favorite ? favorite[0] : null;
}

/** What the shelf-aware lines need to know, computed by the kitchen from its loaded dishes. */
export type ChefShelfFacts = {
  shelfCountsByFoodType: Readonly<Record<ShopFoodType, number>>;
  /** Localized title of findFavoriteRecipeId's recipe, or null when there's no favorite. */
  favoriteDishTitle: string | null;
};

function fillChefTemplate(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((line, [token, value]) => line.split(`{${token}}`).join(value), template);
}

/** The shelf-aware reactions that currently apply -- extras for pickChefTapReaction. */
export function buildShelfChefReactions(
  facts: ChefShelfFacts,
  strings: Pick<KitchenChefLocaleStrings, "shelf">
): ChefReaction[] {
  const reactions: ChefReaction[] = [];
  const add = (id: ChefShelfLineId, tokens: Record<string, string>) => {
    reactions.push({ line: fillChefTemplate(strings.shelf.lines[id], tokens), ...CHEF_SHELF_LINE_STAGING[id] });
  };

  const imbalance = findShelfFoodTypeImbalance(facts.shelfCountsByFoodType);
  if (imbalance) {
    add("foodTypeImbalance", {
      have: strings.shelf.foodTypes[imbalance.have],
      missing: strings.shelf.foodTypes[imbalance.missing],
    });
  }

  if (facts.favoriteDishTitle) {
    add("favoriteAgain", { dish: facts.favoriteDishTitle });
    add("favoriteSpecialty", { dish: facts.favoriteDishTitle });
  }

  return reactions;
}

/**
 * Mystery foods that are unlocked but whose unlock the chef hasn't announced yet,
 * in wall order. A win happens during a quiz, not in the kitchen, so this is how the
 * unlock line reaches the child on their next visit.
 */
export function findUnseenMysteryUnlocks<T extends Pick<ShopRecipe, "id" | "isMystery" | "displayOrder">>(
  recipes: readonly T[],
  unlockedRecipeIds: ReadonlySet<string>,
  seenRecipeIds: ReadonlySet<string>
): T[] {
  return recipes
    .filter((recipe) => recipe.isMystery && unlockedRecipeIds.has(recipe.id) && !seenRecipeIds.has(recipe.id))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Reads the persisted "already announced" ids; anything malformed means "none seen". */
export function parseSeenUnlockIds(raw: string | null): Set<string> {
  if (!raw) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function serializeSeenUnlockIds(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort());
}

/** Tap cooldown: true when enough time has passed since the last tap-triggered line. */
export function canChefRespondToTap(now: number, lastTapAt: number | null, cooldownMs: number): boolean {
  return lastTapAt === null || now - lastTapAt >= cooldownMs;
}
