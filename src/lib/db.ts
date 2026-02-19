import Dexie, { Table } from "dexie";
import type { Word } from "./types";
import { calculateNextState, isDue } from "./scheduler";
import type { Grade } from "./scheduler";
import type { GradeResult } from "./review";

export class AppDB extends Dexie {
  words!: Table<Word, string>;

  constructor() {
    super("cc_review_db");
    this.version(1).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
    });
  }
}

export const db = new AppDB();

export async function getDueWords(now = Date.now()): Promise<Word[]> {
  const indexedDue = await db.words.where("nextReviewAt").belowOrEqual(now).toArray();
  const maybeMissing = await db.words.filter((word) => !word.nextReviewAt).toArray();

  const byId = new Map<string, Word>();
  for (const word of indexedDue) {
    byId.set(word.id, word);
  }

  for (const word of maybeMissing) {
    if (isDue(word.nextReviewAt, now)) {
      byId.set(word.id, word);
    }
  }

  return Array.from(byId.values());
}

export async function gradeWord(
  id: string,
  gradeOrResult: Grade | GradeResult,
  now = Date.now()
): Promise<Word> {
  const grade = typeof gradeOrResult === "string" ? gradeOrResult : gradeOrResult.grade;

  return db.transaction("rw", db.words, async () => {
    const word = await db.words.get(id);
    if (!word) {
      throw new Error(`Word not found: ${id}`);
    }

    const updated = calculateNextState(word, grade, now);
    await db.words.put(updated);
    return updated;
  });
}
