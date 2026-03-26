import type {
  DebugShopRewardIconAuditItem,
  DebugShopRewardRecipeOption,
  DebugShopRewardIconAuditUnusedItem,
  DebugShopRewardIconAuditResponse,
} from "./debug.types";
import type { ShopLocalizedValue, ShopVariantIconRule } from "./shop.types";
import { resolvePublicAssetFilePath } from "./shopIngredientIconAudit";

type ShopRewardIconExists = (filePath: string) => Promise<boolean>;

export type ShopRewardIconAuditRecipe = {
  id: string;
  slug: string;
  title: ShopLocalizedValue<string>;
  variantIconRules: ShopVariantIconRule[];
};

export function normalizeShopRewardIconPath(iconPath: string): string {
  return iconPath.trim();
}

export function normalizeShopRewardMatchInput(matchInput: string): string[] {
  return Array.from(
    new Set(
      matchInput
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function updateShopRewardIconRule(
  variantIconRules: ShopVariantIconRule[],
  ruleIndex: number,
  nextIconPath: string
): ShopVariantIconRule[] {
  if (!Number.isInteger(ruleIndex) || ruleIndex < 0 || ruleIndex >= variantIconRules.length) {
    throw new Error("Reward icon rule not found.");
  }

  const normalizedIconPath = normalizeShopRewardIconPath(nextIconPath);
  if (!normalizedIconPath.startsWith("/rewards/") || !normalizedIconPath.endsWith(".png")) {
    throw new Error('Reward icon path must start with "/rewards/" and end with ".png".');
  }

  return variantIconRules.map((rule, currentIndex) =>
    currentIndex === ruleIndex ? { ...rule, iconPath: normalizedIconPath } : rule
  );
}

export function deleteShopRewardIconRule(
  variantIconRules: ShopVariantIconRule[],
  ruleIndex: number
): ShopVariantIconRule[] {
  if (!Number.isInteger(ruleIndex) || ruleIndex < 0 || ruleIndex >= variantIconRules.length) {
    throw new Error("Reward icon rule not found.");
  }

  return variantIconRules.filter((_, currentIndex) => currentIndex !== ruleIndex);
}

export function createShopRewardIconRule(
  variantIconRules: ShopVariantIconRule[],
  iconPath: string,
  matchInput: string
): ShopVariantIconRule[] {
  const normalizedIconPath = normalizeShopRewardIconPath(iconPath);
  if (!normalizedIconPath.startsWith("/rewards/") || !normalizedIconPath.endsWith(".png")) {
    throw new Error('Reward icon path must start with "/rewards/" and end with ".png".');
  }

  const normalizedMatch = normalizeShopRewardMatchInput(matchInput);
  const matchSignature = normalizedMatch.join("|");
  const hasDuplicateMatch = variantIconRules.some(
    (rule) => normalizeShopRewardMatchInput(rule.match.join(",")).join("|") === matchSignature
  );
  if (hasDuplicateMatch) {
    throw new Error("A reward icon rule with the same match already exists for this recipe.");
  }

  return [
    ...variantIconRules,
    {
      match: normalizedMatch,
      iconPath: normalizedIconPath,
    },
  ];
}

export async function auditShopRewardIcons(
  recipes: ShopRewardIconAuditRecipe[],
  iconExists: ShopRewardIconExists,
  availableIconPaths: string[] = [],
  recipeOptions: DebugShopRewardRecipeOption[] = []
): Promise<DebugShopRewardIconAuditResponse> {
  const items: DebugShopRewardIconAuditItem[] = [];

  for (const recipe of recipes) {
    for (const [ruleIndex, rule] of recipe.variantIconRules.entries()) {
      const filePath = resolvePublicAssetFilePath(rule.iconPath);
      const exists = filePath ? await iconExists(filePath) : null;

      items.push({
        recipeId: recipe.id,
        recipeSlug: recipe.slug,
        recipeTitle: recipe.title,
        ruleIndex,
        match: [...rule.match],
        iconPath: rule.iconPath,
        filePath,
        exists,
      });
    }
  }

  const referencedIconPaths = new Set(items.map((item) => normalizeShopRewardIconPath(item.iconPath)));
  const unreferencedItems: DebugShopRewardIconAuditUnusedItem[] = availableIconPaths
    .filter((iconPath) => !referencedIconPaths.has(normalizeShopRewardIconPath(iconPath)))
    .map((iconPath) => ({
      iconPath,
      filePath: resolvePublicAssetFilePath(iconPath),
    }));

  return {
    checkedAt: Date.now(),
    availableIconPaths: [...availableIconPaths],
    unreferencedItems,
    recipeOptions: [...recipeOptions],
    items,
    missingItems: items.filter((item) => item.filePath === null || item.exists === false),
  };
}
