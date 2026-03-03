import { describe, it, expect } from "vitest";
import type {
  AdminTarget,
  AdminTableRow,
  AdminStatsFilter,
  AdminTargetContentStatus,
  AdminContentStats,
} from "./admin.types";

describe("Admin Types", () => {
  it("should allow creating AdminTarget objects", () => {
    const target: AdminTarget = {
      character: "学",
      pronunciation: "xué",
      key: "学|xué",
    };
    expect(target.key).toBe("学|xué");
  });

  it("should allow creating AdminTableRow objects", () => {
    const row: AdminTableRow = {
      rowKey: "row-1",
      targetKey: "学|xué",
      rowType: "existing",
      pendingId: null,
      character: "学",
      pronunciation: "xué",
      meaningZh: "学习",
      meaningEn: "to learn",
      phrase: "学中文",
      phrasePinyin: "xué zhōngwén",
      example: "我学中文",
      examplePinyin: "wǒ xué zhōngwén",
      includeInFillTest: true,
    };
    expect(row.character).toBe("学");
  });

  it("should allow creating AdminStatsFilter values", () => {
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

  it("should allow creating AdminContentStats objects", () => {
    const stats: AdminContentStats = {
      targetStatusByKey: {
        "学|xué": "ready_for_testing",
        "好|hǎo": "missing_content",
      },
      targetsWithContent: 50,
      targetsMissingContent: 30,
      targetsReadyForTesting: 40,
      targetsExcludedForTesting: 10,
    };
    expect(stats.targetsWithContent).toBe(50);
  });
});
