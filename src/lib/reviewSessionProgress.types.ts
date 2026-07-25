/**
 * Review session progress domain types owned by the lib/service layer.
 *
 * These map directly to the review_session_progress database table read and
 * written by supabase-service.ts. `progressData` is kept as `unknown` at this
 * layer — its concrete runtime-state shape (quiz queue, index, selections,
 * grade history, elapsed time) belongs to the UI/domain layer that consumes
 * it in a later task, not to the service layer.
 */

export type ReviewSessionProgressSourceType = "due_review" | "packaged";

export type ReviewSessionProgress = {
  id: string;
  userId: string;
  clientSessionKey: string;
  sourceType: ReviewSessionProgressSourceType;
  packagedSessionId: string | null;
  progressData: unknown;
  startedAt: number;
  lastSavedAt: number;
};
