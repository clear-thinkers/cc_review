import { describe, expect, it } from "vitest";
import {
  getAllTagFilterOptionIds,
  matchesSelectedTagFilter,
  NO_TAG_FILTER_ID,
  toggleTagFilterId,
} from "./tagFilter.utils";

describe("tag filter utilities", () => {
  it("returns every available tag option id for select-all controls", () => {
    expect(
      getAllTagFilterOptionIds([
        { id: "lesson-tag-1" },
        { id: "lesson-tag-2" },
        { id: "lesson-tag-3" },
      ])
    ).toEqual(["lesson-tag-1", "lesson-tag-2", "lesson-tag-3"]);
  });

  it("returns an empty list when no tag options are available", () => {
    expect(getAllTagFilterOptionIds([])).toEqual([]);
  });

  it("adds a selected tag without duplicating existing selections", () => {
    expect(toggleTagFilterId(["lesson-tag-1"], "lesson-tag-2", true)).toEqual([
      "lesson-tag-1",
      "lesson-tag-2",
    ]);
    expect(toggleTagFilterId(["lesson-tag-1"], "lesson-tag-1", true)).toEqual([
      "lesson-tag-1",
    ]);
  });

  it("removes a cleared tag from the selected filter ids", () => {
    expect(toggleTagFilterId(["lesson-tag-1", "lesson-tag-2"], "lesson-tag-1", false)).toEqual([
      "lesson-tag-2",
    ]);
  });

  it("matches every word when no tag filter is selected", () => {
    expect(matchesSelectedTagFilter(new Set(["lesson-tag-1"]), [])).toBe(true);
    expect(matchesSelectedTagFilter(new Set(), [])).toBe(true);
  });

  it("matches words with any selected lesson tag", () => {
    expect(matchesSelectedTagFilter(new Set(["lesson-tag-2"]), ["lesson-tag-1", "lesson-tag-2"])).toBe(true);
    expect(matchesSelectedTagFilter(new Set(["lesson-tag-3"]), ["lesson-tag-1", "lesson-tag-2"])).toBe(false);
  });

  it("matches untagged words when the None option is selected", () => {
    expect(matchesSelectedTagFilter(new Set(), [NO_TAG_FILTER_ID])).toBe(true);
    expect(matchesSelectedTagFilter(new Set(["lesson-tag-1"]), [NO_TAG_FILTER_ID])).toBe(false);
  });

  it("combines the None option with real tags using OR logic", () => {
    expect(matchesSelectedTagFilter(new Set(), [NO_TAG_FILTER_ID, "lesson-tag-1"])).toBe(true);
    expect(matchesSelectedTagFilter(new Set(["lesson-tag-1"]), [NO_TAG_FILTER_ID, "lesson-tag-1"])).toBe(true);
    expect(matchesSelectedTagFilter(new Set(["lesson-tag-2"]), [NO_TAG_FILTER_ID, "lesson-tag-1"])).toBe(false);
  });
});
