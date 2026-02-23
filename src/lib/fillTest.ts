export type FillSentence = {
  text: string;
  answerIndex: 0 | 1 | 2;
};

export type FillTest = {
  phrases: [string, string, string];
  sentences: [FillSentence, FillSentence, FillSentence];
};

export type Placement = {
  sentenceIndex: 0 | 1 | 2;
  chosenPhraseIndex: 0 | 1 | 2;
};

export type Tier = "again" | "hard" | "good" | "easy";

export type FillResult = {
  correctCount: 0 | 1 | 2 | 3;
  tier: Tier;
  sentenceResults: Array<{
    sentenceIndex: 0 | 1 | 2;
    expectedPhraseIndex: 0 | 1 | 2;
    chosenPhraseIndex: 0 | 1 | 2 | null;
    isCorrect: boolean;
  }>;
  placements: Placement[];
};

const SENTENCE_INDICES = [0, 1, 2] as const;

function isIndex(value: unknown): value is 0 | 1 | 2 {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2;
}

function tierFromCorrectCount(correctCount: 0 | 1 | 2 | 3): Tier {
  if (correctCount === 3) {
    return "easy";
  }

  if (correctCount === 2) {
    return "good";
  }

  if (correctCount === 1) {
    return "hard";
  }

  return "again";
}

export function gradeFillTest(fillTest: FillTest, placements: Placement[]): FillResult {
  const chosenBySentence: Array<0 | 1 | 2 | null> = [null, null, null];

  for (const rawPlacement of placements as unknown[]) {
    if (!rawPlacement || typeof rawPlacement !== "object") {
      continue;
    }

    const { sentenceIndex, chosenPhraseIndex } = rawPlacement as {
      sentenceIndex?: unknown;
      chosenPhraseIndex?: unknown;
    };

    if (!isIndex(sentenceIndex) || !isIndex(chosenPhraseIndex)) {
      continue;
    }

    chosenBySentence[sentenceIndex] = chosenPhraseIndex;
  }

  const sentenceResults = SENTENCE_INDICES.map((sentenceIndex) => {
    const expectedPhraseIndex = fillTest.sentences[sentenceIndex].answerIndex;
    const chosenPhraseIndex = chosenBySentence[sentenceIndex];
    const isCorrect = chosenPhraseIndex === expectedPhraseIndex;

    return {
      sentenceIndex,
      expectedPhraseIndex,
      chosenPhraseIndex,
      isCorrect,
    };
  });

  const correctCount = sentenceResults.filter((sentenceResult) => sentenceResult.isCorrect)
    .length as 0 | 1 | 2 | 3;

  return {
    correctCount,
    tier: tierFromCorrectCount(correctCount),
    sentenceResults,
    placements: placements.slice(),
  };
}
