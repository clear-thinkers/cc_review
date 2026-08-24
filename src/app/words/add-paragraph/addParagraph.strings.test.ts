import { describe, expect, it } from "vitest";
import { addParagraphStrings } from "./addParagraph.strings";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("addParagraph.strings parity", () => {
  it("EN and ZH have identical (nested) key sets", () => {
    const enKeys = collectKeyPaths(addParagraphStrings.en).sort();
    const zhKeys = collectKeyPaths(addParagraphStrings.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("EN string values are non-empty", () => {
    for (const path of collectKeyPaths(addParagraphStrings.en)) {
      const value = path.split(".").reduce<unknown>((obj, key) => (obj as Record<string, unknown>)[key], addParagraphStrings.en);
      expect(String(value).trim().length, `EN key "${path}" is empty`).toBeGreaterThan(0);
    }
  });

  it("ZH string values are non-empty", () => {
    for (const path of collectKeyPaths(addParagraphStrings.zh)) {
      const value = path.split(".").reduce<unknown>((obj, key) => (obj as Record<string, unknown>)[key], addParagraphStrings.zh);
      expect(String(value).trim().length, `ZH key "${path}" is empty`).toBeGreaterThan(0);
    }
  });
});
