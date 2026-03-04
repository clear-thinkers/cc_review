/**
 * Quiz Results Domain Logic
 *
 * Pure functions for calculating accuracy, durations, and summary statistics.
 * No side effects, no database access — these are computation utilities.
 *
 * Last updated: 2026-03-04
 */

import type {
  QuizSession,
  SessionGradeData,
  ResultsSummaryStats,
  SessionDisplayData,
} from "@/app/words/results/results.types";

/**
 * Calculate the percentage of grades that are "easy" (fully correct).
 *
 * Only "easy" grades count toward fully correct percentage.
 * Rounded to nearest integer.
 */
export function calculateFullyCorrectPercent(gradeCounts: {
  fullyCorrectCount: number;
  totalGrades: number;
}): number {
  if (gradeCounts.totalGrades === 0) return 0;
  return Math.round((gradeCounts.fullyCorrectCount / gradeCounts.totalGrades) * 100);
}

/**
 * Calculate the percentage of grades that are "again" (failed).
 *
 * Only "again" grades count toward failed percentage.
 * Rounded to nearest integer.
 */
export function calculateFailedPercent(gradeCounts: {
  failedCount: number;
  totalGrades: number;
}): number {
  if (gradeCounts.totalGrades === 0) return 0;
  return Math.round((gradeCounts.failedCount / gradeCounts.totalGrades) * 100);
}

/**
 * Calculate the percentage of grades that are "good" or "hard" (partially correct).
 *
 * Both "good" and "hard" count as partially correct.
 * Rounded to nearest integer.
 */
export function calculatePartiallyCorrectPercent(gradeCounts: {
  partiallyCorrectCount: number;
  totalGrades: number;
}): number {
  if (gradeCounts.totalGrades === 0) return 0;
  return Math.round((gradeCounts.partiallyCorrectCount / gradeCounts.totalGrades) * 100);
}

/**
 * Extract and deduplicate all tested characters (Hanzi) in order.
 *
 * Returns unique Hanzi in the order they were tested.
 * If the same character is tested multiple times in one session,
 * only the first occurrence is included.
 */
export function getTestedCharacters(gradeData: SessionGradeData[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of gradeData) {
    if (!seen.has(item.hanzi)) {
      result.push(item.hanzi);
      seen.add(item.hanzi);
    }
  }
  return result;
}

/**
 * Extract and deduplicate all failed characters (grade="again") in order.
 *
 * Returns unique Hanzi that were graded as "again", in order failed.
 * Only counts "again" grades; "hard" and "good" are not failures.
 */
export function getFailedCharacters(gradeData: SessionGradeData[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of gradeData) {
    if (item.grade === "again" && !seen.has(item.hanzi)) {
      result.push(item.hanzi);
      seen.add(item.hanzi);
    }
  }
  return result;
}

/**
 * Format duration in seconds to human-readable string.
 *
 * Examples: "4m 32s", "1m 5s", "45s", "1h 2m"
 * Less than 1 second displays as "<1s".
 */
