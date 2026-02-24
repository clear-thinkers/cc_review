import type { FillResult, FillSentence, FillTest, Placement, Tier } from "./fillTest";

export type { FillResult, FillSentence, FillTest, Placement, Tier };

export type Word = {
  id: string;
  hanzi: string;
  pinyin?: string;
  meaning?: string;
  fillTest?: FillTest;
  createdAt: number;

  repetitions: number;
  intervalDays: number;
  ease: number;
  nextReviewAt: number;
  reviewCount?: number;
  testCount?: number;
};
