import { describe, expect, it } from "vitest";
import {
  buildParagraphQuizPages,
  deriveParagraphBlankTier,
  resolveParagraphQuizBlanks,
  shuffleBankOrder,
} from "./paragraphQuizBuilder";
import type { Paragraph, ParagraphSentence, ParagraphSpan } from "./paragraph.types";

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

/** Builds a sentence with `blankCount` selectable single-char spans, ids `s{index}-{n}`. */
function makeSentenceWithBlanks(index: number, blankCount: number): ParagraphSentence {
  const spans: ParagraphSpan[] = [];
  for (let i = 0; i < blankCount; i += 1) {
    spans.push(
      makeSpan({
        id: `s${index}-${i}`,
        text: `字${index}_${i}`,
        startOffset: i,
        endOffset: i + 1,
        resolvedWordId: `w-${index}-${i}`,
      })
    );
  }
  return { index, text: `sentence-${index}`, paragraphBreakBefore: false, spans };
}

function makeParagraph(sentences: ParagraphSentence[]): Paragraph {
  return {
    id: "p1",
    familyId: "family-1",
    title: "Test",
    rawText: sentences.map((s) => s.text).join(""),
    sentences,
    createdByUserId: "user-1",
    createdAt: 0,
    updatedAt: 0,
  };
}

function allSpanIds(paragraph: Paragraph): string[] {
  return paragraph.sentences.flatMap((s) => s.spans.map((span) => span.id));
}

describe("resolveParagraphQuizBlanks", () => {
  it("returns an empty array for an empty paragraph", () => {
    expect(resolveParagraphQuizBlanks(makeParagraph([]), [])).toEqual([]);
  });

  it("resolves blanks in paragraph reading order (sentence index, then start offset)", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 3), makeSentenceWithBlanks(1, 2)]);
    const ids = allSpanIds(paragraph);
    const blanks = resolveParagraphQuizBlanks(paragraph, ids);
    expect(blanks.map((b) => b.spanId)).toEqual(["s0-0", "s0-1", "s0-2", "s1-0", "s1-1"]);
  });

  it("silently drops a requested span id that no longer resolves on the paragraph", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 2)]);
    const blanks = resolveParagraphQuizBlanks(paragraph, ["s0-0", "deleted-span"]);
    expect(blanks.map((b) => b.spanId)).toEqual(["s0-0"]);
  });

  it("collapses a duplicated span id (corrupted paragraph data) to a single blank", () => {
    // Two distinct span objects sharing the same id -- the shape a stale
    // double-materialization bug in mergePendingSpansIntoSentences used to
    // produce (see build-fix-log-2026-08-20-paragraph-quiz-bank-duplicate-blank.md).
    const paragraph = makeParagraph([
      {
        index: 0,
        text: "帮助帮助",
        paragraphBreakBefore: false,
        spans: [
          makeSpan({ id: "s0-0-2", text: "帮助", startOffset: 0, endOffset: 2, resolvedWordId: "w1" }),
          makeSpan({ id: "s0-0-2", text: "帮助", startOffset: 0, endOffset: 2, resolvedWordId: "w1" }),
        ],
      },
    ]);
    const blanks = resolveParagraphQuizBlanks(paragraph, ["s0-0-2"]);
    expect(blanks).toHaveLength(1);
    expect(blanks[0]?.spanId).toBe("s0-0-2");
  });

  it("populates wordId/vocabPhraseId from resolvedWordId/resolvedVocabPhraseId", () => {
    const paragraph = makeParagraph([
      {
        index: 0,
        text: "图书馆",
        paragraphBreakBefore: false,
        spans: [
          makeSpan({ id: "phrase-1", kind: "phrase", resolvedWordId: undefined, resolvedVocabPhraseId: "vp-1" }),
        ],
      },
    ]);
    const [blank] = resolveParagraphQuizBlanks(paragraph, ["phrase-1"]);
    expect(blank.wordId).toBeUndefined();
    expect(blank.vocabPhraseId).toBe("vp-1");
  });
});

