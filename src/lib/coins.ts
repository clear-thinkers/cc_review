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
 * Last updated: 2026-08-13
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
 * Calculates total coins for a quiz session.
 *
 * Sums coin values from all individual grade entries (character and
 * vocab-phrase alike).
 *
 * @param gradeData - Array of grade entries from a quiz session
 * @returns Total coins earned in the session
 */
export function calculateSessionCoins(gradeData: SessionGradeData[]): number {
  return gradeData.reduce((total, entry) => {
    return total + calculateCoinValueForEntry(entry);
  }, 0);
}
