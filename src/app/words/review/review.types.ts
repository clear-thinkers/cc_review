import type { Word } from "@/lib/types";

/**
 * Due Review Queue Types
 * Used in DueReviewSection and ReviewPage
 */

export type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity";

export type SortedDueWord = {
  word: Word;
  familiarity: number;
};
