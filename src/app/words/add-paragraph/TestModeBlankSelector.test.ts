import { describe, expect, it } from "vitest";
import {
  assignBlankDisplayIndexes,
  classifyTokenEligibility,
  computeSpanId,
  mergePendingSpansIntoSentences,
  parseSpanId,
  resolvePendingSpan,
  type SpanPosition,
} from "./TestModeBlankSelector";
import type { SentenceRenderToken } from "./ParagraphSpanSelector";
import type { Paragraph, ParagraphSentence, ParagraphSpan } from "@/lib/paragraph.types";

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

describe("classifyTokenEligibility", () => {
  it("classifies a text (punctuation) token as unknown", () => {
    const token: SentenceRenderToken = { kind: "text", startOffset: 0, endOffset: 1, text: "，" };
    expect(classifyTokenEligibility(token, [])).toBe("unknown");
  });

  it("classifies an unresolved character token as unknown", () => {
    const token: SentenceRenderToken = { kind: "character", startOffset: 0, endOffset: 1, text: "你", wordId: null };
    expect(classifyTokenEligibility(token, [])).toBe("unknown");
  });

  it("classifies a known character token with no matching persisted span as eligible (known-to-the-family is enough, regardless of which paragraph tracked it first)", () => {
    const token: SentenceRenderToken = { kind: "character", startOffset: 0, endOffset: 1, text: "你", wordId: "w1" };
    expect(classifyTokenEligibility(token, [])).toBe("eligible");
  });

  it("classifies a persisted span flagged fillTestEligible: false as ineligible", () => {
    const token: SentenceRenderToken = { kind: "character", startOffset: 0, endOffset: 1, text: "你", wordId: "w1" };
    const spans = [makeSpan({ startOffset: 0, endOffset: 1, fillTestEligible: false })];
    expect(classifyTokenEligibility(token, spans)).toBe("ineligible");
  });

  it("classifies a persisted span flagged fillTestEligible: true as eligible", () => {
    const token: SentenceRenderToken = { kind: "character", startOffset: 0, endOffset: 1, text: "你", wordId: "w1" };
    const spans = [makeSpan({ startOffset: 0, endOffset: 1, fillTestEligible: true })];
    expect(classifyTokenEligibility(token, spans)).toBe("eligible");
  });

  it("classifies a known phrase token the same way, matched by exact offsets", () => {
    const token: SentenceRenderToken = {
      kind: "phrase",
      startOffset: 3,
      endOffset: 6,
      text: "图书馆",
      vocabPhraseId: "vp1",
    };
    const spans = [
      makeSpan({ id: "s2", text: "图书馆", startOffset: 3, endOffset: 6, kind: "phrase", fillTestEligible: true }),
    ];
    expect(classifyTokenEligibility(token, spans)).toBe("eligible");
  });

  it("does not match a persisted span at a different offset -- still eligible (known), just not the tracked one", () => {
    const token: SentenceRenderToken = { kind: "character", startOffset: 5, endOffset: 6, text: "他", wordId: "w2" };
    const spans = [makeSpan({ startOffset: 0, endOffset: 1, fillTestEligible: true })];
    expect(classifyTokenEligibility(token, spans)).toBe("eligible");
  });

  it("a persisted span at a different offset explicitly ineligible does not affect this token either", () => {
    const token: SentenceRenderToken = { kind: "character", startOffset: 5, endOffset: 6, text: "他", wordId: "w2" };
    const spans = [makeSpan({ startOffset: 0, endOffset: 1, fillTestEligible: false })];
    expect(classifyTokenEligibility(token, spans)).toBe("eligible");
  });
});

describe("computeSpanId / parseSpanId", () => {
  it("round-trips sentenceIndex/startOffset/endOffset through the deterministic id format", () => {
    const id = computeSpanId(2, 3, 6);
    expect(id).toBe("s2-3-6");
    expect(parseSpanId(id)).toEqual({ sentenceIndex: 2, startOffset: 3, endOffset: 6 });
  });

  it("parseSpanId returns null for a malformed id", () => {
    expect(parseSpanId("not-a-span-id")).toBeNull();
    expect(parseSpanId("")).toBeNull();
  });
});

