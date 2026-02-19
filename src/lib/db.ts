import Dexie, { Table } from "dexie";
import type { Word } from "./types";

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
