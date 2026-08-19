/**
 * Add Paragraph Feature Types
 * Last updated: 2026-08-17
 */
import type { addParagraphStrings } from "./addParagraph.strings";

export type AddParagraphStrings = typeof addParagraphStrings.en;

/** A contiguous character-offset range within one sentence's text. */
export type ParagraphSpanRange = {
  startOffset: number;
  endOffset: number;
};

export type SelectedParagraphSpan = {
  sentenceIndex: number;
  startOffset: number;
  endOffset: number;
};

export type ResolvedParagraphSpan = SelectedParagraphSpan & {
  text: string;
  kind: "character" | "phrase";
  /** words.id or vocab_phrases.id (matching `kind`), null when not yet added. */
  existingId: string | null;
};

/**
 * Top-level view state for /words/add-paragraph. "library" (the default
 * once the family has saved paragraphs) lists them; "import" is Phase 1's
 * paste/parse/select form; "continueImport" re-triages an already-saved
 * paragraph to add more spans; "testModes" manages a paragraph's named
 * blank-selection templates.
 */
export type ParagraphViewMode = "import" | "library" | "continueImport" | "testModes";
