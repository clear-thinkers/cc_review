/**
 * Coin Rewards System — Domain Layer
 *
 * Pure functions for coin value calculation from quiz grades.
 * No side effects; no database access.
 *
 * Earning rules:
 * - grade="easy" → 5 coins
 * - grade="good" → 3 coins
 * - grade="hard" → 1 coin
 * - grade="again" → 0 coins
 *
 * Last updated: 2026-03-04
 */

import type { SessionGradeData } from "@/app/words/results/results.types";

export type Grade = "easy" | "good" | "hard" | "again";

/**
 * Calculates coin value for a single grade.
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
 * Calculates total coins for a quiz session.
 *
 * Sums coin values from all individual word grades.
 *
 * @param gradeData - Array of grade entries from a quiz session
 * @returns Total coins earned in the session
 */
export function calculateSessionCoins(gradeData: SessionGradeData[]): number {
  return gradeData.reduce((total, entry) => {
    const coinValue = calculateCoinValue(entry.grade as Grade);
    return total + coinValue;
  }, 0);
}
