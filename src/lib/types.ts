import type { FillResult, FillSentence, FillTest, Placement, Tier } from "./fillTest";

export type { FillResult, FillSentence, FillTest, Placement, Tier };

export type Word = {
  id: string;
  hanzi: string;
  fillTest?: FillTest;
  createdAt: number;

  repetitions: number;
  intervalDays: number;
  ease: number;
  nextReviewAt: number;
  reviewCount?: number;
  testCount?: number;
};

export type VocabPhraseExample = {
  zh: string;
  pinyin: string;
  includeInFillTest: boolean;
};

export type VocabPhrase = {
  id: string;
  phrase: string;
  pinyin?: string;
  meaningZh?: string;
  meaningEn?: string;
  examples: VocabPhraseExample[];
  testCount: number;
  createdAt: number;
};
