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
  /** Optional display name for this exact variant (e.g. "黑糖奶茶"), shown instead of the recipe's own title when this rule is the one matched. Absent/blank means fall back to the recipe's title, same as before this field existed. */
  titleI18n?: ShopLocalizedValue<string>;
};

/** Which appliance a recipe is cooked on. `null` means not cookable (Shop Kitchen). */
export type ShopCookMethod = "stove" | "oven";

/** Which shelf tab a cooked dish is organized under. `null` alongside a `null` cookMethod means the recipe isn't cookable; Shop Admin requires it whenever cookMethod is set. */
export type ShopFoodType = "drinks" | "hotmeal" | "desserts";

export const SHOP_FOOD_TYPES: readonly ShopFoodType[] = ["drinks", "hotmeal", "desserts"];

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
  foodType: ShopFoodType | null;
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

export type ShopTransactionAction = "unlock_recipe" | "purchase_ingredient";

export type ShopTransaction = {
  id: string;
  userId: string;
  recipeId: string | null;
  ingredientKey: string | null;
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

/** Where a cooked dish physically sits. The countertop is capacity-limited (SHOP_KITCHEN_COUNTERTOP_CAPACITY); the shelf is unlimited and dishes there are grouped for display by their *recipe's* foodType, not stored per-dish. */
export type ShopDishLocation = "countertop" | "shelf";

/** Max number of dishes that can sit on the countertop before organize_shop_kitchen_countertop must be called (cooking is blocked past this). Kept in sync by hand with the same constant baked into the cook_shop_recipe migration -- no shared config layer between SQL and TS in this codebase. */
export const SHOP_KITCHEN_COUNTERTOP_CAPACITY = 6;

export type ShopCookedDish = {
  id: string;
  userId: string;
  recipeId: string;
  location: ShopDishLocation;
  /** Which of the recipe's own special_ingredient_slots keys were added when this specific dish was cooked. Raw facts, not a resolved icon -- pair with the recipe's variantIconRules and resolveShopRecipeIconPath to get the actual variant icon to display. */
  specialIngredientKeys: string[];
  cookedAt: number;
};

export type CookShopRecipeErrorCode =
  | "forbidden"
  | "recipe_not_cookable"
  | "recipe_not_unlocked"
  | "countertop_full"
  | "insufficient_ingredients"
  | "unknown";

export type CookShopRecipeResult =
  | {
      success: true;
      code: "cooked";
      dishId: string;
      recipeId: string;
      location: ShopDishLocation;
      specialIngredientKeys: string[];
    }
  | {
      success: false;
      code: CookShopRecipeErrorCode;
      missingIngredientKeys: string[];
    };

export type OrganizeKitchenCountertopErrorCode = "forbidden" | "unknown";

export type OrganizeKitchenCountertopResult =
  | {
      success: true;
      code: "organized";
      movedCount: number;
    }
  | {
      success: false;
      code: OrganizeKitchenCountertopErrorCode;
    };

/** Cook-readiness for one recipe against the caller's current available ingredients. */
export type ShopCookReadiness = {
  isReady: boolean;
  missingIngredientKeys: string[];
};

// ─── Ingredient shopping for kids (feature spec 2026-03-30-shop-ingredient-shopping.md) ───

export type PurchaseShopIngredientErrorCode =
  | "forbidden"
  | "invalid_quantity"
  | "ingredient_not_available"
  | "recipe_not_available"
  | "recipe_not_unlocked"
  | "insufficient_coins"
  | "unknown";

export type PurchaseShopIngredientResult =
  | {
      success: true;
      code: "purchased";
      recipeId: string;
      ingredientKey: string;
      remainingCoins: number;
      coinsSpent: number;
      quantity: number;
    }
  | {
      success: false;
      code: PurchaseShopIngredientErrorCode;
      recipeId: string | null;
      ingredientKey: string | null;
      remainingCoins: number | null;
      coinsSpent: number;
    };
