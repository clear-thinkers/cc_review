/**
 * Add Feature — Ingestion Decision Helpers
 *
 * Pure functions extracted from the addWord workflow in words.shared.state.ts.
 * No side effects, no service calls, no React dependencies.
 *
 * These helpers own the three decision points that are otherwise tested
 * only through the full async addWord function:
 *   1. computeIngestionResult  — dedupe submitted chars against existing DB rows
 *   2. resolveAddNoticeType    — pick the correct post-submit notice
 *   3. isTagFormComplete       — validate tag section completeness before submit
 */

/**
 * Deduplicate submitted characters against the set already in the database.
 *
 * @param parsedCharacters - unique Hanzi extracted from user input (ordered)
 * @param existingHanzi    - hanzi values already present in the DB for this family
 * @returns hanziToAdd (net-new only) and skippedCount (duplicates dropped)
 */
export function computeIngestionResult(
  parsedCharacters: string[],
  existingHanzi: string[]
): { hanziToAdd: string[]; skippedCount: number } {
  const existingSet = new Set(existingHanzi);
  const hanziToAdd = parsedCharacters.filter((c) => !existingSet.has(c));
  const skippedCount = parsedCharacters.length - hanziToAdd.length;
  return { hanziToAdd, skippedCount };
}

/**
 * Select which post-submit notice to display.
 *
 * Mirrors the three-branch condition at the end of addWord:
 *   newCount === 0           → "noNew"       (all submitted chars already existed)
 *   newCount > 0, skipped>0 → "partialSuccess" (mix of new and existing)
 *   newCount > 0, skipped=0 → "allSuccess"  (all chars were new)
 */
export type AddNoticeType = "noNew" | "partialSuccess" | "allSuccess";

export function resolveAddNoticeType(newCount: number, skippedCount: number): AddNoticeType {
  if (newCount === 0) return "noNew";
  if (skippedCount > 0) return "partialSuccess";
  return "allSuccess";
}

/**
 * Return true when the tag form is either closed or fully filled.
 *
 * Mirrors the guard in addWord:
 *   addTagSectionOpen && (!resolvedTextbookId || !grade || !unit || !lesson)
 *
 * Returns false (invalid) when the section is open but any required field is missing.
 */
export function isTagFormComplete(
  sectionOpen: boolean,
  textbookId: string | null | undefined,
  grade: string | null | undefined,
  unit: string | null | undefined,
  lesson: string | null | undefined
): boolean {
  if (!sectionOpen) return true;
  return !!(textbookId && grade && unit && lesson);
}

/**
 * Batch Phrase Entry — Ingestion Decision Helpers
 *
 * Parallel to computeIngestionResult above, but for /words/add's batch
 * phrase entry mode. A phrase stays intact as one multi-character unit —
 * deliberately NOT extractUniqueHanzi, which explodes text into individual
 * Han characters.
 */

/**
 * Split a batch phrase list into distinct entries: splits on the ASCII and
 * full-width comma, whitespace, and line breaks (same delimiter tolerance
 * as the character batch-add rule), trims each entry, drops empties, and
 * dedupes while preserving first-seen order.
 */
export function parseCommaSeparatedPhrases(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input.split(/[,，\s]+/)) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Mirrors the vocab_phrases DB check constraint: 2-10 Chinese characters. */
export function isValidPhraseLength(phrase: string): boolean {
  const length = Array.from(phrase).length;
  return length >= 2 && length <= 10;
}

export type PhraseIngestionResult = {
  phrasesToAdd: string[];
  invalidPhrases: string[];
  skippedCount: number;
};

/**
 * Three-way split of a parsed phrase batch against the family's existing
 * vocab_phrases: invalid-length entries (reported, never inserted),
 * already-added entries (skipped, not re-inserted), and net-new phrasesToAdd.
 */
export function computePhraseIngestionResult(
  parsedPhrases: string[],
  existingPhrases: string[]
): PhraseIngestionResult {
  const existingSet = new Set(existingPhrases);
  const invalidPhrases: string[] = [];
  const validPhrases: string[] = [];

  for (const phrase of parsedPhrases) {
    if (isValidPhraseLength(phrase)) {
      validPhrases.push(phrase);
    } else {
      invalidPhrases.push(phrase);
    }
  }

  const phrasesToAdd = validPhrases.filter((phrase) => !existingSet.has(phrase));
  const skippedCount = validPhrases.length - phrasesToAdd.length;
  return { phrasesToAdd, invalidPhrases, skippedCount };
}
