/**
 * Paragraph Quiz Builder — Pagination + Word-Bank Helpers
 *
 * Pure functions, no I/O. Domain layer (no src/app/** imports), mirrors
 * paragraphLibrary.ts's / paragraphTriage.ts's placement.
 *
 * Splits a paragraph's packaged blanks (a test mode's span_ids, already
 * resolved to real spans on the paragraph) into pages of ~20 blanks each,
 * never splitting one sentence's blanks across a page boundary -- mirrors
 * Content Admin's "entire character block stays together on the earlier
 * page, even when that page exceeds the nominal row count" precedent
 * (0_ARCHITECTURE.md, Content Admin Curation Rule 20). Each page also gets
 * its own shuffled word-bank order, scoped to that page's blanks only.
 */

import type { Paragraph, ParagraphSpan } from "./paragraph.types";
import type { Grade } from "./scheduler";

export type ParagraphQuizBlank = {
  spanId: string;
  sentenceIndex: number;
  startOffset: number;
  text: string;
  wordId?: string;
  vocabPhraseId?: string;
};

export type ParagraphQuizPage = {
  pageIndex: number;
  sentences: { index: number; text: string; blankSpanIds: string[] }[];
  bankSpanIds: string[];
};

function toBlank(span: ParagraphSpan, sentenceIndex: number): ParagraphQuizBlank {
  return {
    spanId: span.id,
    sentenceIndex,
    startOffset: span.startOffset,
    text: span.text,
    wordId: span.resolvedWordId,
    vocabPhraseId: span.resolvedVocabPhraseId,
  };
}

/**
 * Resolves every requested blank span id against the paragraph's current
 * spans, in paragraph reading order. A span id that no longer resolves on
 * this paragraph (deleted/edited since the test mode was packaged) is
 * silently dropped -- mirrors the skip-invalid-silently precedent used
 * elsewhere (e.g. resultsReviewTestSession.ts, paragraphLibrary.ts). A span
 * id seen more than once (a corrupted paragraph with a duplicated span --
 * see build-fix-log-2026-08-20-paragraph-quiz-bank-duplicate-blank.md) is
 * also silently collapsed to its first occurrence, so a stale duplicate can
 * never render two identical word-bank entries sharing one React key.
 */
export function resolveParagraphQuizBlanks(paragraph: Paragraph, blankSpanIds: string[]): ParagraphQuizBlank[] {
  const wanted = new Set(blankSpanIds);
  const seen = new Set<string>();
  const blanks: ParagraphQuizBlank[] = [];

  for (const sentence of paragraph.sentences) {
    const sentenceSpans = sentence.spans
      .filter((span) => wanted.has(span.id))
      .sort((a, b) => a.startOffset - b.startOffset);
    for (const span of sentenceSpans) {
      if (seen.has(span.id)) continue;
      seen.add(span.id);
      blanks.push(toBlank(span, sentence.index));
    }
  }

  return blanks;
}

/**
 * Groups a paragraph's blanks into pages of ~targetBlanksPerPage, never
 * splitting a sentence's blanks across a page boundary -- accumulates whole
 * sentences onto the current page until the next sentence would push it
 * over the target, then starts a new page. A single sentence with more
 * blanks than the target (pathological, but not impossible) still stays
 * whole on one page: the "current page has 0 blanks so far" guard is what
 * prevents an infinite loop / an unfillable page in that case.
 */
export function buildParagraphQuizPages(
  paragraph: Paragraph,
  blankSpanIds: string[],
  targetBlanksPerPage = 20
): ParagraphQuizPage[] {
  const blanks = resolveParagraphQuizBlanks(paragraph, blankSpanIds);
  if (blanks.length === 0) return [];

  const blanksBySentence = new Map<number, ParagraphQuizBlank[]>();
  for (const blank of blanks) {
    const list = blanksBySentence.get(blank.sentenceIndex) ?? [];
    list.push(blank);
    blanksBySentence.set(blank.sentenceIndex, list);
  }

  const sentenceIndexesWithBlanks = paragraph.sentences
    .map((sentence) => sentence.index)
    .filter((index) => blanksBySentence.has(index));

  const pages: ParagraphQuizPage[] = [];
  let currentSentences: { index: number; text: string; blankSpanIds: string[] }[] = [];
  let currentBlankCount = 0;

  const flushPage = () => {
    if (currentSentences.length === 0) return;
    const bankSpanIds = currentSentences.flatMap((sentence) => sentence.blankSpanIds);
    pages.push({
      pageIndex: pages.length,
      sentences: currentSentences,
      bankSpanIds: shuffleBankOrder(bankSpanIds),
    });
    currentSentences = [];
    currentBlankCount = 0;
  };

  for (const sentenceIndex of sentenceIndexesWithBlanks) {
    const sentence = paragraph.sentences.find((s) => s.index === sentenceIndex);
    if (!sentence) continue;
    const sentenceBlanks = blanksBySentence.get(sentenceIndex) ?? [];

    if (currentBlankCount > 0 && currentBlankCount + sentenceBlanks.length > targetBlanksPerPage) {
      flushPage();
    }

    currentSentences.push({
      index: sentence.index,
      text: sentence.text,
      blankSpanIds: sentenceBlanks.map((b) => b.spanId),
    });
    currentBlankCount += sentenceBlanks.length;
  }
  flushPage();

  return pages;
}

/**
 * Deterministic-seedable Fisher-Yates shuffle for the per-page word bank
 * order. A fixed seed produces a reproducible permutation (for tests);
 * omitting it falls back to Math.random().
 */
export function shuffleBankOrder(spanIds: string[], seed?: number): string[] {
  const result = [...spanIds];
  const random = seed === undefined ? Math.random : createSeededRandom(seed);

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/** Small linear-congruential PRNG for reproducible-with-a-seed shuffling. */
function createSeededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/**
 * Derives a blank's earned grade tier from its retry count (wrong attempts
 * before the eventual correct placement): first-try-correct (0 wrong
 * attempts) -> easy, correct on the second attempt (1) -> good, correct on
 * the third attempt or later (2+) -> hard. There is no "again" outcome -- a
 * closed matching puzzle (every bank item has exactly one correct home) is
 * always eventually solvable by elimination, and completion requires every
 * blank correct, so "never correct" can't happen.
 */
export function deriveParagraphBlankTier(retryCount: number): Grade {
  if (retryCount <= 0) return "easy";
  if (retryCount === 1) return "good";
  return "hard";
}
