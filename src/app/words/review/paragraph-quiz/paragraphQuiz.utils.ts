/**
 * Paragraph Quiz — pure page/completion/grade-data helpers.
 *
 * Extracted per 0_BUILD_CONVENTIONS.md §6's UI seam priority (pure helpers
 * tested directly, ahead of a section-level smoke test) -- the branching
 * logic ParagraphQuizReviewSection.tsx needs (is this page done? is the
 * whole session done? what does one completed session's SessionGradeData
 * look like?) is app-layer (imports ParagraphQuizPage/ParagraphQuizBlank
 * from the domain layer plus SessionGradeData), so it lives alongside the
 * component rather than in the domain-only src/lib/paragraphQuizBuilder.ts.
 */

import type { ParagraphQuizPage } from "@/lib/paragraphQuizBuilder";
import { deriveParagraphBlankTier } from "@/lib/paragraphQuizBuilder";
import type { SessionGradeData } from "@/lib/quiz.types";
import type { ParagraphQuizBlankProgress, ParagraphQuizHistoryItem } from "./paragraphQuiz.types";

export function isPageComplete(
  page: ParagraphQuizPage,
  blankState: Record<string, ParagraphQuizBlankProgress>
): boolean {
  return page.bankSpanIds.every((spanId) => blankState[spanId]?.status === "correct");
}

export function isQuizComplete(
  pages: ParagraphQuizPage[],
  blankState: Record<string, ParagraphQuizBlankProgress>
): boolean {
  return pages.length > 0 && pages.every((page) => isPageComplete(page, blankState));
}

/** First page (by array order) that still has an unfilled blank, or -1 if none. */
export function findNextIncompletePageIndex(
  pages: ParagraphQuizPage[],
  blankState: Record<string, ParagraphQuizBlankProgress>
): number {
  return pages.findIndex((page) => !isPageComplete(page, blankState));
}

/**
 * Builds the SessionGradeData array for a completed paragraph-quiz session,
 * consumed by both recordQuizSession (quiz_sessions.grade_data) and
 * calculateSessionCoins's isParagraphBlank branch. wordId holds the
 * resolved words/vocab_phrases id (whichever the blank targets); hanzi
 * holds the blank's own text, matching the display role every other
 * SessionGradeData entry already gives that field.
 */
export function buildParagraphQuizGradeData(historyItems: ParagraphQuizHistoryItem[]): SessionGradeData[] {
  return historyItems.map((item) => ({
    wordId: item.wordId ?? item.vocabPhraseId ?? item.spanId,
    hanzi: item.text,
    grade: item.tier,
    isParagraphBlank: true,
    retryCount: item.retryCount,
  }));
}

/** Convenience wrapper: retryCount -> tier, re-exported so callers only import from this module. */
export { deriveParagraphBlankTier };
