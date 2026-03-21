import { describe, expect, it } from "vitest";
import { wordsStrings } from "../words.strings";
import type {
  AdminContentStats,
  AdminStatsFilter,
  AdminTableRow,
  AdminTarget,
  HiddenAdminTarget,
} from "./admin.types";

describe("Admin Types", () => {
  it("allows creating AdminTarget objects", () => {
    const target: AdminTarget = {
      character: "char-a",
      pronunciation: "pin-yin-a",
      key: "char-a|pin-yin-a",
    };
    expect(target.key).toBe("char-a|pin-yin-a");
  });

  it("allows creating HiddenAdminTarget objects", () => {
    const hiddenTarget: HiddenAdminTarget = {
      character: "char-b",
      pronunciation: "pin-yin-b",
      key: "char-b|pin-yin-b",
    };
    expect(hiddenTarget.key).toBe("char-b|pin-yin-b");
  });

  it("allows creating AdminTableRow objects", () => {
    const row: AdminTableRow = {
      rowKey: "row-1",
      targetKey: "char-a|pin-yin-a",
      rowType: "existing",
      pendingId: null,
      character: "char-a",
      pronunciation: "pin-yin-a",
      meaningZh: "meaning-zh",
      meaningEn: "meaning-en",
      phrase: "phrase-zh",
      phrasePinyin: "phrase-pinyin",
      example: "example-zh",
      examplePinyin: "example-pinyin",
      includeInFillTest: true,
    };
    expect(row.character).toBe("char-a");
  });

  it("allows creating AdminStatsFilter values", () => {
    const filters: AdminStatsFilter[] = [
      "characters",
      "targets",
      "with_content",
      "missing_content",
      "ready_for_testing",
      "excluded_for_testing",
    ];
    expect(filters).toHaveLength(6);
  });

  it("allows creating AdminContentStats objects", () => {
    const stats: AdminContentStats = {
      targetStatusByKey: {
        "char-a|pin-yin-a": "ready_for_testing",
        "char-b|pin-yin-b": "missing_content",
      },
      targetsWithContent: 50,
      targetsMissingContent: 30,
      targetsReadyForTesting: 40,
      targetsExcludedForTesting: 10,
    };
    expect(stats.targetsWithContent).toBe(50);
  });
});

describe("Admin string parity", () => {
  it("keeps action button keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.table.actionButtons).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.table.actionButtons).sort()
    );
  });

  it("keeps action tooltip keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.table.actionTooltips).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.table.actionTooltips).sort()
    );
  });

  it("keeps admin message keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.messages).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.messages).sort()
    );
  });

  it("keeps empty-table message keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.emptyTableMessages).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.emptyTableMessages).sort()
    );
  });

  it("keeps admin table summary keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.table.summary).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.table.summary).sort()
    );
  });

  it("defines row-delete confirmation placeholders in both locales", () => {
    expect(wordsStrings.en.admin.table.confirmDeleteRow).toContain("{character}");
    expect(wordsStrings.en.admin.table.confirmDeleteRow).toContain("{pronunciation}");
    expect(wordsStrings.zh.admin.table.confirmDeleteRow).toContain("{character}");
    expect(wordsStrings.zh.admin.table.confirmDeleteRow).toContain("{pronunciation}");
  });

  it("defines last-pronunciation guard copy in both locales", () => {
    expect(wordsStrings.en.admin.table.cannotDeleteLastPronunciation.length).toBeGreaterThan(0);
    expect(wordsStrings.zh.admin.table.cannotDeleteLastPronunciation.length).toBeGreaterThan(0);
  });
});
