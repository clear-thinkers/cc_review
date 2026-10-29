import { describe, expect, it } from "vitest";
import type {
  AnswerChefChallengeResult,
  ChefChallengeQuestion,
  GetChefChallengeResult,
  PawPrintAward,
  PawPrintRewardCardState,
  PawPrintStamp,
  RedeemPawPrintRewardResult,
} from "./pawPrints.types";

describe("pawPrints types", () => {
  it("constructs an award, a stamp and a question", () => {
    const award: PawPrintAward = { id: "a", userId: "u", giver: "shrewy", recipeId: null, earnedAt: 1 };
    const stamp: PawPrintStamp = { award, isUsed: false };
    const question: ChefChallengeQuestion = {
      id: "q",
      recipeId: "r",
      prompt: "问",
      correctAnswer: "对",
      wrongAnswers: ["错1", "错2"],
      isActive: true,
      displayOrder: 0,
    };
    expect(stamp.award.giver).toBe("shrewy");
    expect(question.wrongAnswers).toHaveLength(2);
  });

  it("constructs both arms of every RPC result", () => {
    const got: GetChefChallengeResult[] = [
      { success: true, challenge: { attemptId: "a", prompt: "问", options: ["x", "y"] } },
      { success: false, code: "cook_required" },
    ];
    const answered: AnswerChefChallengeResult[] = [
      { success: true, isCorrect: false, correctAnswer: "对", balance: { collected: 0, available: 0 } },
      { success: false, code: "already_answered" },
    ];
    const redeemed: RedeemPawPrintRewardResult[] = [
      { success: true, available: 0 },
      { success: false, code: "insufficient_paw_prints" },
    ];
    expect([got, answered, redeemed].every((arms) => arms.length === 2)).toBe(true);
  });

  it("accepts every reward card state", () => {
    const states: PawPrintRewardCardState[] = ["redeemable", "needMore", "unlocked"];
    expect(states).toHaveLength(3);
  });
});
