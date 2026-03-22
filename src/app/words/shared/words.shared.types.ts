import type { ReactNode } from "react";
import type { wordsStrings } from "../words.strings";

// Re-export feature-specific types
export type {
  NavPage,
  WordsSectionPage,
  NavItem,
} from "./shell.types";

export type {
  AllWordsSortKey,
  SortedAllWord,
  AllWordsSummary,
} from "../all/all.types";

export type {
  DueWordsSortKey,
  SortedDueWord,
  ReviewTestSessionTargetDraft,
  ReviewTestSessionTarget,
  ReviewTestSession,
  ReviewTestSessionRuntime,
  ReviewTestSessionRuntimeErrorCode,
} from "../review/review.types";

export type {
  FlashcardHistoryItem,
  FlashcardSummary,
  FlashcardLlmResponseMap,
  FlashcardPronunciationEntry,
} from "../review/flashcard/flashcard.types";

export type {
  QuizSelectionMode,
  TestableWord,
  QuizHistoryItem,
  QuizSelections,
  QuizSummary,
  FillTestCandidateRow,
} from "../review/fill-test/fillTest.types";

export type {
  AdminTarget,
  AdminTableRow,
  AdminPendingPhrase,
  AdminPendingMeaning,
  AdminTableRenderRow,
  AdminPhraseLocation,
  AdminStatsFilter,
  AdminTargetContentStatus,
  AdminContentStats,
  FlashcardPhraseGenerationRequest,
  FlashcardPhraseGenerationResponse,
  FlashcardExampleGenerationRequest,
  FlashcardExampleGenerationResponse,
  FlashcardExamplePinyinGenerationRequest,
  FlashcardExamplePinyinGenerationResponse,
  FlashcardPhraseDetailGenerationRequest,
  FlashcardPhraseDetailGenerationResponse,
  FlashcardMeaningDetailGenerationRequest,
  FlashcardMeaningDetailGenerationResponse,
} from "../admin/admin.types";

// Shared utilities
export type WordsLocaleStrings = typeof wordsStrings.en;

export type SortDirection = "asc" | "desc";

export type RenderWithPinyin = (phrase: string, pinyin: string) => ReactNode;
