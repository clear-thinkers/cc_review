import { describe, expect, it } from "vitest";
import { matchesParagraphTitleFilter, resolveParagraphTagIds } from "./paragraphLibrary";
import type { Paragraph, ParagraphSpan } from "./paragraph.types";
import type { ResolvedLessonTag } from "./tagging.types";

function makeSpan(overrides: Partial<ParagraphSpan>): ParagraphSpan {
  return {
    id: "span-1",
    text: "你",
    startOffset: 0,
    endOffset: 1,
    kind: "character",
    fillTestEligible: true,
    ...overrides,
  };
}

function makeParagraph(spans: ParagraphSpan[], title: string | null = null): Paragraph {
  return {
    id: "p1",
    familyId: "family-1",
    title,
    rawText: "你好",
    sentences: [{ index: 0, text: "你好", paragraphBreakBefore: false, spans }],
    createdByUserId: "user-1",
    createdAt: 0,
    updatedAt: 0,
  };
}

const TAG_A: ResolvedLessonTag = {
  lessonTagId: "tag-a",
  textbookId: "tb-1",
  textbookName: "人教版",
  grade: "G1",
  unit: "U1",
  lesson: "L1",
};
const TAG_B: ResolvedLessonTag = {
  lessonTagId: "tag-b",
  textbookId: "tb-1",
  textbookName: "人教版",
  grade: "G2",
  unit: "U2",
  lesson: "L2",
};

describe("resolveParagraphTagIds", () => {
  it("returns an empty set when the paragraph has no spans", () => {
    const result = resolveParagraphTagIds(makeParagraph([]), new Map(), new Map());
    expect(result.size).toBe(0);
  });

  it("resolves tags for a character span via resolvedWordId against wordTagsMap", () => {
    const paragraph = makeParagraph([makeSpan({ resolvedWordId: "w1" })]);
    const wordTagsMap = new Map([["w1", [TAG_A]]]);
    const result = resolveParagraphTagIds(paragraph, wordTagsMap, new Map());
    expect(result).toEqual(new Set(["tag-a"]));
  });

  it("resolves tags for a phrase span via resolvedVocabPhraseId against vocabPhraseTagsMap", () => {
    const paragraph = makeParagraph([
      makeSpan({ kind: "phrase", resolvedWordId: undefined, resolvedVocabPhraseId: "vp1" }),
    ]);
    const vocabPhraseTagsMap = new Map([["vp1", [TAG_B]]]);
    const result = resolveParagraphTagIds(paragraph, new Map(), vocabPhraseTagsMap);
    expect(result).toEqual(new Set(["tag-b"]));
  });

  it("unions tags across multiple spans, deduping repeated tag ids", () => {
    const paragraph = makeParagraph([
      makeSpan({ id: "s1", resolvedWordId: "w1" }),
      makeSpan({ id: "s2", resolvedWordId: "w2" }),
    ]);
    const wordTagsMap = new Map([
      ["w1", [TAG_A]],
      ["w2", [TAG_A, TAG_B]],
    ]);
    const result = resolveParagraphTagIds(paragraph, wordTagsMap, new Map());
    expect(result).toEqual(new Set(["tag-a", "tag-b"]));
  });

  it("silently contributes no tags for a span whose resolved id has no matching entry (deleted word/phrase)", () => {
    const paragraph = makeParagraph([makeSpan({ resolvedWordId: "deleted-word" })]);
    const result = resolveParagraphTagIds(paragraph, new Map(), new Map());
    expect(result.size).toBe(0);
  });

  it("skips a span with neither resolvedWordId nor resolvedVocabPhraseId set", () => {
    const paragraph = makeParagraph([makeSpan({ resolvedWordId: undefined })]);
    const result = resolveParagraphTagIds(paragraph, new Map([["w1", [TAG_A]]]), new Map());
    expect(result.size).toBe(0);
  });
});

describe("matchesParagraphTitleFilter", () => {
  it("returns true for an empty query regardless of title", () => {
    expect(matchesParagraphTitleFilter(makeParagraph([], null), "")).toBe(true);
    expect(matchesParagraphTitleFilter(makeParagraph([], "Chapter 3"), "   ")).toBe(true);
  });

  it("returns false when the query is non-empty but the paragraph has no title", () => {
    expect(matchesParagraphTitleFilter(makeParagraph([], null), "chapter")).toBe(false);
  });

  it("matches a case-insensitive substring", () => {
    expect(matchesParagraphTitleFilter(makeParagraph([], "Chapter 3 Reading"), "chapter")).toBe(true);
    expect(matchesParagraphTitleFilter(makeParagraph([], "Chapter 3 Reading"), "READING")).toBe(true);
  });

  it("returns false when the query doesn't appear in the title", () => {
    expect(matchesParagraphTitleFilter(makeParagraph([], "Chapter 3 Reading"), "chapter 5")).toBe(false);
  });
});
