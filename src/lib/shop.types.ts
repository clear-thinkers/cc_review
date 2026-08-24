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

/** Which appliance a recipe is cooked on. `null` means not cookable (Shop Kitchen). */
export type ShopCookMethod = "stove" | "oven";

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
  cookMethod: ShopCookMethod | null;
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

// ─── Shop Kitchen (feature spec 2026-08-23-kitchen-page.md) ────────────────

/** One ledger row from either shop_ingredient_rewards or shop_ingredient_consumptions -- only the key is needed for client-side availability aggregation. */
export type ShopIngredientLedgerEntry = {
  ingredientKey: string;
};

export type ShopShelfCategory = "default" | "drinks" | "desserts" | "hotmeal";

export const SHOP_SHELF_CATEGORIES: readonly ShopShelfCategory[] = [
  "default",
  "drinks",
  "desserts",
  "hotmeal",
];

export type ShopCookedDish = {
  id: string;
  userId: string;
  recipeId: string;
  shelfCategory: ShopShelfCategory;
  cookedAt: number;
};

export type CookShopRecipeErrorCode =
  | "forbidden"
  | "recipe_not_cookable"
  | "recipe_not_unlocked"
  | "insufficient_ingredients"
  | "unknown";

export type CookShopRecipeResult =
  | {
      success: true;
      code: "cooked";
      dishId: string;
      recipeId: string;
      shelfCategory: ShopShelfCategory;
    }
  | {
      success: false;
      code: CookShopRecipeErrorCode;
      missingIngredientKeys: string[];
    };

export type MoveShopCookedDishErrorCode =
  | "forbidden"
  | "invalid_shelf_category"
  | "dish_not_found"
  | "unknown";

export type MoveShopCookedDishResult =
  | {
      success: true;
      code: "moved";
      dishId: string;
      shelfCategory: ShopShelfCategory;
    }
  | {
      success: false;
      code: MoveShopCookedDishErrorCode;
    };

/** Cook-readiness for one recipe against the caller's current available ingredients. */
export type ShopCookReadiness = {
  isReady: boolean;
  missingIngredientKeys: string[];
};
