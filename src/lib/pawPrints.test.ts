import { describe, expect, it } from "vitest";
import {
  buildPawPrintStamps,
  computePawPrintBalance,
  hasRedeemedReward,
  isPawPrintGiver,
  normalizeAnswerChefChallengeResult,
  normalizeChefChallengeQuestionDraft,
  normalizeGetChefChallengeResult,
  normalizeRedeemPawPrintRewardResult,
  chefChallengeSize,
  earnsPawPrint,
  isChefChallengeFinished,
  resolveRewardCardState,
  SHREWY_HAND_WASH_REWARD_KEY,
  shuffleChallengeOptions,
  validateChefChallengeQuestionDraft,
} from "./pawPrints";
import type { ChefChallengeQuestionDraft, PawPrintAward, PawPrintRedemption } from "./pawPrints.types";

function award(id: string, earnedAt: number): PawPrintAward {
  return { id, userId: "child-1", giver: "shrewy", recipeId: "recipe-1", earnedAt };
}

function redemption(cost: number): PawPrintRedemption {
  return { id: `r-${cost}`, userId: "child-1", rewardKey: SHREWY_HAND_WASH_REWARD_KEY, giver: "shrewy", cost, redeemedAt: 99 };
}

function draft(overrides: Partial<ChefChallengeQuestionDraft> = {}): ChefChallengeQuestionDraft {
  return {
    recipeId: "recipe-1",
    prompt: "中秋节吃什么？",
    correctAnswer: "月饼",
    wrongAnswers: ["粽子", "汤圆"],
    explanation: "中秋节吃月饼，象征团圆。",
    isActive: true,
    ...overrides,
  };
}

describe("paw-print balances and stamps", () => {
  it("counts collected and subtracts spending for the same giver", () => {
    const awards = Array.from({ length: 12 }, (_, i) => award(`a${i}`, i));
    expect(computePawPrintBalance(awards, [], "shrewy")).toEqual({ collected: 12, available: 12 });
    expect(computePawPrintBalance(awards, [redemption(10)], "shrewy")).toEqual({ collected: 12, available: 2 });
  });

  it("never reports a negative balance", () => {
    expect(computePawPrintBalance([award("a", 1)], [redemption(10)], "shrewy").available).toBe(0);
  });

  it("keeps every stamp and marks the oldest spent ones as used", () => {
    const awards = [award("c", 30), award("a", 10), award("b", 20)];
    const stamps = buildPawPrintStamps(awards, [redemption(2)], "shrewy");
    expect(stamps.map((stamp) => stamp.award.id)).toEqual(["a", "b", "c"]);
    expect(stamps.map((stamp) => stamp.isUsed)).toEqual([true, true, false]);
  });

  it("shows no used stamps before anything is redeemed", () => {
    expect(buildPawPrintStamps([award("a", 1)], [], "shrewy")[0].isUsed).toBe(false);
  });
});

describe("reward card state", () => {
  const base = { rewardKey: SHREWY_HAND_WASH_REWARD_KEY, cost: 10 };

  it("is unlocked once redeemed, whatever the balance", () => {
    const redeemed = new Set([SHREWY_HAND_WASH_REWARD_KEY]);
    expect(resolveRewardCardState({ ...base, available: 0, redeemedKeys: redeemed })).toBe("unlocked");
  });

  it("is redeemable at exactly the cost and needs more below it", () => {
    expect(resolveRewardCardState({ ...base, available: 10, redeemedKeys: new Set() })).toBe("redeemable");
    expect(resolveRewardCardState({ ...base, available: 9, redeemedKeys: new Set() })).toBe("needMore");
  });

  it("finds a redeemed reward", () => {
    expect(hasRedeemedReward([redemption(10)], SHREWY_HAND_WASH_REWARD_KEY)).toBe(true);
    expect(hasRedeemedReward([], SHREWY_HAND_WASH_REWARD_KEY)).toBe(false);
  });
});