describe("resolvePendingSpan", () => {
  const paragraph: Paragraph = {
    id: "p1",
    familyId: "family-1",
    title: null,
    rawText: "我喜欢图书馆。",
    sentences: [{ index: 0, text: "我喜欢图书馆。", paragraphBreakBefore: false, spans: [] }],
    createdByUserId: "user-1",
    createdAt: 0,
    updatedAt: 0,
  };

  it("materializes a not-yet-persisted eligible character token into a real ParagraphSpan", () => {
    const characterMatches = new Map([
      [0, [{ sentenceIndex: 0, startOffset: 0, endOffset: 1, character: "我", existingWordId: "w1" }]],
    ]);
    const span = resolvePendingSpan("s0-0-1", paragraph, characterMatches, new Map());
    expect(span).toEqual({
      id: "s0-0-1",
      text: "我",
      startOffset: 0,
      endOffset: 1,
      kind: "character",
      resolvedWordId: "w1",
      fillTestEligible: true,
    });
  });

  it("materializes a not-yet-persisted eligible phrase token into a real ParagraphSpan", () => {
    const phraseMatches = new Map([
      [0, [{ sentenceIndex: 0, startOffset: 3, endOffset: 6, phrase: "图书馆", existingVocabPhraseId: "vp1" }]],
    ]);
    const span = resolvePendingSpan("s0-3-6", paragraph, new Map(), phraseMatches);
    expect(span).toEqual({
      id: "s0-3-6",
      text: "图书馆",
      startOffset: 3,
      endOffset: 6,
      kind: "phrase",
      resolvedVocabPhraseId: "vp1",
      fillTestEligible: true,
    });
  });

  it("returns null for a malformed id", () => {
    expect(resolvePendingSpan("garbage", paragraph, new Map(), new Map())).toBeNull();
  });

  it("returns null when the sentence index no longer exists", () => {
    expect(resolvePendingSpan("s9-0-1", paragraph, new Map(), new Map())).toBeNull();
  });

  it("returns null when nothing resolves at that offset (no matching token)", () => {
    expect(resolvePendingSpan("s0-0-1", paragraph, new Map(), new Map())).toBeNull();
  });
});

describe("mergePendingSpansIntoSentences", () => {
  const sentences: ParagraphSentence[] = [
    { index: 0, text: "我喜欢图书馆。", paragraphBreakBefore: false, spans: [] },
    { index: 1, text: "谢谢。", paragraphBreakBefore: false, spans: [] },
  ];

  it("groups new spans by the sentenceIndex embedded in their id and appends onto existing spans", () => {
    const existing = { ...sentences[0] } as ParagraphSentence;
    existing.spans = [
      { id: "s0-3-6", text: "图书馆", startOffset: 3, endOffset: 6, kind: "phrase", resolvedVocabPhraseId: "vp1", fillTestEligible: true },
    ];
    const newSpan: ParagraphSpan = {
      id: "s0-0-1",
      text: "我",
      startOffset: 0,
      endOffset: 1,
      kind: "character",
      resolvedWordId: "w1",
      fillTestEligible: true,
    };

    const result = mergePendingSpansIntoSentences([existing, sentences[1]], [newSpan]);
    expect(result[0]?.spans).toHaveLength(2);
    expect(result[0]?.spans.map((s) => s.startOffset)).toEqual([0, 3]);
    expect(result[1]?.spans).toEqual([]);
  });

  it("ignores a span whose id doesn't parse", () => {
    const malformed: ParagraphSpan = {
      id: "not-a-span-id",
      text: "我",
      startOffset: 0,
      endOffset: 1,
      kind: "character",
      fillTestEligible: true,
    };
    const result = mergePendingSpansIntoSentences(sentences, [malformed]);
    expect(result[0]?.spans).toEqual([]);
    expect(result[1]?.spans).toEqual([]);
  });

  it("returns sentences unchanged when there are no new spans", () => {
    const result = mergePendingSpansIntoSentences(sentences, []);
    expect(result).toEqual(sentences);
  });
});

describe("assignBlankDisplayIndexes", () => {
  const positions = new Map<string, SpanPosition>([
    ["s0-0-1", { sentenceIndex: 0, startOffset: 0 }],
    ["s0-3-6", { sentenceIndex: 0, startOffset: 3 }],
    ["s1-0-1", { sentenceIndex: 1, startOffset: 0 }],
  ]);

  it("numbers by paragraph reading position, not selection order", () => {
    // Selected in reverse-of-position order: sentence 1 first, then sentence 0's two spans.
    const result = assignBlankDisplayIndexes(["s1-0-1", "s0-3-6", "s0-0-1"], positions);
    expect(result.get("s0-0-1")).toBe(1);
    expect(result.get("s0-3-6")).toBe(2);
    expect(result.get("s1-0-1")).toBe(3);
  });

  it("returns an empty map for an empty selection", () => {
    expect(assignBlankDisplayIndexes([], positions)).toEqual(new Map());
  });

  it("silently excludes a span id with no known position", () => {
    const result = assignBlankDisplayIndexes(["s0-0-1", "unknown-id"], positions);
    expect(result.get("s0-0-1")).toBe(1);
    expect(result.has("unknown-id")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("renumbers correctly after a toggle-off/toggle-on sequence", () => {
    const afterRemoval = assignBlankDisplayIndexes(["s0-0-1", "s1-0-1"], positions);
    expect(afterRemoval.get("s0-0-1")).toBe(1);
    expect(afterRemoval.get("s1-0-1")).toBe(2);

    const afterReAdd = assignBlankDisplayIndexes(["s0-0-1", "s1-0-1", "s0-3-6"], positions);
    expect(afterReAdd.get("s0-0-1")).toBe(1);
    expect(afterReAdd.get("s0-3-6")).toBe(2);
    expect(afterReAdd.get("s1-0-1")).toBe(3);
  });

  it("breaks ties within the same sentence by startOffset ascending", () => {
    const result = assignBlankDisplayIndexes(["s0-3-6", "s0-0-1"], positions);
    expect(result.get("s0-0-1")).toBe(1);
    expect(result.get("s0-3-6")).toBe(2);
  });
});
