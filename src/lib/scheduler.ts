import type { Word } from "./types";

export type Grade = "again" | "hard" | "good" | "easy";
export type ReviewSource = "flashcard" | "fillTest";
export type GradeResult = {
  grade: Grade;
  source?: ReviewSource;
  reason?: string;
  score?: number;
};

// Power-law forgetting curve (same family FSRS uses): R = 1 / (1 + elapsedDays / (FORGETTING_FACTOR * stabilityDays)).
// Replaces an earlier exponential model (R = exp(-elapsed/stability)) that decayed far faster than
// observed real-world recall — see docs/feature-specs/2026-09-19-scheduler-retrievability-power-law.md.
//
// FORGETTING_FACTOR alone controls the curve's long-delay SHAPE, independent of R_TARGET. It was
// first set to 8 (matching observed real recall almost exactly — see the fix log), then deliberately
// lowered to 4, trading some of that fit for a stricter long-delay decay by explicit product choice
// (a fresh word left unreviewed for ~60 days should read closer to ~58% than ~74%). R_TARGET is then
// solved so that FORGETTING_FACTOR * (1/R_TARGET - 1)
// reproduces the OLD exponential model's near-term interval-per-unit-stability coefficient
// (-ln(0.9) ≈ 0.1054): existing `ease` values continue to imply a similar NEAR-term review cadence
// on this deploy (a word due tomorrow under the old model is still due in about a day under the new
// one) — only what happens once a word goes significantly overdue actually changes. Do not read
// R_TARGET as "the retention we're aiming for at due time" in isolation; it's a calibration constant,
// not an independent product decision — re-derive it if FORGETTING_FACTOR ever changes.
const R_TARGET = 0.974;
const S_MIN = 0.5;
const FORGETTING_FACTOR = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDue(nextReviewAt: number | undefined, now = Date.now()): boolean {
  if (!nextReviewAt) {
    return true;
  }

  return nextReviewAt <= now;
}

/** Retrievability (probability of successful recall) at `elapsedDays` since last review, given `stabilityDays`. */
export function computeRetrievability(elapsedDays: number, stabilityDays: number): number {
  const stability = Math.max(S_MIN, stabilityDays);
  const elapsed = Math.max(0, elapsedDays);
  return 1 / (1 + elapsed / (FORGETTING_FACTOR * stability));
}

export function computeIntervalDays(stabilityDays: number, rTarget = R_TARGET): number {
  const stability = Math.max(S_MIN, stabilityDays);
  const intervalDays = FORGETTING_FACTOR * stability * (1 / rTarget - 1);
  return Math.max(1, Math.round(intervalDays));
}

/**
 * Retrievability just before this grading event, derived from the word's prior scheduled state
 * (same back-derivation the UI's familiarity display uses: lastReviewAt = nextReviewAt - intervalDays).
 * Returns 1 (no recall-boost credit) when there's no valid prior review to derive elapsed time from —
 * a brand-new or reset word's first grade — since "recalled despite being overdue" isn't a meaningful
 * signal there.
 */
function computeRetrievabilityAtReview(word: Word, currentStability: number, now: number): number {
  if (!word.nextReviewAt || !word.intervalDays) {
    return 1;
  }
  const lastReviewAt = word.nextReviewAt - word.intervalDays * DAY_MS;
  const elapsedDays = Math.max(0, (now - lastReviewAt) / DAY_MS);
  return computeRetrievability(elapsedDays, currentStability);
}

export function calculateNextState(word: Word, grade: Grade, now = Date.now()): Word {
  // word.ease is repurposed to store stabilityDays (S) for the forgetting curve model
  const currentStability = Math.max(S_MIN, word.ease || 0);

  // A correct recall despite low predicted retrievability is stronger evidence of true stability
  // than a correct recall at high predicted retrievability, so it earns a bigger stability gain.
  // Bounded to [1, 2] since retrievability is itself bounded to [0, 1].
  const rAtReview = computeRetrievabilityAtReview(word, currentStability, now);
  const recallBoost = 1 + (1 - rAtReview);

  let nextStability = currentStability;
  let nextRepetitions = word.repetitions;

  if (grade === "again") {
    nextStability = Math.max(S_MIN, currentStability * 0.5);
    nextRepetitions = 0;
  }

  if (grade === "hard") {
    nextStability = Math.max(S_MIN, currentStability * 1.2);
    nextRepetitions += 1;
  }

  if (grade === "good") {
    nextStability = Math.max(S_MIN, currentStability * 2.0 * recallBoost);
    nextRepetitions += 1;
  }

  if (grade === "easy") {
    nextStability = Math.max(S_MIN, currentStability * 3.0 * recallBoost);
    nextRepetitions += 1;
  }

  const intervalDays = computeIntervalDays(nextStability, R_TARGET);
  const nextReviewAt = now + intervalDays * DAY_MS;

  return {
    ...word,
    // word.ease is repurposed to store stabilityDays (S) for the forgetting curve model
    ease: nextStability,
    repetitions: nextRepetitions,
    intervalDays,
    nextReviewAt,
  };
}
