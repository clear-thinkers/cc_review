import type { Word } from "@/lib/types";
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

export type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity";

export type SortedDueWord = {
  word: Word;
  familiarity: number;
};

export type ReviewTestSessionRuntimeErrorCode =
  | "missing_word"
  | "duplicate_word"
  | null;

export type ReviewTestSessionRuntime = {
  orderedWords: Word[];
  quizWords: TestableWord[];
  packagedPronunciationsByCharacter: Record<string, string[]>;
  skippedQuizCharacters: string[];
  errorCode: ReviewTestSessionRuntimeErrorCode;
  errorCharacter: string | null;
};
