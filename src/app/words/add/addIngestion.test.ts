import { describe, expect, it } from "vitest";

import { extractUniqueHanzi } from "@/app/words/shared/words.shared.utils";
import {
  computeIngestionResult,
  isTagFormComplete,
  resolveAddNoticeType,
} from "./addIngestion";

// ---------------------------------------------------------------------------
// extractUniqueHanzi (src/app/words/shared/words.shared.utils.tsx)
// ---------------------------------------------------------------------------

describe("extractUniqueHanzi", () => {
  it("returns empty array for empty string", () => {
    expect(extractUniqueHanzi("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(extractUniqueHanzi("   ")).toEqual([]);
  });

  it("extracts a single Hanzi character", () => {
    expect(extractUniqueHanzi("你")).toEqual(["你"]);
  });

  it("extracts multiple Hanzi characters in order", () => {
    expect(extractUniqueHanzi("你好")).toEqual(["你", "好"]);
  });

  it("deduplicates repeated characters, keeping first occurrence", () => {
    expect(extractUniqueHanzi("你好你")).toEqual(["你", "好"]);
  });

  it("strips non-Hanzi characters (ASCII letters, digits, punctuation)", () => {
    expect(extractUniqueHanzi("hello你world好123")).toEqual(["你", "好"]);
  });

  it("strips spaces between Hanzi characters", () => {
    expect(extractUniqueHanzi("你 好 他")).toEqual(["你", "好", "他"]);
  });

  it("strips Chinese punctuation (not in Hanzi code point range)", () => {
    // Chinese comma 、 and period 。 are punctuation, not CJK unified ideographs
    expect(extractUniqueHanzi("你、好。")).toEqual(["你", "好"]);
  });

  it("returns empty array when input contains no Hanzi", () => {
    expect(extractUniqueHanzi("hello world 123 !@#")).toEqual([]);
  });

  it("trims surrounding whitespace before processing", () => {
    expect(extractUniqueHanzi("  你好  ")).toEqual(["你", "好"]);
  });

  it("handles a longer phrase with mixed content", () => {
    const result = extractUniqueHanzi("我爱中文 (I love Chinese)");
    expect(result).toEqual(["我", "爱", "中", "文"]);
  });

  it("preserves order of first-seen unique characters", () => {
    expect(extractUniqueHanzi("三一二一三")).toEqual(["三", "一", "二"]);
  });
});

// ---------------------------------------------------------------------------
// computeIngestionResult
// ---------------------------------------------------------------------------

describe("computeIngestionResult", () => {
  it("returns all chars as hanziToAdd when none exist yet", () => {
    const result = computeIngestionResult(["你", "好", "他"], []);
    expect(result.hanziToAdd).toEqual(["你", "好", "他"]);
    expect(result.skippedCount).toBe(0);
  });

  it("skips chars already in the existing set", () => {
    const result = computeIngestionResult(["你", "好", "他"], ["好"]);
    expect(result.hanziToAdd).toEqual(["你", "他"]);
    expect(result.skippedCount).toBe(1);
  });

  it("returns empty hanziToAdd when all chars already exist", () => {
    const result = computeIngestionResult(["你", "好"], ["你", "好"]);
    expect(result.hanziToAdd).toEqual([]);
    expect(result.skippedCount).toBe(2);
  });

  it("skips correctly when existingHanzi has more entries than parsed", () => {
    const result = computeIngestionResult(["你"], ["你", "好", "他", "她"]);
    expect(result.hanziToAdd).toEqual([]);
    expect(result.skippedCount).toBe(1);
  });

  it("preserves order of net-new characters", () => {
    const result = computeIngestionResult(["一", "二", "三", "四"], ["二"]);
    expect(result.hanziToAdd).toEqual(["一", "三", "四"]);
    expect(result.skippedCount).toBe(1);
  });

  it("skippedCount + hanziToAdd.length === parsedCharacters.length", () => {
    const parsed = ["甲", "乙", "丙", "丁"];
    const result = computeIngestionResult(parsed, ["乙", "丁"]);
    expect(result.hanziToAdd.length + result.skippedCount).toBe(parsed.length);
  });

  it("returns empty result for empty input", () => {
    const result = computeIngestionResult([], ["你", "好"]);
    expect(result.hanziToAdd).toEqual([]);
    expect(result.skippedCount).toBe(0);
  });

  it("uses set membership — duplicate existingHanzi entries don't affect result", () => {
    const result = computeIngestionResult(["你", "好"], ["你", "你", "你"]);
    expect(result.hanziToAdd).toEqual(["好"]);
    expect(result.skippedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// resolveAddNoticeType
// ---------------------------------------------------------------------------

describe("resolveAddNoticeType", () => {
  it("returns 'noNew' when newCount is 0 regardless of skippedCount", () => {
    expect(resolveAddNoticeType(0, 0)).toBe("noNew");
    expect(resolveAddNoticeType(0, 3)).toBe("noNew");
  });

  it("returns 'allSuccess' when newCount > 0 and skippedCount is 0", () => {
    expect(resolveAddNoticeType(1, 0)).toBe("allSuccess");
    expect(resolveAddNoticeType(5, 0)).toBe("allSuccess");
  });

  it("returns 'partialSuccess' when newCount > 0 and skippedCount > 0", () => {
    expect(resolveAddNoticeType(2, 1)).toBe("partialSuccess");
    expect(resolveAddNoticeType(1, 4)).toBe("partialSuccess");
  });

  it("covers the three cases exhaustively — no fourth outcome", () => {
    const outcomes = new Set([
      resolveAddNoticeType(0, 0),
      resolveAddNoticeType(3, 0),
      resolveAddNoticeType(2, 1),
    ]);
    expect(outcomes).toEqual(new Set(["noNew", "allSuccess", "partialSuccess"]));
  });
});

// ---------------------------------------------------------------------------
// isTagFormComplete
// ---------------------------------------------------------------------------

describe("isTagFormComplete", () => {
  it("returns true when section is closed, regardless of field values", () => {
    expect(isTagFormComplete(false, null, null, null, null)).toBe(true);
    expect(isTagFormComplete(false, "tb-1", "G1", "U1", "L1")).toBe(true);
    expect(isTagFormComplete(false, undefined, undefined, undefined, undefined)).toBe(true);
  });

  it("returns true when section is open and all four fields are provided", () => {
    expect(isTagFormComplete(true, "tb-1", "Grade 1", "Unit 2", "Lesson 3")).toBe(true);
  });

  it("returns false when section is open and textbookId is missing", () => {
    expect(isTagFormComplete(true, null, "Grade 1", "Unit 2", "Lesson 3")).toBe(false);
    expect(isTagFormComplete(true, undefined, "Grade 1", "Unit 2", "Lesson 3")).toBe(false);
    expect(isTagFormComplete(true, "", "Grade 1", "Unit 2", "Lesson 3")).toBe(false);
  });

  it("returns false when section is open and grade is missing", () => {
    expect(isTagFormComplete(true, "tb-1", null, "Unit 2", "Lesson 3")).toBe(false);
    expect(isTagFormComplete(true, "tb-1", "", "Unit 2", "Lesson 3")).toBe(false);
  });

  it("returns false when section is open and unit is missing", () => {
    expect(isTagFormComplete(true, "tb-1", "Grade 1", null, "Lesson 3")).toBe(false);
    expect(isTagFormComplete(true, "tb-1", "Grade 1", "", "Lesson 3")).toBe(false);
  });

  it("returns false when section is open and lesson is missing", () => {
    expect(isTagFormComplete(true, "tb-1", "Grade 1", "Unit 2", null)).toBe(false);
    expect(isTagFormComplete(true, "tb-1", "Grade 1", "Unit 2", "")).toBe(false);
  });

  it("returns false when section is open and multiple fields are missing", () => {
    expect(isTagFormComplete(true, null, null, null, null)).toBe(false);
    expect(isTagFormComplete(true, "tb-1", null, "Unit 2", null)).toBe(false);
  });
});
