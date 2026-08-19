import { describe, expect, it } from "vitest";
import { isHanziChar, triageParagraphCharacters, triagePhrasesInText } from "./paragraphTriage";

describe("isHanziChar", () => {
  it("returns true for a CJK unified ideograph", () => {
    expect(isHanziChar("你")).toBe(true);
  });

  it("returns false for ASCII letters, digits, and punctuation", () => {
    expect(isHanziChar("a")).toBe(false);
    expect(isHanziChar("1")).toBe(false);
    expect(isHanziChar("!")).toBe(false);
  });

  it("returns false for Chinese punctuation", () => {
    expect(isHanziChar("。")).toBe(false);
    expect(isHanziChar("，")).toBe(false);
  });
});

describe("triageParagraphCharacters", () => {
  it("returns one match per occurrence, not deduped", () => {
    const matches = triageParagraphCharacters(["你你好"], new Map([["你", "w1"]]));
    expect(matches).toHaveLength(3);
    expect(matches[0]).toEqual({
      sentenceIndex: 0,
      startOffset: 0,
      endOffset: 1,
      character: "你",
      existingWordId: "w1",
    });
    expect(matches[1]).toEqual({
      sentenceIndex: 0,
      startOffset: 1,
      endOffset: 2,
      character: "你",
      existingWordId: "w1",
    });
  });

  it("flags a character as unknown (null) when it isn't in the existing map", () => {
    const matches = triageParagraphCharacters(["你好"], new Map([["你", "w1"]]));
    expect(matches[0].existingWordId).toBe("w1");
    expect(matches[1].existingWordId).toBeNull();
  });

  it("skips non-Hanzi characters entirely", () => {
    const matches = triageParagraphCharacters(["hello你world"], new Map());
    expect(matches).toHaveLength(1);
    expect(matches[0].character).toBe("你");
  });

  it("tracks sentenceIndex across multiple sentences", () => {
    const matches = triageParagraphCharacters(["你好", "再见"], new Map());
    expect(matches.map((m) => m.sentenceIndex)).toEqual([0, 0, 1, 1]);
  });

  it("returns an empty array for a sentence with no Hanzi", () => {
    expect(triageParagraphCharacters(["hello!"], new Map())).toEqual([]);
  });

  it("returns an empty array for an empty sentence list", () => {
    expect(triageParagraphCharacters([], new Map())).toEqual([]);
  });
});

describe("triagePhrasesInText", () => {
  it("matches a known phrase substring", () => {
    const matches = triagePhrasesInText(["我喜欢图书馆"], new Map([["图书馆", "vp1"]]));
    expect(matches).toEqual([
      {
        sentenceIndex: 0,
        startOffset: 3,
        endOffset: 6,
        phrase: "图书馆",
        existingVocabPhraseId: "vp1",
      },
    ]);
  });

  it("prefers the longest match at an overlapping start offset", () => {
    // "图书馆" and "图书" both start at offset 3; longest-match-first must
    // choose "图书馆" and must NOT also separately flag "图书" inside it.
    const matches = triagePhrasesInText(
      ["我喜欢图书馆和图书"],
      new Map([
        ["图书馆", "vp1"],
        ["图书", "vp2"],
      ])
    );
    expect(matches).toEqual([
      { sentenceIndex: 0, startOffset: 3, endOffset: 6, phrase: "图书馆", existingVocabPhraseId: "vp1" },
      { sentenceIndex: 0, startOffset: 7, endOffset: 9, phrase: "图书", existingVocabPhraseId: "vp2" },
    ]);
  });

  it("never matches a phrase spanning a sentence boundary", () => {
    // "图书馆" would appear if the two sentences were concatenated, but the
    // scan runs per-sentence and must never merge across the boundary.
    const matches = triagePhrasesInText(["我喜欢图书", "馆很大"], new Map([["图书馆", "vp1"]]));
    expect(matches).toEqual([]);
  });

  it("returns an empty array when no phrase in the map appears in the text", () => {
    const matches = triagePhrasesInText(["没有已知词语"], new Map([["图书馆", "vp1"]]));
    expect(matches).toEqual([]);
  });

  it("returns an empty array immediately when the existing-phrase map is empty", () => {
    expect(triagePhrasesInText(["我喜欢图书馆"], new Map())).toEqual([]);
  });

  it("matches multiple distinct phrases in the same sentence", () => {
    const matches = triagePhrasesInText(
      ["你好，谢谢你的图书馆"],
      new Map([
        ["你好", "vp1"],
        ["图书馆", "vp2"],
      ])
    );
    expect(matches.map((m) => m.phrase)).toEqual(["你好", "图书馆"]);
  });
});
