import type { VocabPhrase, VocabPhraseExample } from "@/lib/types";

export type BatchPhraseScope = "missing_only" | "all" | "filtered" | "selected";

/** Mirrors the per-row "R" definition of a fully-generated phrase. */
export function vocabPhraseHasContent(phrase: VocabPhrase): boolean {
  return Boolean(phrase.pinyin) && Boolean(phrase.meaningZh) && Boolean(phrase.meaningEn) && phrase.examples.length > 0;
}

export function vocabPhraseMissingExamplePinyin(phrase: VocabPhrase): boolean {
  return phrase.examples.some((example) => !example.pinyin);
}

/** Resolves which phrases a batch action (content or pinyin) applies to, given a scope. */
export function resolveBatchPhraseTargets(
  phrases: readonly VocabPhrase[],
  scope: BatchPhraseScope,
  context: {
    filteredIds: ReadonlySet<string>;
    selectedIds: ReadonlySet<string>;
    isMissing: (phrase: VocabPhrase) => boolean;
  }
): VocabPhrase[] {
  switch (scope) {
    case "missing_only":
      return phrases.filter(context.isMissing);
    case "all":
      return [...phrases];
    case "filtered":
      return phrases.filter((phrase) => context.filteredIds.has(phrase.id));
    case "selected":
      return phrases.filter((phrase) => context.selectedIds.has(phrase.id));
    default:
      return [];
  }
}

/**
 * Indices of a phrase's examples that a pinyin batch refresh should touch.
 * "missing_only" only touches examples with empty pinyin; "refresh" touches all of them
 * -- mirrors the character pinyin batch's missing-only-vs-refresh split.
 */
export function resolveExamplePinyinRefreshIndices(
  examples: readonly VocabPhraseExample[],
  mode: "missing_only" | "refresh"
): number[] {
  return examples
    .map((example, index) => ({ example, index }))
    .filter(({ example }) => mode === "refresh" || !example.pinyin)
    .map(({ index }) => index);
}

/** Whether every example across the given phrases is already fill-test included (drives the batch toggle direction). */
export function allSelectedExamplesIncluded(phrases: readonly VocabPhrase[]): boolean {
  const examples = phrases.flatMap((phrase) => phrase.examples);
  return examples.length > 0 && examples.every((example) => example.includeInFillTest);
}
