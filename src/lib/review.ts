import type { Grade } from "./scheduler";

export type ReviewSource = "flashcard" | "fillTest";

export type GradeResult = {
  grade: Grade;
  source?: ReviewSource;
  reason?: string;
  score?: number;
};
