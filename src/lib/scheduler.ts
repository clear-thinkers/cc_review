import type { Word } from "./types";

export type Grade = "again" | "hard" | "good" | "easy";

const R_TARGET = 0.9;
const S_MIN = 0.5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDue(nextReviewAt: number | undefined, now = Date.now()): boolean {
  if (!nextReviewAt) {
    return true;
  }

  return nextReviewAt <= now;
}

export function computeIntervalDays(stabilityDays: number, rTarget = R_TARGET): number {
  const intervalDays = -stabilityDays * Math.log(rTarget);
  return Math.max(1, Math.round(intervalDays));
}

export function calculateNextState(word: Word, grade: Grade, now = Date.now()): Word {
  // word.ease is repurposed to store stabilityDays (S) for the forgetting curve model
  const currentStability = Math.max(S_MIN, word.ease || 0);

  let nextStability = currentStability;
  let nextRepetitions = word.repetitions;

  if (grade === "again") {
    nextStability = Math.max(S_MIN, currentStability * 0.6);
    nextRepetitions = 0;
  }

  if (grade === "hard") {
    nextStability = Math.max(S_MIN, currentStability * 1.05);
    nextRepetitions += 1;
  }

  if (grade === "good") {
    nextStability = Math.max(S_MIN, currentStability * 1.35);
    nextRepetitions += 1;
  }

  if (grade === "easy") {
    nextStability = Math.max(S_MIN, currentStability * 1.6);
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
