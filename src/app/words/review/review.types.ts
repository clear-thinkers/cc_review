import type { Word } from "@/lib/types";
import type { TestableWord } from "./fill-test/fillTest.types";

/**
 * Due Review Queue Types
 * Used in DueReviewSection and ReviewPage
 */

export type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity";

export type SortedDueWord = {
  word: Word;
  familiarity: number;
};

export type ReviewTestSessionTargetDraft = {
  character: string;
  pronunciation: string;
  key: string;
};

export type ReviewTestSessionTarget = ReviewTestSessionTargetDraft & {
  sessionId: string;
  displayOrder: number;
};

export type ReviewTestSession = {
  id: string;
  name: string;
  createdAt: number;
  createdByUserId: string;
  completedAt: number | null;
  completedByUserId: string | null;
  targets: ReviewTestSessionTarget[];
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
