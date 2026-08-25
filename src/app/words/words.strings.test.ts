import { describe, expect, it } from "vitest";
import { wordsStrings } from "./words.strings";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("words.strings parity", () => {
  it("EN and ZH have identical (nested) key sets", () => {
    const enKeys = collectKeyPaths(wordsStrings.en).sort();
    const zhKeys = collectKeyPaths(wordsStrings.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });
});
