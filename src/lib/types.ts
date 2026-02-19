export type Word = {
    id: string;
    hanzi: string;
    pinyin?: string;
    meaning?: string;
    createdAt: number;
  
    repetitions: number;
    intervalDays: number;
    ease: number;
    nextReviewAt: number;
  };
  