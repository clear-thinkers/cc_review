import { describe, expect, it } from "vitest";
import { calculateCoinValue, calculateCoinValueForEntry, calculateSessionCoins } from "./coins";
import type { SessionGradeData } from "./quiz.types";

describe("calculateCoinValue", () => {
  it("maps each character grade to its coin value", () => {
    expect(calculateCoinValue("easy")).toBe(5);
    expect(calculateCoinValue("good")).toBe(3);
    expect(calculateCoinValue("hard")).toBe(1);
    expect(calculateCoinValue("again")).toBe(0);
  });
});

describe("calculateCoinValueForEntry", () => {
  it("uses the character table for a non-phrase entry", () => {
    const entry: SessionGradeData = { wordId: "w1", hanzi: "谢", grade: "good" };
    expect(calculateCoinValueForEntry(entry)).toBe(3);
  });

  it("awards a flat 1 coin for a correctly-answered vocab-phrase entry", () => {
    const entry: SessionGradeData = {
      wordId: "phrase-1",
      hanzi: "谢谢",
      grade: "easy",
      isVocabPhrase: true,
    };
    expect(calculateCoinValueForEntry(entry)).toBe(1);
  });

  it("awards 0 coins for an incorrectly-answered vocab-phrase entry", () => {
    const entry: SessionGradeData = {
      wordId: "phrase-1",
      hanzi: "谢谢",
      grade: "again",
      isVocabPhrase: true,
    };
    expect(calculateCoinValueForEntry(entry)).toBe(0);
  });

  it("never awards the character 'easy' value (5) to a phrase entry", () => {
    const entry: SessionGradeData = {
      wordId: "phrase-1",
      hanzi: "谢谢",
      grade: "easy",
      isVocabPhrase: true,
    };
    expect(calculateCoinValueForEntry(entry)).not.toBe(5);
  });
});

describe("calculateSessionCoins", () => {
  it("sums character-table and flat-phrase-rule values together in one session", () => {
    const gradeData: SessionGradeData[] = [
      { wordId: "w1", hanzi: "谢", grade: "easy" }, // 5
      { wordId: "w2", hanzi: "对", grade: "hard" }, // 1
      { wordId: "phrase-1", hanzi: "谢谢", grade: "easy", isVocabPhrase: true }, // 1
      { wordId: "phrase-2", hanzi: "对不起", grade: "again", isVocabPhrase: true }, // 0
    ];

    expect(calculateSessionCoins(gradeData)).toBe(5 + 1 + 1 + 0);
  });

  it("returns 0 for an empty session", () => {
    expect(calculateSessionCoins([])).toBe(0);
  });
});
