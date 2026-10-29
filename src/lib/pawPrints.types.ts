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

/**
 * The current question of a challenge, as the child sees it: never includes which option
 * is correct. A challenge asks up to 3 questions one at a time (questionNumber of
 * questionCount).
 */
export type ChefChallenge = {
  attemptId: string;
  prompt: string;
  options: string[];
  questionNumber: number;
  questionCount: number;
};

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
  | {
      success: true;
      isCorrect: boolean;
      correctAnswer: string;
      /** 小知识, shown after answering either way; null when the question has none. */
      explanation: string | null;
      /** This question's place in the challenge (1-based) and the challenge's size. */
      questionNumber: number;
      questionCount: number;
      /** A wrong answer, or the last correct one, ends the challenge. */
      challengeFinished: boolean;
      /** True only on the last answer of a fully correct challenge. */
      pawPrintEarned: boolean;
      balance: PawPrintBalance;
    }
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
  /** 小知识: Chinese, child-facing, shown after answering; null when not written yet. */
  explanation: string | null;
  isActive: boolean;
  displayOrder: number;
};

/** The admin form's draft (no id yet for a new question). */
export type ChefChallengeQuestionDraft = {
  recipeId: string;
  prompt: string;
  correctAnswer: string;
  wrongAnswers: string[];
  /** Optional; blank means none. */
  explanation: string;
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
  | "duplicate_answer"
  | "explanation_too_long";

/** What every /api/shop-admin/chef-questions call returns: the recipe's full question list. */
export type ChefChallengeQuestionsResponse = { questions: ChefChallengeQuestion[] };

/** One challenge's progress, as get/answer_chef_challenge compute it (see isChefChallengeFinished). */
export type ChefChallengeProgress = {
  correct: number;
  wrong: number;
  unasked: number;
  /** This challenge already earned its paw print, so it stays finished even if questions are added later. */
  alreadyEarned?: boolean;
};
