import { describe, expect, it } from "vitest";
import { wordsStrings } from "../words.strings";
import type {
  ShopTransaction,
  ShopTransactionAction,
} from "./shop.types";

describe("Shop Types", () => {
  it("allows creating ShopTransactionAction values", () => {
    const actions: ShopTransactionAction[] = ["unlock_recipe"];
    expect(actions).toHaveLength(1);
  });

  it("allows creating ShopTransaction objects", () => {
    const transaction: ShopTransaction = {
      id: "txn-1",
      userId: "user-1",
      recipeId: "recipe-1",
      actionType: "unlock_recipe",
      coinsSpent: 25,
      beginningBalance: 60,
      endingBalance: 35,
      createdAt: 1_710_000_000_000,
    };

    expect(transaction.endingBalance).toBe(35);
  });
});

describe("Shop string parity", () => {
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
});
