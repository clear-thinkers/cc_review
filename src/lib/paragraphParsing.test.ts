import { describe, expect, it } from "vitest";
import {
  MAX_PARAGRAPH_INPUT_LENGTH,
  buildParagraphSentences,
  splitIntoSentences,
  truncateParagraphInput,
} from "./paragraphParsing";

describe("splitIntoSentences", () => {
  it("returns an empty array for empty input", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(splitIntoSentences("   \n  ")).toEqual([]);
  });

  it("splits on Chinese sentence-ending punctuation", () => {
    const result = splitIntoSentences("你好。今天天气很好！你吃饭了吗？");
    expect(result.map((s) => s.text)).toEqual(["你好。", "今天天气很好！", "你吃饭了吗？"]);
  });

  it("splits on ASCII sentence-ending punctuation", () => {
    const result = splitIntoSentences("Hello! How are you? I am fine.");
    expect(result.map((s) => s.text)).toEqual(["Hello!", "How are you?", "I am fine."]);
  });

  it("handles mixed EN/ZH punctuation in the same input", () => {
    const result = splitIntoSentences("你好! 今天天气很好.");
    expect(result.map((s) => s.text)).toEqual(["你好!", "今天天气很好."]);
  });

  it("treats a single newline as a sentence boundary even without punctuation", () => {
    const result = splitIntoSentences("第一行\n第二行");
    expect(result.map((s) => s.text)).toEqual(["第一行", "第二行"]);
  });

  it("trims each sentence and drops empties", () => {
    const result = splitIntoSentences("  你好。   \n  再见。  ");
    expect(result.map((s) => s.text)).toEqual(["你好。", "再见。"]);
  });

  it("does not mark paragraphBreakBefore on the first sentence", () => {
    const result = splitIntoSentences("你好。");
    expect(result[0].paragraphBreakBefore).toBe(false);
  });

  it("marks paragraphBreakBefore true only on the first sentence after a blank line", () => {
    const result = splitIntoSentences("第一段第一句。第一段第二句。\n\n第二段第一句。第二段第二句。");
    expect(result.map((s) => ({ text: s.text, break: s.paragraphBreakBefore }))).toEqual([
      { text: "第一段第一句。", break: false },
      { text: "第一段第二句。", break: false },
      { text: "第二段第一句。", break: true },
      { text: "第二段第二句。", break: false },
    ]);
  });

  it("treats three or more consecutive newlines as a single paragraph break", () => {
    const result = splitIntoSentences("第一段。\n\n\n第二段。");
    expect(result.map((s) => s.paragraphBreakBefore)).toEqual([false, true]);
  });

  it("does not treat a single newline as a paragraph break", () => {
    const result = splitIntoSentences("第一行\n第二行");
    expect(result.map((s) => s.paragraphBreakBefore)).toEqual([false, false]);
  });

  it("handles a paragraph with zero Hanzi content", () => {
    const result = splitIntoSentences("Just English text.");
    expect(result.map((s) => s.text)).toEqual(["Just English text."]);
  });

  it("treats each punctuation mark as its own sentence fragment for punctuation-only input", () => {
    // Trailing punctuation is not "empty" under the trim/drop-empties rule —
    // this matches zero Hanzi content regardless, so paragraphTriage still
    // reports zero character matches for text like this.
    const result = splitIntoSentences("。！？");
    expect(result.map((s) => s.text)).toEqual(["。", "！", "？"]);
  });
});

describe("buildParagraphSentences", () => {
  it("wraps split output into ParagraphSentence skeletons with empty spans", () => {
    const result = buildParagraphSentences("你好。再见。");
    expect(result).toEqual([
      { index: 0, text: "你好。", paragraphBreakBefore: false, spans: [] },
      { index: 1, text: "再见。", paragraphBreakBefore: false, spans: [] },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(buildParagraphSentences("")).toEqual([]);
  });

  it("assigns sequential zero-based indices", () => {
    const result = buildParagraphSentences("一。二。三。");
    expect(result.map((s) => s.index)).toEqual([0, 1, 2]);
  });
});

describe("truncateParagraphInput", () => {
  it("returns input unchanged when at or under the max length", () => {
    const short = "你好";
    expect(truncateParagraphInput(short)).toEqual({ text: short, truncated: false });
  });

  it("returns input unchanged exactly at the max length boundary", () => {
    const exact = "a".repeat(MAX_PARAGRAPH_INPUT_LENGTH);
    expect(truncateParagraphInput(exact)).toEqual({ text: exact, truncated: false });
  });

  it("truncates input over the max length and flags it", () => {
    const long = "a".repeat(MAX_PARAGRAPH_INPUT_LENGTH + 100);
    const result = truncateParagraphInput(long);
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(MAX_PARAGRAPH_INPUT_LENGTH);
    expect(result.text).toBe("a".repeat(MAX_PARAGRAPH_INPUT_LENGTH));
  });
});
