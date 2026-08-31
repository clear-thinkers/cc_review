import type {
  ShopIngredient,
  ShopIngredientPrice,
  ShopLocale,
  ShopLocalizedValue,
  ShopRecipe,
  ShopVariantIconRule,
  UnlockShopRecipeResult,
  RedeemCoinsResult,
  RedeemCoinsErrorCode,
  ShopCookMethod,
  ShopFoodType,
  ShopIngredientLedgerEntry,
  ShopCookReadiness,
  ShopDishLocation,
  CookShopRecipeResult,
  CookShopRecipeErrorCode,
  OrganizeKitchenCountertopResult,
  OrganizeKitchenCountertopErrorCode,
  PurchaseShopIngredientResult,
  PurchaseShopIngredientErrorCode,
} from "./shop.types";
import {
  canonicalizeShopIngredientKey,
  findShopIngredientCatalogEntryByAlias,
  getShopIngredientCatalogEntry,
  type ShopIngredientCatalogEntry,
} from "./shopIngredients";

export const SHOP_WALL_SIZE = 11;
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
      titleI18n: normalizeShopLocalizedStringValue(source?.titleI18n, ""),
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

export function canAffordIngredientPurchase(
  totalCoins: number,
  costCoinsPerUnit: number,
  quantity: number
): boolean {
  return totalCoins >= costCoinsPerUnit * quantity;
}

/**
 * Finds the variant rule that best matches a set of active special
 * ingredient keys -- subset-match, preferring the most specific (longest
 * `match`) rule; a rule with `match: []` always matches (vacuously, as a
 * subset of anything), so it naturally serves as the "nothing more specific
 * matched" fallback with no separate branch needed. Both the resolved icon
 * and the resolved display name (resolveShopRecipeIconPath /
 * resolveShopRecipeVariantTitle) are read off the SAME matched rule via this
 * one function, so they can never disagree about which variant was picked.
 */
export function resolveShopRecipeVariant(
  variantIconRules: ShopVariantIconRule[],
  activeSpecialIngredientKeys: string[]
): ShopVariantIconRule | null {
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

  return bestRule;
}

export function resolveShopRecipeIconPath(
  variantIconRules: ShopVariantIconRule[],
  activeSpecialIngredientKeys: string[]
): string | null {
  return resolveShopRecipeVariant(variantIconRules, activeSpecialIngredientKeys)?.iconPath ?? null;
}

/**
 * The display name for a specific special-ingredient combination, e.g.
 * "黑糖奶茶" for a milk tea recipe cooked with brown sugar -- read from the
 * SAME matched rule resolveShopRecipeIconPath would use (see
 * resolveShopRecipeVariant). Falls back to `fallbackTitle` (typically the
 * recipe's own localized title) when no rule matches, or the matched rule
 * has no title override for either locale.
 */