describe("buildParagraphQuizPages", () => {
  it("returns an empty array when there are no blanks", () => {
    expect(buildParagraphQuizPages(makeParagraph([]), [])).toEqual([]);
  });

  it("keeps all sentences on one page when total blanks is under the target", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 5), makeSentenceWithBlanks(1, 5)]);
    const pages = buildParagraphQuizPages(paragraph, allSpanIds(paragraph), 20);
    expect(pages).toHaveLength(1);
    expect(pages[0].sentences.map((s) => s.index)).toEqual([0, 1]);
    expect(pages[0].bankSpanIds).toHaveLength(10);
  });

  it("never splits a sentence's blanks across a page boundary at the ~20 boundary", () => {
    // Sentence 0: 12 blanks, Sentence 1: 12 blanks -- 12+12=24 > 20, so
    // sentence 1 must start a fresh page rather than being split.
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 12), makeSentenceWithBlanks(1, 12)]);
    const pages = buildParagraphQuizPages(paragraph, allSpanIds(paragraph), 20);
    expect(pages).toHaveLength(2);
    expect(pages[0].sentences.map((s) => s.index)).toEqual([0]);
    expect(pages[0].bankSpanIds).toHaveLength(12);
    expect(pages[1].sentences.map((s) => s.index)).toEqual([1]);
    expect(pages[1].bankSpanIds).toHaveLength(12);
  });

  it("accumulates multiple small sentences onto one page up to the target", () => {
    const paragraph = makeParagraph([
      makeSentenceWithBlanks(0, 7),
      makeSentenceWithBlanks(1, 7),
      makeSentenceWithBlanks(2, 7),
    ]);
    const pages = buildParagraphQuizPages(paragraph, allSpanIds(paragraph), 20);
    // 7+7=14 (fits), +7=21 (would exceed 20) -> sentence 2 starts page 2.
    expect(pages).toHaveLength(2);
    expect(pages[0].sentences.map((s) => s.index)).toEqual([0, 1]);
    expect(pages[1].sentences.map((s) => s.index)).toEqual([2]);
  });

  it("keeps a single oversized sentence (>target blanks) whole on its own page", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 25)]);
    const pages = buildParagraphQuizPages(paragraph, allSpanIds(paragraph), 20);
    expect(pages).toHaveLength(1);
    expect(pages[0].sentences[0].blankSpanIds).toHaveLength(25);
    expect(pages[0].bankSpanIds).toHaveLength(25);
  });

  it("assigns sequential pageIndex values", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 12), makeSentenceWithBlanks(1, 12)]);
    const pages = buildParagraphQuizPages(paragraph, allSpanIds(paragraph), 20);
    expect(pages.map((p) => p.pageIndex)).toEqual([0, 1]);
  });

  it("scopes each page's bank to exactly that page's blanks, not the whole paragraph", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 12), makeSentenceWithBlanks(1, 12)]);
    const pages = buildParagraphQuizPages(paragraph, allSpanIds(paragraph), 20);
    const page0Blanks = new Set(pages[0].sentences.flatMap((s) => s.blankSpanIds));
    const page1Blanks = new Set(pages[1].sentences.flatMap((s) => s.blankSpanIds));
    for (const id of pages[0].bankSpanIds) expect(page0Blanks.has(id)).toBe(true);
    for (const id of pages[1].bankSpanIds) expect(page1Blanks.has(id)).toBe(true);
  });

  it("drops a requested span id that no longer resolves, without breaking pagination of the rest", () => {
    const paragraph = makeParagraph([makeSentenceWithBlanks(0, 3)]);
    const pages = buildParagraphQuizPages(paragraph, [...allSpanIds(paragraph), "ghost-span"], 20);
    expect(pages).toHaveLength(1);
    expect(pages[0].bankSpanIds).toHaveLength(3);
  });
});

describe("shuffleBankOrder", () => {
  it("returns a permutation containing exactly the same elements", () => {
    const input = ["a", "b", "c", "d", "e"];
    const result = shuffleBankOrder(input, 42);
    expect(result).toHaveLength(input.length);
    expect(new Set(result)).toEqual(new Set(input));
  });

  it("is deterministic for a fixed seed", () => {
    const input = ["a", "b", "c", "d", "e", "f", "g"];
    const first = shuffleBankOrder(input, 123);
    const second = shuffleBankOrder(input, 123);
    expect(first).toEqual(second);
  });

  it("produces different orders for different seeds (not a no-op)", () => {
    const input = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const first = shuffleBankOrder(input, 1);
    const second = shuffleBankOrder(input, 2);
    expect(first).not.toEqual(second);
  });

  it("handles empty and single-element input without error", () => {
    expect(shuffleBankOrder([], 1)).toEqual([]);
    expect(shuffleBankOrder(["only"], 1)).toEqual(["only"]);
  });
});

describe("deriveParagraphBlankTier", () => {
  it("maps 0 wrong attempts (first-try-correct) to easy", () => {
    expect(deriveParagraphBlankTier(0)).toBe("easy");
  });

  it("maps 1 wrong attempt (correct on second try) to good", () => {
    expect(deriveParagraphBlankTier(1)).toBe("good");
  });

  it("maps 2 or more wrong attempts (correct on third+ try) to hard", () => {
    expect(deriveParagraphBlankTier(2)).toBe("hard");
    expect(deriveParagraphBlankTier(5)).toBe("hard");
    expect(deriveParagraphBlankTier(100)).toBe("hard");
  });

  it("has no path to 'again' for any non-negative retry count", () => {
    for (let retryCount = 0; retryCount <= 50; retryCount += 1) {
      expect(deriveParagraphBlankTier(retryCount)).not.toBe("again");
    }
  });
});
