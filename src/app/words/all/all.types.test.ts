import { describe, it, expect } from "vitest";
import type {
  AllWordsSortKey,
  SortedAllWord,
  AllWordsSummary,
} from "./all.types";

describe("All Words Types", () => {
  it("should allow creating AllWordsSortKey values", () => {
    const sortKeys: AllWordsSortKey[] = [
      "hanzi",
      "createdAt",
      "nextReviewAt",
      "reviewCount",
      "testCount",
      "familiarity",
    ];
    expect(sortKeys).toHaveLength(6);
  });

  it("should allow creating SortedAllWord objects", () => {
    const word: SortedAllWord = {
      word: {
        id: "test-1",
        hanzi: "你",
        createdAt: Date.now(),
        nextReviewAt: 0,
        repetitions: 0,
        intervalDays: 1,
        ease: 2.5,
        contentStatus: 'ready' as const,
        contentSource: null,
      },
      reviewCount: 5,
      testCount: 2,
      familiarity: 0.75,
    };
    expect(word.word.hanzi).toBe("你");
    expect(word.reviewCount).toBe(5);
  });

  it("should allow creating AllWordsSummary objects", () => {
    const summary: AllWordsSummary = {
      totalWords: 100,
      dueNow: 10,
      totalReviewed: 500,
      totalTested: 200,
      averageFamiliarity: 0.65,
    };
    expect(summary.totalWords).toBe(100);
  });
});
