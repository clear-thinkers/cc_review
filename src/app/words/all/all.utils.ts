import { extractUniqueHanzi } from "../shared/words.shared.utils";

export function matchesFamiliarityFilter(
  familiarity: number,
  operator: "<=" | ">=",
  value: number | ""
): boolean {
  if (value === "") {
    return true;
  }

  const threshold = Number(value) / 100;

  if (operator === "<=") {
    return familiarity <= threshold;
  }

  return familiarity >= threshold;
}

/** A phrase's component Hanzi that already exist as standalone added characters (same resolution as the fill-test familiarity nudge). */
export function getAddedCharactersInPhrase(phrase: string, addedHanzi: ReadonlySet<string>): string[] {
  return extractUniqueHanzi(phrase).filter((hanzi) => addedHanzi.has(hanzi));
}
