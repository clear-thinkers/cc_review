import { describe, expect, it } from "vitest";

import {
  calculateFailedPercent,
  calculateFullyCorrectPercent,
  calculatePartiallyCorrectPercent,
  calculateSummaryStats,
  computeSessionDisplayData,
  formatDuration,
  formatSessionDate,
  formatSessionDateLocale,
  formatTotalDuration,
  getFailedCharacters,
  getTestedCharacters,
} from "./results";
import type { QuizSession, SessionGradeData } from "./quiz.types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGrade(
  hanzi: string,
  grade: SessionGradeData["grade"],
  wordId = "w1"
): SessionGradeData {
  return { wordId, hanzi, grade };
}

function makeSession(overrides: Partial<QuizSession> = {}): QuizSession {
  return {
    id: "s1",
    createdAt: new Date("2026-03-04T12:00:00.000Z").getTime(),
    sessionType: "fill-test",
    gradeData: [],
    fullyCorrectCount: 0,
    failedCount: 0,
    partiallyCorrectCount: 0,
    totalGrades: 0,
    durationSeconds: 0,
    coinsEarned: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateFullyCorrectPercent
// ---------------------------------------------------------------------------

describe("calculateFullyCorrectPercent", () => {
  it("returns 0 when totalGrades is 0", () => {
    expect(calculateFullyCorrectPercent({ fullyCorrectCount: 0, totalGrades: 0 })).toBe(0);
  });

  it("returns 100 when all grades are fully correct", () => {
    expect(calculateFullyCorrectPercent({ fullyCorrectCount: 5, totalGrades: 5 })).toBe(100);
  });

  it("returns 0 when no grades are fully correct", () => {
    expect(calculateFullyCorrectPercent({ fullyCorrectCount: 0, totalGrades: 5 })).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    // 1/3 = 33.33... → rounds to 33
    expect(calculateFullyCorrectPercent({ fullyCorrectCount: 1, totalGrades: 3 })).toBe(33);
    // 2/3 = 66.66... → rounds to 67
    expect(calculateFullyCorrectPercent({ fullyCorrectCount: 2, totalGrades: 3 })).toBe(67);
  });

  it("handles a typical session split", () => {
    expect(calculateFullyCorrectPercent({ fullyCorrectCount: 8, totalGrades: 10 })).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// calculateFailedPercent
// ---------------------------------------------------------------------------

describe("calculateFailedPercent", () => {
  it("returns 0 when totalGrades is 0", () => {
    expect(calculateFailedPercent({ failedCount: 0, totalGrades: 0 })).toBe(0);
  });

  it("returns 100 when all grades failed", () => {
    expect(calculateFailedPercent({ failedCount: 4, totalGrades: 4 })).toBe(100);
  });

  it("returns 0 when no grades failed", () => {
    expect(calculateFailedPercent({ failedCount: 0, totalGrades: 4 })).toBe(0);
  });

  it("rounds to the nearest integer", () => {
    expect(calculateFailedPercent({ failedCount: 1, totalGrades: 3 })).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// calculatePartiallyCorrectPercent
// ---------------------------------------------------------------------------

describe("calculatePartiallyCorrectPercent", () => {
  it("returns 0 when totalGrades is 0", () => {
    expect(
      calculatePartiallyCorrectPercent({ partiallyCorrectCount: 0, totalGrades: 0 })
    ).toBe(0);
  });

  it("returns 100 when all grades are partially correct", () => {
    expect(
      calculatePartiallyCorrectPercent({ partiallyCorrectCount: 6, totalGrades: 6 })
    ).toBe(100);
  });

  it("rounds to the nearest integer", () => {
    expect(
      calculatePartiallyCorrectPercent({ partiallyCorrectCount: 2, totalGrades: 3 })
    ).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// getTestedCharacters
// ---------------------------------------------------------------------------

describe("getTestedCharacters", () => {
  it("returns empty array for empty input", () => {
    expect(getTestedCharacters([])).toEqual([]);
  });

  it("returns all unique characters in first-seen order", () => {
    const grades = [
      makeGrade("你", "easy"),
      makeGrade("好", "hard"),
      makeGrade("你", "again"), // duplicate — should be omitted
    ];
    expect(getTestedCharacters(grades)).toEqual(["你", "好"]);
  });

  it("preserves insertion order", () => {
    const grades = [makeGrade("三", "easy"), makeGrade("一", "good"), makeGrade("二", "hard")];
    expect(getTestedCharacters(grades)).toEqual(["三", "一", "二"]);
  });

  it("deduplicates regardless of grade", () => {
    const grades = [
      makeGrade("水", "again"),
      makeGrade("水", "good"),
      makeGrade("水", "easy"),
    ];
    expect(getTestedCharacters(grades)).toEqual(["水"]);
  });
});

// ---------------------------------------------------------------------------
// getFailedCharacters
// ---------------------------------------------------------------------------

describe("getFailedCharacters", () => {
  it("returns empty array for empty input", () => {
    expect(getFailedCharacters([])).toEqual([]);
  });

  it("returns only characters graded 'again'", () => {
    const grades = [
      makeGrade("你", "again"),
      makeGrade("好", "easy"),
      makeGrade("他", "hard"),
      makeGrade("她", "again"),
    ];
    expect(getFailedCharacters(grades)).toEqual(["你", "她"]);
  });

  it("deduplicates failed characters, keeping first occurrence", () => {
    const grades = [
      makeGrade("失", "again"),
      makeGrade("失", "again"), // second occurrence — omitted
    ];
    expect(getFailedCharacters(grades)).toEqual(["失"]);
  });

  it("does not include 'hard' or 'good' grades", () => {
    const grades = [makeGrade("好", "good"), makeGrade("难", "hard")];
    expect(getFailedCharacters(grades)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  it("returns '<1s' for zero seconds", () => {
    expect(formatDuration(0)).toBe("<1s");
  });

  it("returns '<1s' for fractional seconds below 1", () => {
    expect(formatDuration(0.9)).toBe("<1s");
  });

  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(1)).toBe("1s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(272)).toBe("4m 32s");
    expect(formatDuration(65)).toBe("1m 5s");
  });

  it("formats hours and minutes (omits seconds)", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(3720)).toBe("1h 2m");
  });

  it("formats hours without minutes when minutes is 0", () => {
    expect(formatDuration(7200)).toBe("2h");
  });
});

// ---------------------------------------------------------------------------
// formatSessionDate
// ---------------------------------------------------------------------------

describe("formatSessionDate", () => {
  it("formats a known timestamp to en-US short date", () => {
    // 2026-03-04T12:00:00Z — noon UTC so local date is March 4 in most timezones
    const ts = new Date("2026-03-04T12:00:00.000Z").getTime();
    const result = formatSessionDate(ts);
    expect(result).toContain("2026");
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/4/);
  });

  it("returns a non-empty string", () => {
    expect(formatSessionDate(Date.now()).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// formatSessionDateLocale
// ---------------------------------------------------------------------------

describe("formatSessionDateLocale", () => {
  const ts = new Date("2026-03-04T12:00:00.000Z").getTime();

  it("returns en-US format for locale 'en'", () => {
    const result = formatSessionDateLocale(ts, "en");
    expect(result).toContain("2026");
    expect(result).toMatch(/Mar/);
  });

  it("returns zh-CN format for locale 'zh'", () => {
    const result = formatSessionDateLocale(ts, "zh");
    // zh-CN format contains year digits and numeric separators
    expect(result).toContain("2026");
    expect(result).toMatch(/3|03/); // month — numeric
  });

  it("falls back to en-US for unknown locales", () => {
    const result = formatSessionDateLocale(ts, "fr");
    // Unknown locale falls through to formatSessionDate (en-US)
    expect(result).toContain("2026");
    expect(result).toMatch(/Mar/);
  });
});

// ---------------------------------------------------------------------------
// formatTotalDuration
// ---------------------------------------------------------------------------

describe("formatTotalDuration", () => {
  it("returns '0m' for zero seconds", () => {
    expect(formatTotalDuration(0)).toBe("0m");
  });

  it("formats minutes only when under one hour", () => {
    expect(formatTotalDuration(60)).toBe("1m");
    expect(formatTotalDuration(2700)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatTotalDuration(3660)).toBe("1h 1m");
    expect(formatTotalDuration(7320)).toBe("2h 2m");
  });

  it("formats hours without minutes when minutes is 0", () => {
    expect(formatTotalDuration(3600)).toBe("1h");
    expect(formatTotalDuration(7200)).toBe("2h");
  });
});

// ---------------------------------------------------------------------------
// computeSessionDisplayData
// ---------------------------------------------------------------------------

describe("computeSessionDisplayData", () => {
  it("produces correct percentages for a typical session", () => {
    const session = makeSession({
      fullyCorrectCount: 7,
      failedCount: 2,
      partiallyCorrectCount: 1,
      totalGrades: 10,
      durationSeconds: 272,
      gradeData: [
        makeGrade("你", "easy"),
        makeGrade("好", "again"),
        makeGrade("他", "again"),
        makeGrade("她", "hard"),
      ],
    });

    const result = computeSessionDisplayData(session);

    expect(result.fullyCorrectPercent).toBe(70);
    expect(result.failedPercent).toBe(20);
    expect(result.partiallyCorrectPercent).toBe(10);
  });

  it("populates charactersTested with unique hanzi in order", () => {
    const session = makeSession({
      gradeData: [makeGrade("一", "easy"), makeGrade("二", "good"), makeGrade("一", "again")],
    });

    const result = computeSessionDisplayData(session);
    expect(result.charactersTested).toEqual(["一", "二"]);
  });

  it("populates charactersFailed with only 'again' hanzi", () => {
    const session = makeSession({
      gradeData: [makeGrade("错", "again"), makeGrade("对", "easy")],
    });

    const result = computeSessionDisplayData(session);
    expect(result.charactersFailed).toEqual(["错"]);
  });

  it("formats durationDisplay correctly", () => {
    const session = makeSession({ durationSeconds: 272 });
    expect(computeSessionDisplayData(session).durationDisplay).toBe("4m 32s");
  });

  it("returns a non-empty sessionDate string", () => {
    const session = makeSession({
      createdAt: new Date("2026-03-04T12:00:00.000Z").getTime(),
    });
    expect(computeSessionDisplayData(session).sessionDate.length).toBeGreaterThan(0);
  });

  it("passes locale through to date formatting", () => {
    const session = makeSession({
      createdAt: new Date("2026-03-04T12:00:00.000Z").getTime(),
    });
    const en = computeSessionDisplayData(session, "en");
    const zh = computeSessionDisplayData(session, "zh");
    // zh-CN format differs from en-US
    expect(en.sessionDate).not.toBe(zh.sessionDate);
  });

  it("spreads all original session fields into the result", () => {
    const session = makeSession({ id: "abc123", coinsEarned: 42 });
    const result = computeSessionDisplayData(session);
    expect(result.id).toBe("abc123");
    expect(result.coinsEarned).toBe(42);
  });

  it("handles an empty session (zero grades)", () => {
    const session = makeSession({ totalGrades: 0 });
    const result = computeSessionDisplayData(session);
    expect(result.fullyCorrectPercent).toBe(0);
    expect(result.failedPercent).toBe(0);
    expect(result.partiallyCorrectPercent).toBe(0);
    expect(result.charactersTested).toEqual([]);
    expect(result.charactersFailed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateSummaryStats
// ---------------------------------------------------------------------------

describe("calculateSummaryStats", () => {
  it("returns all-zero stats for an empty session array", () => {
    const result = calculateSummaryStats([]);
    expect(result).toEqual({
      totalSessions: 0,
      fullyCorrectPercent: 0,
      failedPercent: 0,
      partiallyCorrectPercent: 0,
      totalCharactersTested: 0,
      totalCharactersFailed: 0,
      totalDurationSeconds: 0,
      totalCoinsEarned: 0,
    });
  });

  it("calculates weighted accuracy across multiple sessions", () => {
    // Session 1: 8 easy / 10 total
    // Session 2: 2 easy / 10 total
    // Combined: 10 / 20 = 50%
    const sessions = [
      makeSession({ fullyCorrectCount: 8, failedCount: 1, partiallyCorrectCount: 1, totalGrades: 10 }),
      makeSession({ fullyCorrectCount: 2, failedCount: 7, partiallyCorrectCount: 1, totalGrades: 10 }),
    ];

    const result = calculateSummaryStats(sessions);
    expect(result.fullyCorrectPercent).toBe(50);
    expect(result.failedPercent).toBe(40); // (1+7)/20 = 40%
    expect(result.partiallyCorrectPercent).toBe(10); // (1+1)/20 = 10%
  });

  it("deduplicates tested characters across sessions", () => {
    const sessions = [
      makeSession({ gradeData: [makeGrade("你", "easy"), makeGrade("好", "easy")] }),
      makeSession({ gradeData: [makeGrade("好", "easy"), makeGrade("他", "easy")] }), // "好" shared
    ];

    const result = calculateSummaryStats(sessions);
    expect(result.totalCharactersTested).toBe(3); // 你, 好, 他
  });

  it("deduplicates failed characters across sessions", () => {
    const sessions = [
      makeSession({ gradeData: [makeGrade("错", "again")] }),
      makeSession({ gradeData: [makeGrade("错", "again"), makeGrade("误", "again")] }),
    ];

    const result = calculateSummaryStats(sessions);
    expect(result.totalCharactersFailed).toBe(2); // 错, 误
  });

  it("sums duration and coins across sessions", () => {
    const sessions = [
      makeSession({ durationSeconds: 100, coinsEarned: 5 }),
      makeSession({ durationSeconds: 200, coinsEarned: 10 }),
    ];

    const result = calculateSummaryStats(sessions);
    expect(result.totalDurationSeconds).toBe(300);
    expect(result.totalCoinsEarned).toBe(15);
  });

  it("counts total sessions correctly", () => {
    const sessions = [makeSession(), makeSession(), makeSession()];
    expect(calculateSummaryStats(sessions).totalSessions).toBe(3);
  });

  it("handles a single session correctly", () => {
    const session = makeSession({
      fullyCorrectCount: 3,
      failedCount: 1,
      partiallyCorrectCount: 1,
      totalGrades: 5,
      durationSeconds: 90,
      coinsEarned: 3,
      gradeData: [
        makeGrade("一", "easy"),
        makeGrade("二", "again"),
        makeGrade("三", "good"),
      ],
    });

    const result = calculateSummaryStats([session]);
    expect(result.totalSessions).toBe(1);
    expect(result.fullyCorrectPercent).toBe(60);
    expect(result.failedPercent).toBe(20);
    expect(result.partiallyCorrectPercent).toBe(20);
    expect(result.totalCharactersTested).toBe(3);
    expect(result.totalCharactersFailed).toBe(1);
    expect(result.totalDurationSeconds).toBe(90);
    expect(result.totalCoinsEarned).toBe(3);
  });

  it("handles sessions with no gradeData entries", () => {
    const sessions = [
      makeSession({ totalGrades: 0, gradeData: [] }),
      makeSession({ totalGrades: 0, gradeData: [] }),
    ];

    const result = calculateSummaryStats(sessions);
    expect(result.totalCharactersTested).toBe(0);
    expect(result.totalCharactersFailed).toBe(0);
    expect(result.fullyCorrectPercent).toBe(0);
  });
});
