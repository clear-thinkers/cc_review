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
