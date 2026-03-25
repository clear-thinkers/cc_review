import type { ShopLocalizedValue } from "../shop/shop.types";

export type DebugToolResultTone = "success" | "error";

export type DebugToolMessage = {
  tone: DebugToolResultTone;
  text: string;
};

export type DebugErrorResponse = {
  error?: string;
};

export type DebugShopIngredientIconAuditItem = {
  key: string;
  label: ShopLocalizedValue<string>;
  iconPath: string | null;
  filePath: string | null;
  exists: boolean | null;
};

export type DebugShopIngredientIconAuditResponse = {
  checkedAt: number;
  items: DebugShopIngredientIconAuditItem[];
  missingItems: DebugShopIngredientIconAuditItem[];
};

export type DebugShopRewardIconAuditItem = {
  recipeId: string;
  recipeSlug: string;
  recipeTitle: ShopLocalizedValue<string>;
  ruleIndex: number;
  match: string[];
  iconPath: string;
  filePath: string | null;
  exists: boolean | null;
};

export type DebugShopRewardIconAuditUnusedItem = {
  iconPath: string;
  filePath: string | null;
};

export type DebugShopRewardRecipeOption = {
  recipeId: string;
  recipeSlug: string;
  recipeTitle: ShopLocalizedValue<string>;
};

export type DebugShopRewardIconAuditResponse = {
  checkedAt: number;
  availableIconPaths: string[];
  unreferencedItems: DebugShopRewardIconAuditUnusedItem[];
  recipeOptions: DebugShopRewardRecipeOption[];
  items: DebugShopRewardIconAuditItem[];
  missingItems: DebugShopRewardIconAuditItem[];
};
