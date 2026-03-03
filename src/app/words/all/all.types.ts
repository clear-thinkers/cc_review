import type { Word } from "@/lib/types";

/**
 * All Words Inventory Page Types
 * Used in AllWordsSection and AllPage
 */

export type AllWordsSortKey =
  | "hanzi"
  | "createdAt"
  | "nextReviewAt"
  | "reviewCount"
  | "testCount"
  | "familiarity";

export type SortedAllWord = {
  word: Word;
  reviewCount: number;
  testCount: number;
  familiarity: number;
};

export type AllWordsSummary = {
  totalWords: number;
  dueNow: number;
  totalReviewed: number;
  totalTested: number;
  averageFamiliarity: number;
};
