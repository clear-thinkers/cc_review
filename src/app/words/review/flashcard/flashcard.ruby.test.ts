import { describe, expect, it } from "vitest";
import {
  getAlignedPinyinTokens,
  isHanziCharacter,
  splitPinyinTokens,
} from "./flashcard.ruby";

describe("flashcard.ruby", () => {
  it("detects Hanzi code points correctly", () => {
    expect(isHanziCharacter("领")).toBe(true);
    expect(isHanziCharacter("。")).toBe(false);
    expect(isHanziCharacter("a")).toBe(false);
  });

  it("splits whitespace pinyin and removes punctuation", () => {
    const tokens = splitPinyinTokens("lǐng, dǎo!  wǒmen");
    expect(tokens).toEqual(["lǐng", "dǎo", "wǒmen"]);
  });

  it("falls back to compact syllable tokenization for example sentences", () => {
    const text = "老师领导我们学习新知识。";
    const pinyin = "lǎoshī lǐngdǎo wǒmen xuéxí xīn zhīshi";
    const tokens = getAlignedPinyinTokens(text, pinyin);

    // Compact words such as "lǎoshī" and "lǐngdǎo" should be segmented.
    expect(tokens.slice(0, 4)).toEqual(["lǎo", "shī", "lǐng", "dǎo"]);
    expect(tokens.length).toBeGreaterThanOrEqual(10);
  });

  it("returns available tokens when counts still mismatch", () => {
    const tokens = getAlignedPinyinTokens("新知", "xīn");
    expect(tokens.length).toBe(2);
    expect(tokens[0]?.startsWith("x")).toBe(true);
  });
});
