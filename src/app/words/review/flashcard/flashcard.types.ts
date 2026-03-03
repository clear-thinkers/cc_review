import type { Grade } from "@/lib/scheduler";
import type { XinhuaFlashcardPronunciation } from "@/lib/xinhua";
import type { FlashcardLlmResponse } from "@/lib/flashcardLlm";

/**
 * Flashcard Review Types
 * Used in FlashcardReviewSection and FlashcardPage
 */

export type FlashcardHistoryItem = {
  wordId: string;
  hanzi: string;
  grade: Grade;
};

export type FlashcardSummary = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};

export type FlashcardLlmResponseMap = Record<string, FlashcardLlmResponse>;

export type FlashcardPronunciationEntry = XinhuaFlashcardPronunciation;
