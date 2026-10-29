/**
 * Chef challenge + paw prints: pure helpers (roadmap item T; spec
 * docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md).
 *
 * Balances, which stamps show as used, reward-card state, admin draft validation, RPC
 * result normalizers, and a TypeScript reference for the question rotation that
 * `get_chef_challenge` runs in SQL (scripts/verify-chef-challenge.ts checks the two agree).
 */
import type {
  AnswerChefChallengeResult,
  ChallengeRotationAttempt,
  ChefChallengeQuestionDraft,
  ChefChallengeQuestionDraftError,
  GetChefChallengeFailureCode,
  GetChefChallengeResult,
  PawPrintAward,
  PawPrintBalance,
  PawPrintGiver,
  PawPrintRedemption,
  PawPrintRewardCardState,
  PawPrintStamp,
  RedeemPawPrintRewardFailureCode,
  RedeemPawPrintRewardResult,
  AnswerChefChallengeFailureCode,
} from "./pawPrints.types";

export const PAW_PRINT_GIVERS: readonly PawPrintGiver[] = ["shrewy"];

/** The launch reward: Shrewy washes his hands before cooking (owner's child's idea). */
export const SHREWY_HAND_WASH_REWARD_KEY = "shrewy-hand-wash";

export const CHEF_CHALLENGE_PROMPT_MAX = 200;
export const CHEF_CHALLENGE_ANSWER_MAX = 60;
export const CHEF_CHALLENGE_WRONG_MIN = 2;
export const CHEF_CHALLENGE_WRONG_MAX = 3;

export function isPawPrintGiver(value: unknown): value is PawPrintGiver {
  return typeof value === "string" && (PAW_PRINT_GIVERS as readonly string[]).includes(value);
}

/** Collected = earned for this giver; available = collected minus what was spent on this giver's rewards. */
export function computePawPrintBalance(
  awards: readonly PawPrintAward[],
  redemptions: readonly PawPrintRedemption[],
  giver: PawPrintGiver
): PawPrintBalance {
  const collected = awards.filter((award) => award.giver === giver).length;
  const spent = redemptions
    .filter((redemption) => redemption.giver === giver)
    .reduce((sum, redemption) => sum + redemption.cost, 0);
  return { collected, available: Math.max(collected - spent, 0) };
}

/**
 * The stamp sheet for one giver, oldest first. Spending never removes a stamp: the
 * oldest `spent` stamps are shown as used (decision 7a).
 */
export function buildPawPrintStamps(
  awards: readonly PawPrintAward[],
  redemptions: readonly PawPrintRedemption[],
  giver: PawPrintGiver
): PawPrintStamp[] {
  const spent = redemptions
    .filter((redemption) => redemption.giver === giver)
    .reduce((sum, redemption) => sum + redemption.cost, 0);
  return awards
    .filter((award) => award.giver === giver)
    .slice()
    .sort((a, b) => a.earnedAt - b.earnedAt || a.id.localeCompare(b.id))
    .map((award, index) => ({ award, isUsed: index < spent }));
}

export function resolveRewardCardState(params: {
  rewardKey: string;
  cost: number;
  available: number;
  redeemedKeys: ReadonlySet<string>;
}): PawPrintRewardCardState {
  if (params.redeemedKeys.has(params.rewardKey)) return "unlocked";
  return params.available >= params.cost ? "redeemable" : "needMore";
}

export function hasRedeemedReward(redemptions: readonly PawPrintRedemption[], rewardKey: string): boolean {
  return redemptions.some((redemption) => redemption.rewardKey === rewardKey);
}

/**
 * Reference for `get_chef_challenge`'s rotation: the questions eligible right now, and
 * the round they'd be asked in. Within a round no question repeats; once every active
 * question has been asked the next round starts, avoiding the question just asked when
 * there's another (decision 2d). The server then picks one of `eligible` at random.
 */
export function pickNextChallengeQuestion(params: {
  activeQuestionIds: readonly string[];
  attempts: readonly ChallengeRotationAttempt[];
}): { round: number; eligible: string[] } | null {
  const { activeQuestionIds, attempts } = params;
  if (activeQuestionIds.length === 0) return null;

  const round = attempts.reduce((max, attempt) => Math.max(max, attempt.round), 1);
  const askedThisRound = new Set(
    attempts.filter((attempt) => attempt.round === round).map((attempt) => attempt.questionId)
  );
  const remaining = activeQuestionIds.filter((id) => !askedThisRound.has(id));
  if (remaining.length > 0) return { round, eligible: remaining };

  const last = attempts.slice().sort((a, b) => b.issuedAt - a.issuedAt)[0]?.questionId ?? null;
  const fresh = activeQuestionIds.filter((id) => id !== last);
  return { round: round + 1, eligible: fresh.length > 0 ? fresh : [...activeQuestionIds] };
}

