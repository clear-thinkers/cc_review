/**
 * Quiz session domain types.
 *
 * Owned by the lib layer because quiz sessions are persisted records and are
 * consumed by service/domain utilities outside the UI tree.
 */
export type SessionGradeData = {
  wordId: string; // Reference to word.id
  hanzi: string; // Character reviewed
  grade: "again" | "hard" | "good" | "easy"; // Grade given
  timestamp?: number; // When this individual grade was submitted (optional)
};

export type QuizSession = {
  id: string; // Unique session ID - generated as UUID or makeId()
  createdAt: number; // Unix timestamp (milliseconds) when session ended
  sessionType: "fill-test"; // Reserved for future quiz types
  gradeData: SessionGradeData[]; // Array of individual word grades
  fullyCorrectCount: number; // Count of grades === "easy"
  failedCount: number; // Count of grades === "again"
  partiallyCorrectCount: number; // Count of grades === "good" or "hard"
  totalGrades: number; // Total count of all grades
  durationSeconds: number; // Total elapsed time in seconds from start to completion
  coinsEarned: number; // Coins earned during this session
};

export type ResultsSummaryStats = {
  totalSessions: number;
  fullyCorrectPercent: number;
  failedPercent: number;
  partiallyCorrectPercent: number;
  totalCharactersTested: number;
  totalCharactersFailed: number;
  totalDurationSeconds: number;
  totalCoinsEarned: number;
};

export type SessionDisplayData = QuizSession & {
  fullyCorrectPercent: number;
  failedPercent: number;
  partiallyCorrectPercent: number;
  charactersTested: string[];
  charactersFailed: string[];
  durationDisplay: string;
  sessionDate: string;
};

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
