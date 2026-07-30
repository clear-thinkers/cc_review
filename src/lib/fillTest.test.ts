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

  it("grades a vocab-phrase-only round via vocabPhraseMemberResults, independent of memberResults", () => {
    const fillTest: FillTest = {
      phrases: ["\u8c22\u8c22"],
      sentences: [{ text: "___\uff0c\u4f60\u5e2e\u4e86\u6211\u5927\u5fd9\u3002", answerIndex: 0, vocabPhraseId: "phrase-1" }],
      vocabPhraseMembers: [{ vocabPhraseId: "phrase-1", phrase: "\u8c22\u8c22", phraseCount: 1 }],
    };

    const correct = gradeBundledFillTest(fillTest, [{ sentenceIndex: 0, chosenPhraseIndex: 0 }]);
    expect(correct.memberResults).toEqual([]);
    expect(correct.vocabPhraseMemberResults).toEqual([
      { vocabPhraseId: "phrase-1", phrase: "\u8c22\u8c22", correctCount: 1, totalCount: 1, tier: "easy" },
    ]);

    const wrong = gradeBundledFillTest(fillTest, [{ sentenceIndex: 0, chosenPhraseIndex: null as unknown as number }]);
    expect(wrong.vocabPhraseMemberResults[0]?.tier).toBe("again");
  });
});
