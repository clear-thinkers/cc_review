/**
 * Coin Rewards System — Domain Layer
 *
 * Pure functions for coin value calculation from quiz grades.
 * No side effects; no database access.
 *
 * Earning rules for a character grade:
 * - grade="easy" → 5 coins
 * - grade="good" → 3 coins
 * - grade="hard" → 1 coin
 * - grade="again" → 0 coins
 *
 * Earning rule for a vocab-phrase round entry (SessionGradeData.isVocabPhrase):
 * flat 1 coin on a correct answer (grade="easy" -- phrase rounds are binary,
 * see fillTest.ts), 0 otherwise. Deliberately NOT the character table above --
 * a phrase blank is a single right/wrong drag, not a graded review of an
 * already-scheduled item, so it earns a flat, smaller reward regardless of
 * tier.
 *
 * Earning rule for a paragraph-quiz session (SessionGradeData.isParagraphBlank):
 * a session-level flat sum, not a per-entry value -- see
 * calculateParagraphQuizSessionCoins below. A session with ANY
 * isParagraphBlank entry is treated as a paragraph quiz in its entirety (a
 * session is never a mix of paragraph-quiz and ordinary targets), so
 * calculateSessionCoins short-circuits to the session-level formula instead
 * of the per-entry reduce used for character/phrase entries.
 *
 * Last updated: 2026-08-19
 */

import type { SessionGradeData } from "./quiz.types";
import type { Grade } from "./scheduler";

/**
 * Calculates coin value for a single character grade.
 *
 * @param grade - The grade awarded for a word
 * @returns Number of coins earned for this grade
 */
export function calculateCoinValue(grade: Grade): number {
  switch (grade) {
    case "easy":
      return 5;
    case "good":
      return 3;
    case "hard":
      return 1;
    case "again":
      return 0;
    default:
      return 0;
  }
}

/**
 * Calculates coin value for a single grade-data entry, branching on whether
 * it's a character grade (the tiered table above) or a vocab-phrase round
 * (flat 1 coin on a correct answer, 0 otherwise).
 *
 * @param entry - A single grade-data entry from a quiz session
 * @returns Number of coins earned for this entry
 */
export function calculateCoinValueForEntry(entry: SessionGradeData): number {
  if (entry.isVocabPhrase) {
    return entry.grade === "easy" ? 1 : 0;
  }

  return calculateCoinValue(entry.grade);
}

/**
 * Calculates a paragraph-quiz session's one-time, session-level coin award,
 * judged as an error RATE (not a raw incorrect-tries count) so the same
 * accuracy pays the same regardless of paragraph length: a few honest
 * misclicks across a 40-blank paragraph shouldn't fare worse than the same
 * rate of mistakes on a 5-blank one. Buckets mirror the ~20-blank
 * pagination reference size established elsewhere (25/50/75% == the
 * original 5/10/15 absolute-count thresholds at that reference size).
 *
 * @param totalIncorrectTries - Sum of every blank's retryCount in the session
 * @param totalBlanks - Total number of blanks in the session
 * @returns Flat coin award for the whole session (50/40/20/10)
 */
export function calculateParagraphQuizSessionCoins(totalIncorrectTries: number, totalBlanks: number): number {
  if (totalBlanks <= 0) return 0;
  const errorRate = totalIncorrectTries / totalBlanks;
  if (errorRate < 0.25) return 50;
  if (errorRate < 0.5) return 40;
  if (errorRate < 0.75) return 20;
  return 10;
}

/**
 * Calculates total coins for a quiz session.
 *
 * A session with ANY isParagraphBlank entry is treated as a paragraph quiz
 * in its entirety (a session is never a mix -- see feature spec) and short-
 * circuits to the session-level calculateParagraphQuizSessionCoins formula
 * instead of the per-entry sum below. Otherwise, sums coin values from all
 * individual grade entries (character and vocab-phrase alike).
 *
 * @param gradeData - Array of grade entries from a quiz session
 * @returns Total coins earned in the session
 */
export function calculateSessionCoins(gradeData: SessionGradeData[]): number {
  if (gradeData.some((entry) => entry.isParagraphBlank)) {
    const totalIncorrectTries = gradeData.reduce((sum, entry) => sum + (entry.retryCount ?? 0), 0);
    const totalBlanks = gradeData.filter((entry) => entry.isParagraphBlank).length;
    return calculateParagraphQuizSessionCoins(totalIncorrectTries, totalBlanks);
  }

  return gradeData.reduce((total, entry) => {
    return total + calculateCoinValueForEntry(entry);
  }, 0);
}
