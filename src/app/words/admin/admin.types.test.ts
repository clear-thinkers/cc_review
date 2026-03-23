import { describe, expect, it } from "vitest";
import { wordsStrings } from "../words.strings";
import type {
  AdminEditingExample,
  AdminEditingPhrase,
  AdminBatchGenerationScope,
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

  it("allows creating AdminBatchGenerationScope values", () => {
    const scopes: AdminBatchGenerationScope[] = [
      "missing_only",
      "all",
      "filtered",
      "selected",
    ];
    expect(scopes).toHaveLength(4);
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

  it("allows creating AdminEditingPhrase objects", () => {
    const editingPhrase: AdminEditingPhrase = {
      rowKey: "row-phrase-1",
      targetKey: "char-a|pin-yin-a",
      originalPhrase: "原词组",
      nextPhrase: "新词组",
    };
    expect(editingPhrase.nextPhrase).toBe("新词组");
  });

  it("allows creating AdminEditingExample objects", () => {
    const editingExample: AdminEditingExample = {
      rowKey: "row-example-1",
      targetKey: "char-a|pin-yin-a",
      originalExample: "原例句",
      nextExample: "新例句",
    };
    expect(editingExample.nextExample).toBe("新例句");
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

  it("keeps admin batch-menu keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.batchMenus).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.batchMenus).sort()
    );
    expect(Object.keys(wordsStrings.en.admin.batchMenus.content).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.batchMenus.content).sort()
    );
    expect(Object.keys(wordsStrings.en.admin.batchMenus.pinyin).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.batchMenus.pinyin).sort()
    );
  });

  it("keeps admin warning-dialog keys aligned across locales", () => {
    expect(Object.keys(wordsStrings.en.admin.batchWarningDialogs).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.batchWarningDialogs).sort()
    );
    expect(Object.keys(wordsStrings.en.admin.batchWarningDialogs.contentAll).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.batchWarningDialogs.contentAll).sort()
    );
    expect(Object.keys(wordsStrings.en.admin.batchWarningDialogs.pinyinAll).sort()).toEqual(
      Object.keys(wordsStrings.zh.admin.batchWarningDialogs.pinyinAll).sort()
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
