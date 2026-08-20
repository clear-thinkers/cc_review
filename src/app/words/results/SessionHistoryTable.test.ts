/**
 * SessionHistoryTable — focused logic tests
 *
 * @testing-library/react is not available in this project.
 * Tests cover the stable, self-contained behaviors:
 *   1. Tested/Failed popup content-building — characters vs. paragraph-blank branch
 *   2. Sort state machine — field selection and direction toggling
 *   3. Sort comparator — ordering rows by each supported field
 *   4. Clear-button visibility — hideDestructiveActions + empty-session guard
 *
 * Logic is mirrored inline from the component source. If the component
 * logic changes, update these mirrors and tests together.
 */

import { describe, expect, it } from "vitest";
import type { SessionDisplayData, SessionGradeData } from "./results.types";
import { calculateAnchoredDialogPosition } from "./SendFailedToSessionDialog";
import type { SessionCharacterListPopupContent } from "./SessionCharacterListPopup";

// ---------------------------------------------------------------------------
// Mirrors of component-internal logic
// ---------------------------------------------------------------------------

type SortField =
  | "createdAt"
  | "fullyCorrectPercent"
  | "failedPercent"
  | "partiallyCorrectPercent"
  | "durationSeconds"
  | "testedCount"
  | "failedCount"
  | "coinsEarned";

type SortDirection = "asc" | "desc";

