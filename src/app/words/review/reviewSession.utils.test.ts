import { describe, expect, it } from "vitest";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { Word } from "@/lib/types";
import type { Paragraph, ParagraphSpan } from "@/lib/paragraph.types";
import type { ParagraphTestMode } from "@/lib/paragraphTestMode.types";
import type { ReviewTestSession } from "./review.types";
import {
  buildRewardHeadline,
  buildReviewTestSessionRuntime,
  sortReviewTestSessionTargets,
} from "./reviewSession.utils";

function makeWord(
  id: string,
  hanzi: string,
  repetitions: number,
  createdAt: number
): Word {
  return {
    id,
    hanzi,
    createdAt,
    repetitions,
    intervalDays: Math.max(0, repetitions),
    ease: 21,
    nextReviewAt: 0,
  };
}

function makeContent(
  character: string,
  pronunciation: string,
  phrases: Array<{ phrase: string; example: string; includeInFillTest: boolean }>
): FlashcardContentEntry {
  return {
    key: `${character}|${pronunciation}`,
    character,
    pronunciation,
    updatedAt: Date.now(),
    content: {
      character,
      pronunciation,
      meanings: [
        {
          definition: "meaning",
          definition_en: "meaning-en",
          phrases: phrases.map((phrase) => ({
            phrase: phrase.phrase,
            pinyin: "pin yin",
            example: phrase.example,
            example_pinyin: "pin yin",
            include_in_fill_test: phrase.includeInFillTest,
          })),
        },
      ],
    },
  };
}

describe("sortReviewTestSessionTargets", () => {
  it("sorts by familiarity with character and pronunciation tie-breakers", () => {
    const words = [
      makeWord("w1", "好", 8, 1),
      makeWord("w2", "学", 1, 2),
      makeWord("w3", "吃", 1, 3),
    ];

    const sorted = sortReviewTestSessionTargets(
      [
        { character: "好", pronunciation: "hao4", key: "好|hao4" },
        { character: "学", pronunciation: "xue2", key: "学|xue2" },
        { character: "吃", pronunciation: "chi1", key: "吃|chi1" },
      ],
      words,
      0
    );

    expect(sorted.map((target) => target.key)).toEqual(["吃|chi1", "好|hao4", "学|xue2"]);
  });
});

describe("buildReviewTestSessionRuntime", () => {
  it("bundles multiple targets for one character into one runtime word", () => {
    const session: ReviewTestSession = {
      id: "session-1",
      name: "Weekend review",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
      paragraphTestModeId: null,
      targets: [
        {
          sessionId: "session-1",
          character: "好",
          pronunciation: "hao3",
          key: "好|hao3",
          displayOrder: 0,
        },
        {
          sessionId: "session-1",
          character: "好",
          pronunciation: "hao4",
          key: "好|hao4",
          displayOrder: 1,
        },
      ],
    };

    const runtime = buildReviewTestSessionRuntime(
      session,
      [makeWord("word-1", "好", 2, 1)],
      [
        makeContent("好", "hao3", [
          { phrase: "好吃", example: "这个很好吃。", includeInFillTest: true },
          { phrase: "好看", example: "这个很好看。", includeInFillTest: true },
        ]),
        makeContent("好", "hao4", [
          { phrase: "爱好", example: "我的爱好是画画。", includeInFillTest: true },
        ]),
      ]
    );

    expect(runtime.errorCode).toBeNull();
    expect(runtime.orderedWords).toHaveLength(1);
    expect(runtime.quizWords).toHaveLength(1);
    expect(runtime.packagedPronunciationsByCharacter["好"]).toEqual(["hao3", "hao4"]);
  });

  it("tracks characters skipped from quiz when packaged targets have no valid fill-test content", () => {
    const session: ReviewTestSession = {
      id: "session-2",
      name: "No quiz content",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
      paragraphTestModeId: null,
      targets: [
        {
          sessionId: "session-2",
          character: "学",
          pronunciation: "xue2",
          key: "学|xue2",
          displayOrder: 0,
        },
      ],
    };

    const runtime = buildReviewTestSessionRuntime(
      session,
      [makeWord("word-2", "学", 2, 1)],
      [
        makeContent("学", "xue2", [
          { phrase: "学习", example: "我要学习。", includeInFillTest: false },
        ]),
      ]
    );

    expect(runtime.quizWords).toHaveLength(0);
    expect(runtime.skippedQuizCharacters).toEqual(["学"]);
  });

  it("resolves fill-test content even when target.key carries the paragraph-span dedup suffix", () => {
    // Regression test: toReviewTestSessionTarget (supabase-service.ts) builds
    // target.key as `character|pronunciation|paragraphSpanId-or-empty` for
    // EVERY target, including ordinary (non-paragraph) character targets,
    // where paragraphSpanId is always empty -- producing a trailing "|" that
    // never matches contentByKey's plain `character|pronunciation` entries.
    // Content resolution must key off target.character/target.pronunciation
    // directly, not target.key, or every packaged session reads 0 quiz-ready.
    const session: ReviewTestSession = {
      id: "session-4",
      name: "Real DB round-trip shape",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
      paragraphTestModeId: null,
      targets: [
        {
          sessionId: "session-4",
          character: "好",
          pronunciation: "hao3",
          key: "好|hao3|",
          displayOrder: 0,
        },
      ],
    };

    const runtime = buildReviewTestSessionRuntime(
      session,
      [makeWord("word-4", "好", 2, 1)],
      [
        makeContent("好", "hao3", [
          { phrase: "好吃", example: "这个很好吃。", includeInFillTest: true },
        ]),
      ]
    );

    expect(runtime.errorCode).toBeNull();
    expect(runtime.quizWords).toHaveLength(1);
    expect(runtime.skippedQuizCharacters).toEqual([]);
  });

  it("blocks when duplicate words exist for the same character", () => {
    const session: ReviewTestSession = {
      id: "session-3",
      name: "Duplicate words",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
      paragraphTestModeId: null,
      targets: [
        {
          sessionId: "session-3",
          character: "吃",
          pronunciation: "chi1",
          key: "吃|chi1",
          displayOrder: 0,
        },
      ],
    };

    const runtime = buildReviewTestSessionRuntime(
      session,
      [makeWord("word-3a", "吃", 1, 1), makeWord("word-3b", "吃", 2, 2)],
      []
    );

    expect(runtime.errorCode).toBe("duplicate_word");
    expect(runtime.errorCharacter).toBe("吃");
  });
});

