import { describe, expect, it } from "vitest";
import {
  buildParagraphQuizGradeData,
  findNextIncompletePageIndex,
  isPageComplete,
  isQuizComplete,
  isRevealEligible,
  resolveCharacterRevealContent,
  resolvePhraseRevealContent,
} from "./paragraphQuiz.utils";
import type { ParagraphQuizPage } from "@/lib/paragraphQuizBuilder";
import type { ParagraphQuizBlankProgress, ParagraphQuizHistoryItem } from "./paragraphQuiz.types";
import type { Word, VocabPhrase } from "@/lib/types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "word-1",
    hanzi: "你",
    createdAt: 0,
    repetitions: 0,
    intervalDays: 0,
    ease: 21,
    nextReviewAt: 0,
    ...overrides,
  };
}

function makeFlashcardEntry(overrides: Partial<FlashcardContentEntry> = {}): FlashcardContentEntry {
  return {
    key: "你|nǐ",
    character: "你",
    pronunciation: "nǐ",
    content: {
      character: "你",
      pronunciation: "nǐ",
      meanings: [{ definition: "你", definition_en: "you", phrases: [] }],
    },
    updatedAt: 0,
    ...overrides,
  };
}

function makeVocabPhrase(overrides: Partial<VocabPhrase> = {}): VocabPhrase {
  return {
    id: "phrase-1",
    phrase: "图书馆",
    pinyin: "tú shū guǎn",
    meaningZh: "藏书的地方",
    meaningEn: "library",
    examples: [],
    testCount: 0,
    createdAt: 0,
    ...overrides,
  };
}

function makePage(spanIds: string[], pageIndex = 0): ParagraphQuizPage {
  return {
    pageIndex,
    sentences: [{ index: 0, text: "sentence", blankSpanIds: spanIds }],
    bankSpanIds: spanIds,
  };
}

describe("isPageComplete", () => {
  it("is false when a blank has no saved state at all (defaults to unfilled)", () => {
    expect(isPageComplete(makePage(["s1", "s2"]), {})).toBe(false);
  });

  it("is false when any blank is still unfilled", () => {
    const blankState: Record<string, ParagraphQuizBlankProgress> = {
      s1: { status: "correct", retryCount: 0 },
      s2: { status: "unfilled", retryCount: 1 },
    };
    expect(isPageComplete(makePage(["s1", "s2"]), blankState)).toBe(false);
  });

  it("is true when every blank on the page is correct", () => {
    const blankState: Record<string, ParagraphQuizBlankProgress> = {
      s1: { status: "correct", retryCount: 0 },
      s2: { status: "correct", retryCount: 2 },
    };
    expect(isPageComplete(makePage(["s1", "s2"]), blankState)).toBe(true);
  });

  it("is vacuously true for a page with no blanks", () => {
    expect(isPageComplete(makePage([]), {})).toBe(true);
  });
});

describe("isQuizComplete", () => {
  it("is false for an empty pages array (nothing to complete)", () => {
    expect(isQuizComplete([], {})).toBe(false);
  });

  it("is false when any page still has an unfilled blank", () => {
    const blankState: Record<string, ParagraphQuizBlankProgress> = { s1: { status: "correct", retryCount: 0 } };
    expect(isQuizComplete([makePage(["s1"], 0), makePage(["s2"], 1)], blankState)).toBe(false);
  });

  it("is true only once every page's every blank is correct", () => {
    const blankState: Record<string, ParagraphQuizBlankProgress> = {
      s1: { status: "correct", retryCount: 0 },
      s2: { status: "correct", retryCount: 1 },
    };
    expect(isQuizComplete([makePage(["s1"], 0), makePage(["s2"], 1)], blankState)).toBe(true);
  });
});

describe("findNextIncompletePageIndex", () => {
  it("returns -1 when every page is complete", () => {
    const blankState: Record<string, ParagraphQuizBlankProgress> = {
      s1: { status: "correct", retryCount: 0 },
      s2: { status: "correct", retryCount: 0 },
    };
    expect(findNextIncompletePageIndex([makePage(["s1"], 0), makePage(["s2"], 1)], blankState)).toBe(-1);
  });

  it("returns the index of the first page (in array order) with remaining work", () => {
    const blankState: Record<string, ParagraphQuizBlankProgress> = { s1: { status: "correct", retryCount: 0 } };
    expect(findNextIncompletePageIndex([makePage(["s1"], 0), makePage(["s2"], 1)], blankState)).toBe(1);
  });

  it("returns 0 when the very first page is incomplete", () => {
    expect(findNextIncompletePageIndex([makePage(["s1"], 0), makePage(["s2"], 1)], {})).toBe(0);
  });
});

