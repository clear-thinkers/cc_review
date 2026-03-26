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
