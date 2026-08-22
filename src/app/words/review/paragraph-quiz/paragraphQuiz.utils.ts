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
import type { Word, VocabPhrase } from "@/lib/types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type {
  ParagraphQuizBlankProgress,
  ParagraphQuizCharacterRevealContent,
  ParagraphQuizHistoryItem,
  ParagraphQuizPhraseRevealContent,
} from "./paragraphQuiz.types";

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

/**
 * Reveal-after-3-bounces (feature spec 2026-08-22). A blank's word bank item
 * "bounces back" on every wrong drop, bumping retryCount (handlePlacement in
 * ParagraphQuizReviewSection.tsx) -- reveal becomes available once that
 * count reaches 3. Purely a display gate: it never affects
 * deriveParagraphBlankTier or any grading/coin path above.
 */
const REVEAL_RETRY_THRESHOLD = 3;

export function isRevealEligible(retryCount: number): boolean {
  return retryCount >= REVEAL_RETRY_THRESHOLD;
}

/**
 * All flashcard_contents entries sharing this word's hanzi, stacked --
 * resolved 2026-08-22: never guesses which pronunciation is "the" one for
 * this blank. Returns null (not an empty-entries object) when the character
 * has no curated content yet, mirroring the codebase's existing
 * skip-invalid-silently precedent (e.g. resultsReviewTestSession.ts).
 */
export function resolveCharacterRevealContent(
  word: Word,
  allFlashcardContents: FlashcardContentEntry[]
): ParagraphQuizCharacterRevealContent | null {
  const entries = allFlashcardContents
    .filter((entry) => entry.character === word.hanzi)
    .map((entry) => ({ pronunciation: entry.pronunciation, meanings: entry.content.meanings }));

  if (entries.length === 0) {
    return null;
  }

  return { kind: "character", hanzi: word.hanzi, entries };
}

/**
 * Resolved 2026-08-22: shows only the FIRST include_in_fill_test example
 * (deterministic), a deliberate deviation from the ordinary phrase-round
 * quiz's random-example-selection precedent -- reproducibility beats
 * variety for a read-only reveal popup.
 */
export function resolvePhraseRevealContent(vocabPhrase: VocabPhrase): ParagraphQuizPhraseRevealContent {
  return {
    kind: "phrase",
    phrase: vocabPhrase.phrase,
    pinyin: vocabPhrase.pinyin ?? "",
    meaningZh: vocabPhrase.meaningZh,
    meaningEn: vocabPhrase.meaningEn,
    example: vocabPhrase.examples.find((example) => example.includeInFillTest),
  };
}
