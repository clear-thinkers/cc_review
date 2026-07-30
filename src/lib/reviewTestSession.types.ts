/**
 * Review test session domain types owned by the lib/service layer.
 *
 * These map directly to the review_test_sessions and
 * review_test_session_targets database tables read and written by
 * supabase-service.ts.
 *
 * UI-only review types (DueWordsSortKey, SortedDueWord,
 * ReviewTestSessionRuntime) remain in
 * src/app/words/review/review.types.ts.
 */

export type ReviewTestSessionTargetDraft = {
  character: string;
  pronunciation: string;
  key: string;
  // Set only for a vocab-phrase target. `character`/`pronunciation` above
  // still carry the phrase's own text/pinyin as denormalized display data
  // (the same role they already play for character targets); this field is
  // the discriminator that tells the grading/runtime layer "this target
  // grades against vocab_phrases, not words."
  vocabPhraseId?: string;
};

export type ReviewTestSessionTarget = ReviewTestSessionTargetDraft & {
  sessionId: string;
  displayOrder: number;
};

export type ReviewTestSession = {
  id: string;
  name: string;
  createdAt: number;
  createdByUserId: string;
  completedAt: number | null;
  completedByUserId: string | null;
  targets: ReviewTestSessionTarget[];
};
