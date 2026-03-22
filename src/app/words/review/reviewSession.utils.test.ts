import { describe, expect, it } from "vitest";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { Word } from "@/lib/types";
import type { ReviewTestSession } from "./review.types";
import {
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

  it("blocks when duplicate words exist for the same character", () => {
    const session: ReviewTestSession = {
      id: "session-3",
      name: "Duplicate words",
      createdAt: Date.now(),
      createdByUserId: "user-1",
      completedAt: null,
      completedByUserId: null,
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
