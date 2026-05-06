import type { BundledFillTestResult, FillTest, Tier } from "@/lib/fillTest";
import type { Word } from "@/lib/types";

/**
 * Fill-Test Review Types
 * Used in FillTestReviewSection and FillTestPage
 */

export type QuizSelectionMode = "all" | "10" | "20" | "30" | "manual";

export type TestableWord = Word & { fillTest: FillTest };

export type QuizHistoryItem = {
  wordId: string;
  hanzi: string;
  tier: Tier;
  correctCount: number;
  totalCount: number;
};

export type QuizSelections = Array<number | null>;

export type QuizSummary = {
  again: number;
  hard: number;
  good: number;
  easy: number;
  correct: number;
};

export type FillTestCandidateRow = {
  phrase: string;
  example: string;
  characterId?: string;
};

export type BundledFillTest = FillTest;

export type BundledFillTestMember = NonNullable<FillTest["members"]>[number];

export type BundledQuizResult = BundledFillTestResult;