export function formatDuration(durationSeconds: number): string {
  if (durationSeconds < 1) return "<1s";

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Format a date timestamp to human-readable string.
 *
 * Examples: "Mar 4, 2026", "Jan 1, 2026"
 * Uses browser locale if available, otherwise uses standardized format.
 */
export function formatSessionDate(createdAt: number): string {
  const date = new Date(createdAt);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date timestamp in a locale-aware way.
 *
 * For Chinese displays, this uses locale-specific formatting.
 */
export function formatSessionDateLocale(createdAt: number, locale: string): string {
  const date = new Date(createdAt);
  if (locale === "zh") {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  }
  return formatSessionDate(createdAt);
}

/**
 * Compute derived display data for a single session.
 *
 * Takes a QuizSession and calculates percentages, character lists,
 * formatted duration, and formatted date for display.
 */
export function computeSessionDisplayData(session: QuizSession, locale = "en"): SessionDisplayData {
  const fullyCorrectPercent = calculateFullyCorrectPercent({
    fullyCorrectCount: session.fullyCorrectCount,
    totalGrades: session.totalGrades,
  });

  const failedPercent = calculateFailedPercent({
    failedCount: session.failedCount,
    totalGrades: session.totalGrades,
  });

  const partiallyCorrectPercent = calculatePartiallyCorrectPercent({
    partiallyCorrectCount: session.partiallyCorrectCount,
    totalGrades: session.totalGrades,
  });

  const charactersTested = getTestedCharacters(session.gradeData);
  const charactersFailed = getFailedCharacters(session.gradeData);
  const durationDisplay = formatDuration(session.durationSeconds);
  const sessionDate = formatSessionDateLocale(session.createdAt, locale);

  return {
    ...session,
    fullyCorrectPercent,
    failedPercent,
    partiallyCorrectPercent,
    charactersTested,
    charactersFailed,
    durationDisplay,
    sessionDate,
  };
}

/**
 * Calculate summary statistics across all sessions.
 *
 * Computes weighted averages for accuracy metrics and sums for totals.
 * Designed to populate summary cards.
 *
 * Rules:
 * - % Fully Correct = sum(fullyCorrectCounts) / sum(totalGrades) * 100
 * - % Failed = sum(failedCounts) / sum(totalGrades) * 100
 * - % Partially Correct = sum(partiallyCorrectCounts) / sum(totalGrades) * 100
 * - Total Characters Tested = sum of unique characters across all sessions (any grade)
 * - Total Characters Failed = sum of unique characters graded "again" across all sessions
 * - Total Duration = sum of all durationSeconds, converted to hours:minutes:seconds
 * - Total Coins = sum of all coinsEarned
 */
export function calculateSummaryStats(sessions: QuizSession[]): ResultsSummaryStats {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      fullyCorrectPercent: 0,
      failedPercent: 0,
      partiallyCorrectPercent: 0,
      totalCharactersTested: 0,
      totalCharactersFailed: 0,
      totalDurationSeconds: 0,
      totalCoinsEarned: 0,
    };
  }

  // Accumulate counts for weighted averages
  let totalFullyCorrect = 0;
  let totalFailed = 0;
  let totalPartially = 0;
  let totalGrades = 0;

  // Accumulate characters tested and failed (deduplicated across all sessions)
  const allTestedCharacters = new Set<string>();
  const allFailedCharacters = new Set<string>();

  // Accumulate duration and coins
  let totalDurationSeconds = 0;
  let totalCoinsEarned = 0;

  for (const session of sessions) {
    totalFullyCorrect += session.fullyCorrectCount;
    totalFailed += session.failedCount;
    totalPartially += session.partiallyCorrectCount;
    totalGrades += session.totalGrades;

    for (const item of session.gradeData) {
      allTestedCharacters.add(item.hanzi);
      if (item.grade === "again") {
        allFailedCharacters.add(item.hanzi);
      }
    }

    totalDurationSeconds += session.durationSeconds;
    totalCoinsEarned += session.coinsEarned;
  }

  const fullyCorrectPercent =
    totalGrades > 0 ? Math.round((totalFullyCorrect / totalGrades) * 100) : 0;
  const failedPercent = totalGrades > 0 ? Math.round((totalFailed / totalGrades) * 100) : 0;
  const partiallyCorrectPercent =
    totalGrades > 0 ? Math.round((totalPartially / totalGrades) * 100) : 0;

  return {
    totalSessions: sessions.length,
    fullyCorrectPercent,
    failedPercent,
    partiallyCorrectPercent,
    totalCharactersTested: allTestedCharacters.size,
    totalCharactersFailed: allFailedCharacters.size,
    totalDurationSeconds,
    totalCoinsEarned,
  };
}

/**
 * Format total duration for summary display.
 *
 * Converts seconds to "Xh Ym" format (hours and minutes only).
 * Examples: "2h 15m", "45m", "1h"
 */
export function formatTotalDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  return `${minutes}m`;
}
