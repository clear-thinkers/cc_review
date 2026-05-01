import { describe, expect, it } from "vitest";
import { matchesFamiliarityFilter } from "./all.utils";
import { matchesCharacterSearchFilter } from "../shared/words.shared.utils";

describe("matchesFamiliarityFilter", () => {
  it("treats filter values as percentages for less-than-or-equal comparisons", () => {
    expect(matchesFamiliarityFilter(0.4, "<=", 50)).toBe(true);
    expect(matchesFamiliarityFilter(0.6, "<=", 50)).toBe(false);
  });

  it("treats filter values as percentages for greater-than-or-equal comparisons", () => {
    expect(matchesFamiliarityFilter(0.8, ">=", 75)).toBe(true);
    expect(matchesFamiliarityFilter(0.7, ">=", 75)).toBe(false);
  });

  it("allows all rows when no familiarity filter is set", () => {
    expect(matchesFamiliarityFilter(0.2, "<=", "")).toBe(true);
    expect(matchesFamiliarityFilter(0.9, ">=", "")).toBe(true);
  });
});

describe("matchesCharacterSearchFilter", () => {
  it("treats empty input as inactive — shows all characters", () => {
    expect(matchesCharacterSearchFilter("你", "")).toBe(true);
  });

  it("treats non-Hanzi-only input as inactive", () => {
    expect(matchesCharacterSearchFilter("你", "abc123")).toBe(true);
  });

  it("shows a character whose hanzi is in the search set", () => {
    expect(matchesCharacterSearchFilter("你", "你好")).toBe(true);
  });

  it("hides a character whose hanzi is not in the search set", () => {
    expect(matchesCharacterSearchFilter("我", "你好")).toBe(false);
  });
});
