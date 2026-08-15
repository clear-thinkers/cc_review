import type { VocabPhrase, Word } from "@/lib/types";
import type { TestableWord } from "./fill-test/fillTest.types";

// Session record types are owned by the lib/service layer; re-exported here for UI callers.
export type {
  ReviewTestSessionTargetDraft,
  ReviewTestSessionTarget,
  ReviewTestSession,
} from "@/lib/reviewTestSession.types";

/**
 * Due Review Queue Types
 * Used in DueReviewSection and ReviewPage
 */

export type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity" | "testCount";

export type SortedDueWord = {
  word: Word;
  familiarity: number;
  testCount: number;
};

export type ReviewTestSessionRuntimeErrorCode =
  | "missing_word"
  | "duplicate_word"
  | "missing_vocab_phrase"
  | null;

export type ReviewTestSessionRuntime = {
  orderedWords: Word[];
  quizWords: TestableWord[];
  // Raw vocab_phrases matching the session's phrase targets (one per target
  // — a phrase target maps 1:1 to a vocab_phrases row, unlike character
  // targets which can share a character across multiple pronunciations).
  // Not yet bundled into rounds; buildFillTestPlanForVocabPhrases does that
  // at quiz-start time, mirroring how quizWords isn't bundled until
  // buildBundledFillTestPlan runs.
  vocabPhrases: VocabPhrase[];
  packagedPronunciationsByCharacter: Record<string, string[]>;
  skippedQuizCharacters: string[];
  errorCode: ReviewTestSessionRuntimeErrorCode;
  errorCharacter: string | null;
};
