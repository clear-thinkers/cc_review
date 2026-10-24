import type { ShopRecipe } from "@/lib/shop.types";
import type { ChefTrigger, KitchenChefLocaleStrings } from "./kitchenChef.types";

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
  const { trigger, strings, recipeSlug, servedRecipeSlugs = [], lastLine = null } = params;
  const random = params.random ?? Math.random;

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

  pool = Array.from(new Set(pool.filter((line) => line.trim() !== "")));
  if (pool.length === 0) {
    return null;
  }

  const withoutLast = pool.length > 1 ? pool.filter((line) => line !== lastLine) : pool;
  const index = Math.min(Math.floor(random() * withoutLast.length), withoutLast.length - 1);
  return withoutLast[Math.max(index, 0)];
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
