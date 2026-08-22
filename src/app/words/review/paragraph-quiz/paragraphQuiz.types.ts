import type { Grade } from "@/lib/scheduler";
import type { FlashcardMeaning } from "@/lib/flashcardLlm";
import type { VocabPhraseExample } from "@/lib/types";

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
  /**
   * Keyed by a WORD-BANK ITEM's own spanId -- how many times THIS item has
   * been dragged onto any wrong blank, cumulative across every target blank
   * it was tried on. Drives reveal-after-3-bounces eligibility for that bank
   * item (fix 2, feature spec 2026-08-22, corrected same day) -- distinct
   * from ParagraphQuizBlankProgress.retryCount, which counts wrong attempts
   * AT a target blank regardless of which bank item caused them. Optional
   * for backward compatibility with progress rows saved before this field
   * existed; absent means every item's count is 0.
   */
  wrongDragCounts?: Record<string, number>;
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

/**
 * Reveal-after-3-bounces content (feature spec 2026-08-22). One entry per
 * flashcard_contents row sharing the blank's character -- a character with
 * multiple curated pronunciations shows all of them, never guesses one.
 */
export type ParagraphQuizCharacterRevealEntry = {
  pronunciation: string;
  meanings: FlashcardMeaning[];
};

export type ParagraphQuizCharacterRevealContent = {
  kind: "character";
  hanzi: string;
  entries: ParagraphQuizCharacterRevealEntry[];
};

/** The FIRST include_in_fill_test example only (resolved 2026-08-22, not random). */
export type ParagraphQuizPhraseRevealContent = {
  kind: "phrase";
  phrase: string;
  pinyin: string;
  meaningZh?: string;
  meaningEn?: string;
  example?: VocabPhraseExample;
};

export type ParagraphQuizRevealContent = ParagraphQuizCharacterRevealContent | ParagraphQuizPhraseRevealContent;
