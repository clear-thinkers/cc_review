import type { Grade } from "@/lib/scheduler";

/**
 * Per-page paragraph-quiz autosave state. Persisted via the EXISTING
 * review_session_progress machinery (source_type: "packaged",
 * packaged_session_id = review_test_sessions.id -- exactly the packaged
 * flow every other session kind already uses) -- no new table, no new
 * source_type value, since the paragraph-quiz discriminator
 * (session.paragraphTestModeId) is already known before progress_data is
 * even inspected. Mirrors DueReviewProgressData's placement/shape
 * (src/app/words/review/fill-test/fillTest.types.ts), but per-blank
 * (keyed by paragraph span id) rather than a flat quiz queue, since a
 * paragraph quiz's unit of progress is "which blanks are already correct
 * and how many wrong tries each took," not "which word in a linear queue."
 */
export type ParagraphQuizBlankProgress = {
  status: "correct" | "unfilled";
  retryCount: number;
};

export type ParagraphQuizProgressData = {
  testModeId: string;
  currentPageIndex: number;
  /** Keyed by paragraph span id (ParagraphQuizBlank.spanId). */
  blankState: Record<string, ParagraphQuizBlankProgress>;
  sessionStartTime: number | null;
};

/** A single completed grade entry for the results/coins pipeline. */
export type ParagraphQuizHistoryItem = {
  spanId: string;
  wordId?: string;
  vocabPhraseId?: string;
  text: string;
  tier: Grade;
  retryCount: number;
};
