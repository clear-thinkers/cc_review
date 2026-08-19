/**
 * Paragraph Import — Sentence Splitting
 *
 * Pure functions, no I/O. Splits pasted running prose into sentences for
 * /words/add-paragraph. No existing precedent splits running prose:
 * extractUniqueHanzi (words.shared.utils.tsx) explodes text into individual
 * characters, and parseCommaSeparatedPhrases (addIngestion.ts) splits an
 * already-flat, already-delimited list. This is new logic.
 */

import type { ParagraphSentence } from "./paragraph.types";

/**
 * Soft cap on pasted input length (docs/feature-specs/2026-08-17-add-paragraph-article-import.md,
 * Open Question 2): pastes longer than this are truncated with a notice
 * rather than blocked outright or left unbounded.
 */
export const MAX_PARAGRAPH_INPUT_LENGTH = 5000;

export function truncateParagraphInput(rawText: string): { text: string; truncated: boolean } {
  if (rawText.length <= MAX_PARAGRAPH_INPUT_LENGTH) {
    return { text: rawText, truncated: false };
  }
  return { text: rawText.slice(0, MAX_PARAGRAPH_INPUT_LENGTH), truncated: true };
}

const SENTENCE_END_RE = /([。！？!?])/;
const PARAGRAPH_BREAK_RE = /\n{2,}/;

/**
 * Splits on Chinese/ASCII sentence-ending punctuation (。！？!?) and treats
 * single newlines as sentence boundaries too. Two or more consecutive
 * newlines between sentences mark the following sentence with
 * `paragraphBreakBefore: true` (rendering-only, per the feature spec's Data
 * model). Trims each sentence; empties are dropped.
 */
export function splitIntoSentences(
  rawText: string
): { text: string; paragraphBreakBefore: boolean }[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(PARAGRAPH_BREAK_RE);
  const results: { text: string; paragraphBreakBefore: boolean }[] = [];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split("\n");
    const blockSentences: string[] = [];

    for (const line of lines) {
      const parts = line.split(SENTENCE_END_RE);
      let current = "";
      for (const part of parts) {
        current += part;
        if (SENTENCE_END_RE.test(part)) {
          const trimmed = current.trim();
          if (trimmed) blockSentences.push(trimmed);
          current = "";
        }
      }
      const remainder = current.trim();
      if (remainder) blockSentences.push(remainder);
    }

    blockSentences.forEach((sentenceText, sentenceIndex) => {
      results.push({
        text: sentenceText,
        paragraphBreakBefore: blockIndex > 0 && sentenceIndex === 0,
      });
    });
  });

  return results;
}

/** Wraps splitIntoSentences output into empty-span ParagraphSentence skeletons. */
export function buildParagraphSentences(rawText: string): ParagraphSentence[] {
  return splitIntoSentences(rawText).map((sentence, index) => ({
    index,
    text: sentence.text,
    paragraphBreakBefore: sentence.paragraphBreakBefore,
    spans: [],
  }));
}
