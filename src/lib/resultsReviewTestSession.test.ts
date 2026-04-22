import { describe, expect, it } from "vitest";
import type { FlashcardContentEntry } from "./supabase-service";
import { resolveFailedCharactersToReviewTestTargets } from "./resultsReviewTestSession";
import type { Word } from "./types";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "word-1",
    hanzi: "错",
    createdAt: 1,
    repetitions: 0,
    intervalDays: 0,
    ease: 2.5,
    nextReviewAt: 0,
    reviewCount: 0,
    testCount: 0,
    ...overrides,
  };
}

function makeContentEntry(
  overrides: Partial<FlashcardContentEntry> = {}
): FlashcardContentEntry {
  return {
    key: "错|cuo4",
    character: "错",
    pronunciation: "cuo4",
    updatedAt: 1,
    content: {
      character: "错",
      pronunciation: "cuo4",
      meanings: [],
    },
    ...overrides,
  };
}

describe("resolveFailedCharactersToReviewTestTargets", () => {
  it("deduplicates failed hanzi while keeping first-seen order", () => {
    const result = resolveFailedCharactersToReviewTestTargets(
      ["错", "难", "错", "旧"],
      [makeWord({ id: "w-1", hanzi: "错" }), makeWord({ id: "w-2", hanzi: "难" })],
      [
        makeContentEntry({ key: "错|cuo4", character: "错", pronunciation: "cuo4" }),
        makeContentEntry({ key: "难|nan2", character: "难", pronunciation: "nan2" }),
      ]
    );

    expect(result.failedCharacters).toEqual(["错", "难", "旧"]);
  });

  it("emits every saved pronunciation target for eligible hanzi", () => {
    const result = resolveFailedCharactersToReviewTestTargets(
      ["错"],
      [makeWord({ id: "w-1", hanzi: "错" })],
      [
        makeContentEntry({ key: "错|cuo4", character: "错", pronunciation: "cuo4" }),
        makeContentEntry({ key: "错|cuo2", character: "错", pronunciation: "cuo2" }),
      ]
    );

    expect(result.eligibleCharacters).toEqual(["错"]);
    expect(result.skippedCharacters).toEqual([]);
    expect(result.targets).toEqual([
      { character: "错", pronunciation: "cuo4", key: "错|cuo4" },
      { character: "错", pronunciation: "cuo2", key: "错|cuo2" },
    ]);
  });

  it("skips failed hanzi with no current saved flashcard content", () => {
    const result = resolveFailedCharactersToReviewTestTargets(
      ["错", "难"],
      [makeWord({ id: "w-1", hanzi: "错" }), makeWord({ id: "w-2", hanzi: "难" })],
      [makeContentEntry({ key: "错|cuo4", character: "错", pronunciation: "cuo4" })]
    );

    expect(result.eligibleCharacters).toEqual(["错"]);
    expect(result.skippedCharacters).toEqual(["难"]);
    expect(result.targets).toEqual([{ character: "错", pronunciation: "cuo4", key: "错|cuo4" }]);
  });

  it("skips failed hanzi when duplicate current word rows exist", () => {
    const result = resolveFailedCharactersToReviewTestTargets(
      ["错"],
      [makeWord({ id: "w-1", hanzi: "错" }), makeWord({ id: "w-2", hanzi: "错" })],
      [makeContentEntry({ key: "错|cuo4", character: "错", pronunciation: "cuo4" })]
    );

    expect(result.eligibleCharacters).toEqual([]);
    expect(result.skippedCharacters).toEqual(["错"]);
    expect(result.targets).toEqual([]);
  });
});
