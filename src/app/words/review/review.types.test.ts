import { describe, it, expect } from "vitest";
import type {
  DueWordsSortKey,
  SortedDueWord,
} from "./review.types";

describe("Review Queue Types", () => {
  it("should allow creating DueWordsSortKey values", () => {
    const sortKeys: DueWordsSortKey[] = [
      "hanzi",
      "nextReviewAt",
      "familiarity",
    ];
    expect(sortKeys).toHaveLength(3);
  });

  it("should allow creating SortedDueWord objects", () => {
    const word: SortedDueWord = {
      word: {
        id: "test-1",
        hanzi: "好",
        createdAt: Date.now(),
        nextReviewAt: 1000,
        repetitions: 5,
        intervalDays: 10,
        ease: 2.5,
      },
      familiarity: 0.85,
    };
    expect(word.word.hanzi).toBe("好");
    expect(word.familiarity).toBe(0.85);
  });
});
