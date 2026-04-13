import { describe, expect, it } from "vitest";
import { getAllTagFilterOptionIds, toggleTagFilterId } from "./tagFilter.utils";

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
});
