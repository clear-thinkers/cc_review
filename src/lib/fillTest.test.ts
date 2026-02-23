import { describe, expect, it } from "vitest";
import { gradeFillTest, type FillTest, type Placement } from "./fillTest";

const sampleFillTest: FillTest = {
  phrases: ["eat", "run", "sleep"],
  sentences: [
    { text: "I like to ___ in the morning.", answerIndex: 1 },
    { text: "After lunch, I ___ a snack.", answerIndex: 0 },
    { text: "At night, I ___ early.", answerIndex: 2 },
  ],
};

describe("gradeFillTest", () => {
  it("returns easy for a perfect 3/3 match", () => {
    const placements: Placement[] = [
      { sentenceIndex: 0, chosenPhraseIndex: 1 },
      { sentenceIndex: 1, chosenPhraseIndex: 0 },
      { sentenceIndex: 2, chosenPhraseIndex: 2 },
    ];

    const result = gradeFillTest(sampleFillTest, placements);

    expect(result.correctCount).toBe(3);
    expect(result.tier).toBe("easy");
    expect(result.sentenceResults.map((r) => r.isCorrect)).toEqual([true, true, true]);
    expect(result.placements).toEqual(placements);
  });

  it("returns good for a 2/3 match", () => {
    const result = gradeFillTest(sampleFillTest, [
      { sentenceIndex: 0, chosenPhraseIndex: 1 },
      { sentenceIndex: 1, chosenPhraseIndex: 2 },
      { sentenceIndex: 2, chosenPhraseIndex: 2 },
    ]);

    expect(result.correctCount).toBe(2);
    expect(result.tier).toBe("good");
  });

  it("returns hard for a 1/3 match", () => {
    const result = gradeFillTest(sampleFillTest, [
      { sentenceIndex: 0, chosenPhraseIndex: 0 },
      { sentenceIndex: 1, chosenPhraseIndex: 1 },
      { sentenceIndex: 2, chosenPhraseIndex: 2 },
    ]);

    expect(result.correctCount).toBe(1);
    expect(result.tier).toBe("hard");
  });

  it("returns again for 0/3 when placements are missing", () => {
    const result = gradeFillTest(sampleFillTest, []);

    expect(result.correctCount).toBe(0);
    expect(result.tier).toBe("again");
    expect(result.sentenceResults).toEqual([
      {
        sentenceIndex: 0,
        expectedPhraseIndex: 1,
        chosenPhraseIndex: null,
        isCorrect: false,
      },
      {
        sentenceIndex: 1,
        expectedPhraseIndex: 0,
        chosenPhraseIndex: null,
        isCorrect: false,
      },
      {
        sentenceIndex: 2,
        expectedPhraseIndex: 2,
        chosenPhraseIndex: null,
        isCorrect: false,
      },
    ]);
  });

  it("keeps the last placement when sentenceIndex is duplicated", () => {
    const result = gradeFillTest(sampleFillTest, [
      { sentenceIndex: 0, chosenPhraseIndex: 0 },
      { sentenceIndex: 1, chosenPhraseIndex: 0 },
      { sentenceIndex: 0, chosenPhraseIndex: 1 },
      { sentenceIndex: 2, chosenPhraseIndex: 2 },
    ]);

    expect(result.correctCount).toBe(3);
    expect(result.tier).toBe("easy");
    expect(result.sentenceResults[0].chosenPhraseIndex).toBe(1);
  });

  it("ignores out-of-range placements", () => {
    const placements = [
      { sentenceIndex: 0, chosenPhraseIndex: 1 },
      { sentenceIndex: 3, chosenPhraseIndex: 0 },
      { sentenceIndex: 1, chosenPhraseIndex: -1 },
      { sentenceIndex: 2, chosenPhraseIndex: 2 },
      { sentenceIndex: 2, chosenPhraseIndex: 4 },
    ] as unknown as Placement[];

    const result = gradeFillTest(sampleFillTest, placements);

    expect(result.correctCount).toBe(2);
    expect(result.tier).toBe("good");
    expect(result.sentenceResults.map((r) => r.sentenceIndex)).toEqual([0, 1, 2]);
    expect(result.sentenceResults[1].chosenPhraseIndex).toBe(null);
  });
});
