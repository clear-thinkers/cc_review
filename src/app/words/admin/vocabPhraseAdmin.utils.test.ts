import { describe, expect, it } from "vitest";
import {
  allSelectedExamplesIncluded,
  resolveBatchPhraseTargets,
  resolveExamplePinyinRefreshIndices,
  vocabPhraseHasContent,
  vocabPhraseMissingExamplePinyin,
} from "./vocabPhraseAdmin.utils";
import type { VocabPhrase } from "@/lib/types";

function makePhrase(overrides: Partial<VocabPhrase> = {}): VocabPhrase {
  return {
    id: "phrase-1",
    phrase: "谢谢",
    pinyin: "xièxie",
    meaningZh: "感谢",
    meaningEn: "thank you",
    examples: [{ zh: "谢谢你。", pinyin: "xièxie nǐ.", includeInFillTest: true }],
    testCount: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("vocabPhraseHasContent", () => {
  it("is true only when pinyin, both definitions, and at least one example are all present", () => {
    expect(vocabPhraseHasContent(makePhrase())).toBe(true);
  });

  it("is false when any single field is missing", () => {
    expect(vocabPhraseHasContent(makePhrase({ pinyin: undefined }))).toBe(false);
    expect(vocabPhraseHasContent(makePhrase({ meaningZh: undefined }))).toBe(false);
    expect(vocabPhraseHasContent(makePhrase({ meaningEn: undefined }))).toBe(false);
    expect(vocabPhraseHasContent(makePhrase({ examples: [] }))).toBe(false);
  });
});

describe("vocabPhraseMissingExamplePinyin", () => {
  it("is false when every example has pinyin", () => {
    expect(vocabPhraseMissingExamplePinyin(makePhrase())).toBe(false);
  });

  it("is true when any example is missing pinyin", () => {
    expect(
      vocabPhraseMissingExamplePinyin(
        makePhrase({ examples: [{ zh: "谢谢你。", pinyin: "", includeInFillTest: true }] })
      )
    ).toBe(true);
  });

  it("is false for a phrase with no examples at all", () => {
    expect(vocabPhraseMissingExamplePinyin(makePhrase({ examples: [] }))).toBe(false);
  });
});

describe("resolveBatchPhraseTargets", () => {
  const complete = makePhrase({ id: "complete" });
  const incomplete = makePhrase({ id: "incomplete", pinyin: undefined });
  const phrases = [complete, incomplete];
  const context = {
    filteredIds: new Set(["incomplete"]),
    selectedIds: new Set(["complete"]),
    isMissing: (p: VocabPhrase) => !vocabPhraseHasContent(p),
  };

  it("missing_only resolves via the isMissing predicate, ignoring filter/selection", () => {
    expect(resolveBatchPhraseTargets(phrases, "missing_only", context)).toEqual([incomplete]);
  });

  it("all resolves to every phrase", () => {
    expect(resolveBatchPhraseTargets(phrases, "all", context)).toEqual(phrases);
  });

  it("filtered resolves to the filteredIds set", () => {
    expect(resolveBatchPhraseTargets(phrases, "filtered", context)).toEqual([incomplete]);
  });

  it("selected resolves to the selectedIds set", () => {
    expect(resolveBatchPhraseTargets(phrases, "selected", context)).toEqual([complete]);
  });
});

describe("resolveExamplePinyinRefreshIndices", () => {
  const examples = [
    { zh: "一", pinyin: "yī", includeInFillTest: true },
    { zh: "二", pinyin: "", includeInFillTest: true },
    { zh: "三", pinyin: "sān", includeInFillTest: true },
  ];

  it("missing_only returns only indices with empty pinyin", () => {
    expect(resolveExamplePinyinRefreshIndices(examples, "missing_only")).toEqual([1]);
  });

  it("refresh returns every index regardless of existing pinyin", () => {
    expect(resolveExamplePinyinRefreshIndices(examples, "refresh")).toEqual([0, 1, 2]);
  });
});

describe("allSelectedExamplesIncluded", () => {
  it("is false when the selection is empty (no examples at all)", () => {
    expect(allSelectedExamplesIncluded([])).toBe(false);
  });

  it("is true only when every example across every phrase is included", () => {
    const allIncluded = [makePhrase({ id: "a" }), makePhrase({ id: "b" })];
    expect(allSelectedExamplesIncluded(allIncluded)).toBe(true);

    const oneExcluded = [
      makePhrase({ id: "a" }),
      makePhrase({ id: "b", examples: [{ zh: "x", pinyin: "x", includeInFillTest: false }] }),
    ];
    expect(allSelectedExamplesIncluded(oneExcluded)).toBe(false);
  });
});
