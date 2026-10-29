/**
 * Pure helpers for the debug page's ingredient-quantity editor
 * (`/api/debug/shop-ingredient-quantities`, Debug Tools Rule 6). The route sets a
 * platform admin's OWN spendable count of an ingredient by appending to the
 * existing ledgers -- never deleting -- so the kitchen's availability math
 * (rewards + purchases - consumptions) needs no special case.
 *
 * Last updated: 2026-10-29 (bulk "add N to every shown ingredient")
 */
import type { DebugShopIngredientQuantityItem } from "./debug.types";
import { buildShopIngredientAvailabilityMap, SHOP_INGREDIENT_QUANTITY_MAX } from "./shop";
import type { ShopIngredient, ShopIngredientLedgerEntry, ShopLocalizedValue } from "./shop.types";
import { canonicalizeShopIngredientKey } from "./shopIngredients";

/** A whole number from 0 to SHOP_INGREDIENT_QUANTITY_MAX, or null when the input isn't one. */
export function normalizeDebugIngredientTargetQuantity(raw: unknown): number | null {
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 0 && value <= SHOP_INGREDIENT_QUANTITY_MAX ? value : null;
}

/** How many ledger rows reach `target` from `current`: free purchase rows to add, or consumption rows to remove. */
export function planDebugIngredientQuantityChange(
  current: number,
  target: number
): { add: number; remove: number } {
  return target >= current ? { add: target - current, remove: 0 } : { add: 0, remove: current - target };
}

/** The bulk amount: a whole number from 1 to SHOP_INGREDIENT_QUANTITY_MAX, or null. */
export function normalizeDebugBulkAddAmount(raw: unknown): number | null {
  const amount = normalizeDebugIngredientTargetQuantity(raw);
  return amount !== null && amount > 0 ? amount : null;
}

/**
 * "Add N to every shown ingredient": one free-purchase count per requested key, each
 * capped so the ingredient never passes SHOP_INGREDIENT_QUANTITY_MAX (the single
 * editor's ceiling). Unknown keys and already-full ingredients are left out.
 */
export function planDebugBulkIngredientAdd(
  items: readonly Pick<DebugShopIngredientQuantityItem, "key" | "quantity">[],
  keys: readonly string[],
  amount: number
): Array<{ key: string; add: number }> {
  const wanted = new Set(keys.map((key) => canonicalizeShopIngredientKey(key)));
  return items
    .filter((item) => wanted.has(item.key))
    .map((item) => ({ key: item.key, add: Math.max(Math.min(amount, SHOP_INGREDIENT_QUANTITY_MAX - item.quantity), 0) }))
    .filter((change) => change.add > 0);
}

export type DebugQuantityRecipe = {
  id: string;
  slug: string;
  isActive: boolean;
  isMystery: boolean;
  baseIngredients: ShopIngredient[];
  specialIngredients: ShopIngredient[];
};

function recipeUsesIngredient(recipe: DebugQuantityRecipe, key: string): boolean {
  return [...recipe.baseIngredients, ...recipe.specialIngredients].some(
    (ingredient) => canonicalizeShopIngredientKey(ingredient.ingredientKey) === key
  );
}

/**
 * A recipe to attribute a debug purchase row to (`shop_ingredient_purchases.recipe_id`
 * is required) -- the first one using the ingredient, active ones first.
 */
export function findRecipeIdUsingIngredient(recipes: readonly DebugQuantityRecipe[], key: string): string | null {
  const using = recipes.filter((recipe) => recipeUsesIngredient(recipe, key));
  return (using.find((recipe) => recipe.isActive) ?? using[0])?.id ?? null;
}

/** Active mystery foods that use this ingredient -- the ones a raise might complete. */
export function findMysteryRecipesUsingIngredient(
  recipes: readonly DebugQuantityRecipe[],
  key: string
): DebugQuantityRecipe[] {
  return recipes.filter((recipe) => recipe.isActive && recipe.isMystery && recipeUsesIngredient(recipe, key));
}

export type DebugQuantityPriceRow = {
  ingredientKey: string;
  label: ShopLocalizedValue<string>;
  iconPath: string | null;
  isMystery: boolean;
};

/** One row per catalog ingredient with the caller's spendable count, mystery ingredients first, then by key. */
export function buildDebugIngredientQuantityItems(
  priceRows: readonly DebugQuantityPriceRow[],
  ledgers: {
    rewardKeys: readonly string[];
    purchaseKeys: readonly string[];
    consumptionKeys: readonly string[];
  }
): DebugShopIngredientQuantityItem[] {
  const toEntries = (keys: readonly string[]): ShopIngredientLedgerEntry[] =>
    keys.map((ingredientKey) => ({ ingredientKey }));
  const availability = buildShopIngredientAvailabilityMap(
    toEntries([...ledgers.rewardKeys, ...ledgers.purchaseKeys]),
    toEntries(ledgers.consumptionKeys)
  );

  return priceRows
    .map((row) => {
      const key = canonicalizeShopIngredientKey(row.ingredientKey);
      return {
        key,
        label: row.label,
        iconPath: row.iconPath,
        isMystery: row.isMystery,
        quantity: availability.get(key) ?? 0,
      };
    })
    .sort((left, right) =>
      left.isMystery === right.isMystery ? left.key.localeCompare(right.key) : left.isMystery ? -1 : 1
    );
}

/** The catalog row's own label, falling back to the key when a locale is blank. */
export function normalizeDebugIngredientLabel(raw: unknown, key: string): ShopLocalizedValue<string> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const read = (locale: "en" | "zh") =>
    typeof source[locale] === "string" && (source[locale] as string).trim() !== ""
      ? (source[locale] as string).trim()
      : key;
  return { en: read("en"), zh: read("zh") };
}
