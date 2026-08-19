import { describe, expect, it } from "vitest";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { ParagraphSentence } from "@/lib/paragraph.types";
import {
  mergeResolvedSpansIntoSentences,
  resolveSelectedSpans,
  splitSpansNeedingInsert,
  toggleSelectionRange,
} from "./addParagraphIngestion";

describe("toggleSelectionRange", () => {
  it("adds a candidate range to an empty selection", () => {
    const result = toggleSelectionRange([], { startOffset: 0, endOffset: 1 });
    expect(result).toEqual([{ startOffset: 0, endOffset: 1 }]);
  });

  it("removes an existing range identical to the candidate (toggle off)", () => {
    const result = toggleSelectionRange([{ startOffset: 0, endOffset: 1 }], { startOffset: 0, endOffset: 1 });
    expect(result).toEqual([]);
  });

  it("drops overlapping ranges before adding the candidate", () => {
    const result = toggleSelectionRange(
      [{ startOffset: 0, endOffset: 3 }],
      { startOffset: 1, endOffset: 2 }
    );
    expect(result).toEqual([{ startOffset: 1, endOffset: 2 }]);
  });

  it("keeps non-overlapping ranges and sorts by startOffset", () => {
    const result = toggleSelectionRange(
      [{ startOffset: 5, endOffset: 6 }],
      { startOffset: 0, endOffset: 1 }
    );
    expect(result).toEqual([
      { startOffset: 0, endOffset: 1 },
      { startOffset: 5, endOffset: 6 },
    ]);
  });

  it("treats adjacent (touching but not overlapping) ranges as non-overlapping", () => {
    const result = toggleSelectionRange(
      [{ startOffset: 0, endOffset: 2 }],
      { startOffset: 2, endOffset: 4 }
    );
    expect(result).toEqual([
      { startOffset: 0, endOffset: 2 },
      { startOffset: 2, endOffset: 4 },
    ]);
  });
});

describe("resolveSelectedSpans", () => {
  const sentenceTexts = new Map([[0, "我喜欢图书馆"]]);

  it("resolves a single-character selection as kind character, matched against characterMatches", () => {
    const characterMatches: CharacterTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, character: "我", existingWordId: "w1" },
    ];
    const result = resolveSelectedSpans(
      [{ sentenceIndex: 0, startOffset: 0, endOffset: 1 }],
      sentenceTexts,
      characterMatches,
      []
    );
    expect(result).toEqual([
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, text: "我", kind: "character", existingId: "w1" },
    ]);
  });

  it("resolves an unmatched single character as unknown (existingId null)", () => {
    const result = resolveSelectedSpans(
      [{ sentenceIndex: 0, startOffset: 0, endOffset: 1 }],
      sentenceTexts,
      [],
      []
    );
    expect(result[0]?.existingId).toBeNull();
    expect(result[0]?.kind).toBe("character");
  });

  it("resolves a multi-character selection as kind phrase, matched against phraseMatches", () => {
    const phraseMatches: PhraseTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, phrase: "图书馆", existingVocabPhraseId: "vp1" },
    ];
    const result = resolveSelectedSpans(
      [{ sentenceIndex: 0, startOffset: 3, endOffset: 6 }],
      sentenceTexts,
      [],
      phraseMatches
    );
    expect(result).toEqual([
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, text: "图书馆", kind: "phrase", existingId: "vp1" },
    ]);
  });

  it("resolves a brand-new multi-character selection (no phrase match) as an unadded phrase", () => {
    const result = resolveSelectedSpans(
      [{ sentenceIndex: 0, startOffset: 0, endOffset: 2 }],
      sentenceTexts,
      [],
      []
    );
    expect(result[0]).toEqual({
      sentenceIndex: 0,
      startOffset: 0,
      endOffset: 2,
      text: "我喜",
      kind: "phrase",
      existingId: null,
    });
  });
});

