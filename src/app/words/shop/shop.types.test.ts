import { describe, expect, it } from "vitest";
import { wordsStrings } from "../words.strings";
import type {
  CoinBreakdown,
  CoinRedemption,
  PurchaseShopIngredientResult,
  RedeemCoinsResult,
  ShopTransaction,
  ShopTransactionAction,
} from "./shop.types";

describe("Shop Types", () => {
  it("allows creating ShopTransactionAction values", () => {
    const actions: ShopTransactionAction[] = ["unlock_recipe", "purchase_ingredient"];
    expect(actions).toHaveLength(2);
  });

  it("allows creating ShopTransaction objects", () => {
    const transaction: ShopTransaction = {
      id: "txn-1",
      userId: "user-1",
      recipeId: "recipe-1",
      ingredientKey: null,
      actionType: "unlock_recipe",
      coinsSpent: 25,
      beginningBalance: 60,
      endingBalance: 35,
      createdAt: 1_710_000_000_000,
    };

    expect(transaction.endingBalance).toBe(35);
  });

  it("allows creating a purchase_ingredient ShopTransaction with an ingredientKey", () => {
    const transaction: ShopTransaction = {
      id: "txn-2",
      userId: "user-1",
      recipeId: "recipe-1",
      ingredientKey: "milk",
      actionType: "purchase_ingredient",
      coinsSpent: 8,
      beginningBalance: 20,
      endingBalance: 12,
      createdAt: 1_710_000_000_000,
    };

    expect(transaction.ingredientKey).toBe("milk");
  });

  it("allows creating CoinRedemption objects", () => {
    const redemption: CoinRedemption = {
      id: "red-1",
      userId: "user-1",
      coinsRedeemed: 200,
      dollarValue: 2.0,
      note: "birthday",
      childSignature: "Alice",
      beginningBalance: 400,
      endingBalance: 200,
      createdAt: 1_710_000_000_000,
    };

    expect(redemption.dollarValue).toBe(2.0);
    expect(redemption.endingBalance).toBe(200);
  });

  it("allows creating CoinBreakdown objects", () => {
    const breakdown: CoinBreakdown = {
      totalEarned: 500,
      spentOnRecipes: 200,
      redeemed: 100,
      available: 200,
    };

    expect(breakdown.totalEarned - breakdown.spentOnRecipes - breakdown.redeemed).toBe(
      breakdown.available
    );
  });

  it("allows typing a successful RedeemCoinsResult", () => {
    const result: RedeemCoinsResult = {
      success: true,
      code: "redeemed",
      coinsRedeemed: 100,
      dollarValue: 1.0,
      remainingCoins: 300,
    };

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.coinsRedeemed).toBe(100);
    }
  });

  it("allows typing a failed RedeemCoinsResult", () => {
    const result: RedeemCoinsResult = {
      success: false,
      code: "insufficient_coins",
      remainingCoins: 50,
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("insufficient_coins");
    }
  });

  it("allows typing a successful PurchaseShopIngredientResult", () => {
    const result: PurchaseShopIngredientResult = {
      success: true,
      code: "purchased",
      recipeId: "recipe-1",
      ingredientKey: "milk",
      remainingCoins: 12,
      coinsSpent: 8,
      quantity: 2,
    };

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.quantity).toBe(2);
    }
  });

  it("allows typing a failed PurchaseShopIngredientResult", () => {
    const result: PurchaseShopIngredientResult = {
      success: false,
      code: "recipe_not_unlocked",
      recipeId: "recipe-1",
      ingredientKey: "milk",
      remainingCoins: 20,
      coinsSpent: 0,
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("recipe_not_unlocked");
    }
  });
});

describe("Shop string parity", () => {
  it("keeps modal keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.modal).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.modal).sort()
    );
  });

  it("keeps history keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.history).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.history).sort()
    );
  });

  it("keeps history header keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.history.headers).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.history.headers).sort()
    );
  });

  it("keeps breakdown keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.breakdown).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.breakdown).sort()
    );
  });

  it("keeps cashOut keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.cashOut).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.cashOut).sort()
    );
  });

  it("keeps cashOut confirm keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.cashOut.confirm).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.cashOut.confirm).sort()
    );
  });

  it("keeps redemptionHistory keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.redemptionHistory).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.redemptionHistory).sort()
    );
  });

  it("keeps redemptionHistory header keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.shop.redemptionHistory.headers).sort()).toEqual(
      Object.keys(wordsStrings.zh.shop.redemptionHistory.headers).sort()
    );
  });
});
