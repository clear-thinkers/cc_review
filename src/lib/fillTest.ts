export type FillSentence = {
  text: string;
  answerIndex: number;
  characterId?: string;
};

export type FillTestMember = {
  wordId: string;
  hanzi: string;
  phraseCount: number;
};

export type FillTest = {
  phrases: string[];
  sentences: FillSentence[];
  members?: FillTestMember[];
};

export type Placement = {
  sentenceIndex: number;
  chosenPhraseIndex: number;
};

export type Tier = "again" | "hard" | "good" | "easy";

export type FillResult = {
  correctCount: number;
  tier: Tier;
  sentenceResults: Array<{
    sentenceIndex: number;
    expectedPhraseIndex: number;
    chosenPhraseIndex: number | null;
    characterId?: string;
    isCorrect: boolean;
  }>;
  placements: Placement[];
};

export type BundledFillTestMemberResult = {
  wordId: string;
  hanzi: string;
  correctCount: number;
  totalCount: number;
  tier: Tier;
};

export type BundledFillTestResult = FillResult & {
  memberResults: BundledFillTestMemberResult[];
};

function isIndex(value: unknown, length: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length;
}

export function tierFromCorrectRate(correctCount: number, totalCount: number): Tier {
  if (totalCount <= 0 || correctCount <= 0) {
    return "again";
  }

  if (correctCount >= totalCount) {
    return "easy";
  }

  if (correctCount / totalCount > 0.5) {
    return "good";
  }

  return "hard";
}

export function gradeFillTest(fillTest: FillTest, placements: Placement[]): FillResult {
  const chosenBySentence: Array<number | null> = Array(fillTest.sentences.length).fill(null);

  for (const rawPlacement of placements as unknown[]) {
    if (!rawPlacement || typeof rawPlacement !== "object") {
      continue;
    }

    const { sentenceIndex, chosenPhraseIndex } = rawPlacement as {
      sentenceIndex?: unknown;
      chosenPhraseIndex?: unknown;
    };

    if (!isIndex(sentenceIndex, fillTest.sentences.length) || !isIndex(chosenPhraseIndex, fillTest.phrases.length)) {
      continue;
    }

    chosenBySentence[sentenceIndex] = chosenPhraseIndex;
  }

  const sentenceResults = fillTest.sentences.map((sentence, sentenceIndex) => {
    const expectedPhraseIndex = fillTest.sentences[sentenceIndex].answerIndex;
    const chosenPhraseIndex = chosenBySentence[sentenceIndex];
    const isCorrect = chosenPhraseIndex === expectedPhraseIndex;

    return {
      sentenceIndex,
      expectedPhraseIndex,
      chosenPhraseIndex,
      ...(sentence.characterId ? { characterId: sentence.characterId } : {}),
      isCorrect,
    };
  });

  const correctCount = sentenceResults.filter((sentenceResult) => sentenceResult.isCorrect)
    .length;

  return {
    correctCount,
    tier: tierFromCorrectRate(correctCount, fillTest.sentences.length),
    sentenceResults,
    placements: placements.slice(),
  };
}

export function gradeBundledFillTest(fillTest: FillTest, placements: Placement[]): BundledFillTestResult {
  const result = gradeFillTest(fillTest, placements);
  const members = fillTest.members ?? [];
  const memberResults = members.map((member) => {
    const sentenceResults = result.sentenceResults.filter(
      (sentenceResult) => sentenceResult.characterId === member.wordId
    );
    const correctCount = sentenceResults.filter((sentenceResult) => sentenceResult.isCorrect).length;
    const totalCount = sentenceResults.length;

    return {
      wordId: member.wordId,
      hanzi: member.hanzi,
      correctCount,
      totalCount,
      tier: tierFromCorrectRate(correctCount, totalCount),
    };
  });

  return {
    ...result,
    memberResults,
  };
}
