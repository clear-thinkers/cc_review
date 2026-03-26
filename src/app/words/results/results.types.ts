/**
 * UI compatibility re-export for quiz session types.
 *
 * Quiz session records are owned by the lib layer because they are persisted
 * domain/service data used outside the UI tree.
 */
export type {
  QuizSession,
  ResultsSummaryStats,
  SessionDisplayData,
  SessionGradeData,
} from "@/lib/quiz.types";

export {
  isValidGrade,
  isValidGradeData,
  isValidQuizSession,
  isValidSessionType,
} from "@/lib/quiz.types";
