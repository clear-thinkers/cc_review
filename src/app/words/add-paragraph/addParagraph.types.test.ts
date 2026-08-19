import { describe, expect, it } from "vitest";
import { addParagraphStrings } from "./addParagraph.strings";
import type {
  AddParagraphStrings,
  ParagraphSpanRange,
  ParagraphViewMode,
  ResolvedParagraphSpan,
  SelectedParagraphSpan,
} from "./addParagraph.types";

describe("addParagraph.types", () => {
  it("AddParagraphStrings matches the shape of addParagraphStrings.en", () => {
    const str: AddParagraphStrings = addParagraphStrings.en;
    expect(str.pageTitle).toBe(addParagraphStrings.en.pageTitle);
    expect(str.selector.legendKnown).toBe(addParagraphStrings.en.selector.legendKnown);
  });

  it("ParagraphSpanRange can be constructed", () => {
    const range: ParagraphSpanRange = { startOffset: 0, endOffset: 2 };
    expect(range.endOffset - range.startOffset).toBe(2);
  });

  it("SelectedParagraphSpan can be constructed", () => {
    const selection: SelectedParagraphSpan = { sentenceIndex: 0, startOffset: 0, endOffset: 1 };
    expect(selection.sentenceIndex).toBe(0);
  });

  it("ResolvedParagraphSpan allows kind 'character' with a null existingId", () => {
    const resolved: ResolvedParagraphSpan = {
      sentenceIndex: 0,
      startOffset: 0,
      endOffset: 1,
      text: "你",
      kind: "character",
      existingId: null,
    };
    expect(resolved.kind).toBe("character");
    expect(resolved.existingId).toBeNull();
  });

  it("ResolvedParagraphSpan allows kind 'phrase' with a resolved existingId", () => {
    const resolved: ResolvedParagraphSpan = {
      sentenceIndex: 0,
      startOffset: 3,
      endOffset: 6,
      text: "图书馆",
      kind: "phrase",
      existingId: "vp1",
    };
    expect(resolved.kind).toBe("phrase");
    expect(resolved.existingId).toBe("vp1");
  });

  it("ParagraphViewMode allows all four view states", () => {
    const modes: ParagraphViewMode[] = ["import", "library", "continueImport", "testModes"];
    expect(modes).toHaveLength(4);
  });
});

type StringTree = { [key: string]: string | StringTree };

function collectKeyPaths(tree: StringTree, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      paths.push(path);
    } else {
      paths.push(...collectKeyPaths(value, path));
    }
  }
  return paths.sort();
}

describe("addParagraphStrings parity", () => {
  it("EN and ZH have identical key paths at every nesting level (top-level, selector, library, continueImport, testModes, testModes.selector)", () => {
    const enPaths = collectKeyPaths(addParagraphStrings.en);
    const zhPaths = collectKeyPaths(addParagraphStrings.zh);
    expect(enPaths).toEqual(zhPaths);
  });

  it("EN and ZH string values are all non-empty, at every nesting level", () => {
    for (const locale of ["en", "zh"] as const) {
      for (const path of collectKeyPaths(addParagraphStrings[locale])) {
        const value = path.split(".").reduce<unknown>((node, key) => {
          return node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
        }, addParagraphStrings[locale]);
        expect(typeof value, `${locale}.${path}`).toBe("string");
        expect((value as string).length, `${locale}.${path}`).toBeGreaterThan(0);
      }
    }
  });
});