describe("buildParagraphQuizGradeData", () => {
  it("maps a character blank's resolved wordId, text, tier, and retryCount", () => {
    const items: ParagraphQuizHistoryItem[] = [
      { spanId: "s1", wordId: "word-1", text: "你", tier: "easy", retryCount: 0 },
    ];
    expect(buildParagraphQuizGradeData(items)).toEqual([
      { wordId: "word-1", hanzi: "你", grade: "easy", isParagraphBlank: true, retryCount: 0 },
    ]);
  });

  it("falls back to vocabPhraseId when a phrase blank has no wordId", () => {
    const items: ParagraphQuizHistoryItem[] = [
      { spanId: "s2", vocabPhraseId: "phrase-1", text: "图书馆", tier: "hard", retryCount: 2 },
    ];
    expect(buildParagraphQuizGradeData(items)).toEqual([
      { wordId: "phrase-1", hanzi: "图书馆", grade: "hard", isParagraphBlank: true, retryCount: 2 },
    ]);
  });

  it("falls back to the span id itself if neither wordId nor vocabPhraseId is set (defensive)", () => {
    const items: ParagraphQuizHistoryItem[] = [{ spanId: "s3", text: "?", tier: "good", retryCount: 1 }];
    expect(buildParagraphQuizGradeData(items)[0]?.wordId).toBe("s3");
  });

  it("returns an empty array for an empty session", () => {
    expect(buildParagraphQuizGradeData([])).toEqual([]);
  });
});

describe("isRevealEligible", () => {
  it.each([
    [0, false],
    [1, false],
    [2, false],
    [3, true],
    [4, true],
  ])("retryCount %i -> %s", (retryCount, expected) => {
    expect(isRevealEligible(retryCount)).toBe(expected);
  });
});

describe("resolveCharacterRevealContent", () => {
  it("returns null when the character has no flashcard_contents entries", () => {
    expect(resolveCharacterRevealContent(makeWord(), [])).toBeNull();
  });

  it("resolves a single matching entry", () => {
    const entry = makeFlashcardEntry();
    expect(resolveCharacterRevealContent(makeWord(), [entry])).toEqual({
      kind: "character",
      hanzi: "你",
      entries: [{ pronunciation: "nǐ", meanings: entry.content.meanings }],
    });
  });

  it("shows every matching pronunciation entry stacked, never picks just one", () => {
    const entryA = makeFlashcardEntry({ pronunciation: "nǐ" });
    const entryB = makeFlashcardEntry({ pronunciation: "ní" });
    const unrelated = makeFlashcardEntry({ character: "好", pronunciation: "hǎo" });
    const content = resolveCharacterRevealContent(makeWord(), [entryA, entryB, unrelated]);
    expect(content?.entries).toHaveLength(2);
    expect(content?.entries.map((e) => e.pronunciation)).toEqual(["nǐ", "ní"]);
  });
});

describe("resolvePhraseRevealContent", () => {
  it("carries phrase text, pinyin, and both meanings through unchanged", () => {
    const content = resolvePhraseRevealContent(makeVocabPhrase());
    expect(content).toMatchObject({
      kind: "phrase",
      phrase: "图书馆",
      pinyin: "tú shū guǎn",
      meaningZh: "藏书的地方",
      meaningEn: "library",
    });
  });

  it("falls back to an empty pinyin string when the phrase has none", () => {
    const content = resolvePhraseRevealContent(makeVocabPhrase({ pinyin: undefined }));
    expect(content.pinyin).toBe("");
  });

  it("picks only the FIRST include_in_fill_test example, not a random one", () => {
    const content = resolvePhraseRevealContent(
      makeVocabPhrase({
        examples: [
          { zh: "skip me", pinyin: "", includeInFillTest: false },
          { zh: "first eligible", pinyin: "p1", includeInFillTest: true },
          { zh: "second eligible", pinyin: "p2", includeInFillTest: true },
        ],
      })
    );
    expect(content.example?.zh).toBe("first eligible");
  });

  it("leaves example undefined when no example is fill-test eligible", () => {
    const content = resolvePhraseRevealContent(
      makeVocabPhrase({ examples: [{ zh: "not eligible", pinyin: "", includeInFillTest: false }] })
    );
    expect(content.example).toBeUndefined();
  });
});