/** Trims every field and drops empty wrong-answer slots (the form shows 3; 2 may be filled). */
export function normalizeChefChallengeQuestionDraft(draft: ChefChallengeQuestionDraft): ChefChallengeQuestionDraft {
  return {
    recipeId: draft.recipeId.trim(),
    prompt: draft.prompt.trim(),
    correctAnswer: draft.correctAnswer.trim(),
    wrongAnswers: draft.wrongAnswers.map((answer) => answer.trim()).filter((answer) => answer !== ""),
    isActive: draft.isActive,
  };
}

/** First problem with a normalized draft, or null when it can be saved. */
export function validateChefChallengeQuestionDraft(
  draft: ChefChallengeQuestionDraft
): ChefChallengeQuestionDraftError | null {
  if (draft.recipeId === "") return "missing_recipe";
  if (draft.prompt === "") return "missing_prompt";
  if (draft.prompt.length > CHEF_CHALLENGE_PROMPT_MAX) return "prompt_too_long";
  if (draft.correctAnswer === "") return "missing_correct_answer";
  if (draft.wrongAnswers.some((answer) => answer === "")) return "blank_wrong_answer";
  if (draft.wrongAnswers.length < CHEF_CHALLENGE_WRONG_MIN || draft.wrongAnswers.length > CHEF_CHALLENGE_WRONG_MAX) {
    return "wrong_answer_count";
  }
  const all = [draft.correctAnswer, ...draft.wrongAnswers];
  if (all.some((answer) => answer.length > CHEF_CHALLENGE_ANSWER_MAX)) return "answer_too_long";
  if (new Set(all).size !== all.length) return "duplicate_answer";
  return null;
}

/** Every option once, in a random order (the admin preview; the server shuffles for children). */
export function shuffleChallengeOptions(
  correctAnswer: string,
  wrongAnswers: readonly string[],
  random: () => number = Math.random
): string[] {
  const options = [correctAnswer, ...wrongAnswers];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// ── RPC result normalizers ──────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(Math.trunc(n), 0) : 0;
}

function pickCode<T extends string>(value: unknown, known: readonly T[], fallback: T): T {
  return typeof value === "string" && (known as readonly string[]).includes(value) ? (value as T) : fallback;
}

const GET_CODES: readonly GetChefChallengeFailureCode[] = ["forbidden", "not_unlocked", "no_questions", "cook_required"];
const ANSWER_CODES: readonly AnswerChefChallengeFailureCode[] = [
  "forbidden",
  "no_attempt",
  "already_answered",
  "question_unavailable",
];
const REDEEM_CODES: readonly RedeemPawPrintRewardFailureCode[] = [
  "forbidden",
  "unknown_reward",
  "already_redeemed",
  "insufficient_paw_prints",
];

export function normalizeGetChefChallengeResult(data: unknown): GetChefChallengeResult {
  const row = asRecord(data);
  if (row?.success === true) {
    const options = Array.isArray(row.options)
      ? row.options.filter((option): option is string => typeof option === "string")
      : [];
    if (typeof row.attemptId === "string" && typeof row.prompt === "string" && options.length >= 2) {
      return { success: true, challenge: { attemptId: row.attemptId, prompt: row.prompt, options } };
    }
    return { success: false, code: "unknown" };
  }
  return { success: false, code: pickCode(row?.code, GET_CODES, "unknown") };
}

export function normalizeAnswerChefChallengeResult(data: unknown): AnswerChefChallengeResult {
  const row = asRecord(data);
  if (row?.success === true && typeof row.isCorrect === "boolean" && typeof row.correctAnswer === "string") {
    return {
      success: true,
      isCorrect: row.isCorrect,
      correctAnswer: row.correctAnswer,
      balance: { collected: asCount(row.collected), available: asCount(row.available) },
    };
  }
  return { success: false, code: pickCode(row?.code, ANSWER_CODES, "unknown") };
}

export function normalizeRedeemPawPrintRewardResult(data: unknown): RedeemPawPrintRewardResult {
  const row = asRecord(data);
  if (row?.success === true) return { success: true, available: asCount(row.available) };
  return { success: false, code: pickCode(row?.code, REDEEM_CODES, "unknown") };
}
