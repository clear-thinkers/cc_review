import type {
  ShopRecipe,
  ShopVariantIconRule,
  UnlockShopRecipeResult,
} from "@/app/words/shop/shop.types";

export const SHOP_WALL_SIZE = 9;

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