/** Mirror of SessionHistoryTable.handleHeaderClick state transition */
function applyHeaderClick(
  current: { field: SortField; direction: SortDirection },
  clicked: SortField
): { field: SortField; direction: SortDirection } {
  if (current.field === clicked) {
    return { field: current.field, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { field: clicked, direction: "asc" };
}

/** Mirror of SessionHistoryTable sort comparator */
function compareRows(
  a: SessionDisplayData,
  b: SessionDisplayData,
  sortField: SortField,
  sortDirection: SortDirection
): number {
  let aValue: number | undefined;
  let bValue: number | undefined;

  if (
    sortField === "fullyCorrectPercent" ||
    sortField === "failedPercent" ||
    sortField === "partiallyCorrectPercent"
  ) {
    aValue = a[sortField];
    bValue = b[sortField];
  } else if (sortField === "testedCount") {
    aValue = a.charactersTested.length;
    bValue = b.charactersTested.length;
  } else if (sortField === "failedCount") {
    aValue = a.charactersFailed.length;
    bValue = b.charactersFailed.length;
  } else if (
    sortField === "createdAt" ||
    sortField === "durationSeconds" ||
    sortField === "coinsEarned"
  ) {
    aValue = a[sortField];
    bValue = b[sortField];
  }

  if (typeof aValue === "number" && typeof bValue === "number") {
    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  }

  return 0;
}

/** Mirror of clear-button render guard */
function showClearButton(sessionCount: number, hideDestructiveActions?: boolean): boolean {
  return sessionCount > 0 && !hideDestructiveActions;
}

/** Mirror of send-failed button render guard */
function showSendFailedButton(failedCharacterCount: number): boolean {
  return failedCharacterCount > 0;
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeDisplayRow(overrides: Partial<SessionDisplayData> = {}): SessionDisplayData {
  return {
    id: "s1",
    createdAt: 1000,
    sessionType: "fill-test",
    gradeData: [],
    fullyCorrectCount: 0,
    failedCount: 0,
    partiallyCorrectCount: 0,
    totalGrades: 0,
    durationSeconds: 0,
    coinsEarned: 0,
    fullyCorrectPercent: 0,
    failedPercent: 0,
    partiallyCorrectPercent: 0,
    charactersTested: [],
    charactersFailed: [],
    durationDisplay: "0s",
    sessionDate: "Jan 1, 2026",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Tested/Failed popup content-building
// ---------------------------------------------------------------------------

/** Mirror of SessionHistoryTable.openTestedPopup's content-building branch */
function buildTestedPopupContent(
  session: Pick<SessionDisplayData, "gradeData" | "charactersTested">,
  labels: { paragraphBlanksTitle: string; testedCharactersTitle: string }
): SessionCharacterListPopupContent {
  const isParagraphQuiz = session.gradeData.some((entry) => entry.isParagraphBlank);
  if (isParagraphQuiz) {
    return {
      kind: "paragraphBlanks",
      title: labels.paragraphBlanksTitle,
      items: session.gradeData
        .filter((entry) => entry.isParagraphBlank)
        .map((entry) => ({ text: entry.hanzi, tier: entry.grade, retryCount: entry.retryCount ?? 0 })),
    };
  }
  return { kind: "characters", title: labels.testedCharactersTitle, items: session.charactersTested };
}

function makeGradeEntry(overrides: Partial<SessionGradeData> = {}): SessionGradeData {
  return { wordId: "w1", hanzi: "你", grade: "easy", ...overrides };
}

describe("tested popup content-building", () => {
  it("builds a plain characters list for an ordinary (non-paragraph-quiz) session", () => {
    const content = buildTestedPopupContent(
      { gradeData: [makeGradeEntry()], charactersTested: ["你", "好"] },
      { paragraphBlanksTitle: "Blanks", testedCharactersTitle: "Tested Characters" }
    );
    expect(content).toEqual({ kind: "characters", title: "Tested Characters", items: ["你", "好"] });
  });

  it("builds a paragraph-blanks list (text/tier/retryCount) when any grade entry is isParagraphBlank", () => {
    const content = buildTestedPopupContent(
      {
        gradeData: [
          makeGradeEntry({ hanzi: "你", grade: "easy", isParagraphBlank: true, retryCount: 0 }),
          makeGradeEntry({ hanzi: "好", grade: "hard", isParagraphBlank: true, retryCount: 2 }),
        ],
        charactersTested: ["你", "好"],
      },
      { paragraphBlanksTitle: "Blanks", testedCharactersTitle: "Tested Characters" }
    );
    expect(content).toEqual({
      kind: "paragraphBlanks",
      title: "Blanks",
      items: [
        { text: "你", tier: "easy", retryCount: 0 },
        { text: "好", tier: "hard", retryCount: 2 },
      ],
    });
  });

  it("defaults retryCount to 0 when a paragraph-blank entry omits it", () => {
    const content = buildTestedPopupContent(
      { gradeData: [makeGradeEntry({ isParagraphBlank: true, retryCount: undefined })], charactersTested: ["你"] },
      { paragraphBlanksTitle: "Blanks", testedCharactersTitle: "Tested Characters" }
    );
    expect(content.kind).toBe("paragraphBlanks");
    expect(content.kind === "paragraphBlanks" && content.items[0]?.retryCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Sort state machine
// ---------------------------------------------------------------------------

describe("sort state machine", () => {
  const initial: { field: SortField; direction: SortDirection } = {
    field: "createdAt",
    direction: "desc",
  };

  it("clicking the active field toggles direction from desc to asc", () => {
    const next = applyHeaderClick(initial, "createdAt");
    expect(next.field).toBe("createdAt");
    expect(next.direction).toBe("asc");
  });

  it("clicking the active field toggles direction from asc to desc", () => {
    const state = { field: "createdAt" as SortField, direction: "asc" as SortDirection };
    const next = applyHeaderClick(state, "createdAt");
    expect(next.direction).toBe("desc");
  });

  it("clicking a different field switches field and resets direction to asc", () => {
    const next = applyHeaderClick(initial, "coinsEarned");
    expect(next.field).toBe("coinsEarned");
    expect(next.direction).toBe("asc");
  });

  it("clicking a new field does not inherit the previous direction", () => {
    // Even if previous direction was asc, switching field always starts at asc
    const state = { field: "durationSeconds" as SortField, direction: "asc" as SortDirection };
    const next = applyHeaderClick(state, "failedPercent");
    expect(next.direction).toBe("asc");
  });

  it("toggling direction twice returns to original direction", () => {
    const once = applyHeaderClick(initial, "createdAt");
    const twice = applyHeaderClick(once, "createdAt");
    expect(twice.direction).toBe(initial.direction);
  });
});

// ---------------------------------------------------------------------------
// 3. Sort comparator
// ---------------------------------------------------------------------------

describe("sort comparator", () => {
  // All numeric fields on "low" are strictly less than on "high" so the
  // loop assertion "low before high ascending" holds for every field.
  const low = makeDisplayRow({
    id: "low",
    createdAt: 100,
    fullyCorrectPercent: 20,
    failedPercent: 5,
    partiallyCorrectPercent: 5,
    durationSeconds: 30,
    coinsEarned: 1,
    charactersTested: ["一"],
    charactersFailed: [],
  });

  const high = makeDisplayRow({
    id: "high",
    createdAt: 900,
    fullyCorrectPercent: 80,
    failedPercent: 60,
    partiallyCorrectPercent: 20,
    durationSeconds: 120,
    coinsEarned: 10,
    charactersTested: ["一", "二", "三"],
    charactersFailed: ["一", "二"],
  });

  const fields: SortField[] = [
    "createdAt",
    "fullyCorrectPercent",
    "failedPercent",
    "partiallyCorrectPercent",
    "durationSeconds",
    "coinsEarned",
  ];

  for (const field of fields) {
    it(`sorts "${field}" ascending: low before high`, () => {
      expect(compareRows(low, high, field, "asc")).toBeLessThan(0);
      expect(compareRows(high, low, field, "asc")).toBeGreaterThan(0);
    });

    it(`sorts "${field}" descending: high before low`, () => {
      expect(compareRows(high, low, field, "desc")).toBeLessThan(0);
      expect(compareRows(low, high, field, "desc")).toBeGreaterThan(0);
    });
  }

  it("sorts testedCount ascending by charactersTested.length", () => {
    expect(compareRows(low, high, "testedCount", "asc")).toBeLessThan(0); // 1 < 3
    expect(compareRows(high, low, "testedCount", "asc")).toBeGreaterThan(0);
  });

  it("sorts testedCount descending by charactersTested.length", () => {
    expect(compareRows(high, low, "testedCount", "desc")).toBeLessThan(0); // 3 > 1
  });

  it("sorts failedCount ascending by charactersFailed.length", () => {
    expect(compareRows(low, high, "failedCount", "asc")).toBeLessThan(0); // 0 < 2
    expect(compareRows(high, low, "failedCount", "asc")).toBeGreaterThan(0);
  });

  it("sorts failedCount descending by charactersFailed.length", () => {
    expect(compareRows(high, low, "failedCount", "desc")).toBeLessThan(0); // 2 > 0
  });

  it("returns 0 for equal values", () => {
    const a = makeDisplayRow({ coinsEarned: 5 });
    const b = makeDisplayRow({ coinsEarned: 5 });
    expect(compareRows(a, b, "coinsEarned", "asc")).toBe(0);
    expect(compareRows(a, b, "coinsEarned", "desc")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Clear-button visibility
// ---------------------------------------------------------------------------

describe("clear-button visibility", () => {
  it("shows when sessions exist and hideDestructiveActions is not set", () => {
    expect(showClearButton(3)).toBe(true);
  });

  it("shows when sessions exist and hideDestructiveActions is false", () => {
    expect(showClearButton(3, false)).toBe(true);
  });

  it("hides when hideDestructiveActions is true, even with sessions", () => {
    expect(showClearButton(3, true)).toBe(false);
  });

  it("hides when session list is empty, even without hideDestructiveActions", () => {
    expect(showClearButton(0)).toBe(false);
  });

  it("hides when both conditions are unfavorable", () => {
    expect(showClearButton(0, true)).toBe(false);
  });
});

describe("send-failed button visibility", () => {
  it("shows when the row has at least one failed character", () => {
    expect(showSendFailedButton(1)).toBe(true);
    expect(showSendFailedButton(3)).toBe(true);
  });

  it("hides when the row has no failed characters", () => {
    expect(showSendFailedButton(0)).toBe(false);
  });
});

describe("send-failed dialog placement", () => {
  it("opens below the clicked button and centered in the viewport when there is room", () => {
    expect(
      calculateAnchoredDialogPosition({
        anchorRect: { bottom: 128, left: 240, top: 100 },
        dialogHeight: 260,
        dialogWidth: 400,
        viewportHeight: 800,
        viewportWidth: 1200,
      })
    ).toEqual({ left: 400, top: 136 });
  });

  it("opens above the clicked button and stays centered when the bottom of the viewport is too close", () => {
    expect(
      calculateAnchoredDialogPosition({
        anchorRect: { bottom: 760, left: 240, top: 732 },
        dialogHeight: 260,
        dialogWidth: 400,
        viewportHeight: 800,
        viewportWidth: 1200,
      })
    ).toEqual({ left: 400, top: 464 });
  });

  it("keeps the popup centered even when the clicked button is near the right edge", () => {
    expect(
      calculateAnchoredDialogPosition({
        anchorRect: { bottom: 128, left: 940, top: 100 },
        dialogHeight: 260,
        dialogWidth: 400,
        viewportHeight: 800,
        viewportWidth: 1000,
      })
    ).toEqual({ left: 300, top: 136 });
  });
});
