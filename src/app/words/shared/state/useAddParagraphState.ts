import { useState } from "react";
import type { Paragraph, ParagraphSentence } from "@/lib/paragraph.types";
import type { ParagraphTestMode } from "@/lib/paragraphTestMode.types";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { TagCascadeSelection } from "../TagCascadePicker";
import type { ParagraphViewMode } from "../../add-paragraph/addParagraph.types";

export type ParagraphSelectionRange = {
  sentenceIndex: number;
  startOffset: number;
  endOffset: number;
};

const EMPTY_TAG_SELECTION: TagCascadeSelection = {
  textbookId: null,
  grade: "",
  unit: "",
  lesson: "",
};

/**
 * State for /words/add-paragraph: paste input, parsed sentences, triage
 * match lists, current span selection, tag-cascade selection, and
 * submit/notice state. Pure state container, no logic — mirrors
 * useAdminState.ts / useFillTestReviewState.ts. Handler logic lives in
 * AddParagraphSection.tsx, matching how AddVocabPhraseSection.tsx owns its
 * own submit flow rather than growing words.shared.state.ts's addWord path.
 */
export function useAddParagraphState() {
  const [paragraphInput, setParagraphInput] = useState("");
  const [paragraphTitle, setParagraphTitle] = useState("");
  const [paragraphTruncated, setParagraphTruncated] = useState(false);
  const [paragraphSentences, setParagraphSentences] = useState<ParagraphSentence[]>([]);
  const [paragraphCharacterMatches, setParagraphCharacterMatches] = useState<CharacterTriageMatch[]>([]);
  const [paragraphPhraseMatches, setParagraphPhraseMatches] = useState<PhraseTriageMatch[]>([]);
  const [paragraphSelection, setParagraphSelection] = useState<ParagraphSelectionRange[]>([]);
  const [paragraphSubmitting, setParagraphSubmitting] = useState(false);
  const [paragraphNotice, setParagraphNotice] = useState<string | null>(null);
  const [paragraphTagSectionOpen, setParagraphTagSectionOpen] = useState(false);
  const [paragraphTagSelection, setParagraphTagSelection] =
    useState<TagCascadeSelection>(EMPTY_TAG_SELECTION);

  // Library/navigation state (Phase 2) -- library-first once the family has
  // saved paragraphs; ParagraphLibrarySection itself renders the empty
  // state (with the same "+ Import New Paragraph" CTA) when the list is
  // empty or still loading, so a single static default here is sufficient.
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  // Family-wide test modes (Phase 3) -- needed on ANY page, not just
  // /words/add-paragraph, since buildReviewTestSessionRuntime must resolve
  // a paragraph-quiz session's test mode from Due Review / the fill-test
  // entry point too. Mirrors why paragraphs above is loaded unconditionally
  // in refreshAll rather than lazily by ParagraphLibrarySection alone.
  const [paragraphTestModes, setParagraphTestModes] = useState<ParagraphTestMode[]>([]);
  const [paragraphViewMode, setParagraphViewMode] = useState<ParagraphViewMode>("library");
  const [paragraphFilterTitle, setParagraphFilterTitle] = useState("");
  const [paragraphFilterSelectedTagIds, setParagraphFilterSelectedTagIds] = useState<string[]>([]);
  const [paragraphSelectedId, setParagraphSelectedId] = useState<string | null>(null);

  return {
    paragraphInput,
    setParagraphInput,
    paragraphTitle,
    setParagraphTitle,
    paragraphTruncated,
    setParagraphTruncated,
    paragraphSentences,
    setParagraphSentences,
    paragraphCharacterMatches,
    setParagraphCharacterMatches,
    paragraphPhraseMatches,
    setParagraphPhraseMatches,
    paragraphSelection,
    setParagraphSelection,
    paragraphSubmitting,
    setParagraphSubmitting,
    paragraphNotice,
    setParagraphNotice,
    paragraphTagSectionOpen,
    setParagraphTagSectionOpen,
    paragraphTagSelection,
    setParagraphTagSelection,
    paragraphs,
    setParagraphs,
    paragraphTestModes,
    setParagraphTestModes,
    paragraphViewMode,
    setParagraphViewMode,
    paragraphFilterTitle,
    setParagraphFilterTitle,
    paragraphFilterSelectedTagIds,
    setParagraphFilterSelectedTagIds,
    paragraphSelectedId,
    setParagraphSelectedId,
  };
}
