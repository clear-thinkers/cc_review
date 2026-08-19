/**
 * Paragraph Library — Filtering Helpers
 *
 * Pure functions, no I/O. Domain layer (no src/app/** imports), mirrors
 * paragraphTriage.ts's placement. Tag-membership matching itself reuses the
 * existing matchesSelectedTagFilter/NO_TAG_FILTER_ID convention from
 * src/app/words/shared/tagFilter.utils.ts unchanged (per the decision to
 * mirror /words/all's Tags Cascade filter exactly) -- this module only adds
 * what /words/all doesn't already have: resolving a PARAGRAPH's tag set
 * (the union across its resolved spans' underlying words/vocab_phrases,
 * since a paragraph carries no tags of its own) and a title filter.
 */

import type { Paragraph } from "./paragraph.types";
import type { VocabPhraseLessonTagsMap, WordLessonTagsMap } from "./tagging.types";

/**
 * Union of lesson-tag ids across every resolved span in a paragraph. A span
 * whose resolvedWordId/resolvedVocabPhraseId no longer matches any current
 * row (deleted since) simply contributes no tags -- silent skip, matching
 * the skip-invalid-silently precedent used elsewhere (e.g.
 * resultsReviewTestSession.ts).
 */
export function resolveParagraphTagIds(
  paragraph: Paragraph,
  wordTagsMap: WordLessonTagsMap,
  vocabPhraseTagsMap: VocabPhraseLessonTagsMap
): Set<string> {
  const tagIds = new Set<string>();

  for (const sentence of paragraph.sentences) {
    for (const span of sentence.spans) {
      if (span.resolvedWordId) {
        for (const tag of wordTagsMap.get(span.resolvedWordId) ?? []) {
          tagIds.add(tag.lessonTagId);
        }
      }
      if (span.resolvedVocabPhraseId) {
        for (const tag of vocabPhraseTagsMap.get(span.resolvedVocabPhraseId) ?? []) {
          tagIds.add(tag.lessonTagId);
        }
      }
    }
  }

  return tagIds;
}

/** Case-insensitive title substring match; always true for an empty/whitespace query. */
export function matchesParagraphTitleFilter(paragraph: Paragraph, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (!paragraph.title) return false;
  return paragraph.title.toLowerCase().includes(trimmed.toLowerCase());
}