describe("three-question challenges", () => {
  it("asks 3 questions, or every question when a recipe has fewer", () => {
    expect(chefChallengeSize({ correct: 0, unasked: 8 })).toBe(3);
    expect(chefChallengeSize({ correct: 0, unasked: 2 })).toBe(2);
    expect(chefChallengeSize({ correct: 1, unasked: 1 })).toBe(2);
  });

  it("ends at once on a wrong answer, with no paw print", () => {
    const progress = { correct: 1, wrong: 1, unasked: 6 };
    expect(isChefChallengeFinished(progress)).toBe(true);
    expect(earnsPawPrint(progress)).toBe(false);
  });

  it("keeps going until every question is answered correctly, then earns a paw print", () => {
    expect(isChefChallengeFinished({ correct: 2, wrong: 0, unasked: 6 })).toBe(false);
    expect(earnsPawPrint({ correct: 2, wrong: 0, unasked: 6 })).toBe(false);
    expect(isChefChallengeFinished({ correct: 3, wrong: 0, unasked: 5 })).toBe(true);
    expect(earnsPawPrint({ correct: 3, wrong: 0, unasked: 5 })).toBe(true);
  });

  it("finishes a short recipe's challenge once all its questions are right", () => {
    expect(earnsPawPrint({ correct: 2, wrong: 0, unasked: 0 })).toBe(true);
  });

  it("shrinks gracefully when questions are deactivated mid-challenge", () => {
    expect(isChefChallengeFinished({ correct: 1, wrong: 0, unasked: 0 })).toBe(true);
  });

  it("stays finished once its paw print is earned, even if questions are added later", () => {
    const reopened = { correct: 2, wrong: 0, unasked: 3, alreadyEarned: true };
    expect(isChefChallengeFinished(reopened)).toBe(true);
    expect(earnsPawPrint(reopened)).toBe(false);
  });
});

describe("admin question drafts", () => {
  it("accepts a valid draft with 2 or 3 wrong answers", () => {
    expect(validateChefChallengeQuestionDraft(draft())).toBeNull();
    expect(validateChefChallengeQuestionDraft(draft({ wrongAnswers: ["粽子", "汤圆", "饺子"] }))).toBeNull();
  });

  it("trims and drops empty wrong-answer slots when normalizing", () => {
    const normalized = normalizeChefChallengeQuestionDraft(
      draft({ prompt: "  中秋节吃什么？ ", wrongAnswers: [" 粽子 ", "", "汤圆"] })
    );
    expect(normalized.prompt).toBe("中秋节吃什么？");
    expect(normalized.wrongAnswers).toEqual(["粽子", "汤圆"]);
  });

  it("rejects missing fields, wrong counts, duplicates and over-long text", () => {
    expect(validateChefChallengeQuestionDraft(draft({ recipeId: "" }))).toBe("missing_recipe");
    expect(validateChefChallengeQuestionDraft(draft({ prompt: "" }))).toBe("missing_prompt");
    expect(validateChefChallengeQuestionDraft(draft({ prompt: "问".repeat(201) }))).toBe("prompt_too_long");
    expect(validateChefChallengeQuestionDraft(draft({ correctAnswer: "" }))).toBe("missing_correct_answer");
    expect(validateChefChallengeQuestionDraft(draft({ wrongAnswers: ["粽子"] }))).toBe("wrong_answer_count");
    expect(validateChefChallengeQuestionDraft(draft({ wrongAnswers: ["a", "b", "c", "d"] }))).toBe("wrong_answer_count");
    expect(validateChefChallengeQuestionDraft(draft({ wrongAnswers: ["粽子", ""] }))).toBe("blank_wrong_answer");
    expect(validateChefChallengeQuestionDraft(draft({ wrongAnswers: ["月饼", "汤圆"] }))).toBe("duplicate_answer");
    expect(validateChefChallengeQuestionDraft(draft({ correctAnswer: "答".repeat(61) }))).toBe("answer_too_long");
  });

  it("treats the explanation as optional but limits its length", () => {
    expect(validateChefChallengeQuestionDraft(draft({ explanation: "" }))).toBeNull();
    expect(validateChefChallengeQuestionDraft(draft({ explanation: "知".repeat(300) }))).toBeNull();
    expect(validateChefChallengeQuestionDraft(draft({ explanation: "知".repeat(301) }))).toBe("explanation_too_long");
    expect(normalizeChefChallengeQuestionDraft(draft({ explanation: "  小知识 " })).explanation).toBe("小知识");
  });

  it("shuffles every option exactly once", () => {
    const options = shuffleChallengeOptions("月饼", ["粽子", "汤圆"], () => 0);
    expect(options.slice().sort()).toEqual(["月饼", "汤圆", "粽子"].sort());
  });
});

