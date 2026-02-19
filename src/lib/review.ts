import type { Grade } from "./scheduler";

export type GradeResult = {
  grade: Grade;
  reason?: string;
  score?: number;
};
