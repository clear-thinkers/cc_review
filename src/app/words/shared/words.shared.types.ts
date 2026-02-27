import type { ReactNode } from "react";
import type { FillResult, FillTest, Tier } from "@/lib/fillTest";
import type {
  FlashcardLlmRequest,
  FlashcardLlmResponse,
  FlashcardMeaningPhrase,
} from "@/lib/flashcardLlm";
import type { Grade } from "@/lib/scheduler";
import type { Word } from "@/lib/types";
import type { XinhuaFlashcardPronunciation } from "@/lib/xinhua";
import type { wordsStrings } from "../words.strings";

export type WordsLocaleStrings = typeof wordsStrings.en;

export type QuizSelectionMode = "all" | "10" | "20" | "30" | "manual";
export type TestableWord = Word & { fillTest: FillTest };
export type QuizHistoryItem = {
  wordId: string;
  hanzi: string;
  tier: Tier;
  correctCount: 0 | 1 | 2 | 3;
};
export type FlashcardHistoryItem = {
  wordId: string;
  hanzi: string;
  grade: Grade;
};
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

export type NavPage = "add" | "all" | "review" | "admin";
export type WordsSectionPage = NavPage | "flashcard" | "fillTest";

export type NavItem = {
  href: string;
  label: string;
  page: NavPage;
};

export type AllWordsSortKey =
  | "hanzi"
  | "createdAt"
  | "nextReviewAt"
  | "reviewCount"
  | "testCount"
  | "familiarity";
export type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity";
export type SortDirection = "asc" | "desc";

export type FlashcardLlmResponseMap = Record<string, FlashcardLlmResponse>;
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

export type FillTestCandidateRow = {
  phrase: string;
  example: string;
};

export type SortedAllWord = {
  word: Word;
  reviewCount: number;
  testCount: number;
  familiarity: number;
};

export type SortedDueWord = {
  word: Word;
  familiarity: number;
};

export type AllWordsSummary = {
  totalWords: number;
  dueNow: number;
  totalReviewed: number;
  totalTested: number;
  averageFamiliarity: number;
};

export type QuizSelections = [0 | 1 | 2 | null, 0 | 1 | 2 | null, 0 | 1 | 2 | null];

export type FlashcardPronunciationEntry = XinhuaFlashcardPronunciation;

export type RenderWithPinyin = (phrase: string, pinyin: string) => ReactNode;

export type AdminContentStats = {
  targetStatusByKey: Record<string, AdminTargetContentStatus>;
  targetsWithContent: number;
  targetsMissingContent: number;
  targetsReadyForTesting: number;
  targetsExcludedForTesting: number;
};

export type QuizSummary = {
  again: number;
  hard: number;
  good: number;
  easy: number;
  correct: number;
};

export type FlashcardSummary = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};