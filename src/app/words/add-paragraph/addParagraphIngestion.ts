/**
 * Add Paragraph — Orchestration-Adjacent Ingestion Helpers
 *
 * Pure functions, no I/O. Parallel to src/app/words/add/addIngestion.ts's
 * role for /words/add: resolving which selected spans need a new
 * words/vocab_phrases insert vs. already resolve to an existing row, and
 * merging freshly-resolved ids back into the `sentences` structure before
 * createParagraph.
 */

import type { ParagraphSentence, ParagraphSpan } from "@/lib/paragraph.types";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { ParagraphSpanRange, ResolvedParagraphSpan, SelectedParagraphSpan } from "./addParagraph.types";

export type { ParagraphSpanRange, ResolvedParagraphSpan, SelectedParagraphSpan };

/**
 * Toggle a candidate range in/out of a per-sentence selection list. A range
 * identical to an existing one is removed (click-to-deselect); otherwise any
 * ranges the candidate overlaps are dropped and the candidate is added — a
 * paragraph span is always one contiguous, non-overlapping run per the
 * persisted data model.
 */
export function toggleSelectionRange(
  existing: ParagraphSpanRange[],
  candidate: ParagraphSpanRange
): ParagraphSpanRange[] {
  const isSame = (range: ParagraphSpanRange) =>
    range.startOffset === candidate.startOffset && range.endOffset === candidate.endOffset;

  if (existing.some(isSame)) {
    return existing.filter((range) => !isSame(range));
  }

  const overlaps = (range: ParagraphSpanRange) =>
    candidate.startOffset < range.endOffset && range.startOffset < candidate.endOffset;

  return [...existing.filter((range) => !overlaps(range)), candidate].sort(
    (a, b) => a.startOffset - b.startOffset
  );
}

/**
 * Resolves each selected range against the sentence text and the triage
 * match lists. A single-Hanzi selection resolves as a character (against
 * `words` via characterMatches); a multi-character selection resolves as a
 * phrase (against `vocab_phrases` via phraseMatches, when the exact range
 * was already a known-phrase match — otherwise it's a brand-new phrase the
 * parent is choosing to add).
 */
export function resolveSelectedSpans(
  selections: SelectedParagraphSpan[],
  sentenceTexts: Map<number, string>,
  characterMatches: CharacterTriageMatch[],
  phraseMatches: PhraseTriageMatch[]
): ResolvedParagraphSpan[] {
  const rangeKey = (sentenceIndex: number, startOffset: number, endOffset: number) =>
    `${sentenceIndex}:${startOffset}:${endOffset}`;

  const charByKey = new Map(
    characterMatches.map((match) => [rangeKey(match.sentenceIndex, match.startOffset, match.endOffset), match])
  );
  const phraseByKey = new Map(
    phraseMatches.map((match) => [rangeKey(match.sentenceIndex, match.startOffset, match.endOffset), match])
  );

  return selections.map((selection) => {
    const sentenceText = sentenceTexts.get(selection.sentenceIndex) ?? "";
    const text = sentenceText.slice(selection.startOffset, selection.endOffset);
    const key = rangeKey(selection.sentenceIndex, selection.startOffset, selection.endOffset);

    if (Array.from(text).length <= 1) {
      const match = charByKey.get(key);
      return {
        ...selection,
        text,
        kind: "character" as const,
        existingId: match?.existingWordId ?? null,
      };
    }

    const match = phraseByKey.get(key);
    return {
      ...selection,
      text,
      kind: "phrase" as const,
      existingId: match?.existingVocabPhraseId ?? null,
    };
  });
}

/** Unique, not-yet-added hanzi/phrase text across every resolved span. */
export function splitSpansNeedingInsert(resolved: ResolvedParagraphSpan[]): {
  charactersToAdd: string[];
  phrasesToAdd: string[];
} {
  const charSet = new Set<string>();
  const phraseSet = new Set<string>();

  for (const span of resolved) {
    if (span.existingId) continue;
    if (span.kind === "character") {
      charSet.add(span.text);
    } else {
      phraseSet.add(span.text);
    }
  }

  return { charactersToAdd: [...charSet], phrasesToAdd: [...phraseSet] };
}

/**
 * Bakes resolved ids (existing matches plus anything freshly inserted this
 * submission) into `sentences[].spans[]`, ready for createParagraph/
 * updateParagraph. Only the spans the parent actually selected this
 * submission are newly built — a known-but-unselected triage match is not
 * recorded as a span.
 *
 * APPENDS onto whatever a sentence's `spans[]` already contains, rather
 * than replacing it — required for Continue Import (re-parsing an existing
 * paragraph must add to its tracked spans, never drop what's already
 * there). Safe for a brand-new paragraph too: every sentence starts with
 * `spans: []`, so appending onto empty is identical to the old
 * replace-based behavior.
 */
export function mergeResolvedSpansIntoSentences(
  sentences: ParagraphSentence[],
  resolved: ResolvedParagraphSpan[],
  wordIdByHanzi: Map<string, string>,
  vocabPhraseIdByPhrase: Map<string, string>
): ParagraphSentence[] {
  const spansBySentence = new Map<number, ParagraphSpan[]>();

  for (const span of resolved) {
    const resolvedId =
      span.kind === "character"
        ? (span.existingId ?? wordIdByHanzi.get(span.text))
        : (span.existingId ?? vocabPhraseIdByPhrase.get(span.text));

    const built: ParagraphSpan = {
      id: `s${span.sentenceIndex}-${span.startOffset}-${span.endOffset}`,
      text: span.text,
      startOffset: span.startOffset,
      endOffset: span.endOffset,
      kind: span.kind,
      fillTestEligible: true,
      ...(span.kind === "character" ? { resolvedWordId: resolvedId } : { resolvedVocabPhraseId: resolvedId }),
    };

    const list = spansBySentence.get(span.sentenceIndex) ?? [];
    list.push(built);
    spansBySentence.set(span.sentenceIndex, list);
  }

  return sentences.map((sentence) => ({
    ...sentence,
    spans: [...sentence.spans, ...(spansBySentence.get(sentence.index) ?? [])].sort(
      (a, b) => a.startOffset - b.startOffset
    ),
  }));
}
