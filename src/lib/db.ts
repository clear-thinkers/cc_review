import Dexie, { Table } from "dexie";
import type { Word } from "./types";
import type { FillTest } from "./fillTest";
import { calculateNextState, isDue } from "./scheduler";
import type { Grade } from "./scheduler";
import type { GradeResult } from "./review";

export type FillTestOverride = {
  hanzi: string;
  fillTest: FillTest;
  updatedAt: number;
};

export type DisabledFillTestEntry = {
  hanzi: string;
  updatedAt: number;
};

export class AppDB extends Dexie {
  words!: Table<Word, string>;
  fillTests!: Table<FillTestOverride, string>;
  disabledFillTests!: Table<DisabledFillTestEntry, string>;

  constructor() {
    super("cc_review_db");
    this.version(1).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
    });
    this.version(2).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
    });
    this.version(3).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
      disabledFillTests: "hanzi, updatedAt",
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

export async function getCustomFillTest(hanzi: string): Promise<FillTest | undefined> {
  const entry = await db.fillTests.get(hanzi);
  return entry?.fillTest;
}

export async function getAllCustomFillTests(): Promise<FillTestOverride[]> {
  return db.fillTests.toArray();
}

export async function putCustomFillTest(hanzi: string, fillTest: FillTest): Promise<void> {
  await db.fillTests.put({
    hanzi,
    fillTest,
    updatedAt: Date.now(),
  });
}

export async function deleteCustomFillTest(hanzi: string): Promise<void> {
  await db.fillTests.delete(hanzi);
}

export async function getAllDisabledFillTests(): Promise<DisabledFillTestEntry[]> {
  return db.disabledFillTests.toArray();
}

export async function putDisabledFillTest(hanzi: string): Promise<void> {
  await db.disabledFillTests.put({
    hanzi,
    updatedAt: Date.now(),
  });
}

export async function deleteDisabledFillTest(hanzi: string): Promise<void> {
  await db.disabledFillTests.delete(hanzi);
}