export function resolveShopRecipeVariantTitle(
  variantIconRules: ShopVariantIconRule[],
  activeSpecialIngredientKeys: string[],
  locale: ShopLocale,
  fallbackTitle: string
): string {
  const matchedRule = resolveShopRecipeVariant(variantIconRules, activeSpecialIngredientKeys);
  if (!matchedRule?.titleI18n) {
    return fallbackTitle;
  }
  return resolveShopLocalizedString(matchedRule.titleI18n, locale, fallbackTitle);
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

/**
 * Resolves an ingredient's display label for the given locale from a
 * shop_ingredient_prices record, falling back to `fallback` (e.g. the raw
 * ingredient key) when the record is missing or has no labelI18n at all --
 * distinct from resolveShopLocalizedString, which requires labelI18n to
 * already be present.
 */
export function resolveShopIngredientLabel(
  record: ShopIngredientPrice | undefined,
  locale: ShopLocale,
  fallback: string
): string {
  return record?.labelI18n
    ? resolveShopLocalizedString(record.labelI18n, locale, fallback)
    : fallback;
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

type RedeemCoinsRpcResult = {
  success?: boolean;
  code?: string;
  coinsRedeemed?: number;
  dollarValue?: number | string;
  remainingCoins?: number;
};

export function normalizeRedeemCoinsResult(raw: unknown): RedeemCoinsResult {
  const source =
    raw && typeof raw === "object" ? (raw as RedeemCoinsRpcResult) : {};

  if (source.success === true) {
    return {
      success: true,
      code: "redeemed",
      coinsRedeemed: typeof source.coinsRedeemed === "number" ? source.coinsRedeemed : 0,
      dollarValue:
        typeof source.dollarValue === "number"
          ? source.dollarValue
          : typeof source.dollarValue === "string"
            ? parseFloat(source.dollarValue)
            : 0,
      remainingCoins: typeof source.remainingCoins === "number" ? source.remainingCoins : 0,
    };
  }

  const validCodes: RedeemCoinsErrorCode[] = [
    "forbidden",
    "invalid_amount",
    "invalid_note",
    "invalid_signature",
    "insufficient_coins",
  ];
  const code = source.code;
  const normalizedCode: RedeemCoinsErrorCode =
    validCodes.includes(code as RedeemCoinsErrorCode)
      ? (code as RedeemCoinsErrorCode)
      : "unknown";

  return {
    success: false,
    code: normalizedCode,
    ...(typeof source.remainingCoins === "number"
      ? { remainingCoins: source.remainingCoins }
      : {}),
  };
}

// ─── Shop Kitchen (feature spec 2026-08-23-kitchen-page.md) ────────────────

const SHOP_COOK_METHODS: readonly ShopCookMethod[] = ["stove", "oven"];

export function normalizeShopCookMethod(raw: unknown): ShopCookMethod | null {
  return typeof raw === "string" && (SHOP_COOK_METHODS as readonly string[]).includes(raw)
    ? (raw as ShopCookMethod)
    : null;
}

export function normalizeShopFoodType(raw: unknown): ShopFoodType | null {
  return raw === "drinks" || raw === "hotmeal" || raw === "desserts" ? raw : null;
}

/**
 * A child's available count of ingredient X is
 * count(shop_ingredient_rewards where key = X) - count(shop_ingredient_consumptions
 * where key = X) -- computed here client-side rather than as a running-balance
 * column, matching this codebase's existing preference for client-side
 * aggregation over readiness/availability questions.
 */
export function buildShopIngredientAvailabilityMap(
  rewards: ShopIngredientLedgerEntry[],
  consumptions: ShopIngredientLedgerEntry[]
): Map<string, number> {
  const availability = new Map<string, number>();

  for (const reward of rewards) {
    const key = canonicalizeShopIngredientKey(reward.ingredientKey);
    if (!key) continue;
    availability.set(key, (availability.get(key) ?? 0) + 1);
  }

  for (const consumption of consumptions) {
    const key = canonicalizeShopIngredientKey(consumption.ingredientKey);
    if (!key) continue;
    availability.set(key, (availability.get(key) ?? 0) - 1);
  }

  return availability;
}

/**
 * Cook-readiness for one recipe against the caller's current available
 * ingredients -- a different question from item F's proposed (unbuilt)
 * computeRecipeReadiness, which is about purchase completion, not spendable
 * availability. Ingredient rows with no resolvable ingredientKey are skipped,
 * same skip-invalid-silently precedent as reward_random_ingredients.
 */
export function computeShopCookReadiness(
  recipe: Pick<ShopRecipe, "baseIngredients">,
  availabilityByKey: ReadonlyMap<string, number>
): ShopCookReadiness {
  const requiredByKey = new Map<string, number>();

  for (const ingredient of recipe.baseIngredients) {
    const key = canonicalizeShopIngredientKey(ingredient.ingredientKey);
    if (!key) continue;
    requiredByKey.set(key, (requiredByKey.get(key) ?? 0) + ingredient.quantity);
  }

  const missingIngredientKeys: string[] = [];
  for (const [key, requiredQty] of requiredByKey) {
    if ((availabilityByKey.get(key) ?? 0) < requiredQty) {
      missingIngredientKeys.push(key);
    }
  }

  return {
    isReady: requiredByKey.size > 0 && missingIngredientKeys.length === 0,
    missingIngredientKeys,
  };
}

type CookShopRecipeRpcResult = {
  success?: boolean;
  code?: string;
  dishId?: string;
  recipeId?: string;
  location?: string;
  missingIngredientKeys?: unknown;
  specialIngredientKeys?: unknown;
};

function normalizeShopDishLocation(raw: unknown): ShopDishLocation {
  return raw === "shelf" ? "shelf" : "countertop";
}

/** A dish's recorded special_ingredient_keys (jsonb array of ingredient keys) -- from either a cook_shop_recipe RPC response or a shop_cooked_dishes row. Non-string entries are dropped rather than erroring. */
export function normalizeShopSpecialIngredientKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((key): key is string => typeof key === "string")
    .map((key) => canonicalizeShopIngredientKey(key))
    .filter(Boolean);
}

export function normalizeCookShopRecipeResult(raw: unknown): CookShopRecipeResult {
  const source = raw && typeof raw === "object" ? (raw as CookShopRecipeRpcResult) : {};

  if (source.success === true && typeof source.dishId === "string" && typeof source.recipeId === "string") {
    return {
      success: true,
      code: "cooked",
      dishId: source.dishId,
      recipeId: source.recipeId,
      location: normalizeShopDishLocation(source.location),
      specialIngredientKeys: normalizeShopSpecialIngredientKeys(source.specialIngredientKeys),
    };
  }

  const validCodes: CookShopRecipeErrorCode[] = [
    "forbidden",
    "recipe_not_cookable",
    "recipe_not_unlocked",
    "countertop_full",
    "insufficient_ingredients",
  ];
  const code = source.code;
  const normalizedCode: CookShopRecipeErrorCode = validCodes.includes(
    code as CookShopRecipeErrorCode
  )
    ? (code as CookShopRecipeErrorCode)
    : "unknown";

  return {
    success: false,
    code: normalizedCode,
    missingIngredientKeys: Array.isArray(source.missingIngredientKeys)
      ? source.missingIngredientKeys.filter((key): key is string => typeof key === "string")
      : [],
  };
}

type PurchaseShopIngredientRpcResult = {
  success?: boolean;
  code?: string;
  recipeId?: string | null;
  ingredientKey?: string | null;
  remainingCoins?: number | null;
  coinsSpent?: number;
  quantity?: number;
};

export function normalizePurchaseShopIngredientResult(raw: unknown): PurchaseShopIngredientResult {
  const source = raw && typeof raw === "object" ? (raw as PurchaseShopIngredientRpcResult) : {};

  if (
    source.success === true &&
    typeof source.recipeId === "string" &&
    typeof source.ingredientKey === "string"
  ) {
    return {
      success: true,
      code: "purchased",
      recipeId: source.recipeId,
      ingredientKey: source.ingredientKey,
      remainingCoins: typeof source.remainingCoins === "number" ? source.remainingCoins : 0,
      coinsSpent: typeof source.coinsSpent === "number" ? source.coinsSpent : 0,
      quantity: typeof source.quantity === "number" ? source.quantity : 0,
    };
  }

  const validCodes: PurchaseShopIngredientErrorCode[] = [
    "forbidden",
    "invalid_quantity",
    "ingredient_not_available",
    "recipe_not_available",
    "recipe_not_unlocked",
    "insufficient_coins",
  ];
  const code = source.code;
  const normalizedCode: PurchaseShopIngredientErrorCode = validCodes.includes(
    code as PurchaseShopIngredientErrorCode
  )
    ? (code as PurchaseShopIngredientErrorCode)
    : "unknown";

  return {
    success: false,
    code: normalizedCode,
    recipeId: typeof source.recipeId === "string" ? source.recipeId : null,
    ingredientKey: typeof source.ingredientKey === "string" ? source.ingredientKey : null,
    remainingCoins: typeof source.remainingCoins === "number" ? source.remainingCoins : null,
    coinsSpent: typeof source.coinsSpent === "number" ? source.coinsSpent : 0,
  };
}

type OrganizeKitchenCountertopRpcResult = {
  success?: boolean;
  code?: string;
  movedCount?: number;
};

export function normalizeOrganizeKitchenCountertopResult(
  raw: unknown
): OrganizeKitchenCountertopResult {
  const source = raw && typeof raw === "object" ? (raw as OrganizeKitchenCountertopRpcResult) : {};

  if (source.success === true) {
    return {
      success: true,
      code: "organized",
      movedCount: typeof source.movedCount === "number" ? source.movedCount : 0,
    };
  }

  const validCodes: OrganizeKitchenCountertopErrorCode[] = ["forbidden"];
  const code = source.code;
  const normalizedCode: OrganizeKitchenCountertopErrorCode = validCodes.includes(
    code as OrganizeKitchenCountertopErrorCode
  )
    ? (code as OrganizeKitchenCountertopErrorCode)
    : "unknown";

  return { success: false, code: normalizedCode };
}
