import { describe, expect, it } from "vitest";
import type {
  DueWordsSortKey,
  ReviewTestSession,
  ReviewTestSessionRuntime,
  ReviewTestSessionTarget,
  SortedDueWord,
} from "./review.types";

describe("Review Queue Types", () => {
  it("should allow creating DueWordsSortKey values", () => {
    const sortKeys: DueWordsSortKey[] = ["hanzi", "nextReviewAt", "familiarity"];
    expect(sortKeys).toHaveLength(3);
  });

  it("should allow creating SortedDueWord objects", () => {
    const word: SortedDueWord = {
      word: {
        id: "test-1",
        hanzi: "hao",
        createdAt: Date.now(),
        nextReviewAt: 1000,
        repetitions: 5,
        intervalDays: 10,
        ease: 2.5,
      },
      familiarity: 0.85,
    };
    expect(word.word.hanzi).toBe("hao");
    expect(word.familiarity).toBe(0.85);
  });

  it("should allow creating ReviewTestSessionTarget objects", () => {
    const target: ReviewTestSessionTarget = {
      sessionId: "session-1",
      character: "hao",
      pronunciation: "hao3",
      key: "hao|hao3",
      displayOrder: 0,
    };

    expect(target.key).toBe("hao|hao3");
  });

  it("should allow creating ReviewTestSession objects", () => {
    const session: ReviewTestSession = {
      id: "session-1",
      name: "Weekend review",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
      targets: [
        {
          sessionId: "session-1",
          character: "hao",
          pronunciation: "hao3",
          key: "hao|hao3",
          displayOrder: 0,
        },
      ],
    };

    expect(session.targets).toHaveLength(1);
    expect(session.completedAt).toBeNull();
  });

  it("should allow creating ReviewTestSessionRuntime objects", () => {
    const runtime: ReviewTestSessionRuntime = {
      orderedWords: [
        {
          id: "word-1",
          hanzi: "hao",
          createdAt: Date.now(),
          nextReviewAt: 0,
          repetitions: 1,
          intervalDays: 0,
          ease: 21,
        },
      ],
      quizWords: [
        {
          id: "word-1",
          hanzi: "hao",
          createdAt: Date.now(),
          nextReviewAt: 0,
          repetitions: 1,
          intervalDays: 0,
          ease: 21,
          fillTest: {
            phrases: ["p1", "p2", "p3"],
            sentences: [
              { text: "___ a", answerIndex: 0 },
              { text: "___ b", answerIndex: 1 },
              { text: "___ c", answerIndex: 2 },
            ],
          },
        },
      ],
      packagedPronunciationsByCharacter: {
        hao: ["hao3"],
      },
      skippedQuizCharacters: [],
      errorCode: null,
      errorCharacter: null,
    };

    expect(runtime.quizWords[0]?.fillTest.phrases).toHaveLength(3);
  });
});
