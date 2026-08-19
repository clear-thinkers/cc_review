/**
 * Paragraph domain types owned by the lib/service layer.
 *
 * Map directly to the `paragraphs` table (raw pasted article text + parsed
 * sentence/span structure). Phase 1 (article import + known/unknown triage)
 * writes these; Phase 2 (fill-test packaging) is the first reader. Mirrors
 * the placement of VocabPhrase/VocabPhraseExample in `src/lib/types.ts`.
 */

export type ParagraphSpan = {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  kind: "character" | "phrase";
  resolvedWordId?: string;
  resolvedVocabPhraseId?: string;
  fillTestEligible: boolean;
};

export type ParagraphSentence = {
  index: number;
  text: string;
  paragraphBreakBefore: boolean;
  spans: ParagraphSpan[];
};

export type Paragraph = {
  id: string;
  familyId: string;
  title: string | null;
  rawText: string;
  sentences: ParagraphSentence[];
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};
