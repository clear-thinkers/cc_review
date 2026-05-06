import { describe, expect, it } from "vitest";
import { gradeBundledFillTest, type FillTest, type Placement } from "./fillTest";

function makeFillTest(phrasesByMember: Array<{ wordId: string; hanzi: string; phrases: string[] }>): FillTest {
  const phrases = phrasesByMember.flatMap((member) => member.phrases);
  return {
    phrases,
    sentences: phrasesByMember.flatMap((member) =>
      member.phrases.map((phrase) => ({
        text: `${phrase}___`,
        answerIndex: phrases.indexOf(phrase),
        characterId: member.wordId,
      }))
    ),
    members: phrasesByMember.map((member) => ({
      wordId: member.wordId,
      hanzi: member.hanzi,
      phraseCount: member.phrases.length,
    })),
  };
}

function placementsFor(fillTest: FillTest, correctSentenceIndexes: number[]): Placement[] {
  return fillTest.sentences.map((sentence, sentenceIndex) => ({
    sentenceIndex,
    chosenPhraseIndex: correctSentenceIndexes.includes(sentenceIndex)
      ? sentence.answerIndex
      : (sentence.answerIndex + 1) % fillTest.phrases.length,
  }));
}

describe("gradeBundledFillTest", () => {
  it("grades a bundled standard character and one-phrase character independently", () => {
    const fillTest = makeFillTest([
      { wordId: "low", hanzi: "\u4e00", phrases: ["\u4e00\u4e2a"] },
      { wordId: "standard", hanzi: "\u4e09", phrases: ["\u4e09\u4e2a", "\u4e09\u5929", "\u4e09\u5c81"] },
    ]);

    const result = gradeBundledFillTest(fillTest, placementsFor(fillTest, [0, 1, 2]));

    expect(result.memberResults).toEqual([
      { wordId: "low", hanzi: "\u4e00", correctCount: 1, totalCount: 1, tier: "easy" },
      { wordId: "standard", hanzi: "\u4e09", correctCount: 2, totalCount: 3, tier: "good" },
    ]);
  });

  it("grades two-phrase characters with the low-phrase correct-rate rule", () => {
    const fillTest = makeFillTest([
      { wordId: "two", hanzi: "\u4e8c", phrases: ["\u4e8c\u6708", "\u4e8c\u5341"] },
    ]);

    expect(gradeBundledFillTest(fillTest, placementsFor(fillTest, [0, 1])).memberResults[0]?.tier).toBe("easy");
    expect(gradeBundledFillTest(fillTest, placementsFor(fillTest, [0])).memberResults[0]?.tier).toBe("hard");
    expect(gradeBundledFillTest(fillTest, placementsFor(fillTest, [])).memberResults[0]?.tier).toBe("again");
  });
});