describe("buildReviewTestSessionRuntime — paragraph-quiz branch", () => {
  function makeSpan(overrides: Partial<ParagraphSpan>): ParagraphSpan {
    return {
      id: "span-1",
      text: "你",
      startOffset: 0,
      endOffset: 1,
      kind: "character",
      resolvedWordId: "w1",
      fillTestEligible: true,
      ...overrides,
    };
  }

  const PARAGRAPH: Paragraph = {
    id: "paragraph-1",
    familyId: "family-1",
    title: "Test",
    rawText: "你好。",
    sentences: [
      {
        index: 0,
        text: "你好。",
        paragraphBreakBefore: false,
        spans: [
          makeSpan({ id: "s0-0", text: "你", startOffset: 0, endOffset: 1, resolvedWordId: "w-you" }),
          makeSpan({ id: "s0-1", text: "好", startOffset: 1, endOffset: 2, resolvedWordId: "w-hao" }),
        ],
      },
    ],
    createdByUserId: "user-1",
    createdAt: 0,
    updatedAt: 0,
  };

  const TEST_MODE: ParagraphTestMode = {
    id: "test-mode-1",
    paragraphId: "paragraph-1",
    name: "Chapter 3",
    spanIds: ["s0-0", "s0-1"],
    createdByUserId: "user-1",
    createdAt: 0,
    updatedAt: 0,
  };

  function makeParagraphQuizSession(targetSpanIds: string[]): ReviewTestSession {
    return {
      id: "session-p1",
      name: "Chapter 3 Quiz",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
      paragraphTestModeId: "test-mode-1",
      targets: targetSpanIds.map((spanId, index) => ({
        sessionId: "session-p1",
        character: spanId,
        pronunciation: "",
        key: `pk-${spanId}`,
        displayOrder: index,
        paragraphId: "paragraph-1",
        paragraphSpanId: spanId,
      })),
    };
  }

  it("resolves the paragraph and test mode, building pages from the packaged span snapshot", () => {
    const session = makeParagraphQuizSession(["s0-0", "s0-1"]);
    const runtime = buildReviewTestSessionRuntime(session, [], [], [], [PARAGRAPH], [TEST_MODE]);

    expect(runtime.errorCode).toBeNull();
    expect(runtime.quizWords).toEqual([]);
    expect(runtime.vocabPhrases).toEqual([]);
    expect(runtime.paragraphQuiz).not.toBeNull();
    expect(runtime.paragraphQuiz?.paragraph.id).toBe("paragraph-1");
    expect(runtime.paragraphQuiz?.testMode.id).toBe("test-mode-1");
    expect(runtime.paragraphQuiz?.pages).toHaveLength(1);
    expect(runtime.paragraphQuiz?.pages[0]?.bankSpanIds).toHaveLength(2);
  });

  it("returns missing_paragraph_test_mode when the referenced test mode no longer exists", () => {
    const session = makeParagraphQuizSession(["s0-0", "s0-1"]);
    const runtime = buildReviewTestSessionRuntime(session, [], [], [], [PARAGRAPH], []);

    expect(runtime.errorCode).toBe("missing_paragraph_test_mode");
    expect(runtime.paragraphQuiz).toBeNull();
  });

  it("returns missing_paragraph when the test mode's paragraph no longer exists", () => {
    const session = makeParagraphQuizSession(["s0-0", "s0-1"]);
    const runtime = buildReviewTestSessionRuntime(session, [], [], [], [], [TEST_MODE]);

    expect(runtime.errorCode).toBe("missing_paragraph");
    expect(runtime.paragraphQuiz).toBeNull();
  });

  it("silently drops a packaged blank whose span no longer resolves on the paragraph, without erroring the whole session", () => {
    const session = makeParagraphQuizSession(["s0-0", "deleted-span"]);
    const runtime = buildReviewTestSessionRuntime(session, [], [], [], [PARAGRAPH], [TEST_MODE]);

    expect(runtime.errorCode).toBeNull();
    expect(runtime.paragraphQuiz?.pages[0]?.bankSpanIds).toEqual(["s0-0"]);
  });
});

describe("buildRewardHeadline", () => {
  const strings = { headlineSingular: "You earned 1 ingredient!", headlinePlural: "You earned {count} ingredients!" };

  it("uses the singular string for a count of exactly 1", () => {
    expect(buildRewardHeadline(1, strings)).toBe("You earned 1 ingredient!");
  });

  it("interpolates the count into the plural string for any other count", () => {
    expect(buildRewardHeadline(3, strings)).toBe("You earned 3 ingredients!");
    expect(buildRewardHeadline(2, strings)).toBe("You earned 2 ingredients!");
  });

  it("uses the plural string for 0 (never expected in practice, but not the singular string)", () => {
    expect(buildRewardHeadline(0, strings)).toBe("You earned 0 ingredients!");
  });
});
