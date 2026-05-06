import { describe, it, expect } from "vitest";
import type {
  QuizSelectionMode,
  TestableWord,
  QuizHistoryItem,
  QuizSelections,
  QuizSummary,
  FillTestCandidateRow,
} from "./fillTest.types";

describe("Fill-Test Types", () => {
  it("should allow creating QuizSelectionMode values", () => {
    const modes: QuizSelectionMode[] = ["all", "10", "20", "30", "manual"];
    expect(modes).toHaveLength(5);
  });

  it("should allow creating QuizHistoryItem objects", () => {
    const item: QuizHistoryItem = {
      wordId: "test-1",
      hanzi: "中",
      tier: "easy",
      correctCount: 2,
      totalCount: 3,
    };
    expect(item.correctCount).toBe(2);
  });

  it("should allow creating QuizSelections tuples", () => {
    const selections: QuizSelections = [0, 1, null, 3];
    expect(selections).toHaveLength(4);
    expect(selections[2]).toBeNull();
  });

  it("should allow creating QuizSummary objects", () => {
    const summary: QuizSummary = {
      again: 1,
      hard: 2,
      good: 5,
      easy: 2,
      correct: 7,
    };
    expect(summary.correct).toBe(7);
  });

  it("should allow creating FillTestCandidateRow objects", () => {
    const row: FillTestCandidateRow = {
      phrase: "好朋友",
      example: "你的好朋友在哪里？",
    };
    expect(row.phrase).toBe("好朋友");
  });
});