describe("RPC result normalizers", () => {
  it("reads a challenge without any answer marker", () => {
    expect(
      normalizeGetChefChallengeResult({
        success: true,
        attemptId: "a1",
        prompt: "问",
        options: ["x", "y", "z"],
        questionNumber: 2,
        questionCount: 3,
      })
    ).toEqual({
      success: true,
      challenge: { attemptId: "a1", prompt: "问", options: ["x", "y", "z"], questionNumber: 2, questionCount: 3 },
    });
  });

  it("maps known refusal codes and falls back to unknown", () => {
    expect(normalizeGetChefChallengeResult({ success: false, code: "cook_required" })).toEqual({
      success: false,
      code: "cook_required",
    });
    expect(normalizeGetChefChallengeResult({ success: false, code: "weird" })).toEqual({ success: false, code: "unknown" });
    expect(normalizeGetChefChallengeResult(null)).toEqual({ success: false, code: "unknown" });
    expect(normalizeGetChefChallengeResult({ success: true, attemptId: "a1", prompt: "问", options: ["x"] })).toEqual({
      success: false,
      code: "unknown",
    });
  });

  it("reads an answer result with its balance", () => {
    expect(
      normalizeAnswerChefChallengeResult({ success: true, isCorrect: true, correctAnswer: "月饼", collected: 3, available: "2" })
    ).toEqual({
      success: true,
      isCorrect: true,
      correctAnswer: "月饼",
      explanation: null,
      questionNumber: 1,
      questionCount: 1,
      challengeFinished: false,
      pawPrintEarned: false,
      balance: { collected: 3, available: 2 },
    });
    expect(
      normalizeAnswerChefChallengeResult({
        success: true,
        isCorrect: true,
        correctAnswer: "月饼",
        questionNumber: 3,
        questionCount: 3,
        challengeFinished: true,
        pawPrintEarned: true,
        collected: 4,
        available: 4,
      })
    ).toMatchObject({ questionNumber: 3, questionCount: 3, challengeFinished: true, pawPrintEarned: true });
    expect(
      normalizeAnswerChefChallengeResult({
        success: true,
        isCorrect: false,
        correctAnswer: "月饼",
        explanation: "中秋节吃月饼。",
        collected: 0,
        available: 0,
      })
    ).toMatchObject({ explanation: "中秋节吃月饼。" });
    expect(normalizeAnswerChefChallengeResult({ success: false, code: "already_answered" })).toEqual({
      success: false,
      code: "already_answered",
    });
  });

  it("reads redeem results", () => {
    expect(normalizeRedeemPawPrintRewardResult({ success: true, available: 4 })).toEqual({ success: true, available: 4 });
    expect(normalizeRedeemPawPrintRewardResult({ success: false, code: "insufficient_paw_prints" })).toEqual({
      success: false,
      code: "insufficient_paw_prints",
    });
  });

  it("knows its givers", () => {
    expect(isPawPrintGiver("shrewy")).toBe(true);
    expect(isPawPrintGiver("other")).toBe(false);
  });
});
