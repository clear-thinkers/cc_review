export type ShopLocale = "en" | "zh";

export type ShopLocalizedValue<T> = {
  en: T;
  zh: T;
};

export type ShopIngredient = {
  ingredientKey?: string;
  name: string;
  quantity: number;
  costCoins?: number;
};

export type ShopSpecialIngredientOption = {
  key: string;
  label: string;
  effect: string;
};

export type ShopSpecialIngredientSlot = {
  slotKey: string;
  label: string;
  maxSelections: number;
  options: ShopSpecialIngredientOption[];
};

export type ShopVariantIconRule = {
  match: string[];
  iconPath: string;
};

export type ShopRecipe = {
  id: string;
  slug: string;
  title: string;
  titleI18n: ShopLocalizedValue<string>;
  displayOrder: number;
  isActive: boolean;
  intro: string;
  introI18n: ShopLocalizedValue<string>;
  unlockCostCoins: number;
  baseIngredients: ShopIngredient[];
  baseIngredientsI18n: ShopLocalizedValue<ShopIngredient[]>;
  specialIngredientSlots: ShopSpecialIngredientSlot[];
  specialIngredientSlotsI18n: ShopLocalizedValue<ShopSpecialIngredientSlot[]>;
  variantIconRules: ShopVariantIconRule[];
};

export type ShopRecipeUnlock = {
  userId: string;
  recipeId: string;
  coinsSpent: number;
  unlockedAt: number;
};

export type ShopIngredientPrice = {
  ingredientKey: string;
  costCoins: number;
  updatedAt: number;
};

export type ShopTransactionAction = "unlock_recipe";

export type ShopTransaction = {
  id: string;
  userId: string;
  recipeId: string | null;
  actionType: ShopTransactionAction;
  coinsSpent: number;
  beginningBalance: number;
  endingBalance: number;
  createdAt: number;
};

export type UnlockShopRecipeErrorCode =
  | "already_unlocked"
  | "insufficient_coins"
  | "plain_icon_missing"
  | "recipe_not_available"
  | "forbidden"
  | "unknown";

export type UnlockShopRecipeResult =
  | {
      success: true;
      code: "unlocked";
      recipeId: string;
      remainingCoins: number;
      coinsSpent: number;
    }
  | {
      success: false;
      code: UnlockShopRecipeErrorCode;
      recipeId: string | null;
      remainingCoins: number | null;
      coinsSpent: number;
      message?: string;
    };
