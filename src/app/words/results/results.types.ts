/**
 * Quiz Results Feature Types
 *
 * Defines data structures for quiz session tracking and results reporting.
 * Designed for extensibility: future quiz types will add new sessionType values.
 *
 * Last updated: 2026-03-04
 */

/**
 * Individual word grade within a quiz session.
 *
 * Captures grade-level data for per-word session details and calculations.
 * Used to derive: characters tested, characters failed, accuracy percentages.
 */
export type SessionGradeData = {
  wordId: string; // Reference to word.id
  hanzi: string; // Character reviewed
  grade: "again" | "hard" | "good" | "easy"; // Grade given
  timestamp?: number; // When this individual grade was submitted (optional)
};

/**
 * Complete quiz session record.
 *
 * Persisted in `quizSessions` IndexedDB table.
 * One record per completed fill-test session.
 * Designed for extensibility: Phase 3+ will add new sessionType values (e.g., "multi-choice", "flashcard-graded").
 */
export type QuizSession = {
  id: string; // Unique session ID — generated as UUID or makeId()
  createdAt: number; // Unix timestamp (milliseconds) when session ended
  sessionType: "fill-test"; // Currently only "fill-test"; reserved for future quiz types (Phase 3+)
  gradeData: SessionGradeData[]; // Array of individual word grades
  fullyCorrectCount: number; // Count of grades === "easy"
  failedCount: number; // Count of grades === "again"
  partiallyCorrectCount: number; // Count of grades === "good" or "hard"
  totalGrades: number; // Total count of all grades (fullyCorrect + failed + partiallyCorrect)
  durationSeconds: number; // Total elapsed time in seconds from session start to completion
  coinsEarned: number; // Initially `0`; updated by Rewards System (Phase 3)
};

/**
 * Calculated summary statistics for the session history.
 *
 * Derived from QuizSession[] array via calculateSummaryStats().
 * Used to populate summary cards on results page.
 */
export type ResultsSummaryStats = {
  totalSessions: number;
  fullyCorrectPercent: number; // Weighted average: sum(fullyCorrectCounts) / sum(totalGrades) * 100
  failedPercent: number; // Weighted average: sum(failedCounts) / sum(totalGrades) * 100
  partiallyCorrectPercent: number; // Weighted average: sum(partiallyCorrectCounts) / sum(totalGrades) * 100
  totalCharactersTested: number; // Sum of all unique characters tested across all sessions
  totalCharactersFailed: number; // Sum of all characters graded "again" across all sessions
  totalDurationSeconds: number; // Sum of all session durations
  totalCoinsEarned: number; // Sum of all coins earned (currently 0 for Phase 1)
};

/**
 * Derived session display data.
 *
 * Computed from QuizSession for display in the session history table.
 * Includes calculated fields like character lists and formatted duration.
 */
export type SessionDisplayData = QuizSession & {
  fullyCorrectPercent: number; // (fullyCorrectCount / totalGrades) * 100, rounded to nearest integer
  failedPercent: number; // (failedCount / totalGrades) * 100, rounded to nearest integer
  partiallyCorrectPercent: number; // (partiallyCorrectCount / totalGrades) * 100, rounded to nearest integer
  charactersTested: string[]; // Unique Hanzi in order tested, deduped
  charactersFailed: string[]; // Unique Hanzi of "again" grades, in order failed, deduped
  durationDisplay: string; // Human-readable format: "Xm Ys" (e.g., "4m 32s")
  sessionDate: string; // Human-readable date (e.g., "Mar 4, 2026")
};

/**
 * Validation and schema enforcement for QuizSession records.
 *
 * Used during session creation to ensure data integrity before persistence.
 */
export function isValidSessionType(value: unknown): value is "fill-test" {
  return value === "fill-test";
}

export function isValidGrade(value: unknown): value is SessionGradeData["grade"] {
  return value === "again" || value === "hard" || value === "good" || value === "easy";
}

export function isValidGradeData(data: unknown): data is SessionGradeData {
  if (typeof data !== "object" || data === null) return false;
  const g = data as Record<string, unknown>;
  return (
    typeof g.wordId === "string" &&
    typeof g.hanzi === "string" &&
    isValidGrade(g.grade) &&
    (g.timestamp === undefined || typeof g.timestamp === "number")
  );
}

export function isValidQuizSession(data: unknown): data is QuizSession {
  if (typeof data !== "object" || data === null) return false;
  const s = data as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.createdAt === "number" &&
    isValidSessionType(s.sessionType) &&
    Array.isArray(s.gradeData) &&
    s.gradeData.every(isValidGradeData) &&
    typeof s.fullyCorrectCount === "number" &&
    typeof s.failedCount === "number" &&
    typeof s.partiallyCorrectCount === "number" &&
    typeof s.totalGrades === "number" &&
    typeof s.durationSeconds === "number" &&
    typeof s.coinsEarned === "number"
  );
}