describe("splitSpansNeedingInsert", () => {
  it("collects unadded characters and phrases separately, deduped", () => {
    const result = splitSpansNeedingInsert([
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, text: "我", kind: "character", existingId: null },
      { sentenceIndex: 1, startOffset: 0, endOffset: 1, text: "我", kind: "character", existingId: null },
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, text: "图书馆", kind: "phrase", existingId: null },
    ]);
    expect(result.charactersToAdd).toEqual(["我"]);
    expect(result.phrasesToAdd).toEqual(["图书馆"]);
  });

  it("excludes spans that already have an existingId", () => {
    const result = splitSpansNeedingInsert([
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, text: "我", kind: "character", existingId: "w1" },
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, text: "图书馆", kind: "phrase", existingId: "vp1" },
    ]);
    expect(result.charactersToAdd).toEqual([]);
    expect(result.phrasesToAdd).toEqual([]);
  });

  it("returns empty lists for an empty input", () => {
    expect(splitSpansNeedingInsert([])).toEqual({ charactersToAdd: [], phrasesToAdd: [] });
  });
});

describe("mergeResolvedSpansIntoSentences", () => {
  const sentences: ParagraphSentence[] = [
    { index: 0, text: "我喜欢图书馆。", paragraphBreakBefore: false, spans: [] },
    { index: 1, text: "谢谢。", paragraphBreakBefore: false, spans: [] },
  ];

  it("builds spans with resolved ids, using existingId first and falling back to the id map", () => {
    const resolved = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, text: "我", kind: "character" as const, existingId: null },
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, text: "图书馆", kind: "phrase" as const, existingId: "vp1" },
    ];
    const result = mergeResolvedSpansIntoSentences(
      sentences,
      resolved,
      new Map([["我", "w-new-1"]]),
      new Map()
    );

    expect(result[0]?.spans).toEqual([
      {
        id: "s0-0-1",
        text: "我",
        startOffset: 0,
        endOffset: 1,
        kind: "character",
        fillTestEligible: true,
        resolvedWordId: "w-new-1",
      },
      {
        id: "s0-3-6",
        text: "图书馆",
        startOffset: 3,
        endOffset: 6,
        kind: "phrase",
        fillTestEligible: true,
        resolvedVocabPhraseId: "vp1",
      },
    ]);
  });

  it("leaves a sentence's spans empty when nothing was resolved for it", () => {
    const result = mergeResolvedSpansIntoSentences(sentences, [], new Map(), new Map());
    expect(result[1]?.spans).toEqual([]);
  });

  it("preserves sentence text/index/paragraphBreakBefore unchanged", () => {
    const result = mergeResolvedSpansIntoSentences(sentences, [], new Map(), new Map());
    expect(result[1]).toEqual({ index: 1, text: "谢谢。", paragraphBreakBefore: false, spans: [] });
  });

  it("appends newly-resolved spans onto a sentence's pre-existing spans, never dropping them (Continue Import)", () => {
    const preExistingSpan = {
      id: "s0-3-6",
      text: "图书馆",
      startOffset: 3,
      endOffset: 6,
      kind: "phrase" as const,
      resolvedVocabPhraseId: "vp1",
      fillTestEligible: true,
    };
    const sentencesWithExisting: ParagraphSentence[] = [
      { index: 0, text: "我喜欢图书馆。", paragraphBreakBefore: false, spans: [preExistingSpan] },
    ];
    const resolved = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, text: "我", kind: "character" as const, existingId: "w-new" },
    ];

    const result = mergeResolvedSpansIntoSentences(sentencesWithExisting, resolved, new Map(), new Map());

    expect(result[0]?.spans).toHaveLength(2);
    expect(result[0]?.spans).toContainEqual(preExistingSpan);
    expect(result[0]?.spans).toContainEqual(
      expect.objectContaining({ id: "s0-0-1", text: "我", resolvedWordId: "w-new" })
    );
  });

  it("sorts spans within a sentence by startOffset", () => {
    const resolved = [
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, text: "图书馆", kind: "phrase" as const, existingId: "vp1" },
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, text: "我", kind: "character" as const, existingId: "w1" },
    ];
    const result = mergeResolvedSpansIntoSentences(sentences, resolved, new Map(), new Map());
    expect(result[0]?.spans.map((s) => s.startOffset)).toEqual([0, 3]);
  });
});
