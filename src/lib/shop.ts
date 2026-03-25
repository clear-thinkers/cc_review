import type {
  ShopIngredient,
  ShopIngredientPrice,
  ShopLocale,
  ShopLocalizedValue,
  ShopRecipe,
  ShopSpecialIngredientSlot,
  ShopVariantIconRule,
  UnlockShopRecipeResult,
} from "@/app/words/shop/shop.types";
import {
  findShopIngredientCatalogEntryByAlias,
  getShopIngredientCatalogEntry,
  type ShopIngredientCatalogEntry,
} from "@/app/words/shop/shopIngredients";

export const SHOP_WALL_SIZE = 9;
const SHOP_PLAIN_ICON_TOKEN = "plain";
const SHOP_LOCALES: ShopLocale[] = ["en", "zh"];

function normalizeMatchKeys(keys: string[]): string[] {
  return Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean))).sort();
}

export function canAffordRecipeUnlock(
  totalCoins: number,
  recipe: Pick<ShopRecipe, "unlockCostCoins">
): boolean {
  return totalCoins >= recipe.unlockCostCoins;
}

export function resolveShopRecipeIconPath(
  variantIconRules: ShopVariantIconRule[],
  activeSpecialIngredientKeys: string[]
): string | null {
  const activeKeys = normalizeMatchKeys(activeSpecialIngredientKeys);
  let bestRule: ShopVariantIconRule | null = null;

  for (const rule of variantIconRules) {
    const normalizedMatch = normalizeMatchKeys(rule.match);
    const isSubsetMatch = normalizedMatch.every((key) => activeKeys.includes(key));
    if (!isSubsetMatch) {
      continue;
    }

    if (!bestRule || normalizedMatch.length > normalizeMatchKeys(bestRule.match).length) {
      bestRule = {
        ...rule,
        match: normalizedMatch,
      };
    }
  }

  return bestRule?.iconPath ?? null;
}

function isPlainShopIconPath(iconPath: string): boolean {
  const normalizedPath = iconPath.trim().toLowerCase();
  if (!normalizedPath) {
    return false;
  }

  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  return fileName.includes(SHOP_PLAIN_ICON_TOKEN);
}

function normalizeShopIngredientList(
  raw: unknown,
  fallback: ShopIngredient[]
): ShopIngredient[] {
  if (!Array.isArray(raw)) {
    return fallback;
  }

  return raw.map((ingredient) => {
    const source =
      ingredient && typeof ingredient === "object"
        ? (ingredient as Record<string, unknown>)
        : {};
    const ingredientKey =
      typeof source.ingredientKey === "string" ? source.ingredientKey.trim() : "";
    const costCoins =
      typeof source.costCoins === "number" && Number.isFinite(source.costCoins)
        ? source.costCoins
        : undefined;
    const unit = typeof source.unit === "string" ? source.unit.trim() : "";
    return {
      ...(ingredientKey ? { ingredientKey } : {}),
      name: typeof source.name === "string" ? source.name.trim() : "",
      quantity: typeof source.quantity === "string" ? source.quantity.trim() : "",
      ...(unit ? { unit } : {}),
      ...(typeof costCoins === "number" ? { costCoins } : {}),
    };
  });
}

function normalizeShopSpecialIngredientSlotList(
  raw: unknown,
  fallback: ShopSpecialIngredientSlot[]
): ShopSpecialIngredientSlot[] {
  return Array.isArray(raw) ? (raw as ShopSpecialIngredientSlot[]) : fallback;
}

function normalizeShopLocalizedStringValue(
  raw: unknown,
  fallback: string
): ShopLocalizedValue<string> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const en = typeof source.en === "string" ? source.en : fallback;
  const zh = typeof source.zh === "string" ? source.zh : en;
  return { en, zh };
}

function normalizeShopLocalizedListValue<T>(
  raw: unknown,
  fallback: T[],
  parseList: (rawValue: unknown, fallbackValue: T[]) => T[]
): ShopLocalizedValue<T[]> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const en = parseList(source.en, fallback);
  const zh = parseList(source.zh, en);
  return { en, zh };
}

export function normalizeShopLocalizedTitle(
  raw: unknown,
  fallback: string
): ShopLocalizedValue<string> {
  return normalizeShopLocalizedStringValue(raw, fallback);
}

export function normalizeShopLocalizedIntro(
  raw: unknown,
  fallback: string
): ShopLocalizedValue<string> {
  return normalizeShopLocalizedStringValue(raw, fallback);
}

export function normalizeShopLocalizedIngredients(
  raw: unknown,
  fallback: ShopIngredient[]
): ShopLocalizedValue<ShopIngredient[]> {
  return normalizeShopLocalizedListValue(raw, fallback, normalizeShopIngredientList);
}

