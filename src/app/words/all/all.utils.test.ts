import { describe, expect, it } from "vitest";
import { matchesFamiliarityFilter } from "./all.utils";

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
