/**
 * ParagraphSpanSelector — focused logic tests.
 *
 * @testing-library/react is not available in this project (see
 * src/app/words/results/SessionHistoryTable.test.ts), so per
 * 0_BUILD_CONVENTIONS.md §6's UI seam priority, these tests exercise the
 * extracted pure helpers directly rather than rendering the component.
 */
import { describe, expect, it } from "vitest";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import {
  buildSentenceRenderTokens,
  computeDragSelectionRange,
  type SentenceRenderToken,
} from "./ParagraphSpanSelector";

describe("buildSentenceRenderTokens", () => {
  it("emits one character token per unmatched Hanzi, flagging known vs unknown", () => {
    const characterMatches: CharacterTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, character: "你", existingWordId: "w1" },
      { sentenceIndex: 0, startOffset: 1, endOffset: 2, character: "好", existingWordId: null },
    ];
    const tokens = buildSentenceRenderTokens("你好", characterMatches, []);
    expect(tokens).toEqual([
      { kind: "character", startOffset: 0, endOffset: 1, text: "你", wordId: "w1" },
      { kind: "character", startOffset: 1, endOffset: 2, text: "好", wordId: null },
    ]);
  });

  it("emits a single atomic phrase token for a known phrase match, skipping its inner characters", () => {
    const characterMatches: CharacterTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 1, character: "图", existingWordId: null },
      { sentenceIndex: 0, startOffset: 1, endOffset: 2, character: "书", existingWordId: null },
      { sentenceIndex: 0, startOffset: 2, endOffset: 3, character: "馆", existingWordId: null },
    ];
    const phraseMatches: PhraseTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 3, phrase: "图书馆", existingVocabPhraseId: "vp1" },
    ];
    const tokens = buildSentenceRenderTokens("图书馆", characterMatches, phraseMatches);
    expect(tokens).toEqual([
      { kind: "phrase", startOffset: 0, endOffset: 3, text: "图书馆", vocabPhraseId: "vp1" },
    ]);
  });

  it("emits non-selectable text tokens for punctuation and non-Hanzi content", () => {
    const tokens = buildSentenceRenderTokens("Hi!", [], []);
    expect(tokens).toEqual([
      { kind: "text", startOffset: 0, endOffset: 1, text: "H" },
      { kind: "text", startOffset: 1, endOffset: 2, text: "i" },
      { kind: "text", startOffset: 2, endOffset: 3, text: "!" },
    ]);
  });

  it("mixes phrase, character, and text tokens in offset order", () => {
    const characterMatches: CharacterTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 4, endOffset: 5, character: "和", existingWordId: "w-he" },
    ];
    const phraseMatches: PhraseTriageMatch[] = [
      { sentenceIndex: 0, startOffset: 0, endOffset: 3, phrase: "图书馆", existingVocabPhraseId: "vp1" },
    ];
    const tokens = buildSentenceRenderTokens("图书馆，和", characterMatches, phraseMatches);
    expect(tokens.map((t) => t.kind)).toEqual(["phrase", "text", "character"]);
  });

  it("returns an empty array for an empty sentence", () => {
    expect(buildSentenceRenderTokens("", [], [])).toEqual([]);
  });
});

describe("computeDragSelectionRange", () => {
  const tokens: SentenceRenderToken[] = [
    { kind: "character", startOffset: 0, endOffset: 1, text: "我", wordId: null },
    { kind: "character", startOffset: 1, endOffset: 2, text: "喜", wordId: null },
    { kind: "text", startOffset: 2, endOffset: 3, text: "，" },
    { kind: "character", startOffset: 3, endOffset: 4, text: "欢", wordId: null },
  ];

  it("returns the single-token range when anchor equals current", () => {
    expect(computeDragSelectionRange(tokens, 0, 0)).toEqual({ startOffset: 0, endOffset: 1 });
  });

  it("returns a merged range across a contiguous run of selectable tokens", () => {
    expect(computeDragSelectionRange(tokens, 0, 1)).toEqual({ startOffset: 0, endOffset: 2 });
  });

  it("clamps to the anchor alone when the drag crosses into a different run", () => {
    // Dragging from token 0 (run A) onto token 3 (run B, across the "，" text token)
    // must not merge across the gap.
    expect(computeDragSelectionRange(tokens, 0, 3)).toEqual({ startOffset: 0, endOffset: 1 });
  });

  it("returns null when the anchor itself is a non-selectable text token", () => {
    expect(computeDragSelectionRange(tokens, 2, 2)).toBeNull();
  });

  it("supports dragging backwards (current index before anchor index)", () => {
    expect(computeDragSelectionRange(tokens, 1, 0)).toEqual({ startOffset: 0, endOffset: 2 });
  });
});