export function normalizeShopLocalizedSpecialIngredientSlots(
  raw: unknown,
  fallback: ShopSpecialIngredientSlot[]
): ShopLocalizedValue<ShopSpecialIngredientSlot[]> {
  return normalizeShopLocalizedListValue(
    raw,
    fallback,
    normalizeShopSpecialIngredientSlotList
  );
}

export function resolveShopLocalizedString(
  localized: ShopLocalizedValue<string>,
  locale: ShopLocale,
  fallback: string
): string {
  const preferred = localized[locale].trim();
  if (preferred) {
    return preferred;
  }
  const english = localized.en.trim();
  if (english) {
    return english;
  }
  return fallback;
}

export function resolveShopLocalizedList<T>(
  localized: ShopLocalizedValue<T[]>,
  locale: ShopLocale,
  fallback: T[]
): T[] {
  const preferred = localized[locale];
  if (preferred.length > 0) {
    return preferred;
  }
  if (localized.en.length > 0) {
    return localized.en;
  }
  return fallback;
}

export function getShopRecipeContentForLocale(
  recipe: ShopRecipe,
  locale: ShopLocale
): {
  title: string;
  intro: string;
  baseIngredients: ShopIngredient[];
  specialIngredientSlots: ShopSpecialIngredientSlot[];
} {
  return {
    title: resolveShopLocalizedString(recipe.titleI18n, locale, recipe.title),
    intro: resolveShopLocalizedString(recipe.introI18n, locale, recipe.intro),
    baseIngredients: resolveShopLocalizedList(
      recipe.baseIngredientsI18n,
      locale,
      recipe.baseIngredients
    ),
    specialIngredientSlots: resolveShopLocalizedList(
      recipe.specialIngredientSlotsI18n,
      locale,
      recipe.specialIngredientSlots
    ),
  };
}

export function resolvePlainShopRecipeIconPath(
  variantIconRules: ShopVariantIconRule[]
): string | null {
  const plainRules = variantIconRules
    .filter((rule) => isPlainShopIconPath(rule.iconPath))
    .sort((left, right) => normalizeMatchKeys(left.match).length - normalizeMatchKeys(right.match).length);

  return plainRules[0]?.iconPath ?? null;
}

export function resolveShopIngredientCatalogEntry(
  ingredient: ShopIngredient
): ShopIngredientCatalogEntry | null {
  return (
    getShopIngredientCatalogEntry(ingredient.ingredientKey) ??
    findShopIngredientCatalogEntryByAlias(ingredient.name)
  );
}

export function resolveShopIngredientIconPath(ingredient: ShopIngredient): string | null {
  return resolveShopIngredientCatalogEntry(ingredient)?.iconPath ?? null;
}

export function buildShopIngredientPriceMap(
  prices: ShopIngredientPrice[]
): ReadonlyMap<string, number> {
  return new Map(prices.map((price) => [price.ingredientKey, price.costCoins] as const));
}

export function resolveShopIngredientCost(
  ingredient: ShopIngredient,
  priceByKey?: ReadonlyMap<string, number>
): number | null {
  const catalogEntry = resolveShopIngredientCatalogEntry(ingredient);
  if (catalogEntry) {
    return priceByKey?.get(catalogEntry.key) ?? catalogEntry.defaultCostCoins;
  }
  if (typeof ingredient.costCoins === "number" && Number.isFinite(ingredient.costCoins)) {
    return ingredient.costCoins;
  }
  return null;
}

type UnlockShopRecipeRpcResult = {
  success?: boolean;
  code?: string;
  recipeId?: string | null;
  remainingCoins?: number | null;
  coinsSpent?: number;
  message?: string;
};

export function normalizeUnlockShopRecipeResult(raw: unknown): UnlockShopRecipeResult {
  const source =
    raw && typeof raw === "object" ? (raw as UnlockShopRecipeRpcResult) : {};

  if (source.success === true && typeof source.recipeId === "string") {
    return {
      success: true,
      code: "unlocked",
      recipeId: source.recipeId,
      remainingCoins: typeof source.remainingCoins === "number" ? source.remainingCoins : 0,
      coinsSpent: typeof source.coinsSpent === "number" ? source.coinsSpent : 0,
    };
  }

  const code = source.code;
  const normalizedCode =
    code === "already_unlocked" ||
    code === "insufficient_coins" ||
    code === "plain_icon_missing" ||
    code === "recipe_not_available" ||
    code === "forbidden"
      ? code
      : "unknown";

  return {
    success: false,
    code: normalizedCode,
    recipeId: typeof source.recipeId === "string" ? source.recipeId : null,
    remainingCoins:
      typeof source.remainingCoins === "number" ? source.remainingCoins : null,
    coinsSpent: typeof source.coinsSpent === "number" ? source.coinsSpent : 0,
    ...(typeof source.message === "string" ? { message: source.message } : {}),
  };
}
