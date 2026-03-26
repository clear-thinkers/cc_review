import type {
  ShopIngredient,
  ShopIngredientPrice,
  ShopLocale,
  ShopLocalizedValue,
  ShopRecipe,
  ShopVariantIconRule,
  UnlockShopRecipeResult,
} from "./shop.types";
import {
  canonicalizeShopIngredientKey,
  findShopIngredientCatalogEntryByAlias,
  getShopIngredientCatalogEntry,
  type ShopIngredientCatalogEntry,
} from "./shopIngredients";

export const SHOP_WALL_SIZE = 9;
export const SHOP_INGREDIENT_QUANTITY_MIN = 1;
export const SHOP_INGREDIENT_QUANTITY_MAX = 99;
const SHOP_PLAIN_ICON_TOKEN = "plain";

export function normalizeShopVariantMatchKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .map((key) => (typeof key === "string" ? canonicalizeShopIngredientKey(key) : ""))
        .filter(Boolean)
    )
  ).sort();
}

export function normalizeShopVariantIconRules(raw: unknown): ShopVariantIconRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.reduce<ShopVariantIconRule[]>((result, rule) => {
    const source = rule && typeof rule === "object" ? (rule as Record<string, unknown>) : null;
    const iconPath =
      typeof source?.iconPath === "string"
        ? source.iconPath.trim()
        : typeof source?.path === "string"
          ? source.path.trim()
          : "";

    if (!iconPath) {
      return result;
    }

    result.push({
      iconPath,
      match: normalizeShopVariantMatchKeys(source?.match),
    });
    return result;
  }, []);
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
  const activeKeys = normalizeShopVariantMatchKeys(activeSpecialIngredientKeys);
  let bestRule: ShopVariantIconRule | null = null;

  for (const rule of normalizeShopVariantIconRules(variantIconRules)) {
    const normalizedMatch = rule.match;
    const isSubsetMatch = normalizedMatch.every((key) => activeKeys.includes(key));
    if (!isSubsetMatch) {
      continue;
    }

    if (!bestRule || normalizedMatch.length > bestRule.match.length) {
      bestRule = rule;
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

export function parseShopIngredientQuantity(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw >= SHOP_INGREDIENT_QUANTITY_MIN && raw <= SHOP_INGREDIENT_QUANTITY_MAX
      ? raw
      : null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return parsed >= SHOP_INGREDIENT_QUANTITY_MIN && parsed <= SHOP_INGREDIENT_QUANTITY_MAX
      ? parsed
      : null;
  }

  return null;
}

function normalizeShopIngredientQuantity(raw: unknown, fallback = SHOP_INGREDIENT_QUANTITY_MIN): number {
  return parseShopIngredientQuantity(raw) ?? fallback;
}

function normalizeShopIngredientRow(
  raw: unknown,
  fallback?: ShopIngredient
): ShopIngredient {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const ingredientKey = canonicalizeShopIngredientKey(
    typeof source.ingredientKey === "string"
      ? source.ingredientKey
      : typeof source.key === "string"
        ? source.key
        : ""
  );
  const costCoins =
    typeof source.costCoins === "number" && Number.isFinite(source.costCoins)
      ? source.costCoins
      : undefined;

  return {
    ...(ingredientKey ? { ingredientKey } : {}),
    name:
      typeof source.name === "string"
        ? source.name.trim()
        : typeof source.label === "string"
          ? source.label.trim()
          : fallback?.name ?? "",
    quantity: normalizeShopIngredientQuantity(
      source.quantity,
      fallback?.quantity ?? SHOP_INGREDIENT_QUANTITY_MIN
    ),
    ...(typeof costCoins === "number" ? { costCoins } : {}),
  };
}

export function normalizeShopIngredientList(
  raw: unknown,
  fallback: ShopIngredient[]
): ShopIngredient[] {
  if (!Array.isArray(raw)) {
    return fallback;
  }

  return raw.map((ingredient, index) => normalizeShopIngredientRow(ingredient, fallback[index]));
}

function toShopIngredientLabelFallback(key: string): string {
  if (!key) {
    return "";
  }

  return key
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function normalizeShopSpecialIngredientList(
  raw: unknown,
  fallback: ShopIngredient[]
): ShopIngredient[] {
  if (!Array.isArray(raw)) {
    return fallback;
  }

  const normalizedRows: ShopIngredient[] = [];
  let fallbackIndex = 0;

  for (const row of raw) {
    const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    if (!Array.isArray(source.options)) {
      normalizedRows.push(normalizeShopIngredientRow(row, fallback[fallbackIndex]));
      fallbackIndex += 1;
      continue;
    }

    for (const option of source.options) {
      const optionSource =
        option && typeof option === "object" ? (option as Record<string, unknown>) : {};
      const ingredientKey = canonicalizeShopIngredientKey(
        typeof optionSource.ingredientKey === "string"
          ? optionSource.ingredientKey
          : typeof optionSource.key === "string"
            ? optionSource.key
            : ""
      );
      const fallbackIngredient = fallback[fallbackIndex];
      normalizedRows.push({
        ...(ingredientKey ? { ingredientKey } : {}),
        name:
          typeof optionSource.name === "string"
            ? optionSource.name.trim()
            : typeof optionSource.label === "string"
              ? optionSource.label.trim()
              : fallbackIngredient?.name ?? toShopIngredientLabelFallback(ingredientKey),
        quantity: normalizeShopIngredientQuantity(
          optionSource.quantity,
          fallbackIngredient?.quantity ?? SHOP_INGREDIENT_QUANTITY_MIN
        ),
      });
      fallbackIndex += 1;
    }
  }

  return normalizedRows;
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

function realignLocalizedIngredientRows(
  localizedRows: ShopIngredient[],
  fallbackRows: ShopIngredient[]
): ShopIngredient[] {
  if (fallbackRows.length === 0) {
    return localizedRows;
  }

  if (localizedRows.length === 0) {
    return fallbackRows;
  }

  const rowsByKey = new Map<string, ShopIngredient>();
  const unkeyedRows: ShopIngredient[] = [];

  localizedRows.forEach((row) => {
    const ingredientKey = canonicalizeShopIngredientKey(row.ingredientKey);
    if (ingredientKey && !rowsByKey.has(ingredientKey)) {
      rowsByKey.set(ingredientKey, row);
      return;
    }

    unkeyedRows.push(row);
  });

  let nextUnkeyedIndex = 0;
  return fallbackRows.map((fallbackRow) => {
    const ingredientKey = canonicalizeShopIngredientKey(fallbackRow.ingredientKey);
    if (ingredientKey) {
      return rowsByKey.get(ingredientKey) ?? fallbackRow;
    }

    const localizedRow = unkeyedRows[nextUnkeyedIndex];
    nextUnkeyedIndex += 1;
    return localizedRow ?? fallbackRow;
  });
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
  const localized = normalizeShopLocalizedListValue(raw, fallback, normalizeShopIngredientList);
  const en = realignLocalizedIngredientRows(localized.en, fallback);
  return {
    en,
    zh: realignLocalizedIngredientRows(localized.zh, en),
  };
}

export function normalizeShopLocalizedSpecialIngredients(
  raw: unknown,
  fallback: ShopIngredient[]
): ShopLocalizedValue<ShopIngredient[]> {
  if (Array.isArray(raw)) {
    const en = realignLocalizedIngredientRows(
      normalizeShopSpecialIngredientList(raw, fallback),
      fallback
    );
    const zh = realignLocalizedIngredientRows(normalizeShopSpecialIngredientList(raw, en), en);
    return { en, zh };
  }

  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const en = realignLocalizedIngredientRows(
    normalizeShopSpecialIngredientList(source.en, fallback),
    fallback
  );
  const zh = realignLocalizedIngredientRows(normalizeShopSpecialIngredientList(source.zh, en), en);
  return { en, zh };
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
  specialIngredients: ShopIngredient[];
} {
  return {
    title: resolveShopLocalizedString(recipe.titleI18n, locale, recipe.title),
    intro: resolveShopLocalizedString(recipe.introI18n, locale, recipe.intro),
    baseIngredients: resolveShopLocalizedList(
      recipe.baseIngredientsI18n,
      locale,
      recipe.baseIngredients
    ),
    specialIngredients: resolveShopLocalizedList(
      recipe.specialIngredientsI18n,
      locale,
      recipe.specialIngredients
    ),
  };
}

export function resolvePlainShopRecipeIconPath(
  variantIconRules: ShopVariantIconRule[]
): string | null {
  const plainRules = normalizeShopVariantIconRules(variantIconRules)
    .filter((rule) => isPlainShopIconPath(rule.iconPath))
    .sort((left, right) => left.match.length - right.match.length);

  return plainRules[0]?.iconPath ?? null;
}

export function resolveShopIngredientCatalogEntry(
  ingredient: ShopIngredient,
  sharedIngredientsByKey?: ReadonlyMap<string, ShopIngredientPrice>
): ShopIngredientCatalogEntry | null {
  const ingredientKey = canonicalizeShopIngredientKey(ingredient.ingredientKey);
  const seededEntry = getShopIngredientCatalogEntry(ingredientKey);
  const sharedEntry = ingredientKey ? sharedIngredientsByKey?.get(ingredientKey) : undefined;

  if (sharedEntry && ingredientKey) {
    return {
      key: ingredientKey,
      label: sharedEntry.labelI18n ??
        seededEntry?.label ?? {
          en: ingredient.name,
          zh: ingredient.name,
        },
      defaultCostCoins: sharedEntry.costCoins,
      iconPath:
        typeof sharedEntry.iconPath === "string"
          ? sharedEntry.iconPath.trim() || null
          : seededEntry?.iconPath ?? null,
    };
  }

  return seededEntry ?? findShopIngredientCatalogEntryByAlias(ingredient.name);
}

export function resolveShopIngredientIconPath(
  ingredient: ShopIngredient,
  sharedIngredientsByKey?: ReadonlyMap<string, ShopIngredientPrice>
): string | null {
  return resolveShopIngredientCatalogEntry(ingredient, sharedIngredientsByKey)?.iconPath ?? null;
}

export function buildShopIngredientRecordMap(
  prices: ShopIngredientPrice[]
): ReadonlyMap<string, ShopIngredientPrice> {
  return new Map(
    prices.map((price) => [canonicalizeShopIngredientKey(price.ingredientKey), price] as const)
  );
}

export function buildShopIngredientPriceMap(
  prices: ShopIngredientPrice[]
): ReadonlyMap<string, number> {
  return new Map(
    prices.map((price) => [canonicalizeShopIngredientKey(price.ingredientKey), price.costCoins] as const)
  );
}

export function resolveShopIngredientCost(
  ingredient: ShopIngredient,
  priceByKey?: ReadonlyMap<string, number>,
  sharedIngredientsByKey?: ReadonlyMap<string, ShopIngredientPrice>
): number | null {
  const catalogEntry = resolveShopIngredientCatalogEntry(ingredient, sharedIngredientsByKey);
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
