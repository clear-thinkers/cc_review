/**
 * Chef challenge + paw-print types (roadmap item T; spec
 * docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md).
 */

/** Characters who give tokens. Each giver has its own balance and reward list. */
export type PawPrintGiver = "shrewy";

/** One earned paw print (a `paw_print_awards` row). */
export type PawPrintAward = {
  id: string;
  userId: string;
  giver: PawPrintGiver;
  recipeId: string | null;
  earnedAt: number;
};

/** A redeemed reward (a `paw_print_redemptions` row). */
export type PawPrintRedemption = {
  id: string;
  userId: string;
  rewardKey: string;
  giver: PawPrintGiver;
  cost: number;
  redeemedAt: number;
};

/** A catalog reward (a `paw_print_rewards` row). */
export type PawPrintReward = {
  rewardKey: string;
  giver: PawPrintGiver;
  cost: number;
  isActive: boolean;
};

export type PawPrintBalance = { collected: number; available: number };

/** One stamp on the sheet: the award plus whether it has been spent. */
export type PawPrintStamp = { award: PawPrintAward; isUsed: boolean };

export type PawPrintRewardCardState = "redeemable" | "needMore" | "unlocked";

/** A challenge as the child sees it: never includes which option is correct. */
export type ChefChallenge = { attemptId: string; prompt: string; options: string[] };

export type GetChefChallengeFailureCode = "forbidden" | "not_unlocked" | "no_questions" | "cook_required" | "unknown";

export type GetChefChallengeResult =
  | { success: true; challenge: ChefChallenge }
  | { success: false; code: GetChefChallengeFailureCode };

export type AnswerChefChallengeFailureCode =
  | "forbidden"
  | "no_attempt"
  | "already_answered"
  | "question_unavailable"
  | "unknown";

export type AnswerChefChallengeResult =
  | { success: true; isCorrect: boolean; correctAnswer: string; balance: PawPrintBalance }
  | { success: false; code: AnswerChefChallengeFailureCode };

export type RedeemPawPrintRewardFailureCode =
  | "forbidden"
  | "unknown_reward"
  | "already_redeemed"
  | "insufficient_paw_prints"
  | "unknown";

export type RedeemPawPrintRewardResult =
  | { success: true; available: number }
  | { success: false; code: RedeemPawPrintRewardFailureCode };

/** A curated question as the platform admin edits it in Shop Admin. */
export type ChefChallengeQuestion = {
  id: string;
  recipeId: string;
  prompt: string;
  correctAnswer: string;
  wrongAnswers: string[];
  isActive: boolean;
  displayOrder: number;
};

/** The admin form's draft (no id yet for a new question). */
export type ChefChallengeQuestionDraft = {
  recipeId: string;
  prompt: string;
  correctAnswer: string;
  wrongAnswers: string[];
  isActive: boolean;
};

export type ChefChallengeQuestionDraftError =
  | "missing_recipe"
  | "missing_prompt"
  | "prompt_too_long"
  | "missing_correct_answer"
  | "answer_too_long"
  | "wrong_answer_count"
  | "blank_wrong_answer"
  | "duplicate_answer";

/** What every /api/shop-admin/chef-questions call returns: the recipe's full question list. */
export type ChefChallengeQuestionsResponse = { questions: ChefChallengeQuestion[] };

/** Pure reference for the server's question rotation (see pickNextChallengeQuestion). */
export type ChallengeRotationAttempt = { questionId: string | null; round: number; issuedAt: number };
