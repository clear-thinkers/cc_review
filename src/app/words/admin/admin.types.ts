import type {
  FlashcardLlmRequest,
  FlashcardMeaningPhrase,
} from "@/lib/flashcardLlm";

/**
 * Admin Content Curation Types
 * Used in AdminSection and AdminPage
 */

export type AdminTarget = {
  character: string;
  pronunciation: string;
  key: string;
};

export type AdminTableRow = {
  rowKey: string;
  targetKey: string;
  rowType: "existing" | "pending_phrase" | "pending_meaning" | "empty_target";
  pendingId: string | null;
  character: string;
  pronunciation: string;
  meaningZh: string;
  meaningEn: string;
  phrase: string;
  phrasePinyin: string;
  example: string;
  examplePinyin: string;
  includeInFillTest: boolean;
};

export type AdminPendingPhrase = {
  id: string;
  targetKey: string;
  meaningZh: string;
  meaningEn: string;
  phraseInput: string;
};

export type AdminPendingMeaning = {
  id: string;
  targetKey: string;
  meaningZhInput: string;
  phraseInput: string;
  exampleInput: string;
};

export type AdminTableRenderRow = AdminTableRow & {
  showCharacterCell: boolean;
  characterRowSpan: number;
  showMeaningCell: boolean;
  meaningRowSpan: number;
};

export type AdminPhraseLocation = {
  meaningIndex: number;
  phraseIndex: number;
};

export type AdminStatsFilter =
  | "characters"
  | "targets"
  | "with_content"
  | "missing_content"
  | "ready_for_testing"
  | "excluded_for_testing";

export type AdminTargetContentStatus =
  | "missing_content"
  | "ready_for_testing"
  | "excluded_for_testing";

export type AdminContentStats = {
  targetStatusByKey: Record<string, AdminTargetContentStatus>;
  targetsWithContent: number;
  targetsMissingContent: number;
  targetsReadyForTesting: number;
  targetsExcludedForTesting: number;
};

// Generation request/response types for LLM calls

export type FlashcardPhraseGenerationRequest = FlashcardLlmRequest & {
  mode: "phrase";
  meaning: string;
  meaning_en?: string;
  existing_phrases: string[];
};

export type FlashcardPhraseGenerationResponse = {
  phrase: string;
  pinyin: string;
  example: string;
  example_pinyin: string;
};

export type FlashcardExampleGenerationRequest = FlashcardLlmRequest & {
  mode: "example";
  meaning: string;
  meaning_en?: string;
  phrase: string;
  existing_examples: string[];
};

export type FlashcardExampleGenerationResponse = {
  example: string;
  example_pinyin: string;
};

export type FlashcardExamplePinyinGenerationRequest = FlashcardLlmRequest & {
  mode: "example_pinyin";
  meaning?: string;
  meaning_en?: string;
  phrase?: string;
  example: string;
};

export type FlashcardExamplePinyinGenerationResponse = {
  example_pinyin: string;
};

export type FlashcardPhraseDetailGenerationRequest = FlashcardLlmRequest & {
  mode: "phrase_details";
  meaning: string;
  meaning_en?: string;
  phrase: string;
  existing_examples: string[];
};

export type FlashcardPhraseDetailGenerationResponse = {
  pinyin: string;
  example: string;
  example_pinyin: string;
};

export type FlashcardMeaningDetailGenerationRequest = FlashcardLlmRequest & {
  mode: "meaning_details";
  meaning: string;
};

export type FlashcardMeaningDetailGenerationResponse = {
  definition_en: string;
};
