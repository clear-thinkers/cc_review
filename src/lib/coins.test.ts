import { describe, expect, it } from "vitest";
import {
  calculateCoinValue,
  calculateCoinValueForEntry,
  calculateParagraphQuizSessionCoins,
  calculateSessionCoins,
} from "./coins";
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

  it("branches to the paragraph-quiz session-level formula when any entry is isParagraphBlank", () => {
    const gradeData: SessionGradeData[] = [
      { wordId: "w1", hanzi: "你", grade: "easy", isParagraphBlank: true, retryCount: 0 },
      { wordId: "w2", hanzi: "好", grade: "good", isParagraphBlank: true, retryCount: 1 },
    ];
    // totalIncorrectTries=1, totalBlanks=2 -> errorRate=0.5 -> bucket "< 0.75" -> 20
    expect(calculateSessionCoins(gradeData)).toBe(20);
  });

  it("does not branch to the paragraph-quiz formula for an ordinary character/phrase session", () => {
    const gradeData: SessionGradeData[] = [{ wordId: "w1", hanzi: "你", grade: "easy" }];
    expect(calculateSessionCoins(gradeData)).toBe(5);
  });
});

describe("calculateParagraphQuizSessionCoins", () => {
  it("returns 0 for a session with no blanks", () => {
    expect(calculateParagraphQuizSessionCoins(0, 0)).toBe(0);
    expect(calculateParagraphQuizSessionCoins(5, 0)).toBe(0);
  });

  it("pays 50 coins for an error rate strictly under 25%", () => {
    expect(calculateParagraphQuizSessionCoins(0, 20)).toBe(50);
    expect(calculateParagraphQuizSessionCoins(4, 20)).toBe(50); // 20% < 25%
  });

  it("pays 40 coins for an error rate at/over 25% but under 50%", () => {
    expect(calculateParagraphQuizSessionCoins(5, 20)).toBe(40); // exactly 25%
    expect(calculateParagraphQuizSessionCoins(9, 20)).toBe(40); // 45% < 50%
  });

  it("pays 20 coins for an error rate at/over 50% but under 75%", () => {
    expect(calculateParagraphQuizSessionCoins(10, 20)).toBe(20); // exactly 50%
    expect(calculateParagraphQuizSessionCoins(14, 20)).toBe(20); // 70% < 75%
  });

  it("pays 10 coins for an error rate at/over 75%", () => {
    expect(calculateParagraphQuizSessionCoins(15, 20)).toBe(10); // exactly 75%
    expect(calculateParagraphQuizSessionCoins(20, 20)).toBe(10); // 100%
  });

  it("pays the same coin total for the same error rate regardless of paragraph length", () => {
    // 20% error rate at three different sizes -> all land in the < 25% bucket (50 coins).
    expect(calculateParagraphQuizSessionCoins(1, 5)).toBe(50);
    expect(calculateParagraphQuizSessionCoins(8, 40)).toBe(50);
    expect(calculateParagraphQuizSessionCoins(2, 10)).toBe(50);
  });

  it("does not unfairly punish a short paragraph or let a long one off easy at the same raw count", () => {
    // A single mistake on a tiny 3-blank paragraph is a high error rate...
    expect(calculateParagraphQuizSessionCoins(1, 3)).toBe(40); // 33% -> 40-coin bucket
    // ...but the same single mistake on a 40-blank paragraph is a low rate.
    expect(calculateParagraphQuizSessionCoins(1, 40)).toBe(50); // 2.5% -> 50-coin bucket
  });
});
