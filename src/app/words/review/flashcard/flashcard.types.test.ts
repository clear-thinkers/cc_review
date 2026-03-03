import { describe, it, expect } from "vitest";
import type {
  FlashcardHistoryItem,
  FlashcardSummary,
  FlashcardPronunciationEntry,
} from "./flashcard.types";

describe("Flashcard Types", () => {
  it("should allow creating FlashcardHistoryItem objects", () => {
    const item: FlashcardHistoryItem = {
      wordId: "test-1",
      hanzi: "学",
      grade: "good",
    };
    expect(item.grade).toBe("good");
  });

  it("should allow creating FlashcardSummary objects", () => {
    const summary: FlashcardSummary = {
      again: 2,
      hard: 1,
      good: 8,
      easy: 5,
    };
    expect(summary.good).toBe(8);
    expect(summary.again + summary.hard + summary.good + summary.easy).toBe(16);
  });

  it("should accept grade type values", () => {
    const grades: Array<FlashcardHistoryItem["grade"]> = [
      "again",
      "hard",
      "good",
      "easy",
    ];
    expect(grades).toHaveLength(4);
  });
});
