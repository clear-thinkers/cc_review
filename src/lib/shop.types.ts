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
  specialIngredients: ShopIngredient[];
  specialIngredientsI18n: ShopLocalizedValue<ShopIngredient[]>;
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
  labelI18n?: ShopLocalizedValue<string>;
  iconPath?: string | null;
};

/** One ingredient rewarded by reward_random_ingredients (paragraph-quiz ingredient reward, 2026-08-22). */
export type RewardedIngredient = {
  ingredientKey: string;
  labelI18n?: ShopLocalizedValue<string>;
  iconPath?: string | null;
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

export type CoinRedemption = {
  id: string;
  userId: string;
  coinsRedeemed: number;
  dollarValue: number;
  note: string;
  childSignature: string;
  beginningBalance: number;
  endingBalance: number;
  createdAt: number;
};

export type RedeemCoinsErrorCode =
  | "forbidden"
  | "invalid_amount"
  | "invalid_note"
  | "invalid_signature"
  | "insufficient_coins"
  | "unknown";

export type RedeemCoinsResult =
  | {
      success: true;
      code: "redeemed";
      coinsRedeemed: number;
      dollarValue: number;
      remainingCoins: number;
    }
  | {
      success: false;
      code: RedeemCoinsErrorCode;
      remainingCoins?: number;
    };

export type CoinBreakdown = {
  totalEarned: number;
  spentOnRecipes: number;
  redeemed: number;
  available: number;
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
